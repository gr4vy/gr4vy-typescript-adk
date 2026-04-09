import { useState, useEffect } from "react";
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

  useEffect(() => {
    const saved = getWidgetState<{ items: CartItem[] }>();
    if (saved?.items) setItems(saved.items);

    waitForToolOutput<CartData>().then((data) => {
      if (data?.items) {
        setItems((prev) => mergeItems(prev, data.items));
      }
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
      if (!item || !item.name) continue;
      const idx = merged.findIndex((c) => c.product_id === item.product_id);
      if (idx >= 0) {
        merged[idx] = {
          ...merged[idx],
          quantity: merged[idx].quantity + (item.quantity || 1),
        };
      } else {
        merged.push({
          product_id: item.product_id,
          name: item.name,
          price: item.price || 0,
          quantity: item.quantity || 1,
        });
      }
    }
    return merged;
  }

  function adjustQty(index: number, delta: number) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        quantity: Math.max(0, next[index].quantity + delta),
      };
      if (next[index].quantity === 0) next.splice(index, 1);
      return next;
    });
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
    sendFollowUp("Show me the product catalog");
  }

  if (items.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">{"\uD83D\uDED2"}</div>
        <p>Your cart is empty</p>
        <button onClick={handleBrowse} className="browse-btn">
          Browse Products
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="header">
        <h1>{"\uD83D\uDED2"} Your Cart</h1>
        <span className="badge">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="items">
        {items.map((item, i) => (
          <div key={item.product_id} className="item">
            <div className="item-info">
              <div className="item-name">{item.name}</div>
              <div className="item-price">${item.price.toFixed(2)} each</div>
            </div>
            <div className="item-controls">
              <button className="qty-btn" onClick={() => adjustQty(i, -1)}>
                &minus;
              </button>
              <span className="qty">{item.quantity}</span>
              <button className="qty-btn" onClick={() => adjustQty(i, 1)}>
                +
              </button>
            </div>
            <div className="item-subtotal">
              ${(item.price * item.quantity).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <hr className="divider" />

      <div className="total-row">
        <span className="total-label">Total</span>
        <span className="total-amount">${total.toFixed(2)}</span>
      </div>

      <button onClick={handleCheckout} className="checkout-btn">
        Proceed to Checkout
      </button>
    </>
  );
}
