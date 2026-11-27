import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { X } from "lucide-react"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import { FormRequiredLegend, PageHead, RequiredMark } from "@/components/Portal"
import { ApiError, rotateRefreshTokenSingleFlight } from "@/lib/api"
import { LOCATION_PRESETS } from "@/lib/recyclerDiscoveryApi"
import {
  fetchMyRecyclerApplication,
  formatRecyclerApplicationCode,
  submitRecyclerOnboarding,
  type RecyclerApplicationDetailDto,
  type RecyclerPartnerType,
  type SubmitRecyclerOnboardingResult,
} from "@/lib/recyclerWorkflowApi"
import { hasLiveBackendAuth, updateSession, useSession } from "@/lib/session"

const MATERIALS = [
  "Nhựa",
  "Giấy và bìa carton",
  "Kim loại",
  "Thủy tinh",
  "Điện tử",
  "Rác hữu cơ",
]

const REQUIRED_FACILITY_PHOTOS = 5
const MAX_DOC_BYTES = 10 * 1024 * 1024

function isAcceptedImageFile(file: File): boolean {
  return (
    /^image\/(jpeg|jpg|png|webp)$/i.test(file.type) ||
    /\.(jpe?g|png|webp)$/i.test(file.name)
  )
}

function isAcceptedPermitFile(file: File): boolean {
  return (
    isAcceptedImageFile(file) ||
    file.type === "application/pdf" ||
    /\.pdf$/i.test(file.name)
  )
}

/** U-17 Đăng ký đối tác thu mua (Cơ sở cố định hoặc Cá nhân thu mua nhỏ lẻ theo Điều 3 NĐ 39/2007/NĐ-CP). */
export default function JoinRecycler() {
  const navigate = useNavigate()
  const session = useSession()
  const [recyclerType, setRecyclerType] = useState<RecyclerPartnerType>("Facility")
  const [permitFile, setPermitFile] = useState<File | null>(null)
  const [facilityPhotoFiles, setFacilityPhotoFiles] = useState<File[]>([])
  const [cccdFrontFile, setCccdFrontFile] = useState<File | null>(null)
  const [cccdBackFile, setCccdBackFile] = useState<File | null>(null)
  const [name, setName] = useState("")
  const [owner, setOwner] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [lat, setLat] = useState<number>(LOCATION_PRESETS[0].lat)
  const [lng, setLng] = useState<number>(LOCATION_PRESETS[0].lng)
  const [mats, setMats] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [doneResult, setDoneResult] = useState<SubmitRecyclerOnboardingResult | null>(null)
  const [existingApp, setExistingApp] = useState<RecyclerApplicationDetailDto | null>(null)
  const [err, setErr] = useState("")
  const hasTouchedPinRef = useRef(false)
  const hasTouchedTypeRef = useRef(false)

  const handleOpenRecyclerPortal = async () => {
    setOpeningPortal(true)
    try {
      if (hasLiveBackendAuth()) {
        await rotateRefreshTokenSingleFlight()
      }
      updateSession({ role: "recycler" })
      navigate("/recycler")
    } finally {
      setOpeningPortal(false)
    }
  }

  useEffect(() => {
    if (!session) return
    setOwner((prev) => (prev.trim() ? prev : session.name ?? ""))
    setPhone((prev) => (prev.trim() ? prev : session.phoneNumber ?? ""))
    setEmail((prev) => (prev.trim() ? prev : session.email ?? ""))
  }, [session])

  useEffect(() => {
    let active = true
    if (!hasLiveBackendAuth()) {
      setExistingApp(null)
      return
    }
    void fetchMyRecyclerApplication().then((app) => {
      if (!active) return
      setExistingApp(app)
      if (!app) return
      if (!hasTouchedTypeRef.current && app.recyclerType === "Individual") {
        setRecyclerType("Individual")
      }
      setName((prev) => (prev.trim() ? prev : app.facilityName))
      setOwner((prev) =>
        prev.trim() ? prev : (app.representativeName ?? app.applicantFullName ?? ""),
      )
      setPhone((prev) => (prev.trim() ? prev : app.contactPhone))
      setEmail((prev) => (prev.trim() ? prev : app.email))
      setAddress((prev) => (prev.trim() ? prev : app.businessAddress))
      if (!hasTouchedPinRef.current && app.latitude && app.longitude) {
        setLat(Number(app.latitude))
        setLng(Number(app.longitude))
      }
      const rawDesc = app.description?.replace(/^Thu mua:\s*/i, "").trim()
      if (rawDesc) {
        const matched = MATERIALS.filter((m) =>
          rawDesc.toLowerCase().includes(m.toLowerCase()),
        )
        if (matched.length > 0) {
          setMats((prev) => (prev.length > 0 ? prev : matched))
        }
      }
    })
    return () => {
      active = false
    }
  }, [session?.id, session?.fromBackend])

  const isIndividual = recyclerType === "Individual"
  const isAlreadyLockedStatus =
    existingApp?.verificationStatus === "Pending" ||
    existingApp?.verificationStatus === "Verified"

  const hasRequiredDocs = isIndividual
    ? Boolean(cccdFrontFile && cccdBackFile)
    : Boolean(permitFile && facilityPhotoFiles.length === REQUIRED_FACILITY_PHOTOS)

  const handleSelectFacilityPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const next = [...facilityPhotoFiles]
    for (const file of Array.from(files)) {
      if (!isAcceptedImageFile(file)) {
        setErr(`Tệp "${file.name}" không phải hình ảnh hợp lệ (chỉ hỗ trợ JPG, PNG, WEBP).`)
        return
      }
      if (file.size > MAX_DOC_BYTES) {
        setErr(`Ảnh "${file.name}" vượt quá dung lượng tối đa 10 MB.`)
        return
      }
      if (next.length >= REQUIRED_FACILITY_PHOTOS) {
        setErr(
          `Cơ sở cố định chỉ tải đúng ${REQUIRED_FACILITY_PHOTOS} ảnh kho bãi. Vui lòng xóa bớt ảnh cũ nếu muốn thay thế.`,
        )
        setFacilityPhotoFiles(next.slice(0, REQUIRED_FACILITY_PHOTOS))
        return
      }
      next.push(file)
    }
    setErr("")
    setFacilityPhotoFiles(next)
  }

  const handleSelectSingleImage = (
    file: File | null,
    label: string,
    setter: (f: File | null) => void,
  ) => {
    if (!file) {
      setter(null)
      return
    }
    if (!isAcceptedImageFile(file)) {
      setErr(`${label} chỉ hỗ trợ tệp hình ảnh JPG, PNG hoặc WEBP.`)
      return
    }
    if (file.size > MAX_DOC_BYTES) {
      setErr(`${label} vượt quá dung lượng tối đa 10 MB.`)
      return
    }
    setErr("")
    setter(file)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isAlreadyLockedStatus) {
      setErr(
        existingApp?.verificationStatus === "Verified"
          ? "Hồ sơ cơ sở của bạn đã được phê duyệt trước đó."
          : "Hồ sơ cơ sở của bạn đang trong hàng đợi thẩm định. Vui lòng chờ kết quả từ nhân viên.",
      )
      return
    }
    if (name.trim().length < 3) {
      setErr(
        isIndividual
          ? "Cần tên hiển thị người thu mua tối thiểu 3 ký tự."
          : "Cần tên cơ sở tối thiểu 3 ký tự để thẩm định hồ sơ.",
      )
      return
    }
    if (name.trim().length > 150) {
      setErr("Tên hiển thị / cơ sở không được vượt quá 150 ký tự.")
      return
    }
    if (owner.trim().length < 2 || owner.trim().length > 100) {
      setErr(
        isIndividual
          ? "Họ và tên theo CCCD phải từ 2 đến 100 ký tự."
          : "Tên người đại diện phải từ 2 đến 100 ký tự.",
      )
      return
    }
    if (!/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, ""))) {
      setErr("Số điện thoại chưa đúng định dạng Việt Nam.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setErr("Email nhận kết quả thẩm định chưa đúng định dạng.")
      return
    }
    if (!address.trim()) {
      setErr(
        isIndividual
          ? "Cần nhập khu vực hoạt động chính / điểm xuất phát."
          : "Cần địa chỉ kho bãi thu gom thực tế.",
      )
      return
    }
    if (address.trim().length > 255) {
      setErr("Địa chỉ không được vượt quá 255 ký tự.")
      return
    }
    if (lat === 0 && lng === 0) {
      setErr("Vui lòng chấm vị trí hoạt động trên bản đồ.")
      return
    }
    if (mats.length === 0) {
      setErr("Chọn ít nhất một loại rác bạn thu mua.")
      return
    }

    if (isIndividual) {
      if (!cccdFrontFile || !cccdBackFile) {
        setErr("Người thu mua nhỏ lẻ bắt buộc tải đủ 2 ảnh CCCD (Mặt trước và Mặt sau).")
        return
      }
    } else {
      if (!permitFile) {
        setErr("Vui lòng tải lên Giấy phép kinh doanh hoặc chứng từ pháp lý.")
        return
      }
      if (!isAcceptedPermitFile(permitFile)) {
        setErr("Giấy phép kinh doanh chỉ hỗ trợ tệp PDF, JPG, PNG hoặc WEBP.")
        return
      }
      if (permitFile.size > MAX_DOC_BYTES) {
        setErr("Tệp Giấy phép kinh doanh vượt quá dung lượng tối đa 10 MB.")
        return
      }
      if (facilityPhotoFiles.length !== REQUIRED_FACILITY_PHOTOS) {
        setErr(
          `Cơ sở thu mua cố định bắt buộc đính kèm đúng đủ ${REQUIRED_FACILITY_PHOTOS}/5 ảnh thực tế mặt tiền / kho bãi (hiện có ${facilityPhotoFiles.length}/${REQUIRED_FACILITY_PHOTOS} ảnh).`,
        )
        return
      }
    }

    setErr("")
    setSubmitting(true)
    try {
      const result = await submitRecyclerOnboarding({
        recyclerType,
        facilityName: name,
        representativeName: owner,
        phone,
        email,
        businessAddress: address,
        latitude: lat,
        longitude: lng,
        materials: mats,
        permitFile: isIndividual ? null : permitFile,
        facilityPhotoFiles: isIndividual ? [] : facilityPhotoFiles,
        cccdFrontFile: isIndividual ? cccdFrontFile : null,
        cccdBackFile: isIndividual ? cccdBackFile : null,
      })
      setDoneResult(result)
    } catch (submitErr) {
      if (
        submitErr instanceof ApiError &&
        submitErr.messageCode === "MSG-AUTH-01" &&
        !session
      ) {
        setErr(
          `${submitErr.message} Nếu đây là email tài khoản EcoLink của bạn, vui lòng Đăng nhập trước để gửi hồ sơ nâng cấp tài khoản hiện có.`,
        )
        return
      }
      setErr(
        submitErr instanceof Error
          ? submitErr.message
          : "Không thể gửi hồ sơ lúc này. Vui lòng thử lại.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (doneResult) {
    return (
      <Done
        id={doneResult.referenceCode}
        name={name}
        lat={lat}
        lng={lng}
        recyclerType={recyclerType}
        syncedWithBackend={doneResult.syncedWithBackend}
      />
    )
  }

  const existingCode = existingApp
    ? formatRecyclerApplicationCode(existingApp.userId, existingApp.submittedAt)
    : ""
  const existingDateVi =
    existingApp?.submittedAt && !Number.isNaN(Date.parse(existingApp.submittedAt))
      ? new Date(existingApp.submittedAt).toLocaleDateString("vi-VN")
      : ""

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="ĐỐI TÁC THU MUA"
        title="Đăng ký cơ sở thu mua"
        body="Hỗ trợ cả Cơ sở / Vựa thu mua cố định (kèm Giấy phép & 5 ảnh kho bãi) và Cá nhân thu mua nhỏ lẻ lưu động (miễn giấy phép theo Điều 3 Nghị định 39/2007/NĐ-CP, xác thực bằng CCCD 2 mặt)."
      />

      {session && hasLiveBackendAuth() && (
        <div className="rounded-xl border border-brand/25 bg-brand/6 px-4 py-3 text-[13px] text-brand-deep">
          Đang nộp hồ sơ nâng cấp cho tài khoản{" "}
          <strong>
            {session.name}
            {session.email ? ` (${session.email})` : ""}
          </strong>{" "}
          — tài khoản người dân hiện tại vẫn hoạt động bình thường trong thời gian chờ duyệt.
        </div>
      )}

      {existingApp && existingApp.verificationStatus === "Pending" && (
        <div className="card flex flex-wrap items-center justify-between gap-4 border-brand/30 bg-surface-2 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand/12 px-3 py-1 text-xs font-semibold text-brand-deep">
                Đã ghi nhận trên hệ thống (Trạng thái: Chờ thẩm định)
              </span>
              <span className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[11px] font-semibold text-body">
                {existingApp.recyclerType === "Individual" ? "Thu mua nhỏ lẻ" : "Cơ sở cố định"}
              </span>
              <span className="text-xs font-bold tabular-nums text-ink">{existingCode}</span>
              {existingDateVi && (
                <span className="text-xs text-muted">· Nộp ngày {existingDateVi}</span>
              )}
            </div>
            <p className="mt-2 font-bold text-ink">{existingApp.facilityName}</p>
            <p className="mt-0.5 text-[13px] text-muted">
              {existingApp.businessAddress} · GPS ({Number(existingApp.latitude).toFixed(4)},{" "}
              {Number(existingApp.longitude).toFixed(4)})
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setName(existingApp.facilityName)
              setLat(Number(existingApp.latitude))
              setLng(Number(existingApp.longitude))
              setDoneResult({
                referenceCode: existingCode,
                syncedWithBackend: true,
                userId: existingApp.userId,
              })
            }}
            className="btn-outline h-10 px-4 text-xs"
          >
            Xem biên nhận hồ sơ
          </button>
        </div>
      )}

      {existingApp && existingApp.verificationStatus === "Rejected" && (
        <div className="card flex flex-col gap-1.5 border-warn/40 bg-surface-2 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-warn/15 px-3 py-1 text-xs font-semibold text-warn">
              Hồ sơ cần bổ sung ({existingCode})
            </span>
          </div>
          <p className="text-sm font-semibold text-ink">
            Lý do từ chối từ nhân viên thẩm định:{" "}
            <span className="text-warn">
              {existingApp.rejectionReason || "Thông tin hoặc chứng từ chưa đạt yêu cầu."}
            </span>
          </p>
          <p className="text-[13px] text-muted">
            Vui lòng cập nhật lại thông tin, tải chứng từ mới rõ nét ở biểu mẫu bên dưới và bấm
            &quot;Gửi lại hồ sơ thẩm định&quot;.
          </p>
        </div>
      )}

      {existingApp && existingApp.verificationStatus === "Verified" && (
        <div className="card flex flex-wrap items-center justify-between gap-4 border-brand/30 bg-brand/6 px-5 py-4">
          <div>
            <p className="font-bold text-brand-deep">
              Hồ sơ {existingApp.facilityName} ({existingCode}) đã được phê duyệt!
            </p>
            <p className="mt-0.5 text-[13px] text-body">
              Tài khoản của bạn đã đủ điều kiện hoạt động và hiển thị ghim thu mua trên bản đồ EcoLink.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={openingPortal}
              onClick={() => void handleOpenRecyclerPortal()}
              className="btn-primary h-9 px-4 text-xs"
            >
              {openingPortal ? "Đang đồng bộ quyền..." : "Mở cổng Cơ sở thu mua"}
            </button>
            <Link to="/map" className="btn-outline h-9 px-4 text-xs">
              Xem trên Bản đồ
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={(e) => void submit(e)} noValidate className="card flex flex-col gap-6 p-5 md:p-6">
        <FormRequiredLegend />

        {/* Chọn loại hình thu mua */}
        <fieldset className="flex flex-col gap-2.5">
          <legend className="text-[13px] font-semibold text-ink">
            Loại hình đăng ký thu mua
            <RequiredMark />
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                id: "Facility" as const,
                title: "Cơ sở / Vựa thu mua cố định",
                badge: "Đủ 5/5 ảnh kho bãi + GPKD",
                desc: "Dành cho vựa phế liệu, điểm tập kết có mặt bằng cố định. Bắt buộc đính kèm Giấy phép kinh doanh và đúng 5 ảnh kho bãi.",
              },
              {
                id: "Individual" as const,
                title: "Cá nhân thu mua nhỏ lẻ (Lưu động)",
                badge: "Miễn ĐKKD · Cần CCCD 2 mặt",
                desc: "Theo Điều 3 Nghị định 39/2007/NĐ-CP: không có địa điểm cố định được miễn GPKD, chỉ cần ảnh CCCD 2 mặt để xác thực.",
              },
            ].map((opt) => {
              const active = recyclerType === opt.id
              return (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer flex-col gap-1.5 rounded-2xl border p-4 transition-colors ${
                    active
                      ? "border-brand bg-brand/6 shadow-2xs"
                      : "border-line bg-surface hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="recyclerType"
                        value={opt.id}
                        checked={active}
                        onChange={() => {
                          hasTouchedTypeRef.current = true
                          setRecyclerType(opt.id)
                          setErr("")
                        }}
                        className="accent-brand size-4"
                      />
                      <span className="text-sm font-bold text-ink">{opt.title}</span>
                    </div>
                  </div>
                  <span
                    className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      active ? "bg-white text-brand-deep" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {opt.badge}
                  </span>
                  <p className="text-xs leading-5 text-muted">{opt.desc}</p>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            <span>
              {isIndividual ? "Tên hiển thị thu mua" : "Tên cơ sở"}
              <RequiredMark />
            </span>
            <input
              className={`input ${err.startsWith("Cần tên") ? "border-warn" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isIndividual ? "Anh Tuấn - Thu gom lưu động Hòa Lạc" : "Vựa Minh Khai"}
            />
          </label>
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            <span>
              {isIndividual ? "Họ và tên theo CCCD" : "Người đại diện"}
              <RequiredMark />
            </span>
            <input
              className="input"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Nguyễn Văn A"
            />
          </label>
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            <span>
              Số điện thoại
              <RequiredMark />
            </span>
            <input
              className={`input tabular-nums ${
                err.startsWith("Số điện thoại") ? "border-warn" : ""
              }`}
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0901 234 567"
            />
          </label>
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            <span>
              Email nhận kết quả thẩm định
              <RequiredMark />
            </span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten@recycler.vn"
            />
          </label>
        </div>

        <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
          <span>
            {isIndividual
              ? "Khu vực hoạt động chính / Điểm xuất phát"
              : "Địa chỉ kho bãi thu gom thực tế"}
            <RequiredMark />
          </span>
          <input
            className={`input ${err.startsWith("Cần địa chỉ") || err.startsWith("Cần nhập khu vực") ? "border-warn" : ""}`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={
              isIndividual
                ? "Khu vực Tân Xã - Khu CNC Hòa Lạc, Thạch Thất, Hà Nội"
                : "512 Hai Bà Trưng, Quận 5"
            }
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink">
            {isIndividual
              ? "Ghim khu vực hoạt động thường xuyên trên bản đồ"
              : "Ghim vị trí kho bãi trên bản đồ"}
            <RequiredMark />
          </span>
          <span className="text-[12px] text-muted">
            {isIndividual
              ? "Hệ thống sử dụng tọa độ này để người dân trong bán kính gần bạn tìm thấy và đặt lịch thu gom tận nơi."
              : "Nhân viên thẩm định sẽ đối chiếu ghim này với địa chỉ trên giấy phép kinh doanh. Sau khi duyệt, đây là toạ độ hiển thị cho người dân trên trang Bản đồ."}
          </span>
          <LocationPinPickerMap
            lat={lat}
            lng={lng}
            pinTitle={
              name.trim() || (isIndividual ? "Khu vực thu mua lưu động" : "Kho bãi thu mua")
            }
            helperText={
              isIndividual
                ? "Tâm khu vực hoạt động thu mua lưu động (SRID 4326)"
                : "Toạ độ chính xác của kho bãi (SRID 4326)"
            }
            onChange={(nextLat, nextLng, addressHint) => {
              hasTouchedPinRef.current = true
              setLat(nextLat)
              setLng(nextLng)
              if (addressHint && !address.trim()) {
                setAddress(addressHint)
              }
            }}
          />
        </div>

        <fieldset>
          <legend className="text-[13px] font-semibold text-ink">
            Loại rác bạn thu mua
            <RequiredMark />
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MATERIALS.map((m) => {
              const on = mats.includes(m)
              return (
                <label
                  key={m}
                  className={`cursor-pointer rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                    on
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface text-body hover:bg-surface-2"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() =>
                      setMats((ms) => (on ? ms.filter((x) => x !== m) : [...ms, m]))
                    }
                  />
                  {m}
                </label>
              )
            })}
          </div>
        </fieldset>

        {isIndividual ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-xs leading-5 text-sky-950">
              <strong>Miễn giấy phép kinh doanh theo Điều 3 Nghị định 39/2007/NĐ-CP:</strong>{" "}
              Người thu mua phế liệu nhỏ lẻ, lưu động không có địa điểm cố định được miễn đăng ký kinh doanh. Ảnh CCCD chỉ phục vụ Nhân viên EcoLink thẩm định danh tính nội bộ,{" "}
              <strong>tuyệt đối không hiển thị công khai</strong> cho người dùng khác.
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink">
                  1. Ảnh mặt trước Căn cước công dân (CCCD) <span className="text-warn">*</span>
                </span>
                <span className="text-[12px] text-muted">
                  Chụp rõ ảnh chân dung, số CCCD và họ tên (JPG, PNG, WEBP, tối đa 10 MB).
                </span>
                <label className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-sage-line bg-surface-2 px-4 py-5 text-center transition-colors hover:bg-surface-3">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) =>
                      handleSelectSingleImage(
                        e.target.files?.[0] ?? null,
                        "Ảnh mặt trước CCCD",
                        setCccdFrontFile,
                      )
                    }
                  />
                  <span className="break-all text-sm font-semibold text-brand">
                    {cccdFrontFile ? cccdFrontFile.name : "Chọn ảnh mặt trước CCCD (.jpg, .png)"}
                  </span>
                  <span className="text-[11px] text-muted">
                    {cccdFrontFile
                      ? `${(cccdFrontFile.size / 1024).toFixed(0)} KB · Bấm để đổi ảnh`
                      : "Bắt buộc 1 ảnh rõ nét, không chói sáng"}
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink">
                  2. Ảnh mặt sau Căn cước công dân (CCCD) <span className="text-warn">*</span>
                </span>
                <span className="text-[12px] text-muted">
                  Chụp rõ đặc điểm nhận dạng, ngày cấp và mã QR mặt sau (JPG, PNG, WEBP).
                </span>
                <label className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-sage-line bg-surface-2 px-4 py-5 text-center transition-colors hover:bg-surface-3">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) =>
                      handleSelectSingleImage(
                        e.target.files?.[0] ?? null,
                        "Ảnh mặt sau CCCD",
                        setCccdBackFile,
                      )
                    }
                  />
                  <span className="break-all text-sm font-semibold text-brand">
                    {cccdBackFile ? cccdBackFile.name : "Chọn ảnh mặt sau CCCD (.jpg, .png)"}
                  </span>
                  <span className="text-[11px] text-muted">
                    {cccdBackFile
                      ? `${(cccdBackFile.size / 1024).toFixed(0)} KB · Bấm để đổi ảnh`
                      : "Bắt buộc 1 ảnh rõ nét, không mất góc"}
                  </span>
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink">
                1. Giấy phép kinh doanh / Chứng từ pháp lý <span className="text-warn">*</span>
              </span>
              <span className="text-[12px] text-muted">
                Giấy đăng ký doanh nghiệp / hộ kinh doanh hoặc giấy phép thu gom chất thải (Ảnh hoặc PDF).
              </span>
              <label
                className={`mt-1 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
                  err.includes("Giấy phép")
                    ? "border-warn bg-surface-2"
                    : "border-sage-line bg-surface-2 hover:bg-surface-3"
                }`}
              >
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const picked = e.target.files?.[0] ?? null
                    if (picked && !isAcceptedPermitFile(picked)) {
                      setErr("Giấy phép kinh doanh chỉ hỗ trợ tệp PDF, JPG, PNG hoặc WEBP.")
                      return
                    }
                    if (picked && picked.size > MAX_DOC_BYTES) {
                      setErr("Tệp Giấy phép kinh doanh vượt quá dung lượng tối đa 10 MB.")
                      return
                    }
                    setErr("")
                    setPermitFile(picked)
                  }}
                />
                <span className="break-all text-sm font-semibold text-brand">
                  {permitFile ? permitFile.name : "Chọn tệp giấy phép (.pdf, .jpg, .png)"}
                </span>
                <span className="text-[11px] text-muted">
                  {permitFile
                    ? `${(permitFile.size / 1024).toFixed(0)} KB · Bấm để đổi tệp`
                    : "Hỗ trợ PDF, JPG, PNG, WEBP"}
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">
                  2. Ảnh thực tế mặt tiền / kho bãi <span className="text-warn">*</span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    facilityPhotoFiles.length === REQUIRED_FACILITY_PHOTOS
                      ? "bg-brand/12 text-brand-deep"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  Đã chọn {facilityPhotoFiles.length}/{REQUIRED_FACILITY_PHOTOS} ảnh
                </span>
              </div>
              <span className="text-[12px] text-muted">
                Bắt buộc đủ <strong>5/5 ảnh</strong> (mặt tiền biển hiệu, khu vực cân đo, khu lưu trữ phân loại, lối xe vào).
              </span>
              <label
                className={`mt-1 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
                  err.includes("kho bãi")
                    ? "border-warn bg-surface-2"
                    : "border-sage-line bg-surface-2 hover:bg-surface-3"
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    handleSelectFacilityPhotos(e.target.files)
                    e.currentTarget.value = ""
                  }}
                />
                <span className="text-sm font-semibold text-brand">
                  {facilityPhotoFiles.length === REQUIRED_FACILITY_PHOTOS
                    ? "Đã đủ 5/5 ảnh kho bãi"
                    : `Chọn ảnh kho bãi (còn thiếu ${REQUIRED_FACILITY_PHOTOS - facilityPhotoFiles.length} ảnh)`}
                </span>
                <span className="text-[11px] text-muted">
                  Có thể chọn một lúc nhiều ảnh hoặc bấm thêm từng ảnh (.jpg, .png, .webp)
                </span>
              </label>

              {facilityPhotoFiles.length > 0 && (
                <ul className="mt-1 flex flex-col gap-1.5">
                  {facilityPhotoFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs"
                    >
                      <span className="min-w-0 truncate text-ink">
                        <strong className="text-brand-deep">Ảnh {index + 1}:</strong> {file.name}{" "}
                        <span className="text-muted">({(file.size / 1024).toFixed(0)} KB)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setFacilityPhotoFiles((prev) => prev.filter((_, idx) => idx !== index))
                        }
                        aria-label={`Xóa ảnh kho bãi ${index + 1}`}
                        className="grid size-6 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-warn"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {err && (
          <p
            role="alert"
            className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn"
          >
            {err}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button
            type="submit"
            disabled={submitting || isAlreadyLockedStatus || !hasRequiredDocs}
            className="btn-primary h-11 px-6 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {submitting
              ? "Đang gửi hồ sơ..."
              : existingApp?.verificationStatus === "Rejected"
                ? "Gửi lại hồ sơ thẩm định"
                : existingApp?.verificationStatus === "Pending"
                  ? "Hồ sơ đang chờ thẩm định"
                  : existingApp?.verificationStatus === "Verified"
                    ? "Hồ sơ đã được phê duyệt"
                    : "Gửi hồ sơ thẩm định"}
          </button>
          <p className="text-[13px] text-muted">
            {!hasRequiredDocs && !isAlreadyLockedStatus
              ? isIndividual
                ? "Cần tải đủ 2 ảnh CCCD (mặt trước & mặt sau) để bật nút gửi hồ sơ."
                : `Cần tải Giấy phép kinh doanh và đủ 5/5 ảnh kho bãi (hiện có ${facilityPhotoFiles.length}/5 ảnh) để gửi hồ sơ.`
              : "Chờ duyệt thì bạn vẫn dùng được tài khoản người dân như thường."}
          </p>
        </div>
      </form>
    </div>
  )
}

function Done({
  id,
  name,
  lat,
  lng,
  recyclerType,
  syncedWithBackend,
}: {
  id: string
  name: string
  lat: number
  lng: number
  recyclerType: RecyclerPartnerType
  syncedWithBackend: boolean
}) {
  const isIndividual = recyclerType === "Individual"
  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="ĐỐI TÁC THU MUA"
        title="Đã nhận hồ sơ"
        body={`${name} (${isIndividual ? "Thu mua nhỏ lẻ / lưu động" : "Cơ sở cố định"}) đã gửi hồ sơ kèm tọa độ (${lat.toFixed(4)}, ${lng.toFixed(4)}). Nhân viên EcoLink sẽ thẩm định chứng từ trước khi kích hoạt ghim trên bản đồ.`}
      />

      <div className="card flex flex-wrap items-center gap-4 px-5 py-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
            Mã hồ sơ
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-ink">
            {id}
          </p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1 text-right">
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-deep">
            {syncedWithBackend
              ? "Đã ghi nhận trên hệ thống (Trạng thái: Chờ thẩm định)"
              : "Đã lưu hàng đợi thẩm định trình duyệt"}
          </span>
          <p className="text-xs text-muted">
            Mang mã này khi gọi 1900 8828 hoặc kiểm tra tại khu vực Nhân viên thẩm định.
          </p>
        </div>
      </div>

      <ol className="card flex flex-col gap-4 p-5">
        {[
          [
            "Nhận hồ sơ",
            isIndividual
              ? "Hệ thống lưu ảnh CCCD bảo mật nội bộ và khu vực hoạt động ở trạng thái Pending (BR-MTH-01)."
              : "Hệ thống lưu giấy phép, bộ 5 ảnh kho bãi và toạ độ ở trạng thái Pending (BR-MTH-01).",
          ],
          [
            "Thẩm định hồ sơ",
            isIndividual
              ? "Nhân viên đối chiếu ảnh CCCD 2 mặt với thông tin người đăng ký thu mua lưu động (S-04)."
              : "Nhân viên kiểm tra giấy phép, 5 ảnh thực tế và đối chiếu vị trí ghim kho bãi trên bản đồ (S-04).",
          ],
          [
            "Duyệt và lên bản đồ",
            "Ngay khi được duyệt, tài khoản hiển thị trên trang Bản đồ GPS để người dân đặt lịch bàn giao.",
          ],
        ].map(([t, b], i) => (
          <li key={t} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{t}</p>
              <p className="mt-0.5 text-[13px] leading-5 text-muted">{b}</p>
            </div>
          </li>
        ))}
      </ol>

      <div>
        <Link to="/map" className="btn-outline h-10 px-4 text-xs">
          Quay về trang Bản đồ điểm thu mua
        </Link>
      </div>
    </div>
  )
}
