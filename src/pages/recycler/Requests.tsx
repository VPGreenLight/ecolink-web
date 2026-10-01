import { useState } from "react"
import { Link } from "react-router-dom"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import { INCOMING, STATUS_LABEL, TIME_SLOTS, TONE, calc } from "@/data/handover"
import { VND, WASTES } from "@/data/waste"

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0
const nameOf = (id: string) => WASTES.find((w) => w.id === id)?.name ?? id

/** R-03 Tiếp nhận / Từ chối yêu cầu.
 *
 *  Nhận = chốt luôn khung giờ User đề xuất, nên bấm Nhận là một cam kết thời
 *  gian. Đã cam kết rồi mà đổi lịch thì phải qua R-04 (huỷ kèm lý do) chứ
 *  không sửa lặng lẽ — nếu không, người dùng không biết mình còn phải chờ
 *  hay không. */
export default function Requests() {
  const [list, setList] = useState(INCOMING)
  const [busy, setBusy] = useState("")

  const act = (id: string, next: "accepted" | "declined") => {
    setList((ls) => ls.map((l) => (l.id === id ? { ...l, status: next } : l)))
  }

  /** R-04 huỷ lịch giữa chừng: bắt buộc có lý do vì người dùng đang chờ. */
  const cancel = (id: string) => {
    const reason = window.prompt("Lý do huỷ lịch thu gom (người dùng sẽ thấy lý do này):")
    if (!reason?.trim()) return
    setList((ls) =>
      ls.map((l) => (l.id === id ? { ...l, status: "broken", reason: reason.trim() } : l)),
    )
  }

  const pending = list.filter((h) => h.status === "pending")
  const active = list.filter((h) => h.status !== "pending")

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="YÊU CẦU ĐẾN"
        title="Tiếp nhận yêu cầu bàn giao"
        body="Nhận yêu cầu nghĩa là bạn cam kết tới đúng khung giờ người dân đã chọn. Không tới được thì huỷ kèm lý do, họ sẽ tìm người khác."
      />

      <section>
        <h2 className="text-base font-bold text-ink">
          Chờ bạn xác nhận ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="card mt-3 px-5 py-8 text-center text-sm text-muted">
            Không có yêu cầu nào đang chờ.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {pending.map((h) => (
              <li key={h.id} className="card flex flex-col gap-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{h.address}</p>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {h.id} · {h.date} · Khung giờ đề xuất:{" "}
                      <b className="text-ink">{h.slot}</b>
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-bold tabular-nums text-brand">
                    {VND(calc(h, priceOf).gross)}
                  </p>
                </div>

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

                <div className="flex flex-wrap gap-3 border-t border-line-soft pt-4">
                  <button
                    type="button"
                    disabled={busy === h.id}
                    onClick={() => {
                      setBusy(h.id)
                      act(h.id, "accepted")
                    }}
                    className="btn-primary h-11 px-6"
                  >
                    Nhận và chốt khung giờ
                  </button>
                  <button
                    type="button"
                    disabled={busy === h.id}
                    onClick={() => act(h.id, "declined")}
                    className="btn-ghost h-11 px-5"
                  >
                    Từ chối
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold text-ink">Lịch đã nhận</h2>
        <div className="mt-3">
          <Table head={["Mã", "Địa chỉ", "Khung giờ", "Tiền ước tính", "Trạng thái", "Thao tác"]}>
            {active.map((h) => (
              <tr key={h.id}>
                <Td className="tabular-nums whitespace-nowrap">{h.id}</Td>
                <Td>{h.address}</Td>
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
                      to="/recycler/receipt"
                      className="text-[13px] font-semibold text-brand hover:text-brand-deep"
                    >
                      Tạo biên nhận
                    </Link>
                  ) : h.status === "accepted" ? (
                    <button
                      type="button"
                      onClick={() => cancel(h.id)}
                      className="text-[13px] font-semibold text-warn hover:underline"
                    >
                      Huỷ lịch
                    </button>
                  ) : (
                    <span className="text-[13px] text-muted">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </section>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Sau khi tạo biên nhận và người dùng xác nhận khối lượng, tiền về tài khoản
        của họ và bạn bị trừ phí nền tảng trên mỗi giao dịch. Các khung giờ đã
        chốt: {TIME_SLOTS.join(" · ")}.
      </p>
    </div>
  )
}