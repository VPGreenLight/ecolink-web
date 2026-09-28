import { Link } from "react-router-dom"

/** Ba việc app thật sự làm, mỗi việc trỏ tới một route có thật */
const FEATURES = [
  {
    to: "/scanner",
    kicker: "01",
    title: "Nhận diện bằng AI",
    body: "Chụp ảnh rác, nhận vật liệu và đơn giá tham khảo trong vài giây, kèm hướng dẫn cách xử lý đúng.",
  },
  {
    to: "/map",
    kicker: "02",
    title: "Kết nối người thu gom",
    body: "Xem điểm thu gom quanh bạn và đặt lịch người thu gom đến tận nhà, theo dõi lộ trình.",
  },
  {
    to: "/partners",
    kicker: "03",
    title: "Nối chuỗi giá trị",
    body: "Kết nối trực tiếp với nhà máy tái chế đạt chuẩn, có chứng chỉ ISO và FSC công khai.",
  },
] as const

const STEPS = [
  "Chụp ảnh vật rác cần phân loại",
  "Nhận vật liệu, định giá và cách xử lý",
  "Đặt lịch thu gom tại nhà trong vài phút",
] as const

export default function Home() {
  return (
    <div className="page flex flex-col">
      {/* Hero: video là ảnh chính, nằm cạnh chữ nên hiện ngay khi vừa vào,
          không phải cuộn xuống mới thấy. Không đặt chữ đè lên video vì
          video động nên không kiểm soát được độ tương phản.

          Tỉ lệ 0.71 : 1 giữ nguyên phần video lớn hơn ~20% so với bản gốc.
          Cột chữ còn ~492px nên tiêu đề đặt lại 46px. */}
      <section className="pt-10 pb-10 md:pt-14 md:pb-12">
        <div className="grid items-center gap-10 lg:grid-cols-[0.71fr_1fr] lg:gap-12">
          <div>
            <p className="eyebrow">HỆ SINH THÁI TUẦN HOÀN</p>
            <h1 className="display mt-3 text-[34px] leading-[1.1] md:text-[42px] md:leading-[46px] lg:text-[46px] lg:leading-[50px]">
              Phân loại đúng – Thu gom dễ – Tái chế hiệu quả
            </h1>
            <p className="mt-4 text-base leading-[26px] text-body">
              Chụp ảnh để nhận diện rác, nhận hướng dẫn xử lý và kết nối với
              điểm thu gom tái chế gần bạn.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/scanner" className="btn-primary h-12 px-6">
                Thử nhận diện ngay
              </Link>
              <Link to="/map" className="btn-outline h-12 px-6">
                Tìm người thu gom
              </Link>
            </div>
          </div>

          {/* file do bạn bỏ vào public/assets/video/ */}
          <div className="overflow-clip rounded-2xl border border-line bg-surface-2 shadow-[0_1px_2px_rgba(15,31,21,0.05)]">
            <video
              className="aspect-video w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster="/assets/video/poster.jpg"
              aria-label="Video giới thiệu cách dùng EcoLink"
            >
              <source src="/assets/video/intro.mp4" type="video/mp4" />
              Trình duyệt của bạn không hỗ trợ phát video.
            </video>
          </div>
        </div>
      </section>

      {/* 3 bước — đặt ngay dưới hero trong một khối nền riêng để thấy rõ
          hơn các phần bên dưới. Số + chữ đặt cạnh nhau thay vì xếp dọc,
          bỏ border-y, padding thu gọn: tiết kiệm ~72px chiều cao. */}
      <section className="rounded-2xl border border-line bg-surface-2/70 px-5 py-8 md:px-8 md:py-10">
        <h2 className="text-center text-xl leading-7 font-bold tracking-tight text-ink">
          EcoLink hoạt động thế nào
        </h2>
        <ol className="mt-8 grid gap-y-6 sm:grid-cols-3 sm:gap-x-8">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-base font-bold text-white">
                {i + 1}
              </span>
              <p className="pt-1.5 text-base leading-6 font-semibold text-ink">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* 3 tính năng */}
      <section className="py-12 md:py-14">
        <h2 className="text-2xl leading-8 font-bold tracking-tight text-ink">
          Nền tảng gồm những gì
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <Link
              key={f.to}
              to={f.to}
              className="card group flex flex-col p-6 transition-colors hover:border-brand/40 hover:bg-surface-2/60"
            >
              <span className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">
                {f.kicker}
              </span>
              <h3 className="mt-3 text-lg leading-7 font-bold text-ink">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-body">{f.body}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand">
                Tìm hiểu
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
