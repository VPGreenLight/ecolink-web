import * as signalR from "@microsoft/signalr"
import {
  apiRequest,
  getResolvedApiHost,
  rotateRefreshTokenSingleFlight,
  type ApiResponse,
} from "@/lib/api"
import {
  getAccessToken,
  getRefreshToken,
  isRealJwt,
  isStoredAccessTokenExpired,
} from "@/lib/session"

export interface NotificationDto {
  id: string
  title: string
  message: string
  notificationType: string
  referenceType?: string | null
  referenceId?: string | null
  isRead: boolean
  readAt?: string | null
  createdAt: string
}

export interface NotificationListResponseDto {
  items: NotificationDto[]
  pageNumber: number
  pageSize: number
  totalRecords: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  unreadCount: number
}

export interface MarkNotificationReadResultDto {
  notificationId: string
  isRead: boolean
  readAt?: string | null
  unreadCount: number
}

export interface MarkAllNotificationsReadResultDto {
  markedCount: number
  unreadCount: number
  readAt: string
}

export interface NotificationHubHandlers {
  onReceiveNotification?: (notification: NotificationDto) => void
  onUnreadCountUpdated?: (payload: { unreadCount: number }) => void
}

/** [STT 169] Lấy danh sách thông báo hệ thống & bộ đếm chưa đọc (GET /api/v1/notifications). */
export async function fetchMyNotifications(params?: {
  isRead?: boolean
  notificationType?: string
  pageNumber?: number
  pageSize?: number
}): Promise<ApiResponse<NotificationListResponseDto>> {
  const qs = new URLSearchParams()
  if (typeof params?.isRead === "boolean") qs.set("isRead", String(params.isRead))
  if (params?.notificationType) qs.set("notificationType", params.notificationType)
  qs.set("pageNumber", String(params?.pageNumber ?? 1))
  qs.set("pageSize", String(params?.pageSize ?? 20))

  return apiRequest<NotificationListResponseDto>(`/api/v1/notifications?${qs.toString()}`, {
    method: "GET",
  })
}

export const NOTIFICATIONS_UPDATED_EVENT = "ecolink:notifications-updated"

function emitNotificationsUpdated(detail?: { unreadCount?: number; delta?: number }) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, { detail }))
}

/** [STT 170] Đánh dấu một thông báo là đã đọc (PATCH /api/v1/notifications/{notificationId}/read). */
export async function markNotificationRead(
  notificationId: string,
): Promise<ApiResponse<MarkNotificationReadResultDto>> {
  const res = await apiRequest<MarkNotificationReadResultDto>(
    `/api/v1/notifications/${notificationId}/read`,
    {
      method: "PATCH",
    },
  )
  if (res.success) {
    emitNotificationsUpdated({ delta: -1 })
  }
  return res
}

/** [STT 171] Đánh dấu toàn bộ thông báo chưa đọc của tài khoản là đã xem (PUT /api/v1/notifications/read-all). */
export async function markAllNotificationsRead(): Promise<
  ApiResponse<MarkAllNotificationsReadResultDto>
> {
  const res = await apiRequest<MarkAllNotificationsReadResultDto>("/api/v1/notifications/read-all", {
    method: "PUT",
  })
  if (res.success) {
    emitNotificationsUpdated({ unreadCount: 0 })
  }
  return res
}

async function resolveSignalRToken(): Promise<string> {
  let token = getAccessToken()
  if (token && !isRealJwt(token) && getRefreshToken()) {
    token = await rotateRefreshTokenSingleFlight()
  } else if (token && isRealJwt(token) && isStoredAccessTokenExpired(10) && getRefreshToken()) {
    token = await rotateRefreshTokenSingleFlight()
  }
  return isRealJwt(token) ? (token as string) : ""
}

/**
 * [STT 172] Kết nối SignalR Real-Time Notification Hub (`/hubs/notifications`).
 * Trả về `null` khi chạy trên SSR Node.js.
 */
export function createNotificationHubConnection(
  handlers: NotificationHubHandlers,
): signalR.HubConnection | null {
  if (typeof window === "undefined") {
    return null
  }

  const configuredBase = (import.meta.env?.VITE_API_BASE_URL as string | undefined)
    ?.trim()
    .replace(/\/+$/, "")
  const resolvedBase = configuredBase || getResolvedApiHost()
  const hubUrl = resolvedBase ? `${resolvedBase}/hubs/notifications` : "/hubs/notifications"

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: resolveSignalRToken,
      transport:
        signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(signalR.LogLevel.Warning)
    .build()

  if (handlers.onReceiveNotification) {
    connection.on("ReceiveNotification", handlers.onReceiveNotification)
  }
  if (handlers.onUnreadCountUpdated) {
    connection.on("UnreadCountUpdated", handlers.onUnreadCountUpdated)
  }

  return connection
}
