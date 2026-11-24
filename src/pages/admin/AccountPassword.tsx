import { useState } from "react"
import { FormRequiredLegend, PageHead, Field } from "@/components/admin/ui"
import { ROLE_LABEL, useSession } from "@/lib/session"
import { changeCurrentUserPassword, formatAuthError } from "@/lib/authApi"

/** Đổi mật khẩu cho STAFF và ADMIN — nối trực tiếp tới `POST /api/v1/auth/change-password`.
 *
 *  Thống nhất quy chuẩn tối thiểu 8 ký tự trên toàn hệ thống, đồng thời xác minh
 *  mật khẩu hiện tại bằng BCrypt và thu hồi mọi phiên trên thiết bị khác. */
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

  return (
    <>
      <PageHead
        eyebrow="BẢO MẬT"
        title="Đổi mật khẩu"
        body={`Cập nhật mật khẩu tài khoản ${ROLE_LABEL[role].toLowerCase()} (tối thiểu 8 ký tự). Đổi xong mọi thiết bị khác đang đăng nhập sẽ mất phiên ngay.`}
      />

      <form
        onSubmit={submit}
        noValidate
        className="card flex max-w-[520px] flex-col gap-5 p-5 md:p-6"
      >
        <FormRequiredLegend />
        <Field label="Mật khẩu hiện tại" required>
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

        <Field label="Mật khẩu mới" required hint="Tối thiểu 8 ký tự, khác mật khẩu hiện tại.">
          <input
            className={`input ${
              err.startsWith("Mật khẩu mới cần") || err.startsWith("Mật khẩu mới không")
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

        <Field label="Nhập lại mật khẩu mới" required>
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
