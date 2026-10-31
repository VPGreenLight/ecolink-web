import { useEffect, useRef, useState } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import { ROLE_HOME, ROLE_LABEL, useSession, type Role } from "@/lib/session"
import { openAuthPopup, openLogoutPopup } from "@/lib/popupAuth"
import { NAV_LINKS } from "@/data/nav"

function initialsOf(name: string) {
  return name
    .split(" ")
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

  /** Icon người dùng: viewBox cố định nên tỉ lệ đúng ở mọi size, khác với
   *  hình tròn + thang vẽ bằng phần trăm trước đây. */
function UserGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="12" cy="8" r="4.25" />
      <path d="M12 13.75c-4.28 0-7.75 2.7-7.75 6.03V21h15.5v-1.22c0-3.33-3.47-6.03-7.75-6.03Z" />
    </svg>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`size-3.5 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path
        d="m4 6 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Avatar({ user, size = "size-9" }: { user: string; size?: string }) {
  if (user) {
    return (
      <span
        className={`grid ${size} shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#00874a,#004826)] text-[13px] leading-none font-bold tracking-wide text-white`}
      >
        {initialsOf(user)}
      </span>
    )
  }
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-surface-2`}>
      <UserGlyph className="size-1/2 text-sage-line" />
    </span>
  )
}

/** Menu tài khoản: các mục dùng chung cho cả 4 vai trò sau đăng nhập. */
const ACCOUNT_ITEMS = [
  {
    to: "/account/profile",
    label: "Hồ sơ cá nhân",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 text-muted">
        <circle cx="12" cy="8" r="4" />
        <path d="M20 21a8 8 0 1 0-16 0" />
      </svg>
    ),
  },
  {
    to: "/account/notifications",
    label: "Thông báo",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 text-muted">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    to: "/account/password",
    label: "Đổi mật khẩu",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 text-muted">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
] as const

/** Mục Khám phá: dùng lại cho cả khách và người đã đăng nhập. `register` chỉ
 *  hiện khi đã đăng nhập — U-05 là bước nâng cấp từ tài khoản người dân lên
 *  cơ sở thu mua, người chưa có tài khoản thì chưa ở trong hệ sinh thái. */
const EXPLORE = [
  ["/scanner", "Nhận diện rác bằng AI"],
  ["/map", "Tìm người thu gom"],
  // ["/partners", "Đối tác tái chế"],
  ["/leaderboard", "Xếp hạng người dùng"],
] as const

function ExploreList({ close, withRegister }: { close: () => void; withRegister: boolean }) {
  const items = withRegister
    ? [...EXPLORE, ["/join-recycler", "Đăng ký cơ sở thu mua"]]
    : EXPLORE

  return (
    <div className="p-2 space-y-0.5">
      <p className="px-3.5 pt-2 pb-1 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
        Khám phá
      </p>
      <div className="space-y-0.5">
        {items.map(([to, label]) => (
          <Link
            key={to}
            to={to}
            onClick={close}
            className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {label}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4 text-muted">
              <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}

function AccountMenu() {
  const session = useSession()
  const user = session?.name ?? ""
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "AUTH_SUCCESS") {
        const role = e.data.role as Role
        navigate(role === "user" ? "/" : ROLE_HOME[role] || "/")
      } else if (e.data?.type === "AUTH_LOGOUT") {
        navigate("/")
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [navigate])

  const logout = () => {
    setOpen(false)
    openLogoutPopup()
  }

  return (
    <div className="relative" ref={ref}>
        {/* trigger: avatar + mũi tên trong một nút, hover chung */}
        <button
          type="button"
          aria-label={user ? `Tài khoản: ${user}` : "Đăng nhập hoặc đăng ký"}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 items-center gap-1 rounded-full border border-line bg-white px-1 shadow-[0_1px_2px_rgba(15,31,21,0.04)] transition-colors hover:border-sage-line hover:bg-surface-2"
        >
          <Avatar user={user} size="size-8" />
          <Chevron open={open} />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute top-full right-0 mt-2.5 w-[360px] overflow-hidden rounded-2xl border border-line bg-white shadow-[0_20px_48px_-10px_rgba(15,31,21,0.18)]"
          >
            {user ? (
              <>
                <div className="flex items-center gap-3.5 border-b border-line-soft bg-surface-2/60 px-4 py-3.5">
                  <Avatar user={user} size="size-11" />
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-ink">{user}</p>
                    <p className="text-xs text-muted">{ROLE_LABEL[session!.role]}</p>
                  </div>
                </div>

                {/* Nhóm 1: Trang cá nhân */}
                <div className="p-2 space-y-0.5">
                  <p className="px-3.5 pt-2 pb-1 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
                    Trang cá nhân
                  </p>
                  {ACCOUNT_ITEMS.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}

                  {/* Nút vào khu vực theo vai trò (chỉ hiện cho các vai trò vận hành, không hiện cho user) */}
                  {session!.role !== "user" && (
                    <Link
                      to={ROLE_HOME[session!.role]}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-xl bg-brand/10 px-3.5 py-2.5 text-sm font-semibold text-brand-deep transition-colors hover:bg-brand/16"
                    >
                      Khu vực {ROLE_LABEL[session!.role].toLowerCase()}
                      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4 text-muted">
                        <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  )}
                </div>

                {/* Nhóm 2: Khám phá */}
                <div className="border-t border-line-soft">
                  <ExploreList close={() => setOpen(false)} withRegister />
                </div>

                {/* Nhóm 3: Khác */}
                <div className="border-t border-line-soft p-2 space-y-0.5">
                  <p className="px-3.5 pt-2 pb-1 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
                    Khác
                  </p>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-3 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-4 text-red-600">
                      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Đăng xuất
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="border-b border-line-soft p-4">
                  <p className="text-base font-bold text-ink">Chào mừng đến EcoLink</p>
                  <p className="mt-1 text-xs text-muted">
                    Đăng nhập để theo dõi lịch thu gom
                  </p>
                  <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                    <a
                      href="/register"
                      onClick={(e) => {
                        e.preventDefault()
                        setOpen(false)
                        openAuthPopup("register")
                      }}
                      className="grid h-10 place-items-center rounded-xl border border-brand/30 bg-brand/10 text-sm font-semibold text-brand transition-[background-color,transform] duration-200 ease-out hover:bg-brand/18 hover:border-brand/50 active:scale-[0.97]"
                    >
                      Tạo tài khoản
                    </a>
                    <a
                      href="/login"
                      onClick={(e) => {
                        e.preventDefault()
                        setOpen(false)
                        openAuthPopup("login")
                      }}
                      className="grid h-10 place-items-center rounded-xl bg-brand text-sm font-semibold text-white transition-[background-color,transform] duration-200 ease-out hover:bg-brand-deep active:scale-[0.97]"
                    >
                      Đăng nhập
                    </a>
                  </div>
                </div>

                <ExploreList close={() => setOpen(false)} withRegister={false} />
              </>
            )}
          </div>
        )}
    </div>
  )
}

export default function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[70px] border-b border-sage/25 bg-white/95 shadow-[0_4px_22px_rgba(15,31,21,0.06)] backdrop-blur-xl md:h-[76px]">
      {/* `page` = the same shell every screen uses, so the logo lines up with the content below */}
      <div className="page flex h-full items-center gap-6 lg:gap-8">
        <Link to="/" aria-label="EcoLink - Trang chủ" className="shrink-0">
          <img src="/assets/brand/logo1.png" alt="EcoLink" className="h-[42px] w-auto md:h-[46px]" />
        </Link>

        <nav
          aria-label="Điều hướng chính"
          className="hidden items-center gap-1 lg:flex"
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `relative px-3 py-2 text-sm whitespace-nowrap transition-colors after:absolute after:right-3 after:bottom-0 after:left-3 after:h-[2px] after:rounded-full after:bg-brand after:transition-transform ${
                  isActive
                    ? "font-semibold text-brand-deep after:scale-x-100"
                    : "font-medium text-body after:scale-x-0 hover:text-brand-deep hover:after:scale-x-100"
                }`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* ponytail: one height (40px) for every control here so the row reads as a single line */}
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden h-10 items-center gap-1.5 text-xs whitespace-nowrap text-body md:flex">
            <i className="size-1.5 rounded-full bg-brand-soft shadow-[0_0_0_3px_rgba(0,112,61,0.12)]" />
            TP. Hồ Chí Minh
          </span>
          <Link
            to="/map"
            className="hidden h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold whitespace-nowrap text-white shadow-[0_5px_14px_rgba(0,112,61,0.22)] transition-colors hover:bg-brand-deep sm:inline-flex"
          >
            Tìm người thu gom
          </Link>
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
