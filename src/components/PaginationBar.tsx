import { useMemo } from "react"

export const FIXED_PAGE_SIZE = 10

export interface PaginationBarProps {
  page: number
  pageSize?: number
  totalCount: number
  onPageChange: (nextPage: number) => void
  itemLabel?: string
  className?: string
}

/** Tiện ích cắt mảng dùng chung cho danh sách nhỏ hoặc chế độ ngoại tuyến. */
export function paginateItems<T>(
  items: readonly T[],
  page: number,
  pageSize: number = FIXED_PAGE_SIZE,
): T[] {
  const safeSize = Math.max(1, pageSize)
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize))
  const safePage = Math.max(1, Math.min(page, totalPages))
  const start = (safePage - 1) * safeSize
  return items.slice(start, start + safeSize)
}

/** Chuẩn hoá metadata phân trang từ cả PagedResult (totalRecords/pageNumber) và GamPagedResult (totalCount/page). */
export function extractPagedMeta(raw: {
  page?: number
  pageNumber?: number
  pageSize?: number
  totalCount?: number
  totalRecords?: number
  totalPages?: number
}) {
  const page = Math.max(1, raw.page ?? raw.pageNumber ?? 1)
  const pageSize = Math.max(1, raw.pageSize ?? FIXED_PAGE_SIZE)
  const totalCount = Math.max(0, raw.totalCount ?? raw.totalRecords ?? 0)
  const totalPages = Math.max(1, raw.totalPages ?? (Math.ceil(totalCount / pageSize) || 1))
  return { page, pageSize, totalCount, totalPages }
}

/** Thanh phân trang chuẩn toàn hệ thống EcoLink (cố định 10 mục/trang). */
export default function PaginationBar({
  page,
  pageSize = FIXED_PAGE_SIZE,
  totalCount,
  onPageChange,
  itemLabel = "mục",
  className = "",
}: PaginationBarProps) {
  const safeSize = Math.max(1, pageSize)
  const totalPages = Math.max(1, Math.ceil(totalCount / safeSize))
  const current = Math.max(1, Math.min(page, totalPages))

  const pageTokens = useMemo<(number | "ellipsis-left" | "ellipsis-right")[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1)
    }
    const tokens: (number | "ellipsis-left" | "ellipsis-right")[] = [1]
    const winStart = Math.max(2, current - 1)
    const winEnd = Math.min(totalPages - 1, current + 1)
    if (winStart > 2) tokens.push("ellipsis-left")
    for (let p = winStart; p <= winEnd; p++) tokens.push(p)
    if (winEnd < totalPages - 1) tokens.push("ellipsis-right")
    tokens.push(totalPages)
    return tokens
  }, [current, totalPages])

  if (totalCount === 0) return null

  return (
    <div
      className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 text-xs text-body ${className}`}
    >
      <p className="tabular-nums text-muted">
        Tổng <span className="font-semibold text-ink">{totalCount.toLocaleString("vi-VN")}</span>{" "}
        {itemLabel} · Trang{" "}
        <span className="font-semibold text-ink">
          {current}/{totalPages}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2">

        <nav aria-label="Điều hướng phân trang" className="flex items-center gap-1">
          <button
            type="button"
            disabled={current <= 1}
            onClick={() => onPageChange(current - 1)}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white px-3 text-xs font-semibold text-body transition-colors hover:bg-surface-2 disabled:opacity-45"
          >
            Trước
          </button>

          {pageTokens.map((tok) =>
            typeof tok === "number" ? (
              <button
                key={tok}
                type="button"
                aria-current={tok === current ? "page" : undefined}
                onClick={() => onPageChange(tok)}
                className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold tabular-nums transition-colors ${
                  tok === current
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-white text-body hover:bg-surface-2"
                }`}
              >
                {tok}
              </button>
            ) : (
              <span key={tok} className="inline-flex h-9 items-center px-1 text-muted select-none">
                …
              </span>
            ),
          )}

          <button
            type="button"
            disabled={current >= totalPages}
            onClick={() => onPageChange(current + 1)}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white px-3 text-xs font-semibold text-body transition-colors hover:bg-surface-2 disabled:opacity-45"
          >
            Sau
          </button>
        </nav>
      </div>
    </div>
  )
}
