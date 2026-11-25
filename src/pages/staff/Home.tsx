import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { PageHead, Stat } from "@/components/Portal"
import { ECO_FACTS, GIFTS, POSTS, STATS, DATASET, fmtInt } from "@/data/ops"
import { isSsrSmokeTest } from "@/lib/hydration"
import {
  fetchAiDatasetDashboard,
  fetchStaffAiFeedbackQueue,
} from "@/lib/aiCurationApi"
import { fetchStaffBlogs } from "@/lib/blogApi"
import { fetchStaffEcoFacts, fetchStaffGifts } from "@/lib/gamificationApi"
import { fetchStaffApplications } from "@/lib/recyclerWorkflowApi"
import { fetchStaffComplaints } from "@/lib/reviewComplaintApi"
import { getSession, hasLiveBackendAuth } from "@/lib/session"

/** Tổng quan nhân viên (Staff). */
export default function StaffHome() {
  const [liveAuth] = useState(() => !isSsrSmokeTest() && hasLiveBackendAuth())
  const session = getSession()
  const can = (perm: string) => {
    if (!liveAuth) return false
    if (session?.role === "admin") return true
    if (session?.role === "staff") {
      return !Array.isArray(session.permissions) || session.permissions.includes(perm)
    }
    return false
  }
  const hasPermFilter = liveAuth && session?.role === "staff" && Array.isArray(session.permissions)

  const [pendingAiCount, setPendingAiCount] = useState<number>(liveAuth ? 0 : STATS.pending.aiCases)
  const [pendingAppCount, setPendingAppCount] = useState<number>(liveAuth ? 0 : STATS.pending.applications)
  const [openComplaintCount, setOpenComplaintCount] = useState<number>(
    liveAuth ? 0 : STATS.pending.complaints,
  )
  const [pendingBlogCount, setPendingBlogCount] = useState<number>(
    liveAuth ? 0 : STATS.pending.posts,
  )
  const [publishedBlogCount, setPublishedBlogCount] = useState<number>(
    liveAuth ? 0 : POSTS.filter((p) => p.status === "published").length,
  )
  const [activeGiftsCount, setActiveGiftsCount] = useState<number>(
    liveAuth ? 0 : GIFTS.filter((g) => g.active).length,
  )
  const [outOfStockCount, setOutOfStockCount] = useState<number>(
    liveAuth ? 0 : GIFTS.filter((g) => g.stock === 0).length,
  )
  const [activeFactsCount, setActiveFactsCount] = useState<number>(
    liveAuth ? 0 : ECO_FACTS.filter((f) => f.open).length,
  )
  const [totalFactsCount, setTotalFactsCount] = useState<number>(
    liveAuth ? 0 : ECO_FACTS.length,
  )
  const [datasetStats, setDatasetStats] = useState({
    accuracy: liveAuth ? 0 : DATASET.accuracy,
    labeled: liveAuth ? 0 : DATASET.labeled,
    total: liveAuth ? 0 : DATASET.total,
  })
  const [loadErr, setLoadErr] = useState("")

  useEffect(() => {
    if (!liveAuth) return
    let active = true
    const recordErr = (err: unknown) => {
      if (!active) return
      const msg = err instanceof Error ? err.message : "Không thể tải một số dữ liệu tổng quan."
      setLoadErr((prev) => prev || msg)
    }

    if (can("REVIEW_AI")) {
      fetchStaffAiFeedbackQueue({ pageSize: 1 })
        .then((res) => {
          if (active && res.success && res.data) {
            setPendingAiCount(res.data.pendingCount)
          }
        })
        .catch(recordErr)
    }

    if (can("CURATE_DATASET")) {
      fetchAiDatasetDashboard()
        .then((res) => {
          if (active && res.success && res.data?.summary) {
            setDatasetStats({
              accuracy: res.data.summary.empiricalAccuracyPercent,
              labeled: res.data.summary.verifiedLabeledCount,
              total: res.data.summary.totalPoolItems,
            })
          }
        })
        .catch(recordErr)
    }

    if (can("VERIFY_RECYCLER")) {
      fetchStaffApplications()
        .then((res) => {
          if (active) {
            setPendingAppCount(res.items.filter((a) => a.status === "pending").length)
          }
        })
        .catch(recordErr)
    }

    if (can("HANDLE_COMPLAINT")) {
      fetchStaffComplaints({ pageSize: 1, includeReportedReviews: false })
        .then((res) => {
          if (active && res.success && res.data) {
            setOpenComplaintCount(res.data.openCount + res.data.investigatingCount)
          }
        })
        .catch(recordErr)
    }

    if (can("MANAGE_BLOG")) {
      fetchStaffBlogs({ pageSize: 50 })
        .then((res) => {
          if (active && res.data?.items) {
            setPendingBlogCount(
              res.data.items.filter((b) => b.status === "Pending_Approval").length,
            )
            setPublishedBlogCount(
              res.data.items.filter((b) => b.status === "Approved").length,
            )
          }
        })
        .catch(recordErr)
    }

    if (can("MANAGE_INVENTORY")) {
      fetchStaffGifts({ pageSize: 50 })
        .then((res) => {
          if (active && res.data?.items) {
            setActiveGiftsCount(
              res.data.items.filter((g) => g.status === "ACTIVE").length,
            )
            setOutOfStockCount(
              res.data.items.filter((g) => g.stockQuantity <= 0).length,
            )
          }
        })
        .catch(recordErr)

      fetchStaffEcoFacts({ pageSize: 50 })
        .then((res) => {
          if (active && res.data?.items) {
            setTotalFactsCount(res.data.totalCount)
            setActiveFactsCount(
              res.data.items.filter((f) => f.status === "ACTIVE").length,
            )
          }
        })
        .catch(recordErr)
    }

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveAuth])

  const allQueue = [
    { perm: "REVIEW_AI", to: "/staff/ai-review", label: "Ảnh AI nhận diện sai", n: pendingAiCount, unit: "ảnh" },
    { perm: "VERIFY_RECYCLER", to: "/staff/applications", label: "Hồ sơ đối tác thu mua", n: pendingAppCount, unit: "hồ sơ" },
    { perm: "HANDLE_COMPLAINT", to: "/staff/complaints", label: "Khiếu nại giao dịch", n: openComplaintCount, unit: "khiếu nại" },
    { perm: "MANAGE_BLOG", to: "/staff/blog", label: "Bài blog chờ duyệt", n: pendingBlogCount, unit: "bài" },
  ]
  const queue = hasPermFilter ? allQueue.filter((q) => can(q.perm)) : allQueue

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="VẬN HÀNH"
        title="Việc đang chờ bạn xử lý"
        body="Danh sách này là toàn bộ việc tồn đọng của đội ngũ. Xong hết thì báo Admin, không tự ý thêm việc ngoài danh sách này."
      />

      {loadErr && (
        <p
          role="alert"
          className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn"
        >
          {loadErr}
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {queue.map((q) => (
          <li key={q.to} className="card flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{q.label}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {q.n} {q.unit} đang chờ
              </p>
            </div>
            <Link to={q.to} className="btn-outline h-10 shrink-0 px-4 text-[13px]">
              Xử lý
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Độ chính xác AI"
          value={datasetStats.accuracy + "%"}
          note={`${fmtInt(datasetStats.labeled)} ảnh đã gán nhãn`}
        />
        <Stat
          label="Ảnh trong tập kiểm chứng"
          value={fmtInt(datasetStats.total)}
          note={`${fmtInt(Math.max(0, datasetStats.total - datasetStats.labeled))} ảnh chờ gán nhãn`}
        />
        <Stat
          label="Kho quà đang mở"
          value={String(activeGiftsCount)}
          note={`${outOfStockCount} món hết hàng`}
        />
        <Stat
          label="Eco Fact đang bật"
          value={`${activeFactsCount} / ${totalFactsCount}`}
          note={`${publishedBlogCount} bài blog đã xuất bản`}
        />
      </div>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Bạn không có quyền đổi cấu hình hệ thống, phí giao dịch hay tài khoản
        nhân viên — những phần đó thuộc Admin. Nếu cần thay đổi, gửi yêu cầu
        kèm lý do.
      </p>
    </div>
  )
}
