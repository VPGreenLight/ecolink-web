import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { signOut, useSession } from "@/lib/session"
import { isAuthPopup } from "@/lib/popupAuth"

export default function Logout() {
  const session = useSession()
  const navigate = useNavigate()
  const isPopup = isAuthPopup()
  const [done, setDone] = useState(false)

  const handleLogout = () => {
    signOut()
    setDone(true)
    if (isPopup && window.opener) {
      try {
        window.opener.postMessage({ type: "AUTH_LOGOUT" }, "*")
      } catch {}
      setTimeout(() => {
        window.close()
      }, 500)
    } else {
      setTimeout(() => {
        navigate("/")
      }, 500)
    }
  }

  const handleCancel = () => {
    if (isPopup) {
      window.close()
    } else {
      navigate(-1)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-page p-6 text-center">
      <div className="w-full max-w-[380px] rounded-2xl border border-line bg-white p-6 shadow-sm">
        <img src="/assets/brand/logo1.png" alt="EcoLink" className="mx-auto mb-4 h-12 w-auto" />

        {done ? (
          <div>
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-mint/20 text-brand-deep">
              <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="2">
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-ink">Đã đăng xuất thành công</h1>
            <p className="mt-1 text-xs text-muted">Cửa sổ sẽ tự đóng lại trong giây lát...</p>
          </div>
        ) : (
          <div>
            <h1 className="text-lg font-bold text-ink">Xác nhận đăng xuất</h1>
            <p className="mt-2 text-sm text-muted">
              {session?.name
                ? `Bạn có chắc chắn muốn đăng xuất tài khoản "${session.name}" không?`
                : "Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc này?"}
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="h-10 flex-1 rounded-xl border border-line bg-surface text-sm font-semibold text-body transition-colors hover:bg-surface-2"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="h-10 flex-1 rounded-xl bg-warn text-sm font-semibold text-white shadow-xs transition-colors hover:opacity-90"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
