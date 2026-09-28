/** Điểm danh hằng ngày. Ngày liên tiếp thì chuỗi tiếp, bỏ một ngày thì
 *  chuỗi đứt. Chuỗi 7 ngày đủ thì quay lại ngày 1 và nhận thưởng lớn hơn.
 *
 *  ponytail: lưu localStorage vì điểm danh mà không nhớ trạng thái thì vô
 *  nghĩa — mở lại trang là mất. Khi có tài khoản thật thì đọc/ghi server,
 *  hàm này giữ nguyên vì nó thuần, không đụng DOM. */

export const CHECKIN_REWARDS = [20, 30, 50, 70, 100, 150, 500] as const
export const CHECKIN_DAYS = CHECKIN_REWARDS.length

export type CheckIn = { /** số ngày đã điểm danh liên tiếp, 0 = chưa ngày nào */ day: number; /** yyyy-mm-dd lần điểm danh gần nhất */ last: string }

/** yyyy-mm-dd theo giờ địa phương (toISOString đổi sang UTC nên lệch ngày). */
export function dayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function readCheckIn(key: string): CheckIn {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const v = JSON.parse(raw)
      if (typeof v?.day === "number" && typeof v?.last === "string") return v as CheckIn
    }
  } catch {
    /* JSON hong / bi chan trong private mode -> coi nhu chua danh */
  }
  return { day: 0, last: "" }
}

export function writeCheckIn(key: string, v: CheckIn): void {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* khong giu duoc thi thoi, diem van hien tren man hinh */
  }
}

/** ngày hôm nay đã điểm danh chưa */
export function doneToday(v: CheckIn, today = dayKey()): boolean {
  return v.last === today
}

/** điểm sẽ nhận được nếu điểm danh hôm nay, 0 nếu hôm nay đã điểm danh rồi.
 *  Điểm chuỗi 7 ngày = 920; ngày thứ 7 trả 500 chiếm hơn nửa, đủ để tạo
 *  lý do phải quay lại ngày 7 mà không bị xem là bắt lợi nhiều. */
export function nextReward(v: CheckIn, today = dayKey()): number {
  if (doneToday(v, today)) return 0
  return CHECKIN_REWARDS[(v.day % CHECKIN_DAYS)]
}

/** ngày nào sẽ điểm danh tiếp theo — chuỗi còn giữ hay đứt.
 *  day === 0 KHÔNG đủ để kết luận chuỗi còn sống: sau khi đủ 7 ngày, day quay
 *  về 0 nhưng chuỗi vẫn phải còn nếu hôm qua có điểm danh. Chỉ "chưa từng
 *  điểm danh" (last rỗng) mới coi là bắt đầu. */
export function streakAlive(v: CheckIn, today = dayKey()): boolean {
  if (doneToday(v, today)) return true
  if (!v.last) return true
  const t = new Date(`${today}T00:00:00`)
  t.setDate(t.getDate() - 1)
  return v.last === dayKey(t)
}

/** bấm điểm danh hôm nay. Trả về trạng thái mới + điểm được cộng. */
export function checkIn(v: CheckIn, today = dayKey()): { next: CheckIn; gained: number } {
  if (doneToday(v, today)) return { next: v, gained: 0 }
  // carried = số ngày đã điểm danh liên tiếp, nên hôm nay là ngày thứ
  // carried + 1, phần thưởng nằm ở chỉ số carried. Ngày thứ 7 (carried = 6)
  // nhận CHECKIN_REWARDS[6] = 500 rồi next.day quay về 0.
  const carried = streakAlive(v, today) ? v.day : 0
  return {
    next: { day: (carried + 1) % CHECKIN_DAYS, last: today },
    gained: CHECKIN_REWARDS[carried],
  }
}
