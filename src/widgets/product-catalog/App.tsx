import React, { useState, useEffect } from "react";
import type { Product, CartItem, CatalogData } from "../shared/types";
import {
  waitForToolOutput,
  getWidgetState,
  setWidgetState,
  sendFollowUp,
  onToolResult,
} from "../shared/openai-bridge";

interface CartState {
  [productId: string]: number;
}

export function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [cart, setCart] = useState<CartState>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore cart from widget state
    const saved = getWidgetState<{ cart: CartState }>();
    if (saved?.cart) setCart(saved.cart);

    // Wait for initial tool output
    waitForToolOutput<CatalogData>().then((data) => {
      if (data?.products) setProducts(data.products);
      if (data?.categories) setCategories(data.categories);
      if (data?.initialFilter) {
        const match = data.categories?.find(
          (c) => c.toLowerCase() === data.initialFilter!.toLowerCase()
        );
        if (match) setActiveFilter(match);
      }
      setLoading(false);
    });

    // Listen for subsequent tool updates
    const unsub = onToolResult<CatalogData>((data) => {
      if (data?.products) setProducts(data.products);
      if (data?.categories) setCategories(data.categories);
      if (data?.initialFilter) {
        const match = data.categories?.find(
          (c) => c.toLowerCase() === data.initialFilter!.toLowerCase()
        );
        if (match) setActiveFilter(match);
      }
    });

    return unsub;
  }, []);

  // Persist cart on change
  useEffect(() => {
    setWidgetState({ cart });
  }, [cart]);

  const filteredProducts =
    activeFilter === "All"
      ? products
      : products.filter((p) => p.category === activeFilter);

  function changeQty(productId: string, delta: number) {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: next };
    });
  }

  function getCartItems(): CartItem[] {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const p = products.find((x) => x.id === id);
        if (!p) return null;
        return {
          product_id: id,
          name: p.name,
          price: p.price,
          quantity: qty,
        };
      })
      .filter(Boolean) as CartItem[];
  }

  const cartItems = getCartItems();
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  function handleCheckout() {
    const items = getCartItems();
    sendFollowUp(
      `Call the start_checkout tool with these items: ${JSON.stringify(items)}`
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        Loading products...
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px", maxWidth: 600 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
          Bikez Catalog
        </h2>
        {cartCount > 0 && (
          <span
            style={{
              background: "#2563eb",
              color: "#fff",
              borderRadius: 12,
              padding: "2px 10px",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {cartCount} in cart
          </span>
        )}
      </div>

      {/* Category Filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {["All", ...categories].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            style={{
              padding: "4px 12px",
              borderRadius: 16,
              border: "1px solid #d1d5db",
              background: activeFilter === cat ? "#2563eb" : "#fff",
              color: activeFilter === cat ? "#fff" : "#374151",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {filteredProducts.map((product) => {
          const qty = cart[product.id] || 0;
          return (
            <div
              key={product.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {product.category}
              </span>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
                {product.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  lineHeight: 1.4,
                  flex: 1,
                }}
              >
                {product.description.length > 80
                  ? product.description.slice(0, 80) + "..."
                  : product.description}
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#2563eb",
                }}
              >
                ${product.price.toFixed(2)}
              </div>
              {qty === 0 ? (
                <button
                  onClick={() => changeQty(product.id, 1)}
                  style={{
                    padding: "6px 0",
                    borderRadius: 6,
                    border: "none",
                    background: "#2563eb",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Add to Cart
                </button>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <button
                    onClick={() => changeQty(product.id, -1)}
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
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{qty}</span>
                  <button
                    onClick={() => changeQty(product.id, 1)}
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
              )}
            </div>
          );
        })}
      </div>

      {/* Cart Summary */}
      {cartItems.length > 0 && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 14,
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 8,
              color: "#0f172a",
            }}
          >
            Cart ({cartCount} item{cartCount !== 1 ? "s" : ""})
          </div>
          {cartItems.map((item) => (
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
              fontSize: 14,
            }}
          >
            <span>Total</span>
            <span style={{ color: "#2563eb" }}>${cartTotal.toFixed(2)}</span>
          </div>
          <button
            onClick={handleCheckout}
            style={{
              width: "100%",
              marginTop: 10,
              padding: "8px 0",
              borderRadius: 8,
              border: "none",
              background: "#16a34a",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Proceed to Checkout
          </button>
        </div>
      )}
    </div>
  );
}
