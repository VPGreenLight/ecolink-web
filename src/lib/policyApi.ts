import { apiRequest, type ApiResponse } from "@/lib/api"

export type PlatformPolicyCategory = "TERMS" | "ENVIRONMENT" | "PRIVACY"
export type PlatformPolicyStatus = "ACTIVE" | "DRAFT" | "INACTIVE"

export interface PlatformPolicySectionDto {
  id: string
  code: string
  category: PlatformPolicyCategory | string
  title: string
  content: string
  displayOrder: number
  status: PlatformPolicyStatus | string
  updatedByAdminId?: string | null
  createdAt: string
  updatedAt?: string | null
}

export interface SavePlatformPolicyPayload {
  code?: string | null
  category: PlatformPolicyCategory | string
  title: string
  content: string
  displayOrder: number
  status?: PlatformPolicyStatus | string
}

export const POLICY_CATEGORY_META: Record<
  PlatformPolicyCategory,
  { label: string; badgeClass: string }
> = {
  TERMS: {
    label: "Điều khoản sử dụng",
    badgeClass: "bg-brand/10 text-brand-deep",
  },
  ENVIRONMENT: {
    label: "Chính sách môi trường",
    badgeClass: "bg-emerald-50 text-emerald-700",
  },
  PRIVACY: {
    label: "Quyền riêng tư",
    badgeClass: "bg-sky-50 text-sky-700",
  },
}

export const POLICY_STATUS_META: Record<
  PlatformPolicyStatus,
  { label: string; tone: "ok" | "wait" | "off" }
> = {
  ACTIVE: { label: "Đang công khai", tone: "ok" },
  DRAFT: { label: "Bản nháp", tone: "wait" },
  INACTIVE: { label: "Tạm ẩn", tone: "off" },
}

export const DEFAULT_PLATFORM_POLICIES: PlatformPolicySectionDto[] = [
  {
    id: "seed-term-01",
    code: "TERM-01",
    category: "ENVIRONMENT",
    title: "1. Nguyên tắc phân loại rác tại nguồn",
    content:
      "Người tham gia cam kết phân loại rác đúng theo hướng dẫn 3 nhóm (Tái chế, Hữu cơ, Khác). Rác tái chế cần được làm sạch cơ bản, để khô ráo trước khi đặt lịch bàn giao nhằm đảm bảo an toàn vệ sinh và tối ưu giá trị thu gom.",
    displayOrder: 1,
    status: "ACTIVE",
    createdAt: "2026-10-20T00:00:00Z",
    updatedAt: "2026-10-20T00:00:00Z",
  },
  {
    id: "seed-term-02",
    code: "TERM-02",
    category: "TERMS",
    title: "2. Quy chuẩn cân đo và biên nhận giao dịch",
    content:
      "Mọi giao dịch thu mua phế liệu qua nền tảng phải được cân đo minh bạch tại thời điểm bàn giao. Biên nhận điện tử được lập tức thì trên ứng dụng, ghi nhận khối lượng, đơn giá và số tiền thanh toán trực tiếp.",
    displayOrder: 2,
    status: "ACTIVE",
    createdAt: "2026-10-20T00:00:00Z",
    updatedAt: "2026-10-20T00:00:00Z",
  },
  {
    id: "seed-term-03",
    code: "TERM-03",
    category: "TERMS",
    title: "3. Cơ chế tích lũy điểm xanh và đổi quà",
    content:
      "Điểm xanh được tích lũy thông qua hoạt động điểm danh hằng ngày, chăm sóc & thu hoạch Cây ảo và thưởng chu kỳ Bảng xếp hạng. Điểm tiêu dùng có thể dùng để đổi quà tặng hoặc voucher đối tác. Điểm xếp hạng được bảo lưu trọn đời để thăng hạng cây ảo và mở khóa các huy hiệu cộng đồng.",
    displayOrder: 3,
    status: "ACTIVE",
    createdAt: "2026-10-20T00:00:00Z",
    updatedAt: "2026-10-20T00:00:00Z",
  },
  {
    id: "seed-env-01",
    code: "ENV-01",
    category: "ENVIRONMENT",
    title: "4. Trách nhiệm của cơ sở thu gom và đối tác",
    content:
      "Cơ sở thu gom phải có giấy phép hoạt động hợp lệ, cam kết thu gom đúng hẹn và chuyển rác đến các nhà máy tái chế đạt chuẩn môi trường theo định hướng trách nhiệm mở rộng của nhà sản xuất (EPR).",
    displayOrder: 4,
    status: "ACTIVE",
    createdAt: "2026-10-20T00:00:00Z",
    updatedAt: "2026-10-20T00:00:00Z",
  },
  {
    id: "seed-priv-01",
    code: "PRIV-01",
    category: "PRIVACY",
    title: "5. Bảo mật thông tin và quyền riêng tư",
    content:
      "EcoLink cam kết bảo vệ thông tin cá nhân và dữ liệu vị trí thu gom của người dùng. Dữ liệu chỉ được sử dụng cho mục đích điều phối lộ trình thu gom và thống kê báo cáo tác động môi trường số hóa.",
    displayOrder: 5,
    status: "ACTIVE",
    createdAt: "2026-10-20T00:00:00Z",
    updatedAt: "2026-10-20T00:00:00Z",
  },
]

export async function fetchPublicPolicies(
  category?: string,
  signal?: AbortSignal,
): Promise<PlatformPolicySectionDto[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : ""
  const res = await apiRequest<PlatformPolicySectionDto[]>(`/api/v1/policies${qs}`, {
    method: "GET",
    signal,
  })
  return Array.isArray(res.data) ? res.data : []
}

export async function fetchAdminPolicies(
  params?: { category?: string; status?: string; search?: string },
  signal?: AbortSignal,
): Promise<PlatformPolicySectionDto[]> {
  const qs = new URLSearchParams()
  if (params?.category) qs.set("category", params.category)
  if (params?.status) qs.set("status", params.status)
  if (params?.search) qs.set("search", params.search)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  const res = await apiRequest<PlatformPolicySectionDto[]>(`/api/v1/admin/policies${suffix}`, {
    method: "GET",
    signal,
  })
  return Array.isArray(res.data) ? res.data : []
}

export async function createPlatformPolicy(
  payload: SavePlatformPolicyPayload,
): Promise<ApiResponse<PlatformPolicySectionDto>> {
  return apiRequest<PlatformPolicySectionDto>("/api/v1/admin/policies", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updatePlatformPolicy(
  id: string,
  payload: SavePlatformPolicyPayload,
): Promise<ApiResponse<PlatformPolicySectionDto>> {
  return apiRequest<PlatformPolicySectionDto>(`/api/v1/admin/policies/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function setPlatformPolicyStatus(
  id: string,
  status: PlatformPolicyStatus,
): Promise<ApiResponse<PlatformPolicySectionDto>> {
  return apiRequest<PlatformPolicySectionDto>(
    `/api/v1/admin/policies/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  )
}

export async function deletePlatformPolicy(
  id: string,
): Promise<ApiResponse<{ id: string }>> {
  return apiRequest<{ id: string }>(`/api/v1/admin/policies/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}
