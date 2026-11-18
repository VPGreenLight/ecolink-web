import { useEffect, useState } from "react"
import { fmt, LEADERBOARD, type Rank } from "@/data/rewards"
import { fetchLeaderboard, type LeaderboardCycleDto } from "@/lib/gamificationApi"
import { hasLiveBackendAuth } from "@/lib/session"

type BoardRow = Rank & {
  id?: string
  neededAbove?: number
  recycledKg?: number
}

/** Bảng xếp hạng theo điểm xếp hạng (BR-GAM-07: đổi quà không làm tụt hạng). */
export default function Leaderboard() {
  const [liveAuth] = useState(() => hasLiveBackendAuth())
  const [rows, setRows] = useState<BoardRow[]>(() => (liveAuth ? [] : LEADERBOARD))
  const [cycle, setCycle] = useState<LeaderboardCycleDto | null>(null)
  const [myEntry, setMyEntry] = useState<BoardRow | null>(null)
  const [loading, setLoading] = useState(liveAuth)

  useEffect(() => {
    let active = true
    if (liveAuth) setLoading(true)
    fetchLeaderboard({ top: 100 })
      .then((res) => {
        if (!active || !res.data) return
        setCycle(res.data.activeCycle ?? null)
        const items = (res.data.items ?? []).map((x) => ({
          id: x.userId,
          name: x.fullName,
          area: x.area || "Cộng đồng Xanh EcoLink",
          points: x.totalPoints,
          you: x.isCurrentUser,
          neededAbove: x.pointsNeededForNextRank,
          recycledKg: x.totalRecycledKg,
        }))
        if (items.length > 0 || liveAuth) {
          setRows(items)
        }
        if (res.data.myEntry && !items.some((x) => x.you)) {
          setMyEntry({
            id: res.data.myEntry.userId,
            name: res.data.myEntry.fullName,
            area: res.data.myEntry.area || "Cộng đồng Xanh EcoLink",
            points: res.data.myEntry.totalPoints,
            you: true,
            neededAbove: res.data.myEntry.pointsNeededForNextRank,
          })
        } else {
          setMyEntry(null)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [liveAuth])

  const [first, second, third] = rows
  const rest = rows.slice(3)

  return (
    <section className="mt-10 first:mt-0">
      {/* Top 3 + list bao bằng một khung chung border; cap 100 rows */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(15,31,21,0.05)]">
        {/* Băng nền dọc giữa, chữ trắng trên brand-deep, 2 lá vàng phẳng hai bên */}
        <div className="flex items-center justify-center gap-2.5 border-b border-line-soft bg-brand-deep px-4 py-2.5 text-center">
          <LaurelIcon className="size-4 text-[#d9ae52]" />
          <p className="text-[11px] font-bold tracking-[0.12em] text-white sm:text-xs">
            TOP {Math.min(rows.length || LEADERBOARD.length, 100)} ĐIỂM XANH
            {cycle ? ` · ${cycle.name}` : ""}
          </p>
          <LaurelIcon className="size-4 -scale-x-100 text-[#d9ae52]" />
        </div>

        {loading && rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            Đang tải bảng xếp hạng từ hệ thống...
          </p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            Chưa có dữ liệu xếp hạng trong chu kỳ hiện tại. Hãy tích điểm từ thu gom và điểm danh!
          </p>
        ) : (
          <>
            {/* Podium */}
            <ol className="grid grid-cols-3 items-end gap-2 border-b border-line-soft px-3 pt-[34px] pb-5 sm:gap-4 sm:px-6">
              <PodiumCard rank={2} person={second} />
              <PodiumCard rank={1} person={first} />
              <PodiumCard rank={3} person={third} />
            </ol>

            {/* Bảng 4+: hàng nhãn cột; hiển thị tối đa top 100 */}
            {(rest.length > 0 || myEntry) && (
              <ol className="divide-y divide-line-soft">
                <li
                  aria-hidden="true"
                  className="grid grid-cols-[52px_1fr_auto] items-center gap-3 px-4 py-2 text-[11px] font-semibold text-muted sm:px-5"
                >
                  <span>#</span>
                  <span>Thành viên</span>
                  <span className="flex items-center justify-end gap-1.5 text-right">
                    Điểm
                    <img
                      src="/assets/AI/ecolink-coin.png"
                      alt="EcoLink coin"
                      className="size-[35px] object-contain"
                    />
                  </span>
                </li>
                {rest.slice(0, 97).map((r, i) => {
                  const rank = i + 4
                  const above = rows[i + 2]?.points
                  const gap = r.neededAbove ?? (above ? Math.max(0, above - r.points) : 0)
                  return (
                    <li
                      key={r.id ?? r.name}
                      className={`grid grid-cols-[52px_1fr_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/70 sm:px-5 ${
                        r.you ? "bg-brand/8" : ""
                      }`}
                    >
                      <span className="text-sm font-semibold tabular-nums text-muted">
                        {String(rank).padStart(2, "0")}
                      </span>
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-bold text-brand-deep"
                        >
                          {initials(r.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {r.name}
                            {r.you && (
                              <span className="ml-1.5 text-[11px] font-semibold text-brand">
                                Bạn
                              </span>
                            )}
                          </p>
                          <p className="truncate text-[11px] text-muted">
                            {r.you && gap > 0 ? `Cần ${fmt(gap)} điểm để vượt` : r.area}
                          </p>
                        </div>
                      </div>
                      <span className="flex items-center justify-end gap-1.5 text-sm font-semibold tabular-nums text-ink">
                        {fmt(r.points)}
                        <img
                          src="/assets/AI/ecolink-coin.png"
                          alt="EcoLink coin"
                          className="size-[30px] object-contain"
                        />
                      </span>
                    </li>
                  )
                })}
                {myEntry && (
                  <li className="grid grid-cols-[52px_1fr_auto] items-center gap-3 bg-brand/8 px-4 py-2.5 sm:px-5">
                    <span className="text-sm font-semibold tabular-nums text-brand">•</span>
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/16 text-[11px] font-bold text-brand-deep"
                      >
                        {initials(myEntry.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {myEntry.name}
                          <span className="ml-1.5 text-[11px] font-semibold text-brand">
                            Bạn
                          </span>
                        </p>
                        <p className="truncate text-[11px] text-muted">
                          {myEntry.neededAbove && myEntry.neededAbove > 0
                            ? `Cần ${fmt(myEntry.neededAbove)} điểm để vượt`
                            : myEntry.area}
                        </p>
                      </div>
                    </div>
                    <span className="flex items-center justify-end gap-1.5 text-sm font-semibold tabular-nums text-ink">
                      {fmt(myEntry.points)}
                      <img
                        src="/assets/AI/ecolink-coin.png"
                        alt="EcoLink coin"
                        className="size-[30px] object-contain"
                      />
                    </span>
                  </li>
                )}
              </ol>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function PodiumCard({ rank, person }: { rank: 1 | 2 | 3; person?: BoardRow }) {
  const top = rank === 1
  // Medal phẳng vàng/bạc/đồng, số đậm tối màu, viền trắng mảnh — không gradient.
  const medal =
    rank === 1
      ? "bg-[#e9c15b] text-[#3f2d02]"
      : rank === 2
        ? "bg-[#cdd3d0] text-[#3b4a43]"
        : "bg-[#d9a069] text-[#46280d]"
  const size = top
    ? "size-28 sm:size-[155px]"
    : rank === 2
      ? "size-24 sm:size-[132px]"
      : "size-20 sm:size-[110px]"
  const font = top
    ? "text-4xl sm:text-5xl"
    : rank === 2
      ? "text-3xl sm:text-4xl"
      : "text-2xl sm:text-3xl"
  const points = top ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl"
  const avatar = top
    ? "bg-brand-deep text-white"
    : rank === 2
      ? "bg-brand/16 text-brand-deep"
      : "bg-surface-3 text-ink"

  const rise = top
    ? "-translate-y-4 sm:-translate-y-6"
    : rank === 2
      ? "-translate-y-1.5"
      : ""

  return (
    <li className={`flex flex-col items-center justify-start px-2 pb-1 text-center sm:px-4 ${rise}`}>
      <div className="relative">
        <span
          className={`grid shrink-0 place-items-center overflow-hidden rounded-full font-bold ${avatar} ${size} ${font}`}
        >
          {person?.avatar ? (
            <img
              src={person.avatar}
              alt={person.name}
              className="size-full rounded-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : person ? (
            initials(person.name)
          ) : (
            "—"
          )}
        </span>
        <span
          className={`absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border-2 border-white text-[11px] font-extrabold tabular-nums sm:size-8 sm:text-xs ${medal}`}
        >
          {rank}
        </span>
      </div>

      <p className="mt-4 w-full truncate text-center text-sm font-bold text-brand-deep sm:text-base">
        {person ? (
          <>
            {person.name}
            {person.you && <span className="ml-1 text-xs text-brand">(bạn)</span>}
          </>
        ) : (
          "Đang chờ hạng"
        )}
      </p>
      <p className="w-full truncate text-[11px] text-muted">
        {person ? person.area : "—"}
      </p>
      <p className={`mt-1.5 w-full truncate font-bold tabular-nums text-ink ${points}`}>
        {person ? fmt(person.points) : "0"}
      </p>
    </li>
  )
}

function LaurelIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 19c1-5 4.5-8.6 10.5-10M10.5 8.5C9 11 9 14 10 17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M15.5 3.5c.3 2.8-.6 5.5-2.3 7.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="1.5 2.4"
      />
    </svg>
  )
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
