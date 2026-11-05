import { ApiError, apiRequest } from "@/lib/api"
import type { CollectionPartnerDto } from "@/lib/recyclerDiscoveryApi"
import { getSession, type Role } from "@/lib/session"
import { APPLICATIONS, type Application } from "@/data/ops"

/* ------------------------------------------------------------------ DTOs */

export interface AuthLoginResponseDto {
  accessToken: string
  refreshToken?: string
  user?: {
    id: string
    username: string
    email: string
    fullName: string
    role: string
  }
}

export interface RecyclerApplicationDetailDto {
  userId: string
  username: string
  email: string
  applicantFullName: string
  currentRole: string
  facilityName: string
  representativeName?: string | null
  businessAddress: string
  latitude: number
  longitude: number
  operatingHours: string
  contactPhone: string
  description?: string | null
  legalPermitUrl?: string | null
  businessPhotoUrl?: string | null
  verificationStatus: "Pending" | "Verified" | "Rejected" | string
  activeStatus: "Online" | "Offline" | string
  rejectionReason?: string | null
  submittedAt: string
  reviewedAt?: string | null
  reviewedBy?: string | null
}

interface PagedResultDto<T> {
  items: T[]
  pageNumber: number
  pageSize: number
  totalRecords: number
}

interface DocumentUploadResponseDto {
  fileUrl: string
  objectKey: string
}

export interface RecyclerProfileDto {
  recyclerId: string
  facilityName: string
  representativeName?: string | null
  businessAddress: string
  latitude: number
  longitude: number
  operatingHours: string
  contactPhone: string
  description?: string | null
  legalPermitUrl?: string | null
  businessPhotoUrl?: string | null
  verificationStatus: string
  activeStatus: string
  rejectionReason?: string | null
  busyReason?: string | null
  activePriceCount: number
}

export interface AvailabilityDto {
  isOnline: boolean
  activeStatus: string
  verificationStatus: string
  busyReason?: string | null
  operatingHours: string
  activePriceCount: number
}

export interface TradeOrderApiDto {
  id: string
  userId: string
  partnerId: string
  recyclerUserId?: string | null
  partnerName?: string | null
  status: string
  scheduledAt: string
  estimatedWeightKg: number
  categoryCode?: string | null
  initialPricePerKg?: number | null
  proposedTimeSlot?: string | null
  pickupAddress?: string | null
  pickupLatitude?: number | null
  pickupLongitude?: number | null
  note?: string | null
  qrCodeValue: string
}

export interface StaffApplicationView extends Application {
  userId?: string
  representativeName?: string
  phone?: string
  email?: string
  latitude: number
  longitude: number
  legalPermitUrl?: string
  businessPhotoUrl?: string
  fromBackend?: boolean
}

/* ------------------------------------------------------------------ Demo Role JWT Bridge & Local Sync */

const DEMO_BACKEND_CREDENTIALS: Record<Role, { usernameOrEmail: string; password: string }> = {
  user: { usernameOrEmail: "citizen", password: "citizen123" },
  recycler: { usernameOrEmail: "collector", password: "collector123" },
  staff: { usernameOrEmail: "staff", password: "staff123" },
  admin: { usernameOrEmail: "admin", password: "admin123" },
}

const OFFLINE_SYNC_KEY = "ecolink:workflow-sync:v1"

interface LocalWorkflowSyncState {
  /** Trạng thái Online/Offline của cơ sở thu mua mẫu EcoGreen khi chạy ngoại tuyến */
  demoRecyclerOnline: boolean
  demoRecyclerLat?: number
  demoRecyclerLng?: number
  demoRecyclerAddress?: string
  /** Hồ sơ đăng ký cơ sở mới nộp hoặc đã duyệt ở chế độ ngoại tuyến */
  customApplications: StaffApplicationView[]
  /** Đơn hẹn bàn giao rác mới tạo có kèm toạ độ điểm hẹn đầu ngõ */
  handoverOrders: {
    id: string
    recyclerId?: string
    recycler: string
    address: string
    pickupLat: number
    pickupLng: number
    date: string
    slot: string
    lines: { wasteId: string; kg: number }[]
    status: "pending" | "accepted" | "declined" | "broken"
    reason?: string
  }[]
}

const DEFAULT_SYNC_STATE: LocalWorkflowSyncState = {
  demoRecyclerOnline: true,
  customApplications: [],
  handoverOrders: [],
}

function readSyncState(): LocalWorkflowSyncState {
  if (typeof localStorage === "undefined") return DEFAULT_SYNC_STATE
  try {
    const raw = localStorage.getItem(OFFLINE_SYNC_KEY)
    if (!raw) return DEFAULT_SYNC_STATE
    const parsed = JSON.parse(raw) as Partial<LocalWorkflowSyncState>
    return {
      demoRecyclerOnline:
        typeof parsed.demoRecyclerOnline === "boolean" ? parsed.demoRecyclerOnline : true,
      demoRecyclerLat: parsed.demoRecyclerLat,
      demoRecyclerLng: parsed.demoRecyclerLng,
      demoRecyclerAddress: parsed.demoRecyclerAddress,
      customApplications: Array.isArray(parsed.customApplications)
        ? parsed.customApplications
        : [],
      handoverOrders: Array.isArray(parsed.handoverOrders) ? parsed.handoverOrders : [],
    }
  } catch {
    return DEFAULT_SYNC_STATE
  }
}

function writeSyncState(next: LocalWorkflowSyncState) {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(OFFLINE_SYNC_KEY, JSON.stringify(next))
  } catch {
    // Bỏ qua nếu bộ nhớ trình duyệt bị chặn
  }
}

/**
 * Tự động lấy JWT tương ứng với vai trò hiện tại nếu phiên đăng nhập giả lập (`session.ts`)
 * chưa lưu `ecolink:token`. Không chạm tới khoá `ecolink:user` để giữ ổn định tuyệt đối cho `useSession()`.
 */
export async function ensureRoleJwt(role: Role): Promise<string | null> {
  if (typeof localStorage === "undefined") return null

  const currentSession = getSession()
  const existingGlobal = localStorage.getItem("ecolink:token")
  if (
    existingGlobal &&
    currentSession &&
    (currentSession.role === role || (role === "staff" && currentSession.role === "admin"))
  ) {
    return existingGlobal
  }

  const roleTokenKey = `ecolink:jwt:${role}`
  const cachedRoleToken = localStorage.getItem(roleTokenKey)
  if (cachedRoleToken) return cachedRoleToken

  const creds = DEMO_BACKEND_CREDENTIALS[role]
  try {
    const res = await apiRequest<AuthLoginResponseDto>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(creds),
    })
    const token = res.data?.accessToken
    if (token) {
      localStorage.setItem(roleTokenKey, token)
      return token
    }
  } catch {
    // Nếu tài khoản staff chưa có trên DB cũ, dự phòng sang admin cho quyền thẩm định Staff,Admin
    if (role === "staff") {
      try {
        const adminRes = await apiRequest<AuthLoginResponseDto>("/api/v1/auth/login", {
          method: "POST",
          body: JSON.stringify(DEMO_BACKEND_CREDENTIALS.admin),
        })
        const token = adminRes.data?.accessToken
        if (token) {
          localStorage.setItem(roleTokenKey, token)
          return token
        }
      } catch {
        return null
      }
    }
  }
  return null
}

async function authorizedRequest<T>(
  role: Role,
  path: string,
  options: RequestInit = {},
) {
  let token = await ensureRoleJwt(role)
  const makeHeaders = (jwt: string | null) => {
    const h = new Headers(options.headers)
    if (jwt) h.set("Authorization", `Bearer ${jwt}`)
    return h
  }

  try {
    return await apiRequest<T>(path, {
      ...options,
      headers: makeHeaders(token),
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && typeof localStorage !== "undefined") {
      localStorage.removeItem(`ecolink:jwt:${role}`)
      token = await ensureRoleJwt(role)
      if (token) {
        return apiRequest<T>(path, {
          ...options,
          headers: makeHeaders(token),
        })
      }
    }
    throw err
  }
}

/* ------------------------------------------------------------------ Link 1: Đăng ký cơ sở (U-17) */

export interface SubmitRecyclerOnboardingInput {
  facilityName: string
  representativeName: string
  phone: string
  email: string
  businessAddress: string
  latitude: number
  longitude: number
  materials: string[]
  documents: File[]
}

export interface SubmitRecyclerOnboardingResult {
  referenceCode: string
  syncedWithBackend: boolean
  userId?: string
}

async function uploadSingleDocument(
  file: File,
  documentType: "permit" | "facility-photo",
): Promise<string> {
  const form = new FormData()
  form.append("file", file)
  form.append("documentType", documentType)

  const res = await apiRequest<DocumentUploadResponseDto>(
    "/api/v1/recycler-applications/upload-document",
    {
      method: "POST",
      body: form,
    },
  )
  return res.data.fileUrl
}

export async function submitRecyclerOnboarding(
  input: SubmitRecyclerOnboardingInput,
): Promise<SubmitRecyclerOnboardingResult> {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, "0")
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const yyyy = now.getFullYear()
  const description = `Thu mua: ${input.materials.join(", ")}`

  const slug =
    input.facilityName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase()
      .slice(0, 12) || "recycler"
  const suffix = String(Date.now()).slice(-5)
  const username = `${slug}_${suffix}`
  const email =
    input.email.trim() || `${username}@partner.ecolink.vn`

  try {
    let legalPermitUrl = `https://mock-r2.ecolink.vn/recycler-kyb/legal-permits/${encodeURIComponent(
      input.documents[0]?.name || "giay-phep.pdf",
    )}`
    let businessPhotoUrl = `https://mock-r2.ecolink.vn/recycler-kyb/facility-photos/${encodeURIComponent(
      input.documents[1]?.name || input.documents[0]?.name || "kho-bai.jpg",
    )}`

    if (input.documents[0]) {
      try {
        legalPermitUrl = await uploadSingleDocument(input.documents[0], "permit")
      } catch {
        // Giữ URL mô phỏng hợp lệ nếu R2 chưa cấu hình
      }
    }
    if (input.documents[1]) {
      try {
        businessPhotoUrl = await uploadSingleDocument(input.documents[1], "facility-photo")
      } catch {
        // Giữ URL mô phỏng hợp lệ
      }
    }

    const res = await apiRequest<AuthLoginResponseDto>("/api/v1/auth/register-recycler", {
      method: "POST",
      body: JSON.stringify({
        username,
        email,
        password: `Eco@${suffix}99`,
        fullName: input.representativeName.trim() || input.facilityName.trim(),
        phoneNumber: input.phone.replace(/[\s.\-()]/g, ""),
        facilityName: input.facilityName.trim(),
        representativeName: input.representativeName.trim() || input.facilityName.trim(),
        businessAddress: input.businessAddress.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        operatingHours: "08:00 - 18:00",
        contactPhone: input.phone.replace(/[\s.\-()]/g, ""),
        description,
        legalPermitUrl,
        businessPhotoUrl,
      }),
    })

    const createdId = res.data?.user?.id ?? ""
    const shortCode = createdId
      ? `HS-${yyyy}-${createdId.slice(0, 6).toUpperCase()}`
      : `HS-${yyyy}-${suffix}`

    return {
      referenceCode: shortCode,
      syncedWithBackend: true,
      userId: createdId || undefined,
    }
  } catch {
    // Dự phòng ngoại tuyến: lưu vào bộ nhớ đồng bộ trình duyệt để Staff vẫn thấy ngay bên /staff/applications
    const fallbackCode = `HS-${yyyy}-${suffix.slice(-4)}`
    const state = readSyncState()
    const offlineApp: StaffApplicationView = {
      id: fallbackCode,
      name: input.facilityName.trim(),
      representativeName: input.representativeName.trim() || undefined,
      phone: input.phone.trim(),
      email,
      address: input.businessAddress.trim(),
      materials: input.materials.join(", "),
      docs: input.documents.map((d) => d.name),
      date: `${dd}/${mm}/${yyyy}`,
      status: "pending",
      latitude: input.latitude,
      longitude: input.longitude,
      fromBackend: false,
    }
    writeSyncState({
      ...state,
      customApplications: [offlineApp, ...state.customApplications],
    })

    return {
      referenceCode: fallbackCode,
      syncedWithBackend: false,
    }
  }
}

/* ------------------------------------------------------------------ Link 2: Bật/Tắt hoạt động & Kho bãi (R-02, R-01) */

export async function fetchRecyclerStatus(): Promise<{
  profile: RecyclerProfileDto
  isOnline: boolean
  fromBackend: boolean
}> {
  try {
    const [profileRes, availRes] = await Promise.all([
      authorizedRequest<RecyclerProfileDto>("recycler", "/api/v1/recycler/profile", {
        method: "GET",
      }),
      authorizedRequest<AvailabilityDto>("recycler", "/api/v1/recycler/availability", {
        method: "GET",
      }),
    ])

    const state = readSyncState()
    writeSyncState({
      ...state,
      demoRecyclerOnline: availRes.data.isOnline,
      demoRecyclerLat: profileRes.data.latitude,
      demoRecyclerLng: profileRes.data.longitude,
      demoRecyclerAddress: profileRes.data.businessAddress,
    })

    return {
      profile: profileRes.data,
      isOnline: availRes.data.isOnline,
      fromBackend: true,
    }
  } catch {
    const state = readSyncState()
    return {
      profile: {
        recyclerId: "99999991-9999-9999-9999-999999999991",
        facilityName: "Trạm Thu Gom Tái Chế Xanh Hòa Lạc",
        representativeName: "Đỗ Văn Hùng",
        businessAddress:
          state.demoRecyclerAddress ??
          "Thôn 3, Xã Tân Xã (Gần Khu CNC Hòa Lạc & ĐH FPT), Thạch Thất, Hà Nội",
        latitude: state.demoRecyclerLat ?? 21.0182,
        longitude: state.demoRecyclerLng ?? 105.5345,
        operatingHours: "07:30 - 19:00",
        contactPhone: "0968112233",
        verificationStatus: "Verified",
        activeStatus: state.demoRecyclerOnline ? "Online" : "Offline",
        activePriceCount: 4,
      },
      isOnline: state.demoRecyclerOnline,
      fromBackend: false,
    }
  }
}

export async function toggleRecyclerOnlineStatus(nextOnline: boolean): Promise<{
  isOnline: boolean
  message: string
  fromBackend: boolean
}> {
  const state = readSyncState()
  try {
    const res = await authorizedRequest<AvailabilityDto>(
      "recycler",
      "/api/v1/recycler/availability",
      {
        method: "PATCH",
        body: JSON.stringify({
          isOnline: nextOnline,
          busyReason: nextOnline ? null : "Tạm ngưng nhận yêu cầu mới trên bản đồ",
        }),
      },
    )

    writeSyncState({
      ...state,
      demoRecyclerOnline: res.data.isOnline,
    })

    return {
      isOnline: res.data.isOnline,
      message: res.data.isOnline
        ? "Đã bật trực tuyến trên CSDL. Cơ sở của bạn đang hiển thị ngay trên bản đồ /map."
        : "Đã chuyển sang tạm nghỉ. Ghim cơ sở đã ẩn khỏi bản đồ /map (các lịch đang chờ vẫn giữ nguyên — BR-MTH-06).",
      fromBackend: true,
    }
  } catch (err) {
    if (err instanceof ApiError && !err.isNetworkError && err.status >= 400 && err.status < 500) {
      throw err
    }

    writeSyncState({
      ...state,
      demoRecyclerOnline: nextOnline,
    })
    return {
      isOnline: nextOnline,
      message: nextOnline
        ? "Đã bật. Cơ sở hiện trên bản đồ ngay (chế độ đồng bộ trình duyệt)."
        : "Đã tắt. Cơ sở không còn hiện trên bản đồ và không nhận yêu cầu mới. Lịch đang chờ vẫn giữ nguyên.",
      fromBackend: false,
    }
  }
}

export async function updateRecyclerWarehousePin(
  currentProfile: RecyclerProfileDto,
  nextLat: number,
  nextLng: number,
  nextAddress: string,
): Promise<{ profile: RecyclerProfileDto; fromBackend: boolean }> {
  const state = readSyncState()
  try {
    const res = await authorizedRequest<RecyclerProfileDto>(
      "recycler",
      "/api/v1/recycler/profile",
      {
        method: "PUT",
        body: JSON.stringify({
          facilityName: currentProfile.facilityName,
          representativeName: currentProfile.representativeName,
          businessAddress: nextAddress.trim() || currentProfile.businessAddress,
          latitude: nextLat,
          longitude: nextLng,
          contactPhone: currentProfile.contactPhone,
          operatingHours: currentProfile.operatingHours,
          description: currentProfile.description,
          legalPermitUrl: currentProfile.legalPermitUrl,
          businessPhotoUrl: currentProfile.businessPhotoUrl,
        }),
      },
    )

    writeSyncState({
      ...state,
      demoRecyclerLat: res.data.latitude,
      demoRecyclerLng: res.data.longitude,
      demoRecyclerAddress: res.data.businessAddress,
    })

    return { profile: res.data, fromBackend: true }
  } catch {
    const updated: RecyclerProfileDto = {
      ...currentProfile,
      latitude: nextLat,
      longitude: nextLng,
      businessAddress: nextAddress.trim() || currentProfile.businessAddress,
    }
    writeSyncState({
      ...state,
      demoRecyclerLat: nextLat,
      demoRecyclerLng: nextLng,
      demoRecyclerAddress: updated.businessAddress,
    })
    return { profile: updated, fromBackend: false }
  }
}

/* ------------------------------------------------------------------ Link 3a: Thẩm định hồ sơ Staff (S-04) */

const FALLBACK_COORDS_BY_ID: Record<string, { lat: number; lng: number }> = {
  "HS-0231": { lat: 10.7578, lng: 106.6785 },
  "HS-0228": { lat: 10.7692, lng: 106.6986 },
  "HS-0219": { lat: 10.8795, lng: 106.8032 },
  "HS-0210": { lat: 10.7885, lng: 106.6821 },
}

export function getInitialStaffApplications(): StaffApplicationView[] {
  return APPLICATIONS.map((a) => {
    const coords = FALLBACK_COORDS_BY_ID[a.id] ?? { lat: 21.0124, lng: 105.5253 }
    return {
      ...a,
      latitude: coords.lat,
      longitude: coords.lng,
      fromBackend: false,
    }
  })
}

function formatDateVi(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Hôm nay"
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}/${d.getFullYear()}`
}

function mapDtoToStaffView(dto: RecyclerApplicationDetailDto): StaffApplicationView {
  const status: Application["status"] =
    dto.verificationStatus === "Verified"
      ? "approved"
      : dto.verificationStatus === "Rejected"
        ? "rejected"
        : "pending"

  const docs: string[] = []
  if (dto.legalPermitUrl) docs.push("Giấy phép kinh doanh / pháp lý")
  if (dto.businessPhotoUrl) docs.push("Ảnh mặt tiền kho bãi")
  if (docs.length === 0) docs.push("Hồ sơ đăng ký điện tử")

  const rawDesc = dto.description?.replace(/^Thu mua:\s*/i, "").trim()

  return {
    id: `HS-${dto.userId.slice(0, 6).toUpperCase()}`,
    userId: dto.userId,
    name: dto.facilityName,
    representativeName: dto.representativeName ?? dto.applicantFullName,
    phone: dto.contactPhone,
    email: dto.email,
    address: dto.businessAddress,
    materials: rawDesc || "Nhựa, Giấy, Kim loại",
    docs,
    date: formatDateVi(dto.submittedAt),
    status,
    note: dto.rejectionReason ?? undefined,
    latitude: Number(dto.latitude) || 21.0124,
    longitude: Number(dto.longitude) || 105.5253,
    legalPermitUrl: dto.legalPermitUrl ?? undefined,
    businessPhotoUrl: dto.businessPhotoUrl ?? undefined,
    fromBackend: true,
  }
}

export async function fetchStaffApplications(): Promise<{
  items: StaffApplicationView[]
  fromBackend: boolean
}> {
  try {
    const res = await authorizedRequest<PagedResultDto<RecyclerApplicationDetailDto>>(
      "staff",
      "/api/v1/recycler-applications?pageNumber=1&pageSize=50&sortOrder=desc",
      { method: "GET" },
    )
    const mapped = res.data.items.map(mapDtoToStaffView)
    return { items: mapped, fromBackend: true }
  } catch {
    const state = readSyncState()
    const base = getInitialStaffApplications()
    const merged = [...state.customApplications, ...base]
    return { items: merged, fromBackend: false }
  }
}

export async function decideStaffApplication(
  app: StaffApplicationView,
  isApproved: boolean,
  rejectionReason?: string,
): Promise<{ updated: StaffApplicationView; fromBackend: boolean }> {
  if (app.userId) {
    try {
      const res = await authorizedRequest<RecyclerApplicationDetailDto>(
        "staff",
        `/api/v1/recycler-applications/${encodeURIComponent(app.userId)}/verification`,
        {
          method: "PUT",
          body: JSON.stringify({
            isApproved,
            rejectionReason: isApproved ? null : rejectionReason,
          }),
        },
      )
      return {
        updated: mapDtoToStaffView(res.data),
        fromBackend: true,
      }
    } catch (err) {
      if (err instanceof ApiError && !err.isNetworkError && err.status >= 400 && err.status < 500) {
        throw err
      }
    }
  }

  const nextStatus: Application["status"] = isApproved ? "approved" : "rejected"
  const updated: StaffApplicationView = {
    ...app,
    status: nextStatus,
    note: isApproved ? undefined : rejectionReason,
  }

  const state = readSyncState()
  const existsInCustom = state.customApplications.some((c) => c.id === app.id)
  const nextCustom = existsInCustom
    ? state.customApplications.map((c) => (c.id === app.id ? updated : c))
    : [updated, ...state.customApplications]

  writeSyncState({
    ...state,
    customApplications: nextCustom,
  })

  return { updated, fromBackend: false }
}

/* ------------------------------------------------------------------ Link 3b: Đặt lịch bàn giao & Điểm hẹn (U-07) */

const WASTE_ID_TO_CATEGORY: Record<string, string> = {
  pet: "plastic",
  hdpe: "plastic",
  carton: "cardboard",
  paper: "paper",
  alu: "metal",
  steel: "metal",
  glass: "glass",
}

const CATEGORY_TO_WASTE_ID: Record<string, string> = {
  plastic: "pet",
  cardboard: "carton",
  paper: "paper",
  metal: "alu",
  glass: "glass",
}

export interface CreateHandoverInput {
  partnerId?: string
  partnerName?: string
  rows: { wasteId: string; kg: number; unitPrice: number }[]
  slot: string
  pickupAddress: string
  pickupLat: number
  pickupLng: number
}

export async function createHandoverOrder(input: CreateHandoverInput): Promise<{
  orderCode: string
  syncedWithBackend: boolean
}> {
  const totalKg = input.rows.reduce((sum, r) => sum + r.kg, 0)
  const primary = input.rows[0]
  const categoryCode = primary ? (WASTE_ID_TO_CATEGORY[primary.wasteId] ?? "plastic") : "plastic"
  const partnerGuid =
    input.partnerId && /^[0-9a-fA-F-]{36}$/.test(input.partnerId)
      ? input.partnerId
      : "22222222-2222-2222-2222-222222222222"

  const now = new Date()
  const dd = String(now.getDate()).padStart(2, "0")
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const yyyy = now.getFullYear()

  let orderCode = `BH-${yyyy.toString().slice(-2)}${mm}-${String(Date.now()).slice(-4)}`
  let syncedWithBackend = false

  try {
    const res = await authorizedRequest<TradeOrderApiDto>("user", "/api/v1/trade/orders", {
      method: "POST",
      body: JSON.stringify({
        partnerId: partnerGuid,
        scheduledAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        estimatedWeightKg: totalKg,
        categoryCode,
        initialPricePerKg: primary?.unitPrice ?? 7000,
        proposedTimeSlot: input.slot,
        pickupAddress: input.pickupAddress.trim(),
        pickupLatitude: input.pickupLat,
        pickupLongitude: input.pickupLng,
        note: `Điểm hẹn bàn giao đầu ngõ/sảnh đã ghim trên bản đồ`,
      }),
    })

    const createdId = res.data?.id
    if (createdId) {
      orderCode = `BH-${createdId.slice(0, 6).toUpperCase()}`
    }
    syncedWithBackend = true
  } catch {
    syncedWithBackend = false
  }

  const state = readSyncState()
  writeSyncState({
    ...state,
    handoverOrders: [
      {
        id: orderCode,
        recyclerId: partnerGuid,
        recycler: input.partnerName || "Vựa phế liệu EcoGreen",
        address: input.pickupAddress.trim(),
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        date: `${dd}/${mm}/${yyyy}`,
        slot: input.slot,
        lines: input.rows.map((r) => ({ wasteId: r.wasteId, kg: r.kg })),
        status: "pending",
      },
      ...state.handoverOrders,
    ],
  })

  return { orderCode, syncedWithBackend }
}

export async function fetchSyncedHandoverOrders(role: "user" | "recycler") {
  const state = readSyncState()
  try {
    const targetUserId =
      role === "recycler"
        ? "22222222-2222-2222-2222-222222222222"
        : "11111111-1111-1111-1111-111111111111"

    const res = await authorizedRequest<TradeOrderApiDto[]>(
      role,
      `/api/v1/trade/orders?userId=${targetUserId}`,
      { method: "GET" },
    )

    const apiItems = (res.data ?? []).map((o) => {
      const wasteId = o.categoryCode
        ? (CATEGORY_TO_WASTE_ID[o.categoryCode.toLowerCase()] ?? "pet")
        : "pet"
      return {
        id: `BH-${o.id.slice(0, 6).toUpperCase()}`,
        recycler: o.partnerName || "Vựa phế liệu EcoGreen",
        address: o.pickupAddress || "Điểm hẹn khu vực trung tâm",
        pickupLat: o.pickupLatitude ?? undefined,
        pickupLng: o.pickupLongitude ?? undefined,
        date: formatDateVi(o.scheduledAt),
        slot: o.proposedTimeSlot || "09:00 – 11:00",
        lines: [{ wasteId, kg: Number(o.estimatedWeightKg) || 5 }],
        status: (o.status.toLowerCase() === "accepted" ? "accepted" : "pending") as
          | "pending"
          | "accepted",
      }
    })

    if (apiItems.length > 0) {
      return apiItems
    }
  } catch {
    // Dự phòng sang đơn lưu cục bộ
  }

  return state.handoverOrders
}

/**
 * Đồng bộ danh sách dự phòng ngoại tuyến trên `/map` với thao tác Bật/Tắt của Recycler
 * và các hồ sơ vừa được Staff duyệt khi chưa bật máy chủ Backend.
 */
export function applyOfflineWorkflowToPartners(
  basePartners: CollectionPartnerDto[],
): CollectionPartnerDto[] {
  const state = readSyncState()

  let next = basePartners
    .filter((p) => {
      if (p.id === "22222222-2222-2222-2222-222222222222" && !state.demoRecyclerOnline) {
        return false
      }
      return true
    })
    .map((p) => {
      if (p.id === "22222222-2222-2222-2222-222222222222") {
        return {
          ...p,
          latitude: state.demoRecyclerLat ?? p.latitude,
          longitude: state.demoRecyclerLng ?? p.longitude,
          address: state.demoRecyclerAddress ?? p.address,
        }
      }
      return p
    })

  const approvedOffline = state.customApplications.filter((a) => a.status === "approved")
  for (const app of approvedOffline) {
    if (next.some((p) => p.id === app.id || p.facilityName === app.name)) continue
    next = [
      {
        id: app.userId ?? app.id,
        facilityName: app.name,
        representativeName: app.representativeName ?? "Chủ cơ sở",
        address: app.address,
        latitude: app.latitude,
        longitude: app.longitude,
        distanceKm: 0,
        contactPhone: app.phone ?? "0901234567",
        operatingHours: "08:00 - 18:00",
        description: `Thu mua: ${app.materials}`,
        materials: [
          {
            categoryCode: "plastic",
            categoryName: "Nhựa tái chế (Plastic)",
            pricePerKg: 6900,
            minimumQuantityKg: 1,
          },
          {
            categoryCode: "paper",
            categoryName: "Giấy báo & Tài liệu (Paper)",
            pricePerKg: 4600,
            minimumQuantityKg: 2,
          },
          {
            categoryCode: "metal",
            categoryName: "Kim loại & Vỏ lon (Metal)",
            pricePerKg: 25000,
            minimumQuantityKg: 0.5,
          },
        ],
      },
      ...next,
    ]
  }

  return next
}

