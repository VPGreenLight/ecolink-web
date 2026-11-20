import { useState } from "react"
import { PageHead, Field } from "@/components/admin/ui"
import { ROLE_LABEL, useSession } from "@/lib/session"
import { changeCurrentUserPassword, formatAuthError } from "@/lib/authApi"

/** Đổi mật khẩu cho STAFF và ADMIN — nối trực tiếp tới `POST /api/v1/auth/change-password`.
 *
 *  Giữ nguyên ngưỡng bảo mật cao hơn của tài khoản nội bộ (tối thiểu 12 ký tự + có chữ số),
 *  đồng thời xác minh mật khẩu hiện tại bằng BCrypt và thu hồi mọi phiên trên thiết bị khác. */
export default function AccountPassword() {
  const session = useSession()
  const role = session?.role === "admin" ? "admin" : "staff"
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
    if (next.length < 12) {
      setErr("Mật khẩu mới cần ít nhất 12 ký tự.")
      return
    }
    if (!/\d/.test(next)) {
      setErr("Mật khẩu mới phải có ít nhất một chữ số.")
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
    <>
      <PageHead
        eyebrow="BẢO MẬT"
        title="Đổi mật khẩu"
        body={`Mật khẩu tài khoản ${ROLE_LABEL[role].toLowerCase()} dài hơn yêu cầu của tài khoản người dân: tối thiểu 12 ký tự và phải có chữ số. Đổi xong mọi thiết bị khác đang đăng nhập sẽ mất phiên ngay.`}
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

        <Field label="Mật khẩu mới" hint="Tối thiểu 12 ký tự, phải có chữ số.">
          <input
            className={`input ${
              err.startsWith("Mật khẩu mới cần") || err.startsWith("Mật khẩu mới phải có")
                ? "border-warn"
                : ""
            }`}
            type="password"
            value={next}
            onChange={(e) => {
              setNext(e.target.value)
              setFlash("")
            }}
            autoComplete="new-password"
          />
        </Field>

        <Field label="Nhập lại mật khẩu mới">
          <input
            className={`input ${err.startsWith("Hai mật khẩu") ? "border-warn" : ""}`}
            type="password"
            value={again}
            onChange={(e) => {
              setAgain(e.target.value)
              setFlash("")
            }}
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
    </>
  )
}
