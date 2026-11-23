import { useEffect, useState } from "react"
import PaginationBar, { FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import SearchFilterBar from "@/components/SearchFilterBar"
import { Field, FormRequiredLegend, PageHead, Status, Table, TableSkeleton, Td } from "@/components/admin/ui"
import { STAFF, type Staff } from "@/data/ops"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { initApiLoading, initApiState } from "@/lib/hydration"
import {
  createAdminStaff,
  getAdminStaffList,
  lockOrUnlockStaff,
  toUiPerm,
  updateAdminStaff,
  type StaffMemberDto,
} from "@/lib/governanceApi"
import { useSession } from "@/lib/session"

type StaffRow = Staff & {
  backendUserId?: string
  department: string
  position: string
  phoneNumber?: string | null
}

function mapStaffDto(dto: StaffMemberDto): StaffRow {
  return {
    id: dto.employeeCode || dto.userId.slice(0, 8),
    backendUserId: dto.userId,
    name: dto.fullName || dto.username,
    email: dto.email,
    phoneNumber: dto.phoneNumber,
    department: dto.department || "Vận hành chung",
    position: dto.position || "Chuyên viên vận hành",
    perms: (dto.permissions ?? []).map(toUiPerm),
    status: dto.status === "Active" ? "active" : "locked",
  }
}

const FALLBACK_STAFF: StaffRow[] = STAFF.map((s) => ({
  ...s,
  department: "Vận hành hệ thống",
  position: "Chuyên viên vận hành",
}))

/**
 * A-03 Quản lý tài khoản nhân viên (Staff).
 *
 *  - BR-ADM-01: Chỉ Admin được khởi tạo tài khoản Staff, mặc định 0 quyền hạn cho tới khi cấp ở A-04.
 *  - BR-ADM-03: Khoá / Mở khoá bắt buộc nhập lý do >= 10 ký tự và thu hồi Refresh Token tức thời.
 *  - Chặn tự khoá chính tài khoản đang đăng nhập.
 */
export default function StaffAccounts() {
  const session = useSession()
  const [list, setList] = useState<StaffRow[]>(() => initApiState([], FALLBACK_STAFF))
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [isLive, setIsLive] = useState(false)

  // Form tạo mới
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [department, setDepartment] = useState("Vận hành & Kiểm duyệt")
  const [position, setPosition] = useState("Chuyên viên vận hành")
  const [initialPassword, setInitialPassword] = useState("")
  const [flash, setFlash] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Modal sửa thông tin nhân sự
  const [editTarget, setEditTarget] = useState<StaffRow | null>(null)
  const [editName, setEditName] = useState("")
  const [editDept, setEditDept] = useState("")
  const [editPos, setEditPos] = useState("")
  const [editResetPw, setEditResetPw] = useState("")

  // Modal khoá / mở khoá kèm lý do bắt buộc (BR-ADM-03)
  const [lockTarget, setLockTarget] = useState<StaffRow | null>(null)
  const [lockReason, setLockReason] = useState("")
  const [modalError, setModalError] = useState("")

  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "locked">("all")
  const [page, setPage] = useState(1)
  const pageSize = FIXED_PAGE_SIZE

  const staffKeyword = debouncedSearch.trim().toLowerCase()
  const filteredStaff = list.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false
    if (!staffKeyword) return true
    return [s.id, s.name, s.email, s.department, s.position]
      .join(" ")
      .toLowerCase()
      .includes(staffKeyword)
  })
  const pagedStaff = paginateItems(filteredStaff, page, pageSize)

  useEffect(() => {
    let cancelled = false
    getAdminStaffList()
      .then((res) => {
        if (cancelled || !Array.isArray(res.data)) return
        setList(res.data.map(mapStaffDto))
        setIsLive(true)
      })
      .catch(() => {
        // Fallback sang STAFF mô phỏng khi chưa có kết nối
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 3) {
      setFlash("Cần họ tên nhân viên tối thiểu 3 ký tự trước khi tạo tài khoản.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setFlash("Email chưa đúng định dạng công việc.")
      return
    }

    setSubmitting(true)
    setFlash("")
    try {
      if (isLive) {
        const res = await createAdminStaff({
          fullName: name.trim(),
          email: email.trim(),
          department: department.trim() || "Vận hành & Kiểm duyệt",
          position: position.trim() || "Chuyên viên vận hành",
          initialPassword: initialPassword.trim() || undefined,
        })
        const created = mapStaffDto(res.data)
        setList((ls) => [created, ...ls])
        setFlash(
          res.message ||
            `Đã tạo nhân viên ${created.id} với 0 quyền mặc định (BR-ADM-01). Hãy sang trang Phân quyền để cấp quyền.`,
        )
      } else {
        const id = `NV-${String(list.length + 1).padStart(2, "0")}`
        setList((ls) => [
          ...ls,
          {
            id,
            name: name.trim(),
            email: email.trim(),
            department: department.trim() || "Vận hành & Kiểm duyệt",
            position: position.trim() || "Chuyên viên vận hành",
            perms: [],
            status: "active",
          },
        ])
        setFlash(`Đã tạo ${id} (0 quyền mặc định). Sang trang phân quyền để cấp quyền cụ thể.`)
      }
      setName("")
      setEmail("")
      setInitialPassword("")
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Tạo tài khoản nhân viên thất bại.")
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (s: StaffRow) => {
    setEditTarget(s)
    setEditName(s.name)
    setEditDept(s.department)
    setEditPos(s.position)
    setEditResetPw("")
    setModalError("")
  }

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    if (editName.trim().length < 3) {
      setModalError("Họ tên nhân viên tối thiểu 3 ký tự.")
      return
    }

    setSubmitting(true)
    setModalError("")
    try {
      if (isLive && editTarget.backendUserId) {
        const res = await updateAdminStaff(editTarget.backendUserId, {
          fullName: editName.trim(),
          department: editDept.trim() || "Vận hành chung",
          position: editPos.trim() || "Chuyên viên vận hành",
          resetPassword: editResetPw.trim() || undefined,
        })
        const updated = mapStaffDto(res.data)
        setList((ls) =>
          ls.map((x) => (x.backendUserId === editTarget.backendUserId ? updated : x)),
        )
        setFlash(res.message || `Đã cập nhật hồ sơ nhân viên ${updated.id}.`)
      } else {
        setList((ls) =>
          ls.map((x) =>
            x.id === editTarget.id
              ? {
                  ...x,
                  name: editName.trim(),
                  department: editDept.trim(),
                  position: editPos.trim(),
                }
              : x,
          ),
        )
        setFlash(`Đã cập nhật thông tin nhân viên ${editTarget.name}.`)
      }
      setEditTarget(null)
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Cập nhật hồ sơ thất bại.")
    } finally {
      setSubmitting(false)
    }
  }

  const openLockModal = (s: StaffRow) => {
    if (
      (s.backendUserId && session?.id && s.backendUserId === session.id) ||
      (session?.email && s.email.toLowerCase() === session.email.toLowerCase())
    ) {
      setFlash("Không thể tự khoá tài khoản đang đăng nhập của chính bạn (BR-ADM-03).")
      return
    }
    setLockTarget(s)
    setLockReason("")
    setModalError("")
  }

  const submitLock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lockTarget) return
    const cleanReason = lockReason.trim()
    if (cleanReason.length < 10) {
      setModalError("Lý do khoá/mở khoá bắt buộc tối thiểu 10 ký tự (BR-ADM-03).")
      return
    }

    const nextLocked = lockTarget.status === "active"
    setSubmitting(true)
    setModalError("")
    try {
      if (isLive && lockTarget.backendUserId) {
        const res = await lockOrUnlockStaff(lockTarget.backendUserId, {
          isLocked: nextLocked,
          reason: cleanReason,
        })
        setList((ls) =>
          ls.map((x) =>
            x.backendUserId === lockTarget.backendUserId
              ? { ...x, status: nextLocked ? "locked" : "active" }
              : x,
          ),
        )
        setFlash(
          res.message ||
            (nextLocked
              ? `Đã khoá tài khoản nhân viên ${lockTarget.name} và thu hồi token.`
              : `Đã mở khoá nhân viên ${lockTarget.name}.`),
        )
      } else {
        setList((ls) =>
          ls.map((x) =>
            x.id === lockTarget.id ? { ...x, status: nextLocked ? "locked" : "active" } : x,
          ),
        )
        setFlash(
          nextLocked
            ? `Đã khoá nhân viên ${lockTarget.name}.`
            : `Đã mở khoá nhân viên ${lockTarget.name}.`,
        )
      }
      setLockTarget(null)
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Thao tác khoá tài khoản thất bại.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="QUẢN TRỊ · A-03"
        title="Tài khoản nhân viên"
        body="Khởi tạo, cập nhật phòng ban/chức vụ và khoá tài khoản nhân viên vận hành. Tài khoản mới luôn bắt đầu với 0 quyền hạn (Least-Privilege) cho tới khi bạn cấp ở trang Phân quyền."
      />

      <form onSubmit={add} noValidate className="card flex flex-col gap-5 p-5 md:p-6">
        <FormRequiredLegend />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Họ và tên" required>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A"
            />
          </Field>
          <Field label="Email công việc" required>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten@ecolink.vn"
            />
          </Field>
          <Field label="Phòng ban" required>
            <input
              className="input"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Vận hành & Kiểm duyệt"
            />
          </Field>
          <Field label="Chức vụ" required>
            <input
              className="input"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Chuyên viên vận hành"
            />
          </Field>
          <Field label="Mật khẩu khởi tạo (tuỳ chọn)">
            <input
              className="input"
              type="password"
              value={initialPassword}
              onChange={(e) => setInitialPassword(e.target.value)}
              placeholder="Mặc định: Staff@123456"
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button type="submit" disabled={submitting} className="btn-primary h-11 px-6">
            {submitting ? "Đang khởi tạo..." : "Tạo tài khoản nhân viên"}
          </button>
          {flash && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {flash}
            </p>
          )}
        </div>
      </form>

      <SearchFilterBar
        value={search}
        onChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        label="Tìm kiếm nhân sự"
        placeholder="Tìm theo mã NV, họ tên, email, phòng ban..."
        totalCount={filteredStaff.length}
        countLabel="nhân viên"
      >
        <select
          aria-label="Lọc trạng thái nhân viên"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "all" | "active" | "locked")
            setPage(1)
          }}
          className="input h-10 text-xs"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="locked">Đã khoá</option>
        </select>
      </SearchFilterBar>

      <div>
        {loading ? (
          <TableSkeleton rows={5} />
        ) : (
        <>
        <Table head={["Mã NV", "Họ tên", "Email", "Phòng ban", "Số quyền", "Trạng thái", ""]}>
          {pagedStaff.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-xs text-muted">
                Không có tài khoản nhân viên nào khớp bộ lọc.
              </td>
            </tr>
          ) : (
            pagedStaff.map((s) => (
              <tr key={s.backendUserId ?? s.id}>
                <Td className="tabular-nums whitespace-nowrap">{s.id}</Td>
                <Td className="font-semibold text-ink">
                  {s.name}
                  <span className="block text-[11px] font-normal text-muted">{s.position}</span>
                </Td>
                <Td>{s.email}</Td>
                <Td className="whitespace-nowrap">{s.department}</Td>
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
                      onClick={() => openEdit(s)}
                      className="text-[13px] font-semibold text-brand hover:underline"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => openLockModal(s)}
                      className="text-[13px] font-semibold text-warn hover:underline"
                    >
                      {s.status === "active" ? "Khoá" : "Mở khoá"}
                    </button>
                  </span>
                </Td>
              </tr>
            ))
          )}
        </Table>
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalCount={filteredStaff.length}
          onPageChange={setPage}
          itemLabel="nhân viên"
        />
        </>
        )}
      </div>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Nhân viên bị khoá sẽ ngay lập tức bị thu hồi phiên đăng nhập (Refresh Token + bộ chặn trạng thái JWT). Hồ sơ nhân viên không xoá cứng để giữ nguyên dấu vết kiểm duyệt AI, biên bản khiếu nại và nhật ký kiểm toán.
      </p>

      {editTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
        >
          <form
            onSubmit={submitEdit}
            className="card flex w-full max-w-md flex-col gap-4 bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-bold text-ink">
              Cập nhật nhân sự · {editTarget.id}
            </h2>
            <Field label="Họ và tên" required>
              <input
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </Field>
            <Field label="Phòng ban" required>
              <input
                className="input"
                value={editDept}
                onChange={(e) => setEditDept(e.target.value)}
              />
            </Field>
            <Field label="Chức vụ" required>
              <input
                className="input"
                value={editPos}
                onChange={(e) => setEditPos(e.target.value)}
              />
            </Field>
            <Field
              label="Đặt lại mật khẩu mới (tuỳ chọn)"
              hint="Để trống nếu không muốn đổi mật khẩu hiện tại."
            >
              <input
                className="input"
                type="password"
                value={editResetPw}
                onChange={(e) => setEditResetPw(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
              />
            </Field>
            {modalError && <p className="text-[13px] font-semibold text-warn">{modalError}</p>}
            <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="btn-ghost h-10 px-4 text-[13px]"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary h-10 px-5 text-[13px]"
              >
                {submitting ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </div>
      )}

      {lockTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
        >
          <form
            onSubmit={submitLock}
            className="card flex w-full max-w-md flex-col gap-4 bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-bold text-ink">
              {lockTarget.status === "active"
                ? `Khoá nhân viên ${lockTarget.name}`
                : `Mở khoá nhân viên ${lockTarget.name}`}
            </h2>
            <Field label="Lý do kiểm toán (bắt buộc >= 10 ký tự)" required>
              <textarea
                className="input min-h-[90px] py-2"
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                placeholder="Ví dụ: Tạm ngưng quyền truy cập do điều chuyển bộ phận..."
                required
              />
            </Field>
            {modalError && <p className="text-[13px] font-semibold text-warn">{modalError}</p>}
            <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
              <button
                type="button"
                onClick={() => setLockTarget(null)}
                className="btn-ghost h-10 px-4 text-[13px]"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary h-10 px-5 text-[13px]"
              >
                {submitting ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
