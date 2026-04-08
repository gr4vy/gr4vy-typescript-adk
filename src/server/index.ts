import "dotenv/config";
import express from "express";
import { randomUUID } from "crypto";
import { resolve } from "path";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcp.js";
import { initChroma } from "./services/chroma.js";
import { handleWebhook } from "./services/purchases.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  // Initialize ChromaDB (auto-seeds if empty)
  console.log("Initializing ChromaDB...");
  await initChroma();
  console.log("ChromaDB ready.");

  const app = express();
  // Parse JSON for all routes except webhooks (which need raw text for signature verification)
  app.use((req, res, next) => {
    if (req.path === "/webhooks/gr4vy") return next();
    express.json()(req, res, next);
  });

  // Serve built widget HTML files
  const widgetsDir = resolve(process.cwd(), "dist", "widgets");
  app.use("/widgets", express.static(widgetsDir));

  // Track MCP sessions
  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport }
  >();

  // MCP endpoint - handles POST, GET (SSE), DELETE
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const method = req.body?.method || req.body?.[0]?.method || "unknown";
    console.log(`[MCP] POST /mcp (session: ${sessionId || "new"}, method: ${method})`);

    if (sessionId && sessions.has(sessionId)) {
      // Existing session
      const { transport } = sessions.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // New session — generate ID upfront so the MCP server can use it for buyer identity
    const newSessionId = randomUUID();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: (id) => {
        sessions.set(id, { transport });
        console.log(`MCP session created: ${id}`);
      },
    });

    transport.onclose = () => {
      const id = [...sessions.entries()].find(
        ([, v]) => v.transport === transport
      )?.[0];
      if (id) {
        sessions.delete(id);
        console.log(`MCP session closed: ${id}`);
      }
    };

    const server = createMcpServer(newSessionId);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

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

  // Health check (no sensitive data exposed)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", name: "Bikez MCP Server" });
  });

  // Debug endpoint - only available in development
  if (process.env.NODE_ENV !== "production") {
    app.get("/debug/checkout", (_req, res) => {
      res.json({
        gr4vy_id: process.env.GR4VY_ID || "(not set)",
        private_key_path: process.env.GR4VY_PRIVATE_KEY_PATH ? "(set)" : "(not set)",
        merchant_account_id: process.env.GR4VY_MERCHANT_ACCOUNT_ID || "(not set)",
        env_keys: Object.keys(process.env).filter((k) => k.startsWith("GR4VY")),
      });
    });
  }

  // Gr4vy webhook endpoint for payment verification
  app.post("/webhooks/gr4vy", express.text({ type: "*/*" }), (req, res) => {
    try {
      const signature = req.headers["x-gr4vy-signature"] as string | undefined;
      const timestamp = req.headers["x-gr4vy-timestamp"] as string | undefined;
      const event = handleWebhook(req.body, signature, timestamp);
      console.log(`Webhook received: ${(event as Record<string, unknown>).type}`);
      res.status(200).json({ received: true });
    } catch (err) {
      console.error("Webhook verification failed:", err);
      res.status(400).json({ error: "Webhook verification failed" });
    }
  });

  // Session cleanup: remove stale sessions every 30 minutes
  const SESSION_TTL_MS = 30 * 60 * 1000;
  const sessionTimestamps = new Map<string, number>();

  // Patch session tracking to record timestamps
  const originalSet = sessions.set.bind(sessions);
  sessions.set = (key, value) => {
    sessionTimestamps.set(key, Date.now());
    return originalSet(key, value);
  };
  const originalDelete = sessions.delete.bind(sessions);
  sessions.delete = (key) => {
    sessionTimestamps.delete(key);
    return originalDelete(key);
  };

  setInterval(() => {
    const now = Date.now();
    for (const [id, ts] of sessionTimestamps) {
      if (now - ts > SESSION_TTL_MS) {
        sessions.delete(id);
        console.log(`Cleaned up stale session: ${id}`);
      }
    }
  }, SESSION_TTL_MS);

  app.listen(PORT, () => {
    console.log(`\nBikez MCP Server running at http://localhost:${PORT}`);
    console.log(`  MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`  Widgets:      http://localhost:${PORT}/widgets/`);
    console.log(`  Health:       http://localhost:${PORT}/health`);
    console.log(
      `\nTo expose via ngrok: ngrok http ${PORT}`
    );
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
