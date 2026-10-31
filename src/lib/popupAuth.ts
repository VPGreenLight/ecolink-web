import { signOut as doSignOut } from "@/lib/session"

/** Kiểm tra trang hiện tại có đang chạy trong Browser Popup Window hay không */
export function isAuthPopup(): boolean {
  if (typeof window === "undefined") return false
  const params = new URLSearchParams(window.location.search)
  return params.get("popup") === "1" || Boolean(window.opener)
}

/** Mở Browser Popup Window ở chính giữa màn hình người dùng */
export function openAuthPopup(mode: "login" | "register" = "login"): Window | null {
  if (typeof window === "undefined") return null

  const width = 480
  const height = 660
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2))
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2))

  const url = `/${mode}?popup=1`
  const popup = window.open(
    url,
    "EcoLinkAuthPopup",
    `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no,location=no,resizable=yes,scrollbars=yes`
  )

  if (popup) {
    popup.focus()
  } else {
    // Nếu trình duyệt chặn popup, fallback chuyển trang bình thường
    window.location.href = url
  }

  return popup
}

/** Mở Browser Popup Window xác nhận đăng xuất */
export function openLogoutPopup(): Window | null {
  if (typeof window === "undefined") return null

  const width = 420
  const height = 300
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2))
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2))

  const url = `/logout?popup=1`
  const popup = window.open(
    url,
    "EcoLinkLogoutPopup",
    `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no,location=no,resizable=yes`
  )

  if (popup) {
    popup.focus()
  } else {
    // Fallback nếu chặn popup
    doSignOut()
    window.location.href = "/"
  }

  return popup
}
