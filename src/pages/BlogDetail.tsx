import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  estimateReadTime,
  fetchPublishedBlogBySlug,
  formatViDate,
  type PublicBlogPostDto,
} from "@/lib/blogApi"

export default function BlogDetail() {
  const { slug = "" } = useParams<{ slug: string }>()
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
        <Link to="/blog" className="text-sm font-semibold text-brand hover:underline">
          ← Quay lại trang Blog
        </Link>
        <p className="mt-8 text-sm text-muted">Đang tải nội dung bài viết...</p>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="page max-w-[820px] py-12">
        <Link to="/blog" className="text-sm font-semibold text-brand hover:underline">
          ← Quay lại trang Blog
        </Link>
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
    <article className="page max-w-[820px] pt-10 pb-20">
      <Link to="/blog" className="text-sm font-semibold text-brand hover:underline">
        ← Quay lại trang Blog
      </Link>

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
    </article>
  )
}
