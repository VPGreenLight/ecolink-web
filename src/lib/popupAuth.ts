import { isSsrSmokeTest } from "@/lib/hydration"
import { getSession } from "@/lib/session"

export type AuthModalMode = "login" | "register"

/** Kiểm tra trang hiện tại có đang chạy trong Browser Popup Window hay không. */
export function isAuthPopup(): boolean {
  if (typeof window === "undefined") return false
  const params = new URLSearchParams(window.location.search)
  return params.get("popup") === "1" || Boolean(window.opener)
}

/** Mở cửa sổ Đăng nhập / Đăng ký ở chính giữa màn hình. Nếu trình duyệt chặn
 *  popup (gọi ngoài user gesture) thì điều hướng thẳng tới trang `/login` hoặc
 *  `/register` (trang riêng, không phủ form lên trang chủ) nếu `fallbackRedirect` là true. */
export function openAuthPopup(
  mode: AuthModalMode = "login",
  fallbackRedirect: boolean = true,
): Window | null {
  if (typeof window === "undefined") return null

  const width = 480
  const height = 660
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2))
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2))

  const url = `/${mode}?popup=1`
  const popup = window.open(
    url,
    "EcoLinkAuthPopup",
    `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no,location=no,resizable=yes,scrollbars=yes`,
  )

  if (!popup) {
    if (fallbackRedirect) {
      window.location.href = url
    }
    return null
  }

  popup.focus()
  return popup
}

/** Kiểm tra đã đăng nhập trước khi thực hiện thao tác nghiệp vụ; nếu là Guest thì mở popup đăng nhập. */
export function requireAuthenticatedAction(mode: AuthModalMode = "login"): boolean {
  if (getSession() || isSsrSmokeTest()) return true
  openAuthPopup(mode)
  return false
}

/** Che một phần số điện thoại cơ sở thu mua khi hiển thị cho Guest (BR-HND-08). */
export function maskPhoneForGuest(phone?: string | null): string {
  const raw = (phone ?? "").trim()
  if (!raw) return "Chưa cập nhật"
  if (raw.length <= 6) return `${raw.slice(0, 2)}***`
  return `${raw.slice(0, 4)}***${raw.slice(-3)}`
}