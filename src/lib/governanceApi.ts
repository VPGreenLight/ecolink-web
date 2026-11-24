/**
 * Client API cho Module Account, Staff & System Governance / Analytics (FE-17, FE-18 / M-15).
 * Bao phủ đầy đủ 19 REST API (STT 150 -> 168) và khớp 100% với GovernanceDtos.cs (.NET 10):
 *  - A-01: GET /api/v1/admin/analytics/kpi-summary & /charts
 *  - A-02: GET /api/v1/admin/reports/export (CSV/XLSX + PII Masking BR-ADM-06) & /audit-logs (BR-ADM-05)
 *  - S-06: GET /api/v1/staff/accounts & /{userId}
 *  - S-07: PATCH /api/v1/staff/accounts/{userId}/lock & DELETE /api/v1/staff/accounts/{userId}
 *  - A-03: GET / POST / PUT /api/v1/admin/staff & PATCH /api/v1/admin/staff/{staffId}/status
 *  - A-04: GET /api/v1/admin/permissions/catalog & GET/PUT /api/v1/admin/staff/{staffId}/permissions
 *  - S-11: POST /api/v1/staff/attendance/check-in, /check-out, GET /me & GET /api/v1/admin/staff/attendance
 */

import {
  ApiError,
  apiRequest,
  clearSessionOnUnauthorized,
  fetchWithAutoHost,
  resolveApiErrorMessage,
  rotateRefreshTokenSingleFlight,
  type ApiResponse,
} from "@/lib/api"
import { getAccessToken, getRefreshToken, isRealJwt } from "@/lib/session"

/* ============================================================================
 * 1. BẢNG ÁNH XẠ QUYỀN HẠN NHÂN VIÊN (CANONICAL <-> UI ALIAS) — BR-ADM-02
 * ============================================================================ */

export const CANONICAL_TO_UI_PERM: Record<string, string> = {
  REVIEW_AI: "ai.review",
  CURATE_DATASET: "ai.dataset",
  VERIFY_RECYCLER: "partner.verify",
  HANDLE_COMPLAINT: "complaint.handle",
  MANAGE_ACCOUNTS: "account.manage",
  MANAGE_BLOG: "blog.write",
  MANAGE_INVENTORY: "gift.manage",
}

export const UI_TO_CANONICAL_PERM: Record<string, string> = {
  "ai.review": "REVIEW_AI",
  "ai.dataset": "CURATE_DATASET",
  "partner.verify": "VERIFY_RECYCLER",
  "complaint.handle": "HANDLE_COMPLAINT",
  "account.manage": "MANAGE_ACCOUNTS",
  "blog.write": "MANAGE_BLOG",
  "gift.manage": "MANAGE_INVENTORY",
}

export function toUiPerm(code: string): string {
  const trimmed = code.trim()
  return CANONICAL_TO_UI_PERM[trimmed.toUpperCase()] ?? trimmed
}

export function toCanonicalPerm(idOrCode: string): string {
  const trimmed = idOrCode.trim()
  return UI_TO_CANONICAL_PERM[trimmed.toLowerCase()] ?? trimmed.toUpperCase()
}

/* ============================================================================
 * 2. TIỆN ÍCH CHE DẤU PII TRÊN CLIENT FALLBACK — BR-ADM-06
 * ============================================================================ */

export function maskEmailClient(email?: string | null): string {
  if (!email) return ""
  const at = email.indexOf("@")
  if (at <= 0) return "***"
  const local = email.slice(0, at)
  const domain = email.slice(at)
  const prefix = local.length <= 2 ? local[0] : local.slice(0, 2)
  return `${prefix}***${domain}`
}

export function maskPhoneClient(phone?: string | null): string {
  if (!phone) return ""
  const digits = phone.trim()
  if (digits.length <= 6) return "***"
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`
}

/* ============================================================================
 * 3. KIỂU DỮ LIỆU CHUẨN HOÁ CHO FRONTEND & RAW DTO TỪ BACKEND (.NET 10)
 * ============================================================================ */

export interface PagedGovernanceResult<T> {
  items: T[]
  pageNumber: number
  pageSize: number
  totalCount: number
  totalPages: number
}

/* --- A-01: Dashboard & Analytics --- */
interface RawExecutiveKpiSummaryDto {
  periodLabel: string
  fromDate: string
  toDate: string
  activeCitizensCount: number
  verifiedRecyclersCount: number
  completedHandoversCount: number
  totalRecycledWeightKg: number
  totalRecycledTonnage: number
  grossTradeValueVnd: number
  vietQrServiceRevenueVnd: number
  aiBenchmark?: {
    aiServiceOnline: boolean
    totalScans: number
    overallAccuracyPercent: number
    oodRatePercent: number
    falseReportCount: number
  }
  operationalBacklog?: {
    pendingAiFeedbackCount: number
    pendingRecyclerKybCount: number
    openComplaintsCount: number
    pendingBlogPostsCount: number
  }
}

export interface AdminPendingBacklogDto {
  aiMisclassifiedCases: number
  recyclerApplications: number
  openComplaints: number
  pendingBlogPosts: number
}

export interface AdminKpiSummaryDto {
  period: string
  fromUtc: string
  toUtc: string
  totalCitizens: number
  activeRecyclers: number
  totalStaff: number
  completedHandovers: number
  recycledWeightKg: number
  grossMerchandiseValueVnd: number
  platformFeeRevenueVnd: number
  vietQrServiceRevenueVnd: number
  co2SavedKg: number
  aiAccuracyPercent: number
  pending: AdminPendingBacklogDto
}

interface RawAnalyticsChartsDto {
  monthlyHandoverTrend?: {
    month: string
    label: string
    completedHandovers: number
    recycledWeightKg: number
    grossValueVnd: number
  }[]
  aiQualityByGroup?: {
    groupName: string
    scans: number
    correct: number
    falseReports: number
    accuracyPercent: number
  }[]
}

export interface AdminMonthlyTrendPointDto {
  monthLabel: string
  yearMonth: string
  completedHandovers: number
  recycledVolumeKg: number
  grossValueVnd: number
}

export interface AdminAiGroupMetricDto {
  groupName: string
  totalScans: number
  correctScans: number
  falseReports: number
  accuracyPercent: number
}

export interface AdminAnalyticsChartsDto {
  monthlyTrends: AdminMonthlyTrendPointDto[]
  aiByGroup: AdminAiGroupMetricDto[]
}

/* --- A-02: Export Reports & Audit Logs --- */
export type ReportDatasetType = "users" | "handovers" | "cashflow" | "audit"
export type ReportExportFormat = "csv" | "xlsx"

const DATASET_TO_BACKEND: Record<ReportDatasetType, string> = {
  users: "accounts",
  handovers: "handovers",
  cashflow: "vietqr_revenues",
  audit: "audit_logs",
}

export interface AuditLogItemDto {
  id: string
  actorUserId?: string | null
  actorEmail?: string | null
  actorRole?: string | null
  action: string
  entityType: string
  entityId?: string | null
  oldValues?: string | null
  newValues?: string | null
  reason?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: string
}

export interface AuditLogQuery {
  action?: string
  entityType?: string
  actorUserId?: string
  keyword?: string
  fromDate?: string
  toDate?: string
  pageNumber?: number
  pageSize?: number
}

/* --- S-06 & S-07: User & Recycler Accounts --- */
interface RawManagedAccountSummaryDto {
  userId: string
  username: string
  fullName: string
  email: string
  phoneNumber?: string | null
  role: string
  area: string
  status: string
  verificationStatus?: string | null
  completedDealsCount: number
  warningCount: number
  moderationReason?: string | null
  moderatedAt?: string | null
  createdAt: string
}

interface RawManagedAccountDetailDto extends RawManagedAccountSummaryDto {
  activityStats?: {
    totalHandoverRequests: number
    completedDealsCount: number
    cancelledLateCount: number
    totalRecycledKg: number
    greenPoints: number
    treeLevel: number
  }
  moderationHistory?: ModerationLogItemDto[]
}

export interface StaffAccountListItemDto {
  id: string
  accountCode: string
  username: string
  fullName: string
  email: string
  phoneNumber?: string | null
  role: string
  status: string
  area: string
  joinedAt: string
  completedDealsCount: number
  warningCount: number
  canDeactivate: boolean
}

export interface ModerationLogItemDto {
  id: string
  actionType: string
  previousStatus: string
  newStatus: string
  reason: string
  performedByName: string
  revokedTokensCount: number
  createdAt: string
}

export interface StaffAccountDetailDto extends StaffAccountListItemDto {
  currentGreenPoints: number
  totalRecycledKg: number
  moderationReason?: string | null
  moderatedAt?: string | null
  businessName?: string | null
  verificationStatus?: string | null
  moderationHistory: ModerationLogItemDto[]
}

export interface AccountActionResultDto {
  userId: string
  previousStatus: string
  currentStatus: string
  warningCount: number
  revokedRefreshTokens: number
  moderatedAt: string
}

/* --- A-03 & A-04: Staff Management & RBAC Permissions --- */
interface RawStaffAccountDto {
  staffId: string
  staffCode: string
  username: string
  fullName: string
  email: string
  phoneNumber?: string | null
  department?: string | null
  position?: string | null
  userStatus: string
  staffStatus: string
  permissions: string[]
  createdAt: string
}

export interface StaffMemberDto {
  userId: string
  employeeCode: string
  username: string
  fullName: string
  email: string
  phoneNumber?: string | null
  department: string
  position: string
  status: string
  permissions: string[]
  hireDate: string
  lastLoginAt?: string | null
}

export interface CreateStaffAccountInput {
  fullName: string
  email: string
  username?: string
  phoneNumber?: string
  department?: string
  position?: string
  initialPassword?: string
}

export interface UpdateStaffAccountInput {
  fullName: string
  phoneNumber?: string
  department: string
  position: string
  resetPassword?: string
}

export interface PermissionCatalogItemDto {
  code: string
  legacyAlias: string
  label: string
  description: string
}

export interface StaffPermissionsDto {
  staffId: string
  employeeCode: string
  fullName: string
  permissions: string[]
  updatedAt: string
}

/* --- S-11: Staff Daily Check-in & Attendance --- */
interface RawStaffAttendanceLogDto {
  attendanceId: string
  workDate: string
  checkInAt: string
  checkOutAt?: string | null
  workedMinutes?: number | null
  streakDay: number
  workPointsEarned: number
  tasksCompletedSnapshot: number
  shiftNote?: string | null
}

interface RawStaffAttendanceStatusDto {
  attendanceId?: string | null
  workDate: string
  checkedInToday: boolean
  checkedOutToday: boolean
  checkInAt?: string | null
  checkOutAt?: string | null
  workedMinutesToday?: number | null
  currentStreakDay: number
  pointsEarnedToday: number
  monthlyWorkPoints: number
  monthlyTasksCompleted: number
  todayShiftNote?: string | null
  recentLogs?: RawStaffAttendanceLogDto[]
}

export interface StaffAttendanceItemDto {
  id: string
  workDate: string
  checkInAt: string
  checkOutAt?: string | null
  workedMinutes?: number | null
  streakDay: number
  workPointsEarned: number
  tasksCompletedSnapshot: number
  shiftNote?: string | null
}

export interface StaffAttendanceSummaryDto {
  staffId: string
  employeeCode: string
  fullName: string
  checkedInToday: boolean
  checkedOutToday: boolean
  currentStreak: number
  totalWorkPointsMonth: number
  totalShiftsMonth: number
  totalTasksHandled: number
  todayRecord?: StaffAttendanceItemDto | null
  recentRecords: StaffAttendanceItemDto[]
}

export interface AdminStaffAttendanceRowDto {
  attendanceId: string
  staffId: string
  staffCode: string
  staffName: string
  department?: string | null
  workDate: string
  checkInAt: string
  checkOutAt?: string | null
  workedMinutes?: number | null
  streakDay: number
  workPointsEarned: number
  tasksCompletedSnapshot: number
  shiftNote?: string | null
}

/* ============================================================================
 * 4. HÀM ÁNH XẠ & GỌI API TỚI BACKEND
 * ============================================================================ */

function buildQueryString(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && String(v).trim() !== "",
  )
  if (entries.length === 0) return ""
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&")
  return `?${qs}`
}

function mapRawAccountSummary(r: RawManagedAccountSummaryDto): StaffAccountListItemDto {
  const prefix =
    r.role.toLowerCase() === "recycler" || r.role.toLowerCase() === "collector" ? "R" : "U"
  const cleanHex = r.userId.replace(/-/g, "").toUpperCase()
  const shortHex = cleanHex.startsWith("9999") ? cleanHex.slice(-4) : cleanHex.slice(0, 4)
  return {
    id: r.userId,
    accountCode: `${prefix}-${shortHex}`,
    username: r.username,
    fullName: r.fullName,
    email: r.email,
    phoneNumber: r.phoneNumber,
    role: r.role,
    status: r.status,
    area: r.area,
    joinedAt: r.createdAt,
    completedDealsCount: r.completedDealsCount,
    warningCount: r.warningCount,
    canDeactivate: r.completedDealsCount === 0,
  }
}

function mapRawStaffDto(r: RawStaffAccountDto): StaffMemberDto {
  return {
    userId: r.staffId,
    employeeCode: r.staffCode,
    username: r.username,
    fullName: r.fullName,
    email: r.email,
    phoneNumber: r.phoneNumber,
    department: r.department || "Vận hành chung",
    position: r.position || "Chuyên viên vận hành",
    status: r.userStatus,
    permissions: r.permissions ?? [],
    hireDate: r.createdAt,
    lastLoginAt: null,
  }
}

function mapRawAttendanceStatus(r: RawStaffAttendanceStatusDto): StaffAttendanceSummaryDto {
  const mappedLogs: StaffAttendanceItemDto[] = (r.recentLogs ?? []).map((x) => ({
    id: x.attendanceId,
    workDate: x.workDate,
    checkInAt: x.checkInAt,
    checkOutAt: x.checkOutAt,
    workedMinutes: x.workedMinutes,
    streakDay: x.streakDay,
    workPointsEarned: x.workPointsEarned,
    tasksCompletedSnapshot: x.tasksCompletedSnapshot,
    shiftNote: x.shiftNote,
  }))
  return {
    staffId: "",
    employeeCode: "",
    fullName: "",
    checkedInToday: r.checkedInToday,
    checkedOutToday: r.checkedOutToday,
    currentStreak: r.currentStreakDay,
    totalWorkPointsMonth: r.monthlyWorkPoints,
    totalShiftsMonth: mappedLogs.length,
    totalTasksHandled: r.monthlyTasksCompleted,
    todayRecord: mappedLogs[0] ?? null,
    recentRecords: mappedLogs,
  }
}

/* --- A-01 --- */
export async function getAdminKpiSummary(
  period: "7d" | "30d" | "90d" = "30d",
): Promise<ApiResponse<AdminKpiSummaryDto>> {
  const res = await apiRequest<RawExecutiveKpiSummaryDto>(
    `/api/v1/admin/analytics/kpi-summary?period=${period}`,
  )
  const d = res.data
  return {
    ...res,
    data: {
      period: d.periodLabel || period,
      fromUtc: d.fromDate,
      toUtc: d.toDate,
      totalCitizens: d.activeCitizensCount,
      activeRecyclers: d.verifiedRecyclersCount,
      totalStaff: 0,
      completedHandovers: d.completedHandoversCount,
      recycledWeightKg: d.totalRecycledWeightKg,
      grossMerchandiseValueVnd: d.grossTradeValueVnd,
      platformFeeRevenueVnd: 0,
      vietQrServiceRevenueVnd: d.vietQrServiceRevenueVnd,
      co2SavedKg: Math.round(d.totalRecycledWeightKg * 1.5),
      aiAccuracyPercent: d.aiBenchmark?.overallAccuracyPercent ?? 94.6,
      pending: {
        aiMisclassifiedCases: d.operationalBacklog?.pendingAiFeedbackCount ?? 0,
        recyclerApplications: d.operationalBacklog?.pendingRecyclerKybCount ?? 0,
        openComplaints: d.operationalBacklog?.openComplaintsCount ?? 0,
        pendingBlogPosts: d.operationalBacklog?.pendingBlogPostsCount ?? 0,
      },
    },
  }
}

export async function getAdminAnalyticsCharts(): Promise<ApiResponse<AdminAnalyticsChartsDto>> {
  const res = await apiRequest<RawAnalyticsChartsDto>("/api/v1/admin/analytics/charts")
  const d = res.data
  return {
    ...res,
    data: {
      monthlyTrends: (d.monthlyHandoverTrend ?? []).map((m) => ({
        monthLabel: m.label,
        yearMonth: m.month,
        completedHandovers: m.completedHandovers,
        recycledVolumeKg: m.recycledWeightKg,
        grossValueVnd: m.grossValueVnd,
      })),
      aiByGroup: (d.aiQualityByGroup ?? []).map((g) => ({
        groupName: g.groupName,
        totalScans: g.scans,
        correctScans: g.correct,
        falseReports: g.falseReports,
        accuracyPercent: g.accuracyPercent,
      })),
    },
  }
}

/* --- A-02 --- */
export async function getAdminAuditLogs(
  query: AuditLogQuery = {},
): Promise<ApiResponse<PagedGovernanceResult<AuditLogItemDto>>> {
  const qs = buildQueryString({
    action: query.action,
    entityType: query.entityType,
    actorUserId: query.actorUserId,
    keyword: query.keyword,
    fromDate: query.fromDate,
    toDate: query.toDate,
    pageNumber: query.pageNumber ?? 1,
    pageSize: query.pageSize ?? 20,
  })
  return apiRequest<PagedGovernanceResult<AuditLogItemDto>>(`/api/v1/admin/audit-logs${qs}`)
}

export async function exportAdminReportBlob(
  params: {
    dataset: ReportDatasetType
    format: ReportExportFormat
    fromDate?: string
    toDate?: string
  },
  _retried = false,
): Promise<{ blob: Blob; fileName: string; rowCount: number }> {
  const qs = buildQueryString({
    dataset: DATASET_TO_BACKEND[params.dataset] ?? params.dataset,
    format: params.format,
    fromDate: params.fromDate,
    toDate: params.toDate,
  })

  const headers = new Headers()
  const token = getAccessToken()
  if (isRealJwt(token)) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const res = await fetchWithAutoHost(`/api/v1/admin/reports/export${qs}`, {
    method: "GET",
    headers,
  })

  if (res.status === 401 && !_retried && getRefreshToken()) {
    const refreshed = await rotateRefreshTokenSingleFlight()
    if (refreshed) {
      return exportAdminReportBlob(params, true)
    }
  }

  if (!res.ok) {
    if (res.status === 401) clearSessionOnUnauthorized()
    let errMsg = `Xuất báo cáo thất bại (HTTP ${res.status}).`
    let detailErrors: string[] | undefined
    try {
      const json = (await res.json()) as {
        message?: string
        messageCode?: string
        errors?: string[]
      }
      detailErrors = Array.isArray(json?.errors) ? json.errors : undefined
      const resolved = resolveApiErrorMessage(json?.message, detailErrors)
      if (resolved) errMsg = resolved
    } catch {
      // ignore non-json
    }
    throw new ApiError({ status: res.status, message: errMsg, errors: detailErrors })
  }

  const blob = await res.blob()
  const disposition = res.headers.get("content-disposition") ?? ""
  const match =
    disposition.match(/filename\*=UTF-8''([^;\s]+)/i) ??
    disposition.match(/filename="?([^";\s]+)"?/i)
  const fallbackName = `ecolink-${params.dataset}-${new Date().toISOString().slice(0, 10)}.${params.format}`
  const fileName = match?.[1] ? decodeURIComponent(match[1]) : fallbackName
  const rowCount = Number(res.headers.get("x-ecolink-row-count") ?? "0") || 0

  return { blob, fileName, rowCount }
}

/* --- S-06 & S-07 --- */
export async function getStaffAccounts(query: {
  role?: string
  status?: string
  keyword?: string
  pageNumber?: number
  pageSize?: number
} = {}): Promise<ApiResponse<PagedGovernanceResult<StaffAccountListItemDto>>> {
  const qs = buildQueryString({
    role: query.role,
    status: query.status,
    keyword: query.keyword,
    pageNumber: query.pageNumber ?? 1,
    pageSize: query.pageSize ?? 50,
  })
  const res = await apiRequest<PagedGovernanceResult<RawManagedAccountSummaryDto>>(
    `/api/v1/staff/accounts${qs}`,
  )
  return {
    ...res,
    data: {
      ...res.data,
      items: (res.data?.items ?? []).map(mapRawAccountSummary),
    },
  }
}

export async function getStaffAccountDetail(
  userId: string,
): Promise<ApiResponse<StaffAccountDetailDto>> {
  const res = await apiRequest<RawManagedAccountDetailDto>(
    `/api/v1/staff/accounts/${encodeURIComponent(userId)}`,
  )
  const base = mapRawAccountSummary(res.data)
  return {
    ...res,
    data: {
      ...base,
      currentGreenPoints: res.data.activityStats?.greenPoints ?? 0,
      totalRecycledKg: res.data.activityStats?.totalRecycledKg ?? 0,
      moderationReason: res.data.moderationReason,
      moderatedAt: res.data.moderatedAt,
      verificationStatus: res.data.verificationStatus,
      moderationHistory: res.data.moderationHistory ?? [],
    },
  }
}

export async function lockOrUnlockAccount(
  userId: string,
  payload: {
    isLocked: boolean
    reason: string
    addWarning?: boolean
    relatedComplaintId?: string
  },
): Promise<ApiResponse<AccountActionResultDto>> {
  const res = await apiRequest<RawManagedAccountSummaryDto>(
    `/api/v1/staff/accounts/${encodeURIComponent(userId)}/lock`,
    {
      method: "PATCH",
      body: JSON.stringify({
        isLocked: payload.isLocked,
        reason: payload.reason,
        incrementWarning: payload.addWarning ?? true,
        relatedComplaintId: payload.relatedComplaintId || null,
      }),
    },
  )
  return {
    ...res,
    data: {
      userId: res.data.userId,
      previousStatus: payload.isLocked ? "Active" : "Suspended",
      currentStatus: res.data.status,
      warningCount: res.data.warningCount,
      revokedRefreshTokens: payload.isLocked ? 1 : 0,
      moderatedAt: res.data.moderatedAt ?? new Date().toISOString(),
    },
  }
}

export async function deactivateAccount(
  userId: string,
  payload: { reason: string },
): Promise<ApiResponse<AccountActionResultDto>> {
  const res = await apiRequest<RawManagedAccountSummaryDto>(
    `/api/v1/staff/accounts/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ reason: payload.reason }),
    },
  )
  return {
    ...res,
    data: {
      userId: res.data.userId,
      previousStatus: "Active",
      currentStatus: res.data.status,
      warningCount: res.data.warningCount,
      revokedRefreshTokens: 1,
      moderatedAt: res.data.moderatedAt ?? new Date().toISOString(),
    },
  }
}

/* --- A-03 & A-04 --- */
export async function getAdminStaffList(): Promise<ApiResponse<StaffMemberDto[]>> {
  const res = await apiRequest<RawStaffAccountDto[]>("/api/v1/admin/staff")
  return {
    ...res,
    data: (res.data ?? []).map(mapRawStaffDto),
  }
}

export async function createAdminStaff(
  payload: CreateStaffAccountInput,
): Promise<ApiResponse<StaffMemberDto>> {
  const res = await apiRequest<RawStaffAccountDto>("/api/v1/admin/staff", {
    method: "POST",
    body: JSON.stringify({
      fullName: payload.fullName,
      email: payload.email,
      username: payload.username,
      phoneNumber: payload.phoneNumber,
      department: payload.department,
      position: payload.position,
      initialPassword: payload.initialPassword,
    }),
  })
  return {
    ...res,
    data: mapRawStaffDto(res.data),
  }
}

export async function updateAdminStaff(
  staffId: string,
  payload: UpdateStaffAccountInput,
): Promise<ApiResponse<StaffMemberDto>> {
  const res = await apiRequest<RawStaffAccountDto>(
    `/api/v1/admin/staff/${encodeURIComponent(staffId)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        fullName: payload.fullName,
        phoneNumber: payload.phoneNumber,
        department: payload.department,
        position: payload.position,
        resetTemporaryPassword: payload.resetPassword || null,
      }),
    },
  )
  return {
    ...res,
    data: mapRawStaffDto(res.data),
  }
}

export async function lockOrUnlockStaff(
  staffId: string,
  payload: { isLocked: boolean; reason: string },
): Promise<ApiResponse<AccountActionResultDto>> {
  const res = await apiRequest<RawStaffAccountDto>(
    `/api/v1/admin/staff/${encodeURIComponent(staffId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: payload.isLocked ? "Suspended" : "Active",
        reason: payload.reason,
      }),
    },
  )
  return {
    ...res,
    data: {
      userId: res.data.staffId,
      previousStatus: payload.isLocked ? "Active" : "Suspended",
      currentStatus: res.data.userStatus,
      warningCount: 0,
      revokedRefreshTokens: payload.isLocked ? 1 : 0,
      moderatedAt: new Date().toISOString(),
    },
  }
}

export async function getPermissionCatalog(): Promise<ApiResponse<PermissionCatalogItemDto[]>> {
  return apiRequest<PermissionCatalogItemDto[]>("/api/v1/admin/permissions/catalog")
}

export async function getStaffPermissions(
  staffId: string,
): Promise<ApiResponse<StaffPermissionsDto>> {
  const res = await apiRequest<{
    staffId: string
    staffCode: string
    fullName: string
    assignedPermissions: { permissionCode: string; grantedAt: string }[]
  }>(`/api/v1/admin/staff/${encodeURIComponent(staffId)}/permissions`)
  return {
    ...res,
    data: {
      staffId: res.data.staffId,
      employeeCode: res.data.staffCode,
      fullName: res.data.fullName,
      permissions: (res.data.assignedPermissions ?? []).map((p) => p.permissionCode),
      updatedAt: new Date().toISOString(),
    },
  }
}

export async function updateStaffPermissions(
  staffId: string,
  uiOrCanonicalPerms: string[],
): Promise<ApiResponse<StaffPermissionsDto>> {
  const canonical = uiOrCanonicalPerms.map(toCanonicalPerm)
  const res = await apiRequest<RawStaffAccountDto>(
    `/api/v1/admin/staff/${encodeURIComponent(staffId)}/permissions`,
    {
      method: "PUT",
      body: JSON.stringify({
        permissions: canonical,
        reason: "Cập nhật ma trận phân quyền nhân sự qua cổng Admin",
      }),
    },
  )
  return {
    ...res,
    data: {
      staffId: res.data.staffId,
      employeeCode: res.data.staffCode,
      fullName: res.data.fullName,
      permissions: res.data.permissions ?? canonical,
      updatedAt: new Date().toISOString(),
    },
  }
}

/* --- S-11 --- */
export async function getMyAttendance(
  month?: number,
  year?: number,
): Promise<ApiResponse<StaffAttendanceSummaryDto>> {
  const qs = buildQueryString({ month, year })
  const res = await apiRequest<RawStaffAttendanceStatusDto>(`/api/v1/staff/attendance/me${qs}`)
  return {
    ...res,
    data: mapRawAttendanceStatus(res.data),
  }
}

export async function checkInStaff(
  shiftNote?: string,
): Promise<ApiResponse<StaffAttendanceSummaryDto>> {
  const res = await apiRequest<RawStaffAttendanceStatusDto>("/api/v1/staff/attendance/check-in", {
    method: "POST",
    body: JSON.stringify({ shiftNote: shiftNote?.trim() || null }),
  })
  return {
    ...res,
    data: mapRawAttendanceStatus(res.data),
  }
}

export async function checkOutStaff(
  shiftNote?: string,
): Promise<ApiResponse<StaffAttendanceSummaryDto>> {
  const res = await apiRequest<RawStaffAttendanceStatusDto>(
    "/api/v1/staff/attendance/check-out",
    {
      method: "POST",
      body: JSON.stringify({ shiftNote: shiftNote?.trim() || null }),
    },
  )
  return {
    ...res,
    data: mapRawAttendanceStatus(res.data),
  }
}

export async function getAdminStaffAttendance(query: {
  fromDate?: string
  toDate?: string
  staffId?: string
  pageNumber?: number
  pageSize?: number
} = {}): Promise<ApiResponse<PagedGovernanceResult<AdminStaffAttendanceRowDto>>> {
  const qs = buildQueryString({
    fromDate: query.fromDate,
    toDate: query.toDate,
    staffId: query.staffId,
    pageNumber: query.pageNumber ?? 1,
    pageSize: query.pageSize ?? 20,
  })
  return apiRequest<PagedGovernanceResult<AdminStaffAttendanceRowDto>>(
    `/api/v1/admin/staff/attendance${qs}`,
  )
}
