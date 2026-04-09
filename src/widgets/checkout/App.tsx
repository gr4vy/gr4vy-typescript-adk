import { useState, useEffect, useRef } from "react";
import type { CartItem, CheckoutData, EmbedConfig } from "../shared/types";
import { waitForToolOutput, onToolResult } from "../shared/openai-bridge";

declare const gr4vy: {
  setup: (options: Record<string, unknown>) => unknown;
};

interface Transaction {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  message?: string;
  paymentMethod?: unknown;
}

export function App() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [embedConfig, setEmbedConfig] = useState<EmbedConfig | null>(null);
  const [resultHtml, setResultHtml] = useState<string | null>(null);
  const embedLoaded = useRef(false);

  useEffect(() => {
    waitForToolOutput<
      CheckoutData & { payment_result?: Transaction; embed_error?: string }
    >().then((data) => {
      handleData(data);
    });

    const unsub = onToolResult<
      CheckoutData & { payment_result?: Transaction; embed_error?: string }
    >((data) => {
      if (data) handleData(data);
    });

    return unsub;
  }, []);

  function handleData(
    data: CheckoutData & { payment_result?: Transaction; embed_error?: string }
  ) {
    console.log("[Checkout] onToolResult received:", JSON.stringify(data));

    if (data.payment_result) {
      console.log(
        "[Checkout] Payment result:",
        JSON.stringify(data.payment_result)
      );
      showResult(data.payment_result);
      return;
    }

    if (data.items) setItems(data.items);
    if (data.embed) {
      const embed = data.embed;
      console.log(
        "[Checkout] embedConfig set:",
        JSON.stringify({
          gr4vy_id: embed.gr4vy_id,
          environment: embed.environment,
          amount: embed.amount,
          currency: embed.currency,
          country: embed.country,
          merchant_account_id: embed.merchant_account_id,
          tokenLength: embed.token ? embed.token.length : 0,
        })
      );
      setEmbedConfig(embed);
    }
  }

  useEffect(() => {
    if (!embedConfig || embedLoaded.current) return;
    if (!embedConfig.gr4vy_id) return;

    const cdnUrl = `https://cdn.${embedConfig.gr4vy_id}.gr4vy.app/embed.latest.js`;
    console.log("[Checkout] Loading Embed CDN:", cdnUrl);

    const script = document.createElement("script");
    script.src = cdnUrl;
    script.onload = () => {
      console.log(
        "[Checkout] CDN script loaded. typeof gr4vy:",
        typeof gr4vy
      );
      console.log(
        "[Checkout] gr4vy object keys:",
        typeof gr4vy !== "undefined" ? Object.keys(gr4vy) : "undefined"
      );
      embedLoaded.current = true;
      initEmbed();
    };
    script.onerror = (e) => {
      console.error("[Checkout] CDN script failed to load:", cdnUrl, e);
      const el = document.getElementById("embed-container");
      if (el) {
        el.innerHTML =
          '<div style="text-align:center;padding:20px;color:#dc2626;">Failed to load payment form. Please try again.</div>';
      }
    };
    document.head.appendChild(script);
  }, [embedConfig]);

  function initEmbed() {
    if (!embedConfig) return;

    const container = document.getElementById("embed-container");
    console.log(
      "[Checkout] initEmbed: container=",
      container,
      "gr4vy defined=",
      typeof gr4vy !== "undefined"
    );

    if (!container) {
      console.error("[Checkout] initEmbed: #embed-container not found in DOM");
      return;
    }
    if (typeof gr4vy === "undefined") {
      console.error(
        "[Checkout] initEmbed: gr4vy global not defined after CDN load"
      );
      return;
    }

    const totalCents =
      embedConfig.amount ||
      Math.round(
        items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100
      );

    const cartItems = items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitAmount: Math.round(item.price * 100),
    }));

    const options: Record<string, unknown> = {
      gr4vyId: embedConfig.gr4vy_id,
      token: embedConfig.token,
      element: "#embed-container",
      form: "#payment-form",
      amount: totalCents,
      currency: embedConfig.currency || "USD",
      country: embedConfig.country || "US",
      environment: embedConfig.environment || "sandbox",
      intent: "capture",
      metadata: { api_caller: "agent" },
      cartItems,
      onComplete: (transaction: Transaction) => {
        console.log(
          "[Checkout] onComplete:",
          JSON.stringify(transaction)
        );
        showResult(transaction);
      },
      onEvent: (name: string, data: Transaction) => {
        console.log(
          "[Checkout] onEvent:",
          name,
          JSON.stringify(data)
        );
        if (name === "transactionCreated" || name === "transactionFailed") {
          showResult(data);
        }
      },
    };

    if (embedConfig.merchant_account_id) {
      options.merchantAccountId = embedConfig.merchant_account_id;
    }

    console.log(
      "[Checkout] gr4vy.setup options:",
      JSON.stringify({
        gr4vyId: options.gr4vyId,
        amount: options.amount,
        currency: options.currency,
        country: options.country,
        environment: options.environment,
        intent: options.intent,
        merchantAccountId: options.merchantAccountId,
        tokenLength: embedConfig.token ? embedConfig.token.length : 0,
        cartItems: options.cartItems,
      })
    );

    const instance = gr4vy.setup(options);
    console.log("[Checkout] gr4vy.setup returned:", instance);

    // Monitor the container for iframe injection
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          const el = node as HTMLElement;
          console.log(
            "[Checkout] DOM node added to embed-container:",
            el.tagName,
            el.id || "",
            el.className || ""
          );
          if (el.tagName === "IFRAME") {
            const iframe = el as HTMLIFrameElement;
            console.log(
              "[Checkout] Embed iframe detected: src=",
              iframe.src,
              "width=",
              iframe.width,
              "height=",
              iframe.height,
              "style.height=",
              iframe.style.height
            );
          }
        });
      });
    });
    observer.observe(container, { childList: true, subtree: true });
  }

  function showResult(transaction: Transaction) {
    const status = transaction.status || "";
    const isDeclined = status === "authorization_declined";
    const isSuccess =
      status === "capture_succeeded" ||
      status === "authorization_succeeded" ||
      status === "capture_pending" ||
      status === "processing";

    if (isSuccess) {
      const amount = transaction.amount
        ? "$" + (transaction.amount / 100).toFixed(2)
        : "";
      setResultHtml(
        '<div style="text-align:center;padding:40px 20px;">' +
          '<div style="font-size:48px;margin-bottom:16px;">\u2705</div>' +
          '<h2 style="color:#1a5c2a;margin-bottom:8px;">Payment Successful!</h2>' +
          '<p style="color:#6b7b6b;font-size:14px;">' +
          amount +
          " payment processed</p>" +
          (transaction.id
            ? '<p style="color:#9b9b9b;font-size:12px;margin-top:8px;">Transaction: ' +
              transaction.id +
              "</p>"
            : "") +
          "</div>"
      );
    } else {
      const title = isDeclined ? "Payment Declined" : "Payment Failed";
      const subtitle = isDeclined
        ? "Your transaction was declined. Please try again."
        : transaction.message || "Something went wrong";
      setResultHtml(
        '<div style="text-align:center;padding:40px 20px;">' +
          '<div style="font-size:48px;margin-bottom:16px;">\u274C</div>' +
          '<h2 style="color:#dc2626;margin-bottom:8px;">' +
          title +
          "</h2>" +
          '<p style="color:#6b7b6b;font-size:14px;">' +
          subtitle +
          "</p>" +
          "</div>"
      );
    }
  }

  if (resultHtml) {
    return <div dangerouslySetInnerHTML={{ __html: resultHtml }} />;
  }

  if (items.length === 0) {
    return (
      <div className="empty">
        <p>No items to checkout.</p>
      </div>
    );
  }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <>
      <div className="header">
        <h1>Checkout</h1>
        <p>Review your order and enter payment details</p>
      </div>

      <div className="section-title">Order Summary</div>
      <div className="order-items">
        {items.map((item) => (
          <div key={item.product_id} className="order-item">
            <div className="order-item-left">
              <span className="order-item-qty">{item.quantity}x</span>
              <span className="order-item-name">{item.name}</span>
            </div>
            <span className="order-item-price">
              ${(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
        <div className="order-total">
          <span className="order-total-label">Total</span>
          <span className="order-total-amount">${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="section-title">Payment Method</div>
      <form id="payment-form">
        <div id="embed-container"></div>
        <button type="submit" className="pay-btn">
          Pay ${total.toFixed(2)}
        </button>
      </form>
      <div className="secure-note">{"\uD83D\uDD12"} Secured by Gr4vy</div>
    </>
  );
}
