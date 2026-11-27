import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import BlogReadingReward from "@/components/BlogReadingReward"
import {
  estimateReadTime,
  fetchPublishedBlogBySlug,
  formatViDate,
  type PublicBlogPostDto,
} from "@/lib/blogApi"

function BackToBlog({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/blog"
      className={`group inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-sm font-semibold text-body shadow-[0_1px_2px_rgba(15,31,21,0.04)] transition-[color,border-color,background-color,transform] duration-200 ease-out hover:border-sage-line hover:bg-surface-2 hover:text-brand-deep focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] ${className}`}
    >
      <ArrowLeft
        aria-hidden="true"
        className="size-4 transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
      />
      Quay lại trang Blog
    </Link>
  )
}

export default function BlogDetail() {
  const { slug = "" } = useParams<{ slug: string }>()
  const articleRef = useRef<HTMLElement | null>(null)
  const [post, setPost] = useState<PublicBlogPostDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      setError("Không tìm thấy đường dẫn bài viết.")
      return
    }
    let active = true
    setLoading(true)
    setError("")
    fetchPublishedBlogBySlug(slug)
      .then((res) => {
        if (!active) return
        setPost(res.data)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : "Không tải được nội dung bài viết.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slug])

  if (loading) {
    return (
      <div className="page max-w-[820px] py-12">
        <BackToBlog />
        <p className="mt-8 text-sm text-muted">Đang tải nội dung bài viết...</p>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="page max-w-[820px] py-12">
        <BackToBlog />
        <div className="card mt-6 p-6">
          <h1 className="text-xl font-bold text-ink">Không tìm thấy bài viết</h1>
          <p className="mt-2 text-sm text-muted">
            {error || "Bài viết có thể chưa được xuất bản hoặc đã bị gỡ."}
          </p>
        </div>
      </div>
    )
  }

  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(post.content)

  return (
    <article ref={articleRef} className="page max-w-[820px] pt-10 pb-20">
      <BlogReadingReward slug={post.slug} targetRef={articleRef} />
      <BackToBlog />

      <header className="mt-6">
        {post.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-deep"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <h1 className="display text-3xl leading-tight md:text-[40px]">{post.title}</h1>

        <p className="mt-4 text-sm text-muted">
          Tác giả: <span className="font-semibold text-ink">{post.authorName}</span>
          {" · "}
          Xuất bản: {formatViDate(post.publishedAt)}
          {" · "}
          {estimateReadTime(post.content)}
        </p>

        {post.summary && (
          <p className="mt-5 rounded-xl border border-line bg-surface-2 p-4 text-base leading-7 text-ink">
            {post.summary}
          </p>
        )}
      </header>

      {post.coverImageUrl && (
        <figure className="mt-7 overflow-hidden rounded-2xl border border-line bg-surface-2">
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="max-h-[440px] w-full object-cover"
          />
        </figure>
      )}

      <div className="mt-8 space-y-4 text-base leading-8 text-body">
        {hasHtmlTags ? (
          <div
            className="prose max-w-none space-y-4 leading-8 text-body"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          post.content
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((para, idx) => (
              <p key={idx} className="whitespace-pre-line">
                {para}
              </p>
            ))
        )}
      </div>

      <footer className="mt-14 border-t border-line-soft pt-8">
        <BackToBlog className="min-h-11 w-full justify-center px-4 sm:w-auto" />
      </footer>
    </article>
  )
}
