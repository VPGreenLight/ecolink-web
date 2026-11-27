import { useEffect, useRef, useState } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import { hasLiveBackendAuth, ROLE_HOME, ROLE_LABEL, signOut, useSession } from "@/lib/session"
import { openAuthPopup } from "@/lib/popupAuth"
import { isSsrSmokeTest } from "@/lib/hydration"
import {
  createNotificationHubConnection,
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_UPDATED_EVENT,
  type NotificationDto,
} from "@/lib/notificationsApi"
import { useEntitlements } from "@/lib/servicePackageApi"
import ConfirmLogoutDialog from "@/components/ConfirmLogoutDialog"
import UserAvatar from "@/components/UserAvatar"
import { NAV_LINKS } from "@/data/nav"

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
  ["/feedback", "Khiếu nại và góp ý"],
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
  const entitlements = useEntitlements()
  const user = session?.name ?? ""
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
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
    setOpen(false)
    setConfirmLogout(true)
  }

  const handleConfirmLogout = () => {
    signOut()
    setConfirmLogout(false)
    navigate("/")
  }

  return (
    <div className="sm:relative" ref={ref}>
        {/* trigger: avatar + mũi tên trong một nút, hover chung */}
        <button
          type="button"
          aria-label={user ? `Tài khoản: ${user}` : "Đăng nhập hoặc đăng ký"}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-white py-1 pr-2 pl-1 shadow-[0_1px_2px_rgba(15,31,21,0.04)] transition-colors hover:border-sage-line hover:bg-surface-2"
        >
          <UserAvatar name={user} avatarUrl={session?.avatarUrl} size="sm" />
          <Chevron open={open} />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute top-[calc(100%+0.5rem)] right-3 left-3 max-h-[calc(100dvh-5.75rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white shadow-[0_20px_48px_-10px_rgba(15,31,21,0.18)] sm:top-full sm:right-0 sm:left-auto sm:mt-2.5 sm:w-[360px]"
          >
            {user ? (
              <>
                <div className="flex items-center gap-3.5 border-b border-line-soft bg-surface-2/60 px-4 py-3.5">
                  <UserAvatar name={user} avatarUrl={session?.avatarUrl} size="md" />
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

                  {/* Lối vào nhanh theo vai trò */}
                  {session!.role === "user" && (
                    <>
                      <Link
                        to="/user/transactions"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 text-muted">
                          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
                          <path d="M8 7h8M8 11h8M8 15h5" />
                        </svg>
                        Lịch sử biên nhận
                      </Link>
                      <Link
                        to="/user/payout#citizen-packages"
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink"
                      >
                        <span className="flex items-center gap-3">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 text-muted">
                            <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                            <path d="M5 21h14" />
                          </svg>
                          Gói dịch vụ
                        </span>
                        <span className="rounded-full bg-brand/12 px-2 py-0.5 text-[11px] font-bold text-brand-deep">
                          {entitlements.currentTier}
                        </span>
                      </Link>
                    </>
                  )}
                  {session!.role === "recycler" && (
                    <Link
                      to="/recycler/packages"
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <span className="flex items-center gap-3">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 text-muted">
                          <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                          <path d="M5 21h14" />
                        </svg>
                        Gói dịch vụ
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        {entitlements.currentTier}
                      </span>
                    </Link>
                  )}

                  {/* Nút vào khu vực theo vai trò (chỉ hiện cho recycler, staff, admin) */}
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
                  <ExploreList close={() => setOpen(false)} withRegister={session?.role === "user"} />
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

      <ConfirmLogoutDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleConfirmLogout}
        userName={user}
      />
    </div>
  )
}

export default function Navbar() {
  const session = useSession()

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
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {!session && (
            <button
              type="button"
              onClick={() => openAuthPopup("login")}
              className="hidden h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold whitespace-nowrap text-white shadow-[0_5px_14px_rgba(0,112,61,0.22)] transition-colors hover:bg-brand-deep sm:inline-flex"
            >
              Đăng nhập
            </button>
          )}
          {session && (session.role === "user" || session.role === "recycler") && (
            <NavLink
              to="/chat"
              title="Chatbox thương lượng"
              aria-label="Chatbox thương lượng"
              className={({ isActive }) =>
                `group relative flex size-10 items-center justify-center rounded-full border shadow-[0_1px_2px_rgba(15,31,21,0.04)] transition-[color,border-color,background-color,transform] duration-200 ease-out active:scale-[0.96] ${
                  isActive
                    ? "border-brand/35 bg-brand/10 text-brand-deep"
                    : "border-line bg-white text-muted hover:border-sage-line hover:bg-surface-2 hover:text-ink"
                }`
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="size-[18px] transition-transform duration-200 group-hover:scale-105"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </NavLink>
          )}
          {session && (
            <NotificationBellMenu isLoggedIn={Boolean(session)} />
          )}
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}

interface DropdownNote {
  id: string
  title: string
  message: string
  time: string
  isRead: boolean
  isBackend: boolean
}

const FALLBACK_NOTES: DropdownNote[] = [
  {
    id: "n1",
    title: "Lịch thu gom đã được xác nhận",
    message: "Cô Ba Thu Gom đã nhận yêu cầu của bạn và chốt khung giờ 10:00 - 12:00.",
    time: "Hôm nay, 09:34",
    isRead: false,
    isBackend: false,
  },
  {
    id: "n2",
    title: "Biên nhận hoàn tất",
    message: "Tiền giao dịch BH-2609-0184 đã chuyển về tài khoản của bạn.",
    time: "Hôm nay, 11:02",
    isRead: false,
    isBackend: false,
  },
  {
    id: "n3",
    title: "Nhắc nhở điểm danh",
    message: "Bạn bỏ lỡ điểm danh hôm qua, chuỗi đã tính lại từ đầu.",
    time: "Hôm qua, 20:00",
    isRead: true,
    isBackend: false,
  },
]

function mapNotificationDto(n: NotificationDto): DropdownNote {
  return {
    id: n.id,
    title: n.title || "Thông báo hệ thống",
    message: n.message,
    time: new Date(n.createdAt).toLocaleString("vi-VN"),
    isRead: n.isRead,
    isBackend: true,
  }
}

function NotificationBellMenu({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [items, setItems] = useState<DropdownNote[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busyAll, setBusyAll] = useState(false)
  const [err, setErr] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const live = isLoggedIn && !isSsrSmokeTest() && hasLiveBackendAuth()

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
    if (!isLoggedIn || isSsrSmokeTest()) {
      setItems([])
      setUnreadCount(0)
      return
    }
    if (!live) {
      setItems(FALLBACK_NOTES)
      setUnreadCount(FALLBACK_NOTES.filter((n) => !n.isRead).length)
      return
    }
    let active = true

    const syncNotifications = () => {
      setLoading(true)
      void fetchMyNotifications({ pageNumber: 1, pageSize: 20 })
        .then((res) => {
          if (!active || !res.success || !res.data) return
          setItems((res.data.items ?? []).map(mapNotificationDto))
          setUnreadCount(res.data.unreadCount ?? 0)
          setErr("")
        })
        .catch((error) => {
          if (active) {
            setErr(error instanceof Error ? error.message : "Không tải được thông báo.")
          }
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }

    syncNotifications()

    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ unreadCount?: number; delta?: number }>).detail
      if (typeof detail?.unreadCount === "number") {
        setUnreadCount(Math.max(0, detail.unreadCount))
        if (detail.unreadCount === 0) {
          setItems((prev) => prev.map((it) => ({ ...it, isRead: true })))
        }
        return
      }
      if (typeof detail?.delta === "number") {
        setUnreadCount((c) => Math.max(0, c + detail.delta!))
        return
      }
      syncNotifications()
    }
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated)

    const connection = createNotificationHubConnection({
      onReceiveNotification: (incoming) => {
        if (!active) return
        const mapped = mapNotificationDto(incoming)
        setItems((prev) => [mapped, ...prev.filter((x) => x.id !== mapped.id)].slice(0, 20))
        if (!mapped.isRead) setUnreadCount((c) => c + 1)
      },
      onUnreadCountUpdated: (payload) => {
        if (active && typeof payload?.unreadCount === "number") {
          setUnreadCount(Math.max(0, payload.unreadCount))
        }
      },
    })
    if (connection) {
      connection.start().catch(() => {})
    }

    return () => {
      active = false
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated)
      if (connection) {
        connection.stop().catch(() => {})
      }
    }
  }, [isLoggedIn, live])

  const handleMarkOne = async (note: DropdownNote) => {
    if (note.isRead) return
    setItems((prev) => prev.map((x) => (x.id === note.id ? { ...x, isRead: true } : x)))
    setUnreadCount((c) => Math.max(0, c - 1))
    if (note.isBackend && live) {
      try {
        await markNotificationRead(note.id)
      } catch {
        // ignore inline error
      }
    }
  }

  const handleMarkAll = async () => {
    if (busyAll || unreadCount === 0) return
    if (!live) {
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })))
      setUnreadCount(0)
      return
    }
    setBusyAll(true)
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Không thể đánh dấu đã đọc tất cả.")
    } finally {
      setBusyAll(false)
    }
  }

  const visibleItems = filter === "unread" ? items.filter((n) => !n.isRead) : items

  return (
    <div className="sm:relative" ref={ref}>
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : "Thông báo"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="group relative flex size-10 items-center justify-center rounded-full border border-line bg-white text-muted shadow-[0_1px_2px_rgba(15,31,21,0.04)] transition-[color,border-color,background-color,transform] duration-200 ease-out hover:border-sage-line hover:bg-surface-2 hover:text-ink active:scale-[0.96]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-[18px] transition-transform duration-200 group-hover:scale-105"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-brand px-1 text-[10px] leading-[14px] font-bold text-white tabular-nums">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Danh sách thông báo"
          className="absolute top-[calc(100%+0.5rem)] right-3 left-3 flex max-h-[calc(100dvh-5.75rem)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_20px_48px_-10px_rgba(15,31,21,0.18)] sm:top-full sm:right-0 sm:left-auto sm:mt-2.5 sm:w-[360px]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line-soft bg-surface-2/60 px-4 py-3">
            <div>
              <p className="text-base font-bold text-ink">Thông báo</p>
              <p className="text-xs text-muted">
                {unreadCount > 0 ? `${unreadCount} chưa đọc` : "Đã đọc tất cả"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={busyAll}
                onClick={() => void handleMarkAll()}
                className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-brand-deep transition-colors hover:bg-surface-2 hover:underline disabled:opacity-50"
              >
                {busyAll ? "Đang xử lý..." : "Đọc tất cả"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 border-b border-line-soft px-4 py-2">
            {(
              [
                ["all", `Tất cả (${items.length})`],
                ["unread", `Chưa đọc (${unreadCount})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`min-h-8 rounded-full px-3 text-xs font-semibold transition-colors ${
                  filter === key
                    ? "bg-brand/12 text-brand-deep"
                    : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 divide-y divide-line-soft overflow-y-auto overscroll-contain">
            {err && (
              <p role="alert" className="px-4 py-2.5 text-xs font-medium text-warn">
                {err}
              </p>
            )}
            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Đang tải thông báo...</p>
            ) : visibleItems.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">
                {filter === "unread" ? "Không có thông báo chưa đọc." : "Chưa có thông báo nào."}
              </p>
            ) : (
              visibleItems.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  role="menuitem"
                  onClick={() => void handleMarkOne(note)}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${
                    note.isRead ? "bg-white" : "bg-brand/[0.04]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-ink">{note.title}</span>
                    {!note.isRead && (
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-brand"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <p className="text-sm leading-5 text-body">{note.message}</p>
                  <span className="text-xs text-muted tabular-nums">{note.time}</span>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-line-soft bg-surface-2/40 px-4 py-2 text-right">
            <Link
              to="/account/profile"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-9 items-center text-xs font-semibold text-brand-deep hover:underline"
            >
              Hồ sơ cá nhân →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
