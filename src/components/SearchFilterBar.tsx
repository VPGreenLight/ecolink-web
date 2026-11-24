import { useId, type ReactNode } from "react"
import { Search, X } from "lucide-react"

export interface SearchFilterBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  totalCount?: number
  countLabel?: string
  children?: ReactNode
  className?: string
}

/** Thanh tìm kiếm & bộ lọc dùng chung trên các màn hình danh sách/bảng.
 *
 *  Bố cục: nhãn + số lượng ở trên, ô tìm kiếm (co giãn) và bộ lọc nằm cùng
 *  một hàng bên dưới. Nhờ vậy control cao thấp khác nhau vẫn căn giữa, không
 *  bị lệch đáy như khi dùng `items-end`. */
export default function SearchFilterBar({
  value,
  onChange,
  placeholder = "Tìm kiếm...",
  label = "Tìm kiếm",
  totalCount,
  countLabel = "kết quả",
  children,
  className = "",
}: SearchFilterBarProps) {
  const inputId = useId()

  return (
    <div
      className={`rounded-2xl border border-line-soft bg-surface-2/60 p-3.5 sm:p-4 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <label htmlFor={inputId} className="text-[13px] font-semibold text-ink">
          {label}
        </label>
        {typeof totalCount === "number" && (
          <p className="text-xs font-medium tabular-nums text-muted">
            {totalCount.toLocaleString("vi-VN")} {countLabel}
          </p>
        )}
      </div>

      <div className="mt-2.5 flex flex-col gap-2.5 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          />
          <input
            id={inputId}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="input pr-9 pl-9"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Xóa từ khóa tìm kiếm"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted hover:bg-surface-3 hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {children && (
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        )}
      </div>
    </div>
  )
}