import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { PageHead, RequiredMark, Table, TableSkeleton, Td } from "@/components/Portal"
import { INCOMING, type Handover } from "@/data/handover"
import { VND, WASTES } from "@/data/waste"
import { ApiError } from "@/lib/api"
import { initApiLoading, initApiState } from "@/lib/hydration"
import {
  createHandoverReceipt,
  fetchHandoverOrdersResult,
  fetchRecyclerHandoverDetail,
  fetchRecyclerReceipt,
  findCachedHandoverOrder,
  formatOrderDisplayCode,
  uploadReceiptProofPhoto,
  type CreateReceiptRequest,
  type SyncedHandoverOrder,
} from "@/lib/recyclerWorkflowApi"
import { hasLiveBackendAuth } from "@/lib/session"

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0
const nameOf = (id: string) => WASTES.find((w) => w.id === id)?.name ?? id
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ReceiptFormRow = {
  itemId?: string
  wasteCategoryId?: string
  wasteId: string
  wasteName?: string
  estimatedKg: number
  kg: number
  unitPrice?: number
}

/** R-06 Tạo biên nhận bàn giao.
 *
 *  Nhập khối lượng thực cân tại chỗ và tải ảnh bằng chứng cân đo lên Cloudflare R2.
 *  Hệ thống chỉ hỗ trợ lưu trữ biên nhận để hai bên đối chiếu và ghi nhận Điểm Xanh
 *  sau khi người dân xác nhận (BR-HND-05), không thu phí nền tảng hay xử lý dòng tiền. */
export default function Receipt() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const orderId = searchParams.get("orderId")
  const liveAuth = hasLiveBackendAuth()

  const defaultHandover = INCOMING.find((x) => x.status === "collected") || INCOMING[0]
  const [loadingOrder, setLoadingOrder] = useState<boolean>(() => initApiLoading(true))
  const [eligibleOrders, setEligibleOrders] = useState<SyncedHandoverOrder[]>([])
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
    return initApiState(null, defaultHandover)
  })

  const [rows, setRows] = useState<ReceiptFormRow[]>(() =>
    (h?.lines ?? []).map((l) => ({
      wasteId: l.wasteId,
      estimatedKg: l.kg,
      kg: l.kg,
    })),
  )
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [existingProofUrls, setExistingProofUrls] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (files.length === 0) {
      setPreviewUrls([])
      return
    }
    const created = files.map((f) => URL.createObjectURL(f))
    setPreviewUrls(created)
    return () => {
      for (const u of created) URL.revokeObjectURL(u)
    }
  }, [files])

  useEffect(() => {
    let active = true
    async function loadOrder() {
      setLoadingOrder(true)
      setErrorMessage(null)
      setStatusMessage(null)
      setSent(false)
      setExistingProofUrls([])
      setFiles([])

      try {
        const ordersRes = await fetchHandoverOrdersResult("recycler")
        if (!active) return

        const candidates = ordersRes.orders.filter(
          (o) => o.status === "accepted" || o.status === "collected" || o.status === "done",
        )
        setEligibleOrders(candidates)

        const found = orderId
          ? ordersRes.orders.find((o) => o.id === orderId || o.displayCode === orderId)
          : candidates.find((o) => o.status === "accepted") ||
            candidates.find((o) => o.status === "collected") ||
            candidates[0]

        const targetId = found?.id || orderId

        if (targetId) {
          const [detail, existingReceipt] = await Promise.all([
            fetchRecyclerHandoverDetail(targetId),
            fetchRecyclerReceipt(targetId),
          ])
          if (!active) return

          const resolvedHandover: Handover | null = found
            ? {
                id: found.id,
                displayCode: found.displayCode,
                recycler: found.recycler,
                address: detail?.pickupAddress || found.address,
                date: found.date,
                slot: found.slot,
                lines:
                  detail && detail.items.length > 0
                    ? detail.items.map((it) => ({
                        wasteId: it.wasteCategoryCode || it.wasteCategoryId,
                        kg: it.estimatedWeightKg,
                      }))
                    : found.lines,
                status: found.status,
                reason: found.reason,
              }
            : detail
              ? {
                  id: detail.id,
                  displayCode: detail.requestCode || formatOrderDisplayCode(detail.id),
                  recycler: detail.recycler?.name || "Cơ sở thu mua",
                  address: detail.pickupAddress || "Điểm hẹn bàn giao",
                  date: new Date(detail.proposedTimeSlot).toLocaleDateString("vi-VN"),
                  slot: "Theo lịch hẹn",
                  lines: detail.items.map((it) => ({
                    wasteId: it.wasteCategoryCode || it.wasteCategoryId,
                    kg: it.estimatedWeightKg,
                  })),
                  status:
                    detail.status === "Completed"
                      ? "done"
                      : detail.status === "AwaitingConfirmation"
                        ? "collected"
                        : "accepted",
                }
              : null

          const resolvedUnitPrice =
            found?.agreedPricePerKg ??
            found?.initialPricePerKg ??
            detail?.items.find((it) => typeof it.agreedPricePerKg === "number" && it.agreedPricePerKg > 0)
              ?.agreedPricePerKg ??
            undefined

          setOrderUnitPrice(resolvedUnitPrice)
          setH(resolvedHandover)

          if (existingReceipt) {
            setSent(true)
            setExistingProofUrls(existingReceipt.scaleProofPhotoUrls ?? [])
            setStatusMessage(
              `Đơn này đã có biên nhận #${existingReceipt.receiptCode || existingReceipt.receiptId} (trạng thái: ${existingReceipt.requestStatus}).`,
            )
            if (existingReceipt.lines && existingReceipt.lines.length > 0) {
              setRows(
                existingReceipt.lines.map((l) => ({
                  itemId: l.itemId ?? undefined,
                  wasteCategoryId: l.wasteCategoryId,
                  wasteId: l.wasteCategoryCode || l.wasteCategoryId,
                  wasteName: l.wasteCategoryName,
                  estimatedKg: l.estimatedWeightKg,
                  kg: l.actualWeightKg,
                  unitPrice: l.unitPricePerKg,
                })),
              )
            }
          } else if (detail && detail.items.length > 0) {
            setRows(
              detail.items.map((it) => ({
                itemId: it.id,
                wasteCategoryId: it.wasteCategoryId,
                wasteId: it.wasteCategoryCode || it.wasteCategoryId,
                wasteName: it.wasteCategoryName,
                estimatedKg: it.estimatedWeightKg,
                kg: it.actualWeightKg ?? it.estimatedWeightKg,
                unitPrice: it.agreedPricePerKg ?? undefined,
              })),
            )
          } else if (found) {
            setRows(
              found.lines.map((l) => ({
                wasteId: l.wasteId,
                estimatedKg: l.kg,
                kg: l.kg,
              })),
            )
          }
        } else if (!ordersRes.fromBackend && !liveAuth) {
          setH(defaultHandover)
          setRows(
            defaultHandover.lines.map((l) => ({
              wasteId: l.wasteId,
              estimatedKg: l.kg,
              kg: l.kg,
            })),
          )
        } else {
          setH(null)
          setRows([])
        }
      } catch (err) {
        if (!active) return
        setErrorMessage(
          err instanceof Error ? err.message : "Không thể tải dữ liệu đơn thu gom.",
        )
      } finally {
        if (active) setLoadingOrder(false)
      }
    }
    void loadOrder()
    return () => {
      active = false
    }
  }, [orderId, liveAuth])

  const rowPriceOf = (row: ReceiptFormRow, index: number) => {
    if (typeof row.unitPrice === "number" && row.unitPrice > 0) return row.unitPrice
    if (orderUnitPrice && orderUnitPrice > 0 && index === 0) return orderUnitPrice
    return priceOf(row.wasteId)
  }

  const totalEstimatedKg = rows.reduce((s, r) => s + r.estimatedKg, 0)
  const totalGross = rows.reduce((s, r, i) => s + r.kg * rowPriceOf(r, i), 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!h) return
    setErrorMessage(null)

    if (rows.length === 0 || rows.some((r) => !Number.isFinite(r.kg) || r.kg <= 0)) {
      setErrorMessage("Vui lòng nhập khối lượng cân thực tế lớn hơn 0 kg cho tất cả loại rác.")
      return
    }

    if (liveAuth && files.length === 0) {
      setErrorMessage("Vui lòng chọn ít nhất 1 ảnh rác đã cân hoặc biên nhận làm bằng chứng (BR-HND-04).")
      return
    }

    setSubmitting(true)
    try {
      const scaleProofPhotoUrls =
        files.length > 0
          ? await Promise.all(files.map((f) => uploadReceiptProofPhoto(h.id, f)))
          : ["https://images.ecolink.vn/proofs/scale-verified.jpg"]

      const payload: CreateReceiptRequest = {
        items: rows.map((r) => {
          const hasValidItemId = Boolean(r.itemId && UUID_REGEX.test(r.itemId))
          const hasValidCatGuid = Boolean(r.wasteCategoryId && UUID_REGEX.test(r.wasteCategoryId))
          return {
            ...(hasValidItemId ? { itemId: r.itemId } : {}),
            ...(!hasValidItemId && hasValidCatGuid ? { wasteCategoryId: r.wasteCategoryId } : {}),
            actualWeightKg: Number(r.kg.toFixed(2)),
          }
        }),
        scaleProofPhotoUrls,
      }

      const res = await createHandoverReceipt(h.id, payload)
      setSent(true)
      setExistingProofUrls(res.receipt.scaleProofPhotoUrls ?? scaleProofPhotoUrls)
      setStatusMessage(
        res.syncedWithBackend
          ? `Đã phát hành biên nhận #${res.receipt.receiptCode} thành công. Chờ người dân xác nhận!`
          : "Đã gửi biên nhận (chế độ dự phòng ngoại tuyến). Chờ người dùng xác nhận khối lượng.",
      )
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Không thể phát hành biên nhận. Vui lòng thử lại."
      setErrorMessage(msg)
      setSent(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="BIÊN NHẬN"
        title="Tạo biên nhận thu gom"
        body="Nhập khối lượng thực tế bạn vừa cân và chụp ảnh làm bằng chứng. Hệ thống lưu trữ biên nhận để hai bên đối chiếu và ghi nhận Điểm Xanh sau khi người dùng xác nhận."
      />

      {eligibleOrders.length > 1 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <span className="text-xs font-semibold text-ink">
            Chọn đơn cần lập / xem biên nhận ({eligibleOrders.length} đơn):
          </span>
          <select
            className="input h-9 max-w-md text-xs"
            value={h?.id ?? ""}
            onChange={(e) => {
              const nextId = e.target.value
              if (nextId) navigate(`/recycler/receipt?orderId=${encodeURIComponent(nextId)}`)
            }}
          >
            {eligibleOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.displayCode} · {o.citizenName || o.address} ({o.status === "accepted" ? "Chờ lập biên nhận" : o.status === "collected" ? "Đã gửi biên nhận" : "Hoàn tất"})
              </option>
            ))}
          </select>
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm font-medium text-warn">
          {errorMessage}
        </div>
      )}

      {loadingOrder ? (
        <TableSkeleton rows={4} />
      ) : !h ? (
        <div className="card flex flex-col items-center gap-3 px-5 py-10 text-center">
          <p className="text-sm font-semibold text-ink">
            Chưa có lịch hẹn nào đã chốt để lập biên nhận.
          </p>
          <p className="max-w-[52ch] text-xs text-muted">
            Hãy tiếp nhận đơn hoặc chốt điều khoản trong Chat trước khi đến điểm hẹn cân thực tế
            và phát hành biên nhận.
          </p>
          <Link to="/recycler/requests" className="btn-primary h-10 px-5 text-xs font-semibold">
            Quay lại Tiếp nhận yêu cầu
          </Link>
        </div>
      ) : (
      <form onSubmit={submit} className="card flex flex-col gap-5 p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-soft pb-4">
          <div>
            <p className="font-bold text-ink">{h.address}</p>
            <p className="mt-0.5 text-[13px] text-muted">
              {h.displayCode || h.id} · {h.date} · {h.slot}
            </p>
          </div>
          <span className="rounded-full bg-mint/25 px-3 py-1 text-[11px] font-semibold text-brand-deep">
            Người dùng ước tính {totalEstimatedKg} kg
          </span>
        </div>

        <Table head={["Loại rác", "Người dùng bỏ ra", "Bạn cân được (kg) *", "Thành tiền"]}>
          {rows.map((r, i) => {
            const unitPrice = rowPriceOf(r, i)
            return (
              <tr key={r.itemId || `${r.wasteId}-${i}`}>
                <Td className="font-semibold text-ink">
                  {r.wasteName || nameOf(r.wasteId)}
                </Td>
                <Td className="tabular-nums text-muted">{r.estimatedKg} kg</Td>
                <Td>
                  <input
                    className="input h-9 w-28 tabular-nums"
                    type="number"
                    min={0.01}
                    step={0.1}
                    aria-label={`Khối lượng cân thực tế ${r.wasteName || nameOf(r.wasteId)}`}
                    value={r.kg}
                    disabled={sent || submitting}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((x, n) => (n === i ? { ...x, kg: Number(e.target.value) } : x)),
                      )
                    }
                  />
                </Td>
                <Td className="tabular-nums font-semibold text-ink">
                  {VND(r.kg * unitPrice)}
                </Td>
              </tr>
            )
          })}
        </Table>

        <label className="flex cursor-pointer flex-col gap-2 text-[13px] font-semibold text-ink">
          <span>
            Ảnh bàn giao &amp; bằng chứng cân {liveAuth ? "(Bắt buộc tối thiểu 1 ảnh)" : ""}
            <RequiredMark />
          </span>
          <span className="rounded-lg border border-dashed border-sage-line bg-surface-2 px-4 py-6 text-center text-[13px] font-normal text-muted">
            {files.length > 0
              ? files.map((f) => f.name).join(" · ")
              : existingProofUrls.length > 0
                ? `Đã lưu ${existingProofUrls.length} ảnh bằng chứng cân trên hệ thống`
                : "Chọn ảnh rác đã cân hoặc biên nhận cân, tối đa 4 ảnh (.jpg, .png, .webp)"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            multiple
            disabled={sent || submitting}
            className="sr-only"
            onChange={(e) => {
              setFiles(Array.from(e.target.files ?? []).slice(0, 4))
              setErrorMessage(null)
            }}
          />
        </label>

        {(previewUrls.length > 0 || existingProofUrls.length > 0) && (
          <div className="flex flex-wrap gap-3">
            {(existingProofUrls.length > 0 ? existingProofUrls : previewUrls).map((url, idx) => (
              <a
                key={`${url}-${idx}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block size-20 overflow-hidden rounded-lg border border-line bg-surface-2"
                title={`Ảnh bằng chứng cân #${idx + 1}`}
              >
                <img
                  src={url}
                  alt={`Bằng chứng cân #${idx + 1}`}
                  className="size-full object-cover"
                />
              </a>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface-2 px-5 py-4">
          <p className="text-sm text-body">
            Tổng tiền đối tác nhận{" "}
            <b className="tabular-nums text-brand">{VND(totalGross)}</b>
          </p>
          <span className="text-xs text-muted">
            Hệ thống lưu trữ biên nhận để đối chiếu và cộng Điểm Xanh, không thu phí giao dịch.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button type="submit" disabled={sent || submitting} className="btn-primary h-11 px-6">
            {submitting ? "Đang tải ảnh & gửi..." : sent ? "Đã gửi biên nhận" : "Gửi biên nhận"}
          </button>
          {statusMessage && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {statusMessage}
            </p>
          )}
        </div>
      </form>
      )}
    </div>
  )
}
