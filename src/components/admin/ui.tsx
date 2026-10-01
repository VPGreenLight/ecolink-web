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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-[0.14em] text-brand uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-xl leading-7 font-bold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-1.5 max-w-[68ch] text-[13px] leading-5 text-muted">
          {body}
        </p>
      </div>
      {action}
    </header>
  )
}

/** Dải số liệu tổng quan. Lõi trắng trong vỏ mint (double-bezel) để sáng và có
 *  chủ đề mà không thành một tấm xanh đậm nặng nề. */
export function StatRow({ children }: { children: React.ReactNode }) {
  // Cột không chia đều: "1.842.000.000 ₫" dài hơn hẳn "1.284", chia đều thì
  // đơn vị rớt xuống dòng. Bề rộng cột đặt theo độ dài nội dung.
  const grid =
    "grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-[1fr_0.8fr_1.15fr_1.5fr]"
  return (
    <div className="mb-6 rounded-2xl bg-mint/30 p-1.5 ring-1 ring-brand/12">
      <div
        className={`${grid} rounded-xl bg-white px-5 py-6 shadow-[0_24px_48px_-28px_rgba(15,31,21,0.26)]`}
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
}: {
  label: string
  value: string
  unit?: string
  note?: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold tracking-[0.1em] text-brand uppercase">
        {label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-1.5 text-[26px] leading-9 font-bold tracking-tight text-ink xl:text-[28px]">
        <span className="tabular-nums">{value}</span>
        {unit && (
          <span className="text-sm font-semibold text-brand-deep">{unit}</span>
        )}
      </p>
      {note && <p className="mt-1 text-[13px] leading-5 text-muted">{note}</p>}
    </div>
  )
}

/** Bảng dữ liệu của console: KHÔNG bọc khung bo tròn như bảng của khu vực
 *  người dân. Bảng console thường dài và nhiều cột, viền bao quanh chỉ thêm
 *  một vòng nữa mà không giúp gì — dùng đường kẻ hàng ngang để mắt đọc theo
 *  cột dễ hơn. */
export function Table({
  head,
  children,
}: {
  head: readonly string[]
  children: React.ReactNode
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-3 py-2.5 text-[10px] font-bold tracking-[0.1em] text-muted uppercase"
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
    <td className={`px-3 py-2.5 align-middle text-[13px] text-body ${className}`}>
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

/** Trường biểu mẫu: nhãn uppercase 11px như tiêu đề cột của bảng, để cả trang
 *  nhìn như một hệ thống. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">
        {label}
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