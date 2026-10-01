import { useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { PORTAL_NAV } from "@/data/portal"
import { ROLE_LABEL, signOut, useSession } from "@/lib/session"

/** Khung riêng của khu vực quản trị.
 *
 *  CỐ TÌNH không dùng `Layout` của app công khai: trang quản trị là một sản
 *  phẩm khác, không phải một trang trong app của người dân. Dùng chung khung thì
 *  nó mặc navbar bán hàng, tab-bar điều hướng và footer của người dùng — cả ba
 *  đều không liên quan tới việc ra quyết định cấu hình hệ thống.
 *
 *  Khác biệt nhìn thấy được ngay:
 *  - không có navbar công khai, không có footer, không có thanh tab dưới
 *  - thanh trên cố định 56px (thấp hơn navbar 76px) để nhường chỗ cho dữ liệu
 *  - sidebar 232px, dùng chung bề rộng cho mọi trang admin nên khi đổi trang
 *    nội dung không nhảy
 *  - không cuộn trang: sidebar `sticky` riêng, thanh trên `sticky` riêng */
export default function AdminShell() {
  const session = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const logout = () => {
    signOut()
    navigate("/login")
  }

  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-40 h-14 border-b border-line-soft bg-white/90 backdrop-blur-xl">
        <div className="flex h-full items-center gap-3 px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="admin-nav"
            className="grid size-9 place-items-center rounded-lg text-ink transition-colors hover:bg-surface-2 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <span className="sr-only">Mở menu quản trị</span>
          </button>

          <img src="/assets/brand/logo1.png" alt="EcoLink" className="h-7 w-auto" />
          <span className="rounded-md bg-brand/10 px-2 py-1 text-[11px] font-bold tracking-[0.1em] text-brand uppercase">
            Console
          </span>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[13px] text-muted sm:block">
              {session?.name}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-body transition-colors hover:bg-surface-2"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-58 shrink-0 border-r border-line-soft bg-white">
          <nav
            id="admin-nav"
            aria-label="Điều hướng quản trị"
            className={`${open ? "block" : "hidden"} lg:sticky lg:top-14 lg:block lg:max-h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:px-4 lg:py-6`}
          >
            {PORTAL_NAV.admin.map((sec) => (
              <div key={sec.title} className="px-4 pb-5 lg:px-0">
                <h2 className="px-3 text-[11px] font-bold tracking-[0.12em] text-brand uppercase">
                  {sec.title}
                </h2>
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {sec.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to.split("/").length <= 2}
                        className={({ isActive }) =>
                          `block rounded-md px-3 py-2 text-[13px] leading-5 font-medium transition-colors ${
                            isActive
                              ? "bg-brand text-white"
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
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      <p className="px-4 pb-6 text-[12px] text-muted lg:px-8">
        Đang đăng nhập với tài khoản {session?.name} · {ROLE_LABEL.admin}
      </p>
    </div>
  )
}