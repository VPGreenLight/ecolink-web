import { useEffect, useMemo, useRef, useState } from "react"
import { Minus, Plus, X } from "lucide-react"

/** Khung cắt ảnh vuông cho ảnh đại diện.
 *
 *  Không dùng thư viện: đủ một canvas + transform. Người dùng kéo ảnh để
 *  chọn vùng nằm trong vòng tròn, chỉnh zoom, rồi xuất ra JPEG vuông. */
const BOX = 288
const OUT = 512

type Drag = {
  pointerId: number
  startX: number
  startY: number
  baseX: number
  baseY: number
}

export default function AvatarCropper({
  file,
  onCancel,
  onConfirm,
}: {
  file: File
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState("")
  const dragRef = useRef<Drag | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const el = new Image()
    let active = true
    el.onload = () => {
      if (!active) return
      setImg(el)
      setError("")
    }
    el.onerror = () => {
      if (!active) return
      setError("Không đọc được ảnh này.")
    }
    el.src = url
    return () => {
      active = false
      URL.revokeObjectURL(url)
    }
  }, [file])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel])

  const base = img ? Math.max(BOX / img.naturalWidth, BOX / img.naturalHeight) : 1
  const scale = base * zoom
  const width = img ? img.naturalWidth * scale : BOX
  const height = img ? img.naturalHeight * scale : BOX
  const maxX = Math.max(0, (width - BOX) / 2)
  const maxY = Math.max(0, (height - BOX) / 2)
  const left = (BOX - width) / 2 + offset.x
  const top = (BOX - height) / 2 + offset.y

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

  const applyZoom = (next: number) => {
    if (!img) return
    const s1 = base * zoom
    const w1 = img.naturalWidth * s1
    const h1 = img.naturalHeight * s1
    const ix = (w1 / 2 - offset.x) / s1
    const iy = (h1 / 2 - offset.y) / s1
    const s2 = base * next
    const w2 = img.naturalWidth * s2
    const h2 = img.naturalHeight * s2
    setOffset({
      x: clamp(w2 / 2 - ix * s2, -(w2 - BOX) / 2, (w2 - BOX) / 2),
      y: clamp(h2 / 2 - iy * s2, -(h2 - BOX) / 2, (h2 - BOX) / 2),
    })
    setZoom(next)
  }

  const crop = () => {
    if (!img) return
    const canvas = document.createElement("canvas")
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(img, -left / scale, -top / scale, BOX / scale, BOX / scale, 0, 0, OUT, OUT)
    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob)
      },
      "image/jpeg",
      0.92,
    )
  }

  const nudge = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 12 : 4
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const delta = map[e.key]
    if (!delta) return
    e.preventDefault()
    setOffset({
      x: clamp(offset.x + delta[0], -maxX, maxX),
      y: clamp(offset.y + delta[1], -maxY, maxY),
    })
  }

  const zoomPct = useMemo(() => Math.round(zoom * 100), [zoom])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Cắt ảnh đại diện"
    >
      <div className="card flex w-full max-w-[380px] flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Cắt ảnh đại diện</h2>
            <p className="mt-1 text-[13px] leading-5 text-muted">
              Kéo ảnh để chọn phần nằm trong vòng tròn.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Đóng"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex justify-center">
          <div
            className="relative size-[288px] touch-none overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              dragRef.current = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                baseX: offset.x,
                baseY: offset.y,
              }
            }}
            onPointerMove={(e) => {
              const d = dragRef.current
              if (!d || d.pointerId !== e.pointerId) return
              setOffset({
                x: clamp(d.baseX + (e.clientX - d.startX), -maxX, maxX),
                y: clamp(d.baseY + (e.clientY - d.startY), -maxY, maxY),
              })
            }}
            onPointerUp={() => {
              dragRef.current = null
            }}
            onPointerCancel={() => {
              dragRef.current = null
            }}
            onKeyDown={nudge}
            tabIndex={0}
            role="application"
            aria-label="Vùng cắt ảnh, dùng phím mũi tên để di chuyển ảnh"
          >
            {img && (
              <img
                src={img.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{ width, height, left, top }}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => applyZoom(clamp(zoom - 0.1, 1, 3))}
            disabled={zoom <= 1}
            aria-label="Thu nhỏ"
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            aria-label="Mức phóng"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-brand"
          />
          <button
            type="button"
            onClick={() => applyZoom(clamp(zoom + 0.1, 1, 3))}
            disabled={zoom >= 3}
            aria-label="Phóng to"
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
          <span className="w-10 shrink-0 text-right text-[12px] tabular-nums text-muted">
            {zoomPct}%
          </span>
        </div>

        {error && (
          <p role="alert" className="text-[13px] font-medium text-warn">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-line-soft pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost h-11 min-h-11 px-4 text-sm"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={crop}
            disabled={!img}
            className="btn-primary h-11 min-h-11 px-5 text-sm"
          >
            Dùng ảnh này
          </button>
        </div>
      </div>
    </div>
  )
}
