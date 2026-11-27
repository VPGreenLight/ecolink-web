import type { Role } from "@/lib/session"

/** Menu của từng vai trò. Đường dẫn trùng `App.tsx` là cố ý: menu là nơi
 *  duy nhất liệt kê các màn hình, thêm route mà quên thêm ở đây thì người
 *  dùng không có đường vào. */
export type PortalItem = { to: string; label: string }
export type PortalSection = { title: string; items: PortalItem[] }

export const PORTAL_NAV: Record<Role, PortalSection[]> = {
  user: [],
  recycler: [
    {
      title: "Vận hành",
      items: [
        { to: "/recycler", label: "Tổng quan" },
        { to: "/recycler/requests", label: "Yêu cầu bàn giao" },
        { to: "/chat", label: "Chat thương lượng" },
        { to: "/recycler/catalog", label: "Danh mục và bảng giá" },
        { to: "/recycler/receipt", label: "Biên nhận thu gom" },
        { to: "/recycler/facility", label: "Hồ sơ kho bãi" },
        { to: "/recycler/reviews", label: "Đánh giá từ người dùng" },
        { to: "/recycler/packages", label: "Gói dịch vụ Pro" },
      ],
    },
  ],
  staff: [
    {
      title: "Dữ liệu AI",
      items: [
        { to: "/staff", label: "Tổng quan" },
        { to: "/staff/ai-review", label: "Ảnh AI nhận diện sai" },
        { to: "/staff/dataset", label: "Tập dữ liệu kiểm chứng" },
      ],
    },
    {
      title: "Vận hành",
      items: [
        { to: "/staff/applications", label: "Hồ sơ đối tác thu mua" },
        { to: "/staff/complaints", label: "Khiếu nại giao dịch" },
        { to: "/staff/accounts", label: "Tài khoản User/Recycler" },
        { to: "/staff/blog", label: "Soạn bài Blog" },
        { to: "/staff/ecofacts", label: "Nội dung Eco Fact" },
        { to: "/staff/gifts", label: "Kho quà tặng" },
      ],
    },
    {
      title: "Khác",
      items: [
        { to: "/staff/account", label: "Hồ sơ và thông báo" },
        { to: "/staff/account/password", label: "Đổi mật khẩu" },
      ],
    },
  ],
  admin: [
    {
      title: "Quản trị",
      items: [
        { to: "/admin", label: "Dashboard thống kê" },
        { to: "/admin/reports", label: "Xuất báo cáo" },
        { to: "/admin/staff", label: "Tài khoản Staff" },
        { to: "/admin/permissions", label: "Phân quyền Staff" },
        { to: "/admin/blog", label: "Duyệt bài Blog" },
      ],
    },
    {
      title: "Cấu hình nghiệp vụ",
      items: [
        { to: "/admin/categories", label: "Danh mục rác" },
        { to: "/admin/policy", label: "Chính sách phân loại" },
        { to: "/admin/gamification", label: "Cấu hình điểm" },
        { to: "/admin/leaderboard", label: "Chu kỳ xếp hạng" },
        { to: "/admin/fees", label: "Phí giao dịch" },
        { to: "/admin/reconciliation", label: "Đối soát dòng tiền" },
      ],
    },
    // Không có "Tài khoản": 2 mục đó nằm sau avatar ở thanh trên, trong
    // AdminShell. Trộn vào sidebar thì không phân biệt được đâu là màn hình
    // của khu vực làm việc, đâu là mục dùng chung.
  ],
}