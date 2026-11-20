import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { PageHead, Empty, Field } from "@/components/Portal"
import { WASTE_GROUPS, WASTES, VND, type Waste as WasteItem } from "@/data/waste"
import {
  fetchSortingRules,
  getCategoryMeta,
  parsePreparationSteps,
} from "@/lib/wasteScanApi"
import { isDiscoverableCategory } from "@/lib/recyclerDiscoveryApi"

interface ExtendedWasteItem extends WasteItem {
  binColor?: string
  categoryCode?: string
}

const WASTE_TO_API_CATEGORY: Record<string, string> = {
  pet: "plastic",
  hdpe: "plastic",
  carton: "cardboard",
  "office-paper": "paper",
  steel: "metal",
  aluminum: "metal",
  glass: "glass",
  organic: "trash",
}

/** U-03 Tìm kiếm & xem chi tiết loại rác — bổ sung đồng bộ từ Rule Engine API
 *  và nối thẳng sang tìm cơ sở thu mua trên bản đồ `/map?category=...`. */
export default function Waste() {
  const [q, setQ] = useState("")
  const [group, setGroup] = useState<string>(WASTE_GROUPS[0])
  const [only, setOnly] = useState<"all" | "yes">("all")
  const [items, setItems] = useState<ExtendedWasteItem[]>(() =>
    WASTES.map((w) => ({
      ...w,
      categoryCode: WASTE_TO_API_CATEGORY[w.id],
    })),
  )

  useEffect(() => {
    const controller = new AbortController()
    fetchSortingRules(controller.signal)
      .then((rules) => {
        if (rules.length === 0) return
        const byCode = new Map(
          rules.map((r) => [r.categoryCode.toLowerCase(), r] as const),
        )
        setItems(
          WASTES.map((w) => {
            const code = WASTE_TO_API_CATEGORY[w.id]
            const rule = code ? byCode.get(code) : undefined
            if (!rule) return { ...w, categoryCode: code }
            const steps = parsePreparationSteps(rule.preparationSteps)
            return {
              ...w,
              categoryCode: code,
              binColor: rule.standardBinColor,
              rule: rule.handlingAction || w.rule,
              prep: steps.length > 0 ? steps.join(" • ") : w.prep,
              group: getCategoryMeta(code).group,
            }
          }),
        )
      })
      .catch(() => {
        // Giữ dữ liệu tĩnh khi chạy offline
      })
    return () => controller.abort()
  }, [])

  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    return items.filter((w) => {
      const hitQ =
        !k ||
        w.name.toLowerCase().includes(k) ||
        w.rule.toLowerCase().includes(k) ||
        w.prep.toLowerCase().includes(k)
      const hitG = group === WASTE_GROUPS[0] || w.group === group
      const hitR = only === "all" || w.recyclable === (only === "yes")
      return hitQ && hitG && hitR
    })
  }, [items, q, group, only])

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="TRA CỨU"
        title="Loại rác và cách xử lý"
        body="Giá tham khảo và cách chuẩn bị cho từng loại từ Rule Engine. Số tiền thực tế chốt khi bàn giao, theo khối lượng cơ sở thu mua cân."
      />

      <div className="card flex flex-col gap-4 p-4 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <Field label="Tìm theo tên loại rác">
            <input
              className="input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ví dụ: chai nhựa, carton, lon nhôm"
            />
          </Field>
        </div>
        <div className="md:w-52">
          <Field label="Nhóm vật liệu">
            <select
              className="input"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              {WASTE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 pb-3 text-[13px] text-body md:pb-0">
          <input
            type="checkbox"
            className="size-4 accent-brand"
            checked={only === "yes"}
            onChange={(e) => setOnly(e.target.checked ? "yes" : "all")}
          />
          Chỉ loại thu gom được
        </label>
      </div>

      {list.length === 0 ? (
        <Empty>
          Không có loại rác nào khớp bộ lọc. Bạn có thể chụp ảnh để AI nhận diện
          giúp.
        </Empty>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.map((w) => (
            <li key={w.id} className="card flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base leading-6 font-bold text-ink">{w.name}</h2>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {w.group}
                    {w.binColor ? ` · Thùng màu ${w.binColor}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-body">
                  {w.recyclable ? "Thu gom được" : "Không thu gom"}
                </span>
              </div>

              <p className="text-[13px] leading-5 text-body">{w.rule}</p>

              <p className="rounded-lg border border-line-soft bg-surface-2 px-3 py-2 text-[13px] leading-5 text-ink">
                <b>Chuẩn bị:</b> {w.prep}
              </p>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className="text-sm font-bold tabular-nums text-brand">
                  {w.recyclable ? `${VND(w.price)} / kg` : "Không thu gom trong hệ thống"}
                </p>
                {w.recyclable && isDiscoverableCategory(w.categoryCode) && (
                  <Link
                    to={`/map?category=${encodeURIComponent(w.categoryCode)}`}
                    className="text-xs font-semibold text-brand-deep hover:underline"
                  >
                    Tìm nơi thu mua →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
