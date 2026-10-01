import { useState } from "react"
import { PageHead, Table, Td } from "@/components/Portal"
import { INCOMING, calc } from "@/data/handover"
import { FEE_RATE, VND, WASTES } from "@/data/waste"

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0
const nameOf = (id: string) => WASTES.find((w) => w.id === id)?.name ?? id

/** R-06 Tạo biên nhận bàn giao.
 *
 *  Nhập khối lượng thực cân tại chỗ, không nhập tiền. Tiền do hệ thống tự
 *  giải ngân sau khi người dùng xác nhận (U-10) — có ô "số tiền" ở đây thì
 *  cơ sở có thể nhập số tiền tuỳ ý, mà đối soát (A-11) không còn đối chiếu
 *  được với gì. */
export default function Receipt() {
  const h = INCOMING.find((x) => x.status === "collected")!
  const [rows, setRows] = useState(() =>
    h.lines.map((l) => ({ wasteId: l.wasteId, kg: l.kg })),
  )
  const [files, setFiles] = useState<File[]>([])
  const [sent, setSent] = useState(false)

  const money = calc({ ...h, actual: rows, feeRate: FEE_RATE }, priceOf)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (rows.some((r) => r.kg <= 0)) return
    // ponytail: chưa có backend. Nối API thì thay đúng dòng này — và tiền về
    // tài khoản người dùng là việc của PayOS, không phải của form này.
    setSent(true)
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
              {h.id} · {h.date} · {h.slot}
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
                  disabled={sent}
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
          Ảnh bàn giao (không bắt buộc)
          <span className="rounded-lg border border-dashed border-sage-line bg-surface-2 px-4 py-6 text-center text-[13px] font-normal text-muted">
            {files.length === 0
              ? "Chọn ảnh rác đã cân, tối đa 4 ảnh"
              : files.map((f) => f.name).join(" · ")}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
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
          <button type="submit" disabled={sent} className="btn-primary h-11 px-6">
            {sent ? "Đã gửi biên nhận" : "Gửi biên nhận"}
          </button>
          {sent && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              Đã gửi. Chờ người dùng xác nhận khối lượng thì tiền sẽ về tài khoản
              của họ.
            </p>
          )}
        </div>
      </form>
    </div>
  )
}