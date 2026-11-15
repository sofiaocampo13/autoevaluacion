import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ruff compilado a WebAssembly carga su .wasm desde su propia carpeta: no debe empaquetarse.
  serverExternalPackages: ["@astral-sh/ruff-wasm-nodejs", "@react-pdf/renderer"],
  // Las páginas de revisión docente llevan un enlace secreto en la URL: que no viaje en el encabezado Referer,
  // que no se indexe y que nunca se guarde en caché.
  async headers() {
    return [
      {
        source: "/revision/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
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
