import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Check, Mail, ShieldCheck } from "lucide-react"
import { openAuthPopup } from "@/lib/popupAuth"
import {
  confirmPasswordReset,
  formatAuthError,
  requestPasswordResetEmail,
} from "@/lib/authApi"

/** U-18 và R-07 dùng chung trang này: kết nối trực tiếp tới
 *  `POST /api/v1/auth/forgot-password` (BR-AUTH-06, BR-AUTH-09) và
 *  `POST /api/v1/auth/reset-password` (MSG-AUTH-06).
 *
 *  Hỗ trợ cả 2 cách vào Bước 2:
 *   1. Bấm trực tiếp nút "Đặt Lại Mật Khẩu" trong email Gmail (`?token=...`).
 *   2. Nhập email ở Bước 1 rồi dán mã xác nhận bảo mật từ email vào Bước 2. */
type Step = "email" | "code" | "done"

const STEPS: [string, Step][] = [
  ["Nhập email", "email"],
  ["Nhập mã và mật khẩu mới", "code"],
  ["Hoàn tất", "done"],
]

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const urlEmail = searchParams.get("email")?.trim() ?? ""
  const urlToken = searchParams.get("token")?.trim() ?? ""

  const [step, setStep] = useState<Step>(() => (urlToken ? "code" : "email"))
  const [email, setEmail] = useState(urlEmail)
  const [code, setCode] = useState(urlToken)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState("")
  const [info, setInfo] = useState(() =>
    urlToken
      ? "Đã nhận mã xác thực từ liên kết email. Vui lòng nhập mật khẩu mới bên dưới."
      : "",
  )

  const handleRequestEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setFlash("Email chưa đúng định dạng.")
      return
    }

    setFlash("")
    setInfo("")
    setSubmitting(true)
    try {
      const res = await requestPasswordResetEmail(email)
      setInfo(res.message)
      setStep("code")
    } catch (err) {
      setFlash(formatAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setFlash("Vui lòng kiểm tra lại địa chỉ email đã đăng ký.")
      return
    }
    if (code.trim().length < 6) {
      setFlash("Vui lòng nhập mã xác nhận bảo mật nhận được qua email.")
      return
    }
    if (password.length < 8) {
      setFlash("Mật khẩu mới cần ít nhất 8 ký tự.")
      return
    }
    if (password.length > 100) {
      setFlash("Mật khẩu mới không được vượt quá 100 ký tự.")
      return
    }
    if (password !== confirmPassword) {
      setFlash("Mật khẩu xác nhận không khớp với mật khẩu mới.")
      return
    }

    setFlash("")
    setSubmitting(true)
    try {
      await confirmPasswordReset({
        email,
        token: code,
        newPassword: password,
        confirmPassword,
      })
      setStep("done")
    } catch (err) {
      setFlash(formatAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (submitting) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setFlash("Vui lòng nhập đúng email đã đăng ký trước khi gửi lại mã.")
      return
    }
    setFlash("")
    setSubmitting(true)
    try {
      const res = await requestPasswordResetEmail(email)
      setInfo(`Đã gửi lại yêu cầu (giới hạn tối đa 1 lần/phút). ${res.message}`)
    } catch (err) {
      setFlash(formatAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const backToPrevious = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate("/")
  }

  return (
    <div className="page flex flex-col gap-8">
      <header className="border-b border-line-soft pb-5">
        <p className="text-sm font-medium text-brand-deep">Khôi phục tài khoản</p>
        <h1 className="display mt-1 text-[26px] leading-8 tracking-tight text-ink sm:text-[28px] sm:leading-9">
          Đặt lại mật khẩu
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-6 text-body">
          Nhận mã xác nhận qua email đã đăng ký, đặt mật khẩu mới rồi đăng nhập lại.
        </p>
      </header>

      <ol className="flex flex-wrap items-center gap-3">
        {STEPS.map(([label, id], i) => (
          <li key={id} className="flex items-center gap-3">
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                step === id || isDone(step, id) ? "bg-brand text-white" : "bg-surface-2 text-muted"
              }`}
            >
              {isDone(step, id) ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={`text-[13px] font-semibold ${step === id ? "text-ink" : "text-muted"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="text-line">—</span>}
          </li>
        ))}
      </ol>

      <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
        {step === "email" && (
          <form
            onSubmit={handleRequestEmail}
            noValidate
            className="flex flex-col gap-5 lg:col-span-7"
          >
            <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
              <span>Email đã đăng ký *</span>
              <input
                className={`input h-12 min-h-11 text-base sm:text-[15px] ${
                  flash ? "border-warn" : ""
                }`}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setFlash("")
                }}
                placeholder="ban@ecolink.vn"
                autoComplete="email"
              />
            </label>

            {flash && (
              <p
                role="alert"
                className="rounded-lg border border-warn/25 bg-warn/5 px-3.5 py-2.5 text-sm leading-6 font-medium text-warn"
              >
                {flash}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line-soft pt-5">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary h-12 min-h-11 rounded-lg px-6 text-sm font-semibold sm:text-[15px] disabled:opacity-60"
              >
                {submitting ? "Đang gửi..." : "Gửi mã xác thực"}
              </button>
              <button
                type="button"
                onClick={backToPrevious}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep transition-colors hover:text-brand hover:underline underline-offset-4"
              >
                <ArrowLeft className="size-4" />
                Quay lại trang trước
              </button>
            </div>
          </form>
        )}

        {step === "code" && (
          <form
            onSubmit={handleConfirmReset}
            noValidate
            className="flex flex-col gap-5 lg:col-span-7"
          >
            {info && (
              <p
                role="status"
                className="rounded-lg border border-brand/25 bg-brand/8 px-3.5 py-2.5 text-sm leading-6 text-ink"
              >
                {info}
              </p>
            )}

            <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
              <span>Email tài khoản *</span>
              <input
                className="input h-12 min-h-11 text-base sm:text-[15px]"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setFlash("")
                }}
                placeholder="ban@ecolink.vn"
                autoComplete="email"
              />
            </label>

            <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
              <span>Mã xác nhận bảo mật từ email *</span>
              <input
                className="input h-12 min-h-11 font-mono text-sm sm:text-[15px]"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.trim())
                  setFlash("")
                }}
                placeholder="Dán mã xác nhận trong email vào đây"
              />
            </label>

            <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
              <span>Mật khẩu mới *</span>
              <input
                className="input h-12 min-h-11 text-base sm:text-[15px]"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setFlash("")
                }}
                placeholder="Tối thiểu 8 ký tự"
                autoComplete="new-password"
              />
            </label>

            <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
              <span>Nhập lại mật khẩu mới *</span>
              <input
                className="input h-12 min-h-11 text-base sm:text-[15px]"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setFlash("")
                }}
                placeholder="Nhập lại đúng mật khẩu mới"
                autoComplete="new-password"
              />
            </label>

            {flash && (
              <p
                role="alert"
                className="rounded-lg border border-warn/25 bg-warn/5 px-3.5 py-2.5 text-sm leading-6 font-medium text-warn"
              >
                {flash}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line-soft pt-5">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary h-12 min-h-11 rounded-lg px-6 text-sm font-semibold sm:text-[15px] disabled:opacity-60"
              >
                {submitting ? "Đang cập nhật..." : "Đặt mật khẩu mới"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleResend}
                className="text-sm font-semibold text-brand-deep transition-colors hover:text-brand hover:underline underline-offset-4 disabled:opacity-60"
              >
                Gửi lại mã
              </button>
              <button
                type="button"
                onClick={backToPrevious}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-brand-deep hover:underline underline-offset-4"
              >
                <ArrowLeft className="size-4" />
                Quay lại trang trước
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="flex flex-col gap-4 lg:col-span-7">
            <span className="grid size-12 place-items-center rounded-full bg-brand text-white">
              <Check className="size-6" strokeWidth={2.2} />
            </span>
            <h2 className="text-lg leading-7 font-bold text-ink">Đã đặt lại mật khẩu</h2>
            <p className="text-[15px] leading-6 text-body">
              Toàn bộ phiên đăng nhập cũ trên các thiết bị khác đã được tự động thu hồi để bảo vệ
              tài khoản. Vui lòng đăng nhập lại bằng mật khẩu mới.
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <button
                type="button"
                onClick={() => openAuthPopup("login")}
                className="btn-primary h-12 min-h-11 rounded-lg px-6 text-sm font-semibold sm:text-[15px]"
              >
                Đi tới đăng nhập
              </button>
              <button
                type="button"
                onClick={backToPrevious}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep transition-colors hover:text-brand hover:underline underline-offset-4"
              >
                <ArrowLeft className="size-4" />
                Quay lại trang trước
              </button>
            </div>
          </div>
        )}

        <aside className="flex flex-col gap-8 lg:col-span-5">
          <section className="flex gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand-deep">
              <Mail className="size-4.5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Mã có hiệu lực 15 phút</h2>
              <p className="mt-1 text-sm leading-6 text-body">
                Mã xác nhận chỉ sử dụng một lần. Nếu không thấy trong hộp thư đến, hãy kiểm tra
                thư mục Quảng cáo hoặc Thư rác.
              </p>
            </div>
          </section>

          <section className="flex gap-3 border-t border-line-soft pt-6">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand-deep">
              <ShieldCheck className="size-4.5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Các thiết bị khác sẽ đăng xuất</h2>
              <p className="mt-1 text-sm leading-6 text-body">
                Khi mật khẩu được đặt lại, mọi phiên đăng nhập đang mở ở thiết bị khác sẽ bị
                thu hồi ngay lập tức.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

/** một bước đã đi qua = có id nằm sau `step` trong thứ tự email → code → done */
function isDone(step: Step, id: Step): boolean {
  const order: Step[] = ["email", "code", "done"]
  return order.indexOf(step) > order.indexOf(id)
}
