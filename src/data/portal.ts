import type { Role } from "@/lib/session"

/** Menu của từng vai trò. Đường dẫn trùng `App.tsx` là cố ý: menu là nơi
 *  duy nhất liệt kê các màn hình, thêm route mà quên thêm ở đây thì người
 *  dùng không có đường vào.
 *
 *  "Thông báo" (SU-03) nằm trong trang hồ sơ cá nhân, không phải mục riêng —
 *  cả hai đều là việc của tài khoản này và tách ra thì người dùng phải biết
 *  cái nào ở đâu. */
export type PortalItem = { to: string; label: string }
export type PortalSection = { title: string; items: PortalItem[] }

const ACCOUNT: PortalItem[] = [
  { to: "/account/profile", label: "Hồ sơ và thông báo" },
  { to: "/account/password", label: "Đổi mật khẩu" },
]

export const PORTAL_NAV: Record<Role, PortalSection[]> = {
  user: [
    {
      title: "Tài khoản",
      items: [
        { to: "/me", label: "Tổng quan" },
        { to: "/me/handover", label: "Yêu cầu bàn giao" },
        { to: "/me/receipt", label: "Xác nhận biên nhận" },
        { to: "/me/payout", label: "Tài khoản nhận tiền" },
        { to: "/me/transactions", label: "Lịch sử dòng tiền" },
      ],
    },
    {
      title: "Phân loại rác",
      items: [
        { to: "/scanner", label: "Nhận diện bằng AI" },
        { to: "/guidance", label: "Hướng dẫn phân loại" },
        { to: "/waste", label: "Tra cứu loại rác" },
        { to: "/rewards", label: "Đổi thưởng và điểm danh" },
        { to: "/me/gamification", label: "Cây ảo và Eco Fact" },
      ],
    },
    {
      title: "Khác",
      items: [
        { to: "/chat", label: "Chatbox thương lượng" },
        { to: "/feedback", label: "Khiếu nại và góp ý" },
        ...ACCOUNT,
      ],
    },
  ],
  recycler: [
    {
      title: "Vận hành",
      items: [
        { to: "/recycler", label: "Tổng quan" },
        { to: "/recycler/requests", label: "Yêu cầu bàn giao" },
        { to: "/recycler/catalog", label: "Danh mục và bảng giá" },
        { to: "/recycler/receipt", label: "Biên nhận thu gom" },
      ],
    },
    {
      title: "Khác",
      items: [
        { to: "/chat", label: "Chatbox thương lượng" },
        ...ACCOUNT,
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
        { to: "/staff/accounts", label: "Tài khoản User/Buyer" },
        { to: "/staff/blog", label: "Soạn bài Blog" },
        { to: "/staff/ecofacts", label: "Nội dung Eco Fact" },
        { to: "/staff/gifts", label: "Kho quà tặng" },
        { to: "/staff/checkin", label: "Điểm danh nhân viên" },
      ],
    },
    {
      title: "Khác",
      items: ACCOUNT,
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
    {
      title: "Khác",
      items: ACCOUNT,
    },
  ],
}