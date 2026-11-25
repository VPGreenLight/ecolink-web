import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import PaginationBar, { FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import { FormRequiredLegend, PageHead, RequiredMark, Status, Table, TableSkeleton, Td } from "@/components/Portal"
import SearchFilterBar from "@/components/SearchFilterBar"
import { ApiError } from "@/lib/api"
import { initApiLoading, initApiState, isSsrSmokeTest } from "@/lib/hydration"
import { fetchWasteCategories, type WasteCategoryItemDto } from "@/lib/wasteScanApi"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import {
  MY_HANDOVERS,
  STATUS_LABEL,
  TIME_SLOTS,
  TONE,
  buildScheduledAtIso,
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
  getRecyclerPublicDetail,
  searchNearbyRecyclers,
  type CollectionPartnerDto,
} from "@/lib/recyclerDiscoveryApi"
import {
  createHandoverOrder,
  fetchHandoverOrdersResult,
  fetchUserHandoverDetail,
  formatOrderDisplayCode,
  updateHandoverOrder,
  updateHandoverOrderStatus,
} from "@/lib/recyclerWorkflowApi"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type EditHandoverRow = {
  wasteCategoryId: string
  wasteId: string
  kg: number
  itemNote?: string
}

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0

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
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editErr, setEditErr] = useState("")
  const [editRows, setEditRows] = useState<EditHandoverRow[]>([])
  const [editDateIso, setEditDateIso] = useState<string>(() => getDefaultAppointmentDateAndSlot().dateIso)
  const [editSlot, setEditSlot] = useState<string>(() => TIME_SLOTS[0])
  const [editAddress, setEditAddress] = useState("")
  const [editLat, setEditLat] = useState<number>(LOCATION_PRESETS[0].lat)
  const [editLng, setEditLng] = useState<number>(LOCATION_PRESETS[0].lng)
  const [editNote, setEditNote] = useState("")
  const [editPhotoUrls, setEditPhotoUrls] = useState<string[]>([])
  const [editAllowedCodes, setEditAllowedCodes] = useState<Set<string> | null>(null)
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
  const [dynamicCategories, setDynamicCategories] = useState<WasteCategoryItemDto[]>([])

  useEffect(() => {
    if (isSsrSmokeTest()) return
    let active = true
    fetchWasteCategories()
      .then((cats) => {
        if (!active || !Array.isArray(cats)) return
        setDynamicCategories(
          cats.filter((c) => c.isRecyclable && (c.status ?? "Active") === "Active"),
        )
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const resolveWasteName = (wasteId: string) =>
    WASTES.find((w) => w.id === wasteId)?.name ??
    dynamicCategories.find((c) => c.code.toLowerCase() === wasteId.toLowerCase())?.name ??
    wasteId

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

  const resolveCatIdForWaste = (wasteIdOrCode: string) => {
    const mappedCode = (WASTE_TO_CAT[wasteIdOrCode] ?? wasteIdOrCode).toLowerCase()
    return (
      dynamicCategories.find((c) => c.code.toLowerCase() === mappedCode)?.id ??
      dynamicCategories[0]?.id ??
      wasteIdOrCode
    )
  }

  const openEditOrder = async (h: HandoverView) => {
    if (editId === h.id) {
      setEditId(null)
      setEditErr("")
      return
    }
    const parsedDate = parseViOrIsoDateToIsoInput(h.date)
    const defaultAppt = getDefaultAppointmentDateAndSlot()
    const initialDate =
      parsedDate &&
      parsedDate >= appointmentBounds.minDate &&
      parsedDate <= appointmentBounds.maxDate
        ? parsedDate
        : defaultAppt.dateIso

    setEditId(h.id)
    setEditErr("")
    setEditDateIso(initialDate)
    setEditSlot(TIME_SLOTS.includes(h.slot as (typeof TIME_SLOTS)[number]) ? h.slot : defaultAppt.slot)
    setEditAddress(h.address)
    setEditLat(typeof h.pickupLat === "number" ? h.pickupLat : LOCATION_PRESETS[0].lat)
    setEditLng(typeof h.pickupLng === "number" ? h.pickupLng : LOCATION_PRESETS[0].lng)
    setEditNote("")
    setEditPhotoUrls(["https://r2.ecolink.vn/handover/default-waste.jpg"])
    setEditAllowedCodes(null)
    setEditRows(
      h.lines.map((l) => ({
        wasteCategoryId: resolveCatIdForWaste(l.wasteId),
        wasteId: l.wasteId,
        kg: l.kg,
      })),
    )

    if (!UUID_REGEX.test(h.id)) return
    setEditLoading(true)
    try {
      const detail = await fetchUserHandoverDetail(h.id)
      if (!detail) return
      if (detail.items && detail.items.length > 0) {
        setEditRows(
          detail.items.map((it) => ({
            wasteCategoryId: it.wasteCategoryId,
            wasteId: it.wasteCategoryCode || it.wasteCategoryId,
            kg: it.estimatedWeightKg,
            itemNote: it.itemNote ?? undefined,
          })),
        )
      }
      if (detail.pickupAddress) setEditAddress(detail.pickupAddress)
      if (typeof detail.userNote === "string") setEditNote(detail.userNote)
      if (Array.isArray(detail.photoUrls) && detail.photoUrls.length > 0) {
        setEditPhotoUrls(detail.photoUrls)
      }
      if (detail.recycler?.id && UUID_REGEX.test(detail.recycler.id)) {
        void getRecyclerPublicDetail(detail.recycler.id)
          .then((pub) => {
            const codes = pub?.materials?.map((m) => m.categoryCode.toLowerCase()) ?? []
            if (codes.length > 0) setEditAllowedCodes(new Set(codes))
          })
          .catch(() => {})
      }
    } catch {
      // Giữ dữ liệu hiện có trên thẻ đơn nếu không nạp được chi tiết
    } finally {
      setEditLoading(false)
    }
  }

  const saveEditOrder = async (h: HandoverView, e: React.FormEvent) => {
    e.preventDefault()
    if (editSaving) return
    setEditErr("")
    setActionErr("")
    setFlash("")

    if (editRows.length === 0) {
      setEditErr("Yêu cầu bàn giao phải có ít nhất 1 loại phế liệu.")
      return
    }
    const seenCats = new Set<string>()
    for (const row of editRows) {
      if (!row.wasteCategoryId) {
        setEditErr("Vui lòng chọn loại phế liệu hợp lệ cho tất cả các dòng.")
        return
      }
      if (seenCats.has(row.wasteCategoryId)) {
        setEditErr("Mỗi loại phế liệu chỉ xuất hiện một dòng trong cùng yêu cầu.")
        return
      }
      seenCats.add(row.wasteCategoryId)
      if (
        !Number.isFinite(row.kg) ||
        row.kg <= 0 ||
        Math.abs(row.kg * 100 - Math.round(row.kg * 100)) > 1e-4
      ) {
        setEditErr("Khối lượng ước tính phải lớn hơn 0 kg (tối đa 2 chữ số thập phân).")
        return
      }
      if (row.itemNote && row.itemNote.trim().length > 200) {
        setEditErr("Ghi chú từng loại vật liệu tối đa 200 ký tự.")
        return
      }
    }

    const cleanAddress = editAddress.trim()
    if (cleanAddress.length < 5 || cleanAddress.length > 500) {
      setEditErr("Địa chỉ điểm hẹn phải từ 5 đến 500 ký tự.")
      return
    }
    if (editNote.trim().length > 200) {
      setEditErr("Ghi chú cho người thu gom không được vượt quá 200 ký tự.")
      return
    }

    const slotErr = validateAppointmentSelection(editDateIso, editSlot)
    if (slotErr) {
      setEditErr(slotErr)
      return
    }
    const proposedIso = buildScheduledAtIso(editDateIso, editSlot)
    if (new Date(proposedIso).getTime() < Date.now() + 2 * 3_600_000) {
      setEditErr("Thời gian hẹn mới phải cách thời điểm hiện tại ít nhất 2 giờ (BR-HND-02).")
      return
    }

    setEditSaving(true)
    const nextDateVi = formatIsoDateToVi(editDateIso)
    try {
      const res = await updateHandoverOrder(h.id, {
        items: editRows.map((r) => ({
          wasteCategoryId: r.wasteCategoryId,
          wasteId: r.wasteId,
          estimatedWeightKg: r.kg,
          itemNote: r.itemNote,
        })),
        photoUrls: editPhotoUrls,
        proposedTimeSlotIso: proposedIso,
        dateVi: nextDateVi,
        slot: editSlot,
        pickupAddress: cleanAddress,
        latitude: editLat,
        longitude: editLng,
        userNote: editNote.trim() || null,
      })

      const nextLines =
        res.order?.items?.map((it) => ({
          wasteId: it.wasteCategoryCode || it.wasteCategoryId,
          kg: it.estimatedWeightKg,
        })) ??
        editRows.map((r) => ({ wasteId: r.wasteId, kg: r.kg }))

      setList((ls) =>
        ls.map((item) =>
          item.id === h.id
            ? {
                ...item,
                date: nextDateVi,
                slot: editSlot,
                address: cleanAddress,
                pickupLat: editLat,
                pickupLng: editLng,
                lines: nextLines,
              }
            : item,
        ),
      )
      setEditId(null)
      setFlash(
        `${h.displayCode}: ${res.message}${res.syncedWithBackend ? " (đã đồng bộ CSDL)" : ""}.`,
      )
    } catch (err) {
      setEditErr(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Không thể cập nhật yêu cầu bàn giao.",
      )
    } finally {
      setEditSaving(false)
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
          dynamicCategories={dynamicCategories}
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
          const wastes = h.lines.map((l) => resolveWasteName(l.wasteId)).join(" ")
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
                        onClick={() => void openEditOrder(h)}
                        className="btn-outline h-9 px-3 text-[13px]"
                      >
                        {editId === h.id ? "Đóng chỉnh sửa" : "Chỉnh sửa yêu cầu"}
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
                      <Td className="font-semibold text-ink">{resolveWasteName(l.wasteId)}</Td>
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
                  <form
                    noValidate
                    onSubmit={(e) => void saveEditOrder(h, e)}
                    className="mt-4 flex flex-col gap-4 rounded-xl border border-brand/30 bg-brand/6 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-ink">
                        Chỉnh sửa chi tiết yêu cầu (U-07)
                      </p>
                      {editLoading && (
                        <span className="text-xs text-muted">Đang tải chi tiết đơn...</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-ink">
                          Danh sách vật liệu &amp; khối lượng ước tính
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const pool =
                              editAllowedCodes && dynamicCategories.length > 0
                                ? dynamicCategories.filter((c) =>
                                    editAllowedCodes.has(c.code.toLowerCase()),
                                  )
                                : dynamicCategories
                            const chosenIds = new Set(editRows.map((r) => r.wasteCategoryId))
                            const unused = (pool.length > 0 ? pool : dynamicCategories).find(
                              (c) => !chosenIds.has(c.id),
                            )
                            if (!unused) {
                              setEditErr("Đã chọn hết các loại phế liệu khả dụng cho cơ sở này.")
                              return
                            }
                            setEditRows((rs) => [
                              ...rs,
                              { wasteCategoryId: unused.id, wasteId: unused.code, kg: 2 },
                            ])
                            setEditErr("")
                          }}
                          className="text-xs font-semibold text-brand-deep hover:underline"
                        >
                          + Thêm loại rác
                        </button>
                      </div>
                      {editRows.map((row, idx) => {
                        const categoryPool =
                          editAllowedCodes && dynamicCategories.length > 0
                            ? dynamicCategories.filter(
                                (c) =>
                                  editAllowedCodes.has(c.code.toLowerCase()) ||
                                  c.id === row.wasteCategoryId,
                              )
                            : dynamicCategories
                        return (
                          <div
                            key={`${row.wasteCategoryId}-${idx}`}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-2.5"
                          >
                            {categoryPool.length > 0 ? (
                              <select
                                aria-label="Loại phế liệu"
                                className="input h-9 min-w-[160px] flex-1 text-xs"
                                value={row.wasteCategoryId}
                                onChange={(e) => {
                                  const nextCatId = e.target.value
                                  const cat = categoryPool.find((c) => c.id === nextCatId)
                                  setEditRows((rs) =>
                                    rs.map((r, n) =>
                                      n === idx
                                        ? {
                                            ...r,
                                            wasteCategoryId: nextCatId,
                                            wasteId: cat?.code ?? r.wasteId,
                                          }
                                        : r,
                                    ),
                                  )
                                  setEditErr("")
                                }}
                              >
                                {categoryPool.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                className="input h-9 flex-1 text-xs"
                                value={resolveWasteName(row.wasteId)}
                                readOnly
                              />
                            )}
                            <label className="flex items-center gap-1.5 text-xs font-medium text-ink">
                              <span>Kg:</span>
                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                className="input h-9 w-24 text-right text-xs tabular-nums"
                                value={Number.isFinite(row.kg) ? row.kg : ""}
                                onChange={(e) => {
                                  const val = Number(e.target.value)
                                  setEditRows((rs) =>
                                    rs.map((r, n) => (n === idx ? { ...r, kg: val } : r)),
                                  )
                                  setEditErr("")
                                }}
                              />
                            </label>
                            {editRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditRows((rs) => rs.filter((_, n) => n !== idx))
                                }
                                className="btn-ghost h-9 px-2.5 text-xs text-warn"
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
                        Ngày hẹn thu gom
                        <input
                          type="date"
                          className="input h-10 bg-white text-xs"
                          min={appointmentBounds.minDate}
                          max={appointmentBounds.maxDate}
                          value={editDateIso}
                          onChange={(e) => {
                            setEditDateIso(e.target.value)
                            setEditErr("")
                          }}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
                        Ghi chú cho người thu gom
                        <input
                          className="input h-10 bg-white text-xs"
                          value={editNote}
                          onChange={(e) => {
                            setEditNote(e.target.value)
                            setEditErr("")
                          }}
                          placeholder="Ví dụ: Gọi trước 15 phút khi đến cổng..."
                        />
                      </label>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-ink">Khung giờ thu gom</p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {TIME_SLOTS.map((s) => {
                          const past = isTimeSlotInPastForDate(editDateIso, s)
                          const selected = s === editSlot
                          return (
                            <button
                              key={s}
                              type="button"
                              disabled={past}
                              onClick={() => {
                                setEditSlot(s)
                                setEditErr("")
                              }}
                              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                past
                                  ? "border-line bg-surface-2 text-muted cursor-not-allowed opacity-60"
                                  : selected
                                    ? "border-brand bg-brand text-white"
                                    : "border-brand/40 bg-white text-brand hover:bg-brand/10"
                              }`}
                            >
                              {s}
                              {past ? " (đã qua)" : ""}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
                      Địa chỉ điểm hẹn lấy hàng
                      <input
                        className="input h-10 bg-white text-xs"
                        value={editAddress}
                        onChange={(e) => {
                          setEditAddress(e.target.value)
                          setEditErr("")
                        }}
                      />
                    </label>
                    <LocationPinPickerMap
                      lat={editLat}
                      lng={editLng}
                      pinTitle="Điểm hẹn cập nhật"
                      onChange={(nextLat, nextLng, hint) => {
                        setEditLat(nextLat)
                        setEditLng(nextLng)
                        if (hint) setEditAddress(hint)
                      }}
                    />

                    {editErr && (
                      <p
                        role="alert"
                        className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-xs font-semibold text-warn"
                      >
                        {editErr}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={editSaving}
                        className="btn-primary h-10 px-5 text-xs"
                      >
                        {editSaving ? "Đang lưu cập nhật..." : "Lưu cập nhật yêu cầu"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(null)
                          setEditErr("")
                        }}
                        className="btn-ghost h-10 px-4 text-xs"
                      >
                        Hủy chỉnh sửa
                      </button>
                    </div>
                  </form>
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
  dynamicCategories,
  onDone,
}: {
  initialPartnerId?: string
  initialPartner?: string
  initialWasteId?: string
  dynamicCategories: WasteCategoryItemDto[]
  onDone: (d: Draft) => void
}) {
  const staticRecyclables = WASTES.filter((w) => w.recyclable)
  const coveredCatCodes = new Set(
    staticRecyclables.map((w) => (WASTE_TO_CAT[w.id] ?? w.id).toLowerCase()),
  )
  const activeCatCodes =
    dynamicCategories.length > 0
      ? new Set(dynamicCategories.map((c) => c.code.toLowerCase()))
      : null

  const dynamicExtraWastes = dynamicCategories
    .filter((c) => !coveredCatCodes.has(c.code.toLowerCase()))
    .map((c) => ({
      id: c.code,
      name: c.name,
      price: 4000,
      recyclable: true,
    }))

  const availableWastes: { id: string; name: string; price: number; recyclable: boolean }[] =
    activeCatCodes
      ? [
          ...staticRecyclables.filter((w) =>
            activeCatCodes.has((WASTE_TO_CAT[w.id] ?? w.id).toLowerCase()),
          ),
          ...dynamicExtraWastes,
        ]
      : staticRecyclables

  const validInitialWaste = availableWastes.some((w) => w.id === initialWasteId)
    ? (initialWasteId as string)
    : (availableWastes[0]?.id ?? "pet")

  const [rows, setRows] = useState([{ wasteId: validInitialWaste, kg: 5 }])

  useEffect(() => {
    if (availableWastes.length === 0) return
    const validIds = new Set(availableWastes.map((w) => w.id))
    const fallbackId = availableWastes[0].id
    setRows((prev) =>
      prev.every((row) => validIds.has(row.wasteId))
        ? prev
        : prev.map((row) => (validIds.has(row.wasteId) ? row : { ...row, wasteId: fallbackId })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicCategories])
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
    const fallbackPrice = availableWastes.find((w) => w.id === wasteId)?.price ?? priceOf(wasteId)
    return mat?.pricePerKg ?? (fallbackPrice > 0 ? fallbackPrice : 4000)
  }

  const set = (i: number, patch: Partial<{ wasteId: string; kg: number }>) =>
    setRows((r) => r.map((row, n) => (n === i ? { ...row, ...patch } : row)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (availableWastes.length === 0) {
      setErr("Hiện chưa có danh mục phế liệu nào đang hoạt động để đặt lịch thu gom.")
      return
    }
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
                disabled={availableWastes.length === 0}
                onChange={(e) => set(i, { wasteId: e.target.value })}
              >
                {availableWastes.length === 0 ? (
                  <option value="">Hiện không có loại phế liệu khả dụng</option>
                ) : (
                  availableWastes.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} · {VND(partnerPriceOf(w.id))}/kg
                    </option>
                  ))
                )}
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
        disabled={availableWastes.length === 0}
        onClick={() =>
          setRows((r) => [
            ...r,
            { wasteId: availableWastes[0]?.id ?? "carton", kg: 5 },
          ])
        }
        className="btn-outline h-10 w-fit px-4 text-[13px] disabled:opacity-50"
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
