import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Check, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { changeCurrentUserPassword, formatAuthError } from "@/lib/authApi"

/** Ô nhập mật khẩu có nút hiện/ẩn.
 *
 *  Không bọc `<label>` vì nút hiện/ẩn nằm bên trong ô nhập — `<label>` bao
 *  cả nút sẽ khiến click vào nút cũng kích hoạt ô nhập.  Dùng `htmlFor` +
 *  `id` riêng cho từng ô, và `aria-invalid`/`aria-describedby` để báo lỗi
 *  bằng trình đọc màn hình. */
function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  invalid,
  hint,
  autoComplete,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  visible: boolean
  onToggleVisible: () => void
  invalid?: boolean
  hint?: string
  autoComplete: string
  placeholder: string
}) {
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
        <span className="ml-1 font-bold text-red-600" aria-hidden="true">
          *
        </span>
      </label>
      <div className="relative">
        <input
          id={id}
          className={`input h-12 min-h-11 pr-12 text-base sm:text-[15px] ${
            invalid ? "border-warn" : ""
          }`}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={hintId}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1 my-auto flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {hint && (
        <span id={hintId} className="text-[12px] leading-5 text-muted">
          {hint}
        </span>
      )}
    </div>
  )
}

/** SU-02 Đổi mật khẩu — nối trực tiếp tới `POST /api/v1/auth/change-password`.
 *
 *  Xác minh mật khẩu hiện tại qua BCrypt trên PostgreSQL, cập nhật mật khẩu mới
 *  và tự động thu hồi mọi Refresh Token đang hoạt động trên thiết bị khác. */
export default function Password() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [again, setAgain] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showAgain, setShowAgain] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState("")
  const [err, setErr] = useState("")

  const checks = useMemo(
    () => [
      { label: "Ít nhất 8 ký tự", ok: next.length >= 8 && next.length <= 100 },
      { label: "Có cả chữ cái và chữ số", ok: /[a-zA-Z]/.test(next) && /\d/.test(next) },
      { label: "Khác mật khẩu hiện tại", ok: next.length > 0 && next !== current },
      { label: "Khớp với ô xác nhận", ok: again.length > 0 && next === again },
    ],
    [current, next, again],
  )

  const strength = useMemo(() => {
    if (!next) return { score: 0, label: "Chưa nhập", text: "text-muted", bar: "" }
    let score = 0
    if (next.length >= 8) score += 1
    if (/[a-z]/.test(next) && /[A-Z]/.test(next)) score += 1
    if (/\d/.test(next)) score += 1
    if (/[^a-zA-Z0-9]/.test(next) || next.length >= 12) score += 1
    if (score <= 1) {
      return { score: 1, label: "Yếu", text: "text-warn", bar: "bg-warn" }
    }
    if (score === 2) {
      return { score: 2, label: "Trung bình", text: "text-amber-700", bar: "bg-amber-500" }
    }
    if (score === 3) {
      return { score: 3, label: "Khá mạnh", text: "text-lime-700", bar: "bg-lime-500" }
    }
    return { score: 4, label: "Mạnh", text: "text-brand-deep", bar: "bg-brand" }
  }, [next])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (current.length < 1) {
      setErr("Nhập mật khẩu hiện tại.")
      return
    }
    if (next.length < 8) {
      setErr("Mật khẩu mới cần ít nhất 8 ký tự.")
      return
    }
    if (next.length > 100) {
      setErr("Mật khẩu mới không được vượt quá 100 ký tự.")
      return
    }
    if (next !== again) {
      setErr("Hai mật khẩu mới không khớp nhau.")
      return
    }
    if (next === current) {
      setErr("Mật khẩu mới phải khác mật khẩu hiện tại.")
      return
    }

    setErr("")
    setFlash("")
    setSubmitting(true)
    try {
      const res = await changeCurrentUserPassword({
        currentPassword: current,
        newPassword: next,
        confirmPassword: again,
      })
      setFlash(res.message)
      setCurrent("")
      setNext("")
      setAgain("")
    } catch (error) {
      setErr(formatAuthError(error))
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setFlash("")
    if (err) setErr("")
  }

  return (
    <div className="page flex flex-col gap-8">
      <header className="border-b border-line-soft pb-5">
        <p className="text-sm font-medium text-brand-deep">Bảo mật tài khoản</p>
        <h1 className="display mt-1 text-[26px] leading-8 tracking-tight text-ink sm:text-[28px] sm:leading-9">
          Đổi mật khẩu
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-6 text-body">
          Mật khẩu này dùng để đăng nhập và bảo vệ Điểm Xanh cùng lịch sử bàn giao của bạn.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
        <form onSubmit={submit} noValidate className="flex flex-col gap-6 lg:col-span-7">
          <PasswordField
            id="current-password"
            label="Mật khẩu hiện tại"
            value={current}
            onChange={(v) => {
              setCurrent(v)
              reset()
            }}
            visible={showCurrent}
            onToggleVisible={() => setShowCurrent((v) => !v)}
            invalid={err.includes("hiện tại")}
            autoComplete="current-password"
            placeholder="Nhập mật khẩu đang dùng"
          />

          <PasswordField
            id="new-password"
            label="Mật khẩu mới"
            value={next}
            onChange={(v) => {
              setNext(v)
              reset()
            }}
            visible={showNext}
            onToggleVisible={() => setShowNext((v) => !v)}
            invalid={err.includes("ký tự")}
            hint="Tối thiểu 8 ký tự, có cả chữ cái và chữ số."
            autoComplete="new-password"
            placeholder="Nhập mật khẩu mới"
          />

          <PasswordField
            id="confirm-password"
            label="Nhập lại mật khẩu mới"
            value={again}
            onChange={(v) => {
              setAgain(v)
              reset()
            }}
            visible={showAgain}
            onToggleVisible={() => setShowAgain((v) => !v)}
            invalid={err.includes("khớp")}
            autoComplete="new-password"
            placeholder="Nhập lại đúng mật khẩu mới"
          />

          {err && (
            <p
              role="alert"
              className="rounded-lg border border-warn/25 bg-warn/5 px-3.5 py-2.5 text-sm leading-6 font-medium text-warn"
            >
              {err}
            </p>
          )}

          {flash && (
            <p
              role="status"
              className="rounded-lg border border-brand/25 bg-brand/8 px-3.5 py-2.5 text-sm leading-6 font-semibold text-brand-deep"
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
              {submitting ? "Đang cập nhật..." : "Lưu mật khẩu mới"}
            </button>
            <Link
              to="/reset-password"
              className="text-sm font-medium text-muted transition-colors hover:text-brand-deep hover:underline underline-offset-4"
            >
              Quên mật khẩu hiện tại?
            </Link>
          </div>
        </form>

        <aside className="flex flex-col gap-8 lg:col-span-5">
          <section>
            <h2 className="text-[15px] font-semibold text-ink">Độ mạnh mật khẩu</h2>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden="true">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 rounded-full transition-colors ${
                      strength.score >= step ? strength.bar : "bg-surface-3"
                    }`}
                  />
                ))}
              </div>
              <span className={`text-[13px] font-semibold tabular-nums ${strength.text}`}>
                {strength.label}
              </span>
            </div>

            <ul className="mt-5 flex flex-col gap-3">
              {checks.map((item) => (
                <li key={item.label} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full border transition-colors ${
                      item.ok
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-surface-2 text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    <Check className="size-3" />
                  </span>
                  <span className={item.ok ? "font-medium text-ink" : "text-muted"}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex gap-3 border-t border-line-soft pt-6">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand-deep">
              <ShieldCheck className="size-4.5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Các thiết bị khác sẽ đăng xuất</h2>
              <p className="mt-1 text-sm leading-6 text-body">
                Ngay khi đổi mật khẩu, mọi phiên đăng nhập đang mở ở trình duyệt hoặc điện thoại
                khác sẽ bị thu hồi.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
