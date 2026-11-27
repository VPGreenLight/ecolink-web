import { useEffect, useRef, useState } from "react"
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react"
import { BookOpen, Check } from "lucide-react"
import { addSpendPoints } from "@/data/rewards"

const REWARD_POINTS = 10
const STORAGE_KEY = "ecolink:blog-read-v1"
const FAB_POS_KEY = "ecolink:blog-reward-fab-pos-v1"
const DRAG_THRESHOLD_PX = 6
const RING_RADIUS = 22.75
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

interface ReadState {
  progress: number
  claimed: boolean
}

interface RatioPos {
  rx: number
  ry: number
}

interface DragOrigin {
  pointerId: number
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  moved: boolean
}

function readState(slug: string): ReadState {
  if (typeof window === "undefined") return { progress: 0, claimed: false }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { progress: 0, claimed: false }
    const parsed = JSON.parse(raw) as Record<string, Partial<ReadState>>
    const item = parsed[slug]
    const progress =
      typeof item?.progress === "number" && Number.isFinite(item.progress)
        ? Math.min(1, Math.max(0, item.progress))
        : 0
    return { progress, claimed: Boolean(item?.claimed) }
  } catch {
    return { progress: 0, claimed: false }
  }
}

function saveState(slug: string, state: ReadState): void {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, ReadState>) : {}
    parsed[slug] = state
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch {}
}

/** Tỷ lệ bài viết đã đi qua khung nhìn: 0 khi còn ở đầu, 1 khi đọc hết đáy. */
export function computeReadProgress(
  rect: { top: number; height: number },
  viewportHeight: number,
): number {
  if (rect.height <= 0) return 0
  const seen = Math.min(rect.height, Math.max(0, viewportHeight - rect.top))
  return Math.min(1, seen / rect.height)
}

function readSavedRatio(): RatioPos {
  if (typeof window === "undefined") return { rx: 1, ry: 1 }
  try {
    const raw = localStorage.getItem(FAB_POS_KEY)
    if (!raw) return { rx: 1, ry: 1 }
    const parsed = JSON.parse(raw) as Partial<RatioPos>
    if (typeof parsed.rx === "number" && typeof parsed.ry === "number") {
      return {
        rx: Math.min(1, Math.max(0, parsed.rx)),
        ry: Math.min(1, Math.max(0, parsed.ry)),
      }
    }
  } catch {}
  return { rx: 1, ry: 1 }
}

function getViewportSize() {
  return {
    w: document.documentElement.clientWidth || window.innerWidth,
    h: document.documentElement.clientHeight || window.innerHeight,
  }
}

function getSafeBounds(w: number, h: number) {
  const desktop = w >= 1024
  const size = w >= 640 ? 60 : 58
  const marginX = desktop ? 24 : 14
  const minX = marginX
  const maxX = Math.max(minX, w - size - marginX)
  const minY = desktop ? 88 : 80
  const maxY = Math.max(minY, h - size - (desktop ? 24 : 90))
  return { minX, maxX, minY, maxY, size }
}

function clampRatioToPixels(ratio: RatioPos, w: number, h: number) {
  const { minX, maxX, minY, maxY } = getSafeBounds(w, h)
  return {
    x: Math.round(minX + ratio.rx * (maxX - minX)),
    y: Math.round(minY + ratio.ry * (maxY - minY)),
  }
}

interface Props {
  slug: string
  targetRef: RefObject<HTMLElement | null>
}

/** Nút nổi kiểu Cây Ảo: vòng tiến độ đọc blog, đủ 100% thì bấm nhận Điểm Xanh. */
export default function BlogReadingReward({ slug, targetRef }: Props) {
  const [progress, setProgress] = useState(0)
  const [claimed, setClaimed] = useState(false)
  const [hint, setHint] = useState("")
  const [ratioPos, setRatioPos] = useState<RatioPos>(() => readSavedRatio())
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === "undefined") return null
    const { w, h } = getViewportSize()
    return clampRatioToPixels(readSavedRatio(), w, h)
  })
  const [dragging, setDragging] = useState(false)

  const progressRef = useRef(0)
  const hintTimer = useRef<number | null>(null)
  const dragRef = useRef<DragOrigin | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    const stored = readState(slug)
    progressRef.current = stored.progress
    setProgress(stored.progress)
    setClaimed(stored.claimed)
    if (stored.claimed) return

    const el = targetRef.current
    if (!el || typeof window === "undefined") return

    let frame = 0
    const update = () => {
      frame = 0
      const next = computeReadProgress(el.getBoundingClientRect(), window.innerHeight)
      const prev = progressRef.current
      if (next <= prev) return
      progressRef.current = next
      setProgress(next)
      if (Math.round(next * 100) !== Math.round(prev * 100)) {
        saveState(slug, { progress: next, claimed: false })
      }
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [slug, targetRef])

  useEffect(() => {
    if (typeof window === "undefined") return
    const syncCoords = () => {
      const { w, h } = getViewportSize()
      const next = clampRatioToPixels(ratioPos, w, h)
      setCoords((prev) => (prev && prev.x === next.x && prev.y === next.y ? prev : next))
    }
    syncCoords()
    window.addEventListener("resize", syncCoords)
    return () => window.removeEventListener("resize", syncCoords)
  }, [ratioPos])

  useEffect(() => {
    return () => {
      if (hintTimer.current) window.clearTimeout(hintTimer.current)
    }
  }, [])

  const showHint = (text: string) => {
    setHint(text)
    if (hintTimer.current) window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(""), 2200)
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || typeof window === "undefined") return
    suppressClickRef.current = false
    const { w, h } = getViewportSize()
    const current = coords ?? clampRatioToPixels(ratioPos, w, h)
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: current.x,
      startY: current.y,
      moved: false,
    }

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d || d.pointerId !== ev.pointerId) return
      const dx = ev.clientX - d.startClientX
      const dy = ev.clientY - d.startClientY

      if (!d.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
        d.moved = true
        suppressClickRef.current = true
        setDragging(true)
      }

      const vw = getViewportSize()
      const { minX, maxX, minY, maxY } = getSafeBounds(vw.w, vw.h)
      setCoords({
        x: Math.min(maxX, Math.max(minX, Math.round(d.startX + dx))),
        y: Math.min(maxY, Math.max(minY, Math.round(d.startY + dy))),
      })
    }

    const onEnd = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d || d.pointerId !== ev.pointerId) return
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onEnd)
      window.removeEventListener("pointercancel", onEnd)
      dragRef.current = null
      if (!d.moved) return

      setDragging(false)
      const vw = getViewportSize()
      const { minX, maxX, minY, maxY } = getSafeBounds(vw.w, vw.h)
      const curX = Math.min(maxX, Math.max(minX, Math.round(d.startX + (ev.clientX - d.startClientX))))
      const curY = Math.min(maxY, Math.max(minY, Math.round(d.startY + (ev.clientY - d.startClientY))))
      const nextRatio: RatioPos = {
        rx: maxX > minX ? (curX - minX) / (maxX - minX) : 1,
        ry: maxY > minY ? (curY - minY) / (maxY - minY) : 1,
      }
      setRatioPos(nextRatio)
      setCoords({ x: curX, y: curY })
      try {
        localStorage.setItem(FAB_POS_KEY, JSON.stringify(nextRatio))
      } catch {}

      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 60)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onEnd)
    window.addEventListener("pointercancel", onEnd)
  }

  const handleClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressClickRef.current) {
      e.preventDefault()
      e.stopPropagation()
      suppressClickRef.current = false
      return
    }
    if (claimed) return
    if (progressRef.current < 1) {
      showHint("Đọc hết bài viết để nhận điểm")
      return
    }
    addSpendPoints(REWARD_POINTS)
    saveState(slug, { progress: 1, claimed: true })
    setClaimed(true)
    showHint(`Đã nhận +${REWARD_POINTS} Điểm Xanh`)
  }

  const percent = Math.round(progress * 100)
  const ready = progress >= 1 && !claimed
  const label = claimed
    ? "Đã nhận điểm cho bài viết này"
    : ready
      ? `Đủ tiến độ, bấm nhận +${REWARD_POINTS} điểm`
      : `Đọc bài để nhận điểm, ${percent}%`
  const tooltipOnRight = ratioPos.rx < 0.45

  return (
    <div
      style={coords ? { left: `${coords.x}px`, top: `${coords.y}px` } : undefined}
      className={`fixed z-30 lg:z-40 ${coords ? "" : "right-3.5 bottom-20 lg:right-6 lg:bottom-6"}`}
    >
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        aria-label={`${label}. Kéo để di chuyển.`}
        aria-disabled={claimed}
        title={`${label} (Kéo để di chuyển)`}
        className={`group relative flex size-[58px] touch-none select-none items-center justify-center rounded-full bg-white focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none sm:size-[60px] ${
          dragging
            ? "cursor-grabbing shadow-[0_16px_32px_-6px_rgba(15,31,21,0.24)]"
            : claimed
              ? "cursor-grab shadow-[0_8px_22px_-4px_rgba(15,31,21,0.14)]"
              : "cursor-grab shadow-[0_8px_22px_-4px_rgba(15,31,21,0.18),0_2px_6px_rgba(15,31,21,0.08)] transition-shadow duration-200 hover:shadow-[0_12px_26px_-4px_rgba(15,31,21,0.24)]"
        }`}
      >
        <svg viewBox="0 0 48 48" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
          <circle cx="24" cy="24" r={RING_RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
          {progress > 0 && (
            <circle
              cx="24"
              cy="24"
              r={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
              transform="rotate(-90 24 24)"
              className={claimed ? "text-brand/60" : "text-brand"}
            />
          )}
        </svg>

        <span
          className={`pointer-events-none relative flex size-[50px] items-center justify-center rounded-full sm:size-[52px] ${
            claimed ? "bg-brand/10 text-brand-deep" : "bg-surface-2 text-brand-deep"
          }`}
        >
          {claimed ? (
            <Check className="size-[22px]" strokeWidth={2.6} />
          ) : (
            <BookOpen className="size-[22px]" strokeWidth={2.1} />
          )}
        </span>

        {ready && (
          <span className="pointer-events-none absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-brand ring-2 ring-white motion-safe:animate-pulse" />
        )}

        <span
          className={`pointer-events-none absolute -bottom-1.5 left-1/2 min-w-[34px] -translate-x-1/2 rounded-full border px-1.5 py-[1.5px] text-center text-[10.5px] leading-none font-bold tabular-nums shadow-2xs ${
            claimed
              ? "border-brand/30 bg-brand/10 text-brand-deep"
              : ready
                ? "border-brand bg-brand text-white"
                : "border-line bg-white text-brand-deep"
          }`}
        >
          {claimed || ready ? `+${REWARD_POINTS}` : `${percent}%`}
        </span>

        <span
          role="status"
          aria-live="polite"
          className={`pointer-events-none absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 items-center rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-ink shadow-[0_8px_20px_-4px_rgba(15,31,21,0.14)] transition-opacity duration-150 lg:top-1/2 lg:bottom-auto lg:mb-0 lg:-translate-y-1/2 lg:translate-x-0 ${
            tooltipOnRight ? "lg:right-auto lg:left-full lg:ml-3" : "lg:right-full lg:mr-3"
          } ${
            hint
              ? "opacity-100"
              : dragging
                ? "opacity-0"
                : "opacity-0 lg:group-hover:opacity-100 lg:group-focus-visible:opacity-100"
          }`}
        >
          {hint || label}
        </span>
      </button>
    </div>
  )
}
