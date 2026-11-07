/**
 * API client và SignalR Real-Time WebSocket Client cho Module:
 * IN-APP REAL-TIME NEGOTIATION CHATBOX (U-08 & R-05).
 *
 * Tương thích:
 * - 7 REST Endpoints tại /api/v1/trade/orders/{orderId}/* (BR-NEG-01..05)
 * - SignalR Hub tại /hubs/negotiation-chat (WebSocket + LongPolling fallback)
 * - Tự động đồng bộ JWT token theo vai trò (Citizen, Recycler, Staff)
 * - Hỗ trợ chế độ ngoại tuyến (Offline Demo Cache) mượt mà khi chạy trình diễn
 * - An toàn 100% với Node.js SSR (npm run check & npm run check:routes)
 */

import * as signalR from "@microsoft/signalr"
import type { ApiResponse } from "@/lib/api"
import { fetchWithAutoHost } from "@/lib/api"
import { getAccessToken, getSession } from "@/lib/session"
import type { Role } from "@/lib/session"
import { ensureRoleJwt } from "@/lib/recyclerWorkflowApi"

// ==========================================
// 1. Data Transfer Objects (DTOs)
// ==========================================

export type ChatMessageType = "Text" | "Image" | "Proposal" | "System"
export type ProposalStatus = "Pending" | "Accepted" | "Superseded" | "Rejected"

export interface ProposalDetailDto {
  proposedPricePerKg: number
  proposedWeightKg: number
  proposedTimeSlot: string
  note?: string | null
  proposalStatus: ProposalStatus
  respondedByUserId?: string | null
  respondedAt?: string | null
  responseNote?: string | null
}

export interface ChatMessageDto {
  id: string
  orderId: string
  senderUserId: string
  senderName: string
  senderRole: "Citizen" | "Recycler" | "Staff" | "System" | string
  messageType: ChatMessageType
  messageContent?: string | null
  attachmentUrl?: string | null
  proposal?: ProposalDetailDto | null
  isRead: boolean
  sentAt: string
  readAt?: string | null
}

export interface PagedResult<T> {
  items: T[]
  pageNumber: number
  pageSize: number
  totalRecords: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export interface OrderChatThreadDto {
  orderId: string
  citizenUserId: string
  citizenName: string
  recyclerUserId: string
  facilityName: string
  orderStatus: string
  categoryCode?: string | null
  estimatedWeightKg?: number | null
  initialPricePerKg?: number | null
  agreedPricePerKg?: number | null
  proposedTimeSlot?: string | null
  confirmedTimeSlot?: string | null
  scheduledAt?: string | null
  acceptedAt?: string | null
  isProposalLocked: boolean
  isChatOpen: boolean
  unreadCount: number
  activeProposal?: ChatMessageDto | null
  messages: PagedResult<ChatMessageDto>
}

export interface ProposalAcceptanceResultDto {
  orderId: string
  proposalMessageId: string
  proposalStatus: ProposalStatus
  orderStatus: string
  agreedPricePerKg?: number | null
  confirmedWeightKg?: number | null
  confirmedTimeSlot?: string | null
  acceptedAt?: string | null
  isProposalLocked: boolean
  systemMessage?: ChatMessageDto | null
}

export interface ChatAttachmentUploadResponseDto {
  attachmentUrl: string
  fileName: string
  contentType: string
  fileSizeBytes: number
  uploadedAt: string
}

export interface SendChatMessageRequest {
  messageType: "Text" | "Image"
  messageContent?: string
  attachmentUrl?: string
}

export interface SendProposalRequest {
  proposedPricePerKg: number
  proposedWeightKg: number
  proposedTimeSlot: string
  note?: string
}

export interface RespondProposalRequest {
  isAccepted: boolean
  responseNote?: string
}

export function isGuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
}

// ==========================================
// 2. REST API Client Methods
// ==========================================

export async function getEffectiveAuthHeader(): Promise<Record<string, string>> {
  const direct = getAccessToken()
  if (direct) return { Authorization: `Bearer ${direct}` }
  const currentSession = getSession()
  const r: Role = currentSession?.role || "user"
  const roleToken = await ensureRoleJwt(r).catch(() => null)
  if (roleToken) return { Authorization: `Bearer ${roleToken}` }
  return {}
}

/**
 * [U-08 & R-05] Lấy thông tin phòng chat, trạng thái khóa đề xuất và lịch sử tin nhắn
 */
export async function getOrderChatThread(
  orderId: string,
  page: number = 1,
  pageSize: number = 50,
): Promise<OrderChatThreadDto> {
  if (isGuid(orderId)) {
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      }).toString()
      const authHeaders = await getEffectiveAuthHeader()

      const res = await fetchWithAutoHost(
        `/api/v1/trade/orders/${encodeURIComponent(orderId)}/messages?${query}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...authHeaders,
          },
        },
      )

      if (res.ok) {
        const json = (await res.json()) as ApiResponse<OrderChatThreadDto>
        if (json?.data) {
          saveFallbackThread(json.data)
          return json.data
        }
      }
    } catch {
      // Backend offline -> rơi xuống fallback
    }
  }

  // Chế độ dự phòng offline / mã đơn demo
  return getFallbackThread(orderId)
}

/**
 * [U-08 & R-05] Gửi tin nhắn Text hoặc Image vào đơn bàn giao
 */
export async function sendChatMessage(
  orderId: string,
  request: SendChatMessageRequest,
): Promise<ChatMessageDto> {
  if (isGuid(orderId)) {
    try {
      const authHeaders = await getEffectiveAuthHeader()
      const res = await fetchWithAutoHost(
        `/api/v1/trade/orders/${encodeURIComponent(orderId)}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...authHeaders,
          },
          body: JSON.stringify(request),
        },
      )

      if (res.ok) {
        const json = (await res.json()) as ApiResponse<ChatMessageDto>
        if (json?.data) return json.data
      }
    } catch {
      // Backend offline -> rơi xuống fallback
    }
  }

  return fallbackSendChatMessage(orderId, request)
}

/**
 * [U-08 & R-05] Tải ảnh chụp thực tế phế liệu lên Cloudflare R2 để đính kèm tin nhắn
 */
export async function uploadChatAttachment(
  orderId: string,
  file: File,
): Promise<ChatAttachmentUploadResponseDto> {
  if (isGuid(orderId)) {
    try {
      const authHeaders = await getEffectiveAuthHeader()
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetchWithAutoHost(
        `/api/v1/trade/orders/${encodeURIComponent(orderId)}/messages/attachments`,
        {
          method: "POST",
          headers: {
            ...authHeaders,
          },
          body: formData,
        },
      )

      if (res.ok) {
        const json = (await res.json()) as ApiResponse<ChatAttachmentUploadResponseDto>
        if (json?.data) return json.data
      }
    } catch {
      // Fallback
    }
  }

  // Fallback data URL cho demo
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve({
        attachmentUrl: (reader.result as string) || "/assets/scanner/pet_bottle.jpg",
        fileName: file.name,
        contentType: file.type || "image/jpeg",
        fileSizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
      })
    }
    reader.readAsDataURL(file)
  })
}

/**
 * [U-08 & R-05] Gửi đề xuất / phản đề xuất điều chỉnh đơn giá, khối lượng và khung giờ (BR-NEG-04)
 */
export async function sendProposal(
  orderId: string,
  request: SendProposalRequest,
): Promise<ChatMessageDto> {
  if (isGuid(orderId)) {
    try {
      const authHeaders = await getEffectiveAuthHeader()
      const res = await fetchWithAutoHost(
        `/api/v1/trade/orders/${encodeURIComponent(orderId)}/proposals`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...authHeaders,
          },
          body: JSON.stringify(request),
        },
      )

      if (res.ok) {
        const json = (await res.json()) as ApiResponse<ChatMessageDto>
        if (json?.data) return json.data
      }
    } catch {
      // Fallback
    }
  }

  return fallbackSendProposal(orderId, request)
}

/**
 * [U-08 & R-05] Đối phương bấm Chấp nhận hoặc Từ chối đề xuất mới nhất (BR-NEG-03, BR-NEG-05)
 */
export async function respondToProposal(
  orderId: string,
  messageId: string,
  request: RespondProposalRequest,
): Promise<ProposalAcceptanceResultDto> {
  if (isGuid(orderId)) {
    try {
      const authHeaders = await getEffectiveAuthHeader()
      const res = await fetchWithAutoHost(
        `/api/v1/trade/orders/${encodeURIComponent(orderId)}/proposals/${encodeURIComponent(messageId)}/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...authHeaders,
          },
          body: JSON.stringify(request),
        },
      )

      if (res.ok) {
        const json = (await res.json()) as ApiResponse<ProposalAcceptanceResultDto>
        if (json?.data) return json.data
      }
    } catch {
      // Fallback
    }
  }

  return fallbackRespondProposal(orderId, messageId, request)
}

/**
 * [R-05] Cơ sở thu gom bấm "Chấp nhận" trực tiếp điều khoản ban đầu của đơn bàn giao (BR-NEG-05)
 */
export async function acceptOrderInitialTerms(
  orderId: string,
): Promise<ProposalAcceptanceResultDto> {
  if (isGuid(orderId)) {
    try {
      const authHeaders = await getEffectiveAuthHeader()
      const res = await fetchWithAutoHost(
        `/api/v1/trade/orders/${encodeURIComponent(orderId)}/accept-terms`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            ...authHeaders,
          },
        },
      )

      if (res.ok) {
        const json = (await res.json()) as ApiResponse<ProposalAcceptanceResultDto>
        if (json?.data) return json.data
      }
    } catch {
      // Fallback
    }
  }

  return fallbackAcceptOrderInitialTerms(orderId)
}

/**
 * [U-08 & R-05] Đánh dấu toàn bộ tin nhắn đối phương là đã đọc
 */
export async function markMessagesAsRead(
  orderId: string,
): Promise<{ orderId: string; markedCount: number; readAtUtc: string }> {
  if (isGuid(orderId)) {
    try {
      const authHeaders = await getEffectiveAuthHeader()
      const res = await fetchWithAutoHost(
        `/api/v1/trade/orders/${encodeURIComponent(orderId)}/messages/read`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            ...authHeaders,
          },
        },
      )

      if (res.ok) {
        const json = (await res.json()) as ApiResponse<{
          orderId: string
          markedCount: number
          readAtUtc: string
        }>
        return json.data
      }
    } catch {
      // Fallback
    }
  }

  return { orderId, markedCount: 0, readAtUtc: new Date().toISOString() }
}

// ==========================================
// 3. SignalR Real-Time Hub Connection Manager
// ==========================================

export interface SignalRChatHandlers {
  onReceiveMessage?: (data: { orderId: string; message: ChatMessageDto; notification?: string }) => void
  onProposalCreated?: (data: {
    orderId: string
    proposalMessage: ChatMessageDto
    supersededMessageIds: string[]
    notification?: string
  }) => void
  onProposalResponded?: (data: {
    orderId: string
    result: ProposalAcceptanceResultDto
    notification?: string
  }) => void
  onMessagesMarkedAsRead?: (data: {
    orderId: string
    readerUserId: string
    markedCount: number
    readAtUtc: string
  }) => void
  onUserTypingChanged?: (data: {
    orderId: string
    userId: string
    isTyping: boolean
    timestamp: string
  }) => void
  onReconnecting?: (error?: Error) => void
  onReconnected?: (connectionId?: string) => void
  onClose?: (error?: Error) => void
}

/**
 * Xây dựng và mở kết nối thời gian thực SignalR Hub tới `/hubs/negotiation-chat`.
 * Tự động hỗ trợ fallback sang Long Polling nếu môi trường mạng chặn WebSocket.
 */
export function createNegotiationChatConnection(
  handlers: SignalRChatHandlers,
): signalR.HubConnection | null {
  if (typeof window === "undefined") {
    // Không chạy SignalR trên môi trường SSR Node.js
    return null
  }

  const configuredBase = (import.meta.env?.VITE_API_BASE_URL as string | undefined)
    ?.trim()
    .replace(/\/+$/, "")
  const hubUrl = configuredBase ? `${configuredBase}/hubs/negotiation-chat` : "/hubs/negotiation-chat"

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: async () => {
        const direct = getAccessToken()
        if (direct) return direct
        const currentSession = getSession()
        const r: Role = currentSession?.role || "user"
        const roleToken = await ensureRoleJwt(r).catch(() => null)
        return roleToken || ""
      },
      transport:
        signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(signalR.LogLevel.Warning)
    .build()

  if (handlers.onReceiveMessage) {
    connection.on("ReceiveChatMessage", handlers.onReceiveMessage)
  }
  if (handlers.onProposalCreated) {
    connection.on("ProposalCreated", handlers.onProposalCreated)
  }
  if (handlers.onProposalResponded) {
    connection.on("ProposalResponded", handlers.onProposalResponded)
  }
  if (handlers.onMessagesMarkedAsRead) {
    connection.on("MessagesMarkedAsRead", handlers.onMessagesMarkedAsRead)
  }
  if (handlers.onUserTypingChanged) {
    connection.on("UserTypingChanged", handlers.onUserTypingChanged)
  }

  if (handlers.onReconnecting) {
    connection.onreconnecting(handlers.onReconnecting)
  }
  if (handlers.onReconnected) {
    connection.onreconnected(handlers.onReconnected)
  }
  if (handlers.onClose) {
    connection.onclose(handlers.onClose)
  }

  return connection
}

/**
 * Tham gia nhóm chat thời gian thực của đơn bàn giao
 */
export async function joinOrderChatRoom(
  connection: signalR.HubConnection,
  orderId: string,
): Promise<void> {
  if (connection.state === signalR.HubConnectionState.Connected) {
    await connection.invoke("JoinOrderChatRoom", orderId)
  }
}

/**
 * Rời nhóm chat thời gian thực của đơn bàn giao
 */
export async function leaveOrderChatRoom(
  connection: signalR.HubConnection,
  orderId: string,
): Promise<void> {
  if (connection.state === signalR.HubConnectionState.Connected) {
    await connection.invoke("LeaveOrderChatRoom", orderId)
  }
}

/**
 * Phát tín hiệu đang gõ tin nhắn tới đối phương
 */
export async function sendTypingIndicator(
  connection: signalR.HubConnection,
  orderId: string,
  isTyping: boolean,
): Promise<void> {
  if (connection.state === signalR.HubConnectionState.Connected) {
    await connection.invoke("SendTypingIndicator", orderId, isTyping).catch(() => {})
  }
}

// ==========================================
// 4. Offline Demo & Local Storage Fallback
// ==========================================

const FALLBACK_KEY_PREFIX = "ecolink:chat_thread:v2:"

function saveFallbackThread(thread: OrderChatThreadDto): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(`${FALLBACK_KEY_PREFIX}${thread.orderId}`, JSON.stringify(thread))
  } catch {}
}

export function getFallbackThread(orderId: string): OrderChatThreadDto {
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(`${FALLBACK_KEY_PREFIX}${orderId}`)
      if (raw) {
        return JSON.parse(raw) as OrderChatThreadDto
      }
    } catch {}
  }

  // Khởi tạo phòng chat mẫu chuẩn đồ án
  const now = new Date()
  const initialThread: OrderChatThreadDto = {
    orderId,
    citizenUserId: "11111111-1111-1111-1111-111111111111",
    citizenName: "Nguyễn Văn An",
    recyclerUserId: "22222222-2222-2222-2222-222222222222",
    facilityName: "Vựa phế liệu EcoGreen",
    orderStatus: "Negotiating",
    categoryCode: "plastic",
    estimatedWeightKg: 12.5,
    initialPricePerKg: 7000,
    agreedPricePerKg: null,
    proposedTimeSlot: "14:00 - 16:00",
    confirmedTimeSlot: null,
    scheduledAt: now.toISOString(),
    acceptedAt: null,
    isProposalLocked: false,
    isChatOpen: true,
    unreadCount: 0,
    activeProposal: {
      id: "prop-demo-01",
      orderId,
      senderUserId: "22222222-2222-2222-2222-222222222222",
      senderName: "Vựa phế liệu EcoGreen",
      senderRole: "Recycler",
      messageType: "Proposal",
      messageContent: "Chai PET sạch không lẫn nắp bên mình thu 7.500đ/kg chiều nay nhé!",
      attachmentUrl: null,
      proposal: {
        proposedPricePerKg: 7500,
        proposedWeightKg: 12.5,
        proposedTimeSlot: "14:00 - 16:00",
        note: "Chai PET sạch không lẫn nắp bên mình thu 7.500đ/kg chiều nay nhé!",
        proposalStatus: "Pending",
      },
      isRead: true,
      sentAt: new Date(now.getTime() - 10 * 60000).toISOString(),
    },
    messages: {
      items: [
        {
          id: "msg-demo-01",
          orderId,
          senderUserId: "22222222-2222-2222-2222-222222222222",
          senderName: "Vựa phế liệu EcoGreen",
          senderRole: "Recycler",
          messageType: "Text",
          messageContent:
            "Chào bạn, vựa mình đang mở cửa nhận thu gom hôm nay. Bạn cần bán khoảng bao nhiêu kg và có phân loại sạch chưa ạ?",
          isRead: true,
          sentAt: new Date(now.getTime() - 25 * 60000).toISOString(),
        },
        {
          id: "msg-demo-02",
          orderId,
          senderUserId: "11111111-1111-1111-1111-111111111111",
          senderName: "Nguyễn Văn An",
          senderRole: "Citizen",
          messageType: "Text",
          messageContent:
            "Mình có khoảng 12.5kg vỏ chai PET sạch đã tráng nước và đóng bao tải sẵn. Khung giờ 14:00 - 16:00 vựa ghé đầu hẻm được không?",
          isRead: true,
          sentAt: new Date(now.getTime() - 15 * 60000).toISOString(),
        },
        {
          id: "prop-demo-01",
          orderId,
          senderUserId: "22222222-2222-2222-2222-222222222222",
          senderName: "Vựa phế liệu EcoGreen",
          senderRole: "Recycler",
          messageType: "Proposal",
          messageContent: "Chai PET sạch không lẫn nắp bên mình thu 7.500đ/kg chiều nay nhé!",
          proposal: {
            proposedPricePerKg: 7500,
            proposedWeightKg: 12.5,
            proposedTimeSlot: "14:00 - 16:00",
            note: "Chai PET sạch không lẫn nắp bên mình thu 7.500đ/kg chiều nay nhé!",
            proposalStatus: "Pending",
          },
          isRead: true,
          sentAt: new Date(now.getTime() - 10 * 60000).toISOString(),
        },
      ],
      pageNumber: 1,
      pageSize: 50,
      totalRecords: 3,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    },
  }

  saveFallbackThread(initialThread)
  return initialThread
}

function fallbackSendChatMessage(
  orderId: string,
  request: SendChatMessageRequest,
): ChatMessageDto {
  const thread = getFallbackThread(orderId)
  const session = getSession()
  const isRecycler = session?.role === "recycler"
  const senderUserId = isRecycler
    ? "22222222-2222-2222-2222-222222222222"
    : "11111111-1111-1111-1111-111111111111"
  const senderName = session?.name || (isRecycler ? thread.facilityName : thread.citizenName)
  const senderRole = isRecycler ? "Recycler" : "Citizen"

  const newMsg: ChatMessageDto = {
    id: `msg-${Date.now()}`,
    orderId,
    senderUserId,
    senderName,
    senderRole,
    messageType: request.messageType,
    messageContent: request.messageContent || null,
    attachmentUrl: request.attachmentUrl || null,
    isRead: false,
    sentAt: new Date().toISOString(),
  }

  thread.messages.items.push(newMsg)
  thread.messages.totalRecords++
  saveFallbackThread(thread)
  return newMsg
}

function fallbackSendProposal(
  orderId: string,
  request: SendProposalRequest,
): ChatMessageDto {
  const thread = getFallbackThread(orderId)
  const session = getSession()
  const isRecycler = session?.role === "recycler"
  const senderUserId = isRecycler
    ? "22222222-2222-2222-2222-222222222222"
    : "11111111-1111-1111-1111-111111111111"
  const senderName = session?.name || (isRecycler ? thread.facilityName : thread.citizenName)
  const senderRole = isRecycler ? "Recycler" : "Citizen"

  // Chuyển các đề xuất Pending cũ sang Superseded (BR-NEG-03)
  for (const m of thread.messages.items) {
    if (m.proposal && m.proposal.proposalStatus === "Pending") {
      m.proposal.proposalStatus = "Superseded"
    }
  }

  const proposalDetail: ProposalDetailDto = {
    proposedPricePerKg: request.proposedPricePerKg,
    proposedWeightKg: request.proposedWeightKg,
    proposedTimeSlot: request.proposedTimeSlot,
    note: request.note,
    proposalStatus: "Pending",
  }

  const newMsg: ChatMessageDto = {
    id: `prop-${Date.now()}`,
    orderId,
    senderUserId,
    senderName,
    senderRole,
    messageType: "Proposal",
    messageContent: request.note || `Đề xuất giá: ${request.proposedPricePerKg.toLocaleString("vi-VN")} đ/kg, khung giờ: ${request.proposedTimeSlot}`,
    proposal: proposalDetail,
    isRead: false,
    sentAt: new Date().toISOString(),
  }

  thread.activeProposal = newMsg
  thread.orderStatus = "Negotiating"
  thread.messages.items.push(newMsg)
  thread.messages.totalRecords++
  saveFallbackThread(thread)
  return newMsg
}

function fallbackRespondProposal(
  orderId: string,
  messageId: string,
  request: RespondProposalRequest,
): ProposalAcceptanceResultDto {
  const thread = getFallbackThread(orderId)
  const session = getSession()
  const responderName = session?.name || "Đối phương"

  const target = thread.messages.items.find((m) => m.id === messageId)
  if (target && target.proposal) {
    target.proposal.proposalStatus = request.isAccepted ? "Accepted" : "Rejected"
    target.proposal.responseNote = request.responseNote || null
    target.proposal.respondedAt = new Date().toISOString()
  }

  let systemMsg: ChatMessageDto | null = null

  if (request.isAccepted && target?.proposal) {
    thread.orderStatus = "Accepted"
    thread.isProposalLocked = true
    thread.agreedPricePerKg = target.proposal.proposedPricePerKg
    thread.estimatedWeightKg = target.proposal.proposedWeightKg
    thread.confirmedTimeSlot = target.proposal.proposedTimeSlot
    thread.acceptedAt = new Date().toISOString()
    thread.activeProposal = null

    systemMsg = {
      id: `sys-${Date.now()}`,
      orderId,
      senderUserId: "00000000-0000-0000-0000-000000000000",
      senderName: "Hệ thống EcoLink",
      senderRole: "System",
      messageType: "System",
      messageContent: `${responderName} đã chấp nhận đề nghị. Điều khoản đã khóa: ${target.proposal.proposedPricePerKg.toLocaleString("vi-VN")} VNĐ/kg • ${target.proposal.proposedWeightKg} kg • Khung giờ: ${target.proposal.proposedTimeSlot}.`,
      isRead: true,
      sentAt: new Date().toISOString(),
    }
    thread.messages.items.push(systemMsg)
    thread.messages.totalRecords++
  }

  saveFallbackThread(thread)

  return {
    orderId,
    proposalMessageId: messageId,
    proposalStatus: request.isAccepted ? "Accepted" : "Rejected",
    orderStatus: thread.orderStatus,
    agreedPricePerKg: thread.agreedPricePerKg,
    confirmedWeightKg: thread.estimatedWeightKg,
    confirmedTimeSlot: thread.confirmedTimeSlot,
    acceptedAt: thread.acceptedAt,
    isProposalLocked: thread.isProposalLocked,
    systemMessage: systemMsg,
  }
}

function fallbackAcceptOrderInitialTerms(
  orderId: string,
): ProposalAcceptanceResultDto {
  const thread = getFallbackThread(orderId)
  thread.orderStatus = "Accepted"
  thread.isProposalLocked = true
  thread.agreedPricePerKg = thread.initialPricePerKg ?? 7000
  thread.confirmedTimeSlot = thread.proposedTimeSlot ?? "14:00 - 16:00"
  thread.acceptedAt = new Date().toISOString()
  thread.activeProposal = null

  const systemMsg: ChatMessageDto = {
    id: `sys-${Date.now()}`,
    orderId,
    senderUserId: "00000000-0000-0000-0000-000000000000",
    senderName: "Hệ thống EcoLink",
    senderRole: "System",
    messageType: "System",
    messageContent: `${thread.facilityName} đã chấp nhận điều khoản ban đầu của đơn bàn giao. Khung giờ chính thức: ${thread.confirmedTimeSlot}.`,
    isRead: true,
    sentAt: new Date().toISOString(),
  }
  thread.messages.items.push(systemMsg)
  thread.messages.totalRecords++

  saveFallbackThread(thread)

  return {
    orderId,
    proposalMessageId: "",
    proposalStatus: "Accepted",
    orderStatus: "Accepted",
    agreedPricePerKg: thread.agreedPricePerKg,
    confirmedWeightKg: thread.estimatedWeightKg,
    confirmedTimeSlot: thread.confirmedTimeSlot,
    acceptedAt: thread.acceptedAt,
    isProposalLocked: true,
    systemMessage: systemMsg,
  }
}
