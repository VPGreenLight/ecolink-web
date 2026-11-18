import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import type * as signalR from "@microsoft/signalr"
import { PageHead } from "@/components/Portal"
import { ADDRESS } from "@/data/map"
import { TIME_SLOTS } from "@/data/handover"
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

function categoryLabel(code?: string | null): string {
  const found = CHAT_WASTE_CATEGORIES.find(
    (c) => c.code.toLowerCase() === (code ?? "").toLowerCase(),
  )
  return found?.label ?? "Phế liệu tổng hợp"
}

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams()
  const session = useSession()
  const role = useRole() || "user"
  const orderIdParam = searchParams.get("orderId")
  const partnerIdParam = searchParams.get("partnerId")
  const partnerFromMap = searchParams.get("partnerName")
  const addressFromMap = searchParams.get("partnerAddress")

  // Danh sách đơn để chuyển đổi
  const [availableOrders, setAvailableOrders] = useState<
    Array<{
      id: string
      displayCode: string
      partner: string
      partnerId?: string
      recyclerId?: string
      slot: string
      status: string
      rawStatus?: string
      isInquiryOnly?: boolean
    }>
  >([])
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [backendConnected, setBackendConnected] = useState(false)

  // Trạng thái đơn hiện tại: giữ nguyên orderId từ URL (hoặc chờ danh sách đơn thật từ PostgreSQL)
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Modal đề xuất thương lượng (kiêm Lên đơn từ Chat - Chiều A)
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false)
  const [proposalPrice, setProposalPrice] = useState<number>(7500)
  const [proposalWeight, setProposalWeight] = useState<number>(10)
  const [proposalSlot, setProposalSlot] = useState<string>(TIME_SLOTS[1])
  const [proposalCategory, setProposalCategory] = useState<string>("plastic")
  const [proposalAddress, setProposalAddress] = useState<string>(DEFAULT_CHAT_PICKUP_ADDRESS)
  const [proposalNote, setProposalNote] = useState<string>("")
  const [submittingProposal, setSubmittingProposal] = useState(false)

  // Modal xem ảnh phóng to
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  const isRecycler = role === "recycler"
  const hasPartnerContext = Boolean(!isRecycler && (partnerIdParam || partnerFromMap))
  const canCompose = Boolean(currentOrderId || hasPartnerContext)

  const currentOrderIdRef = useRef(currentOrderId)
  currentOrderIdRef.current = currentOrderId
  const hasPartnerContextRef = useRef(hasPartnerContext)
  hasPartnerContextRef.current = hasPartnerContext
  const skipNextThreadLoadIdRef = useRef<string | null>(null)

  const formatOrdersForList = (orders: Awaited<ReturnType<typeof fetchHandoverOrdersResult>>["orders"]) =>
    (orders || []).map((o) => {
      const rawId = o.id || ""
      const displayCode = o.displayCode || formatOrderDisplayCode(rawId)
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
      }
    })

  // 1. Tải danh sách đơn thật của tài khoản đang đăng nhập từ PostgreSQL
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
    }
  }, [orderIdParam, currentOrderId])

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
          if (data.proposedTimeSlot) {
            setProposalSlot(data.proposedTimeSlot)
          }
          if (data.categoryCode) {
            setProposalCategory(data.categoryCode)
          }
          if (data.pickupAddress) {
            setProposalAddress(data.pickupAddress)
          }
        }
        // Đánh dấu đã đọc
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

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [thread?.messages.items, partnerTyping])

  // 3. Khởi tạo kết nối thời gian thực SignalR Hub ngay khi mở trang Chat (kể cả khi danh sách đơn đang trống)
  useEffect(() => {
    const hub = createNegotiationChatConnection({
      onReceiveMessage: (payload) => {
        if (payload.orderId === currentOrderIdRef.current) {
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
        if (payload.orderId === currentOrderIdRef.current) {
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
            const nextProp = payload.proposalMessage.proposal
            return {
              ...prev,
              orderStatus: "Negotiating",
              isInquiryOnly: false,
              initialPricePerKg: prev.initialPricePerKg ?? nextProp?.proposedPricePerKg ?? prev.initialPricePerKg,
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
        if (payload.orderId === currentOrderIdRef.current) {
          setThread((prev) => {
            if (!prev) return prev
            const isAccepted = payload.result.proposalStatus === "Accepted"
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

      if (wasDraftless) {
        skipNextThreadLoadIdRef.current = targetOrderId
        setCurrentOrderId(targetOrderId)
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

      if (wasDraftless) {
        skipNextThreadLoadIdRef.current = targetOrderId
        setCurrentOrderId(targetOrderId)
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

  // Gửi đề xuất giá, loại phế liệu, điểm hẹn & khung giờ mới (BR-NEG-04 + Chiều A Lên đơn trong Chat)
  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (proposalPrice <= 0 || proposalWeight <= 0 || !proposalSlot) {
      alert("Vui lòng nhập đơn giá, khối lượng và khung giờ hợp lệ.")
      return
    }

    setSubmittingProposal(true)
    try {
      const wasDraftless = !currentOrderId
      const cleanAddress = proposalAddress.trim() || DEFAULT_CHAT_PICKUP_ADDRESS
      const targetOrderId = await ensureActiveOrderId()

      const createdProposal = await sendProposal(targetOrderId, {
        proposedPricePerKg: Number(proposalPrice),
        proposedWeightKg: Number(proposalWeight),
        proposedTimeSlot: proposalSlot,
        categoryCode: proposalCategory,
        pickupAddress: cleanAddress,
        note: proposalNote.trim() || undefined,
      })

      setAvailableOrders((prev) =>
        prev.map((o) =>
          o.id === targetOrderId ? { ...o, isInquiryOnly: false, slot: proposalSlot } : o,
        ),
      )

      if (wasDraftless) {
        skipNextThreadLoadIdRef.current = targetOrderId
        setCurrentOrderId(targetOrderId)
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
            proposedTimeSlot: proposalSlot,
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
      alert(err instanceof Error ? err.message : "Không thể gửi đề xuất thương lượng.")
    } finally {
      setSubmittingProposal(false)
    }
  }

  // Phản hồi đề xuất: Chấp nhận hoặc Từ chối (BR-NEG-03, BR-NEG-05)
  const handleRespondProposal = async (messageId: string, isAccepted: boolean) => {
    if (!confirm(isAccepted ? "Bạn có chắc chắn đồng ý chốt đơn với điều khoản này không?" : "Bạn muốn từ chối đề xuất này?")) {
      return
    }

    try {
      const result = await respondToProposal(currentOrderId, messageId, {
        isAccepted,
        responseNote: isAccepted ? "Đồng ý chốt điều khoản này." : "Đã từ chối đề xuất.",
      })

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
      ? "Chưa có đơn bàn giao"
      : partnerFromMap || "Chưa có đơn bàn giao"
    : isRecycler
      ? thread?.citizenName || "Người dân EcoLink"
      : thread?.facilityName || partnerFromMap || "Vựa phế liệu EcoGreen"
  const partnerAddress = isInquiryOrder
    ? addressFromMap || DEFAULT_CHAT_PICKUP_ADDRESS
    : thread?.pickupAddress || addressFromMap || (currentOrderId ? ADDRESS : "Chưa chọn điểm hẹn")
  const orderDisplayCode = !currentOrderId
    ? hasPartnerContext
      ? "Hỏi giá · Chưa lên đơn"
      : "Chưa chọn đơn"
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
        label: isRecycler ? "Xem danh sách đơn thu gom" : "Tạo yêu cầu bàn giao",
      }
    }
    if (statusLower === "accepted" || statusLower === "scheduled") {
      return isRecycler
        ? {
            to: `/recycler/receipt?orderId=${encodeURIComponent(currentOrderId)}`,
            label: "⚖️ Cân thực tế & Lập biên nhận",
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
            label: "✓ Kiểm tra & Xác nhận biên nhận",
          }
    }
    if (statusLower === "completed") {
      return isRecycler
        ? { to: "/recycler/requests", label: "Quay lại danh sách đơn" }
        : { to: "/user/transactions", label: "Xem lịch sử & Đánh giá sao" }
    }
    return {
      to: createHandoverForPartnerUrl,
      label: isRecycler ? "Xem danh sách đơn thu gom" : "Tạo yêu cầu bàn giao",
    }
  })()

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="THƯƠNG LƯỢNG THỜI GIAN THỰC (U-08 & R-05)"
        title={`Chat thương lượng — ${partnerDisplayName}`}
        body="Thống nhất đơn giá, khối lượng và khóa khung giờ thu gom chính thức trước khi đối tác đến cân. Toàn bộ lịch sử trao đổi được lưu trữ bất biến phục vụ đối soát tranh chấp (BR-NEG-01)."
      />

      {/* 1. Header & Điều khoản đơn hiện tại */}
      <div className="card overflow-hidden">
        {/* Thanh tiêu đề phòng chat */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-11 shrink-0 rounded-2xl bg-brand/10 text-brand flex items-center justify-center font-bold text-lg">
              {isRecycler ? "👤" : "🏪"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-bold text-ink text-base">{partnerDisplayName}</p>
                <span className="chip bg-surface-2 text-xs font-mono font-medium text-brand-deep">
                  {orderDisplayCode}
                </span>
              </div>
              <p className="text-xs text-muted truncate mt-0.5">{partnerAddress}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bộ chọn đổi đơn nếu có nhiều đơn */}
            {availableOrders.length > 0 && (
              <select
                aria-label="Chọn đơn bàn giao cần thương lượng"
                value={currentOrderId}
                onChange={(e) => {
                  const newId = e.target.value
                  setCurrentOrderId(newId)
                  setSearchParams(
                    (prev) => {
                      if (newId) prev.set("orderId", newId)
                      else prev.delete("orderId")
                      return prev
                    },
                    { replace: true },
                  )
                }}
                className="input h-9 text-xs py-1 px-2.5 max-w-[240px]"
              >
                {!currentOrderId && (
                  <option value="">
                    -- {hasPartnerContext ? "Hoặc mở đơn có sẵn khác" : "Chọn đơn bàn giao"} (
                    {availableOrders.length}) --
                  </option>
                )}
                {availableOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.isInquiryOnly
                      ? `💬 Hỏi giá (${o.partner})`
                      : `${o.displayCode} (${o.partner}${o.rawStatus === "Negotiating" ? " · Thương lượng" : ""})`}
                  </option>
                ))}
              </select>
            )}

            {/* Chỉ báo trạng thái kết nối SignalR */}
            <span
              className={`chip text-xs shrink-0 ${
                connectionStatus === "connected"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : connectionStatus === "reconnecting"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-surface-2 text-muted"
              }`}
            >
              <i
                className={`size-2 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-emerald-500 animate-pulse"
                    : connectionStatus === "reconnecting"
                      ? "bg-amber-500 animate-ping"
                      : "bg-gray-400"
                }`}
              />
              {connectionStatus === "connected"
                ? "Thời gian thực"
                : connectionStatus === "reconnecting"
                  ? "Đang kết nối lại..."
                  : "Ngoại tuyến"}
            </span>
          </div>
        </header>

        {/* Thanh Điều Khoản Đang Thương Lượng / Đã Khóa (hoặc trạng thái Phiên Hỏi Giá) */}
        {currentOrderId &&
          (isInquiryOrder ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3 text-xs">
              <p className="text-body">
                <b className="text-ink">💬 Phiên trao đổi hỏi giá</b> — Chưa tạo yêu cầu bàn giao
                chính thức. Sau khi hỏi giá, bạn có thể lên đơn ngay tại đây hoặc đặt lịch kèm ghim
                bản đồ.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {!isRecycler && (
                  <Link
                    to={createHandoverForPartnerUrl}
                    className="btn-outline h-8 px-3 text-xs font-medium"
                  >
                    Đặt lịch bàn giao
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setIsProposalModalOpen(true)}
                  className="btn-primary h-8 px-3 text-xs font-semibold"
                >
                  📋 Lên đơn &amp; Đề xuất giá
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface-2/60 px-5 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div>
                  <span className="text-muted block text-[11px]">Đơn giá thu mua:</span>
                  <p className="font-bold text-ink text-sm">
                    {thread?.isProposalLocked && thread?.agreedPricePerKg ? (
                      <span className="text-brand">
                        {thread.agreedPricePerKg.toLocaleString("vi-VN")} đ/kg{" "}
                        <span className="text-[11px] font-normal text-muted">(Đã chốt)</span>
                      </span>
                    ) : thread?.initialPricePerKg ? (
                      <span>
                        {thread.initialPricePerKg.toLocaleString("vi-VN")} đ/kg{" "}
                        <span className="text-[11px] font-normal text-muted">(Tạm tính)</span>
                        {thread?.activeProposal?.proposal?.proposedPricePerKg && (
                          <span className="ml-1 text-amber-600 font-semibold">
                            →{" "}
                            {thread.activeProposal.proposal.proposedPricePerKg.toLocaleString(
                              "vi-VN",
                            )}{" "}
                            đ
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-body">
                        {thread?.activeProposal?.proposal?.proposedPricePerKg
                          ? `${thread.activeProposal.proposal.proposedPricePerKg.toLocaleString("vi-VN")} đ/kg (Đang đề xuất)`
                          : "Đang thỏa thuận"}
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <span className="text-muted block text-[11px]">Loại phế liệu:</span>
                  <p className="font-bold text-ink text-sm">
                    {categoryLabel(thread?.categoryCode)}
                  </p>
                </div>

                <div>
                  <span className="text-muted block text-[11px]">Khối lượng ước tính:</span>
                  <p className="font-bold text-ink text-sm">{activeWeight} kg</p>
                </div>

                <div>
                  <span className="text-muted block text-[11px]">Khung giờ hẹn thu gom:</span>
                  <p className="font-bold text-ink text-sm flex items-center gap-1">
                    {thread?.confirmedTimeSlot ? (
                      <span className="text-brand">🔒 {thread.confirmedTimeSlot}</span>
                    ) : (
                      <span className="text-body">
                        🕒 {thread?.proposedTimeSlot || "09:00 - 11:00"}
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <span className="text-muted block text-[11px]">Thành tiền ước tính:</span>
                  <p className="font-bold text-brand-deep text-sm">
                    ~ {estimatedTotal.toLocaleString("vi-VN")} đ
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {thread?.isProposalLocked ? (
                  <span className="badge bg-emerald-100 text-emerald-800 text-xs px-3 py-1 font-medium">
                    ✓ Lịch hẹn &amp; Điều khoản đã khóa
                  </span>
                ) : (
                  <>
                    {isRecycler && thread?.orderStatus === "Pending" && (
                      <button
                        type="button"
                        onClick={handleAcceptInitialTerms}
                        className="btn-primary h-8 px-3 text-xs"
                      >
                        Chốt lịch hẹn ban đầu
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsProposalModalOpen(true)}
                      className="btn-outline h-8 px-3 text-xs font-semibold text-brand"
                    >
                      ⚡ Đề xuất giá &amp; giờ mới
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

        {/* 2. Cuộc hội thoại tin nhắn */}
        <div className="flex h-[480px] flex-col gap-3 overflow-y-auto p-5 bg-surface-1">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              Đang tải lịch sử thương lượng...
            </div>
          ) : !currentOrderId && ordersLoaded && (backendConnected || hasPartnerContext) ? (
            hasPartnerContext ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-4">
                <p className="text-base font-bold text-ink">
                  Trò chuyện &amp; Thương lượng cùng {partnerFromMap || "cơ sở thu mua"}
                </p>
                <p className="max-w-[56ch] text-xs leading-relaxed text-muted">
                  Bạn có thể nhắn tin hỏi giá hoặc gửi ảnh phế liệu thực tế ngay ở khung bên dưới,
                  hoặc bấm nút Lên đơn &amp; Đề xuất giá trực tiếp tại đây. Tin nhắn/đề xuất đầu
                  tiên sẽ tự động tạo đơn thương lượng lưu trên hệ thống (BR-NEG-01).
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
                  <button
                    type="button"
                    onClick={() => setIsProposalModalOpen(true)}
                    className="btn-primary h-10 px-4 text-xs font-semibold"
                  >
                    📋 Lên đơn &amp; Đề xuất giá ngay
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
                    👋 Hỏi giá thu mua hôm nay
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
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-4">
                <p className="text-base font-bold text-ink">
                  Tài khoản hiện tại chưa có đơn bàn giao nào để thương lượng
                </p>
                <p className="max-w-[54ch] text-xs leading-relaxed text-muted">
                  {isRecycler
                    ? "Khi người dân nhắn tin thương lượng hoặc tạo yêu cầu bàn giao gửi tới cơ sở của bạn, đơn và tin nhắn sẽ tự động xuất hiện tại đây."
                    : "Hãy tạo một yêu cầu bàn giao phế liệu mới hoặc chọn điểm thu gom trên bản đồ để bắt đầu nhắn tin hỏi giá và chốt đơn thời gian thực."}
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
            <div className="p-4 rounded-xl bg-amber-50 text-amber-800 text-sm border border-amber-200">
              {errorMsg}
            </div>
          ) : (
            <>
              <p className="self-center rounded-full bg-surface-2 px-3 py-1 text-center text-[11px] text-muted">
                Bắt đầu phiên trao đổi thương lượng
              </p>

              {(thread?.messages.items || []).map((m) => {
                const isMe =
                  Boolean(session?.id && m.senderUserId === session.id) ||
                  (role === "user" && m.senderRole === "Citizen") ||
                  (role === "recycler" && m.senderRole === "Recycler")

                // Tin nhắn hệ thống (System)
                if (m.messageType === "System") {
                  return (
                    <div key={m.id} className="flex justify-center my-2">
                      <div className="max-w-[85%] rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5 text-center text-xs text-emerald-800 font-medium">
                        {m.messageContent}
                      </div>
                    </div>
                  )
                }

                // Thẻ Đề Xuất Thương Lượng (Proposal Card)
                if (m.messageType === "Proposal" && m.proposal) {
                  const p = m.proposal
                  const isPending = p.proposalStatus === "Pending"
                  const isSuperseded = p.proposalStatus === "Superseded"
                  const isAccepted = p.proposalStatus === "Accepted"
                  const isRejected = p.proposalStatus === "Rejected"

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-2`}
                    >
                      <div
                        className={`w-full max-w-[420px] rounded-2xl p-4 border transition-all ${
                          isSuperseded
                            ? "bg-surface-2/60 border-line text-muted opacity-60 line-through-child"
                            : isAccepted
                              ? "bg-emerald-50/70 border-emerald-300 shadow-sm"
                              : isPending
                                ? "bg-amber-50/80 border-amber-300 shadow-md ring-1 ring-amber-200"
                                : "bg-red-50/60 border-red-200"
                        }`}
                      >
                        {/* Header Thẻ đề xuất */}
                        <div className="flex items-center justify-between border-b border-line/60 pb-2.5 mb-2.5">
                          <span className="font-bold text-xs flex items-center gap-1.5 text-ink">
                            📋 Bản đề xuất thương lượng
                          </span>
                          <span
                            className={`chip text-[11px] font-medium ${
                              isAccepted
                                ? "bg-emerald-100 text-emerald-800"
                                : isSuperseded
                                  ? "bg-gray-200 text-gray-600"
                                  : isPending
                                    ? "bg-amber-200 text-amber-900 animate-pulse"
                                    : "bg-red-100 text-red-800"
                            }`}
                          >
                            {isAccepted
                              ? "✓ Đã chấp thuận"
                              : isSuperseded
                                ? "Đã hết hiệu lực"
                                : isPending
                                  ? "Đang chờ phản hồi"
                                  : isRejected
                                    ? "Đã từ chối"
                                    : "Đã đóng"}
                          </span>
                        </div>

                        {/* Chi tiết đề xuất */}
                        <div className="grid grid-cols-2 gap-2 text-xs text-body mb-3">
                          <div className="bg-white/80 rounded-lg p-2 border border-line-soft">
                            <span className="text-[11px] text-muted block">Đơn giá đề xuất:</span>
                            <span className="font-bold text-brand-deep text-sm">
                              {p.proposedPricePerKg.toLocaleString("vi-VN")} đ/kg
                            </span>
                          </div>
                          <div className="bg-white/80 rounded-lg p-2 border border-line-soft">
                            <span className="text-[11px] text-muted block">Khối lượng:</span>
                            <span className="font-bold text-ink text-sm">
                              {p.proposedWeightKg} kg
                            </span>
                          </div>
                          <div className="col-span-2 bg-white/80 rounded-lg p-2 border border-line-soft">
                            <span className="text-[11px] text-muted block">Khung giờ hẹn thu gom:</span>
                            <span className="font-bold text-ink">
                              🕒 {p.proposedTimeSlot}
                            </span>
                          </div>
                          {(p.categoryCode || p.pickupAddress) && (
                            <div className="col-span-2 bg-white/80 rounded-lg p-2 border border-line-soft space-y-1">
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
                          <p className="text-xs text-body italic bg-white/60 p-2 rounded-lg mb-3">
                            "{p.note}"
                          </p>
                        )}

                        {/* Nút hành động nếu đang Pending */}
                        {isPending && (
                          <div className="pt-2 border-t border-line/60">
                            {!isMe ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleRespondProposal(m.id, true)}
                                  className="btn-primary h-8 px-3 text-xs flex-1 font-semibold"
                                >
                                  ✓ Chấp nhận đề nghị
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProposalPrice(p.proposedPricePerKg)
                                    setProposalWeight(p.proposedWeightKg)
                                    setProposalSlot(p.proposedTimeSlot)
                                    if (p.categoryCode) setProposalCategory(p.categoryCode)
                                    if (p.pickupAddress) setProposalAddress(p.pickupAddress)
                                    setIsProposalModalOpen(true)
                                  }}
                                  className="btn-outline h-8 px-2.5 text-xs text-ink"
                                  title="Gửi phản đề xuất với mức giá hoặc khung giờ khác"
                                >
                                  Đề xuất lại
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRespondProposal(m.id, false)}
                                  className="btn-ghost h-8 px-2 text-xs text-red-600"
                                >
                                  Từ chối
                                </button>
                              </div>
                            ) : (
                              <p className="text-[11px] text-amber-800 text-center font-medium">
                                ⏳ Đang chờ {partnerDisplayName} xem xét và phản hồi (BR-NEG-03)
                              </p>
                            )}
                          </div>
                        )}

                        {isSuperseded && (
                          <p className="text-[10px] text-muted text-center italic mt-1">
                            (Đề xuất này đã bị ghi đè bởi đề xuất mới hơn theo BR-NEG-03)
                          </p>
                        )}
                      </div>
                      <span className="mt-1 px-2 text-[10px] text-muted">
                        {m.senderName} • {new Date(m.sentAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )
                }

                // Tin nhắn Text hoặc Image thông thường
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-1`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-xs ${
                        isMe
                          ? "bg-brand text-white rounded-br-xs"
                          : "bg-surface-2 text-ink rounded-bl-xs border border-line"
                      }`}
                    >
                      {m.attachmentUrl && (
                        <div className="mb-2 overflow-hidden rounded-xl">
                          <img
                            src={m.attachmentUrl}
                            alt="Ảnh đính kèm"
                            onClick={() => setPreviewImageUrl(m.attachmentUrl || null)}
                            className="max-h-[220px] w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </div>
                      )}
                      {m.messageContent && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {m.messageContent}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 px-2 text-[10px] text-muted">
                      <span>{new Date(m.sentAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                      {isMe && <span>{m.isRead ? "✓✓ Đã xem" : "✓ Đã gửi"}</span>}
                    </div>
                  </div>
                )
              })}

              {/* Chỉ báo đang nhập */}
              {partnerTyping && (
                <div className="flex items-center gap-2 text-xs text-muted italic px-2 py-1 animate-pulse">
                  <span className="size-1.5 rounded-full bg-brand" />
                  <span>{partnerDisplayName} đang nhập tin nhắn...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 3. Thanh nhập tin nhắn và đính kèm */}
        <form
          onSubmit={handleSendMessage}
          className="flex items-center gap-2 border-t border-line bg-surface-1 px-4 py-3"
        >
          {/* Nút đính kèm ảnh R2 */}
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
            className="btn-ghost size-10 shrink-0 p-0 text-body hover:text-brand"
            title="Gửi ảnh chụp thực tế tình trạng phế liệu (Cloudflare R2)"
          >
            {uploadingImage ? "⏳" : "📷"}
          </button>

          {/* Nút gửi đề xuất nhanh hoặc lên đơn ngay trong chat nếu chưa khóa */}
          {canCompose && !thread?.isProposalLocked && (
            <button
              type="button"
              onClick={() => setIsProposalModalOpen(true)}
              className="btn-outline h-10 px-3 text-xs shrink-0 text-brand font-medium"
              title="Lên đơn hoặc đưa ra đề xuất điều chỉnh loại rác, điểm hẹn, đơn giá và khung giờ"
            >
              {currentOrderId && !isInquiryOrder ? "📋 Đề xuất giá" : "📋 Lên đơn & Đề xuất"}
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
                ? "Hãy chọn hoặc tạo một đơn bàn giao để bắt đầu trò chuyện..."
                : !currentOrderId && hasPartnerContext
                  ? `Nhắn tin hỏi giá hoặc hẹn giờ thu gom với ${partnerDisplayName}...`
                  : thread?.isProposalLocked
                    ? `Nhắn tin hỏi đường hoặc trao đổi địa điểm với ${partnerDisplayName}...`
                    : `Nhắn tin trao đổi với ${partnerDisplayName}...`
            }
            className="input h-10 flex-1 text-sm"
          />

          <button
            type="submit"
            disabled={!canCompose || !draft.trim() || sending}
            className="btn-primary h-10 shrink-0 px-5 text-sm"
          >
            {sending ? "Đang gửi..." : "Gửi"}
          </button>
        </form>
      </div>

      {/* 4. Điều hướng bước kế tiếp sau thương lượng */}
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5 bg-brand-light/30 border border-brand/20">
        <div>
          <p className="font-bold text-ink text-sm">
            {statusLower === "completed"
              ? "🎉 Giao dịch thu gom đã hoàn tất!"
              : statusLower === "awaitingconfirmation" || statusLower === "collected"
                ? "📄 Cơ sở thu gom đã phát hành biên nhận"
                : thread?.isProposalLocked
                  ? "✓ Lịch hẹn thu gom đã chốt chính thức!"
                  : "Thương lượng giá trước khi đối tác đến tận nơi"}
          </p>
          <p className="text-xs text-body mt-0.5 max-w-[70ch]">
            {statusLower === "completed"
              ? "Đơn hàng đã hoàn thành cân đo và thanh toán. Bạn có thể xem lại biên nhận, lịch sử giao dịch hoặc đánh giá sao."
              : statusLower === "awaitingconfirmation" || statusLower === "collected"
                ? "Người dân hãy kiểm tra khối lượng cân thực tế trên biên nhận và bấm xác nhận để nhận tiền & Điểm Xanh."
                : thread?.isProposalLocked
                  ? `Đối tác sẽ ghé vào khung giờ ${thread.confirmedTimeSlot || thread.proposedTimeSlot}. Sau khi cân thực tế tại điểm hẹn, đối tác sẽ lập biên nhận để hai bên chốt giao dịch.`
                  : "Khi hai bên đồng ý giá, loại phế liệu và khung giờ, hãy bấm 'Chấp nhận đề nghị' để hệ thống tự động khóa lịch hẹn vào đơn bàn giao."}
          </p>
        </div>

        <Link
          to={nextStepAction.to}
          className="btn-primary h-10 px-5 text-xs font-semibold shrink-0"
        >
          {nextStepAction.label}
        </Link>
      </div>

      {/* 5. Modal Đề Xuất Giá & Khung Giờ Mới */}
      {isProposalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="card w-full max-w-[480px] p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <h3 className="font-bold text-ink text-base">
                {currentOrderId && !isInquiryOrder
                  ? "⚡ Đề xuất giá & Khung giờ thu gom"
                  : "📋 Lên đơn & Đề xuất giá thu gom"}
              </h3>
              <button
                type="button"
                onClick={() => setIsProposalModalOpen(false)}
                className="btn-ghost size-8 p-0 text-muted hover:text-ink text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendProposal} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1">
                  Loại phế liệu thu gom:
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
                <label className="font-semibold text-ink block mb-1">
                  Đơn giá thu mua đề xuất (VNĐ/kg):
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
                  <span className="text-muted shrink-0">VNĐ / kg</span>
                </div>
                <div className="flex gap-2 mt-1.5">
                  {[6500, 7000, 7500, 8000].map((pr) => (
                    <button
                      key={pr}
                      type="button"
                      onClick={() => setProposalPrice(pr)}
                      className="chip bg-surface-2 hover:bg-brand/10 hover:text-brand text-[11px]"
                    >
                      {pr.toLocaleString("vi-VN")} đ
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">
                  Khối lượng ước tính (kg):
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

              <div>
                <label className="font-semibold text-ink block mb-1">
                  Khung giờ hẹn thu gom mong muốn:
                </label>
                <select
                  value={proposalSlot}
                  onChange={(e) => setProposalSlot(e.target.value)}
                  className="input h-10 text-sm"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">
                  Địa điểm thu gom / Điểm hẹn đầu ngõ:
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
                <label className="font-semibold text-ink block mb-1">
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

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line mt-2">
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

      {/* 6. Modal Phóng To Ảnh */}
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={previewImageUrl}
              alt="Ảnh phóng to"
              className="max-h-[85vh] w-auto rounded-xl object-contain shadow-2xl"
            />
            <p className="text-white text-center text-xs mt-2">Nhấp bất kỳ đâu để đóng</p>
          </div>
        </div>
      )}
    </div>
  )
}
