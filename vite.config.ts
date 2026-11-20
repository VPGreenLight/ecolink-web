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
      host: true,
      port: 5173,
      allowedHosts: true,
      proxy,
      /*  TẮT HMR: HMR giữ một websocket giữa Vite và trình duyệt, nên khi tunnel
       *  chớp (mất websocket) hoặc dev server khởi động lại, Vite client tự gọi
       *  `location.reload()` — người đang xem qua tunnel bị tải lại trang.
       *
       *  Đang tắt để link demo không bị reload. Khi cần dev nhanh (tự cập nhật
       *  code lúc đang mở tab), đổi `false` thành `true` là xong. */
      hmr: false,
    },
    preview: {
      host: true,
      allowedHosts: true,
      proxy,
    },
  }
})
