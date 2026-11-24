/** Khiếu nại và góp ý.
 *
 *  Tách 2 nhóm vì chúng được xử lý khác nhau: khiếu nại là việc ĐÃ SAI XẢY RA
 *  cần sửa và bồi thường, góp ý là đề xuất tương lai không ai bị thiệt. Trộn
 *  chung một danh sách thì cả hai bị xử lý như nhau và người gửi không biết
 *  mình đang ở nhóm nào. */

export type Category = "complaint" | "review"

export const DESC_MIN = 15
export const DESC_MAX = 2000
export const REVIEW_COMMENT_MAX = 1000
export const MAX_PHOTOS = 5
export const MAX_PHOTO_MB = 10

export const CATEGORIES: { id: Category; label: string; blurb: string }[] = [
  {
    id: "complaint",
    label: "Khiếu nại giao dịch",
    blurb: "Dành cho Người dân & Cơ sở thu mua khiếu nại hai chiều sau khi biên nhận bàn giao đã xác nhận hoàn tất (trong hạn 7 ngày).",
  },
  {
    id: "review",
    label: "Đánh giá & Góp ý",
    blurb: "Chỉ dành cho Người dân chấm 1–5 sao & gửi góp ý cho cơ sở thu mua sau khi đơn hoàn tất (1 đánh giá/đơn; xóa đánh giá cũ để gửi lại).",
  },
]

/** 3 bước sau khi gửi. Nói rõ để người gửi không phải tự hỏi. */
export const STEPS = [
  {
    title: "Biên nhận xác nhận hoàn tất",
    body: "Khiếu nại hai chiều hoặc đánh giá 1–5 sao chỉ áp dụng trên các đơn bàn giao đã hoàn tất xác nhận biên nhận.",
  },
  {
    title: "1 đánh giá / đơn & tối đa 1 khiếu nại mở",
    body: "Người dân có thể xóa đánh giá cũ để gửi đánh giá mới; mỗi đơn tối đa 1 phiếu khiếu nại đang xử lý trong vòng 7 ngày.",
  },
  {
    title: "Staff Trọng tài xử lý & đối soát",
    body: "Khiếu nại giao dịch đi thẳng tới hàng đợi Staff S-05 kèm đầy đủ biên nhận cân và lịch sử chat thương lượng.",
  },
]

/** FAQ dùng <details>/<summary> gốc của trình duyệt, không cần state. */
export const FAQ = [
  {
    q: "Ai được gửi khiếu nại và khi nào gửi được?",
    a: "Cả Người dân và Cơ sở thu mua đều được gửi khiếu nại hai chiều đối với nhau trong vòng 7 ngày sau khi biên nhận bàn giao đã được xác nhận hoàn tất. Nếu biên nhận đang chờ xác nhận mà bị sai số cân, Người dân bấm 'Sai rồi, tôi muốn khiếu nại' ngay tại trang Biên nhận.",
  },
  {
    q: "Ai được gửi đánh giá / góp ý và có sửa được không?",
    a: "Chỉ Người dân chủ đơn được gửi đánh giá 1–5 sao và góp ý sau khi đơn bàn giao hoàn tất (trong vòng 14 ngày). Mỗi đơn chỉ giữ 1 đánh giá đang hiển thị; nếu muốn đổi nội dung hoặc số sao, hãy xóa đánh giá cũ rồi gửi lại đánh giá mới.",
  },
  {
    q: "Nên đính kèm ảnh gì khi khiếu nại giao dịch?",
    a: "Ảnh chụp mặt cân điện tử, biên nhận giấy, hiện trường thu gom hoặc ảnh chụp tin nhắn thỏa thuận (tối đa 5 ảnh JPG/PNG/WEBP, mỗi ảnh tối đa 10 MB).",
  },
  {
    q: "Cần hỗ trợ khẩn cấp ngoài giao dịch?",
    a: "Vui lòng gọi hotline 1900 8828 (8:00 - 18:00) hoặc gửi email về hotro@ecolink.vn để được điều phối viên hỗ trợ trực tiếp.",
  },
]
