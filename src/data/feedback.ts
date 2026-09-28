/** Khiếu nại và góp ý.
 *
 *  Tách 2 nhóm vì chúng được xử lý khác nhau: khiếu nại là việc ĐÃ SAI XẢY RA
 *  cần sửa và bồi thường, góp ý là đề xuất tương lai không ai bị thiệt. Trộn
 *  chung một danh sách thì cả hai bị xử lý như nhau và người gửi không biết
 *  mình đang ở nhóm nào. */

export type Category = "complaint" | "suggestion"

export type Issue = { id: string; label: string; hint?: string }

export const CATEGORIES: { id: Category; label: string; blurb: string }[] = [
  {
    id: "complaint",
    label: "Khiếu nại",
    blurb: "Có gì đã sai và cần được xử lý. Chúng tôi phản hồi trong 24 giờ.",
  },
  {
    id: "suggestion",
    label: "Góp ý",
    blurb: "Ý tưởng để EcoLink làm tốt hơn. Chúng tôi đọc hết và ghi nhận.",
  },
]

/** id: dùng để chọn mức phản hồi, cũng là chuỗi gửi lên backend. */
export const ISSUES: Record<Category, Issue[]> = {
  complaint: [
    { id: "collect-missed", label: "Không có người thu gom đến" },
    { id: "collect-late", label: "Đến sai giờ so với lịch hẹn", hint: "Lệch quá 2 giờ" },
    { id: "weight", label: "Khối lượng cộng điểm bị sai" },
    { id: "sorting", label: "Phân loại sai vật liệu" },
    { id: "collector-attitude", label: "Thái độ người thu gom" },
    { id: "points", label: "Vấn đề điểm hoặc đổi quà" },
    { id: "app-bug", label: "Ứng dụng bị lỗi" },
    { id: "safety", label: "An toàn hoặc môi trường", hint: "Xử lý trong 4 giờ" },
  ],
  suggestion: [
    { id: "feature", label: "Muốn có thêm tính năng" },
    { id: "experience", label: "Trải nghiệm dùng app" },
    { id: "partner", label: "Đề xuất đối tác thu gom hoặc tái chế" },
    { id: "content", label: "Nội dung hướng dẫn phân loại" },
    { id: "other", label: "Góp ý khác" },
  ],
}

/** Cam kết xử lý. Hiện ở ngay cạnh nút gửi để người gửi biết mình chờ được gì. */
export const SLA: Record<Issue["id"], string> = {
  "collect-missed": "Phản hồi trong 24 giờ",
  "collect-late": "Phản hồi trong 24 giờ",
  weight: "Đối chiếu dữ liệu cân trong 48 giờ",
  sorting: "Phản hồi trong 24 giờ",
  "collector-attitude": "Xác minh với đối tác trong 48 giờ",
  points: "Sửa điểm trong 24 giờ",
  "app-bug": "Phản hồi trong 24 giờ",
  safety: "Ưu tiên cao nhất, phản hồi trong 4 giờ",
  feature: "Chúng tôi ghi nhận, phản hồi theo chu kỳ phát triển",
  experience: "Chúng tôi ghi nhận, phản hồi theo chu kỳ phát triển",
  partner: "Chuyển phòng hợp tác, phản hồi trong 5 ngày",
  content: "Chúng tôi ghi nhận, phản hồi theo chu kỳ nội dung",
  other: "Chúng tôi ghi nhận, phản hồi theo chu kỳ phát triển",
}

/** 3 bước sau khi gửi. Nói rõ để người gửi không phải tự hỏi. */
export const STEPS = [
  {
    title: "Nhận mã tiếp nhận",
    body: "Mã hiện ngay trên màn hình, có trong email xác nhận. Giữ mã này để tra cứu.",
  },
  {
    title: "Điều phối viên liên hệ",
    body: "Điều phối viên phụ trách khu vực của bạn gọi lại trong thời hạn ở trên.",
  },
  {
    title: "Kết quả và bồi thường",
    body: "Báo lại kết quả trên app. Sai khối lượng sẽ được cộng lại điểm tự động.",
  },
]

/** FAQ dùng <details>/<summary> gốc của trình duyệt, không cần state. */
export const FAQ = [
  {
    q: "Tôi cần tài khoản để gửi khiếu nại không?",
    a: "Không. Người dùng chưa đăng nhập vẫn gửi được, chỉ cần để lại email hoặc số điện thoại để chúng tôi gọi lại. Có tài khoản thì chúng tôi tự điền hộ tên.",
  },
  {
    q: "Bao lâu thì được phản hồi?",
    a: "Khiếu nại về an toàn và môi trường trong 4 giờ, phần lớn khiếu nại trong 24 giờ, đối chiếu dữ liệu cân thì 48 giờ. Góp ý không có hạn cụ thể vì phụ thuộc chu kỳ phát triển.",
  },
  {
    q: "Tôi nên chụp ảnh gì?",
    a: "Ảnh chụp rác, biển số xe người thu gom, ảnh màn hình hiển thị điểm, hoặc ảnh thẻ khi đổi quà. Ảnh rõ nét giúp xử lý nhanh hơn nhiều.",
  },
  {
    q: "Khiếu nại của tôi có bị mất không?",
    a: "Không. Mọi khiếu nại đều lưu kèm thời điểm, khu vực và mã tiếp nhận. Nếu quá 5 ngày làm việc chưa có phản hồi, bạn gọi 1900 8828 và đưa mã tiếp nhận.",
  },
  {
    q: "Có phải trả phí gửi khiếu nại không?",
    a: "Không. Gửi khiếu nại và góp ý hoàn toàn miễn phí, kể cả khi kết quả là không có lỗi của phía EcoLink.",
  },
]

export const DESC_MIN = 20
export const DESC_MAX = 1000
export const MAX_PHOTOS = 4
export const MAX_PHOTO_MB = 5

/** SĐT Việt Nam: 0xxxxxxxxx hoặc +84xxxxxxxxx, cho phép khoảng trắng, gạch, chấm. */
export function isPhone(v: string) {
  return /^(?:\+84|0)\d{9,10}$/.test(v.replace(/[\s.\-()]/g, ""))
}

export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
}

export type Draft = {
  category: Category
  issue: string
  desc: string
  contact: string
  photos: File[]
}

export type Errors = Partial<Record<"issue" | "desc" | "contact" | "photos", string>>

/** Đây là ranh giới tin cậy: dữ liệu từ người dùng vào hệ thống. Không kiểm
 *  tra thì đơn không xử lý được mà vẫn báo "đã gửi" — tệ hơn không có form. */
export function validate(d: Draft): Errors {
  const e: Errors = {}
  if (!d.issue) e.issue = "Chọn loại vấn đề để chúng tôi chuyển đúng bộ phận"
  const desc = d.desc.trim()
  if (desc.length < DESC_MIN) e.desc = `Mô tả ít nhất ${DESC_MIN} ký tự, hiện mới ${desc.length}`
  else if (desc.length > DESC_MAX) e.desc = `Tối đa ${DESC_MAX} ký tự, hiện ${desc.length}`
  if (!d.contact.trim()) e.contact = "Cần email hoặc số điện thoại để gọi lại cho bạn"
  else if (!isEmail(d.contact) && !isPhone(d.contact)) e.contact = "Email hoặc số điện thoại chưa đúng định dạng"
  if (d.photos.length > MAX_PHOTOS) e.photos = `Tối đa ${MAX_PHOTOS} ảnh`
  return e
}

/** Mã tiếp nhận dạng KN-260928-4F7A: ngày + 4 ký tự ngẫu nhiên. Người gửi đọc
 *  qua điện thoại thì dễ đọc hơn mã dài. */
export function makeRef(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0")
  const day = `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}`
  const tail = Array.from({ length: 4 }, () =>
    "0123456789ABCDEFGHJKLMNPQRSTVWXYZ"[Math.floor(Math.random() * 32)],
  ).join("")
  return `KN-${day}-${tail}`
}
