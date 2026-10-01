import { useState } from "react"
import { Link } from "react-router-dom"
import { PageHead, Stat, Status } from "@/components/Portal"
import { MY_HANDOVERS } from "@/data/handover"
import { FLOWS } from "@/data/cashflow"
import { STATS, fmtVnd } from "@/data/ops"

/** R-02 Bật/tắt trạng thái hoạt động + tổng quan cơ sở thu mua.
 *
 *  Công tắc bật/tắt nằm ở trang tổ quan chứ không tách riêng: nó là thứ người
 *  thu gom kiểm tra đầu tiên mỗi sáng (đang nhận việc không), nên đặt ở trang
 *  này thì thấy ngay, tách trang riêng thì phải vào menu tìm.
 *
 *  Nút là công tắc thật có `role="switch"` và `aria-checked` để trình đọc
 *  màn hình đọc được trạng thái — một nút chỉ có màu đổi thì người dùng
 *  khiếm khả năng thị giác không biết mình đang bật hay tắt. */
export default function RecyclerHome() {
  const [open, setOpen] = useState(true)
  const [flash, setFlash] = useState("")
  const handovers = MY_HANDOVERS.filter((h) => h.status !== "done")
  const payin = FLOWS.filter((f) => f.kind === "payin").reduce((s, f) => s + f.amount, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="VẬN HÀNH"
        title="Tổng quan cơ sở thu mua"
        body="Bật trạng thái hoạt động để hiện trên bản đồ và nhận yêu cầu mới. Tắt khi bạn không ra thu gom được."
      />

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-base font-bold text-ink">Trạng thái hoạt động</p>
          <p className="mt-1 text-sm leading-6 text-body">
            {open
              ? "Cơ sở của bạn đang hiện trên bản đồ và nhận yêu cầu mới."
              : "Đã ẩn khỏi bản đồ. Người dân không đặt được lịch cho tới khi bật lại."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          onClick={() => {
            setOpen((v) => !v)
            setFlash(
              open
                ? "Đã tắt. Cơ sở không còn hiện trên bản đồ và không nhận yêu cầu mới. Lịch đang chờ vẫn giữ nguyên."
                : "Đã bật. Cơ sở hiện trên bản đồ ngay.",
            )
          }}
          className={`inline-flex h-12 shrink-0 items-center gap-3 rounded-full border px-5 text-sm font-semibold transition-colors ${
            open
              ? "border-brand bg-brand/10 text-brand-deep"
              : "border-line bg-surface-2 text-body"
          }`}
        >
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              open ? "bg-brand" : "bg-sage-line"
            }`}
          >
            <span
              className={`absolute top-1 size-4 rounded-full bg-white transition-all ${
                open ? "left-6" : "left-1"
              }`}
            />
          </span>
          {open ? "Đang hoạt động" : "Đã tắt"}
        </button>
      </section>

      {flash && (
        <p role="status" className="text-[13px] font-semibold text-brand">
          {flash}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Yêu cầu đang mở"
          value={String(handovers.length)}
          note="Chờ xác nhận hoặc đã nhận"
        />
        <Stat
          label="Cơ sở thu mua"
          value={STATS.recyclers.toLocaleString("vi-VN")}
          note="Toàn hệ thống"
        />
        <Stat label="Tiền đã thu gom" value={fmtVnd(payin)} note="Đã chuyển qua VietQR" />
        <Stat
          label="Giao dịch 30 ngày"
          value={STATS.handovers30d.toLocaleString("vi-VN")}
          note="Toàn hệ thống"
        />
      </div>

      <section className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-base font-bold text-ink">Lịch sắp tới</h2>
          <Link
            to="/recycler/requests"
            className="text-[13px] font-semibold text-brand hover:text-brand-deep"
          >
            Xem tất cả yêu cầu →
          </Link>
        </div>
        {handovers.length === 0 ? (
          <p className="text-sm text-muted">Chưa có lịch nào đang mở.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {handovers.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">
                    {h.address}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {h.date} · {h.slot}
                  </span>
                </span>
                <Status tone={h.status === "pending" ? "wait" : "todo"}>
                  {h.status === "pending" ? "Chờ xác nhận" : "Đã nhận"}
                </Status>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}