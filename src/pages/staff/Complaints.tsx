import { useState } from "react"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import { COMPLAINTS, type Complaint } from "@/data/ops"

/** S-05 Xử lý khiếu nại giao dịch.
 *
 *  Khiếu nại mà đóng mà không có câu trả lời gửi cho người dùng thì người
 *  dùng sẽ hỏi lại. Ở đây bắt buộc nhập nội dung phản hồi khi chuyển sang
 *  "đã xử lý" — nếu cho đóng không cần trả lời thì hầu hết ca sẽ đóng im lặng. */
export default function Complaints() {
  const [list, setList] = useState<Complaint[]>(COMPLAINTS)
  const [reply, setReply] = useState<Record<string, string>>({})
  const [flash, setFlash] = useState("")

  const take = (id: string) =>
    setList((ls) =>
      ls.map((c) => (c.id === id && c.status === "new" ? { ...c, status: "working" } : c)),
    )

  const resolve = (id: string) => {
    const text = (reply[id] ?? "").trim()
    if (text.length < 10) {
      setFlash("Cần viết phản hồi ít nhất 10 ký tự trước khi đóng khiếu nại.")
      return
    }
    setList((ls) => ls.map((c) => (c.id === id ? { ...c, status: "resolved", reply: text } : c)))
    setFlash("")
  }

  const open = list.filter((c) => c.status !== "resolved")
  const closed = list.filter((c) => c.status === "resolved")

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="HỖ TRỢ"
        title="Khiếu nại giao dịch"
        body="Đối chiếu với biên nhận và lịch sử dòng tiền trước khi trả lời. Mọi ca đóng đều phải có phản hồi gửi cho người dùng."
      />

      {flash && <p className="text-[13px] font-semibold text-warn">{flash}</p>}

      <ul className="flex flex-col gap-4">
        {open.map((c) => (
          <li key={c.id} className="card flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-ink">{c.title}</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  {c.id} · {c.date} · {c.user} · liên quan {c.target}
                </p>
              </div>
              <Status tone={c.status === "new" ? "wait" : "todo"}>
                {c.status === "new" ? "Mới" : "Đang xử lý"}
              </Status>
            </div>

            <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
              Phản hồi cho người dùng
              <textarea
                className="input h-auto resize-y py-3 leading-6"
                rows={3}
                value={reply[c.id] ?? ""}
                onChange={(e) => setReply((r) => ({ ...r, [c.id]: e.target.value }))}
                placeholder="Nêu rõ đã kiểm tra gì, kết luận gì, và người dùng cần làm gì tiếp."
              />
            </label>

            <div className="flex flex-wrap gap-3 border-t border-line-soft pt-4">
              {c.status === "new" && (
                <button type="button" onClick={() => take(c.id)} className="btn-ghost h-11 px-5">
                  Nhận xử lý
                </button>
              )}
              <button type="button" onClick={() => resolve(c.id)} className="btn-primary h-11 px-6">
                Đóng khiếu nại
              </button>
            </div>
          </li>
        ))}
      </ul>

      {closed.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-ink">Đã đóng</h2>
          <div className="mt-3">
            <Table head={["Mã", "Vấn đề", "Người báo", "Kết quả"]}>
              {closed.map((c) => (
                <tr key={c.id}>
                  <Td className="tabular-nums whitespace-nowrap">{c.id}</Td>
                  <Td className="font-semibold text-ink">{c.title}</Td>
                  <Td className="whitespace-nowrap">{c.user}</Td>
                  <Td>{c.reply ?? "—"}</Td>
                </tr>
              ))}
            </Table>
          </div>
        </section>
      )}
    </div>
  )
}