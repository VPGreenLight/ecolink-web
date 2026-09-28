export const ADDRESS = "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1"
export const RADII = ["1 km", "3 km"] as const

export type MapPin = {
  label: string
  /** percentage offsets, exactly as in the Figma layout */
  pos: { top: string; right: string; bottom: string; left: string }
  active?: boolean
  opacity?: number
}

export const PINS: MapPin[] = [
  {
    label: "Bạn ở đây",
    pos: { top: "49.03%", right: "47.92%", bottom: "45.03%", left: "43.92%" },
  },
  {
    label: "Cô Ba (450m)",
    pos: { top: "38%", right: "46.86%", bottom: "58.69%", left: "36%" },
    active: true,
  },
  {
    label: "Anh Tuấn (1.2km)",
    pos: { top: "64%", right: "18.83%", bottom: "32.95%", left: "64%" },
    opacity: 0.9,
  },
  {
    label: "Vựa Minh Khai (2.1km)",
    pos: { top: "24%", right: "9.9%", bottom: "73.3%", left: "70%" },
    opacity: 0.85,
  },
]

export const PARTNER = {
  name: "Cô Ba Thu Gom",
  distance: "Cách bạn 450m",
  status: "Đang hoạt động",
  avatar: "/assets/map/0d2bf.png",
}

export const CHAT = {
  timestamp: "Hôm nay, 09:32",
  photos: [
    { label: "Giấy bìa carton", src: "/assets/map/106f5.png" },
    { label: "Chai nhựa tái chế", src: "/assets/map/238fa.png" },
  ],
  outgoing: {
    time: "09:32",
    text: "Cô ơi cháu có khoảng 15kg bìa carton và 5kg chai nhựa, cô qua lấy giúp cháu nhé!",
  },
  incoming: {
    time: "09:34",
    text: "Được con nhé! Khoảng 15 phút nữa cô đạp xe qua ngõ 24 gom cho con luôn.",
  },
  appointment: {
    title: "Lịch hẹn thu gom",
    badge: "Đã xác nhận",
    rows: [
      { label: "Thời gian dự kiến", value: "15 phút nữa (~09:50)" },
      { label: "Khối lượng ước tính", value: "20 kg tổng hợp" },
    ],
  },
  inputPlaceholder: "Nhắn tin với Cô Ba...",
}
