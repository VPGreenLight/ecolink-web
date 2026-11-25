import { useEffect, useState } from "react"
import PaginationBar, { FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import { PageHead, RequiredMark, Status } from "@/components/Portal"
import { AI_CASES } from "@/data/ops"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { ApiError } from "@/lib/api"
import { initApiLoading, initApiState, isSsrSmokeTest } from "@/lib/hydration"
import { AI_CLASS_OPTIONS, fetchWasteCategories, getCategoryMeta, type DetectedWasteObjectDto } from "@/lib/wasteScanApi"
import { getAccessToken, hasLiveBackendAuth } from "@/lib/session"
import {
  assignGroundTruthLabel,
  batchAssignAiLabels,
  fetchAiLabelingQueue,
  fetchStaffAiFeedbackDetail,
  fetchStaffAiFeedbackQueue,
  reviewStaffAiFeedback,
  type AiDatasetItemDto,
  type StaffAiFeedbackDetailDto,
  type StaffAiFeedbackSummaryDto,
} from "@/lib/aiCurationApi"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function formatNormalizedYoloFromDetected(
  obj: DetectedWasteObjectDto,
  imgW: number,
  imgH: number,
): string | null {
  if (!Array.isArray(obj.bbox) || obj.bbox.length < 4 || imgW <= 0 || imgH <= 0) return null
  const [x1, y1, x2, y2] = obj.bbox
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null
  const isAlreadyNorm = x2 <= 1 && y2 <= 1 && x1 >= 0 && y1 >= 0 && x2 > x1 && y2 > y1
  const xc = isAlreadyNorm ? (x1 + x2) / 2 : (x1 + x2) / 2 / imgW
  const yc = isAlreadyNorm ? (y1 + y2) / 2 : (y1 + y2) / 2 / imgH
  const w = isAlreadyNorm ? x2 - x1 : (x2 - x1) / imgW
  const h = isAlreadyNorm ? y2 - y1 : (y2 - y1) / imgH
  if (w <= 0 || h <= 0) return null
  const clamp = (v: number) => Math.min(1, Math.max(0.0001, Number(v.toFixed(4))))
  return `${clamp(xc)} ${clamp(yc)} ${clamp(w)} ${clamp(h)}`
}

type TabMode = "feedback" | "labeling"
type FeedbackFilter = "All" | "Pending" | "Reviewed" | "Rejected"
type LabelingFilter = "All" | "Unlabeled" | "LowConfidenceAuto" | "VerifiedLabeled"

function buildFallbackFeedbacks(): StaffAiFeedbackSummaryDto[] {
  return AI_CASES.map((c) => ({
    id: c.id,
    scanId: null,
    imageUrl: c.image,
    modelUsed: "yolov8_detect",
    predictedLabel: c.predicted,
    confidenceScore: c.confidence / 100,
    userReportedLabel: c.correct,
    adminVerifiedLabel: c.inDataset ? c.correct : null,
    status: c.inDataset ? "Reviewed" : "Pending",
    reviewDecision: c.inDataset ? "ApproveAndLabel" : null,
    reporterName: c.reporter,
    note: null,
    reviewNote: null,
    datasetItemId: null,
    inDataset: c.inDataset,
    createdAt: c.date,
    reviewedAt: null,
  }))
}

/** S-01 Đánh giá ảnh AI nhận diện sai · S-02 Gán nhãn dữ liệu ảnh & Hộp bao YOLO. */
export default function AiReview() {
  const [tab, setTab] = useState<TabMode>("feedback")
  const [liveConnected, setLiveConnected] = useState(false)

  // S-01 State (Khởi tạo rỗng + loading trên trình duyệt để tránh nháy dữ liệu giả, giữ seed cho SSR test)
  const [feedbacks, setFeedbacks] = useState<StaffAiFeedbackSummaryDto[]>(() =>
    initApiState([], buildFallbackFeedbacks()),
  )
  const [counts, setCounts] = useState(() =>
    initApiState({ pending: 0, reviewed: 0, rejected: 0 }, { pending: 3, reviewed: 2, rejected: 0 }),
  )
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(() => initApiLoading(true))
  const [statusFilter, setStatusFilter] = useState<FeedbackFilter>("All")
  const [selectedFbId, setSelectedFbId] = useState<string>(() =>
    initApiState("", AI_CASES[0].id),
  )
  const [verifiedLabel, setVerifiedLabel] = useState<string>("plastic")
  const [reviewNote, setReviewNote] = useState<string>("")
  const [yoloBoxText, setYoloBoxText] = useState<string>("")
  const [fbDetail, setFbDetail] = useState<StaffAiFeedbackDetailDto | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [savingFb, setSavingFb] = useState(false)
  const [flashFb, setFlashFb] = useState<string>("")
  const [errFb, setErrFb] = useState<string>("")

  // S-02 State
  const [labelItems, setLabelItems] = useState<AiDatasetItemDto[]>([])
  const [labelFilter, setLabelFilter] = useState<LabelingFilter>("Unlabeled")
  const [selectedItemId, setSelectedItemId] = useState<string>("")
  const [singleGtLabel, setSingleGtLabel] = useState<string>("plastic")
  const [singleQualityNote, setSingleQualityNote] = useState<string>("")
  const [batchIds, setBatchIds] = useState<string[]>([])
  const [batchLabel, setBatchLabel] = useState<string>("plastic")
  const [savingLabel, setSavingLabel] = useState(false)
  const [flashLabel, setFlashLabel] = useState<string>("")
  const [errLabel, setErrLabel] = useState<string>("")
  const [categoryOptions, setCategoryOptions] = useState<
    readonly { code: string; label: string }[]
  >(AI_CLASS_OPTIONS)

  // Search & Pagination state
  const [fbSearch, setFbSearch] = useState("")
  const debouncedFbSearch = useDebouncedValue(fbSearch, 250)
  const [fbPage, setFbPage] = useState(1)
  const fbPageSize = FIXED_PAGE_SIZE
  const [labelSearch, setLabelSearch] = useState("")
  const debouncedLabelSearch = useDebouncedValue(labelSearch, 250)
  const [labelPage, setLabelPage] = useState(1)
  const labelPageSize = FIXED_PAGE_SIZE

  const fbKeyword = debouncedFbSearch.trim().toLowerCase()
  const filteredFeedbacks = feedbacks.filter((c) => {
    if (!liveConnected && statusFilter !== "All" && c.status !== statusFilter) return false
    if (!fbKeyword) return true
    return [c.id, c.predictedLabel, c.userReportedLabel, c.reporterName, c.modelUsed]
      .join(" ")
      .toLowerCase()
      .includes(fbKeyword)
  })
  const pagedFeedbacks = paginateItems(filteredFeedbacks, fbPage, fbPageSize)

  const labelKeyword = debouncedLabelSearch.trim().toLowerCase()
  const filteredLabelItems = labelItems.filter((item) => {
    if (!labelKeyword) return true
    return [item.id, item.groundTruthLabel ?? "", item.predictedLabel ?? "", item.sourceType]
      .join(" ")
      .toLowerCase()
      .includes(labelKeyword)
  })
  const pagedLabelItems = paginateItems(filteredLabelItems, labelPage, labelPageSize)

  const currentFb =
    feedbacks.find((f) => f.id === selectedFbId) ?? filteredFeedbacks[0] ?? feedbacks[0] ?? null
  const currentItem =
    labelItems.find((i) => i.id === selectedItemId) ?? filteredLabelItems[0] ?? labelItems[0] ?? null

  const loadFeedbackQueue = async (filter: FeedbackFilter = statusFilter) => {
    const liveAuth = hasLiveBackendAuth()
    const token = getAccessToken()
    if (!token && !liveAuth) {
      setLoadingFeedbacks(false)
      return
    }
    setLoadingFeedbacks(true)
    try {
      const res = await fetchStaffAiFeedbackQueue({
        status: filter === "All" ? undefined : filter,
        pageNumber: 1,
        pageSize: 30,
      })
      if (res.success && res.data) {
        setLiveConnected(true)
        setFeedbacks(res.data.items)
        setCounts({
          pending: res.data.pendingCount,
          reviewed: res.data.reviewedCount,
          rejected: res.data.rejectedCount,
        })
        if (res.data.items.length > 0) {
          const first = res.data.items[0]
          setSelectedFbId(first.id)
          setVerifiedLabel(first.adminVerifiedLabel || first.userReportedLabel || "plastic")
        }
      }
    } catch (err) {
      if (liveAuth) {
        setErrFb(err instanceof ApiError ? err.message : "Không tải được hàng đợi phản hồi AI.")
      }
    } finally {
      setLoadingFeedbacks(false)
    }
  }

  const loadLabelQueue = async (filter: LabelingFilter = labelFilter) => {
    const liveAuth = hasLiveBackendAuth()
    const token = getAccessToken()
    if (!token && !liveAuth) return
    try {
      const res = await fetchAiLabelingQueue({
        status:
          filter === "Unlabeled" || filter === "VerifiedLabeled" ? filter : undefined,
        sourceType: filter === "LowConfidenceAuto" ? "LowConfidenceAuto" : undefined,
        pageNumber: 1,
        pageSize: 40,
      })
      if (res.success && res.data) {
        setLiveConnected(true)
        setLabelItems(res.data.items)
        if (res.data.items.length > 0) {
          const first = res.data.items[0]
          setSelectedItemId(first.id)
          setSingleGtLabel(first.groundTruthLabel || first.predictedLabel || "plastic")
        }
      }
    } catch (err) {
      if (liveAuth) {
        setErrLabel(err instanceof ApiError ? err.message : "Không tải được hàng đợi gán nhãn.")
      }
    }
  }

  useEffect(() => {
    void loadFeedbackQueue("All")
    void loadLabelQueue("Unlabeled")
    if (isSsrSmokeTest()) return
    let active = true
    fetchWasteCategories({ includeNonRecyclable: true })
      .then((cats) => {
        if (!active || cats.length === 0) return
        const activeOpts = cats
          .filter((c) => (c.status ?? "Active") === "Active")
          .map((c) => ({
            code: c.code,
            label: `${c.name} (${c.code})`,
          }))
        if (activeOpts.length > 0) {
          setCategoryOptions(activeOpts)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (isSsrSmokeTest() || tab !== "feedback") return
    if (!UUID_REGEX.test(selectedFbId) || (!liveConnected && !hasLiveBackendAuth())) {
      setFbDetail(null)
      return
    }
    let active = true
    setLoadingDetail(true)
    setFbDetail(null)
    void fetchStaffAiFeedbackDetail(selectedFbId)
      .then((res) => {
        if (!active || !res.success || !res.data) return
        setFbDetail(res.data)
        if (res.data.adminVerifiedLabel || res.data.userReportedLabel) {
          setVerifiedLabel(res.data.adminVerifiedLabel || res.data.userReportedLabel)
        }
        if (res.data.reviewNote) {
          setReviewNote(res.data.reviewNote)
        }
        if (res.data.existingYoloAnnotations?.length > 0) {
          const box = res.data.existingYoloAnnotations[0]
          setYoloBoxText(`${box.xCenter} ${box.yCenter} ${box.width} ${box.height}`)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingDetail(false)
      })
    return () => {
      active = false
    }
  }, [selectedFbId, tab, liveConnected])

  const chooseFeedback = (fb: StaffAiFeedbackSummaryDto) => {
    setSelectedFbId(fb.id)
    setVerifiedLabel(fb.adminVerifiedLabel || fb.userReportedLabel || "plastic")
    setReviewNote(fb.reviewNote ?? "")
    setYoloBoxText("")
    setFbDetail(null)
    setFlashFb("")
    setErrFb("")
  }

  const parseOptionalYoloBox = (categoryCode: string) => {
    const raw = yoloBoxText.trim()
    if (!raw) return undefined
    const parts = raw.split(/[\s,;]+/).map((n) => Number(n))
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
      throw new Error("Tọa độ YOLO phải gồm 4 số thập phân [xCenter yCenter width height] trong (0..1].")
    }
    const [xCenter, yCenter, width, height] = parts
    if (xCenter < 0 || xCenter > 1 || yCenter < 0 || yCenter > 1 || width <= 0 || width > 1 || height <= 0 || height > 1) {
      throw new Error("Tọa độ hộp bao YOLO phải nằm trong khoảng [0.0, 1.0] (width/height > 0).")
    }
    return [{ categoryCode, xCenter, yCenter, width, height }]
  }

  const handleReviewDecision = async (
    decision: "ApproveAndLabel" | "ApproveToQueue" | "Reject",
  ) => {
    if (!currentFb) return
    setErrFb("")
    setFlashFb("")
    if (decision === "ApproveAndLabel" && !verifiedLabel.trim()) {
      setErrFb("Cần chọn nhãn chuẩn trước khi xác nhận.")
      return
    }
    if (decision === "Reject" && reviewNote.trim().length < 5) {
      setErrFb("Khi bác bỏ ảnh (Reject), vui lòng nhập lý do tối thiểu 5 ký tự (BR-CLS-06).")
      return
    }
    if (reviewNote.trim().length > 500) {
      setErrFb("Nhận xét thẩm định không được vượt quá 500 ký tự.")
      return
    }

    const liveAuth = hasLiveBackendAuth()
    if (!liveAuth && (!liveConnected || !getAccessToken())) {
      setFeedbacks((prev) =>
        prev.map((item) =>
          item.id === currentFb.id
            ? {
                ...item,
                adminVerifiedLabel: decision === "Reject" ? null : verifiedLabel,
                status: decision === "Reject" ? "Rejected" : "Reviewed",
                inDataset: decision === "ApproveAndLabel",
              }
            : item,
        ),
      )
      setFlashFb(`Đã lưu thao tác ${decision} cho ${currentFb.id} (chế độ xem thử nội bộ).`)
      return
    }

    setSavingFb(true)
    try {
      const yoloAnnotations =
        decision === "ApproveAndLabel" ? parseOptionalYoloBox(verifiedLabel) : undefined

      const res = await reviewStaffAiFeedback(currentFb.id, {
        decision,
        verifiedLabel: decision === "ApproveAndLabel" ? verifiedLabel : undefined,
        reviewNote: reviewNote.trim() || undefined,
        yoloAnnotations,
      })

      setFlashFb(res.message || "Đã cập nhật thẩm định thành công (MSG-CLS-07).")
      await Promise.all([loadFeedbackQueue(statusFilter), loadLabelQueue(labelFilter)])
    } catch (err) {
      setErrFb(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Không thể cập nhật thẩm định.")
    } finally {
      setSavingFb(false)
    }
  }

  const handleSingleAssign = async (exclude: boolean) => {
    if (!currentItem) return
    setErrLabel("")
    setFlashLabel("")
    if (!exclude && !singleGtLabel.trim()) {
      setErrLabel("Vui lòng chọn nhãn Ground-Truth chuẩn.")
      return
    }
    if (singleQualityNote.trim().length > 500) {
      setErrLabel("Ghi chú chất lượng ảnh không được vượt quá 500 ký tự.")
      return
    }
    setSavingLabel(true)
    try {
      const yoloAnnotations = !exclude ? parseOptionalYoloBox(singleGtLabel) : undefined
      const res = await assignGroundTruthLabel(currentItem.id, {
        groundTruthLabel: exclude ? undefined : singleGtLabel,
        excludeFromDataset: exclude,
        qualityNote: singleQualityNote.trim() || undefined,
        yoloAnnotations,
      })
      setFlashLabel(res.message || "Đã lưu nhãn chuẩn Ground-Truth (MSG-CLS-07).")
      await loadLabelQueue(labelFilter)
    } catch (err) {
      setErrLabel(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Lỗi gán nhãn Ground-Truth.")
    } finally {
      setSavingLabel(false)
    }
  }

  const handleBatchAssign = async () => {
    setErrLabel("")
    setFlashLabel("")
    if (batchIds.length === 0) {
      setErrLabel("Hãy tích chọn ít nhất 1 ảnh trong hàng đợi để gán hàng loạt.")
      return
    }
    if (!batchLabel.trim()) {
      setErrLabel("Vui lòng chọn nhãn Ground-Truth hàng loạt.")
      return
    }
    if (singleQualityNote.trim().length > 500) {
      setErrLabel("Ghi chú chất lượng ảnh không được vượt quá 500 ký tự.")
      return
    }
    setSavingLabel(true)
    try {
      const res = await batchAssignAiLabels({
        itemIds: batchIds,
        groundTruthLabel: batchLabel,
        qualityNote: singleQualityNote.trim() || `Gán nhãn hàng loạt (${batchIds.length} ảnh)`,
      })
      setFlashLabel(res.message || `Đã gán nhãn đồng loạt ${res.data.updatedCount} ảnh.`)
      setBatchIds([])
      await loadLabelQueue(labelFilter)
    } catch (err) {
      setErrLabel(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Lỗi gán nhãn hàng loạt.")
    } finally {
      setSavingLabel(false)
    }
  }

  const toggleBatchId = (id: string) => {
    setBatchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="DỮ LIỆU AI"
        title="Ảnh AI nhận diện sai"
        body="Thẩm định phản hồi người dùng (S-01), thu thập ca OOD dưới 60% và chuẩn hóa nhãn Ground-Truth / YOLO Bounding Box (S-02)."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTab("feedback")
              setYoloBoxText("")
            }}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
              tab === "feedback"
                ? "bg-brand text-white"
                : "bg-surface-2 text-body hover:text-ink"
            }`}
          >
            Hàng đợi Báo sai S-01 ({counts.pending} chờ)
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("labeling")
              setYoloBoxText("")
            }}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
              tab === "labeling"
                ? "bg-brand text-white"
                : "bg-surface-2 text-body hover:text-ink"
            }`}
          >
            Kho Gán nhãn Ground-Truth S-02 ({labelItems.length})
          </button>
        </div>

        <span className="text-xs text-muted">
          {liveConnected ? "Dữ liệu đồng bộ trực tiếp" : "Chế độ xem mẫu tĩnh (Offline)"}
        </span>
      </div>

      {tab === "feedback" ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          {currentFb ? (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                void handleReviewDecision("ApproveAndLabel")
              }}
              className="card flex flex-col gap-4 p-5"
            >
              <figure className="overflow-hidden rounded-xl border border-line bg-surface-2">
                <img
                  src={currentFb.imageUrl || "/assets/scanner/b7b43.png"}
                  alt={`Ảnh ${currentFb.id} người dùng báo AI nhận sai`}
                  className="aspect-video w-full object-cover"
                />
                <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-4 py-2.5 text-[13px]">
                  <span className="font-mono text-xs text-ink">
                    {currentFb.id} · {currentFb.modelUsed}
                  </span>
                  <span className="text-muted">
                    Báo bởi {currentFb.reporterName} ·{" "}
                    {Math.round((currentFb.confidenceScore || 0) * 100)}%
                  </span>
                </figcaption>
              </figure>

              {loadingDetail ? (
                <p className="text-xs text-muted">Đang tải chi tiết snapshot vật thể &amp; khung YOLO...</p>
              ) : fbDetail && fbDetail.detectedObjectsSnapshot?.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line-soft bg-surface-2 px-3.5 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-ink">Khung AI đã nhận diện:</span>
                    {fbDetail.detectedObjectsSnapshot.map((obj, idx) => (
                      <span
                        key={`${obj.id}-${idx}`}
                        className="rounded-full bg-white px-2.5 py-0.5 font-medium text-body ring-1 ring-line"
                      >
                        #{idx + 1} {obj.displayName || obj.label} ({Math.round(obj.confidence * 100)}%)
                      </span>
                    ))}
                  </div>
                  {(() => {
                    const primary =
                      fbDetail.detectedObjectsSnapshot.find((o) => o.isPrimary) ??
                      fbDetail.detectedObjectsSnapshot[0]
                    const norm = primary
                      ? formatNormalizedYoloFromDetected(
                          primary,
                          fbDetail.imageWidth,
                          fbDetail.imageHeight,
                        )
                      : null
                    if (!norm) return null
                    return (
                      <button
                        type="button"
                        onClick={() => setYoloBoxText(norm)}
                        className="font-semibold text-brand-deep hover:underline"
                      >
                        Nạp tọa độ khung AI gốc
                      </button>
                    )
                  })()}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-line bg-surface-2 px-4 py-3">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                    AI đoán vs Người dùng đề xuất
                  </p>
                  <p className="mt-1 text-base font-bold text-ink">
                    {getCategoryMeta(currentFb.predictedLabel).shortName} →{" "}
                    <span className="text-brand">
                      {getCategoryMeta(currentFb.userReportedLabel).shortName}
                    </span>
                  </p>
                  {currentFb.note && (
                    <p className="mt-1 text-[12px] text-body">
                      Ghi chú user: “{currentFb.note}”
                    </p>
                  )}
                </div>

                <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
                  <span>
                    Nhãn chuẩn xác nhận (MasterWasteCategory)
                    <RequiredMark />
                  </span>
                  <select
                    className="input"
                    value={verifiedLabel}
                    onChange={(e) => {
                      setVerifiedLabel(e.target.value)
                      setFlashFb("")
                    }}
                  >
                    <option value="">Chọn nhãn chuẩn</option>
                    {categoryOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
                  Nhận xét thẩm định (Bắt buộc &gt;= 5 ký tự nếu Bác bỏ)
                  <input
                    className="input"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Ví dụ: Chai PET lóa sáng / Ảnh quá mờ không nhận diện được"
                  />
                </label>

                <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
                  Hộp bao YOLO tùy chọn (xCenter yCenter width height ∈ [0..1])
                  <input
                    className="input font-mono text-xs"
                    value={yoloBoxText}
                    onChange={(e) => setYoloBoxText(e.target.value)}
                    placeholder="Ví dụ: 0.50 0.50 0.35 0.60"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
                <button
                  type="submit"
                  disabled={savingFb || currentFb.status !== "Pending"}
                  className="btn-primary h-10 px-5 text-[13px] disabled:opacity-50"
                >
                  Duyệt &amp; Đưa vào Dataset (1 chạm)
                </button>
                <button
                  type="button"
                  disabled={savingFb || currentFb.status !== "Pending"}
                  onClick={() => void handleReviewDecision("ApproveToQueue")}
                  className="btn-outline h-10 px-4 text-[13px] disabled:opacity-50"
                >
                  Chuyển kho gán nhãn S-02
                </button>
                <button
                  type="button"
                  disabled={savingFb || currentFb.status !== "Pending"}
                  onClick={() => void handleReviewDecision("Reject")}
                  className="btn-outline h-10 px-4 text-[13px] text-warn disabled:opacity-50"
                >
                  Bác bỏ (BR-CLS-06)
                </button>
              </div>

              {errFb && (
                <p
                  role="alert"
                  className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn"
                >
                  {errFb}
                </p>
              )}
              {flashFb && (
                <p role="status" className="text-[13px] font-semibold text-brand">
                  {flashFb}
                </p>
              )}
            </form>
          ) : loadingFeedbacks ? (
            <div className="card p-6 text-sm text-muted">
              Đang tải hàng đợi phản hồi AI...
            </div>
          ) : (
            <div className="card p-6 text-sm text-muted">
              Không có báo cáo nào phù hợp bộ lọc hiện tại.
            </div>
          )}

          <aside className="flex flex-col gap-3">
            <input
              type="search"
              value={fbSearch}
              onChange={(e) => {
                setFbSearch(e.target.value)
                setFbPage(1)
              }}
              placeholder="Tìm mã, nhãn AI/User, người báo..."
              aria-label="Tìm báo cáo AI"
              className="input h-9 text-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {(["All", "Pending", "Reviewed", "Rejected"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st)
                    setFbPage(1)
                    void loadFeedbackQueue(st)
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    statusFilter === st
                      ? "bg-brand text-white"
                      : "border border-line bg-surface text-body"
                  }`}
                >
                  {st === "All"
                    ? "Tất cả"
                    : st === "Pending"
                      ? `Chờ (${counts.pending})`
                      : st === "Reviewed"
                        ? `Đã duyệt (${counts.reviewed})`
                        : `Bác bỏ (${counts.rejected})`}
                </button>
              ))}
            </div>

            {pagedFeedbacks.length === 0 ? (
              <p className="rounded-lg border border-line bg-surface px-3 py-5 text-center text-xs text-muted">
                Không có báo cáo nào khớp bộ lọc.
              </p>
            ) : (
              <ul className="flex max-h-[540px] flex-col gap-2 overflow-y-auto pr-1">
                {pagedFeedbacks.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => chooseFeedback(c)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      currentFb?.id === c.id
                        ? "border-brand bg-brand/8"
                        : "border-line bg-surface hover:bg-surface-2"
                    }`}
                  >
                    <img
                      src={c.imageUrl || "/assets/scanner/b7b43.png"}
                      alt=""
                      className="size-11 shrink-0 rounded object-cover"
                      loading="lazy"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {c.predictedLabel} → {c.userReportedLabel}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        {c.reporterName} · {Math.round((c.confidenceScore || 0) * 100)}%
                      </span>
                    </span>
                    <Status
                      tone={
                        c.status === "Reviewed"
                          ? "ok"
                          : c.status === "Rejected"
                            ? "off"
                            : "wait"
                      }
                    >
                      {c.status === "Reviewed"
                        ? "Đã duyệt"
                        : c.status === "Rejected"
                          ? "Bác bỏ"
                          : "Chờ"}
                    </Status>
                  </button>
                </li>
              ))}
            </ul>
            )}
            <PaginationBar
              page={fbPage}
              pageSize={fbPageSize}
              totalCount={filteredFeedbacks.length}
              onPageChange={setFbPage}
              itemLabel="báo cáo"
            />
          </aside>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void handleSingleAssign(false)
            }}
            className="card flex flex-col gap-4 p-5"
          >
            {currentItem ? (
              <>
                <figure className="overflow-hidden rounded-xl border border-line bg-surface-2">
                  <img
                    src={currentItem.imageUrl || "/assets/scanner/b7b43.png"}
                    alt={`Mẫu ${currentItem.id}`}
                    className="aspect-video w-full object-cover"
                  />
                  <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-4 py-2.5 text-xs">
                    <span className="font-mono text-ink">
                      Nguồn: {currentItem.sourceType} · SHA {currentItem.imageSha256.slice(0, 12)}...
                    </span>
                    <span className="text-muted">
                      Sticky Split: {currentItem.stickySplit ?? "Chưa phân bổ"}
                    </span>
                  </figcaption>
                </figure>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
                    Nhãn Ground-Truth chuẩn
                    <select
                      className="input"
                      value={singleGtLabel}
                      onChange={(e) => setSingleGtLabel(e.target.value)}
                    >
                      {categoryOptions.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
                    Ghi chú chất lượng ảnh
                    <input
                      className="input"
                      value={singleQualityNote}
                      onChange={(e) => setSingleQualityNote(e.target.value)}
                      placeholder="Rõ nét / Bóp dẹp / Chụm 2 chai..."
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
                  Tọa độ hộp bao YOLO chuẩn hóa [xCenter yCenter width height] (tùy chọn)
                  <input
                    className="input font-mono text-xs"
                    value={yoloBoxText}
                    onChange={(e) => setYoloBoxText(e.target.value)}
                    placeholder="0.50 0.50 0.40 0.65"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-3">
                  <button
                    type="submit"
                    disabled={savingLabel}
                    className="btn-primary h-10 px-5 text-[13px] disabled:opacity-50"
                  >
                    Xác nhận nhãn chuẩn (S-02)
                  </button>
                  <button
                    type="button"
                    disabled={savingLabel}
                    onClick={() => void handleSingleAssign(true)}
                    className="btn-outline h-10 px-4 text-[13px] text-warn disabled:opacity-50"
                  >
                    Loại khỏi Dataset (Exclude)
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">
                Chưa có ảnh nào trong hàng đợi gán nhãn ở bộ lọc hiện tại.
              </p>
            )}

            <div className="rounded-xl border border-line-soft bg-surface-2 p-4">
              <p className="text-[13px] font-bold text-ink">
                Gán nhãn hàng loạt nguyên tử ({batchIds.length} ảnh đã chọn)
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                <select
                  className="input max-w-[240px]"
                  value={batchLabel}
                  onChange={(e) => setBatchLabel(e.target.value)}
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={savingLabel}
                  onClick={() => void handleBatchAssign()}
                  className="btn-outline h-10 px-4 text-[13px] disabled:opacity-50"
                >
                  Gán hàng loạt ngay
                </button>
              </div>
              {errLabel && (
                <p
                  role="alert"
                  className="mt-2.5 rounded-xl border border-warn/35 bg-warn/10 px-3.5 py-2 text-xs font-medium text-warn"
                >
                  {errLabel}
                </p>
              )}
              {flashLabel && (
                <p role="status" className="mt-2 text-xs font-semibold text-brand">
                  {flashLabel}
                </p>
              )}
            </div>
          </form>

          <aside className="flex flex-col gap-3">
            <input
              type="search"
              value={labelSearch}
              onChange={(e) => {
                setLabelSearch(e.target.value)
                setLabelPage(1)
              }}
              placeholder="Tìm theo mã mẫu, nhãn hoặc nguồn..."
              aria-label="Tìm mẫu gán nhãn"
              className="input h-9 text-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {(["Unlabeled", "LowConfidenceAuto", "VerifiedLabeled", "All"] as const).map(
                (f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setLabelFilter(f)
                      setLabelPage(1)
                      void loadLabelQueue(f)
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      labelFilter === f
                        ? "bg-brand text-white"
                        : "border border-line bg-surface text-body"
                    }`}
                  >
                    {f === "Unlabeled"
                      ? "Chờ gán nhãn"
                      : f === "LowConfidenceAuto"
                        ? "OOD < 60%"
                        : f === "VerifiedLabeled"
                          ? "Đã chuẩn"
                          : "Tất cả"}
                  </button>
                ),
              )}
            </div>

            {pagedLabelItems.length === 0 ? (
              <p className="rounded-lg border border-line bg-surface px-3 py-5 text-center text-xs text-muted">
                Không có ảnh nào khớp từ khóa tìm kiếm.
              </p>
            ) : (
              <ul className="flex max-h-[540px] flex-col gap-2 overflow-y-auto pr-1">
                {pagedLabelItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                    currentItem?.id === item.id
                      ? "border-brand bg-brand/8"
                      : "border-line bg-surface"
                  }`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Chọn lô mẫu ${item.id}`}
                    checked={batchIds.includes(item.id)}
                    onChange={() => toggleBatchId(item.id)}
                    className="size-4 accent-brand"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItemId(item.id)
                      setSingleGtLabel(
                        item.groundTruthLabel || item.predictedLabel || "plastic",
                      )
                      const firstBox = item.yoloAnnotations?.[0]
                      setYoloBoxText(
                        firstBox
                          ? `${firstBox.xCenter} ${firstBox.yCenter} ${firstBox.width} ${firstBox.height}`
                          : "",
                      )
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <img
                      src={item.imageUrl || "/assets/scanner/b7b43.png"}
                      alt=""
                      className="size-10 shrink-0 rounded object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {item.groundTruthLabel || item.predictedLabel || "Chưa gán"}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {item.sourceType}
                      </span>
                    </span>
                    <Status tone={item.status === "VerifiedLabeled" ? "ok" : item.status === "Excluded" ? "off" : "wait"}>
                      {item.status === "VerifiedLabeled"
                        ? "Chuẩn"
                        : item.status === "Excluded"
                          ? "Loại"
                          : "Chờ"}
                    </Status>
                  </button>
                </li>
              ))}
            </ul>
            )}
            <PaginationBar
              page={labelPage}
              pageSize={labelPageSize}
              totalCount={filteredLabelItems.length}
              onPageChange={setLabelPage}
              itemLabel="ảnh"
            />
          </aside>
        </div>
      )}
    </div>
  )
}
