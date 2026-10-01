import { useEffect, useRef, useState } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import { ROLE_HOME, ROLE_LABEL, signOut, useSession } from "@/lib/session"
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
  ["/account/profile", "Hồ sơ và thông báo"],
  ["/account/password", "Đổi mật khẩu"],
] as const

/** Mục Khám phá: dùng lại cho cả khách và người đã đăng nhập. `register` chỉ
 *  hiện khi đã đăng nhập — U-05 là bước nâng cấp từ tài khoản người dân lên
 *  cơ sở thu mua, người chưa có tài khoản thì chưa ở trong hệ sinh thái. */
const EXPLORE = [
  ["/scanner", "Nhận diện rác bằng AI"],
  ["/map", "Tìm người thu gom"],
  ["/partners", "Đối tác tái chế"],
  ["/leaderboard", "Xếp hạng người dùng"],
] as const

function ExploreList({ close, withRegister }: { close: () => void; withRegister: boolean }) {
  const items = withRegister
    ? [...EXPLORE, ["/join-recycler", "Đăng ký cơ sở thu mua"]]
    : EXPLORE

  return (
    <>
      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
        Khám phá
      </p>
      <div className="p-2 pt-0">
        {items.map(([to, label]) => (
          <Link
            key={to}
            to={to}
            onClick={close}
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {label}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5 text-muted">
              <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
      </div>
    </>
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

  const logout = () => {
    signOut()
    setOpen(false)
    navigate("/")
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
        className="flex items-center gap-1 rounded-full border border-line bg-white py-1 pr-2 pl-1 shadow-[0_1px_2px_rgba(15,31,21,0.04)] transition-colors hover:border-sage-line hover:bg-surface-2"
      >
        <Avatar user={user} size="size-9 md:size-10" />
        <Chevron open={open} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_44px_-8px_rgba(15,31,21,0.16)]"
        >
          {user ? (
            <>
              <div className="flex items-center gap-3 border-b border-line-soft bg-surface-2/60 p-4">
                <Avatar user={user} size="size-11" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{user}</p>
                <p className="text-xs text-muted">{ROLE_LABEL[session!.role]}</p>
                </div>
              </div>

              <div className="p-2">
                {/* SU-01, SU-02, SU-03: dùng chung mọi vai trò */}
                {ACCOUNT_ITEMS.map(([to, label]) => (
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
                    {label}
                  </Link>
                ))}

                {/* Nút duy nhất để vào khu vực theo vai trò. Menu khu vực nằm
                    trong Portal chứ không ở navbar, nên thiếu mục này thì sau
                    khi đăng nhập không có đường nào sang trang vận hành. */}
                <Link
                  to={ROLE_HOME[session!.role]}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-lg bg-brand/10 px-3 py-2.5 text-sm font-semibold text-brand-deep transition-colors hover:bg-brand/16"
                >
                  {session!.role === "user"
                    ? "Trang của tôi"
                    : `Khu vực ${ROLE_LABEL[session!.role].toLowerCase()}`}
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5">
                    <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>

                <button
                  type="button"
                  onClick={logout}
                  className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-4 text-muted">
                    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Đăng xuất
                </button>
              </div>

              {/* U-05 nằm ở đây, không ở trang đăng ký: nâng cấp từ tài khoản
                  người dân lên cơ sở thu mua thì phải đã có tài khoản. */}
              <div className="border-t border-line-soft">
                <ExploreList close={() => setOpen(false)} withRegister />
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-line-soft p-4">
                <p className="text-sm font-bold text-ink">Chào mừng đến EcoLink</p>
                <p className="mt-0.5 text-xs text-muted">
                  Đăng nhập để theo dõi lịch thu gom
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    to="/register"
                    onClick={() => setOpen(false)}
                    className="grid h-10 place-items-center rounded-xl border border-brand/30 bg-brand/10 text-[13px] font-semibold text-brand transition-[background-color,transform] duration-200 ease-out hover:bg-brand/18 hover:border-brand/50 active:scale-[0.97]"
                  >
                    Tạo tài khoản
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="grid h-10 place-items-center rounded-xl bg-brand text-[13px] font-semibold text-white transition-[background-color,transform] duration-200 ease-out hover:bg-brand-deep active:scale-[0.97]"
                  >
                    Đăng nhập
                  </Link>
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

        {/* ponytail: one height (44/48) for every control here so the row reads as a single line */}
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden h-11 items-center gap-1.5 text-xs whitespace-nowrap text-body md:h-12 xl:flex">
            <i className="size-1.5 rounded-full bg-brand-soft shadow-[0_0_0_3px_rgba(0,112,61,0.12)]" />
            TP. Hồ Chí Minh
          </span>
          <Link
            to="/map"
            className="hidden h-11 items-center rounded-full bg-brand px-5 text-[13px] font-semibold whitespace-nowrap text-white shadow-[0_5px_14px_rgba(0,112,61,0.22)] transition-colors hover:bg-brand-deep md:h-12 xl:inline-flex"
          >
            Tìm người thu gom
          </Link>
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
