import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import {
  INCOMING,
  STATUS_LABEL,
  TIME_SLOTS,
  TONE,
  calc,
  type Handover as HandoverItem,
} from "@/data/handover"
import { VND, WASTES } from "@/data/waste"
import {
  fetchHandoverOrdersResult,
  formatOrderDisplayCode,
  updateHandoverOrderStatus,
} from "@/lib/recyclerWorkflowApi"
import { ApiError } from "@/lib/api"
import {
  COMPLAINT_CATEGORY_LABELS,
  submitComplaint,
  uploadComplaintEvidence,
  type ComplaintCategoryCode,
} from "@/lib/reviewComplaintApi"

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0
const nameOf = (id: string) => WASTES.find((w) => w.id === id)?.name ?? id

type IncomingView = HandoverItem & {
  displayCode: string
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

/** R-03 Tiếp nhận / Từ chối yêu cầu bàn giao (kèm xem ghim điểm hẹn đầu ngõ của Người dân).
 *
 *  Nhận = chốt luôn khung giờ User đề xuất, nên bấm Nhận là một cam kết thời
 *  gian. Đã cam kết rồi mà đổi lịch thì phải qua R-04 (huỷ kèm lý do) chứ
 *  không sửa lặng lẽ. */
export default function Requests() {
  const [list, setList] = useState<IncomingView[]>(DEFAULT_OFFLINE_INCOMING)
  const [busy, setBusy] = useState("")
  const [flash, setFlash] = useState("")
  const [openMapId, setOpenMapId] = useState<string | null>(null)
  const [complaintOrder, setComplaintOrder] = useState<IncomingView | null>(null)
  const [cmpCategory, setCmpCategory] = useState<ComplaintCategoryCode>("NoShow")
  const [cmpDesc, setCmpDesc] = useState("")
  const [cmpFiles, setCmpFiles] = useState<File[]>([])
  const [cmpBusy, setCmpBusy] = useState(false)

  useEffect(() => {
    let active = true
    void fetchHandoverOrdersResult("recycler").then((res) => {
      if (!active) return
      const mapped: IncomingView[] = res.orders.map((s) => ({
        id: s.id,
        displayCode: s.displayCode || formatOrderDisplayCode(s.id),
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
      }
    })
    return () => {
      active = false
    }
  }, [])

  const act = async (h: IncomingView, next: "accepted" | "declined") => {
    setBusy(h.id)
    try {
      setList((ls) => ls.map((l) => (l.id === h.id ? { ...l, status: next } : l)))
      const res = await updateHandoverOrderStatus(
        h.id,
        "recycler",
        next === "accepted" ? "Accepted" : "Rejected",
      )
      setFlash(
        next === "accepted"
          ? `Đã tiếp nhận đơn ${h.displayCode} và chốt khung giờ ${h.slot}${res.syncedWithBackend ? " (đã lưu PostgreSQL)" : ""}.`
          : `Đã từ chối đơn ${h.displayCode}${res.syncedWithBackend ? " (đã cập nhật PostgreSQL)" : ""}.`,
      )
    } finally {
      setBusy("")
    }
  }

  /** R-04 huỷ lịch giữa chừng: bắt buộc có lý do vì người dùng đang chờ. */
  const cancel = async (h: IncomingView) => {
    const reason = window.prompt(
      `Lý do huỷ lịch thu gom ${h.displayCode} (người dùng sẽ thấy lý do này):`,
    )
    if (!reason?.trim()) return
    const cleanReason = reason.trim()
    setBusy(h.id)
    try {
      setList((ls) =>
        ls.map((l) =>
          l.id === h.id ? { ...l, status: "broken", reason: cleanReason } : l,
        ),
      )
      const res = await updateHandoverOrderStatus(
        h.id,
        "recycler",
        "Cancelled",
        cleanReason,
      )
      setFlash(
        `Đã huỷ lịch thu gom ${h.displayCode}${res.syncedWithBackend ? " trên PostgreSQL" : ""}.`,
      )
    } finally {
      setBusy("")
    }
  }

  const submitRecyclerComplaint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!complaintOrder) return
    const cleanDesc = cmpDesc.trim()
    if (cleanDesc.length < 15) {
      setFlash("Nội dung mô tả khiếu nại phải có tối thiểu 15 ký tự.")
      return
    }
    setCmpBusy(true)
    setFlash("")
    try {
      const evidenceUrls: string[] = []
      for (const f of cmpFiles.slice(0, 5)) {
        const up = await uploadComplaintEvidence(f)
        if (up.data?.fileUrl) evidenceUrls.push(up.data.fileUrl)
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
    } catch (err) {
      setFlash(
        err instanceof ApiError
          ? err.message
          : "Không thể gửi phiếu khiếu nại cho đơn này.",
      )
    } finally {
      setCmpBusy(false)
    }
  }

  const pending = list.filter((h) => h.status === "pending")
  const active = list.filter((h) => h.status !== "pending")

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="YÊU CẦU ĐẾN"
        title="Tiếp nhận yêu cầu bàn giao"
        body="Nhận yêu cầu nghĩa là bạn cam kết tới đúng khung giờ và điểm hẹn người dân đã ghim. Không tới được thì huỷ kèm lý do, họ sẽ tìm người khác."
      />

      {flash && (
        <p role="status" className="text-[13px] font-semibold text-brand">
          {flash}
        </p>
      )}

      <section>
        <h2 className="text-base font-bold text-ink">
          Chờ bạn xác nhận ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="card mt-3 px-5 py-8 text-center text-sm text-muted">
            Không có yêu cầu nào đang chờ xác nhận.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {pending.map((h) => {
              const hasPin = typeof h.pickupLat === "number" && typeof h.pickupLng === "number"
              const mapExpanded = openMapId === h.id

              return (
                <li key={h.id} className="card flex flex-col gap-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{h.address}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {h.displayCode}
                        {h.citizenName ? ` · Người gửi: ${h.citizenName}` : ""} · {h.date} · Khung
                        giờ đề xuất: <b className="text-ink">{h.slot}</b>
                      </p>
                    </div>
                    <p className="shrink-0 text-base font-bold tabular-nums text-brand">
                      {VND(calc(h, priceOf).gross)}
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
        )}
      </section>

      <section>
        <h2 className="text-base font-bold text-ink">Lịch đã nhận</h2>
        <div className="mt-3">
          {active.length === 0 ? (
            <p className="card px-5 py-6 text-center text-sm text-muted">
              Chưa có lịch hẹn nào đã nhận.
            </p>
          ) : (
            <Table head={["Mã", "Địa chỉ", "Khung giờ", "Tiền ước tính", "Trạng thái", "Thao tác"]}>
              {active.map((h) => (
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
                    {VND(calc(h, priceOf).gross)}
                  </Td>
                  <Td>
                    <Status tone={TONE[h.status]}>{STATUS_LABEL[h.status]}</Status>
                  </Td>
                  <Td>
                    {h.status === "collected" ? (
                      <Link
                        to={`/recycler/receipt?orderId=${encodeURIComponent(h.id)}`}
                        className="text-[13px] font-semibold text-brand hover:text-brand-deep"
                      >
                        Tạo biên nhận
                      </Link>
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
                          onClick={() => void cancel(h)}
                          className="text-[13px] font-semibold text-warn hover:underline"
                        >
                          Huỷ lịch
                        </button>
                        {h.fromBackend && (
                          <>
                            <span className="text-muted">·</span>
                            <button
                              type="button"
                              onClick={() => {
                                setComplaintOrder(h)
                                setCmpCategory("NoShow")
                                setCmpDesc("")
                                setCmpFiles([])
                              }}
                              className="text-[13px] font-semibold text-ink hover:underline"
                            >
                              Báo sự cố / Khiếu nại
                            </button>
                          </>
                        )}
                      </div>
                    ) : h.fromBackend && (h.status === "done" || h.status === "broken") ? (
                      <button
                        type="button"
                        onClick={() => {
                          setComplaintOrder(h)
                          setCmpCategory(h.status === "broken" ? "NoShow" : "Misconduct")
                          setCmpDesc("")
                          setCmpFiles([])
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
          )}
        </div>
      </section>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Sau khi tạo biên nhận và người dùng xác nhận khối lượng, tiền về tài khoản
        của họ và bạn bị trừ phí nền tảng trên mỗi giao dịch. Các khung giờ đã
        chốt: {TIME_SLOTS.join(" · ")}.
      </p>

      {complaintOrder && (
        <form
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
              onClick={() => setComplaintOrder(null)}
              className="btn-ghost h-9 px-3 text-xs"
            >
              Đóng
            </button>
          </div>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
            Nhóm nguyên nhân
            <select
              value={cmpCategory}
              onChange={(e) => setCmpCategory(e.target.value as ComplaintCategoryCode)}
              className="input h-10 text-sm"
            >
              {(["NoShow", "Misconduct", "PaymentIssue", "ScaleDiscrepancy", "Other"] as ComplaintCategoryCode[]).map(
                (cat) => (
                  <option key={cat} value={cat}>
                    {COMPLAINT_CATEGORY_LABELS[cat]}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
            Mô tả sự cố (tối thiểu 15 ký tự)
            <textarea
              className="input h-auto resize-y py-2.5 text-sm"
              rows={3}
              value={cmpDesc}
              onChange={(e) => setCmpDesc(e.target.value)}
              placeholder="Ví dụ: Xe thu gom đến đúng điểm hẹn nhưng người dân không nghe máy trong 30 phút."
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
            Ảnh hiện trường / tin nhắn bằng chứng (tùy chọn, tối đa 5 ảnh)
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setCmpFiles(Array.from(e.target.files ?? []).slice(0, 5))}
              className="text-xs font-normal text-muted"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={cmpBusy} className="btn-primary h-10 px-5 text-xs">
              {cmpBusy ? "Đang gửi..." : "Gửi phiếu khiếu nại"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
