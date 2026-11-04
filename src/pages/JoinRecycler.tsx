import { useState } from "react"
import { PageHead } from "@/components/Portal"

/** U-05 Đăng ký tài khoản thu mua.
 *
 *  Tách khỏi `/register` vì đây là quy trình khác hẳn: có giấy phép phải
 *  thẩm định, không có thì không được đứng trong nhà người dân và nhận tiền
 *  mặt của họ. Nhồi vào form đăng ký chung thì form dài gấp đôi và người
 *  dân phải đọc qua mấy ô không liên quan tới mình.
 *
 *  Chưa có backend: bấm gửi thì chỉ hiện mã hồ sơ để người dùng mang đi. */
export default function JoinRecycler() {
  const [docs, setDocs] = useState<File[]>([])
  const [name, setName] = useState("")
  const [owner, setOwner] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [mats, setMats] = useState<string[]>([])
  const [ref, setRef] = useState("")
  const [err, setErr] = useState("")

  const MATERIALS = [
    "Nhựa",
    "Giấy và bìa carton",
    "Kim loại",
    "Thủy tinh",
    "Điện tử",
    "Rác hữu cơ",
  ]

  const submit = (e: React.FormEvent) => {
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
    if (mats.length === 0) {
      setErr("Chọn ít nhất một loại rác bạn thu mua.")
      return
    }
    if (docs.length === 0) {
      setErr("Tải ít nhất một giấy tờ để hồ sơ được thẩm định.")
      return
    }
    setErr("")
    // ponytail: chưa có backend, sinh mã hồ sơ tại chỗ. Nối API thì thay dòng
    // này và giữ nguyên phần hiển thị mã bên dưới.
    setRef(`HS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)
  }

  if (ref) return <Done id={ref} name={name} />

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="ĐỐI TÁC THU MUA"
        title="Đăng ký cơ sở thu mua"
        body="Điền hồ sơ và tải giấy tờ lên. Hồ sơ được thẩm định trong 3 ngày làm việc, trước khi điểm của bạn hiện trên bản đồ GPS."
      />

      <form onSubmit={submit} noValidate className="card flex flex-col gap-6 p-5 md:p-6">
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
            Email
            <input className="input" type="email" placeholder="ten@thugom.vn" />
          </label>
        </div>

        <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
          Địa chỉ thu gom
          <input
            className={`input ${err.startsWith("Cần địa chỉ") ? "border-warn" : ""}`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="512 Hai Bà Trưng, Quận 5"
          />
        </label>

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
            Giấy đăng ký doanh nghiệp hoặc hộ kinh doanh, và giấy phép thu gom
            chất thải rắn. Ảnh chụp rõ chữ, không cắt mép giấy. Tối đa 5 tệp.
          </span>
          <label
            className={`mt-1 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
              err.startsWith("Tải ít nhất") ? "border-warn bg-surface-2" : "border-sage-line bg-surface-2 hover:bg-surface-3"
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
              {docs.length === 0 ? "Chọn giấy tờ" : docs.map((d) => d.name).join(" · ")}
            </span>
            {docs.length === 0 && (
              <span className="text-[12px] text-muted">Chấp nhận ảnh và PDF</span>
            )}
          </label>
        </div>

        {err && <p className="text-[13px] text-warn">{err}</p>}

        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button type="submit" className="btn-primary h-11 px-6">
            Gửi hồ sơ thẩm định
          </button>
          <p className="text-[13px] text-muted">
            Chờ duyệt thì bạn vẫn dùng được tài khoản người dân như thường.
          </p>
        </div>
      </form>
    </div>
  )
}

function Done({ id, name }: { id: string; name: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="ĐỐI TÁC THU MUA"
        title="Đã nhận hồ sơ"
        body={`${name} đã gửi hồ sơ. Nhân viên EcoLink thẩm định trong 3 ngày làm việc và liên hệ qua số điện thoại bạn đăng ký.`}
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
        <p className="ml-auto text-sm text-body">
          Mang mã này khi gọi 1900 8828 để tra nhanh.
        </p>
      </div>

      <ol className="card flex flex-col gap-4 p-5">
        {[
          ["Nhận hồ sơ", "Chúng tôi kiểm tra giấy tờ còn hiệu lực trong 1 ngày làm việc."],
          ["Thẩm định", "Nhân viên có thể gọi để xác minh địa chỉ thu gom thực tế."],
          ["Duyệt và lên bản đồ", "Sau khi duyệt, bạn đặt bảng giá và bắt đầu nhận yêu cầu."],
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
    </div>
  )
}