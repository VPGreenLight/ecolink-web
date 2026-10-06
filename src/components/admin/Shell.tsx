import { useEffect, useRef, useState } from "react"
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom"
import { PORTAL_NAV } from "@/data/portal"
import { ROLE_LABEL, signOut, useSession } from "@/lib/session"
import Assistant from "@/components/admin/Assistant"

/** Menu tài khoản nội bộ.
 *
 *  KHÔNG dùng `/account/profile` và `/account/password` của người dân: đó là
 *  trang của tài khoản công khai — nội dung khác hẳn (điểm cây ảo, lịch thu
 *  gom, yêu cầu bàn giao) và bấm vào sẽ rời khỏi console ra trang có navbar.
 *  Trang riêng cho staff và admin nằm cùng khung `AdminShell`, ở `/{role}/account`. */
const ACCOUNT_ITEMS = {
  staff: [
    ["/staff/account", "Hồ sơ và thông báo"],
    ["/staff/account/password", "Đổi mật khẩu"],
  ],
  admin: [
    ["/admin/account", "Hồ sơ và thông báo"],
    ["/admin/account/password", "Đổi mật khẩu"],
  ],
} as const

/** Khung riêng cho hai vai trò làm việc trong hệ thống: STAFF và ADMIN.
 *
 *  CỐ TÌNH không dùng `Layout` của app công khai: đây là công cụ vận hành, không
 *  phải một trang trong app của người dân. Dùng chung khung thì nó mặc navbar
 *  bán hàng, tab-bar điều hướng và footer của người dùng — cả ba đều không liên
 *  quan tới việc thẩm định dữ liệu hay cấu hình hệ thống.
 *
 *  Khác biệt nhìn thấy được ngay:
 *  - không có navbar công khai, không có footer, không có thanh tab dưới
 *  - thanh trên cố định 56px (thấp hơn navbar 76px) để nhường chỗ cho dữ liệu
 *  - sidebar 232px, dùng chung bề rộng cho mọi trang nên khi đổi trang
 *    nội dung không nhảy
 *  - sidebar TỰ CUỘN, không cuộn cả trang: `<aside>` `sticky` chiếm đúng
 *    chiều cao khung nhìn, trong đó `<nav>` cuộn và nút Đăng xuất đứng yên ở
 *    đáy. Nếu để nút trong dòng cuộn của nav thì nó trôi mất khi trang dài.
 *
 *  Menu đọc từ `PORTAL_NAV[role]` nên staff và admin dùng chung component,
 *  chỉ khác con trỏ ngữ cảnh (role) và nhãn badge. */
export default function AdminShell({ role }: { role: "staff" | "admin" }) {
  const session = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const logout = () => {
    signOut()
    navigate("/login")
  }

  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-40 h-14 border-b border-line-soft bg-white/90 backdrop-blur-xl">
        <div className="flex h-full items-center gap-3 px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="admin-nav"
            className="grid size-9 place-items-center rounded-lg text-ink transition-colors hover:bg-surface-2 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <span className="sr-only">Mở menu</span>
          </button>

          <img src="/assets/brand/logo1.png" alt="EcoLink" className="h-7 w-auto" />
          <span className="rounded-md bg-brand/10 px-2 py-1 text-[11px] font-bold tracking-[0.1em] text-brand uppercase">
            {ROLE_LABEL[role]}
          </span>

          <div className="ml-auto">
            <AccountMenu
              name={session?.name ?? ""}
              label={ROLE_LABEL[role]}
              items={ACCOUNT_ITEMS[role]}
            />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* `sticky` + chiều cao khung nhìn: cột này đứng yên khi cuộn trang,
            chỉ phần menu bên trong mới cuộn. */}
        <aside className="flex w-58 shrink-0 flex-col border-r border-line-soft bg-white lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]">
          <nav
            id="admin-nav"
            aria-label="Điều hướng khu vực quản trị"
            className={`${open ? "block" : "hidden"} lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-4 lg:py-6`}
          >
            {PORTAL_NAV[role].map((sec) => (
              <div key={sec.title} className="px-4 pb-5 lg:px-0">
                <h2 className="px-3 text-[11px] font-bold tracking-[0.12em] text-brand uppercase">
                  {sec.title}
                </h2>
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {sec.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to.split("/").length <= 2}
                        className={({ isActive }) =>
                          `block rounded-md px-3 py-2 text-[13px] leading-5 font-medium transition-colors ${
                            isActive
                              ? "bg-brand text-white"
                              : "text-body hover:bg-surface-2 hover:text-ink"
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* Ngoài `<nav>` để không cuộn theo menu. Đỏ khi hover: đây là hành
              động phá phiến phiên làm việc, màu khác hẳn các nút khác trong
              khung để không bấm nhầm. */}
          <button
            type="button"
            onClick={logout}
            className="mx-4 mb-4 w-[calc(100%-2rem)] shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-800 lg:mt-auto"
          >
            Đăng xuất
          </button>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      <Assistant />
    </div>
  )
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

/** Avatar + menu tài khoản ở thanh trên.
 *
 *  Menu tài khoản KHÔNG nằm trong sidebar: sidebar là danh sách màn hình của
 *  khu vực làm việc, trộn 2 mục tài khoản dùng chung vào đó thì không phân biệt
 *  được đâu là việc công việc, đâu là việc của chính mình. Ở đây nó nằm sau
 *  avatar, đúng chỗ của nó ở mọi app khác. */
function AccountMenu({
  name,
  label,
  items,
}: {
  name: string
  label: string
  items: readonly (readonly [string, string])[]
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Đóng khi bấm ra ngoài hoặc bấm Esc — menu không có nút X, mất focus thì
  // phải tự về.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Tài khoản: ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-line bg-white py-1 pr-2 pl-1 transition-colors hover:border-sage-line hover:bg-surface-2"
      >
        <span className="grid size-8 place-items-center rounded-full bg-[linear-gradient(145deg,#00874a,#004826)] text-[12px] leading-none font-bold tracking-wide text-white">
          {initialsOf(name)}
        </span>
        <span className="hidden text-[13px] text-muted sm:block">{name}</span>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5 text-muted">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_44px_-8px_rgba(15,31,21,0.16)]"
        >
          <div className="flex items-center gap-3 border-b border-line-soft bg-surface-2/60 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#00874a,#004826)] text-sm leading-none font-bold tracking-wide text-white">
              {initialsOf(name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{name}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          </div>

          <div className="p-2">
            {items.map(([to, item]) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-4 text-muted">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M12 14c-3.9 0-7 2.4-7 5.4V21h14v-1.6c0-3-3.1-5.4-7-5.4Z" />
                </svg>
                {item}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate("/login")
              }}
              className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 hover:text-red-800"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-4">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Đổi tài khoản
            </button>
          </div>
        </div>
      )}
    </div>
  )
}