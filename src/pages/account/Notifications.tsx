import { useEffect, useMemo, useState } from "react"
import { CardListSkeleton, Status } from "@/components/Portal"
import { initApiLoading, initApiState } from "@/lib/hydration"
import {
  createNotificationHubConnection,
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationDto,
} from "@/lib/notificationsApi"
import { getAccessToken } from "@/lib/session"

type Note = {
  id: string
  title?: string
  text: string
  time: string
  notificationType?: string
  isRead: boolean
  needsAction: boolean
  isBackend: boolean
}

const INITIAL_NOTES: Note[] = [
  {
    id: "n1",
    title: "Lịch thu gom đã được xác nhận",
    text: "Cô Ba Thu Gom đã nhận yêu cầu của bạn và chốt khung giờ 10:00 - 12:00.",
    time: "Hôm nay, 09:34",
    notificationType: "HANDOVER_REQUESTED",
    isRead: false,
    needsAction: true,
    isBackend: false,
  },
  {
    id: "n2",
    title: "Biên nhận hoàn tất",
    text: "Tiền giao dịch BH-2609-0184 đã chuyển về tài khoản của bạn.",
    time: "Hôm nay, 11:02",
    notificationType: "RECEIPT_ISSUED",
    isRead: false,
    needsAction: false,
    isBackend: false,
  },
  {
    id: "n3",
    title: "Nhắc nhở điểm danh",
    text: "Bạn bỏ lỡ điểm danh hôm qua, chuỗi đã tính lại từ đầu.",
    time: "Hôm qua, 20:00",
    notificationType: "GAMIFICATION",
    isRead: true,
    needsAction: false,
    isBackend: false,
  },
]

const ACTION_TYPES = new Set([
  "HANDOVER_REQUESTED",
  "RECEIPT_ISSUED",
  "RECEIPT_DISPUTED",
  "KYB_VERIFICATION",
])

function mapDtoToNote(n: NotificationDto): Note {
  return {
    id: n.id,
    title: n.title,
    text: n.message,
    time: new Date(n.createdAt).toLocaleString("vi-VN"),
    notificationType: n.notificationType,
    isRead: n.isRead,
    needsAction: !n.isRead && ACTION_TYPES.has(n.notificationType),
    isBackend: true,
  }
}

function getNotificationIcon(type?: string) {
  switch (type) {
    case "HANDOVER_REQUESTED":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-brand-deep">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      )
    case "RECEIPT_ISSUED":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-emerald-600">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      )
    case "RECEIPT_DISPUTED":
    case "KYB_VERIFICATION":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-amber-600">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-brand">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      )
  }
}

export default function Notifications() {
  const [notes, setNotes] = useState<Note[]>(() => initApiState([], INITIAL_NOTES))
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [unreadOverride, setUnreadOverride] = useState<number | null>(null)
  const [isLiveMode, setIsLiveMode] = useState(false)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      setLoading(false)
      return
    }

    let disposed = false
    fetchMyNotifications({ pageNumber: 1, pageSize: 30 })
      .then((res) => {
        if (disposed || !res.success || !res.data) return
        setIsLiveMode(true)
        setNotes(res.data.items.map(mapDtoToNote))
        setUnreadOverride(res.data.unreadCount)
      })
      .catch(() => {
        // Giữ danh sách an toàn khi backend chưa sẵn sàng
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })

    const connection = createNotificationHubConnection({
      onReceiveNotification: (dto) => {
        if (disposed) return
        const mapped = mapDtoToNote(dto)
        setIsLiveMode(true)
        setNotes((prev) => {
          if (prev.some((x) => x.id === mapped.id)) return prev
          return [mapped, ...prev.filter((x) => x.isBackend)]
        })
      },
      onUnreadCountUpdated: ({ unreadCount }) => {
        if (!disposed) setUnreadOverride(unreadCount)
      },
    })

    if (connection) {
      connection.start().catch(() => {
        // Bỏ qua êm nếu WebSocket tạm thời không kết nối được
      })
    }

    return () => {
      disposed = true
      if (connection) {
        connection.stop().catch(() => {})
      }
    }
  }, [])

  const unreadCount = unreadOverride ?? notes.filter((n) => !n.isRead).length

  const filteredNotes = useMemo(() => {
    if (filter === "unread") return notes.filter((n) => !n.isRead)
    return notes
  }, [notes, filter])

  const handleMarkOne = async (note: Note) => {
    if (note.isRead) return
    if (!note.isBackend) {
      setNotes((prev) => prev.map((x) => (x.id === note.id ? { ...x, isRead: true } : x)))
      return
    }
    try {
      const res = await markNotificationRead(note.id)
      setNotes((prev) => prev.map((x) => (x.id === note.id ? { ...x, isRead: true } : x)))
      if (typeof res.data?.unreadCount === "number") {
        setUnreadOverride(res.data.unreadCount)
      }
    } catch {
      // Giữ nguyên trạng thái nếu request thất bại
    }
  }

  const handleMarkAll = async () => {
    if (!isLiveMode) {
      setNotes((prev) => prev.map((x) => ({ ...x, isRead: true })))
      setUnreadOverride(0)
      return
    }
    try {
      await markAllNotificationsRead()
      setNotes((prev) => prev.map((x) => ({ ...x, isRead: true })))
      setUnreadOverride(0)
    } catch {
      setNotes((prev) => prev.map((x) => ({ ...x, isRead: true })))
      setUnreadOverride(0)
    }
  }

  return (
    <div className="page flex flex-col gap-7 py-8 md:py-10 max-w-5xl mx-auto">
      <header className="flex flex-col gap-2 border-b border-line pb-6">
        <p className="text-xs sm:text-[13px] font-bold tracking-[0.14em] uppercase text-brand">
          TÀI KHOẢN
        </p>
        <h1 className="display text-3xl sm:text-4xl font-bold tracking-tight text-ink leading-tight">
          Thông báo hệ thống
        </h1>
        <p className="mt-1 max-w-[65ch] text-base sm:text-[17px] leading-relaxed text-body">
          Cập nhật tiến độ thu gom, biên nhận giao dịch và tin tức từ EcoLink.
        </p>
      </header>

      {/* Double-Bezel Card Container */}
      <div className="rounded-3xl border border-line-soft bg-surface-2/60 p-2.5 sm:p-3">
        <section className="flex flex-col gap-6 rounded-2xl border border-line-soft bg-surface p-5 sm:p-7 shadow-sm">
          {/* Header & Controls bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line-soft pb-5">
            {/* Filter Tabs */}
            <div className="inline-flex h-12 items-center rounded-xl bg-surface-2 p-1.5 border border-line-soft/80">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`flex h-9 items-center gap-2 rounded-lg px-4 sm:px-5 text-sm font-semibold transition-all duration-200 ${
                  filter === "all"
                    ? "bg-white text-ink shadow-[0_1px_3px_rgba(15,31,21,0.08)]"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>Tất cả</span>
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-bold text-muted">
                  {notes.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`flex h-9 items-center gap-2 rounded-lg px-4 sm:px-5 text-sm font-semibold transition-all duration-200 ${
                  filter === "unread"
                    ? "bg-white text-ink shadow-[0_1px_3px_rgba(15,31,21,0.08)]"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>Chưa đọc</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-brand/12 px-2 py-0.5 text-xs font-bold text-brand-deep">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Action: Mark all read */}
            <button
              type="button"
              onClick={() => void handleMarkAll()}
              disabled={unreadCount === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-body transition-colors hover:border-sage-line hover:bg-surface-2 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Đánh dấu đã đọc tất cả</span>
            </button>
          </div>

          {/* List items */}
          <ul className="flex flex-col gap-3.5">
            {loading ? (
              <li>
                <CardListSkeleton count={3} />
              </li>
            ) : filteredNotes.length === 0 ? (
              <li className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-soft bg-surface-2/40 py-14 px-6 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-surface-3 text-muted mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-7">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-ink">
                  {filter === "unread" ? "Không có thông báo chưa đọc" : "Chưa có thông báo nào"}
                </p>
                <p className="mt-1.5 text-sm text-muted max-w-md leading-relaxed">
                  {filter === "unread"
                    ? "Bạn đã xem hết các thông báo từ hệ thống. Các tin tức mới sẽ hiển thị tại đây."
                    : "Mọi hoạt động thu gom, thanh toán và sự kiện sẽ được gửi đến tài khoản của bạn."}
                </p>
              </li>
            ) : (
              filteredNotes.map((n) => (
                <li
                  key={n.id}
                  onClick={() => void handleMarkOne(n)}
                  className={`group relative flex items-start gap-4 sm:gap-5 rounded-2xl border p-5 sm:p-6 transition-all duration-200 cursor-pointer ${
                    n.isRead
                      ? "border-line-soft bg-white hover:border-line hover:bg-surface-2/50"
                      : "border-brand/25 bg-brand/[0.035] hover:border-brand/40 hover:bg-brand/[0.06] shadow-[0_1px_2px_rgba(0,112,61,0.04)]"
                  }`}
                >
                  {/* Leading icon container */}
                  <div className={`shrink-0 flex size-12 sm:size-13 items-center justify-center rounded-xl border transition-colors ${
                    n.isRead
                      ? "border-line-soft bg-surface-2"
                      : "border-brand/20 bg-brand/10"
                  }`}>
                    {getNotificationIcon(n.notificationType)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {n.title && (
                          <h3 className={`text-base sm:text-[17px] leading-snug ${
                            n.isRead ? "text-ink font-semibold" : "text-brand-deep font-bold"
                          }`}>
                            {n.title}
                          </h3>
                        )}
                        {!n.isRead && (
                          <span className="size-2.5 rounded-full bg-brand shrink-0" />
                        )}
                      </div>
                      <time className="shrink-0 text-xs sm:text-[13px] font-medium text-muted whitespace-nowrap pt-0.5">
                        {n.time}
                      </time>
                    </div>

                    <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-body">
                      {n.text}
                    </p>

                    {n.needsAction && !n.isRead && (
                      <div className="mt-3 flex items-center gap-2">
                        <Status tone="wait">Cần xử lý</Status>
                      </div>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}
