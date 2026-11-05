import { useEffect, useRef, useState } from "react"
import type * as LeafletTypes from "leaflet"
import { formatDistance, type CollectionPartnerDto } from "@/lib/recyclerDiscoveryApi"
import { attachVietnamSovereigntyOverlay } from "@/lib/vietnamMapSovereignty"

export type SearchCoordinateSource = "preset" | "search" | "gps" | "pin"

interface LeafletRecyclerMapProps {
  centerLat: number
  centerLng: number
  radiusKm: number
  privacyMode: boolean
  source: SearchCoordinateSource
  partners: CollectionPartnerDto[]
  selectedPartnerId: string | null
  locatingGps: boolean
  onSelectPartner: (partnerId: string) => void
  onMapPinClick: (rawLat: number, rawLng: number) => void
  onRequestGps: () => void
}

function radiusToZoom(radiusKm: number): number {
  if (radiusKm <= 2) return 14
  if (radiusKm <= 5) return 13
  if (radiusKm <= 12) return 12
  if (radiusKm <= 25) return 11
  return 10
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
 * Bản đồ tương tác Leaflet 1.9.4 tải nền CARTO Voyager (tương thích hoàn toàn với SSR `npm run check`).
 * - Nạp động `import("leaflet")` trong `useEffect` để không truy cập `window` trên Node.js.
 * - Tách ngữ cảnh xếp lớp `isolate z-0` để các thanh tìm kiếm nổi của EcoLink luôn hiển thị phía trên.
 * - Vẽ trực quan vòng bán kính quét (`radiusKm`) và vùng làm mờ bảo mật `~500m` (`BR-MTH-05`).
 */
export default function LeafletRecyclerMap({
  centerLat,
  centerLng,
  radiusKm,
  privacyMode,
  source,
  partners,
  selectedPartnerId,
  locatingGps,
  onSelectPartner,
  onMapPinClick,
  onRequestGps,
}: LeafletRecyclerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletTypes.Map | null>(null)
  const leafletModRef = useRef<typeof LeafletTypes | null>(null)
  const overlayLayerRef = useRef<LeafletTypes.LayerGroup | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const onSelectPartnerRef = useRef(onSelectPartner)
  const onMapPinClickRef = useRef(onMapPinClick)
  useEffect(() => {
    onSelectPartnerRef.current = onSelectPartner
  }, [onSelectPartner])
  useEffect(() => {
    onMapPinClickRef.current = onMapPinClick
  }, [onMapPinClick])

  // 1. Khởi tạo thực thể bản đồ Leaflet phía trình duyệt
  useEffect(() => {
    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    let detachSovereignty: (() => void) | null = null

    void import("leaflet").then((mod) => {
      if (cancelled || !containerRef.current) return
      const L = ((mod as unknown as { default?: typeof LeafletTypes }).default ??
        mod) as typeof LeafletTypes
      leafletModRef.current = L

      const map = L.map(containerRef.current, {
        center: [centerLat, centerLng],
        zoom: radiusToZoom(radiusKm),
        zoomControl: false,
        attributionControl: true,
      })

      const cartoKey = import.meta.env.VITE_CARTO_API_KEY?.trim()
      const tileUrl = cartoKey
        ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoKey)}`
        : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

      const attribution = cartoKey
        ? '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'

      L.tileLayer(tileUrl, {
        attribution,
        subdomains: cartoKey ? "abcd" : "abc",
        maxZoom: cartoKey ? 20 : 19,
      }).addTo(map)

      detachSovereignty = attachVietnamSovereigntyOverlay(L, map, Boolean(cartoKey))

      const layerGroup = L.layerGroup().addTo(map)
      overlayLayerRef.current = layerGroup
      mapRef.current = map

      map.on("click", (evt: LeafletTypes.LeafletMouseEvent) => {
        onMapPinClickRef.current(evt.latlng.lat, evt.latlng.lng)
      })

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
      detachSovereignty?.()
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      overlayLayerRef.current = null
      setMapReady(false)
    }
    // Khởi tạo 1 lần khi mount; tâm và bán kính cập nhật mượt qua effect bên dưới
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2. Di chuyển góc nhìn mượt khi người dùng đổi khu vực hoặc đổi bán kính quét
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    map.flyTo([centerLat, centerLng], radiusToZoom(radiusKm), {
      duration: 0.5,
    })
  }, [centerLat, centerLng, radiusKm, mapReady])

  // 3. Nếu người dùng bấm chọn 1 cơ sở ở danh sách bên phải, trượt nhẹ để pin nằm trong khung nhìn
  useEffect(() => {
    const map = mapRef.current
    const L = leafletModRef.current
    if (!map || !L || !mapReady || !selectedPartnerId) return

    const target = partners.find((p) => p.id === selectedPartnerId)
    if (!target) return

    const pt = L.latLng(target.latitude, target.longitude)
    if (!map.getBounds().pad(-0.14).contains(pt)) {
      map.panTo(pt, { animate: true })
    }
  }, [selectedPartnerId, partners, mapReady])

  // 4. Vẽ lại vòng bán kính quét, vòng bảo mật ~500m và các ghim cơ sở thu mua
  useEffect(() => {
    const L = leafletModRef.current
    const group = overlayLayerRef.current
    if (!L || !group || !mapReady) return

    group.clearLayers()

    // Vòng bán kính tìm kiếm tổng (2km / 5km / 10km / 25km)
    L.circle([centerLat, centerLng], {
      radius: Math.max(radiusKm, 0.5) * 1000,
      color: "#278733",
      weight: 1.5,
      dashArray: "6 6",
      fillColor: "#67dc99",
      fillOpacity: 0.06,
      interactive: false,
    }).addTo(group)

    // Tâm người dùng / vùng làm mờ vị trí chính xác (~500m theo BR-MTH-05)
    if (privacyMode) {
      L.circle([centerLat, centerLng], {
        radius: 520,
        color: "#006516",
        weight: 1.5,
        fillColor: "#278733",
        fillOpacity: 0.13,
        interactive: false,
      }).addTo(group)
    }

    const centerBadgeText = privacyMode
      ? source === "gps" || source === "pin"
        ? "Vùng lân cận ẩn danh (~500m)"
        : "Tâm khu vực tra cứu"
      : "Tâm vị trí đã chọn"

    const centerIcon = L.divIcon({
      className: "ecolink-leaflet-div-icon",
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      html: `
        <div style="transform: translate(-50%, -50%); pointer-events: none;" class="flex flex-col items-center">
          <span class="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#278733]/35 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#0f1f15] shadow-[0_4px_10px_rgba(0,0,0,0.14)]">
            <span class="inline-block size-2 rounded-full bg-[#278733]"></span>
            ${escapeHtml(centerBadgeText)}
          </span>
        </div>
      `,
    })

    L.marker([centerLat, centerLng], {
      icon: centerIcon,
      interactive: false,
      zIndexOffset: 150,
    }).addTo(group)

    // Các ghim cơ sở thu mua đã xác minh (Verified + Online)
    partners.forEach((partner) => {
      const isSelected = partner.id === selectedPartnerId
      const label = `${escapeHtml(partner.facilityName)} (${escapeHtml(formatDistance(partner.distanceKm))})`

      const pinHtml = isSelected
        ? `
          <div style="transform: translate(-50%, -100%);" class="flex flex-col items-center cursor-pointer select-none">
            <span class="flex max-w-[230px] items-center gap-1.5 rounded-full border border-white/30 bg-[#006516] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_10px_18px_-3px_rgba(0,0,0,0.28)]">
              <span class="inline-block size-2 shrink-0 rounded-full bg-[#8df9b8]"></span>
              <span class="truncate">${label}</span>
            </span>
            <span class="-mt-1 size-2.5 rotate-45 bg-[#006516]"></span>
          </div>
        `
        : `
          <div style="transform: translate(-50%, -100%);" class="flex flex-col items-center cursor-pointer select-none transition-transform hover:scale-105">
            <span class="flex max-w-[205px] items-center gap-1.5 rounded-full border border-[#cdded3] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0f1f15] shadow-[0_4px_8px_rgba(0,0,0,0.14)]">
              <span class="inline-block size-2 shrink-0 rounded-full bg-[#278733]"></span>
              <span class="truncate">${label}</span>
            </span>
            <span class="-mt-1 size-2 rotate-45 border-r border-b border-[#cdded3] bg-white"></span>
          </div>
        `

      const marker = L.marker([partner.latitude, partner.longitude], {
        icon: L.divIcon({
          className: "ecolink-leaflet-div-icon",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          html: pinHtml,
        }),
        zIndexOffset: isSelected ? 900 : 400,
      })

      marker.on("click", (evt: LeafletTypes.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(evt)
        onSelectPartnerRef.current(partner.id)
      })

      marker.addTo(group)
    })
  }, [centerLat, centerLng, radiusKm, privacyMode, source, partners, selectedPartnerId, mapReady])

  const handleZoomIn = () => mapRef.current?.zoomIn()
  const handleZoomOut = () => mapRef.current?.zoomOut()
  const handleRecenter = () => {
    mapRef.current?.flyTo([centerLat, centerLng], radiusToZoom(radiusKm), { duration: 0.45 })
  }

  return (
    <div className="relative size-full">
      {/* Khung bản đồ cô lập stacking context (isolate z-0) để không đè lên thanh công cụ nổi */}
      <div
        ref={containerRef}
        aria-label="Bản đồ tương tác tra cứu cơ sở thu mua phế liệu"
        className="absolute inset-0 z-0 isolate size-full bg-surface-3"
      />

      {/* Phản hồi nền trong lúc gói Leaflet đang khởi tạo (hoặc môi trường SSR) */}
      {!mapReady && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-surface-3/85">
          <span className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-muted shadow-2xs">
            Đang tải bản đồ khu vực...
          </span>
        </div>
      )}

      {/* Cụm nút Phóng to / Thu nhỏ / Về tâm / Định vị GPS ở góc dưới phải */}
      <div className="absolute right-3.5 bottom-7 z-20 flex flex-col gap-1.5">
        <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-white/95 shadow-[0_2px_6px_rgba(0,0,0,0.12)] backdrop-blur-md">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Phóng to bản đồ"
            aria-label="Phóng to bản đồ"
            className="grid size-9 place-items-center border-b border-line-soft text-base font-bold text-ink hover:bg-surface-2"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Thu nhỏ bản đồ"
            aria-label="Thu nhỏ bản đồ"
            className="grid size-9 place-items-center text-base font-bold text-ink hover:bg-surface-2"
          >
            −
          </button>
        </div>

        <button
          type="button"
          onClick={handleRecenter}
          title="Đưa bản đồ về tâm khu vực đang chọn"
          aria-label="Về tâm khu vực đang chọn"
          className="grid size-9 place-items-center rounded-xl border border-line bg-white/95 text-ink shadow-[0_2px_6px_rgba(0,0,0,0.12)] backdrop-blur-md transition hover:bg-white"
        >
          <RecenterIcon />
        </button>

        <button
          type="button"
          onClick={onRequestGps}
          disabled={locatingGps}
          title="Lấy vị trí GPS hiện tại (tự động làm mờ ~500m nếu bật bảo mật)"
          aria-label="Lấy vị trí GPS hiện tại"
          className="grid size-9 place-items-center rounded-xl border border-line bg-white/95 text-brand-deep shadow-[0_2px_6px_rgba(0,0,0,0.12)] backdrop-blur-md transition hover:bg-white disabled:opacity-60"
        >
          <CrosshairIcon />
        </button>
      </div>

      {/* Nhãn hướng dẫn Click-to-Pin gọn ở góc dưới trái */}
      <div className="pointer-events-none absolute bottom-7 left-3.5 z-20 hidden sm:block">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/92 px-3 py-1 text-[11px] font-medium text-body shadow-2xs backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-brand" />
          Bấm lên bản đồ để dời tâm quét bán kính
        </span>
      </div>
    </div>
  )
}

const iconStroke = {
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function CrosshairIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="3.4" {...iconStroke} />
      <path d="M7 1v1.8M7 11.2V13M1 7h1.8M11.2 7H13" {...iconStroke} />
    </svg>
  )
}

function RecenterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" {...iconStroke} />
      <circle cx="8" cy="8" r="1.8" fill="currentColor" />
    </svg>
  )
}

