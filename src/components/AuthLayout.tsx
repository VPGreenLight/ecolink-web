import { Suspense } from "react"
import { Link, Outlet } from "react-router-dom"

/** Khung trang riêng cho Đăng nhập / Đăng ký.
 *
 *  Màn rộng (popup được phóng to): hai cột - panel thương hiệu dùng ảnh mầm cây
 *  bên trái, form bên phải. Màn hẹp / popup mặc định 480px: chỉ còn form trên
 *  nền sáng có quầng xanh nhẹ. */
const HIGHLIGHTS = [
  "Kết nối cơ sở thu mua gần bạn",
  "Điểm danh hằng ngày và chăm cây tích Điểm Xanh",
  "Theo dõi cây ảo và phần thưởng",
]

export default function AuthLayout() {
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-[#06120b] lg:block">
        <img
          src="/assets/auth/leaves.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-[#06120b]/35" />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[64%] bg-gradient-to-t from-[#06120b] via-[#06120b]/80 to-transparent"
        />

        <div className="relative flex h-full min-h-dvh flex-col p-10 xl:p-14">
          <Link
            to="/"
            aria-label="EcoLink - Trang chủ"
            className="inline-flex w-fit items-center rounded-2xl bg-white/95 px-4 py-2.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-sm"
          >
            <img src="/assets/brand/logo1.png" alt="EcoLink" className="h-8 w-auto" />
          </Link>

          <div className="mt-auto max-w-[30rem] pt-16">
            <p className="text-[2rem] leading-[1.12] font-bold tracking-tight text-white xl:text-[2.5rem]">
              Gieo một mầm xanh,
              <br />
              lớn lên cùng cộng đồng.
            </p>
            <p className="mt-4 max-w-[26rem] text-[15px] leading-relaxed text-white/80">
              Theo dõi lịch thu gom minh bạch, điểm danh tích thưởng và nuôi
              dưỡng cây ảo của riêng bạn.
            </p>

            <ul className="mt-8 grid gap-3">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/12 ring-1 ring-white/25">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5 text-mint">
                      <path
                        d="m3.5 8.5 3 3 6-7"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="text-sm leading-6 text-white/85">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/55">
            <span>© 2026 EcoLink</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-white/40" />
            <span>Nền tảng thu gom tuần hoàn</span>
          </p>
        </div>
      </aside>

      <main className="relative flex min-h-dvh flex-col justify-center overflow-hidden px-5 py-10 sm:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(760px_460px_at_50%_-10%,#dcefe3_0%,rgba(247,251,248,0)_72%)]"
        />
        <div className="relative mx-auto w-full max-w-[420px]">
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}