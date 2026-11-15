import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ruff compilado a WebAssembly carga su .wasm desde su propia carpeta: no debe empaquetarse.
  serverExternalPackages: ["@astral-sh/ruff-wasm-nodejs", "@react-pdf/renderer"],
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
