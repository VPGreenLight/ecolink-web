import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { X } from "lucide-react"
import { PORTAL_NAV } from "@/data/portal"
import { ROLE_LABEL, signOut, useSession, type Role } from "@/lib/session"
import ConfirmLogoutDialog from "@/components/ConfirmLogoutDialog"

/** Khung chung cho 4 vai trò sau đăng nhập: sidebar điều hướng + drawer mobile. */
export default function Portal({ role }: { role: Role }) {
  const session = useSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  const logout = () => {
    setConfirmLogout(true)
  }

  const handleConfirmLogout = () => {
    signOut()
    setConfirmLogout(false)
    navigate("/")
  }

  const isRecycler = role === "recycler"

  return (
    <div className="flex min-h-[calc(100dvh-70px)] flex-col md:min-h-[calc(100dvh-76px)]">
      <div
        className={`h-14 border-b border-line-soft bg-white/95 backdrop-blur-xl lg:hidden ${
          isRecycler ? "sticky top-[70px] z-30 md:top-[76px]" : ""
        }`}
      >
        <div className="flex h-full items-center gap-2.5 px-3 sm:gap-3 sm:px-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="portal-nav"
            className="grid size-10 shrink-0 place-items-center rounded-lg text-ink transition-colors hover:bg-surface-2"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <span className="sr-only">Mở menu</span>
          </button>

          <span className="shrink-0 rounded-md bg-brand/10 px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-brand uppercase sm:text-[11px]">
            {ROLE_LABEL[role]}
          </span>

          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
            {session?.name ?? "Khách"}
          </p>
        </div>
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {open && (
        <aside
          aria-label="Menu điều hướng di động"
          className="fixed inset-y-0 left-0 z-[70] flex w-72 max-w-[85vw] flex-col border-r border-line-soft bg-white shadow-2xl lg:hidden"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line-soft px-4">
            <div className="flex items-center gap-2">
              <img src="/assets/brand/logo1.png" alt="EcoLink" className="h-6 w-auto" />
              <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-brand uppercase">
                {ROLE_LABEL[role]}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng menu"
              className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="border-b border-line-soft bg-surface-2/50 px-4 py-2.5">
            <p className="truncate text-sm font-bold text-ink">{session?.name ?? "Khách"}</p>
          </div>

          <nav id="portal-nav" className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            {PORTAL_NAV[role].map((sec) => (
              <Section
                key={sec.title}
                title={sec.title}
                role={role}
                variant="drawer"
                onNavigate={() => setOpen(false)}
              />
            ))}
          </nav>

          {role !== "user" && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                logout()
              }}
              className="mx-4 mt-auto mb-4 min-h-11 w-[calc(100%-2rem)] shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-800"
            >
              Đăng xuất
            </button>
          )}
        </aside>
      )}

      <div className="page flex flex-1 gap-8 py-6 lg:py-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div
            className={
              isRecycler
                ? "lg:fixed lg:top-[100px] lg:max-h-[calc(100dvh-7.5rem)] lg:w-56 lg:overflow-y-auto"
                : "sticky top-24"
            }
          >
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
            {role !== "user" && (
              <button
                type="button"
                onClick={logout}
                className="mt-6 w-full rounded-lg border border-sage-line px-3 py-2 text-[13px] font-semibold text-body transition-colors hover:bg-surface-2"
              >
                Đăng xuất
              </button>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      <ConfirmLogoutDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleConfirmLogout}
        userName={session?.name}
      />
    </div>
  )
}

function Section({
  title,
  role,
  variant = "sidebar",
  onNavigate,
}: {
  title: string
  role: Role
  variant?: "sidebar" | "drawer"
  onNavigate?: () => void
}) {
  const items = PORTAL_NAV[role].find((s) => s.title === title)?.items ?? []
  return (
    <div className="mb-5">
      {/* Tiêu đề nhóm trong sidebar: màu chủ đạo, to và đậm hơn để tách khỏi
          danh sách mục bên dưới. Dùng đúng sắc `brand` như `.eyebrow` để
          không tự chế ra một sắc xanh thứ hai trong cùng app. */}
      <h2
        className={`px-3 font-bold tracking-[0.12em] text-brand uppercase ${
          variant === "drawer" ? "text-[11px]" : "text-[13px]"
        }`}
      >
        {title}
      </h2>
      <ul className="mt-1.5 flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to.split("/").length <= 2}
              onClick={onNavigate}
              className={({ isActive }) =>
                variant === "drawer"
                  ? `flex min-h-10 items-center rounded-md px-3 py-2 text-sm leading-5 font-medium transition-colors ${
                      isActive
                        ? "bg-brand text-white"
                        : "text-body hover:bg-surface-2 hover:text-ink"
                    }`
                  : `block rounded-lg px-3 py-2.5 text-[14px] leading-5 font-medium transition-colors ${
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
  eyebrow?: string
  title: string
  body?: string
  action?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="display mt-1.5 text-[24px] leading-8 md:text-[28px] md:leading-9">
          {title}
        </h1>
        {body && <p className="mt-2 max-w-[68ch] text-[15px] leading-6 text-body">{body}</p>}
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
        className={`text-xs font-semibold tracking-[0.1em] uppercase ${
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
      {note && <p className="mt-1 text-sm leading-5 text-muted">{note}</p>}
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
                className="px-4 py-2.5 text-xs font-semibold tracking-[0.08em] text-muted uppercase sm:text-[13px]"
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
  return <td className={`px-4 py-3 align-top text-sm text-body ${className}`}>{children}</td>
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

export function RequiredMark() {
  return (
    <span
      className="ml-1 font-bold text-red-600"
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

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="card flex flex-col gap-2.5 p-5">
          <div className="h-4 w-2/5 animate-pulse rounded bg-surface-3" />
          <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface-2" />
        </div>
      ))}
    </div>
  )
}

/** Trường biểu mẫu: nhãn + control + gợi ý. Bọc <label> thật nên bàn phím
 *  chuyển vòng qua các ô bằng Tab là tự động. */
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
    <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
      <span>
        {label}
        {required && <RequiredMark />}
      </span>
      {children}
      {hint && <span className="text-[12px] font-normal text-muted">{hint}</span>}
    </label>
  )
}