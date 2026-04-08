import React, { useState, useEffect, useRef } from "react";
import type { CartItem, CheckoutData, PaymentResult, EmbedConfig } from "../shared/types";
import {
  waitForToolOutput,
  onToolResult,
} from "../shared/openai-bridge";

declare const gr4vy: {
  setup: (options: Record<string, unknown>) => void;
};

function formatAmount(amountInCents: unknown, currency: unknown): string {
  const cents = typeof amountInCents === "number" ? amountInCents : 0;
  const cur = typeof currency === "string" ? currency : "USD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(cents / 100);
}

function extractCardInfo(paymentMethod: unknown): string | undefined {
  if (!paymentMethod || typeof paymentMethod !== "object") return undefined;
  const pm = paymentMethod as Record<string, unknown>;
  if (typeof pm.label === "string") return pm.label;
  if (typeof pm.scheme === "string") {
    const scheme = pm.scheme.charAt(0).toUpperCase() + pm.scheme.slice(1);
    return typeof pm.last4 === "string" ? `${scheme} ${pm.last4}` : scheme;
  }
  return undefined;
}

export function App() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [embedConfig, setEmbedConfig] = useState<EmbedConfig | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const embedLoaded = useRef(false);

  useEffect(() => {
    waitForToolOutput<CheckoutData & { payment_result?: PaymentResult }>().then(
      (data) => {
        handleData(data);
        setLoading(false);
      }
    );

    const unsub = onToolResult<CheckoutData & { payment_result?: PaymentResult }>(
      (data) => {
        if (data) handleData(data);
      }
    );

    return unsub;
  }, []);

  function handleData(
    data: CheckoutData & { payment_result?: PaymentResult; embed_error?: string }
  ) {
    if (data.payment_result) {
      setResult(data.payment_result);
      return;
    }
    if (data.items) setItems(data.items);
    if (data.embed) setEmbedConfig(data.embed);
    if (data.embed_error) setEmbedError(data.embed_error);
  }

  // Load Gr4vy Embed when config arrives
  useEffect(() => {
    if (!embedConfig || embedLoaded.current) return;
    if (!embedConfig.gr4vy_id) return;

    const cdnUrl = `https://cdn.${embedConfig.gr4vy_id}.gr4vy.app/embed.latest.js`;
    const script = document.createElement("script");
    script.src = cdnUrl;
    script.onload = () => {
      embedLoaded.current = true;
      initEmbed();
    };
    script.onerror = () => {
      console.warn("Failed to load Gr4vy Embed script");
      setEmbedError("Payment form could not be loaded. Please try again later.");
    };
    document.head.appendChild(script);
  }, [embedConfig]);

  function initEmbed() {
    if (!embedConfig || typeof gr4vy === "undefined") return;

    // Only pass fields that match what's pinned in the JWT embed token.
    // amount, currency, buyerExternalIdentifier, merchantAccountId, and
    // cartItems are all pinned in the token — passing mismatched values
    // to setup() causes "Request failed validation".
    gr4vy.setup({
      gr4vyId: embedConfig.gr4vy_id,
      token: embedConfig.token,
      element: "#embed-container",
      form: "#payment-form",
      amount: embedConfig.amount,
      currency: embedConfig.currency || "USD",
      country: embedConfig.country || "US",
      environment: embedConfig.environment || "sandbox",
      intent: "capture",
      merchantAccountId: embedConfig.merchant_account_id || undefined,
      onComplete: (transaction: Record<string, unknown>) => {
        console.log("[Gr4vy Embed] onComplete fired. Raw transaction:", JSON.stringify(transaction, null, 2));
        console.log("[Gr4vy Embed] onComplete transaction keys:", Object.keys(transaction));
        console.log("[Gr4vy Embed] onComplete status:", transaction.status);
        setResult({
          transaction_id: transaction.id as string | undefined,
          status: (transaction.status as string) || "capture_succeeded",
          amount: formatAmount(transaction.amount, transaction.currency),
          card: extractCardInfo(transaction.paymentMethod),
        });
      },
      onEvent: (name: string, data: Record<string, unknown>) => {
        console.log("[Gr4vy Embed] onEvent fired. Name:", name, "Data:", JSON.stringify(data, null, 2));
        if (name === "transactionFailed") {
          setResult({
            transaction_id: data.id as string | undefined,
            status: (data.status as string) || "capture_failed",
            message: (data.message as string) || "Transaction failed",
          });
        }
        if (name === "argumentError" || name === "apiError") {
          console.error(`[Gr4vy Embed] ${name}:`, data);
          setEmbedError(String(data.message || "Payment configuration error"));
        }
      },
    });
  }

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        Preparing checkout...
      </div>
    );
  }

  // Payment result screen
  if (result) {
    const isSuccess = [
      "capture_succeeded",
      "authorization_succeeded",
      "capture_pending",
      "processing",
    ].includes(result.status);
    console.log("[Gr4vy Embed] Rendering result. status:", result.status, "isSuccess:", isSuccess, "Full result:", JSON.stringify(result));

    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          {isSuccess ? "\u2705" : "\u274C"}
        </div>
        <h2
          style={{
            color: isSuccess ? "#16a34a" : "#dc2626",
            margin: "0 0 8px",
            fontSize: 20,
          }}
        >
          {isSuccess ? "Payment Successful!" : "Payment Failed"}
        </h2>
        {result.amount && (
          <p style={{ color: "#6b7280", margin: "0 0 4px", fontSize: 15 }}>
            {result.amount} payment processed
          </p>
        )}
        {result.transaction_id && (
          <p style={{ color: "#9ca3af", margin: 0, fontSize: 12 }}>
            Transaction: {result.transaction_id}
          </p>
        )}
        {result.card && (
          <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 12 }}>
            Charged to {result.card}
          </p>
        )}
        {!isSuccess && result.message && (
          <p style={{ color: "#6b7280", marginTop: 12, fontSize: 13 }}>
            {result.message}
          </p>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "#6b7280" }}>No items to checkout.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px", maxWidth: 500 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
        Checkout
      </h2>

      {/* Order Summary */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 14,
          marginBottom: 16,
          background: "#f8fafc",
        }}
      >
        <div
          style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: "#374151" }}
        >
          Order Summary
        </div>
        {items.map((item) => (
          <div
            key={item.product_id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              marginBottom: 4,
              color: "#374151",
            }}
          >
            <span>
              {item.name} x{item.quantity}
            </span>
            <span style={{ fontWeight: 600 }}>
              ${(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            marginTop: 8,
            paddingTop: 8,
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          <span>Total</span>
          <span style={{ color: "#2563eb" }}>${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Embed error */}
      {embedError && (
        <div style={{
          padding: 16,
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 10,
          color: "#991b1b",
          fontSize: 14,
          textAlign: "center",
          marginBottom: 16,
        }}>
          {embedError}
        </div>
      )}

      {/* Gr4vy Embed Container */}
      {embedConfig && !embedError ? (
        <div>
          <form id="payment-form">
            <div id="embed-container" style={{ minHeight: 300 }} />
            <button
              type="submit"
              style={{
                width: "100%",
                marginTop: 12,
                padding: "10px 0",
                borderRadius: 8,
                border: "none",
                background: "#16a34a",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Pay ${total.toFixed(2)}
            </button>
          </form>
        </div>
      ) : !embedError && (
        <div style={{
          padding: 16,
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 10,
          color: "#92400e",
          fontSize: 14,
          textAlign: "center",
        }}>
          Payment configuration unavailable. Please try again.
        </div>
      )}
    </div>
  );
}
