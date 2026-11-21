import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { CardListSkeleton, PageHead } from "@/components/Portal"
import { initApiLoading, initApiState } from "@/lib/hydration"
import {
  DEFAULT_PLATFORM_POLICIES,
  POLICY_CATEGORY_META,
  fetchPublicPolicies,
  type PlatformPolicyCategory,
  type PlatformPolicySectionDto,
} from "@/lib/policyApi"

const FILTER_OPTIONS: { key: "ALL" | PlatformPolicyCategory; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "TERMS", label: "Điều khoản dịch vụ" },
  { key: "ENVIRONMENT", label: "Chính sách môi trường" },
  { key: "PRIVACY", label: "Quyền riêng tư" },
]

function normalizeCategoryParam(raw: string | null): "ALL" | PlatformPolicyCategory {
  const upper = (raw ?? "").trim().toUpperCase()
  if (upper === "TERMS" || upper === "ENVIRONMENT" || upper === "PRIVACY") {
    return upper
  }
  return "ALL"
}

export default function Terms() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | PlatformPolicyCategory>(() =>
    normalizeCategoryParam(searchParams.get("category")),
  )
  const [sections, setSections] = useState<PlatformPolicySectionDto[]>(() =>
    initApiState([], DEFAULT_PLATFORM_POLICIES),
  )
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [syncedFromApi, setSyncedFromApi] = useState(false)

  useEffect(() => {
    setCategoryFilter(normalizeCategoryParam(searchParams.get("category")))
  }, [searchParams])

  useEffect(() => {
    const controller = new AbortController()
    fetchPublicPolicies(undefined, controller.signal)
      .then((list) => {
        if (list.length > 0) {
          setSections(list)
          setSyncedFromApi(true)
        } else {
          setSections(DEFAULT_PLATFORM_POLICIES)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSections((prev) => (prev.length > 0 ? prev : DEFAULT_PLATFORM_POLICIES))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const visibleSections =
    categoryFilter === "ALL"
      ? sections
      : sections.filter((sec) => sec.category.toUpperCase() === categoryFilter)

  const latestUpdateIso = sections
    .map((sec) => sec.updatedAt || sec.createdAt)
    .filter(Boolean)
    .sort()
    .at(-1)

  const handleSelectCategory = (key: "ALL" | PlatformPolicyCategory) => {
    setCategoryFilter(key)
    const next = new URLSearchParams(searchParams)
    if (key === "ALL") {
      next.delete("category")
    } else {
      next.set("category", key)
    }
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="page flex flex-col gap-6 py-8">
      <PageHead
        eyebrow="ĐIỀU KHOẢN & QUY ĐỊNH"
        title="Điều khoản dịch vụ và chính sách môi trường"
        body="Quy chuẩn hoạt động, quyền lợi của người dân và cơ sở thu gom, cùng cam kết minh bạch trong chuỗi giá trị thu gom tuần hoàn tại EcoLink."
        action={
          syncedFromApi ? (
            <span className="chip bg-surface-2 text-body">
              <i className="size-1.5 rounded-full bg-brand" />
              Đã đồng bộ hệ thống
            </span>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => {
            const active = categoryFilter === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                aria-pressed={active}
                onClick={() => handleSelectCategory(opt.key)}
                className={`rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                  active
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-body hover:bg-surface-2"
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        {latestUpdateIso && (
          <p className="text-xs text-muted">
            Cập nhật gần nhất:{" "}
            <span className="font-medium text-body">
              {new Date(latestUpdateIso).toLocaleDateString("vi-VN")}
            </span>
          </p>
        )}
      </div>

      {loading && sections.length === 0 ? (
        <CardListSkeleton count={4} />
      ) : visibleSections.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Chưa có mục điều khoản nào đang công khai trong nhóm này.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {visibleSections.map((sec) => {
            const catMeta =
              POLICY_CATEGORY_META[sec.category.toUpperCase() as PlatformPolicyCategory] ??
              POLICY_CATEGORY_META.TERMS
            return (
              <article key={sec.id} className="card flex flex-col gap-3 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${catMeta.badgeClass}`}
                  >
                    {catMeta.label}
                  </span>
                  <span className="text-[11px] font-medium text-muted">{sec.code}</span>
                </div>
                <h2 className="text-base font-bold text-ink">{sec.title}</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-body">
                  {sec.content}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
