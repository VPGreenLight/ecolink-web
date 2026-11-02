import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export default function ConfirmLogoutDialog({
  open,
  onClose,
  onConfirm,
  userName,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  userName?: string
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-dialog-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3.5 grid size-12 place-items-center rounded-full bg-red-50 text-red-600">
          <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 id="logout-dialog-title" className="text-base font-bold text-ink">
          Xác nhận đăng xuất
        </h2>
        <p className="mt-2 text-sm text-muted">
          {userName
            ? `Bạn có chắc chắn muốn đăng xuất tài khoản "${userName}" không?`
            : "Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc này?"}
        </p>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-xl border border-line bg-surface text-sm font-semibold text-body transition-colors hover:bg-surface-2 cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 flex-1 rounded-xl bg-red-600 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-red-700 cursor-pointer"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  )

  if (mounted && typeof document !== "undefined") {
    return createPortal(content, document.body)
  }

  return content
}
