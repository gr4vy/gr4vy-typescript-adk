import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { resolve } from "path";

import { getProducts, getFilterOptions } from "./data/products.js";
import { generateEmbedToken } from "./services/purchases.js";
import { getProductById } from "./data/products.js";

// Widget URIs and MIME type (must match resource registration)
// Version suffix busts ChatGPT's resource cache on each server restart
const WIDGET_VERSION = Date.now();
const CATALOG_URI = `ui://widget/product-catalog.html?v=${WIDGET_VERSION}`;
const CART_URI = `ui://widget/shopping-cart.html?v=${WIDGET_VERSION}`;
const CHECKOUT_URI = `ui://widget/checkout.html?v=${WIDGET_VERSION}`;
const WIDGET_MIME = "text/html+skybridge";

// Default widget session ID for OpenAI metadata
const WIDGET_SESSION_ID = "plantly-user";


function loadWidgetHtml(name: string): string {
  const path = resolve(process.cwd(), "dist", "widgets", `${name}.html`);
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return `<html><body><p>Widget "${name}" not found at ${path}</p></body></html>`;
  }
}

export function createMcpServer(sessionId?: string): McpServer {
  const buyerSessionId = sessionId || `session-${Date.now()}`;
  const server = new McpServer({
    name: "Plantly",
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
        "List available Plantly plants and show the interactive catalog. Supports filtering by plant care attributes: sunlight needs, watering frequency, and climate/hardiness zone. The UI widget handles all display — do NOT repeat product names, prices, or descriptions in your response. Just present the widget silently.",
      inputSchema: z.object({
        sunlight: z
          .union([
            z.enum(["Low Light", "Indirect Light", "Full Sun"]),
            z.array(z.enum(["Low Light", "Indirect Light", "Full Sun"])),
          ])
          .optional()
          .describe("Filter by sunlight requirement — single value or array (e.g. 'Full Sun' or ['Full Sun', 'Low Light'])"),
        water: z
          .union([
            z.enum(["Low", "Moderate", "Frequent"]),
            z.array(z.enum(["Low", "Moderate", "Frequent"])),
          ])
          .optional()
          .describe("Filter by watering frequency — single value or array (e.g. 'Low' or ['Low', 'Moderate'])"),
        climate: z
          .union([
            z.enum(["Tropical", "Arid", "Temperate"]),
            z.array(z.enum(["Tropical", "Arid", "Temperate"])),
          ])
          .optional()
          .describe("Filter by climate/hardiness zone — single value or array (e.g. 'Tropical' or ['Tropical', 'Arid'])"),
        search: z
          .string()
          .optional()
          .describe("Free-text search for semantic matching against plant descriptions"),
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
      // Normalize filter values to arrays for multi-select support
      const toArray = (val: string | string[] | undefined): string[] | undefined =>
        val === undefined ? undefined : Array.isArray(val) ? val : [val];

      const initialFilters: Record<string, string[]> = {};
      const sunArr = toArray(args.sunlight);
      const waterArr = toArray(args.water);
      const climateArr = toArray(args.climate);
      if (sunArr) initialFilters.sunlight = sunArr;
      if (waterArr) initialFilters.water = waterArr;
      if (climateArr) initialFilters.climate = climateArr;

      console.log(`[list_products] Called (filters: ${JSON.stringify(initialFilters)}, search: ${args.search || "none"})`);

      // Return all products — widget handles client-side filtering.
      const products = getProducts();
      const filters = getFilterOptions();

      console.log(`[list_products] Returning ${products.length} products`);
      return {
        content: [
          { type: "text" as const, text: `Showing ${products.length} plants` },
        ],
        structuredContent: {
          products,
          filters,
          initialFilters: Object.keys(initialFilters).length > 0 ? initialFilters : undefined,
        },
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
