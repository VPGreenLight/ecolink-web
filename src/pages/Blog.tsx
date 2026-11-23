import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import PaginationBar, { FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import { ARTICLES, FEATURED, METRICS } from "@/data/insights"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { initApiLoading, isSsrSmokeTest } from "@/lib/hydration"
import {
  estimateReadTime,
  fetchPublishedBlogs,
  formatViDate,
  type BlogPostSummaryDto,
} from "@/lib/blogApi"

/** Chỉ con số thành tích mới mang màu. Trước đây 350M+ và 9% tô cam cảnh
 *  báo ở cỡ 48px, biến chúng thành hai mảng nổi bật nhất trang. */
const VALUE_TONE = {
  good: "text-brand",
  warn: "text-ink",
} as const

export default function Blog() {
  const [liveMode] = useState(() => !isSsrSmokeTest())
  const [posts, setPosts] = useState<BlogPostSummaryDto[] | null>(null)
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 300)
  const [activeTag, setActiveTag] = useState("")
  const [queryText, setQueryText] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = FIXED_PAGE_SIZE

  useEffect(() => {
    setQueryText(debouncedSearch.trim())
    setPage(1)
  }, [debouncedSearch])

  useEffect(() => {
    let active = true
    if (liveMode) setLoading(true)
    fetchPublishedBlogs({
      search: queryText || undefined,
      tag: activeTag || undefined,
      pageSize: 50,
    })
      .then((res) => {
        if (!active) return
        setPosts(res.data?.items ?? [])
      })
      .catch(() => {
        if (!active) return
        setPosts((prev) => prev)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [queryText, activeTag, liveMode])

  const useBackend = posts !== null && (posts.length > 0 || liveMode || queryText !== "" || activeTag !== "")
  const featuredLive = useBackend && posts.length > 0 ? posts[0] : null
  const restLive = useBackend && posts.length > 1 ? posts.slice(1) : useBackend ? posts : []
  const pagedRestLive = paginateItems(restLive, page, pageSize)
  const offlineKw = queryText.trim().toLowerCase()
  const filteredOfflineArticles = ARTICLES.filter(
    (a) =>
      !offlineKw ||
      `${a.title} ${a.source} ${a.excerpt ?? ""}`.toLowerCase().includes(offlineKw),
  )
  const pagedOfflineArticles = paginateItems(filteredOfflineArticles, page, pageSize)
  const availableTags = Array.from(
    new Set((posts ?? []).flatMap((p) => p.tags ?? [])),
  ).slice(0, 8)

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

        <form
          onSubmit={(e) => {
            e.preventDefault()
            setQueryText(search.trim())
          }}
          className="mx-auto mt-6 flex max-w-md gap-2"
        >
          <input
            className="input h-10 flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm bài viết tái chế, phân loại..."
            aria-label="Tìm kiếm bài viết blog"
          />
          <button type="submit" className="btn-primary h-10 shrink-0 px-4 text-sm">
            Tìm
          </button>
          {(queryText || activeTag) && (
            <button
              type="button"
              onClick={() => {
                setSearch("")
                setQueryText("")
                setActiveTag("")
              }}
              className="btn-ghost h-10 shrink-0 px-3 text-sm"
            >
              Xóa lọc
            </button>
          )}
        </form>

        {availableTags.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {availableTags.map((tag) => {
              const selected = activeTag === tag
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setActiveTag(selected ? "" : tag)
                    setPage(1)
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    selected
                      ? "bg-brand text-white"
                      : "border border-line bg-surface text-body hover:border-brand/50"
                  }`}
                >
                  #{tag}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Featured story */}
      {loading && posts === null ? (
        <section className="pb-16 text-center text-sm text-muted">
          Đang tải bài viết mới nhất từ hệ thống...
        </section>
      ) : featuredLive ? (
        <section className="grid items-center gap-10 pb-20 md:grid-cols-12">
          <div className="aspect-[16/10] overflow-clip rounded-2xl bg-surface-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] md:col-span-7">
            <img
              src={featuredLive.coverImageUrl || FEATURED.image}
              alt={featuredLive.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>

          <div className="md:col-span-5">
            <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold tracking-[0.6px] text-brand uppercase">
                {featuredLive.tags[0] || "TIÊU ĐIỂM"}
              </span>
              <span className="text-body">
                • {formatViDate(featuredLive.publishedAt || featuredLive.createdAt)}
              </span>
              <span className="text-body">{featuredLive.author?.fullName || "EcoLink"}</span>
            </div>

            <h2 className="text-3xl leading-9 font-bold tracking-tight text-ink">
              {featuredLive.title}
            </h2>
            {featuredLive.summary && (
              <p className="mt-6 text-base leading-6 text-body">{featuredLive.summary}</p>
            )}

            <Link to={`/blog/${featuredLive.slug}`} className="link-underline mt-4 inline-flex">
              Đọc bài chi tiết
              <ArrowRight />
            </Link>
          </div>
        </section>
      ) : !useBackend ? (
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

            <a href="#curated" className="link-underline mt-2">
              Đọc bài phân tích
              <ArrowRight />
            </a>
          </div>
        </section>
      ) : null}

      {/* Metrics */}
      <section className="flex flex-col gap-12 border-y border-line py-12 sm:flex-row">
        {METRICS.map((m, i) => (
          <div
            key={m.label}
            className={i === 0 ? "flex-1" : "flex-1 border-line pl-0 sm:border-l sm:pl-12"}
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
      <section id="curated" className="max-w-[896px] pt-20 pb-16">
        <header className="flex items-baseline justify-between border-b border-line pb-4">
          <h2 className="text-2xl leading-8 font-bold tracking-tight text-ink">
            Bài viết chọn lọc
          </h2>
          <span className="text-xs text-body">
            {useBackend ? `${posts.length} bài đã xuất bản` : "Cập nhật hằng tuần"}
          </span>
        </header>

        {useBackend ? (
          restLive.length === 0 ? (
            <p className="py-10 text-sm text-muted">
              {posts.length === 0
                ? "Không tìm thấy bài viết phù hợp với bộ lọc hiện tại."
                : "Bài viết mới nhất đang được hiển thị ở mục Tiêu điểm phía trên."}
            </p>
          ) : (
            <>
              <ul>
                {pagedRestLive.map((p, i) => (
                  <li
                    key={p.id}
                    className={`flex flex-col gap-6 pt-8 pb-8 sm:flex-row sm:gap-8 ${
                      i > 0 ? "border-t border-line" : ""
                    }`}
                  >
                    <Link
                      to={`/blog/${p.slug}`}
                      className="h-36 w-full shrink-0 overflow-clip rounded-xl bg-surface-2 sm:h-32 sm:w-48"
                    >
                      <img
                        src={p.coverImageUrl || "/assets/insights/c4ba2.png"}
                        alt={p.title}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    </Link>

                    <div className="flex flex-1 flex-col">
                      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-semibold text-brand">
                          {p.author?.fullName || "EcoLink"}
                        </span>
                        <span className="text-body">
                          • {formatViDate(p.publishedAt || p.createdAt)}
                        </span>
                        <span className="text-body">
                          • {estimateReadTime(p.summary)}
                        </span>
                      </div>
                      <h3 className="text-xl leading-7 font-bold tracking-tight text-ink">
                        <Link to={`/blog/${p.slug}`} className="hover:text-brand">
                          {p.title}
                        </Link>
                      </h3>
                      {p.summary && (
                        <p className="mt-2 text-sm leading-[22.75px] text-body">
                          {p.summary}
                        </p>
                      )}
                      {p.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {p.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-muted"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <PaginationBar
                page={page}
                pageSize={pageSize}
                totalCount={restLive.length}
                onPageChange={setPage}
                itemLabel="bài viết"
              />
            </>
          )
        ) : pagedOfflineArticles.length === 0 ? (
          <p className="py-10 text-sm text-muted">
            Không tìm thấy bài viết phù hợp với từ khóa hiện tại.
          </p>
        ) : (
          <>
            <ul>
              {pagedOfflineArticles.map((a, i) => (
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
            <PaginationBar
              page={page}
              pageSize={pageSize}
              totalCount={filteredOfflineArticles.length}
              onPageChange={setPage}
              itemLabel="bài viết"
            />
          </>
        )}
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
