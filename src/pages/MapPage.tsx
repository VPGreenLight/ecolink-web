import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ApiError } from "@/lib/api"
import {
  DISCOVERY_CATEGORIES,
  formatDistance,
  formatVnd,
  getRecyclerPublicDetail,
  isDiscoverableCategory,
  LOCATION_PRESETS,
  projectPartnerPinPosition,
  RADIUS_OPTIONS,
  searchNearbyRecyclers,
  type CollectionPartnerDto,
  type DiscoverableCategory,
  type DiscoveryFallbackSuggestionDto,
  type RecyclerSortBy,
} from "@/lib/recyclerDiscoveryApi"
import { getCategoryMeta, parsePreparationSteps } from "@/lib/wasteScanApi"

/** Dữ liệu dự phòng chỉ dùng khi máy chủ Backend chưa được bật để người xem giao diện
 *  vẫn kiểm tra được luồng chọn pin, xem bảng giá và chuyển sang đặt lịch bàn giao. */
const OFFLINE_PARTNERS: CollectionPartnerDto[] = [
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
        categoryCode: "paper",
        categoryName: "Giấy báo & Tài liệu (Paper)",
        pricePerKg: 4500,
        minimumQuantityKg: 2,
        collectionConditions: "Giấy báo, tài liệu khô ráo, không dính dầu mỡ",
      },
      {
        categoryCode: "metal",
        categoryName: "Kim loại & Vỏ lon (Metal)",
        pricePerKg: 25000,
        minimumQuantityKg: 0.5,
        collectionConditions: "Vỏ lon nhôm, sắt vụn đã dốc sạch nước",
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
  {
    id: "11111111-1111-1111-1111-111111111111",
    facilityName: "Vựa Phế Liệu Xanh Quận 1",
    representativeName: "Nguyễn Văn Minh",
    address: "123 Nguyễn Thị Minh Khai, P. Bến Thành, Quận 1, TP.HCM",
    latitude: 10.7725,
    longitude: 106.692,
    distanceKm: 1.18,
    contactPhone: "0901234567",
    operatingHours: "08:00 - 18:00",
    materials: [
      {
        categoryCode: "plastic",
        categoryName: "Nhựa tái chế (Plastic)",
        pricePerKg: 6800,
        minimumQuantityKg: 1.5,
        collectionConditions: "Bóc nhãn rời nếu có",
      },
      {
        categoryCode: "glass",
        categoryName: "Chai lọ thủy tinh",
        pricePerKg: 2000,
        minimumQuantityKg: 5,
        collectionConditions: "Không lẫn mảnh kính cường lực",
      },
    ],
  },
]

/** U-05 Tìm kiếm cơ sở thu gom theo vị trí địa lý GPS (Location-Based Recycler Discovery).
 *
 *  Kết nối trực tiếp với:
 *   - `GET /api/v1/recyclers/nearby` (lọc theo toạ độ GPS, bán kính, loại rác từ AI, từ khoá, giá)
 *   - `GET /api/v1/recyclers/{recyclerId}` (xem hồ sơ công khai & bảng giá Active từ Module R-01/R-02)
 *   - Hiển thị phương án dự phòng 3 tầng `FallbackSuggestion` (`MSG-MTH-01`) khi bán kính không có người mua. */
export default function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCatParam = searchParams.get("category")
  const initialCat: "" | DiscoverableCategory = isDiscoverableCategory(initialCatParam)
    ? (initialCatParam.trim().toLowerCase() as DiscoverableCategory)
    : ""

  const [coords, setCoords] = useState({
    lat: LOCATION_PRESETS[0].lat,
    lng: LOCATION_PRESETS[0].lng,
    label: LOCATION_PRESETS[0].address,
    source: "preset" as "gps" | "preset",
  })
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string>("")
  const [locatingGps, setLocatingGps] = useState(false)

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

  // Đồng bộ nếu URL ?category=... thay đổi từ điều hướng bên ngoài
  useEffect(() => {
    const p = searchParams.get("category")
    const next: "" | DiscoverableCategory = isDiscoverableCategory(p)
      ? (p.trim().toLowerCase() as DiscoverableCategory)
      : ""
    setCategory(next)
  }, [searchParams])

  // Debounce từ khoá tìm kiếm 280ms để không bắn request liên tục mỗi phím gõ
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword.trim()), 280)
    return () => clearTimeout(t)
  }, [keyword])

  // Thử lấy vị trí GPS thật của trình duyệt ở lần mở đầu tiên (nếu người dùng đã cấp quyền)
  const requestBrowserGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatusMsg(
        "Trình duyệt không hỗ trợ định vị GPS (MSG-MTH-02). Đang dùng vị trí khu vực đã chọn.",
      )
      return
    }
    setLocatingGps(true)
    setGpsStatusMsg("")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6))
        const lng = Number(pos.coords.longitude.toFixed(6))
        setCoords({
          lat,
          lng,
          label: `Vị trí GPS của bạn (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          source: "gps",
        })
        setLocatingGps(false)
        setShowLocationPicker(false)
      },
      () => {
        setLocatingGps(false)
        setGpsStatusMsg(
          "Cần quyền truy cập vị trí để tự động định vị (MSG-MTH-02). Bạn vẫn có thể chọn nhanh quận/khu vực bên cạnh.",
        )
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 },
    )
  }

  // Truy vấn danh sách cơ sở thu mua gần vị trí GPS từ Backend
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
          // Dự phòng khi Backend chưa khởi động
          setIsOfflineDemo(true)
          const filteredOffline = OFFLINE_PARTNERS.filter((p) => {
            const hitCat =
              !category ||
              p.materials.some((m) => m.categoryCode.toLowerCase() === category)
            const kw = debouncedKeyword.toLowerCase()
            const hitKw =
              !kw ||
              p.facilityName.toLowerCase().includes(kw) ||
              p.address.toLowerCase().includes(kw)
            return hitCat && hitKw
          })
          setPartners(filteredOffline)
          setFallback(
            filteredOffline.length === 0
              ? {
                  suggestedExpandedRadiusKm: Math.min(50, Math.round(radiusKm * 2.5)),
                  guidanceMessage:
                    "Không tìm thấy cơ sở thu mua phù hợp trong bộ lọc hiện tại.",
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

  return (
    <div className="flex flex-col gap-4 p-4 xl:h-[calc(100dvh-76px)] xl:flex-row">
      {/* Cột trái: Khung bản đồ định vị & các ghim cơ sở thu mua theo toạ độ GPS */}
      <section className="relative flex min-h-[480px] flex-1 flex-col overflow-clip rounded-2xl border border-line bg-surface-3">
        <div className="relative flex-1">
          <img
            src="/assets/map/078b8.png"
            alt="Bản đồ khu vực cơ sở thu mua phế liệu"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/35 via-white/5 to-white/25" />

          {/* Vòng radar trực quan thể hiện bán kính tìm kiếm quanh tâm người dùng */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-brand/35 bg-brand/5 md:size-88"
          />

          {/* Tâm vị trí hiện tại của người dân */}
          <div
            className="absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          >
            <span className="flex items-center gap-1.5 rounded-full border border-brand/30 bg-white px-3 py-1 text-[11px] font-semibold text-ink shadow-[0_4px_10px_rgba(0,0,0,0.12)]">
              <span className="size-2 rounded-full bg-brand" />
              Bạn ở đây
            </span>
          </div>

          {/* Các ghim cơ sở thu mua thật từ API chiếu theo hướng & khoảng cách địa lý */}
          {partners.map((partner, idx) => {
            const pos = projectPartnerPinPosition(
              coords.lat,
              coords.lng,
              partner.latitude,
              partner.longitude,
              radiusKm,
              idx,
            )
            const isSelected = partner.id === activePartner?.id
            return (
              <button
                key={partner.id}
                type="button"
                onClick={() => setSelectedId(partner.id)}
                style={pos}
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-transform focus:outline-none ${
                  isSelected ? "z-20 scale-105" : "z-10 hover:scale-105"
                }`}
              >
                {isSelected ? (
                  <ActivePin
                    label={`${partner.facilityName} (${formatDistance(partner.distanceKm)})`}
                  />
                ) : (
                  <SimplePin
                    label={`${partner.facilityName} (${formatDistance(partner.distanceKm)})`}
                  />
                )}
              </button>
            )
          })}

          {/* Thanh địa chỉ + chọn bán kính ở cạnh trên bản đồ */}
          <div className="absolute inset-x-3.5 top-3.5 z-30 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-line bg-white/95 px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md">
                <PinIcon />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink">{coords.label}</p>
                  <p className="text-[11px] text-muted">
                    {coords.source === "gps" ? "Định vị GPS trực tiếp" : "Toạ độ khu vực"} •{" "}
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLocationPicker((v) => !v)}
                  className="shrink-0 rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-deep hover:bg-surface-3"
                >
                  {showLocationPicker ? "Đóng" : "Đổi vị trí"}
                </button>
              </div>

              <div
                role="group"
                aria-label="Bán kính tìm kiếm"
                className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-white/95 p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md"
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

            {/* Menu chọn nhanh khu vực hoặc bật GPS */}
            {showLocationPicker && (
              <div className="rounded-xl border border-line bg-white/98 p-3 shadow-lg backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                  <span className="text-xs font-semibold text-ink">
                    Chọn vị trí tìm kiếm (bảo mật vị trí theo BR-MTH-05)
                  </span>
                  <button
                    type="button"
                    onClick={requestBrowserGps}
                    disabled={locatingGps}
                    className="btn-primary h-8 px-3 text-xs"
                  >
                    {locatingGps ? "Đang lấy GPS..." : "Dùng GPS hiện tại"}
                  </button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {LOCATION_PRESETS.map((preset) => {
                    const active =
                      Math.abs(coords.lat - preset.lat) < 0.001 &&
                      Math.abs(coords.lng - preset.lng) < 0.001
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setCoords({
                            lat: preset.lat,
                            lng: preset.lng,
                            label: preset.address,
                            source: "preset",
                          })
                          setGpsStatusMsg("")
                          setShowLocationPicker(false)
                        }}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                          active
                            ? "border-brand bg-brand/10 font-semibold text-brand-deep"
                            : "border-line-soft bg-surface hover:bg-surface-2 text-ink"
                        }`}
                      >
                        <span className="block font-semibold">{preset.label}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {preset.address}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Thanh lọc nhanh theo loại phế liệu (nhận trực tiếp từ bước Quét AI) */}
            <div className="flex flex-wrap items-center gap-1.5">
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
                className="rounded-xl border border-warn/30 bg-white/95 px-3 py-2 text-xs text-warn shadow-xs"
              >
                {gpsStatusMsg}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={requestBrowserGps}
            disabled={locatingGps}
            title="Lấy vị trí GPS hiện tại"
            aria-label="Về lại vị trí hiện tại"
            className="absolute right-3.5 bottom-3.5 z-20 grid size-10 place-items-center rounded-xl border border-line bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition hover:bg-white disabled:opacity-60"
          >
            <CrosshairIcon />
          </button>
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
              placeholder="Tìm tên cơ sở hoặc đường, quận..."
              aria-label="Tìm tên cơ sở hoặc địa chỉ"
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
                          Giờ mở cửa: <b className="text-body">{p.operatingHours || "08:00 - 18:00"}</b>
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
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/70 p-4">
      <div>
        <span className="inline-block rounded-full bg-warn/12 px-2.5 py-0.5 text-[11px] font-semibold text-warn">
          MSG-MTH-01 • Chưa có cơ sở mở cửa trong {radiusKm} km
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

/* ---------------------------------------------------------------- Pins & Icons */

function ActivePin({ label }: { label: string }) {
  return (
    <>
      <span className="-mb-1.5 flex max-w-[220px] items-center gap-1.5 rounded-full border border-white/25 bg-brand-deep px-3 py-1.5 text-[11px] font-semibold tracking-[0.2px] text-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.18)]">
        <TruckIcon />
        <span className="truncate">{label}</span>
        <i className="size-1.5 shrink-0 rounded-full bg-mint-bright" />
      </span>
      <span className="size-2.5 rotate-45 bg-brand-deep" />
    </>
  )
}

function SimplePin({ label }: { label: string }) {
  return (
    <span className="flex max-w-[200px] items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-ink shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
      <PinIcon />
      <span className="truncate">{label}</span>
    </span>
  )
}

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

function CrosshairIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="text-ink">
      <circle cx="7" cy="7" r="3.4" {...stroke} />
      <path d="M7 1v1.8M7 11.2V13M1 7h1.8M11.2 7H13" {...stroke} />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg width="15" height="10" viewBox="0 0 16 11" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M1 1h8.5v8H1V1zM9.5 3.6H13l2 2.4v3H9.5V3.6z" {...stroke} />
      <circle cx="4.2" cy="9.6" r="1.4" {...stroke} />
      <circle cx="11.8" cy="9.6" r="1.4" {...stroke} />
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
