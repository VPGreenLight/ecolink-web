import { useEffect, useMemo, useState } from "react"
import { fmt, LEADERBOARD, type Rank } from "@/data/rewards"
import { fetchLeaderboard, type LeaderboardCycleDto } from "@/lib/gamificationApi"
import { hasLiveBackendAuth } from "@/lib/session"
import SearchFilterBar from "@/components/SearchFilterBar"
import PaginationBar, { paginateItems } from "@/components/PaginationBar"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"

type BoardRow = Rank & {
  id?: string
  role?: "User" | "Recycler" | string
  neededAbove?: number
  recycledKg?: number
}

const ROLE_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "user", label: "Người dân" },
  { key: "recycler", label: "Người thu gom" },
] as const

type RoleTab = (typeof ROLE_TABS)[number]["key"]

function RoleBadge({ role }: { role?: string }) {
  if (!role) return null
  const isRecycler = role.toLowerCase() === "recycler"
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        isRecycler
          ? "bg-sky-50 text-sky-800 border border-sky-200"
          : "bg-brand/10 text-brand-deep border border-brand/20"
      }`}
    >
      {isRecycler ? "Cơ sở thu mua" : "Người dân"}
    </span>
  )
}

function formatShortDate(iso?: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("vi-VN")
}

function daysRemaining(endsAt?: string | null) {
  if (!endsAt) return null
  const diff = new Date(endsAt).getTime() - Date.now()
  if (Number.isNaN(diff)) return null
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

/** Bảng xếp hạng theo điểm xếp hạng — áp dụng cho cả Người dân và Người thu gom (BR-GAM-07: đổi quà không làm tụt hạng). */
export default function Leaderboard() {
  const [liveAuth] = useState(() => hasLiveBackendAuth())
  const [roleTab, setRoleTab] = useState<RoleTab>("all")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [rows, setRows] = useState<BoardRow[]>(() => (liveAuth ? [] : LEADERBOARD))
  const [cycle, setCycle] = useState<LeaderboardCycleDto | null>(null)
  const [recentFinalized, setRecentFinalized] = useState<LeaderboardCycleDto[]>([])
  const [myEntry, setMyEntry] = useState<BoardRow | null>(null)
  const [loading, setLoading] = useState(liveAuth)

  useEffect(() => {
    let active = true
    if (liveAuth) setLoading(true)
    fetchLeaderboard({ top: 100, role: roleTab })
      .then((res) => {
        if (!active || !res.data) return
        setCycle(res.data.activeCycle ?? null)
        setRecentFinalized(res.data.recentFinalizedCycles ?? [])
        const items = (res.data.items ?? []).map((x) => ({
          id: x.userId,
          name: x.fullName,
          role: x.role ?? "User",
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
            role: res.data.myEntry.role ?? "User",
            area: res.data.myEntry.area || "Cộng đồng Xanh EcoLink",
            points: res.data.myEntry.totalPoints,
            you: true,
            neededAbove: res.data.myEntry.pointsNeededForNextRank,
            recycledKg: res.data.myEntry.totalRecycledKg,
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
  }, [liveAuth, roleTab])

  const [first, second, third] = rows
  const rest = rows.slice(3)

  const filteredRest = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const indexed = rest.map((r, idx) => ({ ...r, actualRank: idx + 4 }))
    if (!q) return indexed
    return indexed.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q),
    )
  }, [rest, debouncedSearch])

  const pagedRest = useMemo(
    () => paginateItems(filteredRest, page, pageSize),
    [filteredRest, page, pageSize],
  )

  const daysLeft = daysRemaining(cycle?.endsAt)

  return (
    <section className="mt-8 first:mt-0 flex flex-col gap-5">
      {/* Bộ lọc vai trò + tìm kiếm */}
      <SearchFilterBar
        label="Tìm thành viên / cơ sở trên bảng xếp hạng"
        value={search}
        onChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        placeholder="Nhập tên người dân, tên vựa hoặc khu vực..."
        totalCount={rows.length}
        countLabel="thành viên"
      >
        <div className="flex flex-wrap gap-1.5">
          {ROLE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setRoleTab(t.key)
                setPage(1)
              }}
              className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                roleTab === t.key
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-body hover:bg-surface-2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </SearchFilterBar>

      {/* Top 3 + list bao bằng một khung chung border */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(15,31,21,0.05)]">
        {/* Băng nền dọc giữa, chữ trắng trên brand-deep, 2 lá vàng phẳng hai bên */}
        <div className="flex flex-col items-center gap-2 border-b border-line-soft bg-brand-deep px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2.5">
            <LaurelIcon className="size-4 text-[#d9ae52]" />
            <p className="text-[11px] font-bold tracking-[0.12em] text-white sm:text-xs">
              TOP {Math.min(rows.length || LEADERBOARD.length, 100)} ĐIỂM XANH
              {cycle ? ` · ${cycle.name}` : ""}
            </p>
            <LaurelIcon className="size-4 -scale-x-100 text-[#d9ae52]" />
          </div>

          {cycle && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-white/90">
              <span>
                Chu kỳ: {formatShortDate(cycle.startsAt)} – {formatShortDate(cycle.endsAt)}
                {daysLeft !== null ? ` (Còn ${daysLeft} ngày)` : ""}
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 font-semibold text-[#f8d778]">
                Giải Top 1: +{fmt(cycle.top1BonusPoints)}đ
              </span>
              <span className="rounded-full bg-white/12 px-2.5 py-0.5 font-semibold text-white">
                Top 2: +{fmt(cycle.top2BonusPoints)}đ
              </span>
              <span className="rounded-full bg-white/12 px-2.5 py-0.5 font-semibold text-white">
                Top 3: +{fmt(cycle.top3BonusPoints)}đ
              </span>
            </div>
          )}
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
              <PodiumCard rank={2} person={second} bonusPoints={cycle?.top2BonusPoints} />
              <PodiumCard rank={1} person={first} bonusPoints={cycle?.top1BonusPoints} />
              <PodiumCard rank={3} person={third} bonusPoints={cycle?.top3BonusPoints} />
            </ol>

            {/* Bảng 4+ */}
            {(pagedRest.length > 0 || myEntry) && (
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
                {pagedRest.map((r) => {
                  const gap = r.neededAbove ?? 0
                  return (
                    <li
                      key={r.id ?? r.name}
                      className={`grid grid-cols-[52px_1fr_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/70 sm:px-5 ${
                        r.you ? "bg-brand/8" : ""
                      }`}
                    >
                      <span className="text-sm font-semibold tabular-nums text-muted">
                        {String(r.actualRank).padStart(2, "0")}
                      </span>
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-bold text-brand-deep"
                        >
                          {initials(r.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-medium text-ink">
                              {r.name}
                              {r.you && (
                                <span className="ml-1.5 text-[11px] font-semibold text-brand">
                                  Bạn
                                </span>
                              )}
                            </p>
                            <RoleBadge role={r.role} />
                          </div>
                          <p className="truncate text-[11px] text-muted">
                            {r.you && gap > 0 ? `Cần ${fmt(gap)} điểm để vượt` : r.area}
                            {typeof r.recycledKg === "number" && r.recycledKg > 0
                              ? ` · ${r.recycledKg.toLocaleString("vi-VN")} kg`
                              : ""}
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-medium text-ink">
                            {myEntry.name}
                            <span className="ml-1.5 text-[11px] font-semibold text-brand">
                              Bạn
                            </span>
                          </p>
                          <RoleBadge role={myEntry.role} />
                        </div>
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

      {filteredRest.length > pageSize && (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalCount={filteredRest.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 20, 50]}
          itemLabel="thành viên"
          className="mt-0"
        />
      )}

      {recentFinalized.length > 0 && (
        <div className="card p-5">
          <h2 className="text-base font-bold text-ink">Bảng vàng các kỳ trước</h2>
          <p className="mt-1 text-xs text-muted">
            Top 3 thành viên đạt thành tích cao nhất và đã nhận thưởng Điểm Xanh khi chốt chu kỳ.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {recentFinalized.map((fc) => (
              <div key={fc.id} className="rounded-xl border border-line bg-surface p-4">
                <p className="text-sm font-bold text-brand-deep">{fc.name}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Chốt ngày {formatShortDate(fc.finalizedAt || fc.endsAt)}
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {fc.winners.slice(0, 3).map((w) => (
                    <li
                      key={`${fc.id}-${w.userId}`}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex items-center gap-1.5">
                        <span className="font-bold text-ink">#{w.rank}</span>
                        <span className="truncate font-semibold text-ink">{w.fullName}</span>
                        <RoleBadge role={w.role} />
                      </div>
                      <span className="shrink-0 font-bold tabular-nums text-brand">
                        +{fmt(w.bonusPointsAwarded)}đ
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function PodiumCard({
  rank,
  person,
  bonusPoints,
}: {
  rank: 1 | 2 | 3
  person?: BoardRow
  bonusPoints?: number
}) {
  const top = rank === 1
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
      {person?.role && (
        <div className="mt-1">
          <RoleBadge role={person.role} />
        </div>
      )}
      <p className="mt-1 w-full truncate text-[11px] text-muted">
        {person ? person.area : "—"}
      </p>
      <p className={`mt-1 w-full truncate font-bold tabular-nums text-ink ${points}`}>
        {person ? fmt(person.points) : "0"}
      </p>
      {typeof bonusPoints === "number" && bonusPoints > 0 && (
        <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
          Thưởng +{fmt(bonusPoints)}đ
        </span>
      )}
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
