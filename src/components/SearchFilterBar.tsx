import type { ReactNode } from "react"
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

/** Thanh tìm kiếm & bộ lọc dùng chung trên các màn hình danh sách/bảng. */
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
  return (
    <div
      className={`card flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between ${className}`}
    >
      <div className="min-w-0 flex-1">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
          <span>{label}</span>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="input w-full pr-9 pl-9"
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </label>
      </div>

      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}

      {typeof totalCount === "number" && (
        <p className="shrink-0 text-xs font-medium tabular-nums text-muted md:pb-2">
          {totalCount.toLocaleString("vi-VN")} {countLabel}
        </p>
      )}
    </div>
  )
}
