import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Empty, Field, FormRequiredLegend, Status, TableSkeleton } from "@/components/admin/ui"
import { initApiLoading, initApiState, isSsrSmokeTest } from "@/lib/hydration"
import {
  DEFAULT_PLATFORM_POLICIES,
  POLICY_CATEGORY_META,
  POLICY_STATUS_META,
  createPlatformPolicy,
  deletePlatformPolicy,
  fetchAdminPolicies,
  setPlatformPolicyStatus,
  updatePlatformPolicy,
  type PlatformPolicyCategory,
  type PlatformPolicySectionDto,
  type PlatformPolicyStatus,
} from "@/lib/policyApi"

const CATEGORY_OPTIONS: { value: PlatformPolicyCategory; label: string }[] = [
  { value: "TERMS", label: "Điều khoản sử dụng (TERMS)" },
  { value: "ENVIRONMENT", label: "Chính sách môi trường (ENVIRONMENT)" },
  { value: "PRIVACY", label: "Quyền riêng tư (PRIVACY)" },
]

const STATUS_OPTIONS: { value: PlatformPolicyStatus; label: string }[] = [
  { value: "ACTIVE", label: "ACTIVE · Công khai" },
  { value: "DRAFT", label: "DRAFT · Bản nháp" },
  { value: "INACTIVE", label: "INACTIVE · Tạm ẩn" },
]

export default function PlatformPoliciesTab() {
  const [liveMode] = useState(() => !isSsrSmokeTest())
  const [items, setItems] = useState<PlatformPolicySectionDto[]>(() =>
    initApiState([], DEFAULT_PLATFORM_POLICIES),
  )
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | PlatformPolicyCategory>("ALL")
  const [statusFilter, setStatusFilter] = useState<"ALL" | PlatformPolicyStatus>("ALL")

  const [editingId, setEditingId] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [category, setCategory] = useState<PlatformPolicyCategory>("TERMS")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [displayOrder, setDisplayOrder] = useState(1)
  const [status, setStatus] = useState<PlatformPolicyStatus>("ACTIVE")

  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState("")
  const [errMsg, setErrMsg] = useState("")

  const loadPolicies = async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const list = await fetchAdminPolicies(undefined, signal)
      setItems(list)
    } catch (err) {
      if (!signal?.aborted) {
        setErrMsg(err instanceof Error ? err.message : "Không thể tải danh sách điều khoản.")
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    if (!liveMode) return
    const controller = new AbortController()
    void loadPolicies(controller.signal)
    return () => controller.abort()
  }, [liveMode])

  useEffect(() => {
    if (!editingId && items.length > 0) {
      const nextOrder = Math.max(0, ...items.map((x) => x.displayOrder)) + 1
      setDisplayOrder(nextOrder)
    }
  }, [editingId, items])

  const resetForm = (sourceList = items) => {
    setEditingId(null)
    setCode("")
    setCategory("TERMS")
    setTitle("")
    setContent("")
    setStatus("ACTIVE")
    setDisplayOrder(Math.max(0, ...sourceList.map((x) => x.displayOrder)) + 1)
  }

  const startEdit = (row: PlatformPolicySectionDto) => {
    setEditingId(row.id)
    setCode(row.code)
    const upperCat = row.category.toUpperCase()
    setCategory(
      upperCat === "ENVIRONMENT" || upperCat === "PRIVACY" ? upperCat : "TERMS",
    )
    setTitle(row.title)
    setContent(row.content)
    setDisplayOrder(row.displayOrder)
    const upperStatus = row.status.toUpperCase()
    setStatus(
      upperStatus === "DRAFT" || upperStatus === "INACTIVE" ? upperStatus : "ACTIVE",
    )
    setFlash("")
    setErrMsg("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFlash("")
    setErrMsg("")

    if (title.trim().length < 3) {
      setErrMsg("Vui lòng nhập tiêu đề điều khoản (tối thiểu 3 ký tự).")
      return
    }
    if (content.trim().length < 10) {
      setErrMsg("Vui lòng nhập nội dung điều khoản chi tiết (tối thiểu 10 ký tự).")
      return
    }

    if (!liveMode) {
      setFlash("Đã lưu thay đổi điều khoản ở chế độ xem trước.")
      return
    }

    setBusy(true)
    try {
      const payload = {
        code: code.trim() || null,
        category,
        title: title.trim(),
        content: content.trim(),
        displayOrder: Math.max(1, Number(displayOrder) || 1),
        status,
      }
      if (editingId) {
        const res = await updatePlatformPolicy(editingId, payload)
        const updatedList = items
          .map((x) => (x.id === editingId ? res.data : x))
          .sort((a, b) => a.displayOrder - b.displayOrder)
        setItems(updatedList)
        setFlash(`Đã cập nhật điều khoản '${res.data.code}'.`)
        resetForm(updatedList)
      } else {
        const res = await createPlatformPolicy(payload)
        const nextList = [...items, res.data].sort((a, b) => a.displayOrder - b.displayOrder)
        setItems(nextList)
        setFlash(`Đã thêm mới điều khoản '${res.data.code}'.`)
        resetForm(nextList)
      }
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Lưu điều khoản thất bại.")
    } finally {
      setBusy(false)
    }
  }

  const handleToggleStatus = async (row: PlatformPolicySectionDto) => {
    const nextStatus: PlatformPolicyStatus =
      row.status.toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setFlash("")
    setErrMsg("")
    setBusy(true)
    try {
      const res = await setPlatformPolicyStatus(row.id, nextStatus)
      setItems((prev) => prev.map((x) => (x.id === row.id ? res.data : x)))
      setFlash(
        `Đã chuyển '${res.data.code}' sang trạng thái ${
          nextStatus === "ACTIVE" ? "Đang công khai (ACTIVE)" : "Tạm ẩn (INACTIVE)"
        }.`,
      )
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Không thể đổi trạng thái điều khoản.")
    } finally {
      setBusy(false)
    }
  }

  const handleMoveOrder = async (row: PlatformPolicySectionDto, direction: -1 | 1) => {
    const ordered = [...items].sort((a, b) => a.displayOrder - b.displayOrder)
    const idx = ordered.findIndex((x) => x.id === row.id)
    const targetIdx = idx + direction
    if (idx < 0 || targetIdx < 0 || targetIdx >= ordered.length) return

    const neighbor = ordered[targetIdx]
    const currentOrder = row.displayOrder
    const neighborOrder =
      neighbor.displayOrder === currentOrder ? currentOrder + direction : neighbor.displayOrder

    setFlash("")
    setErrMsg("")
    setBusy(true)
    try {
      const [resA, resB] = await Promise.all([
        updatePlatformPolicy(row.id, {
          code: row.code,
          category: row.category,
          title: row.title,
          content: row.content,
          displayOrder: neighborOrder,
          status: row.status,
        }),
        updatePlatformPolicy(neighbor.id, {
          code: neighbor.code,
          category: neighbor.category,
          title: neighbor.title,
          content: neighbor.content,
          displayOrder: currentOrder,
          status: neighbor.status,
        }),
      ])
      setItems((prev) =>
        prev
          .map((x) => (x.id === resA.data.id ? resA.data : x.id === resB.data.id ? resB.data : x))
          .sort((a, b) => a.displayOrder - b.displayOrder),
      )
      setFlash(`Đã cập nhật thứ tự hiển thị cho '${row.code}'.`)
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Không thể đổi thứ tự hiển thị.")
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (row: PlatformPolicySectionDto) => {
    if (!window.confirm(`Bạn chắc chắn muốn xóa mục điều khoản "${row.title}" (${row.code})?`)) {
      return
    }
    setFlash("")
    setErrMsg("")
    setBusy(true)
    try {
      await deletePlatformPolicy(row.id)
      const next = items.filter((x) => x.id !== row.id)
      setItems(next)
      if (editingId === row.id) resetForm(next)
      setFlash(`Đã xóa mục điều khoản '${row.code}'.`)
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Không thể xóa mục điều khoản này.")
    } finally {
      setBusy(false)
    }
  }

  const sortedAll = [...items].sort((a, b) => a.displayOrder - b.displayOrder)
  const filtered = sortedAll.filter((x) => {
    if (categoryFilter !== "ALL" && x.category.toUpperCase() !== categoryFilter) return false
    if (statusFilter !== "ALL" && x.status.toUpperCase() !== statusFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return (
        x.title.toLowerCase().includes(q) ||
        x.code.toLowerCase().includes(q) ||
        x.content.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-surface-2/60 px-4 py-3">
        <p className="text-[13px] leading-5 text-body">
          Nội dung ở đây hiển thị trực tiếp trên trang công khai <b>/terms</b> và các liên kết
          pháp lý dưới chân trang (Footer). Hệ thống luôn giữ tối thiểu 1 mục ở trạng thái{" "}
          <b>ACTIVE</b>.
        </p>
        <Link
          to="/terms"
          className="btn-outline h-9 shrink-0 px-3.5 text-xs font-semibold"
        >
          Xem trang /terms công khai →
        </Link>
      </div>

      <form onSubmit={handleSubmit} noValidate className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-ink">
            {editingId ? "Chỉnh sửa mục điều khoản" : "Thêm mục điều khoản / chính sách mới"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={() => resetForm()}
              className="text-xs font-semibold text-muted underline underline-offset-4 hover:text-ink"
            >
              Hủy chỉnh sửa
            </button>
          )}
        </div>

        <FormRequiredLegend />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Phân nhóm" required>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value as PlatformPolicyCategory)}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Trạng thái hiển thị" required>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as PlatformPolicyStatus)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Thứ tự hiển thị" required>
            <input
              type="number"
              min={1}
              className="input tabular-nums"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
            />
          </Field>

          <Field label="Mã tham chiếu" hint="Bỏ trống để hệ thống tự sinh (VD: TERM-04)">
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="VD: TERM-04"
            />
          </Field>
        </div>

        <Field label="Tiêu đề mục điều khoản" required>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: 6. Quy trình giải quyết tranh chấp và khiếu nại cân đo"
          />
        </Field>

        <Field label="Nội dung chi tiết" required>
          <textarea
            rows={3}
            className="input h-auto resize-y py-3 leading-6"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nhập nội dung quy định rõ ràng cho người dân và cơ sở thu gom..."
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="btn-primary h-10 px-5 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Đang lưu..." : editingId ? "Lưu cập nhật" : "Thêm điều khoản"}
          </button>
          {flash && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {flash}
            </p>
          )}
          {errMsg && (
            <p role="alert" className="text-[13px] font-semibold text-red-600">
              {errMsg}
            </p>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Field label="Tìm kiếm điều khoản">
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã, tiêu đề hoặc nội dung..."
            />
          </Field>
        </div>
        <div className="w-52">
          <Field label="Lọc theo nhóm">
            <select
              className="input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as "ALL" | PlatformPolicyCategory)}
            >
              <option value="ALL">Tất cả nhóm</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="w-44">
          <Field label="Lọc trạng thái">
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | PlatformPolicyStatus)}
            >
              <option value="ALL">Tất cả trạng thái</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <Empty>Không tìm thấy mục điều khoản nào khớp với bộ lọc hiện tại.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((row) => {
            const catMeta =
              POLICY_CATEGORY_META[row.category.toUpperCase() as PlatformPolicyCategory] ??
              POLICY_CATEGORY_META.TERMS
            const statusMeta =
              POLICY_STATUS_META[row.status.toUpperCase() as PlatformPolicyStatus] ?? {
                label: row.status,
                tone: "wait" as const,
              }
            const globalIdx = sortedAll.findIndex((x) => x.id === row.id)

            return (
              <li key={row.id} className="card flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-surface-2 px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink">
                        #{row.displayOrder}
                      </span>
                      <span className="text-xs font-semibold text-muted">{row.code}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${catMeta.badgeClass}`}
                      >
                        {catMeta.label}
                      </span>
                      <Status tone={statusMeta.tone}>{statusMeta.label}</Status>
                    </div>
                    <h3 className="mt-2 text-base font-bold text-ink">{row.title}</h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busy || globalIdx <= 0}
                      onClick={() => void handleMoveOrder(row, -1)}
                      title="Đưa lên trước"
                      aria-label={`Đưa ${row.code} lên trước`}
                      className="btn-outline h-8 px-2.5 text-xs disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={busy || globalIdx < 0 || globalIdx >= sortedAll.length - 1}
                      onClick={() => void handleMoveOrder(row, 1)}
                      title="Đưa xuống sau"
                      aria-label={`Đưa ${row.code} xuống sau`}
                      className="btn-outline h-8 px-2.5 text-xs disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(row)}
                      className="btn-outline h-8 px-3 text-xs font-semibold"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleToggleStatus(row)}
                      className="btn-outline h-8 px-3 text-xs font-semibold"
                    >
                      {row.status.toUpperCase() === "ACTIVE" ? "Tạm ẩn" : "Công khai"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDelete(row)}
                      className="h-8 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                    >
                      Xóa
                    </button>
                  </div>
                </div>

                <p className="whitespace-pre-line text-sm leading-relaxed text-body">
                  {row.content}
                </p>

                <p className="text-[11px] text-muted">
                  Cập nhật lần cuối:{" "}
                  {new Date(row.updatedAt || row.createdAt).toLocaleString("vi-VN")}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
