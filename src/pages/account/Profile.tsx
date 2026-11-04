import { useState } from "react"
import { PageHead, Field, Stat, Status } from "@/components/Portal"
import { useSession } from "@/lib/session"
import { FLOWS } from "@/data/cashflow"
import { MY_HANDOVERS } from "@/data/handover"
import { LEADERBOARD, RANK_POINTS, SPEND_POINTS, fmt, tierProgress } from "@/data/rewards"

/** SU-01 Xem và cập nhật hồ sơ · SU-03 Thông báo hệ thống.
 *
 *  Gộp vì cùng một nguồn dữ liệu: hồ sơ và danh sách thông báo đều là "việc
 *  của tài khoản này". Tách hai trang thì người dùng phải biết cái nào ở
 *  đâu, mà cả hai đều là việc người dùng làm hằng ngày.
 *
 *  Đổi mật khẩu (SU-02) tách riêng thành `/account/password` vì đó là thao tác
 *  có xác thực, không phải chỉnh sửa hồ sơ. */
export default function Profile() {
  const session = useSession()
  const [name, setName] = useState(session?.name ?? "")
  const [phone, setPhone] = useState("0901 234 567")
  const [area, setArea] = useState("Quận 3, TP. Hồ Chí Minh")
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) {
      setErr("Tên hiển thị phải có ít nhất 2 ký tự.")
      setSaved(false)
      return
    }
    if (!/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, ""))) {
      setErr("Số điện thoại chưa đúng định dạng Việt Nam.")
      setSaved(false)
      return
    }
    setErr("")
    // ponytail: chưa có backend. Nối API thì thay đúng dòng này.
    setSaved(true)
  }

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="TÀI KHOẢN"
        title="Hồ sơ cá nhân"
        body="Tên hiển thị và thông tin liên hệ. Tên này là thứ người thu gom thấy khi họ tới nhà bạn, nên để tên gọi thật."
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* self-start: mặc định grid kéo phần tử cao bằng hàng, nên thẻ form
            bị dài bằng cột thông báo và để lại một khoảng trắng lớn dưới nút. */}
        <form onSubmit={submit} noValidate className="card flex flex-col gap-5 self-start p-5 md:p-6">
          <Field label="Tên hiển thị" hint="Người thu gom và nhân viên thấy tên này.">
            <input
              className={`input ${err && name.trim().length < 2 ? "border-warn" : ""}`}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSaved(false)
              }}
            />
          </Field>

          <Field label="Số điện thoại" hint="Dùng để báo lịch thu gom và liên hệ khi có khiếu nại.">
            <input
              className={`input tabular-nums ${
                err && !/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, "")) ? "border-warn" : ""
              }`}
              inputMode="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setSaved(false)
              }}
            />
          </Field>

          <Field label="Khu vực" hint="Dùng để đề xuất điểm thu gom gần bạn nhất.">
            <input
              className="input"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </Field>

          <Field label="Email">
            <input
              className="input"
              value={session ? `${name.split(" ").slice(-1)[0]?.toLowerCase() ?? "ban"}@email.vn` : "ban@email.vn"}
              readOnly
              disabled
            />
            <span className="text-[12px] font-normal text-muted">
              Email là định danh đăng nhập, không đổi trên trang này.
            </span>
          </Field>

          {err && <p className="text-[13px] text-warn">{err}</p>}

          <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
            <button type="submit" className="btn-primary h-11 px-6">
              Lưu hồ sơ
            </button>
            {saved && (
              <p role="status" className="text-[13px] font-semibold text-brand">
                Đã lưu hồ sơ.
              </p>
            )}
          </div>
        </form>

        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="text-base font-bold text-ink">Tài khoản của bạn</h2>
            <dl className="flex flex-col gap-2 text-sm">
              {[
                ["Vai trò", session?.role === "recycler" ? "Cơ sở thu mua" : session?.role === "staff" ? "Nhân viên" : session?.role === "admin" ? "Quản trị viên" : "Người dân"],
                ["Điểm tiêu dùng", fmt(SPEND_POINTS)],
                ["Điểm xếp hạng", fmt(RANK_POINTS)],
                ["Hạng cây ảo", tierProgress().cur.name],
                ["Giao dịch đã hoàn tất", String(MY_HANDOVERS.filter((h) => h.status === "done").length)],
                ["Khoản đã nhận", String(FLOWS.filter((f) => f.kind === "payout").length)],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-3 border-b border-line-soft pb-2"
                >
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Stat label="Xếp hạng" value={`#${LEADERBOARD.findIndex((r) => r.you) + 1}`} />
              <Stat label="Yêu cầu bàn giao" value={String(MY_HANDOVERS.length)} />
            </div>
          </section>

          <Notifications />
        </div>
      </div>
    </div>
  )
}

/** SU-03 Thông báo hệ thống. Ba thông báo mẫu đủ để thấy cách phân loại:
 *  cột phải là việc người dùng cần làm, cột trái là tin chỉ để đọc. */
type Note = { id: string; text: string; time: string; needsAction: boolean }

const NOTES: Note[] = [
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

function Notifications() {
  const [read, setRead] = useState<Record<string, boolean>>({})
  const unread = NOTES.filter((n) => !read[n.id]).length

  return (
    <section className="card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-ink">Thông báo</h2>
        <span className="text-[13px] text-muted">
          {unread === 0 ? "Đã đọc hết" : `${unread} chưa đọc`}
        </span>
      </div>

      {NOTES.length === 0 ? (
        <p className="text-sm text-muted">Chưa có thông báo nào.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {NOTES.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border px-4 py-3 ${
                read[n.id] ? "border-line-soft bg-surface" : "border-brand/25 bg-brand/6"
              }`}
            >
              <p className="text-[13px] leading-5 text-ink">{n.text}</p>
              <p className="mt-1 flex items-center gap-2 text-[12px] text-muted">
                {n.time}
                {n.needsAction && !read[n.id] && <Status tone="wait">Cần xử lý</Status>}
              </p>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() =>
          setRead(Object.fromEntries(NOTES.map((n) => [n.id, true])))
        }
        disabled={unread === 0}
        className="btn-ghost h-10 w-fit px-4 text-[13px]"
      >
        Đánh dấu đã đọc tất cả
      </button>
    </section>
  )
}