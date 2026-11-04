import { useState } from "react"
import { PageHead } from "@/components/Portal"

/** U-18 và R-07 dùng chung trang này: hai vai trò khác nhau nhưng cơ chế
 *  giống hệt nhau — cùng một bước nhập email, cùng một bước nhập mã OTP. Tách
 *  2 trang thì 2 chỗ phải sửa cùng lúc mỗi lần đổi quy trình, và người dùng
 *  phải tự đoán trang nào dành cho mình.
 *
 *  Trạng thái 3 bước giữ trong state của trang chứ không đoán lại từ URL:
 *  người dùng bấm lại trình duyệt thì trang quay về bước đầu, và đó mới đúng
 *  vì đặt lại mật khẩu là một thao tác một lần, không phải một nơi để quay
 *  lại sau. */
type Step = "email" | "code" | "done"

export default function ResetPassword() {
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [flash, setFlash] = useState("")

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="KHÓA TÀI KHOẢN"
        title="Đặt lại mật khẩu"
        body="Nhận mã xác thực qua email đã đăng ký, đặt mật khẩu mới rồi đăng nhập lại. Người dân và cơ sở thu mua dùng chung quy trình này."
      />

      <ol className="flex flex-wrap items-center gap-3">
        {[
          ["Nhập email", "email"],
          ["Nhập mã và mật khẩu mới", "code"],
          ["Hoàn tất", "done"],
        ].map(([label, id], i) => (
          <li key={id} className="flex items-center gap-3">
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                step === id || done(step, id)
                  ? "bg-brand text-white"
                  : "bg-surface-2 text-muted"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`text-[13px] font-semibold ${
                step === id ? "text-ink" : "text-muted"
              }`}
            >
              {label}
            </span>
            {i < 2 && <span className="text-line">—</span>}
          </li>
        ))}
      </ol>

      {step === "email" && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
              setFlash("Email chưa đúng định dạng.")
              return
            }
            setFlash("")
            // ponytail: chưa có dịch vụ gửi email, chuyển thẳng sang bước nhập
            // mã. Nối API thì thay dòng này bằng lệnh gửi OTP.
            setStep("code")
          }}
          noValidate
          className="card flex max-w-[520px] flex-col gap-5 p-5 md:p-6"
        >
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Email đã đăng ký
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@email.vn"
              autoComplete="email"
            />
          </label>
          {flash && <p className="text-[13px] text-warn">{flash}</p>}
          <button type="submit" className="btn-primary h-11 px-6">
            Gửi mã xác thực
          </button>
          <p className="text-[13px] leading-5 text-muted">
            Mã có hiệu lực 10 phút. Nếu không thấy trong hộp thư, kiểm tra thư mục
            quảng cáo hoặc thư rác.
          </p>
        </form>
      )}

      {step === "code" && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!/^\d{6}$/.test(code)) {
              setFlash("Mã xác thực gồm 6 chữ số.")
              return
            }
            if (password.length < 8) {
              setFlash("Mật khẩu mới cần ít nhất 8 ký tự.")
              return
            }
            setFlash("")
            setStep("done")
          }}
          noValidate
          className="card flex max-w-[520px] flex-col gap-5 p-5 md:p-6"
        >
          <p className="text-sm text-body">
            Mã đã gửi tới <b className="text-ink">{email}</b>.
          </p>

          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Mã xác thực
            <input
              className="input tabular-nums"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6 chữ số"
            />
          </label>

          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Mật khẩu mới
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              autoComplete="new-password"
            />
          </label>

          {flash && <p className="text-[13px] text-warn">{flash}</p>}

          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" className="btn-primary h-11 px-6">
              Đặt mật khẩu mới
            </button>
            <button
              type="button"
              onClick={() => {
                setFlash("Đã gửi lại mã. Kiểm tra hộp thư trong vài phút nữa.")
                setCode("")
              }}
              className="btn-ghost h-11 px-5"
            >
              Gửi lại mã
            </button>
          </div>
        </form>
      )}

      {step === "done" && (
        <div className="card flex max-w-[520px] flex-col gap-4 p-5 md:p-6">
          <span className="grid size-12 place-items-center rounded-full bg-brand text-white">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 13 4 4L19 7" />
            </svg>
          </span>
          <h2 className="text-lg leading-7 font-bold text-ink">
            Đã đặt lại mật khẩu
          </h2>
          <p className="text-sm leading-6 text-body">
            Đăng nhập lại bằng mật khẩu mới. Nếu có đăng nhập ở thiết bị khác mà
            không phải bạn, báo ngay để chúng tôi khoá phiên đó.
          </p>
          <a href="/login" className="btn-primary h-11 w-fit px-6">
            Đi tới đăng nhập
          </a>
        </div>
      )}
    </div>
  )
}

/** một bước đã đi qua = có id nằm sau `step` trong thứ tự email → code → done */
function done(step: Step, id: string): boolean {
  const order: Step[] = ["email", "code", "done"]
  return order.indexOf(step) > order.indexOf(id as Step)
}