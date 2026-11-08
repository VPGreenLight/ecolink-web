/**
 * Khung kết nối HTTP chuẩn hoá tới EcoLink Core Business API (.NET 10).
 *
 * Hỗ trợ:
 *  1. Khung phản hồi chuẩn `ApiResponse<T>` (`success`, `messageCode`, `message`, `data`, `errors`).
 *  2. Tự động gắn `Authorization: Bearer <token>` nếu người dùng đã đăng nhập JWT.
 *  3. Tự động xoay vòng Access Token (`POST /api/v1/auth/refresh-token` — BR-AUTH-05)
 *     theo cơ chế single-flight khi gặp `401 Unauthorized`, chống lỗi Replay Attack giả.
 *  4. Tự động đi qua Vite dev proxy (`/api/...`) và dự phòng sang `http://localhost:5000`
 *     hoặc `http://localhost:5017` khi chạy preview / khác cấu hình cổng Kestrel.
 *  5. An toàn tuyệt đối với SSR (`npm run check` / `npm run check:routes`) vì không
 *     gọi `window` hay `localStorage` ở mức khởi tạo module.
 */

import {
  clearAuthStorage,
  getAccessToken,
  getRefreshToken,
  mapBackendRole,
  setAuthTokens,
  updateSession,
} from "@/lib/session"

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

interface RefreshAuthDto {
  accessToken: string
  refreshToken?: string
  expiresAt?: string | null
  user?: {
    id: string
    username: string
    email: string
    fullName: string
    phoneNumber?: string | null
    avatarUrl?: string | null
    role: string
    status?: string
    isGoogleAuth?: boolean
    currentGreenPoints?: number
    treeLevel?: number
    totalRecycledKg?: number
  } | null
}

const configuredBase = (import.meta.env?.VITE_API_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "")

const FALLBACK_HOSTS = ["", "http://localhost:5000", "http://localhost:5017"] as const
let resolvedHost: string | null = configuredBase !== undefined ? configuredBase : null

let refreshInFlight: Promise<string | null> | null = null

const NO_AUTO_REFRESH_PATHS = [
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/register-recycler",
  "/api/v1/auth/google",
  "/api/v1/auth/refresh-token",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/logout",
]

function shouldAttemptRefresh(path: string): boolean {
  const lower = path.toLowerCase()
  return !NO_AUTO_REFRESH_PATHS.some((skip) => lower.startsWith(skip))
}

function readEffectiveAccessToken(): string | null {
  const direct = getAccessToken()
  if (direct) return direct
  if (typeof localStorage === "undefined") return null
  try {
    const rawUser = localStorage.getItem("ecolink:user")
    if (!rawUser) return null
    const parsed = JSON.parse(rawUser) as { token?: string; accessToken?: string }
    return parsed?.token ?? parsed?.accessToken ?? null
  } catch {
    return null
  }
}

export function getResolvedApiHost(): string {
  return resolvedHost ?? configuredBase ?? ""
}

export async function fetchWithAutoHost(path: string, init: RequestInit): Promise<Response> {
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

/**
 * Xoay vòng cặp Access Token + Refresh Token theo cơ chế Single-Flight (BR-AUTH-05).
 * Nhiều request cùng gặp 401 đồng thời sẽ dùng chung 1 tiến trình làm mới duy nhất.
 */
export async function rotateRefreshTokenSingleFlight(): Promise<string | null> {
  if (typeof window === "undefined") return null
  if (refreshInFlight) return refreshInFlight

  const storedRefresh = getRefreshToken()
  if (!storedRefresh) return null

  refreshInFlight = (async () => {
    try {
      const res = await fetchWithAutoHost("/api/v1/auth/refresh-token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      })

      if (!res.ok) {
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          clearAuthStorage()
        }
        return null
      }

      const raw = (await res.json()) as ApiResponse<RefreshAuthDto> | RefreshAuthDto
      const dto =
        raw && typeof raw === "object" && "data" in raw && raw.data
          ? raw.data
          : (raw as RefreshAuthDto)

      if (!dto?.accessToken) {
        clearAuthStorage()
        return null
      }

      setAuthTokens({
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken ?? storedRefresh,
        expiresAt: dto.expiresAt ?? null,
      })

      if (dto.user) {
        updateSession({
          id: dto.user.id,
          name: dto.user.fullName || dto.user.username,
          role: mapBackendRole(dto.user.role),
          username: dto.user.username,
          email: dto.user.email,
          phoneNumber: dto.user.phoneNumber ?? null,
          avatarUrl: dto.user.avatarUrl ?? null,
          status: dto.user.status,
          isGoogleAuth: dto.user.isGoogleAuth,
          currentGreenPoints: dto.user.currentGreenPoints,
          treeLevel: dto.user.treeLevel,
          totalRecycledKg: dto.user.totalRecycledKg,
          fromBackend: true,
        })
      }

      return dto.accessToken
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  _retriedAfterRefresh = false,
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

  const callerProvidedAuth = new Headers(options.headers).has("Authorization")
  const token = readEffectiveAccessToken()
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

  // Tự động thử xoay vòng Refresh Token 1 lần duy nhất nếu Access Token vừa hết hạn (401)
  if (
    res.status === 401 &&
    !_retriedAfterRefresh &&
    !callerProvidedAuth &&
    shouldAttemptRefresh(path) &&
    getRefreshToken()
  ) {
    const newAccessToken = await rotateRefreshTokenSingleFlight()
    if (newAccessToken) {
      const retryHeaders = new Headers(options.headers)
      retryHeaders.set("Authorization", `Bearer ${newAccessToken}`)
      return apiRequest<T>(path, { ...options, headers: retryHeaders }, true)
    }
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
    const env = parsed as Partial<ApiResponse<unknown>> & { message?: string } | null
    const detailErrors = Array.isArray(env?.errors) ? env.errors : undefined
    const primaryMessage =
      env?.message ||
      (detailErrors && detailErrors.length > 0 ? detailErrors[0] : undefined) ||
      (res.status === 404
        ? "Không tìm thấy dữ liệu yêu cầu."
        : res.status === 401
          ? "Phiên đăng nhập đã hết hạn hoặc chưa hợp lệ. Vui lòng đăng nhập lại."
          : `Yêu cầu thất bại (HTTP ${res.status}).`)

    throw new ApiError({
      status: res.status,
      messageCode: env?.messageCode ?? undefined,
      message: primaryMessage,
      errors: detailErrors,
    })
  }

  // Hỗ trợ cả endpoint bọc ApiResponse<T> lẫn endpoint trả trực tiếp mảng/đối tượng (như /auth/me, /waste-scan/rules)
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "success" in parsed &&
    typeof (parsed as { success: unknown }).success === "boolean" &&
    "data" in parsed
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
