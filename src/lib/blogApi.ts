/**
 * Client API cho Module Blog & Content Management (FE-16 / M-14: STT 140 -> 149).
 *  - Công khai (G-01): GET /api/v1/blogs, GET /api/v1/blogs/{slug}
 *  - Staff (S-08): POST /api/v1/staff/blogs/upload-media, CRUD /api/v1/staff/blogs, /submit, /recall
 *  - Admin (A-09): GET /api/v1/admin/blogs/pending, GET /api/v1/admin/blogs/{id}, PATCH /api/v1/admin/blogs/{id}/review
 */

import { apiRequest, type ApiResponse } from "@/lib/api"

export interface BlogAuthorDto {
  id: string
  fullName: string
}

export interface BlogPostSummaryDto {
  id: string
  title: string
  slug: string
  summary?: string | null
  coverImageUrl?: string | null
  tags: string[]
  status: "Draft" | "Pending_Approval" | "Approved" | string
  author: BlogAuthorDto
  submittedAt?: string | null
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface BlogPostDetailDto extends BlogPostSummaryDto {
  content: string
  rejectionReason?: string | null
  approvedAt?: string | null
  canEdit: boolean
  canSubmit: boolean
  canRecall: boolean
  canDelete: boolean
}

export interface PublicBlogPostDto {
  id: string
  title: string
  slug: string
  summary?: string | null
  content: string
  coverImageUrl?: string | null
  tags: string[]
  authorName: string
  publishedAt: string
}

export interface BlogPagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}

export interface SaveBlogPostPayload {
  title: string
  summary?: string | null
  content?: string | null
  coverImageUrl?: string | null
  tags?: string[]
  submitForApproval: boolean
}

export interface BlogMediaUploadResponseDto {
  url: string
  fileUrl: string
  objectKey: string
  contentType: string
  sizeBytes: number
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      sp.set(k, String(v))
    }
  }
  const qs = sp.toString()
  return qs ? `?${qs}` : ""
}

export function formatBlogCode(id: string): string {
  return `BL-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`
}

export function formatViDate(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("vi-VN")
}

export function estimateReadTime(text?: string | null): string {
  if (!text) return "2 phút đọc"
  const plain = text.replace(/<[^>]+>/g, " ").trim()
  const words = plain ? plain.split(/\s+/).length : 0
  const mins = Math.max(1, Math.round(words / 180))
  return `${mins} phút đọc`
}

// ============================================================
// Công khai (G-01)
// ============================================================

export function fetchPublishedBlogs(params?: {
  search?: string
  tag?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<BlogPagedResult<BlogPostSummaryDto>>> {
  const qs = buildQuery({
    search: params?.search,
    tag: params?.tag,
    page: params?.page,
    pageSize: params?.pageSize,
  })
  return apiRequest<BlogPagedResult<BlogPostSummaryDto>>(`/api/v1/blogs${qs}`)
}

export function fetchPublishedBlogBySlug(slug: string): Promise<ApiResponse<PublicBlogPostDto>> {
  return apiRequest<PublicBlogPostDto>(`/api/v1/blogs/${encodeURIComponent(slug)}`)
}

// ============================================================
// Staff (S-08)
// ============================================================

export function uploadBlogMedia(file: File): Promise<ApiResponse<BlogMediaUploadResponseDto>> {
  const form = new FormData()
  form.append("file", file)
  return apiRequest<BlogMediaUploadResponseDto>("/api/v1/staff/blogs/upload-media", {
    method: "POST",
    body: form,
  })
}

export function fetchStaffBlogs(params?: {
  status?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<BlogPagedResult<BlogPostSummaryDto>>> {
  const qs = buildQuery({
    status: params?.status,
    search: params?.search,
    page: params?.page,
    pageSize: params?.pageSize,
  })
  return apiRequest<BlogPagedResult<BlogPostSummaryDto>>(`/api/v1/staff/blogs${qs}`)
}

export function fetchStaffBlogDetail(id: string): Promise<ApiResponse<BlogPostDetailDto>> {
  return apiRequest<BlogPostDetailDto>(`/api/v1/staff/blogs/${encodeURIComponent(id)}`)
}

export function createStaffBlog(
  payload: SaveBlogPostPayload,
): Promise<ApiResponse<BlogPostDetailDto>> {
  return apiRequest<BlogPostDetailDto>("/api/v1/staff/blogs", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateStaffBlog(
  id: string,
  payload: SaveBlogPostPayload,
): Promise<ApiResponse<BlogPostDetailDto>> {
  return apiRequest<BlogPostDetailDto>(`/api/v1/staff/blogs/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export function submitStaffBlog(id: string): Promise<ApiResponse<BlogPostDetailDto>> {
  return apiRequest<BlogPostDetailDto>(`/api/v1/staff/blogs/${encodeURIComponent(id)}/submit`, {
    method: "POST",
  })
}

export function recallStaffBlog(id: string): Promise<ApiResponse<BlogPostDetailDto>> {
  return apiRequest<BlogPostDetailDto>(`/api/v1/staff/blogs/${encodeURIComponent(id)}/recall`, {
    method: "POST",
  })
}

export function deleteStaffBlog(id: string): Promise<ApiResponse<Record<string, never>>> {
  return apiRequest<Record<string, never>>(`/api/v1/staff/blogs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

// ============================================================
// Admin (A-09)
// ============================================================

export function fetchAdminPendingBlogs(params?: {
  search?: string
  sort?: "oldest" | "newest"
  page?: number
  pageSize?: number
}): Promise<ApiResponse<BlogPagedResult<BlogPostSummaryDto>>> {
  const qs = buildQuery({
    search: params?.search,
    sort: params?.sort,
    page: params?.page,
    pageSize: params?.pageSize,
  })
  return apiRequest<BlogPagedResult<BlogPostSummaryDto>>(`/api/v1/admin/blogs/pending${qs}`)
}

export function fetchAdminBlogDetail(id: string): Promise<ApiResponse<BlogPostDetailDto>> {
  return apiRequest<BlogPostDetailDto>(`/api/v1/admin/blogs/${encodeURIComponent(id)}`)
}

export function reviewAdminBlog(
  id: string,
  payload: { approve: boolean; feedback?: string },
): Promise<ApiResponse<BlogPostDetailDto>> {
  return apiRequest<BlogPostDetailDto>(`/api/v1/admin/blogs/${encodeURIComponent(id)}/review`, {
    method: "PATCH",
    body: JSON.stringify({
      action: payload.approve ? "Approve" : "Reject",
      approve: payload.approve,
      feedback: payload.feedback ?? "",
    }),
  })
}
