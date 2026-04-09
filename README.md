# Plantly — ChatGPT MCP E-Commerce App

An example e-commerce store built as a **ChatGPT MCP app**. Plantly is a fictional online plant shop where users can browse products, manage a shopping cart, and check out with real payments — all through interactive UI widgets rendered directly inside ChatGPT conversations.

Built with TypeScript, React, Express, and the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

## Architecture

```
User ↔ ChatGPT ── (HTTPS) ──→ ngrok ──→ Express Server (:3000)
                                          ├── POST /mcp      → MCP protocol (tools + resources)
                                          ├── GET  /widgets/* → React widget HTML files
                                          ├── POST /webhooks  → Gr4vy payment webhooks
                                          └── GET  /health    → Health check
```

## How It Works

This app uses ChatGPT's MCP integration to expose **tools** (actions the model can invoke) and **resources** (interactive React widgets rendered inline in the chat).

The flow works like this:

1. **ChatGPT calls an MCP tool** (e.g. `list_products`) based on the user's message.
2. **The tool returns structured data** (`structuredContent`) plus metadata pointing to a widget resource URI via `openai/outputTemplate`.
3. **ChatGPT fetches the widget** — a self-contained HTML file registered as an MCP resource with MIME type `text/html+skybridge`.
4. **The widget renders inline** in the conversation. It reads the tool's structured data via `window.openai.toolOutput` and renders an interactive UI.
5. **The user interacts with the widget** (filters products, adjusts cart quantities, clicks checkout). The widget communicates back to ChatGPT via `window.openai.sendFollowUpMessage()` to trigger new tool calls.
6. **Widget state persists** across re-renders using `window.openai.widgetState`.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **MCP Tool** | A function ChatGPT can call. Returns text + `structuredContent` for widgets. |
| **MCP Resource** | A `text/html+skybridge` resource — the widget HTML that ChatGPT renders inline. |
| **`structuredContent`** | JSON data passed from a tool result to the widget via `window.openai.toolOutput`. |
| **`openai/outputTemplate`** | Tool metadata linking a tool to its widget resource URI. |
| **OpenAI Bridge** | A TypeScript wrapper (`openai-bridge.ts`) for the `window.openai` API. |
| **`sendFollowUpMessage`** | Triggers a new ChatGPT model turn from within a widget (e.g. "proceed to checkout"). |

## MCP Tools

The server registers 3 tools in `src/server/mcp.ts`:

| Tool | Purpose | Input |
|------|---------|-------|
| `list_products` | Show the product catalog widget with optional filters | `sunlight`, `water`, `climate` (enum arrays), `search` (string) — all optional |
| `show_cart` | Display the shopping cart widget | `items[]` with `product_id`, `name`, `price`, `quantity` |
| `start_checkout` | Start checkout with Gr4vy Embed payment form | `items[]` with `product_id`, `name`, `price`, `quantity` |

Each tool returns `structuredContent` consumed by its corresponding widget. Prices are validated server-side against the canonical product catalog to prevent tampering.

## MCP Resources (Widgets)

Three React widgets are registered as MCP resources:

| Widget | URI | Description |
|--------|-----|-------------|
| **Product Catalog** | `ui://widget/product-catalog.html` | Filterable product grid with multi-select filters (sunlight, water, climate). Includes inline cart with quantity controls. |
| **Shopping Cart** | `ui://widget/shopping-cart.html` | Cart management with quantity adjustment, item removal, and checkout button. |
| **Checkout** | `ui://widget/checkout.html` | Order summary with embedded [Gr4vy](https://gr4vy.com/) payment form. Displays transaction result on completion. |

Widgets are built as self-contained HTML files using Vite + `vite-plugin-singlefile` — all JS, CSS, and React code is inlined into a single HTML file per widget.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [ngrok](https://ngrok.com/) (free account) for exposing your local server to ChatGPT
- (Optional) [Gr4vy](https://gr4vy.com/) account for real payment processing

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Build widgets

```bash
npm run build:widgets
```

This compiles the 3 React widgets into self-contained HTML files in `dist/widgets/`.

### 3. Configure environment

```bash
cp .env.example .env
```

The app works without any environment configuration. Gr4vy credentials are optional — see [Gr4vy Payments](#gr4vy-payments-optional) below.

### 4. Start the server

```bash
npm run dev
```

The server starts at `http://localhost:3000`:
- MCP endpoint: `http://localhost:3000/mcp`
- Widget files: `http://localhost:3000/widgets/`
- Health check: `http://localhost:3000/health`

### 5. Expose via ngrok

In a separate terminal:

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g. `https://abc123.ngrok-free.app`).

### 6. Connect to ChatGPT

1. Open ChatGPT and go to **Settings > Apps & Connectors > Advanced settings**
2. Enable **Developer Mode**
3. Go to **Settings > Connectors > Create**
4. Paste your ngrok URL with the `/mcp` path:
   ```
   https://abc123.ngrok-free.app/mcp
   ```
5. ChatGPT will discover your tools automatically

### 7. Try it out

Say things like:
- "Show me your plants"
- "I need something low-maintenance for a shady room"
- "Add the Monstera to my cart"
- "Show my cart"
- "I'd like to checkout"

## Adapting for Your Own Store

This project is designed as a template. Here's how to make it your own:

### Replace the product catalog

Edit `src/server/data/products.ts`:
- Replace the `PRODUCTS` array with your own items
- Update the `Product` interface in `src/server/types.ts` if your items have different attributes
- Update filter dimensions (currently sunlight/water/climate) to match your product attributes

### Modify or add tools

Edit `src/server/mcp.ts`:
- Update tool descriptions, input schemas, and handlers
- Add new tools with `server.registerTool()`
- Each tool can reference a widget via `openai/outputTemplate` in its `_meta`

### Create or modify widgets

Each widget lives in `src/widgets/{name}/` and needs:
- `index.html` — minimal HTML shell
- `main.tsx` — React entry point
- `App.tsx` — main component

Widgets communicate with ChatGPT through the OpenAI Bridge (`src/widgets/shared/openai-bridge.ts`):

```typescript
import { waitForToolOutput, sendFollowUp, getWidgetState, setWidgetState } from "../shared/openai-bridge";

// Read data from the tool that triggered this widget
const data = await waitForToolOutput<MyDataType>();

// Persist state across widget re-renders
setWidgetState({ cart: items });
const saved = getWidgetState<MyState>();

// Trigger a new ChatGPT turn (e.g. user clicks "Checkout")
sendFollowUp("The user wants to checkout with these items: ...");
```

After adding a new widget:
1. Register it as an MCP resource in `src/server/mcp.ts`
2. Add it to the build list in `scripts/build-widgets.ts`
3. Run `npm run build:widgets`

### Update the OpenAI app manifest CSP

If your widgets load external resources (scripts, iframes, APIs), configure the CSP domains in the OpenAI developer dashboard:
- `connectDomains` — APIs the widget calls
- `resourceDomains` — CDNs the widget loads scripts/styles from
- `frameDomains` — domains the widget embeds in iframes

## Gr4vy Payments (Optional)

For real payment processing via [Gr4vy](https://gr4vy.com/), add these to your `.env`:

```bash
GR4VY_ID=your-gr4vy-id
GR4VY_PRIVATE_KEY_PATH=./your-private-key.pem
GR4VY_MERCHANT_ACCOUNT_ID=your-merchant-account-id
GR4VY_ENVIRONMENT=sandbox
GR4VY_WEBHOOK_SECRET=your-webhook-secret
```

You'll also need to configure CSP domains in your OpenAI app manifest:
```
connectDomains: ["api.*.gr4vy.app"]
resourceDomains: ["cdn.*.gr4vy.app"]
frameDomains: ["*.gr4vy.app"]
```

Without Gr4vy credentials, the checkout widget will show an error message instead of the payment form. The product catalog and cart widgets work fully without it.

## Project Structure

```
agentic-plantly-ts/
├── src/
│   ├── server/
│   │   ├── index.ts              # Express server + MCP transport setup
│   │   ├── mcp.ts                # MCP server: tools & resource registration
│   │   ├── types.ts              # TypeScript interfaces (Product, etc.)
│   │   ├── data/
│   │   │   └── products.ts       # Product catalog (12 plants) + filter logic
│   │   └── services/
│   │       └── purchases.ts      # Gr4vy payment integration
│   └── widgets/
│       ├── shared/
│       │   ├── openai-bridge.ts  # window.openai API wrapper
│       │   └── types.ts          # Shared widget TypeScript interfaces
│       ├── product-catalog/      # Product grid with multi-select filters
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── index.html
│       │   └── styles.css
│       ├── shopping-cart/        # Cart management widget
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── index.html
│       └── checkout/             # Checkout + Gr4vy Embed payment
│           ├── App.tsx
│           ├── main.tsx
│           ├── index.html
│           └── styles.css
├── scripts/
│   └── build-widgets.ts          # Widget build orchestrator
├── dist/                         # Built artifacts (gitignored)
│   ├── server/                   # Compiled TypeScript
│   └── widgets/                  # Self-contained widget HTML files
├── .env.example                  # Environment variable template
├── package.json
├── tsconfig.json                 # Base TypeScript config
├── tsconfig.server.json          # Server TypeScript config
└── vite.config.ts                # Vite config for widget builds
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build:widgets` | Build React widgets into self-contained HTML |
| `npm run build:server` | Compile server TypeScript |
| `npm run build` | Build everything (widgets + server) |
| `npm start` | Run production build |
| `npm run tunnel` | Start ngrok tunnel on port 3000 |

## Tech Stack

- **Server**: TypeScript, Express 5, [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- **Widgets**: React 19, Vite 6, vite-plugin-singlefile
- **Validation**: Zod
- **Payments**: [Gr4vy](https://gr4vy.com/) Embed + @gr4vy/sdk (optional)
- **Tunnel**: ngrok
