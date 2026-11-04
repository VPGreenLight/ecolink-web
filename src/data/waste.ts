/** Danh mục rác hệ thống (A-05) và hướng dẫn xử lý (U-02, U-03, A-06).
 *
 *  Một danh sách dùng cho cả ba nơi vì chúng là cùng một dữ liệu: danh mục
 *  rác + giá tham khảo + cách xử lý. Tách riêng ba bản là ba chỗ phải sửa
 *  cùng lúc khi Admin đổi một loại rác (A-05).
 *
 *  `rule` là câu Rule Engine mà Admin sửa ở /admin/policy (A-06) và người dùng
 *  đọc ở /guidance (U-02) — cùng một chuỗi, không diễn giải lại. */
export type Waste = {
  id: string
  name: string
  group: "Nhựa" | "Giấy" | "Kim loại" | "Thủy tinh" | "Điện tử" | "Hữu cơ"
  /** đơn giá thu mua tham khảo, đồng/kg */
  price: number
  /** rác có thu gom lại hay đem xử lý riêng */
  recyclable: boolean
  rule: string
  prep: string
}

export const WASTE_GROUPS = [
  "Tất cả nhóm",
  "Nhựa",
  "Giấy",
  "Kim loại",
  "Thủy tinh",
  "Điện tử",
  "Hữu cơ",
] as const

export const WASTES: Waste[] = [
  {
    id: "pet",
    name: "Chai nhựa PET",
    group: "Nhựa",
    price: 5_500,
    recyclable: true,
    rule: "Chai nước, nước giải khát, dầu gội. Nắp nhựa để riêng.",
    prep: "Tráng sơ bằng nước sạch, giãm dẹp, không lẫn nước.",
  },
  {
    id: "hdpe",
    name: "Can nhựa HDPE",
    group: "Nhựa",
    price: 4_800,
    recyclable: true,
    rule: "Can dầu ăn, can nước, bình nhựa cứng. Bỏ nắp và nhãn nhựa.",
    prep: "Rửa sạch, để ráo nước, giãm dẹp.",
  },
  {
    id: "carton",
    name: "Bìa carton",
    group: "Giấy",
    price: 2_200,
    recyclable: true,
    rule: "Thùng carton, hộp giấy, bìa bao bì. Không thu gom giấy ướt.",
    prep: "Bỏ lớp dính và băng keo, gấp phẳng.",
  },
  {
    id: "office-paper",
    name: "Giấy văn phòng",
    group: "Giấy",
    price: 1_900,
    recyclable: true,
    rule: "Giấy A4, sổ, hồ sơ hủy bảo mật qua đối tác có chứng chỉ.",
    prep: "Bỏ ghim, bìa nhựa, dây buộc.",
  },
  {
    id: "steel",
    name: "Sắt thép",
    group: "Kim loại",
    price: 3_600,
    recyclable: true,
    rule: "Xà gồ, đinh, vỏ hộp. Nhựa bọc phải bóc trước.",
    prep: "Bóc lớp sơn và nhựa, chặt ngắn nếu thanh dài.",
  },
  {
    id: "aluminum",
    name: "Nhôm và hợp kim",
    group: "Kim loại",
    price: 14_000,
    recyclable: true,
    rule: "Lon nước, vỏ hộp, xốp nhôm bọc thực phẩm.",
    prep: "Giữ nguyên vỏ lon, không ép dẹp mạnh.",
  },
  {
    id: "glass",
    name: "Thủy tinh",
    group: "Thủy tinh",
    price: 900,
    recyclable: true,
    rule: "Chai lọ, hũ thuỷ tinh. Không thu gom gương, kính cường lực.",
    prep: "Rót hết chất lỏng, đậy nắp kín để không vỡ khi vận chuyển.",
  },
  {
    id: "battery",
    name: "Pin và ắc quy",
    group: "Điện tử",
    price: 25_000,
    recyclable: true,
    rule: "Pin Li-ion, ắc quy, sạc dự phòng. Điểm thu mua điện tử mới nhận.",
    prep: "Dán băng keo lên cực pin, không để chung với rác ướt.",
  },
  {
    id: "ewaste",
    name: "Thiết bị điện tử",
    group: "Điện tử",
    price: 8_500,
    recyclable: true,
    rule: "Điện thoại, máy tính, màn hình, linh kiện hỏng.",
    prep: "Xoá dữ liệu trước khi bàn giao, tháo thẻ nhớ nếu có.",
  },
  {
    id: "organic",
    name: "Rác hữu cơ",
    group: "Hữu cơ",
    price: 0,
    recyclable: false,
    rule: "Vỏ rau củ, thức ăn thừa. Không đưa vào nhóm thu gom phế liệu.",
    prep: "Bỏ trực tiếp vào thùng rác hữu cơ của địa phương.",
  },
]

/** Tiền tạm tính cho một yêu cầu bàn giao (U-07). Dùng chung công thức với
 *  biên nhận (U-10, R-06) để số tiền khách thấy lúc đặt và số tiền trả lúc
 *  giao luôn bằng nhau — lệch nhau là lý do phát sinh khiếu nại. */
export function estimate(items: { wasteId: string; kg: number }[]) {
  const lines = items.map((it) => {
    const w = WASTES.find((x) => x.id === it.wasteId)
    const unit = w?.recyclable ? (w?.price ?? 0) : 0
    return { ...it, unit, total: unit * it.kg }
  })
  const gross = lines.reduce((s, l) => s + l.total, 0)
  return { lines, gross }
}

/** Phí nền tảng (A-10) trích trên mỗi giao dịch thành công. Đặt ở đây vì cả
 *  biên nhận (U-10) và đối soát (A-11) đều cần đúng một con số. */
export const FEE_RATE = 0.08

/** Giải ngân (SYS-01): PayOS bắn tiền cho User sau khi Recycler đã Pay-in.
 *  Phí do nền tảng giữ lại, phần còn lại về tài khoản ngân hàng của User. */
export function settle(gross: number) {
  const fee = Math.round(gross * FEE_RATE)
  return { gross, fee, net: gross - fee }
}

export const VND = (n: number) => n.toLocaleString("vi-VN") + " đ"