import { FEE_RATE } from "@/data/waste"

/** Khung giờ dùng chung cho U-07 (User chọn) và R-03 (Recycler chốt).
 *  Một danh sách, hai bên dùng — lệch danh sách là sinh lịch không khớp. */
export const TIME_SLOTS = [
  "08:00 - 10:00",
  "10:00 - 12:00",
  "13:30 - 15:30",
  "15:30 - 17:30",
  "17:30 - 19:00",
] as const

export type HandoverStatus =
  | "pending"     // User đã tạo, chờ Recycler
  | "accepted"    // Recycler nhận, đã chốt khung giờ
  | "collected"   // Recycler đã bàn giao, chờ User xác nhận
  | "done"        // User xác nhận biên nhận, đã giải ngân
  | "cancelled"   // User huỷ
  | "declined"    // Recycler từ chối
  | "broken"      // Recycler huỷ giữa chừng, có lý do

export const STATUS_LABEL: Record<HandoverStatus, string> = {
  pending: "Chờ xác nhận",
  accepted: "Đã nhận",
  collected: "Chờ xác nhận bàn giao",
  done: "Hoàn tất",
  cancelled: "Đã huỷ",
  declined: "Bị từ chối",
  broken: "Thu gom bị huỷ",
}

export type HandoverLine = { wasteId: string; kg: number }

/** Một yêu cầu bàn giao. Dùng chung cho danh sách của User (U-07, U-08) và
 *  của Recycler (R-03, R-04) — chỉ khác góc nhìn, không khác dữ liệu. */
export type Handover = {
  id: string
  recycler: string
  address: string
  date: string
  slot: string
  lines: HandoverLine[]
  status: HandoverStatus
  /** lý do, chỉ có khi Recycler huỷ giữa chừng (R-04) */
  reason?: string
  /** khối lượng Recycler cân thực tế (R-06), khác `lines` là ước tính của User */
  actual?: HandoverLine[]
  /** biểu chỉnh giá tại thời điểm nhận tiền, đồng/kg (U-10) */
  feeRate?: number
}

export const MY_HANDOVERS: Handover[] = [
  {
    id: "BH-2609-0184",
    recycler: "Cô Ba Thu Gom",
    address: "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1",
    date: "28/09/2026",
    slot: TIME_SLOTS[1],
    lines: [
      { wasteId: "carton", kg: 15 },
      { wasteId: "pet", kg: 5 },
    ],
    status: "accepted",
  },
  {
    id: "BH-2609-0121",
    recycler: "Vựa Minh Khai",
    address: "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1",
    date: "21/09/2026",
    slot: TIME_SLOTS[2],
    lines: [
      { wasteId: "aluminum", kg: 4 },
      { wasteId: "steel", kg: 8 },
    ],
    status: "done",
    actual: [
      { wasteId: "aluminum", kg: 4.2 },
      { wasteId: "steel", kg: 7.6 },
    ],
    feeRate: FEE_RATE,
  },
  {
    id: "BH-2608-0409",
    recycler: "Cô Ba Thu Gom",
    address: "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1",
    date: "12/08/2026",
    slot: TIME_SLOTS[4],
    lines: [{ wasteId: "glass", kg: 20 }],
    status: "done",
    actual: [{ wasteId: "glass", kg: 18 }],
    feeRate: FEE_RATE,
  },
]

/** Hàng chờ của Recycler (R-03). Cùng kiểu `Handover`, khác nguồn dữ liệu. */
export const INCOMING: Handover[] = [
  {
    id: "BH-2609-0201",
    recycler: "Chưa có",
    address: "114 Lý Văn Phức, Phường 2, Quận 3",
    date: "30/09/2026",
    slot: TIME_SLOTS[2],
    lines: [
      { wasteId: "carton", kg: 30 },
      { wasteId: "office-paper", kg: 12 },
    ],
    status: "pending",
  },
  {
    id: "BH-2609-0199",
    recycler: "Chưa có",
    address: "22 Nguyễn Văn Cừ, Phường 5, Quận 5",
    date: "30/09/2026",
    slot: TIME_SLOTS[0],
    lines: [
      { wasteId: "steel", kg: 45 },
      { wasteId: "aluminum", kg: 9 },
    ],
    status: "pending",
  },
  {
    id: "BH-2609-0184",
    recycler: "Cô Ba Thu Gom",
    address: "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1",
    date: "28/09/2026",
    slot: TIME_SLOTS[1],
    lines: [
      { wasteId: "carton", kg: 15 },
      { wasteId: "pet", kg: 5 },
    ],
    status: "collected",
  },
  {
    id: "BH-2609-0150",
    recycler: "Cô Ba Thu Gom",
    address: "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1",
    date: "25/09/2026",
    slot: TIME_SLOTS[4],
    lines: [{ wasteId: "pet", kg: 6 }],
    status: "broken",
    reason: "Xe tải hỏng bơm, ca đêm đông khách nên dời sang ngày mai.",
  },
]

/** Các mốc trạng thái trên trang User: dùng nhãn, không dùng mã. */
export const TONE: Record<HandoverStatus, "todo" | "wait" | "ok" | "off"> = {
  pending: "wait",
  accepted: "todo",
  collected: "todo",
  done: "ok",
  cancelled: "off",
  declined: "off",
  broken: "off",
}

/** Tính tiền một yêu cầu: dùng khối lượng thực nếu có (đã có biên nhận),
 *  ngược lại lấy khối lượng User ước tính. */
export function calc(h: Handover, priceOf: (id: string) => number) {
  const src = h.actual ?? h.lines
  const gross = src.reduce((s, l) => s + l.kg * priceOf(l.wasteId), 0)
  const rate = h.feeRate ?? FEE_RATE
  const fee = Math.round(gross * rate)
  return { gross, fee, net: gross - fee, rate }
}