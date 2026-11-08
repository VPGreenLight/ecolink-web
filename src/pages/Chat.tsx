import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import type * as signalR from "@microsoft/signalr"
import { PageHead } from "@/components/Portal"
import { ADDRESS } from "@/data/map"
import { TIME_SLOTS } from "@/data/handover"
import { useRole, useSession } from "@/lib/session"
import {
  acceptOrderInitialTerms,
  createNegotiationChatConnection,
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

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams()
  const session = useSession()
  const role = useRole() || "user"
  const orderIdParam = searchParams.get("orderId")
  const partnerFromMap = searchParams.get("partnerName")
  const addressFromMap = searchParams.get("partnerAddress")

  // Danh sách đơn để chuyển đổi
  const [availableOrders, setAvailableOrders] = useState<
    Array<{ id: string; displayCode: string; partner: string; slot: string; status: string }>
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

  // Modal đề xuất thương lượng
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false)
  const [proposalPrice, setProposalPrice] = useState<number>(7500)
  const [proposalWeight, setProposalWeight] = useState<number>(12.5)
  const [proposalSlot, setProposalSlot] = useState<string>(TIME_SLOTS[1])
  const [proposalNote, setProposalNote] = useState<string>("")
  const [submittingProposal, setSubmittingProposal] = useState(false)

  // Modal xem ảnh phóng to
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  const isRecycler = role === "recycler"

  // 1. Tải danh sách đơn thật của tài khoản đang đăng nhập từ PostgreSQL
  useEffect(() => {
    let active = true
    async function loadOrders() {
      try {
        const res = await fetchHandoverOrdersResult(isRecycler ? "recycler" : "user")
        if (!active) return

        setBackendConnected(res.fromBackend)
        const formatted = (res.orders || []).map((o) => {
          const rawId = o.id || ""
          const displayCode = o.displayCode || formatOrderDisplayCode(rawId)
          return {
            id: rawId,
            displayCode,
            partner: isRecycler
              ? o.citizenName || `Người dân (${displayCode})`
              : o.recycler || "Vựa thu mua EcoLink",
            slot: o.slot || "09:00 - 11:00",
            status: o.status || "pending",
          }
        })

        setAvailableOrders(formatted)
        setOrdersLoaded(true)

        if (!orderIdParam) {
          if (formatted.length > 0) {
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
  }, [role, isRecycler, orderIdParam, setSearchParams])

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
      setLoading(true)
      setErrorMsg(null)
      try {
        const data = await getOrderChatThread(currentOrderId)
        if (!active) return
        setThread(data)
        if (data.initialPricePerKg) {
          setProposalPrice(data.agreedPricePerKg || data.initialPricePerKg || 7500)
        }
        if (data.estimatedWeightKg) {
          setProposalWeight(data.estimatedWeightKg || 12.5)
        }
        if (data.proposedTimeSlot) {
          setProposalSlot(data.proposedTimeSlot)
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

  // 3. Khởi tạo kết nối thời gian thực SignalR Hub
  useEffect(() => {
    const hub = createNegotiationChatConnection({
      onReceiveMessage: (payload) => {
        if (payload.orderId === currentOrderId) {
          setThread((prev) => {
            if (!prev) return prev
            // Tránh trùng tin nhắn nếu đã có
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
          markMessagesAsRead(currentOrderId).catch(() => {})
        }
      },
      onProposalCreated: (payload) => {
        if (payload.orderId === currentOrderId) {
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
            return {
              ...prev,
              orderStatus: "Negotiating",
              activeProposal: payload.proposalMessage,
              messages: {
                ...prev.messages,
                items: [...updatedItems, payload.proposalMessage],
                totalRecords: prev.messages.totalRecords + 1,
              },
            }
          })
        }
      },
      onProposalResponded: (payload) => {
        if (payload.orderId === currentOrderId) {
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

            if (payload.result.systemMessage) {
              updatedItems.push(payload.result.systemMessage)
            }

            return {
              ...prev,
              orderStatus: payload.result.orderStatus,
              isProposalLocked: payload.result.isProposalLocked,
              agreedPricePerKg: payload.result.agreedPricePerKg ?? prev.agreedPricePerKg,
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
        if (payload.orderId === currentOrderId) {
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
        if (payload.orderId === currentOrderId) {
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
      onReconnecting: () => setConnectionStatus("reconnecting"),
      onReconnected: () => {
        setConnectionStatus("connected")
        if (hub && isGuid(currentOrderId)) {
          joinOrderChatRoom(hub, currentOrderId).catch(() => {})
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
        if (isGuid(currentOrderId)) {
          return joinOrderChatRoom(hub, currentOrderId).catch(() => {})
        }
      })
      .catch(() => {
        setConnectionStatus("disconnected")
      })

    return () => {
      if (isGuid(currentOrderId)) {
        leaveOrderChatRoom(hub, currentOrderId).catch(() => {})
      }
      hub.stop().catch(() => {})
      hubRef.current = null
    }
  }, [currentOrderId])

  // Gửi tin nhắn Text
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return

    setSending(true)
    try {
      const created = await sendChatMessage(currentOrderId, {
        messageType: "Text",
        messageContent: text,
      })
      setDraft("")
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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể gửi tin nhắn.")
    } finally {
      setSending(false)
    }
  }

  // Tải ảnh thực tế phế liệu lên R2 và gửi tin nhắn Image
  const handleSelectImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const uploaded = await uploadChatAttachment(currentOrderId, file)
      const created = await sendChatMessage(currentOrderId, {
        messageType: "Image",
        attachmentUrl: uploaded.attachmentUrl,
        messageContent: `Ảnh chụp phế liệu: ${file.name}`,
      })

      setThread((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          messages: {
            ...prev.messages,
            items: [...prev.messages.items, created],
            totalRecords: prev.messages.totalRecords + 1,
          },
        }
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : "Tải ảnh phế liệu thất bại.")
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Gửi đề xuất giá & khung giờ mới (BR-NEG-04)
  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (proposalPrice <= 0 || proposalWeight <= 0 || !proposalSlot) {
      alert("Vui lòng nhập đơn giá, khối lượng và khung giờ hợp lệ.")
      return
    }

    setSubmittingProposal(true)
    try {
      const createdProposal = await sendProposal(currentOrderId, {
        proposedPricePerKg: Number(proposalPrice),
        proposedWeightKg: Number(proposalWeight),
        proposedTimeSlot: proposalSlot,
        note: proposalNote.trim() || undefined,
      })

      setThread((prev) => {
        if (!prev) return prev
        // Chuyển proposal cũ sang Superseded
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
          activeProposal: createdProposal,
          messages: {
            ...prev.messages,
            items: [...items, createdProposal],
            totalRecords: items.length + 1,
          },
        }
      })
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

  const partnerDisplayName = !currentOrderId
    ? isRecycler
      ? "Chưa có đơn bàn giao"
      : partnerFromMap || "Chưa có đơn bàn giao"
    : isRecycler
      ? thread?.citizenName || "Người dân EcoLink"
      : thread?.facilityName || partnerFromMap || "Vựa phế liệu EcoGreen"
  const partnerAddress =
    thread?.pickupAddress || addressFromMap || (currentOrderId ? ADDRESS : "Chưa chọn điểm hẹn")
  const orderDisplayCode = currentOrderId
    ? formatOrderDisplayCode(currentOrderId)
    : "Chưa chọn đơn"

  // Tính tiền ước tính
  const activePrice = thread?.agreedPricePerKg || thread?.initialPricePerKg || 7000
  const activeWeight = thread?.estimatedWeightKg || 10
  const estimatedTotal = activePrice * activeWeight

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
                      prev.set("orderId", newId)
                      return prev
                    },
                    { replace: true },
                  )
                }}
                className="input h-9 text-xs py-1 px-2.5 max-w-[230px]"
              >
                {availableOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.displayCode} ({o.partner})
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

        {/* Thanh Điều Khoản Đang Thương Lượng / Đã Khóa */}
        {currentOrderId && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface-2/60 px-5 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <span className="text-muted block text-[11px]">Đơn giá thu mua:</span>
                <p className="font-bold text-ink text-sm">
                  {thread?.agreedPricePerKg ? (
                    <span className="text-brand">
                      {thread.agreedPricePerKg.toLocaleString("vi-VN")} đ/kg{" "}
                      <span className="text-[11px] font-normal text-muted">(Đã chốt)</span>
                    </span>
                  ) : (
                    <span>
                      {(thread?.initialPricePerKg ?? 7000).toLocaleString("vi-VN")} đ/kg
                      {thread?.activeProposal?.proposal?.proposedPricePerKg && (
                        <span className="ml-1 text-amber-600 font-semibold">
                          → {thread.activeProposal.proposal.proposedPricePerKg.toLocaleString("vi-VN")} đ
                        </span>
                      )}
                    </span>
                  )}
                </p>
              </div>

              <div>
                <span className="text-muted block text-[11px]">Khối lượng ước tính:</span>
                <p className="font-bold text-ink text-sm">
                  {activeWeight} kg
                </p>
              </div>

              <div>
                <span className="text-muted block text-[11px]">Khung giờ hẹn thu gom:</span>
                <p className="font-bold text-ink text-sm flex items-center gap-1">
                  {thread?.confirmedTimeSlot ? (
                    <span className="text-brand">
                      🔒 {thread.confirmedTimeSlot}
                    </span>
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
        )}

        {/* 2. Cuộc hội thoại tin nhắn */}
        <div className="flex h-[480px] flex-col gap-3 overflow-y-auto p-5 bg-surface-1">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              Đang tải lịch sử thương lượng...
            </div>
          ) : !currentOrderId && ordersLoaded && backendConnected ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-4">
              <p className="text-base font-bold text-ink">
                Tài khoản hiện tại chưa có đơn bàn giao nào để thương lượng
              </p>
              <p className="max-w-[52ch] text-xs leading-relaxed text-muted">
                {isRecycler
                  ? "Khi người dân tạo yêu cầu bàn giao gửi tới cơ sở của bạn trên hệ thống, đơn sẽ tự động xuất hiện tại đây và tại mục Yêu cầu bàn giao."
                  : "Hãy tạo một yêu cầu bàn giao phế liệu mới hoặc chọn điểm thu gom trên bản đồ để bắt đầu thương lượng giá và khung giờ thời gian thực."}
              </p>
              <Link
                to={isRecycler ? "/recycler/requests" : "/user/handover"}
                className="btn-primary h-10 px-5 text-xs font-semibold"
              >
                {isRecycler ? "Đi tới Tiếp nhận yêu cầu" : "Tạo yêu cầu bàn giao mới"}
              </Link>
            </div>
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
            disabled={!currentOrderId || uploadingImage}
            onClick={() => fileInputRef.current?.click()}
            className="btn-ghost size-10 shrink-0 p-0 text-body hover:text-brand"
            title="Gửi ảnh chụp thực tế tình trạng phế liệu (Cloudflare R2)"
          >
            {uploadingImage ? "⏳" : "📷"}
          </button>

          {/* Nút gửi đề xuất nhanh nếu chưa khóa */}
          {currentOrderId && !thread?.isProposalLocked && (
            <button
              type="button"
              onClick={() => setIsProposalModalOpen(true)}
              className="btn-outline h-10 px-3 text-xs shrink-0 text-brand font-medium"
              title="Đưa ra đề xuất điều chỉnh đơn giá hoặc khung giờ thu gom"
            >
              📋 Đề xuất giá
            </button>
          )}

          <input
            value={draft}
            disabled={!currentOrderId}
            onChange={(e) => {
              const val = e.target.value
              setDraft(val)
              if (hubRef.current && currentOrderId) {
                sendTypingIndicator(hubRef.current, currentOrderId, true).catch(() => {})
              }
            }}
            placeholder={
              !currentOrderId
                ? "Hãy chọn hoặc tạo một đơn bàn giao để bắt đầu trò chuyện..."
                : thread?.isProposalLocked
                  ? `Nhắn tin hỏi đường hoặc trao đổi địa điểm với ${partnerDisplayName}...`
                  : `Nhắn tin trao đổi với ${partnerDisplayName}...`
            }
            className="input h-10 flex-1 text-sm"
          />

          <button
            type="submit"
            disabled={!currentOrderId || !draft.trim() || sending}
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
            {thread?.isProposalLocked
              ? "✓ Lịch hẹn thu gom đã chốt chính thức!"
              : "Thương lượng giá trước khi đối tác đến tận nơi"}
          </p>
          <p className="text-xs text-body mt-0.5 max-w-[70ch]">
            {thread?.isProposalLocked
              ? `Đối tác sẽ ghé vào khung giờ ${thread.confirmedTimeSlot || thread.proposedTimeSlot}. Tiền sẽ được giải ngân ngay khi hai bên cân thực tế và quét mã QR biên nhận.`
              : "Khi hai bên đồng ý giá và khung giờ, hãy bấm 'Chấp nhận đề nghị' để hệ thống tự động khóa lịch hẹn vào đơn bàn giao."}
          </p>
        </div>

        <Link
          to={isRecycler ? "/recycler/requests" : "/user/handover"}
          className="btn-primary h-10 px-5 text-xs font-semibold shrink-0"
        >
          {isRecycler ? "Xem danh sách đơn thu gom" : "Tạo yêu cầu bàn giao"}
        </Link>
      </div>

      {/* 5. Modal Đề Xuất Giá & Khung Giờ Mới */}
      {isProposalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="card w-full max-w-[480px] p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <h3 className="font-bold text-ink text-base">
                ⚡ Đề xuất giá &amp; Khung giờ thu gom
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
