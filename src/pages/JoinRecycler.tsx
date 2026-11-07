import { useState } from "react"
import { Link } from "react-router-dom"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import { PageHead } from "@/components/Portal"
import { LOCATION_PRESETS } from "@/lib/recyclerDiscoveryApi"
import {
  submitRecyclerOnboarding,
  type SubmitRecyclerOnboardingResult,
} from "@/lib/recyclerWorkflowApi"

/** U-17 Đăng ký cơ sở thu mua (kèm chấm ghim toạ độ kho bãi PostGIS & tải chứng từ lên R2).
 *
 *  Tách khỏi `/register` vì đây là quy trình thẩm định KYB: có giấy phép pháp lý,
 *  ảnh mặt tiền kho bãi và toạ độ thu gom cố định trên bản đồ (`BR-MTH-01`).
 *  Chỉ sau khi Nhân viên EcoLink (`S-04`) phê duyệt, ghim kho bãi mới hiển thị trên `/map`. */
export default function JoinRecycler() {
  const [docs, setDocs] = useState<File[]>([])
  const [name, setName] = useState("")
  const [owner, setOwner] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [lat, setLat] = useState<number>(LOCATION_PRESETS[0].lat)
  const [lng, setLng] = useState<number>(LOCATION_PRESETS[0].lng)
  const [mats, setMats] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [doneResult, setDoneResult] = useState<SubmitRecyclerOnboardingResult | null>(null)
  const [err, setErr] = useState("")

  const MATERIALS = [
    "Nhựa",
    "Giấy và bìa carton",
    "Kim loại",
    "Thủy tinh",
    "Điện tử",
    "Rác hữu cơ",
  ]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 3) {
      setErr("Cần tên cơ sở để thẩm định hồ sơ.")
      return
    }
    if (!/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, ""))) {
      setErr("Số điện thoại chưa đúng định dạng Việt Nam.")
      return
    }
    if (!address.trim()) {
      setErr("Cần địa chỉ nơi thu gom thực tế.")
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
    if (docs.length === 0) {
      setErr("Tải ít nhất một giấy tờ để hồ sơ được thẩm định.")
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
        documents: docs,
      })
      setDoneResult(result)
    } catch (submitErr) {
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

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="ĐỐI TÁC THU MUA"
        title="Đăng ký cơ sở thu mua"
        body="Điền hồ sơ, chấm vị trí kho bãi trên bản đồ và tải giấy tờ pháp lý lên. Hồ sơ được thẩm định trước khi điểm thu mua của bạn xuất hiện trên bản đồ GPS."
      />

      <form onSubmit={(e) => void submit(e)} noValidate className="card flex flex-col gap-6 p-5 md:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Tên cơ sở
            <input
              className={`input ${err.startsWith("Cần tên") ? "border-warn" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vựa Minh Khai"
            />
          </label>
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Người đại diện
            <input
              className="input"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Nguyễn Văn A"
            />
          </label>
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Số điện thoại
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
            Email nhận kết quả thẩm định
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten@thugom.vn"
            />
          </label>
        </div>

        <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
          Địa chỉ kho bãi thu gom thực tế
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

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink">
            Giấy tờ bắt buộc
          </span>
          <span className="text-[12px] text-muted">
            Giấy đăng ký doanh nghiệp hoặc hộ kinh doanh, giấy phép thu gom chất thải rắn
            và ảnh chụp mặt tiền kho bãi. Ảnh rõ chữ, tối đa 5 tệp.
          </span>
          <label
            className={`mt-1 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
              err.startsWith("Tải ít nhất")
                ? "border-warn bg-surface-2"
                : "border-sage-line bg-surface-2 hover:bg-surface-3"
            }`}
          >
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="sr-only"
              onChange={(e) => setDocs(Array.from(e.target.files ?? []).slice(0, 5))}
            />
            <span className="text-sm font-semibold text-brand">
              {docs.length === 0 ? "Chọn giấy tờ & ảnh kho bãi" : docs.map((d) => d.name).join(" · ")}
            </span>
            {docs.length === 0 && (
              <span className="text-[12px] text-muted">Chấp nhận ảnh (.jpg, .png, .webp) và PDF</span>
            )}
          </label>
        </div>

        {err && <p className="text-[13px] text-warn">{err}</p>}

        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary h-11 px-6"
          >
            {submitting ? "Đang gửi hồ sơ..." : "Gửi hồ sơ thẩm định"}
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
              ? "Đã ghi nhận vào CSDL PostGIS (Trạng thái: Chờ thẩm định)"
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
