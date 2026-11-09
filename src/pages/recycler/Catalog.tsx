import { useEffect, useState } from "react"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import { VND, WASTES } from "@/data/waste"
import {
  fetchRecyclerPrices,
  fetchWasteCategories,
  saveRecyclerPrices,
  type BulkPriceItemRequest,
  type WasteCategoryDto,
} from "@/lib/recyclerWorkflowApi"

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0

type Row = { id: string; on: boolean; price: number; categoryCode: string }

const WASTE_TO_CAT_CODE: Record<string, string> = {
  pet: "plastic",
  hdpe: "plastic",
  carton: "cardboard",
  "office-paper": "paper",
  paper: "paper",
  aluminum: "metal",
  alu: "metal",
  steel: "metal",
  glass: "glass",
  battery: "trash",
  circuit: "trash",
}

/** R-01 Danh mục thu mua & bảng giá.
 *
 *  Bảng giá đặt ở đây và giá ở `/waste` (tra cứu của người dân) là hai con số
 *  khác nhau có chủ ý: giá hệ thống là mức trần tham khảo để người dân biết
 *  mình bán được bao nhiêu, giá ở đây là giá cơ sở thật sự trả. Người dùng
 *  luôn thấy con số hệ thống nên không bị bất ngờ. */
export default function Catalog() {
  const [rows, setRows] = useState<Row[]>(() =>
    WASTES.filter((w) => w.recyclable).map((w) => ({
      id: w.id,
      on: true,
      price: w.price,
      categoryCode: WASTE_TO_CAT_CODE[w.id] || "plastic",
    })),
  )
  const [categories, setCategories] = useState<WasteCategoryDto[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const [catsRes, pricesRes] = await Promise.all([
        fetchWasteCategories(),
        fetchRecyclerPrices(),
      ])
      if (!active) return

      if (catsRes.items.length > 0) {
        setCategories(catsRes.items)
      }

      if (pricesRes.items.length > 0) {
        setRows((prev) =>
          prev.map((r) => {
            const matched = pricesRes.items.find(
              (p) =>
                p.wasteCategoryCode.toLowerCase() === r.categoryCode.toLowerCase() ||
                p.wasteCategoryName.toLowerCase().includes(r.categoryCode.toLowerCase()),
            )
            if (matched) {
              return {
                ...r,
                on: matched.isActive,
                price: matched.pricePerKg > 0 ? matched.pricePerKg : r.price,
              }
            }
            return r
          }),
        )
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const set = (id: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Nhóm theo nhóm phế liệu backend để gửi BulkSavePricesRequest
      const catCodeToCategory = new Map<string, WasteCategoryDto>()
      for (const c of categories) {
        catCodeToCategory.set(c.code.toLowerCase(), c)
      }

      // Mỗi loại phế liệu hệ thống lấy giá đại diện từ các dòng đang bật
      const payloadMap = new Map<string, BulkPriceItemRequest>()
      for (const r of rows) {
        const cat = catCodeToCategory.get(r.categoryCode.toLowerCase())
        const catId = cat ? cat.id : r.categoryCode
        if (!payloadMap.has(catId) || r.on) {
          payloadMap.set(catId, {
            wasteCategoryId: catId,
            isActive: r.on,
            pricePerKg: r.price,
            minQuantityKg: 1,
            collectionConditions: r.on ? "Thu gom trực tiếp hoặc tại vựa" : "Tạm ngưng",
          })
        }
      }

      const res = await saveRecyclerPrices(Array.from(payloadMap.values()))
      setDirty(false)
      setFlash(
        res.syncedWithBackend
          ? "Đã lưu và công bố bảng giá thành công lên hệ thống (đã cập nhật PostgreSQL)."
          : "Đã lưu bảng giá tạm thời (chế độ dự phòng ngoại tuyến).",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="THU MUA"
        title="Danh mục và bảng giá"
        body="Chọn loại rác bạn thu mua và đặt giá trả cho người dân. Loại tắt sẽ không hiện trên bản đồ và người dân không đặt được."
        action={
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void handleSave()}
            className="btn-primary h-11 shrink-0 px-5"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        }
      />

      {flash && (
        <div className="rounded-xl border border-brand/30 bg-mint/15 px-4 py-3 text-sm font-medium text-brand-deep">
          {flash}
        </div>
      )}

      <Table head={["Loại rác", "Nhóm", "Thu mua", "Giá bạn trả", "Giá hệ thống"]}>
        {rows.map((r) => {
          const w = WASTES.find((x) => x.id === r.id)!
          return (
            <tr key={r.id}>
              <Td className="font-semibold text-ink">{w.name}</Td>
              <Td>{w.group}</Td>
              <Td>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    checked={r.on}
                    onChange={(e) => set(r.id, { on: e.target.checked })}
                  />
                  <span className="text-[13px] text-body">
                    {r.on ? "Có" : "Không"}
                  </span>
                </label>
              </Td>
              <Td>
                <input
                  className="input h-9 w-32 tabular-nums"
                  type="number"
                  min={0}
                  step={100}
                  disabled={!r.on}
                  value={r.price}
                  onChange={(e) => set(r.id, { price: Number(e.target.value) })}
                  aria-label={`Giá thu mua ${w.name}`}
                />
              </Td>
              <Td className="tabular-nums text-muted">{VND(priceOf(r.id))}</Td>
            </tr>
          )
        })}
      </Table>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Giá hệ thống là mức trần EcoLink hiển thị cho người dân. Không đặt cao
        hơn mức đó — yêu cầu sẽ bị từ chối khi đối soát dòng tiền.
      </p>

      <Status tone="wait">
        Đổi bảng giá chỉ áp dụng cho yêu cầu tạo sau đây, không đổi giá của các
        yêu cầu đã chốt.
      </Status>
    </div>
  )
}
