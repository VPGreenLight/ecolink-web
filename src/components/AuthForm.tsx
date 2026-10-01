import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ROLE_HOME, signIn, type Role } from "@/lib/session"

type Mode = "login" | "register"

/** Tài khoản dùng thử. Vai trò lấy từ tên đăng nhập, KHÔNG có ô chọn vai trò:
 *  hệ thống thật không ai tự chọn quyền cho mình, vai trò do backend trả về theo
 *  tài khoản. Bảng này chỉ để bản demo vào được cả 4 khu vực để xem.
 *
 *  Mật khẩu kiểm ở `DEMO_PASS` — không kiểm thì ai cũng vào được, có kiểm thì
 *  phải nhớ mật khẩu trước khi xem được trang. */
const DEMO: Record<string, { role: Role; name: string }> = {
  user: { role: "user", name: "Nguyễn Đức" },
  recycler: { role: "recycler", name: "Cô Ba Thu Gom" },
  staff: { role: "staff", name: "Lê Thu Hà" },
  admin: { role: "admin", name: "Quản trị viên" },
}

const DEMO_PASS = "123"

const COPY = {
  login: {
    title: "Đăng nhập",
    body: "Đăng nhập để quản lý lịch thu gom và theo dõi đóng góp xanh của bạn.",
    submit: "Đăng nhập",
    switchText: "Chưa có tài khoản?",
    switchLink: "Đăng ký miễn phí",
    switchTo: "register" as const,
  },
  register: {
    title: "Tạo tài khoản",
    body: "Tham gia cộng đồng sống xanh và tích lũy giá trị từ rác tái chế.",
    submit: "Tạo tài khoản",
    switchText: "Đã có tài khoản?",
    switchLink: "Đăng nhập",
    switchTo: "login" as const,
  },
} as const

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

export default function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode]
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [err, setErr] = useState("")

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)

    if (mode === "login") {
      const login = String(data.get("email") ?? "").trim().toLowerCase()
      const pass = String(data.get("password") ?? "")
      // Không kiểm tra mật khẩu thì bản demo không khác gì form bịa ra: bấm là
      // vào. Kiểm thì đúng một câu, và người xem biết mật khẩu là gì.
      if (!DEMO[login] || pass !== DEMO_PASS) {
        setErr("Email hoặc mật khẩu không đúng. Kiểm tra lại rồi thử.")
        return
      }
      signIn(DEMO[login].name, DEMO[login].role)
      navigate(ROLE_HOME[DEMO[login].role])
      return
    }

    const raw = String(data.get("name") || data.get("email") || "EcoLink")
    const name = raw.includes("@") ? raw.split("@")[0] : raw
    signIn(name, "user")
    navigate(ROLE_HOME.user)
  }

  // form và panel đổi chỗ thật: đăng ký form ở trái, đăng nhập form ở phải.
  // Cả hai luôn trượt vào TỪ TRÁI, nên bấm "Đăng nhập" trên trang đăng ký sẽ
  // thấy form dịch từ trái sang phải. Hai cột bằng nhau để không nhảy bề rộng.
  // ponytail: phải khoá row-start-1. Nếu không, khi main đứng ở col-start-2
  // thì con trỏ grid dịch sang cột 3; item sau muốn col-start-1 (nhỏ hơn con
  // trỏ) sẽ bị đẩy xuống hàng 2 -> panel xanh rơi xuống dưới form.
  const side = mode === "register" ? "lg:col-start-1" : "lg:col-start-2"
  const other = mode === "register" ? "lg:col-start-2" : "lg:col-start-1"

  return (
    <div className="grid min-h-dvh bg-page lg:grid-cols-2">
      <main
        style={{ "--auth-from": "-180px" } as CSSProperties}
        className={`auth-enter flex flex-col justify-center px-6 py-12 lg:row-start-1 lg:px-10 xl:px-14 ${side}`}
      >
        <div className="mx-auto flex w-full max-w-[400px] flex-col">
          {/* quay về trang chủ, luôn ở bên trái */}
          <Link
            to="/"
            aria-label="Về trang chủ"
            className="group mb-8 inline-flex items-center gap-2.5 self-start text-sm font-semibold text-body transition-colors hover:text-brand-deep"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="size-5 -translate-x-0 transition-transform duration-200 group-hover:-translate-x-1"
            >
              <path
                d="M20 12H4m0 0 6.5-6.5M4 12l6.5 6.5"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Về trang chủ
          </Link>

          <Link
            to="/"
            aria-label="EcoLink - Trang chủ"
            className="mx-auto mb-8 block w-fit"
          >
            <img src="/assets/brand/logo1.png" alt="EcoLink" className="h-[66px] w-auto" />
          </Link>

          <div className="mb-7">
            <h1 className="text-[26px] font-bold tracking-tight text-ink">
              {copy.title}
            </h1>
            <p className="mt-2 text-sm leading-[1.6] text-muted">{copy.body}</p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-5">
            {mode === "register" && (
              <Field label="Họ và tên">
              <input className="input" name="name" type="text" placeholder="Nguyễn Văn An" autoComplete="name" required />
              </Field>
            )}

            <Field label="Email">
              <input
                className="input"
                name="email"
                /* đăng nhập nhận cả tên tài khoản dùng thử ("admin") nên không
                   dùng type=email: trình duyệt chặn "admin" là hỏng trước khi
                   submit có kịp chạy. */
                type={mode === "login" ? "text" : "email"}
                placeholder={mode === "login" ? "admin" : "ban@ecolink.vn"}
                autoComplete={mode === "login" ? "username" : "email"}
                required
              />
            </Field>

            <Field label="Mật khẩu">
              <span className="relative block">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    mode === "login"
                      ? `Mật khẩu tài khoản dùng thử`
                      : "Tối thiểu 8 ký tự"
                  }
                  minLength={mode === "register" ? 8 : undefined}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                  className="input pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 my-auto h-7 rounded-md px-2.5 text-xs font-semibold text-brand transition-colors hover:text-brand-deep"
                >
                  {showPassword ? "Ẩn" : "Hiện"}
                </button>
              </span>
            </Field>

            {mode === "login" && err && (
              <p role="alert" className="-mt-2 text-[13px] text-warn">
                {err}
              </p>
            )}

            <div className="-mt-1 flex items-center justify-between">
              <label className="flex items-center gap-2 text-[13px] text-muted">
                <input type="checkbox" className="size-4 accent-brand" />
                Ghi nhớ đăng nhập
              </label>
              {mode === "login" && (
                <Link
                  to="/reset-password"
                  className="text-[13px] font-semibold text-brand transition-colors hover:text-brand-deep"
                >
                  Quên mật khẩu?
                </Link>
              )}
            </div>

            <button
              type="submit"
              className="group mt-1 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-brand text-[15px] font-bold text-white shadow-[0_10px_26px_-10px_rgba(15,31,21,0.38)] transition-[background-color,box-shadow,transform] duration-200 ease-out hover:bg-brand-deep hover:shadow-[0_14px_30px_-10px_rgba(15,31,21,0.42)] active:scale-[0.985]"
            >
              {copy.submit}
              <svg
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-1"
              >
                <path
                  d="M2 8h11m0 0-4-4m4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>

          <p className="mt-7 text-center text-[13px] text-muted">
            {copy.switchText}
            <Link
              to={`/${copy.switchTo}`}
              className="ml-2 inline-flex h-9 items-center rounded-full bg-brand/10 px-3.5 font-semibold text-brand transition-[background-color,transform] duration-200 ease-out hover:bg-brand/18 active:scale-[0.97]"
            >
              {copy.switchLink}
            </Link>
          </p>
        </div>
      </main>

      {/* panel xanh bên phải, chỉ hiện từ lg */}
      <aside
        style={{ "--auth-from": "180px" } as CSSProperties}
        className={`auth-enter relative hidden flex-col justify-between overflow-hidden bg-[#052b18] p-10 text-white lg:row-start-1 lg:flex xl:p-14 ${other}`}
      >
        {/* Giảm sáng riêng ảnh (brightness) thay vì tăng tối lớp phủ: như vậy
            vẫn thấy lá nhưng chữ trắng không bị chói. Ảnh 3:2 ngang đặt vào
            panel dọc phải cắt, object-position 18% để lấy phần lá sắc nét ở
            trên thay vì vùng bokeh mờ ở giữa. */}
        <img
          src="/assets/auth/leaves.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover object-[50%_18%] brightness-[0.6] saturate-[1.25]"
        />
        <span className="relative text-xs font-semibold tracking-[0.22em] text-mint uppercase">
          Hệ sinh thái tuần hoàn
        </span>

        <div className="relative max-w-[440px] -my-8">
          <h2 className="text-[clamp(28px,2.6vw,38px)] leading-[1.18] font-bold tracking-tight">
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
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
      {label}
      {children}
    </label>
  )
}

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
