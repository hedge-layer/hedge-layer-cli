import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  outExtension: () => ({ js: ".mjs" }),
});
