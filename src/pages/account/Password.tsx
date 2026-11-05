import { useState } from "react"
import { PageHead, Field } from "@/components/Portal"
import { changeCurrentUserPassword, formatAuthError } from "@/lib/authApi"

/** SU-02 Đổi mật khẩu — nối trực tiếp tới `POST /api/v1/auth/change-password`.
 *
 *  Xác minh mật khẩu hiện tại qua BCrypt trên PostgreSQL, cập nhật mật khẩu mới
 *  và tự động thu hồi mọi Refresh Token đang hoạt động trên thiết bị khác. */
export default function Password() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [again, setAgain] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState("")
  const [err, setErr] = useState("")

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

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="BẢO MẬT"
        title="Đổi mật khẩu"
        body="Đổi mật khẩu sẽ đăng xuất mọi thiết bị khác đang đăng nhập tài khoản này."
      />

      <form
        onSubmit={submit}
        noValidate
        className="card flex max-w-[520px] flex-col gap-5 p-5 md:p-6"
      >
        <Field label="Mật khẩu hiện tại">
          <input
            className={`input ${err.startsWith("Nhập") || err.includes("hiện tại") ? "border-warn" : ""}`}
            type="password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value)
              setFlash("")
            }}
            autoComplete="current-password"
          />
        </Field>

        <Field label="Mật khẩu mới" hint="Tối thiểu 8 ký tự, nên có cả chữ và số.">
          <input
            className="input"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        <Field label="Nhập lại mật khẩu mới">
          <input
            className="input"
            type="password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        {err && (
          <p role="alert" className="text-[13px] text-warn">
            {err}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary h-11 px-6 disabled:opacity-60"
          >
            {submitting ? "Đang cập nhật..." : "Đổi mật khẩu"}
          </button>
          {flash && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {flash}
            </p>
          )}
        </div>
      </form>
    </div>
  )
}
