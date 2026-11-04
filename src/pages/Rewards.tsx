import { useState } from "react"
import CheckIn from "@/components/CheckIn"
import {
  EARN,
  fmt,
  GRAND_PRIZES,
  LOW_STOCK,
  RANK_POINTS,
  REDEEMED,
  REWARDS,
  SPEND_POINTS,
  tierProgress,
  type Reward,
} from "@/data/rewards"

/** Icon điểm. Dùng chung với CheckIn để "điểm" luôn là một biểu tượng duy
 *  nhất, không phải chỗ này chữ "điểm" chỗ kia số trần trụi. */
const COIN = "/assets/AI/ecolink-coin.webp"

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function RewardIcon({ kind }: { kind: Reward["kind"] }) {
  const box = "size-[18px]"
  if (kind === "discount")
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={box}>
        <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a3 3 0 0 1 3 3v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16V8.5Z" {...stroke} />
        <path d="M16 10.5h5v4h-5a2 2 0 0 1 0-4Z" {...stroke} />
      </svg>
    )
  if (kind === "tree")
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={box}>
        <path d="M12 21v-6" {...stroke} />
        <path d="M12 15c0-3 2-5 5-5 0 3-2 5-5 5Zm0 0c0-3-2-5-5-5 0 3 2 5 5 5Z" {...stroke} />
        <path d="M12 10c0-2.5 1.5-4 4-4 0 2.5-1.5 4-4 4Zm0 0c0-2.5-1.5-4-4-4 0 2.5 1.5 4 4 4Z" {...stroke} />
      </svg>
    )
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={box}>
      <path d="M4 9h16v11H4z" {...stroke} />
      <path d="M4 9 6.5 4h11L20 9" {...stroke} />
      <path d="M12 4v16" {...stroke} />
    </svg>
  )
}

/** Ảnh hỏng hoặc thiếu file thì lùi về icon, không để lỗ hổng trắng.
 *  aspect cố định nên ảnh tải chậm không làm trang nhảy. */
function Thumb({ reward }: { reward: Reward }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
      {broken ? (
        <span className="grid h-full place-items-center text-body">
          <RewardIcon kind={reward.kind} />
        </span>
      ) : (
        <img
          src={reward.img}
          alt={reward.name}
          loading="lazy"
          decoding="async"
          width={800}
          height={600}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}

export default function Rewards() {
  const { cur, next, pct, need } = tierProgress()
  // Số dư nằm trong state vì điểm danh cộng vào đây. Ban đầu lấy từ data.
  const [spend, setSpend] = useState(SPEND_POINTS)
  // rẻ nhất trước: người vào trang này để đổi được ngay. Đổi quà bằng điểm
  // tiêu dùng, không phải điểm xếp hạng.
  const list = [...REWARDS].sort((a, b) => a.cost - b.cost)

  return (
    <div className="page flex flex-col pb-16">
      <header className="pt-10 md:pt-14">
        <h1 className="display text-[28px] leading-9 md:text-[34px] md:leading-11">
          Đổi quà bằng điểm xanh
        </h1>
        <p className="mt-2 max-w-[62ch] text-base leading-7 text-body">
          Điểm xanh cộng dồn từ những lần bạn giao rác đúng phân loại. Dùng điểm
          để đổi quà của EcoLink và các đối tác tái chế.
        </p>
      </header>

      {/* Số dư: cột tiêu dùng rộng hơn cột xếp hạng vì đó mới là tiền trong
          túi, còn xếp hạng chỉ là thông tin tham chiếu. */}
      <section className="mt-7 grid overflow-hidden rounded-2xl border border-line bg-surface lg:grid-cols-[1.15fr_1fr]">
        <div className="px-5 py-6 md:px-8 md:py-7">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
            Điểm tiêu dùng
          </p>
          <p className="mt-1 text-4xl leading-none font-bold tracking-tight tabular-nums text-brand md:text-5xl">
            {fmt(spend)}
          </p>
          <p className="mt-3 text-[13px] leading-5 text-muted">
            Dùng để đổi quà bên dưới. Đổi xong mới trừ.
          </p>

          <div className="mt-6 border-t border-line-soft pt-5">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              Điểm xếp hạng
            </p>
            <p className="mt-1 text-3xl leading-none font-bold tracking-tight tabular-nums text-ink md:text-4xl">
              {fmt(RANK_POINTS)}
            </p>

            <p className="mt-3 text-sm font-semibold text-ink">
              Hạng {cur.name}
              {next && <span className="font-normal text-muted"> → {next.name}</span>}
            </p>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={next ? `Tiến độ lên hạng ${next.name}` : "Đã đạt hạng cao nhất"}
            >
              <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-[13px] leading-5 text-muted">
              {next
                ? `Cần thêm ${fmt(need)} điểm để lên hạng ${next.name}`
                : "Đã đạt hạng cao nhất"}
              {" · "}
              đã đổi {fmt(REDEEMED)} điểm
            </p>
          </div>
        </div>

        {/* Cột phải: điểm danh nằm ngay cạnh con số nó sẽ làm tăng. Bấm xong
            nhìn thấy ngay ở cùng một khối, không phải cuộn đi tìm. Cột này
            thấp hơn cột trái nên canh giữa theo chiều dọc cho cân. */}
        <div className="flex flex-col justify-center border-t border-line-soft px-5 py-6 md:px-8 md:py-7 lg:border-t-0 lg:border-l">
          <CheckIn balance={spend} onEarn={(n) => setSpend((s) => s + n)} />
        </div>
      </section>

      {/* QUÀ LỚN — khối nền nhạt riêng, đứng ngay dưới số dư, tách khỏi danh mục
          quà thường bằng nền chứ không bằng đường kẻ.

          Bố cục theo mẫu "ưu đãi nổi bật": thẻ trắng nổi trên nền nhạt, ảnh
          chiếm đầu thẻ, mép trên khối chữ bị cắt tròn (khuyết vé), rồi tới
          thanh tiến trình và hàng giá có icon coin. Trước đây là thẻ tối xanh
          đậm — số tiền 150.000 điểm nổi lên nhưng người dùng không thấy mình
          còn thiếu bao nhiêu; thanh tiến trình trả lời đúng câu hỏi đó. */}
      <section className="relative mt-10 overflow-hidden rounded-3xl bg-surface-2 px-5 py-6 md:px-8 md:py-8">
        {/* Vòng cung trang trí — hoa văn đường đồng của mẫu. Hai vòng, không
            cần ảnh. pointer-events-none để không chặn chọn chữ. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -right-20 size-[440px] rounded-full border border-brand/12"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-14 -right-6 size-[280px] rounded-full border border-brand/12"
        />

        <header className="relative flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="text-2xl leading-8 font-bold tracking-tight text-brand">
            Giải lớn mùa này
          </h2>
          <p className="text-sm text-muted">Điểm gấp 4 đến 13 lần quà thường</p>
        </header>
        <p className="relative mt-1.5 max-w-[62ch] text-sm leading-6 text-body">
          Dành riêng cho người giữ chuỗi điểm dài. Đổi bằng điểm tiêu dùng như
          mọi món khác, điểm xếp hạng của bạn không bị trừ.
        </p>

        <ul className="relative mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GRAND_PRIZES.map((g) => {
            const short = Math.max(g.cost - spend, 0)
            const can = short === 0
            const pct = can ? 100 : Math.round((spend / g.cost) * 100)
            return (
              <li
                key={g.id}
                className="flex flex-col rounded-2xl bg-white shadow-[0_18px_40px_-26px_rgba(15,31,21,0.38)]"
              >
                <div className="relative">
                  <img
                    src={g.img}
                    alt={g.name}
                    loading="lazy"
                    decoding="async"
                    width={400}
                    height={300}
                    className="aspect-[4/3] w-full rounded-t-2xl object-cover"
                  />
                  {/* Khuyết vé: nửa tròn màu nền khối cắt vào mép trên khối
                      chữ. Nằm trong div bọc ảnh nên "đáy" của nó luôn trùng đáy
                      ảnh, không phải tính tỉ lệ 4/3 bằng tay. */}
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-1/2 size-5 -translate-x-1/2 translate-y-1/2 rounded-full bg-surface-2"
                  />
                </div>

                <div className="flex flex-1 flex-col p-4 pt-6">
                  <h3 className="text-[15px] leading-6 font-bold text-ink">
                    {g.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted">
                    {g.desc}
                  </p>

                  {/* Thanh tiến trình = điểm đang có trên tổng điểm món này.
                      Một câu "Cần thêm 137.600 điểm" không cho biết mình đã
                      gần tới nỗi bao nhiêu; thanh thì có. */}
                  <div
                    className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Tiến độ đổi ${g.name}`}
                  >
                    <div
                      className={`h-full rounded-full ${can ? "bg-brand-deep" : "bg-brand"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p
                    className={`mt-2 text-[13px] leading-5 ${
                      can ? "font-semibold text-brand-deep" : "text-muted"
                    }`}
                  >
                    {can ? "Đủ điểm, đổi được ngay" : `Cần thêm ${fmt(short)} điểm`}
                  </p>

                  {/* Danh sách chi tiết gấp lại. Để mở sẵn thì thẻ này cao hơn
                      hai thẻ kia và lệch cả hàng — mà danh sách này phần lớn
                      người dùng không cần đọc mỗi lần vào trang. */}
                  {g.details && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-[13px] font-semibold text-brand">
                        Phần quà gồm gì
                      </summary>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {g.details.map((d) => (
                          <li
                            key={d}
                            className="flex gap-2 text-[12px] leading-5 text-muted"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-2 size-1 shrink-0 rounded-full bg-mint"
                            />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* mt-auto: 3 thẻ cao bằng nhau nên giá phải bấm đáy, hàng giá
                      thẳng hàng. */}
                  <p className="mt-auto flex items-center gap-2 pt-4">
                    <img
                      src={COIN}
                      alt=""
                      width={24}
                      height={24}
                      className="size-6 shrink-0"
                    />
                    <span className="text-lg leading-6 font-bold tabular-nums text-ink">
                      {fmt(g.cost)}
                    </span>
                    <span className="text-xs font-medium text-muted">điểm</span>
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Danh mục: ảnh là nội dung chính nên mỗi món một thẻ, ảnh chiếm phần
          lớn diện tích. Trước đây là 6 icon trong card rỗng, không ai biết
          món quà trông như thế nào. */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
            Phần quà đang mở
          </h2>
          <p className="text-sm text-muted">{list.length} món, sắp theo giá tăng dần</p>
        </div>

        <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => {
            const enough = spend >= r.cost
            const soldOut = r.stock === 0
            const can = enough && !soldOut

            const stock =
              r.stock === null
                ? "Không giới hạn"
                : soldOut
                  ? "Hết hàng"
                  : r.stock <= LOW_STOCK
                    ? `Chỉ còn ${r.stock}`
                    : `Còn ${r.stock}`

            return (
              <li key={r.id} className="card flex flex-col overflow-hidden">
                <div className="relative">
                  <Thumb reward={r} />
                  {r.stock !== null && (
                    <span
                      className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        soldOut
                          ? "bg-surface-3 text-ink"
                          : r.stock <= LOW_STOCK
                            ? "bg-brand text-white"
                            : "bg-surface text-body"
                      }`}
                    >
                      {stock}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <h3 className="text-[15px] leading-6 font-bold text-ink">{r.name}</h3>
                  <p className="mt-1 text-sm leading-6 text-body">{r.desc}</p>

                  <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                    <div>
                      <p
                        className={`text-[15px] leading-6 font-bold tabular-nums ${
                          can ? "text-brand" : "text-muted"
                        }`}
                      >
                        {fmt(r.cost)}{" "}
                        <span className="text-xs font-medium">điểm</span>
                      </p>
                      {!enough && (
                        <p className="text-xs text-muted">
                          Thiếu {fmt(r.cost - spend)} điểm
                        </p>
                      )}
                    </div>

                    {/* nhãn giữ nguyên mọi thẻ, đổi chữ theo trạng thái làm
                        hàng nút lệch nhau. Phần thiếu nằm ở dòng phụ. */}
                    <button
                      type="button"
                      disabled={!can}
                      className="btn btn-primary h-10 min-w-[104px]"
                    >
                      {soldOut ? "Hết hàng" : "Đổi ngay"}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {/* ponytail: chữ này mô tả luồng đổi quà, backend chưa có. Có backend
            thì lấy từ cấu hình điểm thu gom chứ đừng hardcode ở đây. */}
        <p className="mt-6 max-w-[68ch] text-sm leading-6 text-muted">
          Đổi quà chỉ trừ điểm tiêu dùng, điểm xếp hạng giữ nguyên nên bạn không
          bị tụt hạng. Quà vật lý được giao tại nhà trong 3 đến 5 ngày làm việc;
          phiếu giảm giá có hiệu lực từ lần thanh toán kế tiếp.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
          Kiếm điểm thế nào
        </h2>
        <ol className="mt-5 grid gap-y-5 sm:grid-cols-3 sm:gap-x-8">
          {EARN.map((e, i) => (
            <li key={e.title} className="flex items-start gap-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                {i + 1}
              </span>
              <div className="pt-0.5">
                <p className="text-sm leading-5 font-semibold text-ink">{e.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-muted">{e.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
