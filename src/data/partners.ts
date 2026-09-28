export const MATERIAL_TYPES = [
  "Tất cả loại phế liệu",
  "Nhựa PET & HDPE",
  "Giấy & bìa carton",
  "Kim loại & sắt thép",
  "Điện tử & pin Li-ion",
]

export const REGIONS = [
  "Tất cả khu vực",
  "TP. Hồ Chí Minh",
  "Bình Dương & Đồng Nai",
  "Hà Nội & vùng lân cận",
  "Đà Nẵng & miền Trung",
]

export type Partner = {
  name: string
  region: string
  certification: string
  logo: string
  materials: string[]
  minWeight: string
  perk: string
}

export const PARTNERS: Partner[] = [
  {
    name: "Công ty CP Tái chế Nhựa Duy Tân",
    region: "TP. Hồ Chí Minh & Long An, Bình Dương",
    certification: "ISO 14001",
    logo: "/assets/partners/2917f.png",
    materials: ["Nhựa PET công nghiệp", "Can & Chai HDPE", "Màng PP kiện"],
    minWeight: "Tối thiểu từ 100 kg",
    perk: "Hỗ trợ xe ép tận nơi",
  },
  {
    name: "Nhà máy Giấy & Bao bì Đồng Tiến",
    region: "Bình Dương, Đồng Nai & TP.HCM",
    certification: "FSC CoC",
    logo: "/assets/partners/14343.png",
    materials: ["Thùng Carton OCC", "Hồ sơ văn phòng hủy bảo mật", "Giấy bao bì phức hợp"],
    minWeight: "Tối thiểu từ 500 kg",
    perk: "Quy trình hủy có camera giám sát",
  },
  {
    name: "Tập đoàn Môi trường Xanh EGreen",
    region: "Khu công nghiệp Hà Nội & Bình Dương, TP.HCM",
    certification: "Hạng A TN&MT",
    logo: "/assets/partners/8f44f.png",
    materials: ["Sắt thép kết cấu phế liệu", "Đồng cáp, Nhôm định hình", "Thủy tinh công nghiệp"],
    minWeight: "Tối thiểu từ 2 tấn",
    perk: "Hỗ trợ tháo dỡ xưởng trọn gói",
  },
  {
    name: "Việt Nam Tái Chế (Vietnam Recycles)",
    region: "Hà Nội, TP.HCM & Đà Nẵng",
    certification: "Chứng nhận ESG",
    logo: "/assets/partners/46206.png",
    materials: ["Máy tính, Màn hình, Máy chủ", "Pin Li-ion, Ắc quy hết hạn", "Linh kiện điện tử hư hỏng"],
    minWeight: "Tối thiểu từ 50 kg",
    perk: "Hỗ trợ tiêu hủy an toàn dữ liệu",
  },
]

export const CTA = {
  kicker: "Dành cho đơn vị xử lý có giấy phép",
  title: "Trở thành nhà máy đối tác trong mạng lưới EcoLink",
  body: "Tiếp cận nguồn nguyên liệu thu gom ổn định từ hàng nghìn tòa nhà, xí nghiệp và doanh nghiệp đối tác phát thải trên toàn quốc.",
  action: "Đăng ký đối tác",
}
