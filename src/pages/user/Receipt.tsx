import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import { INCOMING, STATUS_LABEL, TONE, calc, type Handover } from "@/data/handover"
import { VND, WASTES } from "@/data/waste"
import { ApiError } from "@/lib/api"
import {
  confirmHandoverReceipt,
  disputeHandoverReceipt,
  fetchHandoverOrdersResult,
  fetchUserHandoverDetail,
  fetchUserHandoverRequestsList,
  fetchUserReceipt,
  findCachedHandoverOrder,
  formatOrderDisplayCode,
  type ReceiptDto,
} from "@/lib/recyclerWorkflowApi"
import {
  createHandoverReview,
  deleteMyReview,
  fetchMyReviews,
  uploadComplaintEvidence,
  type TransactionReviewDto,
} from "@/lib/reviewComplaintApi"
import { getAccessToken, hasLiveBackendAuth } from "@/lib/session"

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0
const nameOf = (id: string) => WASTES.find((w) => w.id === id)?.name ?? id

type ReceiptCandidate = {
  id: string
  displayCode: string
  label: string
  priority: number
}

type ActualLineView = {
  wasteId: string
  wasteName?: string
  estimatedKg?: number
  kg: number
  unitPrice?: number
}

/** U-10 Xác nhận biên nhận bàn giao + U-11 Đánh giá cơ sở thu mua.
 *
 *  Gộp: U-11 chỉ mở được sau khi U-10 xong, nên tách hai trang thì người
 *  dùng phải tự nhớ quay lại. Ở đây chỉ khi xác nhận xong mới hiện phần đánh
 *  giá — đúng luật "Mở khi hoàn tất giao dịch". */
export default function Receipt() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const orderId = searchParams.get("orderId")
  const liveAuth = hasLiveBackendAuth()

  const defaultHandover = INCOMING.find((x) => x.status === "collected") || INCOMING[0]
  const [loadingOrder, setLoadingOrder] = useState<boolean>(() => liveAuth)
  const [candidates, setCandidates] = useState<ReceiptCandidate[]>([])
  const [orderUnitPrice, setOrderUnitPrice] = useState<number | undefined>(undefined)
  const [h, setH] = useState<Handover | null>(() => {
    if (orderId) {
      const cached = findCachedHandoverOrder(orderId)
      if (cached) {
        return {
          id: cached.id,
          displayCode: cached.displayCode,
          recycler: cached.recycler,
          address: cached.address,
          date: cached.date,
          slot: cached.slot,
          lines: cached.lines,
          status: cached.status,
          reason: cached.reason,
        }
      }
    }
    return liveAuth ? null : defaultHandover
  })

  const [actual, setActual] = useState<ActualLineView[]>(() =>
    (h?.lines ?? []).map((l) => ({ wasteId: l.wasteId, estimatedKg: l.kg, kg: l.kg })),
  )
  const [confirmed, setConfirmed] = useState(false)
  const [disputed, setDisputed] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [stars, setStars] = useState(0)
  const [note, setNote] = useState("")
  const [submittedReview, setSubmittedReview] = useState<TransactionReviewDto | null>(null)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [disputeReason, setDisputeReason] = useState("")
  const [disputeFiles, setDisputeFiles] = useState<File[]>([])
  const [receiptInfo, setReceiptInfo] = useState<ReceiptDto | null>(null)
  const [flashMessage, setFlashMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function loadData() {
      setLoadingOrder(true)
      setConfirmed(false)
      setDisputed(false)
      setReceiptInfo(null)
      setFlashMessage(null)

      try {
        const [ordersRes, handoversRes] = await Promise.all([
          fetchHandoverOrdersResult("user"),
          fetchUserHandoverRequestsList(),
        ])
        if (!active) return

        const candidateMap = new Map<string, ReceiptCandidate>()
        for (const hr of handoversRes.items) {
          const st = (hr.status || "").toLowerCase()
          const isAwaiting = st === "awaitingconfirmation" || (hr.hasReceipt && st !== "completed" && st !== "disputed")
          const isCompletedOrDisputed = st === "completed" || st === "disputed"
          if (isAwaiting || isCompletedOrDisputed) {
            const statusText = isAwaiting
              ? "Chờ xác nhận"
              : st === "disputed"
                ? "Đang khiếu nại"
                : "Hoàn tất"
            candidateMap.set(hr.id, {
              id: hr.id,
              displayCode: hr.requestCode || formatOrderDisplayCode(hr.id),
              label: `${hr.requestCode || formatOrderDisplayCode(hr.id)} · ${hr.recycler?.name || "Cơ sở thu mua"} (${statusText})`,
              priority: isAwaiting ? 0 : 1,
            })
          }
        }

        for (const o of ordersRes.orders) {
          if (o.status === "collected" || o.status === "done" || o.rawStatus?.toLowerCase() === "disputed") {
            if (!candidateMap.has(o.id)) {
              const isAwaiting = o.status === "collected"
              const statusText = isAwaiting
                ? "Chờ xác nhận"
                : o.rawStatus?.toLowerCase() === "disputed"
                  ? "Đang khiếu nại"
                  : "Hoàn tất"
              candidateMap.set(o.id, {
                id: o.id,
                displayCode: o.displayCode,
                label: `${o.displayCode} · ${o.recycler} (${statusText})`,
                priority: isAwaiting ? 0 : 1,
              })
            }
          }
        }

        const sortedCandidates = Array.from(candidateMap.values()).sort(
          (a, b) => a.priority - b.priority,
        )
        setCandidates(sortedCandidates)

        const found = orderId
          ? ordersRes.orders.find((o) => o.id === orderId || o.displayCode === orderId)
          : (sortedCandidates[0]
              ? ordersRes.orders.find((o) => o.id === sortedCandidates[0].id)
              : undefined) ||
            ordersRes.orders.find((o) => o.status === "collected" || o.status === "done")

        const targetId = found?.id || orderId || sortedCandidates[0]?.id

        if (getAccessToken() && targetId) {
          try {
            const myRevs = await fetchMyReviews(1, 50)
            if (active && myRevs.success) {
              const matched = myRevs.data.items.find((rv) => rv.requestId === targetId)
              if (matched) setSubmittedReview(matched)
              else setSubmittedReview(null)
            }
          } catch {
            // bỏ qua nếu chưa đăng nhập hoặc offline
          }
        }

        const [r, detail] = targetId
          ? await Promise.all([fetchUserReceipt(targetId), fetchUserHandoverDetail(targetId)])
          : [null, null]
        if (!active) return

        if (r) {
          setReceiptInfo(r)
          if (r.confirmedByUserAt || r.requestStatus === "Completed") {
            setConfirmed(true)
          }
          if (r.requestStatus === "Disputed") {
            setDisputed(true)
          }
          if (Array.isArray(r.lines) && r.lines.length > 0) {
            setActual(
              r.lines.map((l) => ({
                wasteId: l.wasteCategoryCode || l.wasteCategoryId || "plastic",
                wasteName: l.wasteCategoryName,
                estimatedKg: l.estimatedWeightKg,
                kg: l.actualWeightKg,
                unitPrice: l.unitPricePerKg,
              })),
            )
          }
        }

        if (found) {
          setOrderUnitPrice(found.agreedPricePerKg ?? found.initialPricePerKg)
          setH({
            id: found.id,
            displayCode: found.displayCode,
            recycler: detail?.recycler?.name || found.recycler,
            address: detail?.pickupAddress || found.address,
            date: found.date,
            slot: found.slot,
            lines: found.lines,
            status:
              r?.requestStatus === "Completed"
                ? "done"
                : r
                  ? "collected"
                  : found.status,
            reason: found.reason,
          })
          if (!r) {
            if (detail && detail.items.length > 0) {
              setActual(
                detail.items.map((it) => ({
                  wasteId: it.wasteCategoryCode || it.wasteCategoryId,
                  wasteName: it.wasteCategoryName,
                  estimatedKg: it.estimatedWeightKg,
                  kg: it.actualWeightKg ?? it.estimatedWeightKg,
                  unitPrice: it.agreedPricePerKg ?? undefined,
                })),
              )
            } else {
              setActual(found.lines.map((l) => ({ wasteId: l.wasteId, estimatedKg: l.kg, kg: l.kg })))
            }
          }
        } else if (!ordersRes.fromBackend && !liveAuth) {
          setH(defaultHandover)
          setActual(defaultHandover.lines.map((l) => ({ wasteId: l.wasteId, estimatedKg: l.kg, kg: l.kg })))
        } else if (r) {
          setH({
            id: r.requestId,
            displayCode: r.requestCode || formatOrderDisplayCode(r.requestId),
            recycler: r.recycler?.name || detail?.recycler?.name || "Cơ sở thu mua EcoLink",
            address: r.requester?.address || r.recycler?.address || detail?.pickupAddress || "Điểm hẹn bàn giao",
            date: r.createdAt ? new Date(r.createdAt).toLocaleDateString("vi-VN") : "Hôm nay",
            slot: "Theo biên nhận",
            lines: r.lines.map((l) => ({
              wasteId: l.wasteCategoryCode || l.wasteCategoryId || "pet",
              kg: l.estimatedWeightKg,
            })),
            status: r.requestStatus === "Completed" ? "done" : "collected",
          })
        } else {
          setH(null)
        }
      } finally {
        if (active) setLoadingOrder(false)
      }
    }
    void loadData()
    return () => {
      active = false
    }
  }, [orderId, liveAuth])

  const rowPriceOf = (line: ActualLineView, index?: number) => {
    if (typeof line.unitPrice === "number" && line.unitPrice > 0) {
      return line.unitPrice
    }
    if (receiptInfo && typeof index === "number" && receiptInfo.lines[index]?.unitPricePerKg > 0) {
      return receiptInfo.lines[index].unitPricePerKg
    }
    if (orderUnitPrice && orderUnitPrice > 0 && (!index || index === 0)) {
      return orderUnitPrice
    }
    return priceOf(line.wasteId)
  }

  const baseHandover = h ?? defaultHandover
  const totalActualGross = receiptInfo
    ? receiptInfo.totalAmountCash
    : actual.reduce((s, l, i) => s + l.kg * rowPriceOf(l, i), 0)
  const money = receiptInfo
    ? { gross: totalActualGross, fee: 0, net: totalActualGross, rate: 0 }
    : calc({ ...baseHandover, actual }, (id) => priceOf(id))
  const differs = actual.some((a, i) => a.kg !== (a.estimatedKg ?? baseHandover.lines[i]?.kg))

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!h) return
    setProcessing(true)
    setFlashMessage(null)
    try {
      const res = await confirmHandoverReceipt(h.id)
      if (res.receipt) {
        setReceiptInfo(res.receipt)
      }
      setConfirmed(true)
      setH((prev) => (prev ? { ...prev, status: "done" } : prev))
      setFlashMessage(
        res.syncedWithBackend
          ? `Đã xác nhận biên nhận #${res.receipt?.receiptCode || h.displayCode} thành công (đã cộng Điểm Xanh và hoàn tất giao dịch trên PostgreSQL).`
          : "Đã xác nhận khối lượng bàn giao (chế độ dự phòng ngoại tuyến).",
      )
    } catch (err) {
      setFlashMessage(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Không thể xác nhận biên nhận. Vui lòng thử lại.",
      )
    } finally {
      setProcessing(false)
    }
  }

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!h) return
    const clean = disputeReason.trim()
    if (clean.length < 10) {
      setFlashMessage("Vui lòng nhập lý do khiếu nại tối thiểu 10 ký tự.")
      return
    }

    setProcessing(true)
    try {
      const uploadedUrls: string[] = []
      for (const file of disputeFiles.slice(0, 5)) {
        try {
          const up = await uploadComplaintEvidence(file)
          if (up.data?.fileUrl) uploadedUrls.push(up.data.fileUrl)
        } catch {
          // bỏ qua ảnh lỗi nếu chạy offline
        }
      }
      const res = await disputeHandoverReceipt(h.id, clean, uploadedUrls)
      setDisputed(true)
      setShowDisputeForm(false)
      setFlashMessage(
        res.syncedWithBackend
          ? "Khiếu nại biên nhận và bằng chứng ảnh đã được chuyển tới hàng đợi trọng tài Staff."
          : "Khiếu nại đã được ghi nhận (chế độ dự phòng ngoại tuyến).",
      )
    } catch (err) {
      setFlashMessage(err instanceof ApiError ? err.message : "Không thể gửi khiếu nại biên nhận.")
    } finally {
      setProcessing(false)
    }
  }

  const handleSubmitReview = async () => {
    if (!h || stars < 1 || stars > 5) return
    setReviewBusy(true)
    try {
      const res = await createHandoverReview(h.id, {
        ratingStars: stars,
        comment: note.trim() || undefined,
      })
      setSubmittedReview(res.data)
      setFlashMessage(
        res.message || "Cảm ơn bạn đã đánh giá! Điểm uy tín của cơ sở thu mua đã được cập nhật.",
      )
    } catch (err) {
      if (err instanceof ApiError && !err.isNetworkError) {
        setFlashMessage(err.message)
      } else {
        setSubmittedReview({
          reviewId: `local-${Date.now()}`,
          requestId: h.id,
          reviewerId: "local",
          reviewerDisplayName: "Bạn",
          recyclerId: "local",
          facilityName: h.recycler,
          ratingStars: stars,
          comment: note.trim() || null,
          status: "Visible",
          reportCount: 0,
          createdAt: new Date().toISOString(),
        })
        setFlashMessage("Đã lưu đánh giá sao (chế độ dự phòng ngoại tuyến).")
      }
    } finally {
      setReviewBusy(false)
    }
  }

  const handleDeleteReview = async () => {
    if (!submittedReview) return
    setReviewBusy(true)
    try {
      if (!submittedReview.reviewId.startsWith("local-")) {
        const res = await deleteMyReview(submittedReview.reviewId)
        setFlashMessage(res.message || "Đã xóa vĩnh viễn bài đánh giá của bạn.")
      } else {
        setFlashMessage("Đã xóa bài đánh giá cục bộ.")
      }
      setSubmittedReview(null)
      setStars(0)
      setNote("")
    } catch (err) {
      setFlashMessage(err instanceof ApiError ? err.message : "Không thể xóa đánh giá.")
    } finally {
      setReviewBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="BIÊN NHẬN"
        title="Xác nhận bàn giao rác"
        body="Đối chiếu khối lượng người thu gom cân tại chỗ với những gì bạn bỏ ra. Biên nhận được lưu trữ trên hệ thống để hai bên đối chiếu giao dịch trực tiếp và cộng Điểm Xanh."
      />

      {candidates.length > 1 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <span className="text-xs font-semibold text-ink">
            Chọn biên nhận ({candidates.length} đơn):
          </span>
          <select
            className="input h-9 max-w-md text-xs"
            value={h?.id ?? ""}
            onChange={(e) => {
              const nextId = e.target.value
              if (nextId) navigate(`/user/receipt?orderId=${encodeURIComponent(nextId)}`)
            }}
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {flashMessage && (
        <div className="rounded-xl border border-brand/30 bg-mint/15 px-4 py-3 text-sm font-medium text-brand-deep">
          {flashMessage}
        </div>
      )}

      {receiptInfo?.hasDeviationWarning && (
        <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink">
          <p className="font-semibold text-warn">Cảnh báo chênh lệch khối lượng:</p>
          <p className="mt-0.5 text-body">
            {receiptInfo.deviationMessage ||
              `Khối lượng thực tế lệch ${receiptInfo.deviationPercent}% so với ước tính ban đầu.`}
          </p>
        </div>
      )}

      {loadingOrder ? (
        <p className="card px-5 py-8 text-center text-sm text-muted">
          Đang tải thông tin biên nhận...
        </p>
      ) : !h ? (
        <div className="card flex flex-col items-center gap-3 px-5 py-10 text-center">
          <p className="text-sm font-semibold text-ink">
            Chưa có biên nhận thu gom nào đang chờ xác nhận.
          </p>
          <p className="max-w-[52ch] text-xs text-muted">
            Khi cơ sở thu gom đến cân thực tế và phát hành biên nhận, bạn có thể bấm vào nút
            &quot;Xác nhận biên nhận&quot; từ trang Yêu cầu thu gom hoặc khung Chat.
          </p>
          <Link to="/user/handover" className="btn-primary h-10 px-5 text-xs font-semibold">
            Quay lại Yêu cầu thu gom
          </Link>
        </div>
      ) : (
      <form onSubmit={confirm} className="card flex flex-col gap-5 p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-soft pb-4">
          <div>
            <p className="font-bold text-ink">{h.recycler}</p>
            <p className="mt-0.5 text-[13px] text-muted">
              {h.displayCode || h.id} · {h.date} · {h.slot} · {h.address}
            </p>
            {receiptInfo?.receiptCode && (
              <p className="mt-1 text-xs font-semibold text-brand-deep">
                Mã biên nhận: #{receiptInfo.receiptCode} · Điểm Xanh dự kiến: +{receiptInfo.points} điểm
              </p>
            )}
          </div>
          <Status tone={TONE[h.status]}>{STATUS_LABEL[h.status]}</Status>
        </div>

        <Table head={["Loại rác", "Bạn bỏ ra", "Người thu gom cân", "Thành tiền"]}>
          {actual.map((a, i) => (
            <tr key={`${a.wasteId}-${i}`}>
              <Td className="font-semibold text-ink">{a.wasteName || nameOf(a.wasteId)}</Td>
              <Td className="tabular-nums text-muted">{a.estimatedKg ?? h.lines[i]?.kg ?? 0} kg</Td>
              <Td>
                <input
                  className="input h-9 w-28 tabular-nums"
                  type="number"
                  min={0}
                  step={0.1}
                  aria-label={`Khối lượng thực tế ${a.wasteName || nameOf(a.wasteId)}`}
                  value={a.kg}
                  disabled={confirmed || disputed || processing}
                  onChange={(e) =>
                    setActual((rs) =>
                      rs.map((r, n) =>
                        n === i ? { ...r, kg: Number(e.target.value) } : r,
                      ),
                    )
                  }
                />
              </Td>
              <Td className="tabular-nums font-semibold text-ink">
                {VND(a.kg * rowPriceOf(a, i))}
              </Td>
            </tr>
          ))}
          <tr>
            <Td className="font-bold text-ink">Tổng</Td>
            <Td className="tabular-nums text-muted">
              {actual.reduce((s, a, i) => s + (a.estimatedKg ?? h.lines[i]?.kg ?? 0), 0)} kg
            </Td>
            <Td className="tabular-nums font-bold text-ink">
              {actual.reduce((s, a) => s + a.kg, 0)} kg
            </Td>
            <Td className="tabular-nums font-bold text-brand">
              {VND(money.gross)}
            </Td>
          </tr>
        </Table>

        {receiptInfo?.scaleProofPhotoUrls && receiptInfo.scaleProofPhotoUrls.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink">
              Ảnh bàn giao &amp; bằng chứng cân từ cơ sở thu gom ({receiptInfo.scaleProofPhotoUrls.length} ảnh)
            </span>
            <div className="flex flex-wrap gap-3">
              {receiptInfo.scaleProofPhotoUrls.map((url, idx) => (
                <a
                  key={`${url}-${idx}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block size-20 overflow-hidden rounded-lg border border-line bg-surface-2"
                  title={`Xem ảnh bằng chứng cân #${idx + 1}`}
                >
                  <img
                    src={url}
                    alt={`Bằng chứng cân #${idx + 1}`}
                    className="size-full object-cover"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {differs && !confirmed && !disputed && (
          <p className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-[13px] leading-5 text-body">
            Khối lượng bạn xác nhận khác với ước tính ban đầu — không sao, đó là bình
            thường vì người thu gom cân thực tế. Số tiền được tính trên khối lượng
            bạn nhập ở trên.
          </p>
        )}

        <div className="flex flex-wrap gap-4 border-t border-line-soft pt-4">
          <button
            type="submit"
            disabled={confirmed || disputed || processing}
            className="btn-primary h-11 px-6"
          >
            {processing
              ? "Đang xử lý..."
              : confirmed
                ? "Đã xác nhận"
                : "Xác nhận khối lượng này"}
          </button>
          {!confirmed && !disputed && (
            <button
              type="button"
              disabled={processing}
              onClick={() => setShowDisputeForm((v) => !v)}
              className="btn-ghost h-11 px-5"
            >
              Sai rồi, tôi muốn khiếu nại
            </button>
          )}
          {disputed && (
            <span className="rounded-full bg-warn/15 px-3 py-1.5 text-xs font-semibold text-warn">
              Đơn đang được khiếu nại
            </span>
          )}
          {!confirmed && !disputed && (
            <p className="self-center text-[13px] text-muted">
              Xác nhận để lưu biên nhận đối chiếu và ghi nhận Điểm Xanh cho giao dịch này.
            </p>
          )}
        </div>
      </form>
      )}

      {h && showDisputeForm && !confirmed && !disputed && (
        <form onSubmit={(e) => void handleDisputeSubmit(e)} className="card flex flex-col gap-4 border-warn/40 p-5 md:p-6">
          <h2 className="text-base font-bold text-ink">
            Gửi khiếu nại sai lệch biên nhận (U-11)
          </h2>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Lý do sai lệch khối lượng / thanh toán
            <textarea
              className="input h-auto resize-y py-2.5 leading-6"
              rows={3}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Ví dụ: Đồng hồ cân tại điểm thu mua hiển thị 12.5 kg nhưng biên nhận chỉ ghi 9.0 kg."
            />
          </label>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">
              Ảnh bằng chứng mặt cân / biên lai (tùy chọn, tối đa 5 ảnh)
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setDisputeFiles(Array.from(e.target.files ?? []).slice(0, 5))}
              className="text-xs text-muted"
            />
            {disputeFiles.length > 0 && (
              <p className="text-xs text-brand-deep">Đã chọn {disputeFiles.length} ảnh bằng chứng.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={processing} className="btn-primary h-10 px-5 text-sm">
              {processing ? "Đang gửi..." : "Gửi phiếu khiếu nại"}
            </button>
            <button type="button" onClick={() => setShowDisputeForm(false)} className="btn-ghost h-10 px-4 text-sm">
              Hủy
            </button>
          </div>
        </form>
      )}

      {h && confirmed && (
        <section className="card flex flex-col gap-4 p-5 md:p-6">
          <h2 className="text-base font-bold text-ink">
            Đánh giá {h.recycler}
          </h2>
          <p className="text-sm text-muted">
            Điểm của bạn quyết định cơ sở này có được đề xuất cho khu vực của bạn
            không (mỗi đơn chỉ gửi 1 lần trong 14 ngày; không chỉnh sửa sau khi đăng).
          </p>

          {submittedReview ? (
            <div className="rounded-xl border border-brand/25 bg-surface-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-bold text-brand-deep">
                  {"★".repeat(submittedReview.ratingStars)}
                  {"☆".repeat(Math.max(0, 5 - submittedReview.ratingStars))} ({submittedReview.ratingStars}/5 sao)
                </span>
                <span className="chip bg-white text-xs text-muted">
                  Trạng thái: {submittedReview.status}
                </span>
              </div>
              {submittedReview.comment && (
                <p className="mt-2 text-sm text-body">{submittedReview.comment}</p>
              )}
              {typeof submittedReview.updatedRecyclerAverageRating === "number" && (
                <p className="mt-2 text-xs text-muted">
                  Điểm uy tín mới của cơ sở: {submittedReview.updatedRecyclerAverageRating.toFixed(2)}★ ({submittedReview.updatedRecyclerTotalReviews ?? 1} đánh giá)
                </p>
              )}
              <div className="mt-3">
                <button
                  type="button"
                  disabled={reviewBusy}
                  onClick={() => void handleDeleteReview()}
                  className="btn-ghost h-9 px-3.5 text-xs text-warn"
                >
                  {reviewBusy ? "Đang xóa..." : "Tự xóa vĩnh viễn đánh giá này"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                role="radiogroup"
                aria-label="Chấm điểm"
                className="flex items-center gap-1.5"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={stars === n}
                    aria-label={`${n} sao`}
                    onClick={() => setStars(n)}
                    className={`grid size-11 place-items-center rounded-lg border text-lg transition-colors ${
                      n <= stars
                        ? "border-brand bg-brand/12 text-brand"
                        : "border-line bg-surface text-muted hover:bg-surface-2"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>

              <textarea
                className="input h-auto resize-y py-3 leading-6"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi lại điều gì tốt, hoặc điều gì nên sửa. Cụ thể thì cơ sở sửa được."
              />

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  disabled={stars === 0 || reviewBusy}
                  onClick={() => void handleSubmitReview()}
                  className="btn-primary h-11 px-6"
                >
                  {reviewBusy ? "Đang gửi..." : "Gửi đánh giá"}
                </button>
                {stars > 0 && (
                  <p className="text-[13px] text-muted">
                    {stars === 5
                      ? "Cảm ơn bạn, đánh giá này giúp khu vực của bạn."
                      : "Cảm ơn bạn, chúng tôi sẽ xem lại điểm thấp."}
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
