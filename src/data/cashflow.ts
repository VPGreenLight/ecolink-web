/** Dòng tiền của người dân (U-14) và đối soát của Admin (A-11).
 *
 *  Mỗi giao dịch thành công tạo ra 3 dòng: pay-in từ Recycler, phí nền tảng
 *  giữ lại, và pay-out về tài khoản người dân (SYS-01). Ba dòng cùng tham
 *  chiếu `tx` — đối soát là so 3 dòng đó với nhau, không phải đọc dòng đơn
 *  lẻ. */
export type CashFlow = {
  id: string
  date: string
  handoverId: string
  /** loại dòng tiền */
  kind: "payin" | "fee" | "payout"
  amount: number
  /** đối tác hoặc đích nhận */
  party: string
  note: string
}

export const FLOWS: CashFlow[] = [
  {
    id: "CF-2609-0184",
    date: "28/09/2026",
    handoverId: "BH-2609-0184",
    kind: "payout",
    amount: 17_600,
    party: "STK 0070 1234 5678 · Nguyễn Đức",
    note: "Giải ngân tự động qua PayOS sau khi Recycler xác nhận Pay-in.",
  },
  {
    id: "CF-2609-0184-a",
    date: "28/09/2026",
    handoverId: "BH-2609-0184",
    kind: "payin",
    amount: 19_143,
    party: "Cô Ba Thu Gom",
    note: "Recycler chuyển khoản VietQR để bàn giao.",
  },
  {
    id: "CF-2609-0184-f",
    date: "28/09/2026",
    handoverId: "BH-2609-0184",
    kind: "fee",
    amount: 1_543,
    party: "Phí nền tảng 8%",
    note: "Trích trên giao dịch thành công.",
  },
  {
    id: "CF-2609-0121",
    date: "21/09/2026",
    handoverId: "BH-2609-0121",
    kind: "payout",
    amount: 87_770,
    party: "STK 0070 1234 5678 · Nguyễn Đức",
    note: "Giải ngân tự động qua PayOS.",
  },
  {
    id: "CF-2609-0121-a",
    date: "21/09/2026",
    handoverId: "BH-2609-0121",
    kind: "payin",
    amount: 95_402,
    party: "Vựa Minh Khai",
    note: "Recycler chuyển khoản VietQR để bàn giao.",
  },
  {
    id: "CF-2609-0121-f",
    date: "21/09/2026",
    handoverId: "BH-2609-0121",
    kind: "fee",
    amount: 7_632,
    party: "Phí nền tảng 8%",
    note: "Trích trên giao dịch thành công.",
  },
  {
    id: "CF-2608-0409",
    date: "12/08/2026",
    handoverId: "BH-2608-0409",
    kind: "payout",
    amount: 14_904,
    party: "STK 0070 1234 5678 · Nguyễn Đức",
    note: "Giải ngân tự động qua PayOS.",
  },
]

/** Ngân hàng liên kết trong form tài khoản nhận tiền (U-13). */
export const BANKS = [
  "Vietcombank",
  "Techcombank",
  "BIDV",
  "MB Bank",
  "Agribank",
  "VPBank",
] as const

export const KIND_LABEL = {
  payin: "Thu vào từ đối tác",
  fee: "Phí nền tảng",
  payout: "Bãn ra về tài khoản",
} as const

/** Kiểm tra số tài khoản ngân hàng Việt Nam: 6-20 chữ số. Chỉ kiểm tra độ
 *  dài vì định dạng cụ thể khác nhau theo ngân hàng — chặt hơn thì chặn nhầm
 *  tài khoản hợp lệ. */
export function validAccount(no: string) {
  return /^\d{6,20}$/.test(no.replace(/[\s.]/g, ""))
}