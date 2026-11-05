import { apiRequest, type ApiResponse } from "@/lib/api"
import type { WasteSortingGuideDto } from "@/lib/wasteScanApi"

export type DiscoverableCategory = "plastic" | "paper" | "cardboard" | "metal" | "glass"
export type RecyclerSortBy = "distance" | "price_desc"

export interface AcceptedMaterialDto {
  categoryCode: string
  categoryName: string
  pricePerKg: number
  minimumQuantityKg: number
  collectionConditions?: string | null
  lastUpdatedAt?: string | null
}

export interface CollectionPartnerDto {
  id: string
  facilityName: string
  representativeName?: string | null
  address: string
  latitude: number
  longitude: number
  distanceKm: number
  contactPhone: string
  operatingHours: string
  description?: string | null
  businessPhotoUrl?: string | null
  materials: AcceptedMaterialDto[]
}

export interface DiscoveryFallbackSuggestionDto {
  suggestedExpandedRadiusKm: number
  guidanceMessage: string
  publicBinSortingGuide?: WasteSortingGuideDto | null
  allowCommunityPickupPost: boolean
}

export interface NearbyRecyclerSearchResponseDto {
  totalFound: number
  searchRadiusKm: number
  filteredCategory?: string | null
  items: CollectionPartnerDto[]
  fallbackSuggestion?: DiscoveryFallbackSuggestionDto | null
}

export interface NearbyRecyclerFilter {
  lat: number
  lng: number
  category?: DiscoverableCategory | ""
  radiusKm?: number
  keyword?: string
  sortBy?: RecyclerSortBy
}

export const DISCOVERY_CATEGORIES: readonly {
  value: "" | DiscoverableCategory
  label: string
}[] = [
  { value: "", label: "Tất cả phế liệu" },
  { value: "plastic", label: "Nhựa (Plastic)" },
  { value: "paper", label: "Giấy báo (Paper)" },
  { value: "cardboard", label: "Bìa Carton" },
  { value: "metal", label: "Kim loại & Lon" },
  { value: "glass", label: "Thủy tinh" },
]

export const RADIUS_OPTIONS = [2, 5, 10, 25] as const

export interface LocationPreset {
  id: string
  label: string
  address: string
  lat: number
  lng: number
}

/** Các toạ độ khu vực thực tế để người dùng chọn nhanh khi dùng máy tính để bàn
 *  hoặc khi trình duyệt từ chối cấp quyền định vị GPS (MSG-MTH-02). */
export const LOCATION_PRESETS: readonly LocationPreset[] = [
  {
    id: "hcm-q1",
    label: "Quận 1, TP.HCM",
    address: "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1, TP.HCM",
    lat: 10.7785,
    lng: 106.7009,
  },
  {
    id: "hcm-bt",
    label: "Bình Thạnh, TP.HCM",
    address: "120 Nguyễn Hữu Cảnh, P. 22, Quận Bình Thạnh, TP.HCM",
    lat: 10.7938,
    lng: 106.7182,
  },
  {
    id: "hcm-tb",
    label: "Tân Bình, TP.HCM",
    address: "88 Cộng Hòa, Phường 4, Quận Tân Bình, TP.HCM",
    lat: 10.7995,
    lng: 106.657,
  },
  {
    id: "hcm-q7",
    label: "Quận 7, TP.HCM",
    address: "Nguyễn Thị Thập, P. Tân Phú, Quận 7, TP.HCM",
    lat: 10.7324,
    lng: 106.7215,
  },
  {
    id: "hn-cg",
    label: "Cầu Giấy, Hà Nội",
    address: "Đường Xuân Thủy, Quận Cầu Giấy, Hà Nội",
    lat: 21.0368,
    lng: 105.7825,
  },
]

export function isDiscoverableCategory(val?: string | null): val is DiscoverableCategory {
  if (!val) return false
  const v = val.trim().toLowerCase()
  return (
    v === "plastic" ||
    v === "paper" ||
    v === "cardboard" ||
    v === "metal" ||
    v === "glass"
  )
}

/** Tìm kiếm các cơ sở thu gom đã xác minh (Verified) & đang mở cửa (Online) quanh GPS (UC U-05). */
export async function searchNearbyRecyclers(
  filter: NearbyRecyclerFilter,
  signal?: AbortSignal,
): Promise<ApiResponse<NearbyRecyclerSearchResponseDto>> {
  const params = new URLSearchParams()
  params.set("lat", String(filter.lat))
  params.set("lng", String(filter.lng))
  params.set("radiusKm", String(filter.radiusKm ?? 10))
  params.set("sortBy", filter.sortBy ?? "distance")

  if (filter.category && isDiscoverableCategory(filter.category)) {
    params.set("category", filter.category.trim().toLowerCase())
  }
  if (filter.keyword && filter.keyword.trim()) {
    params.set("keyword", filter.keyword.trim())
  }

  return apiRequest<NearbyRecyclerSearchResponseDto>(
    `/api/v1/recyclers/nearby?${params.toString()}`,
    {
      method: "GET",
      signal,
    },
  )
}

/** Xem chi tiết hồ sơ công khai, giờ mở cửa và bảng giá niêm yết của 1 cơ sở thu gom (UC U-05). */
export async function getRecyclerPublicDetail(
  recyclerId: string,
  lat?: number,
  lng?: number,
  signal?: AbortSignal,
): Promise<CollectionPartnerDto> {
  const params = new URLSearchParams()
  if (typeof lat === "number" && lat !== 0) params.set("lat", String(lat))
  if (typeof lng === "number" && lng !== 0) params.set("lng", String(lng))
  const qs = params.toString()

  const res = await apiRequest<CollectionPartnerDto>(
    `/api/v1/recyclers/${encodeURIComponent(recyclerId)}${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      signal,
    },
  )
  return res.data
}

/**
 * Chiếu toạ độ GPS thật (lat, lng) của cơ sở thu mua sang vị trí phần trăm (left%, top%)
 * trên khung bản đồ xung quanh tâm người dùng (50%, 50%) theo bán kính tìm kiếm.
 */
export function projectPartnerPinPosition(
  userLat: number,
  userLng: number,
  partnerLat: number,
  partnerLng: number,
  radiusKm: number,
  indexFallback: number = 0,
): { left: string; top: string } {
  const safeRadius = Math.max(radiusKm, 1)
  const kmPerDegLat = 111.32
  const kmPerDegLng = 111.32 * Math.cos((userLat * Math.PI) / 180)

  const dNorthKm = (partnerLat - userLat) * kmPerDegLat
  const dEastKm = (partnerLng - userLng) * kmPerDegLng

  // Nếu cơ sở trùng sát tâm (< 80m), tách nhẹ theo góc để không đè lên pin "Bạn ở đây"
  const dist = Math.hypot(dEastKm, dNorthKm)
  if (dist < 0.08) {
    const angle = ((indexFallback + 1) * Math.PI) / 3
    return {
      left: `${Math.round(50 + Math.cos(angle) * 14)}%`,
      top: `${Math.round(50 - Math.sin(angle) * 14)}%`,
    }
  }

  // Bán kính hiển thị tối đa ~36% tính từ tâm 50% (tức nằm trong khoảng 14%..86%)
  const scale = Math.min(1, dist / safeRadius)
  const ux = dEastKm / dist
  const uy = dNorthKm / dist
  const offsetPct = 12 + scale * 25

  const left = Math.max(14, Math.min(86, 50 + ux * offsetPct))
  const top = Math.max(16, Math.min(84, 50 - uy * offsetPct))

  return {
    left: `${left.toFixed(1)}%`,
    top: `${top.toFixed(1)}%`,
  }
}

export function formatDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return "Gần bạn"
  if (distanceKm < 1) {
    return `${Math.max(50, Math.round(distanceKm * 1000))} m`
  }
  return `${distanceKm.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} km`
}

export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")} đ`
}

