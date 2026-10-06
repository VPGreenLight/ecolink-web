import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { AI_AVATAR } from "@/data/scanner"
import { APPLICATIONS, AI_CASES, COMPLAINTS, DATASET, POSTS, STAFF, STATS, fmtInt, fmtVnd } from "@/data/ops"
import { FLOWS } from "@/data/cashflow"

/** Trợ lý AI trong console quản trị.
 *
 *  Nằm trong `AdminShell` nên có mặt ở mọi trang admin và staff: người quản trị
 *  hỏi "còn bao nhiêu việc chờ" ngay khi đang đứng ở trang khác, không phải quay
 *  lại dashboard để đếm rồi mở lại đây.
 *
 *  Câu trả lời lấy từ chính các bảng dữ liệu console đang dùng, nên không bao
 *  giờ lệch với trang đếm chi tiết. Không có backend: bộ câu trả lời ở `REPLY`
 *  khớp theo từ khoá, hỏi ngoài phạm vi thì nói thẳng là chưa làm được chứ
 *  không bịa số. */
type Msg = { id: number; from: "me" | "ai"; text: string; link?: { to: string; label: string } }

type Rule = { keys: string[]; answer: () => Omit<Msg, "id" | "from"> }

const REPLY: Rule[] = [
  {
    keys: ["chờ", "hàng đợi", "tồn đọng", "còn việc"],
    answer: () => ({
      text:
        `Đang có ${AI_CASES.filter((c) => !c.inDataset).length} ảnh AI chờ gán nhãn, ` +
        `${APPLICATIONS.filter((a) => a.status === "pending").length} hồ sơ đối tác chờ thẩm định, ` +
        `${COMPLAINTS.filter((c) => c.status !== "resolved").length} khiếu nại chưa xong và ` +
        `${POSTS.filter((p) => p.status === "pending").length} bài Blog chờ duyệt.`,
      link: { to: "/staff/ai-review", label: "Mở hàng đợi" },
    }),
  },
  {
    keys: ["sai", "chính xác", "nhận diện", "dataset", "tập dữ liệu"],
    answer: () => {
      const worst = [...DATASET.byClass].sort((a, b) => a.accuracy - b.accuracy)[0]
      return {
        text: `Độ chính xác trung bình là ${DATASET.accuracy}%. Lớp yếu nhất là ${worst.label} ở ${worst.accuracy}% — đang dưới đường cơ sở.`,
        link: { to: "/staff/dataset", label: "Mở tập dữ liệu" },
      }
    },
  },
  {
    keys: ["tiền", "doanh thu", "phí", "dòng tiền", "giá trị"],
    answer: () => ({
      text: `30 ngày qua giao dịch ${fmtVnd(STATS.gross30d)}, trong đó phí nền tảng thu ${fmtVnd(STATS.fee30d)} trên ${fmtInt(STATS.handovers30d)} giao dịch. Còn ${FLOWS.length} dòng trong sổ đối soát.`,
      link: { to: "/admin/reconciliation", label: "Mở đối soát" },
    }),
  },
  {
    keys: ["giao dịch", "tháng", "xu hướng", "tăng trưởng"],
    answer: () => {
      const [first, last] = [STATS.trend[0], STATS.trend[STATS.trend.length - 1]]
      const growth = ((last.handovers - first.handovers) / first.handovers) * 100
      return {
        text: `Giao dịch tăng từ ${fmtInt(first.handovers)} (${first.month}) lên ${fmtInt(last.handovers)} (${last.month}), tức +${growth.toFixed(0)}% trong 6 tháng.`,
        link: { to: "/admin", label: "Mở dashboard" },
      }
    },
  },
  {
    keys: ["khiếu nại", "khiếu nại mới"],
    answer: () => ({
      text: `${COMPLAINTS.filter((c) => c.status === "new").length} khiếu nại mới, ${COMPLAINTS.filter((c) => c.status === "working").length} đang xử lý, ${COMPLAINTS.filter((c) => c.status === "resolved").length} đã xong.`,
      link: { to: "/staff/complaints", label: "Mở danh sách" },
    }),
  },
  {
    keys: ["nhân viên", "staff", "quyền", "phân quyền"],
    answer: () => ({
      text: `Có ${STAFF.length} tài khoản nhân viên, trong đó ${STAFF.filter((s) => s.status === "locked").length} đang bị khoá. Quyền do bạn cấp ở trang phân quyền.`,
      link: { to: "/admin/permissions", label: "Mở phân quyền" },
    }),
  },
]

const CHIPS = ["Còn việc gì chờ?", "AI chính xác bao nhiêu?", "Tiền tháng này thế nào?"]

function reply(text: string): Omit<Msg, "id" | "from"> {
  const q = text.toLowerCase()
  return REPLY.find((r) => r.keys.some((k) => q.includes(k)))?.answer() ?? {
    text: "Mình chỉ tra được số liệu đang mở trên console. Hãi hỏi về việc chờ, độ chính xác AI, dòng tiền, xu hướng giao dịch, khiếu nại hoặc nhân viên.",
  }
}

export default function Assistant() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: 1,
      from: "ai",
      text: "Chào, mình đọc được số liệu console này. Hỏi tôi về việc chờ, độ chính xác AI, dòng tiền hoặc nhân viên.",
    },
  ])
  const [draft, setDraft] = useState("")
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [msgs, open])

  const send = (text: string) => {
    const t = text.trim()
    if (!t) return
    setMsgs((ms) => [
      ...ms,
      { id: ms.length + 1, from: "me", text: t },
      { id: ms.length + 2, from: "ai", ...reply(t) },
    ])
    setDraft("")
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_-16px_rgba(15,31,21,0.28)]">
          <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
            <img
              src={AI_AVATAR}
              alt=""
              className="size-12 shrink-0 object-contain"
              loading="lazy"
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-ink">Trợ lý EcoLink</p>
              <p className="text-[11px] text-muted">Đọc số liệu trong console</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
              <span className="sr-only">Đóng trợ lý</span>
            </button>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
            {msgs.map((m) => (
              <div key={m.id} className={m.from === "me" ? "flex justify-end" : ""}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-5 ${
                    m.from === "me"
                      ? "bg-brand text-white"
                      : "bg-surface-2 text-body"
                  }`}
                >
                  {m.text}
                  {m.link && (
                    <Link
                      to={m.link.to}
                      onClick={() => setOpen(false)}
                      className={`mt-1.5 block text-[12px] font-semibold underline underline-offset-2 ${
                        m.from === "me" ? "text-white" : "text-brand"
                      }`}
                    >
                      {m.link.label} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {msgs.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => send(c)}
                    className="rounded-full border border-line px-2.5 py-1 text-[12px] text-body transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div ref={end} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(draft)
            }}
            className="flex gap-2 border-t border-line-soft p-3"
          >
            <input
              className="input h-9 flex-1 text-[13px]"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Hỏi về số liệu console..."
              aria-label="Câu hỏi cho trợ lý"
            />
            <button type="submit" className="btn-primary h-9 shrink-0 px-3.5 text-[13px]">
              Gửi
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Đóng trợ lý" : "Mở trợ lý EcoLink"}
        className="grid size-16 place-items-center rounded-full bg-white shadow-[0_12px_28px_-8px_rgba(15,31,21,0.34)] ring-1 ring-line transition-transform hover:scale-105 active:scale-95"
      >
        {/* `p-1` + `scale`: robot có khoảng trắng sẵn trong ảnh, không nới ra
            thì nhìn nhỏ hơn kích thước nút dù số px lớn hơn. */}
        <img src={AI_AVATAR} alt="" className="size-full scale-110 object-contain" loading="lazy" />
      </button>
    </div>
  )
}