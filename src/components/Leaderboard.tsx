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
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
          Xếp hạng người dùng
        </h2>
        <p className="text-sm text-muted">Theo điểm xếp hạng, cập nhật hằng ngày</p>
      </div>

      {/* Bục. items-end cho đáy 3 thẻ thẳng nhau; translate nâng thẻ lên —
          dùng translate chứ không margin vì margin trong grid đáy sẽ dịch cả
          hẳn, hai bậc dưới bị bằng nhau. */}
      <ol className="mt-6 grid grid-cols-3 items-end gap-2 sm:gap-4">
        <PodiumCard rank={2} person={second} />
        <PodiumCard rank={1} person={first} />
        <PodiumCard rank={3} person={third} />
      </ol>

      <ol className="card mt-4 divide-y divide-line-soft overflow-hidden">
        {rest.map((r, i) => {
          const rank = i + 4
          const above = LEADERBOARD[i + 2]?.points
          return (
            <li
              key={r.name}
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
                  {r.you && above
                    ? `Cần ${fmt(above - r.points)} điểm để vượt người trên`
                    : r.area}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                {fmt(r.points)}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function PodiumCard({ rank, person }: { rank: 1 | 2 | 3; person: Rank }) {
  const top = rank === 1
  // Hạng nhất nền brand chữ trắng; 2 và 3 nền sáng chữ ink. Không thêm màu mới.
  const shell = top
    ? "bg-brand text-white shadow-[0_10px_28px_rgba(15,31,21,0.16)]"
    : "border border-line bg-surface text-ink"
  // Chênh cao giữa 3 bậc phải THẤY ĐƯỢC. Hạng nhất nâng cao nhất và thêm
  // đệm dưới (đáy vẫn thẳng hàng với hai bậc sau), 3 không nâng.
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

      <p className={`mt-3 w-full truncate font-bold ${name}`}>{person.name}</p>
      <p className={`w-full truncate text-[11px] sm:text-xs ${top ? "text-white/70" : "text-muted"}`}>
        {person.area}
      </p>
      <p
        className={`mt-2 w-full truncate font-bold tabular-nums ${
          top ? "text-white" : "text-ink"
        } ${points}`}
      >
        {fmt(person.points)}
      </p>
    </li>
  )
}
