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

  // vite outputs to dist/widgets/index.html — rename to widget name
  const srcFile = resolve(outDir, "index.html");
  const destFile = resolve(outDir, `${widget}.html`);
  if (existsSync(srcFile)) {
    renameSync(srcFile, destFile);
    console.log(`  → ${destFile}`);
  }
}

console.log("\nAll widgets built successfully!");
