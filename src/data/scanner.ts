export const SCAN_RESULT = {
  image: "/assets/scanner/b7b43.png",
  imageCaption: "Hình ảnh: Chai nhựa trong suốt 500ml",
  tag: "Nhựa PET (#1)",
  confidence: 92,
  material: "Chai nhựa PET",
  badge: "Vật liệu có giá trị",
  description:
    "Dễ thu gom, có khả năng tái sinh tuần hoàn cao thành sợi hoặc chai mới.",
  price: { label: "ĐƠN GIÁ THAM KHẢO", value: "4.500 – 6.000", unit: "đ / kg" },
  model: "Mô hình phân loại ResNet-V2",
  /** token tên, không phải hex: đổi bảng màu là cả trang đổi theo */
  breakdown: [
    { label: "Chai nhựa (PET)", value: 92, color: "var(--color-brand)" },
    { label: "Chai thủy tinh", value: 5, color: "var(--color-mint)" },
    { label: "Khác", value: 3, color: "var(--color-sage-line)" },
  ],
  steps: [
    "Đổ sạch chất lỏng và tráng sơ bằng nước sạch.",
    "Tháo rời nắp chai và giẫm ép dẹp để tiết kiệm diện tích.",
  ],
}

/** Ba GIF robot AI của bạn — đúng MỘT ẢNH CHO MỖI TRẠNG THÁI:
 *  normal (chờ) / scan (đang quét) / done (đã có kết quả).
 *
 *  Đã bỏ nền và nén bằng ffmpeg. File gốc có NỀN HỒNG #FE01FD từ frame 2 trở
 *  đi (chỉ frame 0 trong suốt) — lỗi khi xuất, không phải chủ ý. WebP giữ
 *  alpha thật nên `colorkey` bỏ sạch; đi qua GIF thì pipeline
 *  palettegen/paletteuse của ffmpeg nuốt mất alpha.
 *
 *    ecolink-ai-normal.gif  5221KB -> ecolink-ai-normal.webp  1360KB  (giảm 74%)
 *    ecolink-ai-scan.gif    9357KB -> ecolink-ai-scan.webp    2558KB  (giảm 73%)
 *    ecolink-ai-done.gif    5090KB -> ecolink-ai-done.webp    1228KB  (giảm 76%)
 *
 *  Lệnh đã dùng cho từng file:
 *    ffmpeg -i <ten>.gif -vf "colorkey=0xFE01FD:0.3:0.2" \
 *           -c:v libwebp -lossless 0 -quality 72 -loop 0 -an <ten>.webp
 *
 *  File gốc GIF vẫn giữ nguyên trong public/assets/AI/ để dựng lại.
 *
 *  `ffprobe` ĐỌC HỎNG animated WebP (báo "image data not found") — đó là giới
 *  hạn demuxer của ffmpeg, KHÔNG phải file hỏng. Header đúng RIFF/WEBP/VP8X/
 *  ANIM/ANMF, trình duyệt hiển thị bình thường. Muốn kiểm tra thì mở bằng
 *  trình duyệt, đừng dùng ffprobe. */
export const AI_IDLE = "/assets/AI/ecolink-ai-normal.webp"
export const AI_SCANNING = "/assets/AI/ecolink-ai-scan.webp"
export const AI_DONE = "/assets/AI/ecolink-ai-done.webp"

/** demo: thời gian giả lập lúc "quét". Đủ lâu để thấy hiệu ứng, ngắn để
 *  không chờ bực. Có backend thì thay bằng thời gian thật của request. */
export const SCAN_MS = 2600

/** độ trễ từng bước khi kết quả hiện ra, đặt trong src/pages/Scanner.tsx (T).
 *  Ở đây chỉ giữ thông điệp, vì mốc thời gian gắn liền với cây DOM. */

/** thông điệp dưới ảnh robot khi đang quét. Trạng thái có kết quả thì
 *  chỉ hiện tiêu đề, không kèm câu phụ — tiêu đề đã đủ nghĩa. */
export const AI_MSG = {
  scanning: "Đang tìm vật liệu và ước lượng khối lượng...",
} as const

/** Lúc người dùng mới vào, chưa quét gì: phần kết quả mẫu biến thành hướng
 *  dẫn dùng, và "hướng dẫn xử lý nhanh" ẩn đi vì chưa có gì để hướng dẫn. */
export const HOW_TO = [
  {
    title: "Đưa ảnh vật rác vào",
    desc: "Chụp trực tiếp bằng camera, hoặc tải ảnh có sẵn trong máy.",
  },
  {
    title: "AI quét và nhận diện",
    desc: "Hệ thống tìm vật liệu, trả về đơn giá tham khảo kèm độ tin cậy.",
  },
  {
    title: "Xem cách xử lý, đặt lịch thu gom",
    desc: "Làm theo hướng dẫn rồi tìm người thu gom gần bạn.",
  },
]
