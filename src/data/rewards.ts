/** Hai loại điểm, tách bạch vì hai việc khác nhau:
 *
 *  - RANK_POINTS  điểm XẾP HẠNG, tích luỹ trọn đời, KHÔNG bao giờ bị trừ.
 *    Chỉ nó quyết định bạn ở hạng nào. Đổi quà không làm tụt hạng.
 *  - SPEND_POINTS điểm TIÊU DÙNG, trừ dần khi đổi quà. Đây mới là tiền
 *    thật sự trong túi để đổi.
 *
 *  Quan hệ bất biến: SPEND_POINTS <= RANK_POINTS, phần chênh là đã đổi rồi.
 *
 *  ponytail: hai số này là mô phỏng — app chưa có backend, chưa có nơi
 *  cộng/trừ điểm. Backend có thật thì đọc từ đây. */
export const RANK_POINTS = 23_400
export const SPEND_POINTS = 12_400

/** ngưỡng lên hạng, tính trên RANK_POINTS */
export const TIERS = [
  { min: 0, name: "Mầm" },
  { min: 5_000, name: "Cây" },
  { min: 15_000, name: "Rừng" },
  { min: 30_000, name: "Đại dương" },
] as const

export type Reward = {
  id: string
  name: string
  desc: string
  /** số điểm xanh cần để đổi */
  cost: number
  /** còn lại bao nhiêu, null = không giới hạn */
  stock: number | null
  kind: "discount" | "gift" | "service" | "tree"
  /** ảnh món quà, tải về local để không phụ thuộc mạng lúc chạy */
  img: string
}

export const REWARDS: Reward[] = [
  {
    id: "bag",
    name: "Túi vải tái chế EcoLink",
    desc: "Túi canvas in logo, may tại xưởng tái chế đối tác.",
    cost: 2_000,
    stock: 120,
    kind: "gift",    img: "/assets/rewards/bag.jpg",
  },
  {
    id: "ship",
    name: "Miễn phí giao hàng 3 lần",
    desc: "Dùng khi đặt lịch thu gom, tự động trừ điểm mỗi lần.",
    cost: 3_500,
    stock: null,
    kind: "service",    img: "/assets/rewards/ship.jpg",
  },
  {
    id: "seedling",
    name: "Một cây xanh trồng từ rác",
    desc: "Cây bản địa, kèm hướng dẫn chăm từ hạt rác tái chế.",
    cost: 4_500,
    stock: 64,
    kind: "tree",    img: "/assets/rewards/seedling.jpg",
  },
  {
    id: "coupon10",
    name: "Giảm 10% phiếu thu gom",
    desc: "Áp dụng tại các điểm thu gom đối tác trên toàn quốc.",
    cost: 6_000,
    stock: null,
    kind: "discount",    img: "/assets/rewards/coupon10.jpg",
  },
  {
    id: "kit",
    name: "Bộ dụng cụ thu gom gia đình",
    desc: "Kéo gom 3 thùng phân loại và bao đựng rác.",
    cost: 9_000,
    stock: 38,
    kind: "gift",    img: "/assets/rewards/kit.jpg",
  },
  {
    id: "tour",
    name: "Ghé tham quan nhà máy tái chế",
    desc: "Cùng gia đình đi xem dây chuyền phân loại và tái sinh.",
    cost: 18_000,
    stock: 12,
    kind: "service",    img: "/assets/rewards/tour.jpg",
  },
]

export const fmt = (n: number) => n.toLocaleString("vi-VN")

const curTier = () => TIERS.filter((t) => RANK_POINTS >= t.min).at(-1) ?? TIERS[0]
const nextTier = () => TIERS.find((t) => RANK_POINTS < t.min)

/** tiến độ trong bậc hiện tại, 0–100. Còn hạng cuối thì luôn 100. */
/** tiến độ trong bậc hiện tại, 0–100. Còn hạng cuối thì luôn 100.
 *  Tính trên RANK_POINTS: đổi quà không được làm tụt hạng. */
export function tierProgress() {
  const cur = curTier()
  const next = nextTier()
  if (!next) return { cur, next: null, pct: 100, need: 0 }
  const span = next.min - cur.min
  const done = RANK_POINTS - cur.min
  return { cur, next, pct: Math.round((done / span) * 100), need: next.min - RANK_POINTS }
}

/** điểm đã đổi rồi = tổng tích luỹ trừ đi còn lại. Giải thích vì sao hai
 *  con số lệch nhau, không thì người dùng tưởng bị tính sai. */
export const REDEEMED = RANK_POINTS - SPEND_POINTS

/** Quà lớn. Điểm cao gấp 4–13 lần quà thường nên hiển thị riêng, không
 *  nhét vào cùng danh sách: người dùng thấy 18.000 điểm "không lồ" thì mấy
 *  món này không có ý nghĩa gì. */
export type GrandPrize = { id: string; name: string; desc: string; cost: number; img: string }

export const GRAND_PRIZES: GrandPrize[] = [
  {
    id: "grand-scooter",
    name: "Xe điện thay cho cả gia đình",
    desc: "Bàn giao tại nhà, kèm 1 năm bảo hành và 500 lượt sạc.",
    cost: 150_000,
    img: "/assets/rewards/grand-scooter.jpg",
  },
  {
    id: "grand-trip",
    name: "Tuần trải nghiệm ở nhà máy tái chế",
    desc: "5 ngày đi thật các dây chuyền phân loại cùng đội ngũ kỹ thuật.",
    cost: 60_000,
    img: "/assets/rewards/grand-trip.jpg",
  },
  {
    id: "grand-scholar",
    name: "Học bổng một năm học phần",
    desc: "Hỗ trợ học phí ngành quản lý môi trường hoặc kỹ thuật tái chế.",
    cost: 45_000,
    img: "/assets/rewards/grand-scholar.jpg",
  },
]

/** Bảng xếp hạng theo RANK_POINTS (điểm xếp hạng), không phải điểm tiêu
 *  dùng — xếp hạng là vinh danh nên tính trên điểm tích luỹ, đổi quà không
 *  làm tụt bảng.
 *
 *  Bạn cố tình đứng giữa bảng chứ không phải đầu: đầu bảng thì không có ai
 *  để vượt, mà mục đích của bảng xếp hạng là tạo cái đích để với tới. */
export type Rank = { name: string; area: string; points: number; you?: boolean }

export const LEADERBOARD: Rank[] = [
  { name: "Trần Minh Khoa", area: "Bình Thạnh", points: 48_200 },
  { name: "Lê Thị Ngọc Hân", area: "Quận 7", points: 39_800 },
  { name: "Phạm Quốc Việt", area: "Thủ Đức", points: 31_500 },
  { name: "Huỳnh Thị Mai Anh", area: "Tân Bình", points: 27_900 },
  { name: "Nguyễn Đức", area: "Quận 3", points: RANK_POINTS, you: true },
  { name: "Đặng Thu Hà", area: "Gò Vấp", points: 19_300 },
  { name: "Võ Thành Long", area: "Quận 8", points: 14_600 },
  { name: "Bùi Khánh Chi", area: "Phú Nhuận", points: 8_100 },
]

/** vòng lặp của EcoLink: giao rác đúng phân loại -> được xác nhận -> cộng điểm */
export const EARN = [
  { title: "Giao rác đúng phân loại", desc: "Nhận diện ra đúng vật liệu" },
  { title: "Người thu gom xác nhận", desc: "Đối chiếu khối lượng tại nhà bạn" },
  { title: "Giao đủ khối lượng", desc: "Cộng thêm theo từng kg đã tái chế" },
] as const

/** dưới ngưỡng này thì gắn nhãn khan hiếm, tồn kho thấp */
export const LOW_STOCK = 15

