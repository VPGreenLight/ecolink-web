import { useEffect, useState } from "react"
import { CheckCircle2, Clock, Copy, QrCode, RefreshCw, X, Zap } from "lucide-react"
import {
  cancelPendingServiceOrder,
  getServiceOrderStatus,
  simulateVietQrTransfer,
  type PayInOrderDto,
} from "@/lib/servicePackageApi"

/** Modal thanh toán VietQR Động (EMVCo Napas 24/7) cho Citizen (U-16) và Recycler (R-07).
 *  Bao gồm đồng hồ đếm ngược 15 phút, polling 3 giây/lần, nút sao chép STK/nội dung CK,
 *  nút hủy đơn (STT 122) và các tùy chọn giả lập Demo (STT 119). */
export default function VietQrCheckoutModal({
  order,
  onClose,
  onOrderUpdated,
}: {
  order: PayInOrderDto | null
  onClose: () => void
  onOrderUpdated: (updated: PayInOrderDto) => void
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [secondsLeft, setSecondsLeft] = useState<number>(900)

  useEffect(() => {
    if (!order) return

    const calcRemaining = () => {
      const targetMs = new Date(order.expiresAt).getTime()
      const diffSec = Math.max(0, Math.floor((targetMs - Date.now()) / 1000))
      setSecondsLeft(diffSec)
    }

    calcRemaining()
    const timer = setInterval(calcRemaining, 1000)
    return () => clearInterval(timer)
  }, [order])

  useEffect(() => {
    if (!order || order.status.toUpperCase() !== "PENDING" || order.id.startsWith("demo-")) {
      return
    }

    const poller = setInterval(() => {
      void getServiceOrderStatus(order.orderCode)
        .then((res) => {
          if (res.data && res.data.status !== order.status) {
            onOrderUpdated(res.data)
          }
        })
        .catch(() => {
          // bỏ qua lỗi mạng nhất thời khi polling
        })
    }, 3000)

    return () => clearInterval(poller)
  }, [order, onOrderUpdated])

  if (!order) return null

  const statusUpper = order.status.toUpperCase()
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0")
  const secs = String(secondsLeft % 60).padStart(2, "0")
  const isPaid = statusUpper === "PAID"
  const isExpiredOrCancelled =
    statusUpper === "EXPIRED" || statusUpper === "CANCELLED" || (statusUpper === "PENDING" && secondsLeft <= 0)

  const handleCopy = (label: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text)
    }
    setCopiedKey(label)
    setTimeout(() => setCopiedKey(null), 1800)
  }

  const handleSimulate = async (scenario: "Exact" | "Underpaid" | "Overpaid") => {
    setBusyAction(scenario)
    setErrorMsg("")
    try {
      if (order.id.startsWith("demo-")) {
        if (scenario === "Underpaid") {
          onOrderUpdated({
            ...order,
            paidAmount: Math.max(1000, order.amount - 9000),
            reconciliationStatus: "Underpaid",
            anomalyType: "Underpaid",
            anomalyNote: `Khách chuyển thiếu ${Math.min(9000, order.amount).toLocaleString("vi-VN")} đ so với đơn gốc.`,
          })
          return
        }
        const paidAmt = scenario === "Overpaid" ? order.amount + 6000 : order.amount
        onOrderUpdated({
          ...order,
          status: "Paid",
          paidAmount: paidAmt,
          paidAt: new Date().toISOString(),
          reconciliationStatus: scenario === "Overpaid" ? "Overpaid" : "Matched",
          anomalyType: scenario === "Overpaid" ? "Overpaid" : "None",
          anomalyNote:
            scenario === "Overpaid"
              ? "Khách chuyển dư 6.000 đ — vẫn kích hoạt gói ngay & ghi nhận cần hoàn dư."
              : null,
        })
        return
      }
      const res = await simulateVietQrTransfer(order.orderCode, scenario)
      onOrderUpdated(res.data)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không thể giả lập chuyển khoản lúc này.")
    } finally {
      setBusyAction(null)
    }
  }

  const handleCancelOrder = async () => {
    setBusyAction("cancel")
    setErrorMsg("")
    try {
      if (order.id.startsWith("demo-")) {
        onOrderUpdated({
          ...order,
          status: "Cancelled",
        })
        return
      }
      const res = await cancelPendingServiceOrder(order.orderCode, "Người dùng hủy từ giao diện VietQR")
      onOrderUpdated(res.data)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không thể hủy đơn thanh toán lúc này.")
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Thanh toán VietQR đơn ${order.orderCode}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
    >
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-2xl md:p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng cửa sổ thanh toán"
          className="absolute top-4 right-4 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-5" />
        </button>

        <div className="pr-8">
          <p className="text-[11px] font-bold tracking-[0.12em] text-brand uppercase">
            CỔNG THANH TOÁN VIETQR ĐỘNG (NAPAS 24/7)
          </p>
          <h2 className="mt-1 text-lg font-bold text-ink">
            Thanh toán gói {order.packageName} · {order.orderCode}
          </h2>
        </div>

        {isPaid ? (
          <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-brand/25 bg-brand/6 p-6 text-center">
            <CheckCircle2 className="size-12 text-brand" />
            <h3 className="text-base font-bold text-brand-deep">
              Thanh toán dịch vụ của bạn đã được xác nhận thành công!
            </h3>
            <p className="text-sm text-body">
              Gói <b>{order.packageName}</b> ({order.durationDays} ngày) đã được kích hoạt tức thì cho tài khoản của bạn.
            </p>
            <button type="button" onClick={onClose} className="btn-primary mt-2 h-10 px-6 text-sm">
              Hoàn tất &amp; Quay lại
            </button>
          </div>
        ) : (
          <div className="mt-5 grid gap-5 md:grid-cols-[240px_1fr]">
            <div className="flex flex-col items-center rounded-xl border border-line bg-surface-2 p-4">
              {order.qrCodeUrl ? (
                <img
                  src={order.qrCodeUrl}
                  alt={`Mã VietQR cho đơn ${order.orderCode}`}
                  className="aspect-square w-full max-w-[208px] rounded-lg border border-line-soft bg-white object-contain p-1"
                />
              ) : (
                <div className="grid aspect-square w-48 place-items-center rounded-lg border border-dashed border-line bg-white text-muted">
                  <QrCode className="size-12" />
                </div>
              )}
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold">
                <Clock className="size-3.5 text-brand" />
                {isExpiredOrCancelled ? (
                  <span className="text-warn">
                    {statusUpper === "CANCELLED"
                      ? "Đơn đã hủy"
                      : "Mã thanh toán này đã hết hạn. Vui lòng tạo mã mới."}
                  </span>
                ) : (
                  <span className="tabular-nums text-ink">
                    Hết hạn sau: {mins}:{secs}
                  </span>
                )}
              </div>
              <p className="mt-1 text-center text-[11px] leading-4 text-muted">
                Quét mã VietQR này để hoàn tất thanh toán dịch vụ EcoLink.
              </p>
            </div>

            <div className="flex flex-col justify-between gap-4">
              <dl className="flex flex-col gap-2.5 text-sm">
                {[
                  { key: "bank", label: "Ngân hàng thụ hưởng", value: `${order.bankName} (${order.bankCode})`, copy: "" },
                  { key: "acc", label: "Số tài khoản", value: order.accountNo, copy: order.accountNo },
                  { key: "name", label: "Chủ tài khoản", value: order.accountName, copy: "" },
                  {
                    key: "amt",
                    label: "Số tiền chính xác",
                    value: `${order.amount.toLocaleString("vi-VN")} đ`,
                    copy: String(order.amount),
                  },
                  { key: "ref", label: "Nội dung chuyển khoản", value: order.transferContent, copy: order.transferContent },
                ].map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-2 border-b border-line-soft pb-2"
                  >
                    <dt className="text-xs text-muted">{row.label}</dt>
                    <dd className="flex items-center gap-1.5 font-semibold text-ink tabular-nums">
                      <span>{row.value}</span>
                      {row.copy && (
                        <button
                          type="button"
                          onClick={() => handleCopy(row.key, row.copy)}
                          className="rounded border border-line px-1.5 py-0.5 text-[11px] font-medium text-brand-deep hover:bg-surface-2"
                        >
                          {copiedKey === row.key ? "Đã chép" : <Copy className="inline size-3" />}
                        </button>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              {order.reconciliationStatus !== "Pending" && order.anomalyNote && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <b>Cảnh báo đối soát ({order.reconciliationStatus}):</b> {order.anomalyNote}
                </div>
              )}

              {errorMsg && <p className="text-xs font-medium text-warn">{errorMsg}</p>}

              <div className="flex flex-col gap-2.5 rounded-xl border border-dashed border-line bg-surface-2 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-muted uppercase">
                  <Zap className="size-3.5 text-brand" />
                  Khu vực Giả lập Webhook Demo (STT 119)
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!!busyAction || isExpiredOrCancelled}
                    onClick={() => void handleSimulate("Exact")}
                    className="btn-primary h-9 px-3.5 text-xs"
                  >
                    {busyAction === "Exact" ? "Đang xác nhận..." : "Giả lập chuyển khoản khớp lệnh"}
                  </button>
                  <button
                    type="button"
                    disabled={!!busyAction || isExpiredOrCancelled}
                    onClick={() => void handleSimulate("Underpaid")}
                    className="btn-ghost h-9 px-3 text-xs"
                    title="Kiểm thử kịch bản chuyển thiếu tiền cho Admin A-11 đối soát"
                  >
                    {busyAction === "Underpaid" ? "..." : "Thử lệch thiếu tiền"}
                  </button>
                  <button
                    type="button"
                    disabled={!!busyAction || isExpiredOrCancelled}
                    onClick={() => void handleSimulate("Overpaid")}
                    className="btn-ghost h-9 px-3 text-xs"
                    title="Kiểm thử kịch bản chuyển dư tiền cho Admin A-11 đối soát"
                  >
                    {busyAction === "Overpaid" ? "..." : "Thử lệch dư tiền"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (order.id.startsWith("demo-")) return
                    void getServiceOrderStatus(order.orderCode).then((r) => onOrderUpdated(r.data))
                  }}
                  className="btn-ghost inline-flex h-9 items-center gap-1.5 px-3 text-xs"
                >
                  <RefreshCw className="size-3.5" />
                  Kiểm tra giao dịch ngay
                </button>
                {statusUpper === "PENDING" && !isExpiredOrCancelled && (
                  <button
                    type="button"
                    disabled={!!busyAction}
                    onClick={() => void handleCancelOrder()}
                    className="text-xs font-semibold text-warn hover:underline"
                  >
                    Hủy mã đơn này
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
