import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Camera, Expand, X } from "lucide-react"

/** Ba ảnh thực tế mặt tiền / kho bãi chuẩn hoá từ tài sản nội bộ khi cơ sở chưa tải ảnh riêng. */
export const DEFAULT_FACILITY_PHOTOS = [
  "/assets/facilities/depot-green-hub.jpg",
  "/assets/facilities/depot-roadside-bay.jpg",
  "/assets/facilities/depot-industrial-yard.jpg",
] as const

const EXPLICIT_FACILITY_PHOTO_MAP: Record<string, string> = {
  "99999991-9999-9999-9999-99999991": "/assets/facilities/depot-roadside-bay.jpg",
  "99999991-9999-9999-9999-999999999991": "/assets/facilities/depot-roadside-bay.jpg",
  "22222222-2222-2222-2222-222222222222": "/assets/facilities/depot-green-hub.jpg",
  "99999992-9999-9999-9999-999999999992": "/assets/facilities/depot-roadside-bay.jpg",
  "99999993-9999-9999-9999-999999999993": "/assets/facilities/depot-industrial-yard.jpg",
  "99999994-9999-9999-9999-999999999994": "/assets/facilities/depot-industrial-yard.jpg",
  "77777777-7777-7777-7777-777777777777": "/assets/facilities/depot-green-hub.jpg",
}

function hashKey(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

function isUsablePhotoUrl(url?: string | null): url is string {
  if (!url) return false
  const clean = url.trim()
  if (!clean) return false
  // Tránh URL giả lập nội bộ không phân giải DNS (tránh khung ảnh lỗi)
  if (/mock-r2\.ecolink\.vn|example\.com/i.test(clean)) return false
  return /^(https?:\/\/|\/assets\/|data:image\/|blob:)/i.test(clean)
}

export function resolveFacilityPhotoSrc(
  partnerKey: string,
  photoUrl?: string | null,
  facilityName?: string,
): string {
  if (isUsablePhotoUrl(photoUrl)) return photoUrl.trim()
  const mapped = EXPLICIT_FACILITY_PHOTO_MAP[partnerKey]
  if (mapped) return mapped
  const idx = hashKey(partnerKey || facilityName || "ecolink") % DEFAULT_FACILITY_PHOTOS.length
  return DEFAULT_FACILITY_PHOTOS[idx]
}

interface FacilityPhotoCardProps {
  facilityName: string
  address?: string | null
  photoUrl?: string | null
  photoUrls?: string[] | null
  partnerKey?: string
  variant?: "detail" | "card"
  className?: string
}

/**
 * Khung ảnh thực tế mặt tiền / kho bãi cơ sở thu mua:
 * - Bố cục Double-Bezel gọn, micro-zoom `1.03` mượt khi di chuột, không đặt chú thích dưới ảnh.
 * - Hỗ trợ xem nhiều ảnh kho bãi thực tế (tối đa 5 ảnh KYB) hoặc fallback sang ảnh chuẩn nội bộ.
 * - Cho phép bấm phóng to xem chi tiết bảng hiệu, khu vực cân và mặt bằng thu gom.
 */
export default function FacilityPhotoCard({
  facilityName,
  address,
  photoUrl,
  photoUrls,
  partnerKey = facilityName,
  variant = "detail",
  className = "",
}: FacilityPhotoCardProps) {
  const [failedSrcs, setFailedSrcs] = useState<Record<string, boolean>>({})
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const fallbackSrc = resolveFacilityPhotoSrc(partnerKey, null, facilityName)
  const uploadedCandidates = [
    ...(Array.isArray(photoUrls) ? photoUrls : []),
    ...(photoUrl ? [photoUrl] : []),
  ]
    .filter((u): u is string => isUsablePhotoUrl(u))
    .filter((u, idx, arr) => arr.indexOf(u) === idx)

  const validUploaded = uploadedCandidates.filter((u) => !failedSrcs[u])
  const galleryPhotos = validUploaded.length > 0 ? validUploaded : [fallbackSrc]
  const safeIndex = selectedIndex < galleryPhotos.length ? selectedIndex : 0
  const activeSrc = galleryPhotos[safeIndex] ?? fallbackSrc

  useEffect(() => {
    setFailedSrcs({})
    setSelectedIndex(0)
  }, [photoUrl, photoUrls, partnerKey])

  useEffect(() => {
    if (!lightboxOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false)
      if (e.key === "ArrowRight" && galleryPhotos.length > 1) {
        setSelectedIndex((prev) => (prev + 1) % galleryPhotos.length)
      }
      if (e.key === "ArrowLeft" && galleryPhotos.length > 1) {
        setSelectedIndex((prev) => (prev - 1 + galleryPhotos.length) % galleryPhotos.length)
      }
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [lightboxOpen, galleryPhotos.length])

  const altText = `Ảnh thực tế mặt tiền / kho bãi ${facilityName}${
    galleryPhotos.length > 1 ? ` (${safeIndex + 1}/${galleryPhotos.length})` : ""
  }`
  const hasRealUploadedPhoto = validUploaded.length > 0

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Camera className="size-3.5 text-brand" strokeWidth={1.6} aria-hidden="true" />
          {hasRealUploadedPhoto
            ? `Ảnh kho bãi thực tế${galleryPhotos.length > 1 ? ` (${safeIndex + 1}/${galleryPhotos.length})` : ""}`
            : "Ảnh thực tế mặt tiền / kho bãi"}
        </span>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-[11px] font-medium text-body transition-colors hover:border-sage-line hover:bg-surface-2 hover:text-ink"
        >
          <Expand className="size-3" strokeWidth={1.6} aria-hidden="true" />
          Phóng to
        </button>
      </div>

      {/* Khung Double-Bezel chuẩn system: viền mềm ngoài + ảnh sắc nét bên trong, không phủ chữ đè bảng hiệu hay caption dưới ảnh */}
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        aria-label={`Xem phóng to ảnh mặt tiền / kho bãi ${facilityName}`}
        className="group block w-full overflow-hidden rounded-2xl border border-line/90 bg-surface-2/60 p-1 text-left shadow-[0_10px_26px_-14px_rgba(15,31,21,0.16)] transition-shadow hover:shadow-[0_14px_32px_-12px_rgba(15,31,21,0.22)] focus-visible:outline-2 focus-visible:outline-brand"
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[12px] bg-surface-3 ring-1 ring-inset ring-black/6">
          <img
            src={activeSrc}
            alt={altText}
            loading={variant === "detail" ? "eager" : "lazy"}
            onError={() => {
              if (activeSrc !== fallbackSrc) {
                setFailedSrcs((prev) => ({ ...prev, [activeSrc]: true }))
              }
            }}
            className="size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
          />
        </div>
      </button>

      {galleryPhotos.length > 1 && (
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {galleryPhotos.slice(0, 5).map((src, idx) => (
            <button
              key={`${src}-${idx}`}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              aria-label={`Xem ảnh kho bãi ${idx + 1}/${galleryPhotos.length}`}
              className={`overflow-hidden rounded-lg border p-0.5 transition-all ${
                idx === safeIndex
                  ? "border-brand ring-1 ring-brand"
                  : "border-line opacity-75 hover:opacity-100"
              }`}
            >
              <img
                src={src}
                alt={`Ảnh kho bãi ${idx + 1}`}
                className="aspect-[16/10] w-full rounded-[5px] object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Ảnh thực tế mặt tiền ${facilityName}`}
            onClick={() => setLightboxOpen(false)}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/82 p-4 backdrop-blur-md sm:p-6"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-surface shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-wide text-brand uppercase">
                    Ảnh thực tế mặt tiền / kho bãi
                  </p>
                  <h3 className="truncate text-sm font-bold text-ink sm:text-base">
                    {facilityName}
                  </h3>
                  {address && <p className="truncate text-xs text-muted">{address}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  aria-label="Đóng xem ảnh kho bãi"
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-ink transition-colors hover:bg-surface-3"
                >
                  <X className="size-4" strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
              <div className="bg-ink/95 p-1.5 sm:p-2">
                <div className="aspect-[16/9] w-full overflow-hidden rounded-xl ring-1 ring-white/10">
                  <img
                    src={activeSrc}
                    alt={altText}
                    className="size-full object-cover"
                  />
                </div>
                {galleryPhotos.length > 1 && (
                  <div className="mt-2 grid grid-cols-5 gap-2 px-1 pb-1">
                    {galleryPhotos.slice(0, 5).map((src, idx) => (
                      <button
                        key={`lb-${src}-${idx}`}
                        type="button"
                        onClick={() => setSelectedIndex(idx)}
                        className={`overflow-hidden rounded-lg border-2 transition-all ${
                          idx === safeIndex
                            ? "border-brand opacity-100"
                            : "border-transparent opacity-60 hover:opacity-90"
                        }`}
                      >
                        <img
                          src={src}
                          alt={`Ảnh kho bãi ${idx + 1}`}
                          className="aspect-[16/10] w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
