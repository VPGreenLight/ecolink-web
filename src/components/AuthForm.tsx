import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ROLE_HOME, type Role } from "@/lib/session"
import { isAuthPopup } from "@/lib/popupAuth"
import {
  SEEDED_DEMO_ACCOUNTS,
  authenticateWithGoogleToken,
  formatAuthError,
  loginWithCredentials,
  openGoogleAccountChooser,
  preloadGoogleIdentity,
  registerCitizenAccount,
} from "@/lib/authApi"

type Mode = "login" | "register"

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

  const [loginId, setLoginId] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  const [regFullName, setRegFullName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [regPassword, setRegPassword] = useState("")

  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState("")

  const [showGooglePrompt, setShowGooglePrompt] = useState(false)
  const [googleDemoEmail, setGoogleDemoEmail] = useState("nguyenvandan.ecolink@gmail.com")

  useEffect(() => {
    void preloadGoogleIdentity()
  }, [])

  const finishAuthNavigation = (role: Role) => {
    if (isPopup && typeof window !== "undefined" && window.opener) {
      try {
        window.opener.postMessage({ type: "AUTH_SUCCESS", role }, "*")
      } catch {
        // ignore cross-window errors
      }
      window.close()
      return
    }
    navigate(role === "user" ? "/" : ROLE_HOME[role])
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setErr("")
    setShowGooglePrompt(false)
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/${next}${isPopup ? "?popup=1" : ""}`)
    }
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setErr("")

    if (mode === "login") {
      if (!loginId.trim() || !loginPassword) {
        setErr("Vui lòng nhập tên đăng nhập/email và mật khẩu.")
        return
      }

      setSubmitting(true)
      try {
        const res = await loginWithCredentials(loginId, loginPassword)
        finishAuthNavigation(res.role)
      } catch (error) {
        setErr(formatAuthError(error))
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Chế độ Đăng ký tài khoản Người dân (Citizen — POST /api/v1/auth/register)
    if (regFullName.trim().length < 2) {
      setErr("Họ và tên cần có ít nhất 2 ký tự.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(regEmail.trim())) {
      setErr("Email chưa đúng định dạng.")
      return
    }
    if (
      regPhone.trim().length > 0 &&
      !/^(?:\+84|0)\d{9,10}$/.test(regPhone.replace(/[\s.\-()]/g, ""))
    ) {
      setErr("Số điện thoại chưa đúng định dạng Việt Nam (10 chữ số).")
      return
    }
    if (regPassword.length < 8) {
      setErr("Mật khẩu cần tối thiểu 8 ký tự.")
      return
    }

    setSubmitting(true)
    try {
      const res = await registerCitizenAccount({
        fullName: regFullName,
        email: regEmail,
        phoneNumber: regPhone,
        password: regPassword,
      })
      finishAuthNavigation(res.role)
    } catch (error) {
      setErr(formatAuthError(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleButton = async () => {
    if (submitting) return
    setErr("")
    setShowGooglePrompt(false)

    setSubmitting(true)
    try {
      const chooser = await openGoogleAccountChooser()
      if (chooser.status === "unconfigured") {
        setShowGooglePrompt(true)
        return
      }
      if (chooser.status === "cancelled") {
        return
      }
      const res = await authenticateWithGoogleToken(chooser.token)
      finishAuthNavigation(res.role)
    } catch (error) {
      setErr(formatAuthError(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleDevHandshake = async () => {
    const cleanEmail = googleDemoEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setErr("Vui lòng nhập địa chỉ email Google hợp lệ.")
      return
    }

    setErr("")
    setSubmitting(true)
    try {
      const res = await authenticateWithGoogleToken(`mock-${cleanEmail}`)
      finishAuthNavigation(res.role)
    } catch (error) {
      setErr(formatAuthError(error))
    } finally {
      setSubmitting(false)
    }
  }

  const fillDemoAccount = (username: string, password: string) => {
    if (mode !== "login") {
      switchMode("login")
    }
    setLoginId(username)
    setLoginPassword(password)
    setErr("")
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

        <div className="mb-6">
          <h1 className="text-[26px] font-bold tracking-tight text-ink">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm leading-[1.6] text-muted">{copy.body}</p>
        </div>

        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {mode === "register" ? (
            <>
              <Field label="Họ và tên">
                <input
                  className="input"
                  name="name"
                  type="text"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="Nguyễn Văn An"
                  autoComplete="name"
                  required
                />
              </Field>

              <Field label="Email">
                <input
                  className="input"
                  name="email"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="ban@ecolink.vn"
                  autoComplete="email"
                  required
                />
              </Field>

              <Field label="Số điện thoại (tuỳ chọn)">
                <input
                  className="input tabular-nums"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="0901 234 567"
                  autoComplete="tel"
                />
              </Field>

              <Field label="Mật khẩu">
                <span className="relative block">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    minLength={8}
                    autoComplete="new-password"
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
            </>
          ) : (
            <>
              <Field label="Email hoặc tên đăng nhập">
                <input
                  className="input"
                  name="email"
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="citizen@ecolink.vn hoặc citizen"
                  autoComplete="username"
                  required
                />
              </Field>

              <Field label="Mật khẩu">
                <span className="relative block">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Mật khẩu"
                    autoComplete="current-password"
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
            </>
          )}

          {err && (
            <p
              role="alert"
              className="rounded-xl border border-warn/25 bg-warn/8 px-3.5 py-2.5 text-[13px] leading-5 text-warn"
            >
              {err}
            </p>
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input type="checkbox" defaultChecked className="size-4 accent-brand" />
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
            disabled={submitting}
            className="group mt-1 flex h-13 w-full items-center justify-center gap-2.5 rounded-2xl bg-brand text-[15px] font-bold text-white shadow-[0_10px_26px_-10px_rgba(15,31,21,0.38)] transition-[background-color,box-shadow,transform] duration-200 ease-out hover:bg-brand-deep hover:shadow-[0_14px_30px_-10px_rgba(15,31,21,0.42)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {submitting
              ? mode === "login"
                ? "Đang đăng nhập..."
                : "Đang tạo tài khoản..."
              : copy.submit}
            {!submitting && (
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
            )}
          </button>
        </form>

        {/* Phân cách & Đăng nhập nhanh Google OAuth 2.0 (POST /api/v1/auth/google) */}
        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          <span>hoặc</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={handleGoogleButton}
          className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="size-4.5 shrink-0" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12Z"
            />
            <path
              fill="#34A853"
              d="M3.6 7.7l3.2 2.3c.9-2.5 3.2-4.1 5.2-4.1 1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 8.3 2.5 5.1 4.6 3.6 7.7Z"
            />
            <path
              fill="#FBBC05"
              d="M12 21.5c2.5 0 4.7-.8 6.3-2.3l-2.9-2.4c-.8.6-1.9 1.1-3.4 1.1-3.7 0-5.1-2.4-5.4-3.7l-3.2 2.5c1.5 3 4.7 4.8 8.6 4.8Z"
            />
            <path
              fill="#4285F4"
              d="M21.1 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.3 1.3-1.1 2.4-2 3.1l2.9 2.4c1.7-1.6 2.8-4 2.8-7.8Z"
            />
          </svg>
          Tiếp tục với Google
        </button>

        {showGooglePrompt && (
          <div className="mt-3 rounded-xl border border-brand/25 bg-surface p-3.5">
            <p className="text-xs leading-5 text-body">
              Xác thực tài khoản Google trực tiếp qua <code className="font-mono text-[11px]">POST /api/v1/auth/google</code>:
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="email"
                value={googleDemoEmail}
                onChange={(e) => setGoogleDemoEmail(e.target.value)}
                placeholder="tenban@gmail.com"
                className="input h-9 flex-1 text-xs"
              />
              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleDevHandshake}
                className="btn-primary h-9 shrink-0 px-3.5 text-xs"
              >
                Xác thực
              </button>
            </div>
          </div>
        )}

        {/* Bộ chọn nhanh 4 tài khoản mẫu đã seed trong PostgreSQL để giảng viên / hội đồng kiểm thử nhanh */}
        {mode === "login" && (
          <div className="mt-5 rounded-xl border border-line-soft bg-surface p-3">
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
              Điền nhanh tài khoản mẫu trên CSDL
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SEEDED_DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => fillDemoAccount(acc.username, acc.password)}
                  className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-semibold text-body transition-colors hover:border-brand hover:text-brand-deep"
                >
                  {acc.label} ({acc.username})
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "register" && !isPopup && (
          <p className="mt-4 text-center text-xs text-muted">
            Bạn là chủ vựa/trạm tái chế?{" "}
            <Link to="/join-recycler" className="font-semibold text-brand hover:text-brand-deep">
              Đăng ký hồ sơ cơ sở thu mua
            </Link>
          </p>
        )}

        <p className="mt-6 text-center text-[13px] text-muted">
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
