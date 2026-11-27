import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { FormRequiredLegend, PageHead, RequiredMark, Status } from "@/components/Portal"
import {
  CATEGORIES,
  DESC_MAX,
  DESC_MIN,
  FAQ,
  MAX_PHOTO_MB,
  MAX_PHOTOS,
  REVIEW_COMMENT_MAX,
  STEPS,
  type Category,
} from "@/data/feedback"
import { ApiError } from "@/lib/api"
import { isSsrSmokeTest } from "@/lib/hydration"
import { openAuthPopup } from "@/lib/popupAuth"
import { fetchHandoverOrdersResult, type SyncedHandoverOrder } from "@/lib/recyclerWorkflowApi"
import {
  createHandoverReview,
  deleteMyReview,
  fetchMyComplaints,
  fetchMyReviews,
  submitComplaint,
  uploadComplaintEvidence,
  type ComplaintCategoryCode,
  type ComplaintSummaryDto,
  type TransactionReviewDto,
} from "@/lib/reviewComplaintApi"
import { hasLiveBackendAuth, useSession } from "@/lib/session"

const COMPLAINT_CATEGORIES: { value: ComplaintCategoryCode; label: string }[] = [
  { value: "ScaleDiscrepancy", label: "Sai lệch khối lượng / số cân" },
  { value: "PaymentIssue", label: "Vấn đề thanh toán / đối soát" },
  { value: "NoShow", label: "Không đến đúng lịch hẹn bàn giao" },
  { value: "Misconduct", label: "Thái độ / vi phạm quy trình" },
  { value: "Other", label: "Vấn đề khác" },
]

const COMPLAINT_STATUS_LABEL: Record<string, string> = {
  Open: "Mới tiếp nhận",
  Investigating: "Đang xác minh",
  Resolved: "Đã giải quyết",
  Dismissed: "Đã đóng / từ chối",
}

const COMPLAINT_STATUS_TONE: Record<string, "ok" | "off" | "todo" | "wait"> = {
  Open: "todo",
  Investigating: "wait",
  Resolved: "ok",
  Dismissed: "off",
}

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"])

type PhotoPreview = {
  file: File
  previewUrl: string
}

function formatViDateTime(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getErrMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message || fallback
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

/** G-03 / U-10 / U-11 Khiếu nại giao dịch (User ↔ Recycler sau hoàn tất biên nhận)
 *  & Đánh giá / Góp ý (chỉ dành cho Người dân sau hoàn tất, 1 đánh giá / đơn;
 *  xóa đánh giá cũ để được phép gửi lại đánh giá mới). */
export default function Feedback() {
  const session = useSession()
  const liveAuth = hasLiveBackendAuth()
  const [searchParams] = useSearchParams()

  const isRecycler = session?.role === "recycler"
  const isUser = session?.role === "user"
  const isParticipant = isUser || isRecycler
  const isStaffOrAdmin = session?.role === "staff" || session?.role === "admin"

  const initialTabParam = searchParams.get("tab")
  const initialOrderParam = searchParams.get("orderId")?.trim() ?? ""

  const [cat, setCat] = useState<Category>(() =>
    initialTabParam === "review" && !isRecycler ? "review" : "complaint",
  )

  useEffect(() => {
    if (isRecycler && cat !== "complaint") {
      setCat("complaint")
    }
  }, [isRecycler, cat])

  // Dữ liệu thực từ Backend
  const [completedOrders, setCompletedOrders] = useState<SyncedHandoverOrder[]>([])
  const [myComplaints, setMyComplaints] = useState<ComplaintSummaryDto[]>([])
  const [myReviews, setMyReviews] = useState<TransactionReviewDto[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [loadErr, setLoadErr] = useState("")

  // Biểu mẫu Khiếu nại giao dịch
  const [complaintOrderId, setComplaintOrderId] = useState(initialOrderParam)
  const [complaintCategory, setComplaintCategory] = useState<ComplaintCategoryCode>("ScaleDiscrepancy")
  const [desc, setDesc] = useState("")
  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [complaintErr, setComplaintErr] = useState("")
  const [complaintOk, setComplaintOk] = useState("")
  const [complaintSubmitting, setComplaintSubmitting] = useState(false)

  // Biểu mẫu Đánh giá & Góp ý (chỉ User)
  const [reviewOrderId, setReviewOrderId] = useState(initialOrderParam)
  const [reviewStars, setReviewStars] = useState(0)
  const [reviewComment, setReviewComment] = useState("")
  const [reviewErr, setReviewErr] = useState("")
  const [reviewOk, setReviewOk] = useState("")
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewListErr, setReviewListErr] = useState("")
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null)

  const visibleCategories = useMemo(
    () => (isRecycler ? CATEGORIES.filter((c) => c.id === "complaint") : CATEGORIES),
    [isRecycler],
  )

  const activeCategory = visibleCategories.find((c) => c.id === cat) ?? visibleCategories[0]

  const loadWorkspaceData = useCallback(async () => {
    if (isSsrSmokeTest() || !liveAuth || !isParticipant) {
      setCompletedOrders([])
      setMyComplaints([])
      setMyReviews([])
      return
    }
    setLoadingData(true)
    setLoadErr("")
    try {
      const roleKey = isRecycler ? "recycler" : "user"
      const [ordersRes, complaintsRes, reviewsRes] = await Promise.all([
        fetchHandoverOrdersResult(roleKey),
        fetchMyComplaints({ role: "all", pageNumber: 1, pageSize: 20 }),
        isUser ? fetchMyReviews(1, 20) : Promise.resolve(null),
      ])

      const completed = ordersRes.orders.filter(
        (o) => o.fromBackend !== false && (o.status === "done" || o.rawStatus === "Completed"),
      )
      setCompletedOrders(completed)
      setMyComplaints(complaintsRes.data?.items ?? [])
      setMyReviews((reviewsRes?.data?.items ?? []).filter((r) => r.status !== "Deleted"))

      if (initialOrderParam && completed.some((o) => o.id === initialOrderParam)) {
        setComplaintOrderId((prev) => prev || initialOrderParam)
        if (isUser) setReviewOrderId((prev) => prev || initialOrderParam)
      }
    } catch (err) {
      setLoadErr(
        getErrMessage(
          err,
          "Không tải được danh sách đơn bàn giao hoàn tất, khiếu nại và đánh giá từ máy chủ.",
        ),
      )
    } finally {
      setLoadingData(false)
    }
  }, [initialOrderParam, isParticipant, isRecycler, isUser, liveAuth])

  useEffect(() => {
    void loadWorkspaceData()
  }, [loadWorkspaceData])

  useEffect(() => {
    return () => {
      for (const p of photos) URL.revokeObjectURL(p.previewUrl)
    }
  }, [photos])

  const activeReviewedOrderIds = useMemo(
    () => new Set(myReviews.filter((r) => r.status !== "Deleted").map((r) => r.requestId)),
    [myReviews],
  )

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (picked.length === 0) return

    setComplaintErr("")
    setComplaintOk("")

    if (photos.length + picked.length > MAX_PHOTOS) {
      setComplaintErr(`Chỉ được đính kèm tối đa ${MAX_PHOTOS} ảnh minh chứng.`)
      return
    }

    const nextItems: PhotoPreview[] = []
    for (const file of picked) {
      const mime = file.type.toLowerCase()
      const validExt = /\.(jpe?g|png|webp)$/i.test(file.name)
      if (!ACCEPTED_IMAGE_TYPES.has(mime) && !validExt) {
        setComplaintErr(`Tệp "${file.name}" không phải ảnh JPG, PNG hoặc WEBP hợp lệ.`)
        return
      }
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        setComplaintErr(`Ảnh "${file.name}" vượt quá dung lượng tối đa ${MAX_PHOTO_MB} MB.`)
        return
      }
      nextItems.push({ file, previewUrl: URL.createObjectURL(file) })
    }

    setPhotos((prev) => [...prev, ...nextItems])
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const target = prev[index]
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSubmitComplaint = async (e: FormEvent) => {
    e.preventDefault()
    if (complaintSubmitting) return
    setComplaintErr("")
    setComplaintOk("")

    if (!session || !liveAuth) {
      setComplaintErr("Vui lòng đăng nhập tài khoản Người dân hoặc Cơ sở thu mua để gửi khiếu nại.")
      return
    }
    if (isStaffOrAdmin) {
      setComplaintErr(
        "Tài khoản Nhân viên / Quản trị tiếp nhận xử lý khiếu nại tại hàng đợi Trọng tài, không gửi khiếu nại giao dịch tại đây.",
      )
      return
    }
    if (!complaintOrderId.trim()) {
      setComplaintErr("Vui lòng chọn đơn bàn giao đã xác nhận hoàn tất biên nhận để khiếu nại.")
      return
    }
    if (!complaintCategory) {
      setComplaintErr("Vui lòng chọn nhóm vấn đề khiếu nại.")
      return
    }

    const trimmed = desc.trim()
    if (trimmed.length < DESC_MIN) {
      setComplaintErr(`Nội dung khiếu nại cần tối thiểu ${DESC_MIN} ký tự để nhân viên có đủ thông tin xử lý.`)
      return
    }
    if (trimmed.length > DESC_MAX) {
      setComplaintErr(`Nội dung khiếu nại không được vượt quá ${DESC_MAX} ký tự.`)
      return
    }
    if (photos.length > MAX_PHOTOS) {
      setComplaintErr(`Chỉ được đính kèm tối đa ${MAX_PHOTOS} ảnh minh chứng.`)
      return
    }

    setComplaintSubmitting(true)
    try {
      const uploadedUrls: string[] = []
      for (const item of photos) {
        const upRes = await uploadComplaintEvidence(item.file)
        if (!upRes.data?.fileUrl) {
          throw new Error(`Không tải lên được ảnh minh chứng "${item.file.name}".`)
        }
        uploadedUrls.push(upRes.data.fileUrl)
      }

      const res = await submitComplaint({
        handoverRequestId: complaintOrderId,
        category: complaintCategory,
        description: trimmed,
        evidencePhotoUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
      })

      const code = res.data?.complaintCode || "mới"
      setComplaintOk(
        `Đã tiếp nhận khiếu nại ${code}. Đội ngũ Trọng tài sẽ đối chiếu biên nhận và phản hồi sớm.`,
      )
      setDesc("")
      for (const p of photos) URL.revokeObjectURL(p.previewUrl)
      setPhotos([])
      await loadWorkspaceData()
    } catch (err) {
      setComplaintErr(
        getErrMessage(err, "Không thể gửi khiếu nại giao dịch. Vui lòng kiểm tra lại điều kiện đơn hàng."),
      )
    } finally {
      setComplaintSubmitting(false)
    }
  }

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault()
    if (reviewSubmitting) return
    setReviewErr("")
    setReviewOk("")

    if (!session || !liveAuth) {
      setReviewErr("Vui lòng đăng nhập bằng tài khoản Người dân để gửi đánh giá cơ sở thu mua.")
      return
    }
    if (!isUser) {
      setReviewErr("Chỉ tài khoản Người dân mới được gửi đánh giá & góp ý sau khi hoàn tất biên nhận.")
      return
    }
    if (!reviewOrderId.trim()) {
      setReviewErr("Vui lòng chọn đơn bàn giao đã hoàn tất để gửi đánh giá.")
      return
    }
    if (activeReviewedOrderIds.has(reviewOrderId)) {
      setReviewErr(
        "Mỗi đơn chỉ giữ 1 đánh giá đang hiển thị. Hãy xóa đánh giá cũ bên dưới trước khi gửi lại.",
      )
      return
    }
    if (reviewStars < 1 || reviewStars > 5) {
      setReviewErr("Vui lòng chọn số sao đánh giá từ 1 đến 5 sao.")
      return
    }
    const trimmedComment = reviewComment.trim()
    if (trimmedComment.length > REVIEW_COMMENT_MAX) {
      setReviewErr(`Nội dung góp ý không được vượt quá ${REVIEW_COMMENT_MAX} ký tự.`)
      return
    }

    setReviewSubmitting(true)
    try {
      await createHandoverReview(reviewOrderId, {
        ratingStars: reviewStars,
        comment: trimmedComment || undefined,
      })
      setReviewOk("Đã gửi đánh giá & góp ý thành công. Điểm uy tín của cơ sở thu mua đã được cập nhật.")
      setReviewStars(0)
      setReviewComment("")
      await loadWorkspaceData()
    } catch (err) {
      setReviewErr(
        getErrMessage(err, "Không thể gửi đánh giá giao dịch. Vui lòng kiểm tra lại đơn đã chọn."),
      )
    } finally {
      setReviewSubmitting(false)
    }
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (deletingReviewId) return
    setReviewListErr("")
    setReviewOk("")
    setReviewErr("")
    setDeletingReviewId(reviewId)
    try {
      await deleteMyReview(reviewId)
      setReviewOk("Đã xóa đánh giá cũ. Bạn có thể gửi đánh giá mới cho đơn bàn giao đó.")
      await loadWorkspaceData()
    } catch (err) {
      setReviewListErr(getErrMessage(err, "Không thể xóa đánh giá cũ. Vui lòng thử lại."))
    } finally {
      setDeletingReviewId(null)
    }
  }

  const categoryLabel = (code: string) =>
    COMPLAINT_CATEGORIES.find((x) => x.value === code)?.label ?? code

  return (
    <div className="page flex flex-col gap-10">
      <PageHead
        eyebrow="HỖ TRỢ & ĐÁNH GIÁ GIAO DỊCH"
        title="Khiếu nại và góp ý"
        body={
          isRecycler
            ? "Cơ sở thu mua có thể gửi khiếu nại hai chiều trong 7 ngày đối với các đơn bàn giao đã xác nhận hoàn tất biên nhận."
            : "Người dân và Cơ sở thu mua có thể khiếu nại hai chiều sau khi xác nhận hoàn tất biên nhận; riêng Người dân được gửi 1 đánh giá / góp ý mỗi đơn hoàn tất (xóa đánh giá cũ để gửi lại)."
        }
      />

      {loadErr && (
        <div
          role="alert"
          className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm font-medium text-warn"
        >
          {loadErr}
        </div>
      )}

      {!session && (
        <div className="card flex flex-wrap items-center justify-between gap-4 border-brand/25 bg-brand/5 p-5">
          <div>
            <p className="text-sm font-bold text-ink">Đăng nhập để tải danh sách đơn đã hoàn tất</p>
            <p className="mt-0.5 text-sm leading-6 text-muted">
              Khiếu nại giao dịch và đánh giá chỉ áp dụng cho đơn bàn giao có thực trên hệ thống.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAuthPopup("login")}
            className="btn-primary min-h-11 px-5 text-sm"
          >
            Đăng nhập ngay
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Chọn loại tác vụ */}
          <div className={`grid gap-3 ${visibleCategories.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {visibleCategories.map((c) => {
              const active = c.id === activeCategory.id
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setCat(c.id)
                    setComplaintErr("")
                    setComplaintOk("")
                    setReviewErr("")
                    setReviewOk("")
                  }}
                  className={`flex min-h-11 flex-col items-start rounded-2xl border p-4 text-left transition-colors ${
                    active
                      ? "border-brand bg-brand/8 text-ink"
                      : "border-line bg-surface text-body hover:bg-surface-2"
                  }`}
                >
                  <span className="text-[15px] font-bold text-ink">{c.label}</span>
                  <span className="mt-1 text-sm leading-6 text-muted">{c.blurb}</span>
                </button>
              )
            })}
          </div>

          {activeCategory.id === "complaint" ? (
            <section className="card flex flex-col gap-5 p-6">
              <div>
                <h2 className="font-display text-xl font-bold text-ink">
                  Gửi khiếu nại giao dịch (sau xác nhận biên nhận)
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Áp dụng hai chiều cho Người dân và Cơ sở thu mua trong vòng 7 ngày sau khi biên
                  nhận hoàn tất (Completed). Nếu Người dân đang ở bước xác nhận cân đo và phát
                  hiện sai số, vui lòng dùng nút <b>Sai rồi, tôi muốn khiếu nại</b> ngay tại{" "}
                  <Link to="/user/receipt" className="font-semibold text-brand-deep underline">
                    trang Biên nhận
                  </Link>
                  .
                </p>
              </div>

              {complaintOk && (
                <div
                  role="status"
                  className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm font-semibold text-brand-deep"
                >
                  {complaintOk}
                </div>
              )}

              <form noValidate onSubmit={handleSubmitComplaint} className="flex flex-col gap-4">
                <FormRequiredLegend />

                <div>
                  <label className="block text-sm font-semibold text-ink" htmlFor="complaint-order">
                    Đơn bàn giao đã hoàn tất <RequiredMark />
                  </label>
                  <select
                    id="complaint-order"
                    className="input mt-1.5 min-h-11 h-12 text-base sm:text-[15px]"
                    value={complaintOrderId}
                    onChange={(e) => {
                      setComplaintOrderId(e.target.value)
                      setComplaintErr("")
                    }}
                    disabled={loadingData}
                  >
                    <option value="">
                      {loadingData
                        ? "Đang tải đơn bàn giao đã hoàn tất..."
                        : completedOrders.length === 0
                          ? "Chưa có đơn bàn giao nào đã xác nhận hoàn tất"
                          : "-- Chọn đơn bàn giao đã hoàn tất --"}
                    </option>
                    {completedOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.displayCode} · {o.recycler} ({o.date} · {o.slot})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-ink" htmlFor="complaint-category">
                    Nhóm vấn đề <RequiredMark />
                  </label>
                  <select
                    id="complaint-category"
                    className="input mt-1.5 min-h-11 h-12 text-base sm:text-[15px]"
                    value={complaintCategory}
                    onChange={(e) => {
                      setComplaintCategory(e.target.value as ComplaintCategoryCode)
                      setComplaintErr("")
                    }}
                  >
                    {COMPLAINT_CATEGORIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-sm font-semibold text-ink" htmlFor="complaint-desc">
                      Nội dung chi tiết <RequiredMark />
                    </label>
                    <span className="text-xs sm:text-sm text-muted">
                      {desc.trim().length}/{DESC_MAX} ký tự (tối thiểu {DESC_MIN})
                    </span>
                  </div>
                  <textarea
                    id="complaint-desc"
                    rows={4}
                    className="input mt-1.5 h-auto min-h-[112px] py-2.5 text-base sm:text-[15px] leading-6"
                    value={desc}
                    onChange={(e) => {
                      setDesc(e.target.value)
                      setComplaintErr("")
                    }}
                    placeholder="Mô tả rõ vấn đề sai lệch số cân, thanh toán hoặc thái độ phát sinh sau khi xác nhận biên nhận..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-ink" htmlFor="complaint-photos">
                    Ảnh minh chứng (tối đa {MAX_PHOTOS} ảnh JPG/PNG/WEBP, mỗi ảnh ≤ {MAX_PHOTO_MB} MB)
                  </label>
                  <input
                    id="complaint-photos"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    onChange={handlePhotoChange}
                    className="mt-1.5 block w-full text-sm text-body file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-surface-2 file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-surface"
                  />
                  {photos.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {photos.map((p, idx) => (
                        <div
                          key={`${p.file.name}-${idx}`}
                          className="relative overflow-hidden rounded-xl border border-line bg-surface-2"
                        >
                          <img
                            src={p.previewUrl}
                            alt={p.file.name}
                            className="h-24 w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            aria-label={`Xóa ảnh ${p.file.name}`}
                            className="absolute top-1.5 right-1.5 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-ink"
                          >
                            Xóa
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {complaintErr && (
                  <p
                    role="alert"
                    className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm leading-6 font-medium text-warn"
                  >
                    {complaintErr}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={complaintSubmitting}
                    className="btn-primary min-h-11 h-12 px-6 text-sm sm:text-[15px]"
                  >
                    {complaintSubmitting ? "Đang gửi khiếu nại..." : "Gửi khiếu nại"}
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <section className="card flex flex-col gap-5 p-6">
              <div>
                <h2 className="font-display text-xl font-bold text-ink">
                  Đánh giá & Góp ý cơ sở thu mua
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Chỉ dành cho Người dân đánh giá cơ sở thu mua trong vòng 14 ngày sau khi biên
                  nhận hoàn tất. Mỗi đơn giữ tối đa 1 đánh giá đang hiển thị; bạn có thể xóa đánh
                  giá cũ bên dưới để gửi đánh giá mới.
                </p>
              </div>

              {reviewOk && (
                <div
                  role="status"
                  className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm font-semibold text-brand-deep"
                >
                  {reviewOk}
                </div>
              )}

              <form noValidate onSubmit={handleSubmitReview} className="flex flex-col gap-4">
                <FormRequiredLegend />

                <div>
                  <label className="block text-sm font-semibold text-ink" htmlFor="review-order">
                    Đơn bàn giao đã hoàn tất <RequiredMark />
                  </label>
                  <select
                    id="review-order"
                    className="input mt-1.5 min-h-11 h-12 text-base sm:text-[15px]"
                    value={reviewOrderId}
                    onChange={(e) => {
                      setReviewOrderId(e.target.value)
                      setReviewErr("")
                    }}
                    disabled={loadingData}
                  >
                    <option value="">
                      {loadingData
                        ? "Đang tải đơn bàn giao đã hoàn tất..."
                        : completedOrders.length === 0
                          ? "Chưa có đơn bàn giao nào đã xác nhận hoàn tất"
                          : "-- Chọn đơn bàn giao đã hoàn tất --"}
                    </option>
                    {completedOrders.map((o) => {
                      const alreadyReviewed = activeReviewedOrderIds.has(o.id)
                      return (
                        <option key={o.id} value={o.id}>
                          {o.displayCode} · {o.recycler} ({o.date})
                          {alreadyReviewed ? " — Đã đánh giá (xóa đánh giá cũ để gửi lại)" : ""}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <span className="block text-sm font-semibold text-ink">
                    Chất lượng thu gom (1–5 sao) <RequiredMark />
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const selected = reviewStars >= star
                      return (
                        <button
                          key={star}
                          type="button"
                          aria-pressed={reviewStars === star}
                          onClick={() => {
                            setReviewStars(star)
                            setReviewErr("")
                          }}
                          className={`min-h-11 rounded-xl border px-3.5 py-2 text-sm font-bold transition-colors ${
                            selected
                              ? "border-amber-400 bg-amber-50 text-amber-800"
                              : "border-line bg-surface-2 text-muted hover:bg-surface"
                          }`}
                        >
                          {star} ★
                        </button>
                      )
                    })}
                    {reviewStars > 0 && (
                      <span className="ml-1 text-sm font-semibold text-ink">
                        Đang chọn {reviewStars}/5 sao
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-sm font-semibold text-ink" htmlFor="review-comment">
                      Nhận xét / góp ý (không bắt buộc)
                    </label>
                    <span className="text-xs sm:text-sm text-muted">
                      {reviewComment.trim().length}/{REVIEW_COMMENT_MAX} ký tự
                    </span>
                  </div>
                  <textarea
                    id="review-comment"
                    rows={4}
                    className="input mt-1.5 h-auto min-h-[112px] py-2.5 text-base sm:text-[15px] leading-6"
                    value={reviewComment}
                    onChange={(e) => {
                      setReviewComment(e.target.value)
                      setReviewErr("")
                    }}
                    placeholder="Chia sẻ trải nghiệm về tốc độ thu gom, thái độ nhân viên và độ chính xác khi cân..."
                  />
                </div>

                {reviewErr && (
                  <p
                    role="alert"
                    className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm leading-6 font-medium text-warn"
                  >
                    {reviewErr}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="btn-primary min-h-11 h-12 px-6 text-sm sm:text-[15px]"
                  >
                    {reviewSubmitting ? "Đang gửi đánh giá..." : "Gửi đánh giá"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Danh sách đánh giá của Người dân (chỉ User) */}
          {isUser && !isRecycler && (
            <section className="card flex flex-col gap-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-ink">
                  Đánh giá của bạn ({myReviews.length})
                </h2>
                <span className="text-sm text-muted">
                  Xóa đánh giá cũ nếu bạn muốn đánh giá lại đơn đó
                </span>
              </div>

              {reviewListErr && (
                <p
                  role="alert"
                  className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm leading-6 font-medium text-warn"
                >
                  {reviewListErr}
                </p>
              )}

              {myReviews.length === 0 ? (
                <p className="text-sm text-muted">
                  Bạn chưa có đánh giá nào đang hiển thị.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {myReviews.map((rev) => (
                    <li
                      key={rev.reviewId}
                      className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-4 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-ink">{rev.facilityName}</span>
                          {rev.requestCode && (
                            <span className="font-mono text-xs text-muted">{rev.requestCode}</span>
                          )}
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                            {rev.ratingStars} ★
                          </span>
                        </div>
                        {rev.comment && (
                          <p className="mt-1.5 text-sm leading-6 text-body">{rev.comment}</p>
                        )}
                        <p className="mt-1 text-xs text-muted">
                          Gửi lúc {formatViDateTime(rev.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={deletingReviewId === rev.reviewId}
                        onClick={() => void handleDeleteReview(rev.reviewId)}
                        className="btn-ghost min-h-11 shrink-0 px-4 text-sm font-semibold text-warn hover:bg-warn/10"
                      >
                        {deletingReviewId === rev.reviewId ? "Đang xóa..." : "Xóa đánh giá"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Danh sách khiếu nại giao dịch (User & Recycler) */}
          {isParticipant && (
            <section className="card flex flex-col gap-4 p-6">
              <h2 className="font-display text-lg font-bold text-ink">
                Khiếu nại giao dịch của bạn ({myComplaints.length})
              </h2>

              {myComplaints.length === 0 ? (
                <p className="text-sm text-muted">Chưa có phiếu khiếu nại giao dịch nào.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {myComplaints.map((c) => (
                    <li
                      key={c.complaintId}
                      className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-ink">
                            {c.complaintCode}
                          </span>
                          <span className="font-mono text-xs text-muted">{c.requestCode}</span>
                          <span className="text-xs font-semibold text-body">
                            {categoryLabel(c.category)}
                          </span>
                        </div>
                        <Status tone={COMPLAINT_STATUS_TONE[c.status] ?? "off"}>
                          {COMPLAINT_STATUS_LABEL[c.status] ?? c.status}
                        </Status>
                      </div>
                      <p className="text-xs text-muted">
                        Bên gửi: <b className="text-ink">{c.complainantName}</b> · Bên bị phản ánh:{" "}
                        <b className="text-ink">{c.respondentName}</b>
                      </p>
                      <p className="text-sm leading-6 text-body">{c.description}</p>
                      {c.resolutionNote && (
                        <p className="rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-xs text-ink">
                          <b>Kết luận Trọng tài:</b> {c.resolutionNote}
                        </p>
                      )}
                      <p className="text-xs text-muted">
                        Tạo lúc {formatViDateTime(c.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Cột phải: Quy trình xử lý & FAQ */}
        <aside className="flex flex-col gap-6">
          <section className="card p-5">
            <p className="eyebrow">QUY TRÌNH XỬ LÝ</p>
            <ol className="mt-4 flex flex-col gap-4">
              {STEPS.map((st, idx) => (
                <li key={st.title} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/12 text-xs font-bold text-brand-deep">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">{st.title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-muted">{st.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="card p-5">
            <p className="eyebrow">CÂU HỎI THƯỜNG GẶP</p>
            <div className="mt-3 flex flex-col divide-y divide-line-soft">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-3 first:pt-1 last:pb-1">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-ink marker:hidden">
                    {f.q}
                  </summary>
                  <p className="mt-2 text-sm leading-6 text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="card bg-surface-2 p-5">
            <p className="eyebrow">CẦN XỬ LÝ KHẨN</p>
            <p className="mt-2 text-sm font-bold text-ink">Tổng đài điều phối EcoLink</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Hotline <b className="text-ink">1900 8828</b> (8:00 – 18:00 hằng ngày) hoặc{" "}
              <b className="text-ink">hotro@ecolink.vn</b>.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
