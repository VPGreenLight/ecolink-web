import { useState } from "react"
import { PageHead, Status } from "@/components/Portal"

type Note = { id: string; text: string; time: string; needsAction: boolean }

const INITIAL_NOTES: Note[] = [
  {
    id: "n1",
    text: "Cô Ba Thu Gom đã nhận yêu cầu của bạn và chốt khung giờ 10:00 - 12:00.",
    time: "Hôm nay, 09:34",
    needsAction: true,
  },
  {
    id: "n2",
    text: "Tiền giao dịch BH-2609-0184 đã chuyển về tài khoản của bạn.",
    time: "Hôm nay, 11:02",
    needsAction: false,
  },
  {
    id: "n3",
    text: "Bạn bỏ lỡ điểm danh hôm qua, chuỗi đã tính lại từ đầu.",
    time: "Hôm qua, 20:00",
    needsAction: true,
  },
]

export default function Notifications() {
  const [read, setRead] = useState<Record<string, boolean>>({})
  const unread = INITIAL_NOTES.filter((n) => !read[n.id]).length

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="TÀI KHOẢN"
        title="Thông báo hệ thống"
        body="Cập nhật tiến độ thu gom, xác nhận giao dịch và tin tức từ EcoLink."
      />

      <section className="card flex flex-col gap-4 p-5 md:p-6 max-w-2xl">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft pb-3">
          <h2 className="text-base font-bold text-ink">Danh sách thông báo</h2>
          <span className="text-[13px] text-muted">
            {unread === 0 ? "Đã đọc hết" : `${unread} chưa đọc`}
          </span>
        </div>

        <ul className="flex flex-col gap-2.5">
          {INITIAL_NOTES.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border p-4 transition-colors ${
                read[n.id] ? "border-line-soft bg-surface" : "border-brand/25 bg-brand/6"
              }`}
            >
              <p className="text-sm leading-relaxed text-ink">{n.text}</p>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                <span>{n.time}</span>
                {n.needsAction && !read[n.id] && <Status tone="wait">Cần xử lý</Status>}
              </div>
            </li>
          ))}
        </ul>

        <div className="pt-2">
          <button
            type="button"
            onClick={() =>
              setRead(Object.fromEntries(INITIAL_NOTES.map((n) => [n.id, true])))
            }
            disabled={unread === 0}
            className="btn-ghost h-10 px-4 text-xs font-semibold"
          >
            Đánh dấu đã đọc tất cả
          </button>
        </div>
      </section>
    </div>
  )
}
