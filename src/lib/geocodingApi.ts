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

export type BrowserGeolocationResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; message: string }

async function queryGeolocationPermissionState(): Promise<PermissionState | "unknown"> {
  if (typeof navigator === "undefined" || !("permissions" in navigator)) return "unknown"
  try {
    const status = await navigator.permissions.query({ name: "geolocation" })
    return status.state
  } catch {
    return "unknown"
  }
}

function tryWatchFixOnce(enableHighAccuracy: boolean, timeoutMs = 3500): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      navigator.geolocation.clearWatch(watchId)
      reject({ code: 3, message: "Timeout" } as GeolocationPositionError)
    }, timeoutMs)

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        navigator.geolocation.clearWatch(watchId)
        resolve(pos)
      },
      (err) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        navigator.geolocation.clearWatch(watchId)
        reject(err)
      },
      { enableHighAccuracy, timeout: timeoutMs, maximumAge: 300_000 },
    )
  })
}

/**
 * Lấy toạ độ GPS hiện tại ngay trong sự kiện chạm của người dùng (không `await permissions.query`
 * trước khi gọi fallback để tránh Safari/WebKit mất user-gesture activation).
 */
export async function requestBrowserGeolocation(
  preferHighAccuracy: boolean = false,
): Promise<BrowserGeolocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return {
      ok: false,
      message:
        "Trình duyệt không hỗ trợ định vị GPS. Bạn có thể chọn khu vực hoặc bấm trực tiếp lên bản đồ.",
    }
  }

  const firstOpts: PositionOptions = preferHighAccuracy
    ? { enableHighAccuracy: true, timeout: 4500, maximumAge: 60_000 }
    : { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 }

  const fallbackOpts: PositionOptions = preferHighAccuracy
    ? { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    : { enableHighAccuracy: true, timeout: 7000, maximumAge: 60_000 }

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        (firstErr) => {
          // Gọi ngay lớp dự phòng đồng bộ trong error callback (giữ nguyên user gesture;
          // thử luôn chế độ thô nếu độ chính xác cao bị WebView từ chối riêng)
          if (firstErr?.code === 1 && !preferHighAccuracy) {
            reject(firstErr)
            return
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, fallbackOpts)
        },
        firstOpts,
      )
    })

    return {
      ok: true,
      lat: Number(pos.coords.latitude.toFixed(6)),
      lng: Number(pos.coords.longitude.toFixed(6)),
    }
  } catch (err) {
    const geoErr = err as GeolocationPositionError | undefined
    const code = geoErr?.code

    // Trên một số máy Android/iOS, single-shot getCurrentPosition báo code 2/3 lúc chip GPS mới khởi động;
    // thử nhanh watchPosition 3.5s để đánh thức FusedLocation trước khi kết luận lỗi.
    if (code === 2 || code === 3) {
      try {
        const watched = await tryWatchFixOnce(false, 3500)
        return {
          ok: true,
          lat: Number(watched.coords.latitude.toFixed(6)),
          lng: Number(watched.coords.longitude.toFixed(6)),
        }
      } catch {
        // Giữ nguyên mã lỗi ban đầu để phân loại thông báo chính xác bên dưới
      }
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      return {
        ok: false,
        message:
          "Trình duyệt chỉ cho phép định vị GPS qua HTTPS. Hãy truy cập qua https:// hoặc bấm chọn trực tiếp trên bản đồ.",
      }
    }

    const permState = await queryGeolocationPermissionState()
    if (code === 3) {
      return {
        ok: false,
        message:
          "Định vị GPS phản hồi quá lâu. Bạn hãy thử bấm lại nút GPS hoặc chạm chọn điểm trên bản đồ.",
      }
    }
    if (code === 2 || permState === "granted") {
      return {
        ok: false,
        message:
          "Trình duyệt đã cấp quyền, nhưng máy/Wi-Fi chưa trả về tọa độ (máy tính bàn không có chip GPS hoặc bộ phát Wi-Fi chưa có dữ liệu vị trí). Hãy nhập tên khu vực hoặc bấm trực tiếp lên bản đồ.",
      }
    }

    return {
      ok: false,
      message:
        "Chưa cấp quyền vị trí GPS. Bạn có thể nhập tên Phường/Quận/Chợ hoặc bấm chọn điểm trên bản đồ.",
    }
  }
}
