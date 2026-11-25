import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { AI_AVATAR } from "@/data/scanner"
import { APPLICATIONS, AI_CASES, COMPLAINTS, DATASET, POSTS, STAFF, STATS, fmtInt, fmtVnd } from "@/data/ops"
import { FLOWS } from "@/data/cashflow"
import { fetchAiDatasetDashboard, fetchStaffAiFeedbackQueue, type AiDatasetDashboardDto } from "@/lib/aiCurationApi"
import { fetchStaffBlogs } from "@/lib/blogApi"
import {
  getAdminAnalyticsCharts,
  getAdminKpiSummary,
  getAdminStaffList,
  type AdminAnalyticsChartsDto,
  type AdminKpiSummaryDto,
  type StaffMemberDto,
} from "@/lib/governanceApi"
import { isSsrSmokeTest } from "@/lib/hydration"
import { fetchStaffApplications } from "@/lib/recyclerWorkflowApi"
import { fetchStaffComplaints, type StaffComplaintQueueResponseDto } from "@/lib/reviewComplaintApi"
import { getAdminReconciliationLedger } from "@/lib/servicePackageApi"
import { getSession, hasLiveBackendAuth } from "@/lib/session"

/** Trợ lý AI trong console quản trị.
 *
 *  Khi đã đăng nhập Backend thật (`hasLiveBackendAuth()`), trợ lý đọc trực tiếp
 *  số liệu từ các API thật (tách biệt theo vai trò Admin / Staff và danh sách
 *  `session.permissions` để tránh gọi API trái quyền gây 403). Chỉ dùng dữ liệu
 *  mẫu khi ở chế độ SSR smoke test hoặc chưa đăng nhập Backend. */
type Msg = { id: number; from: "me" | "ai"; text: string; link?: { to: string; label: string } }

type LiveConsoleSnapshot = {
  loaded: boolean
  isAdmin: boolean
  permissions: Set<string>
  kpi: AdminKpiSummaryDto | null
  charts: AdminAnalyticsChartsDto | null
  dataset: AiDatasetDashboardDto | null
  staff: StaffMemberDto[] | null
  ledgerCount: number | null
  complaints: StaffComplaintQueueResponseDto | null
  pendingAi: number | null
  pendingApps: number | null
  pendingBlogs: number | null
}

type Rule = { keys: string[]; answer: () => Omit<Msg, "id" | "from"> }

const OFFLINE_REPLY: Rule[] = [
  {
    keys: ["chờ", "hàng đợi", "tồn đọng", "còn việc"],
    answer: () => ({
      text:
        `Đang có ${AI_CASES.filter((c) => !c.inDataset).length} ảnh AI chờ gán nhãn, ` +
        `${APPLICATIONS.filter((a) => a.status === "pending").length} hồ sơ đối tác chờ thẩm định, ` +
        `${COMPLAINTS.filter((c) => c.status !== "resolved").length} khiếu nại chưa xong và ` +
        `${POSTS.filter((p) => p.status === "pending").length} bài Blog chờ duyệt.`,
      link: { to: "/staff/ai-review", label: "Mở hàng đợi" },
    }),
  },
  {
    keys: ["sai", "chính xác", "nhận diện", "dataset", "tập dữ liệu"],
    answer: () => {
      const worst = [...DATASET.byClass].sort((a, b) => a.accuracy - b.accuracy)[0]
      return {
        text: `Độ chính xác trung bình là ${DATASET.accuracy}%. Lớp yếu nhất là ${worst.label} ở ${worst.accuracy}% — đang dưới đường cơ sở.`,
        link: { to: "/staff/dataset", label: "Mở tập dữ liệu" },
      }
    },
  },
  {
    keys: ["tiền", "doanh thu", "phí", "dòng tiền", "giá trị"],
    answer: () => ({
      text: `30 ngày qua giao dịch ${fmtVnd(STATS.gross30d)}, trong đó phí nền tảng thu ${fmtVnd(STATS.fee30d)} trên ${fmtInt(STATS.handovers30d)} giao dịch. Còn ${FLOWS.length} dòng trong sổ đối soát.`,
      link: { to: "/admin/reconciliation", label: "Mở đối soát" },
    }),
  },
  {
    keys: ["giao dịch", "tháng", "xu hướng", "tăng trưởng"],
    answer: () => {
      const [first, last] = [STATS.trend[0], STATS.trend[STATS.trend.length - 1]]
      const growth = ((last.handovers - first.handovers) / first.handovers) * 100
      return {
        text: `Giao dịch tăng từ ${fmtInt(first.handovers)} (${first.month}) lên ${fmtInt(last.handovers)} (${last.month}), tức +${growth.toFixed(0)}% trong 6 tháng.`,
        link: { to: "/admin", label: "Mở dashboard" },
      }
    },
  },
  {
    keys: ["khiếu nại", "khiếu nại mới"],
    answer: () => ({
      text: `${COMPLAINTS.filter((c) => c.status === "new").length} khiếu nại mới, ${COMPLAINTS.filter((c) => c.status === "working").length} đang xử lý, ${COMPLAINTS.filter((c) => c.status === "resolved").length} đã xong.`,
      link: { to: "/staff/complaints", label: "Mở danh sách" },
    }),
  },
  {
    keys: ["nhân viên", "staff", "quyền", "phân quyền"],
    answer: () => ({
      text: `Có ${STAFF.length} tài khoản nhân viên, trong đó ${STAFF.filter((s) => s.status === "locked").length} đang bị khoá. Quyền do bạn cấp ở trang phân quyền.`,
      link: { to: "/admin/permissions", label: "Mở phân quyền" },
    }),
  },
]

function buildLiveReply(text: string, snap: LiveConsoleSnapshot): Omit<Msg, "id" | "from"> {
  const q = text.toLowerCase()
  const hasPerm = (perm: string) => snap.isAdmin || snap.permissions.has(perm)

  if (["chờ", "hàng đợi", "tồn đọng", "còn việc"].some((k) => q.includes(k))) {
    const parts: string[] = []
    if (snap.isAdmin && snap.kpi) {
      parts.push(
        `${snap.kpi.pending.aiMisclassifiedCases} ảnh AI chờ duyệt`,
        `${snap.kpi.pending.recyclerApplications} hồ sơ đối tác chờ thẩm định`,
        `${snap.kpi.pending.openComplaints} khiếu nại đang mở`,
        `${snap.kpi.pending.pendingBlogPosts} bài Blog chờ duyệt`,
      )
      return {
        text: `Số liệu trực tiếp từ Backend: ${parts.join(", ")}.`,
        link: { to: "/staff/ai-review", label: "Mở hàng đợi" },
      }
    }
    if (hasPerm("REVIEW_AI") && snap.pendingAi !== null) parts.push(`${snap.pendingAi} ảnh AI chờ duyệt`)
    if (hasPerm("VERIFY_RECYCLER") && snap.pendingApps !== null) parts.push(`${snap.pendingApps} hồ sơ đối tác chờ thẩm định`)
    if (hasPerm("HANDLE_COMPLAINT") && snap.complaints) {
      parts.push(`${snap.complaints.openCount + snap.complaints.investigatingCount} khiếu nại đang xử lý`)
    }
    if (hasPerm("MANAGE_BLOG") && snap.pendingBlogs !== null) parts.push(`${snap.pendingBlogs} bài Blog chờ duyệt`)
    if (parts.length > 0) {
      const target = hasPerm("REVIEW_AI")
        ? "/staff/ai-review"
        : hasPerm("VERIFY_RECYCLER")
          ? "/staff/applications"
          : hasPerm("HANDLE_COMPLAINT")
            ? "/staff/complaints"
            : "/staff/blog"
      return {
        text: `Theo quyền của bạn trên Backend: đang có ${parts.join(", ")}.`,
        link: { to: target, label: "Mở hàng đợi" },
      }
    }
    return {
      text: snap.loaded
        ? "Chưa có mục hàng đợi nào được phép truy cập hoặc máy chủ không trả dữ liệu."
        : "Đang tải số liệu hàng đợi từ máy chủ, bạn vui lòng thử hỏi lại sau giây lát.",
    }
  }

  if (["sai", "chính xác", "nhận diện", "dataset", "tập dữ liệu"].some((k) => q.includes(k))) {
    if (!hasPerm("CURATE_DATASET")) {
      return { text: "Tài khoản của bạn chưa được cấp quyền xem kho dữ liệu AI (CURATE_DATASET)." }
    }
    if (snap.dataset?.summary) {
      const sorted = [...(snap.dataset.byCategory ?? [])].sort((a, b) => a.accuracyPercent - b.accuracyPercent)
      const worst = sorted[0]
      return {
        text: worst
          ? `Độ chính xác thực nghiệm trên tập kiểm chứng là ${snap.dataset.summary.empiricalAccuracyPercent.toFixed(1)}%. Danh mục yếu nhất là ${worst.categoryName} (${worst.accuracyPercent.toFixed(1)}%).`
          : `Độ chính xác thực nghiệm là ${snap.dataset.summary.empiricalAccuracyPercent.toFixed(1)}% trên ${fmtInt(snap.dataset.summary.verifiedLabeledCount)} mẫu đã gán nhãn.`,
        link: { to: "/staff/dataset", label: "Mở tập dữ liệu" },
      }
    }
    return { text: "Chưa tải được thống kê tập dữ liệu AI từ Backend." }
  }

  if (["tiền", "doanh thu", "phí", "dòng tiền", "giá trị"].some((k) => q.includes(k))) {
    if (!snap.isAdmin) {
      return { text: "Số liệu dòng tiền và đối soát gói dịch vụ chỉ hiển thị cho vai trò Admin." }
    }
    if (snap.kpi) {
      const ledgerNote = snap.ledgerCount !== null ? ` Sổ đối soát hiện có ${fmtInt(snap.ledgerCount)} giao dịch gói.` : ""
      return {
        text: `30 ngày qua hệ thống ghi nhận ${fmtVnd(snap.kpi.grossMerchandiseValueVnd)} giá trị thu gom (${fmtInt(snap.kpi.completedHandovers)} giao dịch) và ${fmtVnd(snap.kpi.vietQrServiceRevenueVnd)} doanh thu VietQR.${ledgerNote}`,
        link: { to: "/admin/reconciliation", label: "Mở đối soát" },
      }
    }
    return { text: "Chưa tải được báo cáo tài chính từ Backend." }
  }

  if (["giao dịch", "tháng", "xu hướng", "tăng trưởng"].some((k) => q.includes(k))) {
    if (!snap.isAdmin) {
      return { text: "Biểu đồ tăng trưởng toàn hệ thống thuộc quyền xem của Admin." }
    }
    const trends = snap.charts?.monthlyTrends ?? []
    if (trends.length >= 2) {
      const first = trends[0]
      const last = trends[trends.length - 1]
      const pct = first.completedHandovers > 0
        ? ` (${(((last.completedHandovers - first.completedHandovers) / first.completedHandovers) * 100).toFixed(0)}%)`
        : ""
      return {
        text: `Giao dịch hoàn tất biến động từ ${fmtInt(first.completedHandovers)} (${first.monthLabel}) tới ${fmtInt(last.completedHandovers)} (${last.monthLabel})${pct}.`,
        link: { to: "/admin", label: "Mở dashboard" },
      }
    }
    if (trends.length === 1) {
      return {
        text: `Kỳ gần nhất (${trends[0].monthLabel}) ghi nhận ${fmtInt(trends[0].completedHandovers)} giao dịch hoàn tất.`,
        link: { to: "/admin", label: "Mở dashboard" },
      }
    }
    return { text: "Chưa có đủ dữ liệu xu hướng theo tháng từ Backend." }
  }

  if (["khiếu nại", "khiếu nại mới"].some((k) => q.includes(k))) {
    if (!hasPerm("HANDLE_COMPLAINT")) {
      return { text: "Tài khoản của bạn chưa được cấp quyền xử lý khiếu nại (HANDLE_COMPLAINT)." }
    }
    if (snap.complaints) {
      return {
        text: `Hiện có ${snap.complaints.openCount} khiếu nại mới mở, ${snap.complaints.investigatingCount} đang điều tra và ${snap.complaints.resolvedCount} đã giải quyết.`,
        link: { to: "/staff/complaints", label: "Mở danh sách" },
      }
    }
    return { text: "Chưa tải được danh sách khiếu nại từ Backend." }
  }

  if (["nhân viên", "staff", "quyền", "phân quyền"].some((k) => q.includes(k))) {
    if (!snap.isAdmin) {
      return { text: "Quản lý tài khoản nhân viên và phân quyền thuộc thẩm quyền Admin." }
    }
    if (snap.staff) {
      const locked = snap.staff.filter((s) => s.status.toUpperCase() !== "ACTIVE").length
      return {
        text: `Hệ thống có ${snap.staff.length} tài khoản nhân viên, trong đó ${locked} tài khoản đang tạm khóa hoặc không hoạt động.`,
        link: { to: "/admin/permissions", label: "Mở phân quyền" },
      }
    }
    return { text: "Chưa tải được danh sách nhân viên từ Backend." }
  }

  return {
    text: "Mình chỉ tra được số liệu thật đang mở trên console. Hãy hỏi về việc chờ, độ chính xác AI, dòng tiền, xu hướng giao dịch, khiếu nại hoặc nhân viên.",
  }
}

export default function Assistant() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: 1,
      from: "ai",
      text: "Chào, mình đọc được số liệu console này. Hỏi tôi về việc chờ, độ chính xác AI, dòng tiền hoặc nhân viên.",
    },
  ])
  const [draft, setDraft] = useState("")
  const end = useRef<HTMLDivElement>(null)
  const liveAuth = !isSsrSmokeTest() && hasLiveBackendAuth()
  const session = getSession()
  const isAdmin = session?.role === "admin"
  const [snap, setSnap] = useState<LiveConsoleSnapshot>(() => ({
    loaded: false,
    isAdmin,
    permissions: new Set(session?.permissions ?? []),
    kpi: null,
    charts: null,
    dataset: null,
    staff: null,
    ledgerCount: null,
    complaints: null,
    pendingAi: null,
    pendingApps: null,
    pendingBlogs: null,
  }))

  const chips = useMemo(
    () =>
      isAdmin || !liveAuth
        ? ["Còn việc gì chờ?", "AI chính xác bao nhiêu?", "Tiền tháng này thế nào?"]
        : ["Còn việc gì chờ?", "AI chính xác bao nhiêu?", "Khiếu nại hiện tại?"],
    [isAdmin, liveAuth],
  )

  useEffect(() => {
    if (!liveAuth || !open || snap.loaded) return
    let active = true
    const s = getSession()
    const roleIsAdmin = s?.role === "admin"
    const perms = new Set(s?.permissions ?? [])
    const can = (perm: string) => roleIsAdmin || (s?.role === "staff" && perms.has(perm))

    async function loadLive() {
      const next: LiveConsoleSnapshot = {
        loaded: true,
        isAdmin: roleIsAdmin,
        permissions: perms,
        kpi: null,
        charts: null,
        dataset: null,
        staff: null,
        ledgerCount: null,
        complaints: null,
        pendingAi: null,
        pendingApps: null,
        pendingBlogs: null,
      }

      const tasks: Promise<void>[] = []
      if (roleIsAdmin) {
        tasks.push(
          getAdminKpiSummary("30d").then((r) => {
            if (r.success && r.data) next.kpi = r.data
          }).catch(() => {}),
          getAdminAnalyticsCharts().then((r) => {
            if (r.success && r.data) next.charts = r.data
          }).catch(() => {}),
          getAdminStaffList().then((r) => {
            if (r.success && Array.isArray(r.data)) next.staff = r.data
          }).catch(() => {}),
          getAdminReconciliationLedger({ pageNumber: 1, pageSize: 1 }).then((r) => {
            if (r.success && r.data?.items) next.ledgerCount = r.data.items.totalRecords
          }).catch(() => {}),
        )
      }
      if (can("CURATE_DATASET")) {
        tasks.push(
          fetchAiDatasetDashboard().then((r) => {
            if (r.success && r.data) next.dataset = r.data
          }).catch(() => {}),
        )
      }
      if (can("HANDLE_COMPLAINT")) {
        tasks.push(
          fetchStaffComplaints({ pageSize: 1, includeReportedReviews: false }).then((r) => {
            if (r.success && r.data) next.complaints = r.data
          }).catch(() => {}),
        )
      }
      if (!roleIsAdmin && can("REVIEW_AI")) {
        tasks.push(
          fetchStaffAiFeedbackQueue({ pageSize: 1 }).then((r) => {
            if (r.success && r.data) next.pendingAi = r.data.pendingCount
          }).catch(() => {}),
        )
      }
      if (!roleIsAdmin && can("VERIFY_RECYCLER")) {
        tasks.push(
          fetchStaffApplications().then((r) => {
            next.pendingApps = r.items.filter((a) => a.status === "pending").length
          }).catch(() => {}),
        )
      }
      if (!roleIsAdmin && can("MANAGE_BLOG")) {
        tasks.push(
          fetchStaffBlogs({ status: "Pending_Approval", pageSize: 1 }).then((r) => {
            if (r.success && r.data) next.pendingBlogs = r.data.totalCount
          }).catch(() => {}),
        )
      }

      await Promise.allSettled(tasks)
      if (active) setSnap(next)
    }

    void loadLive()
    return () => {
      active = false
    }
  }, [liveAuth, open, snap.loaded])

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [msgs, open])

  const send = (text: string) => {
    const t = text.trim()
    if (!t) return
    const q = t.toLowerCase()
    const ans = liveAuth
      ? buildLiveReply(t, snap)
      : OFFLINE_REPLY.find((r) => r.keys.some((k) => q.includes(k)))?.answer() ?? {
          text: "Mình chỉ tra được số liệu đang mở trên console. Hãy hỏi về việc chờ, độ chính xác AI, dòng tiền, xu hướng giao dịch, khiếu nại hoặc nhân viên.",
        }
    setMsgs((ms) => [
      ...ms,
      { id: ms.length + 1, from: "me", text: t },
      { id: ms.length + 2, from: "ai", ...ans },
    ])
    setDraft("")
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_-16px_rgba(15,31,21,0.28)]">
          <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
            <img
              src={AI_AVATAR}
              alt=""
              className="size-12 shrink-0 object-contain"
              loading="lazy"
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-ink">Trợ lý EcoLink</p>
              <p className="text-[11px] text-muted">Đọc số liệu trong console</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
              <span className="sr-only">Đóng trợ lý</span>
            </button>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
            {msgs.map((m) => (
              <div key={m.id} className={m.from === "me" ? "flex justify-end" : ""}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-5 ${
                    m.from === "me"
                      ? "bg-brand text-white"
                      : "bg-surface-2 text-body"
                  }`}
                >
                  {m.text}
                  {m.link && (
                    <Link
                      to={m.link.to}
                      onClick={() => setOpen(false)}
                      className={`mt-1.5 block text-[12px] font-semibold underline underline-offset-2 ${
                        m.from === "me" ? "text-white" : "text-brand"
                      }`}
                    >
                      {m.link.label} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {msgs.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => send(c)}
                    className="rounded-full border border-line px-2.5 py-1 text-[12px] text-body transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div ref={end} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(draft)
            }}
            className="flex gap-2 border-t border-line-soft p-3"
          >
            <input
              className="input h-9 flex-1 text-[13px]"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Hỏi về số liệu console..."
              aria-label="Câu hỏi cho trợ lý"
            />
            <button type="submit" className="btn-primary h-9 shrink-0 px-3.5 text-[13px]">
              Gửi
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Đóng trợ lý" : "Mở trợ lý EcoLink"}
        className="grid size-16 place-items-center rounded-full bg-white shadow-[0_12px_28px_-8px_rgba(15,31,21,0.34)] ring-1 ring-line transition-transform hover:scale-105 active:scale-95"
      >
        {/* `p-1` + `scale`: robot có khoảng trắng sẵn trong ảnh, không nới ra
            thì nhìn nhỏ hơn kích thước nút dù số px lớn hơn. */}
        <img src={AI_AVATAR} alt="" className="size-full scale-110 object-contain" loading="lazy" />
      </button>
    </div>
  )
}