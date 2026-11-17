import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ColumnChart, PageHead, Stat, StatRow, Table, Td } from "@/components/admin/ui"
import { DATASET, STATS, fmtInt, fmtVnd } from "@/data/ops"
import { getAdminAnalyticsCharts, getAdminKpiSummary } from "@/lib/governanceApi"

/**
 * A-01 Dashboard và thống kê điều hành cấp cao.
 *
 *  - BR-ADM-07: Chỉ tổng hợp sản lượng rác tái chế, GMV và phí dịch vụ từ các biên nhận
 *    giao dịch đã hoàn tất (`HandoverReceipt.Status == Completed`) và hoá đơn VietQR `Paid`.
 *  - Khởi tạo sẵn từ hằng số `STATS` để an toàn tuyệt đối với SSR (`npm run check`),
 *    sau đó đồng bộ dữ liệu thực theo kỳ (`7d` / `30d` / `90d`) từ Backend API.
 */
export default function AdminHome() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d")
  const [summary, setSummary] = useState({
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
  })
  const [trend, setTrend] = useState(STATS.trend)
  const [aiByGroup, setAiByGroup] = useState(STATS.aiByGroup)

  useEffect(() => {
    let cancelled = false
    getAdminKpiSummary(period)
      .then((res) => {
        if (cancelled || !res.data) return
        const d = res.data
        // Chỉ ghi đè nếu CSDL thực đã phát sinh dữ liệu người dùng/giao dịch
        if (d.totalCitizens + d.activeRecyclers > 0) {
          setSummary({
            users: d.totalCitizens,
            recyclers: d.activeRecyclers,
            handovers: d.completedHandovers,
            volume: Math.round(d.recycledWeightKg),
            gross: Math.round(d.grossMerchandiseValueVnd),
            fee: Math.round(d.platformFeeRevenueVnd + d.vietQrServiceRevenueVnd),
            aiAccuracy: d.aiAccuracyPercent || DATASET.accuracy,
            pending: {
              aiCases: d.pending.aiMisclassifiedCases,
              applications: d.pending.recyclerApplications,
              complaints: d.pending.openComplaints,
              posts: d.pending.pendingBlogPosts,
            },
          })
        }
      })
      .catch(() => {
        // Giữ dữ liệu mặc định khi chưa đăng nhập hoặc ngoại tuyến
      })

    return () => {
      cancelled = true
    }
  }, [period])

  useEffect(() => {
    let cancelled = false
    getAdminAnalyticsCharts()
      .then((res) => {
        if (cancelled || !res.data) return
        if (
          res.data.monthlyTrends?.length > 0 &&
          res.data.monthlyTrends.some((m) => m.completedHandovers > 0)
        ) {
          setTrend(
            res.data.monthlyTrends.map((m) => ({
              month: m.monthLabel,
              handovers: m.completedHandovers,
              volume: Math.round(m.recycledVolumeKg),
            })),
          )
        }
        if (
          res.data.aiByGroup?.length > 0 &&
          res.data.aiByGroup.some((g) => g.totalScans > 0)
        ) {
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
      .catch(() => {
        // Giữ biểu đồ mẫu
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
      n: summary.pending.aiCases,
    },
    {
      to: "/staff/applications",
      label: "Hồ sơ đối tác thu mua",
      owner: "Nhân viên đối tác",
      n: summary.pending.applications,
    },
    {
      to: "/staff/complaints",
      label: "Khiếu nại giao dịch",
      owner: "Nhân viên hỗ trợ",
      n: summary.pending.complaints,
    },
    {
      to: "/admin/blog",
      label: "Bài Blog chờ duyệt",
      owner: "Bạn (Admin)",
      n: summary.pending.posts,
    },
  ].sort((a, b) => b.n - a.n)

  const queueTotal = Math.max(queue.reduce((t, x) => t + x.n, 0), 1)
  const backlog = queue.map((b) => ({ ...b, share: b.n / queueTotal }))
  const aiPeak = Math.max(...aiByGroup.map((g) => g.scans), 1)

  return (
    <div className="flex flex-col gap-8">
      <PageHead
        eyebrow="QUẢN TRỊ · A-01"
        title="Dashboard và thống kê"
        body="Tổng quan KPI toàn hệ thống tính trên các giao dịch đã hoàn tất (BR-ADM-07). Dùng để ra quyết định cấu hình vận hành và đối soát."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-line bg-white p-0.5">
              {(["7d", "30d", "90d"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  aria-pressed={period === p}
                  className={`h-9 rounded-md px-3 text-[12px] font-semibold transition-colors ${
                    period === p
                      ? "bg-brand text-white"
                      : "text-body hover:bg-surface-2"
                  }`}
                >
                  {p === "7d" ? "7N" : p === "30d" ? "30N" : "90N"}
                </button>
              ))}
            </div>
            <Link to="/admin/reports" className="btn-outline h-10 shrink-0 px-4 text-[13px]">
              Xuất báo cáo & Audit
            </Link>
          </div>
        }
      />

      <StatRow>
        <Stat label="Người dùng" value={fmtInt(summary.users)} />
        <Stat label="Cơ sở thu mua" value={fmtInt(summary.recyclers)} />
        <Stat label={`Khối lượng ${periodLabel}`} value={fmtInt(summary.volume)} unit="kg" />
        <Stat label={`Giá trị ${periodLabel}`} value={fmtVnd(summary.gross)} />
      </StatRow>

      <p className="text-sm text-body">
        Trong {periodLabel} qua, EcoLink ghi nhận doanh thu dịch vụ &amp; phí nền tảng{" "}
        <b className="tabular-nums text-ink">{fmtVnd(summary.fee)}</b> từ{" "}
        <b className="tabular-nums text-ink">{fmtInt(summary.handovers)}</b> giao dịch hoàn tất.
      </p>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
            Việc đang chờ xử lý
          </h2>
          <p className="text-sm text-muted">
            Cùng hàng đợi mà nhân viên thấy. Loại nào không giảm được là quy trình đang nghẽn.
          </p>
        </div>

        <ul className="mt-4 divide-y divide-line-soft border-y border-line-soft">
          {backlog.map((b) => (
            <li key={b.to} className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3.5">
              <span className="w-[280px] max-w-full shrink-0">
                <span className="block text-sm font-semibold text-ink">{b.label}</span>
                <span className="block text-[13px] text-muted">{b.owner}</span>
              </span>

              <span className="h-1.5 w-[170px] max-w-full shrink-0 overflow-hidden rounded-full bg-surface-3">
                <span
                  className="block h-full rounded-full bg-brand"
                  style={{ width: `${Math.round(b.share * 100)}%` }}
                />
              </span>

              <span className="flex-1" />

              <span className="w-10 shrink-0 text-right text-lg leading-7 font-bold tabular-nums text-ink">
                {b.n}
              </span>

              <Link
                to={b.to}
                className="w-[68px] shrink-0 text-right text-[13px] font-semibold text-brand transition-colors hover:text-brand-deep"
              >
                Xử lý →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Chart
          title="Giao dịch 6 tháng gần nhất"
          note="Tổng hợp các giao dịch bàn giao đã chốt biên nhận hoàn tất. Bảng dưới thể hiện khối lượng, bình quân mỗi giao dịch và tốc độ tăng trưởng."
        >
          <ColumnChart data={trend.map((t) => ({ label: t.month, value: Math.max(t.handovers, 0) }))} />

          <div className="mt-5">
            <Table
              head={[
                "Tháng",
                "Giao dịch",
                "Tăng so với tháng trước",
                "Khối lượng (kg)",
                "Bình quân mỗi giao dịch",
              ]}
            >
              {trend.map((t, i) => {
                const prev = trend[i - 1]
                const growth =
                  prev && prev.handovers > 0
                    ? ((t.handovers - prev.handovers) / prev.handovers) * 100
                    : null
                return (
                  <tr key={t.month}>
                    <Td className="font-semibold whitespace-nowrap text-ink">{t.month}</Td>
                    <Td className="tabular-nums whitespace-nowrap">{fmtInt(t.handovers)}</Td>
                    <Td className="tabular-nums whitespace-nowrap">
                      {growth === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={growth >= 0 ? "text-brand-deep" : "text-warn"}>
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
        </Chart>
      </section>

      <section>
        <Chart
          title="AI quét đúng và khiếu nại sai, theo nhóm rác"
          note="Hai dải dùng chung một mẫu số tổng lượt quét để trực quan hoá chênh lệch thật sự giữa độ chính xác và tỷ lệ báo nhầm."
          to="/staff/ai-review"
          cta="Ảnh AI sai"
        >
          <div className="grid gap-6 lg:grid-cols-2">
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
        </Chart>
      </section>

      <section>
        <Chart
          title="Độ chính xác nhận diện theo lớp rác"
          note={`Đo trên tập kiểm chứng, trung bình toàn hệ thống ${summary.aiAccuracy}%. Lớp dưới đường cơ sở là nhóm cần ưu tiên bổ sung ảnh huấn luyện.`}
          to="/staff/dataset"
          cta="Tập dữ liệu"
        >
          <ul className="flex flex-col">
            {DATASET.byClass.map((c) => {
              const below = c.accuracy < summary.aiAccuracy
              return (
                <li
                  key={c.label}
                  className="grid grid-cols-[minmax(0,132px)_1fr_92px] items-center gap-3 py-1.5"
                >
                  <span className="truncate text-[13px] text-body">{c.label}</span>
                  <span className="relative h-2 overflow-hidden rounded-full bg-surface-3">
                    <span
                      className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,var(--color-mint),var(--color-brand))]"
                      style={{ width: `${c.accuracy}%` }}
                    />
                    <span
                      className="absolute inset-y-0 w-px bg-ink/45"
                      style={{ left: `${summary.aiAccuracy}%` }}
                    />
                  </span>
                  <span className="text-right text-[13px] font-semibold tabular-nums text-ink">
                    {c.accuracy}%
                  </span>
                  <span className="sr-only">
                    {below ? "Dưới trung bình toàn hệ thống" : "Bằng hoặc trên trung bình"}
                  </span>
                </li>
              )
            })}
          </ul>
        </Chart>
      </section>
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
      <ul className="mt-2">
        {rows.map((r) => (
          <li
            key={r.label}
            className="grid grid-cols-[minmax(0,86px)_1fr_92px] items-center gap-x-3 gap-y-0.5 py-1.5"
          >
            <span className="truncate text-[13px] text-body">{r.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
              <span
                className="block h-full rounded-full bg-brand"
                style={{ width: `${Math.max((r.value / peak) * 100, 0.8)}%` }}
              />
            </span>
            <span className="text-right text-[13px] font-semibold tabular-nums text-ink">
              {fmtInt(r.value)}
            </span>
            <span className="col-start-2 col-end-3 text-[11px] tabular-nums text-muted">
              {r.note} · {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Chart({
  title,
  note,
  to,
  cta,
  children,
}: {
  title: string
  note: string
  to?: string
  cta?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">{title}</h2>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <p className="max-w-[52ch] text-sm text-muted">{note}</p>
          {to && cta && (
            <Link
              to={to}
              className="text-[13px] font-semibold text-brand whitespace-nowrap transition-colors hover:text-brand-deep"
            >
              {cta} →
            </Link>
          )}
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-line bg-white p-5">{children}</div>
    </div>
  )
}
