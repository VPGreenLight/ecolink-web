import { useState } from "react"

export type AvatarSize = "sm" | "md" | "lg"

const SIZE_CLS: Record<AvatarSize, { box: string; text: string }> = {
  sm: { box: "size-8", text: "text-[11px]" },
  md: { box: "size-11", text: "text-[15px]" },
  lg: { box: "size-16", text: "text-[19px]" },
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return parts
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

/** Circular portrait placeholder clipped cleanly to the lower rim instead of a floating icon. */
function GuestPortraitMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className="size-full text-brand-deep">
      {/* Shoulders anchored flush to the bottom rim of the circular frame */}
      <path
        d="M5.2 32c0-5.4 4.3-9.2 10.8-9.2s10.8 3.8 10.8 9.2"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeOpacity="0.72"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Head */}
      <circle
        cx="16"
        cy="12.5"
        r="4.6"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeOpacity="0.78"
        strokeWidth="1.4"
      />
    </svg>
  )
}

/** Shared user avatar for Navbar and AdminShell with photo, monogram, and guest states. */
export default function UserAvatar({
  name = "",
  avatarUrl,
  size = "sm",
}: {
  name?: string
  avatarUrl?: string | null
  size?: AvatarSize
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const scale = SIZE_CLS[size]
  const cleanUrl = avatarUrl?.trim() || ""
  const initials = initialsOf(name)

  if (cleanUrl && failedUrl !== cleanUrl) {
    return (
      <span
        className={`relative grid ${scale.box} shrink-0 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-black/10`}
      >
        <img
          src={cleanUrl}
          alt={name || "Ảnh đại diện"}
          onError={() => setFailedUrl(cleanUrl)}
          className="size-full object-cover"
          referrerPolicy="no-referrer"
        />
      </span>
    )
  }

  if (initials) {
    return (
      <span
        className={`grid ${scale.box} shrink-0 place-items-center rounded-full bg-[radial-gradient(125%_125%_at_28%_18%,var(--color-brand)_0%,var(--color-brand-deep)_95%)] ${scale.text} leading-none font-semibold tracking-[0.03em] text-white ring-1 ring-inset ring-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] select-none`}
      >
        {initials}
      </span>
    )
  }

  return (
    <span
      className={`relative grid ${scale.box} shrink-0 overflow-hidden rounded-full bg-[radial-gradient(120%_100%_at_50%_15%,rgba(141,249,184,0.38)_0%,var(--color-surface-2)_58%,var(--color-surface-3)_100%)] ring-1 ring-inset ring-brand/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]`}
    >
      <GuestPortraitMark />
    </span>
  )
}
