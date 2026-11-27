export const NAV_LINKS = [
  { to: "/", label: "Tổng quan" },
  { to: "/scanner", label: "Nhận diện AI" },
  { to: "/map", label: "Điểm thu gom" },
  // { to: "/partners", label: "Đối tác tái chế" },
  { to: "/rewards", label: "Đổi thưởng" },
  { to: "/blog", label: "Blog" },
] as const

export const FOOTER_COLUMNS = [
  {
    title: "HỆ SINH THÁI",
    links: [
      { label: "Nhận diện tự động qua Camera", to: "/scanner" },
      { label: "Sàn giao dịch phế liệu GPS", to: "/map" },
      { label: "Cổng liên kết nhà máy tái chế", to: "/partners" },
      "Chứng chỉ tín chỉ tuần hoàn EPR",
    ],
  },
  {
    title: "CỘNG ĐỒNG & PHÁP LÝ",
    links: [
      { label: "Khiếu nại và góp ý", to: "/feedback" },
      { label: "Hướng dẫn phân loại rác nguồn", to: "/guidance" },
      { label: "Quy chuẩn vật liệu tái chế", to: "/waste" },
      { label: "Chính sách quyền riêng tư", to: "/terms?category=PRIVACY" },
      { label: "Điều khoản dịch vụ môi trường", to: "/terms" },
    ],
  },
] as const

// Trang khiếu nại để trong footer chứ không nhét vào navbar: navbar đã có 6 mục
// và tràn 81px ở màn 1024, thêm mục thứ 7 thì nửa dưới màn 1440 cũng chật.
// Khiếu nại là trang hỗ trợ, tìm bằng cách cuộn tới cuối trang là hợp lý.

export const SUPPORT = {
  title: "TRUNG TÂM HỖ TRỢ",
  note: "Đường dây nóng điều phối thu gom và xử lý sự cố chất thải địa phương.",
  links: ["1900 8828 (8:00 - 18:00)", "hotro@ecolink.vn"],
} as const
