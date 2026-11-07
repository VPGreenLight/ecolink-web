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

const ROLE_JWT_KEYS = [
  "ecolink:jwt:user",
  "ecolink:jwt:recycler",
  "ecolink:jwt:staff",
  "ecolink:jwt:admin",
] as const

const listeners = new Set<() => void>()

const emit = () => listeners.forEach((l) => l())

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

    return {
      name: v.name,
      role: resolvedRole,
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
  if (!primed) {
    cached = readSession()
    primed = true
  }
  return cached
}

export function getAccessToken(): string | null {
  if (typeof localStorage === "undefined") return null
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

export function getRefreshToken(): string | null {
  if (typeof localStorage === "undefined") return null
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthTokens(tokens: {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: string | null
}) {
  if (typeof localStorage === "undefined") return
  try {
    if (tokens.accessToken) {
      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
    }
    if (tokens.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
    }
    if (tokens.expiresAt) {
      localStorage.setItem(TOKEN_EXPIRES_AT_KEY, tokens.expiresAt)
    }
  } catch {
    // Bỏ qua nếu trình duyệt khoá bộ nhớ cục bộ
  }
}

export function signIn(name: string, role: Role = "user", extra?: SessionExtra) {
  if (typeof localStorage === "undefined") return
  const payload: Session = {
    ...(extra ?? {}),
    name,
    role,
  }
  localStorage.setItem(KEY, JSON.stringify(payload))
  invalidate()
  emit()
}

export function updateSession(patch: Partial<Session>) {
  if (typeof localStorage === "undefined") return
  const current = getSession()
  if (!current) return
  const next: Session = {
    ...current,
    ...patch,
    name: patch.name ?? current.name,
    role: patch.role ?? current.role,
  }
  localStorage.setItem(KEY, JSON.stringify(next))
  invalidate()
  emit()
}

/** Xoá sạch toàn bộ phiên và khoá JWT trong localStorage (không gọi lại API logout). */
export function clearAuthStorage() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(KEY)
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
    for (const k of ROLE_JWT_KEYS) {
      localStorage.removeItem(k)
    }
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
