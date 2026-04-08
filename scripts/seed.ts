import { runSeed } from "../src/server/data/seed.js";

runSeed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
