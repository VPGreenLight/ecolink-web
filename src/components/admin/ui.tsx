/** Bộ component RIÊNG của khu vực quản trị.
 *
 *  Cố tình trùng TÊN với component trong `@/components/Portal` (PageHead, Stat,
 *  Table, Td, Status, Field, Empty) nhưng là kiểm khác: đổi cái import trong
 *  từng trang là xong, không phải sửa lại JSX của cả 11 trang.
 *
 *  Khác biệt so với bản dùng cho khu vực người dân:
 *
 *  |           | khu vực người dân        | console quản trị          |
 *  |-----------|---------------------------|--------------------------|
 *  | tiêu đề  | `.display` xanh 28px      | chữ ink 20px, xanh chỉ ở eyebrow |
 *  | bảng      | trong khung bo tròn có viền| không khung, gọn, số tabular |
 *  | nút       | pill bo tròn             | bo góc vừa, đều chiều cao |
 *  | nhãn      | 13px đậm                | 11px uppercase xám       |
 *  | badge     | pill tròn                | bo góc nhẹ               |
 *
 *  Quy tắc của riêng khu vực quản trị: CHỮ vẫn là chữ của trang công khai
 *  (chỉ đổi cỡ và mật độ) chứ không đổi mặt chữ — đổi mặt chữ theo từng
 *  khu vực thì người dùng phải học lại đọc mỗi lần chuyển trang.
 */

export function PageHead({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <header className="mb-2 flex flex-col gap-4 border-b border-line/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold tracking-[0.14em] text-brand uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-xl leading-7 font-bold tracking-tight text-ink sm:text-[24px] sm:leading-8">
          {title}
        </h1>
        <p className="mt-1.5 max-w-[68ch] text-sm leading-6 text-muted">
          {body}
        </p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

/** Dải số liệu tổng quan theo cấu trúc Double-Bezel + chia cột mượt trên desktop/mobile. */
export function StatRow({ children }: { children: React.ReactNode }) {
  const grid =
    "grid gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_0.85fr_1.15fr_1.45fr] lg:divide-x lg:divide-line-soft"
  return (
    <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
      <div
        className={`${grid} rounded-2xl border border-line-soft bg-white p-5 shadow-[0_14px_34px_-16px_rgba(15,31,21,0.12)] sm:px-6`}
      >
        {children}
      </div>
    </div>
  )
}

export function Stat({
  label,
  value,
  unit,
  note,
  loading,
}: {
  label: string
  value: string
  unit?: string
  note?: string
  loading?: boolean
}) {
  return (
    <div className="min-w-0 lg:px-4 first:lg:pl-0 last:lg:pr-0">
      <p className="text-[11px] font-semibold tracking-[0.1em] text-brand uppercase">
        {label}
      </p>
      {loading ? (
        <span
          className="mt-2 block h-8 w-24 animate-pulse rounded-lg bg-surface-2"
          aria-label="Đang tải số liệu"
        />
      ) : (
        <p className="mt-1.5 flex items-baseline gap-1.5 text-2xl leading-8 font-bold tracking-tight text-ink xl:text-[26px] xl:leading-9">
          <span className="truncate whitespace-nowrap tabular-nums">{value}</span>
          {unit && (
            <span className="shrink-0 text-sm font-semibold text-brand-deep">{unit}</span>
          )}
        </p>
      )}
      {note && <p className="mt-1 text-xs leading-5 text-muted">{note}</p>}
    </div>
  )
}

/** Bảng dữ liệu của console: nền trắng sáng, viền mềm đồng bộ Double-Bezel & header tinh gọn. */
export function Table({
  head,
  children,
}: {
  head: readonly string[]
  children: React.ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line/80 bg-white shadow-[0_10px_28px_-16px_rgba(15,31,21,0.08)]">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2/65">
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-3 text-[11px] font-bold tracking-[0.08em] text-muted uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">{children}</tbody>
      </table>
    </div>
  )
}

export function Td({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <td className={`px-4 py-3 align-middle text-[13px] text-body ${className}`}>
      {children}
    </td>
  )
}

/** Nhãn trạng thái. Bo góc nhẹ, chữ 11px — dùng bo tròn pill ở bảng console thì
 *  nhìn như bảng giá bán lẻ, không phải công cụ vận hành. */
export function Status({
  tone,
  children,
}: {
  tone: "todo" | "wait" | "ok" | "off"
  children: React.ReactNode
}) {
  const cls = {
    todo: "bg-surface-3 text-ink",
    wait: "bg-brand/12 text-brand-deep",
    ok: "bg-brand text-white",
    off: "bg-surface-2 text-muted",
  }[tone]
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls}`}
    >
      {children}
    </span>
  )
}

export function RequiredMark() {
  return (
    <span
      className="ml-0.5 font-bold text-red-600"
      aria-hidden="true"
      title="Trường bắt buộc"
    >
      *
    </span>
  )
}

export function FormRequiredLegend({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted ${className}`}>
      Các trường có dấu <span className="font-bold text-red-600">*</span> là thông tin bắt buộc.
    </p>
  )
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card flex flex-col gap-3 p-5" aria-busy="true" aria-live="polite">
      <div className="h-4 w-48 animate-pulse rounded bg-surface-3" />
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="h-10 w-full animate-pulse rounded-lg bg-surface-2" />
      ))}
    </div>
  )
}

/** Trường biểu mẫu: nhãn uppercase 11px như tiêu đề cột của bảng, để cả trang
 *  nhìn như một hệ thống. */
export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] leading-4 font-bold tracking-[0.08em] text-muted uppercase">
        {label}
        {required && <RequiredMark />}
      </span>
      {children}
      {hint && <span className="text-[12px] leading-5 text-muted">{hint}</span>}
    </label>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
      {children}
    </p>
  )
}

/** Biểu đồ cột đứng, cho dãy số theo thời gian.
 *
 *  Vẽ bằng CSS chứ không cột SVG: cột là hình chữ nhật, CSS lo một việc mà SVG
 *  phải tự tính toạ độ cho từng điểm. Thêm tháng sau chỉ thêm phần tử vào mảng.
 *
 *  `value` nhận kèm số gốc chứ không nhận phần trăm — người đọc biểu đồ phải
 *  thấy đúng con số, không phải tỷ lệ quy về đỉnh. Tỷ lệ chỉ dùng cho CHIỀU
 *  CAO thanh, và chiều cao đó không có nghĩa nếu không ghi số tuyệt đối. */
export function ColumnChart({
  data,
  format = (n) => fmtNum(n),
  height = 168,
}: {
  data: readonly { label: string; value: number }[]
  format?: (n: number) => string
  height?: number
}) {
  const peak = Math.max(1, ...data.map((d) => d.value))

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5">
            <span className="text-center text-[11px] font-semibold tabular-nums text-muted">
              {format(d.value)}
            </span>
            <span
              className="w-full rounded-t-md bg-brand"
              style={{ height: `${Math.max((d.value / peak) * 100, 1.5)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-line-soft pt-2">
        {data.map((d) => (
          <span
            key={d.label}
            className="min-w-0 flex-1 truncate text-center text-[11px] text-muted"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

const fmtNum = (n: number) => n.toLocaleString("vi-VN")