import { useEffect, useState } from "react"
import { PageHead, Field, FormRequiredLegend, Status } from "@/components/Portal"
import SearchFilterBar from "@/components/SearchFilterBar"
import PaginationBar, { FIXED_PAGE_SIZE } from "@/components/PaginationBar"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { ECO_FACTS, type EcoFact } from "@/data/ops"
import { ApiError } from "@/lib/api"
import { initApiLoading, isSsrSmokeTest } from "@/lib/hydration"
import { hasLiveBackendAuth } from "@/lib/session"
import {
  createStaffEcoFact,
  deleteStaffEcoFact,
  fetchStaffEcoFacts,
  setStaffEcoFactStatus,
  updateStaffEcoFact,
  type EcoFactItemDto,
} from "@/lib/gamificationApi"

/** S-09 Quản lý nội dung Eco Fact. */
export default function EcoFacts() {
  const [liveMode] = useState(() => !isSsrSmokeTest())
  const [offlineList, setOfflineList] = useState<EcoFact[]>(ECO_FACTS)
  const [liveList, setLiveList] = useState<EcoFactItemDto[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 300)
  const [levelFilter, setLevelFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [page, setPage] = useState(1)
  const pageSize = FIXED_PAGE_SIZE
  const [loading, setLoading] = useState(() => initApiLoading(true))

  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [unlockLevel, setUnlockLevel] = useState(2)
  const [sourceUrl, setSourceUrl] = useState("")
  const [offlineCost, setOfflineCost] = useState(500)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState("")
  const [errMsg, setErrMsg] = useState("")

  const loadFacts = async () => {
    setLoading(true)
    try {
      const res = await fetchStaffEcoFacts({
        treeLevel: levelFilter ? Number(levelFilter) : undefined,
        status: statusFilter || undefined,
        search: debouncedSearch.trim() || undefined,
        page,
        pageSize,
      })
      if (res.data?.items) {
        setLiveList(res.data.items)
        setTotalCount(res.data.totalCount ?? res.data.items.length)
      }
    } catch {
      // Giữ danh sách hiện có
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (liveMode) void loadFacts()
  }, [liveMode, levelFilter, statusFilter, debouncedSearch, page, pageSize])

  const resetForm = () => {
    setEditingId(null)
    setTitle("")
    setBody("")
    setUnlockLevel(2)
    setSourceUrl("")
  }

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrMsg("")
    setFlash("")
    const cleanTitle = title.trim()
    const cleanBody = body.trim()
    const cleanSource = sourceUrl.trim()

    if (cleanTitle.length < 3 || cleanTitle.length > 150) {
      setErrMsg("Tiêu đề Eco Fact phải từ 3 đến 150 ký tự.")
      return
    }
    if (cleanBody.length < 10 || cleanBody.length > 1000) {
      setErrMsg("Nội dung Eco Fact phải từ 10 đến 1000 ký tự.")
      return
    }
    if (!Number.isInteger(unlockLevel) || unlockLevel < 1 || unlockLevel > 10) {
      setErrMsg("Mốc cấp Cây Ảo mở khóa phải từ cấp 1 đến cấp 10.")
      return
    }
    if (cleanSource && !/^https?:\/\/.+/i.test(cleanSource)) {
      setErrMsg("URL nguồn tham khảo phải bắt đầu bằng http:// hoặc https://.")
      return
    }

    if (!liveMode && !hasLiveBackendAuth()) {
      const id = `EF-${String(offlineList.length + 1).padStart(2, "0")}`
      setOfflineList((ls) => [
        ...ls,
        { id, title: cleanTitle, body: cleanBody, cost: offlineCost, open: false },
      ])
      setTitle("")
      setBody("")
      setFlash(`Đã thêm ${id}. Nội dung mới mở sau khi người dùng đủ điểm.`)
      return
    }

    if (busy) return
    setBusy(true)
    try {
      const payload = {
        title: cleanTitle,
        content: cleanBody,
        unlockTreeLevel: unlockLevel,
        sourceUrl: cleanSource || null,
      }
      if (editingId) {
        await updateStaffEcoFact(editingId, payload)
        setFlash("Đã cập nhật Eco Fact.")
      } else {
        const res = await createStaffEcoFact(payload)
        setFlash(`Đã thêm ${res.data?.code ?? "Eco Fact mới"}.`)
      }
      resetForm()
      await loadFacts()
    } catch (err) {
      setErrMsg(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Lưu Eco Fact thất bại.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="NỘI DUNG"
        title="Quản lý Eco Fact"
        body="Kiến thức ngắn gắn với cấp độ cây ảo: người dùng mở khoá khi cây đạt cấp tương ứng. Nội dung chuẩn xác giúp lan tỏa thói quen phân loại đúng."
      />

      <form onSubmit={(e) => void submitForm(e)} noValidate className="card flex flex-col gap-5 p-5 md:p-6">
        <FormRequiredLegend />
        {editingId && (
          <div className="flex items-center justify-between rounded-lg bg-brand/6 px-3.5 py-2 text-xs font-semibold text-brand-deep">
            <span>Đang chỉnh sửa Eco Fact</span>
            <button type="button" onClick={resetForm} className="text-muted hover:text-ink">
              Huỷ sửa
            </button>
          </div>
        )}

        <Field label="Tiêu đề kiến thức" required>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Vì sao nắp nhựa phải tách riêng"
          />
        </Field>

        <Field label="Nội dung" required hint="Từ 10 đến 1000 ký tự. Ghi rõ số liệu và tác động môi trường.">
          <textarea
            className="input h-auto resize-y py-3 leading-6"
            rows={3}
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              setErrMsg("")
            }}
          />
        </Field>

        {liveMode ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mốc cấp Cây Ảo mở khoá" required hint="Từ cấp 1 trở lên theo cấu hình A-07.">
              <input
                className="input w-40 tabular-nums"
                type="number"
                min={1}
                max={10}
                value={unlockLevel}
                onChange={(e) => setUnlockLevel(Number(e.target.value))}
              />
            </Field>
            <Field label="URL nguồn tham khảo (tuỳ chọn)">
              <input
                className="input"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
              />
            </Field>
          </div>
        ) : (
          <Field label="Điểm cần để mở" required hint="Số điểm tiêu dùng, tức là sẽ bị trừ một lần khi mở.">
            <input
              className="input w-40 tabular-nums"
              type="number"
              min={0}
              step={100}
              value={offlineCost}
              onChange={(e) => setOfflineCost(Number(e.target.value))}
            />
          </Field>
        )}

        {errMsg && (
          <p
            role="alert"
            className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn"
          >
            {errMsg}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button type="submit" disabled={busy} className="btn-primary h-11 px-6">
            {busy ? "Đang lưu..." : editingId ? "Cập nhật Eco Fact" : "Thêm Eco Fact"}
          </button>
          {flash && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {flash}
            </p>
          )}
        </div>
      </form>

      {liveMode ? (
        <section className="flex flex-col gap-4">
          <SearchFilterBar
            label="Tìm kiếm Eco Fact"
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
            placeholder="Tiêu đề Eco Fact..."
            totalCount={totalCount}
            countLabel="Eco Fact"
          >
            <select
              className="input h-9 text-xs"
              value={levelFilter}
              onChange={(e) => {
                setLevelFilter(e.target.value)
                setPage(1)
              }}
              aria-label="Lọc theo cấp cây"
            >
              <option value="">Tất cả cấp cây</option>
              {[1, 2, 3, 4, 5, 6].map((lv) => (
                <option key={lv} value={String(lv)}>
                  Cấp {lv}
                </option>
              ))}
            </select>
            <select
              className="input h-9 text-xs"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              aria-label="Lọc theo trạng thái"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang bật</option>
              <option value="INACTIVE">Đang tắt</option>
            </select>
          </SearchFilterBar>

          {loading && liveList.length === 0 ? (
            <p className="text-sm text-muted">Đang tải danh sách Eco Fact...</p>
          ) : (
            <>
              <ul className="grid gap-4 md:grid-cols-2">
                {liveList.map((f) => {
                  const active = f.status === "ACTIVE"
                  return (
                    <li key={f.id} className="card flex flex-col gap-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-brand">{f.code}</p>
                          <h2 className="text-base leading-6 font-bold text-ink">{f.title}</h2>
                        </div>
                        <Status tone={active ? "ok" : "off"}>
                          {active ? "Đang bật" : "Đang tắt"}
                        </Status>
                      </div>
                      <p className="text-[13px] leading-5 text-body">{f.content}</p>
                      <p className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3 text-[13px]">
                        <span className="tabular-nums text-muted">
                          Mở ở Cây Cấp {f.unlockTreeLevel}
                        </span>
                        <span className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(f.id)
                              setTitle(f.title)
                              setBody(f.content)
                              setUnlockLevel(f.unlockTreeLevel)
                              setSourceUrl(f.sourceUrl ?? "")
                              window.scrollTo({ top: 0, behavior: "smooth" })
                            }}
                            className="font-semibold text-brand-deep hover:underline"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await setStaffEcoFactStatus(f.id, active ? "INACTIVE" : "ACTIVE")
                                setFlash(`Đã chuyển ${f.code} sang ${active ? "INACTIVE" : "ACTIVE"}.`)
                                setErrMsg("")
                                await loadFacts()
                              } catch (err) {
                                setErrMsg(err instanceof Error ? err.message : "Thao tác thất bại.")
                              }
                            }}
                            className="font-semibold text-brand hover:text-brand-deep"
                          >
                            {active ? "Tắt" : "Bật"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await deleteStaffEcoFact(f.id)
                                setFlash(`Đã xoá / gỡ ${f.code}.`)
                                setErrMsg("")
                                await loadFacts()
                              } catch (err) {
                                setErrMsg(err instanceof Error ? err.message : "Không thể xoá.")
                              }
                            }}
                            className="font-semibold text-warn hover:underline"
                          >
                            Xoá
                          </button>
                        </span>
                      </p>
                    </li>
                  )
                })}
              </ul>
              <PaginationBar
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
                itemLabel="Eco Fact"
              />
            </>
          )}
        </section>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {offlineList.map((f) => (
            <li key={f.id} className="card flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-brand">{f.id}</p>
                  <h2 className="text-base leading-6 font-bold text-ink">{f.title}</h2>
                </div>
                <Status tone={f.open ? "ok" : "off"}>{f.open ? "Đang mở" : "Đang khoá"}</Status>
              </div>
              <p className="text-[13px] leading-5 text-body">{f.body}</p>
              <p className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3 text-[13px]">
                <span className="tabular-nums text-muted">
                  {f.cost.toLocaleString("vi-VN")} điểm để mở
                </span>
                <span className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setOfflineList((ls) =>
                        ls.map((x) => (x.id === f.id ? { ...x, open: !x.open } : x)),
                      )
                    }
                    className="font-semibold text-brand hover:text-brand-deep"
                  >
                    {f.open ? "Khoá" : "Mở miễn phí"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOfflineList((ls) => ls.filter((x) => x.id !== f.id))
                      setFlash(`Đã xoá ${f.id}.`)
                    }}
                    className="font-semibold text-warn hover:underline"
                  >
                    Xoá
                  </button>
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
