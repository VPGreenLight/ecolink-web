import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { PageHead, Stat, Table, Td } from "@/components/Portal"
import SponsoredAdBanner from "@/components/SponsoredAdBanner"
import { MY_HANDOVERS } from "@/data/handover"
import { LEADERBOARD, RANK_POINTS, getSpendPoints, fmt, tierProgress } from "@/data/rewards"
import { fetchHandoverOrdersResult, type SyncedHandoverOrder } from "@/lib/recyclerWorkflowApi"
import { refreshMyEntitlementsSafely, useEntitlements } from "@/lib/servicePackageApi"
import { hasLiveBackendAuth, useUser } from "@/lib/session"

type OpenHandoverPreview = {
  id: string
  recycler: string
  date: string
  slot: string
}

const DEFAULT_OFFLINE_OPEN: OpenHandoverPreview[] = MY_HANDOVERS.filter(
  (h) => h.status === "pending" || h.status === "accepted" || h.status === "collected",
).map((h) => ({ id: h.id, recycler: h.recycler, date: h.date, slot: h.slot }))

/** Trang chủ sau đăng nhập của người dân: nối 3 việc đang dở thành một màn
 *  hình — có yêu cầu nào đang chờ, điểm đang ở hạng nào, bước kế tiếp là gì.
 *  Không lặp lại nội dung các trang chuyên biệt, chỉ dẫn tới. */
export default function UserHome() {
  const user = useUser()
  const entitlements = useEntitlements()
  const { cur, next, pct, need } = tierProgress()
  const [open, setOpen] = useState<OpenHandoverPreview[]>(() =>
    hasLiveBackendAuth() ? [] : DEFAULT_OFFLINE_OPEN,
  )
  const [loadingOpen, setLoadingOpen] = useState<boolean>(() => hasLiveBackendAuth())
  const inRank = LEADERBOARD.find((r) => r.you)
  const above = LEADERBOARD.find((r) => r.points > RANK_POINTS)

  useEffect(() => {
    let active = true
    void refreshMyEntitlementsSafely()
    void fetchHandoverOrdersResult("user")
      .then((res) => {
        if (!active) return
        if (res.fromBackend) {
          const liveOpen = res.orders
            .filter(
              (h: SyncedHandoverOrder) =>
                h.status === "pending" || h.status === "accepted" || h.status === "collected",
            )
            .map((h) => ({ id: h.id, recycler: h.recycler, date: h.date, slot: h.slot }))
          setOpen(liveOpen)
        }
      })
      .finally(() => {
        if (active) setLoadingOpen(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="TỔNG QUAN"
        title={`Xin chào, ${user || "bạn"}`}
        body="Từ đây bạn đặt lịch thu gom, nhận tiền về tài khoản và theo dõi điểm xanh của mình."
        action={
          <Link
            to="/user/payout"
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand-deep hover:bg-brand/10"
          >
            {entitlements.hasEcoPlusBadge
              ? `Hội viên ${entitlements.currentTier} · +20% điểm`
              : "Gói Basic · Nâng cấp Premium"}
          </Link>
        }
      />

      <SponsoredAdBanner upgradeTo="/user/payout" compact />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Yêu cầu đang mở" value={String(open.length)} note="Chờ hoặc đã nhận" />
        <Stat label="Điểm tiêu dùng" value={fmt(getSpendPoints())} note="Dùng để đổi quà" />
        <Stat label="Hạng cây ảo" value={cur.name} note={next ? `Cần ${fmt(need)} điểm lên ${next.name}` : "Đã đạt hạng cao nhất"} />
        <Stat label="Xếp hạng" value={`#${inRank ? LEADERBOARD.indexOf(inRank) + 1 : "—"}`} note={above ? `Cần ${fmt(above.points - RANK_POINTS)} điểm để vượt` : "Bạn đang dẫn đầu"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="text-base font-bold text-ink">Yêu cầu đang mở</h2>
          {loadingOpen ? (
            <p className="text-sm text-muted">Đang tải danh sách yêu cầu...</p>
          ) : open.length === 0 ? (
            <p className="text-sm text-muted">
              Bạn không có yêu cầu nào đang chờ. Đặt lịch thu gom khi có rác cần
              bán.
            </p>
          ) : (
            <Table head={["Đối tác", "Ngày", "Trạng thái"]}>
              {open.map((h) => (
                <tr key={h.id}>
                  <Td className="font-semibold text-ink">{h.recycler}</Td>
                  <Td className="tabular-nums whitespace-nowrap">{h.date}</Td>
                  <Td className="whitespace-nowrap">{h.slot}</Td>
                </tr>
              ))}
            </Table>
          )}
          <Link
            to="/user/handover"
            className="text-[13px] font-semibold text-brand hover:text-brand-deep"
          >
            Quản lý yêu cầu →
          </Link>
        </section>

        <section className="card flex flex-col gap-4 p-5">
          <h2 className="text-base font-bold text-ink">Tiến trình lên hạng</h2>
          <p className="text-sm font-semibold text-ink">
            {cur.name}
            {next && <span className="font-normal text-muted"> → {next.name}</span>}
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={next ? `Tiến độ lên hạng ${next.name}` : "Đã đạt hạng cao nhất"}
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[13px] leading-5 text-muted">
            {next
              ? `Cần thêm ${fmt(need)} điểm để lên ${next.name}. Điểm sinh ra từ giao rác đúng phân loại và điểm danh hằng ngày.`
              : "Bạn đã ở hạng cao nhất."}
          </p>
        </section>
      </div>
    </div>
  )
}