import { useSyncExternalStore } from "react"
import { isSsrSmokeTest } from "@/lib/hydration"
import { getSession } from "@/lib/session"

export type AuthModalMode = "login" | "register"

let currentModalMode: AuthModalMode | null = null
const modalListeners = new Set<() => void>()

const emitModal = () => modalListeners.forEach((l) => l())

/** Kiểm tra trang hiện tại có đang chạy trong Browser Popup Window hay không. */
export function isAuthPopup(): boolean {
  if (typeof window === "undefined") return false
  const params = new URLSearchParams(window.location.search)
  return params.get("popup") === "1" || Boolean(window.opener)
}

/** Mở hộp thoại Đăng nhập / Đăng ký dạng Trang Nhỏ thống nhất ở giữa màn hình. */
export function openAuthModal(mode: AuthModalMode = "login"): void {
  if (typeof window === "undefined") return
  currentModalMode = mode
  emitModal()
}

export function closeAuthModal(): void {
  if (currentModalMode === null) return
  currentModalMode = null
  emitModal()
}

export function getAuthModalMode(): AuthModalMode | null {
  return currentModalMode
}

function subscribeAuthModal(onChange: () => void) {
  modalListeners.add(onChange)
  return () => {
    modalListeners.delete(onChange)
  }
}

export function useAuthModalMode(): AuthModalMode | null {
  return useSyncExternalStore(subscribeAuthModal, getAuthModalMode, () => null)
}

/** Mở giao diện Đăng nhập / Đăng ký Trang Nhỏ (hợp nhất về Compact Auth Modal). */
export function openAuthPopup(mode: AuthModalMode = "login"): Window | null {
  openAuthModal(mode)
  return null
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
