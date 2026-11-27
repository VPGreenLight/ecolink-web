import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight, Banknote, Building2, CheckCircle2, Scale as ScaleIcon, Users } from "lucide-react"
import { ColumnChart, PageHead, Table, Td } from "@/components/admin/ui"
import { DATASET, STATS, fmtInt, fmtVnd } from "@/data/ops"
import { fetchAiDatasetDashboard, type AiDatasetDashboardDto } from "@/lib/aiCurationApi"
import { getAdminAnalyticsCharts, getAdminKpiSummary } from "@/lib/governanceApi"
import { initApiLoading, initApiState, isSsrSmokeTest } from "@/lib/hydration"
import { hasLiveBackendAuth } from "@/lib/session"

/**
 * A-01 Dashboard và thống kê điều hành cấp cao.
 *
 *  - BR-ADM-07: Chỉ tổng hợp sản lượng rác tái chế, GMV và phí dịch vụ từ các biên nhận
 *    giao dịch đã hoàn tất (`HandoverReceipt.Status == Completed`) và hoá đơn VietQR `Paid`.
 *  - Áp dụng lưới Asymmetrical Bento Grid + Double-Bezel + loading skeletons giữ cố định chiều cao.
 */
export default function AdminHome() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d")
  const [loadingSummary, setLoadingSummary] = useState(() => initApiLoading(true))
  const [loadingCharts, setLoadingCharts] = useState(() => initApiLoading(true))
  const [loadingCat, setLoadingCat] = useState(() => initApiLoading(true))
  const [summary, setSummary] = useState(() =>
    initApiState(
      {
        users: 0,
        recyclers: 0,
        handovers: 0,
        volume: 0,
        gross: 0,
        fee: 0,
        aiAccuracy: 0,
        pending: {
          aiCases: 0,
          applications: 0,
          complaints: 0,
          posts: 0,
        },
      },
      {
        users: STATS.users,
        recyclers: STATS.recyclers,
        handovers: STATS.handovers30d,
        volume: STATS.volume30d,
        gross: STATS.gross30d,
        fee: STATS.fee30d,
        aiAccuracy: DATASET.accuracy,
        pending: {
          aiCases: STATS.pending.aiCases,
          applications: STATS.pending.applications,
          complaints: STATS.pending.complaints,
          posts: STATS.pending.posts,
        },
      },
    ),
  )
  const [trend, setTrend] = useState(() => initApiState<typeof STATS.trend>([], STATS.trend))
  const [aiByGroup, setAiByGroup] = useState(() =>
    initApiState<typeof STATS.aiByGroup>([], STATS.aiByGroup),
  )
  const [aiByCategory, setAiByCategory] = useState<
    Pick<
      AiDatasetDashboardDto["byCategory"][number],
      "categoryCode" | "categoryName" | "accuracyPercent"
    >[]
  >(() =>
    initApiState(
      [],
      DATASET.byClass.map((c) => ({
        categoryCode: c.label,
        categoryName: c.label,
        accuracyPercent: c.accuracy,
      })),
    ),
  )
  const [loadErr, setLoadErr] = useState("")

  useEffect(() => {
    if (isSsrSmokeTest()) return
    let cancelled = false
    setLoadingSummary(true)
    getAdminKpiSummary(period)
      .then((res) => {
        if (cancelled || !res.data) return
        const d = res.data
        setSummary({
          users: d.totalCitizens,
          recyclers: d.activeRecyclers,
          handovers: d.completedHandovers,
          volume: Math.round(d.recycledWeightKg),
          gross: Math.round(d.grossMerchandiseValueVnd),
          fee: Math.round(d.platformFeeRevenueVnd + d.vietQrServiceRevenueVnd),
          aiAccuracy: d.aiAccuracyPercent ?? 0,
          pending: {
            aiCases: d.pending.aiMisclassifiedCases,
            applications: d.pending.recyclerApplications,
            complaints: d.pending.openComplaints,
            posts: d.pending.pendingBlogPosts,
          },
        })
      })
      .catch((err) => {
        if (!cancelled && hasLiveBackendAuth()) {
          setLoadErr(
            err instanceof Error ? err.message : "Không thể tải số liệu tổng quan từ Backend.",
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSummary(false)
      })

    return () => {
      cancelled = true
    }
  }, [period])

  useEffect(() => {
    if (isSsrSmokeTest()) return
    let cancelled = false
    getAdminAnalyticsCharts()
      .then((res) => {
        if (cancelled || !res.data) return
        if (Array.isArray(res.data.monthlyTrends)) {
          setTrend(
            res.data.monthlyTrends.map((m) => ({
              month: m.monthLabel,
              handovers: m.completedHandovers,
              volume: Math.round(m.recycledVolumeKg),
            })),
          )
        }
        if (Array.isArray(res.data.aiByGroup)) {
          setAiByGroup(
            res.data.aiByGroup.map((g) => ({
              group: g.groupName,
              scans: g.totalScans,
              correct: g.correctScans,
              falseReports: g.falseReports,
            })),
          )
        }
      })
      .catch((err) => {
        if (!cancelled && hasLiveBackendAuth()) {
          setLoadErr((prev) =>
            prev || (err instanceof Error ? err.message : "Không thể tải dữ liệu biểu đồ."),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCharts(false)
      })

    fetchAiDatasetDashboard()
      .then((res) => {
        if (!cancelled && res.success && Array.isArray(res.data?.byCategory)) {
          setAiByCategory(res.data.byCategory)
        }
      })
      .catch((err) => {
        if (!cancelled && hasLiveBackendAuth()) {
          setLoadErr((prev) =>
            prev || (err instanceof Error ? err.message : "Không thể tải độ chính xác theo lớp rác."),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCat(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const periodLabel = period === "7d" ? "7 ngày" : period === "90d" ? "90 ngày" : "30 ngày"

  const queue = [
    {
      to: "/staff/ai-review",
      label: "Ảnh AI nhận diện sai",
      owner: "Nhân viên AI",
      color: "#15803d",
      n: summary.pending.aiCases,
    },
    {
      to: "/staff/applications",
      label: "Hồ sơ đối tác thu mua",
      owner: "Nhân viên đối tác",
      color: "#0284c7",
      n: summary.pending.applications,
    },
    {
      to: "/staff/complaints",
      label: "Khiếu nại giao dịch",
      owner: "Nhân viên hỗ trợ",
      color: "#d97706",
      n: summary.pending.complaints,
    },
    {
      to: "/admin/blog",
      label: "Bài Blog chờ duyệt",
      owner: "Bạn (Admin)",
      color: "#7c3aed",
      n: summary.pending.posts,
    },
  ].sort((a, b) => b.n - a.n)

  const pendingTotal = queue.reduce((t, x) => t + x.n, 0)
  const queuePeak = Math.max(pendingTotal, 1)
  const backlog = queue.map((b) => ({ ...b, share: b.n / queuePeak }))
  const aiPeak = Math.max(...aiByGroup.map((g) => g.scans), 1)
  const totalVolume6m = trend.reduce((acc, t) => acc + Math.max(t.volume, 0), 0)
  const avgWeightSeries = trend.map((t) => ({
    label: t.month,
    value: t.handovers > 0 ? +(t.volume / t.handovers).toFixed(1) : 0,
  }))
  const aboveBaselineCount = aiByCategory.filter((c) => c.accuracyPercent >= summary.aiAccuracy).length
  const belowBaselineCount = aiByCategory.length - aboveBaselineCount

  const kpiCards = [
    {
      label: "Người dùng",
      value: fmtInt(summary.users),
      note: "Công dân đã kích hoạt",
      icon: Users,
    },
    {
      label: "Cơ sở thu mua",
      value: fmtInt(summary.recyclers),
      note: "Đối tác đang hoạt động",
      icon: Building2,
    },
    {
      label: `Khối lượng ${periodLabel}`,
      value: `${fmtInt(summary.volume)} kg`,
      note: `${fmtInt(summary.handovers)} biên nhận hoàn tất`,
      icon: ScaleIcon,
    },
    {
      label: `Giá trị ${periodLabel}`,
      value: fmtVnd(summary.gross),
      note: `Doanh thu dịch vụ ${fmtVnd(summary.fee)}`,
      icon: Banknote,
    },
  ]

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHead
        eyebrow="QUẢN TRỊ · A-01"
        title="Dashboard và thống kê"
        body="Tổng quan KPI toàn hệ thống tính trên các giao dịch đã hoàn tất (BR-ADM-07). Dùng để ra quyết định cấu hình vận hành và đối soát."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-10 items-center rounded-xl border border-line bg-white p-0.5 shadow-2xs">
              {(["7d", "30d", "90d"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  aria-pressed={period === p}
                  className={`h-8.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                    period === p
                      ? "bg-brand text-white"
                      : "text-body hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  {p === "7d" ? "7N" : p === "30d" ? "30N" : "90N"}
                </button>
              ))}
            </div>
            <Link
              to="/admin/reports"
              className="btn-outline inline-flex h-10 shrink-0 items-center px-4 text-[13px] font-semibold"
            >
              Xuất báo cáo &amp; Audit
            </Link>
          </div>
        }
      />

      {loadErr && (
        <p
          role="alert"
          className="rounded-2xl border border-warn/35 bg-warn/10 px-4 py-3 text-sm font-medium text-warn"
        >
          {loadErr}
        </p>
      )}

      {/* 4 Thẻ KPI Double-Bezel cố định chiều cao */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5"
            >
              <div className="flex h-full min-h-[126px] flex-col justify-between gap-3 rounded-2xl border border-line-soft bg-white p-4 shadow-[0_12px_30px_-16px_rgba(15,31,21,0.1)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
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
                  {loadingSummary ? (
                    <span
                      className="block h-7 w-28 animate-pulse rounded-md bg-surface-2"
                      aria-label="Đang tải số liệu"
                    />
                  ) : (
                    <p className="truncate text-xl leading-7 font-bold tracking-tight whitespace-nowrap tabular-nums text-ink sm:text-[22px]">
                      {item.value}
                    </p>
                  )}
                  <p className="mt-1 truncate text-xs text-muted">{item.note}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Dải tóm tắt đối soát kỳ hiện tại */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-body">
          <CheckCircle2 className="size-4 shrink-0 text-brand" aria-hidden="true" />
          <span>
            Trong <strong className="text-ink">{periodLabel}</strong> qua: doanh thu gói dịch vụ VietQR{" "}
            <strong className="tabular-nums text-brand-deep">{fmtVnd(summary.fee)}</strong> ·{" "}
            <strong className="tabular-nums text-ink">{fmtInt(summary.handovers)}</strong> biên nhận hoàn tất.
          </span>
        </div>
        <Link
          to="/admin/reconciliation"
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-deep hover:underline"
        >
          Đối soát dòng tiền
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      {/* Asymmetrical Bento Row: Giao dịch 6 tháng (7/12) + Hàng đợi & Hiệu suất tài chính (5/12) */}
      <div className="grid gap-5 xl:grid-cols-12 xl:items-stretch">
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5 xl:col-span-7">
          <section className="flex h-full flex-col gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-14px_rgba(15,31,21,0.08)]">
            <div className="flex flex-col gap-1.5 border-b border-line-soft pb-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold tracking-tight text-ink">
                  Giao dịch 6 tháng gần nhất
                </h2>
                <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-brand-deep">
                  6 tháng
                </span>
              </div>
              <p className="text-xs leading-5 text-muted">
                Tổng hợp giao dịch bàn giao đã chốt biên nhận hoàn tất và tốc độ tăng trưởng hàng tháng.
              </p>
            </div>

            {loadingCharts ? (
              <div className="space-y-4" aria-hidden="true">
                <div className="h-[168px] w-full animate-pulse rounded-xl bg-surface-2" />
                <div className="h-36 w-full animate-pulse rounded-xl bg-surface-2/70" />
              </div>
            ) : (
              <>
                <ColumnChart data={trend.map((t) => ({ label: t.month, value: Math.max(t.handovers, 0) }))} />

                {/* Mobile cards */}
                <ul className="grid grid-cols-2 gap-2.5 md:hidden">
                  {trend.map((t, i) => {
                    const prev = trend[i - 1]
                    const growth =
                      prev && prev.handovers > 0
                        ? ((t.handovers - prev.handovers) / prev.handovers) * 100
                        : null
                    return (
                      <li
                        key={t.month}
                        className="rounded-xl border border-line-soft bg-surface-2/50 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-ink">{t.month}</span>
                          {growth === null ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <span className={growth >= 0 ? "font-semibold text-brand-deep" : "font-semibold text-warn"}>
                              {growth >= 0 ? "+" : ""}
                              {growth.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-bold text-sm tabular-nums text-ink">
                          {fmtInt(t.handovers)} đơn
                        </p>
                        <p className="mt-0.5 text-[11px] tabular-nums text-muted">
                          {fmtInt(t.volume)} kg · TB {t.handovers > 0 ? Math.round(t.volume / t.handovers) : 0} kg
                        </p>
                      </li>
                    )
                  })}
                </ul>

                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table
                    head={[
                      "Tháng",
                      "Giao dịch",
                      "Tăng trưởng",
                      "Khối lượng (kg)",
                      "Bình quân / đơn",
                    ]}
                  >
                    {trend.map((t, i) => {
                      const prev = trend[i - 1]
                      const growth =
                        prev && prev.handovers > 0
                          ? ((t.handovers - prev.handovers) / prev.handovers) * 100
                          : null
                      return (
                        <tr key={t.month} className="transition-colors hover:bg-surface-2/40">
                          <Td className="font-semibold whitespace-nowrap text-ink">{t.month}</Td>
                          <Td className="tabular-nums whitespace-nowrap">{fmtInt(t.handovers)}</Td>
                          <Td className="tabular-nums whitespace-nowrap">
                            {growth === null ? (
                              <span className="text-muted">—</span>
                            ) : (
                              <span className={growth >= 0 ? "font-semibold text-brand-deep" : "font-semibold text-warn"}>
                                {growth >= 0 ? "+" : ""}
                                {growth.toFixed(1)}%
                              </span>
                            )}
                          </Td>
                          <Td className="tabular-nums whitespace-nowrap">{fmtInt(t.volume)}</Td>
                          <Td className="tabular-nums whitespace-nowrap">
                            {t.handovers > 0 ? Math.round(t.volume / t.handovers) : 0} kg
                          </Td>
                        </tr>
                      )
                    })}
                  </Table>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-5">
          <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
            <section className="flex flex-col gap-3.5 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-14px_rgba(15,31,21,0.08)]">
              <div className="flex flex-col gap-1.5 border-b border-line-soft pb-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold tracking-tight text-ink">
                    Việc đang chờ xử lý
                  </h2>
                  <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-brand-deep">
                    {loadingSummary ? "—" : `${pendingTotal} tồn`}
                  </span>
                </div>
                <p className="text-xs leading-5 text-muted">
                  Cùng hàng đợi mà nhân viên thấy. Loại nào không giảm được là quy trình đang nghẽn.
                </p>
              </div>

              {loadingSummary ? (
                <div className="flex flex-col gap-3" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-surface-2" />
                  ))}
                </div>
              ) : (
                <>
                  <ul className="flex flex-col divide-y divide-line-soft">
                    {backlog.map((b) => (
                      <li
                        key={b.to}
                        className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <span
                              className="mt-1.5 size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: b.color }}
                              aria-hidden="true"
                            />
                            <div className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-ink">{b.label}</span>
                              <span className="block text-xs text-muted">{b.owner}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2.5">
                            <span className="text-lg font-bold tabular-nums text-ink">
                              {b.n}
                            </span>
                            <Link
                              to={b.to}
                              className="inline-flex min-h-9 items-center rounded-lg border border-line bg-surface-2/70 px-2.5 text-xs font-semibold text-brand-deep transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand/10"
                            >
                              Xử lý →
                            </Link>
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                          <div
                            className="h-full rounded-full transition-[width] duration-300"
                            style={{
                              width: `${b.n > 0 ? Math.max(4, Math.round(b.share * 100)) : 0}%`,
                              backgroundColor: b.color,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="rounded-xl border border-line-soft bg-surface-2/60 p-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-ink">Tỷ trọng hàng đợi</span>
                      <span className="tabular-nums text-muted">
                        {pendingTotal > 0 ? `${pendingTotal} hồ sơ cần duyệt` : "Không có hồ sơ tồn"}
                      </span>
                    </div>
                    <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
                      {pendingTotal > 0 ? (
                        backlog
                          .filter((b) => b.n > 0)
                          .map((b) => (
                            <span
                              key={b.to}
                              className="h-full transition-[width] duration-300"
                              style={{
                                width: `${(b.n / pendingTotal) * 100}%`,
                                backgroundColor: b.color,
                              }}
                              title={`${b.label}: ${b.n}`}
                            />
                          ))
                      ) : (
                        <span className="h-full w-full bg-brand/35" />
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                      <span>
                        {pendingTotal > 0 && backlog[0] ? (
                          <>
                            Ưu tiên:{" "}
                            <strong className="text-ink">{backlog[0].label}</strong>{" "}
                            <span className="tabular-nums">({Math.round(backlog[0].share * 100)}%)</span>
                          </>
                        ) : (
                          "Toàn bộ hàng đợi đang thông suốt."
                        )}
                      </span>
                      <Link to="/admin/reports" className="font-semibold text-brand-deep hover:underline">
                        Xem báo cáo →
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>

          <div className="flex-1 rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
            <section className="flex h-full flex-col gap-3.5 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-14px_rgba(15,31,21,0.08)]">
              <div className="flex items-center justify-between gap-2 border-b border-line-soft pb-3">
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-ink">
                    Hiệu suất đơn &amp; dòng tiền
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Chỉ số bình quân mỗi biên nhận trong {periodLabel} qua.
                  </p>
                </div>
                <Link
                  to="/admin/fees"
                  className="inline-flex min-h-8 shrink-0 items-center rounded-full border border-line bg-surface-2 px-2.5 text-xs font-semibold text-brand-deep transition-colors hover:border-sage-line hover:bg-surface-3"
                >
                  Cấu hình phí →
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-line-soft bg-surface-2/50 p-3">
                  <p className="text-[11px] font-medium text-muted">Giá trị / đơn</p>
                  <p className="mt-1 truncate text-sm font-bold tabular-nums text-ink">
                    {loadingSummary
                      ? "—"
                      : fmtVnd(summary.handovers > 0 ? Math.round(summary.gross / summary.handovers) : 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-line-soft bg-surface-2/50 p-3">
                  <p className="text-[11px] font-medium text-muted">Nặng / đơn</p>
                  <p className="mt-1 truncate text-sm font-bold tabular-nums text-ink">
                    {loadingSummary
                      ? "—"
                      : `${summary.handovers > 0 ? (summary.volume / summary.handovers).toFixed(1) : "0.0"} kg`}
                  </p>
                </div>
                <div className="rounded-xl border border-line-soft bg-surface-2/50 p-3">
                  <p className="text-[11px] font-medium text-muted">Phí / GMV</p>
                  <p className="mt-1 truncate text-sm font-bold tabular-nums text-brand-deep">
                    {loadingSummary
                      ? "—"
                      : `${summary.gross > 0 ? ((summary.fee / summary.gross) * 100).toFixed(2) : "0.00"}%`}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* 3 biểu đồ phân tích bổ sung: Sản lượng 6 tháng, Năng suất đơn hàng, Phân bổ lượt quét AI */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 lg:items-stretch">
        {/* Biểu đồ 1: Sản lượng tái chế 6 tháng (kg) */}
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex h-full flex-col gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-14px_rgba(15,31,21,0.08)]">
            <div className="flex flex-col gap-1.5 border-b border-line-soft pb-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold tracking-tight text-ink">
                  Sản lượng tái chế 6 tháng
                </h2>
                <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand-deep">
                  {loadingCharts ? "—" : `${fmtInt(totalVolume6m)} kg`}
                </span>
              </div>
              <p className="text-xs leading-5 text-muted">
                Tổng khối lượng phế liệu cân tại điểm thu mua trong 6 tháng gần nhất.
              </p>
            </div>

            {loadingCharts ? (
              <div className="h-[196px] w-full animate-pulse rounded-xl bg-surface-2" aria-hidden="true" />
            ) : trend.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">Chưa có dữ liệu sản lượng theo tháng.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <ColumnChart
                  data={trend.map((t) => ({ label: t.month, value: Math.max(t.volume, 0) }))}
                  format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}t` : fmtInt(v))}
                  height={156}
                />
                <div className="flex items-center justify-between gap-2 rounded-xl border border-line-soft bg-surface-2/60 px-3 py-2 text-xs">
                  <span className="text-muted">Bình quân tháng</span>
                  <span className="font-bold tabular-nums text-ink">
                    {fmtInt(Math.round(totalVolume6m / trend.length))} kg/tháng
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Biểu đồ 2: Năng suất bình quân mỗi biên nhận (kg/đơn) */}
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex h-full flex-col gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-14px_rgba(15,31,21,0.08)]">
            <div className="flex flex-col gap-1.5 border-b border-line-soft pb-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold tracking-tight text-ink">
                  Khối lượng bình quân / đơn
                </h2>
                <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand-deep">
                  {loadingCharts || avgWeightSeries.length === 0
                    ? "—"
                    : `${avgWeightSeries[avgWeightSeries.length - 1].value} kg`}
                </span>
              </div>
              <p className="text-xs leading-5 text-muted">
                Biến động quy mô trung bình mỗi biên nhận bàn giao qua từng tháng.
              </p>
            </div>

            {loadingCharts ? (
              <div className="h-[196px] w-full animate-pulse rounded-xl bg-surface-2" aria-hidden="true" />
            ) : avgWeightSeries.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">Chưa có dữ liệu hiệu suất đơn hàng.</p>
            ) : (
              <ProductivityAreaChart data={avgWeightSeries} />
            )}
          </section>
        </div>

        {/* Biểu đồ 3: Phân tầng chất lượng lớp AI */}
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5 md:col-span-2 xl:col-span-1">
          <section className="flex h-full flex-col gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-14px_rgba(15,31,21,0.08)]">
            <div className="flex flex-col gap-1.5 border-b border-line-soft pb-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold tracking-tight text-ink">
                  Chất lượng phân lớp AI
                </h2>
                <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand-deep">
                  {loadingSummary ? "—" : `${summary.aiAccuracy}% chuẩn`}
                </span>
              </div>
              <p className="text-xs leading-5 text-muted">
                Tỷ trọng các lớp rác theo ngưỡng độ chính xác so với đường cơ sở hệ thống.
              </p>
            </div>

            {loadingCat ? (
              <div className="h-[196px] w-full animate-pulse rounded-xl bg-surface-2" aria-hidden="true" />
            ) : (
              <AiQualityDonut
                categories={aiByCategory}
                baseline={summary.aiAccuracy}
              />
            )}
          </section>
        </div>
      </div>

      {/* Row dưới: Hiệu năng AI theo nhóm rác & theo lớp vật liệu */}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex h-full flex-col gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-14px_rgba(15,31,21,0.08)]">
            <div className="flex flex-col gap-1.5 border-b border-line-soft pb-3.5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold tracking-tight text-ink">
                  AI quét đúng và khiếu nại sai, theo nhóm rác
                </h2>
                <Link
                  to="/staff/ai-review"
                  className="inline-flex min-h-8 shrink-0 items-center rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-brand-deep transition-colors hover:border-sage-line hover:bg-surface-3"
                >
                  Ảnh AI sai →
                </Link>
              </div>
              <p className="text-xs leading-5 text-muted">
                Cùng mẫu số tổng lượt quét để đối chiếu trực quan giữa độ chính xác và tỷ lệ báo nhầm.
              </p>
            </div>

            {loadingCharts ? (
              <div className="space-y-4" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-8 w-full animate-pulse rounded-lg bg-surface-2" />
                ))}
              </div>
            ) : aiByGroup.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                Chưa có dữ liệu AI theo nhóm rác từ Backend.
              </p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <Scale
                  title="AI nhận diện đúng"
                  unit="lượt"
                  peak={aiPeak}
                  rows={aiByGroup.map((g) => ({
                    label: g.group,
                    value: g.correct,
                    note: `${g.scans > 0 ? ((g.correct / g.scans) * 100).toFixed(1) : "0.0"}% chính xác`,
                  }))}
                />
                <Scale
                  title="Khiếu nại sai (báo nhầm, AI đúng)"
                  unit="lượt"
                  peak={aiPeak}
                  rows={aiByGroup
                    .map((g) => ({
                      label: g.group,
                      value: g.falseReports,
                      note: `${g.scans > 0 ? ((g.falseReports / g.scans) * 100).toFixed(1) : "0.0"}% tổng lượt quét`,
                    }))
                    .sort((a, b) => b.value - a.value)}
                />
              </div>
            )}
          </section>
        </div>

        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex h-full flex-col gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-14px_rgba(15,31,21,0.08)]">
            <div className="flex flex-col gap-2 border-b border-line-soft pb-3.5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold tracking-tight text-ink">
                  Độ chính xác nhận diện theo lớp rác
                </h2>
                <Link
                  to="/staff/dataset"
                  className="inline-flex min-h-8 shrink-0 items-center rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-brand-deep transition-colors hover:border-sage-line hover:bg-surface-3"
                >
                  Tập dữ liệu →
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs leading-5 text-muted">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 font-semibold tabular-nums text-ink">
                  <span className="size-1.5 rounded-full bg-ink/75" aria-hidden="true" />
                  Trung bình toàn hệ thống {summary.aiAccuracy}%
                </span>
                <span>Lớp dưới đường cơ sở cần ưu tiên bổ sung ảnh huấn luyện.</span>
              </div>
            </div>

            {loadingCat ? (
              <div className="flex flex-1 flex-col gap-3" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-surface-2" />
                ))}
              </div>
            ) : aiByCategory.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                Chưa có dữ liệu kiểm chứng theo danh mục rác từ Backend.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <ul className="flex flex-col divide-y divide-line-soft/70">
                  {aiByCategory.map((c) => {
                    const below = c.accuracyPercent < summary.aiAccuracy
                    const delta = c.accuracyPercent - summary.aiAccuracy
                    return (
                      <li key={c.categoryCode} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2 text-[13px]">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium text-ink">{c.categoryName}</span>
                            {below && (
                              <span className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                Dưới cơ sở
                              </span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                            {Math.abs(delta) >= 0.05 && (
                              <span className={`text-[11px] font-medium ${below ? "text-amber-700" : "text-muted"}`}>
                                {delta > 0 ? "+" : ""}
                                {delta.toFixed(1)}%
                              </span>
                            )}
                            <span className={`font-bold ${below ? "text-amber-700" : "text-brand-deep"}`}>
                              {c.accuracyPercent}%
                            </span>
                          </div>
                        </div>
                        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
                          <div
                            className={`h-full rounded-full transition-[width] duration-300 ${
                              below
                                ? "bg-amber-500"
                                : "bg-[linear-gradient(90deg,var(--color-mint),var(--color-brand))]"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, c.accuracyPercent))}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line-soft bg-surface-2/60 px-3 py-2.5 text-[11px] text-muted">
                  <span>
                    <strong className="tabular-nums text-ink">{aboveBaselineCount}/{aiByCategory.length}</strong> lớp đạt chuẩn
                    {belowBaselineCount > 0 && (
                      <> · <strong className="tabular-nums text-amber-800">{belowBaselineCount}</strong> lớp cần bổ sung mẫu</>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
                      Đạt chuẩn
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
                      Dưới {summary.aiAccuracy}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

/** Biểu đồ đường kết hợp diện tích hiển thị khối lượng bình quân mỗi đơn qua 6 tháng. */
function ProductivityAreaChart({
  data,
}: {
  data: readonly { label: string; value: number }[]
}) {
  const width = 320
  const height = 166
  const padX = 24
  const topPad = 24
  const bottomPad = 24
  const innerW = width - padX * 2
  const innerH = height - topPad - bottomPad

  const values = data.map((d) => d.value)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const span = Math.max(rawMax - rawMin, 1)
  const minVal = rawMin === 0 ? 0 : Math.max(0, rawMin - span * 0.25)
  const maxVal = rawMax + span * 0.25
  const range = Math.max(maxVal - minVal, 1)
  const avg = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1)
  const baselineY = height - bottomPad

  const coords = data.map((d, i) => {
    const x = data.length === 1 ? width / 2 : padX + (i / (data.length - 1)) * innerW
    const y = topPad + (1 - (d.value - minVal) / range) * innerH
    return { x: +x.toFixed(1), y: +y.toFixed(1), label: d.label, value: d.value }
  })

  const linePath = coords
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ")
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x} ${baselineY} L ${coords[0].x} ${baselineY} Z`
      : ""

  return (
    <div className="flex flex-1 flex-col justify-between gap-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[168px] w-full overflow-visible"
        role="img"
        aria-label={`Biểu đồ đường khối lượng bình quân mỗi đơn qua ${data.length} tháng`}
      >
        <defs>
          <linearGradient id="admin-avg-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = +(topPad + ratio * innerH).toFixed(1)
          return (
            <line
              key={ratio}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeDasharray="3 3"
              className="text-line"
            />
          )
        })}
        {areaPath && <path d={areaPath} fill="url(#admin-avg-area-grad)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {coords.map((p) => (
          <g key={p.label}>
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill="#ffffff"
              stroke="var(--color-brand-deep)"
              strokeWidth="2.2"
            />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              className="tabular-nums fill-ink"
            >
              {p.value}
            </text>
            <text
              x={p.x}
              y={height - 4}
              textAnchor="middle"
              fontSize="10"
              fontWeight="500"
              className="fill-muted"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="flex items-center justify-between gap-2 rounded-xl border border-line-soft bg-surface-2/60 px-3 py-2 text-xs">
        <span className="text-muted">Trung bình 6 tháng</span>
        <span className="font-bold tabular-nums text-ink">{avg.toFixed(1)} kg/đơn</span>
      </div>
    </div>
  )
}

/** Biểu đồ Donut phân tầng độ chính xác các lớp rác so với đường cơ sở. */
function AiQualityDonut({
  categories,
  baseline,
}: {
  categories: readonly { categoryName: string; accuracyPercent: number }[]
  baseline: number
}) {
  const highTarget = Math.max(95, baseline)
  const highCount = categories.filter((c) => c.accuracyPercent >= highTarget).length
  const midCount = categories.filter(
    (c) => c.accuracyPercent >= baseline && c.accuracyPercent < highTarget,
  ).length
  const lowCount = categories.filter((c) => c.accuracyPercent < baseline).length
  const total = categories.length

  const radius = 44
  const circumference = 2 * Math.PI * radius
  let cumulative = 0

  const tiers = [
    {
      label: `Chuẩn cao (>= ${highTarget}%)`,
      count: highCount,
      color: "#15803d",
    },
    {
      label: `Đạt cơ sở (>= ${baseline}%)`,
      count: midCount,
      color: "#10b981",
    },
    {
      label: `Cần thêm mẫu (< ${baseline}%)`,
      count: lowCount,
      color: "#d97706",
    },
  ].map((tier) => {
    const share = total > 0 ? tier.count / total : 0
    const length = share * circumference
    const offset = -cumulative * circumference
    cumulative += share
    return {
      ...tier,
      pct: total > 0 ? Math.round(share * 100) : 0,
      length,
      offset,
    }
  })

  const sorted =
    categories.length > 0
      ? [...categories].sort((a, b) => a.accuracyPercent - b.accuracyPercent)
      : []
  const lowest = sorted[0] ?? null
  const highest = sorted[sorted.length - 1] ?? null
  const allEqualBaseline =
    lowest !== null && highest !== null && lowest.accuracyPercent === highest.accuracyPercent

  return (
    <div className="flex flex-1 flex-col justify-between gap-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative size-32 shrink-0">
          <svg
            viewBox="0 0 120 120"
            className="size-full -rotate-90"
            role="img"
            aria-label={`Biểu đồ tròn phân tầng ${total} lớp rác quanh mức chuẩn ${baseline}%`}
          >
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--color-surface-3)"
              strokeWidth="14"
            />
            {total > 0 ? (
              tiers
                .filter((t) => t.count > 0)
                .map((seg) => (
                  <circle
                    key={seg.label}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="14"
                    strokeDasharray={`${seg.length} ${Math.max(0, circumference - seg.length)}`}
                    strokeDashoffset={seg.offset}
                  />
                ))
            ) : (
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="#15803d"
                strokeWidth="14"
                strokeDasharray={`${(Math.min(100, Math.max(0, baseline)) / 100) * circumference} ${circumference}`}
              />
            )}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-semibold tracking-wider text-muted uppercase">Cơ sở</span>
            <span className="text-sm font-bold tabular-nums text-ink">{baseline}%</span>
          </div>
        </div>

        <ul className="w-full min-w-0 flex-1 space-y-2">
          {tiers.map((seg) => (
            <li key={seg.label} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: seg.color }}
                  aria-hidden="true"
                />
                <span className="truncate font-medium text-ink">{seg.label}</span>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-body">
                {seg.count} <span className="font-normal text-muted">lớp ({seg.pct}%)</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl border border-line-soft bg-surface-2/60 px-3 py-2 text-xs">
        <span className="text-muted">
          {lowCount > 0 ? "Ưu tiên huấn luyện" : allEqualBaseline ? "Trạng thái lớp" : "Lớp thấp nhất"}
        </span>
        <span className="truncate font-bold tabular-nums text-ink">
          {allEqualBaseline
            ? `Đồng đều ở ${lowest.accuracyPercent}%`
            : lowest
              ? `${lowest.categoryName} (${lowest.accuracyPercent}%)`
              : `Hệ thống ${baseline}%`}
        </span>
      </div>
    </div>
  )
}

function Scale({
  title,
  unit,
  peak,
  rows,
}: {
  title: string
  unit: string
  peak: number
  rows: readonly { label: string; value: number; note: string }[]
}) {
  return (
    <div>
      <h3 className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">{title}</h3>
      <ul className="mt-2 divide-y divide-line-soft/60">
        {rows.map((r) => (
          <li key={r.label} className="py-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-ink">{r.label}</span>
              <span className="shrink-0 font-bold tabular-nums text-ink">
                {fmtInt(r.value)} <span className="font-normal text-muted">{unit}</span>
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2.5">
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                <span
                  className="block h-full rounded-full bg-brand transition-[width] duration-300"
                  style={{ width: `${r.value > 0 ? Math.max((r.value / peak) * 100, 2) : 0}%` }}
                />
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted">{r.note}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
