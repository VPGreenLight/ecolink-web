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
