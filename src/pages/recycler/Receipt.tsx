import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Camera, FileCheck2, Receipt as ReceiptIcon, Search, X } from "lucide-react"
import PaginationBar, { FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import { PageHead, RequiredMark, Status, Table, TableSkeleton, Td } from "@/components/Portal"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { INCOMING, type Handover } from "@/data/handover"
import { VND, WASTES } from "@/data/waste"
import { ApiError } from "@/lib/api"
import { initApiLoading, initApiState, isSsrSmokeTest } from "@/lib/hydration"
import {
  createHandoverReceipt,
  fetchHandoverOrdersResult,
  fetchRecyclerHandoverDetail,
  fetchRecyclerReceipt,
  findCachedHandoverOrder,
  formatOrderDisplayCode,
  previewHandoverReceipt,
  uploadReceiptProofPhoto,
  type CreateReceiptRequest,
  type ReceiptDto,
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
  rawKg?: string
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
  const [loadingDetail, setLoadingDetail] = useState(false)
  const hasLoadedOrdersRef = useRef(false)
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
  const [previewData, setPreviewData] = useState<ReceiptDto | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState<boolean>(() => Boolean(orderId))
  const [orderSearch, setOrderSearch] = useState("")
  const [orderStatusFilter, setOrderStatusFilter] = useState<
    "all" | "accepted" | "collected" | "done"
  >("all")
  const [orderPage, setOrderPage] = useState(1)
  const debouncedRows = useDebouncedValue(rows, 350)

  const filteredEligibleOrders = useMemo(() => {
    const kw = orderSearch.trim().toLowerCase()
    return eligibleOrders.filter((o) => {
      if (orderStatusFilter !== "all" && o.status !== orderStatusFilter) return false
      if (!kw) return true
      return `${o.displayCode} ${o.citizenName ?? ""} ${o.address} ${o.date}`
        .toLowerCase()
        .includes(kw)
    })
  }, [eligibleOrders, orderSearch, orderStatusFilter])

  const pagedEligibleOrders = useMemo(
    () => paginateItems(filteredEligibleOrders, orderPage, FIXED_PAGE_SIZE),
    [filteredEligibleOrders, orderPage],
  )

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
      if (!hasLoadedOrdersRef.current) {
        setLoadingOrder(true)
      } else {
        setLoadingDetail(true)
      }
      setErrorMessage(null)
      setStatusMessage(null)
      setFiles([])

      try {
        const ordersRes = await fetchHandoverOrdersResult("recycler")
        if (!active) return

        const candidates = ordersRes.orders.filter(
          (o) => o.status === "accepted" || o.status === "collected" || o.status === "done",
        )
        setEligibleOrders(candidates)
        hasLoadedOrdersRef.current = true

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
            setSent(false)
            setExistingProofUrls([])
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
            setSent(false)
            setExistingProofUrls([])
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
        if (active) {
          setLoadingOrder(false)
          setLoadingDetail(false)
        }
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
  const totalActualKg = rows.reduce(
    (s, r) => s + (Number.isFinite(r.kg) && r.kg > 0 ? r.kg : 0),
    0,
  )
  const totalGross = rows.reduce(
    (s, r, i) => s + (Number.isFinite(r.kg) && r.kg > 0 ? r.kg : 0) * rowPriceOf(r, i),
    0,
  )

  useEffect(() => {
    if (isSsrSmokeTest() || !h || sent || !UUID_REGEX.test(h.id)) {
      setPreviewData(null)
      return
    }
    const valid =
      debouncedRows.length > 0 &&
      debouncedRows.every(
        (r) =>
          Number.isFinite(r.kg) &&
          r.kg > 0 &&
          Math.abs(r.kg * 100 - Math.round(r.kg * 100)) <= 1e-4,
      )
    if (!valid) {
      setPreviewData(null)
      return
    }

    let cancelled = false
    setPreviewLoading(true)
    const payload: CreateReceiptRequest = {
      items: debouncedRows.map((r) => {
        const hasValidItemId = Boolean(r.itemId && UUID_REGEX.test(r.itemId))
        const hasValidCatGuid = Boolean(r.wasteCategoryId && UUID_REGEX.test(r.wasteCategoryId))
        return {
          ...(hasValidItemId ? { itemId: r.itemId } : {}),
          ...(!hasValidItemId && hasValidCatGuid ? { wasteCategoryId: r.wasteCategoryId } : {}),
          actualWeightKg: Number(r.kg.toFixed(2)),
        }
      }),
      scaleProofPhotoUrls: existingProofUrls,
    }
    void previewHandoverReceipt(h.id, payload)
      .then((res) => {
        if (!cancelled) setPreviewData(res)
      })
      .catch(() => {
        if (!cancelled) setPreviewData(null)
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedRows, existingProofUrls, h, sent])

  const localDeviationPercent =
    totalEstimatedKg > 0
      ? Number((((totalActualKg - totalEstimatedKg) / totalEstimatedKg) * 100).toFixed(1))
      : 0
  const effectiveDeviationPercent = previewData ? previewData.deviationPercent : localDeviationPercent
  const effectiveDeviationWarning = previewData
    ? previewData.hasDeviationWarning
    : Math.abs(localDeviationPercent) > 20
  const effectiveTotalCash = previewData ? previewData.totalAmountCash : totalGross

  const handleProofFileChange = (pickedList: FileList | null) => {
    const picked = Array.from(pickedList ?? [])
    setErrorMessage(null)
    if (picked.length > 4) {
      setErrorMessage("Chỉ được chọn tối đa 4 ảnh bằng chứng cân đo.")
      return
    }
    for (const file of picked) {
      const validType =
        /^image\/(jpeg|jpg|png|webp)$/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)
      if (!validType) {
        setErrorMessage(`Tệp "${file.name}" không phải ảnh JPG, PNG hoặc WEBP hợp lệ.`)
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage(`Ảnh "${file.name}" vượt quá dung lượng tối đa 10 MB.`)
        return
      }
    }
    setFiles(picked)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!h) return
    setErrorMessage(null)

    if (
      rows.length === 0 ||
      rows.some(
        (r) =>
          !Number.isFinite(r.kg) ||
          r.kg <= 0 ||
          Math.abs(r.kg * 100 - Math.round(r.kg * 100)) > 1e-4,
      )
    ) {
      setErrorMessage(
        "Vui lòng nhập khối lượng cân thực tế lớn hơn 0 kg (hỗ trợ tối đa 2 chữ số thập phân, ví dụ 10 hoặc 10.25) cho tất cả loại rác.",
      )
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
        body="Nhập khối lượng thực tế bạn vừa cân và chụp ảnh làm bằng chứng. Hệ thống lưu trữ biên nhận để hai bên đối chiếu minh bạch sau khi người dùng xác nhận."
      />

      {eligibleOrders.length > 0 && (
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <section className="flex flex-col gap-3 rounded-2xl border border-line-soft bg-white p-4 shadow-[0_10px_24px_-14px_rgba(15,31,21,0.08)] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-ink">
                  Chọn đơn cần lập / xem biên nhận
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Tìm nhanh theo mã đơn, tên người dân, địa chỉ hoặc lọc theo trạng thái.
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={orderSearch}
                  onChange={(e) => {
                    setOrderSearch(e.target.value)
                    setOrderPage(1)
                  }}
                  placeholder="Tìm mã đơn, tên, địa chỉ..."
                  aria-label="Tìm đơn cần lập hoặc xem biên nhận"
                  className="input h-10 min-h-10 pl-10 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ["all", `Tất cả (${eligibleOrders.length})`],
                  [
                    "accepted",
                    `Chờ lập biên nhận (${eligibleOrders.filter((o) => o.status === "accepted").length})`,
                  ],
                  [
                    "collected",
                    `Đã gửi biên nhận (${eligibleOrders.filter((o) => o.status === "collected").length})`,
                  ],
                  [
                    "done",
                    `Hoàn tất (${eligibleOrders.filter((o) => o.status === "done").length})`,
                  ],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setOrderStatusFilter(key)
                    setOrderPage(1)
                  }}
                  className={`min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${
                    orderStatusFilter === key
                      ? "border-brand bg-brand/12 text-brand-deep"
                      : "border-line bg-surface-2 text-muted hover:border-sage-line hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {filteredEligibleOrders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-surface-2/50 px-4 py-4 text-center text-xs text-muted">
                Không tìm thấy đơn nào khớp từ khoá hoặc trạng thái đang lọc.
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {pagedEligibleOrders.map((o) => {
                    const isActive = h?.id === o.id
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setModalOpen(true)
                            if (o.id !== orderId) {
                              navigate(`/recycler/receipt?orderId=${encodeURIComponent(o.id)}`)
                            }
                          }}
                          className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                            isActive && modalOpen
                              ? "border-brand bg-brand/10 ring-1 ring-brand/25"
                              : "border-line-soft bg-surface-2/55 hover:border-sage-line hover:bg-surface-2"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-ink">
                                {o.displayCode}
                              </span>
                              <span className="text-sm font-semibold text-ink">
                                {o.citizenName || o.address}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted">
                              {o.date} · {o.slot} · {o.address}
                            </p>
                          </div>
                          <Status tone={o.status === "done" || o.status === "collected" ? "ok" : "wait"}>
                            {o.status === "accepted"
                              ? "Chờ lập biên nhận"
                              : o.status === "collected"
                                ? "Đã gửi biên nhận"
                                : "Hoàn tất"}
                          </Status>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <PaginationBar
                  page={orderPage}
                  pageSize={FIXED_PAGE_SIZE}
                  totalCount={filteredEligibleOrders.length}
                  onPageChange={setOrderPage}
                  itemLabel="đơn"
                />
              </>
            )}
          </section>
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
        <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line-soft bg-white px-5 py-10 text-center">
            <p className="text-sm font-semibold text-ink">
              Chưa có lịch hẹn nào đã chốt để lập biên nhận.
            </p>
            <p className="max-w-[52ch] text-sm leading-6 text-muted">
              Hãy tiếp nhận đơn hoặc chốt điều khoản trong Chat trước khi đến điểm hẹn cân thực tế
              và phát hành biên nhận.
            </p>
            <Link to="/recycler/requests" className="btn-primary min-h-11 px-5 text-sm font-semibold">
              Quay lại Tiếp nhận yêu cầu
            </Link>
          </div>
        </div>
      ) : modalOpen && h ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-modal-title"
        onClick={() => {
          if (!submitting) setModalOpen(false)
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-line/80 bg-surface-2/95 p-1.5 shadow-2xl"
        >
          <form
            noValidate
            onSubmit={submit}
            className="flex flex-col gap-5 rounded-2xl border border-line-soft bg-white p-5 md:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft pb-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-deep">
                  <ReceiptIcon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 id="receipt-modal-title" className="font-bold text-ink">
                      {h.address}
                    </h3>
                    <Status tone={sent || h.status === "done" ? "ok" : "wait"}>
                      {sent ? "Đã gửi biên nhận" : h.status === "done" ? "Hoàn tất" : "Chờ lập biên nhận"}
                    </Status>
                  </div>
                  <p className="mt-0.5 text-sm text-muted tabular-nums">
                    {h.displayCode || h.id} · {h.date} · {h.slot}
                    {loadingDetail ? " · Đang đồng bộ chi tiết..." : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-mint/25 px-3 py-1 text-xs font-semibold tabular-nums text-brand-deep">
                  Ước tính {totalEstimatedKg} kg
                </span>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setModalOpen(false)}
                  aria-label="Đóng chi tiết biên nhận"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((r, i) => {
              const unitPrice = rowPriceOf(r, i)
              return (
                <li
                  key={r.itemId || `${r.wasteId}-${i}`}
                  className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface-2/40 p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-ink break-words">
                      {r.wasteName || nameOf(r.wasteId)}
                    </span>
                    <span className="shrink-0 text-xs text-muted tabular-nums">
                      Ước tính: {r.estimatedKg} kg
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold text-ink">
                      <span>Bạn cân được (kg) *</span>
                      <input
                        className="input min-h-11 w-full text-base tabular-nums"
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        aria-label={`Khối lượng cân thực tế ${r.wasteName || nameOf(r.wasteId)}`}
                        value={r.rawKg ?? (Number.isFinite(r.kg) ? String(r.kg) : "")}
                        disabled={sent || submitting}
                        onChange={(e) => {
                          const raw = e.target.value
                          const parsed = raw.trim() === "" ? Number.NaN : Number(raw)
                          setRows((rs) =>
                            rs.map((x, n) =>
                              n === i ? { ...x, rawKg: raw, kg: parsed } : x,
                            ),
                          )
                        }}
                        onBlur={() =>
                          setRows((rs) =>
                            rs.map((x, n) =>
                              n === i && Number.isFinite(x.kg) && x.kg > 0
                                ? { ...x, rawKg: undefined, kg: Number(x.kg.toFixed(2)) }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <div className="text-right">
                      <span className="block text-[11px] text-muted">Thành tiền</span>
                      <span className="text-sm font-bold tabular-nums text-brand-deep">
                        {VND(r.kg * unitPrice)}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="hidden md:block">
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
                          className="input min-h-11 w-32 text-base tabular-nums sm:text-[15px]"
                          type="number"
                          min="0.01"
                          step="0.01"
                          inputMode="decimal"
                          aria-label={`Khối lượng cân thực tế ${r.wasteName || nameOf(r.wasteId)}`}
                          value={r.rawKg ?? (Number.isFinite(r.kg) ? String(r.kg) : "")}
                          disabled={sent || submitting}
                          onChange={(e) => {
                            const raw = e.target.value
                            const parsed = raw.trim() === "" ? Number.NaN : Number(raw)
                            setRows((rs) =>
                              rs.map((x, n) =>
                                n === i ? { ...x, rawKg: raw, kg: parsed } : x,
                              ),
                            )
                          }}
                          onBlur={() =>
                            setRows((rs) =>
                              rs.map((x, n) =>
                                n === i && Number.isFinite(x.kg) && x.kg > 0
                                  ? { ...x, rawKg: undefined, kg: Number(x.kg.toFixed(2)) }
                                  : x,
                              ),
                            )
                          }
                        />
                      </Td>
                      <Td className="font-semibold tabular-nums text-ink">
                        {VND(r.kg * unitPrice)}
                      </Td>
                    </tr>
                  )
                })}
              </Table>
          </div>

              <label className="flex cursor-pointer flex-col gap-2 text-sm font-semibold text-ink">
                <span className="flex items-center gap-1.5">
                  <Camera className="size-4 text-brand-deep" aria-hidden="true" />
                  Ảnh bàn giao &amp; bằng chứng cân {liveAuth ? "(Bắt buộc tối thiểu 1 ảnh)" : ""}
                  <RequiredMark />
                </span>
                <span className="flex min-h-[76px] items-center justify-center rounded-xl border border-dashed border-sage-line bg-surface-2 px-4 py-4 text-center text-sm leading-6 font-normal text-muted transition-colors hover:border-brand/50">
                  {files.length > 0
                    ? files.map((f) => f.name).join(" · ")
                    : existingProofUrls.length > 0
                      ? `Đã lưu ${existingProofUrls.length} ảnh bằng chứng cân trên hệ thống`
                      : "Chọn ảnh rác đã cân hoặc biên nhận cân, tối đa 4 ảnh (.jpg, .png, .webp)"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  multiple
                  disabled={sent || submitting}
                  className="sr-only"
                  onChange={(e) => handleProofFileChange(e.target.files)}
                />
              </label>

              <div className="flex min-h-[84px] flex-wrap items-center gap-3">
                {loadingDetail ? (
                  <div className="size-20 animate-pulse rounded-xl border border-line bg-surface-2" />
                ) : previewUrls.length > 0 || existingProofUrls.length > 0 ? (
                  (existingProofUrls.length > 0 ? existingProofUrls : previewUrls).map((url, idx) => (
                    <a
                      key={`${url}-${idx}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block size-20 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2 transition-transform hover:scale-105"
                      title={`Ảnh bằng chứng cân #${idx + 1}`}
                    >
                      <img
                        src={url}
                        alt={`Bằng chứng cân #${idx + 1}`}
                        className="size-full object-cover"
                      />
                    </a>
                  ))
                ) : (
                  <span className="text-xs text-muted">
                    Chưa có ảnh bằng chứng cân đính kèm.
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brand/25 bg-brand/6 px-5 py-4">
                <p className="text-sm font-medium text-ink">
                  Tổng tiền ước tính thanh toán:{" "}
                  <b className="text-base tabular-nums text-brand-deep">{VND(effectiveTotalCash)}</b>
                </p>
                <span className="text-xs leading-5 text-muted">
                  {previewLoading
                    ? "Đang kiểm tra biên nhận từ máy chủ..."
                    : "Hệ thống lưu trữ biên nhận để hai bên đối chiếu minh bạch, không thu phí giao dịch."}
                </span>
              </div>

              {effectiveDeviationWarning && (
                <div
                  role="status"
                  className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 font-medium text-amber-950"
                >
                  <b>Cảnh báo lệch khối lượng ({effectiveDeviationPercent > 0 ? `+${effectiveDeviationPercent}` : effectiveDeviationPercent}%):</b>{" "}
                  {previewData?.deviationMessage ||
                    "Khối lượng thực cân chênh lệch quá 20% so với ước tính ban đầu. Vui lòng kiểm tra kỹ và chụp rõ ảnh đồng hồ cân (MSG-HND-04)."}
                </div>
              )}

              {errorMessage && (
                <p role="alert" className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm font-medium text-warn">
                  {errorMessage}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button type="submit" disabled={sent || submitting} className="btn-primary min-h-11 rounded-xl px-6 text-sm font-semibold">
                    <FileCheck2 className="size-4" />
                    {submitting ? "Đang tải ảnh & gửi..." : sent ? "Đã gửi biên nhận" : "Gửi biên nhận"}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setModalOpen(false)}
                    className="btn-ghost min-h-11 px-4 text-sm font-semibold"
                  >
                    Đóng
                  </button>
                </div>
                {statusMessage && (
                  <p role="status" className="text-sm font-semibold text-brand-deep">
                    {statusMessage}
                  </p>
                )}
              </div>
          </form>
        </div>
      </div>
      ) : null}
    </div>
  )
}
