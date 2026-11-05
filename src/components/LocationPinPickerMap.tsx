import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react"
import type * as LeafletTypes from "leaflet"
import {
  filterAreaPresets,
  resolveSearchCoordinates,
  searchPlacesOnSubmit,
  type GeocodingSuggestionDto,
} from "@/lib/geocodingApi"

interface LocationPinPickerMapProps {
  lat: number
  lng: number
  onChange?: (lat: number, lng: number, addressHint?: string) => void
  readOnly?: boolean
  pinTitle?: string
  helperText?: string
  allowPrivacyFuzz?: boolean
  defaultPrivacyFuzz?: boolean
  heightClass?: string
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Bản đồ con chấm & kiểm tra toạ độ dùng chung cho cả 4 vai trò:
 * - U-17 (`JoinRecycler.tsx`): Chủ cơ sở chấm chính xác kho bãi thu mua khi nộp hồ sơ.
 * - R-01/R-02 (`recycler/Home.tsx`): Cơ sở xem & cập nhật vị trí kho bãi hiển thị trên `/map`.
 * - S-04 (`staff/Applications.tsx`): Nhân viên mở chế độ `readOnly` đối chiếu địa chỉ giấy phép với ghim thực tế.
 * - U-07 (`user/Handover.tsx`): Người dân chấm điểm hẹn đầu ngõ / sảnh chung cư (tách khỏi vị trí nhà riêng `BR-MTH-05`).
 *
 * Tuyệt đối không dùng thẻ `<form>` bên trong để nhúng an toàn vào các biểu mẫu cha mà không gây lỗi lồng form SSR.
 */
export default function LocationPinPickerMap({
  lat,
  lng,
  onChange,
  readOnly = false,
  pinTitle = "Vị trí đã ghim",
  helperText,
  allowPrivacyFuzz = false,
  defaultPrivacyFuzz = false,
  heightClass = "h-[250px]",
}: LocationPinPickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletTypes.Map | null>(null)
  const leafletRef = useRef<typeof LeafletTypes | null>(null)
  const layerRef = useRef<LeafletTypes.LayerGroup | null>(null)

  const [mapReady, setMapReady] = useState(false)
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [locatingGps, setLocatingGps] = useState(false)
  const [notice, setNotice] = useState("")
  const [remoteResults, setRemoteResults] = useState<GeocodingSuggestionDto[]>([])
  const [privacyFuzz, setPrivacyFuzz] = useState(defaultPrivacyFuzz)

  const onChangeRef = useRef(onChange)
  const privacyFuzzRef = useRef(privacyFuzz)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  useEffect(() => {
    privacyFuzzRef.current = privacyFuzz
  }, [privacyFuzz])

  const presetMatches = useMemo(() => {
    if (!query.trim()) return []
    return filterAreaPresets(query, 4)
  }, [query])

  const emitCoordinates = (rawLat: number, rawLng: number, addressHint?: string) => {
    if (readOnly || !onChangeRef.current) return
    const resolved = resolveSearchCoordinates(
      rawLat,
      rawLng,
      allowPrivacyFuzz && privacyFuzzRef.current,
    )
    onChangeRef.current(resolved.lat, resolved.lng, addressHint)
  }

  // 1. Khởi tạo bản đồ Leaflet trên trình duyệt (SSR-safe)
  useEffect(() => {
    let cancelled = false
    let resizeObserver: ResizeObserver | null = null

    void import("leaflet").then((mod) => {
      if (cancelled || !containerRef.current) return
      const L = ((mod as unknown as { default?: typeof LeafletTypes }).default ??
        mod) as typeof LeafletTypes
      leafletRef.current = L

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: readOnly ? 15 : 14,
        zoomControl: true,
        attributionControl: true,
      })

      const cartoKey = import.meta.env.VITE_CARTO_API_KEY?.trim()
      const tileUrl = cartoKey
        ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoKey)}`
        : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

      const attribution = cartoKey
        ? '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OSM</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'

      L.tileLayer(tileUrl, {
        attribution,
        subdomains: cartoKey ? "abcd" : "abc",
        maxZoom: cartoKey ? 20 : 19,
      }).addTo(map)

      const group = L.layerGroup().addTo(map)
      layerRef.current = group
      mapRef.current = map

      if (!readOnly) {
        map.on("click", (evt: LeafletTypes.LeafletMouseEvent) => {
          emitCoordinates(evt.latlng.lat, evt.latlng.lng)
        })
      }

      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          map.invalidateSize({ pan: false })
        })
        resizeObserver.observe(containerRef.current)
      }

      setMapReady(true)
    })

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      layerRef.current = null
      leafletRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])

  // 2. Đồng bộ tâm bản đồ và ghim khi toạ độ thay đổi
  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    const group = layerRef.current
    if (!mapReady || !map || !L || !group) return

    group.clearLayers()

    if (allowPrivacyFuzz && privacyFuzz) {
      L.circle([lat, lng], {
        radius: 300,
        color: "#226b42",
        weight: 1.5,
        dashArray: "5 5",
        fillColor: "#52b788",
        fillOpacity: 0.14,
        interactive: false,
      }).addTo(group)
    }

    const safeTitle = escapeHtml(pinTitle)
    const icon = L.divIcon({
      className: "ecolink-leaflet-pin",
      iconSize: [34, 42],
      iconAnchor: [17, 38],
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;cursor:${readOnly ? "default" : "grab"};">
          <div style="width:30px;height:30px;border-radius:9999px;background:#18472d;border:2.5px solid #ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.28);display:grid;place-items:center;color:#ffffff;">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 14.5s5-4.3 5-8.2A5 5 0 003 6.3c0 3.9 5 8.2 5 8.2z" stroke="currentColor" stroke-width="1.6"/>
              <circle cx="8" cy="6.3" r="1.8" fill="currentColor"/>
            </svg>
          </div>
          <span style="margin-top:2px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:6px;background:rgba(255,255,255,0.96);padding:1px 6px;font-size:10px;font-weight:700;color:#122018;border:1px solid rgba(18,32,24,0.14);box-shadow:0 2px 5px rgba(0,0,0,0.12);">
            ${safeTitle}
          </span>
        </div>
      `,
    })

    const marker = L.marker([lat, lng], {
      icon,
      draggable: !readOnly,
      title: pinTitle,
    }).addTo(group)

    if (!readOnly) {
      marker.on("dragend", () => {
        const next = marker.getLatLng()
        emitCoordinates(next.lat, next.lng)
      })
    }

    map.setView([lat, lng], map.getZoom(), { animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, lat, lng, pinTitle, readOnly, allowPrivacyFuzz, privacyFuzz])

  async function runPlaceSearch() {
    const q = query.trim()
    if (!q) {
      setNotice("Nhập tên đường, chợ, phường hoặc quận rồi bấm Tìm vị trí.")
      return
    }
    setSearching(true)
    setNotice("")
    try {
      const res = await searchPlacesOnSubmit(q, 4)
      setRemoteResults(res.items)
      if (res.items.length === 0) {
        setNotice("Chưa tìm thấy địa danh khớp. Bạn có thể bấm trực tiếp lên bản đồ để đặt ghim.")
      } else if (res.items.length === 1) {
        const hit = res.items[0]
        emitCoordinates(hit.latitude, hit.longitude, hit.displayName)
        setRemoteResults([])
        setQuery("")
      }
    } finally {
      setSearching(false)
    }
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void runPlaceSearch()
    }
  }

  function requestGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNotice("Trình duyệt không hỗ trợ định vị GPS. Hãy bấm trực tiếp lên bản đồ để ghim.")
      return
    }
    setLocatingGps(true)
    setNotice("")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        emitCoordinates(pos.coords.latitude, pos.coords.longitude)
        setLocatingGps(false)
      },
      () => {
        setLocatingGps(false)
        setNotice("Không lấy được quyền GPS. Bạn hãy gõ tên khu vực hoặc bấm lên bản đồ để ghim.")
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }

  const osmInspectUrl = `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lng.toFixed(5)}#map=17/${lat.toFixed(5)}/${lng.toFixed(5)}`

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface-2/60 p-3.5">
      {!readOnly && (
        <div role="search" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (notice) setNotice("")
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Tìm nhanh đường, phường, chợ... (nhấn Enter để tra cứu)"
              aria-label="Tìm vị trí trên bản đồ"
              className="h-9 min-w-[200px] flex-1 rounded-lg border border-sage-line bg-white px-3 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void runPlaceSearch()}
              disabled={searching}
              className="btn-outline h-9 px-3 text-xs"
            >
              {searching ? "Đang tìm..." : "Tìm vị trí"}
            </button>
            <button
              type="button"
              onClick={requestGps}
              disabled={locatingGps}
              className="btn-ghost h-9 border border-line bg-white px-3 text-xs"
            >
              {locatingGps ? "Đang định vị..." : "GPS hiện tại"}
            </button>
            {allowPrivacyFuzz && (
              <button
                type="button"
                onClick={() => {
                  const next = !privacyFuzz
                  setPrivacyFuzz(next)
                  const resolved = resolveSearchCoordinates(lat, lng, next)
                  onChange?.(resolved.lat, resolved.lng)
                }}
                className={`h-9 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors ${
                  privacyFuzz
                    ? "border-brand/40 bg-brand/10 text-brand-deep"
                    : "border-line bg-white text-body hover:bg-surface-2"
                }`}
              >
                {privacyFuzz ? "Làm mờ ~500m" : "Ghim chính xác đầu ngõ"}
              </button>
            )}
          </div>

          {presetMatches.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {presetMatches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    emitCoordinates(p.lat, p.lng, p.address)
                    setQuery("")
                    setRemoteResults([])
                  }}
                  className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-ink hover:border-brand hover:bg-mint/15"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {remoteResults.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-xl border border-line bg-white p-2">
              {remoteResults.map((item) => (
                <li key={item.placeId}>
                  <button
                    type="button"
                    onClick={() => {
                      emitCoordinates(item.latitude, item.longitude, item.displayName)
                      setRemoteResults([])
                      setQuery("")
                    }}
                    className="flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left hover:bg-surface-2"
                  >
                    <span className="text-xs font-semibold text-ink">{item.shortLabel}</span>
                    <span className="line-clamp-1 text-[11px] text-muted">{item.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {notice && <p className="text-[11px] text-brand-deep">{notice}</p>}
        </div>
      )}

      <div
        className={`relative isolate z-0 w-full overflow-clip rounded-xl border border-line bg-[#e5ece7] ${heightClass}`}
      >
        <div
          ref={containerRef}
          aria-label={pinTitle}
          className="h-full w-full select-none"
        />
        {!mapReady && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#e5ece7]/85 text-xs font-medium text-muted">
            Đang tải bản đồ CARTO Voyager...
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span className="tabular-nums">
          Toạ độ ghim: <b className="text-ink">{lat.toFixed(5)}, {lng.toFixed(5)}</b>
          {!readOnly && " · Bấm lên bản đồ hoặc kéo ghim xanh để chỉnh vị trí"}
        </span>
        {readOnly ? (
          <a
            href={osmInspectUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand hover:text-brand-deep hover:underline"
          >
            Mở bản đồ đối chiếu thực địa ↗
          </a>
        ) : (
          helperText && <span>{helperText}</span>
        )}
      </div>
    </div>
  )
}

