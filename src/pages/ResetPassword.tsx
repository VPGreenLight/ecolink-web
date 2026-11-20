import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { PageHead } from "@/components/Portal"
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
 *   1. Bấm trực tiếp nút "Đặt Lại Mật Khẩu" trong email Gmail (`?token=...&email=...`).
 *   2. Nhập email ở Bước 1 rồi dán mã xác nhận bảo mật từ email vào Bước 2. */
type Step = "email" | "code" | "done"

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
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
    if (submitting || !email.trim()) return
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

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="KHÔI PHỤC TÀI KHOẢN"
        title="Đặt lại mật khẩu"
        body="Nhận liên kết và mã xác nhận bảo mật qua email đã đăng ký, đặt mật khẩu mới rồi đăng nhập lại. Người dân và cơ sở thu mua dùng chung quy trình này."
      />

      <ol className="flex flex-wrap items-center gap-3">
        {[
          ["Nhập email", "email"],
          ["Nhập mã và mật khẩu mới", "code"],
          ["Hoàn tất", "done"],
        ].map(([label, id], i) => (
          <li key={id} className="flex items-center gap-3">
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                step === id || done(step, id)
                  ? "bg-brand text-white"
                  : "bg-surface-2 text-muted"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`text-[13px] font-semibold ${
                step === id ? "text-ink" : "text-muted"
              }`}
            >
              {label}
            </span>
            {i < 2 && <span className="text-line">—</span>}
          </li>
        ))}
      </ol>

      {step === "email" && (
        <form
          onSubmit={handleRequestEmail}
          noValidate
          className="card flex max-w-[520px] flex-col gap-5 p-5 md:p-6"
        >
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Email đã đăng ký
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@ecolink.vn"
              autoComplete="email"
            />
          </label>
          {flash && (
            <p role="alert" className="text-[13px] text-warn">
              {flash}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary h-11 px-6 disabled:opacity-60"
            >
              {submitting ? "Đang gửi..." : "Gửi mã xác thực"}
            </button>
            <Link to="/login" className="btn-ghost h-11 px-5">
              Quay lại đăng nhập
            </Link>
          </div>
          <p className="text-[13px] leading-5 text-muted">
            Mã xác nhận có hiệu lực 15 phút và chỉ sử dụng một lần duy nhất (BR-AUTH-06). Nếu
            không thấy trong hộp thư đến, vui lòng kiểm tra thư mục Quảng cáo hoặc Thư rác.
          </p>
        </form>
      )}

      {step === "code" && (
        <form
          onSubmit={handleConfirmReset}
          noValidate
          className="card flex max-w-[520px] flex-col gap-5 p-5 md:p-6"
        >
          {info && (
            <p
              role="status"
              className="rounded-xl border border-brand/25 bg-brand/6 px-3.5 py-2.5 text-xs leading-5 text-ink"
            >
              {info}
            </p>
          )}

          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Email tài khoản
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@ecolink.vn"
              autoComplete="email"
            />
          </label>

          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Mã xác nhận bảo mật (Token từ Email)
            <input
              className="input font-mono text-xs"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              placeholder="Dán mã xác nhận trong email vào đây"
            />
          </label>

          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Mật khẩu mới
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              autoComplete="new-password"
            />
          </label>

          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Nhập lại mật khẩu mới
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại đúng mật khẩu mới"
              autoComplete="new-password"
            />
          </label>

          {flash && (
            <p role="alert" className="text-[13px] text-warn">
              {flash}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary h-11 px-6 disabled:opacity-60"
            >
              {submitting ? "Đang cập nhật..." : "Đặt mật khẩu mới"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleResend}
              className="btn-ghost h-11 px-5 disabled:opacity-60"
            >
              Gửi lại mã
            </button>
          </div>
        </form>
      )}

      {step === "done" && (
        <div className="card flex max-w-[520px] flex-col gap-4 p-5 md:p-6">
          <span className="grid size-12 place-items-center rounded-full bg-brand text-white">
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m5 13 4 4L19 7" />
            </svg>
          </span>
          <h2 className="text-lg leading-7 font-bold text-ink">
            Đã đặt lại mật khẩu
          </h2>
          <p className="text-sm leading-6 text-body">
            Toàn bộ phiên đăng nhập cũ trên các thiết bị khác đã được tự động thu hồi để bảo vệ
            tài khoản. Vui lòng đăng nhập lại bằng mật khẩu mới.
          </p>
          <Link to="/login" className="btn-primary h-11 w-fit px-6">
            Đi tới đăng nhập
          </Link>
        </div>
      )}
    </div>
  )
}

/** một bước đã đi qua = có id nằm sau `step` trong thứ tự email → code → done */
function done(step: Step, id: string): boolean {
  const order: Step[] = ["email", "code", "done"]
  return order.indexOf(step) > order.indexOf(id as Step)
}
