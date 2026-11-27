import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Camera, ShieldAlert } from "lucide-react"
import FacilityPhotoCard from "@/components/FacilityPhotoCard"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import { PageHead } from "@/components/Portal"
import { initApiState, isSsrSmokeTest } from "@/lib/hydration"
import {
  fetchRecyclerStatus,
  updateRecyclerProfile,
  updateRecyclerWarehousePin,
  updateRecyclerWeeklySchedule,
  uploadSingleDocument,
  type RecyclerProfileDto,
  type ScheduleDayDto,
} from "@/lib/recyclerWorkflowApi"
import { getSession, hasLiveBackendAuth } from "@/lib/session"

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Thứ hai",
  2: "Thứ ba",
  3: "Thứ tư",
  4: "Thứ năm",
  5: "Thứ sáu",
  6: "Thứ bảy",
  0: "Chủ nhật",
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function buildDefaultWeeklySchedule(incoming?: ScheduleDayDto[]): ScheduleDayDto[] {
  const byDay = new Map<number, ScheduleDayDto>()
  for (const d of incoming ?? []) {
    byDay.set(d.dayOfWeek, d)
  }
  return WEEKDAY_ORDER.map((dayOfWeek) => {
    const existing = byDay.get(dayOfWeek)
    return existing
      ? {
          dayOfWeek,
          isClosed: Boolean(existing.isClosed),
          openTime: existing.openTime || "07:30",
          closeTime: existing.closeTime || "18:30",
        }
      : {
          dayOfWeek,
          isClosed: dayOfWeek === 0,
          openTime: "07:30",
          closeTime: "18:30",
        }
  })
}

/** R-01 & R-02 Hồ sơ kho bãi, vị trí ghim trên bản đồ, ảnh mặt tiền và lịch hoạt động tuần. */
export default function RecyclerFacility() {
  const liveAuth = hasLiveBackendAuth()
  const [flash, setFlash] = useState("")
  const [actionErr, setActionErr] = useState("")
  const [profile, setProfile] = useState<RecyclerProfileDto>(() =>
    liveAuth
      ? {
          recyclerId: "",
          facilityName: getSession()?.name || "Đang tải hồ sơ cơ sở...",
          representativeName: getSession()?.name || "",
          businessAddress: "",
          latitude: 21.0182,
          longitude: 105.5345,
          operatingHours: "07:30 - 19:00",
          contactPhone: "",
          verificationStatus: "Verified",
          activeStatus: "Online",
          activePriceCount: 0,
        }
      : {
          recyclerId: "22222222-2222-2222-2222-222222222222",
          facilityName: "Vựa phế liệu EcoGreen Hòa Lạc",
          representativeName: "Trần Thu Gom",
          businessAddress: "Số 18 Đại lộ Thăng Long, Khu CNC Hòa Lạc, Thạch Thất, Hà Nội",
          latitude: 21.0138,
          longitude: 105.5256,
          operatingHours: "07:30 - 18:30",
          contactPhone: "0988776655",
          verificationStatus: "Verified",
          activeStatus: "Online",
          activePriceCount: 4,
        },
  )

  const [editingLocation, setEditingLocation] = useState(false)
  const [draftLat, setDraftLat] = useState(21.0138)
  const [draftLng, setDraftLng] = useState(105.5256)
  const [draftAddress, setDraftAddress] = useState(() =>
    initApiState("", "Số 18 Đại lộ Thăng Long, Khu CNC Hòa Lạc, Thạch Thất, Hà Nội"),
  )
  const [savingPin, setSavingPin] = useState(false)
  const [pinErr, setPinErr] = useState("")

  const [editingProfile, setEditingProfile] = useState(false)
  const [draftFacilityName, setDraftFacilityName] = useState(() => profile.facilityName)
  const [draftRepresentativeName, setDraftRepresentativeName] = useState(
    () => profile.representativeName ?? "",
  )
  const [draftContactPhone, setDraftContactPhone] = useState(() => profile.contactPhone)
  const [draftOperatingHours, setDraftOperatingHours] = useState(() => profile.operatingHours)
  const [draftDescription, setDraftDescription] = useState(() => profile.description ?? "")
  const [draftBusinessPhotoUrl, setDraftBusinessPhotoUrl] = useState(
    () => profile.businessPhotoUrl ?? "",
  )
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileErr, setProfileErr] = useState("")

  const [editingSchedule, setEditingSchedule] = useState(false)
  const [weeklySchedule, setWeeklySchedule] = useState<ScheduleDayDto[]>(() =>
    buildDefaultWeeklySchedule(),
  )
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleErr, setScheduleErr] = useState("")

  useEffect(() => {
    if (isSsrSmokeTest()) return
    let active = true
    void fetchRecyclerStatus()
      .then((res) => {
        if (!active) return
        setProfile(res.profile)
        setDraftLat(res.profile.latitude)
        setDraftLng(res.profile.longitude)
        setDraftAddress(res.profile.businessAddress)
        setDraftFacilityName(res.profile.facilityName)
        setDraftRepresentativeName(res.profile.representativeName ?? "")
        setDraftContactPhone(res.profile.contactPhone)
        setDraftOperatingHours(res.profile.operatingHours)
        setDraftDescription(res.profile.description ?? "")
        setDraftBusinessPhotoUrl(res.profile.businessPhotoUrl ?? "")
        setWeeklySchedule(buildDefaultWeeklySchedule(res.weeklySchedule))
      })
      .catch((err) => {
        if (active && liveAuth) {
          setActionErr(
            err instanceof Error ? err.message : "Không thể tải thông tin kho bãi.",
          )
        }
      })
    return () => {
      active = false
    }
  }, [liveAuth])

  const isKybVerified = String(profile.verificationStatus ?? "").toLowerCase() === "verified"

  const handleSaveWarehousePin = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (savingPin) return
    setPinErr("")
    setActionErr("")
    setFlash("")
    const cleanAddress = draftAddress.trim()
    if (cleanAddress.length < 5 || cleanAddress.length > 255) {
      setPinErr("Địa chỉ kho bãi công khai phải từ 5 đến 255 ký tự.")
      return
    }
    if (!Number.isFinite(draftLat) || !Number.isFinite(draftLng) || (draftLat === 0 && draftLng === 0)) {
      setPinErr("Vui lòng chọn toạ độ vị trí kho bãi hợp lệ trên bản đồ.")
      return
    }
    setSavingPin(true)
    try {
      const res = await updateRecyclerWarehousePin(profile, draftLat, draftLng, cleanAddress)
      setProfile(res.profile)
      setEditingLocation(false)
      setFlash(
        res.fromBackend
          ? "Đã cập nhật toạ độ kho bãi lên hệ thống. Ghim trên bản đồ /map đã dời sang vị trí mới."
          : "Đã lưu vị trí kho bãi mới và đồng bộ với bản đồ.",
      )
    } catch (err) {
      setPinErr(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật vị trí kho bãi lên hệ thống.",
      )
    } finally {
      setSavingPin(false)
    }
  }

  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingProfile) return
    setProfileErr("")
    setActionErr("")
    setFlash("")

    const cleanFacility = draftFacilityName.trim()
    const cleanRep = draftRepresentativeName.trim()
    const cleanPhone = draftContactPhone.trim()
    const cleanHours = draftOperatingHours.trim()

    if (cleanFacility.length < 2 || cleanFacility.length > 150) {
      setProfileErr("Tên cơ sở thu mua phải từ 2 đến 150 ký tự.")
      return
    }
    if (cleanRep.length > 100) {
      setProfileErr("Tên người đại diện tối đa 100 ký tự.")
      return
    }
    if (
      !cleanPhone ||
      cleanPhone.length > 20 ||
      !/^(?:\+84|0)\d{9,10}$/.test(cleanPhone.replace(/[\s.\-()]/g, ""))
    ) {
      setProfileErr("Số điện thoại liên hệ chưa đúng định dạng Việt Nam (tối đa 20 ký tự).")
      return
    }
    if (cleanHours.length > 100) {
      setProfileErr("Giờ hoạt động tóm tắt tối đa 100 ký tự.")
      return
    }
    if (uploadingPhoto) {
      setProfileErr("Đang tải ảnh mặt tiền / kho bãi lên, vui lòng đợi xong rồi lưu.")
      return
    }

    setSavingProfile(true)
    try {
      const res = await updateRecyclerProfile(profile, {
        facilityName: cleanFacility,
        representativeName: cleanRep || null,
        contactPhone: cleanPhone,
        operatingHours: cleanHours || profile.operatingHours,
        description: draftDescription.trim() || null,
        businessPhotoUrl: draftBusinessPhotoUrl.trim() || null,
      })
      setProfile(res.profile)
      setDraftBusinessPhotoUrl(res.profile.businessPhotoUrl ?? "")
      setEditingProfile(false)
      setFlash(res.message)
    } catch (err) {
      setProfileErr(
        err instanceof Error ? err.message : "Không thể cập nhật thông tin hồ sơ cơ sở.",
      )
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSelectFacilityPhoto = async (file: File | null) => {
    if (!file) return
    setProfileErr("")
    if (!file.type.startsWith("image/")) {
      setProfileErr("Vui lòng chọn tệp ảnh (JPG, PNG hoặc WebP).")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileErr("Kích thước ảnh kho bãi tối đa 5 MB.")
      return
    }
    setUploadingPhoto(true)
    try {
      const uploadedUrl = await uploadSingleDocument(file, "facility-photo")
      setDraftBusinessPhotoUrl(uploadedUrl)
    } catch (err) {
      if (hasLiveBackendAuth()) {
        setProfileErr(
          err instanceof Error
            ? err.message
            : "Không thể tải ảnh mặt tiền / kho bãi lên hệ thống.",
        )
      } else {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
          reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh."))
          reader.readAsDataURL(file)
        }).catch(() => "")
        if (dataUrl) {
          setDraftBusinessPhotoUrl(dataUrl)
        } else {
          setProfileErr("Không thể đọc tệp ảnh vừa chọn.")
        }
      }
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSaveWeeklySchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingSchedule) return
    setScheduleErr("")
    setActionErr("")
    setFlash("")

    if (!isKybVerified) {
      setScheduleErr(
        "Hồ sơ cơ sở phải ở trạng thái Verified mới có thể cập nhật lịch hoạt động theo tuần.",
      )
      return
    }

    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/
    for (const d of weeklySchedule) {
      if (d.isClosed) continue
      const openTime = (d.openTime ?? "").trim()
      const closeTime = (d.closeTime ?? "").trim()
      if (!timeRe.test(openTime) || !timeRe.test(closeTime)) {
        setScheduleErr(
          `${WEEKDAY_LABELS[d.dayOfWeek] ?? `Ngày ${d.dayOfWeek}`}: Giờ mở/đóng cửa phải theo định dạng HH:mm (ví dụ 07:30).`,
        )
        return
      }
      if (closeTime <= openTime) {
        setScheduleErr(
          `${WEEKDAY_LABELS[d.dayOfWeek] ?? `Ngày ${d.dayOfWeek}`}: Giờ đóng cửa phải lớn hơn giờ mở cửa.`,
        )
        return
      }
    }

    setSavingSchedule(true)
    try {
      const normalizedDays: ScheduleDayDto[] = weeklySchedule.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        isClosed: d.isClosed,
        openTime: d.isClosed ? null : (d.openTime ?? "07:30").trim(),
        closeTime: d.isClosed ? null : (d.closeTime ?? "18:30").trim(),
      }))
      const res = await updateRecyclerWeeklySchedule(normalizedDays)
      if (Array.isArray(res.availability.weeklySchedule)) {
        setWeeklySchedule(buildDefaultWeeklySchedule(res.availability.weeklySchedule))
      }
      setProfile((p) => ({
        ...p,
        operatingHours: res.availability.operatingHours || p.operatingHours,
        activeStatus: res.availability.activeStatus || p.activeStatus,
      }))
      setDraftOperatingHours(res.availability.operatingHours || profile.operatingHours)
      setEditingSchedule(false)
      setFlash(res.message)
    } catch (err) {
      setScheduleErr(
        err instanceof Error ? err.message : "Không thể lưu lịch hoạt động theo tuần.",
      )
    } finally {
      setSavingSchedule(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="KHO BÃI & BẢN ĐỒ"
        title="Hồ sơ kho bãi"
        body="Quản lý vị trí ghim kho bãi trên bản đồ, ảnh thực tế mặt tiền, giới thiệu cơ sở và lịch hoạt động theo tuần."
        action={
          <Link to="/map" className="btn-outline min-h-10 px-4 text-sm font-semibold">
            Xem trên /map
          </Link>
        }
      />

      {!isKybVerified && (
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex items-center gap-2 font-bold">
              <ShieldAlert className="size-4 shrink-0 text-amber-700" />
              Hồ sơ đối tác thu mua đang ở trạng thái:{" "}
              <span>
                {profile.verificationStatus === "Rejected"
                  ? "Cần bổ sung (Rejected)"
                  : "Chờ thẩm định (Pending)"}
              </span>
            </p>
            <p className="text-sm leading-6">
              Hoàn tất xác minh KYB để cập nhật lịch hoạt động theo tuần và hiển thị ghim trên bản đồ.
            </p>
          </div>
          <Link to="/join-recycler" className="btn-outline min-h-10 shrink-0 bg-white px-4 text-sm font-semibold">
            Xem / nộp lại hồ sơ KYB →
          </Link>
        </section>
      )}

      {actionErr && (
        <p
          role="alert"
          className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn"
        >
          {actionErr}
        </p>
      )}
      {flash && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/25 bg-brand/6 px-4 py-3">
          <p role="status" className="text-sm font-semibold text-brand-deep">
            {flash}
          </p>
          <Link to="/map" className="text-sm font-semibold text-brand hover:underline">
            Kiểm tra trên trang Bản đồ →
          </Link>
        </div>
      )}

      <section className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-ink">Vị trí kho bãi trên bản đồ</h2>
            <p className="mt-0.5 text-sm text-body">{profile.businessAddress}</p>
            <p className="mt-0.5 text-sm leading-6 tabular-nums text-muted">
              Toạ độ hiện tại: {profile.latitude.toFixed(5)}, {profile.longitude.toFixed(5)} · Giờ mở cửa: {profile.operatingHours}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingProfile((v) => !v)
                setProfileErr("")
              }}
              className="btn-outline min-h-10 px-4 text-sm font-semibold"
            >
              {editingProfile ? "Đóng mô tả cơ sở" : "Sửa mô tả & liên hệ"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingSchedule((v) => !v)
                setScheduleErr("")
              }}
              className="btn-outline min-h-10 px-4 text-sm font-semibold"
            >
              {editingSchedule ? "Đóng lịch tuần" : "Lịch hoạt động tuần (R-02)"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingLocation((v) => !v)
                setPinErr("")
              }}
              className="btn-outline min-h-10 px-4 text-sm font-semibold"
            >
              {editingLocation ? "Đóng chỉnh vị trí" : "Cập nhật ghim kho bãi"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,300px)_1fr] md:items-start">
          {profile.recyclerType === "Individual" ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm leading-6 text-sky-950">
              <strong className="font-semibold">Người thu mua lưu động (Cá nhân):</strong> Hoạt động thu gom tận nơi bằng xe cá nhân, được miễn Giấy phép ĐKKD và kho bãi cố định theo Nghị định 39/2007/NĐ-CP. Đã xác thực CCCD 2 mặt nội bộ.
            </div>
          ) : (
            <FacilityPhotoCard
              facilityName={profile.facilityName}
              address={profile.businessAddress}
              photoUrl={editingProfile ? draftBusinessPhotoUrl || null : profile.businessPhotoUrl}
              photoUrls={
                editingProfile && draftBusinessPhotoUrl
                  ? [
                      draftBusinessPhotoUrl,
                      ...(profile.businessPhotoUrls ?? []).filter(
                        (u) => u !== draftBusinessPhotoUrl,
                      ),
                    ].slice(0, 5)
                  : profile.businessPhotoUrls
              }
              partnerKey={profile.recyclerId}
              variant="detail"
            />
          )}
          <div className="flex flex-col gap-1.5 text-sm leading-6 text-body">
            <p className="font-semibold text-ink">Giới thiệu &amp; quy trình tiếp nhận</p>
            <p>
              {profile.description ||
                "Chưa có mô tả chi tiết. Bạn có thể bấm Sửa mô tả & liên hệ để bổ sung ảnh thực tế mặt tiền / kho bãi và hướng dẫn giao hàng cho người dân."}
            </p>
          </div>
        </div>

        {editingProfile && (
          <form
            noValidate
            onSubmit={(e) => void handleSaveProfileDetails(e)}
            className="flex flex-col gap-3 border-t border-line-soft pt-4"
          >
            <h3 className="text-sm font-bold text-ink">Thông tin giới thiệu &amp; Liên hệ cơ sở</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                Tên cơ sở thu mua
                <input
                  className="input min-h-11 text-base sm:text-[15px]"
                  value={draftFacilityName}
                  onChange={(e) => setDraftFacilityName(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                Người đại diện
                <input
                  className="input min-h-11 text-base sm:text-[15px]"
                  value={draftRepresentativeName}
                  onChange={(e) => setDraftRepresentativeName(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                Số điện thoại liên hệ
                <input
                  className="input min-h-11 text-base tabular-nums sm:text-[15px]"
                  value={draftContactPhone}
                  onChange={(e) => setDraftContactPhone(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                Giờ mở cửa tóm tắt
                <input
                  className="input min-h-11 text-base sm:text-[15px]"
                  placeholder="Ví dụ: 07:30 - 18:30 (T2 - T7)"
                  value={draftOperatingHours}
                  onChange={(e) => setDraftOperatingHours(e.target.value)}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Mô tả năng lực thu mua / hướng dẫn gửi hàng
              <textarea
                className="input min-h-[88px] py-2.5 text-base sm:text-[15px]"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Giới thiệu dịch vụ thu gom tận nơi, cân điện tử tại chỗ..."
              />
            </label>
            <div className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              <span>Ảnh thực tế mặt tiền / kho bãi</span>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface-2 px-4 text-sm font-semibold text-ink transition-colors hover:border-sage-line hover:bg-surface-3">
                  <Camera className="size-4 text-brand" strokeWidth={1.7} aria-hidden="true" />
                  {uploadingPhoto
                    ? "Đang tải ảnh lên..."
                    : draftBusinessPhotoUrl
                      ? "Đổi ảnh mặt tiền / kho bãi"
                      : "Tải ảnh mặt tiền / kho bãi"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingPhoto}
                    onChange={(e) => {
                      const picked = e.target.files?.[0] ?? null
                      e.currentTarget.value = ""
                      void handleSelectFacilityPhoto(picked)
                    }}
                    className="sr-only"
                  />
                </label>
                {draftBusinessPhotoUrl && (
                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={() => setDraftBusinessPhotoUrl("")}
                    className="inline-flex min-h-10 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-muted transition-colors hover:text-warn"
                  >
                    Dùng ảnh mặc định
                  </button>
                )}
              </div>
              <p className="text-sm leading-6 font-normal text-muted">
                Chấp nhận JPG, PNG hoặc WebP tối đa 5 MB. Hiển thị ngay trong chi tiết cơ sở trên Bản đồ &amp; Đối tác.
              </p>
            </div>
            {profileErr && (
              <p
                role="alert"
                className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn"
              >
                {profileErr}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingProfile}
                className="btn-primary min-h-11 px-5 text-sm font-semibold"
              >
                {savingProfile ? "Đang lưu hồ sơ..." : "Lưu thông tin cơ sở"}
              </button>
            </div>
          </form>
        )}

        {editingSchedule && (
          <form
            noValidate
            onSubmit={(e) => void handleSaveWeeklySchedule(e)}
            className="flex flex-col gap-3 border-t border-line-soft pt-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ink">Lịch hoạt động cố định theo tuần (R-02)</h3>
              {!isKybVerified && (
                <span className="text-sm font-medium text-warn">
                  Yêu cầu hồ sơ Verified trước khi cập nhật lịch tuần.
                </span>
              )}
            </div>
            <div className="grid gap-2">
              {weeklySchedule.map((day) => (
                <div
                  key={day.dayOfWeek}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm"
                >
                  <span className="w-24 font-semibold text-ink">
                    {WEEKDAY_LABELS[day.dayOfWeek] ?? `Ngày ${day.dayOfWeek}`}
                  </span>
                  <label className="inline-flex min-h-10 items-center gap-2 text-body">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand"
                      checked={!day.isClosed}
                      onChange={(e) => {
                        const openDay = e.target.checked
                        setWeeklySchedule((prev) =>
                          prev.map((x) =>
                            x.dayOfWeek === day.dayOfWeek ? { ...x, isClosed: !openDay } : x,
                          ),
                        )
                        setScheduleErr("")
                      }}
                    />
                    <span>{day.isClosed ? "Nghỉ" : "Mở cửa"}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      disabled={day.isClosed}
                      value={day.openTime || "07:30"}
                      onChange={(e) => {
                        const v = e.target.value
                        setWeeklySchedule((prev) =>
                          prev.map((x) =>
                            x.dayOfWeek === day.dayOfWeek ? { ...x, openTime: v } : x,
                          ),
                        )
                        setScheduleErr("")
                      }}
                      className="input min-h-11 w-32 text-base tabular-nums sm:text-[15px] disabled:opacity-50"
                      aria-label={`Giờ mở cửa ${WEEKDAY_LABELS[day.dayOfWeek]}`}
                    />
                    <span className="text-muted">đến</span>
                    <input
                      type="time"
                      disabled={day.isClosed}
                      value={day.closeTime || "18:30"}
                      onChange={(e) => {
                        const v = e.target.value
                        setWeeklySchedule((prev) =>
                          prev.map((x) =>
                            x.dayOfWeek === day.dayOfWeek ? { ...x, closeTime: v } : x,
                          ),
                        )
                        setScheduleErr("")
                      }}
                      className="input min-h-11 w-32 text-base tabular-nums sm:text-[15px] disabled:opacity-50"
                      aria-label={`Giờ đóng cửa ${WEEKDAY_LABELS[day.dayOfWeek]}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            {scheduleErr && (
              <p
                role="alert"
                className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn"
              >
                {scheduleErr}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingSchedule || !isKybVerified}
                className="btn-primary min-h-11 px-5 text-sm font-semibold disabled:opacity-50"
              >
                {savingSchedule ? "Đang lưu lịch tuần..." : "Lưu lịch hoạt động tuần"}
              </button>
              <span className="text-sm leading-6 text-muted">
                Giờ mở/đóng cửa sẽ tự đồng bộ để kiểm tra hợp lệ khi người dân đặt lịch hẹn.
              </span>
            </div>
          </form>
        )}

        {editingLocation && (
          <form
            noValidate
            onSubmit={(e) => void handleSaveWarehousePin(e)}
            className="flex flex-col gap-3 border-t border-line-soft pt-4"
          >
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Địa chỉ hiển thị công khai
              <input
                className="input min-h-11 text-base sm:text-[15px]"
                value={draftAddress}
                onChange={(e) => {
                  setDraftAddress(e.target.value)
                  setPinErr("")
                }}
              />
            </label>
            <LocationPinPickerMap
              lat={draftLat}
              lng={draftLng}
              pinTitle={profile.facilityName}
              onChange={(nextLat, nextLng, hint) => {
                setDraftLat(nextLat)
                setDraftLng(nextLng)
                setPinErr("")
                if (hint) setDraftAddress(hint)
              }}
            />
            {pinErr && (
              <p
                role="alert"
                className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn"
              >
                {pinErr}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingPin}
                className="btn-primary min-h-11 px-5 text-sm font-semibold"
              >
                {savingPin ? "Đang lưu toạ độ..." : "Lưu vị trí kho bãi"}
              </button>
              <span className="text-sm leading-6 text-muted">
                Vị trí mới sẽ cập nhật ngay trên truy vấn bán kính của người dân.
              </span>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
