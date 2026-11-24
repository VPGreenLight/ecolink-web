import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import PaginationBar, { FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import { PageHead, RequiredMark, Status, Table, Td } from "@/components/Portal"
import SearchFilterBar from "@/components/SearchFilterBar"
import { initApiLoading, initApiState } from "@/lib/hydration"
import {
  INCOMING,
  STATUS_LABEL,
  TIME_SLOTS,
  TONE,
  calc,
  type Handover as HandoverItem,
} from "@/data/handover"
import { VND, WASTES } from "@/data/waste"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import {
  fetchHandoverOrdersResult,
  formatOrderDisplayCode,
  updateHandoverOrderStatus,
} from "@/lib/recyclerWorkflowApi"
import { ApiError } from "@/lib/api"
import { hasLiveBackendAuth } from "@/lib/session"
import {
  COMPLAINT_CATEGORY_LABELS,
  fetchMyComplaints,
  submitComplaint,
  uploadComplaintEvidence,
  type ComplaintCategoryCode,
  type ComplaintSummaryDto,
} from "@/lib/reviewComplaintApi"

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0
const nameOf = (id: string) => WASTES.find((w) => w.id === id)?.name ?? id

const ALL_COMPLAINT_CATEGORIES: ComplaintCategoryCode[] = [
  "ScaleDiscrepancy",
  "PaymentIssue",
  "NoShow",
  "Misconduct",
  "Other",
]
const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  Open: "Chờ tiếp nhận",
  Investigating: "Đang xử lý",
  Resolved: "Đã giải quyết",
  Dismissed: "Đã bác bỏ",
}

type IncomingView = HandoverItem & {
  displayCode: string
  rawStatus?: string
  unitPricePerKg?: number
  citizenName?: string
  pickupLat?: number
  pickupLng?: number
  fromBackend?: boolean
}

const DEFAULT_OFFLINE_INCOMING: IncomingView[] = INCOMING.map((item) => ({
  ...item,
  displayCode: formatOrderDisplayCode(item.id),
  fromBackend: false,
}))

const priceForOrder = (h: IncomingView) => (wasteId: string) =>
  h.unitPricePerKg && h.unitPricePerKg > 0 && wasteId === h.lines[0]?.wasteId
    ? h.unitPricePerKg
    : priceOf(wasteId)

/** R-03 Tiếp nhận / Từ chối yêu cầu bàn giao (kèm xem ghim điểm hẹn đầu ngõ của Người dân).
 *
 *  Nhận = chốt luôn khung giờ User đề xuất, nên bấm Nhận là một cam kết thời
 *  gian. Đã cam kết rồi mà đổi lịch thì phải qua R-04 (huỷ kèm lý do) chứ
 *  không sửa lặng lẽ. */
export default function Requests() {
  const [list, setList] = useState<IncomingView[]>(() =>
    initApiState([], DEFAULT_OFFLINE_INCOMING),
  )
  const [loading, setLoading] = useState<boolean>(() => initApiLoading(true))
  const [busy, setBusy] = useState("")
  const [flash, setFlash] = useState("")
  const [actionErr, setActionErr] = useState("")
  const [openMapId, setOpenMapId] = useState<string | null>(null)
  const [cancelOrder, setCancelOrder] = useState<IncomingView | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelErr, setCancelErr] = useState("")
  const [complaintOrder, setComplaintOrder] = useState<IncomingView | null>(null)
  const [cmpCategory, setCmpCategory] = useState<ComplaintCategoryCode>("ScaleDiscrepancy")
  const [cmpDesc, setCmpDesc] = useState("")
  const [cmpFiles, setCmpFiles] = useState<File[]>([])
  const [cmpBusy, setCmpBusy] = useState(false)
  const [cmpErr, setCmpErr] = useState("")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)
  const [pendingPage, setPendingPage] = useState(1)
  const pendingPageSize = FIXED_PAGE_SIZE
  const [activePage, setActivePage] = useState(1)
  const activePageSize = FIXED_PAGE_SIZE
  const [myComplaints, setMyComplaints] = useState<ComplaintSummaryDto[]>([])
  const [cmpPage, setCmpPage] = useState(1)

  useEffect(() => {
    let active = true
    void fetchHandoverOrdersResult("recycler")
      .then((res) => {
        if (!active) return
        const mapped: IncomingView[] = res.orders.map((s) => ({
          id: s.id,
          displayCode: s.displayCode || formatOrderDisplayCode(s.id),
          rawStatus: s.rawStatus,
          unitPricePerKg: s.agreedPricePerKg ?? s.initialPricePerKg,
          citizenName: s.citizenName,
          recycler: s.recycler,
          address: s.address,
          date: s.date,
          slot: s.slot,
          lines: s.lines,
          status: s.status,
          reason: s.reason,
          pickupLat: s.pickupLat,
          pickupLng: s.pickupLng,
          fromBackend: s.fromBackend,
        }))

        if (res.fromBackend) {
          // Khi kết nối PostgreSQL thành công: hiển thị đúng các đơn bàn giao thật gửi tới vựa hiện tại
          setList(mapped)
        } else if (mapped.length > 0) {
          const existingIds = new Set(DEFAULT_OFFLINE_INCOMING.map((x) => x.id))
          const fresh = mapped.filter((s) => !existingIds.has(s.id))
          setList([...fresh, ...DEFAULT_OFFLINE_INCOMING])
        } else {
          setList(DEFAULT_OFFLINE_INCOMING)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    if (hasLiveBackendAuth()) {
      void fetchMyComplaints({ role: "all", pageSize: 100 })
        .then((res) => {
          if (active && res.success && res.data) {
            setMyComplaints(res.data.items)
          }
        })
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [])

  const act = async (h: IncomingView, next: "accepted" | "declined") => {
    setBusy(h.id)
    setFlash("")
    setActionErr("")
    try {
      await updateHandoverOrderStatus(
        h.id,
        "recycler",
        next === "accepted" ? "Accepted" : "Rejected",
      )
      setList((ls) => ls.map((l) => (l.id === h.id ? { ...l, status: next } : l)))
      setFlash(
        next === "accepted"
          ? `Đã tiếp nhận đơn ${h.displayCode} và chốt khung giờ ${h.slot}.`
          : `Đã từ chối đơn ${h.displayCode}.`,
      )
    } catch (err) {
      setActionErr(
        err instanceof ApiError
          ? err.message
          : "Không thể cập nhật trạng thái đơn bàn giao. Vui lòng thử lại.",
      )
    } finally {
      setBusy("")
    }
  }

  /** R-04 huỷ lịch giữa chừng: bắt buộc có lý do vì người dùng đang chờ. */
  const openCancelForm = (h: IncomingView) => {
    setCancelOrder(h)
    setCancelReason("")
    setCancelErr("")
    setActionErr("")
  }

  const submitCancel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cancelOrder || busy) return
    const cleanReason = cancelReason.trim()
    if (cleanReason.length < 5) {
      setCancelErr("Vui lòng nhập lý do hủy lịch thu gom tối thiểu 5 ký tự.")
      return
    }
    if (cleanReason.length > 500) {
      setCancelErr("Lý do hủy lịch không được vượt quá 500 ký tự.")
      return
    }
    setCancelErr("")
    setFlash("")
    setActionErr("")
    setBusy(cancelOrder.id)
    try {
      const res = await updateHandoverOrderStatus(
        cancelOrder.id,
        "recycler",
        "Cancelled",
        cleanReason,
      )
      setList((ls) =>
        ls.map((l) =>
          l.id === cancelOrder.id ? { ...l, status: "broken", reason: cleanReason } : l,
        ),
      )
      setFlash(
        `Đã huỷ lịch thu gom ${cancelOrder.displayCode}${res.syncedWithBackend ? " trên hệ thống" : ""}.`,
      )
      setCancelOrder(null)
      setCancelReason("")
    } catch (err) {
      setCancelErr(
        err instanceof ApiError
          ? err.message
          : "Không thể hủy lịch thu gom trên hệ thống.",
      )
    } finally {
      setBusy("")
    }
  }

  const handleComplaintFileChange = (pickedList: FileList | null) => {
    const picked = Array.from(pickedList ?? [])
    setCmpErr("")
    if (picked.length > 5) {
      setCmpErr("Chỉ được đính kèm tối đa 5 ảnh minh chứng.")
      return
    }
    for (const f of picked) {
      const validType =
        /^image\/(jpeg|jpg|png|webp)$/i.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name)
      if (!validType) {
        setCmpErr(`Tệp "${f.name}" không phải ảnh JPG, PNG hoặc WEBP hợp lệ.`)
        return
      }
      if (f.size > 10 * 1024 * 1024) {
        setCmpErr(`Ảnh "${f.name}" vượt quá dung lượng tối đa 10 MB.`)
        return
      }
    }
    setCmpFiles(picked)
  }

  const submitRecyclerComplaint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!complaintOrder || cmpBusy) return
    setCmpErr("")
    setFlash("")

    if (complaintOrder.status !== "done") {
      setCmpErr(
        "Chỉ được gửi khiếu nại giao dịch sau khi biên nhận bàn giao đã xác nhận hoàn tất.",
      )
      return
    }
    const cleanDesc = cmpDesc.trim()
    if (cleanDesc.length < 15) {
      setCmpErr("Nội dung mô tả khiếu nại phải có tối thiểu 15 ký tự.")
      return
    }
    if (cleanDesc.length > 2000) {
      setCmpErr("Nội dung mô tả khiếu nại không được vượt quá 2000 ký tự.")
      return
    }
    if (cmpFiles.length > 5) {
      setCmpErr("Chỉ được đính kèm tối đa 5 ảnh minh chứng.")
      return
    }

    setCmpBusy(true)
    try {
      const evidenceUrls: string[] = []
      for (const f of cmpFiles) {
        const up = await uploadComplaintEvidence(f)
        if (!up.data?.fileUrl) {
          throw new Error(`Không tải lên được ảnh minh chứng "${f.name}".`)
        }
        evidenceUrls.push(up.data.fileUrl)
      }
      const res = await submitComplaint({
        handoverRequestId: complaintOrder.id,
        category: cmpCategory,
        description: cleanDesc,
        evidencePhotoUrls: evidenceUrls,
      })
      setFlash(
        `Đã gửi khiếu nại ${res.data.complaintCode} cho đơn ${complaintOrder.displayCode}.`,
      )
      setComplaintOrder(null)
      setCmpDesc("")
      setCmpFiles([])
      if (hasLiveBackendAuth()) {
        void fetchMyComplaints({ role: "all", pageSize: 100 })
          .then((listRes) => {
            if (listRes.success && listRes.data) {
              setMyComplaints(listRes.data.items)
              setCmpPage(1)
            }
          })
          .catch(() => {})
      }
    } catch (err) {
      setCmpErr(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Không thể gửi phiếu khiếu nại cho đơn này.",
      )
    } finally {
      setCmpBusy(false)
    }
  }

  const reqKeyword = debouncedSearch.trim().toLowerCase()
  const matchRequest = (h: IncomingView) => {
    if (!reqKeyword) return true
    const wastes = h.lines.map((l) => nameOf(l.wasteId)).join(" ")
    return `${h.displayCode} ${h.address} ${h.citizenName ?? ""} ${wastes}`
      .toLowerCase()
      .includes(reqKeyword)
  }

  const pending = list.filter((h) => h.status === "pending" && matchRequest(h))
  const active = list.filter((h) => h.status !== "pending" && matchRequest(h))
  const pagedPending = paginateItems(pending, pendingPage, pendingPageSize)
  const pagedActive = paginateItems(active, activePage, activePageSize)

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="YÊU CẦU ĐẾN"
        title="Tiếp nhận yêu cầu bàn giao"
        body="Nhận yêu cầu nghĩa là bạn cam kết tới đúng khung giờ và điểm hẹn người dân đã ghim. Không tới được thì huỷ kèm lý do, họ sẽ tìm người khác."
      />

      <SearchFilterBar
        value={search}
        onChange={(v) => {
          setSearch(v)
          setPendingPage(1)
          setActivePage(1)
        }}
        label="Tìm kiếm yêu cầu"
        placeholder="Tìm theo mã đơn, tên người dân, địa chỉ điểm hẹn hoặc loại rác..."
        totalCount={pending.length + active.length}
        countLabel="yêu cầu"
      />

      {flash && (
        <p role="status" className="text-[13px] font-semibold text-brand">
          {flash}
        </p>
      )}
      {actionErr && (
        <p
          role="alert"
          className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn"
        >
          {actionErr}
        </p>
      )}

      <section>
        <h2 className="text-base font-bold text-ink">
          Chờ bạn xác nhận ({pending.length})
        </h2>
        {loading ? (
          <p className="card mt-3 px-5 py-8 text-center text-sm text-muted">
            Đang tải danh sách yêu cầu bàn giao...
          </p>
        ) : pending.length === 0 ? (
          <p className="card mt-3 px-5 py-8 text-center text-sm text-muted">
            Không có yêu cầu nào đang chờ xác nhận khớp bộ lọc.
          </p>
        ) : (
          <>
          <ul className="mt-3 flex flex-col gap-4">
            {pagedPending.map((h) => {
              const hasPin = typeof h.pickupLat === "number" && typeof h.pickupLng === "number"
              const mapExpanded = openMapId === h.id

              return (
                <li key={h.id} className="card flex flex-col gap-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-ink">{h.address}</p>
                        {h.rawStatus?.toLowerCase() === "negotiating" && (
                          <Status tone="wait">Đang thương lượng</Status>
                        )}
                      </div>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {h.displayCode}
                        {h.citizenName ? ` · Người gửi: ${h.citizenName}` : ""} · {h.date} · Khung
                        giờ đề xuất: <b className="text-ink">{h.slot}</b>
                      </p>
                    </div>
                    <p className="shrink-0 text-base font-bold tabular-nums text-brand">
                      {VND(calc(h, priceForOrder(h)).gross)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ul className="flex flex-wrap gap-2">
                      {h.lines.map((l) => (
                        <li
                          key={l.wasteId}
                          className="rounded-full bg-surface-2 px-3 py-1 text-xs text-body"
                        >
                          {nameOf(l.wasteId)} · {l.kg} kg
                        </li>
                      ))}
                    </ul>

                    {hasPin && (
                      <button
                        type="button"
                        onClick={() => setOpenMapId(mapExpanded ? null : h.id)}
                        className="btn-outline h-8 px-3 text-xs"
                      >
                        {mapExpanded
                          ? "Ẩn bản đồ điểm hẹn"
                          : `Xem ghim điểm hẹn (${h.pickupLat!.toFixed(4)}, ${h.pickupLng!.toFixed(4)})`}
                      </button>
                    )}
                  </div>

                  {hasPin && mapExpanded && (
                    <LocationPinPickerMap
                      lat={h.pickupLat!}
                      lng={h.pickupLng!}
                      readOnly
                      pinTitle={`Điểm hẹn ${h.displayCode}`}
                      heightClass="h-[200px]"
                    />
                  )}

                  <div className="flex flex-wrap gap-3 border-t border-line-soft pt-4">
                    <button
                      type="button"
                      disabled={busy === h.id}
                      onClick={() => void act(h, "accepted")}
                      className="btn-primary h-11 px-6"
                    >
                      Nhận và chốt khung giờ
                    </button>
                    <Link
                      to={`/chat?orderId=${encodeURIComponent(h.id)}`}
                      className="btn-outline h-11 px-5"
                    >
                      Chat thương lượng
                    </Link>
                    <button
                      type="button"
                      disabled={busy === h.id}
                      onClick={() => void act(h, "declined")}
                      className="btn-ghost h-11 px-5"
                    >
                      Từ chối
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          <PaginationBar
            page={pendingPage}
            pageSize={pendingPageSize}
            totalCount={pending.length}
            onPageChange={setPendingPage}
            itemLabel="yêu cầu chờ"
          />
          </>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold text-ink">Lịch đã nhận ({active.length})</h2>
        <div className="mt-3">
          {active.length === 0 ? (
            <p className="card px-5 py-6 text-center text-sm text-muted">
              Chưa có lịch hẹn nào đã nhận.
            </p>
          ) : (
            <>
            <Table head={["Mã", "Địa chỉ", "Khung giờ", "Tiền ước tính", "Trạng thái", "Thao tác"]}>
              {pagedActive.map((h) => (
                <tr key={h.id}>
                  <Td className="tabular-nums whitespace-nowrap">{h.displayCode}</Td>
                  <Td>
                    <div>{h.address}</div>
                    {h.citizenName && (
                      <div className="text-xs text-muted">Người gửi: {h.citizenName}</div>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {h.date} · {h.slot}
                  </Td>
                  <Td className="tabular-nums whitespace-nowrap">
                    {VND(calc(h, priceForOrder(h)).gross)}
                  </Td>
                  <Td>
                    {h.rawStatus?.toLowerCase() === "disputed" ? (
                      <Status tone="wait">Đang tranh chấp</Status>
                    ) : (
                      <Status tone={TONE[h.status]}>{STATUS_LABEL[h.status]}</Status>
                    )}
                  </Td>
                  <Td>
                    {h.status === "collected" ? (
                      <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
                        <Link
                          to={`/recycler/receipt?orderId=${encodeURIComponent(h.id)}`}
                          className="text-[13px] font-semibold text-brand hover:text-brand-deep"
                        >
                          Xem biên nhận
                        </Link>
                      </div>
                    ) : h.status === "accepted" ? (
                      <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
                        <Link
                          to={`/recycler/receipt?orderId=${encodeURIComponent(h.id)}`}
                          className="text-[13px] font-semibold text-brand hover:underline"
                        >
                          Cân &amp; Lập biên nhận
                        </Link>
                        <span className="text-muted">·</span>
                        <Link
                          to={`/chat?orderId=${encodeURIComponent(h.id)}`}
                          className="text-[13px] font-semibold text-body hover:underline"
                        >
                          Hỏi đường
                        </Link>
                        <span className="text-muted">·</span>
                        <button
                          type="button"
                          disabled={busy === h.id}
                          onClick={() => openCancelForm(h)}
                          className="text-[13px] font-semibold text-warn hover:underline"
                        >
                          Huỷ lịch
                        </button>
                      </div>
                    ) : h.fromBackend && h.status === "done" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setComplaintOrder(h)
                          setCmpCategory("ScaleDiscrepancy")
                          setCmpDesc("")
                          setCmpFiles([])
                          setCmpErr("")
                        }}
                        className="text-[13px] font-semibold text-warn hover:underline"
                      >
                        Khiếu nại giao dịch
                      </button>
                    ) : (
                      <span className="text-[13px] text-muted">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
            <PaginationBar
              page={activePage}
              pageSize={activePageSize}
              totalCount={active.length}
              onPageChange={setActivePage}
              itemLabel="lịch đã nhận"
            />
            </>
          )}
        </div>
      </section>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Sau khi tạo biên nhận và người dùng xác nhận khối lượng, biên nhận sẽ được lưu trữ để hai bên đối chiếu và ghi nhận Điểm Xanh. Các khung giờ thu gom: {TIME_SLOTS.join(" · ")}.
      </p>

      {cancelOrder && (
        <form
          noValidate
          onSubmit={(e) => void submitCancel(e)}
          className="card flex flex-col gap-4 border-warn/40 p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="eyebrow">HỦY LỊCH THU GOM (R-04)</span>
              <h3 className="mt-1 text-base font-bold text-ink">
                Hủy lịch thu gom đơn {cancelOrder.displayCode}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setCancelOrder(null)
                setCancelErr("")
              }}
              className="btn-ghost h-9 px-3 text-xs"
            >
              Đóng
            </button>
          </div>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
            <span>
              Lý do hủy lịch (tối thiểu 5 ký tự, người dân sẽ thấy lý do này)
              <RequiredMark />
            </span>
            <textarea
              className="input h-auto resize-y py-2.5 text-sm"
              rows={2}
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value)
                setCancelErr("")
              }}
              placeholder="Ví dụ: Xe thu gom gặp sự cố kỹ thuật đột xuất, không thể đến đúng khung giờ cam kết."
            />
          </label>

          {cancelErr && (
            <p
              role="alert"
              className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn"
            >
              {cancelErr}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy === cancelOrder.id}
              className="btn-primary h-10 px-5 text-xs"
            >
              {busy === cancelOrder.id ? "Đang hủy..." : "Xác nhận hủy lịch"}
            </button>
          </div>
        </form>
      )}

      {complaintOrder && (
        <form
          noValidate
          onSubmit={(e) => void submitRecyclerComplaint(e)}
          className="card flex flex-col gap-4 border-warn/40 p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="eyebrow">KHIẾU NẠI 2 CHIỀU (U-11)</span>
              <h3 className="mt-1 text-base font-bold text-ink">
                Gửi khiếu nại cho đơn {complaintOrder.displayCode}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setComplaintOrder(null)
                setCmpErr("")
              }}
              className="btn-ghost h-9 px-3 text-xs"
            >
              Đóng
            </button>
          </div>

          <p className="rounded-lg border border-line-soft bg-surface-2 px-3 py-2 text-xs text-muted">
            Ràng buộc BR-DSP-01/02: chỉ khiếu nại hai chiều trong vòng 7 ngày sau khi biên nhận bàn
            giao đã xác nhận hoàn tất, tối đa 1 phiếu đang xử lý trên mỗi đơn và mô tả 15–2000 ký
            tự.
          </p>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
            <span>
              Nhóm nguyên nhân
              <RequiredMark />
            </span>
            <select
              value={cmpCategory}
              onChange={(e) => {
                setCmpCategory(e.target.value as ComplaintCategoryCode)
                setCmpErr("")
              }}
              className="input h-10 text-sm"
            >
              {ALL_COMPLAINT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {COMPLAINT_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
            <span>
              Mô tả sự cố (15–2000 ký tự)
              <RequiredMark />
            </span>
            <textarea
              className="input h-auto resize-y py-2.5 text-sm"
              rows={3}
              value={cmpDesc}
              onChange={(e) => {
                setCmpDesc(e.target.value)
                setCmpErr("")
              }}
              placeholder="Ví dụ: Phát hiện sai lệch khối lượng hoặc phát sinh tranh chấp thanh toán sau khi xác nhận biên nhận."
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
            Ảnh hiện trường / biên nhận bằng chứng (tùy chọn, tối đa 5 ảnh JPG/PNG/WEBP ≤ 10 MB)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              multiple
              onChange={(e) => handleComplaintFileChange(e.target.files)}
              className="text-xs font-normal text-muted"
            />
          </label>

          {cmpErr && (
            <p
              role="alert"
              className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn"
            >
              {cmpErr}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={cmpBusy} className="btn-primary h-10 px-5 text-xs">
              {cmpBusy ? "Đang gửi..." : "Gửi phiếu khiếu nại"}
            </button>
          </div>
        </form>
      )}

      {myComplaints.length > 0 && (
        <section className="card flex flex-col gap-3 p-5">
          <div>
            <h2 className="text-base font-bold text-ink">
              Khiếu nại giao dịch liên quan ({myComplaints.length})
            </h2>
            <p className="mt-1 text-xs text-muted">
              Hạn khiếu nại: 7 ngày kể từ bàn giao/hủy · Tối đa 1 phiếu đang xử lý cho mỗi đơn · Mô tả từ 15–2000 ký tự.
            </p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {paginateItems(myComplaints, cmpPage, FIXED_PAGE_SIZE).map((c) => (
              <li
                key={c.complaintId}
                className="rounded-xl border border-line-soft bg-surface-2/60 p-3.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-ink">{c.complaintCode}</span>
                  <span className="rounded-full bg-surface-3 px-2.5 py-0.5 font-semibold text-brand-deep">
                    {COMPLAINT_STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </div>
                <p className="mt-1 text-muted">
                  Đơn {c.requestCode} · {COMPLAINT_CATEGORY_LABELS[c.category] || c.category} · Bên gửi:{" "}
                  <b>{c.complainantRole}</b>
                </p>
                <p className="mt-1.5 text-body">{c.description}</p>
                {c.resolutionOutcome && (
                  <div className="mt-2 rounded-lg border border-brand/20 bg-mint/10 p-2 text-brand-deep">
                    <b>Kết luận ({c.resolutionOutcome}):</b> {c.resolutionNote}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <PaginationBar
            page={cmpPage}
            totalCount={myComplaints.length}
            onPageChange={setCmpPage}
            itemLabel="khiếu nại"
          />
        </section>
      )}
    </div>
  )
}
