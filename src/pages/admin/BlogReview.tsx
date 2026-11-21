import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import PaginationBar, { paginateItems } from "@/components/PaginationBar"
import SearchFilterBar from "@/components/SearchFilterBar"
import { ApiError } from "@/lib/api"
import { PageHead, RequiredMark, Status, Table, Td } from "@/components/admin/ui"
import { POSTS, type Post } from "@/data/ops"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { initApiLoading, isSsrSmokeTest } from "@/lib/hydration"
import {
  fetchAdminBlogDetail,
  fetchAdminPendingBlogs,
  fetchPublishedBlogs,
  formatBlogCode,
  formatViDate,
  reviewAdminBlog,
  type BlogPostDetailDto,
  type BlogPostSummaryDto,
} from "@/lib/blogApi"

interface ReviewedRow {
  id: string
  code: string
  title: string
  slug?: string
  author: string
  status: "published" | "rejected"
  note?: string
}

/** A-09 Duyệt / hủy bài đăng Blog.
 *
 *  Hủy bài luôn bắt buộc có lý do: tác giả đã viết và chờ, họ cần biết sửa
 *  chỗ nào thay vì thấy bài biến mất. Cùng lý do với S-04 từ chối hồ sơ. */
export default function BlogReview() {
  const [liveMode] = useState(() => !isSsrSmokeTest())
  const [offlineList, setOfflineList] = useState<Post[]>(POSTS)

  const [pendingLive, setPendingLive] = useState<BlogPostSummaryDto[]>([])
  const [publishedLive, setPublishedLive] = useState<BlogPostSummaryDto[]>([])
  const [sessionReviewed, setSessionReviewed] = useState<ReviewedRow[]>([])
  const [detailsById, setDetailsById] = useState<Record<string, BlogPostDetailDto>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null)

  const [sort, setSort] = useState<"oldest" | "newest">("oldest")
  const [searchInput, setSearchInput] = useState("")
  const debouncedSearch = useDebouncedValue(searchInput, 250)
  const [searchQuery, setSearchQuery] = useState("")
  const [pendingPage, setPendingPage] = useState(1)
  const [pendingPageSize, setPendingPageSize] = useState(5)
  const [donePage, setDonePage] = useState(1)
  const [donePageSize, setDonePageSize] = useState(10)
  const [loading, setLoading] = useState(() => initApiLoading(true))

  useEffect(() => {
    setSearchQuery(debouncedSearch.trim())
    setPendingPage(1)
    setDonePage(1)
  }, [debouncedSearch])
  const [busyId, setBusyId] = useState<string | null>(null)

  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [flash, setFlash] = useState("")
  const [error, setError] = useState("")

  const loadLiveQueue = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [pendingRes, publishedRes] = await Promise.all([
        fetchAdminPendingBlogs({
          sort,
          search: searchQuery || undefined,
          pageSize: 50,
        }),
        fetchPublishedBlogs({ pageSize: 20 }).catch(() => null),
      ])
      setPendingLive(pendingRes.data?.items ?? [])
      if (publishedRes?.data?.items) {
        setPublishedLive(publishedRes.data.items)
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Không tải được danh sách bài viết chờ duyệt.",
      )
    } finally {
      setLoading(false)
    }
  }, [sort, searchQuery])

  useEffect(() => {
    if (!liveMode) return
    void loadLiveQueue()
  }, [liveMode, loadLiveQueue])

  const toggleDetail = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (detailsById[id] || !liveMode) return
    setLoadingDetailId(id)
    try {
      const res = await fetchAdminBlogDetail(id)
      if (res.data) {
        setDetailsById((prev) => ({ ...prev, [id]: res.data! }))
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không tải được nội dung chi tiết bài viết.",
      )
    } finally {
      setLoadingDetailId(null)
    }
  }

  const approveLive = async (post: BlogPostSummaryDto) => {
    setBusyId(post.id)
    setError("")
    setFlash("")
    try {
      const res = await reviewAdminBlog(post.id, { approve: true })
      const updated = res.data
      const code = formatBlogCode(post.id)
      setPendingLive((prev) => prev.filter((item) => item.id !== post.id))
      setSessionReviewed((prev) => [
        {
          id: post.id,
          code,
          title: updated?.title ?? post.title,
          slug: updated?.slug ?? post.slug,
          author: updated?.author?.fullName || post.author?.fullName || "Biên tập viên",
          status: "published",
        },
        ...prev.filter((row) => row.id !== post.id),
      ])
      if (rejectingId === post.id) {
        setRejectingId(null)
        setRejectReason("")
      }
      setFlash(`${code} đã xuất bản và hiển thị công khai trên trang Blog.`)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể duyệt và xuất bản bài viết này.",
      )
    } finally {
      setBusyId(null)
    }
  }

  const submitRejectLive = async (post: BlogPostSummaryDto) => {
    const trimmed = rejectReason.trim()
    if (!trimmed) {
      setError("Vui lòng nhập lý do hủy bài trước khi xác nhận.")
      return
    }
    setBusyId(post.id)
    setError("")
    setFlash("")
    try {
      const res = await reviewAdminBlog(post.id, { approve: false, feedback: trimmed })
      const updated = res.data
      const code = formatBlogCode(post.id)
      setPendingLive((prev) => prev.filter((item) => item.id !== post.id))
      setSessionReviewed((prev) => [
        {
          id: post.id,
          code,
          title: updated?.title ?? post.title,
          author: updated?.author?.fullName || post.author?.fullName || "Biên tập viên",
          status: "rejected",
          note: trimmed,
        },
        ...prev.filter((row) => row.id !== post.id),
      ])
      setRejectingId(null)
      setRejectReason("")
      setFlash(`${code} đã bị hủy với lý do "${trimmed}".`)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể hủy bài viết này.",
      )
    } finally {
      setBusyId(null)
    }
  }

  const approveOffline = (id: string) => {
    setError("")
    setOfflineList((ls) =>
      ls.map((p) => (p.id === id ? { ...p, status: "published", note: undefined } : p)),
    )
    setFlash(`${id} đã xuất bản, hiện công khai ngay.`)
  }

  const submitRejectOffline = (id: string) => {
    const trimmed = rejectReason.trim()
    if (!trimmed) {
      setError("Vui lòng nhập lý do hủy bài trước khi xác nhận.")
      return
    }
    setError("")
    setOfflineList((ls) =>
      ls.map((p) => (p.id === id ? { ...p, status: "rejected", note: trimmed } : p)),
    )
    setRejectingId(null)
    setRejectReason("")
    setFlash(`${id} đã bị hủy với lý do "${trimmed}".`)
  }

  const offlinePending = offlineList.filter((p) => p.status === "pending")
  const offlineDone: ReviewedRow[] = offlineList
    .filter((p) => p.status !== "pending")
    .map((p) => ({
      id: p.id,
      code: p.id,
      title: p.title,
      author: p.author,
      status: p.status === "published" ? "published" : "rejected",
      note: p.note,
    }))

  const liveDone: ReviewedRow[] = [
    ...sessionReviewed,
    ...publishedLive
      .filter((pub) => !sessionReviewed.some((row) => row.id === pub.id))
      .map((pub) => ({
        id: pub.id,
        code: formatBlogCode(pub.id),
        title: pub.title,
        slug: pub.slug,
        author: pub.author?.fullName || "Biên tập viên",
        status: "published" as const,
      })),
  ]

  const blogKeyword = searchQuery.trim().toLowerCase()
  const filteredOfflinePending = offlinePending.filter(
    (p) =>
      !blogKeyword ||
      p.title.toLowerCase().includes(blogKeyword) ||
      p.id.toLowerCase().includes(blogKeyword) ||
      p.author.toLowerCase().includes(blogKeyword),
  )
  const doneRows = (liveMode ? liveDone : offlineDone).filter(
    (p) =>
      !blogKeyword ||
      p.title.toLowerCase().includes(blogKeyword) ||
      p.code.toLowerCase().includes(blogKeyword) ||
      p.author.toLowerCase().includes(blogKeyword) ||
      (p.note ?? "").toLowerCase().includes(blogKeyword),
  )
  const pendingCount = liveMode ? pendingLive.length : filteredOfflinePending.length
  const pagedPendingLive = paginateItems(pendingLive, pendingPage, pendingPageSize)
  const pagedOfflinePending = paginateItems(filteredOfflinePending, pendingPage, pendingPageSize)
  const pagedDoneRows = paginateItems(doneRows, donePage, donePageSize)

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="DUYỆT NỘI DUNG"
        title="Duyệt bài Blog"
        body="Chỉ bài đã duyệt mới hiện công khai. Hủy bài thì phải nói lý do để tác giả sửa được, không biến mất im lặng."
        action={
          liveMode ? (
            <button
              type="button"
              onClick={() => void loadLiveQueue()}
              disabled={loading}
              className="btn-ghost h-10 px-4 text-sm"
            >
              {loading ? "Đang tải..." : "Làm mới"}
            </button>
          ) : undefined
        }
      />

      {flash && (
        <p role="status" className="text-[13px] font-semibold text-brand">
          {flash}
        </p>
      )}
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}

      <SearchFilterBar
        value={searchInput}
        onChange={(v) => setSearchInput(v)}
        label="Tìm kiếm bài viết"
        placeholder="Tìm theo tiêu đề, mã bài viết hoặc tác giả..."
        totalCount={pendingCount + doneRows.length}
        countLabel="bài viết"
      >
        {liveMode && (
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value === "newest" ? "newest" : "oldest")
              setPendingPage(1)
            }}
            aria-label="Thứ tự chờ duyệt"
            className="input h-10 w-auto text-xs"
          >
            <option value="oldest">Cũ nhất trước</option>
            <option value="newest">Mới nhất trước</option>
          </select>
        )}
      </SearchFilterBar>

      <section>
        <h2 className="text-base font-bold text-ink">Chờ duyệt ({pendingCount})</h2>
        {liveMode && loading ? (
          <p className="card mt-3 px-5 py-8 text-center text-sm text-muted">
            Đang tải danh sách bài viết chờ duyệt...
          </p>
        ) : pendingCount === 0 ? (
          <p className="card mt-3 px-5 py-8 text-center text-sm text-muted">
            Không có bài nào chờ duyệt.
          </p>
        ) : liveMode ? (
          <>
          <ul className="mt-3 flex flex-col gap-4">
            {pagedPendingLive.map((p) => {
              const code = formatBlogCode(p.id)
              const detail = detailsById[p.id]
              const isExpanded = expandedId === p.id
              const isRejecting = rejectingId === p.id
              const isBusy = busyId === p.id

              return (
                <li key={p.id} className="card flex flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-semibold text-brand">{code}</p>
                        {p.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <h3 className="mt-1 text-base leading-6 font-bold text-ink">{p.title}</h3>
                    </div>
                    <Status tone="wait">Chờ duyệt</Status>
                  </div>

                  <p className="text-sm leading-6 text-body">
                    {p.summary || "Chưa có mô tả tóm tắt."}
                  </p>
                  <p className="text-[13px] text-muted">
                    {p.author?.fullName || "Biên tập viên"} · Gửi lúc{" "}
                    {formatViDate(p.submittedAt ?? p.createdAt)}
                  </p>

                  {isExpanded && (
                    <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm leading-6 text-body">
                      {loadingDetailId === p.id && !detail ? (
                        <p className="text-muted">Đang tải nội dung bài viết...</p>
                      ) : detail ? (
                        <div className="flex flex-col gap-3">
                          {detail.coverImageUrl && (
                            <img
                              src={detail.coverImageUrl}
                              alt={detail.title}
                              className="max-h-56 w-full rounded-lg object-cover"
                            />
                          )}
                          {/<[a-z][\s\S]*>/i.test(detail.content) ? (
                            <div
                              className="prose max-w-none text-sm leading-7 text-body"
                              dangerouslySetInnerHTML={{ __html: detail.content }}
                            />
                          ) : (
                            <p className="whitespace-pre-line">{detail.content}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted">Không có nội dung chi tiết.</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 border-t border-line-soft pt-4">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void approveLive(p)}
                      className="btn-primary h-11 px-6"
                    >
                      {isBusy ? "Đang xử lý..." : "Duyệt và xuất bản"}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setError("")
                        if (isRejecting) {
                          setRejectingId(null)
                          setRejectReason("")
                        } else {
                          setRejectingId(p.id)
                          setRejectReason("")
                        }
                      }}
                      className="btn-ghost h-11 px-5"
                    >
                      Hủy bài
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleDetail(p.id)}
                      className="btn-ghost h-11 px-5"
                    >
                      {isExpanded ? "Thu gọn nội dung" : "Xem nội dung"}
                    </button>
                  </div>

                  {isRejecting && (
                    <div className="mt-1 flex flex-col gap-3 rounded-xl border border-bad/25 bg-bad/5 p-4">
                      <label
                        htmlFor={`reject-reason-${p.id}`}
                        className="text-sm font-semibold text-ink"
                      >
                        Lý do hủy bài {code} (tác giả sẽ thấy lý do này)
                        <RequiredMark />
                      </label>
                      <textarea
                        id={`reject-reason-${p.id}`}
                        rows={3}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Ví dụ: Cần bổ sung nguồn dẫn chứng hoặc hình ảnh minh hoạ rõ hơn..."
                        className="input min-h-[84px] py-2"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void submitRejectLive(p)}
                          className="btn-primary h-10 bg-bad px-4 text-sm hover:bg-bad/90"
                        >
                          Xác nhận hủy bài
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setRejectingId(null)
                            setRejectReason("")
                            setError("")
                          }}
                          className="btn-ghost h-10 px-4 text-sm"
                        >
                          Đóng
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <PaginationBar
            page={pendingPage}
            pageSize={pendingPageSize}
            totalCount={pendingLive.length}
            onPageChange={setPendingPage}
            onPageSizeChange={setPendingPageSize}
            pageSizeOptions={[5, 10, 20]}
            itemLabel="bài chờ duyệt"
          />
          </>
        ) : (
          <>
          <ul className="mt-3 flex flex-col gap-4">
            {pagedOfflinePending.map((p) => {
              const isRejecting = rejectingId === p.id
              return (
                <li key={p.id} className="card flex flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-brand">{p.id}</p>
                      <h3 className="text-base leading-6 font-bold text-ink">{p.title}</h3>
                    </div>
                    <Status tone="wait">Chờ duyệt</Status>
                  </div>
                  <p className="text-sm leading-6 text-body">{p.excerpt}</p>
                  <p className="text-[13px] text-muted">
                    {p.author} · {p.date}
                  </p>
                  <div className="flex flex-wrap gap-3 border-t border-line-soft pt-4">
                    <button
                      type="button"
                      onClick={() => approveOffline(p.id)}
                      className="btn-primary h-11 px-6"
                    >
                      Duyệt và xuất bản
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError("")
                        if (isRejecting) {
                          setRejectingId(null)
                          setRejectReason("")
                        } else {
                          setRejectingId(p.id)
                          setRejectReason("")
                        }
                      }}
                      className="btn-ghost h-11 px-5"
                    >
                      Hủy bài
                    </button>
                  </div>

                  {isRejecting && (
                    <div className="mt-1 flex flex-col gap-3 rounded-xl border border-bad/25 bg-bad/5 p-4">
                      <label
                        htmlFor={`reject-reason-${p.id}`}
                        className="text-sm font-semibold text-ink"
                      >
                        Lý do hủy bài {p.id} (tác giả sẽ thấy lý do này)
                      </label>
                      <textarea
                        id={`reject-reason-${p.id}`}
                        rows={2}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Nhập lý do hủy bài..."
                        className="input min-h-[72px] py-2"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => submitRejectOffline(p.id)}
                          className="btn-primary h-10 bg-bad px-4 text-sm hover:bg-bad/90"
                        >
                          Xác nhận hủy bài
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(null)
                            setRejectReason("")
                            setError("")
                          }}
                          className="btn-ghost h-10 px-4 text-sm"
                        >
                          Đóng
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <PaginationBar
            page={pendingPage}
            pageSize={pendingPageSize}
            totalCount={filteredOfflinePending.length}
            onPageChange={setPendingPage}
            onPageSizeChange={setPendingPageSize}
            pageSizeOptions={[5, 10, 20]}
            itemLabel="bài chờ duyệt"
          />
          </>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold text-ink">Đã xử lý ({doneRows.length})</h2>
        <div className="mt-3">
          <Table head={["Mã", "Tiêu đề", "Tác giả", "Kết quả", "Lý do"]}>
            {pagedDoneRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[13px] text-muted">
                  Chưa có bài viết nào đã xuất bản hoặc bị hủy.
                </td>
              </tr>
            ) : (
              pagedDoneRows.map((p) => (
                <tr key={p.id}>
                  <Td className="tabular-nums whitespace-nowrap">{p.code}</Td>
                  <Td className="font-semibold text-ink">
                    {p.slug && p.status === "published" ? (
                      <Link to={`/blog/${p.slug}`} className="hover:text-brand hover:underline">
                        {p.title}
                      </Link>
                    ) : (
                      p.title
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{p.author}</Td>
                  <Td>
                    <Status tone={p.status === "published" ? "ok" : "off"}>
                      {p.status === "published" ? "Đã xuất bản" : "Đã hủy"}
                    </Status>
                  </Td>
                  <Td>{p.note ?? "—"}</Td>
                </tr>
              ))
            )}
          </Table>
          <PaginationBar
            page={donePage}
            pageSize={donePageSize}
            totalCount={doneRows.length}
            onPageChange={setDonePage}
            onPageSizeChange={setDonePageSize}
            itemLabel="bài đã xử lý"
          />
        </div>
      </section>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Bài đã xuất bản xuất hiện ở trang Blog công khai. Hủy một bài đang chờ duyệt sẽ
        trả về trạng thái Nháp kèm lý do để biên tập viên chỉnh sửa và gửi duyệt lại.
      </p>
    </div>
  )
}