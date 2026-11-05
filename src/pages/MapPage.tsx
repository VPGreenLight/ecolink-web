import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import LeafletRecyclerMap, {
  type SearchCoordinateSource,
} from "@/components/LeafletRecyclerMap"
import { ApiError } from "@/lib/api"
import {
  filterAreaPresets,
  resolveSearchCoordinates,
  searchPlacesOnSubmit,
  type GeocodingSuggestionDto,
} from "@/lib/geocodingApi"
import {
  DISCOVERY_CATEGORIES,
  formatDistance,
  formatVnd,
  getRecyclerPublicDetail,
  isDiscoverableCategory,
  LOCATION_PRESETS,
  RADIUS_OPTIONS,
  searchNearbyRecyclers,
  type CollectionPartnerDto,
  type DiscoverableCategory,
  type DiscoveryFallbackSuggestionDto,
  type RecyclerSortBy,
} from "@/lib/recyclerDiscoveryApi"
import { getCategoryMeta, parsePreparationSteps } from "@/lib/wasteScanApi"
import { applyOfflineWorkflowToPartners } from "@/lib/recyclerWorkflowApi"

/** Dữ liệu dự phòng chỉ dùng khi máy chủ Backend chưa được bật để người xem giao diện
 *  vẫn kiểm tra được bản đồ tương tác tại Hòa Lạc - Hà Nội & toàn quốc. */
const OFFLINE_PARTNERS: CollectionPartnerDto[] = [
  {
    id: "99999991-9999-9999-9999-999999999991",
    facilityName: "Trạm Thu Gom Tái Chế Xanh Hòa Lạc",
    representativeName: "Đỗ Văn Hùng",
    address: "Thôn 3, Xã Tân Xã (Gần Khu CNC Hòa Lạc & ĐH FPT), Thạch Thất, Hà Nội",
    latitude: 21.0182,
    longitude: 105.5345,
    distanceKm: 1.15,
    contactPhone: "0968112233",
    operatingHours: "07:30 - 19:00",
    description:
      "Chuyên thu mua chai nhựa, vỏ lon, bìa carton và giáo trình cũ tại khu KTX sinh viên, nhà trọ Tân Xã - Khu CNC Hòa Lạc.",
    materials: [
      {
        categoryCode: "plastic",
        categoryName: "Nhựa tái chế (Plastic)",
        pricePerKg: 7200,
        minimumQuantityKg: 1,
        collectionConditions: "Chai nhựa PET/HDPE đã tráng sạch, bẹp chai",
      },
      {
        categoryCode: "paper",
        categoryName: "Giấy báo & Tài liệu (Paper)",
        pricePerKg: 4800,
        minimumQuantityKg: 1.5,
        collectionConditions: "Giấy vở, tài liệu in ấn, sách báo khô ráo",
      },
      {
        categoryCode: "cardboard",
        categoryName: "Bìa Carton (Cardboard)",
        pricePerKg: 4100,
        minimumQuantityKg: 2,
        collectionConditions: "Thùng carton chuyển trọ gập phẳng",
      },
      {
        categoryCode: "metal",
        categoryName: "Kim loại & Vỏ lon (Metal)",
        pricePerKg: 26000,
        minimumQuantityKg: 0.5,
        collectionConditions: "Vỏ lon nước ngọt, lon nhôm sinh hoạt đã dốc sạch",
      },
    ],
  },
  {
    id: "99999992-9999-9999-9999-999999999992",
    facilityName: "Cơ Sở Phế Liệu Minh Tâm — Ngã Tư Hòa Lạc",
    representativeName: "Nguyễn Thị Tâm",
    address: "Km28 Quốc lộ 21A, Xã Thạch Hòa, Huyện Thạch Thất, Hà Nội",
    latitude: 20.9986,
    longitude: 105.5184,
    distanceKm: 1.69,
    contactPhone: "0973445566",
    operatingHours: "07:00 - 18:30",
    description:
      "Điểm cân điện tử minh bạch ngay trục Quốc lộ 21A - Ngã tư Hòa Lạc, nhận thu gom tận sảnh tòa nhà & khu trọ.",
    materials: [
      {
        categoryCode: "plastic",
        categoryName: "Nhựa tái chế (Plastic)",
        pricePerKg: 7000,
        minimumQuantityKg: 1,
        collectionConditions: "Bóc nhãn rời nếu có, không lẫn rác thực phẩm",
      },
      {
        categoryCode: "glass",
        categoryName: "Chai lọ thủy tinh",
        pricePerKg: 2400,
        minimumQuantityKg: 4,
        collectionConditions: "Chai lọ thủy tinh nguyên vẹn, không vỡ vụn",
      },
      {
        categoryCode: "metal",
        categoryName: "Kim loại & Vỏ lon (Metal)",
        pricePerKg: 25500,
        minimumQuantityKg: 1,
        collectionConditions: "Nhôm lon, sắt vụn, thiết bị gia dụng kim loại",
      },
      {
        categoryCode: "cardboard",
        categoryName: "Bìa Carton (Cardboard)",
        pricePerKg: 3900,
        minimumQuantityKg: 2.5,
        collectionConditions: "Bìa carton khô, buộc gọn",
      },
    ],
  },
  {
    id: "99999993-9999-9999-9999-999999999993",
    facilityName: "Vựa Tái Chế Bình Yên — Hòa Lạc",
    representativeName: "Chu Văn Khánh",
    address: "Đường Tỉnh lộ 420, Xã Bình Yên, Huyện Thạch Thất, Hà Nội",
    latitude: 21.0345,
    longitude: 105.5468,
    distanceKm: 3.31,
    contactPhone: "0915889900",
    operatingHours: "07:30 - 18:00",
    description:
      "Cơ sở thu mua kim loại màu, sắt vụn, giấy báo và thùng carton khu vực Bình Yên - Khu CNC Hòa Lạc - Liên Quan.",
    materials: [
      {
        categoryCode: "metal",
        categoryName: "Kim loại & Vỏ lon (Metal)",
        pricePerKg: 27000,
        minimumQuantityKg: 1,
        collectionConditions: "Đồng, nhôm lon, sắt thép phân loại riêng",
      },
      {
        categoryCode: "paper",
        categoryName: "Giấy báo & Tài liệu (Paper)",
        pricePerKg: 4900,
        minimumQuantityKg: 2,
        collectionConditions: "Hồ sơ văn phòng, báo chí, sách vở khô sạch",
      },
      {
        categoryCode: "cardboard",
        categoryName: "Bìa Carton (Cardboard)",
        pricePerKg: 4200,
        minimumQuantityKg: 3,
        collectionConditions: "Thùng carton số lượng từ hộ gia đình & cửa hàng",
      },
    ],
  },
  {
    id: "77777777-7777-7777-7777-777777777777",
    facilityName: "Trạm Tái Chế Xanh Cầu Giấy",
    representativeName: "Hoàng Minh Tuấn",
    address: "68 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội",
    latitude: 21.0368,
    longitude: 105.7825,
    distanceKm: 26.8,
    contactPhone: "0944556677",
    operatingHours: "08:00 - 18:30",
    materials: [
      {
        categoryCode: "plastic",
        categoryName: "Nhựa tái chế (Plastic)",
        pricePerKg: 6900,
        minimumQuantityKg: 1,
        collectionConditions: "Chai nhựa sạch, đã tháo nắp",
      },
      {
        categoryCode: "paper",
        categoryName: "Giấy báo & Tài liệu (Paper)",
        pricePerKg: 4700,
        minimumQuantityKg: 2,
        collectionConditions: "Giấy báo, vở học sinh cũ khô ráo",
      },
    ],
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    facilityName: "Vựa phế liệu EcoGreen",
    representativeName: "Trần Thu Gom",
    address: "123 Đường Nguyễn Hữu Cảnh, P. 22, Bình Thạnh, TP.HCM",
    latitude: 10.7938,
    longitude: 106.7182,
    distanceKm: 2.54,
    contactPhone: "0988776655",
    operatingHours: "07:30 - 18:30",
    description: "Chuyên thu mua nhựa sạch, bìa carton và vỏ lon nhôm tận nơi.",
    materials: [
      {
        categoryCode: "plastic",
        categoryName: "Nhựa tái chế (Plastic)",
        pricePerKg: 7000,
        minimumQuantityKg: 1,
        collectionConditions: "Chai nhựa PET/HDPE đã tráng sạch, bẹp chai",
      },
      {
        categoryCode: "cardboard",
        categoryName: "Bìa Carton (Cardboard)",
        pricePerKg: 3800,
        minimumQuantityKg: 3,
        collectionConditions: "Thùng carton gập phẳng, khô ráo",
      },
    ],
  },
]

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2))
}

/** U-05 Tìm kiếm cơ sở thu gom theo vị trí địa lý trên bản đồ tương tác (Privacy-First Geocoding).
 *
 *  Kết nối trực tiếp với:
 *   - Bản đồ tương tác `Leaflet 1.9.4` + `CARTO Voyager` (`VITE_CARTO_API_KEY`)
 *   - Tìm kiếm 2 tầng: gợi ý tức thì bằng `LOCATION_PRESETS` khi gõ + `GET /api/v1/geocoding/search` khi nhấn Enter
 *   - Bảo mật vị trí `BR-MTH-05`: làm mờ toạ độ sang lưới `~500m` (`0.005°`) cho cả GPS, Click-to-Pin và địa chỉ tìm kiếm
 *   - `GET /api/v1/recyclers/nearby` & `GET /api/v1/recyclers/{recyclerId}` */
export default function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCatParam = searchParams.get("category")
  const initialCat: "" | DiscoverableCategory = isDiscoverableCategory(initialCatParam)
    ? (initialCatParam.trim().toLowerCase() as DiscoverableCategory)
    : ""

  // Tâm neo gốc trước khi qua bộ lọc làm mờ vị trí ~500m (BR-MTH-05)
  const [rawAnchor, setRawAnchor] = useState<{
    rawLat: number
    rawLng: number
    label: string
    source: SearchCoordinateSource
  }>({
    rawLat: LOCATION_PRESETS[0].lat,
    rawLng: LOCATION_PRESETS[0].lng,
    label: LOCATION_PRESETS[0].address,
    source: "preset",
  })

  // Mặc định BẬT ẩn vị trí chính xác (~500m) theo nguyên tắc Privacy-by-Design
  const [privacyMode, setPrivacyMode] = useState<boolean>(true)
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false)

  // Trạng thái ô tìm kiếm khu vực 2 tầng (Tầng 1: Presets 0ms | Tầng 2: Nominatim Proxy khi Submit)
  const [placeQuery, setPlaceQuery] = useState<string>("")
  const [searchingPlaces, setSearchingPlaces] = useState<boolean>(false)
  const [remoteSuggestions, setRemoteSuggestions] = useState<GeocodingSuggestionDto[]>([])
  const [placeAttribution, setPlaceAttribution] = useState<string>("")
  const [placeSearchNotice, setPlaceSearchNotice] = useState<string>("")

  const [gpsStatusMsg, setGpsStatusMsg] = useState<string>("")
  const [locatingGps, setLocatingGps] = useState<boolean>(false)

  const [category, setCategory] = useState<"" | DiscoverableCategory>(initialCat)
  const [radiusKm, setRadiusKm] = useState<number>(10)
  const [keyword, setKeyword] = useState<string>("")
  const [debouncedKeyword, setDebouncedKeyword] = useState<string>("")
  const [sortBy, setSortBy] = useState<RecyclerSortBy>("distance")

  const [loading, setLoading] = useState<boolean>(false)
  const [isOfflineDemo, setIsOfflineDemo] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>("")
  const [partners, setPartners] = useState<CollectionPartnerDto[]>([])
  const [fallback, setFallback] = useState<DiscoveryFallbackSuggestionDto | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<CollectionPartnerDto | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)

  // Toạ độ thực sự dùng để vẽ tâm & gửi lên Backend (đã làm mờ lưới ~500m cho GPS, Click-to-Pin và Tìm kiếm)
  const coords = useMemo(() => {
    const shouldFuzz = privacyMode && rawAnchor.source !== "preset"
    const resolved = resolveSearchCoordinates(
      rawAnchor.rawLat,
      rawAnchor.rawLng,
      shouldFuzz,
    )
    return {
      lat: resolved.lat,
      lng: resolved.lng,
      isFuzzed: resolved.isFuzzed,
      label: rawAnchor.label,
      source: rawAnchor.source,
    }
  }, [rawAnchor, privacyMode])

  // Tầng 1: Lọc tức thì bộ địa danh nội bộ (0ms, không gọi mạng khi gõ phím)
  const instantPresets = useMemo(() => filterAreaPresets(placeQuery, 6), [placeQuery])

  // Đồng bộ nếu URL ?category=... thay đổi từ điều hướng bên ngoài
  useEffect(() => {
    const p = searchParams.get("category")
    const next: "" | DiscoverableCategory = isDiscoverableCategory(p)
      ? (p.trim().toLowerCase() as DiscoverableCategory)
      : ""
    setCategory(next)
  }, [searchParams])

  // Debounce từ khoá lọc danh sách cơ sở bên phải 280ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword.trim()), 280)
    return () => clearTimeout(t)
  }, [keyword])

  // Thao tác Lớp 2: Chấm điểm bất kỳ trên bản đồ (Click-to-Pin) — tự động áp dụng làm mờ ~500m
  const handleMapPinClick = useCallback((clickedLat: number, clickedLng: number) => {
    setRawAnchor({
      rawLat: clickedLat,
      rawLng: clickedLng,
      label: "Tâm vùng quét đã chọn trên bản đồ",
      source: "pin",
    })
    setGpsStatusMsg("")
    setShowLocationPicker(false)
  }, [])

  // Thao tác Lớp 3: Người dùng chủ động bấm lấy vị trí GPS trình duyệt
  const requestBrowserGps = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatusMsg(
        "Trình duyệt không hỗ trợ định vị GPS. Bạn có thể chọn khu vực hoặc bấm trực tiếp lên bản đồ.",
      )
      return
    }
    setLocatingGps(true)
    setGpsStatusMsg("")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const rawLat = Number(pos.coords.latitude.toFixed(6))
        const rawLng = Number(pos.coords.longitude.toFixed(6))
        setRawAnchor({
          rawLat,
          rawLng,
          label: "Khu vực quanh vị trí hiện tại của bạn",
          source: "gps",
        })
        setLocatingGps(false)
        setShowLocationPicker(false)
      },
      () => {
        setLocatingGps(false)
        setGpsStatusMsg(
          "Chưa cấp quyền vị trí GPS. Bạn có thể nhập tên Phường/Quận/Chợ hoặc bấm chọn điểm trên bản đồ.",
        )
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 },
    )
  }, [])

  // Tầng 2: Chỉ gọi Backend Geocoding Proxy (Nominatim) khi nhấn Enter / nút "Tìm khu vực"
  const handlePlaceSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = placeQuery.trim()
    if (trimmed.length < 2) {
      setPlaceSearchNotice("Vui lòng nhập ít nhất 2 ký tự (ví dụ: Hòa Lạc, Thạch Thất, Cầu Giấy, Bách Khoa).")
      return
    }

    setSearchingPlaces(true)
    setPlaceSearchNotice("")
    try {
      const result = await searchPlacesOnSubmit(trimmed, 5)
      setRemoteSuggestions(result.items)
      setPlaceAttribution(result.attribution)
      if (result.items.length === 0) {
        setPlaceSearchNotice(
          "Không tìm thấy địa danh khớp. Hãy thử nhập tên Phường, Quận hoặc Chợ lớn gần bạn.",
        )
      }
    } catch {
      setPlaceSearchNotice("Không thể tra cứu địa danh lúc này. Bạn có thể chọn nhanh khu vực bên dưới.")
    } finally {
      setSearchingPlaces(false)
    }
  }

  // Truy vấn danh sách cơ sở thu mua gần toạ độ (đã làm mờ nếu bật bảo mật)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setErrorMsg("")

    searchNearbyRecyclers(
      {
        lat: coords.lat,
        lng: coords.lng,
        category,
        radiusKm,
        keyword: debouncedKeyword,
        sortBy: category ? sortBy : "distance",
      },
      controller.signal,
    )
      .then((res) => {
        if (controller.signal.aborted) return
        setIsOfflineDemo(false)
        const list = res.data.items ?? []
        setPartners(list)
        setFallback(list.length === 0 ? (res.data.fallbackSuggestion ?? null) : null)
        setSelectedId((prev) =>
          prev && list.some((item) => item.id === prev) ? prev : (list[0]?.id ?? null),
        )
      })
      .catch((err) => {
        if (controller.signal.aborted || (err as { name?: string })?.name === "AbortError") {
          return
        }
        if (err instanceof ApiError && err.isNetworkError) {
          // Dự phòng khi Backend chưa khởi động: đồng bộ trạng thái Online/Offline & hồ sơ vừa duyệt rồi tính Haversine
          setIsOfflineDemo(true)
          const filteredOffline = applyOfflineWorkflowToPartners(OFFLINE_PARTNERS)
            .map((p) => ({
              ...p,
              distanceKm: haversineKm(coords.lat, coords.lng, p.latitude, p.longitude),
            }))
            .filter((p) => {
              const withinRadius = p.distanceKm <= radiusKm
              const hitCat =
                !category ||
                p.materials.some((m) => m.categoryCode.toLowerCase() === category)
              const kw = debouncedKeyword.toLowerCase()
              const hitKw =
                !kw ||
                p.facilityName.toLowerCase().includes(kw) ||
                p.address.toLowerCase().includes(kw)
              return withinRadius && hitCat && hitKw
            })
            .sort((a, b) => a.distanceKm - b.distanceKm)

          setPartners(filteredOffline)
          setFallback(
            filteredOffline.length === 0
              ? {
                  suggestedExpandedRadiusKm: Math.min(50, Math.round(radiusKm * 2.5)),
                  guidanceMessage:
                    "Không tìm thấy cơ sở thu mua phù hợp trong bán kính hiện tại.",
                  allowCommunityPickupPost: true,
                }
              : null,
          )
          setSelectedId(filteredOffline[0]?.id ?? null)
          return
        }

        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Không thể tải danh sách cơ sở thu mua gần bạn.",
        )
        setPartners([])
        setFallback(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [coords.lat, coords.lng, category, radiusKm, debouncedKeyword, sortBy])

  // Tải chi tiết công khai & bảng giá Active mới nhất khi người dùng bấm chọn 1 cơ sở (GET /api/v1/recyclers/{id})
  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null)
      return
    }
    const baseItem = partners.find((p) => p.id === selectedId) ?? null
    setSelectedDetail(baseItem)

    if (isOfflineDemo) return

    const controller = new AbortController()
    setLoadingDetail(true)
    getRecyclerPublicDetail(selectedId, coords.lat, coords.lng, controller.signal)
      .then((detail) => {
        if (!controller.signal.aborted) {
          setSelectedDetail(detail)
        }
      })
      .catch(() => {
        // Giữ thông tin sẵn có từ danh sách tìm kiếm nếu gọi lẻ thất bại
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingDetail(false)
        }
      })

    return () => controller.abort()
  }, [selectedId, coords.lat, coords.lng, isOfflineDemo, partners])

  const changeCategory = (next: "" | DiscoverableCategory) => {
    setCategory(next)
    const nextParams = new URLSearchParams(searchParams)
    if (next) nextParams.set("category", next)
    else nextParams.delete("category")
    setSearchParams(nextParams, { replace: true })
  }

  const radiusChoices = useMemo(() => {
    const base: number[] = [...RADIUS_OPTIONS]
    if (!base.includes(radiusKm)) {
      base.push(radiusKm)
      base.sort((a, b) => a - b)
    }
    return base
  }, [radiusKm])

  const activePartner = selectedDetail ?? partners.find((p) => p.id === selectedId) ?? null

  const handoverUrl = useMemo(() => {
    if (!activePartner) return "/user/handover"
    const p = new URLSearchParams()
    p.set("partnerId", activePartner.id)
    p.set("partnerName", activePartner.facilityName)
    if (category) {
      p.set("waste", getCategoryMeta(category).handoverWasteId)
    }
    return `/user/handover?${p.toString()}`
  }, [activePartner, category])

  const chatUrl = useMemo(() => {
    if (!activePartner) return "/chat"
    const p = new URLSearchParams()
    p.set("partnerId", activePartner.id)
    p.set("partnerName", activePartner.facilityName)
    p.set("partnerAddress", activePartner.address)
    return `/chat?${p.toString()}`
  }, [activePartner])

  const coordinateSourceLabel = useMemo(() => {
    if (coords.isFuzzed) {
      return "Đã làm mờ vị trí (~500m)"
    }
    if (coords.source === "gps") return "Định vị GPS chính xác"
    if (coords.source === "pin") return "Điểm chấm trên bản đồ"
    return "Toạ độ khu vực chung"
  }, [coords.isFuzzed, coords.source])

  return (
    <div className="flex flex-col gap-4 p-4 xl:h-[calc(100dvh-76px)] xl:flex-row">
      {/* Cột trái: Khung bản đồ tương tác CARTO Voyager + Tìm kiếm 2 tầng + Bảo mật vị trí ~500m */}
      <section className="relative flex min-h-[500px] flex-1 flex-col overflow-clip rounded-2xl border border-line bg-surface-3">
        <div className="relative flex-1">
          <LeafletRecyclerMap
            centerLat={coords.lat}
            centerLng={coords.lng}
            radiusKm={radiusKm}
            privacyMode={privacyMode}
            source={coords.source}
            partners={partners}
            selectedPartnerId={activePartner?.id ?? null}
            locatingGps={locatingGps}
            onSelectPartner={(id) => setSelectedId(id)}
            onMapPinClick={handleMapPinClick}
            onRequestGps={requestBrowserGps}
          />

          {/* Thanh địa chỉ + Công tắc ẩn vị trí (~500m) + Chọn bán kính ở cạnh trên bản đồ */}
          <div className="pointer-events-none absolute inset-x-3.5 top-3.5 z-30 flex flex-col gap-2">
            <div className="pointer-events-auto flex flex-wrap items-center gap-2">
              <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-line bg-white/95 px-3.5 py-2 shadow-[0_2px_6px_rgba(0,0,0,0.08)] backdrop-blur-md">
                <PinIcon />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink">{coords.label}</p>
                  <p className="truncate text-[11px] text-muted">
                    {coordinateSourceLabel} • {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPrivacyMode((v) => !v)}
                  data-message-code="BR-MTH-05"
                  title="Khi bật, toạ độ GPS và điểm bấm bản đồ được làm tròn sang lưới ~500m trước khi gửi đi"
                  className={`hidden shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors sm:inline-flex ${
                    privacyMode
                      ? "border-brand/35 bg-brand/10 text-brand-deep"
                      : "border-line bg-surface text-muted hover:bg-surface-2"
                  }`}
                >
                  <ShieldIcon />
                  {privacyMode ? "Ẩn vị trí ~500m" : "Vị trí chính xác"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowLocationPicker((v) => !v)}
                  className="shrink-0 rounded-lg bg-brand-deep px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand"
                >
                  {showLocationPicker ? "Đóng" : "Tìm khu vực"}
                </button>
              </div>

              <div
                role="group"
                aria-label="Bán kính tìm kiếm"
                className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-white/95 p-1.5 shadow-[0_2px_6px_rgba(0,0,0,0.08)] backdrop-blur-md"
              >
                {radiusChoices.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadiusKm(r)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                      radiusKm === r
                        ? "bg-brand-deep text-white"
                        : "text-ink hover:bg-surface-2"
                    }`}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            </div>

            {/* Hộp thoại Tìm kiếm khu vực 2 tầng (Presets tức thì + Nominatim Proxy khi Submit) */}
            {showLocationPicker && (
              <div className="pointer-events-auto max-h-[380px] overflow-y-auto rounded-xl border border-line bg-white/98 p-3.5 shadow-lg backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
                  <div>
                    <p className="text-xs font-bold text-ink">
                      Tra cứu theo khu vực (Không cần nhập số nhà riêng)
                    </p>
                    <p className="text-[11px] text-muted">
                      Gõ tên Quận/Phường để chọn ngay, hoặc nhấn Enter để tìm chợ/đường bất kỳ trên toàn quốc
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPrivacyMode((v) => !v)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                        privacyMode
                          ? "border-brand/40 bg-brand/10 text-brand-deep"
                          : "border-line bg-surface text-body hover:bg-surface-2"
                      }`}
                    >
                      <ShieldIcon />
                      {privacyMode ? "Đang bật làm mờ ~500m" : "Tắt làm mờ vị trí"}
                    </button>

                    <button
                      type="button"
                      onClick={requestBrowserGps}
                      disabled={locatingGps}
                      className="btn-primary h-8 px-3 text-xs"
                    >
                      {locatingGps ? "Đang lấy GPS..." : "Dùng GPS hiện tại"}
                    </button>
                  </div>
                </div>

                {/* Ô tìm kiếm địa danh (Submit-only cho Nominatim) */}
                <form onSubmit={handlePlaceSubmit} className="flex gap-2 pb-2.5">
                  <input
                    type="search"
                    value={placeQuery}
                    onChange={(e) => {
                      setPlaceQuery(e.target.value)
                      if (placeSearchNotice) setPlaceSearchNotice("")
                    }}
                    placeholder="Nhập Phường, Quận, Chợ hoặc Ngã tư... rồi nhấn Enter"
                    aria-label="Nhập tên phường, quận, chợ hoặc ngã tư"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-sage-line bg-surface px-3 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={searchingPlaces}
                    className="btn-outline h-9 shrink-0 px-3 text-xs"
                  >
                    {searchingPlaces ? "Đang tìm..." : "Tìm địa danh"}
                  </button>
                </form>

                {placeSearchNotice && (
                  <p className="mb-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs text-body">
                    {placeSearchNotice}
                  </p>
                )}

                {/* Kết quả từ Backend Geocoding Proxy (Nominatim / LocationIQ) sau khi nhấn Enter */}
                {remoteSuggestions.length > 0 && (
                  <div className="mb-3 rounded-xl border border-brand/25 bg-brand/5 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-brand-deep">
                        Kết quả tra cứu địa danh mở rộng
                      </span>
                      {placeAttribution && (
                        <span className="text-[10px] text-muted">{placeAttribution}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {remoteSuggestions.map((item) => (
                        <button
                          key={item.placeId}
                          type="button"
                          onClick={() => {
                            setRawAnchor({
                              rawLat: item.latitude,
                              rawLng: item.longitude,
                              label: item.shortLabel || item.displayName,
                              source: "search",
                            })
                            setGpsStatusMsg("")
                            setShowLocationPicker(false)
                          }}
                          className="rounded-lg border border-line-soft bg-white px-3 py-2 text-left text-xs transition-colors hover:border-brand hover:bg-surface-2"
                        >
                          <span className="block font-semibold text-ink">
                            {item.shortLabel}
                          </span>
                          <span className="block truncate text-[11px] text-muted">
                            {item.displayName}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tầng 1: Gợi ý khu vực tức thì (0 HTTP request) */}
                <div>
                  <span className="mb-1.5 block text-[11px] font-semibold text-muted">
                    {placeQuery.trim()
                      ? `Khu vực gợi ý nhanh (${instantPresets.length})`
                      : "Chọn nhanh khu vực phổ biến"}
                  </span>
                  {instantPresets.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted">
                      Không khớp khu vực có sẵn — bấm nút <b>Tìm địa danh</b> hoặc nhấn{" "}
                      <b>Enter</b> để tra cứu trên toàn quốc.
                    </p>
                  ) : (
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {instantPresets.map((preset) => {
                        const active =
                          Math.abs(rawAnchor.rawLat - preset.lat) < 0.001 &&
                          Math.abs(rawAnchor.rawLng - preset.lng) < 0.001
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setRawAnchor({
                                rawLat: preset.lat,
                                rawLng: preset.lng,
                                label: preset.address,
                                source: "preset",
                              })
                              setGpsStatusMsg("")
                              setShowLocationPicker(false)
                            }}
                            className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                              active
                                ? "border-brand bg-brand/10 font-semibold text-brand-deep"
                                : "border-line-soft bg-surface text-ink hover:bg-surface-2"
                            }`}
                          >
                            <span className="block truncate font-semibold">
                              {preset.label}
                            </span>
                            <span className="block truncate text-[11px] text-muted">
                              {preset.address}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Thanh lọc nhanh theo loại phế liệu (nhận trực tiếp từ bước Quét AI) */}
            <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
              {DISCOVERY_CATEGORIES.map((c) => {
                const on = category === c.value
                return (
                  <button
                    key={c.value || "all"}
                    type="button"
                    onClick={() => changeCategory(c.value)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold shadow-2xs backdrop-blur-md transition-colors ${
                      on
                        ? "border-brand-deep bg-brand-deep text-white"
                        : "border-line bg-white/92 text-ink hover:bg-white"
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>

            {gpsStatusMsg && (
              <p
                role="status"
                data-message-code="MSG-MTH-02"
                className="pointer-events-auto rounded-xl border border-warn/30 bg-white/95 px-3 py-2 text-xs text-warn shadow-xs"
              >
                {gpsStatusMsg}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Cột phải: Danh sách cơ sở thu mua Verified + Online, chi tiết bảng giá & Fallback MSG-MTH-01 */}
      <section className="flex min-h-[580px] w-full shrink-0 flex-col overflow-clip rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] xl:h-full xl:w-[480px]">
        <header className="flex shrink-0 flex-col gap-3 border-b border-line px-5 py-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-lg leading-6 font-bold text-ink">
                Cơ sở thu mua gần bạn
              </h1>
              <p className="mt-0.5 text-xs text-muted">
                Chỉ hiển thị cơ sở đã xác minh (Verified) và đang mở cửa nhận đơn
              </p>
            </div>
            <span
              className={`chip shrink-0 ${
                isOfflineDemo ? "bg-warn/10 text-warn" : "bg-surface-2 text-brand-deep"
              }`}
            >
              <i
                className={`size-1.5 rounded-full ${
                  isOfflineDemo ? "bg-warn" : "bg-brand"
                }`}
              />
              {loading
                ? "Đang tìm..."
                : isOfflineDemo
                  ? `${partners.length} mẫu Offline`
                  : `${partners.length} mở cửa`}
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Lọc theo tên cơ sở hoặc đường, quận..."
              aria-label="Lọc tên cơ sở hoặc địa chỉ"
              className="h-9 min-w-0 flex-1 rounded-lg border border-sage-line bg-surface px-3 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
            <select
              aria-label="Sắp xếp kết quả"
              value={category ? sortBy : "distance"}
              disabled={!category}
              onChange={(e) => setSortBy(e.target.value as RecyclerSortBy)}
              title={
                category
                  ? "Chọn tiêu chí sắp xếp"
                  : "Chọn một loại phế liệu cụ thể để sắp xếp theo đơn giá"
              }
              className="h-9 shrink-0 rounded-lg border border-sage-line bg-surface px-2.5 text-xs font-medium text-ink focus:border-brand focus:outline-none disabled:opacity-60"
            >
              <option value="distance">Gần nhất</option>
              <option value="price_desc">Giá cao nhất</option>
            </select>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-warn/30 bg-warn/5 p-3.5 text-xs leading-5 text-warn"
            >
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              <div className="pulse-bar h-20 rounded-xl bg-surface-2" />
              <div className="pulse-bar h-20 rounded-xl bg-surface-2" />
              <div className="pulse-bar h-44 rounded-xl bg-surface-2" />
            </div>
          ) : partners.length === 0 ? (
            <FallbackPanel
              radiusKm={radiusKm}
              category={category}
              fallback={fallback}
              onExpandRadius={(nextRadius) => setRadiusKm(nextRadius)}
              onClearFilters={() => {
                setKeyword("")
                changeCategory("")
              }}
            />
          ) : (
            <>
              {/* Danh sách chọn nhanh các cơ sở trong bán kính */}
              <div className="flex flex-col gap-2">
                {partners.map((p) => {
                  const isSelected = p.id === activePartner?.id
                  const matchedMat = category
                    ? p.materials.find(
                        (m) => m.categoryCode.toLowerCase() === category,
                      )
                    : p.materials[0]

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-brand bg-brand/6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                          : "border-line bg-surface hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                            <span className="truncate">{p.facilityName}</span>
                            <VerifiedIcon />
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted">
                            {p.address}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-surface-3 px-2.5 py-0.5 text-[11px] font-semibold text-brand-deep">
                          {formatDistance(p.distanceKm)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-muted">
                          Giờ mở cửa:{" "}
                          <b className="text-body">
                            {p.operatingHours || "08:00 - 18:00"}
                          </b>
                        </span>
                        {matchedMat && (
                          <span className="font-semibold text-brand-deep">
                            {matchedMat.categoryName.replace(/\s*\(.*\)/, "")}:{" "}
                            {formatVnd(matchedMat.pricePerKg)}/kg
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Chi tiết công khai & bảng giá niêm yết của cơ sở đang chọn */}
              {activePartner && (
                <PartnerDetailCard
                  partner={activePartner}
                  highlightedCategory={category}
                  loadingDetail={loadingDetail}
                  handoverUrl={handoverUrl}
                  chatUrl={chatUrl}
                />
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}

/* ---------------------------------------------------------------- Chi tiết cơ sở & bảng giá */

function PartnerDetailCard({
  partner,
  highlightedCategory,
  loadingDetail,
  handoverUrl,
  chatUrl,
}: {
  partner: CollectionPartnerDto
  highlightedCategory: "" | DiscoverableCategory
  loadingDetail: boolean
  handoverUrl: string
  chatUrl: string
}) {
  return (
    <div className="mt-1 flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/65 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-base font-bold text-ink">
              {partner.facilityName}
            </h2>
            <VerifiedIcon />
          </div>
          <p className="mt-0.5 text-xs text-body">{partner.address}</p>
          {partner.representativeName && (
            <p className="mt-0.5 text-[11px] text-muted">
              Đại diện: {partner.representativeName}
            </p>
          )}
        </div>

        {partner.contactPhone && (
          <a
            href={`tel:${partner.contactPhone}`}
            title={`Gọi ${partner.contactPhone}`}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-ink hover:bg-surface-2"
          >
            <PhoneIcon />
            {partner.contactPhone}
          </a>
        )}
      </div>

      {partner.description && (
        <p className="text-xs leading-5 text-body">{partner.description}</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-line-soft bg-white px-3 py-2">
          <span className="block text-[11px] text-muted">Khoảng cách ước tính</span>
          <b className="text-ink">Cách bạn {formatDistance(partner.distanceKm)}</b>
        </div>
        <div className="rounded-lg border border-line-soft bg-white px-3 py-2">
          <span className="block text-[11px] text-muted">Khung giờ hoạt động</span>
          <b className="text-ink">{partner.operatingHours || "08:00 - 18:00"}</b>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold tracking-wide text-ink uppercase">
            Bảng giá thu mua đang áp dụng
          </h3>
          {loadingDetail && (
            <span className="text-[11px] text-muted">Đang cập nhật giá...</span>
          )}
        </div>

        <ul className="mt-2 flex flex-col gap-1.5">
          {partner.materials.map((m) => {
            const isHighlighted =
              highlightedCategory !== "" &&
              m.categoryCode.toLowerCase() === highlightedCategory
            return (
              <li
                key={m.categoryCode}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  isHighlighted
                    ? "border-brand bg-mint/18"
                    : "border-line-soft bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{m.categoryName}</span>
                  <b className="tabular-nums text-brand-deep">
                    {formatVnd(m.pricePerKg)} / kg
                  </b>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                  <span>Tối thiểu: {m.minimumQuantityKg} kg</span>
                  {m.collectionConditions && (
                    <span className="truncate">{m.collectionConditions}</span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Link to={handoverUrl} className="btn-primary h-10 rounded-xl px-3 text-xs">
          Đặt lịch bàn giao
        </Link>
        <Link to={chatUrl} className="btn-outline h-10 rounded-xl px-3 text-xs">
          Nhắn thương lượng
        </Link>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Phương án dự phòng MSG-MTH-01 */

function FallbackPanel({
  radiusKm,
  category,
  fallback,
  onExpandRadius,
  onClearFilters,
}: {
  radiusKm: number
  category: "" | DiscoverableCategory
  fallback: DiscoveryFallbackSuggestionDto | null
  onExpandRadius: (r: number) => void
  onClearFilters: () => void
}) {
  const expanded =
    fallback?.suggestedExpandedRadiusKm && fallback.suggestedExpandedRadiusKm > radiusKm
      ? fallback.suggestedExpandedRadiusKm
      : Math.min(50, Math.round(radiusKm * 2.5))

  const guide = fallback?.publicBinSortingGuide
  const prepSteps = parsePreparationSteps(guide?.preparationSteps)

  return (
    <div
      data-message-code="MSG-MTH-01"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/70 p-4"
    >
      <div>
        <span className="inline-block rounded-full bg-warn/12 px-2.5 py-0.5 text-[11px] font-semibold text-warn">
          Chưa có cơ sở mở cửa trong {radiusKm} km
        </span>
        <p className="mt-2 text-sm leading-6 text-ink">
          {fallback?.guidanceMessage ||
            "Không tìm thấy cơ sở thu mua rác gần bạn trong bán kính hiện tại. Bạn có thể mở rộng bán kính tìm kiếm hoặc xem hướng dẫn xử lý bên dưới."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {radiusKm < 50 && (
          <button
            type="button"
            onClick={() => onExpandRadius(expanded)}
            className="btn-primary h-9 px-3.5 text-xs"
          >
            Mở rộng bán kính lên {expanded} km
          </button>
        )}
        {category && (
          <button
            type="button"
            onClick={onClearFilters}
            className="btn-ghost h-9 px-3.5 text-xs"
          >
            Xem tất cả loại phế liệu
          </button>
        )}
      </div>

      {guide && (
        <div className="rounded-xl border border-line bg-white p-3.5 text-xs leading-5">
          <p className="font-bold text-ink">
            Hướng dẫn thùng rác công cộng ({guide.categoryName})
          </p>
          <p className="mt-1 font-semibold text-brand-deep">
            Màu thùng rác quy định: {guide.standardBinColor}
          </p>
          {prepSteps.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-body">
              {prepSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
          {guide.hazardWarning && (
            <p className="mt-1.5 text-warn">
              <b>Lưu ý:</b> {guide.hazardWarning}
            </p>
          )}
        </div>
      )}

      {(fallback?.allowCommunityPickupPost ?? true) && (
        <div className="rounded-xl border border-brand/25 bg-brand/6 p-3.5 text-xs">
          <p className="font-semibold text-ink">
            Đăng yêu cầu thu gom chờ đối tác nhận đơn
          </p>
          <p className="mt-0.5 text-body">
            Bạn vẫn có thể tạo lịch hẹn trước; cơ sở thu gom quanh khu vực sẽ nhận được
            thông báo ngay khi bật trực tuyến.
          </p>
          <Link to="/user/handover" className="btn-outline mt-2.5 h-9 px-3.5 text-xs">
            Tạo yêu cầu thu gom trước
          </Link>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Icons */

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

function ShieldIcon() {
  return (
    <svg width="13" height="14" viewBox="0 0 14 15" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M7 1.5L2 3.6v3.7c0 3.2 2.1 5.6 5 6.4 2.9-.8 5-3.2 5-6.4V3.6L7 1.5z" {...stroke} />
      <path d="M5.1 7.6l1.3 1.3 2.6-2.7" {...stroke} />
    </svg>
  )
}

function VerifiedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-brand">
      <circle cx="8" cy="8" r="7" {...stroke} />
      <path d="M5.6 8.2l1.7 1.7 3.2-3.4" {...stroke} />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="text-brand-deep">
      <path d="M4 1.8l2 2.4-1.4 1.4c.7 1.5 1.9 2.7 3.4 3.4l1.4-1.4 2.4 2c.2.2.2.6 0 .8l-1 1C10 12.4 7.4 9.8 6.6 8.6L3.2 6.8c-.2-.2-.2-.6 0-.8l1-1c.2-.2.6-.2.8 0z" {...stroke} />
    </svg>
  )
}
