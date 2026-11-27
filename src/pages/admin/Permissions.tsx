import { useEffect, useState } from "react"
import { PageHead, Status, Table, TableSkeleton, Td } from "@/components/admin/ui"
import { PERMS, STAFF, type Staff } from "@/data/ops"
import { hasLiveBackendAuth } from "@/lib/session"
import { initApiLoading, initApiState } from "@/lib/hydration"
import {
  getAdminStaffList,
  getPermissionCatalog,
  getStaffPermissions,
  toUiPerm,
  updateStaffPermissions,
  type PermissionCatalogItemDto,
  type StaffMemberDto,
} from "@/lib/governanceApi"

type CatalogColumn = {
  id: string
  code: string
  label: string
  description?: string
}

const DEFAULT_CATALOG: CatalogColumn[] = PERMS.map((p) => ({
  id: p.id,
  code: p.id.toUpperCase(),
  label: p.label,
}))

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
  const [list, setList] = useState<StaffPermRow[]>(() => initApiState([], STAFF))
  const [catalog, setCatalog] = useState<CatalogColumn[]>(DEFAULT_CATALOG)
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [isLive, setIsLive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [flash, setFlash] = useState("")
  const [errMsg, setErrMsg] = useState("")

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getAdminStaffList(),
      getPermissionCatalog().catch(() => null),
    ])
      .then(([staffRes, catRes]) => {
        if (cancelled) return
        if (Array.isArray(staffRes.data)) {
          setList(staffRes.data.map(mapStaffToPermRow))
          setIsLive(true)
        }
        if (catRes?.success && Array.isArray(catRes.data) && catRes.data.length > 0) {
          setCatalog(
            catRes.data.map((c: PermissionCatalogItemDto) => ({
              id: toUiPerm(c.code || c.legacyAlias),
              code: c.code,
              label: c.label,
              description: c.description,
            })),
          )
        }
      })
      .catch((err) => {
        if (!cancelled && hasLiveBackendAuth()) {
          setErrMsg(err instanceof Error ? err.message : "Không tải được danh sách phân quyền.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const refreshRowPermissions = async (row: StaffPermRow) => {
    if (!row.backendUserId) return
    setRefreshingId(row.backendUserId)
    setErrMsg("")
    setFlash("")
    try {
      const res = await getStaffPermissions(row.backendUserId)
      if (res.success && res.data) {
        const nextPerms = res.data.permissions.map(toUiPerm)
        setList((ls) =>
          ls.map((item) =>
            item.backendUserId === row.backendUserId
              ? { ...item, perms: nextPerms, dirty: false }
              : item,
          ),
        )
        setFlash(`Đã đồng bộ quyền mới nhất của ${row.name}.`)
      }
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Không thể đồng bộ quyền nhân viên.")
    } finally {
      setRefreshingId(null)
    }
  }

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
    setErrMsg("")
    try {
      if (isLive || hasLiveBackendAuth()) {
        const targets = list.filter((s) => s.dirty && s.backendUserId)
        const listToSave = targets.length > 0 ? targets : list.filter((s) => s.backendUserId)
        if (listToSave.length === 0) {
          setErrMsg("Không tìm thấy dữ liệu nhân viên hợp lệ để đồng bộ phân quyền lên máy chủ.")
          return
        }
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
      setFlash("")
      setErrMsg(err instanceof Error ? err.message : "Cập nhật phân quyền thất bại.")
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

      {loading ? (
        <TableSkeleton rows={4} />
      ) : (
      <>
      <ul className="flex flex-col gap-4 md:hidden">
        {list.map((s) => (
          <li key={s.backendUserId ?? s.id} className="card flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2 border-b border-line-soft pb-2.5">
              <div>
                <p className="font-bold text-ink">{s.name}</p>
                <p className="text-xs text-muted">
                  {s.id}
                  {s.dirty ? " · Chưa lưu" : ""}
                </p>
              </div>
              <Status tone={s.status === "active" ? "ok" : "off"}>
                {s.status === "active" ? "Hoạt động" : "Đã khoá"}
              </Status>
            </div>
            <div className="grid gap-1.5">
              {catalog.map((p) => (
                <label
                  key={p.id}
                  className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg border border-line-soft bg-surface-2/40 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-ink">{p.label}</span>
                    <span className="block font-mono text-[10px] text-muted">{p.code}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-brand"
                    checked={s.perms.includes(p.id)}
                    onChange={() => flip(s.id, p.id)}
                    aria-label={`${p.label} cho ${s.name}`}
                  />
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              <th
                scope="col"
                className="px-4 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase"
              >
                Nhân viên
              </th>
              {catalog.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  title={p.description ? `${p.code} — ${p.description}` : p.code}
                  className="px-3 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase"
                >
                  {p.label}
                  <span className="block font-mono text-[9px] font-normal text-muted/80">
                    {p.code}
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
                {catalog.map((p) => (
                  <td key={p.id} className="px-3 py-3" title={p.description}>
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
      </>
      )}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void saveAllChanges()
        }}
        className="flex flex-wrap items-center gap-3"
      >
        <button
          type="submit"
          disabled={saving}
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
            setErrMsg("")
            setList((ls) =>
              ls.map((s) => ({ ...s, dirty: true, perms: catalog.map((p) => p.id) })),
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
            setErrMsg("")
            setList((ls) => ls.map((s) => ({ ...s, dirty: true, perms: [] })))
            setFlash("Đã bỏ chọn toàn bộ quyền. Nhấn 'Lưu cấu hình phân quyền' để xác nhận thu hồi.")
          }}
          className="btn-ghost h-11 px-5 text-warn"
        >
          Thu hồi toàn bộ quyền
        </button>
        {errMsg && (
          <p role="alert" className="text-[13px] font-semibold text-warn">
            {errMsg}
          </p>
        )}
        {flash && (
          <p role="status" className="text-[13px] font-semibold text-brand">
            {flash}
          </p>
        )}
      </form>

      <section>
        <h2 className="text-base font-bold text-ink">Trạng thái hiện tại</h2>
        <div className="mt-3">
          <ul className="flex flex-col gap-3 md:hidden">
            {list.map((s) => (
              <li key={s.backendUserId ?? s.id} className="card flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-ink">{s.name}</p>
                    <p className="text-xs text-muted tabular-nums">
                      {s.perms.length} / {PERMS.length} quyền
                    </p>
                  </div>
                  <Status tone={s.status === "active" ? "ok" : "off"}>
                    {s.status === "active" ? "Hoạt động" : "Đã khoá"}
                  </Status>
                </div>
                <p className="text-xs leading-5 text-body">
                  {s.perms.length === 0
                    ? "Chưa có quyền nào"
                    : s.perms.length === PERMS.length
                      ? "Toàn quyền (7/7)"
                      : PERMS.filter((p) => s.perms.includes(p.id))
                          .map((p) => p.label)
                          .join(", ")}
                </p>
                {s.backendUserId && (
                  <button
                    type="button"
                    disabled={refreshingId === s.backendUserId}
                    onClick={() => void refreshRowPermissions(s)}
                    className="btn-outline min-h-9 w-full justify-center text-xs font-semibold"
                  >
                    {refreshingId === s.backendUserId ? "Đang tải..." : "Đồng bộ quyền"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
          <Table head={["Nhân viên", "Tài khoản", "Số quyền", "Tóm tắt quyền hạn"]}>
            {list.map((s) => (
              <tr key={s.backendUserId ?? s.id}>
                <Td className="font-semibold text-ink">
              {s.name}
              {s.backendUserId && (
                <button
                  type="button"
                  disabled={refreshingId === s.backendUserId}
                  onClick={() => void refreshRowPermissions(s)}
                  className="ml-2 text-xs font-medium text-brand hover:underline"
                >
                  {refreshingId === s.backendUserId ? "Đang tải..." : "Đồng bộ quyền"}
                </button>
              )}
            </Td>
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
        </div>
      </section>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Mọi thay đổi được kiểm tra đồng thời ở giao diện và ở Middleware `[HasPermission]` của Backend (.NET 10) kèm xoá bộ nhớ đệm phân quyền tức thời, đảm bảo nhân viên không thể gọi thẳng URL API khi đã bị thu hồi quyền.
      </p>
    </div>
  )
}
