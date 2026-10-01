import { useState } from "react"
import { Link } from "react-router-dom"
import { PageHead } from "@/components/Portal"
import { BANKS, validAccount } from "@/data/cashflow"

/** U-13 Thiết lập tài khoản nhận tiền.
 *
 *  Chỉ giữ 3 trường thật sự cần: ngân hàng, số tài khoản, chủ tài khoản. Mã QR
 *  và hạn mức mỗi lần là chi tiết của cổng thanh toán, không phải thứ người
 *  dùng nhập ở đây. */
export default function Payout() {
  const [bank, setBank] = useState<string>(BANKS[0])
  const [no, setNo] = useState("007012345678")
  const [holder, setHolder] = useState("Nguyễn Đức")
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validAccount(no)) {
      setErr("Số tài khoản phải là 6 đến 20 chữ số.")
      setSaved(false)
      return
    }
    if (holder.trim().length < 3) {
      setErr("Tên chủ tài khoản phải khớp với tên trên giấy tờ.")
      setSaved(false)
      return
    }
    setErr("")
    // ponytail: chưa có backend, chỉ báo đã lưu. Nối API thì thay đúng dòng này.
    setSaved(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="DÒNG TIỀN"
        title="Tài khoản nhận tiền"
        body="Tiền bán rác được EcoLink chuyển thẳng về tài khoản này. Cài một lần, các giao dịch sau tự động về đúng chỗ."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <form onSubmit={submit} noValidate className="card flex flex-col gap-5 p-5 md:p-6">
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Ngân hàng
            <select
              className="input"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
            >
              {BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Số tài khoản
            <input
              className={`input tabular-nums ${err && !validAccount(no) ? "border-warn" : ""}`}
              inputMode="numeric"
              value={no}
              onChange={(e) => setNo(e.target.value)}
              placeholder="007012345678"
            />
            <span className="text-[12px] font-normal text-muted">
              Nhập dấu cách hoặc dấu chấm cũng được, hệ thống tự bỏ.
            </span>
          </label>

          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Chủ tài khoản
            <input
              className={`input ${err && holder.trim().length < 3 ? "border-warn" : ""}`}
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
            />
            <span className="text-[12px] font-normal text-muted">
              Phải là chính bạn. EcoLink không chuyển tiền vào tài khoản của
              người khác.
            </span>
          </label>

          {err && <p className="text-[13px] text-warn">{err}</p>}

          <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
            <button type="submit" className="btn-primary h-11 px-6">
              Lưu tài khoản
            </button>
            {saved && (
              <p role="status" className="text-[13px] font-semibold text-brand">
                Đã lưu. Các khoản chi tiếp theo sẽ về tài khoản này.
              </p>
            )}
          </div>
        </form>

        <aside className="card flex flex-col gap-4 p-5 md:p-6">
          <h2 className="text-base font-bold text-ink">Tiền về từ đâu</h2>
          <ol className="flex flex-col gap-4">
            {[
              [
                "Người thu gom nhận rác",
                "Sau khi bàn giao xong, cơ sở thu mua chuyển tiền qua VietQR về EcoLink.",
              ],
              [
                "Hệ thống nhận tiền",
                "Webhook VietQR báo nhận đủ. EcoLink trừ phí nền tảng rồi tính số tiền về của bạn.",
              ],
              [
                "PayOS bắn tiền về tài khoản",
                "Thường trong vài phút. Xem từng khoản ở Lịch sử dòng tiền.",
              ],
            ].map(([t, b], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{t}</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-muted">{b}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            to="/me/transactions"
            className="mt-1 text-[13px] font-semibold text-brand hover:text-brand-deep"
          >
            Xem lịch sử dòng tiền →
          </Link>
        </aside>
      </div>
    </div>
  )
}