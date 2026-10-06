import { useState } from "react"
import { Link } from "react-router-dom"
import { PageHead, Field, Status } from "@/components/admin/ui"
import { ROLE_LABEL, useSession } from "@/lib/session"
import { AI_CASES, APPLICATIONS, COMPLAINTS, PERMS, POSTS, STAFF } from "@/data/ops"

/** Hồ sơ và thông báo cho STAFF và ADMIN.
 *
 *  TÁCH khỏi `/account/profile` của người dân, dù đều gọi là "hồ sơ": hai bên
 *  không có gì giống nhau. Người dân có điểm cây ảo, xếp hạng, lịch thu gom —
 *  nhân viên không có. Nhân viên có mã nhân viên, bộ phận, quyền được cấp —
 *  người dân không có. Để chung một trang thì phải nhồi hai bảng chồng lên nhau
 *  và 3/4 nội dung là thừa với một trong hai bên.
 *
 *  Thông báo cũng khác: của người dân là "cô Ba đã nhận yêu cầu của bạn", của
 *  nhân viên là việc đang chờ trong hàng đợi vận hành. Số đếm thẳng từ bảng
 *  dữ liệu nên không bao giờ lệch với trang đếm chi tiết bên cạnh. */
export default function AccountProfile() {
  const session = useSession()
  const role = session?.role === "admin" ? "admin" : "staff"
  const me = STAFF.find((s) => s.name === session?.name)

  const [name, setName] = useState(session?.name ?? "")
  const [phone, setPhone] = useState("0901 234 567")
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    // Kiểm tra ở ranh giới tin cậy: dữ liệu sau này về từ API, không tin ô
    // nhập là hợp lệ.
    if (name.trim().length < 2) {
      setErr("Tên hiển thị phải có ít nhất 2 ký tự.")
      setSaved(false)
      return
    }
    if (!/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, ""))) {
      setErr("Số điện thoại chưa đúng định dạng Việt Nam.")
      setSaved(false)
      return
    }
    setErr("")
    // ponytail: chưa có backend. Nối API thì thay đúng dòng này.
    setSaved(true)
  }

  return (
    <>
      <PageHead
        eyebrow="TÀI KHOẢN NỘI BỘ"
        title={role === "admin" ? "Hồ sơ quản trị" : "Hồ sơ nhân viên"}
        body={`Tài khoản ${ROLE_LABEL[role].toLowerCase()} đang đăng nhập và những việc đang chờ trong console. Mã nhân viên và quyền do quản trị viên cấp, không sửa được ở đây.`}
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <form
          onSubmit={submit}
          noValidate
          className="card flex flex-col gap-5 self-start p-5 md:p-6"
        >
          <Field label="Tên hiển thị" hint="Tên này hiện cạnh quyền trong log vận hành.">
            <input
              className={`input ${err && name.trim().length < 2 ? "border-warn" : ""}`}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSaved(false)
              }}
            />
          </Field>

          <Field label="Số điện thoại nội bộ" hint="Để người trực ban gọi khi có việc gấp ngoài giờ.">
            <input
              className={`input tabular-nums ${
                err && !/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, ""))
                  ? "border-warn"
                  : ""
              }`}
              inputMode="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setSaved(false)
              }}
            />
          </Field>

          <Field label="Email công việc">
            <input className="input" value={me?.email ?? "quantri@ecolink.vn"} readOnly disabled />
            <span className="text-[12px] text-muted">
              Email là định danh đăng nhập, đổi ở phòng IT chứ không sửa trên web.
            </span>
          </Field>

          {err && <p className="text-[13px] text-warn">{err}</p>}

          <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
            <button type="submit" className="btn-primary h-11 px-6">
              Lưu hồ sơ
            </button>
            {saved && (
              <p role="status" className="text-[13px] font-semibold text-brand">
                Đã lưu hồ sơ.
              </p>
            )}
          </div>
        </form>

        <div className="flex flex-col gap-6">
          <section className="card p-5">
            <h2 className="text-[15px] font-bold text-ink">Thông tin được cấp</h2>
            <dl className="mt-3 flex flex-col gap-2 text-[13px]">
              {[
                ["Mã nhân viên", me?.id ?? "QT-01"],
                ["Vai trò", ROLE_LABEL[role]],
                ["Bộ phận", me ? "Vận hành nền tảng" : "Ban quản trị"],
                ["Ngày bắt đầu", "12/03/2025"],
                ["Trạng thái", me?.status === "locked" ? "Đang khoá" : "Đang hoạt động"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line-soft pb-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-5 text-[11px] font-bold tracking-[0.1em] text-muted uppercase">
              Quyền được cấp
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {role === "admin" ? (
                <Status tone="ok">Toàn quyền hệ thống</Status>
              ) : (
                (me?.perms ?? []).map((id) => (
                  <Status key={id} tone="wait">
                    {PERMS.find((p) => p.id === id)?.label ?? id}
                  </Status>
                ))
              )}
            </div>
            <p className="mt-3 text-[12px] leading-5 text-muted">
              Quyền do quản trị viên cấp. Cần thêm quyền thì gửi yêu cầu, không tự
              chỉnh ở đây.
            </p>
          </section>

          <Queue role={role} />
        </div>
      </div>
    </>
  )
}

/** Việc đang chờ, đếm thẳng từ bảng dữ liệu vận hành.
 *
 *  Liệt kê RIÊNG theo vai trò, không dùng `/${role}/...` chung: staff và admin
 *  không có cùng bộ màn hình. Admin không có `/admin/applications` và
 *  `/admin/complaints` — dựng link bằng cách ghép chuỗi sẽ dẫn tới trang 404. */
function Queue({ role }: { role: "staff" | "admin" }) {
  const rows: { to: string; label: string; count: number }[] =
    role === "staff"
      ? [
          {
            to: "/staff/ai-review",
            label: "Ảnh AI chờ gán nhãn",
            count: AI_CASES.filter((c) => !c.inDataset).length,
          },
          {
            to: "/staff/applications",
            label: "Hồ sơ đối tác chờ thẩm định",
            count: APPLICATIONS.filter((a) => a.status === "pending").length,
          },
          {
            to: "/staff/complaints",
            label: "Khiếu nại mới",
            count: COMPLAINTS.filter((c) => c.status === "new").length,
          },
          {
            to: "/staff/blog",
            label: "Bài Blog chờ duyệt",
            count: POSTS.filter((p) => p.status === "pending").length,
          },
        ]
      : [
          {
            to: "/admin/blog",
            label: "Bài Blog chờ duyệt",
            count: POSTS.filter((p) => p.status === "pending").length,
          },
          {
            to: "/admin/staff",
            label: "Nhân viên đang bị khoá",
            count: STAFF.filter((s) => s.status === "locked").length,
          },
        ]

  const open = rows.reduce((n, r) => n + r.count, 0)

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-ink">Việc đang chờ</h2>
        <span className="text-[13px] text-muted">
          {open === 0 ? "Không có việc nào" : `${open} việc`}
        </span>
      </div>

      <ul className="mt-3 flex flex-col">
        {rows.map((r) => (
          <li key={r.to} className="border-b border-line-soft last:border-0">
            <Link
              to={r.to}
              className="flex items-center justify-between gap-3 py-2.5 text-[13px] text-body transition-colors hover:text-brand-deep"
            >
              {r.label}
              {r.count === 0 ? (
                <Status tone="off">Xong</Status>
              ) : (
                <Status tone="todo">{r.count} chờ</Status>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}