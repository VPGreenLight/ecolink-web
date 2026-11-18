import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { BadgeCheck, ChevronDown, Clock, MapPin, Navigation, Phone, Search, ShieldCheck, Tag } from "lucide-react"
import ShinyText from "@/components/ShinyText"
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
import {
  fetchRecyclerReviews,
  reportReview,
  type RecyclerReviewsSummaryDto,
} from "@/lib/reviewComplaintApi"

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
    hasVerifiedBadge: true,
    isFeatured: true,
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

/** Nhãn gọn cho filter loại phế liệu một hàng; `title` giữ nguyên tên đầy đủ. */
const CATEGORY_SHORT: Record<string, string> = {
  "": "Tất cả",
  plastic: "Nhựa",
  paper: "Giấy báo",
  cardboard: "Carton",
  metal: "Kim loại",
  glass: "Thủy tinh",
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

  // Khi mở một cơ sở, đôn dòng đó lên đầu khung danh sách để detail chiếm trọn tầm nhìn
  const listScrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!selectedId) return
    const container = listScrollRef.current
    if (!container) return
    const li = container.querySelector<HTMLLIElement>(`li[data-partner-id="${selectedId}"]`)
    if (!li) return
    const delta = li.getBoundingClientRect().top - container.getBoundingClientRect().top
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    container.scrollTo({
      top: container.scrollTop + delta,
      behavior: reduce ? "auto" : "smooth",
    })
  }, [selectedId])

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
        sortBy: !category && sortBy === "price_desc" ? "distance" : sortBy,
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
          prev && list.some((item) => item.id === prev) ? prev : null,
        )
      })
      .catch((err) => {
        if (controller.signal.aborted || (err as { name?: string })?.name === "AbortError") {
          return
        }
        // Dự phòng khi Backend lỗi kết nối hoặc phản hồi sự cố hệ thống:
        // Tự động chuyển sang chế độ Offline Demo để hiển thị đầy đủ 4 cơ sở Hòa Lạc và cơ sở lân cận
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
          .sort(
            (a, b) =>
              Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) ||
              Number(Boolean(b.hasVerifiedBadge)) - Number(Boolean(a.hasVerifiedBadge)) ||
              a.distanceKm - b.distanceKm,
          )

        if (filteredOffline.length > 0) {
          if (err instanceof ApiError) {
            console.warn("[MapPage] Nearby API error (" + err.messageCode + "): " + err.message + ", fallback to offline.")
          }
          setPartners(filteredOffline)
          setFallback(null)
          setSelectedId(null)
          setErrorMsg("")
          return
        }

        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Không thể tải danh sách cơ sở thu mua gần bạn.",
        )
        setPartners([])
        setFallback({
          suggestedExpandedRadiusKm: Math.min(50, Math.round(radiusKm * 2.5)),
          guidanceMessage:
            "Không tìm thấy cơ sở thu mua phù hợp trong bán kính hiện tại.",
          allowCommunityPickupPost: true,
        })
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
    <div className="flex flex-col gap-3 p-3 md:p-4 xl:h-[calc(100dvh-76px)] xl:flex-row">
      {/* Cột trái: khung bản đồ tương tác + tra cứu khu vực + bảo mật vị trí ~500m */}
      <section className="relative flex min-h-[520px] flex-1 flex-col overflow-clip rounded-2xl border border-line bg-surface-3">
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

          {/* Thanh điều khiển gọn trên bản đồ: khu vực, quyền riêng tư và bán kính */}
          <div className="pointer-events-none absolute inset-x-4 top-4 z-30 flex flex-col gap-2">
            <div className="pointer-events-auto flex flex-wrap items-start gap-2">
              <div className="flex min-w-[280px] flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface/95 px-3 py-2 shadow-sm backdrop-blur-md">
                <MapPin className="size-4 shrink-0 text-brand" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{coords.label}</p>
                  <p className="truncate text-xs text-muted">
                    {coordinateSourceLabel} · {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPrivacyMode((v) => !v)}
                  data-message-code="BR-MTH-05"
                  aria-pressed={privacyMode}
                  title="Khi bật, toạ độ GPS và điểm bấm bản đồ được làm tròn sang lưới ~500m trước khi gửi đi"
                  className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors ${
                    privacyMode
                      ? "border-brand/35 bg-brand/10 text-brand-deep"
                      : "border-line bg-surface text-muted hover:bg-surface-2"
                  }`}
                >
                  <ShieldCheck className="size-3.5" strokeWidth={1.5} />
                  <span className="hidden sm:inline">
                    {privacyMode ? "Ẩn vị trí ~500m" : "Vị trí chính xác"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLocationPicker((v) => !v)}
                  aria-expanded={showLocationPicker}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-brand-deep px-2.5 text-xs font-medium text-white transition-colors hover:bg-brand"
                >
                  Đổi khu vực
                  <ChevronDown
                    className={`size-3.5 transition-transform ${showLocationPicker ? "rotate-180" : ""}`}
                    strokeWidth={1.5}
                  />
                </button>
              </div>

              <div
                role="group"
                aria-label="Bán kính tìm kiếm"
                className="flex shrink-0 items-center rounded-xl border border-line bg-surface/95 p-1 shadow-sm backdrop-blur-md"
              >
                <span className="px-2 text-xs text-muted">Bán kính</span>
                {radiusChoices.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadiusKm(r)}
                    aria-pressed={radiusKm === r}
                    className={`h-7 rounded-lg px-2 text-xs font-medium tabular-nums transition-colors ${
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

            {/* Hộp thoại tra cứu khu vực: gợi ý nội bộ 0ms + Nominatim khi nhấn Enter */}
            {showLocationPicker && (
              <div className="pointer-events-auto max-h-[400px] overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-lg">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-medium text-ink">Tra cứu theo khu vực</p>
                    <p className="mt-0.5 text-xs text-muted">
                      Gõ tên Quận/Phường để chọn ngay, hoặc nhấn Enter để tìm chợ, đường
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={requestBrowserGps}
                    disabled={locatingGps}
                    className="btn-primary h-8 px-3 text-xs"
                  >
                    {locatingGps ? "Đang lấy GPS..." : "Dùng GPS hiện tại"}
                  </button>
                </div>

                {/* Ô tìm kiếm địa danh (Submit-only cho Nominatim) */}
                <form onSubmit={handlePlaceSubmit} className="mt-3 flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
                      strokeWidth={1.5}
                    />
                    <input
                      type="search"
                      value={placeQuery}
                      onChange={(e) => {
                        setPlaceQuery(e.target.value)
                        if (placeSearchNotice) setPlaceSearchNotice("")
                      }}
                      placeholder="Phường, Quận, Chợ hoặc Ngã tư"
                      aria-label="Nhập tên phường, quận, chợ hoặc ngã tư"
                      className="h-9 w-full rounded-lg border border-sage-line bg-surface pr-3 pl-8 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searchingPlaces}
                    className="btn-outline h-9 shrink-0 px-3 text-xs"
                  >
                    {searchingPlaces ? "Đang tìm..." : "Tìm địa danh"}
                  </button>
                </form>

                {placeSearchNotice && (
                  <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-body">
                    {placeSearchNotice}
                  </p>
                )}

                {/* Kết quả từ Backend Geocoding Proxy (Nominatim / LocationIQ) sau khi nhấn Enter */}
                {remoteSuggestions.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-ink">Kết quả tra cứu</span>
                      {placeAttribution && (
                        <span className="text-[11px] text-muted">{placeAttribution}</span>
                      )}
                    </div>
                    <div className="mt-1.5 divide-y divide-line-soft rounded-lg border border-line">
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
                          className="block w-full px-3 py-2 text-left transition-colors hover:bg-surface-2"
                        >
                          <span className="block text-xs font-medium text-ink">
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
                <div className="mt-3">
                  <span className="text-xs text-muted">
                    {placeQuery.trim()
                      ? `Khu vực gợi ý (${instantPresets.length})`
                      : "Khu vực phổ biến"}
                  </span>
                  {instantPresets.length === 0 ? (
                    <p className="mt-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted">
                      Không khớp khu vực có sẵn. Nhấn Enter để tra cứu trên toàn quốc.
                    </p>
                  ) : (
                    <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
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
                                ? "border-brand/40 bg-brand/10 text-brand-deep"
                                : "border-line-soft bg-surface hover:bg-surface-2"
                            }`}
                          >
                            <span className="block truncate font-medium">{preset.label}</span>
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

            {gpsStatusMsg && (
              <p
                role="status"
                data-message-code="MSG-MTH-02"
                className="pointer-events-auto rounded-xl border border-warn/30 bg-surface px-3 py-2 text-xs text-warn"
              >
                {gpsStatusMsg}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Cột phải: danh sách cơ sở đã xác minh, mở rộng tại chỗ để xem bảng giá */}
      <section className="flex min-h-[580px] w-full shrink-0 flex-col overflow-clip rounded-2xl border border-line bg-surface xl:h-full xl:w-[460px]">
        <header className="shrink-0 border-b border-line px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[19px] leading-6 font-semibold text-ink">
                Cơ sở thu mua gần bạn
              </h1>
              <p className="mt-1 text-xs text-muted">Đã xác minh và đang mở cửa nhận đơn</p>
            </div>
            <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted">
              {loading ? "Đang tìm" : `${partners.length} cơ sở`}
            </span>
          </div>

          <div
            role="group"
            aria-label="Lọc theo loại phế liệu"
            className="mt-2.5 grid grid-cols-6 gap-1"
          >
            {DISCOVERY_CATEGORIES.map((c) => {
              const on = category === c.value
              const short = CATEGORY_SHORT[c.value] ?? c.label.replace(/\s*\(.*\)/, "")
              return (
                <button
                  key={c.value || "all"}
                  type="button"
                  onClick={() => changeCategory(c.value)}
                  aria-pressed={on}
                  title={c.label.replace(/\s*\(.*\)/, "")}
                  className={`h-7 truncate rounded-lg px-1 text-[11px] transition-colors ${
                    on
                      ? "bg-brand-deep font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                      : "font-medium text-body hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  {short}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
                strokeWidth={1.5}
              />
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tên cơ sở hoặc đường, quận"
                aria-label="Lọc tên cơ sở hoặc địa chỉ"
                className="h-9 w-full rounded-lg border border-sage-line bg-surface pr-3 pl-8 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
              />
            </div>
            <select
              aria-label="Sắp xếp kết quả"
              value={!category && sortBy === "price_desc" ? "distance" : sortBy}
              onChange={(e) => setSortBy(e.target.value as RecyclerSortBy)}
              title="Chọn tiêu chí sắp xếp"
              className="h-9 shrink-0 rounded-lg border border-sage-line bg-surface px-2.5 text-xs font-medium text-ink focus:border-brand focus:outline-none"
            >
              <option value="distance">Gần nhất</option>
              <option value="rating_desc">Đánh giá cao nhất</option>
              {category && <option value="price_desc">Giá cao nhất</option>}
            </select>
          </div>

          {isOfflineDemo && (
            <p className="mt-2 flex items-center gap-2 text-[11px] text-muted">
              <span className="size-1.5 rounded-full bg-warn" />
              Đang hiển thị dữ liệu mẫu vì máy chủ chưa phản hồi
            </p>
          )}
        </header>

        <div ref={listScrollRef} className="flex-1 overflow-y-auto">
          {errorMsg && (
            <div
              role="alert"
              className="m-4 rounded-xl border border-warn/30 bg-warn/5 p-3.5 text-xs leading-5 text-warn"
            >
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="space-y-1 p-4">
              <div className="pulse-bar h-16 rounded-lg bg-surface-2" />
              <div className="pulse-bar h-16 rounded-lg bg-surface-2" />
              <div className="pulse-bar h-16 rounded-lg bg-surface-2" />
            </div>
          ) : partners.length === 0 ? (
            <div className="p-4">
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
            </div>
          ) : (
            <ul className="divide-y divide-line-soft">
              {partners.map((p, index) => {
                const isSelected = p.id === activePartner?.id
                const matchedMat = category
                  ? p.materials.find((m) => m.categoryCode.toLowerCase() === category)
                  : undefined
                const minPrice =
                  p.materials.length > 0
                    ? Math.min(...p.materials.map((m) => m.pricePerKg))
                    : 0

                return (
                  <li
                    key={p.id}
                    data-partner-id={p.id}
                    className={
                      isSelected
                        ? "bg-surface-2/70"
                        : p.isFeatured
                          ? "bg-mint/8"
                          : ""
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedId((prev) => (prev === p.id ? null : p.id))
                      }
                      aria-expanded={isSelected}
                      className="w-full px-5 py-3 text-left transition-colors hover:bg-mint/10"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums ${
                            isSelected
                              ? "border-brand-deep bg-brand-deep text-white"
                              : p.isFeatured
                                ? "border-brand/40 bg-brand/10 text-brand-deep"
                                : "border-line bg-surface text-muted"
                          }`}
                        >
                          {index + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm leading-5 font-semibold text-ink">
                              {p.facilityName}
                            </span>
                            {p.hasVerifiedBadge && (
                              <span
                                role="img"
                                aria-label="Đã xác minh"
                                title="Đã xác minh"
                                className="sheen inline-flex shrink-0 items-center justify-center"
                              >
                                <BadgeCheck
                                  className="size-4 text-brand"
                                  strokeWidth={1.5}
                                  aria-hidden="true"
                                />
                              </span>
                            )}
                            {p.isFeatured && (
                              <span className="inline-flex shrink-0 items-center rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5">
                                <ShinyText
                                  text="Đối tác Pro"
                                  color="#006516"
                                  shineColor="#ffffff"
                                  speed={2.4}
                                  shineWidth={35}
                                  softness={0.65}
                                  trigger="loop"
                                  className="text-[10px] font-semibold"
                                />
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted">{p.address}</p>

                          <dl className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                            <div className="inline-flex items-center gap-1 font-semibold tabular-nums text-amber-700">
                              <dt className="sr-only">Đánh giá</dt>
                              <dd>
                                ★ {(p.averageRating ?? 0).toFixed(1)} ({p.totalReviews ?? 0})
                              </dd>
                            </div>
                            <div className="inline-flex items-center gap-1.5">
                              <Clock
                                className="size-3.5 text-muted"
                                strokeWidth={1.5}
                                aria-hidden="true"
                              />
                              <dt className="sr-only">Giờ mở cửa</dt>
                              <dd className="font-medium tabular-nums text-ink">
                                {p.operatingHours || "08:00 - 18:00"}
                              </dd>
                            </div>
                            <div className="inline-flex items-center gap-1.5">
                              <Navigation
                                className="size-3.5 text-muted"
                                strokeWidth={1.5}
                                aria-hidden="true"
                              />
                              <dt className="sr-only">Khoảng cách ước tính</dt>
                              <dd className="font-medium tabular-nums text-ink">
                                {formatDistance(p.distanceKm)}
                              </dd>
                            </div>
                          </dl>

                          {matchedMat ? (
                            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-deep">
                              <Tag
                                className="size-3.5"
                                strokeWidth={1.5}
                                aria-hidden="true"
                              />
                              <span className="tabular-nums">
                                {matchedMat.categoryName.replace(/\s*\(.*\)/, "")}:{" "}
                                {formatVnd(matchedMat.pricePerKg)}/kg
                              </span>
                            </p>
                          ) : (
                            <p className="mt-1.5 text-[12px]">
                              {minPrice > 0 ? (
                                <>
                                  <span className="font-semibold tabular-nums text-ink">
                                    từ {formatVnd(minPrice)}/kg
                                  </span>
                                  <span className="text-muted">
                                    {" "}
                                    · {p.materials.length} loại phế liệu
                                  </span>
                                </>
                              ) : (
                                <span className="text-muted">
                                  {p.materials.length} loại phế liệu
                                </span>
                              )}
                            </p>
                          )}
                        </div>

                        <ChevronDown
                          className={`mt-0.5 size-4 shrink-0 text-muted transition-transform ${
                            isSelected ? "rotate-180" : ""
                          }`}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </div>
                    </button>

                    {isSelected && activePartner && (
                      <PartnerDetail
                        partner={activePartner}
                        highlightedCategory={category}
                        loadingDetail={loadingDetail}
                        handoverUrl={handoverUrl}
                        chatUrl={chatUrl}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

/* ---------------------------------------------------------------- Chi tiết cơ sở & bảng giá */

function PartnerDetail({
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
  const [reviewsSummary, setReviewsSummary] = useState<RecyclerReviewsSummaryDto | null>(null)
  const [reportBusyId, setReportBusyId] = useState<string | null>(null)
  const [reportFlash, setReportFlash] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    setReviewsSummary(null)
    setReportFlash("")
    void fetchRecyclerReviews(partner.id, { pageSize: 4 }, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted && res.success && res.data) {
          setReviewsSummary(res.data)
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [partner.id])

  const handleReportReview = async (reviewId: string) => {
    const reason = window.prompt("Nhập lý do báo cáo đánh giá vi phạm (tối thiểu 5 ký tự):")
    if (!reason || reason.trim().length < 5) return
    setReportBusyId(reviewId)
    setReportFlash("")
    try {
      await reportReview(reviewId, reason.trim())
      setReportFlash("Đã gửi báo cáo vi phạm đánh giá tới nhân viên kiểm duyệt.")
    } catch (err) {
      setReportFlash(
        err instanceof ApiError ? err.message : "Vui lòng đăng nhập để báo cáo đánh giá vi phạm.",
      )
    } finally {
      setReportBusyId(null)
    }
  }

  return (
    <div className="pr-5 pb-4 pl-14">
      <div className="border-t border-line-soft pt-3">
        {(partner.description || partner.representativeName || partner.contactPhone) && (
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
            <div className="min-w-0 flex-1">
              {partner.description && (
                <p className="text-xs leading-5 text-body">{partner.description}</p>
              )}
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
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
              >
                <Phone className="size-3.5" strokeWidth={1.5} />
                {partner.contactPhone}
              </a>
            )}
          </div>
        )}
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink">Bảng giá thu mua</p>
            {loadingDetail && <span className="text-[11px] text-muted">Đang cập nhật</span>}
          </div>

          <ul className="mt-1">
            {partner.materials.map((m) => {
              const isHighlighted =
                highlightedCategory !== "" &&
                m.categoryCode.toLowerCase() === highlightedCategory
              return (
                <li
                  key={m.categoryCode}
                  className={`flex items-baseline justify-between gap-3 border-b border-line-soft py-2 last:border-0 ${
                    isHighlighted ? "-mx-2 rounded-md bg-brand/10 px-2" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p
                      className={`text-[13px] ${
                        isHighlighted ? "font-semibold text-ink" : "font-medium text-ink"
                      }`}
                    >
                      {m.categoryName.replace(/\s*\(.*\)/, "")}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      Tối thiểu {m.minimumQuantityKg} kg
                      {m.collectionConditions ? ` · ${m.collectionConditions}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[13px] font-semibold tabular-nums ${
                      isHighlighted ? "text-brand-deep" : "text-ink"
                    }`}
                  >
                    {formatVnd(m.pricePerKg)}/kg
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link to={handoverUrl} className="btn-primary h-9 rounded-lg px-3 text-xs">
            Đặt lịch bàn giao
          </Link>
          <Link to={chatUrl} className="btn-outline h-9 rounded-lg px-3 text-xs">
            Nhắn thương lượng
          </Link>
        </div>
      </div>

      <div className="border-t border-line-soft pt-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold tracking-wide text-ink uppercase">
            Đánh giá từ người dân (U-10)
          </h3>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
            ★ {(reviewsSummary?.averageRating ?? partner.averageRating ?? 0).toFixed(2)} (
            {reviewsSummary?.totalReviews ?? partner.totalReviews ?? 0} lượt)
          </span>
        </div>

        {reportFlash && (
          <p className="mt-2 rounded-lg bg-surface px-2.5 py-1.5 text-[11px] font-medium text-brand-deep">
            {reportFlash}
          </p>
        )}

        {reviewsSummary && reviewsSummary.reviews.items.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {reviewsSummary.reviews.items.map((rv) => (
              <li key={rv.reviewId} className="rounded-lg border border-line-soft bg-white p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">
                    {rv.reviewerDisplayName} ·{" "}
                    <span className="text-amber-700">{"★".repeat(rv.ratingStars)}</span>
                  </span>
                  <button
                    type="button"
                    disabled={reportBusyId === rv.reviewId}
                    onClick={() => void handleReportReview(rv.reviewId)}
                    className="text-[11px] text-muted hover:text-warn hover:underline"
                  >
                    Báo cáo vi phạm
                  </button>
                </div>
                {rv.comment && <p className="mt-1 text-body">{rv.comment}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted">
            Chưa có nhận xét nào hiển thị cho cơ sở này.
          </p>
        )}
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
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
    >
      <div>
        <p className="text-sm font-medium text-ink">
          Không có cơ sở trong {radiusKm} km
        </p>
        <p className="mt-1 text-xs leading-5 text-body">
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
            Mở rộng lên {expanded} km
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
        <div className="rounded-lg bg-surface-2 p-3.5 text-xs leading-5">
          <p className="font-medium text-ink">
            Thùng rác công cộng cho {guide.categoryName}
          </p>
          <p className="mt-1 text-body">
            Màu quy định:{" "}
            <span className="font-medium text-ink">{guide.standardBinColor}</span>
          </p>
          {prepSteps.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-body">
              {prepSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
          {guide.hazardWarning && (
            <p className="mt-1.5 text-warn">{guide.hazardWarning}</p>
          )}
        </div>
      )}

      {(fallback?.allowCommunityPickupPost ?? true) && (
        <div className="rounded-lg border border-line p-3.5 text-xs">
          <p className="font-medium text-ink">Đăng yêu cầu chờ đối tác nhận đơn</p>
          <p className="mt-0.5 text-body">
            Bạn vẫn có thể tạo lịch hẹn trước; cơ sở quanh khu vực sẽ nhận thông báo khi mở cửa.
          </p>
          <Link to="/user/handover" className="btn-outline mt-2.5 h-9 px-3.5 text-xs">
            Tạo yêu cầu thu gom trước
          </Link>
        </div>
      )}
    </div>
  )
}

