import { useEffect, useState } from "react"
import { Field, FormRequiredLegend, PageHead, Status, Table, TableSkeleton, Td } from "@/components/admin/ui"
import { WASTE_GROUPS, WASTES, VND } from "@/data/waste"
import { fmtInt } from "@/data/ops"
import { ApiError } from "@/lib/api"
import { initApiLoading, initApiState } from "@/lib/hydration"
import { hasLiveBackendAuth } from "@/lib/session"
import {
  createWasteCategory,
  fetchWasteCategories,
  toggleWasteCategoryStatus,
  updateWasteCategory,
  type WasteCategoryItemDto,
} from "@/lib/wasteScanApi"

type CategoryRow = {
  id: string
  code: string
  name: string
  group: string
  standardBinColor: string
  description: string
  price: number
  recyclable: boolean
  rule: string
  prep: string
  status: "Active" | "Inactive" | string
  isBackend: boolean
  dirty?: boolean
}

function mapDtoToRow(c: WasteCategoryItemDto): CategoryRow {
  const staticMatch = WASTES.find(
    (w) => w.id === c.code || w.name.toLowerCase().includes(c.code.toLowerCase()),
  )
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    group: staticMatch?.group ?? "Khác",
    standardBinColor: c.standardBinColor,
    description: c.description ?? staticMatch?.rule ?? "",
    price: staticMatch?.price ?? (c.isRecyclable ? 4000 : 0),
    recyclable: c.isRecyclable,
    rule: c.description ?? staticMatch?.rule ?? "Theo quy chuẩn phân loại EcoLink",
    prep: staticMatch?.prep ?? "Làm sạch và phân loại riêng.",
    status: c.status,
    isBackend: true,
    dirty: false,
  }
}

const FALLBACK_ROWS: CategoryRow[] = WASTES.map((w) => ({
  id: w.id,
  code: w.id,
  name: w.name,
  group: w.group,
  standardBinColor: "Cam",
  description: w.rule,
  price: w.price,
  recyclable: w.recyclable,
  rule: w.rule,
  prep: w.prep,
  status: "Active",
  isBackend: false,
  dirty: false,
}))

/** A-05 Quản lý danh mục rác hệ thống.
 *
 *  Kết nối trực tiếp API `/api/v1/waste-categories` (GET/POST/PUT/PATCH status)
 *  và tự động fallback sang dữ liệu tĩnh khi chạy SSR hoặc offline. */
export default function Categories() {
  const [rows, setRows] = useState<CategoryRow[]>(() => initApiState([], FALLBACK_ROWS))
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [flash, setFlash] = useState("")
  const [tableErr, setTableErr] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetchWasteCategories({ includeInactive: true, includeNonRecyclable: true })
      .then((list) => {
        if (!active || list.length === 0) return
        setRows(list.map(mapDtoToRow))
      })
      .catch(() => {
        // Fallback nếu backend chưa chạy
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const set = (id: string, patch: Partial<CategoryRow>) =>
    setRows((rs) => rs.map((w) => (w.id === id ? { ...w, ...patch, dirty: true } : w)))

  const handleSaveAll = async () => {
    setTableErr("")
    setFlash("")
    const invalidRow = rows.find(
      (r) =>
        !r.name.trim() ||
        r.name.trim().length > 100 ||
        !r.standardBinColor.trim() ||
        r.standardBinColor.trim().length > 50,
    )
    if (invalidRow) {
      setTableErr(
        `Danh mục '${invalidRow.code}': Tên loại rác (tối đa 100 ký tự) và Màu thùng chuẩn (tối đa 50 ký tự) không được để trống.`,
      )
      return
    }
    setSaving(true)
    try {
      const backendDirty = rows.filter((r) => r.isBackend && r.dirty)
      if (backendDirty.length > 0) {
        const updatedList = await Promise.all(
          backendDirty.map((r) =>
            updateWasteCategory(r.id, {
              name: r.name.trim(),
              description: (r.description || r.rule).trim(),
              standardBinColor: r.standardBinColor.trim(),
              isRecyclable: r.recyclable,
            }),
          ),
        )
        const updatedMap = new Map(updatedList.map((res) => [res.data.id, mapDtoToRow(res.data)]))
        setRows((prev) => prev.map((r) => updatedMap.get(r.id) ?? { ...r, dirty: false }))
      } else if (hasLiveBackendAuth()) {
        setFlash("Không có thay đổi nào cần lưu.")
        return
      }
      setFlash("Đã lưu đồng bộ danh mục rác lên máy chủ.")
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Không thể lưu danh mục rác lúc này."
      if (hasLiveBackendAuth()) {
        setTableErr(msg)
      } else {
        setFlash("Đã lưu thay đổi cục bộ.")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (row: CategoryRow) => {
    const nextStatus: "Active" | "Inactive" = row.status === "Active" ? "Inactive" : "Active"
    setFlash("")
    setTableErr("")
    if (!row.isBackend) {
      if (hasLiveBackendAuth()) {
        setTableErr("Danh mục này chưa đồng bộ với máy chủ.")
        return
      }
      set(row.id, { status: nextStatus })
      return
    }
    try {
      const res = await toggleWasteCategoryStatus(row.id, nextStatus)
      setRows((prev) => prev.map((r) => (r.id === row.id ? mapDtoToRow(res.data) : r)))
      setFlash(`Đã chuyển trạng thái '${row.code}' sang ${nextStatus} (BR-SRT-04).`)
    } catch (err) {
      setTableErr(err instanceof Error ? err.message : "Không thể đổi trạng thái danh mục.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="CẤU HÌNH"
        title="Danh mục rác hệ thống"
        body="Giá và luật xử lý ở đây là nguồn cho trang tra cứu, hướng dẫn phân loại và bảng giá của cơ sở thu mua. Sửa một chỗ là cả ba nơi cùng đổi."
      />

      {loading ? (
        <TableSkeleton rows={5} />
      ) : (
      <Table head={["Tên loại rác", "Màu thùng / Nhóm", "Giá tham khảo", "Thu gom & Trạng thái", "Mô tả / Luật xử lý"]}>
        {rows.map((w) => (
          <tr key={w.id} className={w.status === "Inactive" ? "opacity-60" : undefined}>
            <Td className="font-semibold text-ink">
              <input
                className="input h-9 font-semibold text-ink"
                value={w.name}
                onChange={(e) => set(w.id, { name: e.target.value })}
                aria-label={`Tên loại rác ${w.code}`}
              />
              <span className="mt-1 block text-[12px] font-normal text-muted">{w.code}</span>
            </Td>
            <Td>
              <div className="flex flex-col gap-1.5">
                <input
                  className="input h-8 w-32 text-[13px]"
                  value={w.standardBinColor}
                  onChange={(e) => set(w.id, { standardBinColor: e.target.value })}
                  aria-label={`Màu thùng của ${w.name}`}
                  placeholder="Màu thùng"
                />
                <select
                  className="input h-8 w-32 text-[12px]"
                  value={w.group}
                  onChange={(e) => set(w.id, { group: e.target.value })}
                  aria-label={`Nhóm của ${w.name}`}
                >
                  {WASTE_GROUPS.filter((g) => g !== WASTE_GROUPS[0]).map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                  {!WASTE_GROUPS.includes(w.group as (typeof WASTE_GROUPS)[number]) && (
                    <option value={w.group}>{w.group}</option>
                  )}
                </select>
              </div>
            </Td>
            <Td>
              <div className="flex items-center gap-2">
                <input
                  className="input h-9 w-24 tabular-nums"
                  type="number"
                  min={0}
                  step={100}
                  value={w.price}
                  disabled={!w.recyclable}
                  onChange={(e) => set(w.id, { price: Number(e.target.value) })}
                  aria-label={`Giá của ${w.name}`}
                />
                <span className="whitespace-nowrap text-[13px] text-muted">đ/kg</span>
              </div>
            </Td>
            <Td>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    checked={w.recyclable}
                    onChange={(e) => set(w.id, { recyclable: e.target.checked })}
                  />
                  <span className="text-[13px] text-body">
                    {w.recyclable ? "Tái chế" : "Rác thường"}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => void handleToggleStatus(w)}
                  className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    w.status === "Active"
                      ? "bg-brand/10 text-brand-deep hover:bg-brand/20"
                      : "bg-surface-2 text-muted hover:bg-line-soft"
                  }`}
                >
                  {w.status === "Active" ? "Active · Tạm ngưng" : "Inactive · Mở lại"}
                </button>
              </div>
            </Td>
            <Td>
              <input
                className="input h-9"
                value={w.description || w.rule}
                onChange={(e) => set(w.id, { description: e.target.value, rule: e.target.value })}
                aria-label={`Luật xử lý của ${w.name}`}
              />
            </Td>
          </tr>
        ))}
      </Table>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void handleSaveAll()}
          disabled={saving}
          className="btn-primary h-11 px-6 disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
        <p className="text-[13px] text-muted">
          Tổng {fmtInt(rows.filter((w) => w.recyclable && w.status === "Active").length)} loại thu gom được đang bật,{" "}
          {fmtInt(rows.filter((w) => !w.recyclable || w.status !== "Active").length)} loại khác. Giá
          cao nhất {VND(Math.max(0, ...rows.map((w) => w.price)))}/kg.
        </p>
        {flash && (
          <p role="status" className="text-[13px] font-semibold text-brand">
            {flash}
          </p>
        )}
      </div>
      {tableErr && (
        <p
          role="alert"
          className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn"
        >
          {tableErr}
        </p>
      )}

      <section>
        <h2 className="text-base font-bold text-ink">Thêm loại rác mới</h2>
        <AddForm
          onAdd={async (payload) => {
            setFlash("")
            setTableErr("")
            try {
              const res = await createWasteCategory(payload)
              setRows((rs) => [...rs, mapDtoToRow(res.data)])
              setFlash(`Đã thêm danh mục '${res.data.code}' vào cơ sở dữ liệu.`)
              return { ok: true as const }
            } catch (err) {
              if (hasLiveBackendAuth() || (err instanceof ApiError && !err.isNetworkError)) {
                return {
                  ok: false as const,
                  error:
                    err instanceof Error
                      ? err.message
                      : "Không thể thêm danh mục rác lên máy chủ.",
                }
              }
              setRows((rs) => [
                ...rs,
                {
                  id: `local-${Date.now().toString(36)}`,
                  code: payload.code,
                  name: payload.name,
                  group: "Khác",
                  standardBinColor: payload.standardBinColor,
                  description: payload.description ?? "",
                  price: 2000,
                  recyclable: payload.isRecyclable,
                  rule: payload.description ?? "",
                  prep: "Làm sạch và phân loại riêng.",
                  status: "Active",
                  isBackend: false,
                },
              ])
              setFlash("Đã thêm danh mục ở chế độ cục bộ.")
              return { ok: true as const }
            }
          }}
        />
      </section>

      <Status tone="wait">
        Thay đổi trạng thái sang Inactive sẽ ẩn danh mục khỏi dropdown mới nhưng vẫn bảo toàn
        lịch sử biên nhận (BR-SRT-04).
      </Status>
    </div>
  )
}

function AddForm({
  onAdd,
}: {
  onAdd: (payload: {
    code: string
    name: string
    description: string
    standardBinColor: string
    isRecyclable: boolean
  }) => Promise<{ ok: true } | { ok: false; error: string }>
}) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [binColor, setBinColor] = useState("Cam")
  const [rule, setRule] = useState("")
  const [isRecyclable, setIsRecyclable] = useState(true)
  const [formErr, setFormErr] = useState("")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setFormErr("")
        const rawCode = code.trim().toLowerCase()
        const cleanName = name.trim()
        const cleanBin = binColor.trim()
        const cleanRule = rule.trim()
        if (!rawCode) {
          setFormErr("Vui lòng nhập mã danh mục (chỉ gồm chữ thường, số, dấu '_').")
          return
        }
        if (rawCode.length > 50 || !/^[a-z0-9_]+$/.test(rawCode)) {
          setFormErr("Mã danh mục tối đa 50 ký tự và chỉ chứa chữ thường (a-z), số (0-9) hoặc gạch dưới (_).")
          return
        }
        if (!cleanName || cleanName.length > 100) {
          setFormErr("Vui lòng nhập tên loại rác (tối đa 100 ký tự).")
          return
        }
        if (!cleanBin || cleanBin.length > 50) {
          setFormErr("Vui lòng nhập màu thùng chuẩn (tối đa 50 ký tự).")
          return
        }
        if (!cleanRule || cleanRule.length > 1000) {
          setFormErr("Vui lòng nhập luật xử lý / mô tả loại rác (tối đa 1000 ký tự).")
          return
        }
        void onAdd({
          code: rawCode,
          name: cleanName,
          description: cleanRule,
          standardBinColor: cleanBin,
          isRecyclable,
        }).then((res) => {
          if (res.ok) {
            setCode("")
            setName("")
            setRule("")
          } else {
            setFormErr(res.error)
          }
        })
      }}
      noValidate
      className="card mt-3 grid gap-4 p-5 md:grid-cols-2 md:p-6"
    >
      <div className="md:col-span-2">
        <FormRequiredLegend />
      </div>
      <Field label="Mã danh mục (chữ thường, số, _)" required hint="Ví dụ: e_waste, tetrapak">
        <input
          className="input"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setFormErr("")
          }}
          placeholder="Ví dụ: pvc_plastic"
        />
      </Field>
      <Field label="Tên loại rác" required>
        <input
          className="input"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setFormErr("")
          }}
          placeholder="Ví dụ: Nhựa PVC ống nước"
        />
      </Field>
      <Field label="Màu thùng chuẩn" required>
        <input
          className="input"
          value={binColor}
          onChange={(e) => {
            setBinColor(e.target.value)
            setFormErr("")
          }}
          placeholder="Ví dụ: Cam, Xanh Dương, Đen..."
        />
      </Field>
      <Field label="Khả năng tái chế" required>
        <label className="flex h-11 items-center gap-2 rounded-lg border border-line-soft px-3">
          <input
            type="checkbox"
            className="size-4 accent-brand"
            checked={isRecyclable}
            onChange={(e) => setIsRecyclable(e.target.checked)}
          />
          <span className="text-sm text-ink">Có giá trị thu mua tái chế</span>
        </label>
      </Field>
      <div className="md:col-span-2">
        <Field label="Luật xử lý / Mô tả" required hint="Hiển thị cho người dân ở trang hướng dẫn phân loại.">
          <input
            className="input"
            value={rule}
            onChange={(e) => {
              setRule(e.target.value)
              setFormErr("")
            }}
            placeholder="Ống nước PVC, làm sạch bùn đất trước khi bàn giao."
          />
        </Field>
      </div>
      {formErr && (
        <div className="md:col-span-2">
          <p
            role="alert"
            className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn"
          >
            {formErr}
          </p>
        </div>
      )}
      <div className="md:col-span-2">
        <button type="submit" className="btn-primary h-11 px-6">
          Thêm vào danh mục
        </button>
      </div>
    </form>
  )
}
