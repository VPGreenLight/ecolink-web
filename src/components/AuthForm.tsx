import { useState, type FormEvent, type ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ROLE_HOME, signIn, type Role } from "@/lib/session"
import { isAuthPopup } from "@/lib/popupAuth"

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

export default function AuthForm({ mode: initialMode }: { mode: Mode }) {
  const isPopup = isAuthPopup()
  const [mode, setMode] = useState<Mode>(initialMode)
  const copy = COPY[mode]
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [err, setErr] = useState("")

  const switchMode = (next: Mode) => {
    setMode(next)
    setErr("")
    window.history.replaceState(null, "", `/${next}${isPopup ? "?popup=1" : ""}`)
  }

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
      const role = DEMO[login].role

      if (isPopup && window.opener) {
        try {
          window.opener.postMessage({ type: "AUTH_SUCCESS", role }, "*")
        } catch {}
        window.close()
        return
      }

      navigate(role === "user" ? "/" : ROLE_HOME[role])
      return
    }

    const raw = String(data.get("name") || data.get("email") || "EcoLink")
    const name = raw.includes("@") ? raw.split("@")[0] : raw
    signIn(name, "user")

    if (isPopup && window.opener) {
      try {
        window.opener.postMessage({ type: "AUTH_SUCCESS", role: "user" }, "*")
      } catch {}
      window.close()
      return
    }

    navigate("/")
  }

  return (
    <div className="mx-auto flex w-full max-w-[430px] flex-col">
      {/* Nút thoát: đóng popup nếu mở cửa sổ riêng, hoặc quay về trang chủ */}
      {isPopup ? (
        <button
          type="button"
          onClick={() => window.close()}
          className="group mb-5 inline-flex items-center gap-2 self-start text-sm font-semibold text-body transition-colors hover:text-brand-deep"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="size-5 transition-transform duration-200 group-hover:-translate-x-0.5"
          >
            <path
              d="M18 6 6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Đóng cửa sổ
        </button>
      ) : (
        <Link
          to="/"
          aria-label="Về trang chủ"
          className="group mb-5 inline-flex items-center gap-2.5 self-start text-sm font-semibold text-body transition-colors hover:text-brand-deep"
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
      )}

      {/* Khung viền (border): chỉ hiện khi người dùng mở hết màn hình ra (desktop lg), màn hình thu nhỏ thì không viền */}
      <div className="rounded-none border-0 bg-transparent p-0 shadow-none lg:rounded-3xl lg:border lg:border-line lg:bg-white lg:p-8 lg:shadow-[0_4px_24px_rgba(15,31,21,0.05)]">
        <Link
          to="/"
          aria-label="EcoLink - Trang chủ"
          className="mx-auto mb-6 block w-fit"
        >
          <img src="/assets/brand/logo1.png" alt="EcoLink" className="h-[66px] w-auto" />
        </Link>

        {/* Thanh tab Compact: Tạo tài khoản trước, Đăng nhập sau (khớp menu user ở ngoài) */}
        <div className="mb-6 grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`rounded-lg py-2 transition-[background-color,color,box-shadow] duration-150 ${
              mode === "register"
                ? "bg-white text-ink shadow-xs"
                : "text-muted hover:text-ink"
            }`}
          >
            Tạo tài khoản
          </button>
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`rounded-lg py-2 transition-[background-color,color,box-shadow] duration-150 ${
              mode === "login"
                ? "bg-white text-ink shadow-xs"
                : "text-muted hover:text-ink"
            }`}
          >
            Đăng nhập
          </button>
        </div>

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
              placeholder={mode === "login" ? "Tài khoản" : "ban@ecolink.vn"}
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
                    ? `Mật khẩu`
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
          <button
            type="button"
            onClick={() => switchMode(copy.switchTo)}
            className="ml-2 inline-flex h-9 items-center rounded-full bg-brand/10 px-3.5 font-semibold text-brand transition-[background-color,transform] duration-200 ease-out hover:bg-brand/18 active:scale-[0.97]"
          >
            {copy.switchLink}
          </button>
        </p>
      </div>
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
