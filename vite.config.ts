import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";

// Build target is set via WIDGET env var (e.g., "product-catalog")
const widget = process.env.WIDGET;

if (!widget) {
  // Fallback: multi-page build without single-file inlining
  // (used if someone runs `vite build` directly)
  console.warn(
    "No WIDGET env var set. Building all widgets without single-file inlining."
  );
}

export default defineConfig(
  widget
    ? {
        // Single widget build (self-contained HTML)
        plugins: [react(), viteSingleFile()],
        root: `src/widgets/${widget}`,
        build: {
          outDir: resolve(__dirname, "dist/widgets"),
          emptyOutDir: false,
          rollupOptions: {
            input: resolve(__dirname, `src/widgets/${widget}/index.html`),
          },
        },
      }
    : {
        // Multi-page fallback (no inlining)
        plugins: [react()],
        root: "src/widgets",
        build: {
          outDir: resolve(__dirname, "dist/widgets"),
          emptyOutDir: true,
          rollupOptions: {
            input: {
              "product-catalog": resolve(
                __dirname,
                "src/widgets/product-catalog/index.html"
              ),
              "shopping-cart": resolve(
                __dirname,
                "src/widgets/shopping-cart/index.html"
              ),
              checkout: resolve(
                __dirname,
                "src/widgets/checkout/index.html"
              ),
            },
          },
        },
      }
);
