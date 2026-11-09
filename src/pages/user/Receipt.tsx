import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import { INCOMING, STATUS_LABEL, TONE, calc, type Handover } from "@/data/handover"
import { VND, WASTES } from "@/data/waste"
import {
  confirmHandoverReceipt,
  disputeHandoverReceipt,
  fetchSyncedHandoverOrders,
  fetchUserReceipt,
  findCachedHandoverOrder,
  type ReceiptDto,
} from "@/lib/recyclerWorkflowApi"

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0
const nameOf = (id: string) => WASTES.find((w) => w.id === id)?.name ?? id

/** U-10 Xác nhận biên nhận bàn giao + U-11 Đánh giá cơ sở thu mua.
 *
 *  Gộp: U-11 chỉ mở được sau khi U-10 xong, nên tách hai trang thì người
 *  dùng phải tự nhớ quay lại. Ở đây chỉ khi xác nhận xong mới hiện phần đánh
 *  giá — đúng luật "Mở khi hoàn tất giao dịch". */
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

  const [actual, setActual] = useState(() =>
    (h.lines ?? []).map((l) => ({ wasteId: l.wasteId, kg: l.kg })),
  )
  const [confirmed, setConfirmed] = useState(false)
  const [disputed, setDisputed] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [stars, setStars] = useState(0)
  const [note, setNote] = useState("")
  const [receiptInfo, setReceiptInfo] = useState<ReceiptDto | null>(null)
  const [flashMessage, setFlashMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function loadData() {
      if (!orderId) return

      // Tải thông tin biên nhận từ backend
      const r = await fetchUserReceipt(orderId)
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
              wasteId: l.wasteCategoryId || l.wasteCategoryCode || "plastic",
              kg: l.actualWeightKg,
            })),
          )
        }
      }

      // Tải chi tiết đơn bàn giao
      const orders = await fetchSyncedHandoverOrders("user")
      if (!active) return
      const found = orders.find((o) => o.id === orderId || o.displayCode === orderId)
      if (found) {
        setH({
          id: found.id,
          displayCode: found.displayCode,
          recycler: found.recycler,
          address: found.address,
          date: found.date,
          slot: found.slot,
          lines: found.lines,
          status: found.status,
          reason: found.reason,
        })
        if (!r) {
          setActual(found.lines.map((l) => ({ wasteId: l.wasteId, kg: l.kg })))
        }
      }
    }
    void loadData()
    return () => {
      active = false
    }
  }, [orderId])

  const money = calc({ ...h, actual }, priceOf)
  const differs = actual.some((a, i) => a.kg !== h.lines[i]?.kg)

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcessing(true)
    try {
      const res = await confirmHandoverReceipt(h.id)
      setConfirmed(true)
      setFlashMessage(
        res.syncedWithBackend
          ? "Đã xác nhận biên nhận thành công (đã cộng điểm xanh và hoàn tất giao dịch trên PostgreSQL)."
          : "Đã xác nhận khối lượng bàn giao (chế độ dự phòng ngoại tuyến).",
      )
    } finally {
      setProcessing(false)
    }
  }

  const handleDispute = async () => {
    const reason = window.prompt("Nhập lý do khiếu nại sai lệch khối lượng hoặc số tiền:")
    if (!reason?.trim()) return

    setProcessing(true)
    try {
      const res = await disputeHandoverReceipt(h.id, reason.trim())
      setDisputed(true)
      setFlashMessage(
        res.syncedWithBackend
          ? "Khiếu nại biên nhận đã được ghi nhận và gửi đến bộ phận vận hành thẩm định (đã cập nhật PostgreSQL)."
          : "Khiếu nại đã được ghi nhận (chế độ dự phòng ngoại tuyến).",
      )
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="BIÊN NHẬN"
        title="Xác nhận bàn giao rác"
        body="Đối chiếu khối lượng người thu gom cân tại chỗ với những gì bạn bỏ ra. Sai ở đâu thì sửa ở đó — tiền tính trên số bạn xác nhận."
      />

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

      <form onSubmit={confirm} className="card flex flex-col gap-5 p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-soft pb-4">
          <div>
            <p className="font-bold text-ink">{h.recycler}</p>
            <p className="mt-0.5 text-[13px] text-muted">
              {h.displayCode || h.id} · {h.date} · {h.slot} · {h.address}
            </p>
          </div>
          <Status tone={TONE[h.status]}>{STATUS_LABEL[h.status]}</Status>
        </div>

        <Table head={["Loại rác", "Bạn bỏ ra", "Người thu gom cân", "Thành tiền"]}>
          {actual.map((a, i) => (
            <tr key={a.wasteId}>
              <Td className="font-semibold text-ink">{nameOf(a.wasteId)}</Td>
              <Td className="tabular-nums text-muted">{h.lines[i]?.kg} kg</Td>
              <Td>
                <input
                  className="input h-9 w-28 tabular-nums"
                  type="number"
                  min={0}
                  step={0.1}
                  aria-label={`Khối lượng thực tế ${nameOf(a.wasteId)}`}
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
                {VND(a.kg * priceOf(a.wasteId))}
              </Td>
            </tr>
          ))}
          <tr>
            <Td className="font-bold text-ink">Tổng</Td>
            <Td className="tabular-nums text-muted">
              {h.lines.reduce((s, l) => s + l.kg, 0)} kg
            </Td>
            <Td className="tabular-nums font-bold text-ink">
              {actual.reduce((s, a) => s + a.kg, 0)} kg
            </Td>
            <Td className="tabular-nums font-bold text-brand">
              {VND(money.gross)}
            </Td>
          </tr>
        </Table>

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
              onClick={() => void handleDispute()}
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
              Xác nhận xong hệ thống mới trả tiền về tài khoản của bạn.
            </p>
          )}
        </div>
      </form>

      {confirmed && (
        <section className="card flex flex-col gap-4 p-5 md:p-6">
          <h2 className="text-base font-bold text-ink">
            Đánh giá {h.recycler}
          </h2>
          <p className="text-sm text-muted">
            Điểm của bạn quyết định cơ sở này có được đề xuất cho khu vực của bạn
            không.
          </p>

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
              disabled={stars === 0}
              className="btn-primary h-11 px-6"
            >
              Gửi đánh giá
            </button>
            {stars > 0 && (
              <p className="text-[13px] text-muted">
                {stars === 5
                  ? "Cảm ơn bạn, đánh giá này giúp khu vực của bạn."
                  : "Cảm ơn bạn, chúng tôi sẽ xem lại điểm thấp."}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
