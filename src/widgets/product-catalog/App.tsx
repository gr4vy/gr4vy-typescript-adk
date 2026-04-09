import { useState, useEffect } from "react";
import type { Product, CartItem, CatalogData, FilterOptions, ActiveFilters } from "../shared/types";
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

function updateModelContext(products: Product[], cart: CartState) {
  try {
    const items = Object.entries(cart)
      .map(([id, qty]) => {
        const p = products.find((x) => x.id === id);
        if (!p) return null;
        return { id, name: p.name, price: p.price, quantity: qty };
      })
      .filter(Boolean) as { id: string; name: string; price: number; quantity: number }[];
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    window.parent.postMessage(
      {
        jsonrpc: "2.0",
        method: "ui/update-model-context",
        params: { cart: items, total },
      },
      "*"
    );
  } catch (_e) {
    // ignore
  }
}

export function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ sunlight: [], water: [], climate: [] });
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [cart, setCart] = useState<CartState>({});

  function applyCatalogData(data: CatalogData) {
    console.log(`[Plantly] Received ${data?.products?.length ?? 0} products, initialFilters:`, data?.initialFilters);
    if (data?.products) setProducts(data.products);
    if (data?.filters) setFilterOptions(data.filters);
    if (data?.initialFilters) {
      // Normalize initialFilters: wrap single strings in arrays for backward compat
      const normalized: ActiveFilters = {};
      for (const key of ["sunlight", "water", "climate"] as const) {
        const val = (data.initialFilters as any)[key];
        if (val !== undefined) {
          normalized[key] = Array.isArray(val) ? val : [val];
        }
      }
      setActiveFilters(normalized);
    }
  }

  useEffect(() => {
    const saved = getWidgetState<{ cart: CartState }>();
    if (saved?.cart) setCart(saved.cart);

    waitForToolOutput<CatalogData>().then(applyCatalogData);
    const unsub = onToolResult<CatalogData>(applyCatalogData);
    return unsub;
  }, []);

  useEffect(() => {
    setWidgetState({ cart });
    updateModelContext(products, cart);
  }, [cart, products]);

  const filteredProducts = products.filter((p) => {
    if (activeFilters.sunlight?.length && !activeFilters.sunlight.includes(p.sunlight)) return false;
    if (activeFilters.water?.length && !activeFilters.water.includes(p.water)) return false;
    if (activeFilters.climate?.length && !activeFilters.climate.includes(p.climate)) return false;
    return true;
  });

  function toggleFilter(dimension: keyof ActiveFilters, value: string) {
    setActiveFilters((prev) => {
      const current = prev[dimension] || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return {
        ...prev,
        [dimension]: next.length > 0 ? next : undefined,
      };
    });
  }

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

  function removeItem(productId: string) {
    setCart((prev) => {
      const { [productId]: _, ...rest } = prev;
      return rest;
    });
  }

  function getCartItems(): CartItem[] {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const p = products.find((x) => x.id === id);
        if (!p) return null;
        return { product_id: id, name: p.name, price: p.price, quantity: qty };
      })
      .filter(Boolean) as CartItem[];
  }

  const cartItems = getCartItems();
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  function handleCheckout() {
    sendFollowUp(
      `Call the start_checkout tool with these items: ${JSON.stringify(cartItems)}`
    );
  }

  function renderFilterGroup(label: string, dimension: keyof ActiveFilters, values: string[]) {
    if (values.length === 0) return null;
    return (
      <div className="filter-group" key={dimension}>
        <span className="filter-group-label">{label}</span>
        <div className="filter-group-buttons">
          {values.map((val) => (
            <button
              key={val}
              onClick={() => toggleFilter(dimension, val)}
              className={`filter-btn${activeFilters[dimension]?.includes(val) ? " active" : ""}`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="header">
        <h1>Plantly</h1>
        <p>Find the perfect plant for your space</p>
      </div>

      <div className="filters">
        {renderFilterGroup("Sunlight", "sunlight", filterOptions.sunlight)}
        {renderFilterGroup("Water", "water", filterOptions.water)}
        {renderFilterGroup("Climate", "climate", filterOptions.climate)}
      </div>

      <div className="grid">
        {filteredProducts.map((product) => {
          const qty = cart[product.id] || 0;
          return (
            <div key={product.id} className="card">
              <img className="card-image" src={product.image} alt={product.name} />
              <div className="card-name">{product.name}</div>
              <div className="card-desc">{product.description}</div>
              <div className="attribute-tags">
                <span className="attribute-tag sunlight-tag">{product.sunlight}</span>
                <span className="attribute-tag water-tag">{product.water} Water</span>
                <span className="attribute-tag climate-tag">{product.climate}</span>
              </div>
              <div className="card-footer">
                <span className="card-price">${product.price.toFixed(2)}</span>
                {qty === 0 ? (
                  <button
                    onClick={() => changeQty(product.id, 1)}
                    className="add-btn"
                  >
                    Add
                  </button>
                ) : (
                  <div className="qty-row">
                    <button
                      onClick={() => changeQty(product.id, -1)}
                      className="qty-btn"
                    >
                      &minus;
                    </button>
                    <span className="qty-num">{qty}</span>
                    <button
                      onClick={() => changeQty(product.id, 1)}
                      className="qty-btn"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="empty">No plants match your filters.</div>
      )}

      {cartItems.length > 0 && (
        <div className="cart-section">
          <div className="cart-header">
            <div className="cart-header-left">
              <span className="cart-header-icon">&#128722;</span>
              <span className="cart-header-title">Your Cart</span>
            </div>
            <span className="cart-header-badge">
              {cartCount} item{cartCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="cart-items">
            {cartItems.map((item) => (
              <div key={item.product_id} className="cart-item">
                <img
                  className="cart-item-image"
                  src={products.find((p) => p.id === item.product_id)?.image}
                  alt={item.name}
                />
                <div className="cart-item-details">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-price">
                    ${item.price.toFixed(2)} each
                  </div>
                </div>
                <div className="cart-item-controls">
                  <button
                    className="cart-item-qty-btn"
                    onClick={() => changeQty(item.product_id, -1)}
                  >
                    &minus;
                  </button>
                  <span className="cart-item-qty">{item.quantity}</span>
                  <button
                    className="cart-item-qty-btn"
                    onClick={() => changeQty(item.product_id, 1)}
                  >
                    +
                  </button>
                </div>
                <div className="cart-item-subtotal">
                  ${(item.price * item.quantity).toFixed(2)}
                </div>
                <button
                  className="cart-item-delete"
                  onClick={() => removeItem(item.product_id)}
                  title="Remove"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <div className="cart-footer">
            <div className="cart-total-row">
              <span className="cart-total-label">Total</span>
              <span className="cart-total-amount">${cartTotal.toFixed(2)}</span>
            </div>
            <button onClick={handleCheckout} className="checkout-btn">
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </>
  );
}
