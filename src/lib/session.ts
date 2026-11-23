import { useSyncExternalStore } from "react"

/** 4 vai trò sau khi đăng nhập. GUEST = chưa đăng nhập, không lưu gì. */
export type Role = "user" | "recycler" | "staff" | "admin"

export const ROLE_LABEL: Record<Role, string> = {
  user: "Người dân",
  recycler: "Cơ sở thu mua",
  staff: "Nhân viên",
  admin: "Quản trị viên",
}

/** Trang chủ sau khi đăng nhập, theo vai trò. */
export const ROLE_HOME: Record<Role, string> = {
  user: "/user",
  recycler: "/recycler",
  staff: "/staff",
  admin: "/admin",
}

const KEY = "ecolink:user"
export const ACCESS_TOKEN_KEY = "ecolink:token"
export const REFRESH_TOKEN_KEY = "ecolink:refresh_token"
export const TOKEN_EXPIRES_AT_KEY = "ecolink:token_expires_at"
export const SESSION_COOKIE_FLAG = "ecolink_session_active"
export const COOKIE_SESSION_SENTINEL = "__cookie_auth__"
export const COOKIE_REFRESH_SENTINEL = "__cookie_refresh__"

const ROLE_JWT_KEYS = [
  "ecolink:jwt:user",
  "ecolink:jwt:recycler",
  "ecolink:jwt:staff",
  "ecolink:jwt:admin",
] as const

// Lưu token tạm thời trong bộ nhớ RAM (tuyệt đối không lưu JWT/RefreshToken vào localStorage).
let inMemoryAccessToken: string | null = null
let inMemoryRefreshToken: string | null = null
let inMemoryExpiresAt: string | null = null
let legacyPurged = false

const listeners = new Set<() => void>()

const emit = () => listeners.forEach((l) => l())

export function isRealJwt(token?: string | null): boolean {
  if (!token) return false
  const parts = token.split(".")
  return parts.length === 3 && parts.every((p) => p.length > 0)
}

export function purgeLegacyTokenStorage(): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
    for (const k of ROLE_JWT_KEYS) {
      localStorage.removeItem(k)
    }
  } catch {
    // Bỏ qua nếu bộ nhớ bị khóa
  }
}

export function hasSessionCookieFlag(): boolean {
  if (typeof document === "undefined") return false
  try {
    return document.cookie
      .split(";")
      .some((part) => part.trim().startsWith(`${SESSION_COOKIE_FLAG}=1`))
  } catch {
    return false
  }
}

function setSessionCookieFlag(active: boolean): void {
  if (typeof document === "undefined") return
  try {
    const isHttps = typeof window !== "undefined" && window.location?.protocol === "https:"
    const secureAttr = isHttps ? "; Secure" : ""
    document.cookie = active
      ? `${SESSION_COOKIE_FLAG}=1; Path=/; Max-Age=604800; SameSite=Lax${secureAttr}`
      : `${SESSION_COOKIE_FLAG}=; Path=/; Max-Age=0; SameSite=Lax${secureAttr}`
  } catch {
    // Bỏ qua nếu cookie bị khóa
  }
}

export type Session = {
  name: string
  role: Role
  id?: string
  username?: string
  email?: string
  phoneNumber?: string | null
  avatarUrl?: string | null
  status?: string
  isGoogleAuth?: boolean
  currentGreenPoints?: number
  treeLevel?: number
  totalRecycledKg?: number
  fromBackend?: boolean
}

export type SessionExtra = Omit<Session, "name" | "role">

type LogoutHook = (refreshToken: string | null, accessToken: string | null) => void
let logoutHook: LogoutHook | null = null

export function registerLogoutHook(fn: LogoutHook) {
  logoutHook = fn
}

/**
 * Chuẩn hoá tên vai trò trả về từ Backend C# (`Citizen`/`User`, `Recycler`/`Collector`, `Staff`, `Admin`)
 * sang tập 4 vai trò chuẩn của Frontend.
 */
export function mapBackendRole(rawRole?: string | null): Role {
  const norm = (rawRole ?? "").trim().toLowerCase()
  if (norm === "admin") return "admin"
  if (norm === "staff") return "staff"
  if (norm === "recycler" || norm === "collector") return "recycler"
  return "user"
}

/** Bộ nhớ đệm của getSnapshot.
 *
 *  BẮT BUỘC phải có. `useSyncExternalStore` so sánh kết quả của `getSnapshot`
 *  bằng `Object.is`: nếu mỗi lần gọi đều trả về object MỚI thì luôn khác
 *  nhau, React coi là đã đổi rồi render lại, lại gọi, lại khác... đến khi vượt
 *  "Maximum update depth exceeded" và **dựng lại cả cây — trang trắng**. */
let cached: Session | null = null
let primed = false

function normalizeSessionObject(
  v: Partial<Session> & { name: string; role: Role },
): Session {
  return {
    name: v.name,
    role: v.role,
    ...(typeof v.id === "string" ? { id: v.id } : {}),
    ...(typeof v.username === "string" ? { username: v.username } : {}),
    ...(typeof v.email === "string" ? { email: v.email } : {}),
    ...(v.phoneNumber !== undefined ? { phoneNumber: v.phoneNumber } : {}),
    ...(v.avatarUrl !== undefined ? { avatarUrl: v.avatarUrl } : {}),
    ...(typeof v.status === "string" ? { status: v.status } : {}),
    ...(typeof v.isGoogleAuth === "boolean" ? { isGoogleAuth: v.isGoogleAuth } : {}),
    ...(typeof v.currentGreenPoints === "number"
      ? { currentGreenPoints: v.currentGreenPoints }
      : {}),
    ...(typeof v.treeLevel === "number" ? { treeLevel: v.treeLevel } : {}),
    ...(typeof v.totalRecycledKg === "number" ? { totalRecycledKg: v.totalRecycledKg } : {}),
    ...(typeof v.fromBackend === "boolean" ? { fromBackend: v.fromBackend } : {}),
  }
}

function readSession(): Session | null {
  // Máy chủ thật không có localStorage. Guard ở đây (thay vì chỉ ở nhánh
  // server) để getSnapshot và getServerSnapshot đọc CÙNG một nguồn — hai
  // nhánh trả hai giá trị khác nhau chính là mẫu hình React báo lệch
  // hydration, và làm mọi route có RequireRole render sai ở lần đầu.
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<Session> | null
    if (!v || typeof v.name !== "string") return null
    const resolvedRole: Role = ROLE_LABEL[v.role as Role]
      ? (v.role as Role)
      : mapBackendRole(typeof v.role === "string" ? v.role : undefined)

    return normalizeSessionObject({
      ...v,
      name: v.name,
      role: resolvedRole,
    })
  } catch {
    return null
  }
}

/** Bỏ đệm để lần đọc kế tiếp nạp lại từ localStorage. */
function invalidate() {
  cached = null
  primed = false
}

export function getSession(): Session | null {
  if (!legacyPurged) {
    legacyPurged = true
    purgeLegacyTokenStorage()
  }
  if (!primed) {
    cached = readSession()
    primed = true
  }
  return cached
}

export function getAccessToken(): string | null {
  if (inMemoryAccessToken) return inMemoryAccessToken
  if (hasSessionCookieFlag() || getSession()?.fromBackend) {
    return COOKIE_SESSION_SENTINEL
  }
  return null
}

export function getRefreshToken(): string | null {
  if (inMemoryRefreshToken) return inMemoryRefreshToken
  if (hasSessionCookieFlag() || getSession()?.fromBackend) {
    return COOKIE_REFRESH_SENTINEL
  }
  return null
}

export function hasLiveBackendAuth(): boolean {
  return Boolean(getSession()?.fromBackend || hasSessionCookieFlag() || inMemoryAccessToken)
}

export function getJwtRole(token?: string | null): Role | null {
  if (!isRealJwt(token)) return null
  const parts = token!.split(".")
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
    if (typeof atob !== "function") return null
    const json = atob(padded)
    const payload = JSON.parse(json) as Record<string, unknown>
    const rawRole =
      payload.role ??
      payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]
    if (typeof rawRole === "string" && rawRole.trim()) {
      return mapBackendRole(rawRole)
    }
    if (Array.isArray(rawRole)) {
      const first = rawRole.find((r) => typeof r === "string" && r.trim())
      if (typeof first === "string") return mapBackendRole(first)
    }
    return null
  } catch {
    return null
  }
}

export function getInMemoryJwtRole(): Role | null {
  return getJwtRole(inMemoryAccessToken)
}

/**
 * Kiểm tra payload `exp` của JWT phía client (không xác minh chữ ký).
 * Trả về `false` nếu chuỗi không phải JWT chuẩn để tránh xóa nhầm token cookie/sentinel.
 */
export function isJwtExpired(token?: string | null, leewaySeconds = 10): boolean {
  if (!token) return false
  const parts = token.split(".")
  if (parts.length !== 3) return false
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
    if (typeof atob !== "function") return false
    const json = atob(padded)
    const payload = JSON.parse(json) as { exp?: unknown }
    if (typeof payload.exp !== "number") return false
    return Date.now() >= payload.exp * 1000 - leewaySeconds * 1000
  } catch {
    return false
  }
}

export function isStoredAccessTokenExpired(leewaySeconds = 10): boolean {
  if (inMemoryExpiresAt) {
    const expiresMs = Date.parse(inMemoryExpiresAt)
    if (!Number.isNaN(expiresMs) && Date.now() >= expiresMs - leewaySeconds * 1000) {
      return true
    }
  }
  if (inMemoryAccessToken && isRealJwt(inMemoryAccessToken)) {
    return isJwtExpired(inMemoryAccessToken, leewaySeconds)
  }
  // Khi dùng HttpOnly Cookie sau reload (RAM rỗng), để Backend tự kiểm tra hạn dùng & 401
  return false
}

export function setAuthTokens(tokens: {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: string | null
}) {
  purgeLegacyTokenStorage()
  if (tokens.accessToken) {
    inMemoryAccessToken = tokens.accessToken
  }
  if (tokens.refreshToken) {
    inMemoryRefreshToken = tokens.refreshToken
  }
  if (tokens.expiresAt !== undefined) {
    inMemoryExpiresAt = tokens.expiresAt ?? null
  }
  setSessionCookieFlag(true)
}

export function signIn(name: string, role: Role = "user", extra?: SessionExtra) {
  if (typeof localStorage === "undefined") return
  const payload = normalizeSessionObject({
    ...(extra ?? {}),
    name,
    role,
  })
  localStorage.setItem(KEY, JSON.stringify(payload))
  invalidate()
  emit()
}

export function updateSession(patch: Partial<Session>) {
  if (typeof localStorage === "undefined") return
  const current = getSession()
  if (!current) return
  const next = normalizeSessionObject({
    ...current,
    ...patch,
    name: patch.name ?? current.name,
    role: patch.role ?? current.role,
  })
  const prevJson = JSON.stringify(normalizeSessionObject(current))
  const nextJson = JSON.stringify(next)
  if (prevJson === nextJson) return

  localStorage.setItem(KEY, nextJson)
  invalidate()
  emit()
}

/** Xoá sạch toàn bộ phiên, token trong RAM, cookie cờ và khoá JWT cũ trong localStorage. */
export function clearAuthStorage() {
  inMemoryAccessToken = null
  inMemoryRefreshToken = null
  inMemoryExpiresAt = null
  setSessionCookieFlag(false)
  purgeLegacyTokenStorage()

  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(KEY)
    localStorage.removeItem("ecolink:m12_entitlements")
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ecolink:auth-cleared"))
  }
  invalidate()
  emit()
}

export function signOut() {
  const prevRefresh = getRefreshToken()
  const prevAccess = getAccessToken()
  clearAuthStorage()

  // Chỉ thu hồi Refresh Token trên máy chủ khi đang chạy trong trình duyệt thật
  if (typeof window !== "undefined" && logoutHook && (prevRefresh || prevAccess)) {
    try {
      logoutHook(prevRefresh, prevAccess)
    } catch {
      // Không chặn luồng đăng xuất UI nếu mất kết nối
    }
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // keep other tabs in sync — bỏ đệm TRƯỚC khi báo, nếu không React so được với
  // giá trị cũ rồi mới vỡ
  const onStorage = () => {
    invalidate()
    onChange()
  }
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage)
  }
  return () => {
    listeners.delete(onChange)
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage)
    }
  }
}

/** phiên hiện tại, hoặc null khi chưa đăng nhập. */
export function useSession() {
  return useSyncExternalStore(subscribe, getSession, getSession)
}

/** Tên hiển thị, hoặc "" khi chưa đăng nhập. */
export function useUser() {
  return useSession()?.name ?? ""
}

export function useRole(): Role | null {
  return useSession()?.role ?? null
}
