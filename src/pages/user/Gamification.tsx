import { Link } from "react-router-dom"
import { PageHead, Stat, Table, Td } from "@/components/Portal"
import { GIFTS } from "@/data/ops"
import { GRAND_PRIZES } from "@/data/rewards"

/** U-15 Điểm danh · U-16 Đổi điểm lấy quà · U-17 Cây ảo & Eco Fact.
 *
 *  Gộp ba UC vào một trang vì cùng đọc từ `src/data/rewards.ts` và cùng là
 *  "phần thưởng". Tách ba trang thì người dùng phải nhớ 3 URL mà nội dung
 *  lại liên tục: điểm sinh ra ở đây, dùng ở kia. Điểm danh và đổi quà thật
 *  vẫn nằm ở `/rewards` — trang này là tổng quan. */
export default function Gamification() {
  return (
    <div className="flex flex-col gap-8">
      <PageHead
        eyebrow="GAMIFICATION"
        title="Điểm xanh, quà tặng và cây ảo"
        body="Điểm xanh cộng dồn từ giao rác đúng phân loại. Dùng điểm để đổi quà, và đủ điểm là mở khoá thêm Eco Fact trên cây ảo."
        action={
          <Link to="/rewards" className="btn-primary h-11 shrink-0 px-5">
            Điểm danh và đổi quà
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Điểm tiêu dùng" value="12.400" note="Dùng để đổi quà, bấm mới trừ" />
        <Stat label="Điểm xếp hạng" value="23.400" note="Tích luỹ trọn đời, không bao giờ trừ" />
        <Stat label="Hạng hiện tại" value="Rừng" note="Cần thêm 6.600 điểm để lên Đại dương" />
        <Stat label="Eco Fact đã mở" value="2 / 6" note="Cần thêm 4.500 điểm cho tất cả" />
      </div>

      <Tree />
      <Catalog />
    </div>
  )
}

/** U-17 Cây ảo: 6 nhánh, mở dần theo điểm. Vẽ bằng SVG thay vì ảnh — nhánh
 *  đổi theo điểm nên ảnh tĩnh không đổi được, còn SVG thì đổi `fill` là xong. */
const BRANCHES = [
  { x: 70, y: 175, cost: 500, title: "Nhựa PET tái chế thành sợi" },
  { x: 130, y: 160, cost: 800, title: "Phân loại 3R tại Việt Nam" },
  { x: 68, y: 130, cost: 1_200, title: "Pin Li-ion gây hoạ hoả" },
  { x: 132, y: 112, cost: 1_500, title: "Màu nắp thùng rác có ý nghĩa" },
  { x: 74, y: 100, cost: 2_000, title: "Bìa carton thu gom giá 2.200đ/kg" },
  { x: 126, y: 96, cost: 3_000, title: "Thuế EPR và bài toán bao bì" },
]

/** Điểm xếp hạng đủ mở 2 nhánh đầu — suy ra từ hạng Rừng (15.000), không
 *  hardcode danh sách mở khoá riêng để hai nơi không lệch nhau. */
const UNLOCKED = 2

function Tree() {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-soft px-5 py-4">
        <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
          Cây ảo của bạn
        </h2>
        <p className="text-sm text-muted">
          Mỗi Eco Fact mở thêm một nhánh. Điểm chỉ tiêu một lần lúc mở, không
          mất khi đổi quà.
        </p>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[260px_1fr]">
        <figure className="rounded-xl border border-line bg-surface-2 p-4">
          <svg
            viewBox="0 0 200 240"
            className="w-full"
            role="img"
            aria-label={`Cây ảo đang có ${UNLOCKED} trên 6 nhánh đã mở khoá`}
          >
            <path d="M100 230V120" stroke="var(--color-brand-deep)" strokeWidth="7" strokeLinecap="round" />
            {BRANCHES.map((b, i) => (
              <g key={b.cost}>
                <path
                  d={`M100 ${200 - i * 14}L${b.x} ${b.y}`}
                  stroke={i < UNLOCKED ? "var(--color-brand-deep)" : "var(--color-sage-line)"}
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <circle
                  cx={b.x}
                  cy={b.y}
                  r="15"
                  fill={i < UNLOCKED ? "var(--color-brand)" : "var(--color-surface-3)"}
                  stroke={i < UNLOCKED ? "var(--color-brand-deep)" : "var(--color-sage-line)"}
                  strokeWidth="1.5"
                />
              </g>
            ))}
          </svg>
          <figcaption className="mt-2 text-center text-[13px] text-muted">
            {UNLOCKED} / {BRANCHES.length} Eco Fact đã mở khoá
          </figcaption>
        </figure>

        <ul className="flex flex-col gap-2.5">
          {BRANCHES.map((b, i) => (
            <li
              key={b.cost}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${
                i < UNLOCKED ? "border-brand/30 bg-brand/6" : "border-line bg-surface"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                    i < UNLOCKED ? "bg-brand text-white" : "bg-surface-2 text-muted"
                  }`}
                >
                  {i < UNLOCKED ? "✓" : "·"}
                </span>
                <span className={`text-sm font-semibold ${i < UNLOCKED ? "text-ink" : "text-body"}`}>
                  {b.title}
                </span>
                <span className="text-[11px] font-semibold text-muted">
                  {i < UNLOCKED ? "Đã mở" : "Chưa mở"}
                </span>
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-muted">
                {b.cost.toLocaleString("vi-VN")} điểm
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** U-16 Danh mục quà, sắp theo giá tăng dần: người vào để đổi được ngay. */
function Catalog() {
  const gifts = GIFTS.filter((g) => g.active).sort((a, b) => a.cost - b.cost)
  return (
    <section>
      <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
        Quà đang mở
      </h2>
      <p className="mt-1 text-sm text-muted">
        Đổi bằng điểm tiêu dùng. Đổi xong mới trừ, và điểm xếp hạng giữ nguyên nên
        không bị tụt hạng.
      </p>
      <div className="mt-4">
        <Table head={["Quà tặng", "Loại", "Điểm", "Tồn kho"]}>
          {gifts.map((g) => (
            <tr key={g.id}>
              <Td className="font-semibold text-ink">{g.name}</Td>
              <Td>{g.kind === "voucher" ? "Phiếu giảm giá" : "Quà vật lý"}</Td>
              <Td className="tabular-nums">{g.cost.toLocaleString("vi-VN")}</Td>
              <Td>
                {g.stock === null
                  ? "Không giới hạn"
                  : g.stock === 0
                    ? "Hết hàng"
                    : `${g.stock.toLocaleString("vi-VN")} món`}
              </Td>
            </tr>
          ))}
          {GRAND_PRIZES.map((g) => (
            <tr key={g.id}>
              <Td className="font-semibold text-ink">
                {g.name}
                <span className="ml-2 rounded-full bg-mint/30 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-brand-deep">
                  Giải lớn
                </span>
              </Td>
              <Td>Quà vật lý</Td>
              <Td className="tabular-nums">{g.cost.toLocaleString("vi-VN")}</Td>
              <Td>Giới hạn theo mùa</Td>
            </tr>
          ))}
        </Table>
      </div>
    </section>
  )
}