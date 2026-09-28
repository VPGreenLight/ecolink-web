import { ARTICLES, FEATURED, METRICS } from "@/data/insights"

/** Chỉ con số thành tích mới mang màu. Trước đây 350M+ và 9% tô cam cảnh
 *  báo ở cỡ 48px, biến chúng thành hai mảng nổi bật nhất trang. */
const VALUE_TONE = {
  good: "text-brand",
  warn: "text-ink",
} as const

export default function Blog() {
  return (
    <div className="page flex flex-col">
      {/* Blog hero */}
      <section className="py-10 text-center md:py-16">
        <p className="eyebrow">Tin tức &amp; phân tích</p>
        <h1 className="display mt-3 text-4xl leading-none md:text-[48px] md:leading-[48px]">
          Bài viết về rác thải &amp; kinh tế tuần hoàn
        </h1>
        <p className="mt-4 text-base leading-[26px] text-body">
          Chuỗi giá trị tái chế, hạn ngạch EPR và cách hạ tầng thu gom đang thay
          đổi tại Việt Nam.
        </p>
      </section>

      {/* Featured story: image + text */}
      <section className="grid items-center gap-10 pb-20 md:grid-cols-12">
        <div className="overflow-clip rounded-2xl bg-surface-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] md:col-span-7">
          <img
            src={FEATURED.image}
            alt={FEATURED.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="md:col-span-5">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold tracking-[0.6px] text-brand uppercase">
              {FEATURED.kicker}
            </span>
            <span className="text-body">• {FEATURED.readTime}</span>
            <span className="text-body">{FEATURED.publication}</span>
          </div>

          <h2 className="text-3xl leading-9 font-bold tracking-tight text-ink">
            {FEATURED.title}
          </h2>
          <p className="mt-6 text-base leading-6 text-body">{FEATURED.excerpt}</p>

          <a href="#" className="link-underline mt-2">
            Đọc bài phân tích
            <ArrowRight />
          </a>
        </div>
      </section>

      {/* Metrics */}
      <section className="flex flex-col gap-12 border-y border-line py-12 sm:flex-row">
        {METRICS.map((m, i) => (
          <div
            key={m.label}
            className={i === 0 ? "flex-1" : `flex-1 border-line pl-0 sm:border-l sm:pl-12`}
          >
            <p className="text-xs font-medium tracking-[1.2px] text-body uppercase">
              {m.label}
            </p>
            <p
              className={`text-[48px] leading-[48px] font-bold tracking-tight ${VALUE_TONE[m.tone]}`}
            >
              {m.value}
            </p>
            <p className="text-xs leading-[19.5px] text-body">{m.note}</p>
          </div>
        ))}
      </section>

      {/* Curated articles */}
      <section className="max-w-[896px] pt-20">
        <header className="flex items-baseline justify-between border-b border-line pb-4">
          <h2 className="text-2xl leading-8 font-bold tracking-tight text-ink">
            Bài viết chọn lọc
          </h2>
          <span className="text-xs text-body">Cập nhật hằng tuần</span>
        </header>

        <ul>
          {ARTICLES.map((a, i) => (
            <li
              key={a.title}
              className={`flex gap-8 pt-8 pb-8 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <div className="h-32 w-48 shrink-0 overflow-clip rounded-xl bg-surface-2">
                <img
                  src={a.image}
                  alt={a.source}
                  className="size-full object-cover"
                  loading="lazy"
                />
              </div>

              <div className="flex flex-1 flex-col">
                <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-semibold text-brand">{a.source}</span>
                  <span className="text-body">• {a.readTime}</span>
                </div>
                <h3 className="text-xl leading-7 font-bold tracking-tight text-ink">
                  {a.title}
                </h3>
                {a.excerpt && (
                  <p className="mt-2 text-sm leading-[22.75px] text-body">
                    {a.excerpt}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function ArrowRight() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 6h8m0 0L6.5 2.5M10 6l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
