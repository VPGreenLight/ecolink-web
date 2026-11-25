import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { FormRequiredLegend, PageHead, Field, Stat, Status } from "@/components/Portal"
import { getAccessToken, ROLE_LABEL, useSession } from "@/lib/session"
import { useEntitlements } from "@/lib/servicePackageApi"
import {
  fetchCurrentUserProfile,
  formatAuthError,
  updateCurrentUserProfile,
} from "@/lib/authApi"
import { MY_HANDOVERS } from "@/data/handover"
import { LEADERBOARD, RANK_POINTS, getSpendPoints, fmt, tierProgress } from "@/data/rewards"
import { initApiState, isSsrSmokeTest } from "@/lib/hydration"
import { fetchMyNotifications, markAllNotificationsRead } from "@/lib/notificationsApi"
import { fetchHandoverOrdersResult, fetchUserTransactions } from "@/lib/recyclerWorkflowApi"
import { fetchLeaderboard } from "@/lib/gamificationApi"
import { uploadComplaintEvidence } from "@/lib/reviewComplaintApi"

/** SU-01 Xem và cập nhật hồ sơ · SU-03 Thông báo hệ thống.
 *
 *  Đồng bộ trực tiếp với `GET /api/v1/auth/me` (nạp email, SĐT, ảnh đại diện, điểm xanh,
 *  hạng cây ảo, tổng khối lượng tái chế từ PostgreSQL) và `PUT /api/v1/auth/profile` khi bấm Lưu hồ sơ. */
export default function Profile() {
  const session = useSession()
  const entitlements = useEntitlements()
  const [name, setName] = useState(session?.name ?? "")
  const [phone, setPhone] = useState(() =>
    session?.phoneNumber ?? initApiState("", "0901 234 567"),
  )
  const [avatarUrl, setAvatarUrl] = useState(session?.avatarUrl ?? "")
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [completedDeals, setCompletedDeals] = useState(() =>
    initApiState(0, MY_HANDOVERS.filter((h) => h.status === "done").length),
  )
  const [totalHandovers, setTotalHandovers] = useState(() =>
    initApiState(0, MY_HANDOVERS.length),
  )
  const [payoutCount, setPayoutCount] = useState(() =>
    initApiState(0, MY_HANDOVERS.filter((h) => h.status === "done").length),
  )
  const [rankDisplay, setRankDisplay] = useState<string>(() =>
    initApiState("—", `#${LEADERBOARD.findIndex((r) => r.you) + 1}`),
  )
  const [rankPointsDisplay, setRankPointsDisplay] = useState<string>(() =>
    initApiState("0", fmt(RANK_POINTS)),
  )
  const [submitting, setSubmitting] = useState(false)
  const [savedMsg, setSavedMsg] = useState("")
  const [err, setErr] = useState("")

  useEffect(() => {
    if (isSsrSmokeTest()) return
    let active = true
    void fetchCurrentUserProfile().then((profile) => {
      if (!active || !profile) return
      setName(profile.fullName || profile.username)
      if (profile.phoneNumber) {
        setPhone(profile.phoneNumber)
      }
      if (typeof profile.avatarUrl === "string") {
        setAvatarUrl(profile.avatarUrl)
      }
    })
    if (getAccessToken()) {
      void Promise.allSettled([
        fetchHandoverOrdersResult(session?.role === "recycler" ? "recycler" : "user"),
        fetchUserTransactions(undefined, undefined, 1, 100),
        fetchLeaderboard({ top: 10 }),
      ]).then(([ordRes, txRes, lbRes]) => {
        if (!active) return
        if (ordRes.status === "fulfilled" && ordRes.value.fromBackend) {
          const orders = ordRes.value.orders
          setTotalHandovers(orders.length)
          setCompletedDeals(orders.filter((o) => o.status === "done").length)
        }
        if (txRes.status === "fulfilled" && txRes.value.fromBackend) {
          setPayoutCount(txRes.value.data.totalCount ?? txRes.value.data.items.length)
        }
        if (lbRes.status === "fulfilled" && lbRes.value.data?.myEntry) {
          const me = lbRes.value.data.myEntry
          setRankDisplay(`#${me.rank}`)
          setRankPointsDisplay(fmt(me.totalPoints))
        }
      })
    }
    return () => {
      active = false
    }
  }, [session?.role])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setErr("Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WEBP).")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Ảnh đại diện không được vượt quá 5 MB.")
      return
    }
    setErr("")
    setSavedMsg("")
    setUploadingAvatar(true)
    try {
      const up = await uploadComplaintEvidence(file)
      if (up.data?.fileUrl) {
        setAvatarUrl(up.data.fileUrl)
        setSavedMsg("Đã tải ảnh đại diện lên thành công. Hãy bấm Lưu hồ sơ để áp dụng.")
      }
    } catch (error) {
      setErr(formatAuthError(error))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (name.trim().length < 2) {
      setErr("Tên hiển thị phải có ít nhất 2 ký tự.")
      setSavedMsg("")
      return
    }
    if (name.trim().length > 100) {
      setErr("Tên hiển thị không được vượt quá 100 ký tự.")
      setSavedMsg("")
      return
    }
    if (!/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, ""))) {
      setErr("Số điện thoại chưa đúng định dạng Việt Nam.")
      setSavedMsg("")
      return
    }
    if (avatarUrl.trim().length > 500) {
      setErr("Đường dẫn ảnh đại diện không được vượt quá 500 ký tự.")
      setSavedMsg("")
      return
    }

    setErr("")
    setSubmitting(true)
    try {
      const res = await updateCurrentUserProfile({
        fullName: name,
        phoneNumber: phone,
        avatarUrl: avatarUrl.trim(),
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
      : fmt(getSpendPoints())

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
          <FormRequiredLegend />
          <Field label="Tên hiển thị" required hint="Người thu gom và nhân viên thấy tên này.">
            <input
              className={`input ${err && name.trim().length < 2 ? "border-warn" : ""}`}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSavedMsg("")
              }}
            />
          </Field>

          <Field label="Số điện thoại" required hint="Dùng để báo lịch thu gom và liên hệ khi có khiếu nại.">
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

          <Field label="Ảnh đại diện" hint="Tải ảnh lên hoặc dán đường dẫn ảnh (tối đa 500 ký tự).">
            <div className="flex flex-wrap items-center gap-3">
              {avatarUrl.trim() ? (
                <img
                  src={avatarUrl.trim()}
                  alt="Xem trước ảnh đại diện"
                  className="size-12 shrink-0 rounded-full border border-line object-cover"
                />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-xs font-bold text-muted">
                  Ảnh
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <input
                  className="input min-w-[180px] flex-1"
                  value={avatarUrl}
                  onChange={(e) => {
                    setAvatarUrl(e.target.value)
                    setSavedMsg("")
                  }}
                  placeholder="https://..."
                />
                <label className="btn-outline h-10 cursor-pointer px-3.5 text-xs">
                  {uploadingAvatar ? "Đang tải..." : "Chọn ảnh"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingAvatar}
                    onChange={(e) => {
                      void handleAvatarUpload(e)
                    }}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          </Field>

          <Field label="Email">
            <input className="input" value={resolvedEmail} readOnly disabled />
            <span className="text-[12px] font-normal text-muted">
              Email là định danh đăng nhập{session?.isGoogleAuth ? " (đã liên kết Google OAuth)" : ""}, không đổi trên trang này.
            </span>
          </Field>

          {err && (
            <p role="alert" className="text-[13px] font-medium text-warn">
              {err}
            </p>
          )}

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
                ["Gói dịch vụ", entitlements.isAdFree ? `${entitlements.currentTier} (Đã tắt quảng cáo)` : `${entitlements.currentTier} (Mặc định)`],
                ...(session?.username ? [["Tên đăng nhập", session.username]] : []),
                ["Điểm tiêu dùng", displayGreenPoints],
                ["Điểm xếp hạng", rankPointsDisplay],
                ["Hạng cây ảo", displayTreeTier],
                ...(session?.fromBackend && typeof session.totalRecycledKg === "number"
                  ? [["Tổng phế liệu tái chế", `${session.totalRecycledKg} kg`]]
                  : []),
                ["Giao dịch đã hoàn tất", String(completedDeals)],
                ["Biên nhận hoàn tất", String(payoutCount)],
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
              <Stat label="Xếp hạng" value={rankDisplay} />
              <Stat label="Yêu cầu bàn giao" value={String(totalHandovers)} />
            </div>
            {(session?.role === "user" || session?.role === "recycler") && (
              <Link
                to={
                  session.role === "recycler"
                    ? "/recycler#recycler-packages"
                    : "/user/payout#citizen-packages"
                }
                className="mt-1 inline-flex items-center justify-between rounded-xl border border-brand/25 bg-brand/6 px-3.5 py-2.5 text-xs font-semibold text-brand-deep transition-colors hover:bg-brand/12"
              >
                <span>
                  {session.role === "recycler"
                    ? "Quản lý gói Tích xanh Pro & VietQR"
                    : entitlements.isAdFree
                      ? "Quản lý gói Premium tắt quảng cáo"
                      : "Nâng cấp gói Premium tắt quảng cáo"}
                </span>
                <span>→</span>
              </Link>
            )}
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
    text: "Biên nhận bàn giao BH-2609-0184 đã hoàn tất và cập nhật Điểm Mầm Xanh.",
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
  const [notes, setNotes] = useState<Note[]>(() => initApiState([], NOTES))
  const [read, setRead] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (isSsrSmokeTest() || !getAccessToken()) return
    let active = true
    void fetchMyNotifications({ pageNumber: 1, pageSize: 10 })
      .then((res) => {
        if (!active || !res.success || !res.data) return
        const mapped: Note[] = res.data.items.map((n) => ({
          id: n.id,
          text: n.message,
          time: new Date(n.createdAt).toLocaleString("vi-VN"),
          needsAction: !n.isRead,
        }))
        setNotes(mapped)
        const initialRead: Record<string, boolean> = {}
        for (const item of res.data.items) {
          if (item.isRead) initialRead[item.id] = true
        }
        setRead(initialRead)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const unread = notes.filter((n) => !read[n.id]).length

  return (
    <section className="card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-ink">Thông báo</h2>
        <span className="text-[13px] text-muted">
          {unread === 0 ? "Đã đọc hết" : `${unread} chưa đọc`}
        </span>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-muted">Chưa có thông báo nào.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
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
        onClick={() => {
          setRead(Object.fromEntries(notes.map((n) => [n.id, true])))
          if (getAccessToken()) void markAllNotificationsRead().catch(() => {})
        }}
        disabled={unread === 0}
        className="btn-ghost h-10 w-fit px-4 text-[13px]"
      >
        Đánh dấu đã đọc tất cả
      </button>
    </section>
  )
}
