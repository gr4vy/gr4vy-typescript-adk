# How-to Build a ChatGPT App Using Gr4vy Payment Orchestration

A ChatGPT app is an application that ChatGPT can present to the user within a conversation via inline frames. The application is a Model Context Protocol (MCP) server. This server makes tools (actions that can be taken) and resources (UI widgets) available to ChatGPT during a conversation. This allows merchants to build and control the user experience of their own application within ChatGPT. ChatGPT will determine when to invoke the available tools and resources as necessary throughout conversations.

This guide will demonstrate how merchants can build ChatGPT applications for e-commerce that include widgets for shopping (a product catalog), building a cart, and completing an e-commerce checkout while using the Gr4vy Embed solution to collect the payment information during checkout and orchestrating that transaction.

## Prerequisites

* Access to a Pro/Business/Team/Enterprise ChatGPT subscription to enable developer mode. Developer mode is not available in free subscriptions.
* Access to a Gr4vy Sandbox environment
* Node.js 18+ installed
* A tunneling tool such as [ngrok](https://ngrok.com) for exposing your local server to ChatGPT during development

## Setup and Installation

You can build the application using any framework or language that you desire. In this how-to guide, we will build an MCP server using TypeScript that exposes UI widgets built as React single-page applications.

### Initialize the Project

Create a new Node.js project and install the required dependencies:

```bash
mkdir my-chatgpt-store && cd my-chatgpt-store
npm init -y
```

Edit `package.json` to set the module type and add build scripts:

```json
{
  "name": "my-chatgpt-store",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server/index.ts",
    "build:server": "tsc -p tsconfig.server.json",
    "build:widgets": "tsx scripts/build-widgets.ts",
    "build": "npm run build:widgets && npm run build:server",
    "start": "node dist/server/index.js",
    "tunnel": "ngrok http 3000"
  }
}
```

Install runtime dependencies:

```bash
npm install @modelcontextprotocol/sdk express @gr4vy/sdk zod dotenv uuid
```

Install dev dependencies:

```bash
npm install -D typescript tsx vite react react-dom \
  @vitejs/plugin-react vite-plugin-singlefile \
  tailwindcss @tailwindcss/vite \
  @types/express @types/node @types/react @types/react-dom @types/uuid
```

### Configure TypeScript

Create `tsconfig.json` at the project root:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Create `tsconfig.server.json` for server-only compilation:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/server",
    "rootDir": "src/server",
    "jsx": "react-jsx"
  },
  "include": ["src/server/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Configure Environment Variables

Create a `.env` file using the values from your Gr4vy Sandbox dashboard:

```bash
# Server
PORT=3000
NODE_ENV=development

# Gr4vy Payment
GR4VY_ID=your-gr4vy-id
GR4VY_PRIVATE_KEY_PATH=./your-private-key.pem
GR4VY_MERCHANT_ACCOUNT_ID=your-merchant-account-id
GR4VY_ENVIRONMENT=sandbox

# Gr4vy Webhook (for payment verification)
GR4VY_WEBHOOK_SECRET=your-webhook-secret
```

Place the Gr4vy private key `.pem` file in your project root. You can download this from your Gr4vy dashboard under **Integrations > Private Keys**.

### Project Structure

When complete, your project should look like this:

```
my-chatgpt-store/
├── src/
│   ├── server/
│   │   ├── index.ts              # Express server + MCP transport
│   │   ├── mcp.ts                # MCP tools & resources
│   │   ├── types.ts              # Shared TypeScript interfaces
│   │   ├── data/
│   │   │   └── products.ts       # Your product catalog
│   │   └── services/
│   │       └── purchases.ts      # Gr4vy payment integration
│   └── widgets/
│       ├── shared/
│       │   ├── types.ts          # Shared widget types
│       │   └── openai-bridge.ts  # ChatGPT integration API
│       ├── product-catalog/      # Catalog browsing widget
│       ├── shopping-cart/        # Cart management widget
│       └── checkout/             # Checkout + Gr4vy Embed widget
├── scripts/
│   └── build-widgets.ts          # Widget build orchestrator
├── dist/                         # Compiled output (generated)
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── vite.config.ts
└── .env
```

---

## Building the Application

### Building an MCP Server

#### How MCP Works

The Model Context Protocol (MCP) is an open protocol that standardizes how AI models discover and interact with external applications. Think of it as a contract between your application and ChatGPT: your server declares what it can do, and ChatGPT decides when and how to use those capabilities during a conversation.

MCP defines two core primitives:

- **Tools** are actions that ChatGPT can invoke on your behalf. A tool has a name, a description (which ChatGPT reads to understand *when* to use it), an input schema (which tells ChatGPT *what parameters* to pass), and a handler function (which runs your business logic). For an e-commerce app, your tools might include listing products, showing a cart, and starting a checkout.

- **Resources** are content that ChatGPT can present to the user. In the context of a ChatGPT app, resources are HTML files that get embedded as interactive iframes directly in the conversation. These are your UI widgets — the product catalog, shopping cart, and checkout form that the user sees and interacts with.

When a user installs your app, ChatGPT connects to your MCP server, discovers your available tools and resources, and then uses them naturally throughout conversations. The key insight is that **you define the capabilities, but ChatGPT decides when to invoke them** based on the conversation context. If a user says "show me what you have," ChatGPT reads your tool descriptions, determines that `list_products` is the right tool to call, and invokes it.

Here is what a single interaction looks like end-to-end:

```
1. User says: "What top rated plants do you sell?"

2. ChatGPT reads your tool descriptions and decides to call list_products(category: "Top Rated")

3. Your MCP server receives the tool call, queries your product catalog, and returns:
   - A text summary ("Showing 4 products") for ChatGPT's conversational context
   - Structured data (the product array) for the widget to render
   - Metadata pointing to the product catalog widget

4. ChatGPT fetches the product catalog resource (a self-contained HTML file)
   and embeds it as an iframe in the conversation

5. The widget receives the structured data and renders an interactive product grid

6. The user browses products and adds items to their cart — all within the widget,
   with no further round-trips to ChatGPT until the user triggers a new action
```

#### Anatomy of a ChatGPT MCP App

A ChatGPT MCP app has three layers:

```
┌─────────────────────────────────────────────────────┐
│                     ChatGPT                         │
│                                                     │
│  Discovers tools & resources from your MCP server.  │
│  Invokes tools based on conversation context.       │
│  Embeds resource widgets as iframes in the chat.    │
└──────────┬──────────────────────────┬───────────────┘
           │ MCP Protocol (HTTP)      │ iframe
           │                          │
┌──────────▼──────────┐   ┌──────────▼───────────────┐
│    Your MCP Server  │   │   Your Widgets (iframes)  │
│                     │   │                           │
│  Express HTTP layer │   │  Self-contained React     │
│  MCP tools          │   │  single-page apps that    │
│  MCP resources      │   │  render your UI.          │
│  Business logic     │   │                           │
│  (products, Gr4vy)  │   │  Receive data from tools  │
│                     │   │  via window.openai API.   │
└─────────────────────┘   └───────────────────────────┘
```

**Why tools and resources are separate.** Tools contain your server-side logic — querying databases, validating prices, calling payment APIs. Resources contain your client-side UI — the HTML, CSS, and JavaScript that renders in the user's browser. This separation mirrors a traditional web application where the backend API and the frontend are distinct concerns. The MCP protocol is the bridge: a tool's return value includes both a text response for ChatGPT and structured data that gets forwarded to a widget.

**Why widgets must be self-contained HTML.** ChatGPT embeds your widgets as iframes using a special MIME type (`text/html+skybridge`). Because the widget loads inside ChatGPT's UI, it cannot make external HTTP requests to load CSS or JavaScript files from your server. Everything — HTML, CSS, JavaScript, and any framework code (React, etc.) — must be inlined into a single HTML file. This is why we use `vite-plugin-singlefile` during the build process.

**How tools connect to widgets.** This is the critical mechanism that makes the whole system work. When a tool returns its result, it includes three things:

1. **`content`** — A text summary that becomes part of ChatGPT's conversation context. ChatGPT can reference this in its response, but for widget-based tools you typically keep this minimal (e.g., "Showing 14 products") since the widget handles the display.

2. **`structuredContent`** — A JSON object containing the actual data for the widget. This is the data bridge between your server and your widget. For a product catalog, this would be the array of products. For checkout, this would include the Gr4vy embed token. ChatGPT forwards this data to the widget, where it becomes available as `window.openai.toolOutput`.

3. **`_meta`** — Metadata that tells ChatGPT *which* widget to render and *how*. The most important field is `openai/outputTemplate`, which contains the URI of the resource (widget) to embed. When ChatGPT sees this, it fetches the corresponding resource HTML and renders it as an iframe, passing the `structuredContent` into the iframe.

This three-part return value is the core pattern you'll see in every tool:

```
Tool is called by ChatGPT
    │
    ▼
Your handler runs (query DB, call APIs, validate data)
    │
    ▼
Return: {
  content:           "text for ChatGPT's context"
  structuredContent:  { data for the widget }
  _meta:             { "openai/outputTemplate": "ui://widget/your-widget.html" }
}
    │
    ├──► ChatGPT reads `content` for conversation context
    ├──► ChatGPT reads `_meta` to know which widget to embed
    └──► ChatGPT passes `structuredContent` to the widget as `window.openai.toolOutput`
```

#### Step 1: Define Your Data Types

With the architecture in mind, let's build the server. Start with the shared TypeScript interfaces that both your server and widgets will use.

Create `src/server/types.ts`:

```typescript
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  image?: string;
}

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface EmbedConfig {
  token: string;
  gr4vy_id: string;
  environment: string;
  currency: string;
  country: string;
  merchant_account_id: string;
  amount: number;
}
```

#### Step 2: Define Your Product Catalog

Create `src/server/data/products.ts`. This is the canonical source of truth for product names and pricing. It matters for security: later, when the checkout tool processes a purchase, it will look up prices from this catalog rather than trusting whatever ChatGPT or the widget sends. This prevents price tampering.

```typescript
import type { Product } from "../types.js";

export const PRODUCTS: Product[] = [
  {
    id: "product-1",
    name: "My Product",
    category: "My Category",
    price: 49.99,
    description: "Description of my product.",
  },
  // Add more products...
];

export function getProducts(category?: string): Product[] {
  if (category) {
    return PRODUCTS.filter(
      (p) => p.category.toLowerCase() === category.toLowerCase()
    );
  }
  return PRODUCTS;
}

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getCategories(): string[] {
  return [...new Set(PRODUCTS.map((p) => p.category))].sort();
}
```

#### Step 3: Create the HTTP Server

The MCP protocol communicates over HTTP. ChatGPT sends requests to a single endpoint (`/mcp`) on your server, and the MCP SDK handles the protocol serialization. You need an Express server that:

- Accepts MCP requests on `POST /mcp` (tool calls and session initialization)
- Serves SSE streams on `GET /mcp` (for streaming responses back to ChatGPT)
- Handles session cleanup on `DELETE /mcp`
- Manages session state so each ChatGPT conversation gets its own isolated context

Create `src/server/index.ts`:

```typescript
import "dotenv/config";
import express from "express";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcp.js";
import { handleWebhook } from "./services/purchases.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  const app = express();

  // Parse JSON for all routes except webhooks (which need raw text for signature verification)
  app.use((req, res, next) => {
    if (req.path === "/webhooks/gr4vy") return next();
    express.json()(req, res, next);
  });

  // Track MCP sessions in memory
  const sessions = new Map<string, { transport: StreamableHTTPServerTransport }>();
```

**Session management.** Each ChatGPT conversation establishes its own MCP session. The first `POST /mcp` request from a new conversation has no session ID, so your server creates one. Subsequent requests include the session ID in the `mcp-session-id` header. The `StreamableHTTPServerTransport` from the MCP SDK handles all protocol-level concerns (JSON-RPC serialization, session negotiation, SSE framing) — you just need to wire it into Express:

```typescript
  // MCP endpoint — all MCP communication happens through this single path
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // If the request includes a known session ID, route to that session's transport
    if (sessionId && sessions.has(sessionId)) {
      const { transport } = sessions.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // No session ID (or unknown ID) — this is a new conversation.
    // Create a new session with its own MCP server instance.
    const newSessionId = randomUUID();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: (id) => {
        sessions.set(id, { transport });
      },
    });

    transport.onclose = () => {
      const id = [...sessions.entries()]
        .find(([, v]) => v.transport === transport)?.[0];
      if (id) sessions.delete(id);
    };

    // Create a fresh MCP server for this session and connect it to the transport
    const server = createMcpServer(newSessionId);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
```

**SSE and session cleanup.** ChatGPT also uses `GET /mcp` for Server-Sent Events (SSE) streaming — this allows your server to push updates to ChatGPT in real time. `DELETE /mcp` lets ChatGPT cleanly close a session when the conversation ends:

```typescript
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: "Invalid or missing session ID" });
      return;
    }
    const { transport } = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: "Invalid or missing session ID" });
      return;
    }
    const { transport } = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
  });
```

**Health check and webhook.** Add a health check endpoint (useful for monitoring) and a Gr4vy webhook endpoint for payment verification. The webhook endpoint uses `express.text()` instead of `express.json()` because Gr4vy's webhook signature verification requires the raw request body:

```typescript
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/webhooks/gr4vy", express.text({ type: "*/*" }), (req, res) => {
    try {
      const signature = req.headers["x-gr4vy-signature"] as string | undefined;
      const timestamp = req.headers["x-gr4vy-timestamp"] as string | undefined;
      const event = handleWebhook(req.body, signature, timestamp);
      res.status(200).json({ received: true });
    } catch (err) {
      res.status(400).json({ error: "Webhook verification failed" });
    }
  });

  app.listen(PORT, () => {
    console.log(`MCP Server running at http://localhost:${PORT}`);
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
```

At this point you have a running HTTP server, but it delegates to `createMcpServer()` — a function that doesn't exist yet. That's where the tools and resources live.

#### Step 4: Register Tools and Resources

Create `src/server/mcp.ts`. This is the heart of your application — it defines what your ChatGPT app can do (tools) and what it can show (resources).

Start with the imports, constants, and a helper to load widget HTML files from disk:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { resolve } from "path";

import { queryProducts, getAllCategories } from "./services/chroma.js";
import { generateEmbedToken } from "./services/purchases.js";
import { getProductById } from "./data/products.js";
```

**Widget URIs and the `skybridge` MIME type.** Each widget resource needs a URI that tools can reference, and a special MIME type that tells ChatGPT "this is an embeddable widget, not a regular HTML page":

```typescript
const CATALOG_URI = "ui://widget/product-catalog.html";
const CART_URI = "ui://widget/shopping-cart.html";
const CHECKOUT_URI = "ui://widget/checkout.html";
const WIDGET_MIME = "text/html+skybridge";
```

The `ui://` scheme is a convention — these URIs don't correspond to real URLs. They're identifiers that connect a tool's `_meta.openai/outputTemplate` to a registered resource.

**Widget session ID.** ChatGPT uses this identifier to persist widget state (like cart contents) across tool invocations within the same conversation. All widgets in the same session share state under this ID:

```typescript
const WIDGET_SESSION_ID = "my-store-user";
```

**Loading widget HTML.** The `loadWidgetHtml` helper reads the pre-built, self-contained HTML files from `dist/widgets/`. If the widgets haven't been built yet, it returns a helpful error message instead of crashing:

```typescript
function loadWidgetHtml(name: string): string {
  const path = resolve(process.cwd(), "dist", "widgets", `${name}.html`);
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return `<html><body><p>Widget "${name}" not built yet. Run: npm run build:widgets</p></body></html>`;
  }
}
```

**Create the MCP server.** The `McpServer` class from the MCP SDK handles protocol serialization and tool dispatch. You give it a name and version, then register your resources and tools:

```typescript
export function createMcpServer(sessionId?: string): McpServer {
  const server = new McpServer({
    name: "Plantly",
    version: "0.1.0",
  });
```

##### Registering Resources (Widgets)

Resources are registered with a name, a URI, metadata (the MIME type), and a handler that returns the content. Each resource serves one of your widget HTML files. When ChatGPT needs to display a widget, it fetches the resource by URI and gets back the full self-contained HTML:

```typescript
  server.registerResource(
    "product-catalog",               // Resource name
    CATALOG_URI,                      // URI that tools reference in _meta
    { mimeType: WIDGET_MIME },        // text/html+skybridge
    async (uri) => ({
      contents: [{
        uri: uri.toString(),
        text: loadWidgetHtml("product-catalog"),
        mimeType: WIDGET_MIME,
      }],
    })
  );

  server.registerResource("shopping-cart", CART_URI, { mimeType: WIDGET_MIME }, async (uri) => ({
    contents: [{ uri: uri.toString(), text: loadWidgetHtml("shopping-cart"), mimeType: WIDGET_MIME }],
  }));

  server.registerResource("checkout", CHECKOUT_URI, { mimeType: WIDGET_MIME }, async (uri) => ({
    contents: [{ uri: uri.toString(), text: loadWidgetHtml("checkout"), mimeType: WIDGET_MIME }],
  }));
```

##### Registering Tools

Each tool registration has three parts: a **name**, a **configuration object**, and a **handler function**.

The configuration object is particularly important because ChatGPT relies on it heavily:

- **`description`** — ChatGPT reads this to decide *when* to invoke the tool. Write it clearly and specifically. If you want the widget to handle all display, say so in the description — otherwise ChatGPT may repeat product details in its text response.
- **`inputSchema`** — A Zod schema that defines the tool's parameters. ChatGPT uses this to know *what data to pass* when invoking the tool. Zod provides both runtime validation and schema generation.
- **`annotations`** — Hints that tell ChatGPT about the tool's behavior:
  - `readOnlyHint: true` means the tool doesn't change any state (safe to call speculatively)
  - `destructiveHint: true` means the tool makes irreversible changes
  - `openWorldHint: true` means the tool interacts with external services (like a payment API)
- **`_meta`** — OpenAI-specific metadata:
  - `openai/outputTemplate` — the resource URI of the widget to render when this tool is called
  - `openai/toolInvocation/invoking` — loading text shown while the tool is executing
  - `openai/toolInvocation/invoked` — text shown when the tool completes

**The `list_products` tool.** This tool queries your product catalog and returns the data for the catalog widget to render:

```typescript
  server.registerTool(
    "list_products",
    {
      description:
        "List available Plantly products and show the interactive catalog. "
        + "The UI widget handles all display — do NOT repeat product names, "
        + "prices, or descriptions in your response. Just present the widget silently.",
      inputSchema: z.object({
        category: z
          .string()
          .optional()
          .describe(
            "Pass the category when the user indicates a preference. "
            + "Used to pre-select the filter in the catalog widget "
            + "(Top Rated, Essentials, Accessories)."
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
```

The handler function receives the validated arguments and returns the three-part response (content, structuredContent, _meta) described earlier:

```typescript
    async (args) => {
      const products = await queryProducts();
      const categories = await getAllCategories();

      return {
        // Text for ChatGPT's conversational context
        content: [
          { type: "text" as const, text: `Showing ${products.length} products` },
        ],
        // Data forwarded to the widget via window.openai.toolOutput
        structuredContent: { products, categories, initialFilter: args.category },
        // Widget rendering instructions
        _meta: {
          "openai/widgetSessionId": WIDGET_SESSION_ID,
          "openai/widgetAccessible": true,
        },
      };
    }
  );
```

Note how the `_meta` on the tool *configuration* (`openai/outputTemplate: CATALOG_URI`) tells ChatGPT which widget to embed, while the `_meta` on the *return value* (`openai/widgetSessionId`, `openai/widgetAccessible`) tells ChatGPT how to manage the widget's state and interactivity.

**The `show_cart` tool.** Similar pattern — receives cart items and passes them to the shopping cart widget:

```typescript
  server.registerTool(
    "show_cart",
    {
      description:
        "Show the shopping cart with the given items. The UI widget handles all display "
        + "— do NOT repeat item names, quantities, or totals in your response.",
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
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/outputTemplate": CART_URI,
        "openai/toolInvocation/invoking": "Loading cart...",
        "openai/toolInvocation/invoked": "Shopping cart ready",
      },
    },
    async (args) => {
      return {
        content: [
          { type: "text" as const, text: `Cart has ${args.items.length} item(s)` },
        ],
        structuredContent: { items: args.items },
        _meta: { "openai/widgetSessionId": WIDGET_SESSION_ID, "openai/widgetAccessible": true },
      };
    }
  );
```

**The `start_checkout` tool.** This is the most important tool because it bridges your application to Gr4vy's payment infrastructure. It has two critical responsibilities: **server-side price validation** and **embed token generation**.

```typescript
  server.registerTool(
    "start_checkout",
    {
      description:
        "Start the checkout process. Shows order summary and Gr4vy Embed for payment. "
        + "The UI widget handles all display — do NOT repeat order details.",
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
        readOnlyHint: false,      // This tool creates a checkout session (side effect)
        destructiveHint: false,
        openWorldHint: true,       // This tool calls an external payment API
      },
      _meta: {
        "openai/outputTemplate": CHECKOUT_URI,
        "openai/toolInvocation/invoking": "Preparing checkout...",
        "openai/toolInvocation/invoked": "Checkout ready",
      },
    },
```

**Why server-side price validation matters.** The `items` array that arrives in this tool call comes from ChatGPT, which assembled it from widget interactions and conversation context. The model could inadvertently alter prices, or a compromised widget could send manipulated values. The server must always look up canonical prices from its own product catalog:

```typescript
    async (args) => {
      // ALWAYS validate prices server-side. Never trust prices from the model or widget.
      const validatedItems = args.items.map((item) => {
        const product = getProductById(item.product_id);
        if (!product) throw new Error(`Unknown product: ${item.product_id}`);
        return {
          ...item,
          price: product.price,  // Canonical price from YOUR catalog, not the model's
          name: product.name,
        };
      });

      // Compute total in cents (Gr4vy expects amounts in minor currency units)
      let totalAmount = 0;
      for (const item of validatedItems) {
        totalAmount += Math.round(item.price * 100) * (item.quantity || 1);
      }
```

The handler then calls Gr4vy to generate an embed token (covered in the [Integrating Gr4vy Embed](#integrating-gr4vy-embed) section) and returns the result to the checkout widget:

```typescript
      const checkoutItems = validatedItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitAmount: Math.round(item.price * 100),
      }));

      // Generate Gr4vy embed token (see "Integrating Gr4vy Embed" section)
      let embedConfig: Record<string, unknown> | null = null;
      let embedError: string | null = null;
      try {
        const embedToken = await generateEmbedToken(totalAmount, "USD", checkoutItems);
        embedConfig = {
          token: embedToken,
          gr4vy_id: process.env.GR4VY_ID,
          environment: process.env.GR4VY_ENVIRONMENT || "sandbox",
          currency: "USD",
          country: "US",
          merchant_account_id: process.env.GR4VY_MERCHANT_ACCOUNT_ID,
          amount: totalAmount,
        };
      } catch (err) {
        embedError = "Payment processing is temporarily unavailable. Please try again later.";
      }

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
```

Notice the graceful error handling: if Gr4vy is unavailable, the tool still returns successfully with an `embed_error` field instead of crashing. The checkout widget can then display a user-friendly error message instead of a broken iframe.

With the server complete, the next step is to build the widgets that receive the `structuredContent` data and render the user interface.

#### Step 5: Build the ChatGPT Widget Bridge

Create `src/widgets/shared/openai-bridge.ts`. This is a TypeScript wrapper around the `window.openai` API that ChatGPT makes available inside widget iframes. All widgets use these functions to communicate with ChatGPT:

```typescript
declare global {
  interface Window {
    openai?: {
      toolOutput?: unknown;
      widgetState?: unknown;
      setWidgetState?: (state: unknown) => void;
      sendFollowUpMessage?: (msg: { prompt: string }) => void;
    };
  }
}

/**
 * Poll for window.openai.toolOutput to become available.
 * This is how the widget receives data from a tool call.
 * Times out after 30 seconds.
 */
export function waitForToolOutput<T>(timeoutMs = 30000): Promise<T> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    function check() {
      if (window.openai?.toolOutput) {
        resolve(window.openai.toolOutput as T);
      } else if (Date.now() > deadline) {
        reject(new Error("Timed out waiting for tool output"));
      } else {
        setTimeout(check, 100);
      }
    }
    check();
  });
}

/**
 * Get persisted widget state (survives re-renders within a session).
 * Use this to restore cart contents, filter selections, etc.
 */
export function getWidgetState<T>(): T | null {
  return (window.openai?.widgetState as T) ?? null;
}

/**
 * Persist widget state to ChatGPT's context.
 * Call this whenever state changes that should survive widget re-renders.
 */
export function setWidgetState(state: unknown): void {
  window.openai?.setWidgetState?.(state);
}

/**
 * Send a follow-up message to ChatGPT, triggering a new model turn.
 * Use this to instruct ChatGPT to call the next tool — for example,
 * when the user clicks "Proceed to Checkout" in the catalog widget.
 */
export function sendFollowUp(prompt: string): void {
  window.openai?.sendFollowUpMessage?.({ prompt });
}

/**
 * Listen for subsequent tool result updates via postMessage.
 * When ChatGPT re-invokes a tool (e.g., start_checkout after the user
 * was in the catalog), this callback fires with the new structured content.
 * Returns an unsubscribe function.
 */
export function onToolResult<T>(callback: (data: T) => void): () => void {
  function handler(ev: MessageEvent) {
    if (ev.source !== window.parent) return;
    const msg = ev.data;
    if (!msg || msg.jsonrpc !== "2.0") return;
    if (msg.method === "ui/notifications/tool-result") {
      callback(msg.params?.structuredContent as T);
    }
  }
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
```

**How the widget communication flow works:**

```
User says: "Show me your products"
    │
    ▼
ChatGPT calls tool: list_products()
    │
    ▼
MCP Server returns: structuredContent (product data) + outputTemplate (catalog widget URI)
    │
    ▼
ChatGPT embeds the catalog widget in the conversation as an iframe
    │
    ▼
Widget calls: waitForToolOutput() → receives product data from structuredContent
    │
    ▼
Widget renders the product catalog UI (your application-specific design)
    │
    ▼
User interacts: browses products, adds items to cart, clicks "Proceed to Checkout"
    │
    ▼
Widget calls: sendFollowUp("Call start_checkout with these items: [...]")
    │
    ▼
ChatGPT calls tool: start_checkout(items)
    │
    ▼
MCP Server validates prices, calls Gr4vy API, returns embed token
    │
    ▼
Checkout widget receives: onToolResult() fires with Gr4vy embed config
    │
    ▼
Checkout widget loads Gr4vy Embed and renders the payment form
```

#### Step 6: Build the Widgets

Each widget is a React single-page application that gets built into a single self-contained HTML file. This is important because ChatGPT embeds widgets as iframes — the entire application (HTML, CSS, and JavaScript) must be in a single file.

The product catalog, shopping cart, and their UI designs are entirely application-specific — you'll build these to match your brand and product experience. The [example repository](https://github.com/nicholasgriffintn/agentic-plantly) contains a full implementation you can reference. What matters for this guide is the **communication pattern** that all widgets share, and the **checkout widget** where Gr4vy Embed is integrated.

**Widget file structure.** Every widget follows the same structure — a standard React single-page app:

```
src/widgets/<widget-name>/
├── index.html    # HTML template with <div id="root"></div>
├── main.tsx      # createRoot(document.getElementById("root")!).render(<App />)
├── App.tsx       # Your widget component
└── styles.css    # @import "tailwindcss" + base styles
```

**The widget lifecycle pattern.** Regardless of what your widget displays, every widget follows the same communication lifecycle with ChatGPT. Here is the minimal skeleton:

```tsx
import { useState, useEffect } from "react";
import {
  waitForToolOutput,
  getWidgetState,
  setWidgetState,
  sendFollowUp,
  onToolResult,
} from "../shared/openai-bridge";

export function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Restore any persisted state (e.g., cart contents) from a previous render
    const saved = getWidgetState();
    if (saved) { /* restore state from saved */ }

    // 2. Wait for the tool's structuredContent to arrive
    waitForToolOutput().then((toolData) => {
      setData(toolData);
      setLoading(false);
    });

    // 3. Listen for updates if ChatGPT calls another tool while this widget is open
    const unsub = onToolResult((newData) => {
      setData(newData);
    });
    return unsub;
  }, []);

  // 4. Persist widget state whenever it changes
  useEffect(() => {
    setWidgetState({ /* your state to persist */ });
  }, [data]);

  // 5. Trigger the next step in the flow (e.g., user clicks "Checkout")
  function handleNextAction() {
    sendFollowUp("Call the start_checkout tool with these items: [...]");
  }

  // 6. Render your application-specific UI
  return <div>{/* Your UI here */}</div>;
}
```

This pattern applies to every widget you build:

- **`waitForToolOutput()`** receives the initial `structuredContent` from the tool that triggered this widget.
- **`getWidgetState()` / `setWidgetState()`** persist state (like cart contents) across widget re-renders within the same ChatGPT conversation.
- **`onToolResult()`** listens for updates when ChatGPT calls additional tools while the widget is still displayed.
- **`sendFollowUp()`** sends a message back to ChatGPT to trigger the next tool call — this is how the user transitions from browsing to checkout.

The checkout widget follows this same pattern, with the addition of Gr4vy Embed integration. See the next section for the full checkout implementation.

#### Step 7: Configure the Widget Build Process

Widgets must be compiled into self-contained HTML files (with all CSS and JavaScript inlined) so they can be served as MCP resources. This is accomplished with Vite and the `vite-plugin-singlefile` plugin.

**Create `vite.config.ts`:**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

const widget = process.env.WIDGET;

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  root: `src/widgets/${widget}`,
  build: {
    outDir: resolve(__dirname, "dist/widgets"),
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, `src/widgets/${widget}/index.html`),
    },
  },
});
```

**Create `scripts/build-widgets.ts`:**

```typescript
import { execSync } from "child_process";
import { rmSync, mkdirSync, renameSync, existsSync } from "fs";
import { resolve } from "path";

const widgets = ["product-catalog", "shopping-cart", "checkout"];
const outDir = resolve(import.meta.dirname!, "..", "dist", "widgets");

// Clean output directory
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const widget of widgets) {
  console.log(`\nBuilding widget: ${widget}...`);
  execSync(`npx vite build`, {
    cwd: resolve(import.meta.dirname!, ".."),
    env: { ...process.env, WIDGET: widget },
    stdio: "inherit",
  });

  // Vite outputs to dist/widgets/index.html — rename to widget name
  const srcFile = resolve(outDir, "index.html");
  const destFile = resolve(outDir, `${widget}.html`);
  if (existsSync(srcFile)) {
    renameSync(srcFile, destFile);
  }
}

console.log("\nAll widgets built successfully!");
```

Build the widgets:

```bash
npm run build:widgets
```

This produces three self-contained HTML files in `dist/widgets/`:
- `product-catalog.html`
- `shopping-cart.html`
- `checkout.html`

Each file contains all HTML, CSS, and JavaScript inlined — no external dependencies needed at runtime.

---

### Integrating Gr4vy Embed

Gr4vy Embed is a client-side JavaScript library that renders a PCI-compliant payment form inside your checkout widget. The integration has two parts: a **server-side** component that creates a checkout session and generates a signed token, and a **client-side** component in the checkout widget that loads the Embed script and initializes the payment form.

#### Server-Side: Generate the Embed Token

Create `src/server/services/purchases.ts`. This service uses the Gr4vy SDK to create a checkout session and generate a signed JWT embed token:

```typescript
import { readFileSync } from "fs";
import { Gr4vy, getEmbedToken, withToken, verifyWebhook } from "@gr4vy/sdk";

interface CheckoutItem {
  name: string;
  quantity: number;
  unitAmount: number; // in cents
}

function getPrivateKey(): string {
  const privateKeyPath = process.env.GR4VY_PRIVATE_KEY_PATH;
  if (!privateKeyPath) {
    throw new Error("Set GR4VY_PRIVATE_KEY_PATH environment variable.");
  }
  return readFileSync(privateKeyPath, "utf8");
}

function getGr4vyClient(): Gr4vy {
  const gr4vyId = process.env.GR4VY_ID;
  if (!gr4vyId) {
    throw new Error("Set GR4VY_ID environment variable.");
  }

  return new Gr4vy({
    server: (process.env.GR4VY_ENVIRONMENT || "sandbox") as "sandbox" | "production",
    id: gr4vyId,
    merchantAccountId: process.env.GR4VY_MERCHANT_ACCOUNT_ID,
    bearerAuth: withToken({ privateKey: getPrivateKey() }),
  });
}

export async function generateEmbedToken(
  amount: number,
  currency: string = "USD",
  cartItems: CheckoutItem[] = []
): Promise<string> {
  const gr4vy = getGr4vyClient();
  const privateKey = getPrivateKey();

  // 1. Create a checkout session on the Gr4vy backend
  const checkoutSession = await gr4vy.checkoutSessions.create({
    amount,
    currency,
    cartItems: cartItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
    })),
    metadata: {
      source: "chatgpt-app",
    },
  });

  // 2. Generate a signed JWT embed token
  return getEmbedToken({
    privateKey,
    checkoutSessionId: checkoutSession.id,
    embedParams: {
      amount,
      currency,
      merchantAccountId: process.env.GR4VY_MERCHANT_ACCOUNT_ID,
      cartItems: cartItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitAmount: item.unitAmount,
      })),
    },
  });
}
```

**How the token flow works:**

1. The `start_checkout` tool validates item prices against the server-side product catalog.
2. It calculates the total in cents (e.g., $199.99 becomes 19999).
3. It calls `generateEmbedToken()` which creates a Gr4vy checkout session containing the cart items and amount.
4. The Gr4vy SDK generates a signed JWT that pins the amount, currency, merchant account, and cart items.
5. This token is returned to the checkout widget as part of `structuredContent.embed`.

**Important:** The JWT token pins the payment amount and cart items. If the checkout widget passes mismatched values to `gr4vy.setup()`, Gr4vy will reject the request with a validation error. Always ensure the values passed to `gr4vy.setup()` match exactly what was pinned in the token.

#### Client-Side: Load Gr4vy Embed in the Checkout Widget

The checkout widget follows the same widget lifecycle pattern described earlier, with one addition: after receiving the embed configuration from the `start_checkout` tool, it dynamically loads the Gr4vy Embed script and initializes the payment form.

**Receiving the embed configuration.** The checkout widget uses the same `waitForToolOutput()` and `onToolResult()` bridge functions as any other widget. The `structuredContent` from the `start_checkout` tool includes either an `embed` object (with the Gr4vy token and configuration) or an `embed_error` string if token generation failed:

```tsx
const [embedConfig, setEmbedConfig] = useState<EmbedConfig | null>(null);
const [embedError, setEmbedError] = useState<string | null>(null);
const embedLoaded = useRef(false);

useEffect(() => {
  waitForToolOutput<CheckoutData>().then((data) => {
    if (data.embed) setEmbedConfig(data.embed);
    if (data.embed_error) setEmbedError(data.embed_error);
  });

  const unsub = onToolResult<CheckoutData>((data) => {
    if (data?.embed) setEmbedConfig(data.embed);
  });
  return unsub;
}, []);
```

**Loading the Gr4vy Embed script.** Once the embed configuration arrives, dynamically insert a `<script>` tag to load the Gr4vy Embed library from your Gr4vy instance's CDN. The URL follows the pattern `https://cdn.<your-gr4vy-id>.gr4vy.app/embed.latest.js`:

```tsx
useEffect(() => {
  if (!embedConfig || embedLoaded.current || !embedConfig.gr4vy_id) return;

  const cdnUrl = `https://cdn.${embedConfig.gr4vy_id}.gr4vy.app/embed.latest.js`;
  const script = document.createElement("script");
  script.src = cdnUrl;
  script.onload = () => {
    embedLoaded.current = true;
    initEmbed();
  };
  script.onerror = () => {
    setEmbedError("Payment form could not be loaded.");
  };
  document.head.appendChild(script);
}, [embedConfig]);
```

**Initializing Gr4vy Embed.** After the script loads, call `gr4vy.setup()` to render the payment form. The values for `amount`, `currency`, and `merchantAccountId` **must match exactly** what was pinned in the JWT token on the server — Gr4vy will reject mismatched values:

```tsx
function initEmbed() {
  if (!embedConfig || typeof gr4vy === "undefined") return;

  gr4vy.setup({
    gr4vyId: embedConfig.gr4vy_id,
    token: embedConfig.token,              // Signed JWT from your server
    element: "#embed-container",           // DOM element for the payment form
    form: "#payment-form",                 // Wrapping <form> element
    amount: embedConfig.amount,            // Total in cents — must match the token
    currency: embedConfig.currency,
    country: embedConfig.country,
    environment: embedConfig.environment,  // "sandbox" or "production"
    intent: "capture",                     // "capture" or "authorize"
    merchantAccountId: embedConfig.merchant_account_id,

    onComplete: (transaction) => {
      // Fires when the payment succeeds.
      // transaction.id — the Gr4vy transaction ID
      // transaction.status — e.g., "capture_succeeded"
      // transaction.paymentMethod — card scheme, last 4 digits, etc.
      // Display your application-specific success screen here.
    },

    onEvent: (name, data) => {
      // Fires on errors and other lifecycle events.
      // "transactionFailed" — the payment was declined or errored
      // "argumentError" — a configuration mismatch (e.g., amount vs token)
      // "apiError" — a Gr4vy API error
      if (name === "transactionFailed") {
        // Display your application-specific error screen here.
      }
    },
  });
}
```

**The required HTML elements.** Gr4vy Embed needs two elements in your JSX: a `<form>` wrapper and a container `<div>` where the payment fields will be rendered. The `id` attributes must match what you pass to `gr4vy.setup()`:

```tsx
<form id="payment-form">
  <div id="embed-container" style={{ minHeight: 300 }} />
  <button type="submit">Pay Now</button>
</form>
```

Gr4vy Embed renders its own PCI-compliant input fields (card number, expiry, CVC) inside the `#embed-container` div. Your application is responsible for the surrounding UI — order summary, result screens, error messages, and the submit button.

**Key integration points:**

- The `intent` option controls the payment flow. Use `"capture"` to charge immediately, or `"authorize"` for two-step flows where you capture later.
- The `onComplete` callback provides the full transaction object. Use `transaction.id` to correlate with webhooks and `transaction.paymentMethod` to display card details to the user.
- If `gr4vy.setup()` receives values that don't match the JWT token (e.g., a different `amount`), the `onEvent` callback fires with `"argumentError"`. This is why the server-side price validation in the `start_checkout` tool is critical — the token and the widget must agree.
- See the [example repository](https://github.com/nicholasgriffintn/agentic-plantly) for a complete checkout widget implementation including order summary, payment result screens, and error handling.

#### Webhook Verification (Optional)

For production applications, you should verify payment outcomes via Gr4vy webhooks rather than relying solely on client-side callbacks. Add a webhook handler to your server:

```typescript
export function handleWebhook(
  payload: string,
  signatureHeader: string | null | undefined,
  timestampHeader: string | null | undefined
): Record<string, unknown> {
  const secret = process.env.GR4VY_WEBHOOK_SECRET;
  if (!secret) throw new Error("GR4VY_WEBHOOK_SECRET not configured.");

  // Verify HMAC signature (throws if invalid)
  verifyWebhook(payload, secret, signatureHeader, timestampHeader, 300);

  const event = JSON.parse(payload);
  // Store or process the transaction result
  return event;
}
```

Configure the webhook URL in your Gr4vy dashboard to point to `https://your-domain.com/webhooks/gr4vy`.

---

### Enabling ChatGPT to Access the Application

#### Step 1: Start the Server Locally

Build the widgets and start the development server:

```bash
# Build the widget HTML files
npm run build:widgets

# Start the MCP server with hot reload
npm run dev
```

Your server will be running at `http://localhost:3000` with the MCP endpoint at `http://localhost:3000/mcp`.

#### Step 2: Expose Your Server with ngrok

ChatGPT needs an HTTPS URL to connect to your MCP server. Use ngrok to create a tunnel:

```bash
ngrok http 3000
```

ngrok will provide a public URL like `https://abc123.ngrok-free.app`. Your MCP endpoint is at `https://abc123.ngrok-free.app/mcp`.

#### Step 3: Configure Content Security Policy Domains

Since the checkout widget loads the Gr4vy Embed script from an external CDN, you need to configure CSP domains in your OpenAI app settings to allow these external resources:

- **`connectDomains`**: `["api.*.gr4vy.app"]` — allows API calls to Gr4vy
- **`resourceDomains`**: `["cdn.*.gr4vy.app"]` — allows loading the Embed script
- **`frameDomains`**: `["*.gr4vy.app"]` — allows Gr4vy's iframe-based payment form

#### Step 4: Connect to ChatGPT

1. Open ChatGPT (Pro/Business/Team/Enterprise subscription required).
2. Enable **Developer Mode** in your ChatGPT settings.
3. Navigate to **Settings > Connectors** (or the equivalent in your ChatGPT version).
4. Click **Create** or **Add Connector**.
5. Paste your MCP endpoint URL: `https://abc123.ngrok-free.app/mcp`
6. ChatGPT will auto-discover your tools (`list_products`, `show_cart`, `start_checkout`) and resources.

#### Step 5: Deploy for Production

For production use, deploy your MCP server to any Node.js hosting provider (Vercel, Railway, AWS, etc.). Ensure you:

1. Set all environment variables (`GR4VY_ID`, `GR4VY_PRIVATE_KEY_PATH`, etc.) in your hosting provider.
2. Run `npm run build` to compile both widgets and server code.
3. Use `npm start` as the start command.
4. Update your ChatGPT connector URL to your production domain.

---

## Using the App

Once connected to ChatGPT, users can interact with your store through natural conversation:

1. **Browse products** — The user asks to see your products (e.g., "What do you sell?" or "Show me your catalog"). ChatGPT invokes the `list_products` tool and the product catalog widget appears inline in the conversation. Users can browse, filter, and add items to their cart directly in the widget.

2. **Manage cart** — Users can view and modify their cart through the catalog widget's built-in cart summary, or ask ChatGPT to "show my cart" which invokes the `show_cart` tool and displays the dedicated cart widget.

3. **Checkout** — When the user clicks "Proceed to Checkout" in a widget (or asks ChatGPT to check out), `sendFollowUp()` triggers the `start_checkout` tool. The checkout widget appears with an order summary and the Gr4vy Embed payment form. The user enters their payment details directly in the Gr4vy form and submits payment — all within the ChatGPT conversation.

4. **Payment confirmation** — After a successful payment, the Gr4vy Embed `onComplete` callback fires and the checkout widget displays a confirmation screen with the transaction ID, amount charged, and payment method used.

---

## Useful Resources

- [OpenAI Apps SDK](https://openai.com/index/apps-in-chatgpt/)
- [OpenAI Apps SDK Examples](https://github.com/openai/openai-apps-sdk-examples)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [Gr4vy Embed Integration Guide](https://docs.gr4vy.com/guides/payments/embed)
- [Gr4vy Node.js SDK](https://github.com/gr4vy/gr4vy-node)
- [@modelcontextprotocol/sdk on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
