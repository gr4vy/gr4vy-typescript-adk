import { ChromaClient } from "chromadb";
import type { Collection } from "chromadb";
import type { Product } from "../types.js";
import {
  PRODUCTS,
  getProducts as getProductsLocal,
  getCategories as getCategoriesLocal,
} from "../data/products.js";

const COLLECTION_NAME = "bikez-products";
const CHROMA_URL = process.env.CHROMA_URL || "http://localhost:8000";

let client: ChromaClient | null = null;
let collection: Collection | null = null;
let useChroma = false;

export async function initChroma(): Promise<void> {
  try {
    client = new ChromaClient({ path: CHROMA_URL });
    // Test connection
    await client.heartbeat();
    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
    });

    // Auto-seed if collection is empty
    const count = await collection.count();
    if (count === 0) {
      console.log("ChromaDB collection empty — seeding products...");
      await seedProducts();
      console.log(`Seeded ${PRODUCTS.length} products into ChromaDB.`);
    }

    useChroma = true;
    console.log(`ChromaDB connected at ${CHROMA_URL}`);
  } catch (err) {
    console.warn(
      `ChromaDB not available at ${CHROMA_URL} — using in-memory product data.`
    );
    console.warn(
      "To enable ChromaDB: run `chroma run --path ./chroma-data` and set CHROMA_URL=http://localhost:8000"
    );
    useChroma = false;
  }
}

export async function seedProducts(): Promise<void> {
  if (!client || !collection) {
    throw new Error("ChromaDB not connected.");
  }

  // Delete and recreate to avoid duplicates
  try {
    await client.deleteCollection({ name: COLLECTION_NAME });
  } catch {
    // Collection may not exist
  }
  collection = await client.getOrCreateCollection({ name: COLLECTION_NAME });

  const ids: string[] = [];
  const documents: string[] = [];
  const metadatas: Record<string, string | number>[] = [];

  for (const product of PRODUCTS) {
    ids.push(product.id);
    documents.push(`${product.name}: ${product.description}`);
    metadatas.push({
      name: product.name,
      category: product.category,
      price: product.price,
      description: product.description,
    });
  }

  await collection.add({ ids, documents, metadatas });
}

export async function queryProducts(
  category?: string,
  searchText?: string
): Promise<Product[]> {
  // Fallback to in-memory data if ChromaDB isn't available
  if (!useChroma || !collection) {
    return getProductsLocal(category);
  }

  if (searchText) {
    const where = category ? { category: { $eq: category } } : undefined;
    const results = await collection.query({
      queryTexts: [searchText],
      nResults: 20,
      where: where as any,
    });
    return mapQueryResults(results);
  }

  const where = category ? { category: { $eq: category } } : undefined;
  const results = await collection.get({ where: where as any });
  return mapGetResults(results);
}

export async function getChromaProductById(
  id: string
): Promise<Product | undefined> {
  if (!useChroma || !collection) {
    return PRODUCTS.find((p) => p.id === id);
  }

  const results = await collection.get({ ids: [id] });
  const products = mapGetResults(results);
  return products[0];
}

export async function getAllCategories(): Promise<string[]> {
  if (!useChroma || !collection) {
    return getCategoriesLocal();
  }

  const results = await collection.get({});
  const categories = new Set<string>();
  if (results.metadatas) {
    for (const meta of results.metadatas) {
      if (meta?.category) {
        categories.add(meta.category as string);
      }
    }
  }
  return [...categories].sort();
}

function mapQueryResults(results: any): Product[] {
  if (!results.ids?.[0]) return [];
  return results.ids[0].map((id: string, i: number) => {
    const meta = results.metadatas?.[0]?.[i] || {};
    return {
      id,
      name: meta.name as string,
      category: meta.category as string,
      price: meta.price as number,
      description: meta.description as string,
    };
  });
}

function mapGetResults(results: any): Product[] {
  if (!results.ids) return [];
  return results.ids.map((id: string, i: number) => {
    const meta = results.metadatas?.[i] || {};
    return {
      id,
      name: meta.name as string,
      category: meta.category as string,
      price: meta.price as number,
      description: meta.description as string,
    };
  });
}
