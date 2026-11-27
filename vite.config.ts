import { defineConfig, loadEnv, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

function findOpenSslBinary(): string | null {
  const candidates = [
    "openssl",
    "D:\\Git\\usr\\bin\\openssl.exe",
    "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
    "C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe",
  ]
  for (const bin of candidates) {
    if (bin !== "openssl" && !fs.existsSync(bin)) continue
    try {
      execFileSync(bin, ["version"], { stdio: "ignore" })
      return bin
    } catch {
      // Try next OpenSSL location.
    }
  }
  return null
}

function collectLanIpv4Addresses(): string[] {
  const ips = new Set<string>()
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const info of entries ?? []) {
      if (info.family === "IPv4" && !info.internal) {
        ips.add(info.address)
      }
    }
  }
  return [...ips].sort()
}

function ensureLocalHttpsCerts(): { key: string; cert: string; caPath: string } | undefined {
  const certDir = path.resolve(import.meta.dirname, ".certs")
  const caKey = path.resolve(certDir, "ecolink-ca.key")
  const caCrt = path.resolve(certDir, "ecolink-ca.crt")
  const devKey = path.resolve(certDir, "ecolink-dev.key")
  const devCrt = path.resolve(certDir, "ecolink-dev.crt")
  const devCsr = path.resolve(certDir, "ecolink-dev.csr")
  const sanFile = path.resolve(certDir, "san.txt")
  const extFile = path.resolve(certDir, "ext.cnf")

  const lanIps = collectLanIpv4Addresses()
  const sanList = ["DNS:localhost", "IP:127.0.0.1", ...lanIps.map((ip) => `IP:${ip}`)].join(",")
  const hasCerts =
    fs.existsSync(caCrt) &&
    fs.existsSync(devKey) &&
    fs.existsSync(devCrt) &&
    fs.existsSync(sanFile) &&
    fs.readFileSync(sanFile, "utf8").trim() === sanList

  if (hasCerts) {
    return {
      key: fs.readFileSync(devKey, "utf8"),
      cert: fs.readFileSync(devCrt, "utf8"),
      caPath: caCrt,
    }
  }

  const openssl = findOpenSslBinary()
  if (!openssl) {
    console.warn("[ecolink] OpenSSL not found; falling back to HTTP for local dev server.")
    return undefined
  }

  fs.mkdirSync(certDir, { recursive: true })

  if (!fs.existsSync(caKey) || !fs.existsSync(caCrt)) {
    const caConf = path.resolve(certDir, "ca.cnf")
    fs.writeFileSync(
      caConf,
      [
        "[req]",
        "distinguished_name = dn",
        "x509_extensions = v3_ca",
        "prompt = no",
        "[dn]",
        "CN = EcoLink Local Dev CA",
        "O = EcoLink",
        "[v3_ca]",
        "subjectKeyIdentifier = hash",
        "authorityKeyIdentifier = keyid:always,issuer",
        "basicConstraints = critical, CA:TRUE, pathlen:0",
        "keyUsage = critical, digitalSignature, cRLSign, keyCertSign",
      ].join("\n"),
    )
    execFileSync(
      openssl,
      ["req", "-x509", "-new", "-nodes", "-newkey", "rsa:2048", "-days", "825", "-keyout", caKey, "-out", caCrt, "-config", caConf],
      { stdio: "ignore" },
    )
  }

  fs.writeFileSync(
    extFile,
    [
      "authorityKeyIdentifier = keyid,issuer",
      "basicConstraints = CA:FALSE",
      "keyUsage = critical, digitalSignature, keyEncipherment",
      "extendedKeyUsage = serverAuth",
      `subjectAltName = ${sanList}`,
    ].join("\n"),
  )

  execFileSync(
    openssl,
    ["req", "-new", "-nodes", "-newkey", "rsa:2048", "-keyout", devKey, "-out", devCsr, "-subj", "/CN=localhost/O=EcoLink"],
    { stdio: "ignore" },
  )
  execFileSync(
    openssl,
    ["x509", "-req", "-in", devCsr, "-CA", caCrt, "-CAkey", caKey, "-CAcreateserial", "-out", devCrt, "-days", "365", "-sha256", "-extfile", extFile],
    { stdio: "ignore" },
  )
  fs.writeFileSync(sanFile, sanList)

  return {
    key: fs.readFileSync(devKey, "utf8"),
    cert: fs.readFileSync(devCrt, "utf8"),
    caPath: caCrt,
  }
}

/** Cho phép điện thoại qua Wi-Fi tải trực tiếp Root CA cục bộ tại `/ecolink-ca.crt` nếu trình duyệt yêu cầu tin cậy chứng chỉ cho Camera/GPS. */
function serveLocalCaCert(caPath?: string): Plugin | null {
  if (!caPath) return null
  const attach = (middlewares: { use: (path: string, handler: (req: unknown, res: { setHeader: (k: string, v: string) => void; end: (b: string) => void }) => void) => void }) => {
    middlewares.use("/ecolink-ca.crt", (_req, res) => {
      res.setHeader("Content-Type", "application/x-x509-ca-cert")
      res.setHeader("Content-Disposition", 'attachment; filename="ecolink-ca.crt"')
      res.end(fs.readFileSync(caPath, "utf8"))
    })
  }
  return {
    name: "ecolink:serve-local-ca-cert",
    apply: "serve",
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}

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

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, ".", "")
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:5000"
  const useHttps = command === "serve" && env.VITE_HTTPS !== "false"
  const httpsCerts = useHttps ? ensureLocalHttpsCerts() : undefined
  const httpsOption = httpsCerts ? { key: httpsCerts.key, cert: httpsCerts.cert } : undefined
  const caPlugin = serveLocalCaCert(httpsCerts?.caPath)

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
    plugins: [react(), tailwindcss(), disableViteClientAutoReload(), ...(caPlugin ? [caPlugin] : [])],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    server: {
      host: true,
      port: 5173,
      allowedHosts: true,
      ...(httpsOption ? { https: httpsOption } : {}),
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
      ...(httpsOption ? { https: httpsOption } : {}),
      proxy,
    },
  }
})
