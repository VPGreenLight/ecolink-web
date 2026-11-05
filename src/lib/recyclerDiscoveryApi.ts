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

/** Các toạ độ khu vực thực tế để gợi ý tức thì (0 HTTP request) khi người dùng đang gõ
 *  hoặc chọn nhanh mà không cần chia sẻ vị trí nhà riêng (BR-MTH-05, MSG-MTH-02). */
export const LOCATION_PRESETS: readonly LocationPreset[] = [
  {
    id: "hcm-q1",
    label: "Quận 1 — Chợ Bến Thành, TP.HCM",
    address: "Khu vực Chợ Bến Thành, P. Bến Thành, Quận 1, TP.HCM",
    lat: 10.7725,
    lng: 106.698,
  },
  {
    id: "hcm-bt",
    label: "Bình Thạnh — Nguyễn Hữu Cảnh, TP.HCM",
    address: "Khu vực P. 22 & Cầu Sài Gòn, Quận Bình Thạnh, TP.HCM",
    lat: 10.7938,
    lng: 106.7182,
  },
  {
    id: "hcm-tb",
    label: "Tân Bình — Cộng Hòa, TP.HCM",
    address: "Ngã tư Cộng Hòa - Hoàng Hoa Thám, Quận Tân Bình, TP.HCM",
    lat: 10.7995,
    lng: 106.657,
  },
  {
    id: "hcm-q7",
    label: "Quận 7 — Nguyễn Thị Thập, TP.HCM",
    address: "Khu vực P. Tân Phú & Phú Mỹ Hưng, Quận 7, TP.HCM",
    lat: 10.7324,
    lng: 106.7215,
  },
  {
    id: "hn-cg",
    label: "Cầu Giấy — Xuân Thủy, Hà Nội",
    address: "Khu vực Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội",
    lat: 21.0368,
    lng: 105.7825,
  },
  {
    id: "hcm-td",
    label: "TP. Thủ Đức — Ngã tư Thủ Đức, TP.HCM",
    address: "Khu vực Hiệp Phú & Làng Đại học, TP. Thủ Đức, TP.HCM",
    lat: 10.8505,
    lng: 106.7717,
  },
  {
    id: "hcm-gv",
    label: "Gò Vấp — Quang Trung, TP.HCM",
    address: "Khu vực Chợ Hạnh Thông Tây, Quận Gò Vấp, TP.HCM",
    lat: 10.8382,
    lng: 106.6653,
  },
  {
    id: "hcm-q3",
    label: "Quận 3 — Công trường Dân Chủ, TP.HCM",
    address: "Vòng xoay Dân Chủ, Phường Võ Thị Sáu, Quận 3, TP.HCM",
    lat: 10.7776,
    lng: 106.6816,
  },
  {
    id: "hn-dd",
    label: "Đống Đa — Ngã Tư Sở, Hà Nội",
    address: "Khu vực Ngã Tư Sở, Quận Đống Đa, Hà Nội",
    lat: 21.0031,
    lng: 105.8201,
  },
  {
    id: "hn-hbt",
    label: "Hai Bà Trưng — Bách Khoa, Hà Nội",
    address: "Khu vực Bách Khoa - Giải Phóng, Quận Hai Bà Trưng, Hà Nội",
    lat: 21.0045,
    lng: 105.8465,
  },
  {
    id: "dn-hc",
    label: "Hải Châu — Cầu Rồng, Đà Nẵng",
    address: "Khu vực Phước Ninh, Quận Hải Châu, Đà Nẵng",
    lat: 16.0611,
    lng: 108.2232,
  },
  {
    id: "ct-nk",
    label: "Ninh Kiều — Bến Ninh Kiều, Cần Thơ",
    address: "Khu vực Tân An, Quận Ninh Kiều, Cần Thơ",
    lat: 10.0341,
    lng: 105.7875,
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
 * dự phòng cho môi trường SSR chưa nạp DOM trình duyệt.
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

  const dist = Math.hypot(dEastKm, dNorthKm)
  if (dist < 0.08) {
    const angle = ((indexFallback + 1) * Math.PI) / 3
    return {
      left: `${Math.round(50 + Math.cos(angle) * 14)}%`,
      top: `${Math.round(50 - Math.sin(angle) * 14)}%`,
    }
  }

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
