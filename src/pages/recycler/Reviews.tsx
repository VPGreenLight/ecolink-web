import { useEffect, useState } from "react"
import { Star } from "lucide-react"
import { PageHead } from "@/components/Portal"
import { initApiState, isSsrSmokeTest } from "@/lib/hydration"
import { fetchRecyclerStatus } from "@/lib/recyclerWorkflowApi"
import {
  fetchRecyclerReviews,
  type RecyclerReviewsSummaryDto,
} from "@/lib/reviewComplaintApi"
import { hasLiveBackendAuth } from "@/lib/session"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DEMO_REVIEWS_SUMMARY: RecyclerReviewsSummaryDto = {
  recyclerId: "22222222-2222-2222-2222-222222222222",
  facilityName: "Vựa phế liệu EcoGreen Hòa Lạc",
  averageRating: 4.8,
  totalReviews: 18,
  starDistribution: {
    fiveStars: 14,
    fourStars: 3,
    threeStars: 1,
    twoStars: 0,
    oneStar: 0,
  },
  reviews: {
    items: [
      {
        reviewId: "rev-1",
        requestId: "req-101",
        requestCode: "BH-2611-0192",
        reviewerId: "u-1",
        reviewerDisplayName: "Nguyễn Minh Anh",
        recyclerId: "22222222-2222-2222-2222-222222222222",
        facilityName: "Vựa phế liệu EcoGreen Hòa Lạc",
        ratingStars: 5,
        comment: "Đến đúng giờ hẹn, cân điện tử minh bạch và thanh toán tiền mặt ngay tại chỗ.",
        status: "Visible",
        reportCount: 0,
        createdAt: "2026-11-26T09:15:00Z",
      },
      {
        reviewId: "rev-2",
        requestId: "req-102",
        requestCode: "BH-2611-0185",
        reviewerId: "u-2",
        reviewerDisplayName: "Trần Quốc Bảo",
        recyclerId: "22222222-2222-2222-2222-222222222222",
        facilityName: "Vựa phế liệu EcoGreen Hòa Lạc",
        ratingStars: 5,
        comment: "Giá thu mua carton và vỏ lon nhôm rất tốt, thái độ thân thiện.",
        status: "Visible",
        reportCount: 0,
        createdAt: "2026-11-24T15:40:00Z",
      },
      {
        reviewId: "rev-3",
        requestId: "req-103",
        requestCode: "BH-2611-0174",
        reviewerId: "u-3",
        reviewerDisplayName: "Lê Thu Hà",
        recyclerId: "22222222-2222-2222-2222-222222222222",
        facilityName: "Vựa phế liệu EcoGreen Hòa Lạc",
        ratingStars: 4,
        comment: "Hỗ trợ dọn gọn khu vực để rác tái chế sau khi cân xong, rất hài lòng.",
        status: "Visible",
        reportCount: 0,
        createdAt: "2026-11-21T11:20:00Z",
      },
    ],
    totalRecords: 3,
    pageNumber: 1,
    pageSize: 10,
    totalPages: 1,
  },
}

/** Trang Đánh giá từ người dùng dành cho cơ sở thu mua (`/recycler/reviews`). */
export default function RecyclerReviews() {
  const liveAuth = hasLiveBackendAuth()
  const [recyclerId, setRecyclerId] = useState("")
  const [reviewsSummary, setReviewsSummary] = useState<RecyclerReviewsSummaryDto | null>(() =>
    initApiState(null, DEMO_REVIEWS_SUMMARY),
  )
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewStarFilter, setReviewStarFilter] = useState<number>(0)
  const [reviewPage, setReviewPage] = useState<number>(1)
  const [reviewsErr, setReviewsErr] = useState("")

  useEffect(() => {
    if (isSsrSmokeTest()) return
    let active = true
    void fetchRecyclerStatus()
      .then((res) => {
        if (!active) return
        setRecyclerId(res.profile.recyclerId)
        if (!liveAuth && !UUID_REGEX.test(res.profile.recyclerId)) {
          setReviewsSummary(DEMO_REVIEWS_SUMMARY)
        }
      })
      .catch(() => {
        if (active && !liveAuth) {
          setReviewsSummary(DEMO_REVIEWS_SUMMARY)
        }
      })
    return () => {
      active = false
    }
  }, [liveAuth])

  useEffect(() => {
    if (isSsrSmokeTest()) return
    if (!UUID_REGEX.test(recyclerId)) {
      if (!liveAuth) {
        setReviewsSummary(DEMO_REVIEWS_SUMMARY)
      }
      return
    }
    const controller = new AbortController()
    setReviewsLoading(true)
    void fetchRecyclerReviews(
      recyclerId,
      {
        ratingStars: reviewStarFilter > 0 ? reviewStarFilter : undefined,
        pageNumber: reviewPage,
        pageSize: 10,
      },
      controller.signal,
    )
      .then((rvRes) => {
        if (!controller.signal.aborted && rvRes.success && rvRes.data) {
          setReviewsSummary(rvRes.data)
          setReviewsErr("")
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted && liveAuth) {
          setReviewsErr(
            err instanceof Error ? err.message : "Không thể tải danh sách đánh giá khách hàng.",
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setReviewsLoading(false)
      })
    return () => controller.abort()
  }, [liveAuth, recyclerId, reviewPage, reviewStarFilter])

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="VẬN HÀNH"
        title="Đánh giá từ người dùng"
        body="Phản hồi thực tế từ khách hàng sau mỗi đơn bàn giao và tiến độ đạt chuẩn Tích xanh Pro (≥ 50 lượt & ≥ 4.0★)."
        action={
          reviewsSummary ? (
            <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm">
              <Star className="size-4 fill-amber-400 text-amber-500" />
              <b className="tabular-nums text-ink">{reviewsSummary.averageRating.toFixed(1)}</b>
              <span className="text-muted">({reviewsSummary.totalReviews} lượt đánh giá)</span>
            </div>
          ) : undefined
        }
      />

      {reviewsErr && (
        <p
          role="alert"
          className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn"
        >
          {reviewsErr}
        </p>
      )}

      {reviewsSummary ? (
        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5 lg:col-span-4">
            <section className="flex flex-col gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,31,21,0.08)]">
              <h2 className="text-base font-bold text-ink">Tiến độ đạt chuẩn Pro</h2>
              <div className="flex flex-col gap-3 rounded-xl border border-line-soft bg-surface-2/60 p-4">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-ink">
                    <span>Số lượng đánh giá hợp lệ</span>
                    <span className="tabular-nums">
                      {Math.min(reviewsSummary.totalReviews, 50)} / 50 lượt
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-brand transition-[width] duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((reviewsSummary.totalReviews / 50) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-ink">
                    <span>Điểm hài lòng trung bình</span>
                    <span className="tabular-nums">
                      {reviewsSummary.averageRating.toFixed(1)} / 5.0 ★
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-[width] duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((reviewsSummary.averageRating / 5) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs leading-5 text-muted">
                Cơ sở cần duy trì tối thiểu 50 đánh giá và điểm trung bình từ 4.0★ trở lên để đủ điều kiện đăng ký gói Pro.
              </p>
            </section>
          </div>

          <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5 lg:col-span-8">
            <section className="flex flex-col gap-4 rounded-2xl border border-line-soft bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,31,21,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-3.5">
                <h2 className="text-base font-bold text-ink">Danh sách đánh giá</h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { stars: 0, label: "Tất cả" },
                    { stars: 5, label: `5 ★ (${reviewsSummary.starDistribution.fiveStars})` },
                    { stars: 4, label: `4 ★ (${reviewsSummary.starDistribution.fourStars})` },
                    { stars: 3, label: `3 ★ (${reviewsSummary.starDistribution.threeStars})` },
                    { stars: 2, label: `2 ★ (${reviewsSummary.starDistribution.twoStars})` },
                    { stars: 1, label: `1 ★ (${reviewsSummary.starDistribution.oneStar})` },
                  ].map((opt) => (
                    <button
                      key={opt.stars}
                      type="button"
                      onClick={() => {
                        setReviewStarFilter(opt.stars)
                        setReviewPage(1)
                      }}
                      className={`min-h-8 rounded-full border px-2.5 text-xs font-semibold transition-colors ${
                        reviewStarFilter === opt.stars
                          ? "border-brand bg-brand/12 text-brand-deep"
                          : "border-line bg-surface-2 text-muted hover:border-sage-line hover:text-ink"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const displayedReviews =
                  UUID_REGEX.test(recyclerId) || reviewStarFilter === 0
                    ? reviewsSummary.reviews.items
                    : reviewsSummary.reviews.items.filter(
                        (rv) => rv.ratingStars === reviewStarFilter,
                      )

                if (reviewsLoading) {
                  return <p className="py-6 text-sm text-muted">Đang tải đánh giá...</p>
                }

                if (displayedReviews.length === 0) {
                  return (
                    <p className="rounded-xl border border-dashed border-line bg-surface-2/50 px-4 py-6 text-center text-sm text-muted">
                      {reviewStarFilter > 0
                        ? `Chưa có đánh giá ${reviewStarFilter} sao nào.`
                        : "Chưa có đánh giá nào từ người dân."}
                    </p>
                  )
                }

                const totalPages = reviewsSummary.reviews.totalPages ?? 1

                return (
                  <>
                    <ul className="divide-y divide-line-soft">
                      {displayedReviews.map((rv) => (
                        <li key={rv.reviewId} className="flex flex-col gap-1.5 py-3.5 text-sm leading-6">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate font-semibold text-ink">
                                {rv.reviewerDisplayName}
                              </span>
                              {rv.requestCode && (
                                <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">
                                  {rv.requestCode}
                                </span>
                              )}
                            </div>
                            <span className="text-xs tabular-nums text-muted">
                              {new Date(rv.createdAt).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                          <div
                            className="flex items-center gap-0.5"
                            aria-label={`${rv.ratingStars} trên 5 sao`}
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                className={`size-3.5 ${
                                  n <= rv.ratingStars
                                    ? "fill-amber-400 text-amber-500"
                                    : "text-line"
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-sm leading-6 text-body">
                            {rv.comment || "Người dùng không để lại nhận xét thêm."}
                          </p>
                        </li>
                      ))}
                    </ul>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between gap-2 border-t border-line-soft pt-3 text-xs">
                        <button
                          type="button"
                          disabled={reviewPage <= 1 || reviewsLoading}
                          onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                          className="btn-outline min-h-8 px-3 text-xs disabled:opacity-50"
                        >
                          ← Trước
                        </button>
                        <span className="font-medium tabular-nums text-muted">
                          Trang {reviewsSummary.reviews.pageNumber} / {totalPages}
                        </span>
                        <button
                          type="button"
                          disabled={reviewPage >= totalPages || reviewsLoading}
                          onClick={() => setReviewPage((p) => Math.min(totalPages, p + 1))}
                          className="btn-outline min-h-8 px-3 text-xs disabled:opacity-50"
                        >
                          Sau →
                        </button>
                      </div>
                    )}
                  </>
                )
              })()}
            </section>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line bg-surface-2/50 px-4 py-6 text-sm text-muted">
          Số liệu đánh giá sao sẽ tự động hiển thị khi kết nối với hồ sơ cơ sở trên hệ thống.
        </p>
      )}
    </div>
  )
}
