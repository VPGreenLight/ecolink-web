import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, Mail, X } from "lucide-react"
import { Stat } from "@/components/Portal"
import AvatarCropper from "@/components/AvatarCropper"
import UserAvatar from "@/components/UserAvatar"
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
import { fetchHandoverOrdersResult, fetchUserTransactions } from "@/lib/recyclerWorkflowApi"
import { fetchLeaderboard } from "@/lib/gamificationApi"
import { uploadComplaintEvidence } from "@/lib/reviewComplaintApi"

/** SU-01 Xem và cập nhật hồ sơ cá nhân.
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
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSsrSmokeTest()) return
    let active = true
    void fetchCurrentUserProfile().then((profile) => {
      if (!active || !profile) return
      setName(profile.fullName || profile.username)
      if (profile.phoneNumber) setPhone(profile.phoneNumber)
      if (typeof profile.avatarUrl === "string") setAvatarUrl(profile.avatarUrl)
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

  const uploadAvatar = async (blob: Blob) => {
    setErr("")
    setSavedMsg("")
    setUploadingAvatar(true)
    setAvatarPreview(URL.createObjectURL(blob))
    try {
      const up = await uploadComplaintEvidence(
        new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" }),
      )
      if (up.data?.fileUrl) {
        setAvatarUrl(up.data.fileUrl)
        setSavedMsg("Ảnh đã tải lên. Bấm Lưu hồ sơ để áp dụng.")
      }
    } catch (error) {
      setErr(formatAuthError(error))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const pickAvatarFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setErr("Chỉ chọn được tệp hình ảnh (JPG, PNG, WEBP).")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Ảnh đại diện không được vượt quá 5 MB.")
      return
    }
    setErr("")
    setCropFile(file)
  }

  const clearAvatar = () => {
    setAvatarUrl("")
    setAvatarPreview(null)
    setSavedMsg("")
    if (fileInputRef.current) fileInputRef.current.value = ""
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
    (session
      ? `${name.split(" ").slice(-1)[0]?.toLowerCase() ?? "ban"}@ecolink.vn`
      : "ban@ecolink.vn")

  const displayGreenPoints =
    session?.fromBackend && typeof session.currentGreenPoints === "number"
      ? fmt(session.currentGreenPoints)
      : fmt(getSpendPoints())

  const displayTreeTier =
    session?.fromBackend && typeof session.treeLevel === "number"
      ? `Cấp ${session.treeLevel}`
      : tierProgress().cur.name

  const roleText = session ? ROLE_LABEL[session.role] : "Người dân"
  const currentAvatar = avatarPreview ?? (avatarUrl.trim() || null)
  const phoneInvalid = !!err && !/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, ""))

  return (
    <div className="page flex flex-col gap-8">
      <header className="border-b border-line-soft pb-5">
        <p className="text-sm font-medium text-brand-deep">{roleText}</p>
        <h1 className="display mt-1 text-[26px] leading-8 tracking-tight text-ink sm:text-[28px] sm:leading-9">
          Hồ sơ cá nhân
        </h1>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <section className="flex flex-wrap items-center gap-5">
            <span className="block size-20 shrink-0 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line">
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt={`Ảnh đại diện của ${name || "bạn"}`}
                  className="size-full object-cover"
                />
              ) : (
                <span className="grid size-full place-items-center">
                  <UserAvatar name={name || "Thành viên EcoLink"} size="lg" />
                </span>
              )}
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-[15px] font-semibold text-ink">Ảnh đại diện</span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label
                  htmlFor="avatar-input"
                  className={`btn-outline inline-flex h-10 min-h-10 cursor-pointer items-center rounded-lg px-4 text-sm font-semibold ${
                    uploadingAvatar ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  {uploadingAvatar ? "Đang tải..." : "Chọn ảnh"}
                </label>
                <input
                  id="avatar-input"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  disabled={uploadingAvatar}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ""
                    pickAvatarFile(file)
                  }}
                  className="sr-only"
                />
                {currentAvatar && (
                  <button
                    type="button"
                    onClick={clearAvatar}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-warn"
                  >
                    <X className="size-4" />
                    Xóa ảnh
                  </button>
                )}
              </div>
              <span className="text-[13px] leading-5 text-muted">
                JPG, PNG hoặc WEBP · tối đa 5 MB
              </span>
            </div>
          </section>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
              <span>Tên hiển thị *</span>
              <input
                className={`input h-12 min-h-11 text-base sm:text-[15px] ${
                  err && name.trim().length < 2 ? "border-warn" : ""
                }`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setSavedMsg("")
                  if (err) setErr("")
                }}
              />
            </label>

            <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
              <span>Số điện thoại *</span>
              <input
                className={`input h-12 min-h-11 text-base tabular-nums sm:text-[15px] ${
                  phoneInvalid ? "border-warn" : ""
                }`}
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  setSavedMsg("")
                  if (err) setErr("")
                }}
              />
            </label>
          </div>

          <div className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            <span>Email đăng nhập</span>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3.5 py-2.5">
              <Mail className="size-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-normal text-body">
                {resolvedEmail}
              </span>
            </div>
            <span className="text-[12px] font-normal leading-5 text-muted">
              Email là định danh đăng nhập hệ thống nên không thay đổi tại đây.
            </span>
          </div>

          {err && (
            <p
              role="alert"
              className="rounded-lg border border-warn/25 bg-warn/5 px-3.5 py-2.5 text-sm leading-6 font-medium text-warn"
            >
              {err}
            </p>
          )}

          {savedMsg && (
            <p
              role="status"
              className="flex items-center gap-2 rounded-lg border border-brand/25 bg-brand/8 px-3.5 py-2.5 text-sm leading-6 font-semibold text-brand-deep"
            >
              <CheckCircle2 className="size-4 shrink-0 text-brand" />
              {savedMsg}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-5">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary h-12 min-h-11 rounded-lg px-6 text-sm font-semibold sm:text-[15px] disabled:opacity-60"
            >
              {submitting ? "Đang lưu..." : "Lưu hồ sơ"}
            </button>
          </div>
        </form>

        <section className="card flex flex-col gap-4 p-5">
          <h2 className="text-[15px] font-semibold text-ink">Tài khoản của bạn</h2>

          <div className="grid grid-cols-2 gap-4 border-b border-line-soft pb-4">
            <Stat label="Xếp hạng" value={rankDisplay} />
            <Stat label="Yêu cầu bàn giao" value={String(totalHandovers)} />
          </div>

          <dl className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] text-muted">Vai trò</dt>
              <dd className="text-[13px] font-semibold text-ink">{roleText}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] text-muted">Gói dịch vụ</dt>
              <dd className="text-[13px] font-semibold text-ink">
                {entitlements.currentTier}
                {entitlements.isAdFree ? " · Đã tắt quảng cáo" : ""}
              </dd>
            </div>
            {session?.username ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-muted">Tên đăng nhập</dt>
                <dd className="truncate text-[13px] font-semibold text-ink">
                  {session.username}
                </dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] text-muted">Điểm tiêu dùng</dt>
              <dd className="text-[13px] font-semibold tabular-nums text-ink">
                {displayGreenPoints}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] text-muted">Điểm xếp hạng</dt>
              <dd className="text-[13px] font-semibold tabular-nums text-ink">
                {rankPointsDisplay}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] text-muted">Hạng cây ảo</dt>
              <dd className="text-[13px] font-semibold text-ink">{displayTreeTier}</dd>
            </div>
            {session?.fromBackend && typeof session.totalRecycledKg === "number" ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-muted">Tổng phế liệu tái chế</dt>
                <dd className="text-[13px] font-semibold tabular-nums text-ink">
                  {session.totalRecycledKg} kg
                </dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] text-muted">Giao dịch đã hoàn tất</dt>
              <dd className="text-[13px] font-semibold tabular-nums text-ink">
                {String(completedDeals)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] text-muted">Biên nhận hoàn tất</dt>
              <dd className="text-[13px] font-semibold tabular-nums text-ink">
                {String(payoutCount)}
              </dd>
            </div>
          </dl>

          {(session?.role === "user" || session?.role === "recycler") && (
            <Link
              to={
                session.role === "recycler"
                  ? "/recycler#recycler-packages"
                  : "/user/payout#citizen-packages"
              }
              className="inline-flex items-center justify-between gap-3 rounded-lg border border-brand/25 bg-brand/6 px-3.5 py-2.5 text-[13px] font-semibold text-brand-deep transition-colors hover:bg-brand/12"
            >
              <span>
                {session.role === "recycler"
                  ? "Quản lý gói Tích xanh Pro & VietQR"
                  : entitlements.isAdFree
                    ? "Quản lý gói Premium tắt quảng cáo"
                    : "Nâng cấp gói Premium tắt quảng cáo"}
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </section>
      </div>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={(blob) => {
            setCropFile(null)
            void uploadAvatar(blob)
          }}
        />
      )}
    </div>
  )
}
