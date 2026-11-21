import { useEffect } from "react"
import AuthForm from "@/components/AuthForm"
import { closeAuthModal, useAuthModalMode } from "@/lib/popupAuth"

/** Hộp thoại Đăng nhập / Đăng ký Trang Nhỏ thống nhất trên toàn ứng dụng. */
export default function CompactAuthModal() {
  const mode = useAuthModalMode()

  useEffect(() => {
    if (!mode || typeof document === "undefined") return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAuthModal()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [mode])

  if (!mode) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "register" ? "Tạo tài khoản EcoLink" : "Đăng nhập EcoLink"}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeAuthModal()
      }}
    >
      <div className="my-auto w-full max-w-[420px]">
        <AuthForm key={mode} mode={mode} onClose={closeAuthModal} />
      </div>
    </div>
  )
}
