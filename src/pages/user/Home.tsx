import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { PageHead, Stat, Table, TableSkeleton, Td } from "@/components/Portal"
import SponsoredAdBanner from "@/components/SponsoredAdBanner"
import { MY_HANDOVERS } from "@/data/handover"
import { LEADERBOARD, RANK_POINTS, getSpendPoints, fmt, tierProgress } from "@/data/rewards"
import { initApiLoading, initApiState } from "@/lib/hydration"
import {
  fetchLeaderboard,
  fetchMyEcoProfile,
  type EcoProfileDto,
} from "@/lib/gamificationApi"
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

/** Trang chủ sau đăng nhập của người dân. */
export default function UserHome() {
  const user = useUser()
  const entitlements = useEntitlements()
  const offlineTier = tierProgress()
  const [liveAuth] = useState(() => hasLiveBackendAuth())

  const [open, setOpen] = useState<OpenHandoverPreview[]>(() =>
    initApiState([], DEFAULT_OFFLINE_OPEN),
  )
  const [loadingOpen, setLoadingOpen] = useState<boolean>(() => initApiLoading(true))
  const [ecoProfile, setEcoProfile] = useState<EcoProfileDto | null>(null)
  const [myRank, setMyRank] = useState<{ rank: number; gap: number } | null>(null)
  const [loadingStats, setLoadingStats] = useState<boolean>(() => initApiLoading(liveAuth))

  const offlineInRank = LEADERBOARD.find((r) => r.you)
  const offlineAbove = LEADERBOARD.find((r) => r.points > RANK_POINTS)

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

    if (liveAuth) {
      Promise.all([
        fetchMyEcoProfile().catch(() => null),
        fetchLeaderboard({ top: 10 }).catch(() => null),
      ])
        .then(([profRes, lbRes]) => {
          if (!active) return
          if (profRes?.data) setEcoProfile(profRes.data)
          const me = lbRes?.data?.myEntry
          if (me) {
            setMyRank({ rank: me.rank, gap: me.pointsNeededForNextRank })
          }
        })
        .finally(() => {
          if (active) setLoadingStats(false)
        })
    }

    return () => {
      active = false
    }
  }, [liveAuth])

  const spendValue = liveAuth
    ? loadingStats
      ? "—"
      : fmt(ecoProfile?.currentGreenPoints ?? 0)
    : fmt(getSpendPoints())

  const treeTitle = liveAuth
    ? loadingStats
      ? "—"
      : ecoProfile
        ? `Cấp ${ecoProfile.treeLevel} · ${ecoProfile.treeStageTitle}`
        : "Cấp 1"
    : offlineTier.cur.name

  const treeNote = liveAuth
    ? ecoProfile
      ? `${fmt(ecoProfile.totalLifetimePoints)} điểm tích luỹ · ${Number(ecoProfile.totalRecycledKg).toFixed(1)} kg tái chế`
      : "Đang đồng bộ..."
    : offlineTier.next
      ? `Cần ${fmt(offlineTier.need)} điểm lên ${offlineTier.next.name}`
      : "Đã đạt hạng cao nhất"

  const rankValue = liveAuth
    ? loadingStats
      ? "—"
      : myRank
        ? `#${myRank.rank}`
        : "#—"
    : `#${offlineInRank ? LEADERBOARD.indexOf(offlineInRank) + 1 : "—"}`

  const rankNote = liveAuth
    ? myRank
      ? myRank.gap > 0
        ? `Cần ${fmt(myRank.gap)} điểm để vượt`
        : "Đang dẫn đầu bảng"
      : "Hoàn tất đơn thu gom để lên bảng"
    : offlineAbove
      ? `Cần ${fmt(offlineAbove.points - RANK_POINTS)} điểm để vượt`
      : "Bạn đang dẫn đầu"

  const progressPct = liveAuth
    ? ecoProfile && ecoProfile.experienceToNextLevel > 0
      ? Math.min(100, Math.round((ecoProfile.treeExperience / ecoProfile.experienceToNextLevel) * 100))
      : 100
    : offlineTier.pct

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
        <Stat label="Điểm tiêu dùng" value={spendValue} note="Dùng để đổi quà" />
        <Stat label="Hạng cây ảo" value={treeTitle} note={treeNote} />
        <Stat label="Xếp hạng" value={rankValue} note={rankNote} />
      </div>

      <section aria-label="Lối tắt chức năng" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            to: "/user/handover",
            title: "Yêu cầu bàn giao",
            desc: "Đặt lịch thu gom hoặc đổi giờ hẹn",
          },
          {
            to: "/chat",
            title: "Chatbox thương lượng",
            desc: "Nhắn tin, chốt giá và giờ với đối tác",
          },
          {
            to: "/user/receipt",
            title: "Biên nhận & Đánh giá",
            desc: "Xác nhận khối lượng cân & chấm 1–5 sao",
          },
          {
            to: "/feedback",
            title: "Khiếu nại & góp ý",
            desc: "Báo sai lệch cân đo hoặc hỗ trợ sự cố",
          },
        ].map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="card flex flex-col justify-between gap-1.5 border border-line bg-white p-4 transition-colors hover:border-brand/50 hover:bg-surface-2"
          >
            <span className="text-sm font-bold text-ink">{q.title}</span>
            <span className="text-xs leading-5 text-muted">{q.desc}</span>
          </Link>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="text-base font-bold text-ink">Yêu cầu đang mở</h2>
          {loadingOpen ? (
            <TableSkeleton rows={3} />
          ) : open.length === 0 ? (
            <p className="text-sm text-muted">
              Bạn không có yêu cầu nào đang chờ. Đặt lịch thu gom khi có rác cần
              bán.
            </p>
          ) : (
            <Table head={["Đối tác", "Ngày", "Khung giờ", "Thao tác"]}>
              {open.map((h) => (
                <tr key={h.id}>
                  <Td className="font-semibold text-ink">{h.recycler}</Td>
                  <Td className="tabular-nums whitespace-nowrap">{h.date}</Td>
                  <Td className="whitespace-nowrap">{h.slot}</Td>
                  <Td className="whitespace-nowrap">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <Link
                        to={`/chat?orderId=${encodeURIComponent(h.id)}&partnerName=${encodeURIComponent(h.recycler)}`}
                        className="text-brand hover:underline"
                      >
                        Chat
                      </Link>
                      <span className="text-line">·</span>
                      <Link
                        to={`/user/receipt?orderId=${encodeURIComponent(h.id)}`}
                        className="text-brand-deep hover:underline"
                      >
                        Biên nhận
                      </Link>
                    </div>
                  </Td>
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
            {treeTitle}
            {!liveAuth && offlineTier.next && (
              <span className="font-normal text-muted"> → {offlineTier.next.name}</span>
            )}
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tiến trình lên hạng"
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-[13px] leading-5 text-muted">
            {liveAuth
              ? ecoProfile
                ? `Bạn đã giảm thải ước tính ${ecoProfile.co2SavedKg} kg CO₂ qua EcoLink.`
                : "Điểm sinh ra từ giao rác đúng phân loại và điểm danh hằng ngày."
              : offlineTier.next
                ? `Cần thêm ${fmt(offlineTier.need)} điểm để lên ${offlineTier.next.name}. Điểm sinh ra từ giao rác đúng phân loại và điểm danh hằng ngày.`
                : "Bạn đã ở hạng cao nhất."}
          </p>
        </section>
      </div>
    </div>
  )
}
