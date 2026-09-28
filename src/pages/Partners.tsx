import { useMemo, useState } from "react"
import { CTA, MATERIAL_TYPES, PARTNERS, REGIONS, type Partner } from "@/data/partners"

export default function Partners() {
  const [query, setQuery] = useState("")
  const [material, setMaterial] = useState(MATERIAL_TYPES[0])
  const [region, setRegion] = useState(REGIONS[0])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PARTNERS.filter((p) => {
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.certification.toLowerCase().includes(q) ||
        p.materials.some((m) => m.toLowerCase().includes(q))
      const matchMaterial =
        material === MATERIAL_TYPES[0] || p.materials.join(" ").includes(material.replace(/ &.*/, ""))
      const matchRegion = region === REGIONS[0] || p.region.includes(region)
      return matchQuery && matchMaterial && matchRegion
    })
  }, [query, material, region])

  const reset = () => {
    setQuery("")
    setMaterial(MATERIAL_TYPES[0])
    setRegion(REGIONS[0])
  }

  return (
    <div>
      {/* Header band */}
      <section className="border-b border-sage/20 bg-white pt-12 pb-14">
        <div className="page">
          <span className="chip border border-sage/20 bg-surface-3 text-brand-deep">
            <BadgeIcon />
            Hệ thống đối tác kiểm định tiêu chuẩn
          </span>
          <h1 className="display mt-1 text-3xl leading-10 md:text-[32px]">
            Đối tác tái chế quy mô lớn
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-[29.25px] text-body">
            Kết nối trực tiếp các đơn vị phát thải lớn với hệ thống nhà máy tái
            chế quy chuẩn, tối ưu hóa chi phí và đảm bảo hồ sơ pháp lý môi
            trường.
          </p>
        </div>
      </section>

      <div className="page flex flex-col gap-6 py-10">
        {/* Filter bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-sage/30 bg-white p-5 shadow-[0_2px_6px_rgba(0,0,0,0.02)] lg:flex-row lg:items-center">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên nhà máy, chứng chỉ..."
            aria-label="Tìm đối tác"
            className="h-11 min-w-0 flex-1 rounded-lg border border-sage-line bg-surface-2 py-3 pr-4 pl-[41px] text-sm text-ink placeholder:text-muted focus:outline-none"
          />

          <Select
            label="Loại phế liệu"
            value={material}
            options={MATERIAL_TYPES}
            onChange={setMaterial}
            className="lg:w-60"
          />
          <Select
            label="Khu vực"
            value={region}
            options={REGIONS}
            onChange={setRegion}
            className="lg:w-56"
          />

          <button type="button" onClick={reset} className="btn-ghost h-11 shrink-0">
            <ResetIcon />
            Đặt lại
          </button>
        </div>

        {/* Result count */}
        <header className="flex items-center justify-between pt-4 pb-2">
          <h2 className="flex items-center gap-2 text-xl leading-7 font-bold tracking-tight text-ink">
            Nhà máy đối tác chọn lọc
            <span className="chip bg-surface-2 text-muted">{filtered.length} đơn vị</span>
          </h2>
          <span className="chip hidden bg-surface-2 text-body sm:inline-flex">
            <i className="size-1.5 rounded-full bg-brand" />
            Hệ thống vận hành 24/7
          </span>
        </header>

        {/* Cards */}
        {filtered.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {filtered.map((p) => (
              <PartnerCard key={p.name} partner={p} />
            ))}
          </div>
        ) : (
          <p className="card p-10 text-center text-sm text-muted">
            Không tìm thấy đơn vị phù hợp. Thử bỏ bớt bộ lọc hoặc{" "}
            <button
              type="button"
              onClick={reset}
              className="font-semibold text-brand-deep"
            >
              đặt lại
            </button>
            .
          </p>
        )}

        {/* CTA banner */}
        <section className="mt-6 flex flex-col items-start justify-between gap-6 rounded-xl border border-sage/30 bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)] md:flex-row md:items-center md:p-10">
          <div>
            <span className="text-[11px] font-semibold tracking-[0.33px] text-brand-soft uppercase">
              {CTA.kicker}
            </span>
            <h2 className="mt-1 text-2xl leading-7 font-bold tracking-tight text-ink">
              {CTA.title}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-[22.75px] text-body">
              {CTA.body}
            </p>
          </div>
          <a href="#" className="btn-primary h-11 shrink-0 rounded-lg px-5">
            {CTA.action}
            <ArrowIcon />
          </a>
        </section>
      </div>
    </div>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={`relative shrink-0 ${className}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-lg bg-surface-2 py-2.5 pr-10 pl-4 text-sm text-ink focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronIcon />
    </div>
  )
}

function PartnerCard({ partner }: { partner: Partner }) {
  return (
    <article className="flex flex-col justify-between rounded-xl border border-sage/30 bg-white p-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src={partner.logo}
              alt={partner.name}
              className="size-14 shrink-0 rounded-lg border border-sage/20 bg-surface-2 object-cover"
              loading="lazy"
            />
            <div className="flex flex-col gap-0.5">
              <h3 className="text-xl leading-7 font-semibold text-ink">
                {partner.name}
              </h3>
              <p className="text-sm leading-5 text-body">{partner.region}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-md border border-sage/20 bg-surface-3 px-3 py-1.5 text-[11px] font-semibold text-brand-deep">
            {partner.certification}
          </span>
        </div>

        <div className="pt-2">
          <p className="text-[11px] font-semibold tracking-[0.55px] text-muted uppercase">
            Chủng loại thu mua chính:
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {partner.materials.map((m) => (
              <li
                key={m}
                className="self-stretch rounded bg-surface-2 px-2.5 py-1 text-xs leading-4 text-body"
              >
                {m}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-sage/15 pt-2.5 pb-2">
          <span className="text-sm text-body">Khối lượng tiếp nhận:</span>
          <span className="text-sm font-semibold text-brand-deep">
            {partner.minWeight}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-sage/20 pt-5">
        <span className="flex items-center gap-2 text-xs text-body">
          <i className="size-1.5 rounded-full bg-brand" />
          {partner.perk}
        </span>
        <a
          href="#"
          className="btn h-9 shrink-0 border border-brand/30 bg-white px-4 text-xs text-brand-deep"
        >
          Liên hệ thu gom
          <ArrowIcon />
        </a>
      </div>
    </article>
  )
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function BadgeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5l5 2v4.2c0 3.1-2 5.6-5 6.8-3-1.2-5-3.7-5-6.8V3.5l5-2z" {...stroke} />
      <path d="M5.8 8.2l1.6 1.6 3-3.2" {...stroke} />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
    >
      <path d="M1 1l4 4 4-4" {...stroke} />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M10.5 6a4.5 4.5 0 11-1.6-3.42" {...stroke} />
      <path d="M10.8 1v2.4H8.4" {...stroke} />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 6h8m0 0L6.5 2.5M10 6l-3.5 3.5" {...stroke} />
    </svg>
  )
}
