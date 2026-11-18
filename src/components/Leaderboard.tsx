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
    fetchLeaderboard({ top: 20 })
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
            area: res.data.myEntry.area,
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
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
          {cycle ? `Xếp hạng người dùng · ${cycle.name}` : "Xếp hạng người dùng"}
        </h2>
        <p className="text-sm text-muted">
          {cycle
            ? `Thưởng Top 1: +${fmt(cycle.top1BonusPoints)}đ · Top 2: +${fmt(cycle.top2BonusPoints)}đ · Top 3: +${fmt(cycle.top3BonusPoints)}đ`
            : "Theo điểm xếp hạng, cập nhật hằng ngày"}
        </p>
      </div>

      {loading && rows.length === 0 ? (
        <p className="card mt-6 px-5 py-10 text-center text-sm text-muted">
          Đang tải bảng xếp hạng từ hệ thống...
        </p>
      ) : rows.length === 0 ? (
        <p className="card mt-6 px-5 py-10 text-center text-sm text-muted">
          Chưa có dữ liệu xếp hạng trong chu kỳ hiện tại. Hãy tích điểm từ thu gom và điểm danh!
        </p>
      ) : (
        <>
          <ol className="mt-6 grid grid-cols-3 items-end gap-2 sm:gap-4">
            <PodiumCard rank={2} person={second} />
            <PodiumCard rank={1} person={first} />
            <PodiumCard rank={3} person={third} />
          </ol>

          {(rest.length > 0 || myEntry) && (
            <ol className="card mt-4 divide-y divide-line-soft overflow-hidden">
              {rest.map((r, i) => {
                const rank = i + 4
                const gap = r.neededAbove ?? Math.max(0, (rows[i + 2]?.points ?? r.points) - r.points)
                return (
                  <li
                    key={r.id ?? r.name}
                    className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${
                      r.you ? "bg-brand/8" : ""
                    }`}
                  >
                    <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted">
                      {rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {r.name}
                        {r.you && <span className="ml-1.5 text-xs text-brand">(bạn)</span>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {r.you && gap > 0
                          ? `Cần ${fmt(gap)} điểm để vượt người trên`
                          : r.area}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                      {fmt(r.points)}
                    </span>
                  </li>
                )
              })}

              {myEntry && (
                <li className="flex items-center gap-3 bg-brand/8 px-4 py-3 sm:px-5">
                  <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-brand">
                    •
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {myEntry.name}
                      <span className="ml-1.5 text-xs text-brand">(bạn)</span>
                    </p>
                    <p className="truncate text-xs text-muted">
                      {myEntry.neededAbove
                        ? `Cần ${fmt(myEntry.neededAbove)} điểm để vượt người trên`
                        : myEntry.area}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                    {fmt(myEntry.points)}
                  </span>
                </li>
              )}
            </ol>
          )}
        </>
      )}
    </section>
  )
}

function PodiumCard({ rank, person }: { rank: 1 | 2 | 3; person?: BoardRow }) {
  const top = rank === 1
  const shell = top
    ? "bg-brand text-white shadow-[0_10px_28px_rgba(15,31,21,0.16)]"
    : "border border-line bg-surface text-ink"
  const rise = top
    ? "-translate-y-8 pb-8 sm:-translate-y-10 sm:pb-12"
    : rank === 2
      ? "-translate-y-2"
      : ""
  const size = top ? "size-16 sm:size-20" : rank === 2 ? "size-11 sm:size-14" : "size-9 sm:size-12"
  const font = top ? "text-2xl" : rank === 2 ? "text-base sm:text-lg" : "text-sm sm:text-base"
  const name = top ? "text-[15px] sm:text-base" : "text-xs sm:text-sm"
  const points = top ? "text-2xl sm:text-3xl" : "text-sm sm:text-base"

  return (
    <li
      className={`flex flex-col items-center rounded-2xl px-2 pt-4 pb-4 text-center sm:px-4 sm:pt-5 sm:pb-5 ${rise} ${shell}`}
    >
      <span
        className={`grid shrink-0 place-items-center rounded-full font-bold tabular-nums ${
          top
            ? "bg-white/22 text-white ring-2 ring-white/40"
            : rank === 2
              ? "bg-brand/14 text-brand"
              : "bg-surface-3 text-ink"
        } ${size} ${font}`}
      >
        {rank}
      </span>

      <p className={`mt-3 w-full truncate font-bold ${name}`}>
        {person ? (
          <>
            {person.name}
            {person.you && (
              <span className={`ml-1 text-xs ${top ? "text-white/90" : "text-brand"}`}>
                (bạn)
              </span>
            )}
          </>
        ) : (
          "Đang chờ hạng"
        )}
      </p>
      <p className={`w-full truncate text-[11px] sm:text-xs ${top ? "text-white/70" : "text-muted"}`}>
        {person ? person.area : "—"}
      </p>
      <p
        className={`mt-2 w-full truncate font-bold tabular-nums ${
          top ? "text-white" : "text-ink"
        } ${points}`}
      >
        {person ? fmt(person.points) : "0"}
      </p>
    </li>
  )
}
