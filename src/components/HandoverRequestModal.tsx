import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { MapPin, Plus, Trash2, X } from "lucide-react"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import { FormRequiredLegend, RequiredMark } from "@/components/Portal"
import {
  TIME_SLOTS,
  formatIsoDateToVi,
  getAppointmentDateBounds,
  getDefaultAppointmentDateAndSlot,
  isTimeSlotInPastForDate,
  validateAppointmentSelection,
} from "@/data/handover"
import { VND, WASTES } from "@/data/waste"
import { isSsrSmokeTest } from "@/lib/hydration"
import {
  LOCATION_PRESETS,
  searchNearbyRecyclers,
  type CollectionPartnerDto,
} from "@/lib/recyclerDiscoveryApi"
import { createHandoverOrder } from "@/lib/recyclerWorkflowApi"
import { fetchWasteCategories, type WasteCategoryItemDto } from "@/lib/wasteScanApi"

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

const DEFAULT_PARTNER_ID = "22222222-2222-2222-2222-222222222222"
const DEFAULT_PARTNER_NAME = "Vựa phế liệu EcoGreen"
const DEFAULT_PICKUP_ADDRESS =
  "Cổng phụ Khu CNC Hòa Lạc (gần ĐH FPT), Xã Tân Xã, Thạch Thất, Hà Nội"

export interface HandoverCreatedPayload {
  id: string
  displayCode: string
  orderCode?: string
  syncedWithBackend: boolean
  partnerId?: string
  partnerName?: string
  slot: string
  dateVi: string
  address: string
  weightKg: number
  unitPricePerKg: number
  categoryCode: string
}

interface HandoverRequestModalProps {
  open: boolean
  onClose: () => void
  initialPartnerId?: string
  initialPartnerName?: string
  initialWaste?: string
  onCreated: (created: HandoverCreatedPayload) => void
}

/** Form tạo yêu cầu bàn giao tích hợp trực tiếp trong `/chat`. */
export default function HandoverRequestModal({
  open,
  onClose,
  initialPartnerId = "",
  initialPartnerName = "",
  initialWaste = "",
  onCreated,
}: HandoverRequestModalProps) {
  const [dynamicCategories, setDynamicCategories] = useState<WasteCategoryItemDto[] | null>(null)
  const availableWastes =
    dynamicCategories !== null
      ? dynamicCategories.map((c) => {
          const fallback = WASTES.find(
            (w) =>
              w.id === c.code.toLowerCase() ||
              w.name.toLowerCase().includes(c.name.toLowerCase()),
          )
          return {
            id: c.code.toLowerCase(),
            name: c.name,
            price: fallback?.price ?? 5000,
          }
        })
      : WASTES.map((w) => ({ id: w.id, name: w.name, price: w.price }))

  const defaultWasteId = availableWastes[0]?.id ?? "pet"
  const [rows, setRows] = useState<Array<{ wasteId: string; kg: number }>>(() => [
    { wasteId: initialWaste || defaultWasteId, kg: 3 },
  ])
  const [appointmentDate, setAppointmentDate] = useState<string>(
    () => getDefaultAppointmentDateAndSlot().dateIso,
  )
  const [slot, setSlot] = useState<string>(() => getDefaultAppointmentDateAndSlot().slot)
  const dateBounds = getAppointmentDateBounds()
  const [address, setAddress] = useState(DEFAULT_PICKUP_ADDRESS)
  const [pickupLat, setPickupLat] = useState<number>(LOCATION_PRESETS[0].lat)
  const [pickupLng, setPickupLng] = useState<number>(LOCATION_PRESETS[0].lng)
  const [showMapPicker, setShowMapPicker] = useState(false)

  const [partners, setPartners] = useState<CollectionPartnerDto[]>([])
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    initialPartnerId || DEFAULT_PARTNER_ID,
  )
  const [selectedPartnerName, setSelectedPartnerName] = useState<string>(
    initialPartnerName || DEFAULT_PARTNER_NAME,
  )
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!open || isSsrSmokeTest()) return
    let active = true
    void fetchWasteCategories()
      .then((cats) => {
        if (active && cats.length > 0) setDynamicCategories(cats)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setErr("")
    if (initialPartnerId) setSelectedPartnerId(initialPartnerId)
    if (initialPartnerName) setSelectedPartnerName(initialPartnerName)
    if (initialWaste) {
      setRows((prev) =>
        prev.length === 1 ? [{ ...prev[0], wasteId: initialWaste }] : prev,
      )
    }
  }, [open, initialPartnerId, initialPartnerName, initialWaste])

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

  useEffect(() => {
    if (!open || isSsrSmokeTest()) return
    let active = true
    void searchNearbyRecyclers({ lat: pickupLat, lng: pickupLng, radiusKm: 50 })
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
            if (matched) setSelectedPartnerName(matched.facilityName)
          }
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [open, initialPartnerId, pickupLat, pickupLng])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  const selectedPartnerObj = partners.find((p) => p.id === selectedPartnerId)
  const partnerPriceOf = (wasteId: string) => {
    const catCode = WASTE_TO_CAT[wasteId] ?? wasteId
    const mat = selectedPartnerObj?.materials?.find(
      (m) => m.categoryCode.toLowerCase() === catCode.toLowerCase() && m.pricePerKg > 0,
    )
    const fallbackPrice = availableWastes.find((w) => w.id === wasteId)?.price ?? 5000
    return mat?.pricePerKg ?? (fallbackPrice > 0 ? fallbackPrice : 4000)
  }

  const updateRow = (index: number, patch: Partial<{ wasteId: string; kg: number }>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const grossEstimate = rows.reduce((sum, r) => sum + r.kg * partnerPriceOf(r.wasteId), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (availableWastes.length === 0) {
      setErr("Hiện chưa có danh mục phế liệu nào đang hoạt động để đặt lịch thu gom.")
      return
    }
    if (rows.length === 0 || rows.some((r) => !Number.isFinite(r.kg) || r.kg <= 0)) {
      setErr("Khối lượng mỗi loại phế liệu phải lớn hơn 0 kg.")
      return
    }
    const scheduleErr = validateAppointmentSelection(appointmentDate, slot)
    if (scheduleErr) {
      setErr(scheduleErr)
      return
    }
    const cleanAddr = address.trim()
    if (!cleanAddr) {
      setErr("Cần ghi mô tả điểm hẹn (ví dụ: đầu ngõ, sảnh tòa nhà) để cơ sở tìm tới.")
      return
    }
    if (cleanAddr.length > 255) {
      setErr("Mô tả điểm hẹn không được vượt quá 255 ký tự.")
      return
    }

    setErr("")
    setSubmitting(true)
    try {
      const primaryWaste = rows[0]?.wasteId ?? "plastic"
      const primaryPrice = partnerPriceOf(primaryWaste)
      const totalKg = rows.reduce((s, r) => s + r.kg, 0)
      const result = await createHandoverOrder({
        partnerId: selectedPartnerId || initialPartnerId || undefined,
        partnerName: selectedPartnerName || initialPartnerName || undefined,
        rows: rows.map((r) => ({
          wasteId: r.wasteId,
          kg: r.kg,
          unitPrice: partnerPriceOf(r.wasteId),
        })),
        appointmentDateIso: appointmentDate,
        slot,
        pickupAddress: cleanAddr,
        pickupLat,
        pickupLng,
      })

      onCreated({
        id: result.id,
        displayCode: result.displayCode,
        orderCode: result.orderCode,
        syncedWithBackend: result.syncedWithBackend,
        partnerId: selectedPartnerId || initialPartnerId || undefined,
        partnerName: result.partnerName || selectedPartnerName || initialPartnerName || undefined,
        slot,
        dateVi: formatIsoDateToVi(appointmentDate),
        address: cleanAddr,
        weightKg: totalKg,
        unitPricePerKg: primaryPrice,
        categoryCode: WASTE_TO_CAT[primaryWaste] ?? primaryWaste,
      })
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Không thể tạo yêu cầu bàn giao.")
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tạo yêu cầu bàn giao phế liệu"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/55 p-3 backdrop-blur-xs sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-line bg-surface-2/80 p-1 shadow-[0_24px_64px_-12px_rgba(15,31,21,0.32)]"
      >
        <div className="max-h-[90dvh] overflow-y-auto rounded-[14px] bg-surface p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-line-soft pb-3.5">
            <div>
              <p className="eyebrow">ĐẶT LỊCH BÀN GIAO TRONG CHAT</p>
              <h2 className="mt-0.5 text-lg font-bold text-ink">Tạo yêu cầu bàn giao mới</h2>
              <FormRequiredLegend className="mt-1" />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng biểu mẫu tạo yêu cầu bàn giao"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-muted transition-colors hover:text-ink"
            >
              <X className="size-4.5" />
            </button>
          </div>

          <form noValidate onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              <span>
                Cơ sở thu mua tiếp nhận đơn <RequiredMark />
              </span>
              <select
                value={selectedPartnerId}
                onChange={(e) => {
                  const nextId = e.target.value
                  setSelectedPartnerId(nextId)
                  const matched = partners.find((p) => p.id === nextId)
                  if (matched) setSelectedPartnerName(matched.facilityName)
                  else if (nextId === DEFAULT_PARTNER_ID) setSelectedPartnerName(DEFAULT_PARTNER_NAME)
                }}
                className="input min-h-12 text-base sm:text-[15px]"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.facilityName} · {p.address}
                  </option>
                ))}
                {!partners.some((p) => p.id === DEFAULT_PARTNER_ID) && (
                  <option value={DEFAULT_PARTNER_ID}>{DEFAULT_PARTNER_NAME} (Mặc định)</option>
                )}
              </select>
            </label>

            <div className="rounded-xl border border-line bg-surface-2/50 p-3.5">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">Phế liệu &amp; khối lượng</span>
                <button
                  type="button"
                  onClick={() => setRows((prev) => [...prev, { wasteId: defaultWasteId, kg: 2 }])}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-brand/30 bg-white px-3 text-xs font-semibold text-brand-deep transition-colors hover:bg-brand/8"
                >
                  <Plus className="size-3.5" />
                  Thêm loại khác
                </button>
              </div>
              <ul className="flex flex-col gap-2.5">
                {rows.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-end gap-2.5">
                    <label className="flex w-full min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-ink sm:min-w-[200px]">
                      <span>
                        Loại phế liệu <RequiredMark />
                      </span>
                      <select
                        value={r.wasteId}
                        disabled={availableWastes.length === 0}
                        onChange={(e) => updateRow(i, { wasteId: e.target.value })}
                        className="input min-h-11 text-base sm:text-[15px]"
                      >
                        {availableWastes.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} · {VND(partnerPriceOf(w.id))}/kg
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex w-full flex-col gap-1.5 text-sm font-semibold text-ink sm:w-32">
                      <span>
                        Khối lượng (kg) <RequiredMark />
                      </span>
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={r.kg}
                        onChange={(e) => updateRow(i, { kg: Number(e.target.value) })}
                        className="input min-h-11 text-base tabular-nums sm:text-[15px]"
                      />
                    </label>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label="Xóa dòng phế liệu"
                        className="btn-ghost min-h-11 px-3 text-sm text-muted hover:text-warn"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-right text-sm text-body">
                Ước tính nhận được:{" "}
                <strong className="font-bold text-brand-deep tabular-nums">
                  {VND(grossEstimate)}
                </strong>
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                <span>
                  Ngày hẹn thu gom <RequiredMark />
                </span>
                <input
                  type="date"
                  min={dateBounds.minDate}
                  max={dateBounds.maxDate}
                  value={appointmentDate}
                  onChange={(e) => {
                    const nextDate = e.target.value
                    setAppointmentDate(nextDate)
                    setErr("")
                    if (nextDate && isTimeSlotInPastForDate(nextDate, slot)) {
                      const firstValid = TIME_SLOTS.find(
                        (s) => !isTimeSlotInPastForDate(nextDate, s),
                      )
                      if (firstValid) setSlot(firstValid)
                    }
                  }}
                  className="input min-h-12 text-base sm:text-[15px]"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                <span>
                  Khung giờ bàn giao <RequiredMark />
                </span>
                <select
                  value={slot}
                  onChange={(e) => {
                    setSlot(e.target.value)
                    setErr("")
                  }}
                  className="input min-h-12 text-base sm:text-[15px]"
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

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="chat-handover-address"
                  className="text-sm font-semibold text-ink"
                >
                  Điểm hẹn bàn giao (đầu ngõ / sảnh tòa nhà) <RequiredMark />
                </label>
                <button
                  type="button"
                  onClick={() => setShowMapPicker((v) => !v)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-brand-deep transition-colors hover:border-sage-line"
                >
                  <MapPin className="size-3.5" />
                  {showMapPicker ? "Ẩn bản đồ" : "Chấm ghim bản đồ"}
                </button>
              </div>
              <input
                id="chat-handover-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ví dụ: Cổng phụ Khu CNC Hòa Lạc (gần ĐH FPT)"
                className="input min-h-12 text-base sm:text-[15px]"
              />
              {showMapPicker && (
                <div className="mt-2.5 overflow-hidden rounded-xl border border-line">
                  <LocationPinPickerMap
                    lat={pickupLat}
                    lng={pickupLng}
                    heightClass="h-56"
                    onChange={(lat, lng, addressHint) => {
                      setPickupLat(lat)
                      setPickupLng(lng)
                      if (addressHint) setAddress(addressHint)
                    }}
                  />
                </div>
              )}
            </div>

            {err && (
              <p
                role="alert"
                className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm leading-6 font-medium text-warn"
              >
                {err}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost min-h-11 px-4 text-sm font-semibold"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary min-h-11 px-5 text-sm font-semibold"
              >
                {submitting ? "Đang gửi yêu cầu..." : "Tạo yêu cầu & mở chat"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  )
}
