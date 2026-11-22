import { defineConfig, loadEnv, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

/**
 * Ngắt kết nối WebSocket `vite-hmr` và vô hiệu hoá `location.reload()` bên trong `/@vite/client`
 * khi tắt HMR/WS (`hmr: false` hoặc `ws: false`), nhưng vẫn giữ nguyên các hàm `updateStyle` /
 * `removeStyle` để nạp CSS (Tailwind, Leaflet) bình thường và không in lỗi đỏ WebSocket ra Console.
 */
function disableViteClientAutoReload(): Plugin {
  let wsDisabled = false

  return {
    name: "ecolink:disable-vite-client-autoreload",
    apply: "serve",
    enforce: "post",
    configResolved(resolved) {
      wsDisabled = resolved.server.hmr === false || resolved.server.ws === false
    },
    transform(code, id) {
      if (!wsDisabled) return null
      const normalizedId = id.replace(/\\/g, "/")
      if (
        !normalizedId.includes("/vite/dist/client/") ||
        (!normalizedId.includes("client.mjs") && !normalizedId.includes("bundledDevClient.mjs"))
      ) {
        return null
      }

      const patched = code
        .replace(
          /console\.debug\("\[vite\] connecting\.\.\."\);?/g,
          "/* [ecolink] vite-hmr ws disabled */",
        )
        .replace(
          /transport\.connect\(createHMRHandler\(handleMessage\)\);?/g,
          "/* [ecolink] vite-hmr transport disabled */",
        )
        .replace(
          /setupForwardConsoleHandler\(transport,\s*forwardConsole\);?/g,
          "/* [ecolink] forward console disabled */",
        )
        .replace(/\blocation\.reload\(\)/g, "void 0")

      return { code: patched, map: null }
    },
  }
}

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
    plugins: [react(), tailwindcss(), disableViteClientAutoReload()],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    server: {
      host: true,
      port: 5173,
      allowedHosts: true,
      proxy,
      /*  TẮT HMR & DEV WEBSOCKET (`vite-hmr`):
       *  Trên Vite 8, `hmr: false` một mình KHÔNG tắt WebSocket server (`server.ws`)
       *  và `/@vite/client` vẫn tự gọi `location.reload()` khi tunnel chớp rớt WS.
       *  Cần kết hợp `hmr: false` + `ws: false` + plugin `disableViteClientAutoReload()`
       *  (không ảnh hưởng tới WebSocket SignalR `/hubs` vì `/hubs` đi qua `proxy`).
       *
       *  Khi cần dev nhanh (tự cập nhật code lúc đang mở tab), đổi `hmr: false` thành
       *  `hmr: true` và xoá dòng `ws: false` là xong. */
      hmr: false,
      ws: false,
    },
    preview: {
      host: true,
      allowedHosts: true,
      proxy,
    },
  }
})
