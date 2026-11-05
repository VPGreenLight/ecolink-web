import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import { PageHead, Stat, Status } from "@/components/Portal"
import { MY_HANDOVERS, type HandoverStatus } from "@/data/handover"
import { FLOWS } from "@/data/cashflow"
import { STATS, fmtVnd } from "@/data/ops"
import {
  fetchRecyclerStatus,
  fetchSyncedHandoverOrders,
  toggleRecyclerOnlineStatus,
  updateRecyclerWarehousePin,
  type RecyclerProfileDto,
} from "@/lib/recyclerWorkflowApi"

type UpcomingRow = {
  id: string
  address: string
  date: string
  slot: string
  status: HandoverStatus
  pickupLat?: number
  pickupLng?: number
}

/** R-02 Bật/tắt trạng thái hoạt động trực tiếp trên bản đồ (`/map`) + R-01 Cập nhật ghim kho bãi.
 *
 *  Công tắc thật có `role="switch"` và `aria-checked`, kết nối trực tiếp tới
 *  `PATCH /api/v1/recycler/availability` của `RecyclerController`:
 *  - Khi tắt (`Offline`), ghim cơ sở lập tức ẩn khỏi `/map`, còn các lịch đang chờ xử lý vẫn giữ nguyên (`BR-MTH-06`).
 *  - Khi bật (`Online`), ghim cơ sở hiện trở lại ngay trên `/map`. */
export default function RecyclerHome() {
  const [open, setOpen] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [flash, setFlash] = useState("")
  const [syncedBackend, setSyncedBackend] = useState(false)

  const [profile, setProfile] = useState<RecyclerProfileDto>({
    recyclerId: "22222222-2222-2222-2222-222222222222",
    facilityName: "Vựa phế liệu EcoGreen",
    representativeName: "Trần Thu Gom",
    businessAddress: "123 Đường Nguyễn Hữu Cảnh, P. 22, Bình Thạnh, TP.HCM",
    latitude: 10.7938,
    longitude: 106.7182,
    operatingHours: "07:30 - 18:30",
    contactPhone: "0988776655",
    verificationStatus: "Verified",
    activeStatus: "Online",
    activePriceCount: 4,
  })

  const [editingLocation, setEditingLocation] = useState(false)
  const [draftLat, setDraftLat] = useState(10.7938)
  const [draftLng, setDraftLng] = useState(106.7182)
  const [draftAddress, setDraftAddress] = useState(
    "123 Đường Nguyễn Hữu Cảnh, P. 22, Bình Thạnh, TP.HCM",
  )
  const [savingPin, setSavingPin] = useState(false)

  const [handovers, setHandovers] = useState<UpcomingRow[]>(() =>
    MY_HANDOVERS.filter((h) => h.status !== "done"),
  )

  const payin = FLOWS.filter((f) => f.kind === "payin").reduce((s, f) => s + f.amount, 0)

  useEffect(() => {
    let active = true
    void fetchRecyclerStatus().then((res) => {
      if (!active) return
      setProfile(res.profile)
      setOpen(res.isOnline)
      setDraftLat(res.profile.latitude)
      setDraftLng(res.profile.longitude)
      setDraftAddress(res.profile.businessAddress)
      setSyncedBackend(res.fromBackend)
    })

    void fetchSyncedHandoverOrders("recycler").then((synced) => {
      if (!active || synced.length === 0) return
      const existingIds = new Set(MY_HANDOVERS.map((m) => m.id))
      const fresh: UpcomingRow[] = synced
        .filter((s) => !existingIds.has(s.id))
        .map((s) => ({
          id: s.id,
          address: s.address,
          date: s.date,
          slot: s.slot,
          status: s.status === "accepted" ? "accepted" : "pending",
          pickupLat: s.pickupLat,
          pickupLng: s.pickupLng,
        }))
      if (fresh.length > 0) {
        setHandovers([...fresh, ...MY_HANDOVERS.filter((h) => h.status !== "done")])
      }
    })

    return () => {
      active = false
    }
  }, [])

  const handleToggleAvailability = async () => {
    const nextOnline = !open
    setToggling(true)
    try {
      const res = await toggleRecyclerOnlineStatus(nextOnline)
      setOpen(res.isOnline)
      setSyncedBackend(res.fromBackend)
      setFlash(res.message)
    } catch (err) {
      setFlash(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật trạng thái hoạt động lúc này.",
      )
    } finally {
      setToggling(false)
    }
  }

  const handleSaveWarehousePin = async () => {
    setSavingPin(true)
    try {
      const res = await updateRecyclerWarehousePin(profile, draftLat, draftLng, draftAddress)
      setProfile(res.profile)
      setSyncedBackend(res.fromBackend)
      setEditingLocation(false)
      setFlash(
        res.fromBackend
          ? "Đã cập nhật toạ độ kho bãi lên PostGIS. Ghim trên bản đồ /map đã dời sang vị trí mới."
          : "Đã lưu vị trí kho bãi mới và đồng bộ với bản đồ.",
      )
    } finally {
      setSavingPin(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="VẬN HÀNH"
        title="Tổng quan cơ sở thu mua"
        body="Bật trạng thái hoạt động để hiện trên bản đồ và nhận yêu cầu mới. Tắt khi bạn không ra thu gom được."
      />

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-ink">Trạng thái hoạt động</p>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-muted">
              {profile.facilityName} · {syncedBackend ? "Đồng bộ CSDL trực tiếp" : "Chế độ trình duyệt"}
            </span>
          </div>
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
          disabled={toggling}
          onClick={() => void handleToggleAvailability()}
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
          {toggling ? "Đang lưu..." : open ? "Đang hoạt động" : "Đã tắt"}
        </button>
      </section>

      {flash && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/25 bg-brand/6 px-4 py-3">
          <p role="status" className="text-[13px] font-semibold text-brand-deep">
            {flash}
          </p>
          <Link to="/map" className="text-xs font-semibold text-brand hover:underline">
            Kiểm tra trên trang Bản đồ →
          </Link>
        </div>
      )}

      {/* Khung R-01: Quản lý vị trí ghim kho bãi trên bản đồ */}
      <section className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-ink">Vị trí kho bãi trên bản đồ</h2>
            <p className="mt-0.5 text-sm text-body">{profile.businessAddress}</p>
            <p className="mt-0.5 text-xs tabular-nums text-muted">
              Toạ độ hiện tại: {profile.latitude.toFixed(5)}, {profile.longitude.toFixed(5)} · Giờ mở cửa: {profile.operatingHours}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/map" className="btn-ghost h-9 px-3 text-xs">
              Xem trên /map
            </Link>
            <button
              type="button"
              onClick={() => setEditingLocation((v) => !v)}
              className="btn-outline h-9 px-3.5 text-xs"
            >
              {editingLocation ? "Đóng chỉnh vị trí" : "Cập nhật ghim kho bãi"}
            </button>
          </div>
        </div>

        {editingLocation && (
          <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
              Địa chỉ hiển thị công khai
              <input
                className="input"
                value={draftAddress}
                onChange={(e) => setDraftAddress(e.target.value)}
              />
            </label>
            <LocationPinPickerMap
              lat={draftLat}
              lng={draftLng}
              pinTitle={profile.facilityName}
              onChange={(nextLat, nextLng, hint) => {
                setDraftLat(nextLat)
                setDraftLng(nextLng)
                if (hint) setDraftAddress(hint)
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={savingPin}
                onClick={() => void handleSaveWarehousePin()}
                className="btn-primary h-10 px-5 text-xs"
              >
                {savingPin ? "Đang lưu toạ độ..." : "Lưu vị trí kho bãi"}
              </button>
              <span className="text-xs text-muted">
                Vị trí mới sẽ cập nhật ngay trên truy vấn bán kính của người dân.
              </span>
            </div>
          </div>
        )}
      </section>

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
                    {typeof h.pickupLat === "number" && typeof h.pickupLng === "number" && (
                      <span className="ml-2 tabular-nums text-brand-deep">
                        · Điểm hẹn GPS: {h.pickupLat.toFixed(4)}, {h.pickupLng.toFixed(4)}
                      </span>
                    )}
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
