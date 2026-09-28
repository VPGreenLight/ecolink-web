export const NAV_LINKS = [
  { to: "/", label: "Tổng quan" },
  { to: "/scanner", label: "Nhận diện AI" },
  { to: "/map", label: "Điểm thu gom" },
  { to: "/partners", label: "Đối tác tái chế" },
  { to: "/rewards", label: "Đổi thưởng" },
  { to: "/blog", label: "Blog" },
] as const

// Blog không có ở thanh dưới: 5 tab trên màn 320px sẽ chật, và blog là nội
// dung đọc thêm chứ không phải chức năng chính.
// Đổi thưởng thì có: đó là điểm đóng lại vòng lặp giao rác -> tích điểm, thiếu
// nó thì người dùng mobile không tới được nơi tiêu điểm. Đổi "Đối tác" (chỉ để
// xem danh bạ, có trong footer) ra cho "Đổi thưởng".
export const MOBILE_LINKS = [
  { to: "/", label: "Tổng quan" },
  { to: "/scanner", label: "Nhận diện" },
  { to: "/map", label: "Thu gom" },
  { to: "/rewards", label: "Đổi thưởng" },
] as const

export const FOOTER_COLUMNS = [
  {
    title: "HỆ SINH THÁI",
    links: [
      "Nhận diện tự động qua Camera",
      "Sàn giao dịch phế liệu GPS",
      "Cổng liên kết nhà máy tái chế",
      "Chứng chỉ tín chỉ tuần hoàn EPR",
    ],
  },
  {
    title: "CỘNG ĐỒNG & PHÁP LÝ",
    links: [
      { label: "Khiếu nại và góp ý", to: "/feedback" },
      "Hướng dẫn phân loại rác nguồn",
      "Quy chuẩn vật liệu tái chế",
      "Chính sách quyền riêng tư",
      "Điều khoản dịch vụ môi trường",
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
