import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Database, Gift, Leaf, Sparkles } from "lucide-react"
import { PageHead } from "@/components/Portal"
import { ECO_FACTS, GIFTS, POSTS, STATS, DATASET, fmtInt } from "@/data/ops"
import { initApiLoading, isSsrSmokeTest } from "@/lib/hydration"
import {
  fetchAiDatasetDashboard,
  fetchStaffAiFeedbackQueue,
} from "@/lib/aiCurationApi"
import { fetchStaffBlogs } from "@/lib/blogApi"
import { fetchStaffEcoFacts, fetchStaffGifts } from "@/lib/gamificationApi"
import { fetchStaffApplications } from "@/lib/recyclerWorkflowApi"
import { fetchStaffComplaints } from "@/lib/reviewComplaintApi"
import { getSession, hasLiveBackendAuth } from "@/lib/session"

/** Tổng quan nhân viên (Staff). */
export default function StaffHome() {
  const [liveAuth] = useState(() => !isSsrSmokeTest() && hasLiveBackendAuth())
  const session = getSession()
  const can = (perm: string) => {
    if (!liveAuth) return false
    if (session?.role === "admin") return true
    if (session?.role === "staff") {
      return !Array.isArray(session.permissions) || session.permissions.includes(perm)
    }
    return false
  }
  const hasPermFilter = liveAuth && session?.role === "staff" && Array.isArray(session.permissions)

  const [loading, setLoading] = useState<boolean>(() => initApiLoading(true))
  const [pendingAiCount, setPendingAiCount] = useState<number>(liveAuth ? 0 : STATS.pending.aiCases)
  const [pendingAppCount, setPendingAppCount] = useState<number>(liveAuth ? 0 : STATS.pending.applications)
  const [openComplaintCount, setOpenComplaintCount] = useState<number>(
    liveAuth ? 0 : STATS.pending.complaints,
  )
  const [pendingBlogCount, setPendingBlogCount] = useState<number>(
    liveAuth ? 0 : STATS.pending.posts,
  )
  const [publishedBlogCount, setPublishedBlogCount] = useState<number>(
    liveAuth ? 0 : POSTS.filter((p) => p.status === "published").length,
  )
  const [activeGiftsCount, setActiveGiftsCount] = useState<number>(
    liveAuth ? 0 : GIFTS.filter((g) => g.active).length,
  )
  const [outOfStockCount, setOutOfStockCount] = useState<number>(
    liveAuth ? 0 : GIFTS.filter((g) => g.stock === 0).length,
  )
  const [activeFactsCount, setActiveFactsCount] = useState<number>(
    liveAuth ? 0 : ECO_FACTS.filter((f) => f.open).length,
  )
  const [totalFactsCount, setTotalFactsCount] = useState<number>(
    liveAuth ? 0 : ECO_FACTS.length,
  )
  const [datasetStats, setDatasetStats] = useState({
    accuracy: liveAuth ? 0 : DATASET.accuracy,
    labeled: liveAuth ? 0 : DATASET.labeled,
    total: liveAuth ? 0 : DATASET.total,
  })
  const [loadErr, setLoadErr] = useState("")

  useEffect(() => {
    if (!liveAuth) return
    let active = true
    const recordErr = (err: unknown) => {
      if (!active) return
      const msg = err instanceof Error ? err.message : "Không thể tải một số dữ liệu tổng quan."
      setLoadErr((prev) => prev || msg)
    }

    const jobs: Promise<unknown>[] = []

    if (can("REVIEW_AI")) {
      jobs.push(
        fetchStaffAiFeedbackQueue({ pageSize: 1 })
          .then((res) => {
            if (active && res.success && res.data) {
              setPendingAiCount(res.data.pendingCount)
            }
          })
          .catch(recordErr),
      )
    }

    if (can("CURATE_DATASET")) {
      jobs.push(
        fetchAiDatasetDashboard()
          .then((res) => {
            if (active && res.success && res.data?.summary) {
              setDatasetStats({
                accuracy: res.data.summary.empiricalAccuracyPercent,
                labeled: res.data.summary.verifiedLabeledCount,
                total: res.data.summary.totalPoolItems,
              })
            }
          })
          .catch(recordErr),
      )
    }

    if (can("VERIFY_RECYCLER")) {
      jobs.push(
        fetchStaffApplications()
          .then((res) => {
            if (active) {
              setPendingAppCount(res.items.filter((a) => a.status === "pending").length)
            }
          })
          .catch(recordErr),
      )
    }

    if (can("HANDLE_COMPLAINT")) {
      jobs.push(
        fetchStaffComplaints({ pageSize: 1, includeReportedReviews: false })
          .then((res) => {
            if (active && res.success && res.data) {
              setOpenComplaintCount(res.data.openCount + res.data.investigatingCount)
            }
          })
          .catch(recordErr),
      )
    }

    if (can("MANAGE_BLOG")) {
      jobs.push(
        fetchStaffBlogs({ pageSize: 50 })
          .then((res) => {
            if (active && res.data?.items) {
              setPendingBlogCount(
                res.data.items.filter((b) => b.status === "Pending_Approval").length,
              )
              setPublishedBlogCount(
                res.data.items.filter((b) => b.status === "Approved").length,
              )
            }
          })
          .catch(recordErr),
      )
    }

    if (can("MANAGE_INVENTORY")) {
      jobs.push(
        fetchStaffGifts({ pageSize: 50 })
          .then((res) => {
            if (active && res.data?.items) {
              setActiveGiftsCount(
                res.data.items.filter((g) => g.status === "ACTIVE").length,
              )
              setOutOfStockCount(
                res.data.items.filter((g) => g.stockQuantity <= 0).length,
              )
            }
          })
          .catch(recordErr),
      )

      jobs.push(
        fetchStaffEcoFacts({ pageSize: 50 })
          .then((res) => {
            if (active && res.data?.items) {
              setTotalFactsCount(res.data.totalCount)
              setActiveFactsCount(
                res.data.items.filter((f) => f.status === "ACTIVE").length,
              )
            }
          })
          .catch(recordErr),
      )
    }

    void Promise.allSettled(jobs).finally(() => {
      if (active) setLoading(false)
    })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveAuth])

  const allQueue = [
    { perm: "REVIEW_AI", to: "/staff/ai-review", label: "Ảnh AI nhận diện sai", short: "Ảnh AI", n: pendingAiCount, unit: "ảnh", color: "bg-brand" },
    { perm: "VERIFY_RECYCLER", to: "/staff/applications", label: "Hồ sơ đối tác thu mua", short: "Hồ sơ KYB", n: pendingAppCount, unit: "hồ sơ", color: "bg-sky-500" },
    { perm: "HANDLE_COMPLAINT", to: "/staff/complaints", label: "Khiếu nại giao dịch", short: "Khiếu nại", n: openComplaintCount, unit: "khiếu nại", color: "bg-amber-500" },
    { perm: "MANAGE_BLOG", to: "/staff/blog", label: "Bài blog chờ duyệt", short: "Bài blog", n: pendingBlogCount, unit: "bài", color: "bg-emerald-400" },
  ]
  const queue = hasPermFilter ? allQueue.filter((q) => can(q.perm)) : allQueue

  const charts = useMemo(() => {
    const maxQueue = Math.max(1, ...queue.map((q) => q.n))
    const totalPending = queue.reduce((acc, q) => acc + q.n, 0)

    const unlabeled = Math.max(0, datasetStats.total - datasetStats.labeled)
    const dsTotal = Math.max(1, datasetStats.labeled + unlabeled)
    const labeledPct = Math.round((datasetStats.labeled / dsTotal) * 100)
    const unlabeledPct = Math.max(0, 100 - labeledPct)

    const inventoryRows = [
      { label: "Quà đang mở", count: activeGiftsCount, bar: "bg-brand" },
      { label: "Quà hết hàng", count: outOfStockCount, bar: "bg-amber-500" },
      { label: "Eco Fact đang bật", count: activeFactsCount, bar: "bg-sky-500" },
      { label: "Blog đã xuất bản", count: publishedBlogCount, bar: "bg-emerald-400" },
    ]
    const maxInventory = Math.max(1, ...inventoryRows.map((r) => r.count))

    const totalShare = Math.max(1, totalPending)
    const queueShares = queue.map((q) => ({
      ...q,
      pct: totalPending > 0 ? Math.round((q.n / totalShare) * 100) : 0,
    }))

    return {
      maxQueue,
      totalPending,
      unlabeled,
      labeledPct,
      unlabeledPct,
      inventoryRows,
      maxInventory,
      queueShares,
    }
  }, [activeFactsCount, activeGiftsCount, datasetStats.labeled, datasetStats.total, outOfStockCount, publishedBlogCount, queue])

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="VẬN HÀNH"
        title="Việc đang chờ bạn xử lý"
        body="Theo dõi hàng đợi xử lý, chất lượng tập dữ liệu AI, kho quà và nội dung cộng đồng. Xong hết việc tồn đọng thì báo Admin."
      />

      {loadErr && (
        <p
          role="alert"
          className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-medium text-warn"
        >
          {loadErr}
        </p>
      )}

      {/* 4 thẻ chỉ số vận hành theo lưới Bento */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Độ chính xác AI",
            value: `${datasetStats.accuracy}%`,
            note: `${fmtInt(datasetStats.labeled)} ảnh đã gán nhãn`,
            icon: Sparkles,
          },
          {
            label: "Ảnh tập kiểm chứng",
            value: fmtInt(datasetStats.total),
            note: `${fmtInt(charts.unlabeled)} ảnh chờ gán nhãn`,
            icon: Database,
          },
          {
            label: "Kho quà đang mở",
            value: String(activeGiftsCount),
            note: `${outOfStockCount} món hết hàng`,
            icon: Gift,
          },
          {
            label: "Eco Fact đang bật",
            value: `${activeFactsCount} / ${totalFactsCount}`,
            note: `${publishedBlogCount} bài blog đã xuất bản`,
            icon: Leaf,
          },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5"
            >
              <div className="flex h-full min-h-[124px] flex-col justify-between gap-3 rounded-2xl border border-line-soft bg-white p-4 shadow-[0_10px_24px_-14px_rgba(15,31,21,0.08)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                    {item.label}
                  </p>
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-deep"
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                </div>
                <div>
                  {loading ? (
                    <span
                      className="block h-7 w-24 animate-pulse rounded-md bg-surface-2"
                      aria-label="Đang tải số liệu"
                    />
                  ) : (
                    <p className="truncate text-xl leading-7 font-bold tracking-tight whitespace-nowrap tabular-nums text-ink sm:text-[22px]">
                      {item.value}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">{item.note}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Hàng đợi việc cần xử lý */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-ink">Việc đang chờ xử lý</h2>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold tabular-nums text-brand-deep">
            {loading ? "Đang đồng bộ..." : `${charts.totalPending} việc tồn đọng`}
          </span>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {queue.map((q) => (
            <li
              key={q.to}
              className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5"
            >
              <div className="flex h-full items-center justify-between gap-4 rounded-2xl border border-line-soft bg-white p-4 shadow-[0_10px_24px_-14px_rgba(15,31,21,0.08)]">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{q.label}</p>
                  <p className="mt-1 text-xs text-muted tabular-nums">
                    {loading ? "Đang tải..." : `${q.n} ${q.unit} đang chờ`}
                  </p>
                </div>
                <Link
                  to={q.to}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-brand-deep transition-colors hover:border-sage-line hover:bg-surface-2"
                >
                  <span>Xử lý</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 4 biểu đồ tổng quan vận hành Staff */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Biểu đồ 1: Khối lượng việc tồn đọng theo hàng đợi */}
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,31,21,0.08)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-ink">Việc tồn đọng theo hàng đợi</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Số lượng hồ sơ, khiếu nại và nội dung chờ duyệt hiện tại
                </p>
              </div>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand-deep">
                {loading ? "—" : `${charts.totalPending} việc`}
              </span>
            </div>
            {loading ? (
              <div className="flex h-40 items-end justify-between gap-3 pt-2" aria-hidden="true">
                {queue.map((q) => (
                  <div key={q.to} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="h-4 w-7 animate-pulse rounded bg-surface-2" />
                    <div className="flex h-28 w-full items-end rounded-lg bg-surface-2/70 p-1">
                      <div className="h-1/2 w-full animate-pulse rounded-md bg-surface-3" />
                    </div>
                    <span className="text-xs font-medium text-muted">{q.short}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-40 items-end justify-between gap-3 pt-2">
                {queue.map((q) => {
                  const hPct = q.n > 0 ? Math.max(12, Math.round((q.n / charts.maxQueue) * 100)) : 6
                  return (
                    <div key={q.to} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="text-xs font-semibold tabular-nums text-ink">{q.n}</span>
                      <div className="flex h-28 w-full items-end rounded-lg bg-surface-2/70 p-1">
                        <div
                          className={`w-full rounded-md ${q.color} transition-[height] duration-300`}
                          style={{ height: `${hPct}%` }}
                          title={`${q.label}: ${q.n} ${q.unit}`}
                        />
                      </div>
                      <span className="truncate text-xs font-medium text-muted">{q.short}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Biểu đồ 2: Tiến độ gán nhãn tập kiểm chứng AI */}
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,31,21,0.08)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-ink">Tiến độ gán nhãn Dataset AI</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Tỉ lệ ảnh đã gán nhãn chuẩn trên tổng tập kiểm chứng
                </p>
              </div>
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-brand-deep">
                {loading ? "—" : `${datasetStats.accuracy}% chính xác`}
              </span>
            </div>
            {loading ? (
              <div className="flex flex-col items-center gap-5 sm:flex-row" aria-hidden="true">
                <div className="size-28 shrink-0 animate-pulse rounded-full border-[14px] border-surface-2 bg-white" />
                <ul className="w-full flex-1 space-y-2.5">
                  <li className="h-4 w-full animate-pulse rounded bg-surface-2" />
                  <li className="h-4 w-full animate-pulse rounded bg-surface-2" />
                </ul>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                {(() => {
                  const r = 42
                  const c = 2 * Math.PI * r
                  const labeledLen = (charts.labeledPct / 100) * c
                  const unlabeledLen = (charts.unlabeledPct / 100) * c
                  return (
                    <svg viewBox="0 0 112 112" className="size-28 shrink-0 -rotate-90" aria-hidden="true">
                      <circle
                        cx="56"
                        cy="56"
                        r={r}
                        fill="none"
                        stroke="#eaf2ed"
                        strokeWidth="14"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r={r}
                        fill="none"
                        stroke="#278733"
                        strokeWidth="14"
                        strokeDasharray={`${labeledLen} ${c}`}
                        strokeDashoffset={0}
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r={r}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="14"
                        strokeDasharray={`${unlabeledLen} ${c}`}
                        strokeDashoffset={-labeledLen}
                      />
                    </svg>
                  )
                })()}
                <ul className="w-full flex-1 space-y-2.5 text-xs">
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <span className="size-2.5 rounded-full bg-brand" aria-hidden="true" />
                      Đã gán nhãn
                    </span>
                    <span className="font-semibold tabular-nums text-body">
                      {charts.labeledPct}% ({fmtInt(datasetStats.labeled)})
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <span className="size-2.5 rounded-full bg-amber-500" aria-hidden="true" />
                      Chờ gán nhãn
                    </span>
                    <span className="font-semibold tabular-nums text-body">
                      {charts.unlabeledPct}% ({fmtInt(charts.unlabeled)})
                    </span>
                  </li>
                </ul>
              </div>
            )}
          </section>
        </div>

        {/* Biểu đồ 3: Kho quà & Nội dung cộng đồng */}
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,31,21,0.08)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-ink">Kho quà &amp; Nội dung</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Tình trạng vật phẩm đổi thưởng, Eco Fact và bài viết đã xuất bản
                </p>
              </div>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                4 nhóm
              </span>
            </div>
            {loading ? (
              <div className="space-y-3" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-6 w-full animate-pulse rounded bg-surface-2" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {charts.inventoryRows.map((row) => {
                  const wPct = row.count > 0 ? Math.max(8, Math.round((row.count / charts.maxInventory) * 100)) : 4
                  return (
                    <div key={row.label} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink">{row.label}</span>
                        <span className="font-semibold tabular-nums text-body">{row.count}</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={`h-full rounded-full ${row.bar} transition-[width] duration-300`}
                          style={{ width: `${wPct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Biểu đồ 4: Cơ cấu hàng đợi cần xử lý */}
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,31,21,0.08)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-ink">Phân bổ tỉ trọng hàng đợi</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {loading
                    ? "Đang đồng bộ phân bổ đầu việc chờ xử lý"
                    : `Cơ cấu trên tổng ${charts.totalPending} đầu việc cần duyệt`}
                </p>
              </div>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink">
                {loading ? "—" : `${charts.totalPending} việc`}
              </span>
            </div>
            {loading ? (
              <div className="space-y-4" aria-hidden="true">
                <div className="h-4 w-full animate-pulse rounded-full bg-surface-2" />
                <div className="space-y-2.5">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-4 w-full animate-pulse rounded bg-surface-2" />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex h-4 w-full overflow-hidden rounded-full bg-surface-2">
                  {charts.queueShares.map((row) =>
                    row.pct > 0 ? (
                      <div
                        key={row.to}
                        className={`${row.color} h-full transition-[width] duration-300`}
                        style={{ width: `${row.pct}%` }}
                        title={`${row.label}: ${row.n} (${row.pct}%)`}
                      />
                    ) : null,
                  )}
                </div>
                <div className="space-y-2.5">
                  {charts.queueShares.map((row) => (
                    <div key={row.to} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium text-ink">
                        <span className={`size-2.5 rounded-full ${row.color}`} aria-hidden="true" />
                        {row.label}
                      </span>
                      <span className="font-semibold tabular-nums text-body">
                        {row.n} ({row.pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Bạn không có quyền đổi cấu hình hệ thống, phí giao dịch hay tài khoản
        nhân viên — những phần đó thuộc Admin. Nếu cần thay đổi, gửi yêu cầu
        kèm lý do.
      </p>
    </div>
  )
}
