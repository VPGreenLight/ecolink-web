import Leaderboard from "@/components/Leaderboard"

/** Bảng xếp hạng người dùng.
 *
 *  Tách khỏi `/rewards` và đặt ở phần Khám phá của menu vì xếp hạng là thứ
 *  người dùng vào xem chứ không phải thứ họ phải đổi điểm mới thấy: giữ nó
 *  trong trang đổi thưởng thì phải cuộn qua 6 món quà và 3 giải lớn mới tới.
 *
 *  Component `Leaderboard` giữ nguyên vì dùng chung cho cả trang này. */
export default function LeaderboardPage() {
  return (
    <div className="page flex flex-col pb-16">
      <header className="pt-10 md:pt-14">
        <h1 className="display text-[28px] leading-9 md:text-[34px] md:leading-11">
          Bảng xếp hạng đóng góp Sống Xanh
        </h1>
        <p className="mt-2 max-w-[66ch] text-base leading-7 text-body">
          Áp dụng cho cả Người dân và Người thu gom (Cơ sở thu mua). Xếp hạng theo Điểm Xanh
          tích lũy trong chu kỳ từ các giao dịch hoàn tất và điểm danh hằng ngày — đổi quà không
          bao giờ làm tụt hạng của bạn.
        </p>
      </header>

      <Leaderboard />

      <p className="mt-8 max-w-[70ch] text-sm leading-6 text-muted">
        Cuối mỗi chu kỳ (Tuần / Tháng / Quý), Top 3 thành viên dẫn đầu được trao thưởng Điểm Xanh
        vào ví theo cơ cấu giải do Admin cấu hình. Nếu đồng điểm, hệ thống xét theo điểm trọn đời
        và tổng khối lượng phế liệu đã tái chế.
      </p>
    </div>
  )
}