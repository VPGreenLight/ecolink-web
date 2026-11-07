import { useEffect, useState } from "react"
import { PageHead, Field, Stat, Status } from "@/components/Portal"
import { ROLE_LABEL, useSession } from "@/lib/session"
import {
  fetchCurrentUserProfile,
  formatAuthError,
  updateCurrentUserProfile,
} from "@/lib/authApi"
import { FLOWS } from "@/data/cashflow"
import { MY_HANDOVERS } from "@/data/handover"
import { LEADERBOARD, RANK_POINTS, SPEND_POINTS, fmt, tierProgress } from "@/data/rewards"

/** SU-01 Xem và cập nhật hồ sơ · SU-03 Thông báo hệ thống.
 *
 *  Đồng bộ trực tiếp với `GET /api/v1/auth/me` (nạp email, SĐT, điểm xanh, hạng cây ảo,
 *  tổng khối lượng tái chế từ PostgreSQL) và `PUT /api/v1/auth/profile` khi bấm Lưu hồ sơ. */
export default function Profile() {
  const session = useSession()
  const [name, setName] = useState(session?.name ?? "")
  const [phone, setPhone] = useState(session?.phoneNumber ?? "0901 234 567")
  const [area, setArea] = useState("Khu Công nghệ cao Hòa Lạc, Hà Nội")
  const [submitting, setSubmitting] = useState(false)
  const [savedMsg, setSavedMsg] = useState("")
  const [err, setErr] = useState("")

  useEffect(() => {
    let active = true
    void fetchCurrentUserProfile().then((profile) => {
      if (!active || !profile) return
      setName(profile.fullName || profile.username)
      if (profile.phoneNumber) {
        setPhone(profile.phoneNumber)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (name.trim().length < 2) {
      setErr("Tên hiển thị phải có ít nhất 2 ký tự.")
      setSavedMsg("")
      return
    }
    if (!/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, ""))) {
      setErr("Số điện thoại chưa đúng định dạng Việt Nam.")
      setSavedMsg("")
      return
    }

    setErr("")
    setSubmitting(true)
    try {
      const res = await updateCurrentUserProfile({
        fullName: name,
        phoneNumber: phone,
      })
      setSavedMsg(res.message)
    } catch (error) {
      setErr(formatAuthError(error))
      setSavedMsg("")
    } finally {
      setSubmitting(false)
    }
  }

  const resolvedEmail =
    session?.email ||
    (session ? `${name.split(" ").slice(-1)[0]?.toLowerCase() ?? "ban"}@ecolink.vn` : "ban@ecolink.vn")

  const displayGreenPoints =
    session?.fromBackend && typeof session.currentGreenPoints === "number"
      ? fmt(session.currentGreenPoints)
      : fmt(SPEND_POINTS)

  const displayTreeTier =
    session?.fromBackend && typeof session.treeLevel === "number"
      ? `Cấp ${session.treeLevel}`
      : tierProgress().cur.name

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="TÀI KHOẢN"
        title="Hồ sơ cá nhân"
        body="Tên hiển thị và thông tin liên hệ. Tên này là thứ người thu gom thấy khi họ tới nhà bạn, nên để tên gọi thật."
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <form onSubmit={submit} noValidate className="card flex flex-col gap-5 self-start p-5 md:p-6">
          <Field label="Tên hiển thị" hint="Người thu gom và nhân viên thấy tên này.">
            <input
              className={`input ${err && name.trim().length < 2 ? "border-warn" : ""}`}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSavedMsg("")
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
                setSavedMsg("")
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
            <input className="input" value={resolvedEmail} readOnly disabled />
            <span className="text-[12px] font-normal text-muted">
              Email là định danh đăng nhập{session?.isGoogleAuth ? " (đã liên kết Google OAuth)" : ""}, không đổi trên trang này.
            </span>
          </Field>

          {err && <p className="text-[13px] text-warn">{err}</p>}

          <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary h-11 px-6 disabled:opacity-60"
            >
              {submitting ? "Đang lưu..." : "Lưu hồ sơ"}
            </button>
            {savedMsg && (
              <p role="status" className="text-[13px] font-semibold text-brand">
                {savedMsg}
              </p>
            )}
          </div>
        </form>

        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="text-base font-bold text-ink">Tài khoản của bạn</h2>
            <dl className="flex flex-col gap-2 text-sm">
              {[
                ["Vai trò", session ? ROLE_LABEL[session.role] : "Người dân"],
                ...(session?.username ? [["Tên đăng nhập", session.username]] : []),
                ["Điểm tiêu dùng", displayGreenPoints],
                ["Điểm xếp hạng", fmt(RANK_POINTS)],
                ["Hạng cây ảo", displayTreeTier],
                ...(session?.fromBackend && typeof session.totalRecycledKg === "number"
                  ? [["Tổng phế liệu tái chế", `${session.totalRecycledKg} kg`]]
                  : []),
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

type Note = { id: string; text: string; time: string; needsAction: boolean }

const NOTES: Note[] = [
  {
    id: "n1",
    text: "Trạm Thu Gom Tái Chế Xanh Hòa Lạc đã nhận yêu cầu của bạn và chốt khung giờ 10:00 - 12:00.",
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
