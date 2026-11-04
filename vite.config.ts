import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "")
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:5000"

  const proxy = {
    "/api": {
      target: apiTarget,
      changeOrigin: true,
    },
    "/hubs": {
      target: apiTarget,
      ws: true,
      changeOrigin: true,
    },
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    server: {
      port: 5173,
      proxy,
    },
    preview: {
      proxy,
    },
  }
})
