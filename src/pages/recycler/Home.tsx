import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  MapPin,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
} from "lucide-react"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import { initApiLoading, initApiState, isSsrSmokeTest } from "@/lib/hydration"
import { MY_HANDOVERS, type HandoverStatus } from "@/data/handover"
import { fmtVnd } from "@/data/ops"
import {
  fetchHandoverOrdersResult,
  fetchRecyclerStatus,
  fetchRecyclerTransactions,
  toggleRecyclerOnlineStatus,
  type RecyclerProfileDto,
  type TransactionHistoryItemDto,
} from "@/lib/recyclerWorkflowApi"
import { useEntitlements } from "@/lib/servicePackageApi"
import { getSession, hasLiveBackendAuth } from "@/lib/session"

type UpcomingRow = {
  id: string
  address: string
  date: string
  slot: string
  status: HandoverStatus
  pickupLat?: number
  pickupLng?: number
}


/** R-02 Bật/tắt trạng thái hoạt động trực tiếp trên bản đồ (`/map`) + R-01 Cập nhật ghim kho bãi.
 *
 *  Công tắc thật có `role="switch"` và `aria-checked`, kết nối trực tiếp tới
 *  `PATCH /api/v1/recycler/availability` của `RecyclerController`:
 *  - Khi tắt (`Offline`), ghim cơ sở lập tức ẩn khỏi `/map`, còn các lịch đang chờ xử lý vẫn giữ nguyên (`BR-MTH-06`).
 *  - Khi bật (`Online`), ghim cơ sở hiện trở lại ngay trên `/map`. */
export default function RecyclerHome() {
  const [open, setOpen] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [actionErr, setActionErr] = useState("")

  const liveAuth = hasLiveBackendAuth()
  const [profile, setProfile] = useState<RecyclerProfileDto>(() =>
    liveAuth
      ? {
          recyclerId: "",
          facilityName: getSession()?.name || "Đang tải hồ sơ cơ sở...",
          representativeName: getSession()?.name || "",
          businessAddress: "",
          latitude: 21.0182,
          longitude: 105.5345,
          operatingHours: "07:30 - 19:00",
          contactPhone: "",
          verificationStatus: "Verified",
          activeStatus: "Online",
          activePriceCount: 0,
        }
      : {
          recyclerId: "22222222-2222-2222-2222-222222222222",
          facilityName: "Vựa phế liệu EcoGreen Hòa Lạc",
          representativeName: "Trần Thu Gom",
          businessAddress: "Số 18 Đại lộ Thăng Long, Khu CNC Hòa Lạc, Thạch Thất, Hà Nội",
          latitude: 21.0138,
          longitude: 105.5256,
          operatingHours: "07:30 - 18:30",
          contactPhone: "0988776655",
          verificationStatus: "Verified",
          activeStatus: "Online",
          activePriceCount: 4,
        },
  )

  const entitlements = useEntitlements()


  const [loadingHandovers, setLoadingHandovers] = useState<boolean>(() => initApiLoading(true))
  const [loadingTx, setLoadingTx] = useState<boolean>(() => initApiLoading(true))
  const [handovers, setHandovers] = useState<UpcomingRow[]>(() =>
    initApiState([], MY_HANDOVERS.filter((h) => h.status !== "done")),
  )
  const [txSummary, setTxSummary] = useState(() =>
    initApiState(
      { totalCount: 0, totalAmountCash: 0, totalWeightKg: 0 },
      { totalCount: 18, totalAmountCash: 4250000, totalWeightKg: 312 },
    ),
  )
  const [txItems, setTxItems] = useState<TransactionHistoryItemDto[]>([])
  const [txSearch, setTxSearch] = useState("")


  useEffect(() => {
    if (isSsrSmokeTest()) return
    let active = true
    void fetchRecyclerStatus()
      .then((res) => {
        if (!active) return
        setProfile(res.profile)
        setOpen(res.isOnline)
      })
      .catch((err) => {
        if (!active) return
        if (liveAuth) {
          setActionErr((prev) =>
            prev || (err instanceof Error ? err.message : "Không thể tải trạng thái cơ sở."),
          )
        }
      })

    void fetchRecyclerTransactions(undefined, undefined, 1, 20)
      .then((res) => {
        if (!active) return
        if (res.fromBackend || !liveAuth) {
          setTxSummary({
            totalCount: res.data.totalCount,
            totalAmountCash: res.data.totalAmountCash,
            totalWeightKg: res.data.totalWeightKg,
          })
          setTxItems(res.data.items ?? [])
        }
      })
      .catch((err) => {
        if (!active) return
        if (liveAuth) {
          setActionErr((prev) =>
            prev || (err instanceof Error ? err.message : "Không thể tải thống kê giao dịch cơ sở."),
          )
        }
      })
      .finally(() => {
        if (active) setLoadingTx(false)
      })

    void fetchHandoverOrdersResult("recycler")
      .then((res) => {
        if (!active) return
        if (res.fromBackend) {
          const openRows: UpcomingRow[] = res.orders
            .filter((s) => s.status === "pending" || s.status === "accepted")
            .map((s) => ({
              id: s.id,
              address: s.address,
              date: s.date,
              slot: s.slot,
              status: s.status === "accepted" ? "accepted" : "pending",
              pickupLat: s.pickupLat,
              pickupLng: s.pickupLng,
            }))
          setHandovers(openRows)
        } else {
          const existingIds = new Set(MY_HANDOVERS.map((m) => m.id))
          const fresh: UpcomingRow[] = res.orders
            .filter((s) => !existingIds.has(s.id))
            .map((s) => ({
              id: s.id,
              address: s.address,
              date: s.date,
              slot: s.slot,
              status: s.status === "accepted" ? "accepted" : "pending",
              pickupLat: s.pickupLat,
              pickupLng: s.pickupLng,
            }))
          if (fresh.length > 0) {
            setHandovers([...fresh, ...MY_HANDOVERS.filter((h) => h.status !== "done")])
          }
        }
      })
      .catch((err) => {
        if (!active) return
        if (liveAuth) {
          setActionErr((prev) =>
            prev || (err instanceof Error ? err.message : "Không thể tải lịch thu gom đang mở."),
          )
        }
      })
      .finally(() => {
        if (active) setLoadingHandovers(false)
      })

    return () => {
      active = false
    }
  }, [liveAuth])


  const handleToggleAvailability = async () => {
    const nextOnline = !open
    setToggling(true)
    setActionErr("")
    try {
      const res = await toggleRecyclerOnlineStatus(nextOnline)
      setOpen(res.isOnline)
    } catch (err) {
      setActionErr(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật trạng thái hoạt động lúc này.",
      )
    } finally {
      setToggling(false)
    }
  }


  const isKybVerified =
    String(profile.verificationStatus ?? "").toLowerCase() === "verified"

  const chartData = useMemo(() => {
    const monthNames = ["T6", "T7", "T8", "T9", "T10", "T11"]
    const monthlyKg = new Map<string, number>()
    const monthlyCash = new Map<string, number>()
    for (const m of monthNames) {
      monthlyKg.set(m, 0)
      monthlyCash.set(m, 0)
    }

    const catKg = new Map<string, number>()
    for (const tx of txItems) {
      const dt = new Date(tx.completedAt)
      const label = Number.isNaN(dt.getTime()) ? "T11" : `T${dt.getMonth() + 1}`
      if (monthlyKg.has(label)) {
        monthlyKg.set(label, (monthlyKg.get(label) ?? 0) + (tx.totalWeightKg || 0))
        monthlyCash.set(label, (monthlyCash.get(label) ?? 0) + (tx.totalAmountCash || 0))
      }
      const cats = tx.categories.length > 0 ? tx.categories : ["Khác"]
      const share = (tx.totalWeightKg || 0) / cats.length
      for (const c of cats) {
        catKg.set(c, (catKg.get(c) ?? 0) + share)
      }
    }

    const hasRealMonthly = Array.from(monthlyKg.values()).some((v) => v > 0)
    const fallbackKg = [38, 46, 52, 49, 61, 66]
    const fallbackCash = [480000, 620000, 740000, 690000, 830000, 890000]

    const series = monthNames.map((label, idx) => ({
      label,
      kg: hasRealMonthly ? Math.round((monthlyKg.get(label) ?? 0) * 10) / 10 : fallbackKg[idx],
      cash: hasRealMonthly ? Math.round(monthlyCash.get(label) ?? 0) : fallbackCash[idx],
    }))

    const palette = ["#278733", "#0ea5e9", "#f59e0b", "#67dc99"]
    const rawCats =
      catKg.size > 0
        ? Array.from(catKg.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
        : [
            ["Nhựa tái chế", 124],
            ["Giấy & Carton", 98],
            ["Kim loại", 56],
            ["Thủy tinh", 34],
          ]
    const catTotal = Math.max(
      1,
      rawCats.reduce((acc, [, v]) => acc + Number(v), 0),
    )
    const categories = rawCats.map(([name, val], idx) => ({
      name: String(name),
      kg: Math.round(Number(val) * 10) / 10,
      pct: Math.round((Number(val) / catTotal) * 100),
      color: palette[idx % palette.length],
    }))

    const pendingCount = handovers.filter((h) => h.status === "pending").length
    const acceptedCount = handovers.filter((h) => h.status === "accepted").length
    const doneCount = txSummary.totalCount
    const totalOrders = Math.max(1, pendingCount + acceptedCount + doneCount)

    return {
      series,
      maxKg: Math.max(1, ...series.map((s) => s.kg)),
      maxCash: Math.max(1, ...series.map((s) => s.cash)),
      categories,
      isSampleSeries: !hasRealMonthly,
      statusRows: [
        {
          label: "Đã hoàn tất",
          count: doneCount,
          pct: Math.round((doneCount / totalOrders) * 100),
          bar: "bg-brand",
        },
        {
          label: "Đã nhận lịch",
          count: acceptedCount,
          pct: Math.round((acceptedCount / totalOrders) * 100),
          bar: "bg-sky-500",
        },
        {
          label: "Chờ xác nhận",
          count: pendingCount,
          pct: Math.round((pendingCount / totalOrders) * 100),
          bar: "bg-amber-500",
        },
      ],
      totalStatusCount: pendingCount + acceptedCount + doneCount,
    }
  }, [handovers, txItems, txSummary.totalCount])

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="VẬN HÀNH"
        title="Tổng quan cơ sở thu mua"
        body="Bật trạng thái hoạt động để hiện trên bản đồ và nhận yêu cầu mới. Tắt khi bạn không ra thu gom được."
        action={
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <Link
              to="/recycler/packages"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand/25 bg-brand/6 px-3.5 text-sm font-semibold whitespace-nowrap text-brand-deep transition-colors hover:bg-brand/12"
            >
              {entitlements.hasVerifiedBlueBadge ? (
                <>
                  <Star className="size-3.5 shrink-0 text-amber-500" />
                  <span>Gói Pro · Tích xanh &amp; Ghim nổi bật</span>
                </>
              ) : (
                <span>Gói {entitlements.currentTier} · Quản lý gói dịch vụ</span>
              )}
            </Link>

            <div className="flex items-center gap-2">
              {entitlements.hasVerifiedBlueBadge && (
                <span className="inline-flex h-9 items-center gap-1 rounded-full bg-sky-50 px-2.5 text-[11px] font-bold whitespace-nowrap text-sky-700 ring-1 ring-sky-200">
                  <ShieldCheck className="size-3.5 shrink-0" />
                  <span>Tích xanh Pro</span>
                </span>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={open}
                aria-label="Trạng thái hoạt động"
                title={
                  open
                    ? `${profile.facilityName}: Đang hiện trên bản đồ và nhận yêu cầu mới`
                    : `${profile.facilityName}: Đã ẩn khỏi bản đồ`
                }
                disabled={toggling}
                onClick={() => void handleToggleAvailability()}
                className={`inline-flex h-9 shrink-0 items-center justify-between gap-2.5 rounded-full border px-3.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  open
                    ? "border-brand/40 bg-brand/10 text-brand-deep hover:bg-brand/15"
                    : "border-line bg-surface-2 text-body hover:bg-surface-3"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-muted">Trạng thái:</span>
                  <span className="min-w-[92px] text-left">
                    {toggling ? "Đang lưu..." : open ? "Đang hoạt động" : "Đã tắt"}
                  </span>
                </span>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    open ? "bg-brand" : "bg-sage-line"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-4 rounded-full bg-white shadow-xs transition-transform ${
                      open ? "translate-x-4 left-0.5" : "translate-x-0 left-0.5"
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        }
      />

      {!isKybVerified && (
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex items-center gap-2 font-bold">
              <ShieldAlert className="size-4 shrink-0 text-amber-700" />
              Hồ sơ đối tác thu mua đang ở trạng thái:{" "}
              <span>
                {profile.verificationStatus === "Rejected" ? "Cần bổ sung (Rejected)" : "Chờ thẩm định (Pending)"}
              </span>
            </p>
            {profile.verificationStatus === "Rejected" ? (
              <p className="text-sm leading-6">
                <b>Lý do từ chối:</b> {profile.rejectionReason || "Hồ sơ chưa đạt yêu cầu xác minh."}{" "}
                Theo quy chuẩn <code>BR-MTH-02</code>, khi bạn cập nhật lại thông tin hoặc ghim kho bãi bên dưới, hồ sơ sẽ tự động chuyển về <b>Pending</b> để nhân viên xét duyệt lại.
              </p>
            ) : (
              <p className="text-sm leading-6">
                Nhân viên vận hành đang kiểm tra giấy phép pháp lý và tọa độ kho bãi của bạn. Khi được duyệt, cơ sở có thể bật trực tuyến trên bản đồ.
              </p>
            )}
          </div>
          <Link to="/join-recycler" className="btn-outline min-h-10 shrink-0 bg-white px-4 text-sm font-semibold">
            Xem / nộp lại hồ sơ KYB →
          </Link>
        </section>
      )}

      {actionErr && (
        <p
          role="alert"
          className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn"
        >
          {actionErr}
        </p>
      )}

      {/* 4 thẻ chỉ số vận hành theo lưới Bento */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Yêu cầu đang mở",
            value: String(handovers.length),
            loading: loadingHandovers,
            note: "Chờ xác nhận hoặc đã nhận",
            icon: CalendarClock,
          },
          {
            label: "Khối lượng đã thu gom",
            value: `${txSummary.totalWeightKg.toLocaleString("vi-VN")} kg`,
            loading: loadingTx,
            note: "Biên nhận đã hoàn tất",
            icon: Scale,
          },
          {
            label: "Tổng giá trị đã chi trả",
            value: fmtVnd(txSummary.totalAmountCash),
            loading: loadingTx,
            note: "Biên nhận thu mua hoàn tất",
            icon: Banknote,
          },
          {
            label: "Đơn đã hoàn tất",
            value: txSummary.totalCount.toLocaleString("vi-VN"),
            loading: loadingTx,
            note: "Lịch sử giao dịch của cơ sở",
            icon: CheckCircle2,
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
                  {item.loading ? (
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

      {/* 4 biểu đồ tổng quan vận hành */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Biểu đồ 1: Khối lượng thu gom 6 tháng gần đây */}
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,31,21,0.08)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-ink">Khối lượng thu gom (kg)</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Biến động sản lượng 6 tháng gần đây{!loadingTx && chartData.isSampleSeries ? " (dữ liệu tham khảo)" : ""}
                </p>
              </div>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand-deep">
                6 tháng
              </span>
            </div>
            {loadingTx ? (
              <div className="flex h-40 items-end justify-between gap-2.5 pt-2" aria-hidden="true">
                {["T6", "T7", "T8", "T9", "T10", "T11"].map((label) => (
                  <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="h-4 w-7 animate-pulse rounded bg-surface-2" />
                    <div className="flex h-28 w-full items-end rounded-lg bg-surface-2/70 p-1">
                      <div className="h-1/2 w-full animate-pulse rounded-md bg-surface-3" />
                    </div>
                    <span className="text-xs font-medium text-muted">{label}</span>
                  </div>
                ))}
              </div>
            ) : (
            <div className="flex h-40 items-end justify-between gap-2.5 pt-2">
              {chartData.series.map((bar) => {
                const hPct = Math.max(10, Math.round((bar.kg / chartData.maxKg) * 100))
                return (
                  <div key={bar.label} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[11px] font-semibold tabular-nums text-ink">
                      {bar.kg}
                    </span>
                    <div className="flex h-28 w-full items-end rounded-lg bg-surface-2/70 p-1">
                      <div
                        className="w-full rounded-md bg-gradient-to-t from-brand-deep to-brand transition-[height] duration-300"
                        style={{ height: `${hPct}%` }}
                        title={`${bar.label}: ${bar.kg} kg`}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted">{bar.label}</span>
                  </div>
                )
              })}
            </div>
            )}
          </section>
        </div>

        {/* Biểu đồ 2: Cơ cấu loại phế liệu */}
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,31,21,0.08)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-ink">Cơ cấu loại phế liệu</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Tỉ trọng khối lượng theo nhóm vật liệu chính
                </p>
              </div>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                Top 4
              </span>
            </div>
            {loadingTx ? (
              <div className="flex flex-col items-center gap-5 sm:flex-row" aria-hidden="true">
                <div className="size-28 shrink-0 animate-pulse rounded-full border-[14px] border-surface-2 bg-white" />
                <ul className="w-full flex-1 space-y-2.5">
                  {[0, 1, 2, 3].map((i) => (
                    <li key={i} className="h-4 w-full animate-pulse rounded bg-surface-2" />
                  ))}
                </ul>
              </div>
            ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              {(() => {
                const r = 42
                const c = 2 * Math.PI * r
                let offset = 0
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
                    {chartData.categories.map((cat) => {
                      const segLen = (cat.pct / 100) * c
                      const el = (
                        <circle
                          key={cat.name}
                          cx="56"
                          cy="56"
                          r={r}
                          fill="none"
                          stroke={cat.color}
                          strokeWidth="14"
                          strokeDasharray={`${segLen} ${c}`}
                          strokeDashoffset={-offset}
                        />
                      )
                      offset += segLen
                      return el
                    })}
                  </svg>
                )
              })()}
              <ul className="w-full flex-1 space-y-2 text-xs">
                {chartData.categories.map((cat) => (
                  <li key={cat.name} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: cat.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate font-medium text-ink">{cat.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-body">
                      {cat.pct}% ({cat.kg} kg)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            )}
          </section>
        </div>

        {/* Biểu đồ 3: Xu hướng giá trị chi trả */}
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,31,21,0.08)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-ink">Xu hướng chi trả thu mua</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Tổng tiền thanh toán cho người dân qua các tháng
                </p>
              </div>
              <span className="min-w-[84px] rounded-full bg-brand/10 px-2.5 py-0.5 text-center text-[11px] font-bold whitespace-nowrap tabular-nums text-brand-deep">
                {loadingTx ? "—" : fmtVnd(chartData.series[chartData.series.length - 1]?.cash ?? 0)}
              </span>
            </div>
            {loadingTx ? (
              <div aria-hidden="true">
                <div className="h-32 w-full animate-pulse rounded-xl bg-surface-2/75" />
                <div className="mt-1 flex justify-between px-1 text-xs font-medium text-muted">
                  {["T6", "T7", "T8", "T9", "T10", "T11"].map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
              </div>
            ) : (() => {
              const pts = chartData.series.map((item, idx) => {
                const x = 16 + (idx * 268) / Math.max(1, chartData.series.length - 1)
                const y = 92 - Math.round((item.cash / chartData.maxCash) * 68)
                return { ...item, x, y }
              })
              const linePath = pts.map((p) => `${p.x},${p.y}`).join(" ")
              const areaPath = `16,96 ${linePath} 284,96`
              return (
                <div>
                  <svg viewBox="0 0 300 108" className="h-32 w-full overflow-visible" aria-hidden="true">
                    <polygon points={areaPath} fill="rgba(39, 135, 51, 0.12)" />
                    <polyline
                      fill="none"
                      stroke="#278733"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={linePath}
                    />
                    {pts.map((p) => (
                      <circle key={p.label} cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#278733" strokeWidth="2.5" />
                    ))}
                  </svg>
                  <div className="mt-1 flex justify-between px-1 text-xs font-medium text-muted">
                    {pts.map((p) => (
                      <span key={p.label}>{p.label}</span>
                    ))}
                  </div>
                </div>
              )
            })()}
          </section>
        </div>

        {/* Biểu đồ 4: Tỉ lệ trạng thái yêu cầu thu gom */}
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,31,21,0.08)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-ink">Tỉ lệ trạng thái đơn thu gom</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {loadingTx || loadingHandovers
                    ? "Đang đồng bộ phân bổ trạng thái xử lý"
                    : `Phân bổ trạng thái xử lý trên tổng ${chartData.totalStatusCount} đơn`}
                </p>
              </div>
              <span className="min-w-[58px] rounded-full bg-surface-2 px-2.5 py-0.5 text-center text-[11px] font-semibold whitespace-nowrap tabular-nums text-ink">
                {loadingTx || loadingHandovers ? "— đơn" : `${chartData.totalStatusCount} đơn`}
              </span>
            </div>
            {loadingTx || loadingHandovers ? (
              <div className="space-y-4" aria-hidden="true">
                <div className="h-4 w-full animate-pulse rounded-full bg-surface-2" />
                <div className="space-y-2.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-4 w-full animate-pulse rounded bg-surface-2" />
                  ))}
                </div>
              </div>
            ) : (
            <>
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-surface-2">
              {chartData.statusRows.map((row) =>
                row.pct > 0 ? (
                  <div
                    key={row.label}
                    className={`${row.bar} h-full transition-[width] duration-300`}
                    style={{ width: `${row.pct}%` }}
                    title={`${row.label}: ${row.count} (${row.pct}%)`}
                  />
                ) : null,
              )}
            </div>
            <div className="space-y-2.5">
              {chartData.statusRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <span className={`size-2.5 rounded-full ${row.bar}`} aria-hidden="true" />
                    {row.label}
                  </span>
                  <span className="font-semibold tabular-nums text-body">
                    {row.count} đơn ({row.pct}%)
                  </span>
                </div>
              ))}
            </div>
            </>
            )}
          </section>
        </div>
      </div>

      {/* Lịch thu gom sắp tới */}
      <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex flex-col gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,31,21,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft pb-3.5">
              <div>
                <h2 className="text-base font-bold text-ink">Lịch thu gom sắp tới</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Các điểm hẹn người dân vừa đặt lịch bàn giao với cơ sở
                </p>
              </div>
              <Link
                to="/recycler/requests"
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line bg-surface-2 px-3.5 text-xs font-semibold text-brand-deep transition-colors hover:border-sage-line hover:bg-surface-3"
              >
                Xem tất cả yêu cầu
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="min-h-[120px]">
            {loadingHandovers ? (
              <p className="py-4 text-sm text-muted">Đang tải lịch thu gom...</p>
            ) : handovers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-surface-2/50 px-4 py-6 text-center text-sm text-muted">
                Chưa có lịch hẹn nào đang mở.
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {handovers.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-surface-2/55 px-4 py-3 transition-colors hover:border-sage-line hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-start gap-2 text-sm font-semibold text-ink">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                        <span>{h.address}</span>
                      </p>
                      <p className="mt-1 pl-6 text-xs text-muted tabular-nums">
                        {h.date} · {h.slot}
                        {typeof h.pickupLat === "number" && typeof h.pickupLng === "number" && (
                          <span className="ml-2 text-brand-deep">
                            · GPS: {h.pickupLat.toFixed(4)}, {h.pickupLng.toFixed(4)}
                          </span>
                        )}
                      </p>
                    </div>
                    <Status tone={h.status === "pending" ? "wait" : "todo"}>
                      {h.status === "pending" ? "Chờ xác nhận" : "Đã nhận"}
                    </Status>
                  </li>
                ))}
              </ul>
            )}
            </div>
          </section>
        </div>


      {/* Bảng giao dịch thu gom đã hoàn tất */}
      <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
        <section className="flex flex-col gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,31,21,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft pb-3.5">
            <div>
              <h2 className="text-base font-bold text-ink">Giao dịch thu gom đã hoàn tất</h2>
              <p className="mt-0.5 text-xs leading-5 text-muted">
                Tổng hợp các biên nhận đã được người dân xác nhận hoàn tất bàn giao.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="Lọc mã đơn, người dân, vật liệu..."
                aria-label="Lọc giao dịch đã hoàn tất"
                className="input h-11 min-h-10 pl-10 text-base sm:text-[15px]"
              />
            </div>
          </div>
          {(() => {
            const kw = txSearch.trim().toLowerCase()
            const filteredTx = txItems.filter(
              (it) =>
                !kw ||
                `${it.receiptCode} ${it.requestCode} ${it.counterpartName} ${it.categories.join(" ")}`
                  .toLowerCase()
                  .includes(kw),
            )
            if (filteredTx.length === 0) {
              return (
                <p className="rounded-xl border border-dashed border-line bg-surface-2/50 px-4 py-5 text-sm text-muted">
                  Chưa có giao dịch thu gom hoàn tất nào khớp bộ lọc.
                </p>
              )
            }
            return (
              <Table head={["Mã biên nhận", "Người dân", "Loại phế liệu", "Khối lượng", "Giá trị", "Thời điểm"]}>
                {filteredTx.map((it) => (
                  <tr key={it.receiptId || it.requestId}>
                    <Td className="font-mono text-sm font-semibold whitespace-nowrap text-ink">
                      {it.receiptCode || it.requestCode}
                    </Td>
                    <Td>{it.counterpartName}</Td>
                    <Td className="text-sm">{it.categories.join(", ") || "—"}</Td>
                    <Td className="tabular-nums whitespace-nowrap">{it.totalWeightKg} kg</Td>
                    <Td className="font-semibold tabular-nums whitespace-nowrap text-brand-deep">
                      {fmtVnd(it.totalAmountCash)}
                    </Td>
                    <Td className="text-sm tabular-nums whitespace-nowrap text-muted">
                      {new Date(it.completedAt).toLocaleString("vi-VN")}
                    </Td>
                  </tr>
                ))}
              </Table>
            )
          })()}
        </section>
      </div>
    </div>
  )
}
