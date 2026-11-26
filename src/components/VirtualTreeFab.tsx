import { useEffect, useRef, useState } from "react"
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react"
import { Link, useLocation } from "react-router-dom"
import { fetchMyVirtualTree } from "@/lib/gamificationApi"
import { isSsrSmokeTest } from "@/lib/hydration"
import { hasLiveBackendAuth, useSession } from "@/lib/session"
import {
  clearLiveTreePreview,
  getDefaultFrameForStage,
  getFrameSrc,
  getStageName,
  getTreeAvatarImgClass,
  readLiveTreePreview,
  readStoredTreePreview,
  saveLiveTreePreview,
  STORAGE_KEY,
  type TreePreviewSnapshot,
  type TreeStage,
} from "@/lib/virtualTree"

const FAB_POS_KEY = "ecolink:tree-fab-pos-v1"
const DRAG_THRESHOLD_PX = 6

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

function samePreview(a: TreePreviewSnapshot, b: TreePreviewSnapshot): boolean {
  return (
    a.stage === b.stage &&
    a.label === b.label &&
    a.water === b.water &&
    a.isDead === b.isDead &&
    a.harvestReady === b.harvestReady
  )
}

function resolveInitialPreview(
  isGuest: boolean,
  liveTreeUser: boolean,
  userKey: string,
): TreePreviewSnapshot {
  if (liveTreeUser) {
    const cached = readLiveTreePreview(userKey)
    if (cached) return cached
    // Chưa có cache thực tế: không đặt mức nước giả 75% để tránh nhảy số khi tải xong API
    return {
      stage: "seed",
      label: getStageName("seed"),
      water: null,
      isDead: false,
      harvestReady: false,
    }
  }

  if (!isGuest) {
    const stored = readStoredTreePreview()
    if (stored) {
      return {
        stage: stored.stage,
        label: stored.isDead ? "Héo khô" : getStageName(stored.stage),
        water: stored.water,
        isDead: stored.isDead,
        harvestReady: stored.harvestReady,
      }
    }
  }

  const stage: TreeStage = "seed"
  return { stage, label: getStageName(stage), water: 80, isDead: false, harvestReady: false }
}

function getWaterTheme(water: number | null, isDead: boolean) {
  if (water === null) {
    return { stroke: "#cbd5e1", textClass: "text-muted border-line bg-white" }
  }
  if (isDead || water <= 20) {
    return { stroke: "#e11d48", textClass: "text-rose-700 border-rose-200 bg-white" }
  }
  if (water < 30) {
    return { stroke: "#d97706", textClass: "text-amber-700 border-amber-200 bg-white" }
  }
  if (water >= 60 && water <= 90) {
    return { stroke: "#0284c7", textClass: "text-sky-700 border-sky-200 bg-white" }
  }
  return { stroke: "#2563eb", textClass: "text-blue-700 border-blue-200 bg-white" }
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
  // Dành khoảng trống bên dưới cho nhãn % đứng gọn phía trên MobileNav
  const maxY = Math.max(minY, h - size - (desktop ? 24 : 80))
  return { minX, maxX, minY, maxY, size }
}

function clampRatioToPixels(ratio: RatioPos, w: number, h: number) {
  const { minX, maxX, minY, maxY } = getSafeBounds(w, h)
  return {
    x: Math.round(minX + ratio.rx * (maxX - minX)),
    y: Math.round(minY + ratio.ry * (maxY - minY)),
  }
}

/** Nút nổi hình tròn (`58px`/`60px`): viền ngoài mảnh hiển thị mực nước rút đối xứng 2 bên,
 *  lòng trong là ảnh cây thật của Cây Ảo EcoLink kèm nhãn `%`, kéo thả tự do trên 4 trang chính. */
export default function VirtualTreeFab() {
  const { pathname } = useLocation()
  const session = useSession()
  const isGuest = !session && !isSsrSmokeTest()
  const liveTreeUser = hasLiveBackendAuth() && session?.role === "user"
  const userKey = session?.id || session?.name || ""

  const [preview, setPreview] = useState<TreePreviewSnapshot>(() =>
    resolveInitialPreview(isGuest, liveTreeUser, userKey),
  )
  const [ratioPos, setRatioPos] = useState<RatioPos>(() => readSavedRatio())
  // Khởi tạo tọa độ đồng bộ ngay ở frame đầu trên trình duyệt để tránh giật vị trí sau hydration
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(() => {
    if (isSsrSmokeTest() || typeof window === "undefined") return null
    const { w, h } = getViewportSize()
    return clampRatioToPixels(readSavedRatio(), w, h)
  })
  const [dragging, setDragging] = useState(false)

  const dragRef = useRef<DragOrigin | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    if (!liveTreeUser) {
      if (isGuest) clearLiveTreePreview()
      const next = resolveInitialPreview(isGuest, liveTreeUser, userKey)
      setPreview((prev) => (samePreview(prev, next) ? prev : next))
    } else {
      const cached = readLiveTreePreview(userKey)
      if (cached) {
        setPreview((prev) => (samePreview(prev, cached) ? prev : cached))
      }

      let active = true
      void fetchMyVirtualTree()
        .then((res) => {
          if (!active || !res.data) return
          const next = saveLiveTreePreview(userKey, res.data)
          setPreview((prev) => (samePreview(prev, next) ? prev : next))
        })
        .catch(() => {
          // Nếu chưa có cache mà lỗi mạng thì giữ 80% ổn định thay vì nháy 75%
          if (!active || readLiveTreePreview(userKey)) return
          setPreview((prev) =>
            prev.water === null ? { ...prev, water: 80 } : prev,
          )
        })
      return () => {
        active = false
      }
    }

    if (isGuest || typeof window === "undefined") return
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const next = resolveInitialPreview(isGuest, liveTreeUser, userKey)
        setPreview((prev) => (samePreview(prev, next) ? prev : next))
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [pathname, isGuest, liveTreeUser, userKey])

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

  const handlePointerDown = (e: ReactPointerEvent<HTMLAnchorElement>) => {
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

  const handleClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (suppressClickRef.current) {
      e.preventDefault()
      e.stopPropagation()
      suppressClickRef.current = false
    }
  }

  const waterRatio = preview.water !== null ? preview.water / 100 : 0
  const radius = 22.75
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - waterRatio)
  // Xoay tâm cung về đỉnh dưới (6 giờ) để khi giảm nước sẽ rút đều 2 bên trái/phải xuống dưới
  const arcRotation = 90 - 180 * waterRatio
  const waterTheme = getWaterTheme(preview.water, preview.isDead)
  const frameSrc = getFrameSrc(getDefaultFrameForStage(preview.stage))
  const waterLabel = preview.water !== null ? `${preview.water}%` : "--"
  const tooltipOnRight = ratioPos.rx < 0.45
  const ariaLabel = `Mở Cây Ảo EcoLink (${preview.label}${preview.water !== null ? `, mực nước ${preview.water}%` : ""}) — có thể kéo để di chuyển`

  return (
    <Link
      to="/ecofacts"
      aria-label={ariaLabel}
      title={`Cây Ảo EcoLink · ${preview.label}${preview.water !== null ? ` · Ẩm ${preview.water}%` : ""} (Kéo để di chuyển)`}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      draggable={false}
      style={coords ? { left: `${coords.x}px`, top: `${coords.y}px` } : undefined}
      className={`group fixed z-30 flex size-[58px] touch-none select-none items-center justify-center rounded-full bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:size-[60px] lg:z-40 ${
        coords ? "" : "right-3.5 bottom-20 lg:right-6 lg:bottom-6"
      } ${
        dragging
          ? "cursor-grabbing shadow-[0_16px_32px_-6px_rgba(15,31,21,0.24)]"
          : "cursor-grab shadow-[0_8px_22px_-4px_rgba(15,31,21,0.18),0_2px_6px_rgba(15,31,21,0.08)] transition-shadow duration-200 hover:shadow-[0_12px_26px_-4px_rgba(15,31,21,0.24)]"
      }`}
    >
      {/* Viền ngoài mảnh gọn hiển thị mực nước rút đối xứng 2 bên xuống đáy */}
      <svg viewBox="0 0 48 48" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="2.5"
        />
        {preview.water !== null && preview.water > 0 && (
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke={waterTheme.stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(${arcRotation} 24 24)`}
          />
        )}
      </svg>

      {/* Ảnh cây thật theo giai đoạn Cây Ảo EcoLink phóng to gần kín lòng nút */}
      <span className="pointer-events-none relative block size-[50px] overflow-hidden rounded-full bg-sky-100 isolate sm:size-[52px]">
        <img
          src={frameSrc}
          alt=""
          draggable={false}
          className={`${getTreeAvatarImgClass(preview.stage)} select-none ${
            preview.isDead ? "grayscale contrast-125 opacity-75" : ""
          }`}
        />
      </span>

      {/* Nhãn % mực nước cố định tại mép dưới viền tròn */}
      <span
        className={`pointer-events-none absolute -bottom-1.5 left-1/2 min-w-[34px] -translate-x-1/2 rounded-full border px-1.5 py-[1.5px] text-center text-[10.5px] leading-none font-bold tabular-nums shadow-2xs ${waterTheme.textClass}`}
      >
        {waterLabel}
      </span>

      {/* Nhãn thông tin khi di chuột trên desktop */}
      <span
        className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-ink shadow-[0_8px_20px_-4px_rgba(15,31,21,0.14)] transition-opacity duration-150 lg:flex ${
          tooltipOnRight ? "left-full ml-3" : "right-full mr-3"
        } ${
          dragging
            ? "opacity-0"
            : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        }`}
      >
        <span>Cây Ảo · {preview.label}</span>
      </span>
    </Link>
  )
}
