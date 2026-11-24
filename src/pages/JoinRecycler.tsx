import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import { FormRequiredLegend, PageHead, RequiredMark } from "@/components/Portal"
import { ApiError, rotateRefreshTokenSingleFlight } from "@/lib/api"
import { LOCATION_PRESETS } from "@/lib/recyclerDiscoveryApi"
import {
  fetchMyRecyclerApplication,
  formatRecyclerApplicationCode,
  submitRecyclerOnboarding,
  type RecyclerApplicationDetailDto,
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

/** U-17 Đăng ký cơ sở thu mua (kèm chấm ghim toạ độ kho bãi PostGIS & tải chứng từ lên R2).
 *
 *  Tách khỏi `/register` vì đây là quy trình thẩm định KYB: có giấy phép pháp lý,
 *  ảnh mặt tiền kho bãi và toạ độ thu gom cố định trên bản đồ (`BR-MTH-01`).
 *  Chỉ sau khi Nhân viên EcoLink (`S-04`) phê duyệt, ghim kho bãi mới hiển thị trên `/map`. */
export default function JoinRecycler() {
  const navigate = useNavigate()
  const session = useSession()
  const [permitFile, setPermitFile] = useState<File | null>(null)
  const [facilityPhotoFile, setFacilityPhotoFile] = useState<File | null>(null)
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

  const isAlreadyLockedStatus =
    existingApp?.verificationStatus === "Pending" ||
    existingApp?.verificationStatus === "Verified"

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
      setErr("Cần tên cơ sở tối thiểu 3 ký tự để thẩm định hồ sơ.")
      return
    }
    if (name.trim().length > 150) {
      setErr("Tên cơ sở không được vượt quá 150 ký tự.")
      return
    }
    if (owner.trim().length < 2 || owner.trim().length > 100) {
      setErr("Tên người đại diện phải từ 2 đến 100 ký tự.")
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
      setErr("Cần địa chỉ nơi thu gom thực tế.")
      return
    }
    if (address.trim().length > 255) {
      setErr("Địa chỉ kho bãi không được vượt quá 255 ký tự.")
      return
    }
    if (lat === 0 && lng === 0) {
      setErr("Vui lòng chấm vị trí kho bãi trên bản đồ.")
      return
    }
    if (mats.length === 0) {
      setErr("Chọn ít nhất một loại rác bạn thu mua.")
      return
    }
    if (!permitFile) {
      setErr("Vui lòng tải lên Giấy phép kinh doanh hoặc chứng từ pháp lý.")
      return
    }
    const permitOk =
      /^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/i.test(permitFile.type) ||
      /\.(pdf|jpe?g|png|webp)$/i.test(permitFile.name)
    if (!permitOk) {
      setErr("Giấy phép kinh doanh chỉ hỗ trợ tệp PDF, JPG, PNG hoặc WEBP.")
      return
    }
    if (permitFile.size > 10 * 1024 * 1024) {
      setErr("Tệp Giấy phép kinh doanh vượt quá dung lượng tối đa 10 MB.")
      return
    }
    if (!facilityPhotoFile) {
      setErr("Vui lòng tải lên Ảnh chụp mặt tiền / kho bãi thu gom.")
      return
    }
    const photoOk =
      /^image\/(jpeg|jpg|png|webp)$/i.test(facilityPhotoFile.type) ||
      /\.(jpe?g|png|webp)$/i.test(facilityPhotoFile.name)
    if (!photoOk) {
      setErr("Ảnh chụp mặt tiền / kho bãi chỉ hỗ trợ định dạng JPG, PNG hoặc WEBP.")
      return
    }
    if (facilityPhotoFile.size > 10 * 1024 * 1024) {
      setErr("Ảnh chụp mặt tiền / kho bãi vượt quá dung lượng tối đa 10 MB.")
      return
    }

    setErr("")
    setSubmitting(true)
    try {
      const result = await submitRecyclerOnboarding({
        facilityName: name,
        representativeName: owner,
        phone,
        email,
        businessAddress: address,
        latitude: lat,
        longitude: lng,
        materials: mats,
        documents: [permitFile, facilityPhotoFile],
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
        body="Điền hồ sơ, chấm vị trí kho bãi trên bản đồ và tải giấy tờ pháp lý lên. Hồ sơ được thẩm định trước khi điểm thu mua của bạn xuất hiện trên bản đồ GPS."
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
            Vui lòng cập nhật lại thông tin kho bãi, tải chứng từ mới rõ nét ở biểu mẫu bên dưới và
            bấm &quot;Gửi lại hồ sơ thẩm định&quot;.
          </p>
        </div>
      )}

      {existingApp && existingApp.verificationStatus === "Verified" && (
        <div className="card flex flex-wrap items-center justify-between gap-4 border-brand/30 bg-brand/6 px-5 py-4">
          <div>
            <p className="font-bold text-brand-deep">
              Cơ sở {existingApp.facilityName} ({existingCode}) đã được phê duyệt!
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
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            <span>
              Tên cơ sở
              <RequiredMark />
            </span>
            <input
              className={`input ${err.startsWith("Cần tên") ? "border-warn" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vựa Minh Khai"
            />
          </label>
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            <span>
              Người đại diện
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
            Địa chỉ kho bãi thu gom thực tế
            <RequiredMark />
          </span>
          <input
            className={`input ${err.startsWith("Cần địa chỉ") ? "border-warn" : ""}`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="512 Hai Bà Trưng, Quận 5"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink">
            Ghim vị trí kho bãi trên bản đồ
            <RequiredMark />
          </span>
          <span className="text-[12px] text-muted">
            Nhân viên thẩm định sẽ đối chiếu ghim này với địa chỉ trên giấy phép kinh doanh.
            Sau khi duyệt, đây là toạ độ hiển thị cho người dân trên trang Bản đồ.
          </span>
          <LocationPinPickerMap
            lat={lat}
            lng={lng}
            pinTitle={name.trim() || "Kho bãi thu mua"}
            helperText="Toạ độ chính xác của kho bãi (SRID 4326)"
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
                onChange={(e) => setPermitFile(e.target.files?.[0] ?? null)}
              />
              <span className="text-sm font-semibold text-brand break-all">
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
            <span className="text-[13px] font-semibold text-ink">
              2. Ảnh thực tế mặt tiền / kho bãi <span className="text-warn">*</span>
            </span>
            <span className="text-[12px] text-muted">
              Ảnh chụp rõ biển hiệu, khu vực cân đo hoặc mặt bằng thu gom thực tế tại địa chỉ đăng ký.
            </span>
            <label
              className={`mt-1 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
                err.includes("Ảnh chụp")
                  ? "border-warn bg-surface-2"
                  : "border-sage-line bg-surface-2 hover:bg-surface-3"
              }`}
            >
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => setFacilityPhotoFile(e.target.files?.[0] ?? null)}
              />
              <span className="text-sm font-semibold text-brand break-all">
                {facilityPhotoFile ? facilityPhotoFile.name : "Chọn ảnh kho bãi (.jpg, .png)"}
              </span>
              <span className="text-[11px] text-muted">
                {facilityPhotoFile
                  ? `${(facilityPhotoFile.size / 1024).toFixed(0)} KB · Bấm để đổi ảnh`
                  : "Chỉ chấp nhận tệp hình ảnh rõ nét"}
              </span>
            </label>
          </div>
        </div>

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
            disabled={submitting || isAlreadyLockedStatus}
            className="btn-primary h-11 px-6 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {submitting
              ? "Đang gửi hồ sơ..."
              : existingApp?.verificationStatus === "Rejected"
                ? "Gửi lại hồ sơ thẩm định"
                : existingApp?.verificationStatus === "Pending"
                  ? "Hồ sơ đang chờ thẩm định"
                  : existingApp?.verificationStatus === "Verified"
                    ? "Cơ sở đã được phê duyệt"
                    : "Gửi hồ sơ thẩm định"}
          </button>
          <p className="text-[13px] text-muted">
            Chờ duyệt thì bạn vẫn dùng được tài khoản người dân như thường.
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
  syncedWithBackend,
}: {
  id: string
  name: string
  lat: number
  lng: number
  syncedWithBackend: boolean
}) {
  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="ĐỐI TÁC THU MUA"
        title="Đã nhận hồ sơ"
        body={`${name} đã gửi hồ sơ kèm toạ độ kho bãi (${lat.toFixed(4)}, ${lng.toFixed(4)}). Nhân viên EcoLink sẽ thẩm định giấy phép và đối chiếu vị trí trước khi kích hoạt ghim trên bản đồ.`}
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
          ["Nhận hồ sơ", "Hệ thống lưu chứng từ và toạ độ kho bãi ở trạng thái Pending (chưa hiển thị công khai — BR-MTH-01)."],
          ["Thẩm định thực địa", "Nhân viên kiểm tra giấy phép và đối chiếu vị trí ghim kho bãi trên bản đồ thẩm định (S-04)."],
          ["Duyệt và lên bản đồ", "Ngay khi được duyệt, cơ sở hiển thị trên trang Bản đồ GPS để người dân đặt lịch bàn giao."],
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
