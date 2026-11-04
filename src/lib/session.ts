import { useSyncExternalStore } from "react"

/** 4 vai trò sau khi đăng nhập. GUEST = chưa đăng nhập, không lưu gì. */
export type Role = "user" | "recycler" | "staff" | "admin"

export const ROLE_LABEL: Record<Role, string> = {
  user: "Người dân",
  recycler: "Cơ sở thu mua",
  staff: "Nhân viên",
  admin: "Quản trị viên",
}

/** Trang chủ sau khi đăng nhập, theo vai trò. */
export const ROLE_HOME: Record<Role, string> = {
  user: "/user",
  recycler: "/recycler",
  staff: "/staff",
  admin: "/admin",
}

const KEY = "ecolink:user"
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((l) => l())

export type Session = { name: string; role: Role }

/** Bộ nhớ đệm của getSnapshot.
 *
 *  BẮT BUỘC phải có. `useSyncExternalStore` so sánh kết quả của `getSnapshot`
 *  bằng `Object.is`: nếu mỗi lần gọi đều trả về object MỚI thì luôn khác
 *  nhau, React coi là đã đổi rồi render lại, lại gọi, lại khác... đến khi vượt
 *  "Maximum update depth exceeded" và **dựng lại cả cây — trang trắng**.
 *
 *  Trước đây `session.ts` trả về một CHUỖI, primitive nên `Object.is` ổn định
 *  và không có vòng lặp. Đổi sang object mà quên chuyện này là nguyên nhân trang
 *  trắng — và nó xảy ra ở MỌI trang khi đã đăng nhập, vì navbar gọi
 *  `useSession()` trên khắp app chứ không riêng trang quản trị. */
let cached: Session | null = null
let primed = false

function readSession(): Session | null {
  // Máy chủ thật không có localStorage. Guard ở đây (thay vì chỉ ở nhánh
  // server) để getSnapshot và getServerSnapshot đọc CÙNG một nguồn — hai
  // nhánh trả hai giá trị khác nhau chính là mẫu hình React báo lệch
  // hydration, và làm mọi route có RequireRole render sai ở lần đầu.
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    if (typeof v?.name !== "string") return null
    return { name: v.name, role: ROLE_LABEL[v.role as Role] ? (v.role as Role) : "user" }
  } catch {
    return null
  }
}

/** Bỏ đệm để lần đọc kế tiếp nạp lại từ localStorage. */
function invalidate() {
  cached = null
  primed = false
}

export function getSession(): Session | null {
  if (!primed) {
    cached = readSession()
    primed = true
  }
  return cached
}

export function signIn(name: string, role: Role = "user") {
  localStorage.setItem(KEY, JSON.stringify({ name, role }))
  invalidate()
  emit()
}

export function signOut() {
  localStorage.removeItem(KEY)
  invalidate()
  emit()
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // keep other tabs in sync — bỏ đệm TRƯỚC khi báo, nếu không React so được với
  // giá trị cũ rồi mới vỡ
  const onStorage = () => {
    invalidate()
    onChange()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onStorage)
  }
}

/** phiên hiện tại, hoặc null khi chưa đăng nhập. */
export function useSession() {
  return useSyncExternalStore(subscribe, getSession, getSession)
}

/** Tên hiển thị, hoặc "" khi chưa đăng nhập. */
export function useUser() {
  return useSession()?.name ?? ""
}

export function useRole(): Role | null {
  return useSession()?.role ?? null
}