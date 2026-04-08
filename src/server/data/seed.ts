import { initChroma, seedProducts } from "../services/chroma.js";

export async function runSeed(): Promise<void> {
  console.log("Initializing ChromaDB...");
  await initChroma();
  console.log("Seeding products...");
  await seedProducts();
  console.log("Done! Products seeded successfully.");
}
