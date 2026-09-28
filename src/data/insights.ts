export const FEATURED = {
  kicker: "TIÊU ĐIỂM",
  readTime: "5 phút đọc",
  publication: "Kinh tế Tuần hoàn",
  title: "Khủng hoảng rác thải nhựa đại dương & Bước chuyển của chuỗi giá trị",
  excerpt:
    "Các chuỗi giá trị Đông Nam Á đang tái định hình hạ tầng thu gom với hạn ngạch EPR khắt khe, kết nối trực tiếp người dân vào mạng lưới tái chế quy chuẩn.",
  image: "/assets/insights/36f2d.png",
}

/** tone = ý nghĩa, không phải thứ tự: `warn` là con số cần cải thiện,
 *  `good` là thành tích. Không dùng xanh lá cho tin xấu. */
export const METRICS = [
  {
    label: "QUY MÔ PHÁT THẢI TOÀN CẦU",
    value: "350M+",
    tone: "warn",
    note: "tấn rác nhựa phát sinh hàng năm cần được quản trị",
  },
  {
    label: "TỶ LỆ HOÀN LƯU GIÁ TRỊ",
    value: "9%",
    tone: "warn",
    note: "thực sự được phân loại và tái sinh thành nguyên liệu mới",
  },
  {
    label: "ĐÃ SỐ HÓA QUA ECOLINK",
    value: "12.4k",
    tone: "good",
    note: "tấn phế liệu chuẩn đã khớp nối tuần hoàn thành công",
  },
] as const

export const ARTICLES = [
  {
    source: "UNEP",
    readTime: "4 phút đọc",
    title: "Mỏ vàng từ bo mạch cũ: Đòn bẩy kinh tế cho ngành tái chế thiết bị viễn thông",
    excerpt:
      "Phục hồi kim loại quý từ 1 triệu điện thoại tương đương khai thác 35 tấn quặng mà không gây tổn hại địa chất sinh thái.",
    image: "/assets/insights/c4ba2.png",
  },
  {
    source: "MONRE",
    readTime: "6 phút đọc",
    title: "Khung pháp lý Trách nhiệm Mở rộng của Nhà sản xuất: Hạn ngạch bắt đầu hiệu lực",
    excerpt:
      "Doanh nghiệp F&B và bao bì tiêu dùng bắt buộc đạt tỷ lệ tái chế thực tế theo quy chuẩn mới nhằm hướng tới Net-Zero.",
    image: "/assets/insights/fc414.png",
  },
  {
    source: "World Bank Report",
    readTime: "5 phút đọc",
    title: "Tín dụng xanh: Nền tảng cho chuỗi thu gom tuần hoàn tại Đồng bằng sông Cửu Long",
    excerpt:
      "Chuyển đổi phụ phẩm nông nghiệp thành nguồn năng lượng sinh khối biomass xuất khẩu sang thị trường Đông Á.",
    image: "/assets/insights/01ee5.png",
  },
]
