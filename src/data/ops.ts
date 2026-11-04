/** Dữ liệu vận hành cho Staff và Admin. Tất cả là số mô phỏng nằm cứng trong
 *  repo — app chưa có backend. Khi nối API, thay từng bảng ở đây. */

import { FEE_RATE } from "@/data/waste"

/* ------------------------------------------------------------------ S-01..03 */

/** Ảnh AI nhận diện sai, chờ nhân viên gán nhãn (S-01, S-02). */
export type AiCase = {
  id: string
  image: string
  /** nhãn AI đoán */
  predicted: string
  /** nhãn đúng, người dùng báo sai (U-04) hoặc nhân viên gán (S-02) */
  correct: string
  confidence: number
  reporter: string
  date: string
  /** đã vào tập kiểm chứng chưa (S-03) */
  inDataset: boolean
}

export const AI_CASES: AiCase[] = [
  {
    id: "AI-4471",
    image: "/assets/scanner/b7b43.png",
    predicted: "Nhựa PET",
    correct: "Nhựa HDPE",
    confidence: 78,
    reporter: "Huỳnh Thị Mai Anh",
    date: "27/09/2026",
    inDataset: true,
  },
  {
    id: "AI-4468",
    image: "/assets/map/238fa.png",
    predicted: "Nhựa PET",
    correct: "Nhựa PP",
    confidence: 61,
    reporter: "Phạm Quốc Việt",
    date: "27/09/2026",
    inDataset: false,
  },
  {
    id: "AI-4455",
    image: "/assets/map/106f5.png",
    predicted: "Giấy carton",
    correct: "Bìa carton có in",
    confidence: 84,
    reporter: "Đặng Thu Hà",
    date: "26/09/2026",
    inDataset: true,
  },
  {
    id: "AI-4440",
    image: "/assets/scanner/28077.png",
    predicted: "Thủy tinh",
    correct: "Nhựa cứng trong suốt",
    confidence: 55,
    reporter: "Võ Thành Long",
    date: "26/09/2026",
    inDataset: false,
  },
  {
    id: "AI-4429",
    image: "/assets/partners/28077.png",
    predicted: "Kim loại",
    correct: "Bìa carton",
    confidence: 49,
    reporter: "Bùi Khánh Chi",
    date: "25/09/2026",
    inDataset: false,
  },
]

/** Tập dữ liệu kiểm chứng (S-03). `source` cho biết ảnh đến từ đâu vì ảnh từ
 *  người dùng báo sai và ảnh do nhân viên tự chụp cần đánh giá khác nhau. */
export const DATASET = {
  total: 12_480,
  labeled: 11_902,
  /** độ chính xác đo trên tập kiểm chứng, % */
  accuracy: 94.6,
  byClass: [
    { label: "Nhựa PET", count: 3_180, accuracy: 97.2 },
    { label: "Nhựa HDPE", count: 2_240, accuracy: 95.1 },
    { label: "Bìa carton", count: 2_610, accuracy: 96.4 },
    { label: "Sắt thép", count: 1_480, accuracy: 93.8 },
    { label: "Nhôm", count: 1_020, accuracy: 92.5 },
    { label: "Thủy tinh", count: 900, accuracy: 89.7 },
    { label: "Pin Li-ion", count: 620, accuracy: 91.4 },
    { label: "Thiết bị điện tử", count: 430, accuracy: 88.3 },
  ],
}

/* ---------------------------------------------------------------------- S-04 */

/** Hồ sơ đăng ký cơ sở thu mua (U-05 gửi, S-04 thẩm định). */
export type Application = {
  id: string
  name: string
  address: string
  materials: string
  /** giấy phép đã đính kèm */
  docs: string[]
  date: string
  status: "pending" | "approved" | "rejected"
  note?: string
}

export const APPLICATIONS: Application[] = [
  {
    id: "HS-0231",
    name: "Vựa Minh Khai",
    address: "512 Hai Bà Trưng, Quận 5",
    materials: "Kim loại, nhôm, sắt thép",
    docs: ["Giấy ĐKDN", "Giấy phép thu gom", "Ảnh cơ sở"],
    date: "27/09/2026",
    status: "pending",
  },
  {
    id: "HS-0228",
    name: "Anh Tuấn - Thu gom tận nhà",
    address: "78 Nguyễn Thái Bình, Quận 1",
    materials: "Nhựa, giấy, thủy tinh",
    docs: ["Giấy ĐKDN", "CCMT người đại diện"],
    date: "26/09/2026",
    status: "pending",
  },
  {
    id: "HS-0219",
    name: "Công ty CP Tái chế Duy Tân",
    address: "KCN Long Bình, TP. Thủ Đức",
    materials: "Nhựa công nghiệp",
    docs: ["Giấy ĐKDN", "ISO 14001", "Hợp đồng thu gom"],
    date: "24/09/2026",
    status: "approved",
  },
  {
    id: "HS-0210",
    name: "Tổ hợp thu gom An Phú",
    address: "19 Lê Văn Sỹ, Quận 3",
    materials: "Giấy, bìa carton",
    docs: ["Giấy ĐKDN"],
    date: "22/09/2026",
    status: "rejected",
    note: "Thiếu giấy phép thu gom chất thải rắn.",
  },
]

/* ---------------------------------------------------------------------- S-05 */

export type Complaint = {
  id: string
  title: string
  user: string
  target: string
  date: string
  status: "new" | "working" | "resolved"
  reply?: string
}

export const COMPLAINTS: Complaint[] = [
  {
    id: "KN-260928-4F7A",
    title: "Người thu gom đến trễ 3 giờ so với khung giờ đã chốt",
    user: "Nguyễn Đức",
    target: "Cô Ba Thu Gom · BH-2609-0184",
    date: "28/09/2026",
    status: "new",
  },
  {
    id: "KN-260927-1B3C",
    title: "Khối lượng cân thiếu 6kg so với biên nhận",
    user: "Lê Thị Ngọc Hân",
    target: "Vựa Minh Khai · BH-2609-0121",
    date: "27/09/2026",
    status: "working",
  },
  {
    id: "KN-260926-9D2E",
    title: "Nhận diện AI sai, báo lại nhưng chưa thấy kết quả",
    user: "Phạm Quốc Việt",
    target: "AI-4468",
    date: "26/09/2026",
    status: "resolved",
    reply: "Đã gán nhãn đúng và đưa ảnh vào tập kiểm chứng. Cảm ơn bạn đã báo.",
  },
]

/* ------------------------------------------------------------- S-06, S-07, A-03 */

export type Account = {
  id: string
  name: string
  email: string
  role: "user" | "recycler"
  area: string
  joined: string
  status: "active" | "locked"
  /** số giao dịch hoàn tất, dùng để quyết định khoá hay xoá (S-07) */
  deals: number
}

export const ACCOUNTS: Account[] = [
  { id: "U-1042", name: "Nguyễn Đức", email: "duc.nguyen@email.vn", role: "user", area: "Quận 3", joined: "12/03/2026", status: "active", deals: 24 },
  { id: "U-1039", name: "Lê Thị Ngọc Hân", email: "han.le@email.vn", role: "user", area: "Quận 7", joined: "10/03/2026", status: "active", deals: 31 },
  { id: "U-1031", name: "Phạm Quốc Việt", email: "viet.pham@email.vn", role: "user", area: "Thủ Đức", joined: "08/03/2026", status: "active", deals: 12 },
  { id: "B-0207", name: "Cô Ba Thu Gom", email: "coba@thugom.vn", role: "recycler", area: "Quận 1", joined: "02/04/2026", status: "active", deals: 268 },
  { id: "B-0211", name: "Anh Tuấn", email: "tuan@thugom.vn", role: "recycler", area: "Quận 1", joined: "18/04/2026", status: "active", deals: 143 },
  { id: "B-0202", name: "Vựa Minh Khai", email: "minhkhai@thugom.vn", role: "recycler", area: "Quận 5", joined: "25/02/2026", status: "locked", deals: 86 },
  { id: "U-1028", name: "Đặng Thu Hà", email: "ha.dang@email.vn", role: "user", area: "Gò Vấp", joined: "05/03/2026", status: "active", deals: 7 },
  { id: "U-1015", name: "Võ Thành Long", email: "long.vo@email.vn", role: "user", area: "Quận 8", joined: "28/02/2026", status: "active", deals: 19 },
]

/** Nhân viên (A-03). `perms` là danh sách mã quyền, dùng lại cho A-04. */
export type Staff = {
  id: string
  name: string
  email: string
  perms: string[]
  status: "active" | "locked"
}

export const PERMS = [
  { id: "ai.review", label: "Đánh giá ảnh AI" },
  { id: "ai.dataset", label: "Cập nhật tập dữ liệu" },
  { id: "partner.verify", label: "Thẩm định hồ sơ đối tác" },
  { id: "complaint.handle", label: "Xử lý khiếu nại" },
  { id: "account.manage", label: "Quản lý tài khoản" },
  { id: "blog.write", label: "Soạn bài Blog" },
  { id: "gift.manage", label: "Quản lý kho quà" },
] as const

export const STAFF: Staff[] = [
  { id: "NV-01", name: "Lê Thu Hà", email: "ha.le@ecolink.vn", perms: PERMS.map((p) => p.id), status: "active" },
  { id: "NV-02", name: "Trần Đình Khoa", email: "khoa.tran@ecolink.vn", perms: ["ai.review", "ai.dataset", "complaint.handle"], status: "active" },
  { id: "NV-03", name: "Phạm Bảo Ngọc", email: "ngoc.pham@ecolink.vn", perms: ["partner.verify", "blog.write"], status: "active" },
]

/* ------------------------------------------------------------------ S-08, A-09 */

export type Post = {
  id: string
  title: string
  excerpt: string
  author: string
  date: string
  status: "draft" | "pending" | "published" | "rejected"
  note?: string
}

export const POSTS: Post[] = [
  {
    id: "BL-0088",
    title: "Vì sao bìa carton nhà bạn thường bị thu gom giá thấp hơn kỳ vọng",
    excerpt: "Phân loại giấy phụ thuộc độ sạch của lớp phủ và keo dán, không chỉ khối lượng.",
    author: "Phạm Bảo Ngọc",
    date: "27/09/2026",
    status: "pending",
  },
  {
    id: "BL-0087",
    title: "Từ 1kg nhôm phế liệu đến 25kg nhôm có thể tái chế",
    excerpt: "Chuỗi giá trị nhôm tại Việt Nam đang mở rộng ra thế nào.",
    author: "Phạm Bảo Ngọc",
    date: "25/09/2026",
    status: "pending",
  },
  {
    id: "BL-0086",
    title: "Hướng dẫn tái chế pin Li-ion an toàn tại nhà",
    excerpt: "Không bao giờ bỏ pin vào thùng rác thường. Đây là cách xử lý đúng.",
    author: "Lê Thu Hà",
    date: "20/09/2026",
    status: "published",
  },
  {
    id: "BL-0085",
    title: "Thu gom tận nhà: ba câu hỏi nên đặt cho người thu gom",
    excerpt: "Kinh nghiệm thương lượng giá từ 240 giao dịch.",
    author: "Trần Đình Khoa",
    date: "18/09/2026",
    status: "rejected",
    note: "Cần dẫn nguồn số liệu và ghi rõ phạm vi mẫu khảo sát.",
  },
]

/* ---------------------------------------------------------------------- S-09 */

export type EcoFact = {
  id: string
  title: string
  body: string
  /** cây cần đủ số Eco Fact để mở */
  cost: number
  open: boolean
}

export const ECO_FACTS: EcoFact[] = [
  { id: "EF-01", title: "Nhựa PET tái chế thành sợi", body: "1kg chai PET có thể tạo ra khoảng 0,7kg sợi tái sinh, đủ dệt 2 chiếc áo phông.", cost: 500, open: true },
  { id: "EF-02", title: "Phân loại 3R tại Việt Nam", body: "Reduce - giảm phát sinh, Reuse - dùng lại, Recycle - tái chế. Luôn theo thứ tự này.", cost: 800, open: true },
  { id: "EF-03", title: "Pin Li-ion gây hoạ hoả", body: "Pin bị dập có thể tự nóng và cháy trong thùng rác. Cần đưa riêng tới điểm thu gom điện tử.", cost: 1_200, open: false },
  { id: "EF-04", title: "Màu nắp thùng rác có ý nghĩa", body: "Xanh lá thường cho rác tái chế, vàng cho rác hữu cơ. Quy ước thay đổi theo địa phương, phải xem hướng dẫn tại khu vực của bạn.", cost: 1_500, open: false },
  { id: "EF-05", title: "Bìa carton thu gom giá 2.200đ/kg", body: "Giá này áp dụng cho bìa sạch, khô, không còn lớp nhựa. Bìa dính bọc thực phẩm không đạt mức này.", cost: 2_000, open: false },
  { id: "EF-06", title: "Thuế nhập phẩm và tái chế (EPR)", body: "Hạn ngạch EPR buộc nhà sản xuất bao bì chịu trách nhiệm thu gom từ năm 2024, thay đổi cách giá rác được tính.", cost: 3_000, open: false },
]

/* ---------------------------------------------------------------------- S-10 */

export type Gift = {
  id: string
  name: string
  cost: number
  /** null = không giới hạn (voucher) */
  stock: number | null
  kind: "gift" | "voucher"
  active: boolean
}

export const GIFTS: Gift[] = [
  { id: "g-bag", name: "Túi vải tái chế EcoLink", cost: 2_000, stock: 120, kind: "gift", active: true },
  { id: "g-kit", name: "Bộ dụng cụ thu gom gia đình", cost: 9_000, stock: 38, kind: "gift", active: true },
  { id: "g-coupon10", name: "Giảm 10% phiếu thu gom", cost: 6_000, stock: null, kind: "voucher", active: true },
  { id: "g-tree", name: "Một cây xanh trồng từ rác", cost: 4_500, stock: 64, kind: "gift", active: true },
  { id: "g-old", name: "Hộp bánh mì không nhựa (mẫu cũ)", cost: 5_000, stock: 0, kind: "gift", active: false },
]

/* ---------------------------------------------------------------------- A-01, A-02 */

export const STATS = {
  users: 48_210,
  recyclers: 1_284,
  handovers30d: 3_640,
  volume30d: 214_500,
  gross30d: 1_842_000_000,
  fee30d: 147_360_000,
  /** giao dịch đang chờ nhân viên xử lý */
  pending: {
    aiCases: AI_CASES.filter((c) => !c.inDataset).length,
    applications: APPLICATIONS.filter((a) => a.status === "pending").length,
    complaints: COMPLAINTS.filter((c) => c.status !== "resolved").length,
    posts: POSTS.filter((p) => p.status === "pending").length,
  },
  trend: [
    { month: "T4", handovers: 2_180, volume: 132_000 },
    { month: "T5", handovers: 2_640, volume: 158_000 },
    { month: "T6", handovers: 2_950, volume: 171_000 },
    { month: "T7", handovers: 3_210, volume: 189_000 },
    { month: "T8", handovers: 3_380, volume: 198_000 },
    { month: "T9", handovers: 3_640, volume: 214_500 },
  ],
  /** Chất lượng nhận diện AI trong 30 ngày, tách theo nhóm rác.
   *
   *  `correct` là số lượt quét mà AI đoán đúng. `falseReports` là số khiếu nại
   *  của người dùng mà kiểm lại thì AI đúng, người dùng báo nhầm — cần theo dõi
   *  riêng vì nó tốn công nhân viên xác minh mà không thu được gì, và nhiều khi
   *  báo sai vì ảnh chụp mờ chứ không phải vì AI kém.
   *
   *  `correct / scans` là tỷ lệ đúng thực tế của nhóm, dưới mức trung bình nghĩa
   *  là nhóm đó đang đánh đổi uy tín. */
  aiByGroup: [
    { group: "Nhựa", scans: 48_200, correct: 45_140, falseReports: 512 },
    { group: "Giấy", scans: 21_600, correct: 20_520, falseReports: 188 },
    { group: "Kim loại", scans: 14_300, correct: 13_614, falseReports: 96 },
    { group: "Thủy tinh", scans: 12_900, correct: 11_895, falseReports: 341 },
    { group: "Hữu cơ", scans: 8_700, correct: 8_178, falseReports: 143 },
    { group: "Điện tử", scans: 6_100, correct: 5_429, falseReports: 407 },
  ],
}

/** Cột cao nhất của biểu đồ, dùng để quy về %. Không hardcode 100% vì chiều
 *  cao cột phải bám dữ liệu, không bám con số đẹp. */
export const TREND_PEAK = Math.max(...STATS.trend.map((t) => t.handovers))

/** Số lượt quét lớn nhất — mẫu số chung để hai dãi thanh dùng CÙNG một thang
 *  đo. Nếu mỗi dải tự chuẩn hoá theo giá trị lớn nhất của nó thì mắt so sánh
 *  nhầm: cột "khiếu nại sai" dài bằng cột lớn nhất của nó chứ không phải bằng
 *  tỷ lệ thật. */
export const AI_SCAN_PEAK = Math.max(...STATS.aiByGroup.map((g) => g.scans))

/* ---------------------------------------------------------------------- A-07, A-08 */

export const GAMIFICATION = {
  /** điểm cho mỗi kg bàn giao đúng loại */
  pointsPerKg: 10,
  /** điểm thưởng khi nhân viên gán nhãn đúng */
  labelBonus: 5,
  tiers: [
    { name: "Mầm", min: 0, factCost: 0 },
    { name: "Cây", min: 5_000, factCost: 500 },
    { name: "Rừng", min: 15_000, factCost: 1_200 },
    { name: "Đại dương", min: 30_000, factCost: 2_000 },
  ],
}

export const CYCLES = [
  { id: "week", label: "Tuần", from: "Thứ 2", to: "Chủ nhật", active: true },
  { id: "month", label: "Tháng", from: "Ngày 1", to: "Ngày cuối tháng", active: true },
  { id: "quarter", label: "Quý", from: "Ngày 1 quý", to: "Ngày cuối quý", active: false },
] as const

/* ---------------------------------------------------------------------- A-10 */

export const FEE = {
  rate: FEE_RATE,
  /** phần phí cố định trên mỗi lượt thu gom, đồng */
  fixed: 2_000,
  minNet: 5_000,
  effectiveFrom: "01/09/2026",
}

export const fmtInt = (n: number) => n.toLocaleString("vi-VN")
export const fmtVnd = (n: number) => n.toLocaleString("vi-VN") + " đ"