import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { FormRequiredLegend, PageHead, Field, Status } from "@/components/admin/ui"
import { getAccessToken, ROLE_LABEL, useSession } from "@/lib/session"
import {
  fetchCurrentUserProfile,
  formatAuthError,
  updateCurrentUserProfile,
} from "@/lib/authApi"
import { AI_CASES, APPLICATIONS, COMPLAINTS, POSTS, STAFF } from "@/data/ops"
import { initApiState, isSsrSmokeTest } from "@/lib/hydration"
import { fetchStaffAiFeedbackQueue } from "@/lib/aiCurationApi"
import { fetchStaffApplications } from "@/lib/recyclerWorkflowApi"
import { fetchStaffComplaints } from "@/lib/reviewComplaintApi"
import { fetchAdminPendingBlogs, fetchStaffBlogs } from "@/lib/blogApi"
import { getAdminStaffList, getPermissionCatalog } from "@/lib/governanceApi"

const STAFF_PERM_LABELS: Record<string, string> = {
  REVIEW_AI: "Duyệt ảnh AI phân loại",
  CURATE_DATASET: "Kiểm duyệt tập dữ liệu AI",
  VERIFY_RECYCLER: "Thẩm định đối tác thu mua",
  HANDLE_COMPLAINT: "Xử lý khiếu nại & đánh giá",
  MANAGE_ACCOUNTS: "Quản lý tài khoản cộng đồng",
  MANAGE_BLOG: "Duyệt & quản lý Blog",
  MANAGE_INVENTORY: "Quản lý kho quà & Eco Fact",
}

/** Hồ sơ và thông báo cho STAFF và ADMIN — đồng bộ trực tiếp với
 *  `GET /api/v1/auth/me` và `PUT /api/v1/auth/profile`. */
export default function AccountProfile() {
  const session = useSession()
  const role = session?.role === "admin" ? "admin" : "staff"
  const [permLabels, setPermLabels] = useState<Record<string, string>>(STAFF_PERM_LABELS)

  const [name, setName] = useState(session?.name ?? "")
  const [phone, setPhone] = useState(() =>
    session?.phoneNumber ?? initApiState("", "0901 234 567"),
  )
  const [submitting, setSubmitting] = useState(false)
  const [savedMsg, setSavedMsg] = useState("")
  const [err, setErr] = useState("")

  useEffect(() => {
    if (isSsrSmokeTest()) return
    let active = true
    void fetchCurrentUserProfile().then((profile) => {
      if (!active || !profile) return
      setName(profile.fullName || profile.username)
      if (profile.phoneNumber) {
        setPhone(profile.phoneNumber)
      }
    })
    if (role === "admin" && getAccessToken()) {
      void getPermissionCatalog()
        .then((res) => {
          if (!active || !res.success || !Array.isArray(res.data)) return
          const map: Record<string, string> = { ...STAFF_PERM_LABELS }
          for (const item of res.data) {
            if (item.code && item.label) map[item.code] = item.label
          }
          setPermLabels(map)
        })
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [role])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (name.trim().length < 2) {
      setErr("Tên hiển thị phải có ít nhất 2 ký tự.")
      setSavedMsg("")
      return
    }
    if (name.trim().length > 100) {
      setErr("Tên hiển thị không được vượt quá 100 ký tự.")
      setSavedMsg("")
      return
    }
    if (!/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, ""))) {
      setErr("Số điện thoại chưa đúng định dạng Việt Nam.")
      setSavedMsg("")
      return
    }

    setErr("")
    setSubmitting(true)
    try {
      const res = await updateCurrentUserProfile({
        fullName: name,
        phoneNumber: phone,
      })
      setSavedMsg(res.message)
    } catch (error) {
      setErr(formatAuthError(error))
      setSavedMsg("")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHead
        eyebrow="TÀI KHOẢN NỘI BỘ"
        title={role === "admin" ? "Hồ sơ quản trị" : "Hồ sơ nhân viên"}
        body={`Tài khoản ${ROLE_LABEL[role].toLowerCase()} đang đăng nhập và những việc đang chờ trong console. Mã nhân viên và quyền do quản trị viên cấp, không sửa được ở đây.`}
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <form
          onSubmit={submit}
          noValidate
          className="card flex flex-col gap-5 self-start p-5 md:p-6"
        >
          <FormRequiredLegend />
          <Field label="Tên hiển thị" required hint="Tên này hiện cạnh quyền trong log vận hành.">
            <input
              className={`input ${err && name.trim().length < 2 ? "border-warn" : ""}`}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSavedMsg("")
              }}
            />
          </Field>

          <Field label="Số điện thoại nội bộ" required hint="Để người trực ban gọi khi có việc gấp ngoài giờ.">
            <input
              className={`input tabular-nums ${
                err && !/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, ""))
                  ? "border-warn"
                  : ""
              }`}
              inputMode="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setSavedMsg("")
              }}
            />
          </Field>

          <Field label="Email công việc">
            <input
              className="input"
              value={session?.email ?? "quantri@ecolink.vn"}
              readOnly
              disabled
            />
            <span className="text-[12px] text-muted">
              Email là định danh đăng nhập, đổi ở phòng IT chứ không sửa trên web.
            </span>
          </Field>

          {err && (
            <p role="alert" className="text-[13px] font-medium text-warn">
              {err}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary h-11 px-6 disabled:opacity-60"
            >
              {submitting ? "Đang lưu..." : "Lưu hồ sơ"}
            </button>
            {savedMsg && (
              <p role="status" className="text-[13px] font-semibold text-brand">
                {savedMsg}
              </p>
            )}
          </div>
        </form>

        <div className="flex flex-col gap-6">
          <section className="card p-5">
            <h2 className="text-[15px] font-bold text-ink">Thông tin được cấp</h2>
            <dl className="mt-3 flex flex-col gap-2 text-[13px]">
              {[
                ["Mã tài khoản", session?.username ? session.username.toUpperCase() : role === "admin" ? "QT-01" : "NV-01"],
                ["Email", session?.email || "—"],
                ["Vai trò", ROLE_LABEL[role]],
                ["Bộ phận", role === "admin" ? "Ban quản trị" : "Vận hành nền tảng"],
                ["Trạng thái", session?.status === "Suspended" || session?.status === "Locked" ? "Đang khoá" : "Đang hoạt động"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line-soft pb-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-5 text-[11px] font-bold tracking-[0.1em] text-muted uppercase">
              Quyền được cấp
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {role === "admin" ? (
                <Status tone="ok">Toàn quyền hệ thống</Status>
              ) : (session?.permissions?.length ?? 0) > 0 ? (
                session!.permissions!.map((code) => (
                  <Status key={code} tone="wait">
                    {permLabels[code] ?? code}
                  </Status>
                ))
              ) : (
                <Status tone="off">Chưa được cấp quyền chi tiết</Status>
              )}
            </div>
            <p className="mt-3 text-[12px] leading-5 text-muted">
              Quyền do quản trị viên cấp. Cần thêm quyền thì gửi yêu cầu, không tự
              chỉnh ở đây.
            </p>
          </section>

          <Queue role={role} permissions={session?.permissions} />
        </div>
      </div>
    </>
  )
}

function Queue({ role, permissions }: { role: "staff" | "admin"; permissions?: string[] }) {
  const hasPermFilter = role === "staff" && Array.isArray(permissions)
  const perms = new Set(permissions ?? [])
  const can = (p: string) => role === "admin" || !hasPermFilter || perms.has(p)

  const [counts, setCounts] = useState(() =>
    initApiState(
      { ai: 0, apps: 0, complaints: 0, posts: 0, lockedStaff: 0 },
      {
        ai: AI_CASES.filter((c) => !c.inDataset).length,
        apps: APPLICATIONS.filter((a) => a.status === "pending").length,
        complaints: COMPLAINTS.filter((c) => c.status === "new").length,
        posts: POSTS.filter((p) => p.status === "pending").length,
        lockedStaff: STAFF.filter((s) => s.status === "locked").length,
      },
    ),
  )

  useEffect(() => {
    if (isSsrSmokeTest() || !getAccessToken()) return
    let active = true
    if (role === "staff") {
      const canAi = !hasPermFilter || perms.has("REVIEW_AI")
      const canApp = !hasPermFilter || perms.has("VERIFY_RECYCLER")
      const canCmp = !hasPermFilter || perms.has("HANDLE_COMPLAINT")
      const canBlog = !hasPermFilter || perms.has("MANAGE_BLOG")

      void Promise.allSettled([
        canAi ? fetchStaffAiFeedbackQueue({ pageSize: 1 }) : Promise.resolve(null),
        canApp ? fetchStaffApplications() : Promise.resolve(null),
        canCmp ? fetchStaffComplaints({ pageSize: 1, includeReportedReviews: false }) : Promise.resolve(null),
        canBlog ? fetchStaffBlogs({ status: "Pending_Approval", pageSize: 1 }) : Promise.resolve(null),
      ]).then(([aiRes, appRes, cmpRes, blogRes]) => {
        if (!active) return
        setCounts((prev) => ({
          ...prev,
          ai:
            aiRes.status === "fulfilled" && aiRes.value?.data
              ? aiRes.value.data.pendingCount
              : prev.ai,
          apps:
            appRes.status === "fulfilled" && appRes.value
              ? appRes.value.items.filter((a) => a.status === "pending").length
              : prev.apps,
          complaints:
            cmpRes.status === "fulfilled" && cmpRes.value?.data
              ? cmpRes.value.data.openCount + cmpRes.value.data.investigatingCount
              : prev.complaints,
          posts:
            blogRes.status === "fulfilled" && blogRes.value?.data
              ? blogRes.value.data.totalCount
              : prev.posts,
        }))
      })
    } else {
      void Promise.allSettled([
        fetchAdminPendingBlogs({ pageSize: 1 }),
        getAdminStaffList(),
      ]).then(([blogRes, staffRes]) => {
        if (!active) return
        setCounts((prev) => ({
          ...prev,
          posts:
            blogRes.status === "fulfilled" && blogRes.value.data
              ? blogRes.value.data.totalCount
              : prev.posts,
          lockedStaff:
            staffRes.status === "fulfilled" && Array.isArray(staffRes.value.data)
              ? staffRes.value.data.filter((s) => s.status !== "Active").length
              : prev.lockedStaff,
        }))
      })
    }
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, permissions])

  const allStaffRows: { perm: string; to: string; label: string; count: number }[] = [
    {
      perm: "REVIEW_AI",
      to: "/staff/ai-review",
      label: "Ảnh AI chờ gán nhãn",
      count: counts.ai,
    },
    {
      perm: "VERIFY_RECYCLER",
      to: "/staff/applications",
      label: "Hồ sơ đối tác chờ thẩm định",
      count: counts.apps,
    },
    {
      perm: "HANDLE_COMPLAINT",
      to: "/staff/complaints",
      label: "Khiếu nại mới",
      count: counts.complaints,
    },
    {
      perm: "MANAGE_BLOG",
      to: "/staff/blog",
      label: "Bài Blog chờ duyệt",
      count: counts.posts,
    },
  ]

  const rows: { to: string; label: string; count: number }[] =
    role === "staff"
      ? (hasPermFilter ? allStaffRows.filter((r) => can(r.perm)) : allStaffRows)
      : [
          {
            to: "/admin/blog",
            label: "Bài Blog chờ duyệt",
            count: counts.posts,
          },
          {
            to: "/admin/staff",
            label: "Nhân viên đang bị khoá",
            count: counts.lockedStaff,
          },
        ]

  const open = rows.reduce((n, r) => n + r.count, 0)

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-ink">Việc đang chờ</h2>
        <span className="text-[13px] text-muted">
          {open === 0 ? "Không có việc nào" : `${open} việc`}
        </span>
      </div>

      <ul className="mt-3 flex flex-col">
        {rows.map((r) => (
          <li key={r.to} className="border-b border-line-soft last:border-0">
            <Link
              to={r.to}
              className="flex items-center justify-between gap-3 py-2.5 text-[13px] text-body transition-colors hover:text-brand-deep"
            >
              {r.label}
              {r.count === 0 ? (
                <Status tone="off">Xong</Status>
              ) : (
                <Status tone="todo">{r.count} chờ</Status>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
