import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { BadgeCheck, ChevronDown, Clock, List, Map as MapIcon, MapPin, Navigation, Phone, Search, ShieldCheck, Tag, User, X } from "lucide-react"
import FacilityPhotoCard, { resolveFacilityPhotoSrc } from "@/components/FacilityPhotoCard"
import ShinyText from "@/components/ShinyText"
import LeafletRecyclerMap, {
  type SearchCoordinateSource,
} from "@/components/LeafletRecyclerMap"
import { ApiError } from "@/lib/api"
import {
  filterAreaPresets,
  requestBrowserGeolocation,
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
  isPartnerOnline,
  LOCATION_PRESETS,
  RADIUS_OPTIONS,
  searchNearbyRecyclers,
  type CollectionPartnerDto,
  type DiscoverableCategory,
  type DiscoveryFallbackSuggestionDto,
  type LocationPreset,
  type RecyclerSortBy,
} from "@/lib/recyclerDiscoveryApi"
import { fetchWasteCategories, getCategoryMeta, parsePreparationSteps } from "@/lib/wasteScanApi"
import { applyOfflineWorkflowToPartners } from "@/lib/recyclerWorkflowApi"
import {
  fetchRecyclerReviews,
  reportReview,
  type RecyclerReviewsSummaryDto,
} from "@/lib/reviewComplaintApi"
import { isSsrSmokeTest } from "@/lib/hydration"
import { maskPhoneForGuest, openAuthPopup } from "@/lib/popupAuth"
import { hasLiveBackendAuth, useSession } from "@/lib/session"

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
    facilityName: "Vựa phế liệu EcoGreen Hòa Lạc",
    representativeName: "Trần Thu Gom",
    address: "Số 18 Đại lộ Thăng Long, Khu CNC Hòa Lạc, Thạch Thất, Hà Nội",
    latitude: 21.0138,
    longitude: 105.5256,
    distanceKm: 0.16,
    contactPhone: "0988776655",
    operatingHours: "07:30 - 18:30",
    description: "Chuyên thu mua nhựa sạch, bìa carton và vỏ lon nhôm tận nơi quanh Khu CNC Hòa Lạc.",
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

function getPartnerPriceSummary(
  partner: CollectionPartnerDto,
  category: "" | DiscoverableCategory,
) {
  const matchedMat = category
    ? partner.materials.find((m) => m.categoryCode.toLowerCase() === category)
    : undefined
  const minPrice =
    partner.materials.length > 0
      ? Math.min(...partner.materials.map((m) => m.pricePerKg))
      : 0
  return { matchedMat, minPrice }
}

/** U-05 Tìm kiếm cơ sở thu gom theo vị trí địa lý trên bản đồ tương tác (Privacy-First Geocoding).
 *
 *  Kết nối trực tiếp với:
 *   - Bản đồ tương tác `Leaflet 1.9.4` + `CARTO Voyager` (`VITE_CARTO_API_KEY`)
 *   - Tìm kiếm 2 tầng: gợi ý tức thì bằng `LOCATION_PRESETS` khi gõ + `GET /api/v1/geocoding/search` khi nhấn Enter
 *   - Bảo mật vị trí `BR-MTH-05`: làm mờ toạ độ sang lưới `~500m` (`0.005°`) cho cả GPS, Click-to-Pin và địa chỉ tìm kiếm
 *   - `GET /api/v1/recyclers/nearby` & `GET /api/v1/recyclers/{recyclerId}` */
export default function MapPage() {
  const session = useSession()
  const isGuest = !session && !isSsrSmokeTest()
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
  const [activeCatCodes, setActiveCatCodes] = useState<Set<string> | null>(null)
  const [radiusKm, setRadiusKm] = useState<number>(10)
  const [keyword, setKeyword] = useState<string>("")
  const [debouncedKeyword, setDebouncedKeyword] = useState<string>("")
  const [sortBy, setSortBy] = useState<RecyclerSortBy>("distance")

  useEffect(() => {
    if (isSsrSmokeTest()) return
    let active = true
    fetchWasteCategories()
      .then((cats) => {
        if (!active) return
        setActiveCatCodes(new Set(cats.map((c) => c.code.toLowerCase())))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const visibleCategories = activeCatCodes
    ? DISCOVERY_CATEGORIES.filter((c) => c.value === "" || activeCatCodes.has(c.value))
    : DISCOVERY_CATEGORIES

  useEffect(() => {
    if (activeCatCodes && category && !activeCatCodes.has(category)) {
      setCategory("")
      const next = new URLSearchParams(searchParams)
      next.delete("category")
      setSearchParams(next, { replace: true })
    }
  }, [activeCatCodes, category, searchParams, setSearchParams])

  const [loading, setLoading] = useState<boolean>(false)
  const [isOfflineDemo, setIsOfflineDemo] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>("")
  const [partners, setPartners] = useState<CollectionPartnerDto[]>([])
  const [fallback, setFallback] = useState<DiscoveryFallbackSuggestionDto | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<CollectionPartnerDto | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)
  const [mobileView, setMobileView] = useState<"map" | "list">("map")
  const [mobileSheetOpen, setMobileSheetOpen] = useState<boolean>(false)
  const mobileMapSectionRef = useRef<HTMLElement | null>(null)

  const focusMobileMap = useCallback((partnerId?: string) => {
    if (partnerId) setSelectedId(partnerId)
    setMobileSheetOpen(false)
    // Đặt về đầu trang ngay trước khi ẩn danh sách dài để tránh trình duyệt tụt cuộn xuống footer
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      window.scrollTo(0, 0)
    }
    setMobileView("map")
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      requestAnimationFrame(() => {
        const el = mobileMapSectionRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const mapBottomDoc = rect.bottom + window.scrollY
        const usableBottom = window.innerHeight - 72
        if (mapBottomDoc > usableBottom) {
          window.scrollTo({
            top: Math.max(0, rect.top + window.scrollY - 72),
            behavior: "smooth",
          })
        }
      })
    }
  }, [])

  useEffect(() => {
    if (!selectedId) setMobileSheetOpen(false)
  }, [selectedId])

  // Khoá cuộn nền khi mở sheet khu vực hoặc chi tiết cơ sở trên mobile (< xl)
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 1280) return
    if (!showLocationPicker && !mobileSheetOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setMobileSheetOpen(false)
      setShowLocationPicker(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [showLocationPicker, mobileSheetOpen])

  // Khi mở một cơ sở trên desktop, đôn dòng đó lên đầu khung danh sách để detail chiếm trọn tầm nhìn
  const listScrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!selectedId) return
    const container = listScrollRef.current
    if (!container || container.scrollHeight <= container.clientHeight) return
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
  const requestBrowserGps = useCallback(async () => {
    setLocatingGps(true)
    setGpsStatusMsg("")
    const res = await requestBrowserGeolocation(!privacyMode)
    setLocatingGps(false)
    if (res.ok) {
      setRawAnchor({
        rawLat: res.lat,
        rawLng: res.lng,
        label: "Khu vực quanh vị trí hiện tại của bạn",
        source: "gps",
      })
      setShowLocationPicker(false)
      return
    }
    setGpsStatusMsg(res.message)
  }, [privacyMode])

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
        const liveError = hasLiveBackendAuth() || (err instanceof ApiError && !err.isNetworkError)
        if (liveError) {
          setIsOfflineDemo(false)
          setPartners([])
          setFallback(null)
          setSelectedId(null)
          setErrorMsg(
            err instanceof Error
              ? err.message
              : "Không thể tải danh sách cơ sở thu mua gần bạn từ máy chủ.",
          )
          return
        }
        // Dự phòng chỉ dành cho chế độ Offline Demo khi chưa đăng nhập Backend và mất kết nối mạng:
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
  const activePartnerIndex = activePartner
    ? partners.findIndex((p) => p.id === activePartner.id)
    : -1
  const activePartnerPrice = useMemo(
    () => (activePartner ? getPartnerPriceSummary(activePartner, category) : null),
    [activePartner, category],
  )
  const mobileExpandedRadius =
    fallback?.suggestedExpandedRadiusKm && fallback.suggestedExpandedRadiusKm > radiusKm
      ? fallback.suggestedExpandedRadiusKm
      : Math.min(50, Math.round(radiusKm * 2.5))

  const handoverUrl = useMemo(() => {
    const p = new URLSearchParams()
    p.set("newHandover", "1")
    if (activePartner) {
      p.set("partnerId", activePartner.id)
      p.set("partnerName", activePartner.facilityName)
    }
    if (category) {
      p.set("waste", getCategoryMeta(category).handoverWasteId)
    }
    return `/chat?${p.toString()}`
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
    <div className="flex flex-col gap-2 p-2.5 sm:gap-2.5 sm:p-3 md:p-4 xl:h-[calc(100dvh-76px)] xl:flex-row xl:gap-3 xl:pb-4">
      {/* Thanh điều khiển gọn cho Mobile/Tablet (< xl): chọn khu vực, lọc phế liệu 1 hàng, chuyển Bản đồ / Danh sách */}
      <div className="flex shrink-0 flex-col gap-1.5 rounded-2xl border border-line bg-surface p-2 shadow-2xs xl:hidden">
        <button
          type="button"
          onClick={() => setShowLocationPicker(true)}
          aria-expanded={showLocationPicker}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2/60 px-2.5 py-1.5 text-left transition-colors active:scale-[0.99] active:bg-surface-2"
        >
          <MapPin className="size-4 shrink-0 text-brand" strokeWidth={1.6} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{coords.label}</p>
            <p className="truncate text-xs text-muted">
              Bán kính {radiusKm} km · {privacyMode ? "Ẩn vị trí ~500m" : "Vị trí chính xác"}
            </p>
          </div>
          <span className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg bg-brand-deep px-2.5 text-[13px] font-semibold text-white">
            Đổi
            <ChevronDown className="size-3.5" strokeWidth={1.6} aria-hidden="true" />
          </span>
        </button>

        <div
          role="group"
          aria-label="Lọc theo loại phế liệu"
          className="no-scrollbar -mx-0.5 flex items-center gap-1.5 overflow-x-auto px-0.5 py-0.5"
        >
          {visibleCategories.map((c) => {
            const on = category === c.value
            const short = CATEGORY_SHORT[c.value] ?? c.label.replace(/\s*\(.*\)/, "")
            return (
              <button
                key={c.value || "all"}
                type="button"
                onClick={() => changeCategory(c.value)}
                aria-pressed={on}
                title={c.label.replace(/\s*\(.*\)/, "")}
                className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-all active:scale-[0.97] ${
                  on
                    ? "border-brand-deep bg-brand-deep font-semibold text-white shadow-xs"
                    : "border-line bg-surface-2/60 font-medium text-body hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {short}
              </button>
            )
          })}
        </div>

        <div
          role="tablist"
          aria-label="Chế độ xem điểm thu gom"
          className="grid grid-cols-2 gap-1 rounded-xl border border-line-soft bg-surface-2/80 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === "map"}
            onClick={() => focusMobileMap()}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-[13px] transition-all ${
              mobileView === "map"
                ? "bg-surface font-semibold text-brand-deep shadow-xs ring-1 ring-black/5"
                : "font-medium text-body hover:text-ink"
            }`}
          >
            <MapIcon className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
            Bản đồ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === "list"}
            onClick={() => setMobileView("list")}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-[13px] transition-all ${
              mobileView === "list"
                ? "bg-surface font-semibold text-brand-deep shadow-xs ring-1 ring-black/5"
                : "font-medium text-body hover:text-ink"
            }`}
          >
            <List className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
            Danh sách ({loading ? "…" : partners.length})
          </button>
        </div>

        {gpsStatusMsg && (
          <p
            role="status"
            data-message-code="MSG-MTH-02"
            className="rounded-xl border border-warn/30 bg-warn/5 px-3 py-2 text-sm leading-6 text-warn"
          >
            {gpsStatusMsg}
          </p>
        )}
      </div>

      {/* Cột trái: khung bản đồ tương tác + tra cứu khu vực + bảo mật vị trí ~500m (tỷ lệ dọc trên mobile < xl) */}
      <section
        ref={mobileMapSectionRef}
        className={`relative aspect-[3/4] min-h-[max(480px,calc(100dvh-332px))] w-full shrink-0 flex-col overflow-clip rounded-2xl border border-line bg-surface-3 md:aspect-[4/5] md:min-h-[620px] lg:aspect-auto lg:h-[calc(100dvh-250px)] lg:min-h-[540px] xl:flex xl:h-full xl:min-h-[520px] xl:flex-1 ${
          mobileView === "map" ? "flex" : "hidden"
        }`}
      >
        <div className="relative h-full w-full flex-1">
          <LeafletRecyclerMap
            centerLat={rawAnchor.rawLat}
            centerLng={rawAnchor.rawLng}
            radiusKm={radiusKm}
            privacyMode={privacyMode}
            source={rawAnchor.source}
            partners={partners}
            selectedPartnerId={activePartner?.id ?? null}
            locatingGps={locatingGps}
            onSelectPartner={(id) => setSelectedId(id)}
            onMapPinClick={handleMapPinClick}
            onRequestGps={requestBrowserGps}
          />

          {/* Nhãn dữ liệu mẫu gọn trên bản đồ mobile khi Backend offline */}
          {isOfflineDemo && (
            <span className="pointer-events-none absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/92 px-2.5 py-1 text-xs font-medium text-muted shadow-2xs backdrop-blur-md xl:hidden">
              <span className="size-1.5 rounded-full bg-warn" />
              Dữ liệu mẫu
            </span>
          )}

          {/* Gợi ý thao tác ngắn trên mobile khi chưa chọn ghim */}
          {!activePartner && !loading && partners.length > 0 && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[calc(100%-4.5rem)] xl:hidden">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/92 px-3 py-1.5 text-xs font-medium text-body shadow-2xs backdrop-blur-md">
                <span className="size-1.5 shrink-0 rounded-full bg-brand" />
                <span className="truncate">Chạm ghim số xem giá · Chạm bản đồ dời tâm</span>
              </span>
            </div>
          )}

          {/* Thẻ xem nhanh cơ sở ở đáy bản đồ mobile khi chạm ghim */}
          {activePartner && !mobileSheetOpen && (
            <div className="absolute inset-x-3 bottom-3 z-30 rounded-2xl border border-line bg-surface/98 p-3.5 shadow-[0_12px_32px_rgba(15,31,21,0.16)] backdrop-blur-md xl:hidden">
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => setMobileSheetOpen(true)}
                  aria-label={`Xem chi tiết và ảnh kho bãi ${activePartner.facilityName}`}
                  className="group relative mt-0.5 size-14 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-3 ring-1 ring-black/5 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <img
                    key={activePartner.id}
                    src={resolveFacilityPhotoSrc(
                      activePartner.id,
                      activePartner.businessPhotoUrl,
                      activePartner.facilityName,
                    )}
                    alt={`Ảnh thực tế mặt tiền ${activePartner.facilityName}`}
                    onError={(e) => {
                      if (e.currentTarget.dataset.fallback) return
                      e.currentTarget.dataset.fallback = "1"
                      e.currentTarget.src = resolveFacilityPhotoSrc(
                        activePartner.id,
                        null,
                        activePartner.facilityName,
                      )
                    }}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute top-1 left-1 grid size-5 place-items-center rounded-full bg-brand-deep/90 text-[10px] font-bold tabular-nums text-white ring-1 ring-white/50">
                    {activePartnerIndex >= 0 ? activePartnerIndex + 1 : "•"}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm leading-5 font-semibold text-ink">
                      {activePartner.facilityName}
                    </p>
                    {activePartner.hasVerifiedBadge && (
                      <BadgeCheck
                        className="size-4 shrink-0 text-brand"
                        strokeWidth={1.6}
                        aria-label="Đã xác minh"
                      />
                    )}
                    {activePartner.isFeatured && (
                      <span className="inline-flex shrink-0 items-center rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand-deep">
                        Đối tác Pro
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[13px] leading-5 text-muted">{activePartner.address}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                    <OnlineStatusBadge online={isPartnerOnline(activePartner)} />
                    <span className="inline-flex items-center gap-1 font-medium tabular-nums text-ink">
                      <Clock className="size-3.5 text-muted" strokeWidth={1.5} aria-hidden="true" />
                      {activePartner.operatingHours || "08:00 - 18:00"}
                    </span>
                    <span className="font-semibold tabular-nums text-amber-700">
                      ★ {(activePartner.averageRating ?? 0).toFixed(1)} ({activePartner.totalReviews ?? 0})
                    </span>
                    <span className="font-medium tabular-nums text-ink">
                      {formatDistance(activePartner.distanceKm)}
                    </span>
                  </div>
                  {activePartnerPrice && (
                    <p className="mt-1 text-[13px] font-semibold tabular-nums text-brand-deep">
                      {activePartnerPrice.matchedMat
                        ? `${activePartnerPrice.matchedMat.categoryName.replace(/\s*\(.*\)/, "")}: ${formatVnd(activePartnerPrice.matchedMat.pricePerKg)}/kg`
                        : activePartnerPrice.minPrice > 0
                          ? `từ ${formatVnd(activePartnerPrice.minPrice)}/kg · ${activePartner.materials.length} loại phế liệu`
                          : `${activePartner.materials.length} loại phế liệu`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Đóng thẻ xem nhanh"
                  className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-4" strokeWidth={1.7} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMobileSheetOpen(true)}
                  className="btn-outline min-h-10 rounded-xl px-2 text-[13px] font-semibold min-[360px]:px-3"
                >
                  Xem bảng giá
                </button>
                <Link
                  to={chatUrl}
                  onClick={(e) => {
                    if (isGuest) {
                      e.preventDefault()
                      openAuthPopup("login")
                    }
                  }}
                  className="btn-primary min-h-10 rounded-xl px-2 text-[13px] font-semibold min-[360px]:px-3"
                >
                  Nhắn thương lượng
                </Link>
              </div>
            </div>
          )}

          {/* Phương án dự phòng gọn trên bản đồ mobile khi không có cơ sở trong bán kính */}
          {!activePartner && !loading && partners.length === 0 && (
            <div className="absolute inset-x-3 bottom-3 z-30 rounded-2xl border border-line bg-surface/98 p-3.5 shadow-[0_12px_32px_rgba(15,31,21,0.16)] backdrop-blur-md xl:hidden">
              <p className="text-sm font-semibold text-ink">
                Không có cơ sở trong {radiusKm} km
              </p>
              <p className="mt-0.5 text-sm leading-6 text-muted">
                Thử mở rộng bán kính hoặc xem hướng dẫn phân loại.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {radiusKm < 50 && (
                  <button
                    type="button"
                    onClick={() => setRadiusKm(mobileExpandedRadius)}
                    className="btn-primary min-h-10 flex-1 rounded-xl px-3 text-[13px] font-semibold"
                  >
                    Mở rộng {mobileExpandedRadius} km
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="btn-outline min-h-10 flex-1 rounded-xl px-3 text-[13px] font-semibold"
                >
                  Xem hướng dẫn
                </button>
              </div>
            </div>
          )}

          {/* Thanh điều khiển gọn trên bản đồ Desktop (xl+): khu vực, quyền riêng tư và bán kính */}
          <div className="pointer-events-none absolute inset-x-4 top-4 z-30 hidden flex-col gap-2 xl:flex">
            <div className="pointer-events-auto flex flex-wrap items-start gap-2">
              <div className="flex min-w-[280px] flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface/95 px-3 py-2 shadow-sm backdrop-blur-md">
                <MapPin className="size-4 shrink-0 text-brand" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{coords.label}</p>
                  <p className="truncate text-[13px] text-muted">
                    {coordinateSourceLabel} · {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPrivacyMode((v) => !v)}
                  data-message-code="BR-MTH-05"
                  aria-pressed={privacyMode}
                  title="Khi bật, toạ độ GPS và điểm bấm bản đồ được làm tròn sang lưới ~500m trước khi gửi đi"
                  className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-semibold transition-colors ${
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
                  className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-brand-deep px-3 text-[13px] font-semibold text-white transition-colors hover:bg-brand"
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
                <span className="px-2 text-[13px] text-muted">Bán kính</span>
                {radiusChoices.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadiusKm(r)}
                    aria-pressed={radiusKm === r}
                    className={`min-h-9 rounded-lg px-2.5 text-[13px] font-semibold tabular-nums transition-colors ${
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

            {/* Hộp thoại tra cứu khu vực trên Desktop: gợi ý nội bộ 0ms + Nominatim khi nhấn Enter */}
            {showLocationPicker && (
              <div className="pointer-events-auto max-h-[400px] overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-lg">
                <LocationPickerBody
                  placeQuery={placeQuery}
                  onPlaceQueryChange={(val) => {
                    setPlaceQuery(val)
                    if (placeSearchNotice) setPlaceSearchNotice("")
                  }}
                  onPlaceSubmit={handlePlaceSubmit}
                  searchingPlaces={searchingPlaces}
                  placeSearchNotice={placeSearchNotice}
                  remoteSuggestions={remoteSuggestions}
                  placeAttribution={placeAttribution}
                  instantPresets={instantPresets}
                  rawAnchor={rawAnchor}
                  locatingGps={locatingGps}
                  onRequestGps={requestBrowserGps}
                  onSelectLocation={(rawLat, rawLng, label, source) => {
                    setRawAnchor({ rawLat, rawLng, label, source })
                    setGpsStatusMsg("")
                    setShowLocationPicker(false)
                  }}
                />
              </div>
            )}

            {gpsStatusMsg && (
              <p
                role="status"
                data-message-code="MSG-MTH-02"
                className="pointer-events-auto rounded-xl border border-warn/30 bg-surface px-3 py-2 text-sm leading-6 text-warn"
              >
                {gpsStatusMsg}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Cột phải: danh sách cơ sở đã xác minh, mở rộng tại chỗ để xem bảng giá */}
      <section
        className={`w-full shrink-0 flex-col overflow-clip rounded-2xl border border-line bg-surface xl:flex xl:h-full xl:w-[460px] ${
          mobileView === "list" ? "flex" : "hidden"
        }`}
      >
        <header className="shrink-0 border-b border-line px-4 pt-3.5 pb-3 xl:px-5 xl:pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg leading-6 font-semibold text-ink xl:text-[19px]">
                Cơ sở thu mua gần bạn
              </h1>
              <p className="mt-0.5 text-sm leading-5 text-muted xl:mt-1">Đã xác minh và đang mở cửa nhận đơn</p>
            </div>
            <span className="shrink-0 pt-0.5 text-[13px] tabular-nums text-muted">
              {loading ? "Đang tìm" : `${partners.length} cơ sở`}
            </span>
          </div>

          <div
            role="group"
            aria-label="Lọc theo loại phế liệu"
            className="mt-2.5 hidden flex-wrap gap-1.5 xl:flex"
          >
            {visibleCategories.map((c) => {
              const on = category === c.value
              const short = CATEGORY_SHORT[c.value] ?? c.label.replace(/\s*\(.*\)/, "")
              return (
                <button
                  key={c.value || "all"}
                  type="button"
                  onClick={() => changeCategory(c.value)}
                  aria-pressed={on}
                  title={c.label.replace(/\s*\(.*\)/, "")}
                  className={`min-h-9 flex-1 min-w-[64px] truncate rounded-lg px-2 text-[13px] transition-colors ${
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

          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row xl:mt-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                strokeWidth={1.5}
              />
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tên cơ sở hoặc đường, quận"
                aria-label="Lọc tên cơ sở hoặc địa chỉ"
                className="min-h-11 w-full rounded-xl border border-sage-line bg-surface pr-3 pl-9 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none sm:text-[15px]"
              />
            </div>
            <select
              aria-label="Sắp xếp kết quả"
              value={!category && sortBy === "price_desc" ? "distance" : sortBy}
              onChange={(e) => setSortBy(e.target.value as RecyclerSortBy)}
              title="Chọn tiêu chí sắp xếp"
              className="min-h-11 shrink-0 rounded-xl border border-sage-line bg-surface px-3 text-base font-medium text-ink focus:border-brand focus:outline-none sm:text-[15px]"
            >
              <option value="distance">Gần nhất</option>
              <option value="rating_desc">Đánh giá cao nhất</option>
              {category && <option value="price_desc">Giá cao nhất</option>}
            </select>
          </div>

          {isOfflineDemo && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-warn" />
              Đang hiển thị dữ liệu mẫu vì máy chủ chưa phản hồi
            </p>
          )}
        </header>

        <div ref={listScrollRef} className="xl:flex-1 xl:overflow-y-auto">
          {errorMsg && (
            <div
              role="alert"
              className="m-4 rounded-xl border border-warn/30 bg-warn/5 p-3.5 text-sm leading-6 text-warn"
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
                const { matchedMat, minPrice } = getPartnerPriceSummary(p, category)

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
                      className="w-full px-4 py-3.5 text-left transition-colors hover:bg-mint/10 xl:px-5 xl:py-3"
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
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 xl:flex-nowrap">
                            <span className="line-clamp-2 text-sm leading-5 font-semibold text-ink xl:line-clamp-none xl:truncate">
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
                          <p className="mt-0.5 truncate text-[13px] leading-5 text-muted">{p.address}</p>

                          <dl className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                            <div className="inline-flex items-center">
                              <dt className="sr-only">Trạng thái hoạt động</dt>
                              <dd>
                                <OnlineStatusBadge online={isPartnerOnline(p)} />
                              </dd>
                            </div>
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
                            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep">
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
                            <p className="mt-1.5 text-sm">
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
                        onFocusOnMap={() => focusMobileMap(p.id)}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Bottom Sheet chọn khu vực, bán kính & ẩn vị trí ~500m trên Mobile/Tablet (< xl) */}
      {showLocationPicker && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chọn khu vực và bán kính tìm kiếm"
          onClick={() => setShowLocationPicker(false)}
          className="fixed inset-0 z-50 flex items-end bg-ink/45 backdrop-blur-[2px] xl:hidden"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-surface p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-line-soft pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Khu vực &amp; Bán kính</h2>
                <p className="text-[13px] text-muted">
                  {coordinateSourceLabel} · {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationPicker(false)}
                aria-label="Đóng bảng chọn khu vực"
                className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-body transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" strokeWidth={1.7} aria-hidden="true" />
              </button>
            </div>

            <LocationPickerBody
              placeQuery={placeQuery}
              onPlaceQueryChange={(val) => {
                setPlaceQuery(val)
                if (placeSearchNotice) setPlaceSearchNotice("")
              }}
              onPlaceSubmit={handlePlaceSubmit}
              searchingPlaces={searchingPlaces}
              placeSearchNotice={placeSearchNotice}
              remoteSuggestions={remoteSuggestions}
              placeAttribution={placeAttribution}
              instantPresets={instantPresets}
              rawAnchor={rawAnchor}
              locatingGps={locatingGps}
              onRequestGps={requestBrowserGps}
              onSelectLocation={(rawLat, rawLng, label, source) => {
                setRawAnchor({ rawLat, rawLng, label, source })
                setGpsStatusMsg("")
                setShowLocationPicker(false)
              }}
              mobileExtras={
                <div className="mb-4 flex flex-col gap-3">
                  <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">Ẩn vị trí chính xác (~500m)</p>
                      <p className="text-sm leading-5 text-muted">
                        Làm tròn GPS &amp; điểm chấm trước khi gửi đi
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrivacyMode((v) => !v)}
                      data-message-code="BR-MTH-05"
                      aria-pressed={privacyMode}
                      className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors ${
                        privacyMode
                          ? "border-brand/40 bg-brand-deep text-white"
                          : "border-line bg-surface text-body"
                      }`}
                    >
                      <ShieldCheck className="size-3.5" strokeWidth={1.6} aria-hidden="true" />
                      {privacyMode ? "Đang bật" : "Đang tắt"}
                    </button>
                  </div>

                  <div>
                    <p className="mb-1.5 text-sm font-semibold text-ink">Bán kính tìm kiếm</p>
                    <div role="group" aria-label="Bán kính tìm kiếm" className="grid grid-cols-4 gap-2">
                      {radiusChoices.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRadiusKm(r)}
                          aria-pressed={radiusKm === r}
                          className={`min-h-11 rounded-xl border text-sm font-semibold tabular-nums transition-colors ${
                            radiusKm === r
                              ? "border-brand-deep bg-brand-deep text-white shadow-xs"
                              : "border-line bg-surface text-ink hover:bg-surface-2"
                          }`}
                        >
                          {r} km
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* Bottom Sheet chi tiết bảng giá & đặt lịch khi mở từ ghim bản đồ Mobile */}
      {mobileSheetOpen && activePartner && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Chi tiết ${activePartner.facilityName}`}
          onClick={() => setMobileSheetOpen(false)}
          className="fixed inset-0 z-50 flex items-end bg-ink/45 backdrop-blur-[2px] xl:hidden"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[86dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-surface pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur-md">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-deep text-[11px] font-semibold tabular-nums text-white">
                  {activePartnerIndex >= 0 ? activePartnerIndex + 1 : "•"}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="text-sm leading-5 font-semibold text-ink">
                      {activePartner.facilityName}
                    </h2>
                    {activePartner.hasVerifiedBadge && (
                      <BadgeCheck className="size-4 shrink-0 text-brand" strokeWidth={1.6} aria-label="Đã xác minh" />
                    )}
                    {activePartner.isFeatured && (
                      <span className="inline-flex shrink-0 items-center rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand-deep">
                        Đối tác Pro
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                    <OnlineStatusBadge online={isPartnerOnline(activePartner)} />
                    <span className="inline-flex items-center gap-1 font-medium tabular-nums text-ink">
                      <Clock className="size-3.5 text-muted" strokeWidth={1.5} aria-hidden="true" />
                      {activePartner.operatingHours || "08:00 - 18:00"}
                    </span>
                    <span className="font-semibold tabular-nums text-amber-700">
                      ★ {(activePartner.averageRating ?? 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                aria-label="Đóng chi tiết cơ sở"
                className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-body transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" strokeWidth={1.7} aria-hidden="true" />
              </button>
            </div>

            <div className="pt-2">
              <PartnerDetail
                partner={activePartner}
                highlightedCategory={category}
                loadingDetail={loadingDetail}
                handoverUrl={handoverUrl}
                chatUrl={chatUrl}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Chi tiết cơ sở & bảng giá */

function OnlineStatusBadge({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        online
          ? "border-brand/25 bg-brand/10 text-brand-deep"
          : "border-line bg-surface-2 text-muted"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${online ? "bg-brand" : "bg-muted"}`}
      />
      {online ? "Đang online" : "Offline"}
    </span>
  )
}

function PartnerDetail({
  partner,
  highlightedCategory,
  loadingDetail,
  handoverUrl,
  chatUrl,
  onFocusOnMap,
}: {
  partner: CollectionPartnerDto
  highlightedCategory: "" | DiscoverableCategory
  loadingDetail: boolean
  handoverUrl: string
  chatUrl: string
  onFocusOnMap?: () => void
}) {
  const session = useSession()
  const isGuest = !session && !isSsrSmokeTest()
  const [reviewsSummary, setReviewsSummary] = useState<RecyclerReviewsSummaryDto | null>(null)
  const [reportBusyId, setReportBusyId] = useState<string | null>(null)
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState("")
  const [reportErr, setReportErr] = useState("")
  const [reportFlash, setReportFlash] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    setReviewsSummary(null)
    setReportFlash("")
    setReportingReviewId(null)
    setReportReason("")
    setReportErr("")
    void fetchRecyclerReviews(partner.id, { pageSize: 4 }, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted && res.success && res.data) {
          setReviewsSummary(res.data)
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [partner.id])

  const openReportForm = (reviewId: string) => {
    if (isGuest) {
      openAuthPopup("login")
      return
    }
    setReportingReviewId((prev) => (prev === reviewId ? null : reviewId))
    setReportReason("")
    setReportErr("")
    setReportFlash("")
  }

  const submitReportReview = async (e: React.FormEvent, reviewId: string) => {
    e.preventDefault()
    if (reportBusyId) return
    const clean = reportReason.trim()
    if (clean.length < 5) {
      setReportErr("Lý do báo cáo đánh giá vi phạm cần tối thiểu 5 ký tự.")
      return
    }
    if (clean.length > 500) {
      setReportErr("Lý do báo cáo đánh giá không được vượt quá 500 ký tự.")
      return
    }
    setReportBusyId(reviewId)
    setReportErr("")
    setReportFlash("")
    try {
      await reportReview(reviewId, clean)
      setReportFlash("Đã gửi báo cáo vi phạm đánh giá tới nhân viên kiểm duyệt.")
      setReportingReviewId(null)
      setReportReason("")
    } catch (err) {
      setReportErr(
        err instanceof ApiError ? err.message : "Vui lòng đăng nhập để báo cáo đánh giá vi phạm.",
      )
    } finally {
      setReportBusyId(null)
    }
  }

  return (
    <div className="px-4 pb-4 xl:pr-5 xl:pl-14">
      <div className="border-t border-line-soft pt-3">
        <FacilityPhotoCard
          facilityName={partner.facilityName}
          address={partner.address}
          photoUrl={partner.businessPhotoUrl}
          partnerKey={partner.id}
          variant="detail"
          className="mb-3.5"
        />

        {/* Khối Vị trí cơ sở: rộng 100%, hiển thị trọn vẹn địa chỉ và khoảng cách trên mobile lẫn desktop */}
        <div className="rounded-xl border border-line bg-surface-2/65 p-3">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-brand/20 bg-brand/10 text-brand-deep"
            >
              <MapPin className="size-3.5" strokeWidth={1.7} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="text-xs font-semibold tracking-wide text-brand-deep uppercase">
                  Vị trí cơ sở
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">
                  <Navigation className="size-3 text-brand" strokeWidth={1.6} aria-hidden="true" />
                  {formatDistance(partner.distanceKm)}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 font-medium text-ink [overflow-wrap:anywhere]">
                {partner.address}
              </p>
              {onFocusOnMap && (
                <button
                  type="button"
                  onClick={onFocusOnMap}
                  className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-brand-deep transition-colors hover:bg-surface-2 xl:hidden"
                >
                  <MapPin className="size-3.5 shrink-0" strokeWidth={1.6} aria-hidden="true" />
                  Xem trên bản đồ
                </button>
              )}
            </div>
          </div>
        </div>

        {(partner.description || partner.representativeName || partner.contactPhone) && (
          <div className="mt-2.5 flex flex-col gap-2.5 rounded-xl border border-line bg-white p-3">
            {partner.description && (
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Giới thiệu cơ sở
                </p>
                <p className="mt-1 text-sm leading-6 text-body [overflow-wrap:anywhere]">
                  {partner.description}
                </p>
              </div>
            )}
            {(partner.representativeName || partner.contactPhone) && (
              <div
                className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ${
                  partner.description ? "border-t border-line-soft pt-2.5" : ""
                }`}
              >
                {partner.representativeName && (
                  <p className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted">
                    <User className="size-3.5 shrink-0 text-brand" strokeWidth={1.6} aria-hidden="true" />
                    <span className="[overflow-wrap:anywhere]">
                      Đại diện:{" "}
                      <strong className="font-semibold text-ink">
                        {partner.representativeName}
                      </strong>
                    </span>
                  </p>
                )}
                {partner.contactPhone && (
                  isGuest ? (
                    <button
                      type="button"
                      onClick={() => openAuthPopup("login")}
                      title="Đăng nhập để xem đầy đủ và liên hệ cơ sở thu mua"
                      className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-2 min-[430px]:w-auto sm:min-h-9"
                    >
                      <Phone className="size-3.5 shrink-0 text-brand" strokeWidth={1.6} />
                      <span>{maskPhoneForGuest(partner.contactPhone)} · Đăng nhập</span>
                    </button>
                  ) : (
                    <a
                      href={`tel:${partner.contactPhone}`}
                      title={`Gọi ${partner.contactPhone}`}
                      className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-2 min-[430px]:w-auto sm:min-h-9"
                    >
                      <Phone className="size-3.5 shrink-0 text-brand" strokeWidth={1.6} />
                      <span className="tabular-nums">{partner.contactPhone}</span>
                    </a>
                  )
                )}
              </div>
            )}
          </div>
        )}
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Bảng giá thu mua</p>
            {loadingDetail && <span className="text-xs text-muted">Đang cập nhật</span>}
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
                      className={`text-sm ${
                        isHighlighted ? "font-semibold text-ink" : "font-medium text-ink"
                      }`}
                    >
                      {m.categoryName.replace(/\s*\(.*\)/, "")}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-muted">
                      Tối thiểu {m.minimumQuantityKg} kg
                      {m.collectionConditions ? ` · ${m.collectionConditions}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
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

        <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
          <Link
            to={handoverUrl}
            onClick={(e) => {
              if (isGuest) {
                e.preventDefault()
                openAuthPopup("login")
              }
            }}
            className="btn-primary min-h-11 rounded-xl px-3 text-sm font-semibold sm:min-h-9"
          >
            Đặt lịch bàn giao
          </Link>
          <Link
            to={chatUrl}
            onClick={(e) => {
              if (isGuest) {
                e.preventDefault()
                openAuthPopup("login")
              }
            }}
            className="btn-outline min-h-11 rounded-xl px-3 text-sm font-semibold sm:min-h-9"
          >
            Nhắn thương lượng
          </Link>
        </div>
      </div>

      <div className="mt-3 border-t border-line-soft pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold tracking-wide text-ink uppercase">
            Đánh giá từ người dân (U-10)
          </h3>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
            ★ {(reviewsSummary?.averageRating ?? partner.averageRating ?? 0).toFixed(2)} (
            {reviewsSummary?.totalReviews ?? partner.totalReviews ?? 0} lượt)
          </span>
        </div>

        {reportFlash && (
          <p role="status" className="mt-2 rounded-lg bg-surface px-2.5 py-1.5 text-sm leading-6 font-medium text-brand-deep">
            {reportFlash}
          </p>
        )}

        {reviewsSummary && reviewsSummary.reviews.items.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {reviewsSummary.reviews.items.map((rv) => (
              <li key={rv.reviewId} className="rounded-lg border border-line-soft bg-white p-2.5 text-sm leading-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink">
                    {rv.reviewerDisplayName} ·{" "}
                    <span className="text-amber-700">{"★".repeat(rv.ratingStars)}</span>
                  </span>
                  <button
                    type="button"
                    disabled={reportBusyId === rv.reviewId}
                    onClick={() => openReportForm(rv.reviewId)}
                    className="inline-flex min-h-10 items-center rounded-md px-2 text-[13px] font-semibold text-muted hover:text-warn hover:underline sm:min-h-9"
                  >
                    {reportingReviewId === rv.reviewId ? "Đóng" : "Báo cáo vi phạm"}
                  </button>
                </div>
                {rv.comment && <p className="mt-1 text-body">{rv.comment}</p>}
                {reportingReviewId === rv.reviewId && (
                  <form
                    noValidate
                    onSubmit={(e) => void submitReportReview(e, rv.reviewId)}
                    className="mt-2 flex flex-col gap-2 rounded-lg border border-warn/30 bg-surface-2 p-2.5"
                  >
                    <textarea
                      rows={2}
                      value={reportReason}
                      onChange={(e) => {
                        setReportReason(e.target.value)
                        setReportErr("")
                      }}
                      placeholder="Nhập lý do báo cáo đánh giá vi phạm (5–500 ký tự)..."
                      className="input min-h-12 h-auto py-2.5 text-base sm:text-[15px]"
                    />
                    {reportErr && (
                      <p role="alert" className="text-sm leading-6 font-medium text-warn">
                        {reportErr}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={reportBusyId === rv.reviewId}
                        className="btn-primary min-h-10 px-3.5 text-sm font-semibold sm:min-h-9"
                      >
                        {reportBusyId === rv.reviewId ? "Đang gửi..." : "Gửi báo cáo"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReportingReviewId(null)
                          setReportErr("")
                        }}
                        className="btn-ghost min-h-10 px-3.5 text-sm font-semibold sm:min-h-9"
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-sm leading-6 text-muted">
            Chưa có nhận xét nào hiển thị cho cơ sở này.
          </p>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Tra cứu khu vực dùng chung Desktop + Mobile Sheet */

function LocationPickerBody({
  placeQuery,
  onPlaceQueryChange,
  onPlaceSubmit,
  searchingPlaces,
  placeSearchNotice,
  remoteSuggestions,
  placeAttribution,
  instantPresets,
  rawAnchor,
  locatingGps,
  onRequestGps,
  onSelectLocation,
  mobileExtras,
}: {
  placeQuery: string
  onPlaceQueryChange: (val: string) => void
  onPlaceSubmit: (e: FormEvent) => void
  searchingPlaces: boolean
  placeSearchNotice: string
  remoteSuggestions: GeocodingSuggestionDto[]
  placeAttribution: string
  instantPresets: LocationPreset[]
  rawAnchor: { rawLat: number; rawLng: number }
  locatingGps: boolean
  onRequestGps: () => void
  onSelectLocation: (
    rawLat: number,
    rawLng: number,
    label: string,
    source: SearchCoordinateSource,
  ) => void
  mobileExtras?: ReactNode
}) {
  return (
    <div>
      {mobileExtras}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">Tra cứu theo khu vực</p>
          <p className="mt-0.5 text-sm leading-6 text-muted">
            Gõ tên Quận/Phường để chọn ngay, hoặc nhấn Enter để tìm chợ, đường
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestGps}
          disabled={locatingGps}
          className="btn-primary min-h-10 w-full px-3.5 text-[13px] font-semibold sm:min-h-9 sm:w-auto"
        >
          {locatingGps ? "Đang lấy GPS..." : "Dùng GPS hiện tại"}
        </button>
      </div>

      {/* Ô tìm kiếm địa danh (Submit-only cho Nominatim) */}
      <form noValidate onSubmit={onPlaceSubmit} className="mt-3 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            strokeWidth={1.5}
          />
          <input
            type="search"
            value={placeQuery}
            onChange={(e) => onPlaceQueryChange(e.target.value)}
            placeholder="Phường, Quận, Chợ hoặc Ngã tư"
            aria-label="Nhập tên phường, quận, chợ hoặc ngã tư"
            className="min-h-11 w-full rounded-xl border border-sage-line bg-surface pr-3 pl-9 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none sm:text-[15px]"
          />
        </div>
        <button
          type="submit"
          disabled={searchingPlaces}
          className="btn-outline min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold sm:min-h-9"
        >
          {searchingPlaces ? "Đang tìm..." : "Tìm địa danh"}
        </button>
      </form>

      {placeSearchNotice && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-sm leading-6 font-medium text-warn"
        >
          {placeSearchNotice}
        </p>
      )}

      {/* Kết quả từ Backend Geocoding Proxy (Nominatim / LocationIQ) sau khi nhấn Enter */}
      {remoteSuggestions.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink">Kết quả tra cứu</span>
            {placeAttribution && (
              <span className="text-xs text-muted">{placeAttribution}</span>
            )}
          </div>
          <div className="mt-1.5 divide-y divide-line-soft rounded-lg border border-line">
            {remoteSuggestions.map((item) => (
              <button
                key={item.placeId}
                type="button"
                onClick={() =>
                  onSelectLocation(
                    item.latitude,
                    item.longitude,
                    item.shortLabel || item.displayName,
                    "search",
                  )
                }
                className="block min-h-11 w-full px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
              >
                <span className="block text-sm font-medium text-ink">
                  {item.shortLabel}
                </span>
                <span className="block truncate text-[13px] text-muted">
                  {item.displayName}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tầng 1: Gợi ý khu vực tức thì (0 HTTP request) */}
      <div className="mt-3">
        <span className="text-sm font-medium text-muted">
          {placeQuery.trim()
            ? `Khu vực gợi ý (${instantPresets.length})`
            : "Khu vực phổ biến"}
        </span>
        {instantPresets.length === 0 ? (
          <p className="mt-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-sm leading-6 text-muted">
            Không khớp khu vực có sẵn. Nhấn Enter để tra cứu trên toàn quốc.
          </p>
        ) : (
          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {instantPresets.map((preset) => {
              const active =
                Math.abs(rawAnchor.rawLat - preset.lat) < 0.001 &&
                Math.abs(rawAnchor.rawLng - preset.lng) < 0.001
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    onSelectLocation(preset.lat, preset.lng, preset.address, "preset")
                  }
                  className={`min-h-11 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? "border-brand/40 bg-brand/10 text-brand-deep"
                      : "border-line-soft bg-surface hover:bg-surface-2"
                  }`}
                >
                  <span className="block truncate font-semibold">{preset.label}</span>
                  <span className="block truncate text-xs text-muted">
                    {preset.address}
                  </span>
                </button>
              )
            })}
          </div>
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
  const session = useSession()
  const isGuest = !session && !isSsrSmokeTest()
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
        <p className="text-sm font-semibold text-ink">
          Không có cơ sở trong {radiusKm} km
        </p>
        <p className="mt-1 text-sm leading-6 text-body">
          {fallback?.guidanceMessage ||
            "Không tìm thấy cơ sở thu mua rác gần bạn trong bán kính hiện tại. Bạn có thể mở rộng bán kính tìm kiếm hoặc xem hướng dẫn xử lý bên dưới."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {radiusKm < 50 && (
          <button
            type="button"
            onClick={() => onExpandRadius(expanded)}
            className="btn-primary min-h-10 px-4 text-sm font-semibold sm:min-h-9"
          >
            Mở rộng lên {expanded} km
          </button>
        )}
        {category && (
          <button
            type="button"
            onClick={onClearFilters}
            className="btn-ghost min-h-10 px-4 text-sm font-semibold sm:min-h-9"
          >
            Xem tất cả loại phế liệu
          </button>
        )}
      </div>

      {guide && (
        <div className="rounded-lg bg-surface-2 p-3.5 text-sm leading-6">
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
        <div className="rounded-lg border border-line p-3.5 text-sm leading-6">
          <p className="font-medium text-ink">Đăng yêu cầu chờ đối tác nhận đơn</p>
          <p className="mt-0.5 text-body">
            Bạn vẫn có thể tạo lịch hẹn trước; cơ sở quanh khu vực sẽ nhận thông báo khi mở cửa.
          </p>
          <Link
            to="/chat?newHandover=1"
            onClick={(e) => {
              if (isGuest) {
                e.preventDefault()
                openAuthPopup("login")
              }
            }}
            className="btn-outline mt-2.5 min-h-10 px-4 text-sm font-semibold sm:min-h-9"
          >
            Tạo yêu cầu thu gom trước
          </Link>
        </div>
      )}
    </div>
  )
}

