/**
 * Client API cho Module AI Misclassification Feedback & Dataset Curation (FE-15 / M-13).
 * Bao phủ đầy đủ 10 Core REST APIs (STT 130 -> 139):
 *  - U-04: GET /api/v1/waste-scan/feedback/me
 *  - S-01: GET /api/v1/staff/ai-feedback, /{id}, PATCH /{id}/review
 *  - S-02: GET /api/v1/staff/ai-labeling/queue, PUT /{itemId}, POST /batch-assign
 *  - S-03: GET /api/v1/staff/ai-datasets, POST /versions, GET /versions/{id}/export
 */

import {
  ApiError,
  apiRequest,
  clearSessionOnUnauthorized,
  fetchWithAutoHost,
  rotateRefreshTokenSingleFlight,
  type ApiResponse,
} from "@/lib/api"
import { getAccessToken, getRefreshToken, isRealJwt } from "@/lib/session"
import type { DetectedWasteObjectDto } from "@/lib/wasteScanApi"

export interface YoloBoundingBoxDto {
  categoryCode: string
  xCenter: number
  yCenter: number
  width: number
  height: number
}

export interface PagedCurationResult<T> {
  items: T[]
  pageNumber: number
  pageSize: number
  totalRecords: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export interface MyAiFeedbackReportDto {
  id: string
  scanId?: string | null
  imageUrl: string
  modelUsed: string
  predictedLabel: string
  confidenceScore: number
  userReportedLabel: string
  adminVerifiedLabel?: string | null
  status: "Pending" | "Reviewed" | "Rejected" | string
  reviewDecision?: string | null
  note?: string | null
  reviewNote?: string | null
  createdAt: string
  reviewedAt?: string | null
}

export interface StaffAiFeedbackSummaryDto {
  id: string
  scanId?: string | null
  imageUrl: string
  modelUsed: string
  predictedLabel: string
  confidenceScore: number
  userReportedLabel: string
  adminVerifiedLabel?: string | null
  status: "Pending" | "Reviewed" | "Rejected" | string
  reviewDecision?: string | null
  reporterName: string
  note?: string | null
  reviewNote?: string | null
  datasetItemId?: string | null
  inDataset: boolean
  createdAt: string
  reviewedAt?: string | null
}

export interface StaffAiFeedbackQueueDto {
  items: StaffAiFeedbackSummaryDto[]
  pageNumber: number
  pageSize: number
  totalRecords: number
  totalPages: number
  pendingCount: number
  reviewedCount: number
  rejectedCount: number
}

export interface StaffAiFeedbackDetailDto {
  id: string
  scanId?: string | null
  imageUrl: string
  imageSha256?: string | null
  imageWidth: number
  imageHeight: number
  modelUsed: string
  predictedLabel: string
  confidenceScore: number
  userReportedLabel: string
  adminVerifiedLabel?: string | null
  status: string
  reviewDecision?: string | null
  note?: string | null
  reviewNote?: string | null
  reporterName: string
  reporterRole: string
  reviewedByStaffName?: string | null
  datasetItemId?: string | null
  datasetItemStatus?: string | null
  detectedObjectsSnapshot: DetectedWasteObjectDto[]
  existingYoloAnnotations: YoloBoundingBoxDto[]
  createdAt: string
  reviewedAt?: string | null
}

export interface ReviewAiFeedbackPayload {
  decision: "ApproveAndLabel" | "ApproveToQueue" | "Reject"
  verifiedLabel?: string
  reviewNote?: string
  yoloAnnotations?: YoloBoundingBoxDto[]
}

export interface AiDatasetItemDto {
  id: string
  sourceType: "UserFeedback" | "LowConfidenceAuto" | "StaffUpload" | "BenchmarkSeed" | string
  sourceScanId?: string | null
  sourceFeedbackId?: string | null
  imageUrl: string
  imageSha256: string
  imageWidth: number
  imageHeight: number
  predictedLabel?: string | null
  predictedConfidence?: number | null
  groundTruthLabel?: string | null
  status: "Unlabeled" | "VerifiedLabeled" | "Excluded" | string
  stickySplit?: "Train" | "Validation" | "Test" | null
  qualityNote?: string | null
  labeledByStaffName?: string | null
  labeledAt?: string | null
  createdAt: string
  yoloAnnotations: YoloBoundingBoxDto[]
}

export interface AiDatasetSummaryMetricsDto {
  totalPoolItems: number
  verifiedLabeledCount: number
  unlabeledCount: number
  excludedCount: number
  stickyTrainCount: number
  stickyValidationCount: number
  stickyTestCount: number
  imbalanceRatio: number
  isBalanced: boolean
  weakestCategory?: string | null
  empiricalAccuracyPercent: number
}

export interface AiDatasetCategoryStatDto {
  categoryCode: string
  categoryName: string
  totalVerified: number
  trainCount: number
  valCount: number
  testCount: number
  unassignedCount: number
  verifiedFeedbackCount: number
  falseReportCount: number
  accuracyPercent: number
  needsMoreSamples: boolean
}

export interface AiDatasetVersionDto {
  id: string
  versionCode: string
  versionName: string
  description?: string | null
  trainRatio: number
  valRatio: number
  testRatio: number
  totalSamples: number
  trainCount: number
  valCount: number
  testCount: number
  imbalanceRatio: number
  isBalanced: boolean
  status: "Published" | "SyncedToAi" | "Archived" | string
  syncedToAiAt?: string | null
  createdByStaffName: string
  createdAt: string
  aiSyncWarning?: string | null
  classDistribution: Record<string, Record<string, number>>
}

export interface AiDatasetDashboardDto {
  summary: AiDatasetSummaryMetricsDto
  byCategory: AiDatasetCategoryStatDto[]
  versions: AiDatasetVersionDto[]
}

export interface CreateDatasetVersionPayload {
  versionCode: string
  versionName: string
  description?: string
  trainRatio: number
  valRatio: number
  testRatio: number
  syncToAiService: boolean
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== "") {
      qs.set(k, String(v))
    }
  }
  const str = qs.toString()
  return str ? `?${str}` : ""
}

/* --- U-04: Lịch sử báo sai cá nhân --- */
export async function fetchMyAiFeedback(params: {
  status?: string
  pageNumber?: number
  pageSize?: number
} = {}): Promise<ApiResponse<PagedCurationResult<MyAiFeedbackReportDto>>> {
  const qs = buildQuery({
    status: params.status,
    pageNumber: params.pageNumber ?? 1,
    pageSize: params.pageSize ?? 20,
  })
  return apiRequest<PagedCurationResult<MyAiFeedbackReportDto>>(
    `/api/v1/waste-scan/feedback/me${qs}`,
  )
}

/* --- S-01: Hàng đợi thẩm định báo cáo sai --- */
export async function fetchStaffAiFeedbackQueue(params: {
  status?: string
  predictedLabel?: string
  userReportedLabel?: string
  maxConfidence?: number
  search?: string
  pageNumber?: number
  pageSize?: number
} = {}): Promise<ApiResponse<StaffAiFeedbackQueueDto>> {
  const qs = buildQuery({
    status: params.status,
    predictedLabel: params.predictedLabel,
    userReportedLabel: params.userReportedLabel,
    maxConfidence: params.maxConfidence,
    search: params.search,
    pageNumber: params.pageNumber ?? 1,
    pageSize: params.pageSize ?? 20,
  })
  return apiRequest<StaffAiFeedbackQueueDto>(`/api/v1/staff/ai-feedback${qs}`)
}

export async function fetchStaffAiFeedbackDetail(
  reportId: string,
): Promise<ApiResponse<StaffAiFeedbackDetailDto>> {
  return apiRequest<StaffAiFeedbackDetailDto>(`/api/v1/staff/ai-feedback/${reportId}`)
}

export async function reviewStaffAiFeedback(
  reportId: string,
  payload: ReviewAiFeedbackPayload,
): Promise<ApiResponse<StaffAiFeedbackDetailDto>> {
  return apiRequest<StaffAiFeedbackDetailDto>(`/api/v1/staff/ai-feedback/${reportId}/review`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

/* --- S-02: Kho ảnh gán nhãn Ground-Truth & Batch --- */
export async function fetchAiLabelingQueue(params: {
  status?: string
  sourceType?: string
  groundTruthLabel?: string
  predictedLabel?: string
  unlabeledOnly?: boolean
  pageNumber?: number
  pageSize?: number
} = {}): Promise<ApiResponse<PagedCurationResult<AiDatasetItemDto>>> {
  const qs = buildQuery({
    status: params.status,
    sourceType: params.sourceType,
    groundTruthLabel: params.groundTruthLabel,
    predictedLabel: params.predictedLabel,
    unlabeledOnly: params.unlabeledOnly,
    pageNumber: params.pageNumber ?? 1,
    pageSize: params.pageSize ?? 30,
  })
  return apiRequest<PagedCurationResult<AiDatasetItemDto>>(`/api/v1/staff/ai-labeling/queue${qs}`)
}

export async function assignGroundTruthLabel(
  itemId: string,
  payload: {
    groundTruthLabel?: string
    excludeFromDataset?: boolean
    qualityNote?: string
    yoloAnnotations?: YoloBoundingBoxDto[]
  },
): Promise<ApiResponse<AiDatasetItemDto>> {
  return apiRequest<AiDatasetItemDto>(`/api/v1/staff/ai-labeling/${itemId}`, {
    method: "PUT",
    body: JSON.stringify({
      groundTruthLabel: payload.groundTruthLabel ?? null,
      excludeFromDataset: Boolean(payload.excludeFromDataset),
      qualityNote: payload.qualityNote?.trim() || null,
      yoloAnnotations: payload.yoloAnnotations ?? null,
    }),
  })
}

export async function batchAssignAiLabels(payload: {
  itemIds: string[]
  groundTruthLabel: string
  qualityNote?: string
}): Promise<ApiResponse<{ updatedCount: number; groundTruthLabel: string; updatedItemIds: string[] }>> {
  return apiRequest<{ updatedCount: number; groundTruthLabel: string; updatedItemIds: string[] }>(
    "/api/v1/staff/ai-labeling/batch-assign",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  )
}

/* --- S-03: Quản trị phiên bản Dataset Sticky Stratified Split & ZIP Export --- */
export async function fetchAiDatasetDashboard(): Promise<ApiResponse<AiDatasetDashboardDto>> {
  return apiRequest<AiDatasetDashboardDto>("/api/v1/staff/ai-datasets")
}

export async function createAiDatasetVersion(
  payload: CreateDatasetVersionPayload,
): Promise<ApiResponse<AiDatasetVersionDto>> {
  return apiRequest<AiDatasetVersionDto>("/api/v1/staff/ai-datasets/versions", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function downloadDatasetVersionZip(
  versionId: string,
  format: "yolo" | "imagefolder" = "yolo",
  _retried = false,
): Promise<{ blob: Blob; fileName: string; sampleCount: number }> {
  const qs = buildQuery({ format })
  const headers = new Headers()
  const token = getAccessToken()
  if (isRealJwt(token)) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const res = await fetchWithAutoHost(
    `/api/v1/staff/ai-datasets/versions/${versionId}/export${qs}`,
    {
      method: "GET",
      headers,
    },
  )

  if (res.status === 401 && !_retried && getRefreshToken()) {
    const refreshed = await rotateRefreshTokenSingleFlight()
    if (refreshed) {
      return downloadDatasetVersionZip(versionId, format, true)
    }
  }

  if (!res.ok) {
    if (res.status === 401) clearSessionOnUnauthorized()
    let errMsg = `Xuất gói dữ liệu thất bại (HTTP ${res.status}).`
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
  const fallbackName = `ecolink-dataset-${versionId.slice(0, 8)}-${format}.zip`
  const fileName = match?.[1] ? decodeURIComponent(match[1]) : fallbackName
  const sampleCount = Number(res.headers.get("x-ecolink-sample-count") ?? "0") || 0

  return { blob, fileName, sampleCount }
}
