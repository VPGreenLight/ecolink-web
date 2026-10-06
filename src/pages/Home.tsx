import { useRef, useState } from "react"
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
  const video = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)

  /** Bật tiếng. `play()` phải gọi lại trong thao tác của người dùng: video đang
   *  `autoplay muted`, nếu chỉ gỡ `muted` thì trình duyệt coi là phát tự động
   *  có tiếng và từ chối. Chỉ sửa thuộc tính là không đủ. */
  const toggleSound = () => {
    const v = video.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    if (!v.muted) void v.play()
  }

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
          <div className="relative overflow-clip rounded-2xl border border-line bg-surface-2 shadow-[0_1px_2px_rgba(15,31,21,0.05)]">
            <video
              ref={video}
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

            {/* `muted` là điều kiện bắt buộc để `autoplay` chạy — trình duyệt
                chặn video có tiếng tự phát. Nên mặc định luôn tắt tiếng và
                để người xem tự bật, thay vì đợi video cạn tiếng rồi mới nói. */}
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={!muted}
              aria-label={muted ? "Bật tiếng video" : "Tắt tiếng video"}
              title={muted ? "Bật tiếng" : "Tắt tiếng"}
              className="absolute right-3 bottom-3 grid size-9 place-items-center rounded-full text-ink/75 ring-1 ring-ink/15 transition-colors hover:bg-ink/6 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
            >
              {muted ? <MuteIcon /> : <SoundIcon />}
            </button>
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

/** Hai icon cùng bộ kích thước: chỉ khác ở sóng âm, đổi trạng thái mà không
 *  nhảy layout. */
const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function SoundIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-4">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" {...stroke} />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.5 6.5a8 8 0 0 1 0 11" {...stroke} />
    </svg>
  )
}

function MuteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-4">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" {...stroke} />
      <path d="m15.5 9.5 5 5m0-5-5 5" {...stroke} />
    </svg>
  )
}
