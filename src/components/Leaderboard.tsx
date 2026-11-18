import { fmt, LEADERBOARD, type Rank } from "@/data/rewards"

/** Bảng xếp hạng theo điểm xếp hạng.
 *
 *  Top 3 dựng thành **bục**: hạng nhất ở giữa và cao hơn, 2 – 1 – 3 (nên phải
 *  đảo thứ tự hiển thị). Không dùng màu vàng/bạc cho kim loại — app chỉ có một
 *  sắc xanh chủ đạo, phân cấp bằng chiều cao + nền brand + cỡ chữ.
 *
 *  Hạng 4 trở xuống là danh sách gọn. Dòng của bạn luôn tô nền và ghi rõ còn
 *  kém người trên bao nhiêu, vì bảng xếp hạng chỉ có tác dụng khi biết mình ở
 *  đâu và có ai để vượt. */
export default function Leaderboard() {
  const [first, second, third] = LEADERBOARD
  const rest = LEADERBOARD.slice(3)

  return (
    <section className="mt-10 first:mt-0">
      {/* Top 3 + list bao bằng một khung chung border; cap 100 rows */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(15,31,21,0.05)]">
        {/* Băng nền dọc giữa, chữ trắng trên brand-deep, 2 lá vàng phẳng hai bên */}
        <div className="flex items-center justify-center gap-2.5 border-b border-line-soft bg-brand-deep px-4 py-2.5 text-center">
          <LaurelIcon className="size-4 text-[#d9ae52]" />
          <p className="text-[11px] font-bold tracking-[0.12em] text-white sm:text-xs">
            TOP {Math.min(LEADERBOARD.length, 100)} ĐIỂM XANH
          </p>
          <LaurelIcon className="size-4 -scale-x-100 text-[#d9ae52]" />
        </div>

        {/* Podium */}
        <ol className="grid grid-cols-3 items-end gap-2 border-b border-line-soft px-3 pt-[34px] pb-5 sm:gap-4 sm:px-6">
          <PodiumCard rank={2} person={second} />
          <PodiumCard rank={1} person={first} />
          <PodiumCard rank={3} person={third} />
        </ol>

        {/* Bảng 4+: hàng nhãn cột; hiển thị tối đa top 100 */}
        <ol className="divide-y divide-line-soft">
          <li
            aria-hidden="true"
            className="grid grid-cols-[52px_1fr_auto] items-center gap-3 px-4 py-2 text-[11px] font-semibold text-muted sm:px-5"
          >
            <span>#</span>
            <span>Thành viên</span>
            <span className="flex items-center justify-end gap-1.5 text-right">
              Điểm
              <img src="/assets/AI/ecolink-coin.png" alt="EcoLink coin" className="size-[35px] object-contain" />
            </span>
          </li>
          {rest.slice(0, 97).map((r, i) => {
            const rank = i + 4
            const above = LEADERBOARD[i + 2]?.points
            return (
              <li
                key={r.name}
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
                      {r.you && <span className="ml-1.5 text-[11px] font-semibold text-brand">Bạn</span>}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {r.you && above ? `Cần ${fmt(above - r.points)} điểm để vượt` : r.area}
                    </p>
                  </div>
                </div>
                <span className="flex items-center justify-end gap-1.5 text-sm font-semibold tabular-nums text-ink">
                  {fmt(r.points)}
                  <img src="/assets/AI/ecolink-coin.png" alt="EcoLink coin" className="size-[30px] object-contain" />
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

function PodiumCard({ rank, person }: { rank: 1 | 2 | 3; person: Rank }) {
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
          {person.avatar ? (
            <img
              src={person.avatar}
              alt={person.name}
              className="size-full rounded-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            initials(person.name)
          )}
        </span>
        <span
          className={`absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border-2 border-white text-[11px] font-extrabold tabular-nums sm:size-8 sm:text-xs ${medal}`}
        >
          {rank}
        </span>
      </div>

      <p className="mt-4 w-full truncate text-sm text-center font-bold text-brand-deep sm:text-base">
        {person.name}
      </p>
      <p className="w-full truncate text-[11px] text-muted">{person.area}</p>
      <p className={`mt-1.5 w-full truncate font-bold tabular-nums text-ink ${points}`}>
        {fmt(person.points)}
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
