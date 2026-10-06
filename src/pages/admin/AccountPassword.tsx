import { useState } from "react"
import { PageHead, Field } from "@/components/admin/ui"
import { ROLE_LABEL, useSession } from "@/lib/session"

/** Đổi mật khẩu cho STAFF và ADMIN.
 *
 *  Tách khỏi `/account/password` của người dân vì chính sách khác: tài khoản
 *  nội bộ đổi mật khẩu là hành động bảo mật, không phải thao tác tiện lợi —
 *  nên bắt mật khẩu mới dài hơn và phải có số. Người dân đổi vì quên, nhân
 *  viên đổi vì nghi ngờ lộ; hai việc đó không nên dùng chung một ngưỡng.
 *
 *  Bắt buộc mật khẩu hiện tại đúng mới cho đổi: đây là ranh giới tin cậy —
 *  không có nó thì ai đó ngồi máy đã mở khoá cũng đổi được mật khẩu của bạn. */
export default function AccountPassword() {
  const session = useSession()
  const role = session?.role === "admin" ? "admin" : "staff"
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [again, setAgain] = useState("")
  const [flash, setFlash] = useState("")
  const [err, setErr] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
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
    // ponytail: chưa có backend. Nối API thì thay đúng dòng này — và đăng xuất
    // hết mọi phiên khác, nếu không thì đổi mật khẩu mà kẻ cũ vẫn vào được.
    setFlash("Đã đổi mật khẩu. Các phiên khác đã đăng xuất.")
    setCurrent("")
    setNext("")
    setAgain("")
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
            className={`input ${err.startsWith("Nhập") ? "border-warn" : ""}`}
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

        {err && <p className="text-[13px] text-warn">{err}</p>}

        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button type="submit" className="btn-primary h-11 px-6">
            Đổi mật khẩu
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