import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import type * as signalR from "@microsoft/signalr"
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ClipboardList,
  Clock,
  ImagePlus,
  Info,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  SendHorizontal,
  Store,
  User as UserIcon,
  X,
} from "lucide-react"
import { RequiredMark } from "@/components/Portal"
import { ADDRESS } from "@/data/map"
import {
  TIME_SLOTS,
  formatCombinedAppointmentSlot,
  formatIsoDateToVi,
  getAppointmentDateBounds,
  getDefaultAppointmentDateAndSlot,
  isTimeSlotInPastForDate,
  splitCombinedAppointmentSlot,
  validateAppointmentSelection,
} from "@/data/handover"
import { clearSessionOnUnauthorized, rotateRefreshTokenSingleFlight } from "@/lib/api"
import { getRefreshToken, useRole, useSession } from "@/lib/session"
import {
  acceptOrderInitialTerms,
  createNegotiationChatConnection,
  ensureInquiryOrderForPartner,
  getOrderChatThread,
  isGuid,
  joinOrderChatRoom,
  leaveOrderChatRoom,
  markMessagesAsRead,
  respondToProposal,
  sendChatMessage,
  sendProposal,
  sendTypingIndicator,
  uploadChatAttachment,
} from "@/lib/chatApi"
import type { OrderChatThreadDto } from "@/lib/chatApi"
import {
  fetchHandoverOrdersResult,
  formatOrderDisplayCode,
  type SyncedHandoverOrder,
} from "@/lib/recyclerWorkflowApi"

const DEFAULT_CHAT_PICKUP_ADDRESS =
  "Cổng phụ Khu CNC Hòa Lạc (gần ĐH FPT), Xã Tân Xã, Thạch Thất, Hà Nội"

const CHAT_WASTE_CATEGORIES = [
  { code: "plastic", label: "Nhựa tái chế (PET / HDPE)" },
  { code: "paper", label: "Giấy báo & Tài liệu" },
  { code: "cardboard", label: "Bìa carton" },
  { code: "metal", label: "Kim loại & Vỏ lon" },
  { code: "glass", label: "Thủy tinh" },
] as const

interface ChatSessionItem {
  id: string
  displayCode: string
  partner: string
  partnerId?: string
  recyclerId?: string
  slot: string
  status: string
  rawStatus?: string
  isInquiryOnly?: boolean
  address?: string
  categoryCode?: string
  weightKg?: number
  pricePerKg?: number
  lastMessagePreview?: string
  lastMessageSenderId?: string
  lastMessageSenderRole?: string
  lastMessageAt?: string
  unreadCount: number
}

const AVATAR_TONES = [
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-sky-100 text-sky-800 border-sky-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-lime-100 text-lime-800 border-lime-200",
] as const

const IGNORED_NAME_PREFIXES = new Set([
  "cơ",
  "sở",
  "phế",
  "liệu",
  "trạm",
  "vựa",
  "thu",
  "gom",
  "tái",
  "chế",
])

function categoryLabel(code?: string | null): string {
  const found = CHAT_WASTE_CATEGORIES.find(
    (c) => c.code.toLowerCase() === (code ?? "").toLowerCase(),
  )
  return found?.label ?? "Phế liệu tổng hợp"
}

function getInitials(name: string): string {
  const primaryName = name.split(/\s*(?:—|–|\s-\s)\s*/)[0] || name
  const parts = primaryName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return "EL"
  const meaningful = parts.filter((w) => !IGNORED_NAME_PREFIXES.has(w.toLowerCase()))
  const source = meaningful.length >= 2 ? meaningful : parts
  if (source.length === 1) return source[0].slice(0, 2).toUpperCase()
  return `${source[0][0]}${source[source.length - 1][0]}`.toUpperCase()
}

function avatarToneClass(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]
}

function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatShortChatTime(iso?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  if (toDayKey(d) === toDayKey(now)) {
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (toDayKey(d) === toDayKey(yesterday)) return "Hôm qua"
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

function formatDayDivider(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  if (toDayKey(d) === toDayKey(now)) return "Hôm nay"
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (toDayKey(d) === toDayKey(yesterday)) return "Hôm qua"
  return d.toLocaleDateString("vi-VN")
}

function orderStatusMeta(item: {
  isInquiryOnly?: boolean
  rawStatus?: string
  status?: string
}): { label: string; badgeCls: string; dotCls: string; isClosed: boolean } {
  if (item.isInquiryOnly) {
    return {
      label: "Hỏi giá",
      badgeCls: "bg-brand/10 text-brand-deep border border-brand/20",
      dotCls: "bg-emerald-500",
      isClosed: false,
    }
  }
  const s = (item.rawStatus || item.status || "").trim().toLowerCase()
  if (s === "completed" || s === "done") {
    return {
      label: "Hoàn tất",
      badgeCls: "bg-surface-3 text-body border border-line",
      dotCls: "bg-slate-400",
      isClosed: true,
    }
  }
  if (
    s === "cancelled" ||
    s === "canceled" ||
    s === "rejected" ||
    s === "declined" ||
    s === "broken" ||
    s === "expired"
  ) {
    return {
      label: "Đã hủy",
      badgeCls: "bg-surface-2 text-muted border border-line-soft",
      dotCls: "bg-slate-300",
      isClosed: true,
    }
  }
  if (s === "disputed") {
    return {
      label: "Tranh chấp",
      badgeCls: "bg-amber-50 text-amber-800 border border-amber-200",
      dotCls: "bg-amber-500",
      isClosed: false,
    }
  }
  if (s === "awaitingconfirmation" || s === "awaiting_confirmation" || s === "collected") {
    return {
      label: "Chờ duyệt cân",
      badgeCls: "bg-sky-50 text-sky-700 border border-sky-200",
      dotCls: "bg-sky-500",
      isClosed: false,
    }
  }
  if (s === "accepted" || s === "scheduled" || s === "in_progress" || s === "inprogress") {
    return {
      label: "Đã chốt",
      badgeCls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      dotCls: "bg-emerald-500",
      isClosed: false,
    }
  }
  if (s === "negotiating") {
    return {
      label: "Thương lượng",
      badgeCls: "bg-amber-50 text-amber-800 border border-amber-200",
      dotCls: "bg-amber-500",
      isClosed: false,
    }
  }
  return {
    label: "Chờ xác nhận",
    badgeCls: "bg-amber-50 text-amber-700 border border-amber-200",
    dotCls: "bg-amber-400",
    isClosed: false,
  }
}

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams()
  const session = useSession()
  const role = useRole() || "user"
  const orderIdParam = searchParams.get("orderId")
  const partnerIdParam = searchParams.get("partnerId")
  const partnerFromMap = searchParams.get("partnerName")
  const addressFromMap = searchParams.get("partnerAddress")

  // Danh sách các phiên chat / đơn bàn giao (trình bày kiểu Messenger sidebar)
  const [availableOrders, setAvailableOrders] = useState<ChatSessionItem[]>([])
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [backendConnected, setBackendConnected] = useState(false)

  // Giao diện responsive kiểu Messenger (list vs chat trên mobile + drawer thông tin đơn)
  const [mobileView, setMobileView] = useState<"list" | "chat">(() =>
    orderIdParam || partnerIdParam || partnerFromMap ? "chat" : "list",
  )
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [listFilter, setListFilter] = useState<"all" | "unread" | "active" | "closed">("all")

  // Trạng thái đơn hiện tại
  const [currentOrderId, setCurrentOrderId] = useState<string>(orderIdParam || "")

  const [thread, setThread] = useState<OrderChatThreadDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Trạng thái kết nối SignalR
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "reconnecting" | "disconnected"
  >("disconnected")

  // Trạng thái đối phương đang gõ phím
  const [partnerTyping, setPartnerTyping] = useState(false)
  const typingTimeoutRef = useRef<number | null>(null)
  const hubRef = useRef<signalR.HubConnection | null>(null)

  // Khung nhập tin nhắn
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modal đề xuất thương lượng (kiêm Lên đơn từ Chat - Chiều A)
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false)
  const [proposalPrice, setProposalPrice] = useState<number>(7500)
  const [proposalWeight, setProposalWeight] = useState<number>(10)
  const [proposalDate, setProposalDate] = useState<string>(
    () => getDefaultAppointmentDateAndSlot().dateIso,
  )
  const [proposalSlot, setProposalSlot] = useState<string>(
    () => getDefaultAppointmentDateAndSlot().slot,
  )
  const [proposalCategory, setProposalCategory] = useState<string>("plastic")
  const [proposalAddress, setProposalAddress] = useState<string>(DEFAULT_CHAT_PICKUP_ADDRESS)
  const [proposalNote, setProposalNote] = useState<string>("")
  const [proposalErr, setProposalErr] = useState<string>("")
  const [submittingProposal, setSubmittingProposal] = useState(false)

  const appointmentBounds = getAppointmentDateBounds()

  const syncProposalScheduleFromRaw = (rawSlot?: string | null, fallbackScheduledAt?: string | null) => {
    const parsed = splitCombinedAppointmentSlot(rawSlot, fallbackScheduledAt)
    const validationErr = validateAppointmentSelection(parsed.dateIso, parsed.timeSlot)
    if (!validationErr) {
      setProposalDate(parsed.dateIso)
      setProposalSlot(parsed.timeSlot)
      return
    }
    const defaults = getDefaultAppointmentDateAndSlot()
    if (
      parsed.dateIso >= appointmentBounds.minDate &&
      parsed.dateIso <= appointmentBounds.maxDate
    ) {
      setProposalDate(parsed.dateIso)
      const firstValidOnDate =
        TIME_SLOTS.find((s) => !isTimeSlotInPastForDate(parsed.dateIso, s)) ?? defaults.slot
      setProposalSlot(firstValidOnDate)
    } else {
      setProposalDate(defaults.dateIso)
      setProposalSlot(defaults.slot)
    }
  }

  // Modal xem ảnh phóng to
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  const isRecycler = role === "recycler"
  const hasPartnerContext = Boolean(!isRecycler && (partnerIdParam || partnerFromMap))
  const canCompose = Boolean(currentOrderId || hasPartnerContext)

  const currentOrderIdRef = useRef(currentOrderId)
  currentOrderIdRef.current = currentOrderId
  const hasPartnerContextRef = useRef(hasPartnerContext)
  hasPartnerContextRef.current = hasPartnerContext
  const sessionIdRef = useRef(session?.id)
  sessionIdRef.current = session?.id
  const skipNextThreadLoadIdRef = useRef<string | null>(null)

  const formatOrdersForList = (orders: SyncedHandoverOrder[]): ChatSessionItem[] =>
    (orders || []).map((o) => {
      const rawId = o.id || ""
      const displayCode = o.displayCode || formatOrderDisplayCode(rawId)
      const weightSum = (o.lines || []).reduce((sum, l) => sum + (Number(l.kg) || 0), 0)
      return {
        id: rawId,
        displayCode,
        partner: isRecycler
          ? o.citizenName || `Người dân (${displayCode})`
          : o.recycler || "Vựa thu mua EcoLink",
        partnerId: o.partnerId,
        recyclerId: o.recyclerId,
        slot: o.slot || "09:00 - 11:00",
        status: o.status || "pending",
        rawStatus: o.rawStatus,
        isInquiryOnly: o.isInquiryOnly,
        address: o.address,
        categoryCode: o.categoryCode || o.lines?.[0]?.wasteId,
        weightKg: weightSum > 0 ? weightSum : undefined,
        pricePerKg: o.agreedPricePerKg ?? o.initialPricePerKg,
        lastMessagePreview: o.lastMessagePreview,
        lastMessageSenderId: o.lastMessageSenderId,
        lastMessageSenderRole: o.lastMessageSenderRole,
        lastMessageAt: o.lastMessageAt,
        unreadCount: rawId === currentOrderIdRef.current ? 0 : (o.unreadCount ?? 0),
      }
    })

  const touchOrderPreview = (
    orderId: string,
    preview: string,
    sentAtIso: string,
    unreadDelta: number,
    meta?: {
      senderId?: string
      senderRole?: string
      rawStatus?: string
      status?: string
      isInquiryOnly?: boolean
      slot?: string
    },
  ) => {
    setAvailableOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === orderId)
      if (idx === -1) return prev
      const existing = prev[idx]
      const updated: ChatSessionItem = {
        ...existing,
        lastMessagePreview: preview,
        lastMessageAt: sentAtIso,
        lastMessageSenderId: meta?.senderId ?? existing.lastMessageSenderId,
        lastMessageSenderRole: meta?.senderRole ?? existing.lastMessageSenderRole,
        rawStatus: meta?.rawStatus ?? existing.rawStatus,
        status: meta?.status ?? existing.status,
        isInquiryOnly:
          typeof meta?.isInquiryOnly === "boolean" ? meta.isInquiryOnly : existing.isInquiryOnly,
        slot: meta?.slot ?? existing.slot,
        unreadCount:
          unreadDelta === 0
            ? 0
            : Math.max(0, (existing.unreadCount || 0) + unreadDelta),
      }
      const next = prev.filter((_, i) => i !== idx)
      return [updated, ...next]
    })
  }

  const selectOrderSession = (orderId: string) => {
    setCurrentOrderId(orderId)
    setMobileView("chat")
    setPartnerTyping(false)
    setAvailableOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, unreadCount: 0 } : o)),
    )
    setSearchParams(
      (prev) => {
        if (orderId) prev.set("orderId", orderId)
        else prev.delete("orderId")
        return prev
      },
      { replace: true },
    )
  }

  // 1. Tải danh sách phiên chat thật của tài khoản đang đăng nhập từ PostgreSQL
  useEffect(() => {
    let active = true
    async function loadOrders() {
      try {
        const res = await fetchHandoverOrdersResult(isRecycler ? "recycler" : "user", {
          includeInquiries: true,
        })
        if (!active) return

        setBackendConnected(res.fromBackend)
        const formatted = formatOrdersForList(res.orders)

        setAvailableOrders(formatted)
        setOrdersLoaded(true)

        if (!orderIdParam) {
          if (hasPartnerContext) {
            const partnerMatches = formatted.filter((o) => {
              const idMatch =
                Boolean(partnerIdParam) &&
                (o.partnerId === partnerIdParam || o.recyclerId === partnerIdParam)
              const nameMatch =
                Boolean(partnerFromMap) &&
                o.partner.trim().toLowerCase() === partnerFromMap!.trim().toLowerCase()
              return idMatch || nameMatch
            })
            const preferredMatch =
              partnerMatches.find((o) => o.status === "pending" || o.status === "accepted") ||
              partnerMatches[0]

            if (preferredMatch) {
              setCurrentOrderId(preferredMatch.id)
              setAvailableOrders((prev) =>
                prev.map((o) => (o.id === preferredMatch.id ? { ...o, unreadCount: 0 } : o)),
              )
              setSearchParams(
                (prev) => {
                  prev.set("orderId", preferredMatch.id)
                  return prev
                },
                { replace: true },
              )
            } else {
              // Sẵn sàng trò chuyện ngay theo ngữ cảnh cơ sở từ /map (tạo đơn nháp ở tin nhắn/đề xuất đầu tiên)
              setCurrentOrderId("")
              setLoading(false)
            }
          } else if (formatted.length > 0) {
            setCurrentOrderId(formatted[0].id)
            setAvailableOrders((prev) =>
              prev.map((o, i) => (i === 0 ? { ...o, unreadCount: 0 } : o)),
            )
            setSearchParams(
              (prev) => {
                prev.set("orderId", formatted[0].id)
                return prev
              },
              { replace: true },
            )
          } else if (!res.fromBackend) {
            // Chỉ khi máy chủ thực sự ngoại tuyến mới chọn mã đơn mẫu để trình diễn
            const offlineDefaultId = isRecycler ? "BH-2609-0199" : "BH-2609-0184"
            setCurrentOrderId(offlineDefaultId)
          } else {
            // Tài khoản hiện tại chưa có đơn bàn giao nào trên PostgreSQL
            setCurrentOrderId("")
            setLoading(false)
          }
        }
      } catch {
        if (active) {
          setOrdersLoaded(true)
          setLoading(false)
        }
      }
    }
    void loadOrders()
    return () => {
      active = false
    }
  }, [role, isRecycler, orderIdParam, hasPartnerContext, partnerIdParam, partnerFromMap, setSearchParams])

  // Cập nhật khi URL param thay đổi
  useEffect(() => {
    if (orderIdParam && orderIdParam !== currentOrderId) {
      setCurrentOrderId(orderIdParam)
      setMobileView("chat")
    } else if (!orderIdParam && hasPartnerContext) {
      setMobileView("chat")
    }
  }, [orderIdParam, hasPartnerContext, currentOrderId])

  // 2. Tải lịch sử thread của đơn
  useEffect(() => {
    let active = true
    async function loadThread() {
      if (!currentOrderId) {
        if (ordersLoaded) {
          setThread(null)
          setLoading(false)
        }
        return
      }
      if (skipNextThreadLoadIdRef.current === currentOrderId) {
        skipNextThreadLoadIdRef.current = null
        return
      }
      setLoading(true)
      setErrorMsg(null)
      try {
        const data = await getOrderChatThread(currentOrderId)
        if (!active) return
        setThread(data)
        if (!data.isInquiryOnly) {
          if (data.initialPricePerKg) {
            setProposalPrice(data.agreedPricePerKg || data.initialPricePerKg || 7500)
          }
          if (data.estimatedWeightKg) {
            setProposalWeight(data.estimatedWeightKg || 10)
          }
          if (data.proposedTimeSlot || data.scheduledAt) {
            syncProposalScheduleFromRaw(data.proposedTimeSlot, data.scheduledAt)
          }
          if (data.categoryCode) {
            setProposalCategory(data.categoryCode)
          }
          if (data.pickupAddress) {
            setProposalAddress(data.pickupAddress)
          }
        }
        // Đánh dấu đã đọc & xóa badge chưa đọc ở sidebar
        setAvailableOrders((prev) =>
          prev.map((o) => (o.id === currentOrderId ? { ...o, unreadCount: 0 } : o)),
        )
        markMessagesAsRead(currentOrderId).catch(() => {})
      } catch (err) {
        if (!active) return
        setErrorMsg(err instanceof Error ? err.message : "Không thể tải phòng chat.")
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadThread()
    return () => {
      active = false
    }
  }, [currentOrderId, ordersLoaded])

  // Tham chiếu khung cuộn tin nhắn (cuộn nội bộ trong khung, không kéo trôi window)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const lastScrollSigRef = useRef<string>("")

  // Giữ cửa sổ trình duyệt ở đầu trang khi mới điều hướng vào /chat
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" })
    }
  }, [])

  // Tự động cuộn bên trong khung chat khi đổi đơn hoặc có tin nhắn mới
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const items = thread?.messages.items ?? []
    const lastId = items[items.length - 1]?.id ?? ""
    const nextSig = `${currentOrderId ?? "offline"}|${items.length}|${lastId}|${partnerTyping ? "1" : "0"}`
    if (lastScrollSigRef.current === nextSig) return
    const switchedOrder = !lastScrollSigRef.current.startsWith(
      `${currentOrderId ?? "offline"}|`,
    )
    lastScrollSigRef.current = nextSig

    container.scrollTo({
      top: container.scrollHeight,
      behavior: switchedOrder ? "auto" : "smooth",
    })
  }, [currentOrderId, thread?.messages.items, partnerTyping, mobileView])

  // 3. Khởi tạo kết nối thời gian thực SignalR Hub ngay khi mở trang Chat
  useEffect(() => {
    const hub = createNegotiationChatConnection({
      onReceiveMessage: (payload) => {
        const preview =
          payload.message.messageType === "Image"
            ? "Đã gửi ảnh phế liệu"
            : payload.message.messageContent || "Tin nhắn mới"
        const isCurrent = payload.orderId === currentOrderIdRef.current
        const sentByOther =
          Boolean(sessionIdRef.current) && payload.message.senderUserId !== sessionIdRef.current

        touchOrderPreview(
          payload.orderId,
          preview,
          payload.message.sentAt,
          isCurrent ? 0 : sentByOther ? 1 : 0,
          {
            senderId: payload.message.senderUserId,
            senderRole: payload.message.senderRole,
          },
        )

        if (isCurrent) {
          setThread((prev) => {
            if (!prev) return prev
            if (prev.messages.items.some((m) => m.id === payload.message.id)) return prev
            return {
              ...prev,
              messages: {
                ...prev.messages,
                items: [...prev.messages.items, payload.message],
                totalRecords: prev.messages.totalRecords + 1,
              },
            }
          })
          markMessagesAsRead(payload.orderId).catch(() => {})
        }
      },
      onProposalCreated: (payload) => {
        const nextProp = payload.proposalMessage.proposal
        const preview = nextProp?.proposedPricePerKg
          ? `Đề xuất: ${nextProp.proposedPricePerKg.toLocaleString("vi-VN")} đ/kg · ${nextProp.proposedWeightKg} kg`
          : "Bản đề xuất thương lượng"
        const isCurrent = payload.orderId === currentOrderIdRef.current
        const sentByOther =
          Boolean(sessionIdRef.current) &&
          payload.proposalMessage.senderUserId !== sessionIdRef.current

        touchOrderPreview(
          payload.orderId,
          preview,
          payload.proposalMessage.sentAt,
          isCurrent ? 0 : sentByOther ? 1 : 0,
          {
            senderId: payload.proposalMessage.senderUserId,
            senderRole: payload.proposalMessage.senderRole,
            rawStatus: "Negotiating",
            isInquiryOnly: false,
            slot: nextProp?.proposedTimeSlot,
          },
        )

        if (isCurrent) {
          setThread((prev) => {
            if (!prev) return prev
            const supersededSet = new Set(payload.supersededMessageIds || [])
            const updatedItems = prev.messages.items.map((m) => {
              if (supersededSet.has(m.id) && m.proposal) {
                return {
                  ...m,
                  proposal: { ...m.proposal, proposalStatus: "Superseded" as const },
                }
              }
              return m
            })
            if (!updatedItems.some((m) => m.id === payload.proposalMessage.id)) {
              updatedItems.push(payload.proposalMessage)
            }
            return {
              ...prev,
              orderStatus: "Negotiating",
              isInquiryOnly: false,
              initialPricePerKg:
                prev.initialPricePerKg ?? nextProp?.proposedPricePerKg ?? prev.initialPricePerKg,
              estimatedWeightKg: nextProp?.proposedWeightKg ?? prev.estimatedWeightKg,
              proposedTimeSlot: nextProp?.proposedTimeSlot ?? prev.proposedTimeSlot,
              categoryCode: nextProp?.categoryCode ?? prev.categoryCode,
              pickupAddress: nextProp?.pickupAddress ?? prev.pickupAddress,
              activeProposal: payload.proposalMessage,
              messages: {
                ...prev.messages,
                items: updatedItems,
                totalRecords: updatedItems.length,
              },
            }
          })
        }
      },
      onProposalResponded: (payload) => {
        const isAccepted = payload.result.proposalStatus === "Accepted"
        touchOrderPreview(
          payload.orderId,
          isAccepted ? "Đã chấp thuận điều khoản thu gom" : "Đã phản hồi bản đề xuất",
          payload.result.acceptedAt || new Date().toISOString(),
          payload.orderId === currentOrderIdRef.current ? 0 : 1,
          {
            senderRole: "System",
            rawStatus: payload.result.orderStatus,
            status: isAccepted ? "accepted" : undefined,
          },
        )

        if (payload.orderId === currentOrderIdRef.current) {
          setThread((prev) => {
            if (!prev) return prev
            const updatedItems = prev.messages.items.map((m) => {
              if (m.id === payload.result.proposalMessageId && m.proposal) {
                return {
                  ...m,
                  proposal: {
                    ...m.proposal,
                    proposalStatus: payload.result.proposalStatus,
                  },
                }
              }
              return m
            })

            const sysMsg = payload.result.systemMessage
            if (sysMsg && !updatedItems.some((m) => m.id === sysMsg.id)) {
              updatedItems.push(sysMsg)
            }

            return {
              ...prev,
              orderStatus: payload.result.orderStatus,
              isProposalLocked: payload.result.isProposalLocked,
              agreedPricePerKg: payload.result.agreedPricePerKg ?? prev.agreedPricePerKg,
              estimatedWeightKg: payload.result.confirmedWeightKg ?? prev.estimatedWeightKg,
              confirmedTimeSlot: payload.result.confirmedTimeSlot ?? prev.confirmedTimeSlot,
              acceptedAt: payload.result.acceptedAt ?? prev.acceptedAt,
              activeProposal: isAccepted ? null : prev.activeProposal,
              messages: {
                ...prev.messages,
                items: updatedItems,
                totalRecords: updatedItems.length,
              },
            }
          })
        }
      },
      onMessagesMarkedAsRead: (payload) => {
        if (payload.orderId === currentOrderIdRef.current) {
          setThread((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              messages: {
                ...prev.messages,
                items: prev.messages.items.map((m) => ({ ...m, isRead: true })),
              },
            }
          })
        }
      },
      onUserTypingChanged: (payload) => {
        if (payload.orderId === currentOrderIdRef.current) {
          if (payload.isTyping) {
            setPartnerTyping(true)
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
            typingTimeoutRef.current = window.setTimeout(() => {
              setPartnerTyping(false)
            }, 3000)
          } else {
            setPartnerTyping(false)
          }
        }
      },
      onOrderChatUpdated: (payload) => {
        void fetchHandoverOrdersResult(isRecycler ? "recycler" : "user", {
          includeInquiries: true,
        })
          .then((res) => {
            setAvailableOrders(formatOrdersForList(res.orders))
            const activeId = currentOrderIdRef.current
            if (!activeId && !hasPartnerContextRef.current && payload?.orderId) {
              setCurrentOrderId(payload.orderId)
              setSearchParams(
                (prev) => {
                  prev.set("orderId", payload.orderId)
                  return prev
                },
                { replace: true },
              )
            } else if (
              activeId &&
              payload?.orderId === activeId &&
              (payload.eventType === "OrderStatusUpdated" ||
                payload.eventType === "OrderTimeSlotUpdated")
            ) {
              void getOrderChatThread(activeId)
                .then((fresh) => setThread(fresh))
                .catch(() => {})
            }
          })
          .catch(() => {})
      },
      onReconnecting: () => setConnectionStatus("reconnecting"),
      onReconnected: () => {
        setConnectionStatus("connected")
        const activeId = currentOrderIdRef.current
        if (hub && isGuid(activeId)) {
          joinOrderChatRoom(hub, activeId).catch(() => {})
        }
      },
      onClose: () => setConnectionStatus("disconnected"),
    })

    if (!hub) return
    hubRef.current = hub

    hub
      .start()
      .then(() => {
        setConnectionStatus("connected")
        const activeId = currentOrderIdRef.current
        if (isGuid(activeId)) {
          return joinOrderChatRoom(hub, activeId).catch(() => {})
        }
      })
      .catch(async (err) => {
        setConnectionStatus("disconnected")
        const msg = err instanceof Error ? err.message : String(err ?? "")
        const status = (err as { statusCode?: number } | null)?.statusCode
        if (status === 401 || /\b401\b|Unauthorized/i.test(msg)) {
          if (getRefreshToken()) {
            const renewed = await rotateRefreshTokenSingleFlight()
            if (renewed) return
          }
          clearSessionOnUnauthorized()
        }
      })

    return () => {
      hub.stop().catch(() => {})
      hubRef.current = null
    }
  }, [role, session?.id, isRecycler, setSearchParams])

  // Tham gia / rời phòng chat khi người dùng đổi đơn
  useEffect(() => {
    const hub = hubRef.current
    if (!hub || connectionStatus !== "connected" || !isGuid(currentOrderId)) return

    joinOrderChatRoom(hub, currentOrderId).catch(() => {})
    return () => {
      leaveOrderChatRoom(hub, currentOrderId).catch(() => {})
    }
  }, [currentOrderId, connectionStatus])

  // Đảm bảo có orderId hợp lệ trên PostgreSQL khi bắt đầu từ Chiều A (Chat trước -> Lên đơn)
  const ensureActiveOrderId = async (): Promise<string> => {
    if (currentOrderId) return currentOrderId
    if (!hasPartnerContext) {
      throw new Error("Vui lòng chọn một cơ sở thu mua từ bản đồ hoặc chọn đơn có sẵn.")
    }

    const created = await ensureInquiryOrderForPartner({
      partnerId: partnerIdParam || undefined,
      partnerName: partnerFromMap || undefined,
    })

    const newId = created.id
    setAvailableOrders((prev) => {
      if (prev.some((o) => o.id === newId)) return prev
      return [
        {
          id: newId,
          displayCode: created.displayCode || formatOrderDisplayCode(newId),
          partner: created.partnerName || partnerFromMap || "Vựa thu mua EcoLink",
          partnerId: partnerIdParam || undefined,
          recyclerId: partnerIdParam || undefined,
          slot: "",
          status: "pending",
          rawStatus: "Negotiating",
          isInquiryOnly: true,
          address: addressFromMap || undefined,
          unreadCount: 0,
        },
        ...prev,
      ]
    })

    if (hubRef.current && isGuid(newId)) {
      await joinOrderChatRoom(hubRef.current, newId).catch(() => {})
    }

    return newId
  }

  const sendTextDirect = async (rawText: string) => {
    const text = rawText.trim()
    if (!text || sending) return

    setSending(true)
    try {
      const wasDraftless = !currentOrderId
      const targetOrderId = await ensureActiveOrderId()
      const created = await sendChatMessage(targetOrderId, {
        messageType: "Text",
        messageContent: text,
      })
      setDraft("")

      touchOrderPreview(targetOrderId, text, created.sentAt || new Date().toISOString(), 0, {
        senderId: session?.id,
        senderRole: role === "recycler" ? "Recycler" : "Citizen",
      })

      if (wasDraftless) {
        skipNextThreadLoadIdRef.current = targetOrderId
        setCurrentOrderId(targetOrderId)
        setMobileView("chat")
        setSearchParams(
          (prev) => {
            prev.set("orderId", targetOrderId)
            return prev
          },
          { replace: true },
        )
        const freshThread = await getOrderChatThread(targetOrderId)
        setThread(freshThread)
        markMessagesAsRead(targetOrderId).catch(() => {})
      } else {
        setThread((prev) => {
          if (!prev) return prev
          if (prev.messages.items.some((m) => m.id === created.id)) return prev
          return {
            ...prev,
            messages: {
              ...prev.messages,
              items: [...prev.messages.items, created],
              totalRecords: prev.messages.totalRecords + 1,
            },
          }
        })
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể gửi tin nhắn.")
    } finally {
      setSending(false)
    }
  }

  // Gửi tin nhắn Text
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendTextDirect(draft)
  }

  // Tải ảnh thực tế phế liệu lên R2 và gửi tin nhắn Image
  const handleSelectImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const wasDraftless = !currentOrderId
      const targetOrderId = await ensureActiveOrderId()
      const uploaded = await uploadChatAttachment(targetOrderId, file)
      const created = await sendChatMessage(targetOrderId, {
        messageType: "Image",
        attachmentUrl: uploaded.attachmentUrl,
        messageContent: `Ảnh chụp phế liệu: ${file.name}`,
      })

      touchOrderPreview(
        targetOrderId,
        "Đã gửi ảnh phế liệu",
        created.sentAt || new Date().toISOString(),
        0,
        {
          senderId: session?.id,
          senderRole: role === "recycler" ? "Recycler" : "Citizen",
        },
      )

      if (wasDraftless) {
        skipNextThreadLoadIdRef.current = targetOrderId
        setCurrentOrderId(targetOrderId)
        setMobileView("chat")
        setSearchParams(
          (prev) => {
            prev.set("orderId", targetOrderId)
            return prev
          },
          { replace: true },
        )
        const freshThread = await getOrderChatThread(targetOrderId)
        setThread(freshThread)
      } else {
        setThread((prev) => {
          if (!prev) return prev
          if (prev.messages.items.some((m) => m.id === created.id)) return prev
          return {
            ...prev,
            messages: {
              ...prev.messages,
              items: [...prev.messages.items, created],
              totalRecords: prev.messages.totalRecords + 1,
            },
          }
        })
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Tải ảnh phế liệu thất bại.")
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Gửi đề xuất giá, loại phế liệu, điểm hẹn & ngày/khung giờ mới (BR-NEG-04 + Chiều A Lên đơn trong Chat)
  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (proposalPrice <= 0 || proposalWeight <= 0) {
      setProposalErr("Vui lòng nhập đơn giá và khối lượng ước tính lớn hơn 0.")
      return
    }
    const scheduleErr = validateAppointmentSelection(proposalDate, proposalSlot)
    if (scheduleErr) {
      setProposalErr(scheduleErr)
      return
    }
    setProposalErr("")

    const combinedSlot = formatCombinedAppointmentSlot(proposalDate, proposalSlot)

    setSubmittingProposal(true)
    try {
      const wasDraftless = !currentOrderId
      const cleanAddress = proposalAddress.trim() || DEFAULT_CHAT_PICKUP_ADDRESS
      const targetOrderId = await ensureActiveOrderId()

      const createdProposal = await sendProposal(targetOrderId, {
        proposedPricePerKg: Number(proposalPrice),
        proposedWeightKg: Number(proposalWeight),
        proposedTimeSlot: combinedSlot,
        categoryCode: proposalCategory,
        pickupAddress: cleanAddress,
        note: proposalNote.trim() || undefined,
      })

      touchOrderPreview(
        targetOrderId,
        `Đề xuất: ${Number(proposalPrice).toLocaleString("vi-VN")} đ/kg · ${Number(proposalWeight)} kg`,
        createdProposal.sentAt || new Date().toISOString(),
        0,
        {
          senderId: session?.id,
          senderRole: role === "recycler" ? "Recycler" : "Citizen",
          rawStatus: "Negotiating",
          isInquiryOnly: false,
          slot: proposalSlot,
        },
      )

      if (wasDraftless) {
        skipNextThreadLoadIdRef.current = targetOrderId
        setCurrentOrderId(targetOrderId)
        setMobileView("chat")
        setSearchParams(
          (prev) => {
            prev.set("orderId", targetOrderId)
            return prev
          },
          { replace: true },
        )
        const freshThread = await getOrderChatThread(targetOrderId)
        setThread(freshThread)
      } else {
        setThread((prev) => {
          if (!prev) return prev
          const items = prev.messages.items.map((m) => {
            if (m.proposal && m.proposal.proposalStatus === "Pending") {
              return {
                ...m,
                proposal: { ...m.proposal, proposalStatus: "Superseded" as const },
              }
            }
            return m
          })
          return {
            ...prev,
            orderStatus: "Negotiating",
            isInquiryOnly: false,
            initialPricePerKg: prev.initialPricePerKg ?? Number(proposalPrice),
            categoryCode: proposalCategory,
            pickupAddress: cleanAddress,
            estimatedWeightKg: Number(proposalWeight),
            proposedTimeSlot: combinedSlot,
            activeProposal: createdProposal,
            messages: {
              ...prev.messages,
              items: [...items, createdProposal],
              totalRecords: items.length + 1,
            },
          }
        })
      }
      setIsProposalModalOpen(false)
      setProposalNote("")
    } catch (err) {
      setProposalErr(err instanceof Error ? err.message : "Không thể gửi đề xuất thương lượng.")
    } finally {
      setSubmittingProposal(false)
    }
  }

  // Phản hồi đề xuất: Chấp nhận hoặc Từ chối (BR-NEG-03, BR-NEG-05)
  const handleRespondProposal = async (messageId: string, isAccepted: boolean) => {
    if (
      !confirm(
        isAccepted
          ? "Bạn có chắc chắn đồng ý chốt đơn với điều khoản này không?"
          : "Bạn muốn từ chối đề xuất này?",
      )
    ) {
      return
    }

    try {
      const result = await respondToProposal(currentOrderId, messageId, {
        isAccepted,
        responseNote: isAccepted ? "Đồng ý chốt điều khoản này." : "Đã từ chối đề xuất.",
      })

      touchOrderPreview(
        currentOrderId,
        isAccepted ? "Đã chốt điều khoản thu gom" : "Đã từ chối bản đề xuất",
        result.acceptedAt || new Date().toISOString(),
        0,
        {
          senderRole: "System",
          rawStatus: result.orderStatus,
          status: isAccepted ? "accepted" : undefined,
        },
      )

      setThread((prev) => {
        if (!prev) return prev
        const updated = prev.messages.items.map((m) => {
          if (m.id === messageId && m.proposal) {
            return {
              ...m,
              proposal: { ...m.proposal, proposalStatus: result.proposalStatus },
            }
          }
          return m
        })

        if (result.systemMessage) {
          updated.push(result.systemMessage)
        }

        return {
          ...prev,
          orderStatus: result.orderStatus,
          isProposalLocked: result.isProposalLocked,
          agreedPricePerKg: result.agreedPricePerKg ?? prev.agreedPricePerKg,
          confirmedTimeSlot: result.confirmedTimeSlot ?? prev.confirmedTimeSlot,
          acceptedAt: result.acceptedAt ?? prev.acceptedAt,
          activeProposal: isAccepted ? null : prev.activeProposal,
          messages: {
            ...prev.messages,
            items: updated,
            totalRecords: updated.length,
          },
        }
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : "Thao tác không thành công.")
    }
  }

  // Recycler chấp nhận trực tiếp điều khoản ban đầu (R-05 / BR-NEG-05)
  const handleAcceptInitialTerms = async () => {
    if (!confirm("Xác nhận chấp nhận lịch hẹn và đơn giá ban đầu của người dân?")) return

    try {
      const result = await acceptOrderInitialTerms(currentOrderId)
      touchOrderPreview(
        currentOrderId,
        "Đã xác nhận lịch hẹn ban đầu",
        result.acceptedAt || new Date().toISOString(),
        0,
        {
          senderRole: "System",
          rawStatus: "Accepted",
          status: "accepted",
        },
      )
      setThread((prev) => {
        if (!prev) return prev
        const updated = [...prev.messages.items]
        if (result.systemMessage) {
          updated.push(result.systemMessage)
        }
        return {
          ...prev,
          orderStatus: "Accepted",
          isProposalLocked: true,
          agreedPricePerKg: result.agreedPricePerKg ?? prev.initialPricePerKg,
          confirmedTimeSlot: result.confirmedTimeSlot ?? prev.proposedTimeSlot,
          activeProposal: null,
          messages: {
            ...prev.messages,
            items: updated,
            totalRecords: updated.length,
          },
        }
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể chốt đơn.")
    }
  }

  const matchedOrderMeta = currentOrderId
    ? availableOrders.find((o) => o.id === currentOrderId)
    : undefined
  const isInquiryOrder = Boolean(
    currentOrderId && (thread ? thread.isInquiryOnly : matchedOrderMeta?.isInquiryOnly),
  )

  const partnerDisplayName = !currentOrderId
    ? isRecycler
      ? "Chọn đoạn chat"
      : partnerFromMap || "Chọn cơ sở để trò chuyện"
    : isRecycler
      ? thread?.citizenName || matchedOrderMeta?.partner || "Người dân EcoLink"
      : thread?.facilityName || matchedOrderMeta?.partner || partnerFromMap || "Vựa phế liệu EcoGreen"
  const partnerAddress = isInquiryOrder
    ? addressFromMap || matchedOrderMeta?.address || DEFAULT_CHAT_PICKUP_ADDRESS
    : thread?.pickupAddress ||
      matchedOrderMeta?.address ||
      addressFromMap ||
      (currentOrderId ? ADDRESS : "Chưa chọn điểm hẹn")
  const orderDisplayCode = !currentOrderId
    ? hasPartnerContext
      ? "Hỏi giá · Chưa lên đơn"
      : "Chưa chọn phiên chat"
    : isInquiryOrder
      ? "Hỏi giá · Chưa lên đơn"
      : formatOrderDisplayCode(currentOrderId)
  const createHandoverForPartnerUrl =
    !isRecycler && (partnerIdParam || partnerFromMap)
      ? `/user/handover?${new URLSearchParams({
          ...(partnerIdParam ? { partnerId: partnerIdParam } : {}),
          ...(partnerFromMap ? { partnerName: partnerFromMap } : {}),
        }).toString()}`
      : isRecycler
        ? "/recycler/requests"
        : "/user/handover"

  // Tính tiền ước tính
  const activePrice = thread?.agreedPricePerKg || thread?.initialPricePerKg || 7000
  const activeWeight = thread?.estimatedWeightKg || 10
  const estimatedTotal = activePrice * activeWeight
  const statusLower = (thread?.orderStatus ?? "").toLowerCase()
  const nextStepAction = (() => {
    if (!currentOrderId) {
      return {
        to: createHandoverForPartnerUrl,
        label: isRecycler ? "Xem đơn thu gom" : "Tạo yêu cầu bàn giao",
      }
    }
    if (statusLower === "accepted" || statusLower === "scheduled") {
      return isRecycler
        ? {
            to: `/recycler/receipt?orderId=${encodeURIComponent(currentOrderId)}`,
            label: "Cân & Lập biên nhận",
          }
        : {
            to: "/user/handover",
            label: "Theo dõi lịch thu gom",
          }
    }
    if (statusLower === "awaitingconfirmation" || statusLower === "collected") {
      return isRecycler
        ? {
            to: `/recycler/receipt?orderId=${encodeURIComponent(currentOrderId)}`,
            label: "Xem biên nhận đã lập",
          }
        : {
            to: `/user/receipt?orderId=${encodeURIComponent(currentOrderId)}`,
            label: "Kiểm tra & Xác nhận",
          }
    }
    if (statusLower === "completed") {
      return isRecycler
        ? { to: "/recycler/requests", label: "Danh sách đơn" }
        : {
            to: `/user/receipt?orderId=${encodeURIComponent(currentOrderId)}`,
            label: "Xem biên nhận & Đánh giá",
          }
    }
    return {
      to: createHandoverForPartnerUrl,
      label: isRecycler ? "Xem đơn thu gom" : "Tạo yêu cầu bàn giao",
    }
  })()

  // Bộ lọc & thống kê cho danh sách Messenger bên trái
  const totalUnreadAll = useMemo(
    () => availableOrders.reduce((sum, o) => sum + (o.unreadCount || 0), 0),
    [availableOrders],
  )
  const otherUnreadCount = useMemo(
    () =>
      availableOrders
        .filter((o) => o.id !== currentOrderId)
        .reduce((sum, o) => sum + (o.unreadCount || 0), 0),
    [availableOrders, currentOrderId],
  )
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return availableOrders.filter((o) => {
      const meta = orderStatusMeta(o)
      if (listFilter === "unread" && (o.unreadCount || 0) <= 0) return false
      if (listFilter === "active" && meta.isClosed) return false
      if (listFilter === "closed" && !meta.isClosed) return false
      if (!q) return true
      return `${o.partner} ${o.displayCode} ${o.address ?? ""} ${o.lastMessagePreview ?? ""}`
        .toLowerCase()
        .includes(q)
    })
  }, [availableOrders, searchQuery, listFilter])

  // Tập ảnh đã chia sẻ trong luồng chat cho Drawer Info bên phải
  const sharedImages = useMemo(
    () =>
      (thread?.messages.items || []).filter(
        (m) => Boolean(m.attachmentUrl) && m.messageType === "Image",
      ),
    [thread?.messages.items],
  )

  const openProposalModal = () => {
    setProposalErr("")
    syncProposalScheduleFromRaw(thread?.proposedTimeSlot, thread?.scheduledAt)
    setIsProposalModalOpen(true)
  }

  return (
    <div className="flex flex-col">
      {/* Khung Messenger responsive (Danh sách chat bên trái + Hội thoại giữa + Chi tiết đơn phải) */}
      <div className="relative -mx-3 sm:mx-0 flex h-[calc(100dvh-210px)] min-h-[480px] sm:h-[calc(100dvh-180px)] md:h-[calc(100dvh-140px)] md:min-h-[560px] md:max-h-[780px] overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
        {/* CỘT TRÁI: DANH SÁCH ĐOẠN CHAT GIỐNG MESSENGER */}
        <aside
          aria-label="Danh sách cuộc trò chuyện"
          className={`${
            mobileView === "list" ? "flex" : "hidden md:flex"
          } w-full md:w-[270px] lg:w-[290px] xl:w-[320px] shrink-0 flex-col border-line bg-surface md:border-r`}
        >
          {/* Header Sidebar */}
          <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-ink truncate">Đoạn chat</h1>
              {totalUnreadAll > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white tabular-nums">
                  {totalUnreadAll}
                </span>
              )}
              <span
                title={
                  connectionStatus === "connected"
                    ? "Kết nối thời gian thực"
                    : connectionStatus === "reconnecting"
                      ? "Đang kết nối lại..."
                      : "Ngoại tuyến"
                }
                className={`size-2 shrink-0 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-emerald-500"
                    : connectionStatus === "reconnecting"
                      ? "bg-amber-500 animate-ping"
                      : "bg-gray-300"
                }`}
              />
            </div>

            <Link
              to={createHandoverForPartnerUrl}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-brand/25 bg-brand/8 px-2.5 text-[11px] font-semibold text-brand-deep transition-colors hover:bg-brand/15"
              title={isRecycler ? "Đi tới danh sách yêu cầu thu gom" : "Tạo yêu cầu bàn giao mới"}
            >
              <Plus className="size-3.5 shrink-0" />
              <span>{isRecycler ? "Đơn thu gom" : "Tạo yêu cầu bàn giao"}</span>
            </Link>
          </div>

          {/* Thanh tìm kiếm & bộ lọc trạng thái kiểu Messenger */}
          <div className="flex flex-col gap-2.5 border-b border-line-soft px-3 py-2.5">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 size-4 text-muted" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm đối tác, mã đơn BH-..."
                aria-label="Tìm cuộc trò chuyện"
                className="h-9 w-full rounded-full border border-line bg-surface-2 pl-9 pr-8 text-xs text-ink placeholder:text-muted focus:border-brand focus:bg-white focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2 rounded-full p-1 text-muted hover:bg-surface-3 hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
              {(
                [
                  { id: "all", label: "Tất cả" },
                  { id: "unread", label: "Chưa đọc" },
                  { id: "active", label: "Đang giao dịch" },
                  { id: "closed", label: "Đã đóng" },
                ] as const
              ).map((tab) => {
                const active = listFilter === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setListFilter(tab.id)}
                    className={`shrink-0 rounded-full px-2.5 py-1 font-semibold transition-colors ${
                      active
                        ? "bg-brand text-white"
                        : "bg-surface-2 text-body hover:bg-surface-3 hover:text-ink"
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Danh sách thẻ cuộc trò chuyện */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {hasPartnerContext && !currentOrderId && (
              <button
                type="button"
                onClick={() => setMobileView("chat")}
                className="flex w-full items-center gap-3 rounded-xl border border-brand/30 bg-brand/8 p-2.5 text-left transition-colors"
              >
                <div
                  className={`relative flex size-11 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${avatarToneClass(
                    partnerFromMap || "M",
                  )}`}
                >
                  {getInitials(partnerFromMap || "Cơ sở")}
                  <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white bg-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-ink">
                      {partnerFromMap || "Cơ sở thu mua"}
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-brand">Mới</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="rounded-full border border-brand/25 bg-white px-2 py-0.5 text-[10px] font-semibold text-brand-deep">
                      Hỏi giá mới
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">
                    Nhắn tin hỏi giá hoặc lên đơn ngay...
                  </p>
                </div>
              </button>
            )}

            {!ordersLoaded ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl p-2 animate-pulse">
                    <div className="size-11 shrink-0 rounded-full bg-surface-3" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-3/4 rounded bg-surface-3" />
                      <div className="h-3 w-1/2 rounded bg-surface-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <MessageSquare className="size-8 text-muted/60" />
                <p className="text-xs font-semibold text-ink">
                  {availableOrders.length === 0
                    ? "Chưa có cuộc trò chuyện nào"
                    : "Không tìm thấy đoạn chat phù hợp"}
                </p>
                <p className="text-[11px] leading-relaxed text-muted">
                  {availableOrders.length === 0
                    ? isRecycler
                      ? "Đơn và tin nhắn từ Người dân sẽ hiển thị tại đây."
                      : "Chọn cơ sở trên bản đồ hoặc tạo yêu cầu bàn giao để nhắn tin trực tiếp."
                    : "Thử xóa từ khóa tìm kiếm hoặc chọn bộ lọc Tất cả."}
                </p>
                {availableOrders.length === 0 && (
                  <Link
                    to={isRecycler ? "/recycler/requests" : "/map"}
                    className="btn-outline mt-1 h-8 px-3 text-xs"
                  >
                    {isRecycler ? "Xem yêu cầu đến" : "Tìm cơ sở trên bản đồ"}
                  </Link>
                )}
              </div>
            ) : (
              filteredOrders.map((o) => {
                const isSelected = o.id === currentOrderId
                const meta = orderStatusMeta(o)
                const unread = o.unreadCount || 0
                const minePrefix =
                  Boolean(session?.id && o.lastMessageSenderId === session.id) ||
                  (!isRecycler && o.lastMessageSenderRole === "Citizen") ||
                  (isRecycler && o.lastMessageSenderRole === "Recycler")
                const fallbackPreview = o.categoryCode
                  ? `${categoryLabel(o.categoryCode)}${o.weightKg ? ` · ${o.weightKg} kg` : ""}`
                  : o.slot
                    ? `Khung giờ ${o.slot}`
                    : "Nhấn để xem chi tiết trao đổi"
                const snippet = o.lastMessagePreview
                  ? `${minePrefix ? "Bạn: " : ""}${o.lastMessagePreview}`
                  : fallbackPreview

                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => selectOrderSession(o.id)}
                    className={`group flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                      isSelected
                        ? "border-brand/25 bg-brand/10"
                        : "border-transparent hover:bg-surface-2"
                    }`}
                  >
                    <div
                      className={`relative flex size-11 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${avatarToneClass(
                        o.partner,
                      )}`}
                    >
                      {getInitials(o.partner)}
                      <span
                        className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-white ${meta.dotCls}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-sm ${
                            unread > 0 || isSelected
                              ? "font-bold text-ink"
                              : "font-semibold text-ink"
                          }`}
                        >
                          {o.partner}
                        </span>
                        <span
                          className={`shrink-0 text-[10px] tabular-nums ${
                            unread > 0 ? "font-bold text-brand" : "text-muted"
                          }`}
                        >
                          {formatShortChatTime(o.lastMessageAt)}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badgeCls}`}
                        >
                          {o.isInquiryOnly ? meta.label : `${o.displayCode} · ${meta.label}`}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p
                          className={`min-w-0 flex-1 truncate text-xs ${
                            unread > 0 ? "font-semibold text-ink" : "text-muted"
                          }`}
                        >
                          {snippet}
                        </p>
                        {unread > 0 && (
                          <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white tabular-nums">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* CỘT GIỮA: KHUNG CHAT THỜI GIAN THỰC */}
        <section
          aria-label="Khung chat thương lượng"
          className={`${
            mobileView === "chat" ? "flex" : "hidden md:flex"
          } min-w-0 flex-1 flex-col bg-surface`}
        >
          {/* Header Messenger gọn gàng */}
          <header className="flex items-center justify-between gap-2 border-b border-line px-3 sm:px-4 py-2.5 bg-surface">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileView("list")}
                aria-label="Quay lại danh sách đoạn chat"
                className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-body hover:bg-surface-2 md:hidden"
              >
                <ArrowLeft className="size-5" />
                {otherUnreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand" />
                )}
              </button>

              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${avatarToneClass(
                  partnerDisplayName,
                )}`}
              >
                {currentOrderId || hasPartnerContext ? (
                  getInitials(partnerDisplayName)
                ) : isRecycler ? (
                  <UserIcon className="size-4.5" />
                ) : (
                  <Store className="size-4.5" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm sm:text-base font-bold text-ink">
                    {partnerDisplayName}
                  </p>
                  {currentOrderId && (
                    <span className="hidden sm:inline-flex shrink-0 rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-deep">
                      {orderDisplayCode}
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-muted">
                  {partnerTyping ? (
                    <span className="font-semibold text-brand">Đang nhập tin nhắn...</span>
                  ) : (
                    <>
                      <span className={currentOrderId ? "sm:hidden" : ""}>{orderDisplayCode}</span>
                      <span className="hidden sm:inline">
                        {currentOrderId ? partnerAddress : ` · ${partnerAddress}`}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {currentOrderId &&
                isRecycler &&
                thread?.orderStatus === "Pending" &&
                !thread.isProposalLocked && (
                  <button
                    type="button"
                    onClick={handleAcceptInitialTerms}
                    className="btn-primary hidden sm:inline-flex h-8 px-3 text-xs"
                  >
                    Chốt lịch ban đầu
                  </button>
                )}

              {currentOrderId && (thread?.isProposalLocked || statusLower === "completed") && (
                <Link
                  to={nextStepAction.to}
                  className="btn-outline hidden lg:inline-flex h-8 px-3 text-xs"
                >
                  {nextStepAction.label}
                </Link>
              )}

              <button
                type="button"
                onClick={() => setShowInfoPanel((v) => !v)}
                aria-label="Thông tin đơn và ảnh đính kèm"
                aria-expanded={showInfoPanel}
                title="Thông tin đơn & Ảnh đính kèm"
                className={`flex size-9 items-center justify-center rounded-full border transition-colors ${
                  showInfoPanel
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-transparent text-brand hover:bg-surface-2"
                }`}
              >
                <Info className="size-4.5" />
              </button>
            </div>
          </header>

          {/* Thanh ghim điều khoản thương lượng (Pinned Strip kiểu Messenger) */}
          {currentOrderId && !isInquiryOrder && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/70 px-3 sm:px-4 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                <span className="font-bold text-ink">{categoryLabel(thread?.categoryCode)}</span>
                <span className="text-muted">·</span>
                <span className="font-bold text-brand-deep tabular-nums">
                  {(thread?.agreedPricePerKg || thread?.initialPricePerKg || 7000).toLocaleString(
                    "vi-VN",
                  )}{" "}
                  đ/kg
                </span>
                <span className="text-muted">·</span>
                <span className="font-semibold text-ink tabular-nums">{activeWeight} kg</span>
                <span className="hidden sm:inline text-muted">·</span>
                <span className="hidden sm:inline font-semibold text-ink">
                  {thread?.confirmedTimeSlot || thread?.proposedTimeSlot || "09:00 - 11:00"}
                </span>
                <span className="hidden md:inline font-bold text-brand-deep tabular-nums">
                  (~{estimatedTotal.toLocaleString("vi-VN")} đ)
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {thread?.isProposalLocked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    Đã chốt
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={openProposalModal}
                    className="btn-outline h-7 px-2.5 text-[11px] font-semibold"
                  >
                    Đề xuất giá &amp; giờ
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Luồng tin nhắn */}
          <div
            ref={messagesContainerRef}
            className="flex flex-1 flex-col gap-2.5 overflow-y-auto bg-page/60 px-3 sm:px-5 py-4"
          >
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted">
                Đang tải lịch sử thương lượng...
              </div>
            ) : !currentOrderId && ordersLoaded && (backendConnected || hasPartnerContext) ? (
              hasPartnerContext ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                  <div
                    className={`flex size-16 items-center justify-center rounded-full border text-lg font-bold ${avatarToneClass(
                      partnerFromMap || "Cơ sở",
                    )}`}
                  >
                    {getInitials(partnerFromMap || "Cơ sở")}
                  </div>
                  <p className="text-base font-bold text-ink">
                    Trò chuyện &amp; Thương lượng cùng {partnerFromMap || "cơ sở thu mua"}
                  </p>
                  <p className="max-w-[52ch] text-xs leading-relaxed text-muted">
                    Nhắn tin hỏi giá, gửi ảnh phế liệu thực tế hoặc bấm Lên đơn &amp; Đề xuất giá
                    ngay tại đây. Lịch sử trao đổi được lưu bất biến (BR-NEG-01).
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsProposalModalOpen(true)}
                      className="btn-primary h-10 px-4 text-xs font-semibold"
                    >
                      Lên đơn &amp; Đề xuất giá ngay
                    </button>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() =>
                        void sendTextDirect(
                          "Chào cơ sở, mình muốn hỏi giá thu mua hôm nay và hẹn lịch bàn giao.",
                        )
                      }
                      className="btn-outline h-10 px-4 text-xs font-medium"
                    >
                      Hỏi giá thu mua hôm nay
                    </button>
                    <Link
                      to={createHandoverForPartnerUrl}
                      className="btn-ghost h-10 px-4 text-xs text-muted hover:text-ink"
                    >
                      Đặt lịch kèm ghim bản đồ
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                  <MessageSquare className="size-10 text-brand/40" />
                  <p className="text-base font-bold text-ink">
                    Chọn một cuộc trò chuyện để bắt đầu
                  </p>
                  <p className="max-w-[50ch] text-xs leading-relaxed text-muted">
                    {isRecycler
                      ? "Khi người dân nhắn tin thương lượng hoặc gửi yêu cầu thu gom tới cơ sở, tin nhắn sẽ xuất hiện ở danh sách bên trái."
                      : "Chọn điểm thu mua trên bản đồ hoặc tạo yêu cầu bàn giao để nhắn tin trao đổi trực tiếp."}
                  </p>
                  <Link
                    to={createHandoverForPartnerUrl}
                    className="btn-primary h-10 px-5 text-xs font-semibold"
                  >
                    {isRecycler ? "Đi tới Tiếp nhận yêu cầu" : "Tạo yêu cầu bàn giao mới"}
                  </Link>
                </div>
              )
            ) : errorMsg ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {errorMsg}
              </div>
            ) : (
              <>
                <p className="self-center rounded-full border border-line-soft bg-white px-3 py-1 text-center text-[11px] text-muted shadow-2xs">
                  Toàn bộ trao đổi được lưu phục vụ đối soát minh bạch (BR-NEG-01)
                </p>

                {(thread?.messages.items || []).map((m, idx, arr) => {
                  const prevMsg = idx > 0 ? arr[idx - 1] : null
                  const showDateDivider =
                    !prevMsg ||
                    toDayKey(new Date(prevMsg.sentAt)) !== toDayKey(new Date(m.sentAt))

                  const isMe =
                    Boolean(session?.id && m.senderUserId === session.id) ||
                    (role === "user" && m.senderRole === "Citizen") ||
                    (role === "recycler" && m.senderRole === "Recycler")

                  return (
                    <div key={m.id} className="flex flex-col gap-1.5">
                      {showDateDivider && (
                        <div className="my-1 flex justify-center">
                          <span className="rounded-full bg-surface-2 px-3 py-0.5 text-[10px] font-semibold text-muted">
                            {formatDayDivider(m.sentAt)}
                          </span>
                        </div>
                      )}

                      {m.messageType === "System" ? (
                        <div className="my-1 flex justify-center">
                          <div className="max-w-[90%] rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-center text-[11px] font-medium text-emerald-800">
                            {m.messageContent}
                          </div>
                        </div>
                      ) : m.messageType === "Proposal" && m.proposal ? (
                        (() => {
                          const p = m.proposal
                          const isPending = p.proposalStatus === "Pending"
                          const isSuperseded = p.proposalStatus === "Superseded"
                          const isAccepted = p.proposalStatus === "Accepted"
                          const isRejected = p.proposalStatus === "Rejected"

                          return (
                            <div
                              className={`flex items-end gap-2 ${
                                isMe ? "justify-end" : "justify-start"
                              } my-1`}
                            >
                              {!isMe && (
                                <div
                                  className={`hidden sm:flex size-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${avatarToneClass(
                                    partnerDisplayName,
                                  )}`}
                                >
                                  {getInitials(partnerDisplayName)}
                                </div>
                              )}
                              <div
                                className={`flex flex-col ${
                                  isMe ? "items-end" : "items-start"
                                } max-w-full`}
                              >
                                <div
                                  className={`w-full max-w-[min(100%,400px)] rounded-2xl border p-3.5 sm:p-4 transition-all ${
                                    isSuperseded
                                      ? "border-line bg-surface-2/60 text-muted opacity-65"
                                      : isAccepted
                                        ? "border-emerald-300 bg-emerald-50/80 shadow-xs"
                                        : isPending
                                          ? "border-amber-300 bg-amber-50/90 shadow-sm ring-1 ring-amber-200"
                                          : "border-red-200 bg-red-50/70"
                                  }`}
                                >
                                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2">
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                                      Bản đề xuất thương lượng
                                    </span>
                                    <span
                                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                                        isAccepted
                                          ? "bg-emerald-100 text-emerald-800"
                                          : isSuperseded
                                            ? "bg-gray-200 text-gray-600"
                                            : isPending
                                              ? "bg-amber-200 text-amber-900"
                                              : "bg-red-100 text-red-800"
                                      }`}
                                    >
                                      {isAccepted
                                        ? "Đã chấp thuận"
                                        : isSuperseded
                                          ? "Đã thay thế"
                                          : isPending
                                            ? "Đang chờ"
                                            : isRejected
                                              ? "Đã từ chối"
                                              : "Đã đóng"}
                                    </span>
                                  </div>

                                  <div className="mb-2.5 grid grid-cols-2 gap-2 text-xs text-body">
                                    <div className="rounded-lg border border-line-soft bg-white/85 p-2">
                                      <span className="block text-[10px] text-muted">
                                        Đơn giá đề xuất
                                      </span>
                                      <span className="text-sm font-bold text-brand-deep tabular-nums">
                                        {p.proposedPricePerKg.toLocaleString("vi-VN")} đ/kg
                                      </span>
                                    </div>
                                    <div className="rounded-lg border border-line-soft bg-white/85 p-2">
                                      <span className="block text-[10px] text-muted">
                                        Khối lượng
                                      </span>
                                      <span className="text-sm font-bold text-ink tabular-nums">
                                        {p.proposedWeightKg} kg
                                      </span>
                                    </div>
                                    <div className="col-span-2 rounded-lg border border-line-soft bg-white/85 p-2">
                                      <span className="block text-[10px] text-muted">
                                        Khung giờ thu gom
                                      </span>
                                      <span className="font-bold text-ink">
                                        {p.proposedTimeSlot}
                                      </span>
                                    </div>
                                    {(p.categoryCode || p.pickupAddress) && (
                                      <div className="col-span-2 space-y-1 rounded-lg border border-line-soft bg-white/85 p-2">
                                        {p.categoryCode && (
                                          <p>
                                            <span className="text-muted">Loại phế liệu: </span>
                                            <b className="text-ink">{categoryLabel(p.categoryCode)}</b>
                                          </p>
                                        )}
                                        {p.pickupAddress && (
                                          <p>
                                            <span className="text-muted">Điểm hẹn: </span>
                                            <b className="text-ink">{p.pickupAddress}</b>
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {p.note && (
                                    <p className="mb-2.5 rounded-lg bg-white/70 p-2 text-xs italic text-body">
                                      "{p.note}"
                                    </p>
                                  )}

                                  {isPending && (
                                    <div className="border-t border-line/60 pt-2">
                                      {!isMe ? (
                                        <div className="flex flex-wrap items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => handleRespondProposal(m.id, true)}
                                            className="btn-primary h-8 flex-1 px-3 text-xs font-semibold"
                                          >
                                            Chấp nhận
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setProposalErr("")
                                              setProposalPrice(p.proposedPricePerKg)
                                              setProposalWeight(p.proposedWeightKg)
                                              syncProposalScheduleFromRaw(
                                                p.proposedTimeSlot,
                                                thread?.scheduledAt,
                                              )
                                              if (p.categoryCode) setProposalCategory(p.categoryCode)
                                              if (p.pickupAddress) setProposalAddress(p.pickupAddress)
                                              setIsProposalModalOpen(true)
                                            }}
                                            className="btn-outline h-8 px-2.5 text-xs text-ink"
                                          >
                                            Đề xuất lại
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRespondProposal(m.id, false)}
                                            className="btn-ghost h-8 px-2.5 text-xs text-red-600"
                                          >
                                            Từ chối
                                          </button>
                                        </div>
                                      ) : (
                                        <p className="text-center text-[11px] font-medium text-amber-800">
                                          Đang chờ {partnerDisplayName} phản hồi (BR-NEG-03)
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <span className="mt-1 px-1 text-[10px] text-muted">
                                  {m.senderName} ·{" "}
                                  {new Date(m.sentAt).toLocaleTimeString("vi-VN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                          )
                        })()
                      ) : (
                        <div
                          className={`flex items-end gap-2 ${
                            isMe ? "justify-end" : "justify-start"
                          }`}
                        >
                          {!isMe && (
                            <div
                              className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${avatarToneClass(
                                partnerDisplayName,
                              )}`}
                            >
                              {getInitials(partnerDisplayName)}
                            </div>
                          )}
                          <div
                            className={`flex flex-col ${
                              isMe ? "items-end" : "items-start"
                            } max-w-[82%] sm:max-w-[72%]`}
                          >
                            <div
                              className={`rounded-2xl px-3.5 py-2 shadow-2xs ${
                                isMe
                                  ? "rounded-br-xs bg-brand text-white"
                                  : "rounded-bl-xs border border-line bg-white text-ink"
                              }`}
                            >
                              {m.attachmentUrl && (
                                <div className="mb-1.5 overflow-hidden rounded-xl">
                                  <img
                                    src={m.attachmentUrl}
                                    alt="Ảnh đính kèm"
                                    onClick={() => setPreviewImageUrl(m.attachmentUrl || null)}
                                    className="max-h-[220px] w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                                  />
                                </div>
                              )}
                              {m.messageContent && (
                                <p className="whitespace-pre-wrap text-sm leading-relaxed break-words">
                                  {m.messageContent}
                                </p>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-muted">
                              <span>
                                {new Date(m.sentAt).toLocaleTimeString("vi-VN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {isMe &&
                                (m.isRead ? (
                                  <span className="inline-flex items-center gap-0.5 text-brand">
                                    <CheckCheck className="size-3" />
                                    Đã xem
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5">
                                    <Check className="size-3" />
                                    Đã gửi
                                  </span>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Chỉ báo đang nhập */}
                {partnerTyping && (
                  <div className="flex items-center gap-2 px-1 py-1 text-xs italic text-muted animate-pulse">
                    <div
                      className={`flex size-6 items-center justify-center rounded-full border text-[9px] font-bold ${avatarToneClass(
                        partnerDisplayName,
                      )}`}
                    >
                      {getInitials(partnerDisplayName)}
                    </div>
                    <span className="rounded-full border border-line bg-white px-3 py-1">
                      Đang nhập tin nhắn...
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Thanh nhập tin nhắn kiểu Messenger */}
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-1.5 sm:gap-2 border-t border-line bg-surface px-2.5 sm:px-4 py-2.5"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleSelectImage}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />
            <button
              type="button"
              disabled={!canCompose || uploadingImage}
              onClick={() => fileInputRef.current?.click()}
              className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full text-brand transition-colors hover:bg-surface-2 disabled:opacity-40"
              title="Gửi ảnh chụp thực tế phế liệu"
              aria-label="Đính kèm ảnh phế liệu"
            >
              {uploadingImage ? (
                <Clock className="size-4.5 animate-spin" />
              ) : (
                <ImagePlus className="size-5" />
              )}
            </button>

            {canCompose && !thread?.isProposalLocked && (
              <button
                type="button"
                onClick={openProposalModal}
                className="inline-flex h-9 sm:h-10 shrink-0 items-center gap-1.5 rounded-full border border-brand/30 bg-brand/8 px-2.5 sm:px-3 text-xs font-semibold text-brand transition-colors hover:bg-brand/15"
                title="Lên đơn hoặc gửi đề xuất điều chỉnh giá, khối lượng và khung giờ"
              >
                <ClipboardList className="size-4 shrink-0" />
                <span className="hidden sm:inline">
                  {currentOrderId && !isInquiryOrder ? "Đề xuất giá" : "Lên đơn & Đề xuất"}
                </span>
              </button>
            )}

            <input
              value={draft}
              disabled={!canCompose}
              onChange={(e) => {
                const val = e.target.value
                setDraft(val)
                if (hubRef.current && currentOrderId) {
                  sendTypingIndicator(hubRef.current, currentOrderId, true).catch(() => {})
                }
              }}
              placeholder={
                !canCompose
                  ? "Chọn một đoạn chat để bắt đầu..."
                  : !currentOrderId && hasPartnerContext
                    ? `Nhắn tin hỏi giá với ${partnerDisplayName}...`
                    : `Nhắn tin cho ${partnerDisplayName}...`
              }
              className="h-9 sm:h-10 min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 text-sm text-ink placeholder:text-muted focus:border-brand focus:bg-white focus:outline-none disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={!canCompose || !draft.trim() || sending}
              aria-label="Gửi tin nhắn"
              className="btn-primary h-9 sm:h-10 shrink-0 rounded-full px-3 sm:px-4 text-xs sm:text-sm"
            >
              <SendHorizontal className="size-4 shrink-0" />
              <span className="hidden sm:inline">{sending ? "Đang gửi..." : "Gửi"}</span>
            </button>
          </form>
        </section>

        {/* PANEL PHẢI (DRAWER / SIDEBAR THÔNG TIN ĐƠN & ẢNH CHIA SẺ KIỂU MESSENGER) */}
        {showInfoPanel && (
          <>
            <div
              onClick={() => setShowInfoPanel(false)}
              className="absolute inset-0 z-20 bg-black/25 xl:hidden"
              aria-hidden="true"
            />
            <aside
              aria-label="Thông tin đơn và tệp đính kèm"
              className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[310px] flex-col border-l border-line bg-surface shadow-xl xl:static xl:z-auto xl:w-[275px] xl:shrink-0 xl:shadow-none"
            >
              <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
                <h2 className="text-sm font-bold text-ink">Chi tiết giao dịch</h2>
                <button
                  type="button"
                  onClick={() => setShowInfoPanel(false)}
                  aria-label="Đóng bảng chi tiết"
                  className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
                <div className="flex flex-col items-center text-center">
                  <div
                    className={`flex size-14 items-center justify-center rounded-full border text-base font-bold ${avatarToneClass(
                      partnerDisplayName,
                    )}`}
                  >
                    {getInitials(partnerDisplayName)}
                  </div>
                  <p className="mt-2 font-bold text-sm text-ink">{partnerDisplayName}</p>
                  <span className="mt-1 rounded-full bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] text-brand-deep">
                    {orderDisplayCode}
                  </span>
                  <p className="mt-1.5 flex items-start justify-center gap-1 text-[11px] text-muted">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    <span>{partnerAddress}</span>
                  </p>
                </div>

                {currentOrderId && !isInquiryOrder && (
                  <div className="space-y-2 rounded-xl border border-line bg-surface-2/70 p-3">
                    <p className="font-bold text-ink">Điều khoản hiện tại</p>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted">Loại phế liệu</span>
                      <span className="font-semibold text-ink text-right">
                        {categoryLabel(thread?.categoryCode)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted">Đơn giá</span>
                      <span className="font-bold text-brand-deep tabular-nums">
                        {activePrice.toLocaleString("vi-VN")} đ/kg
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted">Khối lượng</span>
                      <span className="font-semibold text-ink tabular-nums">{activeWeight} kg</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted">Khung giờ</span>
                      <span className="font-semibold text-ink text-right">
                        {thread?.confirmedTimeSlot || thread?.proposedTimeSlot || "09:00 - 11:00"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-line-soft pt-2">
                      <span className="text-muted">Ước tính</span>
                      <span className="font-bold text-brand-deep tabular-nums">
                        ~{estimatedTotal.toLocaleString("vi-VN")} đ
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {canCompose && !thread?.isProposalLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowInfoPanel(false)
                        openProposalModal()
                      }}
                      className="btn-outline h-9 w-full justify-center text-xs"
                    >
                      {currentOrderId && !isInquiryOrder
                        ? "Đề xuất giá & giờ mới"
                        : "Lên đơn & Đề xuất giá"}
                    </button>
                  )}

                  {currentOrderId &&
                    isRecycler &&
                    thread?.orderStatus === "Pending" &&
                    !thread.isProposalLocked && (
                      <button
                        type="button"
                        onClick={handleAcceptInitialTerms}
                        className="btn-primary h-9 w-full justify-center text-xs"
                      >
                        Chốt lịch ban đầu
                      </button>
                    )}

                  <Link
                    to={nextStepAction.to}
                    className="btn-primary h-9 w-full justify-center text-xs"
                  >
                    {nextStepAction.label}
                  </Link>
                </div>

                {/* Ảnh đính kèm đã chia sẻ trong phòng chat */}
                <div>
                  <p className="mb-2 font-bold text-ink">
                    Ảnh đã chia sẻ ({sharedImages.length})
                  </p>
                  {sharedImages.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-line p-3 text-center text-[11px] text-muted">
                      Chưa có ảnh phế liệu nào trong đoạn chat này.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                      {sharedImages.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setPreviewImageUrl(img.attachmentUrl || null)}
                          className="aspect-square overflow-hidden rounded-lg border border-line hover:opacity-85"
                        >
                          <img
                            src={img.attachmentUrl || ""}
                            alt="Ảnh phế liệu"
                            className="size-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Modal Đề Xuất Giá & Khung Giờ Mới */}
      {isProposalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="card max-h-[90vh] w-full max-w-[480px] overflow-y-auto p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink">
                {currentOrderId && !isInquiryOrder
                  ? "Đề xuất giá & Khung giờ thu gom"
                  : "Lên đơn & Đề xuất giá thu gom"}
              </h3>
              <button
                type="button"
                onClick={() => setIsProposalModalOpen(false)}
                className="btn-ghost size-8 p-0 text-lg text-muted hover:text-ink"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendProposal} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-ink">
                  Loại phế liệu thu gom: <RequiredMark />
                </label>
                <select
                  value={proposalCategory}
                  onChange={(e) => setProposalCategory(e.target.value)}
                  className="input h-10 text-sm"
                >
                  {CHAT_WASTE_CATEGORIES.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-ink">
                  Đơn giá thu mua đề xuất (VNĐ/kg): <RequiredMark />
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={proposalPrice}
                    onChange={(e) => setProposalPrice(Number(e.target.value))}
                    className="input h-10 text-sm font-bold text-brand"
                  />
                  <span className="shrink-0 text-muted">VNĐ / kg</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {[6500, 7000, 7500, 8000].map((pr) => (
                    <button
                      key={pr}
                      type="button"
                      onClick={() => setProposalPrice(pr)}
                      className="chip bg-surface-2 text-[11px] hover:bg-brand/10 hover:text-brand"
                    >
                      {pr.toLocaleString("vi-VN")} đ
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-ink">
                  Khối lượng ước tính (kg): <RequiredMark />
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={proposalWeight}
                  onChange={(e) => setProposalWeight(Number(e.target.value))}
                  className="input h-10 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block min-h-5 leading-5 font-semibold text-ink">
                    Ngày hẹn thu gom:{" "}
                    <span className="whitespace-nowrap">
                      <RequiredMark />
                    </span>
                  </label>
                  <input
                    type="date"
                    min={appointmentBounds.minDate}
                    max={appointmentBounds.maxDate}
                    value={proposalDate}
                    onChange={(e) => {
                      const nextDate = e.target.value
                      setProposalDate(nextDate)
                      setProposalErr("")
                      if (nextDate && isTimeSlotInPastForDate(nextDate, proposalSlot)) {
                        const firstValid = TIME_SLOTS.find(
                          (s) => !isTimeSlotInPastForDate(nextDate, s),
                        )
                        if (firstValid) setProposalSlot(firstValid)
                      }
                    }}
                    className="input h-10 text-sm"
                    required
                  />
                  <span className="mt-1 block text-[11px] text-muted">
                    Hôm nay ({formatIsoDateToVi(appointmentBounds.minDate)}) đến +30 ngày
                  </span>
                </div>

                <div>
                  <label className="mb-1 block min-h-5 leading-5 font-semibold text-ink">
                    Khung giờ thu gom:{" "}
                    <span className="whitespace-nowrap">
                      <RequiredMark />
                    </span>
                  </label>
                  <select
                    value={proposalSlot}
                    onChange={(e) => {
                      setProposalSlot(e.target.value)
                      setProposalErr("")
                    }}
                    className="input h-10 text-sm"
                  >
                    {TIME_SLOTS.map((slot) => {
                      const past = isTimeSlotInPastForDate(proposalDate, slot)
                      return (
                        <option key={slot} value={slot} disabled={past}>
                          {slot}
                          {past ? " (đã qua)" : ""}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              {proposalErr && (
                <p
                  role="alert"
                  className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs font-medium text-warn"
                >
                  {proposalErr}
                </p>
              )}

              <div>
                <label className="mb-1 block font-semibold text-ink">
                  Địa điểm thu gom / Điểm hẹn đầu ngõ: <RequiredMark />
                </label>
                <input
                  type="text"
                  value={proposalAddress}
                  onChange={(e) => setProposalAddress(e.target.value)}
                  placeholder="Ví dụ: Cổng phụ Khu CNC Hòa Lạc (gần ĐH FPT), Thạch Thất"
                  className="input h-10 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-ink">
                  Ghi chú cho đối tác (tuỳ chọn):
                </label>
                <textarea
                  rows={2}
                  value={proposalNote}
                  onChange={(e) => setProposalNote(e.target.value)}
                  placeholder="Ví dụ: Rác đã phân loại sạch, buộc bao sẵn; hoặc Kho bận tuyến sáng, hẹn đầu giờ chiều..."
                  className="input py-2 text-xs"
                />
              </div>

              <div className="mt-2 flex items-center justify-end gap-3 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setIsProposalModalOpen(false)}
                  className="btn-ghost h-10 px-4 text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingProposal}
                  className="btn-primary h-10 px-5 text-xs font-semibold"
                >
                  {submittingProposal ? "Đang gửi..." : "Gửi bản đề xuất"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Phóng To Ảnh */}
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/80 p-4"
        >
          <div className="relative max-h-[90vh] max-w-3xl">
            <img
              src={previewImageUrl}
              alt="Ảnh phóng to"
              className="max-h-[85vh] w-auto rounded-xl object-contain shadow-2xl"
            />
            <p className="mt-2 text-center text-xs text-white">Nhấp bất kỳ đâu để đóng</p>
          </div>
        </div>
      )}
    </div>
  )
}
