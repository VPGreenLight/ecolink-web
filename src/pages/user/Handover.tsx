import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import {
  MY_HANDOVERS,
  STATUS_LABEL,
  TIME_SLOTS,
  TONE,
  calc,
  type Handover as HandoverItem,
} from "@/data/handover"
import { VND, WASTES, estimate } from "@/data/waste"
import { LOCATION_PRESETS } from "@/lib/recyclerDiscoveryApi"
import {
  createHandoverOrder,
  fetchSyncedHandoverOrders,
} from "@/lib/recyclerWorkflowApi"

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0
const nameOf = (id: string) => WASTES.find((w) => w.id === id)?.name ?? id

type HandoverView = HandoverItem & {
  pickupLat?: number
  pickupLng?: number
}

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
  const [list, setList] = useState<HandoverView[]>(MY_HANDOVERS)
  const [editId, setEditId] = useState<string | null>(null)
  const [flash, setFlash] = useState("")

  useEffect(() => {
    let active = true
    void fetchSyncedHandoverOrders("user").then((synced) => {
      if (!active || synced.length === 0) return
      const existingIds = new Set(MY_HANDOVERS.map((m) => m.id))
      const fresh: HandoverView[] = synced
        .filter((s) => !existingIds.has(s.id))
        .map((s) => ({
          id: s.id,
          recycler: s.recycler,
          address: s.address,
          date: s.date,
          slot: s.slot,
          lines: s.lines,
          status: s.status === "accepted" ? "accepted" : "pending",
          pickupLat: s.pickupLat,
          pickupLng: s.pickupLng,
        }))
      if (fresh.length > 0) {
        setList([...fresh, ...MY_HANDOVERS])
      }
    })
    return () => {
      active = false
    }
  }, [])

  const reslot = (id: string, slot: string) => {
    setList((ls) => ls.map((h) => (h.id === id ? { ...h, slot } : h)))
    setEditId(null)
    setFlash(`${id}: đã đổi khung giờ sang ${slot}. Người thu gom sẽ thấy giờ mới.`)
  }

  const cancel = (h: HandoverView) => {
    const reason = window.prompt(`Huỷ yêu cầu ${h.id}. Lý do (người thu gom sẽ thấy):`)
    if (!reason?.trim()) return
    setList((ls) =>
      ls.map((x) =>
        x.id === h.id ? { ...x, status: "cancelled", reason: reason.trim() } : x,
      ),
    )
    setFlash(`${h.id}: đã huỷ. Người thu gom sẽ không tới.`)
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

      {open && (
        <CreateForm
          initialPartnerId={prefilledPartnerId}
          initialPartner={prefilledPartner}
          initialWasteId={prefilledWaste}
          onDone={(draft) => {
            setList((ls) => [newRow(draft), ...ls])
            setOpen(false)
            setFlash(
              draft.recyclerName
                ? `Đã gửi yêu cầu ${draft.orderCode} tới ${draft.recyclerName}${draft.syncedWithBackend ? " (đã lưu CSDL)" : ""}. Đối tác sẽ xác nhận khung giờ trong hôm nay.`
                : `Đã gửi yêu cầu ${draft.orderCode}. Người thu gom sẽ xác nhận khung giờ trong hôm nay.`,
            )
          }}
        />
      )}

      {list.length === 0 ? (
        <p className="card px-5 py-8 text-center text-sm text-muted">
          Bạn chưa có yêu cầu nào. Bấm "Tạo yêu cầu mới" để đặt lịch thu gom.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.map((h) => (
            <li key={h.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-ink">{h.recycler}</span>
                    <Status tone={TONE[h.status]}>{STATUS_LABEL[h.status]}</Status>
                  </p>
                  <p className="mt-1 text-[13px] text-muted">
                    {h.id} · {h.date} · {h.slot}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {h.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditId(editId === h.id ? null : h.id)}
                        className="btn-outline h-9 px-3 text-[13px]"
                      >
                        {editId === h.id ? "Đóng" : "Đổi giờ"}
                      </button>
                      <button
                        type="button"
                        onClick={() => cancel(h)}
                        className="btn-ghost h-9 px-3 text-[13px]"
                      >
                        Huỷ yêu cầu
                      </button>
                      <Link
                        to={`/chat?orderId=${encodeURIComponent(h.id)}&partnerName=${encodeURIComponent(h.recycler)}`}
                        className="btn-outline h-9 px-3 text-[13px] font-medium text-brand"
                      >
                        Thương lượng giá &amp; giờ
                      </Link>
                    </>
                  )}
                  {h.status === "accepted" && (
                    <Link
                      to={`/chat?orderId=${encodeURIComponent(h.id)}&partnerName=${encodeURIComponent(h.recycler)}`}
                      className="btn-outline h-9 px-3 text-[13px]"
                    >
                      Nhắn đối tác (Hỏi đường)
                    </Link>
                  )}
                  {h.status === "collected" && (
                    <Link to="/user/receipt" className="btn-primary h-9 px-3 text-[13px]">
                      Xác nhận biên nhận
                    </Link>
                  )}
                  {h.status === "done" && (
                    <Link to="/user/transactions" className="btn-ghost h-9 px-3 text-[13px]">
                      Xem tiền đã nhận
                    </Link>
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
                        {VND(l.kg * priceOf(l.wasteId))}
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
                      {VND(calc(h, priceOf).gross)}
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
                  <div className="mt-3 rounded-lg border border-brand/30 bg-brand/6 p-4">
                    <p className="text-[13px] font-semibold text-ink">
                      Chọn khung giờ thu gom khác
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {TIME_SLOTS.filter((s) => s !== h.slot).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => reslot(h.id, s)}
                          className="rounded-full border border-brand bg-white px-3.5 py-2 text-[13px] font-medium text-brand transition-colors hover:bg-brand/10"
                        >
                          {s}
                        </button>
                      ))}
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
          ))}
        </ul>
      )}
    </div>
  )
}

type Draft = {
  orderCode: string
  syncedWithBackend: boolean
  rows: { wasteId: string; kg: number }[]
  slot: string
  address: string
  pickupLat: number
  pickupLng: number
  recyclerName?: string
}

function newRow(d: Draft): HandoverView {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, "0")
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const yyyy = now.getFullYear()
  return {
    id: d.orderCode,
    recycler: d.recyclerName || "Vựa phế liệu EcoGreen",
    address: d.address,
    date: `${dd}/${mm}/${yyyy}`,
    slot: d.slot,
    lines: d.rows.map((r) => ({ wasteId: r.wasteId, kg: r.kg })),
    status: "pending",
    pickupLat: d.pickupLat,
    pickupLng: d.pickupLng,
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
  const [slot, setSlot] = useState<string>(TIME_SLOTS[1])
  const [address, setAddress] = useState("Đầu ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1")
  const [pickupLat, setPickupLat] = useState<number>(LOCATION_PRESETS[0].lat)
  const [pickupLng, setPickupLng] = useState<number>(LOCATION_PRESETS[0].lng)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState("")

  const set = (i: number, patch: Partial<{ wasteId: string; kg: number }>) =>
    setRows((r) => r.map((row, n) => (n === i ? { ...row, ...patch } : row)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const bad = rows.find((r) => r.kg <= 0)
    if (bad) {
      setErr("Khối lượng phải lớn hơn 0 kg.")
      return
    }
    if (!address.trim()) {
      setErr("Cần ghi mô tả điểm hẹn (ví dụ: đầu ngõ, sảnh toà nhà) để người thu gom tìm tới.")
      return
    }
    setErr("")
    setSubmitting(true)
    try {
      const result = await createHandoverOrder({
        partnerId: initialPartnerId || undefined,
        partnerName: initialPartner || undefined,
        rows: rows.map((r) => ({
          wasteId: r.wasteId,
          kg: r.kg,
          unitPrice: priceOf(r.wasteId),
        })),
        slot,
        pickupAddress: address,
        pickupLat,
        pickupLng,
      })

      onDone({
        orderCode: result.orderCode,
        syncedWithBackend: result.syncedWithBackend,
        rows,
        slot,
        address,
        pickupLat,
        pickupLng,
        recyclerName: initialPartner || undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const { gross } = estimate(rows)

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="card flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-ink">Thông tin rác & điểm hẹn bàn giao</h2>
        {initialPartner && (
          <span className="rounded-full border border-brand/25 bg-brand/8 px-3 py-1 text-xs font-semibold text-brand-deep">
            Đối tác đã chọn: {initialPartner}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[180px] flex-1 flex-col gap-2 text-[13px] font-semibold text-ink">
              Loại rác
              <select
                className="input"
                value={r.wasteId}
                onChange={(e) => set(i, { wasteId: e.target.value })}
              >
                {WASTES.filter((w) => w.recyclable).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} · {VND(w.price)}/kg
                  </option>
                ))}
              </select>
            </label>
            <label className="flex w-32 flex-col gap-2 text-[13px] font-semibold text-ink">
              Khối lượng (kg)
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

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
          Khung giờ muốn thu gom
          <select className="input" value={slot} onChange={(e) => setSlot(e.target.value)}>
            {TIME_SLOTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
          Mô tả điểm hẹn (đầu ngõ, sảnh chung cư, cột mốc dễ tìm)
          <input
            className="input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink">
          Ghim điểm hẹn trên bản đồ (chỉ chia sẻ cho cơ sở nhận đơn — BR-MTH-05)
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

      {err && <p className="text-[13px] text-warn">{err}</p>}

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
