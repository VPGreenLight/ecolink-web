import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { Home, MessageSquare, X } from "lucide-react"
import { PORTAL_NAV } from "@/data/portal"
import { fetchCurrentUserProfile } from "@/lib/authApi"
import { isSsrSmokeTest } from "@/lib/hydration"
import {
  createNotificationHubConnection,
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_UPDATED_EVENT,
  type NotificationDto,
} from "@/lib/notificationsApi"
import { hasLiveBackendAuth, ROLE_LABEL, signOut, useSession } from "@/lib/session"
import { openAuthPopup } from "@/lib/popupAuth"
import ConfirmLogoutDialog from "@/components/ConfirmLogoutDialog"
import UserAvatar from "@/components/UserAvatar"

const STAFF_ROUTE_PERMISSIONS: Record<string, readonly string[]> = {
  "/staff/ai-review": ["REVIEW_AI", "ai.review"],
  "/staff/dataset": ["CURATE_DATASET", "ai.dataset"],
  "/staff/applications": ["VERIFY_RECYCLER", "partner.verify"],
  "/staff/complaints": ["HANDLE_COMPLAINT", "complaint.handle"],
  "/staff/accounts": ["MANAGE_ACCOUNTS", "account.manage"],
  "/staff/blog": ["MANAGE_BLOG", "blog.write"],
  "/staff/ecofacts": ["MANAGE_INVENTORY", "gift.manage"],
  "/staff/gifts": ["MANAGE_INVENTORY", "gift.manage"],
}

function hasStaffRouteAccess(path: string, permissions?: readonly string[]): boolean {
  const normalizedPath = path.replace(/\/+$/, "") || "/"
  const required = STAFF_ROUTE_PERMISSIONS[normalizedPath]
  if (!required) return true
  if (!permissions || permissions.length === 0) return false
  const granted = new Set(permissions.map((p) => p.trim().toUpperCase()))
  return required.some((req) => granted.has(req.toUpperCase()))
}

/** Menu tài khoản nội bộ.
 *
 *  KHÔNG dùng `/account/profile` và `/account/password` của người dân: đó là
 *  trang của tài khoản công khai — nội dung khác hẳn (điểm cây ảo, lịch thu
 *  gom, yêu cầu bàn giao) và bấm vào sẽ rời khỏi console ra trang có navbar.
 *  Trang riêng cho staff và admin nằm cùng khung `AdminShell`, ở `/{role}/account`. */
const ACCOUNT_ITEMS = {
  recycler: [
    ["/", "Home"],
    ["/recycler/facility", "Hồ sơ kho bãi"],
    ["/recycler/packages", "Gói dịch vụ Pro"],
    ["/account/profile", "Hồ sơ cá nhân"],
    ["/account/password", "Đổi mật khẩu"],
  ],
  staff: [
    ["/staff/account", "Hồ sơ và thông báo"],
    ["/staff/account/password", "Đổi mật khẩu"],
  ],
  admin: [
    ["/admin/account", "Hồ sơ và thông báo"],
    ["/admin/account/password", "Đổi mật khẩu"],
  ],
} as const

/** Khung làm việc dùng chung cho RECYCLER, STAFF và ADMIN.
 *
 *  Tách khỏi `Layout` công khai: không mang navbar công khai, footer hay tab-bar dưới
 *  trên mobile; thay bằng một thanh đầu trang 56px gọn nhẹ, sidebar sticky ở desktop
 *  và slide-over drawer đồng bộ trên mobile. */
export default function AdminShell({ role }: { role: "recycler" | "staff" | "admin" }) {
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  useEffect(() => {
    if (role === "staff" && session?.fromBackend && !Array.isArray(session.permissions)) {
      void fetchCurrentUserProfile()
    }
  }, [role, session?.fromBackend, session?.permissions])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  const enforceStaffRbac =
    role === "staff" && Boolean(session?.fromBackend) && Array.isArray(session?.permissions)

  const navSections = useMemo(() => {
    const sections = PORTAL_NAV[role]
    if (!enforceStaffRbac) return sections
    return sections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((item) => hasStaffRouteAccess(item.to, session?.permissions)),
      }))
      .filter((sec) => sec.items.length > 0)
  }, [enforceStaffRbac, role, session?.permissions])

  const staffRouteAllowed =
    !enforceStaffRbac || hasStaffRouteAccess(location.pathname, session?.permissions)

  const logout = () => {
    setConfirmLogout(true)
  }

  const handleConfirmLogout = () => {
    signOut()
    setConfirmLogout(false)
    navigate("/")
  }

  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-40 h-14 border-b border-line-soft bg-white/90 backdrop-blur-xl">
        <div className="flex h-full items-center gap-2.5 px-3 sm:gap-3 sm:px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="admin-nav"
            className="grid size-10 shrink-0 place-items-center rounded-lg text-ink transition-colors hover:bg-surface-2 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <span className="sr-only">Mở menu</span>
          </button>

          {role === "recycler" ? (
            <Link to="/" aria-label="EcoLink - Trang chủ" className="shrink-0">
              <img src="/assets/brand/logo1.png" alt="EcoLink" className="h-6 w-auto sm:h-7" />
            </Link>
          ) : (
            <img src="/assets/brand/logo1.png" alt="EcoLink" className="h-6 w-auto shrink-0 sm:h-7" />
          )}
          <span className="shrink-0 rounded-md bg-brand/10 px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-brand uppercase sm:text-[11px]">
            {ROLE_LABEL[role]}
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
            {role === "recycler" && (
              <>
                <Link
                  to="/"
                  title="Home"
                  aria-label="Home"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-line bg-white px-2.5 text-xs font-semibold text-body transition-colors hover:border-sage-line hover:bg-surface-2 hover:text-ink sm:px-3"
                >
                  <Home className="size-4 shrink-0 text-brand" aria-hidden="true" />
                  <span className="hidden sm:inline">Home</span>
                </Link>
                <Link
                  to="/chat"
                  title="Chat thương lượng"
                  aria-label="Chat thương lượng"
                  className="grid size-10 place-items-center rounded-full border border-line bg-white text-muted transition-colors hover:border-sage-line hover:bg-surface-2 hover:text-ink"
                >
                  <MessageSquare className="size-4" aria-hidden="true" />
                </Link>
              </>
            )}
            <NotificationBellPopover role={role} />
            <AccountMenu
              name={session?.name ?? ""}
              avatarUrl={session?.avatarUrl}
              label={ROLE_LABEL[role]}
              items={ACCOUNT_ITEMS[role]}
            />
          </div>
        </div>
      </header>

      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <div className="flex min-w-0">
        {/* Mobile (< lg): slide-over drawer khi `open`, ẩn hoàn toàn khi đóng để `<main>` chiếm 100% chiều rộng.
            Desktop (>= lg): sidebar sticky 232px bên trái, menu tự cuộn độc lập. */}
        <aside
          className={`${
            open
              ? "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shadow-2xl"
              : "hidden"
          } flex-col border-r border-line-soft bg-white lg:sticky lg:top-14 lg:z-auto lg:flex lg:h-[calc(100dvh-3.5rem)] lg:w-58 lg:shrink-0 lg:shadow-none`}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line-soft px-4 lg:hidden">
            <div className="flex items-center gap-2">
              <img src="/assets/brand/logo1.png" alt="EcoLink" className="h-6 w-auto" />
              <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-brand uppercase">
                {ROLE_LABEL[role]}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng menu"
              className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>

          <nav
            id="admin-nav"
            aria-label="Điều hướng khu vực quản trị"
            className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:py-6"
          >
            {navSections.map((sec) => (
              <div key={sec.title} className="pb-5">
                <h2 className="px-3 text-[11px] font-bold tracking-[0.12em] text-brand uppercase">
                  {sec.title}
                </h2>
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {sec.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to.split("/").length <= 2}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          `flex min-h-10 items-center rounded-md px-3 py-2 text-sm leading-5 font-medium transition-colors ${
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
              động phá phiên làm việc, màu khác hẳn các nút khác trong khung. */}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              logout()
            }}
            className="mx-4 mt-auto mb-4 min-h-11 w-[calc(100%-2rem)] shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-800"
          >
            Đăng xuất
          </button>
        </aside>

        <main
          className={`min-w-0 flex-1 ${
            location.pathname === "/chat"
              ? "p-0"
              : "px-4 py-5 sm:py-6 lg:px-8 lg:py-8"
          }`}
        >
          {!staffRouteAllowed ? (
            <div
              role="alert"
              className="mx-auto max-w-xl rounded-2xl border border-warn/30 bg-warn/5 p-6 text-sm text-ink"
            >
              <p className="text-base font-bold text-warn">
                Bạn chưa được cấp quyền cho chức năng này (BR-ADM-02)
              </p>
              <p className="mt-2 leading-6 text-body">
                Tài khoản Nhân viên hiện chưa có mã quyền vận hành phù hợp cho trang{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs">{location.pathname}</code>.
                Vui lòng liên hệ Quản trị viên để được bật quyền tại mục Phân quyền Staff.
              </p>
              <div className="mt-4">
                <Link to="/staff" className="btn-primary inline-flex min-h-10 items-center px-4 text-sm font-semibold">
                  Quay về tổng quan Nhân viên
                </Link>
              </div>
            </div>
          ) : (
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          )}
        </main>
      </div>

      <ConfirmLogoutDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleConfirmLogout}
        userName={session?.name}
      />
    </div>
  )
}

/** Avatar + menu tài khoản ở thanh trên.
 *
 *  Menu tài khoản KHÔNG nằm trong sidebar: sidebar là danh sách màn hình của
 *  khu vực làm việc, trộn 2 mục tài khoản dùng chung vào đó thì không phân biệt
 *  được đâu là việc công việc, đâu là việc của chính mình. Ở đây nó nằm sau
 *  avatar, đúng chỗ của nó ở mọi app khác. */
function AccountMenu({
  name,
  avatarUrl,
  label,
  items,
}: {
  name: string
  avatarUrl?: string | null
  label: string
  items: readonly (readonly [string, string])[]
}) {
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
        className="flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-white py-1 pr-2 pl-1 transition-colors hover:border-sage-line hover:bg-surface-2"
      >
        <UserAvatar name={name} avatarUrl={avatarUrl} size="sm" />
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
            <UserAvatar name={name} avatarUrl={avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{name}</p>
              <p className="text-sm text-muted">{label}</p>
            </div>
          </div>

          <div className="p-2">
            {items.map(([to, item]) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-body transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 text-muted">
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
                signOut()
                openAuthPopup("login")
              }}
              className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 hover:text-red-800"
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

function NotificationBellPopover({ role }: { role: "recycler" | "staff" | "admin" }) {
  const session = useSession()
  const live = Boolean(session) && !isSsrSmokeTest() && hasLiveBackendAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationDto[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busyAll, setBusyAll] = useState(false)
  const [err, setErr] = useState("")
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
    if (!live) {
      setItems([])
      setUnreadCount(0)
      return
    }
    let active = true

    const syncNotifications = () => {
      setLoading(true)
      void fetchMyNotifications({ pageNumber: 1, pageSize: 10 })
        .then((res) => {
          if (!active || !res.success || !res.data) return
          setItems(res.data.items ?? [])
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
        setItems((prev) => [incoming, ...prev.filter((x) => x.id !== incoming.id)].slice(0, 10))
        if (!incoming.isRead) setUnreadCount((c) => c + 1)
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
  }, [live])

  const handleMarkOne = async (n: NotificationDto) => {
    if (n.isRead || !live) return
    try {
      await markNotificationRead(n.id)
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)))
    } catch {
      // ignore inline click errors
    }
  }

  const handleMarkAll = async () => {
    if (!live || busyAll || unreadCount === 0) return
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : "Thông báo"}
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-full border border-line bg-white text-muted transition-colors hover:border-sage-line hover:bg-surface-2 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-brand px-1 text-[10px] leading-[13px] font-bold text-white tabular-nums">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Hộp thông báo nội bộ"
          className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_44px_-8px_rgba(15,31,21,0.18)] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-line-soft bg-surface-2/70 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-ink">Thông báo hệ thống</p>
              <p className="text-xs text-muted">
                {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : "Đã đọc tất cả"}
              </p>
            </div>
            {live && unreadCount > 0 && (
              <button
                type="button"
                disabled={busyAll}
                onClick={() => void handleMarkAll()}
                className="min-h-10 px-2 text-sm font-semibold text-brand-deep hover:underline disabled:opacity-50"
              >
                {busyAll ? "Đang xử lý..." : "Đọc tất cả"}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-line-soft">
            {err && (
              <p role="alert" className="px-4 py-2.5 text-sm font-medium text-warn">
                {err}
              </p>
            )}
            {!live ? (
              <p className="px-4 py-6 text-center text-sm leading-6 text-muted">
                Kết nối tài khoản Backend để nhận thông báo thời gian thực.
              </p>
            ) : loading && items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm leading-6 text-muted">Đang tải thông báo...</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm leading-6 text-muted">
                Chưa có thông báo nào.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void handleMarkOne(n)}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${
                    n.isRead ? "bg-white" : "bg-brand/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-ink">{n.title}</span>
                    {!n.isRead && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                    )}
                  </div>
                  <p className="text-sm leading-6 text-body">{n.message}</p>
                  <span className="text-xs text-muted tabular-nums">
                    {new Date(n.createdAt).toLocaleString("vi-VN")}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-line-soft bg-surface-2/40 px-4 py-2.5 text-right">
            <Link
              to={role === "recycler" ? "/account/profile" : `/${role}/account`}
              onClick={() => setOpen(false)}
              className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-deep hover:underline"
            >
              Mở trang Hồ sơ &amp; Thông báo →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}