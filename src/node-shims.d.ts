/** Khai báo kiểu tối thiểu cho các script kiểm thử Node (`check.tsx`, `check-routes.tsx`)
 *  và `vite.config.ts` khi môi trường máy trạm chưa cài `@types/node` toàn cục. */
declare module "node:path" {
  export function resolve(...paths: string[]): string
  const path: { resolve(...paths: string[]): string }
  export default path
}

declare module "node:fs" {
  export function existsSync(p: string): boolean
  export function mkdirSync(p: string, opts?: { recursive?: boolean }): void
  export function readFileSync(p: string, enc: "utf8"): string
  export function writeFileSync(p: string, data: string): void
  const fs: {
    existsSync: typeof existsSync
    mkdirSync: typeof mkdirSync
    readFileSync: typeof readFileSync
    writeFileSync: typeof writeFileSync
  }
  export default fs
}

declare module "node:os" {
  export interface NetworkInterfaceInfo {
    address: string
    family: string | number
    internal: boolean
  }
  export function networkInterfaces(): Record<string, NetworkInterfaceInfo[] | undefined>
  const os: { networkInterfaces: typeof networkInterfaces }
  export default os
}

declare module "node:child_process" {
  export function execFileSync(file: string, args?: string[], opts?: { stdio?: string }): unknown
}

interface ImportMeta {
  readonly dirname: string
}

declare const process: {
  exit(code?: number): never
  env: Record<string, string | undefined>
}

