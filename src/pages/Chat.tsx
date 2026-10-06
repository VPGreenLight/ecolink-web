import { useState } from "react"
import { Link } from "react-router-dom"
import { PageHead } from "@/components/Portal"
import { ADDRESS } from "@/data/map"
import { useRole } from "@/lib/session"

/** U-09 và R-05: thương lượng qua chatbox.
 *
 *  Một trang cho cả hai vai trò, đổi góc nhìn bằng `useRole()` — người dân
 *  và cơ sở thu mua chat với nhau cùng một luồng, tách 2 trang thì phải viết
 *  2 bản tin nhắn giống hệt nhau.
 *
 *  Tin nhắn chỉ nằm trong state của trang: mở lại là mất. Đây là điểm cần nối
 *  WebSocket sớm nhất, vì thương lượng mà mất lịch thì hỏng việc thật — khác
 *  hẳn điểm danh hay điểm xanh, mất đi thì chỉ mất vui. */
type Msg = { id: number; from: "me" | "them"; text: string; time: string }

const SEED: Msg[] = [
  {
    id: 1,
    from: "them",
    text: "Chào bạn, hôm nay mình có đi gom khu Quận 1 không? Có khoảng 20kg bìa carton.",
    time: "09:12",
  },
  {
    id: 2,
    from: "me",
    text: "Có nhé. Bìa carton sạch không dính băng keo thì giá 2.200đ/kg, mình lấy 20kg đó luôn.",
    time: "09:15",
  },
  {
    id: 3,
    from: "them",
    text: "Được. Mình qua lúc 10h nhé, khung giờ 10:00 - 12:00 bạn tiện không?",
    time: "09:16",
  },
]

export default function Chat() {
  const role = useRole()
  const me = role === "recycler" ? "Cô Ba Thu Gom" : "Nguyễn Đức"
  const them = role === "recycler" ? "Nguyễn Đức" : "Cô Ba Thu Gom"
  const [msgs, setMsgs] = useState(SEED)
  const [draft, setDraft] = useState("")

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    const now = new Date()
    setMsgs((ms) => [
      ...ms,
      {
        id: ms.length + 1,
        from: "me",
        text,
        time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      },
    ])
    setDraft("")
    // ponytail: không có WebSocket, tin nhắn của đối táp không về. Nối socket
    // thì thay dòng này, phần hiển thị giữ nguyên.
  }

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="THƯƠNG LƯỢNG"
        title={`Chat với ${them}`}
        body="Dùng để thống nhất giá, khối lượng và khung giờ trước khi bàn giao. Nội dung chat không thay thế biên nhận — tiền chỉ chốt sau khi bạn xác nhận khối lượng thực."
      />

      <div className="card flex h-[560px] flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">{them}</p>
            <p className="mt-0.5 text-[13px] text-muted">{ADDRESS}</p>
          </div>
          <span className="chip shrink-0 bg-surface-2 text-body">
            <i className="size-1.5 rounded-full bg-brand" />
            Đang hoạt động
          </span>
        </header>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
          <p className="self-stretch rounded-full bg-surface-3 px-3 py-1 text-center text-[12px] text-body">
            Hôm nay
          </p>
          {msgs.map((m) => (
            <div key={m.id} className={m.from === "me" ? "w-full pl-10" : "w-full pr-10"}>
              <div className={`flex flex-col ${m.from === "me" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    m.from === "me"
                      ? "bg-brand-deep text-white"
                      : "bg-surface-2 text-ink"
                  }`}
                >
                  <p className="text-sm leading-6">{m.text}</p>
                </div>
                <p className="mt-1 px-1 text-[11px] text-muted">{m.time}</p>
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={send}
          className="flex items-center gap-2 border-t border-line px-4 py-3"
        >
          <label className="sr-only" htmlFor="chat-draft">
            Nhắn tin với {them}
          </label>
          <input
            id="chat-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Nhắn tin với ${them}...`}
            className="input h-11"
          />
          <button type="submit" disabled={!draft.trim()} className="btn-primary h-11 shrink-0 px-5">
            Gửi
          </button>
        </form>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="max-w-[60ch] text-sm leading-6 text-body">
          <b className="text-ink">{me}</b>, khi thống nhất xong thì bấm bên dưới để
          tạo yêu cầu bàn giao chính thức. Không có yêu cầu thì hệ thống không
          biết chuyển tiền cho ai.
        </p>
        <Link
          to={role === "recycler" ? "/recycler/requests" : "/user/handover"}
          className="btn-outline h-11 shrink-0 px-5"
        >
          Tạo yêu cầu bàn giao
        </Link>
      </div>
    </div>
  )
}