import { apiRequest } from "@/lib/api"
import { LOCATION_PRESETS, type LocationPreset } from "@/lib/recyclerDiscoveryApi"

export interface GeocodingSuggestionDto {
  placeId: string
  shortLabel: string
  displayName: string
  latitude: number
  longitude: number
  categoryType?: string | null
}

export interface GeocodingSearchResponseDto {
  query: string
  provider: string
  cached: boolean
  attribution: string
  items: GeocodingSuggestionDto[]
}

/** Bộ nhớ đệm phía trình duyệt để không gửi lặp lại truy vấn địa danh trong cùng phiên làm việc. */
const clientGeocodeCache = new Map<string, GeocodingSearchResponseDto>()

/** Bỏ dấu Tiếng Việt và chuẩn hoá chữ thường phục vụ lọc nhanh `LOCATION_PRESETS` trong 0ms. */
export function normalizeVietnameseText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Tầng 1 (Search-as-you-type — 0 HTTP request):
 * Lọc tức thì danh sách khu vực / phường / quận / chợ phổ biến ngay khi người dùng đang gõ phím.
 */
export function filterAreaPresets(query: string, maxItems: number = 6): LocationPreset[] {
  const norm = normalizeVietnameseText(query)
  if (!norm) {
    return LOCATION_PRESETS.slice(0, maxItems)
  }

  const tokens = norm.split(" ").filter(Boolean)
  return LOCATION_PRESETS.filter((preset) => {
    const haystack = normalizeVietnameseText(`${preset.label} ${preset.address}`)
    return tokens.every((tok) => haystack.includes(tok))
  }).slice(0, maxItems)
}

/**
 * Tầng 2 (Submit-only — Tuân thủ Nominatim Usage Policy):
 * Chỉ gọi Backend Geocoding Proxy (`GET /api/v1/geocoding/search`) khi người dùng nhấn Enter hoặc bấm nút Tìm.
 */
export async function searchPlacesOnSubmit(
  query: string,
  limit: number = 5,
  signal?: AbortSignal,
): Promise<GeocodingSearchResponseDto> {
  const trimmed = query.trim().replace(/\s+/g, " ")
  if (trimmed.length < 2) {
    return {
      query: trimmed,
      provider: "local",
      cached: true,
      attribution: "© OpenStreetMap contributors",
      items: [],
    }
  }

  const cacheKey = `${limit}:${trimmed.toLowerCase()}`
  const hit = clientGeocodeCache.get(cacheKey)
  if (hit) {
    return { ...hit, cached: true }
  }

  try {
    const params = new URLSearchParams()
    params.set("q", trimmed)
    params.set("limit", String(limit))

    const res = await apiRequest<GeocodingSearchResponseDto>(
      `/api/v1/geocoding/search?${params.toString()}`,
      {
        method: "GET",
        signal,
      },
    )

    clientGeocodeCache.set(cacheKey, res.data)
    return res.data
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      throw err
    }

    // Dự phòng khi Backend chưa khởi động: tìm khớp trên bộ khu vực nội bộ
    const fallbackMatches = filterAreaPresets(trimmed, limit).map((p) => ({
      placeId: p.id,
      shortLabel: p.label,
      displayName: p.address,
      latitude: p.lat,
      longitude: p.lng,
      categoryType: "preset",
    }))

    return {
      query: trimmed,
      provider: "offline-preset",
      cached: true,
      attribution: "© OpenStreetMap contributors",
      items: fallbackMatches,
    }
  }
}

/**
 * Chuẩn hoá toạ độ tra cứu theo chế độ Bảo mật Vị trí (`BR-MTH-05`).
 * Khi `privacyMode = true`, làm tròn sang tâm ô lưới `0.005°` (~550m tại Việt Nam),
 * áp dụng thống nhất cho CẢ định vị GPS lẫn thao tác chấm điểm trên bản đồ (`Click-to-Pin`).
 */
export function resolveSearchCoordinates(
  rawLat: number,
  rawLng: number,
  privacyMode: boolean = true,
  gridStepDeg: number = 0.005,
): { lat: number; lng: number; isFuzzed: boolean } {
  if (!privacyMode) {
    return {
      lat: Number(rawLat.toFixed(5)),
      lng: Number(rawLng.toFixed(5)),
      isFuzzed: false,
    }
  }

  const fuzzedLat = Math.round(rawLat / gridStepDeg) * gridStepDeg
  const fuzzedLng = Math.round(rawLng / gridStepDeg) * gridStepDeg
  return {
    lat: Number(fuzzedLat.toFixed(4)),
    lng: Number(fuzzedLng.toFixed(4)),
    isFuzzed: true,
  }
}

