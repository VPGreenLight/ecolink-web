import { useState, type FormEvent } from "react"
import { ADDRESS, CHAT, PARTNER, PINS, RADII } from "@/data/map"

export default function MapPage() {
  const [radius, setRadius] = useState<string>(RADII[0])
  const [draft, setDraft] = useState("")

  const send = (e: FormEvent) => {
    e.preventDefault()
    setDraft("")
  }

  return (
    <div className="flex flex-col gap-4 p-4 xl:h-[calc(100dvh-76px)] xl:flex-row">
      {/* Map panel */}
      <section className="relative flex min-h-[470px] flex-1 flex-col overflow-clip rounded-2xl border border-line bg-surface-3">
        <div className="relative flex-1">
          <img
            src="/assets/map/078b8.png"
            alt="Bản đồ khu vực thu gom"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-white/0 to-white/20" />

          {PINS.map((pin) => (
            <div
              key={pin.label}
              className="absolute flex flex-col items-center"
              style={{ ...pin.pos, opacity: pin.opacity }}
            >
              {pin.active ? (
                <ActivePin label={pin.label} />
              ) : (
                <SimplePin label={pin.label} />
              )}
            </div>
          ))}

          <button
            type="button"
            aria-label="Về lại vị trí hiện tại"
            className="absolute right-3.5 bottom-3.5 grid size-9 place-items-center rounded-xl border border-line bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
          >
            <CrosshairIcon />
          </button>

          {/* location bar + radius toggle */}
          <div className="absolute inset-x-3.5 top-3.5 flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-white/95 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md">
              <PinIcon />
              <span className="min-w-0 flex-1 truncate text-xs font-medium tracking-[0.24px] text-ink">
                {ADDRESS}
              </span>
              <button
                type="button"
                className="shrink-0 text-[11px] font-semibold tracking-[0.33px] text-brand-deep"
              >
                Đổi
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-white/95 p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md">
              {RADII.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadius(r)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-[0.33px] transition-colors ${radius === r ? "bg-brand-deep text-white" : "text-ink hover:bg-surface-2"}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Chat panel */}
      <section className="flex h-[640px] w-full shrink-0 flex-col overflow-clip rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] xl:h-full xl:w-[460px]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <img
                src={PARTNER.avatar}
                alt={PARTNER.name}
                className="size-11 rounded-full object-cover"
              />
              <i className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-white bg-brand" />
            </div>
            <div>
              <h2 className="flex items-center gap-1.5 text-lg leading-6 font-bold text-ink">
                {PARTNER.name}
                <VerifiedIcon />
              </h2>
              <p className="flex items-center gap-1 text-xs leading-[14px] text-muted">
                {PARTNER.distance} <span>·</span> {PARTNER.status}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Gọi thoại"
              className="grid size-8 place-items-center rounded-lg hover:bg-surface-2"
            >
              <PhoneIcon />
            </button>
            <button
              type="button"
              aria-label="Tuỳ chọn khác"
              className="grid size-8 place-items-center rounded-lg hover:bg-surface-2"
            >
              <DotsIcon />
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <p className="self-stretch rounded-full bg-surface-3 px-2.5 py-1 text-center text-[11px] leading-[16.5px] text-body">
            {CHAT.timestamp}
          </p>

          {/* outgoing */}
          <div className="w-full pl-6">
            <div className="flex flex-col items-end gap-1">
              <div className="flex max-w-[320px] flex-col gap-2 rounded-2xl bg-brand-deep p-3 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
                <div className="flex gap-1.5 overflow-clip rounded-xl">
                  {CHAT.photos.map((p) => (
                    <div key={p.label} className="h-20 flex-1" title={p.label}>
                      <img
                        src={p.src}
                        alt={p.label}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm leading-[22.75px] text-white">
                  {CHAT.outgoing.text}
                </p>
              </div>
              <p className="pr-1 text-[11px] leading-[16.5px] text-body">
                {CHAT.outgoing.time}
              </p>
            </div>
          </div>

          {/* incoming */}
          <div className="w-full pr-6">
            <div className="flex items-start gap-2">
              <img
                src={PARTNER.avatar}
                alt={PARTNER.name}
                className="mt-1 size-6 shrink-0 rounded-full object-cover"
                loading="lazy"
              />
              <div className="flex max-w-[320px] flex-col gap-1">
                <div className="rounded-2xl bg-surface-2 px-3 pt-3 pb-3 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
                  <p className="text-sm leading-[22.75px] text-ink">
                    {CHAT.incoming.text}
                  </p>
                </div>
                <p className="ml-1 text-[11px] leading-[16.5px] text-body">
                  {CHAT.incoming.time}
                </p>
              </div>
            </div>
          </div>

          {/* appointment summary */}
          <div className="w-full p-1">
            <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface-2 p-4">
              <div className="flex items-center gap-1.5">
                <CalendarIcon />
                <h3 className="text-sm leading-4 font-semibold text-ink">
                  {CHAT.appointment.title}
                </h3>
                <span className="ml-auto rounded-full bg-mint-bright px-2.5 py-0.5 text-[11px] leading-[16.5px] font-semibold text-brand-deep">
                  {CHAT.appointment.badge}
                </span>
              </div>
              <dl className="flex flex-col gap-2">
                {CHAT.appointment.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex flex-col gap-0.5 rounded-lg border border-line bg-white px-3 py-2.5"
                  >
                    <dt className="text-[11px] leading-[16.5px] text-body">
                      {row.label}
                    </dt>
                    <dd className="text-sm leading-4 font-semibold text-ink">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        <form
          onSubmit={send}
          className="flex shrink-0 items-center gap-2 border-t border-line px-4 py-3"
        >
          <button
            type="button"
            aria-label="Đính kèm ảnh"
            className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-surface-2"
          >
            <AttachIcon />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={CHAT.inputPlaceholder}
            aria-label={CHAT.inputPlaceholder}
            className="h-10 min-w-0 flex-1 rounded-lg bg-surface-2 px-3 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Gửi tin nhắn"
            className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-deep text-white"
          >
            <SendIcon />
          </button>
        </form>
      </section>
    </div>
  )
}

function ActivePin({ label }: { label: string }) {
  return (
    <>
      <span className="-mb-1.5 flex items-center gap-1.5 rounded-full border border-white/20 bg-brand-deep px-3 py-1.5 text-[11px] font-semibold tracking-[0.33px] whitespace-nowrap text-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]">
        <TruckIcon />
        {label}
        <i className="size-1.5 rounded-full bg-mint-bright" />
      </span>
      <span className="h-3 w-3 rotate-45 bg-brand-deep" />
    </>
  )
}

function SimplePin({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-medium tracking-[0.33px] whitespace-nowrap text-ink shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
      <PinIcon />
      {label}
    </span>
  )
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function PinIcon() {
  return (
    <svg width="14" height="15" viewBox="0 0 14 15" fill="none" aria-hidden="true" className="shrink-0 text-brand">
      <path d="M7 14s5-4.2 5-8A5 5 0 002 6c0 3.8 5 8 5 8z" {...stroke} />
      <circle cx="7" cy="6" r="1.8" {...stroke} />
    </svg>
  )
}

function CrosshairIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="text-ink">
      <circle cx="7" cy="7" r="3.4" {...stroke} />
      <path d="M7 1v1.8M7 11.2V13M1 7h1.8M11.2 7H13" {...stroke} />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg width="15" height="10" viewBox="0 0 16 11" fill="none" aria-hidden="true">
      <path d="M1 1h8.5v8H1V1zM9.5 3.6H13l2 2.4v3H9.5V3.6z" {...stroke} />
      <circle cx="4.2" cy="9.6" r="1.4" {...stroke} />
      <circle cx="11.8" cy="9.6" r="1.4" {...stroke} />
    </svg>
  )
}

function VerifiedIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-brand">
      <circle cx="8" cy="8" r="7" {...stroke} />
      <path d="M5.6 8.2l1.7 1.7 3.2-3.4" {...stroke} />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="text-body">
      <path d="M4 1.8l2 2.4-1.4 1.4c.7 1.5 1.9 2.7 3.4 3.4l1.4-1.4 2.4 2c.2.2.2.6 0 .8l-1 1C10 12.4 7.4 9.8 6.6 8.6L3.2 6.8c-.2-.2-.2-.6 0-.8l1-1c.2-.2.6-.2.8 0z" {...stroke} />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg width="4" height="12" viewBox="0 0 4 12" fill="none" aria-hidden="true" className="text-body">
      <circle cx="2" cy="2" r="1" fill="currentColor" />
      <circle cx="2" cy="6" r="1" fill="currentColor" />
      <circle cx="2" cy="10" r="1" fill="currentColor" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true" className="text-brand">
      <rect x="1" y="2.5" width="13" height="11.5" rx="2" {...stroke} />
      <path d="M1 6h13M4.5 1v3M10.5 1v3" {...stroke} />
    </svg>
  )
}

function AttachIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true" className="text-body">
      <path d="M12.5 6.5l-5.6 5.6a3.2 3.2 0 01-4.5-4.5L8 2a2.1 2.1 0 013 3l-5.5 5.6a1 1 0 01-1.5-1.5L9.4 3.8" {...stroke} />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="14" height="11" viewBox="0 0 14 11" fill="none" aria-hidden="true">
      <path d="M1 5.5L13 1l-4 9-2.2-3.3L1 5.5z" {...stroke} />
    </svg>
  )
}
