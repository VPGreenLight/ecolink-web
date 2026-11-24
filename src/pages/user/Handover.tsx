import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import PaginationBar, { FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import { FormRequiredLegend, PageHead, RequiredMark, Status, Table, TableSkeleton, Td } from "@/components/Portal"
import SearchFilterBar from "@/components/SearchFilterBar"
import { ApiError } from "@/lib/api"
import { initApiLoading, initApiState } from "@/lib/hydration"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import {
  MY_HANDOVERS,
  STATUS_LABEL,
  TIME_SLOTS,
  TONE,
  calc,
  formatIsoDateToVi,
  getAppointmentDateBounds,
  getDefaultAppointmentDateAndSlot,
  isTimeSlotInPastForDate,
  parseViOrIsoDateToIsoInput,
  validateAppointmentSelection,
  type Handover as HandoverItem,
} from "@/data/handover"
import { VND, WASTES } from "@/data/waste"
import {
  LOCATION_PRESETS,
  searchNearbyRecyclers,
  type CollectionPartnerDto,
} from "@/lib/recyclerDiscoveryApi"
import {
  createHandoverOrder,
  fetchHandoverOrdersResult,
  formatOrderDisplayCode,
  updateHandoverOrderStatus,
  updateHandoverOrderTimeSlot,
} from "@/lib/recyclerWorkflowApi"

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0
const nameOf = (id: string) => WASTES.find((w) => w.id === id)?.name ?? id

const WASTE_TO_CAT: Record<string, string> = {
  pet: "plastic",
  hdpe: "plastic",
  carton: "cardboard",
  "office-paper": "paper",
  paper: "paper",
  aluminum: "metal",
  steel: "metal",
  glass: "glass",
}

type HandoverView = HandoverItem & {
  displayCode: string
  rawStatus?: string
  unitPricePerKg?: number
  pickupLat?: number
  pickupLng?: number
  fromBackend?: boolean
}

const priceForOrder = (h: HandoverView) => (wasteId: string) =>
  h.unitPricePerKg && h.unitPricePerKg > 0 && wasteId === h.lines[0]?.wasteId
    ? h.unitPricePerKg
    : priceOf(wasteId)

const DEFAULT_OFFLINE_HANDOVERS: HandoverView[] = MY_HANDOVERS.map((m) => ({
  ...m,
  displayCode: formatOrderDisplayCode(m.id),
  fromBackend: false,
}))

/** U-07 Tạo yêu cầu (kèm chấm điểm hẹn đầu ngõ `BR-MTH-05`) · U-08 Sửa / Huỷ yêu cầu.
 *
 *  Nhận trực tiếp tham số `?partnerId=...&partnerName=...&waste=...` từ trang Bản đồ (U-05)
 *  để mở sẵn biểu mẫu đặt lịch với đúng cơ sở thu mua và loại phế liệu đã chọn.
 *  Người dân chủ động chọn điểm gặp mặt thuận tiện (đầu ngõ, sảnh chung cư, góc phố)
 *  thay vì hệ thống tự thu thập địa chỉ nhà riêng khi dạo bản đồ. */
export default function Handover() {
  const [searchParams] = useSearchParams()
  const prefilledPartnerId = searchParams.get("partnerId") ?? ""
  const prefilledPartner = searchParams.get("partnerName") ?? ""
  const prefilledWaste = searchParams.get("waste") ?? ""

  const [open, setOpen] = useState(() => Boolean(prefilledPartner || prefilledWaste))
  const [list, setList] = useState<HandoverView[]>(() =>
    initApiState([], DEFAULT_OFFLINE_HANDOVERS),
  )
  const [loading, setLoading] = useState<boolean>(() => initApiLoading(true))
  const [editId, setEditId] = useState<string | null>(null)
  const [editDateIso, setEditDateIso] = useState<string>(() => getDefaultAppointmentDateAndSlot().dateIso)
  const [cancelOrder, setCancelOrder] = useState<HandoverView | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelErr, setCancelErr] = useState("")
  const [cancelling, setCancelling] = useState(false)
  const [flash, setFlash] = useState("")
  const [actionErr, setActionErr] = useState("")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const pageSize = FIXED_PAGE_SIZE
  const appointmentBounds = getAppointmentDateBounds()

  useEffect(() => {
    let active = true
    void fetchHandoverOrdersResult("user")
      .then((res) => {
        if (!active) return
        const mapped: HandoverView[] = res.orders.map((s) => ({
          id: s.id,
          displayCode: s.displayCode || formatOrderDisplayCode(s.id),
          recycler: s.recycler,
          address: s.address,
          date: s.date,
          slot: s.slot,
          lines: s.lines,
          status: s.status,
          rawStatus: s.rawStatus,
          unitPricePerKg: s.agreedPricePerKg ?? s.initialPricePerKg,
          reason: s.reason,
          pickupLat: s.pickupLat,
          pickupLng: s.pickupLng,
          fromBackend: s.fromBackend,
        }))

        if (res.fromBackend) {
          // Khi kết nối PostgreSQL thành công: hiển thị đúng các đơn thật của tài khoản hiện tại
          setList(mapped)
        } else if (mapped.length > 0) {
          const existingIds = new Set(DEFAULT_OFFLINE_HANDOVERS.map((m) => m.id))
          const fresh = mapped.filter((s) => !existingIds.has(s.id))
          setList([...fresh, ...DEFAULT_OFFLINE_HANDOVERS])
        } else {
          setList(DEFAULT_OFFLINE_HANDOVERS)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const reslot = async (h: HandoverView, nextDateIso: string, slot: string) => {
    setActionErr("")
    setFlash("")
    const errMsg = validateAppointmentSelection(nextDateIso, slot)
    if (errMsg) {
      setActionErr(errMsg)
      return
    }
    const nextDateVi = formatIsoDateToVi(nextDateIso)
    try {
      const res = await updateHandoverOrderTimeSlot(h.id, slot, nextDateIso)
      setList((ls) =>
        ls.map((item) => (item.id === h.id ? { ...item, date: nextDateVi, slot } : item)),
      )
      setEditId(null)
      setFlash(
        `${h.displayCode}: đã đổi lịch hẹn sang ${nextDateVi} · ${slot}${res.syncedWithBackend ? " (đã cập nhật CSDL)" : ""}. Người thu gom sẽ thấy lịch mới.`,
      )
    } catch (err) {
      setActionErr(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Không thể cập nhật lịch hẹn.",
      )
    }
  }

  const openCancelModal = (h: HandoverView) => {
    setCancelOrder(h)
    setCancelReason("")
    setCancelErr("")
    setActionErr("")
  }

  const submitCancel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cancelOrder || cancelling) return
    const cleanReason = cancelReason.trim()
    if (cleanReason.length < 5) {
      setCancelErr("Vui lòng nhập lý do hủy yêu cầu tối thiểu 5 ký tự.")
      return
    }
    if (cleanReason.length > 500) {
      setCancelErr("Lý do hủy yêu cầu không được vượt quá 500 ký tự.")
      return
    }
    setCancelErr("")
    setActionErr("")
    setFlash("")
    setCancelling(true)
    try {
      const res = await updateHandoverOrderStatus(
        cancelOrder.id,
        "user",
        "Cancelled",
        cleanReason,
      )
      setList((ls) =>
        ls.map((x) =>
          x.id === cancelOrder.id ? { ...x, status: "cancelled", reason: cleanReason } : x,
        ),
      )
      setFlash(
        `${cancelOrder.displayCode}: đã huỷ${res.syncedWithBackend ? " trên hệ thống" : ""}. Người thu gom sẽ không tới.`,
      )
      setCancelOrder(null)
      setCancelReason("")
    } catch (err) {
      setCancelErr(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Không thể hủy yêu cầu trên hệ thống.",
      )
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="BÀN GIAO"
        title="Yêu cầu thu gom rác"
        body="Đặt lịch thu gom, chấm điểm hẹn đầu ngõ hoặc sảnh chung cư và chọn khung giờ thuận tiện. Bạn có thể sửa giờ hoặc huỷ khi đối tác chưa nhận."
        action={
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn-primary h-11 shrink-0 px-5"
          >
            {open ? "Đóng form" : "Tạo yêu cầu mới"}
          </button>
        }
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
      {cancelOrder && (
        <form
          noValidate
          onSubmit={(e) => void submitCancel(e)}
          className="card flex flex-col gap-4 border-warn/40 p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="eyebrow">HỦY YÊU CẦU THU GOM (U-08)</span>
              <h2 className="mt-1 text-base font-bold text-ink">
                Hủy yêu cầu {cancelOrder.displayCode}
              </h2>
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
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
            <span>
              Lý do hủy (tối thiểu 5 ký tự, người thu gom sẽ thấy lý do này)
              <RequiredMark />
            </span>
            <textarea
              rows={2}
              className="input h-auto resize-y py-2.5 text-sm"
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value)
                setCancelErr("")
              }}
              placeholder="Ví dụ: Đổi kế hoạch giao rác sang cuối tuần."
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
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={cancelling}
              className="btn-primary h-10 px-5 text-xs"
            >
              {cancelling ? "Đang hủy..." : "Xác nhận hủy yêu cầu"}
            </button>
          </div>
        </form>
      )}

      {open && (
        <CreateForm
          initialPartnerId={prefilledPartnerId}
          initialPartner={prefilledPartner}
          initialWasteId={prefilledWaste}
          onDone={(draft) => {
            setList((ls) => [newRow(draft), ...ls.filter((x) => x.id !== draft.id)])
            setOpen(false)
            setFlash(
              draft.recyclerName
                ? `Đã gửi yêu cầu ${draft.displayCode} tới ${draft.recyclerName}${draft.syncedWithBackend ? " (đã lưu trên hệ thống)" : ""}. Đối tác sẽ xác nhận lịch hẹn (${draft.dateVi} · ${draft.slot}).`
                : `Đã gửi yêu cầu ${draft.displayCode} (${draft.dateVi} · ${draft.slot}). Người thu gom sẽ xác nhận lịch hẹn.`,
            )
          }}
        />
      )}

      {(() => {
        const kw = debouncedSearch.trim().toLowerCase()
        const filteredList = list.filter((h) => {
          if (statusFilter !== "all" && h.status !== statusFilter) return false
          if (!kw) return true
          const wastes = h.lines.map((l) => nameOf(l.wasteId)).join(" ")
          return `${h.displayCode} ${h.recycler} ${h.address} ${wastes}`.toLowerCase().includes(kw)
        })
        const pagedList = paginateItems(filteredList, page, pageSize)

        return (
          <>
            <SearchFilterBar
              value={search}
              onChange={(v) => {
                setSearch(v)
                setPage(1)
              }}
              label="Tìm kiếm yêu cầu thu gom"
              placeholder="Tìm theo mã đơn, tên cơ sở, địa chỉ hoặc loại rác..."
              totalCount={filteredList.length}
              countLabel="yêu cầu"
            >
              <select
                aria-label="Lọc trạng thái đơn thu gom"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="input h-10 text-xs"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="pending">Chờ nhận</option>
                <option value="accepted">Đã nhận lịch</option>
                <option value="collected">Chờ xác nhận biên nhận</option>
                <option value="done">Hoàn tất</option>
                <option value="cancelled">Đã huỷ</option>
              </select>
            </SearchFilterBar>

            {loading ? (
              <TableSkeleton rows={4} />
            ) : list.length === 0 ? (
              <p className="card px-5 py-8 text-center text-sm text-muted">
                Bạn chưa có yêu cầu nào trên hệ thống. Bấm &quot;Tạo yêu cầu mới&quot; để đặt lịch thu gom.
              </p>
            ) : filteredList.length === 0 ? (
              <p className="card px-5 py-8 text-center text-sm text-muted">
                Không có yêu cầu thu gom nào khớp bộ lọc hiện tại.
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-4">
                  {pagedList.map((h) => {
            const rowPrice = priceForOrder(h)
            return (
            <li key={h.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-ink">{h.recycler}</span>
                    <Status tone={h.rawStatus?.toLowerCase() === "negotiating" ? "wait" : TONE[h.status]}>
                      {h.rawStatus?.toLowerCase() === "negotiating"
                        ? "Đang thương lượng"
                        : STATUS_LABEL[h.status]}
                    </Status>
                  </p>
                  <p className="mt-1 text-[13px] text-muted">
                    {h.displayCode} · {h.date} · {h.slot}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {h.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (editId === h.id) {
                            setEditId(null)
                          } else {
                            const parsedDate = parseViOrIsoDateToIsoInput(h.date)
                            const defaultDate = getDefaultAppointmentDateAndSlot().dateIso
                            const initialDate =
                              parsedDate &&
                              parsedDate >= appointmentBounds.minDate &&
                              parsedDate <= appointmentBounds.maxDate
                                ? parsedDate
                                : defaultDate
                            setEditDateIso(initialDate)
                            setEditId(h.id)
                          }
                        }}
                        className="btn-outline h-9 px-3 text-[13px]"
                      >
                        {editId === h.id ? "Đóng" : "Đổi lịch hẹn"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openCancelModal(h)}
                        className="btn-ghost h-9 px-3 text-[13px]"
                      >
                        Huỷ yêu cầu
                      </button>
                      <Link
                        to={`/chat?orderId=${encodeURIComponent(h.id)}&partnerName=${encodeURIComponent(h.recycler)}&partnerAddress=${encodeURIComponent(h.address)}`}
                        className="btn-outline h-9 px-3 text-[13px] font-medium text-brand"
                      >
                        Thương lượng giá &amp; giờ
                      </Link>
                    </>
                  )}
                  {h.status === "accepted" && (
                    <Link
                      to={`/chat?orderId=${encodeURIComponent(h.id)}&partnerName=${encodeURIComponent(h.recycler)}&partnerAddress=${encodeURIComponent(h.address)}`}
                      className="btn-outline h-9 px-3 text-[13px]"
                    >
                      Nhắn đối tác (Hỏi đường)
                    </Link>
                  )}
                  {h.status === "collected" && (
                    <Link
                      to={`/user/receipt?orderId=${encodeURIComponent(h.id)}`}
                      className="btn-primary h-9 px-3 text-[13px]"
                    >
                      Xác nhận biên nhận
                    </Link>
                  )}
                  {h.status === "done" && (
                    <>
                      <Link
                        to={`/user/receipt?orderId=${encodeURIComponent(h.id)}`}
                        className="btn-primary h-9 px-3 text-[13px]"
                      >
                        Biên nhận &amp; Đánh giá sao
                      </Link>
                      <Link
                        to={`/chat?orderId=${encodeURIComponent(h.id)}&partnerName=${encodeURIComponent(h.recycler)}&partnerAddress=${encodeURIComponent(h.address)}`}
                        className="btn-outline h-9 px-3 text-[13px]"
                      >
                        Xem lại Chat
                      </Link>
                      <Link to="/user/transactions" className="btn-ghost h-9 px-3 text-[13px]">
                        Xem tiền đã nhận
                      </Link>
                      {h.fromBackend && (
                        <Link
                          to={`/feedback?tab=complaint&orderId=${encodeURIComponent(h.id)}`}
                          className="btn-ghost h-9 px-3 text-[13px] text-warn"
                        >
                          Khiếu nại giao dịch
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="px-5 py-4">
                <Table head={["Loại rác", "Khối lượng ước tính", "Thành tiền ước tính"]}>
                  {(h.actual ?? h.lines).map((l) => (
                    <tr key={l.wasteId}>
                      <Td className="font-semibold text-ink">{nameOf(l.wasteId)}</Td>
                      <Td className="tabular-nums">{l.kg.toLocaleString("vi-VN")} kg</Td>
                      <Td className="tabular-nums">
                        {VND(l.kg * rowPrice(l.wasteId))}
                      </Td>
                    </tr>
                  ))}
                  <tr>
                    <Td className="font-bold text-ink">
                      {h.actual ? "Khối lượng thực nhận" : "Tổng cộng ước tính"}
                    </Td>
                    <Td className="tabular-nums font-bold text-ink">
                      {(h.actual ?? h.lines)
                        .reduce((s, l) => s + l.kg, 0)
                        .toLocaleString("vi-VN")}{" "}
                      kg
                    </Td>
                    <Td className="tabular-nums font-bold text-brand">
                      {VND(calc(h, rowPrice).gross)}
                    </Td>
                  </tr>
                </Table>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] leading-5 text-muted">
                  <span>Điểm hẹn: {h.address}</span>
                  {typeof h.pickupLat === "number" && typeof h.pickupLng === "number" && (
                    <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs tabular-nums text-brand-deep">
                      Ghim hẹn GPS: {h.pickupLat.toFixed(4)}, {h.pickupLng.toFixed(4)}
                    </span>
                  )}
                </div>

                {editId === h.id && (
                  <div className="mt-3 rounded-lg border border-brand/30 bg-brand/6 p-4 flex flex-col gap-3">
                    <div className="flex flex-wrap items-end gap-4">
                      <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink">
                        Chọn ngày hẹn thu gom
                        <input
                          type="date"
                          className="input h-10 bg-white text-sm"
                          min={appointmentBounds.minDate}
                          max={appointmentBounds.maxDate}
                          value={editDateIso}
                          onChange={(e) => setEditDateIso(e.target.value)}
                        />
                      </label>
                      <p className="text-xs text-muted pb-2">
                        Hỗ trợ từ hôm nay ({formatIsoDateToVi(appointmentBounds.minDate)}) đến +30 ngày tới
                      </p>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-ink">
                        Chọn khung giờ thu gom
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {TIME_SLOTS.map((s) => {
                          const past = isTimeSlotInPastForDate(editDateIso, s)
                          const isSameSchedule =
                            s === h.slot && formatIsoDateToVi(editDateIso) === h.date
                          return (
                            <button
                              key={s}
                              type="button"
                              disabled={past || isSameSchedule}
                              onClick={() => void reslot(h, editDateIso, s)}
                              className={`rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                                past || isSameSchedule
                                  ? "border-line bg-surface-2 text-muted cursor-not-allowed opacity-60"
                                  : "border-brand bg-white text-brand hover:bg-brand/10"
                              }`}
                            >
                              {s}
                              {past ? " (đã qua)" : isSameSchedule ? " (hiện tại)" : ""}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {h.reason && (
                  <p className="mt-2 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-[13px] leading-5 text-body">
                    <b className="text-ink">Lý do huỷ:</b> {h.reason}
                  </p>
                )}
              </div>
            </li>
            )
          })}
        </ul>
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalCount={filteredList.length}
          onPageChange={setPage}
          itemLabel="yêu cầu"
        />
        </>
      )}
          </>
        )
      })()}
    </div>
  )
}

type Draft = {
  id: string
  displayCode: string
  orderCode: string
  syncedWithBackend: boolean
  rows: { wasteId: string; kg: number }[]
  unitPricePerKg?: number
  dateVi: string
  slot: string
  address: string
  pickupLat: number
  pickupLng: number
  recyclerName?: string
}

function newRow(d: Draft): HandoverView {
  return {
    id: d.id,
    displayCode: d.displayCode,
    recycler: d.recyclerName || "Vựa phế liệu EcoGreen",
    address: d.address,
    date: d.dateVi,
    slot: d.slot,
    lines: d.rows.map((r) => ({ wasteId: r.wasteId, kg: r.kg })),
    unitPricePerKg: d.unitPricePerKg,
    status: "pending",
    pickupLat: d.pickupLat,
    pickupLng: d.pickupLng,
    fromBackend: d.syncedWithBackend,
  }
}

function CreateForm({
  initialPartnerId,
  initialPartner,
  initialWasteId,
  onDone,
}: {
  initialPartnerId?: string
  initialPartner?: string
  initialWasteId?: string
  onDone: (d: Draft) => void
}) {
  const validInitialWaste = WASTES.some((w) => w.recyclable && w.id === initialWasteId)
    ? (initialWasteId as string)
    : "pet"

  const [rows, setRows] = useState([{ wasteId: validInitialWaste, kg: 5 }])
  const [appointmentDate, setAppointmentDate] = useState<string>(
    () => getDefaultAppointmentDateAndSlot().dateIso,
  )
  const [slot, setSlot] = useState<string>(
    () => getDefaultAppointmentDateAndSlot().slot,
  )
  const formDateBounds = getAppointmentDateBounds()
  const [address, setAddress] = useState(
    "Cổng phụ Khu CNC Hòa Lạc (gần ĐH FPT), Xã Tân Xã, Thạch Thất, Hà Nội",
  )
  const [pickupLat, setPickupLat] = useState<number>(LOCATION_PRESETS[0].lat)
  const [pickupLng, setPickupLng] = useState<number>(LOCATION_PRESETS[0].lng)
  const [partners, setPartners] = useState<CollectionPartnerDto[]>([])
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    initialPartnerId || "22222222-2222-2222-2222-222222222222",
  )
  const [selectedPartnerName, setSelectedPartnerName] = useState<string>(
    initialPartner || "Vựa phế liệu EcoGreen",
  )
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    let active = true
    void searchNearbyRecyclers({
      lat: pickupLat,
      lng: pickupLng,
      radiusKm: 50,
    })
      .then((res) => {
        if (!active) return
        const items = res.data?.items ?? []
        if (items.length > 0) {
          setPartners(items)
          if (!initialPartnerId) {
            setSelectedPartnerId(items[0].id)
            setSelectedPartnerName(items[0].facilityName)
          } else {
            const matched = items.find((p) => p.id === initialPartnerId)
            if (matched) {
              setSelectedPartnerName(matched.facilityName)
            }
          }
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [initialPartnerId, pickupLat, pickupLng])

  const selectedPartnerObj = partners.find((p) => p.id === selectedPartnerId)
  const partnerPriceOf = (wasteId: string) => {
    const catCode = WASTE_TO_CAT[wasteId] ?? wasteId
    const mat = selectedPartnerObj?.materials?.find(
      (m) => m.categoryCode.toLowerCase() === catCode.toLowerCase() && m.pricePerKg > 0,
    )
    return mat?.pricePerKg ?? priceOf(wasteId)
  }

  const set = (i: number, patch: Partial<{ wasteId: string; kg: number }>) =>
    setRows((r) => r.map((row, n) => (n === i ? { ...row, ...patch } : row)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rows.length === 0) {
      setErr("Cần ít nhất một loại rác bàn giao.")
      return
    }
    const bad = rows.find((r) => !Number.isFinite(r.kg) || r.kg <= 0)
    if (bad) {
      setErr("Khối lượng mỗi loại rác phải lớn hơn 0 kg.")
      return
    }
    const scheduleErr = validateAppointmentSelection(appointmentDate, slot)
    if (scheduleErr) {
      setErr(scheduleErr)
      return
    }
    if (!address.trim()) {
      setErr("Cần ghi mô tả điểm hẹn (ví dụ: đầu ngõ, sảnh toà nhà) để người thu gom tìm tới.")
      return
    }
    if (address.trim().length > 255) {
      setErr("Mô tả điểm hẹn không được vượt quá 255 ký tự.")
      return
    }
    setErr("")
    setSubmitting(true)
    try {
      const primaryUnitPrice = rows[0] ? partnerPriceOf(rows[0].wasteId) : 5500
      const result = await createHandoverOrder({
        partnerId: selectedPartnerId || initialPartnerId || undefined,
        partnerName: selectedPartnerName || initialPartner || undefined,
        rows: rows.map((r) => ({
          wasteId: r.wasteId,
          kg: r.kg,
          unitPrice: partnerPriceOf(r.wasteId),
        })),
        appointmentDateIso: appointmentDate,
        slot,
        pickupAddress: address,
        pickupLat,
        pickupLng,
      })

      onDone({
        id: result.id,
        displayCode: result.displayCode,
        orderCode: result.orderCode,
        syncedWithBackend: result.syncedWithBackend,
        rows,
        unitPricePerKg: primaryUnitPrice,
        dateVi: formatIsoDateToVi(appointmentDate),
        slot,
        address,
        pickupLat,
        pickupLng,
        recyclerName: result.partnerName || selectedPartnerName || initialPartner || undefined,
      })
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Không thể tạo yêu cầu bàn giao.")
    } finally {
      setSubmitting(false)
    }
  }

  const gross = rows.reduce((sum, r) => sum + r.kg * partnerPriceOf(r.wasteId), 0)

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="card flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ink">Thông tin rác &amp; điểm hẹn bàn giao</h2>
          <FormRequiredLegend className="mt-1" />
        </div>
        <span className="rounded-full border border-brand/25 bg-brand/8 px-3 py-1 text-xs font-semibold text-brand-deep">
          Đối tác nhận đơn: {selectedPartnerName}
        </span>
      </div>

      <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
        <span>
          Cơ sở thu mua tiếp nhận đơn
          <RequiredMark />
        </span>
        <select
          className="input"
          value={selectedPartnerId}
          onChange={(e) => {
            const nextId = e.target.value
            setSelectedPartnerId(nextId)
            const matched = partners.find((p) => p.id === nextId)
            if (matched) {
              setSelectedPartnerName(matched.facilityName)
            } else if (nextId === "22222222-2222-2222-2222-222222222222") {
              setSelectedPartnerName("Vựa phế liệu EcoGreen")
            }
          }}
        >
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.facilityName} · {p.address}
            </option>
          ))}
          {!partners.some((p) => p.id === "22222222-2222-2222-2222-222222222222") && (
            <option value="22222222-2222-2222-2222-222222222222">
              Vựa phế liệu EcoGreen (Cơ sở mặc định)
            </option>
          )}
        </select>
      </label>

      <ul className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[180px] flex-1 flex-col gap-2 text-[13px] font-semibold text-ink">
              <span>
                Loại rác
                <RequiredMark />
              </span>
              <select
                className="input"
                value={r.wasteId}
                onChange={(e) => set(i, { wasteId: e.target.value })}
              >
                {WASTES.filter((w) => w.recyclable).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} · {VND(partnerPriceOf(w.id))}/kg
                  </option>
                ))}
              </select>
            </label>
            <label className="flex w-32 flex-col gap-2 text-[13px] font-semibold text-ink">
              <span>
                Khối lượng (kg)
                <RequiredMark />
              </span>
              <input
                className="input"
                type="number"
                min={0.5}
                step={0.5}
                value={r.kg}
                onChange={(e) => set(i, { kg: Number(e.target.value) })}
              />
            </label>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((_, n) => n !== i))}
                className="btn-ghost h-12 px-4"
              >
                Bỏ dòng
              </button>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setRows((r) => [...r, { wasteId: "carton", kg: 5 }])}
        className="btn-outline h-10 w-fit px-4 text-[13px]"
      >
        Thêm loại rác
      </button>

      <div className="grid items-start gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
          <span className="min-h-5 leading-5">
            Ngày hẹn thu gom
            <RequiredMark />
          </span>
          <input
            type="date"
            className="input h-10"
            min={formDateBounds.minDate}
            max={formDateBounds.maxDate}
            value={appointmentDate}
            onChange={(e) => {
              const nextDate = e.target.value
              setAppointmentDate(nextDate)
              setErr("")
              if (nextDate && isTimeSlotInPastForDate(nextDate, slot)) {
                const firstValid = TIME_SLOTS.find((s) => !isTimeSlotInPastForDate(nextDate, s))
                if (firstValid) setSlot(firstValid)
              }
            }}
            required
          />
          <span className="text-[11px] font-normal text-muted">
            Chọn từ hôm nay ({formatIsoDateToVi(formDateBounds.minDate)}) đến tối đa 30 ngày tới
          </span>
        </label>
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
          <span className="min-h-5 leading-5">
            Khung giờ thu gom
            <RequiredMark />
          </span>
          <select
            className="input h-10"
            value={slot}
            onChange={(e) => {
              setSlot(e.target.value)
              setErr("")
            }}
          >
            {TIME_SLOTS.map((s) => {
              const past = isTimeSlotInPastForDate(appointmentDate, s)
              return (
                <option key={s} value={s} disabled={past}>
                  {s}
                  {past ? " (đã qua)" : ""}
                </option>
              )
            })}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
        <span>
          Mô tả điểm hẹn (đầu ngõ, sảnh chung cư, cột mốc dễ tìm)
          <RequiredMark />
        </span>
        <input
          className="input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink">
          Ghim điểm hẹn trên bản đồ (chỉ chia sẻ cho cơ sở nhận đơn — BR-MTH-05)
          <RequiredMark />
        </span>
        <span className="text-[12px] text-muted">
          Bạn có thể ghim tại đầu ngõ, sảnh toà nhà hoặc bật làm mờ ~500m nếu muốn hẹn thêm qua khung chat.
        </span>
        <LocationPinPickerMap
          lat={pickupLat}
          lng={pickupLng}
          allowPrivacyFuzz
          defaultPrivacyFuzz={false}
          pinTitle="Điểm hẹn bàn giao"
          heightClass="h-[230px]"
          onChange={(nextLat, nextLng, addressHint) => {
            setPickupLat(nextLat)
            setPickupLng(nextLng)
            if (addressHint && !address.trim()) {
              setAddress(addressHint)
            }
          }}
        />
      </div>

      {err && (
        <p role="alert" className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn">
          {err}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary h-11 px-6"
        >
          {submitting ? "Đang tạo đơn..." : "Gửi yêu cầu"}
        </button>
        <p className="text-[13px] text-muted">
          Tiền tạm tính <b className="tabular-nums text-ink">{VND(gross)}</b> ·
          người thu gom xác nhận sẽ chốt khung giờ và khối lượng thực tế.
        </p>
      </div>
    </form>
  )
}
