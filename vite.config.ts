import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Prefer values from .env files, but fall back to OS-level environment variables for developers who don't want a local .env
  const alphaKey = (env.API_KEY || process.env.API_KEY || "").trim();

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/yapi": {
          target: "https://query1.finance.yahoo.com",
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/yapi/, ""),
        },
        // Server-side proxy for Alpha Vantage to keep API key private in dev
        "/avapi": {
          target: "https://www.alphavantage.co",
          changeOrigin: true,
          secure: true,
          // Map /avapi?... -> /query?...&apikey=XXXX (only if API key is provided)
          rewrite: (p) => {
            const base = p.replace(/^\/avapi/, "/query");
            if (!alphaKey) return base; // avoid appending an empty apikey param
            const hasQuery = base.includes("?");
            const suffix = `${hasQuery ? "&" : "?"}apikey=${encodeURIComponent(alphaKey)}`;
            return `${base}${suffix}`;
          },
        },
      },
    },
    // Allow exposing variables prefixed with API_ (e.g., API_KEY) to client code
    // Note: We still keep this for other potential vars, but Alpha Vantage key is used via server proxy now
    envPrefix: ["VITE_", "API_"],
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
