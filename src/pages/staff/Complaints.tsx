import { useEffect, useState } from "react"
import PaginationBar, { extractPagedMeta, FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import { PageHead, RequiredMark, Status, Table, TableSkeleton, Td } from "@/components/Portal"
import SearchFilterBar from "@/components/SearchFilterBar"
import { COMPLAINTS, type Complaint } from "@/data/ops"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { ApiError } from "@/lib/api"
import { initApiLoading, initApiState, isSsrSmokeTest } from "@/lib/hydration"
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_OUTCOME_LABELS,
  fetchStaffComplaintDossier,
  fetchStaffComplaints,
  moderateReview,
  resolveStaffComplaint,
  type ComplaintResolutionOutcomeCode,
  type ComplaintSummaryDto,
  type StaffComplaintDossierDto,
  type TransactionReviewDto,
} from "@/lib/reviewComplaintApi"
import { getAccessToken, hasLiveBackendAuth } from "@/lib/session"

const OUTCOME_OPTIONS: ComplaintResolutionOutcomeCode[] = [
  "ConfirmReceiptAsIs",
  "CompensateUser",
  "UpholdComplainant",
  "CancelDisputedOrder",
  "Dismissed",
]

/** S-05 Xử lý khiếu nại giao dịch (Hồ sơ Trọng tài 360°) & Kiểm duyệt Đánh giá bị báo cáo (U-10, BR-RVW-03). */
export default function Complaints() {
  // Chế độ offline dự phòng chỉ dùng cho SSR smoke-test hoặc khi mất kết nối
  const [offlineList, setOfflineList] = useState<Complaint[]>(() =>
    initApiState([], COMPLAINTS),
  )
  const [offlineReply, setOfflineReply] = useState<Record<string, string>>({})

  // Dữ liệu thật từ PostgreSQL 16 (STT 108, 112-114)
  const [usingLiveApi, setUsingLiveApi] = useState(() => !isSsrSmokeTest())
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [tab, setTab] = useState<"complaints" | "reviews">("complaints")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [categoryFilter, setCategoryFilter] = useState<string>("")
  const [search, setSearch] = useState<string>("")
  const debouncedSearch = useDebouncedValue(search, 300)
  const [complaintPage, setComplaintPage] = useState(1)
  const complaintPageSize = FIXED_PAGE_SIZE
  const [complaintTotal, setComplaintTotal] = useState(0)
  const [reviewSearch, setReviewSearch] = useState("")
  const debouncedReviewSearch = useDebouncedValue(reviewSearch, 250)
  const [reviewPage, setReviewPage] = useState(1)
  const reviewPageSize = FIXED_PAGE_SIZE
  const [offlineSearch, setOfflineSearch] = useState("")
  const debouncedOfflineSearch = useDebouncedValue(offlineSearch, 250)
  const [offlineOpenPage, setOfflineOpenPage] = useState(1)
  const [offlineClosedPage, setOfflineClosedPage] = useState(1)
  const offlinePageSize = FIXED_PAGE_SIZE

  const [liveComplaints, setLiveComplaints] = useState<ComplaintSummaryDto[]>([])
  const [reportedReviews, setReportedReviews] = useState<TransactionReviewDto[]>([])
  const [counts, setCounts] = useState({
    openCount: 0,
    investigatingCount: 0,
    resolvedCount: 0,
    dismissedCount: 0,
    reportedReviewsCount: 0,
  })

  const [dossier, setDossier] = useState<StaffComplaintDossierDto | null>(null)
  const [loadingDossier, setLoadingDossier] = useState(false)
  const [outcome, setOutcome] = useState<ComplaintResolutionOutcomeCode>("ConfirmReceiptAsIs")
  const [resolutionNote, setResolutionNote] = useState("")
  const [issueWarning, setIssueWarning] = useState(false)
  const [warningReason, setWarningReason] = useState("")
  const [modReasons, setModReasons] = useState<Record<string, string>>({})
  const [flash, setFlash] = useState("")
  const [errMsg, setErrMsg] = useState("")
  const [resolveErr, setResolveErr] = useState("")
  const [reviewErrs, setReviewErrs] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState("")

  const loadLiveQueue = async (
    targetPage = complaintPage,
    targetPageSize = complaintPageSize,
    targetSearch = debouncedSearch,
  ) => {
    setLoading(true)
    try {
      const res = await fetchStaffComplaints({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        search: targetSearch.trim() || undefined,
        includeReportedReviews: true,
        pageNumber: targetPage,
        pageSize: targetPageSize,
      })
      if (res.success && res.data) {
        setUsingLiveApi(true)
        setLiveComplaints(res.data.complaints.items)
        setComplaintTotal(extractPagedMeta(res.data.complaints).totalCount)
        setReportedReviews(res.data.reportedReviews ?? [])
        setCounts({
          openCount: res.data.openCount,
          investigatingCount: res.data.investigatingCount,
          resolvedCount: res.data.resolvedCount,
          dismissedCount: res.data.dismissedCount,
          reportedReviewsCount: res.data.reportedReviewsCount,
        })
      }
    } catch (err) {
      if (hasLiveBackendAuth()) {
        setErrMsg(
          err instanceof ApiError
            ? err.message
            : "Không tải được danh sách khiếu nại từ máy chủ.",
        )
      } else {
        setUsingLiveApi(false)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!getAccessToken() && !hasLiveBackendAuth()) {
      setLoading(false)
      return
    }
    void loadLiveQueue(complaintPage, complaintPageSize, debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, complaintPage, complaintPageSize, debouncedSearch])

  const openDossier = async (complaintId: string) => {
    setLoadingDossier(true)
    setFlash("")
    setErrMsg("")
    setResolveErr("")
    try {
      const res = await fetchStaffComplaintDossier(complaintId, true)
      if (res.success && res.data) {
        setDossier(res.data)
        setResolutionNote(res.data.complaint.resolutionNote ?? "")
        setOutcome(
          (res.data.complaint.resolutionOutcome as ComplaintResolutionOutcomeCode) ||
            "ConfirmReceiptAsIs",
        )
        setIssueWarning(false)
        setWarningReason("")
        await loadLiveQueue()
      }
    } catch (err) {
      setErrMsg(err instanceof ApiError ? err.message : "Không thể tải hồ sơ trọng tài 360°.")
    } finally {
      setLoadingDossier(false)
    }
  }

  const handleResolveLive = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dossier) return
    setResolveErr("")
    setFlash("")
    if (!outcome) {
      setResolveErr("Vui lòng chọn quyết định phán quyết trọng tài.")
      return
    }
    const cleanNote = resolutionNote.trim()
    if (cleanNote.length < 10 || cleanNote.length > 1000) {
      setResolveErr("Biên bản giải trình phán quyết phải từ 10 đến 1000 ký tự (BR-DSP-04).")
      return
    }
    const cleanWarn = warningReason.trim()
    if (issueWarning && (cleanWarn.length < 5 || cleanWarn.length > 500)) {
      setResolveErr("Khi ghi cảnh cáo vi phạm, vui lòng nhập lý do cảnh cáo từ 5 đến 500 ký tự.")
      return
    }

    setBusyId(dossier.complaint.complaintId)
    try {
      const res = await resolveStaffComplaint(dossier.complaint.complaintId, {
        resolutionOutcome: outcome,
        resolutionNote: cleanNote,
        issueWarningToRespondent: issueWarning,
        warningReason: issueWarning ? cleanWarn : undefined,
      })
      setFlash(res.message || "Đã ban hành phán quyết trọng tài thành công.")
      setDossier(null)
      await loadLiveQueue()
    } catch (err) {
      setResolveErr(err instanceof ApiError ? err.message : "Giải quyết khiếu nại thất bại.")
    } finally {
      setBusyId("")
    }
  }

  const handleModerateReview = async (reviewId: string, action: "Hide" | "Restore") => {
    const reason = (modReasons[reviewId] ?? "").trim()
    setFlash("")
    if (reason.length < 5 || reason.length > 500) {
      setReviewErrs((m) => ({
        ...m,
        [reviewId]: "Vui lòng nhập lý do kiểm duyệt từ 5 đến 500 ký tự.",
      }))
      return
    }
    setReviewErrs((m) => {
      const next = { ...m }
      delete next[reviewId]
      return next
    })
    setBusyId(reviewId)
    try {
      const res = await moderateReview(reviewId, { action, moderationReason: reason })
      setFlash(res.message || "Đã cập nhật kiểm duyệt đánh giá và tính lại điểm sao trung bình.")
      await loadLiveQueue()
    } catch (err) {
      setReviewErrs((m) => ({
        ...m,
        [reviewId]: err instanceof ApiError ? err.message : "Kiểm duyệt đánh giá thất bại.",
      }))
    } finally {
      setBusyId("")
    }
  }

  // Fallback offline handlers
  const takeOffline = (id: string) =>
    setOfflineList((ls) =>
      ls.map((c) => (c.id === id && c.status === "new" ? { ...c, status: "working" } : c)),
    )

  const resolveOffline = (id: string) => {
    const text = (offlineReply[id] ?? "").trim()
    if (text.length < 10 || text.length > 1000) {
      setErrMsg("Cần viết phản hồi từ 10 đến 1000 ký tự trước khi đóng khiếu nại.")
      return
    }
    setOfflineList((ls) =>
      ls.map((c) => (c.id === id ? { ...c, status: "resolved", reply: text } : c)),
    )
    setErrMsg("")
    setFlash(`Đã đóng khiếu nại ${id}.`)
  }

  const openOffline = offlineList.filter((c) => c.status !== "resolved")
  const closedOffline = offlineList.filter((c) => c.status === "resolved")

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="HỖ TRỢ & TRỌNG TÀI"
        title="Khiếu nại giao dịch"
        body="Đối chiếu Hồ sơ Trọng tài 360° gồm ảnh bằng chứng hai bên, biên nhận cân điện tử và lịch sử chat bất biến trước khi ban hành phán quyết."
      />

      {errMsg && (
        <p role="alert" className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-3 text-[13px] font-medium text-warn">
          {errMsg}
        </p>
      )}
      {flash && (
        <p role="status" className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-[13px] font-semibold text-brand-deep">
          {flash}
        </p>
      )}

      {usingLiveApi ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab("complaints")}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  tab === "complaints"
                    ? "bg-brand text-white"
                    : "border border-line bg-surface text-ink hover:bg-surface-2"
                }`}
              >
                Hàng đợi Khiếu nại ({counts.openCount + counts.investigatingCount} chờ xử lý / {counts.resolvedCount + counts.dismissedCount} đã đóng)
              </button>
              <button
                type="button"
                onClick={() => setTab("reviews")}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  tab === "reviews"
                    ? "bg-brand text-white"
                    : "border border-line bg-surface text-ink hover:bg-surface-2"
                }`}
              >
                Đánh giá bị báo cáo vi phạm ({counts.reportedReviewsCount})
              </button>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadLiveQueue()}
              className="btn-outline h-9 px-3.5 text-xs"
            >
              {loading ? "Đang tải..." : "Làm mới"}
            </button>
          </div>

          {tab === "complaints" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setComplaintPage(1)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setComplaintPage(1)
                      void loadLiveQueue(1, complaintPageSize, search)
                    }
                  }}
                  placeholder="Tìm theo mã CMP-..., mã đơn HND-..., tên các bên..."
                  className="input h-10 min-w-[220px] flex-1"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setComplaintPage(1)
                  }}
                  className="input h-10 w-44"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="Open">Open ({counts.openCount})</option>
                  <option value="Investigating">Investigating ({counts.investigatingCount})</option>
                  <option value="Resolved">Resolved ({counts.resolvedCount})</option>
                  <option value="Dismissed">Dismissed ({counts.dismissedCount})</option>
                </select>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value)
                    setComplaintPage(1)
                  }}
                  className="input h-10 w-48"
                >
                  <option value="">Tất cả nhóm lỗi</option>
                  {Object.entries(COMPLAINT_CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setComplaintPage(1)
                    void loadLiveQueue(1, complaintPageSize, search)
                  }}
                  className="btn-primary h-10 px-4 text-xs"
                >
                  Lọc
                </button>
              </div>

              {dossier && (
                <section className="card flex flex-col gap-5 border-brand/40 p-5 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft pb-4">
                    <div>
                      <span className="eyebrow">HỒ SƠ TRỌNG TÀI 360°</span>
                      <h2 className="mt-1 text-lg font-bold text-ink">
                        {dossier.complaint.complaintCode} · Đơn {dossier.handoverRequestCode}
                      </h2>
                      <p className="mt-0.5 text-xs text-muted">
                        Nhóm lỗi: {COMPLAINT_CATEGORY_LABELS[dossier.complaint.category] || dossier.complaint.category} · Trạng thái đơn: {dossier.handoverStatus}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDossier(null)}
                      className="btn-ghost h-9 px-3 text-xs"
                    >
                      Đóng hồ sơ
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-line bg-surface-2 p-4 text-xs">
                      <p className="font-bold text-ink">
                        Bên gửi khiếu nại ({dossier.complaint.complainantRole})
                      </p>
                      <p className="mt-1 font-semibold text-brand-deep">{dossier.complainant.fullName}</p>
                      <p className="text-muted">
                        {dossier.complainant.email} · Cảnh cáo: {dossier.complainant.warningCount}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-body">{dossier.complaint.description}</p>
                      {dossier.complaint.evidencePhotoUrls.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {dossier.complaint.evidencePhotoUrls.map((url, idx) => (
                            <a
                              key={url + idx}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded border border-line bg-white px-2 py-1 text-[11px] font-semibold text-brand-deep hover:underline"
                            >
                              Bằng chứng #{idx + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-line bg-surface-2 p-4 text-xs">
                      <p className="font-bold text-ink">Bên bị khiếu nại (Respondent)</p>
                      <p className="mt-1 font-semibold text-ink">{dossier.respondent.fullName}</p>
                      <p className="text-muted">
                        {dossier.respondent.email} · Đã bị cảnh cáo: {dossier.respondent.warningCount} lần
                      </p>
                      {dossier.receipt ? (
                        <div className="mt-2 border-t border-line-soft pt-2">
                          <p className="font-semibold text-ink">
                            Biên nhận #{dossier.receipt.receiptCode}: {dossier.receipt.totalWeightKg} kg ·{" "}
                            {dossier.receipt.totalAmountCash.toLocaleString("vi-VN")} đ
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {dossier.receipt.scaleProofPhotoUrls.map((url, idx) => (
                              <a
                                key={url + idx}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded border border-line bg-white px-2 py-1 text-[11px] font-semibold text-ink hover:underline"
                              >
                                Ảnh cân #{idx + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-muted">Đơn này chưa lập biên nhận điện tử.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-line bg-surface p-4">
                    <h3 className="text-xs font-bold tracking-wide text-ink uppercase">
                      Lịch sử Thương lượng &amp; Chat Bất biến ({dossier.negotiationMessages.length} tin nhắn)
                    </h3>
                    {dossier.negotiationMessages.length === 0 ? (
                      <p className="mt-2 text-xs text-muted">Chưa có tin nhắn thương lượng nào trong đơn này.</p>
                    ) : (
                      <ul className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto text-xs">
                        {dossier.negotiationMessages.map((m) => (
                          <li key={m.messageId} className="rounded-lg bg-surface-2 px-3 py-2">
                            <div className="flex justify-between gap-2 text-[11px] text-muted">
                              <span>
                                <b className="text-ink">{m.senderName}</b> ({m.senderRole} · {m.messageType})
                              </span>
                              <span>{new Date(m.sentAt).toLocaleString("vi-VN")}</span>
                            </div>
                            <p className="mt-0.5 text-body">{m.content}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {dossier.complaint.status === "Open" || dossier.complaint.status === "Investigating" ? (
                    <form
                      noValidate
                      onSubmit={(e) => void handleResolveLive(e)}
                      className="flex flex-col gap-3 border-t border-line-soft pt-4"
                    >
                      <h3 className="text-sm font-bold text-ink">Ban hành Phán quyết Trọng tài (BR-DSP-04)</h3>
                      <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
                        <span>
                          Quyết định phán quyết
                          <RequiredMark />
                        </span>
                        <select
                          value={outcome}
                          onChange={(e) => {
                            setOutcome(e.target.value as ComplaintResolutionOutcomeCode)
                            setResolveErr("")
                          }}
                          className="input h-10"
                        >
                          {OUTCOME_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt} — {COMPLAINT_OUTCOME_LABELS[opt]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
                        <span>
                          Biên bản giải trình phán quyết (10–1000 ký tự)
                          <RequiredMark />
                        </span>
                        <textarea
                          className="input h-auto resize-y py-2.5 text-sm font-normal"
                          rows={3}
                          value={resolutionNote}
                          onChange={(e) => {
                            setResolutionNote(e.target.value)
                            setResolveErr("")
                          }}
                          placeholder="Nhập biên bản giải trình phán quyết tối thiểu 10 ký tự..."
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-ink">
                        <input
                          type="checkbox"
                          checked={issueWarning}
                          onChange={(e) => {
                            setIssueWarning(e.target.checked)
                            setResolveErr("")
                          }}
                        />
                        Ghi cảnh cáo vi phạm vào hồ sơ bên bị khiếu nại (AccountModerationLog)
                      </label>
                      {issueWarning && (
                        <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
                          <span>
                            Lý do cảnh cáo vi phạm (tối thiểu 5 ký tự)
                            <RequiredMark />
                          </span>
                          <input
                            type="text"
                            value={warningReason}
                            onChange={(e) => {
                              setWarningReason(e.target.value)
                              setResolveErr("")
                            }}
                            placeholder="Nhập lý do cảnh cáo vi phạm tối thiểu 5 ký tự..."
                            className="input h-9 text-xs font-normal"
                          />
                        </label>
                      )}
                      {resolveErr && (
                        <p
                          role="alert"
                          className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-xs font-medium text-warn"
                        >
                          {resolveErr}
                        </p>
                      )}
                      <div>
                        <button
                          type="submit"
                          disabled={busyId === dossier.complaint.complaintId}
                          className="btn-primary h-10 px-5 text-xs"
                        >
                          {busyId === dossier.complaint.complaintId
                            ? "Đang chốt phán quyết..."
                            : "Xác nhận & Đóng khiếu nại"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="rounded-xl border border-line-soft bg-surface-2 p-3 text-xs">
                      <p className="font-bold text-ink">
                        Đã giải quyết: {dossier.complaint.resolutionOutcome}
                      </p>
                      <p className="mt-1 text-body">{dossier.complaint.resolutionNote}</p>
                    </div>
                  )}
                </section>
              )}

              {loading && liveComplaints.length === 0 ? (
                <TableSkeleton rows={4} />
              ) : liveComplaints.length === 0 ? (
                <p className="card px-5 py-8 text-center text-sm text-muted">
                  Chưa có phiếu khiếu nại nào khớp bộ lọc hiện tại.
                </p>
              ) : (
                <>
                <ul className="flex flex-col gap-3">
                  {liveComplaints.map((c) => (
                    <li key={c.complaintId} className="card flex flex-wrap items-center justify-between gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-ink">{c.complaintCode}</span>
                          <Status
                            tone={
                              c.status === "Open"
                                ? "wait"
                                : c.status === "Investigating"
                                  ? "todo"
                                  : "ok"
                            }
                          >
                            {c.status}
                          </Status>
                          <span className="chip bg-surface-2 text-[11px] text-body">
                            {COMPLAINT_CATEGORY_LABELS[c.category] || c.category}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          Đơn {c.requestCode} · {c.complainantName} ({c.complainantRole}) kiện{" "}
                          <b className="text-ink">{c.respondentName}</b> ·{" "}
                          {new Date(c.createdAt).toLocaleString("vi-VN")}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-body">{c.description}</p>
                      </div>
                      <button
                        type="button"
                        disabled={loadingDossier}
                        onClick={() => void openDossier(c.complaintId)}
                        className="btn-primary h-9 shrink-0 px-4 text-xs"
                      >
                        {c.status === "Open" || c.status === "Investigating"
                          ? "Mở Hồ sơ 360° & Xử lý"
                          : "Xem lại Hồ sơ"}
                      </button>
                    </li>
                  ))}
                </ul>
                <PaginationBar
                  page={complaintPage}
                  pageSize={complaintPageSize}
                  totalCount={complaintTotal}
                  onPageChange={setComplaintPage}
                  itemLabel="khiếu nại"
                />
                </>
              )}
            </>
          ) : (
            (() => {
              const rkw = debouncedReviewSearch.trim().toLowerCase()
              const filteredReviews = reportedReviews.filter(
                (rv) =>
                  !rkw ||
                  `${rv.facilityName} ${rv.reviewerDisplayName} ${rv.comment ?? ""} ${rv.lastReportReason ?? ""}`
                    .toLowerCase()
                    .includes(rkw),
              )
              const pagedReviews = paginateItems(filteredReviews, reviewPage, reviewPageSize)

              return (
                <div className="flex flex-col gap-3">
                  <SearchFilterBar
                    value={reviewSearch}
                    onChange={(v) => {
                      setReviewSearch(v)
                      setReviewPage(1)
                    }}
                    label="Tìm kiếm đánh giá bị báo cáo"
                    placeholder="Tìm theo tên cơ sở, người đánh giá hoặc lý do báo cáo..."
                    totalCount={filteredReviews.length}
                    countLabel="đánh giá"
                  />
                  {filteredReviews.length === 0 ? (
                    <p className="card px-5 py-8 text-center text-sm text-muted">
                      Hiện không có đánh giá nào bị báo cáo vi phạm khớp bộ lọc.
                    </p>
                  ) : (
                    <>
                      {pagedReviews.map((rv) => (
                  <div key={rv.reviewId} className="card flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-ink">
                          {rv.facilityName} · {"★".repeat(rv.ratingStars)} ({rv.ratingStars}/5)
                        </p>
                        <p className="text-xs text-muted">
                          Tác giả: {rv.reviewerDisplayName} · Số lần báo cáo: {rv.reportCount} · Trạng thái:{" "}
                          <b>{rv.status}</b>
                        </p>
                      </div>
                    </div>
                    {rv.comment && <p className="text-sm text-body">{rv.comment}</p>}
                    {rv.lastReportReason && (
                      <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
                        Lý do báo cáo: {rv.lastReportReason}
                      </p>
                    )}
                    <form
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault()
                        void handleModerateReview(rv.reviewId, "Hide")
                      }}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={modReasons[rv.reviewId] ?? ""}
                          onChange={(e) => {
                            setModReasons((m) => ({ ...m, [rv.reviewId]: e.target.value }))
                            setReviewErrs((errs) => {
                              if (!errs[rv.reviewId]) return errs
                              const next = { ...errs }
                              delete next[rv.reviewId]
                              return next
                            })
                          }}
                          placeholder="Nhập lý do kiểm duyệt tối thiểu 5 ký tự..."
                          className="input h-9 min-w-[240px] flex-1 text-xs"
                        />
                        <button
                          type="submit"
                          disabled={busyId === rv.reviewId}
                          className="btn-primary h-9 px-3.5 text-xs"
                        >
                          Ẩn đánh giá
                        </button>
                        <button
                          type="button"
                          disabled={busyId === rv.reviewId}
                          onClick={() => void handleModerateReview(rv.reviewId, "Restore")}
                          className="btn-outline h-9 px-3.5 text-xs"
                        >
                          Khôi phục (Giữ lại)
                        </button>
                      </div>
                      {reviewErrs[rv.reviewId] && (
                        <p
                          role="alert"
                          className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-1.5 text-xs font-medium text-warn"
                        >
                          {reviewErrs[rv.reviewId]}
                        </p>
                      )}
                    </form>
                  </div>
                ))}
                      <PaginationBar
                        page={reviewPage}
                        pageSize={reviewPageSize}
                        totalCount={filteredReviews.length}
                        onPageChange={setReviewPage}
                        itemLabel="đánh giá"
                      />
                    </>
                  )}
                </div>
              )
            })()
          )}
        </>
      ) : (
        (() => {
          const okw = debouncedOfflineSearch.trim().toLowerCase()
          const filteredOpen = openOffline.filter(
            (c) => !okw || `${c.id} ${c.title} ${c.user} ${c.target}`.toLowerCase().includes(okw),
          )
          const filteredClosed = closedOffline.filter(
            (c) => !okw || `${c.id} ${c.title} ${c.user} ${c.reply ?? ""}`.toLowerCase().includes(okw),
          )
          const pagedOpenOffline = paginateItems(filteredOpen, offlineOpenPage, offlinePageSize)
          const pagedClosedOffline = paginateItems(filteredClosed, offlineClosedPage, offlinePageSize)

          return (
            <>
              <SearchFilterBar
                value={offlineSearch}
                onChange={(v) => {
                  setOfflineSearch(v)
                  setOfflineOpenPage(1)
                  setOfflineClosedPage(1)
                }}
                label="Tìm kiếm khiếu nại"
                placeholder="Tìm theo mã, tiêu đề, người báo hoặc đối tượng liên quan..."
                totalCount={filteredOpen.length + filteredClosed.length}
                countLabel="khiếu nại"
              />

              <ul className="flex flex-col gap-4">
                {pagedOpenOffline.map((c) => (
                  <li key={c.id} className="card flex flex-col gap-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-ink">{c.title}</p>
                        <p className="mt-0.5 text-[13px] text-muted">
                          {c.id} · {c.date} · {c.user} · liên quan {c.target}
                        </p>
                      </div>
                      <Status tone={c.status === "new" ? "wait" : "todo"}>
                        {c.status === "new" ? "Mới" : "Đang xử lý"}
                      </Status>
                    </div>

                    <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
                      Phản hồi cho người dùng
                      <textarea
                        className="input h-auto resize-y py-3 leading-6"
                        rows={3}
                        value={offlineReply[c.id] ?? ""}
                        onChange={(e) =>
                          setOfflineReply((r) => ({ ...r, [c.id]: e.target.value }))
                        }
                        placeholder="Nêu rõ đã kiểm tra gì, kết luận gì, và người dùng cần làm gì tiếp."
                      />
                    </label>

                    <div className="flex flex-wrap gap-3 border-t border-line-soft pt-4">
                      {c.status === "new" && (
                        <button
                          type="button"
                          onClick={() => takeOffline(c.id)}
                          className="btn-ghost h-11 px-5"
                        >
                          Nhận xử lý
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => resolveOffline(c.id)}
                        className="btn-primary h-11 px-6"
                      >
                        Đóng khiếu nại
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <PaginationBar
                page={offlineOpenPage}
                pageSize={offlinePageSize}
                totalCount={filteredOpen.length}
                onPageChange={setOfflineOpenPage}
                itemLabel="khiếu nại mở"
              />

              {filteredClosed.length > 0 && (
                <section>
                  <h2 className="text-base font-bold text-ink">Đã đóng ({filteredClosed.length})</h2>
                  <div className="mt-3">
                    <Table head={["Mã", "Vấn đề", "Người báo", "Kết quả"]}>
                      {pagedClosedOffline.map((c) => (
                        <tr key={c.id}>
                          <Td className="tabular-nums whitespace-nowrap">{c.id}</Td>
                          <Td className="font-semibold text-ink">{c.title}</Td>
                          <Td className="whitespace-nowrap">{c.user}</Td>
                          <Td>{c.reply ?? "—"}</Td>
                        </tr>
                      ))}
                    </Table>
                    <PaginationBar
                      page={offlineClosedPage}
                      pageSize={offlinePageSize}
                      totalCount={filteredClosed.length}
                      onPageChange={setOfflineClosedPage}
                      itemLabel="khiếu nại đã đóng"
                    />
                  </div>
                </section>
              )}
            </>
          )
        })()
      )}
    </div>
  )
}
