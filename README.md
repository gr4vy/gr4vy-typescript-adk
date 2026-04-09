# Plantly - ChatGPT MCP App

A ChatGPT MCP app for **Plantly**, a fictional online plant store. Browse plants, manage a cart, and checkout with Gr4vy payments — all within ChatGPT's conversational UI.

Built with TypeScript, React, Express, and ChromaDB.

## Architecture

```
ChatGPT ─── (HTTPS) ──→ ngrok tunnel ──→ Express Server (:3000)
                                            ├── /mcp     → MCP Protocol
                                            ├── /widgets → React widget HTML
                                            └── /health  → Health check
```

**MCP Tools** (8):
- `list_products` — Show product catalog widget
- `show_cart` — Show shopping cart widget
- `start_checkout` — Show checkout widget with Gr4vy Embed
- `pay` — Process single-step payment
- `list_cards` — List stored payment cards
- `checkout_tokenize` — Step 1: Generate payment token + 2FA
- `checkout_verify` — Step 2: Verify 2FA code
- `checkout_purchase` — Step 3: Complete purchase

**MCP Resources** (3 React widgets):
- Product Catalog — Filterable grid with inline cart
- Shopping Cart — Cart management with quantity controls
- Checkout — Order summary + Gr4vy Embed payment form

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [ngrok](https://ngrok.com/) (free account) for exposing to ChatGPT
- (Optional) [ChromaDB](https://docs.trychroma.com/) for semantic product search
- (Optional) [Gr4vy](https://gr4vy.com/) account for real payment processing

## Quick Start

### 1. Install dependencies

```bash
cd agentic-plantly
npm install
```

### 2. Build widgets

```bash
npm run build:widgets
```

This produces 3 self-contained HTML files in `dist/widgets/`.

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your Gr4vy credentials (optional for demo)
```

### 4. Start the server

```bash
npm run dev
```

The server starts at `http://localhost:3000` with:
- MCP endpoint: `http://localhost:3000/mcp`
- Widget files: `http://localhost:3000/widgets/`
- Health check: `http://localhost:3000/health`

### 5. Expose via ngrok

In a separate terminal:

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`).

### 6. Connect to ChatGPT

1. Open ChatGPT and go to **Settings → Apps & Connectors → Advanced settings**
2. Enable **Developer Mode**
3. Go to **Settings → Connectors → Create**
4. Paste your ngrok URL with `/mcp` path:
   ```
   https://abc123.ngrok-free.app/mcp
   ```
5. ChatGPT will discover your tools automatically

### 7. Try it out

Say things like:
- "Show me your plants"
- "What top rated plants do you have?"
- "Add the Monstera Deliciosa to my cart"
- "Show my cart"
- "I'd like to checkout"

## ChromaDB (Optional)

The app works without ChromaDB (falls back to in-memory product data). To enable semantic search:

```bash
# Install ChromaDB
pip install chromadb

# Start ChromaDB server
chroma run --path ./chroma-data --port 8000

# Set environment variable
echo "CHROMA_URL=http://localhost:8000" >> .env

# Restart the server — products auto-seed on first run
npm run dev
```

With ChromaDB, users can search semantically:
- "Show me low-maintenance plants" → Aloe Vera, Snake Plant
- "I need something for a shady room" → Peace Lily, Golden Pothos

## Gr4vy Payments (Optional)

For real payment processing, configure Gr4vy in `.env`:

```bash
GR4VY_ID=your-gr4vy-id
GR4VY_PRIVATE_KEY=your-private-key
GR4VY_MERCHANT_ACCOUNT_ID=your-merchant-account-id
```

Without Gr4vy credentials, the checkout widget shows a placeholder and the `pay` tool returns mock transaction results.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build:widgets` | Build React widget HTML bundles |
| `npm run build:server` | Compile server TypeScript |
| `npm run build` | Build everything |
| `npm run seed` | Seed ChromaDB (requires running server) |
| `npm start` | Run production build |
| `npm run tunnel` | Start ngrok tunnel on port 3000 |

## Project Structure

```
agentic-plantly/
├── src/
│   ├── server/
│   │   ├── index.ts          # Express + MCP transport
│   │   ├── mcp.ts            # McpServer: tools & resources
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── data/
│   │   │   ├── products.ts   # 9 plant products
│   │   │   ├── cards.ts      # Mock payment cards
│   │   │   └── seed.ts       # ChromaDB seeder
│   │   └── services/
│   │       ├── chroma.ts     # ChromaDB client (with fallback)
│   │       └── purchases.ts  # Gr4vy payments & token flow
│   └── widgets/
│       ├── shared/            # OpenAI bridge & types
│       ├── product-catalog/   # Product grid widget
│       ├── shopping-cart/     # Cart widget
│       └── checkout/          # Checkout + Gr4vy Embed
├── dist/widgets/              # Built widget HTML (gitignored)
├── scripts/
│   ├── build-widgets.ts       # Widget build orchestrator
│   └── seed.ts                # ChromaDB seed CLI
└── package.json
```

## Product Catalog

| Category | Products |
|----------|----------|
| Top Rated | Aloe Vera ($14.99), Monstera Deliciosa ($34.99), Snake Plant ($24.99) |
| Essentials | Golden Pothos ($12.99), Peace Lily ($18.99), Barrel Cactus ($9.99) |
| Accessories | Pruning Shears ($16.99), Watering Can ($22.99), Ceramic Planter Pot ($19.99) |

## Tech Stack

- **Server**: TypeScript, Express 5, `@modelcontextprotocol/sdk`
- **Widgets**: React 19, Vite, Tailwind CSS 4
- **Database**: ChromaDB (optional, with in-memory fallback)
- **Payments**: Gr4vy Embed (optional, with mock fallback)
- **Tunnel**: ngrok
