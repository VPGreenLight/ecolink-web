import { Link } from "react-router-dom"
import { SCAN_RESULT as r } from "@/data/scanner"

export default function Scanner() {
  return (
    <div className="page flex flex-col gap-6 py-10 md:py-16">
      <header className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm text-body">
          Hệ sinh thái
          <Separator />
          <span className="font-medium text-brand-deep">Nhận diện thông minh</span>
        </p>
        <h1 className="display text-2xl leading-8">
          Phân loại &amp; Định giá rác tái chế
        </h1>
      </header>

      <div className="grid gap-8 md:grid-cols-12">
        {/* Left: preview + guidance */}
        <section className="flex flex-col gap-6 md:col-span-7">
          <div className="overflow-clip rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            {/* wash xanh nhạt: nền ảnh chụp không cạnh tranh với vật liệu */}
            <div className="relative aspect-4/3 bg-gradient-to-br from-mint/12 via-surface-2 to-surface-3">
              <img
                src={r.image}
                alt="Mẫu rác chai nhựa PET được nhận diện"
                className="size-full object-cover"
              />

              <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-white/90 px-3.5 py-2 text-xs font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md">
                <CameraIcon />
                Chụp trực tiếp
              </span>

              <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-line-soft bg-white/90 px-4 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md">
                <i className="size-2 rounded-full bg-brand-deep" />
                <b className="text-xs font-semibold tracking-[0.24px] text-brand-deep">
                  {r.tag}
                </b>
                <em className="text-[11px] font-medium tracking-[0.33px] text-muted not-italic">
                  • {r.confidence}% độ tin cậy
                </em>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 bg-white px-6 py-4">
              <span className="text-sm text-body">{r.imageCaption}</span>
              <span className="btn-outline">Tải ảnh lên</span>
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-xl leading-7 font-bold tracking-tight text-ink">
              Hướng dẫn xử lý nhanh
            </h2>
            <ol className="flex flex-col gap-4">
              {r.steps.map((step, i) => (
                <li
                  key={step}
                  className="flex items-start gap-3 rounded-xl border border-line-soft bg-surface-2/60 p-3.5"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand-deep">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-[22.75px] text-ink">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="chip w-fit bg-surface-2 text-body">
            <i className="size-1.5 rounded-full bg-brand" />
            Hệ thống sẵn sàng tại các tỉnh thành
          </p>
        </section>

        {/* Right: result card */}
        <section className="md:col-span-5">
          <div className="card flex flex-col justify-between gap-4 p-8 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
            <div>
              <span className="chip w-full justify-center border border-mint/40 bg-mint/25 text-[11px] font-semibold tracking-[0.33px] text-brand-deep">
                {r.badge}
              </span>

              <h2 className="mt-3 text-[32px] leading-10 font-bold tracking-tight text-ink">
                {r.material}
              </h2>
              <p className="mt-1 text-sm leading-5 text-body">{r.description}</p>

              <div className="mt-6 flex items-center justify-between rounded-xl border border-line-soft bg-surface-2 p-4">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.55px] text-body uppercase">
                    {r.price.label}
                  </p>
                  <p className="mt-0.5 flex items-baseline gap-1">
                    <b className="text-2xl leading-8 font-bold tracking-tight text-brand-deep">
                      {r.price.value}
                    </b>
                    <span className="text-xs font-semibold text-body">
                      {r.price.unit}
                    </span>
                  </p>
                </div>
                <PriceIcon />
              </div>

              <div className="mt-4 rounded-xl border border-line-soft bg-surface-2 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.24px] text-ink">
                    <ShieldIcon />
                    Độ tin cậy nhận diện AI
                  </p>
                  <span className="rounded-full border border-brand/20 bg-mint/25 px-3 py-1.5 text-[11px] font-semibold tracking-[0.33px] text-brand-deep">
                    Chính xác {r.confidence}%
                  </span>
                </div>

                <ul className="flex flex-col gap-4">
                  {r.breakdown.map((b) => (
                    <li key={b.label} className="flex flex-col gap-1.5">
                      <p className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-semibold text-ink">
                          <i
                            className="size-2.5 rounded-full"
                            style={{ background: b.color }}
                          />
                          {b.label}
                        </span>
                        <b className={b.value >= 50 ? "text-brand-deep" : "text-body"}>
                          {b.value}%
                        </b>
                      </p>
                      <div className="h-2 overflow-clip rounded-full bg-line/70">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${b.value}%`,
                            background: b.color,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 flex items-center gap-1.5 border-t border-line-soft pt-4 text-[11px] tracking-[0.33px] text-muted">
                  <InfoIcon />
                  {r.model}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <Link to="/map" className="btn-primary h-12 rounded-xl px-6">
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
    <svg width="26" height="19" viewBox="0 0 26 19" fill="none" aria-hidden="true" className="text-brand-deep">
      <rect x="1" y="1" width="24" height="17" rx="3" {...stroke} />
      <circle cx="13" cy="9.5" r="3.2" {...stroke} />
      <path d="M4.5 5.5h3M4.5 13.5h3" {...stroke} />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="14" height="15" viewBox="0 0 14 15" fill="none" aria-hidden="true" className="text-brand-deep">
      <path d="M7 1l5 2v4c0 3.2-2.1 5.8-5 7-2.9-1.2-5-3.8-5-7V3l5-2z" {...stroke} />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" {...stroke} />
      <path d="M7 6.2v3.4M7 4.4v.6" {...stroke} />
    </svg>
  )
}
