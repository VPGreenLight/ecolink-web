/**
 * Khung kết nối HTTP chuẩn hoá tới EcoLink Core Business API (.NET 10).
 *
 * Hỗ trợ:
 *  1. Khung phản hồi chuẩn `ApiResponse<T>` (`success`, `messageCode`, `message`, `data`, `errors`).
 *  2. Tự động gắn `Authorization: Bearer <token>` nếu người dùng đã đăng nhập JWT.
 *  3. Tự động đi qua Vite dev proxy (`/api/...`) và dự phòng sang `http://localhost:5000`
 *     hoặc `http://localhost:5017` khi chạy preview / khác cấu hình cổng Kestrel.
 *  4. An toàn tuyệt đối với SSR (`npm run check` / `npm run check:routes`) vì không
 *     gọi `window` hay `localStorage` ở mức khởi tạo module.
 */

export interface ApiResponse<T> {
  success: boolean
  messageCode?: string | null
  message?: string | null
  data: T
  errors?: string[] | null
  timestamp?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly messageCode?: string
  readonly errors?: string[]
  readonly isNetworkError: boolean

  constructor(opts: {
    message: string
    status?: number
    messageCode?: string
    errors?: string[]
    isNetworkError?: boolean
  }) {
    super(opts.message)
    this.name = "ApiError"
    this.status = opts.status ?? 0
    this.messageCode = opts.messageCode
    this.errors = opts.errors
    this.isNetworkError = opts.isNetworkError ?? false
  }
}

const configuredBase = (import.meta.env?.VITE_API_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "")

const FALLBACK_HOSTS = ["", "http://localhost:5000", "http://localhost:5017"] as const
let resolvedHost: string | null = configuredBase !== undefined ? configuredBase : null

function readAccessToken(): string | null {
  if (typeof localStorage === "undefined") return null
  try {
    const direct = localStorage.getItem("ecolink:token")
    if (direct) return direct
    const rawUser = localStorage.getItem("ecolink:user")
    if (!rawUser) return null
    const parsed = JSON.parse(rawUser) as { token?: string; accessToken?: string }
    return parsed?.token ?? parsed?.accessToken ?? null
  } catch {
    return null
  }
}

async function fetchWithAutoHost(path: string, init: RequestInit): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`

  if (resolvedHost !== null) {
    return fetch(`${resolvedHost}${normalizedPath}`, init)
  }

  let lastErr: unknown = null
  for (const host of FALLBACK_HOSTS) {
    try {
      const res = await fetch(`${host}${normalizedPath}`, init)
      // Nếu Vite proxy trả 502/504 hoặc static server trả HTML cho /api, thử cổng kế tiếp
      const ct = res.headers.get("content-type") ?? ""
      const isProxyDown = res.status === 502 || res.status === 504
      const isUnexpectedHtml = host === "" && ct.includes("text/html") && res.status === 404
      if (isProxyDown || isUnexpectedHtml) {
        continue
      }
      resolvedHost = host
      return res
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") throw err
      lastErr = err
    }
  }

  throw new ApiError({
    message:
      "Không thể kết nối tới máy chủ EcoLink Backend (localhost:5000). Vui lòng kiểm tra dịch vụ WebApi đã khởi động chưa.",
    isNetworkError: true,
    errors: lastErr instanceof Error ? [lastErr.message] : undefined,
  })
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers)
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json")
  }
  if (
    options.body &&
    typeof options.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json")
  }

  const token = readAccessToken()
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  let res: Response
  try {
    res = await fetchWithAutoHost(path, { ...options, headers })
  } catch (err) {
    if (err instanceof ApiError) throw err
    if ((err as { name?: string })?.name === "AbortError") throw err
    throw new ApiError({
      message:
        "Không thể kết nối tới máy chủ EcoLink Backend. Vui lòng kiểm tra kết nối mạng hoặc khởi động Backend.",
      isNetworkError: true,
    })
  }

  const text = await res.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }

  if (!res.ok) {
    const env = parsed as Partial<ApiResponse<unknown>> | null
    throw new ApiError({
      status: res.status,
      messageCode: env?.messageCode ?? undefined,
      message:
        env?.message ||
        (res.status === 404
          ? "Không tìm thấy dữ liệu yêu cầu."
          : `Yêu cầu thất bại (HTTP ${res.status}).`),
      errors: Array.isArray(env?.errors) ? env.errors : undefined,
    })
  }

  // Hỗ trợ cả endpoint bọc ApiResponse<T> lẫn endpoint trả trực tiếp mảng/đối tượng (như /waste-scan/rules)
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "success" in parsed &&
    typeof (parsed as { success: unknown }).success === "boolean"
  ) {
    const env = parsed as ApiResponse<T>
    if (!env.success) {
      throw new ApiError({
        status: res.status,
        messageCode: env.messageCode ?? undefined,
        message: env.message || "Xử lý yêu cầu không thành công.",
        errors: env.errors ?? undefined,
      })
    }
    return env
  }

  return {
    success: true,
    data: parsed as T,
    messageCode: "MSG-GEN-01",
    message: null,
  }
}

