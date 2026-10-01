import { useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { PORTAL_NAV } from "@/data/portal"
import { ROLE_LABEL, signOut, useSession, type Role } from "@/lib/session"

/** Khung chung cho 4 vai trò sau đăng nhập: sidebar điều hướng + tiêu đề.
 *
 *  Sidebar ẩn dưới `lg` thay vì có drawer: các màn hình sau đăng nhập đều dùng
 *  bảng và biểu mẫu, người dùng chủ yếu ở desktop. Ở mobile hiện thanh cuộn
 *  ngang ở đầu trang — 4 mục trở xuống vẫn bấm được. */
export default function Portal({ role }: { role: Role }) {
  const session = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const logout = () => {
    signOut()
    navigate("/")
  }

  return (
    <div className="flex min-h-[calc(100dvh-70px)] flex-col md:min-h-[calc(100dvh-76px)]">
      <div className="border-b border-line bg-white lg:hidden">
        <div className="page flex items-center gap-3 py-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="portal-nav"
            className="btn-ghost h-10 shrink-0 px-3 text-[13px]"
          >
            {open ? "Đóng" : "Menu"}
          </button>
          <p className="min-w-0 truncate text-sm font-bold text-ink">
            {session?.name} · {ROLE_LABEL[role]}
          </p>
        </div>
        {open && (
          <nav id="portal-nav" className="page flex flex-col gap-4 pb-4">
            {PORTAL_NAV[role].map((sec) => (
              <Section key={sec.title} title={sec.title} role={role} />
            ))}
          </nav>
        )}
      </div>

      <div className="page flex flex-1 gap-8 py-6 lg:py-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">
            <p className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
              <span className="block truncate text-sm font-bold text-ink">
                {session?.name ?? "Khách"}
              </span>
              <span className="block text-xs text-muted">{ROLE_LABEL[role]}</span>
            </p>
            <nav aria-label="Điều hướng khu vực" className="mt-4">
              {PORTAL_NAV[role].map((sec) => (
                <Section key={sec.title} title={sec.title} role={role} />
              ))}
            </nav>
            <button
              type="button"
              onClick={logout}
              className="mt-6 w-full rounded-lg border border-sage-line px-3 py-2 text-[13px] font-semibold text-body transition-colors hover:bg-surface-2"
            >
              Đăng xuất
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Section({ title, role }: { title: string; role: Role }) {
  const items = PORTAL_NAV[role].find((s) => s.title === title)?.items ?? []
  return (
    <div className="mb-5">
      {/* Tiêu đề nhóm trong sidebar: màu chủ đạo, to và đậm hơn để tách khỏi
          danh sách mục bên dưới. Dùng đúng sắc `brand` như `.eyebrow` để
          không tự chế ra một sắc xanh thứ hai trong cùng app. */}
      <h2 className="px-3 text-[13px] font-bold tracking-[0.12em] text-brand uppercase">
        {title}
      </h2>
      <ul className="mt-1.5 flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to.split("/").length <= 2}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-[13px] leading-5 font-medium transition-colors ${
                  isActive
                    ? "bg-brand/10 text-brand-deep"
                    : "text-body hover:bg-surface-2 hover:text-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Tiêu đề trang dùng chung cho mọi màn hình sau đăng nhập: eyebrow + h1 +
 *  mô tả. Mô tả nói việc người dùng làm được ở đây, không lặp lại tên menu. */
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
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-1.5 text-[24px] leading-8 md:text-[28px] md:leading-9">
          {title}
        </h1>
        <p className="mt-2 max-w-[68ch] text-sm leading-6 text-body">{body}</p>
      </div>
      {action}
    </header>
  )
}

/** Kiểu hiển thị của số liệu.
 *
 *  `plain` chữ trên nền sáng, dùng cho trang công khai.
 *  `brand` khối sáng có màu, dùng MỘT lần trên mỗi trang cho dải số liệu tổng
 *          quan. Đây là ngoại lệ "một bề mặt được phép mang màu" của luật thiết
 *          kế sản phẩm — trang trắng phẳng thì số liệu không dẫn mắt, mà tô
 *          cả 4 số thành xanh thì lại mất thứ bậc và trông như bảng quảng cáo.
 *
 *  Bản đầu tô dùng nền `brand-deep` xanh đậm, người dùng bảo trông nặng và
 *  không có chút sáng nào. Nay lùi lại về lõi TRẮNG, chỉ để lớp vỏ ngoài
 *  mang màu: sáng mà vẫn có chủ đề. Chữ trên nền trắng dùng `brand` (4,57:1)
 *  và `brand-deep` (7,0:1) — cả hai đạt WCAG AA. */
export type StatTone = "plain" | "brand"

/** Ô số liệu.
 *
 *  KHÔNG viền 1px xám. Trước đây mỗi số liệu là một hộp `card` có viền, đặt
 *  cạnh nhau thành dãy 4 hộp giống hệt nhau — đúng cái "identical card grid"
 *  mà luật thiết kế cấm: nó toát ra "AI làm" và ăn chỗ trống của dữ liệu. Thay
 *  bằng khoảng trắng và bóng đổ rất mềm.
 *
 *  `unit` tách riêng khỏi `value` vì lý do thị giác: "214.500 kg" gộp chung
 *  làm con số dài ra ngang với "1.842.000.000", cả hàng lệch nhau. Để đơn vị
 *  thành chữ nhỏ mảnh đi, các số cùng cỡ và đọc thành một hàng.
 *
 *  `note` vẫn giữ vì vài trang dùng; trang nào không cần thì đừng truyền —
 *  ba dòng chữ ở ba cỡ trong một ô làm rối. */
export function Stat({
  label,
  value,
  unit,
  note,
  tone = "plain",
}: {
  label: string
  value: string
  unit?: string
  note?: string
  tone?: StatTone
}) {
  const onBrand = tone === "brand"
  return (
    <div className="min-w-0">
      <p
        className={`text-[11px] font-semibold tracking-[0.1em] uppercase ${
          onBrand ? "text-brand" : "text-muted"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1.5 flex items-baseline gap-1.5 font-bold tracking-tight ${
          onBrand ? "text-[26px] leading-9 xl:text-[28px]" : "text-2xl leading-8"
        } text-ink`}
      >
        <span className="tabular-nums">{value}</span>
        {unit && (
          <span
            className={`text-sm font-semibold ${
              onBrand ? "text-brand-deep" : "text-muted"
            }`}
          >
            {unit}
          </span>
        )}
      </p>
      {note && <p className="mt-1 text-[13px] leading-5 text-muted">{note}</p>}
    </div>
  )
}

/** Hàng số liệu.
 *
 *  `plain` chỉ kẻ dưới: `PageHead` đã có đường kẻ riêng ở trên, thêm một
 *  đường nữa thì hai kẻ cách nhau chừng 30px và nhìn như vẽ nhầm.
 *
 *  `brand` dùng kiểu **Double-Bezel**: lớp vỏ ngoài bo tròn lớn, màu mint
 *  nhạt và một vòng mảnh; lõi trong là mặt trắng bo tròn nhỏ hơn đúng bằng
 *  lớp vỏ trừ đi lớp đệm, nên hai đường viền song song đồng tâm. Bóng đổ
 *  lan to và nhạt (`-28px` blur-offset) chứ không phải bóng đen cứng — bóng
 *  cứng là thứ làm giao diện trông rẻ. */
export function StatRow({
  children,
  tone = "plain",
}: {
  children: React.ReactNode
  tone?: StatTone
}) {
  // Cột KHÔNG chia đều: "1.842.000.000 ₫" dài hơn hẳn "1.284", chia đều thì
  // đơn vị rớt xuống dòng. Bề rộng cột đặt theo độ dài nội dung, cố định theo
  // thứ tự số liệu nên vẫn thẳng hàng chứ không phải bố cục tùy ý.
  const grid =
    "grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-[1fr_0.8fr_1.15fr_1.5fr]"
  return tone === "brand" ? (
    <div className="rounded-[1.75rem] bg-mint/30 p-1.5 ring-1 ring-brand/12">
      <div
        className={`${grid} rounded-[1.5rem] bg-white px-6 py-7 shadow-[0_28px_56px_-30px_rgba(15,31,21,0.28)] md:px-7`}
      >
        {children}
      </div>
    </div>
  ) : (
    <div className={`${grid} border-b border-line-soft pb-6`}>{children}</div>
  )
}

/** Khung bảng dữ liệu: tiêu đề cột + nội dung. Bọc trong `overflow-x-auto` ở
 *  nơi dùng vì bảng rộng hơn màn hình trên mobile. */
export function Table({
  head,
  children,
}: {
  head: readonly string[]
  children: React.ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2">
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase"
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
  return <td className={`px-4 py-3 align-top text-body ${className}`}>{children}</td>
}

/** Nhãn trạng thái. Chỉ một hệ màu xanh như phần còn lại của app: mức độ
 *  đậm nhạt phân biệt trạng thái, không thêm màu đỏ/vàng. */
export function Status({ tone, children }: { tone: "todo" | "wait" | "ok" | "off"; children: React.ReactNode }) {
  const cls = {
    todo: "bg-surface-3 text-body",
    wait: "bg-mint/25 text-brand-deep",
    ok: "bg-brand text-white",
    off: "bg-surface-2 text-muted",
  }[tone]
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      {children}
    </span>
  )
}

/** Khối "chưa có gì" — dùng thay cho danh sách rỗng. */
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="card px-5 py-8 text-center text-sm leading-6 text-muted">
      {children}
    </p>
  )
}

/** Trường biểu mẫu: nhãn + control + gợi ý. Bọc <label> thật nên bàn phím
 *  chuyển vòng qua các ô bằng Tab là tự động. */
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
    <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
      {label}
      {children}
      {hint && <span className="text-[12px] font-normal text-muted">{hint}</span>}
    </label>
  )
}