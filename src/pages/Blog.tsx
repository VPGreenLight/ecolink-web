import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import PaginationBar, { paginateItems } from "@/components/PaginationBar"
import { ARTICLES, FEATURED, METRICS } from "@/data/insights"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { initApiLoading, isSsrSmokeTest } from "@/lib/hydration"
import {
  fetchPublishedBlogs,
  formatViDate,
  type BlogPostSummaryDto,
} from "@/lib/blogApi"

const VALUE_TONE = {
  good: "text-brand-deep",
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
  const [pageSize, setPageSize] = useState(6)

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
    <div className="page flex flex-col pb-20">
      {/* Blog Hero Header */}
      <section className="relative pt-12 pb-16 md:pt-16 md:pb-20 text-center max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl md:text-[54px] font-extrabold tracking-tight text-ink leading-[1.12]">
          Bài viết về rác thải &amp; kinh tế tuần hoàn
        </h1>
        <p className="mt-4 text-base sm:text-xl leading-relaxed text-body max-w-3xl mx-auto font-normal">
          Chuỗi giá trị tái chế, chính sách trách nhiệm mở rộng của nhà sản xuất (EPR) và cách hạ tầng thu gom tuần hoàn đang đổi mới tại Việt Nam.
        </p>

        {/* Search Bar - High-End Double Bezel shape enlarged ~20% */}
        <div className="mx-auto mt-9 max-w-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setQueryText(search.trim())
            }}
            className="flex items-center gap-2 rounded-2xl border border-line-soft bg-surface-2/60 p-2 shadow-[0_4px_16px_rgba(15,31,21,0.06)] focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/10 transition-all"
          >
            <div className="flex flex-1 items-center gap-3 px-3.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5 text-muted shrink-0">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="w-full bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm bài viết tái chế, phân loại, chính sách EPR..."
                aria-label="Tìm kiếm bài viết blog"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-deep shrink-0 active:scale-[0.98]"
            >
              Tìm kiếm
            </button>
            {(queryText || activeTag) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("")
                  setQueryText("")
                  setActiveTag("")
                }}
                className="inline-flex h-11 items-center rounded-xl px-3.5 text-sm font-medium text-muted hover:text-ink hover:bg-surface-3 transition-colors shrink-0"
              >
                Xóa lọc
              </button>
            )}
          </form>

          {/* Tag Pills */}
          {availableTags.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
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
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                      selected
                        ? "bg-brand text-white shadow-sm"
                        : "border border-line-soft bg-white text-body hover:border-brand/40 hover:text-brand-deep"
                    }`}
                  >
                    #{tag}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Featured Editorial Story */}
      {loading && posts === null ? (
        <section className="py-12 text-center text-sm text-muted">
          Đang tải bài viết mới nhất từ hệ thống...
        </section>
      ) : featuredLive ? (
        <section className="mb-16">
          <div className="rounded-2xl border border-line-soft bg-surface-2/60 p-2 sm:p-3">
            <div className="group grid items-center gap-8 rounded-xl border border-line-soft bg-white p-5 sm:p-7 shadow-sm transition-all duration-300 hover:shadow-md md:grid-cols-12">
              <div className="aspect-[16/10] overflow-hidden rounded-xl bg-surface-2 md:col-span-7">
                <img
                  src={featuredLive.coverImageUrl || FEATURED.image}
                  alt={featuredLive.title}
                  className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>

              <div className="flex flex-col justify-center md:col-span-5 md:pr-4">
                <div className="mb-3 flex flex-wrap items-center gap-2.5 text-xs text-muted">
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 font-bold tracking-wide text-brand-deep uppercase">
                    {featuredLive.tags[0] || "Tiêu điểm"}
                  </span>
                  <span>•</span>
                  <time>{formatViDate(featuredLive.publishedAt || featuredLive.createdAt)}</time>
                  <span>•</span>
                  <span>{featuredLive.author?.fullName || "EcoLink"}</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink leading-snug group-hover:text-brand-deep transition-colors">
                  <Link to={`/blog/${featuredLive.slug}`}>
                    {featuredLive.title}
                  </Link>
                </h2>
                {featuredLive.summary && (
                  <p className="mt-3.5 text-sm sm:text-base leading-relaxed text-body line-clamp-3">
                    {featuredLive.summary}
                  </p>
                )}

                <div className="mt-5">
                  <Link
                    to={`/blog/${featuredLive.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-deep hover:text-brand transition-colors"
                  >
                    <span>Đọc bài chi tiết</span>
                    <ArrowRight />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : !useBackend ? (
        <section className="mb-16">
          <div className="rounded-2xl border border-line-soft bg-surface-2/60 p-2 sm:p-3">
            <div className="group grid items-center gap-8 rounded-xl border border-line-soft bg-white p-5 sm:p-7 shadow-sm transition-all duration-300 hover:shadow-md md:grid-cols-12">
              <div className="aspect-[16/10] overflow-hidden rounded-xl bg-surface-2 md:col-span-7">
                <img
                  src={FEATURED.image}
                  alt={FEATURED.title}
                  className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>

              <div className="flex flex-col justify-center md:col-span-5 md:pr-4">
                <div className="mb-3 flex flex-wrap items-center gap-2.5 text-xs text-muted">
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 font-bold tracking-wide text-brand-deep uppercase">
                    {FEATURED.kicker}
                  </span>
                  <span>•</span>
                  <span>{FEATURED.readTime}</span>
                  <span>•</span>
                  <span>{FEATURED.publication}</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink leading-snug group-hover:text-brand-deep transition-colors">
                  <a href="#curated">
                    {FEATURED.title}
                  </a>
                </h2>
                <p className="mt-3.5 text-sm sm:text-base leading-relaxed text-body line-clamp-3">
                  {FEATURED.excerpt}
                </p>

                <div className="mt-5">
                  <a
                    href="#curated"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-deep hover:text-brand transition-colors"
                  >
                    <span>Đọc bài phân tích</span>
                    <ArrowRight />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* High-End Bento Metrics Grid */}
      <section className="mb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {METRICS.map((m) => (
            <div
              key={m.label}
              className="flex flex-col justify-between rounded-2xl border border-line-soft bg-surface-2/40 p-5 sm:p-6 transition-all hover:bg-surface-2/70"
            >
              <p className="text-xs font-semibold tracking-wider text-muted uppercase">
                {m.label}
              </p>
              <div className="my-3">
                <span className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${VALUE_TONE[m.tone]}`}>
                  {m.value}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-body">{m.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Curated Articles - Bento / Card Grid */}
      <section id="curated" className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line-soft pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              Bài viết chọn lọc
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {useBackend ? `${posts?.length ?? 0} bài đã xuất bản` : "Cập nhật định kỳ từ chuyên gia EcoLink"}
            </p>
          </div>
        </div>

        {useBackend ? (
          restLive.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-soft bg-surface-2/30 py-16 px-4 text-center">
              <p className="text-sm font-medium text-ink">
                {posts.length === 0
                  ? "Không tìm thấy bài viết phù hợp với bộ lọc hiện tại."
                  : "Bài viết mới nhất đang được hiển thị ở mục Tiêu điểm phía trên."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pagedRestLive.map((p) => (
                  <article
                    key={p.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-line-soft bg-white shadow-sm transition-all duration-200 hover:border-line hover:shadow-md"
                  >
                    <Link
                      to={`/blog/${p.slug}`}
                      className="aspect-[16/10] w-full overflow-hidden bg-surface-2"
                    >
                      <img
                        src={p.coverImageUrl || "/assets/insights/c4ba2.png"}
                        alt={p.title}
                        className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                        loading="lazy"
                      />
                    </Link>

                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                        <span className="font-semibold text-brand-deep">
                          {p.author?.fullName || "EcoLink"}
                        </span>
                        <span>•</span>
                        <time>{formatViDate(p.publishedAt || p.createdAt)}</time>
                      </div>

                      <h3 className="text-base font-bold tracking-tight text-ink group-hover:text-brand-deep transition-colors line-clamp-2">
                        <Link to={`/blog/${p.slug}`}>
                          {p.title}
                        </Link>
                      </h3>

                      {p.summary && (
                        <p className="mt-2 text-xs leading-relaxed text-body line-clamp-3 flex-1">
                          {p.summary}
                        </p>
                      )}

                      {p.tags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-line-soft">
                          {p.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-8">
                <PaginationBar
                  page={page}
                  pageSize={pageSize}
                  totalCount={restLive.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[6, 12, 24]}
                  itemLabel="bài viết"
                />
              </div>
            </>
          )
        ) : pagedOfflineArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-soft bg-surface-2/30 py-16 px-4 text-center">
            <p className="text-sm font-medium text-ink">
              Không tìm thấy bài viết phù hợp với từ khóa hiện tại.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pagedOfflineArticles.map((a) => (
                <article
                  key={a.title}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-line-soft bg-white shadow-sm transition-all duration-200 hover:border-line hover:shadow-md"
                >
                  <div className="aspect-[16/10] w-full overflow-hidden bg-surface-2">
                    <img
                      src={a.image}
                      alt={a.source}
                      className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                      <span className="font-semibold text-brand-deep">{a.source}</span>
                      <span>•</span>
                      <span>{a.readTime}</span>
                    </div>

                    <h3 className="text-base font-bold tracking-tight text-ink group-hover:text-brand-deep transition-colors line-clamp-2">
                      {a.title}
                    </h3>

                    {a.excerpt && (
                      <p className="mt-2 text-xs leading-relaxed text-body line-clamp-3 flex-1">
                        {a.excerpt}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-8">
              <PaginationBar
                page={page}
                pageSize={pageSize}
                totalCount={filteredOfflineArticles.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[6, 12, 24]}
                itemLabel="bài viết"
              />
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function ArrowRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="transition-transform group-hover:translate-x-0.5"
    >
      <path
        d="M2.5 7h9m0 0L8 3.5M11.5 7L8 10.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
