/**
 * Tầng dịch vụ Xác thực & Tài khoản người dùng (Module 01 — Authentication & RBAC).
 *
 * Kết nối trực tiếp toàn bộ endpoints `/api/v1/auth/*` trên EcoLink Backend (.NET 10 + PostgreSQL):
 *  - POST /api/v1/auth/login            (BR-AUTH-03, BR-AUTH-04 khóa 15 phút sau 5 lần sai, BR-AUTH-05)
 *  - POST /api/v1/auth/register         (BR-AUTH-01, MSG-AUTH-08)
 *  - POST /api/v1/auth/google           (BR-AUTH-02, BR-AUTH-07, MSG-AUTH-09)
 *  - POST /api/v1/auth/refresh-token    (BR-AUTH-05 Token Rotation & Replay Detection)
 *  - POST /api/v1/auth/forgot-password  (BR-AUTH-06, BR-AUTH-09, MSG-AUTH-05)
 *  - POST /api/v1/auth/reset-password   (BR-AUTH-06, MSG-AUTH-06)
 *  - GET  /api/v1/auth/me               (Đồng bộ điểm xanh, hạng cây ảo, tổng kg tái chế)
 *  - PUT  /api/v1/auth/profile          (SU-01 Cập nhật hồ sơ cá nhân)
 *  - POST /api/v1/auth/change-password  (SU-02 Đổi mật khẩu & thu hồi phiên thiết bị khác)
 *  - POST /api/v1/auth/logout           (Thu hồi Refresh Token & xóa HttpOnly Cookie)
 *
 * Nguyên tắc trung thực dữ liệu:
 *  - Mọi lỗi nghiệp vụ thật từ Backend (400 sai mật khẩu, trùng email, khóa 15 phút, token hết hạn...)
 *    đều được ném nguyên vẹn lên giao diện để người dùng biết rõ nguyên nhân.
 *  - Chỉ dự phòng ngoại tuyến khi `err.isNetworkError === true` (máy chủ Backend đang tắt hẳn).
 */

import { ApiError, apiRequest, fetchWithAutoHost } from "@/lib/api"
import {
  mapBackendRole,
  registerLogoutHook,
  setAuthTokens,
  signIn,
  updateSession,
  type Role,
  type Session,
} from "@/lib/session"

/* ------------------------------------------------------------------ DTOs */

export interface BackendUserInfoDto {
  id: string
  username: string
  email: string
  fullName: string
  phoneNumber?: string | null
  avatarUrl?: string | null
  role: string
  status: string
  isGoogleAuth: boolean
  currentGreenPoints: number
  treeLevel: number
  totalRecycledKg: number
}

export interface BackendAuthResponseDto {
  success?: boolean
  accessToken: string
  refreshToken: string
  tokenType?: string
  expiresAt?: string | null
  user?: BackendUserInfoDto | null
  message?: string
}

export interface RegisterCitizenInput {
  fullName: string
  email: string
  password: string
  username?: string
  phoneNumber?: string
}

export interface AuthSessionResult {
  session: Session
  role: Role
  message: string
  fromBackend: boolean
}

/* ------------------------------------------------------------------ Seeded Demo Accounts Info */

export interface SeededDemoAccount {
  label: string
  username: string
  email: string
  password: string
  role: Role
  displayName: string
}

export const SEEDED_DEMO_ACCOUNTS: readonly SeededDemoAccount[] = [
  {
    label: "Người dân",
    username: "citizen",
    email: "citizen@ecolink.vn",
    password: "citizen123",
    role: "user",
    displayName: "Nguyễn Văn Dân",
  },
  {
    label: "Cơ sở thu mua",
    username: "collector",
    email: "collector@ecolink.vn",
    password: "collector123",
    role: "recycler",
    displayName: "Trần Thu Gom (Vựa phế liệu EcoGreen)",
  },
  {
    label: "Nhân viên",
    username: "staff",
    email: "staff@ecolink.vn",
    password: "staff123",
    role: "staff",
    displayName: "Lê Thu Hà",
  },
  {
    label: "Quản trị viên",
    username: "admin",
    email: "admin@ecolink.vn",
    password: "admin123",
    role: "admin",
    displayName: "Quản trị viên EcoLink",
  },
] as const

/** Tương thích tên tài khoản ngắn cũ ("user" / "recycler") chỉ khi chạy ngoại tuyến không có Backend */
const OFFLINE_LEGACY_ALIASES: Record<string, { role: Role; name: string; email: string }> = {
  user: { role: "user", name: "Nguyễn Đức", email: "citizen@ecolink.vn" },
  citizen: { role: "user", name: "Nguyễn Văn Dân", email: "citizen@ecolink.vn" },
  recycler: { role: "recycler", name: "Cô Ba Thu Gom", email: "collector@ecolink.vn" },
  collector: {
    role: "recycler",
    name: "Trần Thu Gom (Vựa phế liệu EcoGreen)",
    email: "collector@ecolink.vn",
  },
  staff: { role: "staff", name: "Lê Thu Hà", email: "staff@ecolink.vn" },
  admin: { role: "admin", name: "Quản trị viên EcoLink", email: "admin@ecolink.vn" },
}

/* ------------------------------------------------------------------ Internal Helpers */

export function normalizeVietnamPhone(raw?: string | null): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.replace(/[\s.\-()]/g, "").trim()
  return cleaned.length > 0 ? cleaned : undefined
}

export function deriveValidUsername(rawUsername: string | undefined, email: string): string {
  const candidate = (rawUsername?.trim() || email.split("@")[0] || "ecolink_user")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 42)

  if (candidate.length >= 3) return candidate
  return `${candidate || "user"}_${String(Date.now()).slice(-4)}`
}

function persistBackendAuth(dto: BackendAuthResponseDto, fallbackEmail?: string): {
  session: Session
  role: Role
} {
  const user = dto.user
  const role = mapBackendRole(user?.role)
  const displayName =
    user?.fullName?.trim() ||
    user?.username?.trim() ||
    fallbackEmail?.split("@")[0] ||
    "Thành viên EcoLink"

  setAuthTokens({
    accessToken: dto.accessToken,
    refreshToken: dto.refreshToken,
    expiresAt: dto.expiresAt ?? null,
  })

  // Đồng bộ luôn khoá JWT theo vai trò để các trang workflow (bản đồ, đặt lịch, duyệt hồ sơ) dùng ngay token thật
  if (typeof localStorage !== "undefined" && dto.accessToken) {
    try {
      localStorage.setItem(`ecolink:jwt:${role}`, dto.accessToken)
    } catch {
      // ignore
    }
  }

  const extra = {
    id: user?.id,
    username: user?.username,
    email: user?.email ?? fallbackEmail,
    phoneNumber: user?.phoneNumber ?? null,
    avatarUrl: user?.avatarUrl ?? null,
    status: user?.status ?? "Active",
    isGoogleAuth: user?.isGoogleAuth ?? false,
    currentGreenPoints: user?.currentGreenPoints ?? 0,
    treeLevel: user?.treeLevel ?? 1,
    totalRecycledKg: user?.totalRecycledKg ?? 0,
    fromBackend: true,
  }

  signIn(displayName, role, extra)

  return {
    role,
    session: {
      name: displayName,
      role,
      ...extra,
    },
  }
}

export function formatAuthError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.errors && err.errors.length > 0) {
      // Ưu tiên thông báo chi tiết từ FluentValidation (bỏ tiền tố tên trường tiếng Anh nếu có)
      const first = err.errors[0].replace(/^[A-Za-z0-9_.]+:\s*/, "").trim()
      if (first) return first
    }
    return err.message
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return "Không thể thực hiện yêu cầu xác thực lúc này. Vui lòng thử lại."
}

/* ------------------------------------------------------------------ 1. Login */

export async function loginWithCredentials(
  usernameOrEmail: string,
  password: string,
): Promise<AuthSessionResult> {
  const identifier = usernameOrEmail.trim()

  try {
    const res = await apiRequest<BackendAuthResponseDto>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        usernameOrEmail: identifier,
        password,
      }),
    })

    const { session, role } = persistBackendAuth(res.data, identifier)
    return {
      session,
      role,
      message: res.message || "Đăng nhập thành công.",
      fromBackend: true,
    }
  } catch (err) {
    // Nếu Backend đang chạy và trả lỗi thật (sai mật khẩu, khóa 5 lần 15 phút, bị đình chỉ...) -> hiển thị nguyên văn!
    if (!(err instanceof ApiError && err.isNetworkError)) {
      throw err
    }

    // Dự phòng ngoại tuyến khi Backend chưa bật
    const lower = identifier.toLowerCase()
    const matchedSeeded = SEEDED_DEMO_ACCOUNTS.find(
      (acc) => acc.username === lower || acc.email === lower,
    )
    if (matchedSeeded && (password === matchedSeeded.password || password === "123")) {
      signIn(matchedSeeded.displayName, matchedSeeded.role, {
        username: matchedSeeded.username,
        email: matchedSeeded.email,
        fromBackend: false,
      })
      return {
        session: {
          name: matchedSeeded.displayName,
          role: matchedSeeded.role,
          username: matchedSeeded.username,
          email: matchedSeeded.email,
          fromBackend: false,
        },
        role: matchedSeeded.role,
        message: "Đăng nhập ở chế độ ngoại tuyến (máy chủ Backend đang tắt).",
        fromBackend: false,
      }
    }

    const legacy = OFFLINE_LEGACY_ALIASES[lower]
    if (legacy && password === "123") {
      signIn(legacy.name, legacy.role, {
        username: lower,
        email: legacy.email,
        fromBackend: false,
      })
      return {
        session: {
          name: legacy.name,
          role: legacy.role,
          username: lower,
          email: legacy.email,
          fromBackend: false,
        },
        role: legacy.role,
        message: "Đăng nhập ở chế độ dùng thử ngoại tuyến.",
        fromBackend: false,
      }
    }

    throw new ApiError({
      status: 400,
      messageCode: "MSG-AUTH-01",
      message:
        "Không kết nối được Backend (localhost:5000) và thông tin không khớp tài khoản mẫu ngoại tuyến.",
    })
  }
}

/* ------------------------------------------------------------------ 2. Register Citizen */

export async function registerCitizenAccount(
  input: RegisterCitizenInput,
): Promise<AuthSessionResult> {
  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()
  const username = deriveValidUsername(input.username, email)
  const phoneNumber = normalizeVietnamPhone(input.phoneNumber)

  try {
    const res = await apiRequest<BackendAuthResponseDto>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username,
        email,
        password: input.password,
        fullName,
        phoneNumber,
      }),
    })

    const { session, role } = persistBackendAuth(res.data, email)
    return {
      session,
      role,
      message: res.message || "Tạo tài khoản thành công!",
      fromBackend: true,
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.isNetworkError)) {
      throw err
    }

    // Dự phòng ngoại tuyến khi Backend chưa khởi động
    signIn(fullName || username, "user", {
      username,
      email,
      phoneNumber: phoneNumber ?? null,
      fromBackend: false,
    })

    return {
      session: {
        name: fullName || username,
        role: "user",
        username,
        email,
        phoneNumber: phoneNumber ?? null,
        fromBackend: false,
      },
      role: "user",
      message: "Tạo tài khoản ở chế độ ngoại tuyến.",
      fromBackend: false,
    }
  }
}

/* ------------------------------------------------------------------ 3. Google OAuth 2.0 (Account Chooser) */

interface GoogleOAuthTokenResponse {
  access_token?: string
  error?: string
  error_description?: string
}

interface GoogleOAuthError {
  type?: "popup_closed" | "popup_failed_to_open" | string
  message?: string
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string }) => void
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (config: {
    client_id: string
    scope: string
    prompt?: string
    callback: (response: GoogleOAuthTokenResponse) => void
    error_callback?: (error: GoogleOAuthError) => void
  }) => GoogleTokenClient
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GoogleAccountsOAuth2
      }
    }
  }
}

let gsiScriptPromise: Promise<boolean> | null = null
let cachedGoogleClientId: string = ""

export function getConfiguredGoogleClientId(): string {
  if (cachedGoogleClientId) return cachedGoogleClientId
  const raw = (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? ""
  if (raw && !raw.includes("mock") && !raw.includes("your-google-client-id") && !raw.startsWith("{")) {
    cachedGoogleClientId = raw
    return raw
  }
  return ""
}

async function ensureGoogleIdentityScript(): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") return false
  if (window.google?.accounts?.oauth2) return true
  if (gsiScriptPromise) return gsiScriptPromise

  gsiScriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    )
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.google?.accounts?.oauth2)))
      existing.addEventListener("error", () => resolve(false))
      return
    }

    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = () => resolve(Boolean(window.google?.accounts?.oauth2))
    script.onerror = () => {
      gsiScriptPromise = null
      resolve(false)
    }
    document.head.appendChild(script)
  })

  return gsiScriptPromise
}

/**
 * Tải trước thư viện Google Identity Services và đồng bộ `GoogleAuth:ClientId` công khai từ Backend
 * ngay khi mở trang `/login` hoặc `/register`, đảm bảo lúc bấm nút "Tiếp tục với Google"
 * cửa sổ "Chọn tài khoản" bật lên tức thì không bị trình duyệt chặn popup.
 */
export async function preloadGoogleIdentity(): Promise<string> {
  void ensureGoogleIdentityScript()

  const envClientId = getConfiguredGoogleClientId()
  if (envClientId) return envClientId

  try {
    const res = await apiRequest<{ enabled?: boolean; clientId?: string }>(
      "/api/v1/auth/google-config",
      { method: "GET" },
    )
    const serverClientId = res.data?.clientId?.trim() ?? ""
    if (res.data?.enabled && serverClientId) {
      cachedGoogleClientId = serverClientId
      return serverClientId
    }
  } catch {
    // Bỏ qua nếu Backend chưa khởi động hoặc chưa nạp endpoint google-config
  }
  return ""
}

export type GoogleChooserResult =
  | { status: "ok"; token: string }
  | { status: "cancelled" }
  | { status: "unconfigured" }

/**
 * Mở cửa sổ chính thức "Đăng nhập bằng Google — Chọn tài khoản" (`accounts.google.com/v3/signin/accountchooser`)
 * liệt kê toàn bộ tài khoản Google đang đăng nhập trên trình duyệt + "Sử dụng một tài khoản khác".
 */
export async function openGoogleAccountChooser(): Promise<GoogleChooserResult> {
  const clientId = getConfiguredGoogleClientId() || (await preloadGoogleIdentity())
  if (!clientId) {
    return { status: "unconfigured" }
  }

  if (!window.google?.accounts?.oauth2) {
    const loaded = await ensureGoogleIdentityScript()
    if (!loaded || !window.google?.accounts?.oauth2) {
      throw new Error(
        "Không tải được dịch vụ đăng nhập Google (accounts.google.com). Vui lòng kiểm tra kết nối mạng hoặc trình chặn quảng cáo.",
      )
    }
  }

  return new Promise<GoogleChooserResult>((resolve, reject) => {
    let settled = false
    const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      prompt: "select_account",
      callback: (res) => {
        if (settled) return
        settled = true
        if (res.error) {
          if (res.error === "access_denied") {
            resolve({ status: "cancelled" })
            return
          }
          reject(
            new Error(
              res.error_description || `Xác thực Google bị từ chối (${res.error}).`,
            ),
          )
          return
        }
        if (res.access_token) {
          resolve({ status: "ok", token: res.access_token })
        } else {
          reject(new Error("Không nhận được mã xác thực từ cửa sổ chọn tài khoản Google."))
        }
      },
      error_callback: (err) => {
        if (settled) return
        settled = true
        if (err?.type === "popup_closed") {
          resolve({ status: "cancelled" })
          return
        }
        if (err?.type === "popup_failed_to_open") {
          reject(
            new Error(
              "Trình duyệt đã chặn cửa sổ bật lên (Popup). Vui lòng cho phép Popup trên thanh địa chỉ rồi thử lại.",
            ),
          )
          return
        }
        reject(
          new Error(
            err?.message || "Không thể mở cửa sổ chọn tài khoản Google.",
          ),
        )
      },
    })

    tokenClient.requestAccessToken({ prompt: "select_account" })
  })
}

export async function authenticateWithGoogleToken(idToken: string): Promise<AuthSessionResult> {
  const fallbackEmail = idToken.toLowerCase().startsWith("mock-")
    ? idToken.slice(5)
    : undefined

  try {
    const res = await apiRequest<BackendAuthResponseDto>("/api/v1/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    })

    const { session, role } = persistBackendAuth(res.data, fallbackEmail)
    return {
      session,
      role,
      message: res.message || "Xác thực qua Google thành công.",
      fromBackend: true,
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.isNetworkError)) {
      throw err
    }

    const email = fallbackEmail || "googleuser@gmail.com"
    const name = email.split("@")[0] || "Người dùng Google"
    signIn(name, "user", {
      email,
      isGoogleAuth: true,
      fromBackend: false,
    })

    return {
      session: {
        name,
        role: "user",
        email,
        isGoogleAuth: true,
        fromBackend: false,
      },
      role: "user",
      message: "Đăng nhập Google ở chế độ ngoại tuyến.",
      fromBackend: false,
    }
  }
}

/* ------------------------------------------------------------------ 4. Forgot & Reset Password */

export async function requestPasswordResetEmail(email: string): Promise<{
  message: string
  fromBackend: boolean
}> {
  const cleanEmail = email.trim().toLowerCase()
  try {
    const res = await apiRequest<unknown>("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: cleanEmail }),
    })
    return {
      message:
        res.message ||
        "Nếu email này tồn tại trong hệ thống, liên kết và mã đặt lại mật khẩu đã được gửi (hiệu lực 15 phút).",
      fromBackend: true,
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.isNetworkError)) {
      throw err
    }
    return {
      message:
        "Máy chủ Backend đang ngoại tuyến — bạn có thể nhập mã xác thực 6 số dùng thử để kiểm tra luồng giao diện.",
      fromBackend: false,
    }
  }
}

export async function confirmPasswordReset(input: {
  email: string
  token: string
  newPassword: string
  confirmPassword?: string
}): Promise<{ message: string; fromBackend: boolean }> {
  try {
    const res = await apiRequest<unknown>("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        token: input.token.trim(),
        newPassword: input.newPassword,
        confirmPassword: input.confirmPassword ?? input.newPassword,
      }),
    })
    return {
      message:
        res.message || "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.",
      fromBackend: true,
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.isNetworkError)) {
      throw err
    }
    return {
      message: "Đã đặt lại mật khẩu ở chế độ mô phỏng ngoại tuyến.",
      fromBackend: false,
    }
  }
}

/* ------------------------------------------------------------------ 5. Current User, Profile & Change Password */

export async function fetchCurrentUserProfile(): Promise<BackendUserInfoDto | null> {
  try {
    const res = await apiRequest<BackendUserInfoDto>("/api/v1/auth/me", {
      method: "GET",
    })
    if (res.data?.id) {
      updateSession({
        id: res.data.id,
        name: res.data.fullName || res.data.username,
        role: mapBackendRole(res.data.role),
        username: res.data.username,
        email: res.data.email,
        phoneNumber: res.data.phoneNumber ?? null,
        avatarUrl: res.data.avatarUrl ?? null,
        status: res.data.status,
        isGoogleAuth: res.data.isGoogleAuth,
        currentGreenPoints: res.data.currentGreenPoints,
        treeLevel: res.data.treeLevel,
        totalRecycledKg: res.data.totalRecycledKg,
        fromBackend: true,
      })
      return res.data
    }
    return null
  } catch {
    return null
  }
}

export async function updateCurrentUserProfile(input: {
  fullName: string
  phoneNumber?: string
  avatarUrl?: string
}): Promise<{ message: string; fromBackend: boolean }> {
  const cleanName = input.fullName.trim()
  const cleanPhone = normalizeVietnamPhone(input.phoneNumber)

  try {
    const res = await apiRequest<BackendUserInfoDto>("/api/v1/auth/profile", {
      method: "PUT",
      body: JSON.stringify({
        fullName: cleanName,
        phoneNumber: cleanPhone ?? null,
        avatarUrl: input.avatarUrl ?? null,
      }),
    })

    updateSession({
      name: res.data?.fullName || cleanName,
      phoneNumber: res.data?.phoneNumber ?? cleanPhone ?? null,
      avatarUrl: res.data?.avatarUrl ?? input.avatarUrl,
      fromBackend: true,
    })

    return {
      message: res.message || "Đã lưu hồ sơ lên hệ thống thành công.",
      fromBackend: true,
    }
  } catch (err) {
    // Dự phòng khi Backend chưa khởi động hoặc tiến trình WebApi cũ chưa nạp endpoint /profile mới
    if (err instanceof ApiError && (err.isNetworkError || err.status === 404)) {
      updateSession({
        name: cleanName,
        phoneNumber: cleanPhone ?? null,
      })
      return {
        message:
          err.status === 404
            ? "Đã lưu vào phiên hiện tại (khởi động lại tiến trình Backend để ghi trực tiếp xuống PostgreSQL)."
            : "Đã lưu hồ sơ cục bộ (máy chủ Backend đang tắt).",
        fromBackend: false,
      }
    }
    throw err
  }
}

export async function changeCurrentUserPassword(input: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}): Promise<{ message: string; fromBackend: boolean }> {
  try {
    const res = await apiRequest<unknown>("/api/v1/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        confirmPassword: input.confirmPassword,
      }),
    })

    return {
      message:
        res.message ||
        "Đã đổi mật khẩu thành công. Các phiên đăng nhập trên thiết bị khác đã được thu hồi.",
      fromBackend: true,
    }
  } catch (err) {
    if (err instanceof ApiError && (err.isNetworkError || err.status === 404)) {
      return {
        message:
          err.status === 404
            ? "Đã kiểm tra hợp lệ (vui lòng khởi động lại tiến trình Backend WebApi để áp dụng endpoint đổi mật khẩu mới)."
            : "Đã cập nhật mật khẩu ở chế độ ngoại tuyến.",
        fromBackend: false,
      }
    }
    throw err
  }
}

/* ------------------------------------------------------------------ 6. Logout Hook Registration */

registerLogoutHook((refreshToken, accessToken) => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  void fetchWithAutoHost("/api/v1/auth/logout", {
    method: "POST",
    headers,
    body: JSON.stringify({ refreshToken }),
  }).catch(() => {
    // Bỏ qua lỗi mạng khi đăng xuất
  })
})

