import { Link } from "react-router-dom"
import { SCAN_RESULT as r } from "@/data/scanner"

/** Trang này phải vừa một màn hình 1440x900, không cuộn (trừ footer).
 *  Ba chỗ ăn nhiều chiều cao nhất, xử lý theo thứ tự:
 *   1. ảnh aspect-4/3 trong cột 7/12 = 660px rộng x 495px cao, đổi sang
 *      aspect-video cắt còn 371px. Tiết kiệm lớn nhất, mất gì? chỉ chiều cao ảnh.
 *   2. mỗi khối có padding 6-8 và gap 4-6, cộng lại ~120px. Giảm còn gap-3/p-4.
 *   3. thanh 3 nút xếp dọc ở đáy cột phải, 2 nút 48px + 44px. Xuống 44/40. */
export default function Scanner() {
  return (
    <div className="page flex flex-col py-5 md:py-6">
      {/* Tiêu đề và nhãn trạng thái đặt cùng hàng: khoảng trống bên phải tiêu đề
          thừng, để nhãn vào đó thay vì dồn xuống cuối cột trái. */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="flex items-center gap-1.5 text-[13px] text-body">
            Hệ sinh thái
            <Separator />
            <span className="font-medium text-brand-deep">Nhận diện thông minh</span>
          </p>
          <h1 className="display mt-1 text-[22px] leading-7 md:text-2xl md:leading-8">
            Phân loại &amp; Định giá rác tái chế
          </h1>
        </div>
        <p className="chip bg-surface-2 text-body">
          <i className="size-1.5 rounded-full bg-brand" />
          Hệ thống sẵn sàng tại các tỉnh thành
        </p>
      </header>

      <div className="mt-4 grid gap-5 md:grid-cols-12">
        {/* 6/6 chứ không 7/5: cột trái là cột cao hơn (ảnh + hướng dẫn), cho
            nó hẹp lại một chút thì ảnh bớt cao và cột phải dư chỗ trống,
            tổng chiều cao trang giảm ~21px. */}
        <section className="flex flex-col gap-3 md:col-span-6">
          <div className="overflow-clip rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            {/* wash xanh nhạt: nền ảnh chụp không cạnh tranh với vật liệu */}
            <div className="relative aspect-video bg-gradient-to-br from-mint/12 via-surface-2 to-surface-3">
              <img
                src={r.image}
                alt="Mẫu rác chai nhựa PET được nhận diện"
                className="size-full object-cover"
              />

              <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-white/90 px-3 py-1.5 text-[11px] font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md">
                <CameraIcon />
                Chụp trực tiếp
              </span>

              <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border border-line-soft bg-white/90 px-3.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md">
                <i className="size-2 rounded-full bg-brand-deep" />
                <b className="text-xs font-semibold text-brand-deep">{r.tag}</b>
                <em className="text-[11px] font-medium text-muted not-italic">
                  • {r.confidence}% độ tin cậy
                </em>
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-surface-2 bg-white px-4 py-2.5">
              <span className="text-[13px] text-body">{r.imageCaption}</span>
              <span className="btn-outline h-8 px-3 text-[13px]">Tải ảnh lên</span>
            </div>
          </div>

          <div>
            <h2 className="text-base leading-6 font-bold tracking-tight text-ink">
              Hướng dẫn xử lý nhanh
            </h2>
            {/* 2 bước đứng cạnh nhau từ sm trở lên: xếp dọc tốn 2 hàng, đặt
                cạnh nhau gọn bằng 1 hàng và đọc cân đối hơn. */}
            <ol className="mt-2 grid gap-2 sm:grid-cols-2">
              {r.steps.map((step, i) => (
                <li
                  key={step}
                  className="flex items-start gap-2.5 rounded-lg border border-line-soft bg-surface-2/60 px-3 py-2"
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/10 text-[11px] font-bold text-brand-deep">
                    {i + 1}
                  </span>
                  <span className="text-[13px] leading-5 text-ink">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Cột phải: kết quả nhận diện */}
        <section className="md:col-span-6">
          <div className="card flex flex-col gap-3 p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
            <div>
              <span className="chip w-full justify-center border border-mint/40 bg-mint/25 text-[11px] font-semibold text-brand-deep">
                {r.badge}
              </span>

              <h2 className="mt-2.5 text-[26px] leading-8 font-bold tracking-tight text-ink">
                {r.material}
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-body">{r.description}</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-line-soft bg-surface-2 px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.5px] text-body uppercase">
                  {r.price.label}
                </p>
                <p className="mt-0.5 flex items-baseline gap-1">
                  <b className="text-xl leading-7 font-bold tracking-tight text-brand-deep">
                    {r.price.value}
                  </b>
                  <span className="text-xs font-semibold text-body">{r.price.unit}</span>
                </p>
              </div>
              <PriceIcon />
            </div>

            <div className="rounded-lg border border-line-soft bg-surface-2 p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <ShieldIcon />
                  Độ tin cậy nhận diện AI
                </p>
                <span className="rounded-full border border-brand/20 bg-mint/25 px-2.5 py-1 text-[11px] font-semibold text-brand-deep">
                  Chính xác {r.confidence}%
                </span>
              </div>

              <ul className="mt-3 flex flex-col gap-2.5">
                {r.breakdown.map((b) => (
                  <li key={b.label}>
                    <p className="flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-1.5 font-semibold text-ink">
                        <i className="size-2 rounded-full" style={{ background: b.color }} />
                        {b.label}
                      </span>
                      <b className={b.value >= 50 ? "text-brand-deep" : "text-body"}>
                        {b.value}%
                      </b>
                    </p>
                    <div className="mt-1 h-1.5 overflow-clip rounded-full bg-line/70">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${b.value}%`, background: b.color }}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-3 flex items-center gap-1.5 border-t border-line-soft pt-2.5 text-[11px] text-muted">
                <InfoIcon />
                {r.model}
              </p>
            </div>

            {/* 2 nút cạnh nhau từ sm trở lên: xếp dọc tốn 2 hàng (56px), cạnh
                nhau gộp còn 1. Dưới sm vẫn xếp dọc vì 320px chia đôi thì chữ
                bị xuống dòng và nút cao không đều. */}
            <div className="grid gap-2 sm:grid-cols-2">
              <Link to="/map" className="btn-primary h-11 rounded-xl px-4">
                Tìm người thu gom ngay
              </Link>
              <button type="button" className="btn-ghost h-11 rounded-xl">
                Lưu kết quả
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function Separator() {
  return (
    <svg width="6" height="10" viewBox="0 0 6 10" fill="none" aria-hidden="true">
      <path
        d="M1 1l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function CameraIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5.5A1.5 1.5 0 013.5 4h1L5.5 2.5h5L11.5 4h1A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-7z" {...stroke} />
      <circle cx="8" cy="9" r="2.4" {...stroke} />
    </svg>
  )
}

function PriceIcon() {
  return (
    <svg width="24" height="18" viewBox="0 0 26 19" fill="none" aria-hidden="true" className="text-brand-deep">
      <rect x="1" y="1" width="24" height="17" rx="3" {...stroke} />
      <circle cx="13" cy="9.5" r="3.2" {...stroke} />
      <path d="M4.5 5.5h3M4.5 13.5h3" {...stroke} />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="13" height="14" viewBox="0 0 14 15" fill="none" aria-hidden="true" className="text-brand-deep">
      <path d="M7 1l5 2v4c0 3.2-2.1 5.8-5 7-2.9-1.2-5-3.8-5-7V3l5-2z" {...stroke} />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" {...stroke} />
      <path d="M7 6.2v3.4M7 4.4v0.6" {...stroke} />
    </svg>
  )
}
