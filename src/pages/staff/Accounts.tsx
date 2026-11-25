import { useEffect, useState } from "react"
import PaginationBar, { FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import { PageHead, RequiredMark, Status, Table, TableSkeleton, Td } from "@/components/Portal"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { ACCOUNTS, type Account } from "@/data/ops"
import { ApiError } from "@/lib/api"
import { initApiLoading, initApiState } from "@/lib/hydration"
import { hasLiveBackendAuth } from "@/lib/session"
import {
  deactivateAccount,
  getStaffAccountDetail,
  getStaffAccounts,
  lockOrUnlockAccount,
  type ModerationLogItemDto,
  type StaffAccountDetailDto,
  type StaffAccountListItemDto,
} from "@/lib/governanceApi"

type AccountRow = Account & {
  backendId?: string
  rawStatus: "Active" | "Suspended" | "Deactivated" | "PendingVerification"
  warningCount: number
  canDeactivate: boolean
  phoneNumber?: string | null
  moderationReason?: string | null
}

function mapDtoToRow(dto: StaffAccountListItemDto): AccountRow {
  const normRole = dto.role.toLowerCase() === "recycler" || dto.role.toLowerCase() === "collector"
    ? "recycler"
    : "user"
  const normStatus: AccountRow["rawStatus"] =
    dto.status === "Suspended"
      ? "Suspended"
      : dto.status === "Deactivated"
        ? "Deactivated"
        : dto.status === "PendingVerification"
          ? "PendingVerification"
          : "Active"

  return {
    id: dto.accountCode || dto.id.slice(0, 8),
    backendId: dto.id,
    name: dto.fullName || dto.username,
    email: dto.email,
    phoneNumber: dto.phoneNumber,
    role: normRole,
    area: dto.area || "Chưa cập nhật",
    joined: new Date(dto.joinedAt).toLocaleDateString("vi-VN"),
    status: normStatus === "Active" || normStatus === "PendingVerification" ? "active" : "locked",
    rawStatus: normStatus,
    deals: dto.completedDealsCount,
    warningCount: dto.warningCount,
    canDeactivate: dto.canDeactivate,
  }
}

const FALLBACK_ROWS: AccountRow[] = ACCOUNTS.map((a) => ({
  ...a,
  rawStatus: a.status === "active" ? "Active" : "Suspended",
  warningCount: a.status === "locked" ? 1 : 0,
  canDeactivate: a.deals === 0,
}))

/**
 * S-06 Xem danh sách & chi tiết User/Recycler · S-07 Khoá / vô hiệu hoá tài khoản.
 *
 * Tuân thủ BR-ADM-03 (bắt buộc nhập lý do >= 10 ký tự & thu hồi Refresh Token)
 * và BR-ADM-04 (chỉ vô hiệu hoá mềm Deactivated kèm lý do kiểm toán, không xóa vật lý bản ghi).
 */
export default function Accounts() {
  const [list, setList] = useState<AccountRow[]>(() => initApiState([], FALLBACK_ROWS))
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [isLive, setIsLive] = useState(false)
  const [role, setRole] = useState<"all" | "user" | "recycler">("all")
  const [q, setQ] = useState("")
  const debouncedQ = useDebouncedValue(q, 250)
  const [page, setPage] = useState(1)
  const pageSize = FIXED_PAGE_SIZE
  const [pick, setPick] = useState<AccountRow | null>(null)
  const [detail, setDetail] = useState<StaffAccountDetailDto | null>(null)
  const [flash, setFlash] = useState("")
  const [actionErr, setActionErr] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Modal nhập lý do bắt buộc (BR-ADM-03 / BR-ADM-04)
  const [modalAction, setModalAction] = useState<{
    target: AccountRow
    kind: "lock" | "unlock" | "deactivate"
  } | null>(null)
  const [reasonText, setReasonText] = useState("")
  const [addWarning, setAddWarning] = useState(true)
  const [modalError, setModalError] = useState("")

  useEffect(() => {
    let cancelled = false
    getStaffAccounts({ pageSize: 100 })
      .then((res) => {
        if (cancelled || !res.data?.items) return
        const mapped = res.data.items.map(mapDtoToRow)
        setList(mapped)
        setIsLive(true)
      })
      .catch((err) => {
        if (!cancelled && hasLiveBackendAuth()) {
          setActionErr(
            err instanceof ApiError
              ? err.message
              : "Không tải được danh sách tài khoản từ máy chủ.",
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectAccount = (a: AccountRow) => {
    setPick(a)
    setDetail(null)
    if (a.backendId) {
      getStaffAccountDetail(a.backendId)
        .then((res) => {
          if (res.data) setDetail(res.data)
        })
        .catch(() => {
          // Giữ thông tin cơ bản
        })
    }
  }

  const openModerationModal = (target: AccountRow, kind: "lock" | "unlock" | "deactivate") => {
    setActionErr("")
    setFlash("")
    setModalAction({ target, kind })
    setReasonText("")
    setAddWarning(kind === "lock")
    setModalError("")
  }

  const submitModeration = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modalAction) return

    const cleanReason = reasonText.trim()
    if (cleanReason.length < 10) {
      setModalError("Lý do xử lý bắt buộc tối thiểu 10 ký tự theo quy tắc BR-ADM-03.")
      return
    }
    if (cleanReason.length > 500) {
      setModalError("Lý do xử lý không được vượt quá 500 ký tự.")
      return
    }

    const { target, kind } = modalAction
    setSubmitting(true)
    setModalError("")

    try {
      if ((isLive || hasLiveBackendAuth()) && target.backendId) {
        if (kind === "deactivate") {
          await deactivateAccount(target.backendId, { reason: cleanReason })
          setList((ls) =>
            ls.map((x) =>
              x.backendId === target.backendId
                ? { ...x, status: "locked", rawStatus: "Deactivated", moderationReason: cleanReason }
                : x,
            ),
          )
          setFlash(`Đã vô hiệu hoá mềm tài khoản ${target.name} và thu hồi toàn bộ phiên đăng nhập.`)
        } else {
          const isLocked = kind === "lock"
          const res = await lockOrUnlockAccount(target.backendId, {
            isLocked,
            reason: cleanReason,
            addWarning: isLocked ? addWarning : false,
          })
          const nextWarn = res.data?.warningCount ?? target.warningCount
          setList((ls) =>
            ls.map((x) =>
              x.backendId === target.backendId
                ? {
                    ...x,
                    status: isLocked ? "locked" : "active",
                    rawStatus: isLocked ? "Suspended" : "Active",
                    warningCount: nextWarn,
                    moderationReason: isLocked ? cleanReason : null,
                  }
                : x,
            ),
          )
          setFlash(
            res.message ||
              (isLocked
                ? `Đã khoá ${target.name} và thu hồi ${res.data?.revokedRefreshTokens ?? 0} phiên Refresh Token.`
                : `Đã mở khoá tài khoản ${target.name}.`),
          )
        }

        if (pick?.backendId === target.backendId) {
          const refreshed = await getStaffAccountDetail(target.backendId).catch(() => null)
          if (refreshed?.data) setDetail(refreshed.data)
        }
      } else {
        // Fallback offline nhưng vẫn kiểm tra nghiêm ngặt BR-ADM-03 / BR-ADM-04
        if (kind === "deactivate") {
          setList((ls) =>
            ls.map((x) =>
              x.id === target.id
                ? { ...x, status: "locked", rawStatus: "Deactivated", moderationReason: cleanReason }
                : x,
            ),
          )
          setFlash(`Đã vô hiệu hoá tài khoản ${target.name} (ghi nhận lý do).`)
        } else {
          const isLocked = kind === "lock"
          setList((ls) =>
            ls.map((x) =>
              x.id === target.id
                ? {
                    ...x,
                    status: isLocked ? "locked" : "active",
                    rawStatus: isLocked ? "Suspended" : "Active",
                    warningCount: isLocked && addWarning ? x.warningCount + 1 : x.warningCount,
                    moderationReason: isLocked ? cleanReason : null,
                  }
                : x,
            ),
          )
          setFlash(isLocked ? `Đã khoá tài khoản ${target.name}.` : `Đã mở khoá ${target.name}.`)
        }
      }

      setPick((prev) =>
        prev && prev.id === target.id
          ? {
              ...prev,
              status: kind === "unlock" ? "active" : "locked",
              rawStatus:
                kind === "deactivate"
                  ? "Deactivated"
                  : kind === "lock"
                    ? "Suspended"
                    : "Active",
            }
          : prev,
      )
      setModalAction(null)
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Không thể thực hiện thao tác chế tài.")
    } finally {
      setSubmitting(false)
    }
  }

  const view = list.filter((a) => {
    const k = debouncedQ.trim().toLowerCase()
    const hitQ =
      !k ||
      a.name.toLowerCase().includes(k) ||
      a.email.toLowerCase().includes(k) ||
      a.id.toLowerCase().includes(k) ||
      a.area.toLowerCase().includes(k)
    return hitQ && (role === "all" || a.role === role)
  })
  const pagedView = paginateItems(view, page, pageSize)

  const statusLabel = (a: AccountRow) => {
    if (a.rawStatus === "Deactivated") return "Ngưng kích hoạt"
    if (a.rawStatus === "Suspended" || a.status === "locked") return "Đã khoá"
    return "Hoạt động"
  }

  const historyList: ModerationLogItemDto[] = detail?.moderationHistory ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="TÀI KHOẢN · S-06 & S-07"
        title="Danh sách User và Recycler"
        body="Tra cứu hồ sơ, cảnh cáo vi phạm và áp dụng chế tài (Khoá / Mở khoá / Vô hiệu hoá mềm). Mọi thao tác bắt buộc ghi rõ lý do kiểm toán tối thiểu 10 ký tự."
      />

      <div className="card flex flex-col gap-4 p-4 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Tìm tài khoản
            <input
              className="input"
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              placeholder="Tên, email, khu vực hoặc mã tài khoản"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "user", "recycler"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRole(r)
                setPage(1)
              }}
              aria-pressed={role === r}
              className={`h-12 rounded-lg border px-4 text-[13px] font-semibold transition-colors ${
                role === r
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-body hover:bg-surface-2"
              }`}
            >
              {r === "all" ? "Tất cả" : r === "user" ? "Người dân" : "Cơ sở thu mua"}
            </button>
          ))}
        </div>
      </div>

      {actionErr && (
        <p
          role="alert"
          className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn"
        >
          {actionErr}
        </p>
      )}
      {flash && (
        <p role="status" className="text-[13px] font-semibold text-brand">
          {flash}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.65fr_1fr]">
        <div className="min-w-0">
          {loading ? (
            <TableSkeleton rows={5} />
          ) : (
          <Table
            head={["Mã", "Tên", "Vai trò", "Khu vực", "Giao dịch", "Cảnh cáo", "Trạng thái", ""]}
          >
            {pagedView.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-xs text-muted">
                  Không tìm thấy tài khoản nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              pagedView.map((a) => (
                <tr key={a.backendId ?? a.id}>
                  <Td className="tabular-nums whitespace-nowrap">{a.id}</Td>
                  <Td className="font-semibold text-ink">{a.name}</Td>
                  <Td className="whitespace-nowrap">
                    {a.role === "user" ? "Người dân" : "Cơ sở thu mua"}
                  </Td>
                  <Td className="whitespace-nowrap">{a.area}</Td>
                  <Td className="tabular-nums">{a.deals}</Td>
                  <Td className="tabular-nums">
                    {a.warningCount > 0 ? (
                      <span className="font-semibold text-warn">{a.warningCount}</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </Td>
                  <Td>
                    <Status tone={a.status === "active" ? "ok" : "off"}>{statusLabel(a)}</Status>
                  </Td>
                  <Td>
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => selectAccount(a)}
                        className="text-[13px] font-semibold text-brand hover:text-brand-deep"
                      >
                        Chi tiết
                      </button>
                      {a.rawStatus !== "Deactivated" && (
                        <button
                          type="button"
                          onClick={() =>
                            openModerationModal(a, a.status === "active" ? "lock" : "unlock")
                          }
                          className="text-[13px] font-semibold text-warn hover:underline"
                        >
                          {a.status === "active" ? "Khoá" : "Mở khoá"}
                        </button>
                      )}
                    </span>
                  </Td>
                </tr>
              ))
            )}
          </Table>
          )}
          <PaginationBar
            page={page}
            pageSize={pageSize}
            totalCount={view.length}
            onPageChange={setPage}
            itemLabel="tài khoản"
          />
        </div>

        <aside className="card flex flex-col gap-4 p-5">
          {!pick ? (
            <p className="text-sm text-muted">
              Chọn &ldquo;Chi tiết&rdquo; ở một dòng để xem hồ sơ hoạt động, số lần cảnh cáo và lịch sử chế tài.
            </p>
          ) : (
            <>
              <div>
                <p className="text-base font-bold text-ink">{pick.name}</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  {pick.id} · {pick.email}
                </p>
              </div>
              <dl className="flex flex-col gap-2 text-sm">
                {[
                  ["Vai trò", pick.role === "user" ? "Người dân" : "Cơ sở thu mua"],
                  ["Khu vực", detail?.area ?? pick.area],
                  ["Ngày tham gia", pick.joined],
                  ["Giao dịch hoàn tất", String(detail?.completedDealsCount ?? pick.deals)],
                  ["Số lần cảnh cáo", String(detail?.warningCount ?? pick.warningCount)],
                  ...(detail
                    ? [
                        ["Điểm Mầm Xanh", detail.currentGreenPoints.toLocaleString("vi-VN")],
                        ["Tổng khối lượng tái chế", `${detail.totalRecycledKg} kg`],
                      ]
                    : []),
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-3 border-b border-line-soft pb-2"
                  >
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-semibold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>

              {(detail?.moderationReason || pick.moderationReason) && (
                <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] text-body">
                  <span className="font-semibold text-ink">Lý do chế tài gần nhất: </span>
                  {detail?.moderationReason || pick.moderationReason}
                </div>
              )}

              {pick.rawStatus !== "Deactivated" && (
                <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      openModerationModal(pick, pick.status === "active" ? "lock" : "unlock")
                    }
                    className="btn-outline h-10 px-4 text-[13px]"
                  >
                    {pick.status === "active" ? "Khoá tài khoản" : "Mở khoá"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openModerationModal(pick, "deactivate")}
                    className="btn-ghost h-10 px-4 text-[13px] text-warn"
                  >
                    Vô hiệu hoá
                  </button>
                </div>
              )}

              <p className="text-[13px] leading-5 text-muted">
                Theo quy tắc BR-ADM-04, thao tác vô hiệu hoá chỉ chuyển trạng thái sang{" "}
                <b>Vô hiệu hoá mềm (Deactivated)</b> kèm lý do kiểm toán bắt buộc, tuyệt đối không xóa vật lý bản ghi nhằm bảo toàn{" "}
                {pick.deals > 0 ? `${pick.deals} giao dịch hoàn tất và dấu vết đối soát.` : "toàn bộ lịch sử kiểm toán."}
              </p>

              {historyList.length > 0 && (
                <div className="border-t border-line-soft pt-3">
                  <p className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
                    Lịch sử chế tài ({historyList.length})
                  </p>
                  <ul className="mt-2 flex flex-col gap-2 text-[12px]">
                    {historyList.slice(0, 4).map((h) => (
                      <li
                        key={h.id}
                        className="rounded-md border border-line-soft bg-surface px-2.5 py-2"
                      >
                        <div className="flex justify-between font-semibold text-ink">
                          <span>{h.actionType}</span>
                          <span className="tabular-nums text-muted">
                            {new Date(h.createdAt).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                        <p className="mt-0.5 text-body">{h.reason}</p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          Bởi {h.performedByName} · Thu hồi {h.revokedTokensCount} token
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {modalAction && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
        >
          <form
            noValidate
            onSubmit={submitModeration}
            className="card flex w-full max-w-md flex-col gap-4 bg-white p-6 shadow-xl"
          >
            <div>
              <p className="text-[11px] font-bold tracking-[0.12em] text-brand uppercase">
                XÁC NHẬN CHẾ TÀI · BR-ADM-03
              </p>
              <h2 className="mt-1 text-lg font-bold text-ink">
                {modalAction.kind === "lock"
                  ? `Khoá tài khoản ${modalAction.target.name}`
                  : modalAction.kind === "unlock"
                    ? `Mở khoá tài khoản ${modalAction.target.name}`
                    : `Vô hiệu hoá mềm ${modalAction.target.name}`}
              </h2>
            </div>

            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
              <span>
                Lý do ghi vào Nhật ký kiểm toán (bắt buộc &ge; 10 ký tự)
                <RequiredMark />
              </span>
              <textarea
                className="input min-h-[96px] py-2"
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Ví dụ: Tái phạm gian lận cân đo ở mã đơn BH-2609-0184 sau khi đã nhắc nhở..."
                required
              />
            </label>

            {modalAction.kind === "lock" && (
              <label className="flex items-center gap-2 text-[13px] text-body">
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={addWarning}
                  onChange={(e) => setAddWarning(e.target.checked)}
                />
                Cộng thêm +1 lần cảnh cáo vi phạm vào hồ sơ tài khoản
              </label>
            )}

            {modalError && (
              <p
                role="alert"
                className="rounded-xl border border-warn/35 bg-warn/10 px-3.5 py-2 text-[13px] font-medium text-warn"
              >
                {modalError}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
              <button
                type="button"
                onClick={() => setModalAction(null)}
                disabled={submitting}
                className="btn-ghost h-10 px-4 text-[13px]"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary h-10 px-5 text-[13px]"
              >
                {submitting ? "Đang lưu..." : "Xác nhận thực thi"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
