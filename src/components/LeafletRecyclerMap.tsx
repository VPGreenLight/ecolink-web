import { useEffect, useRef, useState } from "react"
import type * as LeafletTypes from "leaflet"
import { Crosshair, LocateFixed, Minus, Plus } from "lucide-react"
import { formatDistance, type CollectionPartnerDto } from "@/lib/recyclerDiscoveryApi"
import { attachVietnamSovereigntyOverlay } from "@/lib/vietnamMapSovereignty"

export type SearchCoordinateSource = "preset" | "search" | "gps" | "pin"

/** Màu tương ứng token brand trong index.css; Leaflet nhận màu qua SVG attribute. */
const MAP_BRAND = "#278733"
const MAP_BRAND_DEEP = "#006516"

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
  const latestViewRef = useRef({ centerLat, centerLng, radiusKm })
  latestViewRef.current = { centerLat, centerLng, radiusKm }
  const latestSelectionRef = useRef({ partners, selectedPartnerId })
  latestSelectionRef.current = { partners, selectedPartnerId }

  useEffect(() => {
    onSelectPartnerRef.current = onSelectPartner
  }, [onSelectPartner])
  useEffect(() => {
    onMapPinClickRef.current = onMapPinClick
  }, [onMapPinClick])

  const focusSelectedPartner = (
    map: LeafletTypes.Map,
    L: typeof LeafletTypes,
    list: CollectionPartnerDto[],
    partnerId: string | null,
    animate: boolean,
  ) => {
    if (!partnerId) return
    const sz = map.getSize()
    if (sz.x === 0 || sz.y === 0) return

    const target = list.find((p) => p.id === partnerId)
    if (!target) return

    const pt = L.latLng(target.latitude, target.longitude)
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      // Trên mobile có thẻ xem nhanh ở đáy (~180px), giữ ghim ở nửa trên thoáng của bản đồ
      const px = map.latLngToContainerPoint(pt)
      const safeBottom = Math.max(140, sz.y - 195)
      if (px.x < 48 || px.x > sz.x - 48 || px.y < 56 || px.y > safeBottom) {
        const projected = map.project(pt)
        projected.y += 72
        map.panTo(map.unproject(projected), { animate })
      }
      return
    }

    if (!map.getBounds().pad(-0.14).contains(pt)) {
      map.panTo(pt, { animate })
    }
  }

  // 1. Khởi tạo thực thể bản đồ Leaflet phía trình duyệt
  useEffect(() => {
    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    let detachSovereignty: (() => void) | null = null
    let rafId: number | null = null
    let removeResizeListener: (() => void) | null = null

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

      const scheduleInvalidate = () => {
        if (rafId !== null) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(() => {
          rafId = null
          const sz = map.getSize()
          map.invalidateSize({ pan: false })
          if (sz.x === 0 || sz.y === 0) {
            const { centerLat: lat, centerLng: lng, radiusKm: r } = latestViewRef.current
            map.setView([lat, lng], radiusToZoom(r), { animate: false })
            const sel = latestSelectionRef.current
            focusSelectedPartner(map, L, sel.partners, sel.selectedPartnerId, false)
          }
        })
      }

      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver(scheduleInvalidate)
        resizeObserver.observe(containerRef.current)
      }
      window.addEventListener("resize", scheduleInvalidate)
      removeResizeListener = () => window.removeEventListener("resize", scheduleInvalidate)
      scheduleInvalidate()

      setMapReady(true)
    })

    return () => {
      cancelled = true
      if (rafId !== null) cancelAnimationFrame(rafId)
      resizeObserver?.disconnect()
      removeResizeListener?.()
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
    const sz = map.getSize()
    if (sz.x === 0 || sz.y === 0) return
    map.flyTo([centerLat, centerLng], radiusToZoom(radiusKm), {
      duration: 0.5,
    })
  }, [centerLat, centerLng, radiusKm, mapReady])

  // 3. Nếu người dùng bấm chọn 1 cơ sở, trượt nhẹ để pin nằm trong phần nhìn thấy của bản đồ
  useEffect(() => {
    const map = mapRef.current
    const L = leafletModRef.current
    if (!map || !L || !mapReady) return
    focusSelectedPartner(map, L, partners, selectedPartnerId, true)
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
      color: MAP_BRAND,
      weight: 1.5,
      dashArray: "6 6",
      fillColor: MAP_BRAND,
      fillOpacity: 0.06,
      interactive: false,
    }).addTo(group)

    // Tâm người dùng / vùng làm mờ vị trí chính xác (~500m theo BR-MTH-05)
    if (privacyMode) {
      L.circle([centerLat, centerLng], {
        radius: 520,
        color: MAP_BRAND_DEEP,
        weight: 1.5,
        fillColor: MAP_BRAND,
        fillOpacity: 0.13,
        interactive: false,
      }).addTo(group)
    }

    const isGps = source === "gps"
    const dotBg = isGps ? "#2563eb" : MAP_BRAND_DEEP
    const haloBg = isGps ? "rgba(37, 99, 235, 0.2)" : "rgba(39, 135, 51, 0.18)"
    const pingBg = "rgba(37, 99, 235, 0.28)"
    const dotShadow = isGps ? "rgba(37, 99, 235, 0.45)" : "rgba(0, 101, 22, 0.4)"

    // Hiển thị điểm tâm bằng chấm tròn đồng tâm đặt chính xác tại [centerLat, centerLng], không kèm chữ che khuất vị trí
    const centerIcon = L.divIcon({
      className: "ecolink-leaflet-div-icon",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      html: `
        <div style="position:relative;width:28px;height:28px;display:grid;place-items:center;pointer-events:none;">
          ${isGps ? `<span class="animate-ping" style="position:absolute;inset:4px;border-radius:9999px;background:${pingBg};"></span>` : ""}
          <span style="position:absolute;inset:2px;border-radius:9999px;background:${haloBg};"></span>
          <span style="position:relative;display:block;width:14px;height:14px;border-radius:9999px;background:${dotBg};border:2.5px solid #ffffff;box-shadow:0 2px 6px ${dotShadow};"></span>
        </div>
      `,
    })

    L.marker([centerLat, centerLng], {
      icon: centerIcon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 150,
    }).addTo(group)

    // Ghim đánh số khớp thứ tự danh sách bên phải để tránh nhãn chồng nhau
    partners.forEach((partner, index) => {
      const isSelected = partner.id === selectedPartnerId
      const isFeatured = Boolean(partner.isFeatured) // Ghim cơ sở Pro tô đặc brand để nổi bật
      const pinNumber = index + 1
      const label = escapeHtml(partner.facilityName)
      const distance = escapeHtml(formatDistance(partner.distanceKm))

      const pinHtml = isSelected
        ? `
          <div style="transform: translate(-50%, -100%);" class="flex cursor-pointer flex-col items-center select-none">
            <span class="flex max-w-[230px] items-center gap-1.5 rounded-full bg-[#006516] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_6px_14px_rgba(15,31,21,0.28)]">
              <span class="tabular-nums opacity-70">${pinNumber}</span>
              <span class="truncate">${label}</span>
              <span class="shrink-0 tabular-nums opacity-70">${distance}</span>
            </span>
            <span class="-mt-1 size-2.5 rotate-45 bg-[#006516]"></span>
          </div>
        `
        : `
          <div style="transform: translate(-50%, -100%);" class="flex cursor-pointer flex-col items-center select-none">
            <span class="flex size-6 items-center justify-center rounded-full border ${isFeatured ? "border-[#278733] bg-[#278733] text-white" : "border-[#cdded3] bg-white text-[#006516]"} text-[11px] font-semibold tabular-nums shadow-[0_2px_6px_rgba(15,31,21,0.2)]">
              ${pinNumber}
            </span>
            <span class="-mt-1 size-2 rotate-45 border-r border-b ${isFeatured ? "border-[#278733] bg-[#278733]" : "border-[#cdded3] bg-white"}"></span>
          </div>
        `

      const marker = L.marker([partner.latitude, partner.longitude], {
        icon: L.divIcon({
          className: "ecolink-leaflet-div-icon",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          html: pinHtml,
        }),
        zIndexOffset: isSelected ? 900 : isFeatured ? 650 : 400 + pinNumber,
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
    <div className="absolute inset-0 size-full">
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

      {/* Cụm điều khiển Phóng to / Thu nhỏ / Về tâm / Định vị GPS: trên phải ở mobile để tránh MobileNav/TreeFab, dưới phải ở Desktop */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 sm:right-4 xl:top-auto xl:bottom-8">
        <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface/95 shadow-sm backdrop-blur-md xl:rounded-lg">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Phóng to bản đồ"
            aria-label="Phóng to bản đồ"
            className="grid size-10 place-items-center border-b border-line-soft text-ink transition-colors hover:bg-surface-2 active:bg-surface-3 xl:size-9"
          >
            <Plus className="size-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Thu nhỏ bản đồ"
            aria-label="Thu nhỏ bản đồ"
            className="grid size-10 place-items-center text-ink transition-colors hover:bg-surface-2 active:bg-surface-3 xl:size-9"
          >
            <Minus className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        <button
          type="button"
          onClick={handleRecenter}
          title="Đưa bản đồ về tâm khu vực đang chọn"
          aria-label="Về tâm khu vực đang chọn"
          className="grid size-10 place-items-center rounded-xl border border-line bg-surface/95 text-ink shadow-sm backdrop-blur-md transition-colors hover:bg-surface-2 active:scale-95 xl:size-9 xl:rounded-lg"
        >
          <Crosshair className="size-4" strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={onRequestGps}
          disabled={locatingGps}
          title="Lấy vị trí GPS hiện tại (tự động làm mờ ~500m nếu bật bảo mật)"
          aria-label="Lấy vị trí GPS hiện tại"
          className="grid size-10 place-items-center rounded-xl border border-line bg-surface/95 text-brand-deep shadow-sm backdrop-blur-md transition-colors hover:bg-surface-2 active:scale-95 disabled:opacity-60 xl:size-9 xl:rounded-lg"
        >
          <LocateFixed className={`size-4 ${locatingGps ? "animate-pulse" : ""}`} strokeWidth={1.5} />
        </button>
      </div>

      {/* Nhãn hướng dẫn Click-to-Pin gọn ở góc dưới trái */}
      <div className="pointer-events-none absolute bottom-8 left-4 z-20 hidden sm:block">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/95 px-3 py-1 text-[11px] font-medium text-body shadow-2xs backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-brand" />
          Bấm lên bản đồ để dời tâm quét bán kính
        </span>
      </div>
    </div>
  )
}

