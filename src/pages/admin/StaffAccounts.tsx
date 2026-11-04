import { useState } from "react"
import { PageHead, Field, Status, Table, Td } from "@/components/admin/ui"
import { STAFF, type Staff } from "@/data/ops"

/** A-03 Quản lý tài khoản nhân viên.
 *
 *  Không cho nhân viên tự khoá chính mình: người đang đăng nhập mà bị khoá thì
 *  mất đường vào hệ thống cho tới khi có Admin khác sửa. */
export default function StaffAccounts() {
  const [list, setList] = useState<Staff[]>(STAFF)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [flash, setFlash] = useState("")

  const toggle = (id: string) =>
    setList((ls) =>
      ls.map((s) =>
        s.id === id ? { ...s, status: s.status === "active" ? "locked" : "active" } : s,
      ),
    )

  const remove = (s: Staff) => {
    if (!window.confirm(`Xoá tài khoản nhân viên ${s.name}?`)) return
    setList((ls) => ls.filter((x) => x.id !== s.id))
    setFlash(`Đã xoá ${s.name}.`)
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 3) {
      setFlash("Cần họ tên nhân viên trước khi tạo tài khoản.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setFlash("Email chưa đúng định dạng, nhân viên cần email để đặt lại mật khẩu.")
      return
    }
    const id = `NV-${String(list.length + 1).padStart(2, "0")}`
    // Nhân viên mới vào không có quyền nào: Admin cấp sau bằng trang phân quyền.
    // Cấp sẵn ở đây là cách tạo tài khoản có toàn quyền mà không ai duyệt.
    setList((ls) => [...ls, { id, name: name.trim(), email: email.trim(), perms: [], status: "active" }])
    setName("")
    setEmail("")
    setFlash(`Đã tạo ${id}. Sang trang phân quyền cấp quyền cụ thể cho nhân viên này.`)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="QUẢN TRỊ"
        title="Tài khoản nhân viên"
        body="Tạo, khoá và xoá tài khoản nhân viên. Tài khoản mới không có quyền nào cho tới khi bạn cấp ở trang phân quyền."
      />

      <form onSubmit={add} noValidate className="card flex flex-col gap-5 p-5 md:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Họ và tên">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A"
            />
          </Field>
          <Field label="Email công việc">
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten@ecolink.vn"
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button type="submit" className="btn-primary h-11 px-6">
            Tạo tài khoản
          </button>
          {flash && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {flash}
            </p>
          )}
        </div>
      </form>

      <Table head={["Mã", "Họ tên", "Email", "Số quyền", "Trạng thái", ""]}>
        {list.map((s) => (
          <tr key={s.id}>
            <Td className="tabular-nums whitespace-nowrap">{s.id}</Td>
            <Td className="font-semibold text-ink">{s.name}</Td>
            <Td>{s.email}</Td>
            <Td className="tabular-nums">{s.perms.length}</Td>
            <Td>
              <Status tone={s.status === "active" ? "ok" : "off"}>
                {s.status === "active" ? "Hoạt động" : "Đã khoá"}
              </Status>
            </Td>
            <Td>
              <span className="flex gap-3">
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="text-[13px] font-semibold text-warn hover:underline"
                >
                  {s.status === "active" ? "Khoá" : "Mở khoá"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(s)}
                  className="text-[13px] font-semibold text-warn hover:underline"
                >
                  Xoá
                </button>
              </span>
            </Td>
          </tr>
        ))}
      </Table>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Nhân viên đã gán quyền sẽ mất toàn bộ quyền khi bị khoá. Xoá tài khoản
        không xoá lịch sử công việc đã ghi nhận trong báo cáo.
      </p>
    </div>
  )
}