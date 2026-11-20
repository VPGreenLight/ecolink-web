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

export const MAX_APPOINTMENT_DAYS = 30

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

export function toLocalDateInputValue(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function addDaysToLocalDateInput(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number)
  if (!y || !m || !d) return toLocalDateInputValue()
  const base = new Date(y, m - 1, d)
  base.setDate(base.getDate() + days)
  return toLocalDateInputValue(base)
}

export function getAppointmentDateBounds(now: Date = new Date()): {
  minDate: string
  maxDate: string
} {
  const minDate = toLocalDateInputValue(now)
  const maxDate = addDaysToLocalDateInput(minDate, MAX_APPOINTMENT_DAYS)
  return { minDate, maxDate }
}

export function formatIsoDateToVi(dateIso: string): string {
  const m = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return dateIso
  return `${m[3]}/${m[2]}/${m[1]}`
}

export function parseViOrIsoDateToIsoInput(raw?: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const isoMatch = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  const vnMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (vnMatch) {
    return `${vnMatch[3]}-${pad2(Number(vnMatch[2]))}-${pad2(Number(vnMatch[1]))}`
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return toLocalDateInputValue(parsed)
  }
  return null
}

export function getTimeSlotStartMinutes(slot: string): number | null {
  const match = slot.match(/(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hh = Number(match[1])
  const mm = Number(match[2])
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null
  }
  return hh * 60 + mm
}

export function isTimeSlotInPastForDate(
  dateIso: string,
  slot: string,
  now: Date = new Date(),
): boolean {
  const todayIso = toLocalDateInputValue(now)
  if (!dateIso || dateIso < todayIso) return true
  if (dateIso > todayIso) return false

  const startMin = getTimeSlotStartMinutes(slot)
  if (startMin === null) return false
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return startMin <= nowMin
}

export function getDefaultAppointmentDateAndSlot(now: Date = new Date()): {
  dateIso: string
  slot: string
} {
  const todayIso = toLocalDateInputValue(now)
  const preferredOrder = [TIME_SLOTS[1], ...TIME_SLOTS.filter((s) => s !== TIME_SLOTS[1])]
  const validToday = preferredOrder.find((s) => !isTimeSlotInPastForDate(todayIso, s, now))
  if (validToday) {
    return { dateIso: todayIso, slot: validToday }
  }
  return {
    dateIso: addDaysToLocalDateInput(todayIso, 1),
    slot: TIME_SLOTS[1],
  }
}

export function validateAppointmentSelection(
  dateIso: string,
  slot: string,
  now: Date = new Date(),
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return "Vui lòng chọn ngày hẹn hợp lệ."
  }
  const { minDate, maxDate } = getAppointmentDateBounds(now)
  if (dateIso < minDate) {
    return "Không thể chọn ngày hẹn trong quá khứ."
  }
  if (dateIso > maxDate) {
    return `Chỉ được chọn ngày hẹn từ hôm nay đến tối đa ${MAX_APPOINTMENT_DAYS} ngày tới.`
  }
  if (!slot.trim()) {
    return "Vui lòng chọn khung giờ thu gom."
  }
  if (isTimeSlotInPastForDate(dateIso, slot, now)) {
    return "Khung giờ này hôm nay đã qua. Vui lòng chọn khung giờ sau hoặc chọn ngày khác."
  }
  return null
}

export function extractPureTimeSlot(rawSlot?: string | null): string {
  const fallback = TIME_SLOTS[1]
  if (!rawSlot) return fallback
  const trimmed = rawSlot.trim()
  const matchedKnown = TIME_SLOTS.find((s) => trimmed.includes(s))
  if (matchedKnown) return matchedKnown
  const stripped = trimmed
    .replace(/^\d{4}-\d{2}-\d{2}\s*/, "")
    .replace(/^\d{1,2}\/\d{1,2}\/\d{4}\s*/, "")
    .replace(/^[·•\-|\s]+/, "")
    .replace(/^\((.+)\)$/, "$1")
    .trim()
  return stripped || fallback
}

export function formatCombinedAppointmentSlot(dateIso: string, slot: string): string {
  const pureSlot = extractPureTimeSlot(slot)
  return `${formatIsoDateToVi(dateIso)} (${pureSlot})`
}

export function splitCombinedAppointmentSlot(
  rawSlot?: string | null,
  fallbackDateRaw?: string | null,
): { dateIso: string; dateVi: string; timeSlot: string } {
  const parsedDateFromSlot = parseViOrIsoDateToIsoInput(rawSlot)
  const parsedFallback = parseViOrIsoDateToIsoInput(fallbackDateRaw)
  const dateIso = parsedDateFromSlot || parsedFallback || toLocalDateInputValue()
  return {
    dateIso,
    dateVi: formatIsoDateToVi(dateIso),
    timeSlot: extractPureTimeSlot(rawSlot),
  }
}

export function buildScheduledAtIso(dateIso: string, slot: string): string {
  const [y, m, d] = dateIso.split("-").map(Number)
  const startMin = getTimeSlotStartMinutes(slot) ?? 10 * 60
  const hh = Math.floor(startMin / 60)
  const mm = startMin % 60
  if (!y || !m || !d) return new Date(Date.now() + 2 * 3600 * 1000).toISOString()
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString()
}

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
  /** Mã hiển thị thân thiện trên UI (VD: BH-A3F18C) */
  displayCode?: string
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