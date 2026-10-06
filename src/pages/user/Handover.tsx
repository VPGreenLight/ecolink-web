import { useState } from "react"
import { Link } from "react-router-dom"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import {
  MY_HANDOVERS,
  STATUS_LABEL,
  TIME_SLOTS,
  TONE,
  calc,
} from "@/data/handover"
import { VND, WASTES, estimate } from "@/data/waste"

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0
const nameOf = (id: string) => WASTES.find((w) => w.id === id)?.name ?? id

/** U-07 Tạo yêu cầu · U-08 Sửa / Huỷ yêu cầu.
 *
 *  Hai UC trên cùng một màn hình vì cùng một danh sách: bấm "Tạo yêu cầu" ra
 *  form, bấm "Sửa" sửa chính form đó. Tách 2 trang thì phải truyền lại dữ
 *  liệu yêu cầu qua URL, vô ích. */
export default function Handover() {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState(MY_HANDOVERS)
  const [editId, setEditId] = useState<string | null>(null)
  const [flash, setFlash] = useState("")

  /** U-08 dời giờ: chỉ khi chưa ai nhận. Sau khi Recycler accept, khung giờ đã
   *  thành cam kết của hai bên — đổi lặng lẽ thì người thu gom tới nhầm giờ
   *  và người dân không biết mình đã đổi. */
  const reslot = (id: string, slot: string) => {
    setList((ls) => ls.map((h) => (h.id === id ? { ...h, slot } : h)))
    setEditId(null)
    setFlash(`${id}: đã đổi khung giờ sang ${slot}. Người thu gom sẽ thấy giờ mới.`)
  }

  /** U-08 huỷ: hỏi lý do trước khi huỷ. Không có lý do thì người thu gom không
   *  biết có nên ghé lần nữa hay không — mất luôn một mối quan hệ. */
  const cancel = (h: (typeof MY_HANDOVERS)[number]) => {
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
        body="Đặt lịch thu gom tại nhà, chọn khung giờ người thu gom có mặt. Bạn có thể sửa giờ hoặc huỷ khi đối tác chưa nhận."
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
          onDone={(draft) => {
            setList((ls) => [newRow(draft), ...ls])
            setOpen(false)
            setFlash(
              "Đã gửi yêu cầu. Người thu gom sẽ xác nhận khung giờ trong hôm nay.",
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
                    </>
                  )}
                  {h.status === "accepted" && (
                    <Link to="/chat" className="btn-outline h-9 px-3 text-[13px]">
                      Nhắn đối tác
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
                <p className="mt-3 text-[13px] leading-5 text-muted">{h.address}</p>

                {/* Danh sách khung giờ mở ngay dưới yêu cầu đang sửa: bấm là đổi,
                    không cần mở form riêng cho một lựa chọn có 5 giá trị. */}
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

/** Sinh yêu cầu mới từ form. Mã sinh tại chỗ chứ không lấy từ server — ở đây
 *  chỉ để danh sách có dòng mới hiện ra ngay, không phải mã thật. */
let seq = 200

type Draft = { rows: { wasteId: string; kg: number }[]; slot: string; address: string }

function newRow(d: Draft) {
  seq += 1
  return {
    id: `BH-2609-0${seq}`,
    recycler: "Chưa có",
    address: d.address,
    date: "30/09/2026",
    slot: d.slot,
    lines: d.rows.map((r) => ({ wasteId: r.wasteId, kg: r.kg })),
    status: "pending" as const,
  }
}

/** Form U-07. Bắt buộc có: chọn ít nhất một loại rác thu gom được và khối
 *  lượng > 0, có địa chỉ — đây là ranh giới tin cậy, không kiểm thì tạo ra
 *  yêu cầu rỗng mà vẫn báo thành công. */
function CreateForm({ onDone }: { onDone: (d: Draft) => void }) {
  const [rows, setRows] = useState([{ wasteId: "pet", kg: 5 }])
  const [slot, setSlot] = useState<string>(TIME_SLOTS[1])
  const [address, setAddress] = useState("Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1")
  const [err, setErr] = useState("")

  const set = (i: number, patch: Partial<{ wasteId: string; kg: number }>) =>
    setRows((r) => r.map((row, n) => (n === i ? { ...row, ...patch } : row)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const bad = rows.find((r) => r.kg <= 0)
    if (bad) {
      setErr("Khối lượng phải lớn hơn 0 kg.")
      return
    }
    if (!address.trim()) {
      setErr("Cần địa chỉ để người thu gom tìm tới nhà bạn.")
      return
    }
    setErr("")
    // ponytail: chưa có backend, chỉ thêm vào danh sách ở trên. Nối API thì
    // thay đúng dòng này.
    onDone({ rows, slot, address })
  }

  const { gross } = estimate(rows)

  return (
    <form onSubmit={submit} noValidate className="card flex flex-col gap-5 p-5">
      <h2 className="text-base font-bold text-ink">Thông tin rác cần thu gom</h2>

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
          Địa chỉ
          <input
            className="input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
      </div>

      {err && <p className="text-[13px] text-warn">{err}</p>}

      <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
        <button type="submit" className="btn-primary h-11 px-6">
          Gửi yêu cầu
        </button>
        <p className="text-[13px] text-muted">
          Tiền tạm tính <b className="tabular-nums text-ink">{VND(gross)}</b> ·
          người thu gom xác nhận sẽ chốt khung giờ và khối lượng thực tế.
        </p>
      </div>
    </form>
  )
}