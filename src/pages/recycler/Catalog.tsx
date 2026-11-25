import { useEffect, useState } from "react"
import PaginationBar, { FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import { PageHead, Status, Table, TableSkeleton, Td } from "@/components/Portal"
import SearchFilterBar from "@/components/SearchFilterBar"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { ApiError } from "@/lib/api"
import { initApiLoading, initApiState } from "@/lib/hydration"
import { hasLiveBackendAuth } from "@/lib/session"
import {
  fetchRecyclerPrices,
  fetchWasteCategories,
  saveRecyclerPrices,
  type BulkPriceItemRequest,
} from "@/lib/recyclerWorkflowApi"

type CatalogRow = {
  wasteCategoryId: string
  code: string
  name: string
  standardBinColor: string
  on: boolean
  price: number
  minQuantityKg: number
  collectionConditions: string
  hasExistingRecord: boolean
}

const SUGGESTED_PRICE_BY_CODE: Record<string, number> = {
  plastic: 7000,
  paper: 4500,
  cardboard: 3800,
  metal: 25000,
  glass: 1800,
}

const DEFAULT_CONDITIONS = "Làm sạch cơ bản, để khô ráo trước khi cân"

const INITIAL_SEED_ROWS: CatalogRow[] = [
  {
    wasteCategoryId: "11111111-1111-1111-1111-111111111101",
    code: "plastic",
    name: "Nhựa tái chế (Plastic)",
    standardBinColor: "Cam",
    on: true,
    price: 7000,
    minQuantityKg: 1,
    collectionConditions: "Chai nhựa PET/HDPE đã tráng sạch, bẹp chai",
    hasExistingRecord: true,
  },
  {
    wasteCategoryId: "11111111-1111-1111-1111-111111111102",
    code: "paper",
    name: "Giấy báo & Tài liệu (Paper)",
    standardBinColor: "Xanh dương",
    on: true,
    price: 4500,
    minQuantityKg: 2,
    collectionConditions: "Giấy báo, tài liệu khô ráo, không dính dầu mỡ",
    hasExistingRecord: true,
  },
  {
    wasteCategoryId: "11111111-1111-1111-1111-111111111103",
    code: "cardboard",
    name: "Bìa Carton (Cardboard)",
    standardBinColor: "Nâu vàng",
    on: true,
    price: 3800,
    minQuantityKg: 3,
    collectionConditions: "Thùng carton gập phẳng, khô ráo",
    hasExistingRecord: true,
  },
  {
    wasteCategoryId: "11111111-1111-1111-1111-111111111104",
    code: "metal",
    name: "Kim loại & Vỏ lon (Metal)",
    standardBinColor: "Xám kim loại",
    on: true,
    price: 25000,
    minQuantityKg: 0.5,
    collectionConditions: "Vỏ lon nhôm, sắt vụn đã dốc sạch nước",
    hasExistingRecord: true,
  },
  {
    wasteCategoryId: "11111111-1111-1111-1111-111111111105",
    code: "glass",
    name: "Thủy tinh (Glass)",
    standardBinColor: "Trắng",
    on: true,
    price: 1800,
    minQuantityKg: 2,
    collectionConditions: "Chai lọ nguyên vẹn, đã đổ sạch chất lỏng",
    hasExistingRecord: true,
  },
]

function suggestedPriceFor(code: string): number {
  return SUGGESTED_PRICE_BY_CODE[code.trim().toLowerCase()] ?? 4000
}

/** R-01 Danh mục thu mua & bảng giá (ánh xạ 1-1 với WasteCategory Active & IsRecyclable). */
export default function Catalog() {
  const liveAuth = hasLiveBackendAuth()
  const [rows, setRows] = useState<CatalogRow[]>(() => initApiState([], INITIAL_SEED_ROWS))
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState("")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)
  const [activeFilter, setActiveFilter] = useState<"all" | "on" | "off">("all")
  const [page, setPage] = useState(1)
  const pageSize = FIXED_PAGE_SIZE

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [catsRes, pricesRes] = await Promise.all([
          fetchWasteCategories(),
          fetchRecyclerPrices(),
        ])
        if (!active) return

        const activeRecyclableCats = catsRes.items.filter(
          (c) => (c.isRecyclable ?? true) && (c.status ?? "Active") === "Active",
        )

        const baseRows: CatalogRow[] = activeRecyclableCats.map((cat) => {
          const matched = pricesRes.items.find(
            (p) =>
              p.wasteCategoryId === cat.id ||
              p.wasteCategoryCode.toLowerCase() === cat.code.toLowerCase(),
          )
          if (matched) {
            return {
              wasteCategoryId: cat.id,
              code: cat.code,
              name: cat.name,
              standardBinColor: cat.standardBinColor ?? "Tiêu chuẩn",
              on: matched.isActive,
              price: matched.pricePerKg > 0 ? matched.pricePerKg : suggestedPriceFor(cat.code),
              minQuantityKg: matched.minQuantityKg > 0 ? matched.minQuantityKg : 1,
              collectionConditions: matched.collectionConditions ?? DEFAULT_CONDITIONS,
              hasExistingRecord: true,
            }
          }

          return {
            wasteCategoryId: cat.id,
            code: cat.code,
            name: cat.name,
            standardBinColor: cat.standardBinColor ?? "Tiêu chuẩn",
            on: !pricesRes.fromBackend && pricesRes.items.length === 0,
            price: suggestedPriceFor(cat.code),
            minQuantityKg: 1,
            collectionConditions: DEFAULT_CONDITIONS,
            hasExistingRecord: false,
          }
        })

        setRows(baseRows)
      } catch (err) {
        if (!active) return
        if (liveAuth) {
          setErrMsg(
            err instanceof ApiError
              ? err.message
              : "Không tải được bảng giá thu mua từ máy chủ.",
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [liveAuth])

  const set = (wasteCategoryId: string, patch: Partial<CatalogRow>) => {
    setRows((rs) =>
      rs.map((r) => (r.wasteCategoryId === wasteCategoryId ? { ...r, ...patch } : r)),
    )
    setDirty(true)
    setErrMsg("")
  }

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (saving) return
    setErrMsg("")
    setFlash(null)
    if (rows.length === 0) {
      setErrMsg("Hiện không có danh mục phế liệu tái chế nào đang hoạt động trên hệ thống.")
      return
    }

    const activeRows = rows.filter((r) => r.on)
    if (activeRows.length === 0 && !rows.some((r) => r.hasExistingRecord)) {
      setErrMsg("Vui lòng bật thu mua ít nhất một danh mục phế liệu trước khi lưu.")
      return
    }

    for (const r of activeRows) {
      if (!Number.isFinite(r.price) || r.price <= 0 || !Number.isInteger(r.price)) {
        setErrMsg(`Đơn giá thu mua cho "${r.name}" phải là số nguyên dương (VNĐ/kg).`)
        return
      }
      if (!Number.isFinite(r.minQuantityKg) || r.minQuantityKg <= 0) {
        setErrMsg(`Khối lượng tối thiểu cho "${r.name}" phải lớn hơn 0 kg.`)
        return
      }
      if (r.collectionConditions.trim().length > 200) {
        setErrMsg(`Điều kiện thu gom cho "${r.name}" tối đa 200 ký tự.`)
        return
      }
    }

    const rowsToPersist = rows.filter((r) => r.on || r.hasExistingRecord)
    if (rowsToPersist.length === 0) {
      setErrMsg("Vui lòng bật thu mua ít nhất một danh mục phế liệu.")
      return
    }

    setSaving(true)
    try {
      const payload: BulkPriceItemRequest[] = rowsToPersist.map((r) => ({
        wasteCategoryId: r.wasteCategoryId,
        isActive: r.on,
        pricePerKg: r.on ? r.price : Math.max(100, Math.round(r.price || 1000)),
        minQuantityKg: r.minQuantityKg > 0 ? r.minQuantityKg : 1,
        collectionConditions: r.collectionConditions.trim() || null,
      }))

      const res = await saveRecyclerPrices(payload)
      const savedMap = new Map(res.items.map((it) => [it.wasteCategoryId, it]))
      setRows((prev) =>
        prev.map((r) => {
          const hit = savedMap.get(r.wasteCategoryId)
          if (!hit) return r
          return {
            ...r,
            on: hit.isActive,
            price: hit.pricePerKg > 0 ? hit.pricePerKg : r.price,
            minQuantityKg: hit.minQuantityKg > 0 ? hit.minQuantityKg : r.minQuantityKg,
            collectionConditions: hit.collectionConditions ?? r.collectionConditions,
            hasExistingRecord: true,
          }
        }),
      )
      setDirty(false)
      setFlash(
        res.syncedWithBackend
          ? "Đã lưu và công bố bảng giá thành công lên hệ thống."
          : "Đã lưu bảng giá tạm thời (chế độ dự phòng ngoại tuyến).",
      )
    } catch (err) {
      setErrMsg(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Không thể lưu bảng giá thu mua lên hệ thống.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-6">
      <PageHead
        eyebrow="THU MUA"
        title="Danh mục và bảng giá"
        body="Mỗi dòng tương ứng trực tiếp một danh mục phế liệu tái chế đang Active trên hệ thống. Bật thu mua và đặt đơn giá, khối lượng tối thiểu cùng điều kiện nhận hàng của cơ sở."
        action={
          <button
            type="submit"
            disabled={!dirty || saving}
            className="btn-primary h-11 shrink-0 px-5"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        }
      />

      {errMsg && (
        <div
          role="alert"
          className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-3 text-sm font-medium text-warn"
        >
          {errMsg}
        </div>
      )}

      {flash && (
        <div
          role="status"
          className="rounded-xl border border-brand/30 bg-mint/15 px-4 py-3 text-sm font-medium text-brand-deep"
        >
          {flash}
        </div>
      )}

      {(() => {
        const kw = debouncedSearch.trim().toLowerCase()
        const filteredRows = rows.filter((r) => {
          if (activeFilter === "on" && !r.on) return false
          if (activeFilter === "off" && r.on) return false
          if (!kw) return true
          return `${r.name} ${r.code} ${r.collectionConditions}`
            .toLowerCase()
            .includes(kw)
        })
        const pagedRows = paginateItems(filteredRows, page, pageSize)

        return (
          <>
            <SearchFilterBar
              value={search}
              onChange={(v) => {
                setSearch(v)
                setPage(1)
              }}
              label="Tìm kiếm danh mục phế liệu"
              placeholder="Tìm theo tên danh mục, mã hoặc điều kiện thu gom..."
              totalCount={filteredRows.length}
              countLabel="danh mục"
            >
              <select
                aria-label="Lọc trạng thái thu mua"
                value={activeFilter}
                onChange={(e) => {
                  setActiveFilter(e.target.value as "all" | "on" | "off")
                  setPage(1)
                }}
                className="input h-10 text-xs"
              >
                <option value="all">Tất cả</option>
                <option value="on">Đang thu mua</option>
                <option value="off">Tạm ngưng</option>
              </select>
            </SearchFilterBar>

            {loading ? (
              <TableSkeleton rows={5} />
            ) : (
            <>
            <Table head={["Danh mục phế liệu", "Thu mua", "Đơn giá (đ/kg)", "Tối thiểu (kg)", "Điều kiện thu mua"]}>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted">
                    Không có danh mục phế liệu nào khớp bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr key={r.wasteCategoryId} className={!r.on ? "opacity-75" : undefined}>
                    <Td>
                      <p className="font-semibold text-ink">{r.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        Mã: <code>{r.code}</code> · Thùng {r.standardBinColor}
                      </p>
                    </Td>
                    <Td>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-4 accent-brand"
                          checked={r.on}
                          onChange={(e) => set(r.wasteCategoryId, { on: e.target.checked })}
                        />
                        <span className="text-[13px] text-body">
                          {r.on ? "Đang mua" : "Tạm ngưng"}
                        </span>
                      </label>
                    </Td>
                    <Td>
                      <input
                        className="input h-9 w-28 tabular-nums"
                        type="number"
                        min={100}
                        step={100}
                        disabled={!r.on}
                        value={r.price}
                        onChange={(e) =>
                          set(r.wasteCategoryId, { price: Number(e.target.value) })
                        }
                        aria-label={`Giá thu mua ${r.name}`}
                      />
                    </Td>
                    <Td>
                      <input
                        className="input h-9 w-24 tabular-nums"
                        type="number"
                        min={0.1}
                        step={0.5}
                        disabled={!r.on}
                        value={r.minQuantityKg}
                        onChange={(e) =>
                          set(r.wasteCategoryId, { minQuantityKg: Number(e.target.value) })
                        }
                        aria-label={`Khối lượng tối thiểu ${r.name}`}
                      />
                    </Td>
                    <Td>
                      <input
                        className="input h-9 min-w-[200px] text-[13px]"
                        type="text"
                        maxLength={200}
                        disabled={!r.on}
                        value={r.collectionConditions}
                        onChange={(e) =>
                          set(r.wasteCategoryId, { collectionConditions: e.target.value })
                        }
                        placeholder="Ví dụ: Khô ráo, gập phẳng..."
                        aria-label={`Điều kiện thu gom ${r.name}`}
                      />
                    </Td>
                  </tr>
                ))
              )}
            </Table>

            <PaginationBar
              page={page}
              pageSize={pageSize}
              totalCount={filteredRows.length}
              onPageChange={setPage}
              itemLabel="danh mục"
            />
            </>
            )}
          </>
        )
      })()}

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Bảng giá bạn công bố tại đây hiển thị công khai trên bản đồ tìm kiếm cơ sở thu
        mua (<code className="text-xs">/map</code>) và được áp dụng làm giá đề xuất khi
        người dân đặt lịch bàn giao.
      </p>

      <Status tone="wait">
        Đổi bảng giá chỉ áp dụng cho yêu cầu tạo mới sau thời điểm lưu, không thay đổi
        đơn giá các đơn bàn giao đã chốt.
      </Status>
    </form>
  )
}
