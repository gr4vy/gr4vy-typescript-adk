import React, { useState, useEffect } from "react";
import type { CartItem, CartData } from "../shared/types";
import {
  waitForToolOutput,
  getWidgetState,
  setWidgetState,
  sendFollowUp,
  onToolResult,
} from "../shared/openai-bridge";

export function App() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore from widget state
    const saved = getWidgetState<{ items: CartItem[] }>();
    if (saved?.items) setItems(saved.items);

    waitForToolOutput<CartData>().then((data) => {
      if (data?.items) {
        setItems((prev) => mergeItems(prev, data.items));
      }
      setLoading(false);
    });

    const unsub = onToolResult<CartData>((data) => {
      if (data?.items) {
        setItems((prev) => mergeItems(prev, data.items));
      }
    });

    return unsub;
  }, []);

  useEffect(() => {
    setWidgetState({ items });
  }, [items]);

  function mergeItems(existing: CartItem[], incoming: CartItem[]): CartItem[] {
    const merged = [...existing];
    for (const item of incoming) {
      const idx = merged.findIndex(
        (c) => c.product_id === item.product_id
      );
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + (item.quantity || 1) };
      } else {
        merged.push({ ...item, quantity: item.quantity || 1 });
      }
    }
    return merged;
  }

  function adjustQty(index: number, delta: number) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: Math.max(0, next[index].quantity + delta) };
      if (next[index].quantity === 0) next.splice(index, 1);
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function handleCheckout() {
    const checkoutItems = items.map((i) => ({
      product_id: i.product_id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
    }));
    sendFollowUp(
      `Call the start_checkout tool with these items: ${JSON.stringify(checkoutItems)}`
    );
  }

  function handleBrowse() {
    sendFollowUp("Call the list_products tool to show the product catalog.");
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        Loading cart...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>&#128722;</div>
        <p style={{ color: "#6b7280", marginBottom: 16 }}>Your cart is empty</p>
        <button
          onClick={handleBrowse}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Browse Products
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px", maxWidth: 500 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
        Shopping Cart
      </h2>

      {items.map((item, i) => (
        <div
          key={item.product_id}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 0",
            borderBottom: "1px solid #f1f5f9",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
              {item.name}
            </div>
            <div style={{ fontSize: 13, color: "#2563eb", fontWeight: 600 }}>
              ${item.price.toFixed(2)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => adjustQty(i, -1)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#fff",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              -
            </button>
            <span style={{ fontWeight: 600, fontSize: 14, minWidth: 20, textAlign: "center" }}>
              {item.quantity}
            </span>
            <button
              onClick={() => adjustQty(i, 1)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#fff",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              +
            </button>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, minWidth: 70, textAlign: "right" }}>
            ${(item.price * item.quantity).toFixed(2)}
          </div>
          <button
            onClick={() => removeItem(i)}
            style={{
              background: "none",
              border: "none",
              color: "#ef4444",
              cursor: "pointer",
              fontSize: 16,
              padding: 4,
            }}
          >
            &#10005;
          </button>
        </div>
      ))}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "12px 0",
          fontWeight: 700,
          fontSize: 16,
          borderTop: "2px solid #e5e7eb",
          marginTop: 8,
        }}
      >
        <span>Total</span>
        <span style={{ color: "#2563eb" }}>${total.toFixed(2)}</span>
      </div>

      <button
        onClick={handleCheckout}
        style={{
          width: "100%",
          padding: "10px 0",
          borderRadius: 8,
          border: "none",
          background: "#16a34a",
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          marginTop: 4,
        }}
      >
        Proceed to Checkout
      </button>
    </div>
  );
}
