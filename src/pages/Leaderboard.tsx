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
          Xếp hạng người dùng
        </h1>
        <p className="mt-2 max-w-[62ch] text-base leading-7 text-body">
          Xếp theo điểm xếp hạng — tức là điểm tích luỹ trọn đời, không bao giờ
          bị trừ khi bạn đổi quà. Chuỗi điểm của bạn còn nguyên.
        </p>
      </header>

      <Leaderboard />

      <p className="mt-8 max-w-[68ch] text-sm leading-6 text-muted">
        Điểm xếp hạng cộng dồn từ giao rác đúng phân loại và điểm danh hằng
        ngày. Hạng được tính lại mỗi chu kỳ do Admin cấu hình, đang là chu kỳ
        tháng.
      </p>
    </div>
  )
}