import { Outlet } from "react-router-dom"
import { isAuthPopup } from "@/lib/popupAuth"

/** Ba việc app thật sự làm, không bịa thêm tính năng */
const PERKS = [
  {
    title: "Nhận diện bằng AI",
    body: "Chụp ảnh rác, biết vật liệu và giá tham khảo trong vài giây.",
    icon: "scan",
  },
  {
    title: "Thu gom tận nhà",
    body: "Đặt lịch người thu gom gần bạn và theo dõi lộ trình.",
    icon: "pin",
  },
  {
    title: "Nối chuỗi giá trị",
    body: "Kết nối trực tiếp với nhà máy tái chế đạt chuẩn.",
    icon: "recycle",
  },
] as const

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function PerkIcon({ name }: { name: (typeof PERKS)[number]["icon"] }) {
  const box = "size-[18px]"
  if (name === "scan") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={box}>
        <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" {...stroke} />
        <path d="M3 12h18" {...stroke} />
      </svg>
    )
  }
  if (name === "pin") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={box}>
        <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" {...stroke} />
        <circle cx="12" cy="10" r="2.5" {...stroke} />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={box}>
      <path d="m8 4 3 3-2 2a4 4 0 0 0 5 5l2-2 3 3-2 2" {...stroke} />
      <path d="M4.5 8.5 7 6M14 18l2.5-2.5" {...stroke} />
    </svg>
  )
}

/** Khung layout dùng chung cho Login & Register.
 *  Panel hình ảnh bên trái cố định, không unmount hay giật nháy khi chuyển form qua lại.
 */
export default function AuthLayout() {
  const isPopup = isAuthPopup()

  if (isPopup) {
    return (
      <div className="flex min-h-dvh flex-col justify-center bg-page px-6 py-8">
        <main className="mx-auto w-full max-w-[420px]">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="grid min-h-dvh bg-page lg:grid-cols-2">
      {/* panel xanh bên trái (cố định, không đổi khi chuyển giữa login <-> register) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#052b18] p-10 text-white lg:col-start-1 lg:row-start-1 lg:flex xl:p-14">
        <img
          src="/assets/auth/leaves.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover object-[50%_18%] brightness-[0.6] saturate-[1.25]"
        />
        <span className="relative text-xs font-semibold tracking-[0.22em] text-mint uppercase">
          Hệ sinh thái tuần hoàn
        </span>

        <div className="relative -my-8 max-w-[440px]">
          <h2 className="text-[clamp(28px,2.6vw,38px)] font-bold tracking-tight leading-[1.18]">
            Chụp ảnh rác. Biết vật liệu. Người thu gom tới tận nhà.
          </h2>
          <p className="mt-5 text-[15px] leading-[1.7] text-white/70">
            EcoLink nối người dân với người thu gom và nhà máy tái chế trong
            một nền tảng duy nhất.
          </p>

          <ul className="mt-9 flex flex-col gap-5">
            {PERKS.map((perk) => (
              <li key={perk.title} className="flex items-start gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/12 text-mint">
                  <PerkIcon name={perk.icon} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{perk.title}</p>
                  <p className="mt-0.5 text-[13px] leading-[1.55] text-white/60">
                    {perk.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-baseline gap-3 border-t border-white/15 pt-6">
          <b className="text-3xl font-bold tracking-tight">12.4k</b>
          <span className="text-[13px] text-white/60">
            tấn phế liệu đã số hoá qua EcoLink
          </span>
        </p>
      </aside>

      {/* Cột hiển thị form bên phải */}
      <main className="flex flex-col justify-center px-6 py-12 lg:col-start-2 lg:row-start-1 lg:px-10 xl:px-14">
        <Outlet />
      </main>
    </div>
  )
}
