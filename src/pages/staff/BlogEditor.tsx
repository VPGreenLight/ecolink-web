import { useEffect, useState } from "react"
import PaginationBar, { paginateItems } from "@/components/PaginationBar"
import { PageHead, Field, Status, Table, Td } from "@/components/Portal"
import SearchFilterBar from "@/components/SearchFilterBar"
import { POSTS, type Post } from "@/data/ops"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import {
  createStaffBlog,
  deleteStaffBlog,
  fetchStaffBlogDetail,
  fetchStaffBlogs,
  formatBlogCode,
  formatViDate,
  recallStaffBlog,
  submitStaffBlog,
  updateStaffBlog,
  uploadBlogMedia,
  type BlogPostSummaryDto,
} from "@/lib/blogApi"
import { hasLiveBackendAuth } from "@/lib/session"

const BLOG_STATUS_META: Record<string, { label: string; tone: "wait" | "ok" | "off" | "todo" }> = {
  Draft: { label: "Bản nháp", tone: "todo" },
  Pending_Approval: { label: "Chờ duyệt", tone: "wait" },
  Approved: { label: "Đã xuất bản", tone: "ok" },
}

/** S-08 Soạn thảo bài đăng Blog. */
export default function BlogEditor() {
  const [liveMode] = useState(() => hasLiveBackendAuth())
  const [offlineList, setOfflineList] = useState<Post[]>(POSTS)
  const [liveList, setLiveList] = useState<BlogPostSummaryDto[]>([])
  const [loading, setLoading] = useState(liveMode)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [rejectionFeedback, setRejectionFeedback] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [content, setContent] = useState("")
  const [coverImageUrl, setCoverImageUrl] = useState("")
  const [tagsText, setTagsText] = useState("")
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState("")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)
  const [statusFilter, setStatusFilter] = useState<"all" | "Draft" | "Approved">("all")
  const [pendingPage, setPendingPage] = useState(1)
  const [restPage, setRestPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const loadStaffPosts = async () => {
    setLoading(true)
    try {
      const res = await fetchStaffBlogs({ pageSize: 50 })
      if (res.data?.items) setLiveList(res.data.items)
    } catch {
      // Giữ danh sách hiện tại
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (liveMode) void loadStaffPosts()
  }, [liveMode])

  const resetForm = () => {
    setEditingId(null)
    setRejectionFeedback(null)
    setTitle("")
    setExcerpt("")
    setContent("")
    setCoverImageUrl("")
    setTagsText("")
  }

  const handleUploadCover = async (file?: File) => {
    if (!file || !liveMode) return
    setUploading(true)
    setFlash("")
    try {
      const res = await uploadBlogMedia(file)
      if (res.data?.url || res.data?.fileUrl) {
        setCoverImageUrl(res.data.url || res.data.fileUrl)
        setFlash("Đã tải ảnh bìa lên máy chủ thành công.")
      }
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Tải ảnh bìa thất bại.")
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (submitForApproval: boolean) => {
    if (!liveMode) {
      if (title.trim().length < 10) {
        setFlash("Tiêu đề cần ít nhất 10 ký tự.")
        return
      }
      if (excerpt.trim().length < 30) {
        setFlash("Tóm tắt cần ít nhất 30 ký tự để người đọc biết bài nói gì.")
        return
      }
      const id = `BL-${String(offlineList.length + 89).padStart(4, "0")}`
      setOfflineList((ls) => [
        {
          id,
          title: title.trim(),
          excerpt: excerpt.trim(),
          author: "Lê Thu Hà",
          date: "30/09/2026",
          status: "pending",
        },
        ...ls,
      ])
      setTitle("")
      setExcerpt("")
      setFlash(`Đã gửi ${id} sang Admin duyệt. Bài chưa hiện công khai cho tới khi duyệt.`)
      return
    }

    if (saving) return
    setSaving(true)
    setFlash("")
    const tags = tagsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5)

    try {
      const payload = {
        title: title.trim(),
        summary: excerpt.trim() || null,
        content: content.trim() || null,
        coverImageUrl: coverImageUrl.trim() || null,
        tags,
        submitForApproval,
      }
      const res = editingId
        ? await updateStaffBlog(editingId, payload)
        : await createStaffBlog(payload)
      setFlash(
        res.message ||
          (submitForApproval
            ? "Bài viết đã được gửi Admin xét duyệt."
            : "Đã lưu bản nháp."),
      )
      resetForm()
      await loadStaffPosts()
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Không thể lưu bài viết.")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (id: string) => {
    setFlash("")
    try {
      const res = await fetchStaffBlogDetail(id)
      if (!res.data) return
      const d = res.data
      setEditingId(d.id)
      setRejectionFeedback(d.rejectionReason ?? null)
      setTitle(d.title)
      setExcerpt(d.summary ?? "")
      setContent(d.content ?? "")
      setCoverImageUrl(d.coverImageUrl ?? "")
      setTagsText((d.tags ?? []).join(", "))
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Không tải được chi tiết bài viết.")
    }
  }

  const blogKeyword = debouncedSearch.trim().toLowerCase()
  const pendingLive = liveList.filter(
    (p) =>
      p.status === "Pending_Approval" &&
      (!blogKeyword ||
        p.title.toLowerCase().includes(blogKeyword) ||
        formatBlogCode(p.id).toLowerCase().includes(blogKeyword)),
  )
  const restLive = liveList.filter((p) => {
    if (p.status === "Pending_Approval") return false
    if (statusFilter !== "all" && p.status !== statusFilter) return false
    if (!blogKeyword) return true
    return (
      p.title.toLowerCase().includes(blogKeyword) ||
      formatBlogCode(p.id).toLowerCase().includes(blogKeyword)
    )
  })
  const pendingOffline = offlineList.filter(
    (p) =>
      p.status === "pending" &&
      (!blogKeyword ||
        p.title.toLowerCase().includes(blogKeyword) ||
        p.id.toLowerCase().includes(blogKeyword) ||
        p.author.toLowerCase().includes(blogKeyword)),
  )
  const restOffline = offlineList.filter((p) => {
    if (p.status === "pending") return false
    if (statusFilter === "Approved" && p.status !== "published") return false
    if (statusFilter === "Draft" && p.status === "published") return false
    if (!blogKeyword) return true
    return (
      p.title.toLowerCase().includes(blogKeyword) ||
      p.id.toLowerCase().includes(blogKeyword) ||
      p.author.toLowerCase().includes(blogKeyword)
    )
  })

  const pagedPendingLive = paginateItems(pendingLive, pendingPage, pageSize)
  const pagedRestLive = paginateItems(restLive, restPage, pageSize)
  const pagedPendingOffline = paginateItems(pendingOffline, pendingPage, pageSize)
  const pagedRestOffline = paginateItems(restOffline, restPage, pageSize)

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="NỘI DUNG"
        title="Soạn bài Blog"
        body="Viết bài rồi gửi Admin duyệt. Bài ở trạng thái chờ duyệt không hiện công khai, và sẽ tự xuất bản ngay khi được duyệt."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSave(true)
        }}
        noValidate
        className="card flex flex-col gap-5 p-5 md:p-6"
      >
        {editingId && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/25 bg-brand/6 px-4 py-2.5 text-sm">
            <span className="font-semibold text-brand-deep">
              Đang chỉnh sửa: {formatBlogCode(editingId)}
              {rejectionFeedback && ` · Góp ý từ chối: "${rejectionFeedback}"`}
            </span>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-semibold text-muted hover:text-ink"
            >
              Tạo bài mới
            </button>
          </div>
        )}

        <Field label="Tiêu đề" hint="Từ 10 đến 150 ký tự.">
          <input
            className="input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setFlash("")
            }}
            placeholder="Nêu rõ điều bài nói, không dùng tiêu đề chung chung"
          />
        </Field>

        <Field label="Tóm tắt" hint="Hai ba câu, hiện ở đầu bài và trong danh sách bài mới.">
          <textarea
            className="input h-auto resize-y py-3 leading-6"
            rows={2}
            value={excerpt}
            onChange={(e) => {
              setExcerpt(e.target.value)
              setFlash("")
            }}
            placeholder="Đọc phần tóm tắt là người đọc biết có nên mở bài hay không."
          />
        </Field>

        {liveMode && (
          <>
            <Field label="Nội dung bài viết" hint="Bắt buộc khi gửi Admin duyệt (hỗ trợ văn bản hoặc HTML).">
              <textarea
                className="input h-auto resize-y py-3 leading-6"
                rows={6}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value)
                  setFlash("")
                }}
                placeholder="Nhập nội dung chi tiết bài viết về phân loại rác và kinh tế tuần hoàn..."
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="URL ảnh bìa (hoặc tải ảnh)" hint="Bắt buộc khi gửi duyệt (.jpg, .png, .webp).">
                <div className="flex flex-col gap-2">
                  <input
                    className="input"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    placeholder="https://... hoặc /assets/insights/36f2d.png"
                  />
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/50">
                    <span>{uploading ? "Đang tải ảnh..." : "Tải ảnh lên R2"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={uploading}
                      onChange={(e) => void handleUploadCover(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </Field>

              <Field label="Thẻ phân loại" hint="Tối đa 5 thẻ, phân cách bởi dấu phẩy (vd: tai-che, nhua).">
                <input
                  className="input"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="tai-che, phan-loai-rac"
                />
              </Field>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
          {liveMode && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave(false)}
              className="btn-ghost h-11 px-5"
            >
              {saving ? "Đang lưu..." : "Lưu bản nháp"}
            </button>
          )}
          <button type="submit" disabled={saving} className="btn-primary h-11 px-6">
            {saving ? "Đang gửi..." : "Gửi Admin duyệt"}
          </button>
          {flash && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {flash}
            </p>
          )}
        </div>
      </form>

      <SearchFilterBar
        value={search}
        onChange={(v) => {
          setSearch(v)
          setPendingPage(1)
          setRestPage(1)
        }}
        label="Tìm kiếm bài viết của tôi"
        placeholder="Tìm theo mã bài viết hoặc tiêu đề..."
        totalCount={
          liveMode
            ? pendingLive.length + restLive.length
            : pendingOffline.length + restOffline.length
        }
        countLabel="bài viết"
      >
        <select
          aria-label="Lọc trạng thái bài viết"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "all" | "Draft" | "Approved")
            setRestPage(1)
          }}
          className="input h-10 text-xs"
        >
          <option value="all">Nháp &amp; Đã xuất bản</option>
          <option value="Draft">Chỉ bản nháp</option>
          <option value="Approved">Đã xuất bản</option>
        </select>
      </SearchFilterBar>

      {liveMode ? (
        <>
          <section>
            <h2 className="text-base font-bold text-ink">Chờ duyệt ({pendingLive.length})</h2>
            <div className="mt-3">
              {loading && liveList.length === 0 ? (
                <p className="text-sm text-muted">Đang tải danh sách bài viết...</p>
              ) : (
                <>
                  <Table head={["Mã", "Tiêu đề", "Ngày gửi", "Trạng thái", "Thao tác"]}>
                    {pagedPendingLive.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted">
                          Không có bài chờ duyệt nào khớp bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      pagedPendingLive.map((p) => (
                        <tr key={p.id}>
                          <Td className="font-mono text-xs tabular-nums whitespace-nowrap">
                            {formatBlogCode(p.id)}
                          </Td>
                          <Td className="font-semibold text-ink">{p.title}</Td>
                          <Td className="tabular-nums whitespace-nowrap">
                            {formatViDate(p.submittedAt || p.updatedAt)}
                          </Td>
                          <Td>
                            <Status tone="wait">Chờ duyệt</Status>
                          </Td>
                          <Td>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await recallStaffBlog(p.id)
                                  setFlash("Đã thu hồi bài viết về bản nháp.")
                                  await loadStaffPosts()
                                } catch (err) {
                                  setFlash(err instanceof Error ? err.message : "Thu hồi thất bại.")
                                }
                              }}
                              className="text-xs font-semibold text-brand hover:underline"
                            >
                              Thu hồi
                            </button>
                          </Td>
                        </tr>
                      ))
                    )}
                  </Table>
                  <PaginationBar
                    page={pendingPage}
                    pageSize={pageSize}
                    totalCount={pendingLive.length}
                    onPageChange={setPendingPage}
                    onPageSizeChange={setPageSize}
                    itemLabel="bài chờ duyệt"
                  />
                </>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink">
              Bản nháp &amp; Đã xuất bản ({restLive.length})
            </h2>
            <div className="mt-3">
              <Table head={["Mã", "Tiêu đề", "Cập nhật", "Trạng thái", "Thao tác"]}>
                {pagedRestLive.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted">
                      Không có bài viết nào khớp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  pagedRestLive.map((p) => {
                  const meta = BLOG_STATUS_META[p.status] ?? {
                    label: p.status,
                    tone: "off" as const,
                  }
                  const isDraft = p.status === "Draft"
                  return (
                    <tr key={p.id}>
                      <Td className="font-mono text-xs tabular-nums whitespace-nowrap">
                        {formatBlogCode(p.id)}
                      </Td>
                      <Td className="font-semibold text-ink">{p.title}</Td>
                      <Td className="tabular-nums whitespace-nowrap">
                        {formatViDate(p.publishedAt || p.updatedAt)}
                      </Td>
                      <Td>
                        <Status tone={meta.tone}>{meta.label}</Status>
                      </Td>
                      <Td>
                        {isDraft ? (
                          <div className="flex flex-wrap gap-3 text-xs font-semibold">
                            <button
                              type="button"
                              onClick={() => void handleEdit(p.id)}
                              className="text-brand hover:underline"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await submitStaffBlog(p.id)
                                  setFlash("Đã nộp bài lên hàng đợi Admin.")
                                  await loadStaffPosts()
                                } catch (err) {
                                  setFlash(
                                    err instanceof Error
                                      ? err.message
                                      : "Bài cần có ảnh bìa và nội dung trước khi nộp duyệt.",
                                  )
                                }
                              }}
                              className="text-brand-deep hover:underline"
                            >
                              Nộp duyệt
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await deleteStaffBlog(p.id)
                                  setFlash("Đã xóa bản nháp.")
                                  await loadStaffPosts()
                                } catch (err) {
                                  setFlash(err instanceof Error ? err.message : "Không thể xóa.")
                                }
                              }}
                              className="text-warn hover:underline"
                            >
                              Xóa
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">/{p.slug}</span>
                        )}
                      </Td>
                    </tr>
                  )
                })
                )}
              </Table>
              <PaginationBar
                page={restPage}
                pageSize={pageSize}
                totalCount={restLive.length}
                onPageChange={setRestPage}
                onPageSizeChange={setPageSize}
                itemLabel="bài viết"
              />
            </div>
          </section>
        </>
      ) : (
        <>
          <section>
            <h2 className="text-base font-bold text-ink">Chờ duyệt ({pendingOffline.length})</h2>
            <div className="mt-3">
              <Table head={["Mã", "Tiêu đề", "Tác giả", "Ngày", "Trạng thái"]}>
                {pagedPendingOffline.map((p) => (
                  <tr key={p.id}>
                    <Td className="tabular-nums whitespace-nowrap">{p.id}</Td>
                    <Td className="font-semibold text-ink">{p.title}</Td>
                    <Td className="whitespace-nowrap">{p.author}</Td>
                    <Td className="tabular-nums whitespace-nowrap">{p.date}</Td>
                    <Td>
                      <Status tone="wait">Chờ duyệt</Status>
                    </Td>
                  </tr>
                ))}
              </Table>
              <PaginationBar
                page={pendingPage}
                pageSize={pageSize}
                totalCount={pendingOffline.length}
                onPageChange={setPendingPage}
                onPageSizeChange={setPageSize}
                itemLabel="bài chờ duyệt"
              />
            </div>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink">Đã xử lý ({restOffline.length})</h2>
            <div className="mt-3">
              <Table head={["Mã", "Tiêu đề", "Ngày", "Kết quả", "Lý do"]}>
                {pagedRestOffline.map((p) => (
                  <tr key={p.id}>
                    <Td className="tabular-nums whitespace-nowrap">{p.id}</Td>
                    <Td className="font-semibold text-ink">{p.title}</Td>
                    <Td className="tabular-nums whitespace-nowrap">{p.date}</Td>
                    <Td>
                      <Status tone={p.status === "published" ? "ok" : "off"}>
                        {p.status === "published" ? "Đã xuất bản" : "Bị từ chối"}
                      </Status>
                    </Td>
                    <Td>{p.note ?? "—"}</Td>
                  </tr>
                ))}
              </Table>
              <PaginationBar
                page={restPage}
                pageSize={pageSize}
                totalCount={restOffline.length}
                onPageChange={setRestPage}
                onPageSizeChange={setPageSize}
                itemLabel="bài đã xử lý"
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
