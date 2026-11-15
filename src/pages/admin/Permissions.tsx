import { useEffect, useState } from "react"
import { PageHead, Status, Table, Td } from "@/components/admin/ui"
import { PERMS, STAFF, type Staff } from "@/data/ops"
import {
  getAdminStaffList,
  toCanonicalPerm,
  toUiPerm,
  updateStaffPermissions,
  type StaffMemberDto,
} from "@/lib/governanceApi"

type StaffPermRow = Staff & {
  backendUserId?: string
  dirty?: boolean
}

function mapStaffToPermRow(dto: StaffMemberDto): StaffPermRow {
  return {
    id: dto.employeeCode || dto.userId.slice(0, 8),
    backendUserId: dto.userId,
    name: dto.fullName || dto.username,
    email: dto.email,
    perms: (dto.permissions ?? []).map(toUiPerm),
    status: dto.status === "Active" ? "active" : "locked",
    dirty: false,
  }
}

/**
 * A-04 Quản lý phân quyền nhân viên (RBAC Matrix).
 *
 *  - BR-ADM-02: Backend kiểm tra trực tiếp 7 mã quyền chuẩn (`REVIEW_AI`, `CURATE_DATASET`,
 *    `VERIFY_RECYCLER`, `HANDLE_COMPLAINT`, `MANAGE_ACCOUNTS`, `MANAGE_BLOG`, `MANAGE_INVENTORY`)
 *    qua `[HasPermission]` Policy và tự động xoá cache phân quyền ngay khi lưu (`MSG-ADM-01`).
 */
export default function Permissions() {
  const [list, setList] = useState<StaffPermRow[]>(STAFF)
  const [isLive, setIsLive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState("")

  useEffect(() => {
    let cancelled = false
    getAdminStaffList()
      .then((res) => {
        if (cancelled || !Array.isArray(res.data)) return
        setList(res.data.map(mapStaffToPermRow))
        setIsLive(true)
      })
      .catch(() => {
        // Giữ dữ liệu STAFF mô phỏng khi chưa đăng nhập Admin
      })
    return () => {
      cancelled = true
    }
  }, [])

  const flip = (id: string, perm: string) =>
    setList((ls) =>
      ls.map((s) =>
        s.id === id
          ? {
              ...s,
              dirty: true,
              perms: s.perms.includes(perm)
                ? s.perms.filter((p) => p !== perm)
                : [...s.perms, perm],
            }
          : s,
      ),
    )

  const saveAllChanges = async () => {
    setSaving(true)
    setFlash("")
    try {
      if (isLive) {
        const targets = list.filter((s) => s.dirty && s.backendUserId)
        const listToSave = targets.length > 0 ? targets : list.filter((s) => s.backendUserId)
        let lastMessage = ""
        for (const row of listToSave) {
          if (!row.backendUserId) continue
          const res = await updateStaffPermissions(row.backendUserId, row.perms)
          if (res.message) lastMessage = res.message
        }
        setList((ls) => ls.map((s) => ({ ...s, dirty: false })))
        setFlash(
          lastMessage ||
            "Đã cập nhật quyền hạn nhân viên thành công (MSG-ADM-01). Hiệu lực tức thời trên API.",
        )
      } else {
        setList((ls) => ls.map((s) => ({ ...s, dirty: false })))
        setFlash("Đã lưu ma trận phân quyền nhân viên (MSG-ADM-01).")
      }
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Cập nhật phân quyền thất bại.")
    } finally {
      setSaving(false)
    }
  }

  const dirtyCount = list.filter((s) => s.dirty).length

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="QUẢN TRỊ · A-04"
        title="Phân quyền nhân viên (RBAC)"
        body="Mỗi cột tương ứng một chính sách bảo mật ở tầng API Backend (BR-ADM-02). Nhân viên không có quyền nào sẽ đăng nhập được nhưng bị chặn 403 trên các API nghiệp vụ chưa được cấp."
      />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
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
                  title={toCanonicalPerm(p.id)}
                  className="px-3 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase"
                >
                  {p.label}
                  <span className="block font-mono text-[9px] font-normal text-muted/80">
                    {toCanonicalPerm(p.id)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {list.map((s) => (
              <tr key={s.backendUserId ?? s.id}>
                <Td className="font-semibold text-ink whitespace-nowrap">
                  {s.name}
                  <span className="block text-[12px] font-normal text-muted">
                    {s.id}
                    {s.dirty ? " · Chưa lưu" : ""}
                  </span>
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={saveAllChanges}
          className="btn-primary h-11 px-6"
        >
          {saving
            ? "Đang đồng bộ RBAC..."
            : dirtyCount > 0
              ? `Lưu cấu hình phân quyền (${dirtyCount})`
              : "Lưu cấu hình phân quyền"}
        </button>
        <button
          type="button"
          onClick={() => {
            setList((ls) =>
              ls.map((s) => ({ ...s, dirty: true, perms: PERMS.map((p) => p.id) })),
            )
            setFlash("Đã chọn toàn bộ quyền. Nhấn 'Lưu cấu hình phân quyền' để áp dụng lên máy chủ.")
          }}
          className="btn-ghost h-11 px-5"
        >
          Cấp toàn quyền cho tất cả
        </button>
        <button
          type="button"
          onClick={() => {
            setList((ls) => ls.map((s) => ({ ...s, dirty: true, perms: [] })))
            setFlash("Đã bỏ chọn toàn bộ quyền. Nhấn 'Lưu cấu hình phân quyền' để xác nhận thu hồi.")
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
          <Table head={["Nhân viên", "Tài khoản", "Số quyền", "Tóm tắt quyền hạn"]}>
            {list.map((s) => (
              <tr key={s.backendUserId ?? s.id}>
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
                      ? "Toàn quyền (7/7)"
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
        Mọi thay đổi được kiểm tra đồng thời ở giao diện và ở Middleware `[HasPermission]` của Backend (.NET 10) kèm xoá bộ nhớ đệm phân quyền tức thời, đảm bảo nhân viên không thể gọi thẳng URL API khi đã bị thu hồi quyền.
      </p>
    </div>
  )
}
