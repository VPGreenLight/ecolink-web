/** Khai báo kiểu tối thiểu cho các script kiểm thử Node (`check.tsx`, `check-routes.tsx`)
 *  và `vite.config.ts` khi môi trường máy trạm chưa cài `@types/node` toàn cục. */
declare module "node:path" {
  export function resolve(...paths: string[]): string
  const path: { resolve(...paths: string[]): string }
  export default path
}

interface ImportMeta {
  readonly dirname: string
}

declare const process: {
  exit(code?: number): never
  env: Record<string, string | undefined>
}

