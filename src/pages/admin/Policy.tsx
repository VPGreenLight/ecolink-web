import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import PlatformPoliciesTab from "@/components/admin/PlatformPoliciesTab"
import { Empty, Field, FormRequiredLegend, PageHead, Status, TableSkeleton } from "@/components/admin/ui"
import { GAMIFICATION } from "@/data/ops"
import { WASTES } from "@/data/waste"
import { initApiLoading, initApiState } from "@/lib/hydration"
import {
  fetchDetailedSortingRules,
  fetchWasteCategories,
  publishSortingRule,
  upsertSortingRule,
  type SortingRuleDetailDto,
  type WasteCategoryItemDto,
} from "@/lib/wasteScanApi"

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000"

const REGION_OPTIONS = [
  { value: "VN_NATIONAL", label: "Toàn quốc (VN_NATIONAL)" },
  { value: "VN_NORTH", label: "Miền Bắc (VN_NORTH)" },
  { value: "VN_CENTRAL", label: "Miền Trung (VN_CENTRAL)" },
  { value: "VN_SOUTH", label: "Miền Nam (VN_SOUTH)" },
] as const

type PolicyRuleRow = {
  id: string
  ruleId?: string
  wasteCategoryId?: string
  categoryCode: string
  name: string
  categoryStatus: string
  standardBinColor: string
  title: string
  sortingInstruction: string
  preparationSteps: string
  handlingAction: string
  hazardWarning: string
  applicableRegion: string
  status: string
  hasRule: boolean
  isBackend: boolean
  updatedAt?: string | null
}

function mapDetailToRow(d: SortingRuleDetailDto): PolicyRuleRow {
  const hasRealRule = Boolean(d.ruleId && d.ruleId !== EMPTY_GUID)
  return {
    id: hasRealRule ? d.ruleId : `cat-${d.wasteCategoryId}`,
    ruleId: hasRealRule ? d.ruleId : undefined,
    wasteCategoryId: d.wasteCategoryId,
    categoryCode: d.categoryCode,
    name: d.categoryName,
    categoryStatus: d.categoryStatus || "Active",
    standardBinColor: d.standardBinColor,
    title: d.title,
    sortingInstruction: d.sortingInstruction,
    preparationSteps: d.preparationSteps,
    handlingAction: d.handlingAction,
    hazardWarning: d.hazardWarning ?? "",
    applicableRegion: d.applicableRegion || "VN_NATIONAL",
    status: d.status || "DRAFT",
    hasRule: hasRealRule,
    isBackend: true,
    updatedAt: d.updatedAt ?? d.createdAt,
  }
}

function mapCategoryFallbackToRule(c: WasteCategoryItemDto): PolicyRuleRow {
  return {
    id: `cat-${c.id}`,
    ruleId: undefined,
    wasteCategoryId: c.id,
    categoryCode: c.code,
    name: c.name,
    categoryStatus: c.status || "Active",
    standardBinColor: c.standardBinColor,
    title: `Hướng dẫn phân loại ${c.name}`,
    sortingInstruction:
      c.description?.trim() ||
      `Tách riêng ${c.name} khỏi các nhóm rác khác để tránh lẫn tạp chất.`,
    preparationSteps: c.isRecyclable
      ? "1. Làm sạch sơ bộ và để khô ráo trước khi phân loại.\n2. Xếp gọn để tối ưu thể tích lưu trữ."
      : "1. Buộc kín miệng túi rác.\n2. Không trộn lẫn vào nhóm phế liệu tái chế.",
    handlingAction: c.isRecyclable
      ? `Bỏ vào thùng rác màu ${c.standardBinColor} hoặc đặt lịch thu gom trên EcoLink.`
      : `Bỏ vào thùng rác màu ${c.standardBinColor} theo quy định thu gom rác sinh hoạt.`,
    hazardWarning: "",
    applicableRegion: "VN_NATIONAL",
    status: c.ruleStatus || "DRAFT",
    hasRule: Boolean(c.hasSortingRule),
    isBackend: true,
    updatedAt: c.updatedAt ?? c.createdAt ?? null,
  }
}

const FALLBACK_POLICIES: PolicyRuleRow[] = WASTES.filter((w) => w.recyclable).map((w) => ({
  id: w.id,
  categoryCode: w.id,
  name: w.name,
  categoryStatus: "Active",
  standardBinColor: "Cam",
  title: `Hướng dẫn phân loại ${w.name}`,
  sortingInstruction: w.rule,
  preparationSteps: w.prep,
  handlingAction: "Gửi tới đối tác thu mua trên bản đồ EcoLink.",
  hazardWarning: "",
  applicableRegion: "VN_NATIONAL",
  status: "ACTIVE",
  hasRule: true,
  isBackend: false,
}))

type AdminPolicyTab = "rules" | "terms"

/** A-06 Thiết lập chính sách phân loại (Rule Engine) & Quản trị Điều khoản nền tảng (/terms). */
export default function Policy() {
  const [activeTab, setActiveTab] = useState<AdminPolicyTab>("rules")
  const [rules, setRules] = useState<PolicyRuleRow[]>(() =>
    initApiState([], FALLBACK_POLICIES),
  )
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [ruleSearch, setRuleSearch] = useState("")
  const [ruleStatusFilter, setRuleStatusFilter] = useState<"ALL" | "ACTIVE" | "DRAFT" | "UNCONFIGURED">("ALL")
  const [flash, setFlash] = useState("")
  const [errMsg, setErrMsg] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      fetchDetailedSortingRules(true),
      fetchWasteCategories({ includeInactive: true, includeNonRecyclable: true }).catch(() => []),
    ])
      .then(([detailList, categoryList]) => {
        if (!active) return

        const merged = detailList.map(mapDetailToRow)
        const existingCatIds = new Set(
          merged.map((r) => r.wasteCategoryId).filter((v): v is string => Boolean(v)),
        )
        const existingCodes = new Set(merged.map((r) => r.categoryCode.toLowerCase()))

        for (const cat of categoryList) {
          if (!existingCatIds.has(cat.id) && !existingCodes.has(cat.code.toLowerCase())) {
            merged.push(mapCategoryFallbackToRule(cat))
          }
        }

        if (merged.length > 0) {
          setRules(merged.sort((a, b) => a.categoryCode.localeCompare(b.categoryCode)))
        }
      })
      .catch(() => {
        // Fallback giữ nguyên UI khi chưa kết nối Admin hoặc offline
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const set = (id: string, patch: Partial<PolicyRuleRow>) =>
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const buildRulePayload = (r: PolicyRuleRow) => ({
    title: r.title,
    preparationSteps: r.preparationSteps,
    sortingInstruction: r.sortingInstruction,
    handlingAction: r.handlingAction,
    hazardWarning: r.hazardWarning || null,
    applicableRegion: r.applicableRegion || "VN_NATIONAL",
  })

  const handleSaveRule = async (r: PolicyRuleRow) => {
    if (!r.isBackend || !r.wasteCategoryId) {
      setFlash("Đã lưu thay đổi cục bộ.")
      return
    }
    setBusyId(r.id)
    setFlash("")
    setErrMsg("")
    try {
      const res = await upsertSortingRule(r.wasteCategoryId, buildRulePayload(r))
      setRules((rs) => rs.map((item) => (item.id === r.id ? mapDetailToRow(res.data) : item)))
      setFlash(`Đã lưu bản nháp quy tắc '${res.data.categoryCode}'. Bấm 'Công bố & Đồng bộ AI' để kích hoạt.`)
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Không thể lưu quy tắc phân loại.")
    } finally {
      setBusyId(null)
    }
  }

  const handlePublishRule = async (r: PolicyRuleRow) => {
    if (!r.isBackend || !r.wasteCategoryId) {
      setFlash("Chỉ hỗ trợ công bố quy tắc khi đã kết nối máy chủ Admin.")
      return
    }
    setBusyId(r.id)
    setFlash("")
    setErrMsg("")
    try {
      let targetRuleId = r.ruleId && r.ruleId !== EMPTY_GUID ? r.ruleId : ""
      if (!targetRuleId) {
        const saved = await upsertSortingRule(r.wasteCategoryId, buildRulePayload(r))
        targetRuleId = saved.data.ruleId
      }
      if (!targetRuleId || targetRuleId === EMPTY_GUID) {
        throw new Error("Không lấy được mã quy tắc sau khi lưu bản nháp.")
      }
      const res = await publishSortingRule(targetRuleId)
      setRules((rs) =>
        rs.map((item) => (item.id === r.id ? mapDetailToRow(res.data.rule) : item)),
      )
      setFlash(
        res.data.aiServiceSynced
          ? `Đã phát hành quy tắc '${res.data.rule.categoryCode}' & đồng bộ AI Service thành công.`
          : `Đã phát hành quy tắc '${res.data.rule.categoryCode}' trên Core DB (AI sync: ${res.data.aiSyncMessage ?? "tạm hoãn"}).`,
      )
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Không thể phát hành quy tắc.")
    } finally {
      setBusyId(null)
    }
  }

  const handleSaveAll = async () => {
    const backendRules = rules.filter((r) => r.isBackend && r.wasteCategoryId)
    if (backendRules.length === 0) {
      setFlash("Đã lưu. Hướng dẫn phân loại và kết quả AI hiện câu mới ngay.")
      return
    }
    setBusyId("ALL")
    setFlash("")
    setErrMsg("")
    try {
      const saved = await Promise.all(
        backendRules.map((r) => upsertSortingRule(r.wasteCategoryId!, buildRulePayload(r))),
      )
      const mapByCat = new Map(saved.map((res) => [res.data.wasteCategoryId, mapDetailToRow(res.data)]))
      setRules((prev) => prev.map((item) => mapByCat.get(item.wasteCategoryId ?? "") ?? item))
      setFlash("Đã lưu đồng loạt các quy tắc ở trạng thái DRAFT. Chọn từng thẻ để công bố.")
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Lưu danh sách chính sách thất bại.")
    } finally {
      setBusyId(null)
    }
  }

  const filteredRules = rules.filter((r) => {
    if (ruleStatusFilter === "ACTIVE" && r.status !== "ACTIVE") return false
    if (ruleStatusFilter === "DRAFT" && (!r.hasRule || r.status === "ACTIVE")) return false
    if (ruleStatusFilter === "UNCONFIGURED" && r.hasRule) return false
    if (ruleSearch.trim()) {
      const q = ruleSearch.trim().toLowerCase()
      return (
        r.name.toLowerCase().includes(q) ||
        r.categoryCode.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="CẤU HÌNH"
        title="Chính sách phân loại rác"
        body="Quản lý quy tắc phân loại từng danh mục rác (đồng bộ từ Danh mục rác hệ thống) và nội dung Điều khoản dịch vụ / Chính sách môi trường công khai."
      />

      <div className="flex flex-wrap gap-2 border-b border-line-soft pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("rules")}
          aria-pressed={activeTab === "rules"}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "rules"
              ? "bg-brand text-white"
              : "bg-surface-2 text-body hover:text-ink"
          }`}
        >
          Quy tắc phân loại rác &amp; AI ({rules.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("terms")}
          aria-pressed={activeTab === "terms"}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "terms"
              ? "bg-brand text-white"
              : "bg-surface-2 text-body hover:text-ink"
          }`}
        >
          Điều khoản &amp; Chính sách nền tảng (/terms)
        </button>
      </div>

      {activeTab === "terms" ? (
        <PlatformPoliciesTab />
      ) : (
        <>
          <FormRequiredLegend />

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-[240px] flex-1">
              <Field label="Tìm theo tên hoặc mã danh mục">
                <input
                  className="input"
                  value={ruleSearch}
                  onChange={(e) => setRuleSearch(e.target.value)}
                  placeholder="Tìm plastic, pvc, thủy tinh..."
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["ALL", "Tất cả"],
                  ["ACTIVE", "Đang áp dụng (ACTIVE)"],
                  ["DRAFT", "Bản nháp (DRAFT)"],
                  ["UNCONFIGURED", "Chưa thiết lập"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRuleStatusFilter(key)}
                  aria-pressed={ruleStatusFilter === key}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    ruleStatusFilter === key
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface text-body hover:bg-surface-2"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={4} />
          ) : filteredRules.length === 0 ? (
            <Empty>
              Không có quy tắc phân loại nào phù hợp. Nếu bạn vừa thêm danh mục mới ở{" "}
              <Link to="/admin/categories" className="font-semibold text-brand underline">
                Danh mục rác
              </Link>
              , hãy chuyển bộ lọc về &ldquo;Tất cả&rdquo;.
            </Empty>
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {filteredRules.map((r) => (
                <li key={r.id} className="card flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold text-ink">{r.name}</p>
                      <p className="text-xs text-muted">
                        Mã: {r.categoryCode} · Thùng {r.standardBinColor} · {r.applicableRegion}
                      </p>
                      {r.categoryStatus.toLowerCase() === "inactive" && (
                        <p className="mt-1 text-[11px] font-semibold text-warn">
                          Danh mục gốc đang tạm ngưng (Inactive)
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          !r.hasRule
                            ? "bg-surface-2 text-muted"
                            : r.status === "ACTIVE"
                              ? "bg-brand/10 text-brand-deep"
                              : "bg-warn/15 text-warn"
                        }`}
                      >
                        {!r.hasRule ? "CHƯA THIẾT LẬP" : r.status}
                      </span>
                      {r.updatedAt && (
                        <span className="text-[11px] text-muted">
                          {new Date(r.updatedAt).toLocaleDateString("vi-VN")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Field label="Tiêu đề quy tắc" required>
                    <input
                      className="input"
                      value={r.title}
                      onChange={(e) => set(r.id, { title: e.target.value })}
                    />
                  </Field>
                  <Field label="Khu vực áp dụng" required>
                    <select
                      className="input"
                      value={r.applicableRegion}
                      onChange={(e) => set(r.id, { applicableRegion: e.target.value })}
                    >
                      {REGION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                      {!REGION_OPTIONS.some((o) => o.value === r.applicableRegion) && (
                        <option value={r.applicableRegion}>{r.applicableRegion}</option>
                      )}
                    </select>
                  </Field>
                  <Field label="Câu luật phân loại hiện cho người dân" required>
                    <input
                      className="input"
                      value={r.sortingInstruction}
                      onChange={(e) => set(r.id, { sortingInstruction: e.target.value })}
                    />
                  </Field>
                  <Field label="Hướng dẫn chuẩn bị & sơ chế" required>
                    <textarea
                      className="input h-auto resize-y py-3 leading-6"
                      rows={2}
                      value={r.preparationSteps}
                      onChange={(e) => set(r.id, { preparationSteps: e.target.value })}
                    />
                  </Field>
                  <Field label="Hành động xử lý đề xuất" required>
                    <input
                      className="input"
                      value={r.handlingAction}
                      onChange={(e) => set(r.id, { handlingAction: e.target.value })}
                    />
                  </Field>
                  <Field label="Cảnh báo an toàn (nếu có)">
                    <input
                      className="input"
                      value={r.hazardWarning}
                      onChange={(e) => set(r.id, { hazardWarning: e.target.value })}
                    />
                  </Field>
                  {r.isBackend && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void handleSaveRule(r)}
                        className="btn-outline h-9 px-3.5 text-xs font-semibold"
                      >
                        Lưu bản nháp
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void handlePublishRule(r)}
                        className="btn-primary h-9 px-3.5 text-xs font-semibold"
                      >
                        Công bố &amp; Đồng bộ AI
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void handleSaveAll()}
              disabled={busyId === "ALL"}
              className="btn-primary h-11 px-6 disabled:opacity-60"
            >
              Lưu chính sách
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

          <section className="card flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-ink">
                Điểm thưởng theo khối lượng
              </h2>
              <Link
                to="/admin/gamification"
                className="text-xs font-semibold text-brand underline underline-offset-4"
              >
                Cấu hình điểm chi tiết →
              </Link>
            </div>
            <p className="text-sm leading-6 text-body">
              Người dùng nhận{" "}
              <b className="tabular-nums text-ink">{GAMIFICATION.pointsPerKg}</b> điểm
              xanh cho mỗi kg bàn giao đúng loại đã thẩm định. Đây là con số dùng
              chung với bảng xếp hạng và đổi thưởng — đổi ở đây thì cả hai nơi đổi
              theo.
            </p>
            <Status tone="wait">
              Khi lưu chính sách mới, Rule sẽ ở trạng thái DRAFT; bấm &ldquo;Công bố &amp; Đồng bộ AI&rdquo; để
              kích hoạt chính thức sang AI Service (BR-SRT-03).
            </Status>
          </section>
        </>
      )}
    </div>
  )
}
