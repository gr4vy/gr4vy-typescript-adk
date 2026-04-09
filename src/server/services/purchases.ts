import { readFileSync } from "fs";
import { Gr4vy, getEmbedToken, withToken, verifyWebhook } from "@gr4vy/sdk";

interface CheckoutItem {
  name: string;
  quantity: number;
  unitAmount: number; // in cents
}

// In-memory transaction store (replace with a database in production)
const transactions = new Map<string, Record<string, unknown>>();

function getPrivateKey(): string {
  const privateKeyPath = process.env.GR4VY_PRIVATE_KEY_PATH;
  if (!privateKeyPath) {
    throw new Error(
      "Gr4vy credentials not configured. Set GR4VY_PRIVATE_KEY_PATH environment variable."
    );
  }
  return readFileSync(privateKeyPath, "utf8");
}

function getGr4vyClient(): Gr4vy {
  const gr4vyId = process.env.GR4VY_ID;
  const merchantAccountId = process.env.GR4VY_MERCHANT_ACCOUNT_ID;
  const environment = process.env.GR4VY_ENVIRONMENT || "sandbox";

  if (!gr4vyId) {
    throw new Error("Gr4vy credentials not configured. Set GR4VY_ID environment variable.");
  }

  return new Gr4vy({
    server: environment as "sandbox" | "production",
    id: gr4vyId,
    merchantAccountId,
    bearerAuth: withToken({ privateKey: getPrivateKey() }),
  });
}

/**
 * Generate a Gr4vy Embed token for client-side checkout.
 *
 * Creates a checkout session with cart data and returns a signed JWT.
 */
export async function generateEmbedToken(
  amount: number,
  currency: string = "USD",
  cartItems: CheckoutItem[] = []
): Promise<string> {
  const gr4vy = getGr4vyClient();
  const privateKey = getPrivateKey();

  const checkoutSession = await gr4vy.checkoutSessions.create({
    amount,
    currency,
    cartItems: cartItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
    })),
    metadata: {
      source: "plantly-chatgpt-app",
    },
  });

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

/**
 * Verify and process a Gr4vy webhook payload.
 * Returns the parsed event or throws if verification fails.
 */
export function handleWebhook(
  payload: string,
  signatureHeader: string | null | undefined,
  timestampHeader: string | null | undefined
): Record<string, unknown> {
  const secret = process.env.GR4VY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("GR4VY_WEBHOOK_SECRET not configured.");
  }

  // Verify signature (throws if invalid)
  verifyWebhook(payload, secret, signatureHeader, timestampHeader, 300);

  const event = JSON.parse(payload) as Record<string, unknown>;

  // Store transaction result
  const transactionId = (event.target as Record<string, unknown>)?.id as string | undefined;
  if (transactionId) {
    transactions.set(transactionId, event);
  }

  return event;
}

/**
 * Look up a stored transaction by ID.
 */
export function getTransaction(transactionId: string): Record<string, unknown> | undefined {
  return transactions.get(transactionId);
}

/**
 * Get all stored transactions for a buyer.
 */
export function getTransactionsForBuyer(buyerId: string): Record<string, unknown>[] {
  return [...transactions.values()].filter((tx) => {
    const target = tx.target as Record<string, unknown> | undefined;
    const buyer = target?.buyer as Record<string, unknown> | undefined;
    return buyer?.externalIdentifier === buyerId;
  });
}
