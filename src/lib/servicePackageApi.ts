/**
 * Client API & Entitlement Store cho Module M-12 / FE-14:
 * Gói Dịch vụ Nội bộ (BASIC - PREMIUM - PRO) & Tích hợp Thanh toán VietQR Động.
 *
 * Bao phủ đầy đủ 15 REST API (STT 115 -> 129):
 *  - STT 115: POST /api/v1/service-payments/create
 *  - STT 116: GET  /api/v1/service-payments/orders/{orderCode}
 *  - STT 117: GET  /api/v1/service-payments/orders
 *  - STT 118: POST /api/v1/service-payments/webhook
 *  - STT 119: POST /api/v1/service-payments/simulate-transfer/{orderCode}
 *  - STT 120: GET  /api/v1/service-packages
 *  - STT 121: GET  /api/v1/service-packages/subscriptions/me
 *  - STT 122: POST /api/v1/service-payments/orders/{orderCode}/cancel
 *  - STT 123: GET  /api/v1/admin/service-packages
 *  - STT 124: POST /api/v1/admin/service-packages
 *  - STT 125: PUT  /api/v1/admin/service-packages/{packageId}
 *  - STT 126: PATCH /api/v1/admin/service-packages/{packageId}/status
 *  - STT 127: GET  /api/v1/admin/reconciliations/ledger
 *  - STT 128: PATCH /api/v1/admin/reconciliations/orders/{orderCode}/resolve
 *  - STT 129: GET  /api/v1/admin/reconciliations/export
 */

import { useSyncExternalStore } from "react"
import {
  ApiError,
  apiRequest,
  clearSessionOnUnauthorized,
  fetchWithAutoHost,
  rotateRefreshTokenSingleFlight,
  type ApiResponse,
} from "@/lib/api"
import { getAccessToken, getRefreshToken } from "@/lib/session"

export type ServiceTierName = "Basic" | "Premium" | "Pro"

export interface ServicePackageFeaturesDto {
  tierName: string
  adFree: boolean
  dailyPointMultiplier: number
  ecoPlusBadge: boolean
  verifiedBlueBadge: boolean
  featuredMapMarker: boolean
  mapPriorityBoost: number
}

export interface ProEligibilityReportDto {
  isEligible: boolean
  isReRegistration: boolean
  isKybAndProfileValid: boolean
  verificationStatus: string
  requiresProfileReverification: boolean
  isWarningLimitOk: boolean
  currentWarningCount: number
  maxAllowedWarnings: number
  isPositiveFeedbackMet: boolean
  averageRating: number
  totalReviews: number
  minRequiredRating: number
  minRequiredReviewsForRenewal: number
  isNotCurrentlyActivePro: boolean
  activeProExpiresAt?: string | null
  blockingReasons: string[]
}

export interface ServicePackageCatalogDto {
  id: string
  packageCode: string
  packageName: string
  targetRole: "User" | "Recycler" | "All" | string
  description?: string | null
  isDefaultFree: boolean
  requiresVerifiedKyb: boolean
  priceVnd: number
  durationDays: number
  displayOrder: number
  features: ServicePackageFeaturesDto
  isActive: boolean
  isEligible: boolean
  ineligibleReason?: string | null
  isCurrentPlan: boolean
  isIncludedInHigherPlan?: boolean
  canRenew?: boolean
  currentActiveExpiresAt?: string | null
  proEligibility?: ProEligibilityReportDto | null
}

export interface AdminServicePackageDto extends ServicePackageCatalogDto {
  activeSubscribersCount: number
  totalPaidOrdersCount: number
  totalRevenueVnd: number
  createdAt: string
  updatedAt?: string | null
  updatedBy?: string | null
}

export interface UpsertServicePackageRequest {
  packageCode: string
  packageName: string
  targetRole: "User" | "Recycler" | "All"
  description?: string
  priceVnd: number
  durationDays: number
  requiresVerifiedKyb: boolean
  displayOrder?: number
  isActive: boolean
  features: ServicePackageFeaturesDto
}

export interface UserEntitlementSummaryDto {
  currentTier: ServiceTierName | string
  isAdFree: boolean
  dailyPointMultiplier: number
  hasEcoPlusBadge: boolean
  hasVerifiedBlueBadge: boolean
  isFeaturedMapMarker: boolean
  mapPriorityBoost: number
}

export interface ActiveSubscriptionDto {
  subscriptionId: string
  packageId: string
  packageCode: string
  packageName: string
  sourceOrderCode: string
  startsAt: string
  expiresAt: string
  remainingDays: number
  status: string
  features: ServicePackageFeaturesDto
}

export interface MySubscriptionsResponseDto {
  currentTier: ServiceTierName | string
  entitlements: UserEntitlementSummaryDto
  activeSubscriptions: ActiveSubscriptionDto[]
  pastSubscriptions: ActiveSubscriptionDto[]
}

export interface PayInOrderDto {
  id: string
  userId: string
  packageId: string
  packageCode: string
  packageName: string
  durationDays: number
  orderCode: string
  amount: number
  paidAmount?: number | null
  description: string
  transferContent: string
  bankCode: string
  bankName: string
  accountNo: string
  accountName: string
  qrCodeUrl: string
  qrPayload?: string | null
  checkoutUrl?: string | null
  status: string
  reconciliationStatus: string
  anomalyType: string
  anomalyNote?: string | null
  createdAt: string
  expiresAt: string
  paidAt?: string | null
  transactionReference?: string | null
  activatedSubscription?: ActiveSubscriptionDto | null
}

export interface PagedOrdersResult {
  items: PayInOrderDto[]
  pageNumber: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

export interface ReconciliationSummaryDto {
  totalMatchedRevenueVnd: number
  pendingOrdersCount: number
  openAnomaliesCount: number
  totalDiscrepancyVnd: number
  totalRefundedVnd: number
}

export interface ReconciliationLedgerItemDto {
  recordType: "Order" | "OrphanWebhook" | string
  referenceCode: string
  userId?: string | null
  payerName: string
  payerEmail?: string | null
  payerPhone?: string | null
  payerRole?: string | null
  packageCode?: string | null
  packageName?: string | null
  expectedAmountVnd: number
  paidAmountVnd: number
  discrepancyVnd: number
  bankCode: string
  paymentReference?: string | null
  orderStatus: string
  reconciliationStatus: string
  anomalyType: string
  anomalyNote?: string | null
  rawWebhookJson?: string | null
  resolvedByName?: string | null
  resolvedAt?: string | null
  resolutionNote?: string | null
  resolutionBankRef?: string | null
  createdAt: string
  paidAt?: string | null
}

export interface ReconciliationLedgerResponseDto {
  summary: ReconciliationSummaryDto
  items: {
    items: ReconciliationLedgerItemDto[]
    pageNumber: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

export type ReconciliationActionType =
  | "ApproveAndActivate"
  | "ManualMatchOrder"
  | "MarkRefunded"
  | "MarkExcessRefunded"
  | "CloseAnomaly"

export interface ResolvePaymentAnomalyRequest {
  action: ReconciliationActionType
  targetOrderCode?: string | null
  resolutionBankRef?: string | null
  resolutionNote: string
}

/* ============================================================================
 * 1. BỘ NHỚ QUYỀN LỢI SSR-SAFE (External Store giữ Object.is ổn định)
 * ============================================================================ */

const ENTITLEMENT_KEY = "ecolink:m12_entitlements"
const DEFAULT_ENTITLEMENTS: UserEntitlementSummaryDto = {
  currentTier: "Basic",
  isAdFree: false,
  dailyPointMultiplier: 1.0,
  hasEcoPlusBadge: false,
  hasVerifiedBlueBadge: false,
  isFeaturedMapMarker: false,
  mapPriorityBoost: 0,
}

let cachedEntitlements: UserEntitlementSummaryDto = DEFAULT_ENTITLEMENTS
let entitlementsPrimed = false
const entitlementListeners = new Set<() => void>()

function emitEntitlements() {
  entitlementListeners.forEach((l) => l())
}

function readEntitlements(): UserEntitlementSummaryDto {
  if (typeof localStorage === "undefined") return DEFAULT_ENTITLEMENTS
  try {
    const raw = localStorage.getItem(ENTITLEMENT_KEY)
    if (!raw) return DEFAULT_ENTITLEMENTS
    return { ...DEFAULT_ENTITLEMENTS, ...(JSON.parse(raw) as Partial<UserEntitlementSummaryDto>) }
  } catch {
    return DEFAULT_ENTITLEMENTS
  }
}

function getEntitlementSnapshot(): UserEntitlementSummaryDto {
  if (!entitlementsPrimed) {
    cachedEntitlements = readEntitlements()
    entitlementsPrimed = true
  }
  return cachedEntitlements
}

function getEntitlementServerSnapshot(): UserEntitlementSummaryDto {
  return DEFAULT_ENTITLEMENTS
}

export function setLocalEntitlements(next: UserEntitlementSummaryDto) {
  cachedEntitlements = next
  entitlementsPrimed = true
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(ENTITLEMENT_KEY, JSON.stringify(next))
    } catch {
      // ignore storage quota errors
    }
  }
  emitEntitlements()
}

export function clearLocalEntitlements() {
  cachedEntitlements = DEFAULT_ENTITLEMENTS
  entitlementsPrimed = true
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(ENTITLEMENT_KEY)
    } catch {
      // ignore
    }
  }
  emitEntitlements()
}

export function useEntitlements(): UserEntitlementSummaryDto {
  return useSyncExternalStore(
    (onChange) => {
      entitlementListeners.add(onChange)
      return () => entitlementListeners.delete(onChange)
    },
    getEntitlementSnapshot,
    getEntitlementServerSnapshot,
  )
}

if (typeof window !== "undefined") {
  window.addEventListener("ecolink:auth-cleared", () => {
    clearLocalEntitlements()
  })
}

/* ============================================================================
 * 2. DỮ LIỆU DỰ PHÒNG NGOẠI TUYẾN CHUẨN 3 GÓI (BASIC - PREMIUM - PRO)
 * ============================================================================ */

export const CANONICAL_FALLBACK_PACKAGES: AdminServicePackageDto[] = [
  {
    id: "51000001-0000-0000-0000-000000000001",
    packageCode: "BASIC",
    packageName: "Basic (Mặc định)",
    targetRole: "All",
    description:
      "Gói mặc định miễn phí với đầy đủ tính năng phân loại rác AI và bàn giao cơ bản.",
    isDefaultFree: true,
    requiresVerifiedKyb: false,
    priceVnd: 0,
    durationDays: 0,
    displayOrder: 10,
    features: {
      tierName: "Basic",
      adFree: false,
      dailyPointMultiplier: 1.0,
      ecoPlusBadge: false,
      verifiedBlueBadge: false,
      featuredMapMarker: false,
      mapPriorityBoost: 0,
    },
    isActive: true,
    isEligible: true,
    isCurrentPlan: true,
    activeSubscribersCount: 1240,
    totalPaidOrdersCount: 0,
    totalRevenueVnd: 0,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "51000001-0000-0000-0000-000000000002",
    packageCode: "PREMIUM",
    packageName: "Premium (Tắt quảng cáo)",
    targetRole: "All",
    description:
      "Tắt hoàn toàn banner quảng cáo trong 30 ngày kèm đặc quyền hội viên EcoPlus (+20% điểm điểm danh).",
    isDefaultFree: false,
    requiresVerifiedKyb: false,
    priceVnd: 59000,
    durationDays: 30,
    displayOrder: 20,
    features: {
      tierName: "Premium",
      adFree: true,
      dailyPointMultiplier: 1.2,
      ecoPlusBadge: true,
      verifiedBlueBadge: false,
      featuredMapMarker: false,
      mapPriorityBoost: 0,
    },
    isActive: true,
    isEligible: true,
    isCurrentPlan: false,
    activeSubscribersCount: 186,
    totalPaidOrdersCount: 214,
    totalRevenueVnd: 12626000,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "51000002-0000-0000-0000-000000000001",
    packageCode: "PRO",
    packageName: "Pro (Tích xanh & Ưu tiên bản đồ)",
    targetRole: "Recycler",
    description:
      "Gói thương mại 1 năm (~83.300đ/tháng) cho Cơ sở thu mua đã xác minh KYB: Tắt quảng cáo, Huy hiệu Tích xanh và Ghim Nổi bật đầu bản đồ.",
    isDefaultFree: false,
    requiresVerifiedKyb: true,
    priceVnd: 1000000,
    durationDays: 365,
    displayOrder: 30,
    features: {
      tierName: "Pro",
      adFree: true,
      dailyPointMultiplier: 1.2,
      ecoPlusBadge: true,
      verifiedBlueBadge: true,
      featuredMapMarker: true,
      mapPriorityBoost: 100,
    },
    isActive: true,
    isEligible: true,
    isCurrentPlan: false,
    activeSubscribersCount: 38,
    totalPaidOrdersCount: 41,
    totalRevenueVnd: 41000000,
    createdAt: "2026-01-01T00:00:00Z",
  },
]

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      sp.set(k, String(v))
    }
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

/* ============================================================================
 * 3. CÁC HÀM GỌI API CHUẨN BACKEND (.NET 10)
 * ============================================================================ */

/** [STT 120] Lấy bảng giá các gói dịch vụ đang mở bán. */
export async function getAvailableServicePackages(
  targetRole?: string,
): Promise<ApiResponse<ServicePackageCatalogDto[]>> {
  const qs = buildQuery({ targetRole })
  return apiRequest<ServicePackageCatalogDto[]>(`/api/v1/service-packages${qs}`)
}

/** [STT 121] Lấy gói đặc quyền & thời hạn cộng dồn hiện tại của tài khoản. */
export async function getMyServiceSubscriptions(): Promise<ApiResponse<MySubscriptionsResponseDto>> {
  const res = await apiRequest<MySubscriptionsResponseDto>("/api/v1/service-packages/subscriptions/me")
  if (res.success && res.data?.entitlements) {
    setLocalEntitlements(res.data.entitlements)
  }
  return res
}

/** Đồng bộ an toàn quyền lợi khi phiên trình duyệt đã có token. */
export async function refreshMyEntitlementsSafely(): Promise<void> {
  if (!getAccessToken()) return
  try {
    await getMyServiceSubscriptions()
  } catch {
    // giữ nguyên cache hiện tại nếu mạng tạm gián đoạn
  }
}

/** [STT 115] Khởi tạo đơn mua gói dịch vụ và sinh mã VietQR động. */
export async function createServicePaymentOrder(payload: {
  packageId?: string
  packageCode: string
  description?: string
}): Promise<ApiResponse<PayInOrderDto>> {
  return apiRequest<PayInOrderDto>("/api/v1/service-payments/create", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

/** [STT 116] Tra cứu trạng thái đơn thanh toán theo mã đơn. */
export async function getServiceOrderStatus(orderCode: string): Promise<ApiResponse<PayInOrderDto>> {
  return apiRequest<PayInOrderDto>(
    `/api/v1/service-payments/orders/${encodeURIComponent(orderCode)}`,
  )
}

/** [STT 117] Danh sách hóa đơn thanh toán dịch vụ của tài khoản đang đăng nhập. */
export async function getMyServiceOrders(query: {
  status?: string
  pageNumber?: number
  pageSize?: number
} = {}): Promise<ApiResponse<PagedOrdersResult>> {
  const qs = buildQuery({
    status: query.status,
    pageNumber: query.pageNumber ?? 1,
    pageSize: query.pageSize ?? 10,
  })
  return apiRequest<PagedOrdersResult>(`/api/v1/service-payments/orders${qs}`)
}

/** [STT 122] Hủy đơn thanh toán VietQR đang chờ (Pending). */
export async function cancelPendingServiceOrder(
  orderCode: string,
  reason?: string,
): Promise<ApiResponse<PayInOrderDto>> {
  return apiRequest<PayInOrderDto>(
    `/api/v1/service-payments/orders/${encodeURIComponent(orderCode)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    },
  )
}

/** [STT 119] Giả lập chuyển khoản VietQR (Exact / Underpaid / Overpaid / LateTransfer / Unmatched). */
export async function simulateVietQrTransfer(
  orderCode: string,
  scenario: "Exact" | "Underpaid" | "Overpaid" | "LateTransfer" | "Unmatched" = "Exact",
  simulatedAmount?: number,
): Promise<ApiResponse<PayInOrderDto>> {
  return apiRequest<PayInOrderDto>(
    `/api/v1/service-payments/simulate-transfer/${encodeURIComponent(orderCode)}`,
    {
      method: "POST",
      body: JSON.stringify({
        scenario,
        simulatedAmount: simulatedAmount ?? null,
      }),
    },
  )
}

/* --- A-10: Quản trị Gói Dịch vụ & Biểu phí --- */

/** [STT 123] Lấy toàn bộ gói dịch vụ kèm thống kê doanh thu & thuê bao cho Admin. */
export async function getAdminServicePackages(query: {
  search?: string
  targetRole?: string
  isActive?: boolean
} = {}): Promise<ApiResponse<AdminServicePackageDto[]>> {
  const qs = buildQuery(query)
  return apiRequest<AdminServicePackageDto[]>(`/api/v1/admin/service-packages${qs}`)
}

/** [STT 124] Admin tạo gói dịch vụ mới. */
export async function createAdminServicePackage(
  payload: UpsertServicePackageRequest,
): Promise<ApiResponse<AdminServicePackageDto>> {
  return apiRequest<AdminServicePackageDto>("/api/v1/admin/service-packages", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

/** [STT 125] Admin cập nhật biểu phí & thông tin gói dịch vụ. */
export async function updateAdminServicePackage(
  packageId: string,
  payload: UpsertServicePackageRequest,
): Promise<ApiResponse<AdminServicePackageDto>> {
  return apiRequest<AdminServicePackageDto>(
    `/api/v1/admin/service-packages/${encodeURIComponent(packageId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  )
}

/** [STT 126] Admin bật/tắt trạng thái mở bán gói dịch vụ. */
export async function toggleAdminServicePackageStatus(
  packageId: string,
  isActive: boolean,
  reason?: string,
): Promise<ApiResponse<AdminServicePackageDto>> {
  return apiRequest<AdminServicePackageDto>(
    `/api/v1/admin/service-packages/${encodeURIComponent(packageId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive, reason }),
    },
  )
}

/* --- A-11: Quản trị Sổ cái & Đối soát Bất thường VietQR --- */

/** [STT 127] Truy vấn sổ cái đối soát tài chính & giao dịch bất thường. */
export async function getAdminReconciliationLedger(query: {
  reconciliationStatus?: string
  anomalyType?: string
  onlyAnomalies?: boolean
  search?: string
  fromDate?: string
  toDate?: string
  pageNumber?: number
  pageSize?: number
} = {}): Promise<ApiResponse<ReconciliationLedgerResponseDto>> {
  const qs = buildQuery({
    reconciliationStatus: query.reconciliationStatus,
    anomalyType: query.anomalyType,
    onlyAnomalies: query.onlyAnomalies ? true : undefined,
    search: query.search,
    fromDate: query.fromDate,
    toDate: query.toDate,
    pageNumber: query.pageNumber ?? 1,
    pageSize: query.pageSize ?? 10,
  })
  return apiRequest<ReconciliationLedgerResponseDto>(
    `/api/v1/admin/reconciliations/ledger${qs}`,
  )
}

/** [STT 128] Đối soát thủ công giao dịch bất thường (ECO... hoặc WH-...). */
export async function resolveReconciliationAnomaly(
  orderCode: string,
  payload: ResolvePaymentAnomalyRequest,
): Promise<ApiResponse<ReconciliationLedgerItemDto>> {
  return apiRequest<ReconciliationLedgerItemDto>(
    `/api/v1/admin/reconciliations/orders/${encodeURIComponent(orderCode)}/resolve`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  )
}

/** [STT 129] Xuất bảng kê đối soát dòng tiền VietQR (CSV UTF-8 BOM / XLSX) ẩn danh PII. */
export async function exportReconciliationReportBlob(
  params: {
    format: "csv" | "xlsx"
    reconciliationStatus?: string
    fromDate?: string
    toDate?: string
  },
  _retried = false,
): Promise<{ blob: Blob; fileName: string; rowCount: number }> {
  const qs = buildQuery(params)
  const headers = new Headers()
  const token = getAccessToken()
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const res = await fetchWithAutoHost(`/api/v1/admin/reconciliations/export${qs}`, {
    method: "GET",
    headers,
  })

  if (res.status === 401 && !_retried && getRefreshToken()) {
    const refreshed = await rotateRefreshTokenSingleFlight()
    if (refreshed) {
      return exportReconciliationReportBlob(params, true)
    }
  }

  if (!res.ok) {
    if (res.status === 401) clearSessionOnUnauthorized()
    let errMsg = `Xuất bảng kê đối soát thất bại (HTTP ${res.status}).`
    try {
      const json = (await res.json()) as { message?: string }
      if (json?.message) errMsg = json.message
    } catch {
      // ignore non-json
    }
    throw new ApiError({ status: res.status, message: errMsg })
  }

  const blob = await res.blob()
  const disposition = res.headers.get("content-disposition") ?? ""
  const match =
    disposition.match(/filename\*=UTF-8''([^;\s]+)/i) ??
    disposition.match(/filename="?([^";\s]+)"?/i)
  const fallbackName = `ecolink-reconciliation-${new Date().toISOString().slice(0, 10)}.${params.format}`
  const fileName = match?.[1] ? decodeURIComponent(match[1]) : fallbackName
  const rowCount = Number(res.headers.get("x-ecolink-row-count") ?? "0") || 0

  return { blob, fileName, rowCount }
}
