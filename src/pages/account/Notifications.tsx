import { useEffect, useState } from "react"
import { CardListSkeleton, PageHead, Status } from "@/components/Portal"
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
    isRead: false,
    needsAction: true,
    isBackend: false,
  },
  {
    id: "n2",
    title: "Biên nhận hoàn tất",
    text: "Tiền giao dịch BH-2609-0184 đã chuyển về tài khoản của bạn.",
    time: "Hôm nay, 11:02",
    isRead: false,
    needsAction: false,
    isBackend: false,
  },
  {
    id: "n3",
    title: "Nhắc nhở điểm danh",
    text: "Bạn bỏ lỡ điểm danh hôm qua, chuỗi đã tính lại từ đầu.",
    time: "Hôm qua, 20:00",
    isRead: false,
    needsAction: true,
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

export default function Notifications() {
  const [notes, setNotes] = useState<Note[]>(() => initApiState([], INITIAL_NOTES))
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [unreadOverride, setUnreadOverride] = useState<number | null>(null)
  const [isLiveMode, setIsLiveMode] = useState(false)

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

  const unread = unreadOverride ?? notes.filter((n) => !n.isRead).length

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
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="TÀI KHOẢN"
        title="Thông báo hệ thống"
        body="Cập nhật tiến độ thu gom, xác nhận giao dịch và tin tức từ EcoLink."
      />

      <section className="card flex flex-col gap-4 p-5 md:p-6 max-w-2xl">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft pb-3">
          <h2 className="text-base font-bold text-ink">Danh sách thông báo</h2>
          <span className="text-[13px] text-muted">
            {unread === 0 ? "Đã đọc hết" : `${unread} chưa đọc`}
          </span>
        </div>

        <ul className="flex flex-col gap-2.5">
          {loading ? (
            <li>
              <CardListSkeleton count={3} />
            </li>
          ) : notes.length === 0 ? (
            <li className="rounded-xl border border-line-soft bg-surface p-4 text-sm text-muted">
              Bạn chưa có thông báo hệ thống nào.
            </li>
          ) : (
            notes.map((n) => (
              <li
                key={n.id}
                onClick={() => void handleMarkOne(n)}
                className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                  n.isRead ? "border-line-soft bg-surface" : "border-brand/25 bg-brand/6"
                }`}
              >
                {n.title && (
                  <p className="mb-1 text-sm font-semibold text-ink">{n.title}</p>
                )}
                <p className="text-sm leading-relaxed text-ink">{n.text}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                  <span>{n.time}</span>
                  {n.needsAction && !n.isRead && <Status tone="wait">Cần xử lý</Status>}
                </div>
              </li>
            ))
          )}
        </ul>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => void handleMarkAll()}
            disabled={unread === 0}
            className="btn-ghost h-10 px-4 text-xs font-semibold disabled:opacity-50"
          >
            Đánh dấu đã đọc tất cả
          </button>
        </div>
      </section>
    </div>
  )
}
