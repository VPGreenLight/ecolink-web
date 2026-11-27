import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { CardListSkeleton, Empty, Field, PageHead } from "@/components/Portal"
import { WASTE_GROUPS, WASTES, VND, type Waste as WasteItem } from "@/data/waste"
import { initApiLoading, initApiState } from "@/lib/hydration"
import {
  fetchSortingRules,
  fetchWasteCategories,
  getCategoryMeta,
  parsePreparationSteps,
  type WasteSortingGuideDto,
} from "@/lib/wasteScanApi"
import { isDiscoverableCategory } from "@/lib/recyclerDiscoveryApi"
import { hasLiveBackendAuth } from "@/lib/session"

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
  battery: "battery",
  ewaste: "battery",
  organic: "biological",
  clothes: "clothes",
  shoes: "shoes",
  trash: "trash",
}

const SEED_ITEMS: ExtendedWasteItem[] = WASTES.map((w) => ({
  ...w,
  categoryCode: WASTE_TO_API_CATEGORY[w.id],
}))

/** U-03 Tìm kiếm & xem chi tiết loại rác — bổ sung đồng bộ từ Rule Engine API
 *  và nối thẳng sang tìm cơ sở thu mua trên bản đồ `/map?category=...`. */
export default function Waste() {
  const [q, setQ] = useState("")
  const [group, setGroup] = useState<string>(WASTE_GROUPS[0])
  const [only, setOnly] = useState<"all" | "yes">("all")
  const [items, setItems] = useState<ExtendedWasteItem[]>(() => initApiState([], SEED_ITEMS))
  const [loading, setLoading] = useState(() => initApiLoading(true))

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetchSortingRules(controller.signal).catch(() => [] as WasteSortingGuideDto[]),
      fetchWasteCategories({ includeNonRecyclable: true }),
    ])
      .then(([rules, categories]) => {
        if (controller.signal.aborted) return
        const byCode = new Map(
          rules.map((r) => [r.categoryCode.toLowerCase(), r] as const),
        )
        const activeCategories = categories.filter((c) => (c.status ?? "Active") === "Active")
        const activeByCode = new Map(
          activeCategories.map((c) => [c.code.toLowerCase(), c] as const),
        )

        const mappedStatic = WASTES.map((w): ExtendedWasteItem | null => {
          const code = WASTE_TO_API_CATEGORY[w.id]
          if (!code) return null
          const cat = activeByCode.get(code)
          const rule = byCode.get(code)
          if (!cat && !rule) return null
          const steps = rule ? parsePreparationSteps(rule.preparationSteps) : []
          return {
            ...w,
            categoryCode: code,
            recyclable: cat ? Boolean(cat.isRecyclable) : w.recyclable,
            binColor: rule?.standardBinColor || cat?.standardBinColor,
            rule: rule?.handlingAction || cat?.description || w.rule,
            prep: steps.length > 0 ? steps.join(" • ") : w.prep,
            group: getCategoryMeta(code).group,
          }
        }).filter((item): item is ExtendedWasteItem => item !== null)

        const coveredCodes = new Set(Object.values(WASTE_TO_API_CATEGORY))
        const dynamicExtras: ExtendedWasteItem[] = activeCategories
          .filter((cat) => !coveredCodes.has(cat.code.toLowerCase()))
          .map((cat) => {
            const rule = byCode.get(cat.code.toLowerCase())
            const steps = rule ? parsePreparationSteps(rule.preparationSteps) : []
            return {
              id: cat.code,
              name: cat.name,
              group: "Khác" as WasteItem["group"],
              price: 0,
              recyclable: Boolean(cat.isRecyclable),
              categoryCode: cat.code,
              binColor: rule?.standardBinColor || cat.standardBinColor,
              rule:
                rule?.handlingAction ||
                cat.description ||
                "Phân loại riêng theo quy chuẩn EcoLink.",
              prep:
                steps.length > 0
                  ? steps.join(" • ")
                  : "Làm sạch cơ bản và để khô ráo trước khi bàn giao.",
            }
          })

        setItems([...mappedStatic, ...dynamicExtras])
      })
      .catch(() => {
        if (!controller.signal.aborted && !hasLiveBackendAuth()) {
          setItems(SEED_ITEMS)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const groupOptions = useMemo(() => {
    const hasExtraGroup = items.some(
      (w) => !WASTE_GROUPS.includes(w.group as (typeof WASTE_GROUPS)[number]),
    )
    return hasExtraGroup ? [...WASTE_GROUPS, "Khác"] : [...WASTE_GROUPS]
  }, [items])

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
              {groupOptions.map((g) => (
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

      {loading ? (
        <CardListSkeleton count={4} />
      ) : list.length === 0 ? (
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
                  {w.recyclable
                    ? w.price > 0
                      ? `${VND(w.price)} / kg`
                      : "Theo bảng giá cơ sở thu mua"
                    : "Không thu gom trong hệ thống"}
                </p>
                {w.recyclable && isDiscoverableCategory(w.categoryCode) ? (
                  <Link
                    to={`/map?category=${encodeURIComponent(w.categoryCode)}`}
                    className="text-xs font-semibold text-brand-deep hover:underline"
                  >
                    Tìm nơi thu mua →
                  </Link>
                ) : w.recyclable ? (
                  <Link
                    to={`/chat?waste=${encodeURIComponent(w.categoryCode ?? w.id)}&newHandover=1`}
                    className="text-xs font-semibold text-brand-deep hover:underline"
                  >
                    Đặt lịch thu gom →
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
