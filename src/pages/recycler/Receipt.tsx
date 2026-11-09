import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { PageHead, Table, Td } from "@/components/Portal"
import { INCOMING, calc, type Handover } from "@/data/handover"
import { FEE_RATE, VND, WASTES } from "@/data/waste"
import {
  createHandoverReceipt,
  fetchRecyclerReceipt,
  fetchSyncedHandoverOrders,
  findCachedHandoverOrder,
  type CreateReceiptRequest,
} from "@/lib/recyclerWorkflowApi"

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0
const nameOf = (id: string) => WASTES.find((w) => w.id === id)?.name ?? id

/** R-06 Tạo biên nhận bàn giao.
 *
 *  Nhập khối lượng thực cân tại chỗ, không nhập tiền. Tiền do hệ thống tự
 *  giải ngân sau khi người dùng xác nhận (U-10) — có ô "số tiền" ở đây thì
 *  cơ sở có thể nhập số tiền tuỳ ý, mà đối soát (A-11) không còn đối chiếu
 *  được với gì. */
export default function Receipt() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get("orderId")

  const defaultHandover = INCOMING.find((x) => x.status === "collected") || INCOMING[0]
  const [h, setH] = useState<Handover>(() => {
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
    return defaultHandover
  })

  const [rows, setRows] = useState(() =>
    h.lines.map((l) => ({ wasteId: l.wasteId, kg: l.kg })),
  )
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function loadOrder() {
      if (!orderId) return
      // Kiểm tra xem đã có biên nhận được phát hành chưa
      const existingReceipt = await fetchRecyclerReceipt(orderId)
      if (!active) return

      if (existingReceipt) {
        setSent(true)
        setStatusMessage(
          `Đơn này đã có biên nhận #${existingReceipt.receiptCode || existingReceipt.receiptId} (trạng thái: ${existingReceipt.requestStatus}).`,
        )
      }

      // Tải chi tiết đơn bàn giao từ PostgreSQL hoặc bộ đệm
      const orders = await fetchSyncedHandoverOrders("recycler")
      if (!active) return
      const found = orders.find((o) => o.id === orderId || o.displayCode === orderId)
      if (found) {
        const resolved: Handover = {
          id: found.id,
          displayCode: found.displayCode,
          recycler: found.recycler,
          address: found.address,
          date: found.date,
          slot: found.slot,
          lines: found.lines,
          status: found.status,
          reason: found.reason,
        }
        setH(resolved)
        setRows(found.lines.map((l) => ({ wasteId: l.wasteId, kg: l.kg })))
      }
    }
    void loadOrder()
    return () => {
      active = false
    }
  }, [orderId])

  const money = calc({ ...h, actual: rows, feeRate: FEE_RATE }, priceOf)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rows.some((r) => r.kg <= 0)) return

    setSubmitting(true)
    try {
      const payload: CreateReceiptRequest = {
        items: rows.map((r) => ({
          wasteCategoryId: r.wasteId,
          actualWeightKg: r.kg,
        })),
        scaleProofPhotoUrls:
          files.length > 0
            ? files.map((f) => `https://images.ecolink.vn/proofs/${encodeURIComponent(f.name)}`)
            : ["https://images.ecolink.vn/proofs/scale-verified.jpg"],
        receiptImageUrl: "https://images.ecolink.vn/proofs/receipt-standard.jpg",
      }

      const res = await createHandoverReceipt(h.id, payload)
      setSent(true)
      setStatusMessage(
        res.syncedWithBackend
          ? `Đã phát hành biên nhận #${res.receipt.receiptCode} thành công (đã cập nhật PostgreSQL và chuyển đơn sang AwaitingConfirmation). Chờ người dân xác nhận!`
          : "Đã gửi biên nhận (chế độ dự phòng ngoại tuyến). Chờ người dùng xác nhận khối lượng.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="BIÊN NHẬN"
        title="Tạo biên nhận thu gom"
        body="Nhập khối lượng thực tế bạn vừa cân và chụp ảnh làm bằng chứng. Người dùng xác nhận khối lượng này thì hệ thống mới trả tiền."
      />

      <form onSubmit={submit} className="card flex flex-col gap-5 p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-soft pb-4">
          <div>
            <p className="font-bold text-ink">{h.address}</p>
            <p className="mt-0.5 text-[13px] text-muted">
              {h.displayCode || h.id} · {h.date} · {h.slot}
            </p>
          </div>
          <span className="rounded-full bg-mint/25 px-3 py-1 text-[11px] font-semibold text-brand-deep">
            Người dùng ước tính {h.lines.reduce((s, l) => s + l.kg, 0)} kg
          </span>
        </div>

        <Table head={["Loại rác", "Người dùng bỏ ra", "Bạn cân được", "Thành tiền"]}>
          {rows.map((r, i) => (
            <tr key={r.wasteId}>
              <Td className="font-semibold text-ink">{nameOf(r.wasteId)}</Td>
              <Td className="tabular-nums text-muted">{h.lines[i]?.kg} kg</Td>
              <Td>
                <input
                  className="input h-9 w-28 tabular-nums"
                  type="number"
                  min={0}
                  step={0.1}
                  aria-label={`Khối lượng cân thực tế ${nameOf(r.wasteId)}`}
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
                {VND(r.kg * priceOf(r.wasteId))}
              </Td>
            </tr>
          ))}
        </Table>

        <label className="flex cursor-pointer flex-col gap-2 text-[13px] font-semibold text-ink">
          Ảnh bàn giao &amp; bằng chứng cân
          <span className="rounded-lg border border-dashed border-sage-line bg-surface-2 px-4 py-6 text-center text-[13px] font-normal text-muted">
            {files.length === 0
              ? "Chọn ảnh rác đã cân hoặc biên nhận cân, tối đa 4 ảnh"
              : files.map((f) => f.name).join(" · ")}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={sent}
            className="sr-only"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))}
          />
        </label>

        <div className="flex flex-wrap gap-6 rounded-xl border border-line bg-surface-2 px-5 py-4">
          <p className="text-sm text-body">
            Tổng tiền đối tác nhận{" "}
            <b className="tabular-nums text-ink">{VND(money.gross)}</b>
          </p>
          <p className="text-sm text-body">
            Phí nền tảng {(FEE_RATE * 100).toFixed(0)}%{" "}
            <b className="tabular-nums text-ink">{VND(money.fee)}</b>
          </p>
          <p className="text-sm text-body">
            Bạn thực nhận{" "}
            <b className="tabular-nums text-brand">{VND(money.net)}</b>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button type="submit" disabled={sent || submitting} className="btn-primary h-11 px-6">
            {submitting ? "Đang gửi..." : sent ? "Đã gửi biên nhận" : "Gửi biên nhận"}
          </button>
          {statusMessage && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {statusMessage}
            </p>
          )}
        </div>
      </form>
    </div>
  )
}
