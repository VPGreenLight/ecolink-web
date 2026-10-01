import { useState } from "react"
import { PageHead, Status, Table, Td } from "@/components/admin/ui"
import { PERMS, STAFF, type Staff } from "@/data/ops"

/** A-04 Phân quyền nhân viên.
 *
 *  Nhân viên ở đây là danh sách 3 người, quyền 7 mã — checkbox gốc của trình
 *  duyệt là đủ, không cần bảng quyền riêng hay hệ thống vai trò riêng. Vài
 *  trăm nhân viên thì mới cần bảng quyền chi tiết.
 *
 *  Ô "toàn quyền" ghi rõ trạng thái chứ không dùng màu: nhân viên không có
 *  bất kỳ quyền nào trông giống nhân viên có toàn quyền khi quyền chưa tải. */
export default function Permissions() {
  const [list, setList] = useState<Staff[]>(STAFF)
  const [flash, setFlash] = useState("")

  const flip = (id: string, perm: string) =>
    setList((ls) =>
      ls.map((s) =>
        s.id === id
          ? {
              ...s,
              perms: s.perms.includes(perm)
                ? s.perms.filter((p) => p !== perm)
                : [...s.perms, perm],
            }
          : s,
      ),
    )

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="QUẢN TRỊ"
        title="Phân quyền nhân viên"
        body="Mỗi quyền tương ứng một nhóm màn hình vận hành. Nhân viên không có quyền nào sẽ đăng nhập được nhưng không thấy việc nào để xử lý."
      />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              <th
                scope="col"
                className="px-4 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase"
              >
                Nhân viên
              </th>
              {PERMS.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  className="px-3 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase"
                >
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {list.map((s) => (
              <tr key={s.id}>
                <Td className="font-semibold text-ink whitespace-nowrap">
                  {s.name}
                  <span className="block text-[12px] font-normal text-muted">{s.id}</span>
                </Td>
                {PERMS.map((p) => (
                  <td key={p.id} className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand"
                      checked={s.perms.includes(p.id)}
                      onChange={() => flip(s.id, p.id)}
                      aria-label={`${p.label} cho ${s.name}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => {
            setList((ls) =>
              ls.map((s) => ({ ...s, perms: PERMS.map((p) => p.id) })),
            )
            setFlash("Đã cấp toàn bộ quyền cho tất cả nhân viên trong danh sách.")
          }}
          className="btn-ghost h-11 px-5"
        >
          Cấp toàn quyền cho tất cả
        </button>
        <button
          type="button"
          onClick={() => {
            setList((ls) => ls.map((s) => ({ ...s, perms: [] })))
            setFlash("Đã thu hồi toàn bộ quyền. Chỉ dùng khi cần reset sạch.")
          }}
          className="btn-ghost h-11 px-5 text-warn"
        >
          Thu hồi toàn bộ quyền
        </button>
        {flash && (
          <p role="status" className="text-[13px] font-semibold text-brand">
            {flash}
          </p>
        )}
      </div>

      <section>
        <h2 className="text-base font-bold text-ink">Trạng thái hiện tại</h2>
        <div className="mt-3">
          <Table head={["Nhân viên", "Tài khoản", "Số quyền", "Tóm tắt"]}>
            {list.map((s) => (
              <tr key={s.id}>
                <Td className="font-semibold text-ink">{s.name}</Td>
                <Td>
                  <Status tone={s.status === "active" ? "ok" : "off"}>
                    {s.status === "active" ? "Hoạt động" : "Đã khoá"}
                  </Status>
                </Td>
                <Td className="tabular-nums">
                  {s.perms.length} / {PERMS.length}
                </Td>
                <Td>
                  {s.perms.length === 0
                    ? "Chưa có quyền nào"
                    : s.perms.length === PERMS.length
                      ? "Toàn quyền"
                      : PERMS.filter((p) => s.perms.includes(p.id))
                          .map((p) => p.label)
                          .join(", ")}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </section>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Quyền ở đây chỉ ẩn hiện màn hình. Backend vẫn phải tự kiểm tra quyền theo
        từng API — nếu không, người dùng gọi thẳng URL là vẫn làm được việc bị
        cấm.
      </p>
    </div>
  )
}