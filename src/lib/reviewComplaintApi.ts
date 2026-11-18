import { apiRequest, type ApiResponse } from "@/lib/api"

/* ------------------------------------------------------------------ Shared Paged */

export interface PagedResultDto<T> {
  items: T[]
  pageNumber: number
  pageSize: number
  totalRecords: number
  totalPages?: number
  hasPreviousPage?: boolean
  hasNextPage?: boolean
}

export interface UploadedEvidenceDto {
  fileUrl: string
  objectKey: string
  contentType: string
  sizeBytes: number
  uploadedAt?: string
}

/* ------------------------------------------------------------------ U-10: Reviews */

export interface TransactionReviewDto {
  reviewId: string
  requestId: string
  requestCode?: string | null
  reviewerId: string
  reviewerDisplayName: string
  recyclerId: string
  facilityName: string
  ratingStars: number
  comment?: string | null
  status: "Visible" | "Reported" | "Hidden" | "Deleted" | string
  reportCount: number
  lastReportReason?: string | null
  moderationReason?: string | null
  moderatedAt?: string | null
  createdAt: string
  updatedRecyclerAverageRating?: number | null
  updatedRecyclerTotalReviews?: number | null
}

export interface StarDistributionDto {
  fiveStars: number
  fourStars: number
  threeStars: number
  twoStars: number
  oneStar: number
}

export interface RecyclerReviewsSummaryDto {
  recyclerId: string
  facilityName: string
  averageRating: number
  totalReviews: number
  starDistribution: StarDistributionDto
  reviews: PagedResultDto<TransactionReviewDto>
}

export interface CreateReviewPayload {
  ratingStars: number
  comment?: string
}

export async function createHandoverReview(
  requestId: string,
  payload: CreateReviewPayload,
): Promise<ApiResponse<TransactionReviewDto>> {
  return apiRequest<TransactionReviewDto>(
    `/api/v1/handover-requests/${encodeURIComponent(requestId)}/reviews`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  )
}

export async function fetchRecyclerReviews(
  recyclerId: string,
  params?: { ratingStars?: number; pageNumber?: number; pageSize?: number },
  signal?: AbortSignal,
): Promise<ApiResponse<RecyclerReviewsSummaryDto>> {
  const qs = new URLSearchParams()
  if (params?.ratingStars) qs.set("ratingStars", String(params.ratingStars))
  qs.set("pageNumber", String(params?.pageNumber ?? 1))
  qs.set("pageSize", String(params?.pageSize ?? 10))
  return apiRequest<RecyclerReviewsSummaryDto>(
    `/api/v1/recyclers/${encodeURIComponent(recyclerId)}/reviews?${qs.toString()}`,
    { method: "GET", signal },
  )
}

export async function fetchMyReviews(
  pageNumber = 1,
  pageSize = 20,
): Promise<ApiResponse<PagedResultDto<TransactionReviewDto>>> {
  return apiRequest<PagedResultDto<TransactionReviewDto>>(
    `/api/v1/reviews/me?pageNumber=${pageNumber}&pageSize=${pageSize}`,
    { method: "GET" },
  )
}

export async function deleteMyReview(
  reviewId: string,
): Promise<ApiResponse<TransactionReviewDto>> {
  return apiRequest<TransactionReviewDto>(
    `/api/v1/reviews/${encodeURIComponent(reviewId)}`,
    { method: "DELETE" },
  )
}

export async function reportReview(
  reviewId: string,
  reason: string,
): Promise<ApiResponse<TransactionReviewDto>> {
  return apiRequest<TransactionReviewDto>(
    `/api/v1/reviews/${encodeURIComponent(reviewId)}/report`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  )
}

export async function moderateReview(
  reviewId: string,
  payload: { action: "Hide" | "Restore"; moderationReason: string },
): Promise<ApiResponse<TransactionReviewDto>> {
  return apiRequest<TransactionReviewDto>(
    `/api/v1/staff/reviews/${encodeURIComponent(reviewId)}/moderate`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  )
}

/* ------------------------------------------------------------------ U-11 & S-05: Complaints */

export type ComplaintCategoryCode =
  | "ScaleDiscrepancy"
  | "PaymentIssue"
  | "NoShow"
  | "Misconduct"
  | "Other"

export type ComplaintResolutionOutcomeCode =
  | "ConfirmReceiptAsIs"
  | "CompensateUser"
  | "UpholdComplainant"
  | "CancelDisputedOrder"
  | "Dismissed"

export interface ComplaintSummaryDto {
  complaintId: string
  complaintCode: string
  requestId: string
  requestCode: string
  handoverStatus: string
  receiptId?: string | null
  receiptCode?: string | null
  complainantId: string
  complainantName: string
  complainantRole: "Citizen" | "Recycler" | string
  respondentId: string
  respondentName: string
  category: ComplaintCategoryCode | string
  description: string
  evidencePhotoUrls: string[]
  status: "Open" | "Investigating" | "Resolved" | "Dismissed" | string
  assignedStaffId?: string | null
  resolutionOutcome?: ComplaintResolutionOutcomeCode | string | null
  resolutionNote?: string | null
  resolvedAt?: string | null
  pointsRevoked: boolean
  warningLogged: boolean
  createdAt: string
}

export interface SubmitComplaintPayload {
  handoverRequestId: string
  category: ComplaintCategoryCode
  description: string
  evidencePhotoUrls?: string[]
}

export interface StaffComplaintQueueResponseDto {
  complaints: PagedResultDto<ComplaintSummaryDto>
  openCount: number
  investigatingCount: number
  resolvedCount: number
  dismissedCount: number
  reportedReviewsCount: number
  reportedReviews: TransactionReviewDto[]
}

export interface DossierPartyInfoDto {
  userId: string
  fullName: string
  email: string
  phoneNumber?: string | null
  role: string
  status: string
  warningCount: number
}

export interface DossierHandoverItemDto {
  itemId: string
  categoryCode: string
  categoryName: string
  estimatedWeightKg: number
  actualWeightKg?: number | null
  agreedPricePerKg?: number | null
}

export interface DossierReceiptSnapshotDto {
  receiptId: string
  receiptCode: string
  totalWeightKg: number
  totalAmountCash: number
  pointsAwarded: number
  scaleProofPhotoUrls: string[]
  receiptImageUrl?: string | null
  createdAt: string
  confirmedByUserAt?: string | null
}

export interface DossierChatMessageDto {
  messageId: string
  senderUserId: string
  senderName: string
  senderRole: string
  messageType: string
  content: string
  attachmentImageUrl?: string | null
  proposedPricePerKg?: number | null
  proposedWeightKg?: number | null
  proposalStatus?: string | null
  sentAt: string
}

export interface StaffComplaintDossierDto {
  complaint: ComplaintSummaryDto
  complainant: DossierPartyInfoDto
  respondent: DossierPartyInfoDto
  handoverRequestCode: string
  handoverStatus: string
  pickupAddress: string
  preferredTimeSlot?: string | null
  wastePhotoUrls: string[]
  items: DossierHandoverItemDto[]
  receipt?: DossierReceiptSnapshotDto | null
  negotiationMessages: DossierChatMessageDto[]
}

export interface ResolveComplaintPayload {
  resolutionOutcome: ComplaintResolutionOutcomeCode
  resolutionNote: string
  issueWarningToRespondent?: boolean
  warningReason?: string
}

export async function uploadComplaintEvidence(
  file: File,
): Promise<ApiResponse<UploadedEvidenceDto>> {
  const form = new FormData()
  form.append("file", file)
  return apiRequest<UploadedEvidenceDto>("/api/v1/complaints/upload-evidence", {
    method: "POST",
    body: form,
  })
}

export async function submitComplaint(
  payload: SubmitComplaintPayload,
): Promise<ApiResponse<ComplaintSummaryDto>> {
  return apiRequest<ComplaintSummaryDto>("/api/v1/complaints", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function fetchMyComplaints(params?: {
  role?: "all" | "submitted" | "against"
  status?: string
  pageNumber?: number
  pageSize?: number
}): Promise<ApiResponse<PagedResultDto<ComplaintSummaryDto>>> {
  const qs = new URLSearchParams()
  if (params?.role) qs.set("role", params.role)
  if (params?.status) qs.set("status", params.status)
  qs.set("pageNumber", String(params?.pageNumber ?? 1))
  qs.set("pageSize", String(params?.pageSize ?? 20))
  return apiRequest<PagedResultDto<ComplaintSummaryDto>>(
    `/api/v1/complaints/me?${qs.toString()}`,
    { method: "GET" },
  )
}

export async function fetchStaffComplaints(params?: {
  status?: string
  category?: string
  search?: string
  includeReportedReviews?: boolean
  pageNumber?: number
  pageSize?: number
}): Promise<ApiResponse<StaffComplaintQueueResponseDto>> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set("status", params.status)
  if (params?.category) qs.set("category", params.category)
  if (params?.search) qs.set("search", params.search)
  qs.set(
    "includeReportedReviews",
    String(params?.includeReportedReviews ?? true),
  )
  qs.set("pageNumber", String(params?.pageNumber ?? 1))
  qs.set("pageSize", String(params?.pageSize ?? 20))
  return apiRequest<StaffComplaintQueueResponseDto>(
    `/api/v1/staff/complaints?${qs.toString()}`,
    { method: "GET" },
  )
}

export async function fetchStaffComplaintDossier(
  complaintId: string,
  claim = true,
): Promise<ApiResponse<StaffComplaintDossierDto>> {
  return apiRequest<StaffComplaintDossierDto>(
    `/api/v1/staff/complaints/${encodeURIComponent(complaintId)}?claim=${claim}`,
    { method: "GET" },
  )
}

export async function resolveStaffComplaint(
  complaintId: string,
  payload: ResolveComplaintPayload,
): Promise<ApiResponse<ComplaintSummaryDto>> {
  return apiRequest<ComplaintSummaryDto>(
    `/api/v1/staff/complaints/${encodeURIComponent(complaintId)}/resolve`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  )
}

export const COMPLAINT_CATEGORY_LABELS: Record<string, string> = {
  ScaleDiscrepancy: "Sai lệch khối lượng / cân đo",
  PaymentIssue: "Thanh toán / ép giá sai cam kết",
  NoShow: "Không đến đúng hẹn (No-show)",
  Misconduct: "Thái độ / hành vi thiếu chuẩn mực",
  Other: "Vấn đề giao dịch khác",
}

export const COMPLAINT_OUTCOME_LABELS: Record<string, string> = {
  ConfirmReceiptAsIs: "Công nhận số liệu biên nhận hợp lệ",
  CompensateUser: "Buộc đối tác bồi hoàn chênh lệch cho Người dân",
  UpholdComplainant: "Chấp thuận khiếu nại & yêu cầu khắc phục",
  CancelDisputedOrder: "Hủy giao dịch tranh chấp & thu hồi điểm",
  Dismissed: "Bác bỏ khiếu nại do thiếu căn cứ",
}
