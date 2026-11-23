import { useCallback, useEffect, useState } from "react"
import PaginationBar, { FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import SearchFilterBar from "@/components/SearchFilterBar"
import { ApiError } from "@/lib/api"
import { Field, FormRequiredLegend, PageHead, Status } from "@/components/admin/ui"
import { CYCLES } from "@/data/ops"
import { LEADERBOARD, fmt } from "@/data/rewards"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { formatViDate } from "@/lib/blogApi"
import { initApiLoading, isSsrSmokeTest } from "@/lib/hydration"
import {
  activateLeaderboardCycle,
  createLeaderboardCycle,
  fetchLeaderboard,
  fetchLeaderboardCycles,
  finalizeLeaderboardCycle,
  type LeaderboardCycleDto,
  type LeaderboardViewDto,
} from "@/lib/gamificationApi"

const PERIOD_LABEL: Record<string, string> = {
  Weekly: "Theo tuần",
  Monthly: "Theo tháng",
  Quarterly: "Theo quý",
}

function defaultStartDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultEndDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

function statusMeta(cycle: LeaderboardCycleDto): {
  tone: "todo" | "wait" | "ok" | "off"
  label: string
} {
  if (cycle.isActive || cycle.status === "Active") {
    return { tone: "ok", label: "Đang tính" }
  }
  if (cycle.status === "Finalized") {
    return { tone: "wait", label: "Đã chốt thưởng" }
  }
  if (cycle.status === "Upcoming") {
    return { tone: "todo", label: "Sắp mở" }
  }
  return { tone: "off", label: cycle.status || "Tắt" }
}

/** A-08 Cấu hình chu kỳ bảng xếp hạng (Tuần / Tháng / Quý).
 *
 *  Bật nhiều chu kỳ cùng lúc thì người dùng phải tự hiểu "quý" tính khác gì
 *  "tuần". Cho phép bật tối đa một chu kỳ, và hiện bảng xếp hạng tương ứng với
 *  chu kỳ đang bật — bảng nào không bật thì không render, không phải render
 *  rồi ghi "tạm thời không xếp hạng". */
export default function LeaderboardConfig() {
  const [liveMode] = useState(() => !isSsrSmokeTest())

  // Offline / SSR fallback
  const [on, setOn] = useState<string>(CYCLES.find((c) => c.active)!.id)

  // Live Backend state
  const [cycles, setCycles] = useState<LeaderboardCycleDto[]>([])
  const [board, setBoard] = useState<LeaderboardViewDto | null>(null)
  const [selectedCycleId, setSelectedCycleId] = useState<string>("")
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmFinalizeId, setConfirmFinalizeId] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [periodType, setPeriodType] = useState<"Weekly" | "Monthly" | "Quarterly">("Monthly")
  const [startsAt, setStartsAt] = useState(defaultStartDate)
  const [endsAt, setEndsAt] = useState(defaultEndDate)
  const [top1Bonus, setTop1Bonus] = useState(500)
  const [top2Bonus, setTop2Bonus] = useState(300)
  const [top3Bonus, setTop3Bonus] = useState(150)
  const [activateNow, setActivateNow] = useState(false)

  const [flash, setFlash] = useState("")
  const [error, setError] = useState("")
  const [boardSearch, setBoardSearch] = useState("")
  const debouncedBoardSearch = useDebouncedValue(boardSearch, 250)
  const [boardRoleFilter, setBoardRoleFilter] = useState<"all" | "User" | "Recycler">("all")
  const [boardPage, setBoardPage] = useState(1)
  const boardPageSize = FIXED_PAGE_SIZE

  const loadData = useCallback(async (preferredCycleId?: string) => {
    setLoading(true)
    setError("")
    try {
      const cyclesRes = await fetchLeaderboardCycles()
      const list = cyclesRes.data ?? []
      setCycles(list)

      const active = list.find((c) => c.isActive || c.status === "Active") ?? list[0]
      const targetId =
        preferredCycleId && list.some((c) => c.id === preferredCycleId)
          ? preferredCycleId
          : active?.id ?? ""

      setSelectedCycleId(targetId)
      const boardRes = await fetchLeaderboard({
        top: 50,
        cycleId: targetId || undefined,
      })
      setBoard(boardRes.data ?? null)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Không tải được danh sách chu kỳ bảng xếp hạng.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!liveMode) return
    void loadData()
  }, [liveMode, loadData])

  const previewCycleBoard = async (cycleId: string) => {
    setSelectedCycleId(cycleId)
    setBoardPage(1)
    setError("")
    try {
      const res = await fetchLeaderboard({ top: 50, cycleId })
      setBoard(res.data ?? null)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không tải được bảng xếp hạng cho chu kỳ này.",
      )
    }
  }

  const handleActivate = async (cycle: LeaderboardCycleDto) => {
    setBusyId(cycle.id)
    setError("")
    setFlash("")
    try {
      await activateLeaderboardCycle(cycle.id)
      await loadData(cycle.id)
      setFlash(`Đã kích hoạt "${cycle.name}" làm chu kỳ bảng xếp hạng duy nhất đang tính.`)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể kích hoạt chu kỳ bảng xếp hạng.",
      )
    } finally {
      setBusyId(null)
    }
  }

  const handleFinalize = async (cycle: LeaderboardCycleDto) => {
    setBusyId(cycle.id)
    setError("")
    setFlash("")
    try {
      const res = await finalizeLeaderboardCycle(cycle.id)
      const finalized = res.data
      setConfirmFinalizeId(null)
      await loadData(cycle.id)
      const winnerCount = finalized?.winners?.length ?? 0
      setFlash(
        winnerCount > 0
          ? `Đã chốt chu kỳ "${cycle.name}" và trao thưởng cho ${winnerCount} người dẫn đầu.`
          : `Đã chốt chu kỳ "${cycle.name}".`,
      )
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể chốt chu kỳ và trao thưởng.",
      )
    } finally {
      setBusyId(null)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setFlash("")
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Vui lòng nhập tên chu kỳ bảng xếp hạng.")
      return
    }
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      setError("Ngày kết thúc phải sau ngày bắt đầu.")
      return
    }

    setCreating(true)
    try {
      const res = await createLeaderboardCycle({
        name: trimmed,
        periodType,
        startsAt: new Date(`${startsAt}T00:00:00Z`).toISOString(),
        endsAt: new Date(`${endsAt}T23:59:59Z`).toISOString(),
        isActive: activateNow,
        top1BonusPoints: Math.max(0, Math.round(top1Bonus)),
        top2BonusPoints: Math.max(0, Math.round(top2Bonus)),
        top3BonusPoints: Math.max(0, Math.round(top3Bonus)),
      })
      const created = res.data
      setName("")
      setActivateNow(false)
      setShowCreate(false)
      await loadData(created?.id)
      setFlash(`Đã tạo chu kỳ "${created?.name ?? trimmed}".`)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể tạo chu kỳ bảng xếp hạng mới.",
      )
    } finally {
      setCreating(false)
    }
  }

  const viewedCycle = cycles.find((c) => c.id === selectedCycleId) ?? board?.activeCycle ?? null

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="CẤU HÌNH"
        title="Chu kỳ bảng xếp hạng"
        body="Chỉ một chu kỳ được tính tại một thời điểm. Bật thêm chu kỳ thứ hai thì người dùng phải tự đoán cái nào tính điểm gì."
        action={
          liveMode ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadData(selectedCycleId || undefined)}
                className="btn-ghost h-10 px-4 text-sm"
              >
                {loading ? "Đang tải..." : "Làm mới"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate((s) => !s)
                  setError("")
                }}
                className="btn-primary h-10 px-4 text-sm"
              >
                {showCreate ? "Đóng biểu mẫu" : "Tạo chu kỳ mới"}
              </button>
            </div>
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

      {liveMode ? (
        <>
          {showCreate && (
            <form onSubmit={handleCreate} className="card flex flex-col gap-4 p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-ink">Tạo chu kỳ bảng xếp hạng mới</h2>
                <FormRequiredLegend />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Tên chu kỳ" required>
                  <input
                    className="input"
                    type="text"
                    maxLength={120}
                    placeholder="Ví dụ: Đua top Tháng 11/2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label="Loại chu kỳ" required>
                  <select
                    className="input"
                    value={periodType}
                    onChange={(e) =>
                      setPeriodType(
                        e.target.value as "Weekly" | "Monthly" | "Quarterly",
                      )
                    }
                  >
                    <option value="Weekly">Theo tuần (Weekly)</option>
                    <option value="Monthly">Theo tháng (Monthly)</option>
                    <option value="Quarterly">Theo quý (Quarterly)</option>
                  </select>
                </Field>
                <Field label="Từ ngày" required>
                  <input
                    className="input"
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </Field>
                <Field label="Đến ngày" required>
                  <input
                    className="input"
                    type="date"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Thưởng Top 1 (điểm)" required>
                  <input
                    className="input tabular-nums"
                    type="number"
                    min={0}
                    value={top1Bonus}
                    onChange={(e) => setTop1Bonus(Number(e.target.value))}
                  />
                </Field>
                <Field label="Thưởng Top 2 (điểm)" required>
                  <input
                    className="input tabular-nums"
                    type="number"
                    min={0}
                    value={top2Bonus}
                    onChange={(e) => setTop2Bonus(Number(e.target.value))}
                  />
                </Field>
                <Field label="Thưởng Top 3 (điểm)" required>
                  <input
                    className="input tabular-nums"
                    type="number"
                    min={0}
                    value={top3Bonus}
                    onChange={(e) => setTop3Bonus(Number(e.target.value))}
                  />
                </Field>
              </div>

              <label className="flex items-center gap-2.5 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={activateNow}
                  onChange={(e) => setActivateNow(e.target.checked)}
                />
                Kích hoạt ngay làm chu kỳ đang tính (tự động tắt chu kỳ cũ nếu có)
              </label>

              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={creating} className="btn-primary h-10 px-5">
                  {creating ? "Đang tạo..." : "Lưu chu kỳ mới"}
                </button>
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setShowCreate(false)}
                  className="btn-ghost h-10 px-4"
                >
                  Huỷ
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="card px-5 py-8 text-center text-sm text-muted">
              Đang tải danh sách chu kỳ bảng xếp hạng...
            </div>
          ) : cycles.length === 0 ? (
            <div className="card px-5 py-8 text-center text-sm text-muted">
              Chưa có chu kỳ bảng xếp hạng nào. Nhấn &ldquo;Tạo chu kỳ mới&rdquo; để khởi tạo.
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cycles.map((c) => {
                const meta = statusMeta(c)
                const isFinalized = c.status === "Finalized" || c.status === "Cancelled"
                const isBusy = busyId === c.id
                const isSelected = selectedCycleId === c.id

                return (
                  <li
                    key={c.id}
                    className={`card flex flex-col gap-3 p-5 transition-colors ${
                      c.isActive ? "border-brand bg-brand/6" : isSelected ? "border-brand/50" : ""
                    }`}
                  >
                    <label className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold tracking-wider text-brand uppercase">
                          {PERIOD_LABEL[c.periodType] ?? c.periodType}
                        </p>
                        <span className="text-base font-bold text-ink">{c.name}</span>
                      </div>
                      <input
                        type="radio"
                        name="cycle"
                        className="mt-1 size-4 shrink-0 accent-brand"
                        checked={c.isActive}
                        disabled={isFinalized || isBusy}
                        onChange={() => void handleActivate(c)}
                        aria-label={`Kích hoạt chu kỳ ${c.name}`}
                      />
                    </label>

                    <p className="text-[13px] text-muted">
                      Từ {formatViDate(c.startsAt)} đến {formatViDate(c.endsAt)}
                    </p>
                    <p className="text-xs text-muted">
                      Thưởng Top 3: {fmt(c.top1BonusPoints)} / {fmt(c.top2BonusPoints)} /{" "}
                      {fmt(c.top3BonusPoints)}
                    </p>

                    {c.winners && c.winners.length > 0 && (
                      <div className="rounded-lg border border-line-soft bg-surface-2 p-2.5 text-xs">
                        <p className="font-semibold text-ink">Top thắng giải đã chốt:</p>
                        <ul className="mt-1 space-y-0.5 text-muted">
                          {c.winners.map((w) => (
                            <li key={`${w.rank}-${w.userId}`}>
                              #{w.rank} {w.fullName} · {fmt(w.points)} (+
                              {w.bonusPointsAwarded.toLocaleString("vi-VN")} thưởng)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                      <Status tone={meta.tone}>{meta.label}</Status>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void previewCycleBoard(c.id)}
                          className="btn-ghost h-8 px-3 text-xs"
                        >
                          {isSelected ? "Đang xem BXH" : "Xem BXH"}
                        </button>
                        {!isFinalized &&
                          (confirmFinalizeId === c.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleFinalize(c)}
                                className="btn-primary h-8 px-3 text-xs"
                              >
                                {isBusy ? "Đang chốt..." : "Xác nhận chốt"}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => setConfirmFinalizeId(null)}
                                className="btn-ghost h-8 px-2 text-xs"
                              >
                                Huỷ
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmFinalizeId(c.id)}
                              className="btn-ghost h-8 px-3 text-xs text-brand-deep"
                            >
                              Chốt &amp; trao thưởng
                            </button>
                          ))}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
                Bảng xếp hạng{viewedCycle ? `: ${viewedCycle.name}` : ""}
              </h2>
              <p className="text-sm text-muted">
                Theo điểm xếp hạng, đổi quà không làm tụt hạng
              </p>
            </div>

            {(() => {
              const kw = debouncedBoardSearch.trim().toLowerCase()
              const filteredItems = (board?.items ?? []).filter((r) => {
                const roleMatch =
                  boardRoleFilter === "all" ||
                  (boardRoleFilter === "Recycler"
                    ? r.role?.toLowerCase() === "recycler"
                    : r.role?.toLowerCase() !== "recycler")
                if (!roleMatch) return false
                if (!kw) return true
                return `${r.fullName} ${r.area ?? ""} #${r.rank}`.toLowerCase().includes(kw)
              })
              const pagedItems = paginateItems(filteredItems, boardPage, boardPageSize)

              return (
                <>
                  <SearchFilterBar
                    value={boardSearch}
                    onChange={(v) => {
                      setBoardSearch(v)
                      setBoardPage(1)
                    }}
                    label="Tìm trong bảng xếp hạng"
                    placeholder="Tìm tên người dân, cơ sở thu mua hoặc khu vực..."
                    totalCount={filteredItems.length}
                    countLabel="tài khoản"
                    className="mt-4"
                  >
                    <select
                      aria-label="Lọc vai trò bảng xếp hạng"
                      value={boardRoleFilter}
                      onChange={(e) => {
                        setBoardRoleFilter(e.target.value as "all" | "User" | "Recycler")
                        setBoardPage(1)
                      }}
                      className="input h-10 text-xs"
                    >
                      <option value="all">Tất cả vai trò</option>
                      <option value="User">Người dân</option>
                      <option value="Recycler">Cơ sở thu mua</option>
                    </select>
                  </SearchFilterBar>

                  {filteredItems.length === 0 ? (
                    <div className="card mt-4 px-5 py-8 text-center text-sm text-muted">
                      {!board || board.items.length === 0
                        ? "Chưa có người dân hoặc cơ sở thu mua nào ghi nhận điểm xếp hạng trong chu kỳ này."
                        : "Không tìm thấy kết quả phù hợp bộ lọc."}
                    </div>
                  ) : (
                    <>
                      <ol className="card mt-4 divide-y divide-line-soft overflow-hidden">
                        {pagedItems.map((r) => {
                          const isRecycler = r.role?.toLowerCase() === "recycler"
                          return (
                            <li
                              key={r.userId}
                              className={`flex items-center gap-3 px-4 py-3 ${r.isCurrentUser ? "bg-brand/8" : ""}`}
                            >
                              <span className="w-7 shrink-0 text-sm font-semibold tabular-nums text-muted">
                                #{r.rank}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-ink">
                                    {r.fullName}
                                  </p>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      isRecycler
                                        ? "bg-amber-50 text-amber-800"
                                        : "bg-surface-2 text-brand-deep"
                                    }`}
                                  >
                                    {isRecycler ? "Cơ sở thu mua" : "Người dân"}
                                  </span>
                                </div>
                                <p className="truncate text-xs text-muted">
                                  {r.area || "Chưa cập nhật khu vực"} · Đã{" "}
                                  {isRecycler ? "thu mua" : "thu gom"}{" "}
                                  {r.totalRecycledKg.toFixed(1)} kg
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                                {fmt(r.periodPoints > 0 ? r.periodPoints : r.totalPoints)}
                              </span>
                            </li>
                          )
                        })}
                      </ol>
                      <PaginationBar
                        page={boardPage}
                        pageSize={boardPageSize}
                        totalCount={filteredItems.length}
                        onPageChange={setBoardPage}
                        itemLabel="tài khoản"
                      />
                    </>
                  )}
                </>
              )
            })()}
          </section>
        </>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-3">
            {CYCLES.map((c) => (
              <li
                key={c.id}
                className={`card flex flex-col gap-3 p-5 transition-colors ${
                  on === c.id ? "border-brand bg-brand/6" : ""
                }`}
              >
                <label className="flex items-center justify-between gap-3">
                  <span className="text-base font-bold text-ink">{c.label}</span>
                  <input
                    type="radio"
                    name="cycle"
                    className="size-4 accent-brand"
                    checked={on === c.id}
                    onChange={() => {
                      setOn(c.id)
                      setFlash(`Đã chuyển bảng xếp hạng sang chu kỳ ${c.label.toLowerCase()}.`)
                    }}
                  />
                </label>
                <p className="text-[13px] text-muted">
                  Từ {c.from} đến {c.to}
                </p>
                <div className="mt-auto">
                  <Status tone={on === c.id ? "ok" : "off"}>
                    {on === c.id ? "Đang tính" : "Tắt"}
                  </Status>
                </div>
              </li>
            ))}
          </ul>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
                Bảng xếp hạng {CYCLES.find((c) => c.id === on)?.label.toLowerCase()}
              </h2>
              <p className="text-sm text-muted">
                Theo điểm xếp hạng (Người dân &amp; Cơ sở thu mua), đổi quà không làm tụt hạng
              </p>
            </div>

            {(() => {
              const kw = debouncedBoardSearch.trim().toLowerCase()
              const filteredOffline = LEADERBOARD.map((r, idx) => ({ ...r, rank: idx + 1 })).filter(
                (r) => !kw || `${r.name} ${r.area}`.toLowerCase().includes(kw),
              )
              const pagedOffline = paginateItems(filteredOffline, boardPage, boardPageSize)
              return (
                <>
                  <SearchFilterBar
                    value={boardSearch}
                    onChange={(v) => {
                      setBoardSearch(v)
                      setBoardPage(1)
                    }}
                    label="Tìm trong bảng xếp hạng"
                    placeholder="Tìm tên người dân, cơ sở thu mua hoặc khu vực..."
                    totalCount={filteredOffline.length}
                    countLabel="tài khoản"
                    className="mt-4"
                  />
                  <ol className="card mt-4 divide-y divide-line-soft overflow-hidden">
                    {pagedOffline.map((r) => (
                      <li
                        key={r.name}
                        className={`flex items-center gap-3 px-4 py-3 ${r.you ? "bg-brand/8" : ""}`}
                      >
                        <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted">
                          {r.rank}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">
                            {r.name}
                            {r.you && <span className="ml-1.5 text-xs text-brand">(tài khoản mẫu)</span>}
                          </p>
                          <p className="truncate text-xs text-muted">{r.area}</p>
                        </div>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                          {fmt(r.points)}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <PaginationBar
                    page={boardPage}
                    pageSize={boardPageSize}
                    totalCount={filteredOffline.length}
                    onPageChange={setBoardPage}
                    itemLabel="tài khoản"
                  />
                </>
              )
            })()}
          </section>
        </>
      )}
    </div>
  )
}