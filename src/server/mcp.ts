import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { resolve } from "path";

import { queryProducts, getAllCategories } from "./services/chroma.js";
import { generateEmbedToken } from "./services/purchases.js";
import { getProductById } from "./data/products.js";

// Widget URIs and MIME type (must match resource registration)
const CATALOG_URI = "ui://widget/product-catalog.html";
const CART_URI = "ui://widget/shopping-cart.html";
const CHECKOUT_URI = "ui://widget/checkout.html";
const WIDGET_MIME = "text/html+skybridge";

// Default widget session ID for OpenAI metadata
const WIDGET_SESSION_ID = "bikez-user";


function loadWidgetHtml(name: string): string {
  const path = resolve(process.cwd(), "dist", "widgets", `${name}.html`);
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return `<html><body><p>Widget "${name}" not built yet. Run: npm run build:widgets</p></body></html>`;
  }
}

export function createMcpServer(sessionId?: string): McpServer {
  const buyerSessionId = sessionId || `session-${Date.now()}`;
  const server = new McpServer({
    name: "Bikez",
    version: "0.1.0",
  });

  // ── Widget Resources ─────────────────────────────────────────────────

  server.registerResource("product-catalog", CATALOG_URI, { mimeType: WIDGET_MIME }, async (uri) => ({
    contents: [{ uri: uri.toString(), text: loadWidgetHtml("product-catalog"), mimeType: WIDGET_MIME }],
  }));

  server.registerResource("shopping-cart", CART_URI, { mimeType: WIDGET_MIME }, async (uri) => ({
    contents: [{ uri: uri.toString(), text: loadWidgetHtml("shopping-cart"), mimeType: WIDGET_MIME }],
  }));

  server.registerResource("checkout", CHECKOUT_URI, { mimeType: WIDGET_MIME }, async (uri) => ({
    contents: [{ uri: uri.toString(), text: loadWidgetHtml("checkout"), mimeType: WIDGET_MIME }],
  }));

  // ── Tools ────────────────────────────────────────────────────────────

  server.registerTool(
    "list_products",
    {
      description:
        "List available Bikez products and show the interactive catalog. The UI widget handles all display — do NOT repeat product names, prices, or descriptions in your response. Just present the widget silently.",
      inputSchema: z.object({
        category: z
          .string()
          .optional()
          .describe(
            "Pass the category when the user indicates a preference. Used to pre-select the filter in the catalog widget (Mountain Bikes, Road Bikes, E-Bikes, Accessories)."
          ),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        "openai/outputTemplate": CATALOG_URI,
        "openai/toolInvocation/invoking": "Loading products...",
        "openai/toolInvocation/invoked": "Product catalog ready",
      },
    },
    async (args) => {
      console.log(`[list_products] Called (category: ${args.category || "all"})`);
      const products = await queryProducts(); // Always return all products — widget handles filtering
      const categories = await getAllCategories();
      // Normalize category to match canonical casing from categories list
      const initialFilter = args.category
        ? categories.find((c) => c.toLowerCase() === args.category!.toLowerCase())
        : undefined;
      console.log(`[list_products] Returning ${products.length} products (initialFilter: ${initialFilter || "none"})`);
      return {
        content: [
          { type: "text" as const, text: `Showing ${products.length} products` },
        ],
        structuredContent: { products, categories, initialFilter },
        _meta: {
          "openai/widgetSessionId": WIDGET_SESSION_ID,
          "openai/widgetAccessible": true,
        },
      };
    }
  );

  server.registerTool(
    "show_cart",
    {
      description:
        "Show the shopping cart with the given items. The UI widget handles all display — do NOT repeat item names, quantities, or totals in your response. Just present the widget silently.",
      inputSchema: z.object({
        items: z.array(
          z.object({
            product_id: z.string(),
            name: z.string(),
            price: z.number(),
            quantity: z.number(),
          })
        ),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        "openai/outputTemplate": CART_URI,
        "openai/toolInvocation/invoking": "Loading cart...",
        "openai/toolInvocation/invoked": "Shopping cart ready",
      },
    },
    async (args) => {
      console.log(`[show_cart] Called with ${args.items.length} item(s)`);
      return {
        content: [
          { type: "text" as const, text: `Cart has ${args.items.length} item(s)` },
        ],
        structuredContent: { items: args.items },
        _meta: {
          "openai/widgetSessionId": WIDGET_SESSION_ID,
          "openai/widgetAccessible": true,
        },
      };
    }
  );

  server.registerTool(
    "start_checkout",
    {
      description:
        "Start the checkout process. Shows order summary and Gr4vy Embed for payment. This should be called when the user wants to pay for items in their cart. The user will enter payment details via the Gr4vy Embed widget. The UI widget handles all display — do NOT repeat order details or payment info in your response. Just present the widget silently.",
      inputSchema: z.object({
        items: z.array(
          z.object({
            product_id: z.string(),
            name: z.string(),
            price: z.number(),
            quantity: z.number(),
          })
        ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        "openai/outputTemplate": CHECKOUT_URI,
        "openai/toolInvocation/invoking": "Preparing checkout...",
        "openai/toolInvocation/invoked": "Checkout ready",
      },
    },
    async (args) => {
      console.log(`[start_checkout] Called with ${args.items.length} item(s):`, args.items.map(i => i.product_id));
      // Validate prices server-side using canonical product data
      const validatedItems = args.items.map((item) => {
        const product = getProductById(item.product_id);
        if (!product) {
          throw new Error(`Unknown product: ${item.product_id}`);
        }
        return {
          ...item,
          price: product.price, // Use canonical price, not model-provided
          name: product.name,
        };
      });

      // Compute total in cents from validated prices
      let totalAmount = 0;
      for (const item of validatedItems) {
        const qty = item.quantity || 1;
        totalAmount += Math.round(item.price * 100) * qty;
      }

      const gr4vyEnvironment = process.env.GR4VY_ENVIRONMENT || "sandbox";
      const checkoutItems = validatedItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitAmount: Math.round(item.price * 100),
      }));

      // Generate embed token with graceful error handling
      let embedConfig: Record<string, unknown> | null = null;
      let embedError: string | null = null;
      try {
        const embedToken = await generateEmbedToken(totalAmount, "USD", checkoutItems);
        console.log(`[start_checkout] Embed token generated (length: ${embedToken.length})`);
        embedConfig = {
          token: embedToken,
          gr4vy_id: process.env.GR4VY_ID,
          environment: gr4vyEnvironment,
          currency: "USD",
          country: "US",
          merchant_account_id: process.env.GR4VY_MERCHANT_ACCOUNT_ID,
          amount: totalAmount,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[start_checkout] Embed token generation failed:`, message);
        embedError = "Payment processing is temporarily unavailable. Please try again later.";
      }

      console.log(`[start_checkout] Returning checkout data (embed: ${embedConfig ? "ok" : "failed"})`);

      return {
        content: [
          {
            type: "text" as const,
            text: embedConfig
              ? `Checkout with ${validatedItems.length} item(s)`
              : `Checkout ready but payment form unavailable: ${embedError}`,
          },
        ],
        structuredContent: {
          items: validatedItems,
          ...(embedConfig ? { embed: embedConfig } : { embed_error: embedError }),
        },
        _meta: {
          "openai/widgetSessionId": WIDGET_SESSION_ID,
          "openai/widgetAccessible": true,
        },
      };
    }
  );

  return server;
}
