import { useState } from "react"
import { PageHead, Field, Stat } from "@/components/admin/ui"
import { FEE, fmtInt, fmtVnd } from "@/data/ops"
import { settle } from "@/data/waste"

/** A-10 Cấu hình phí giao dịch.
 *
 *  Con số `FEE_RATE` dùng chung với công thức giải ngân (SYS-01) và biên nhận
 *  của cơ sở thu mua. Đổi ở đây thì cả ba nơi cùng đổi — trước khi gộp, mỗi
 *  nơi một hằng số và cả ba đã lệch nhau một lần.
 *
 *  Không có nút "Áp dụng" vì con số này quyết định tiền thật cho hàng nghìn
 *  giao dịch đang chạy: ô số bị sửa dở thì đổi luôn là sai tiền. Ở đây chỉ
 *  ghi ra giá trị đang áp dụng. */
export default function Fees() {
  const [rate, setRate] = useState(FEE.rate)
  const [fixed, setFixed] = useState(FEE.fixed)
  const [flash, setFlash] = useState("")

  const dirty = rate !== FEE.rate || fixed !== FEE.fixed
  const sample = settle(500_000)

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="CẤU HÌNH"
        title="Cấu hình phí giao dịch"
        body="Phí nền tảng trích trên mỗi giao dịch thành công. Phần này là nguồn tiền duy nhất của nền tảng, nên đổi ở đây cần Admin thứ hai xác nhận."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setFlash(
              "Đã lưu. Giá trị mới áp dụng cho giao dịch phát sinh sau khi lưu, không đổi giao dịch đã chốt.",
            )
          }}
          className="card flex flex-col gap-5 p-5 md:p-6"
        >
          <Field
            label="Phí theo tỷ lệ"
            hint={`Đang áp dụng ${(FEE.rate * 100).toFixed(0)}% từ ngày ${FEE.effectiveFrom}.`}
          >
            <div className="flex items-center gap-3">
              <input
                className="input tabular-nums"
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={rate * 100}
                onChange={(e) => setRate(Number(e.target.value) / 100)}
              />
              <span className="text-sm font-semibold text-body">%</span>
            </div>
          </Field>

          <Field
            label="Phí cố định mỗi lượt thu gom"
            hint="Cộng thêm sau khi trừ tỷ lệ, dùng cho các giao dịch rất nhỏ để hệ thống vẫn có chi phí xử lý."
          >
            <input
              className="input tabular-nums"
              type="number"
              min={0}
              step={500}
              value={fixed}
              onChange={(e) => setFixed(Number(e.target.value))}
            />
          </Field>

          <Field
            label="Số tiền về tối thiểu"
            hint="Giao dịch nhỏ hơn ngưỡng này thì không trả tiền, chuyển sang ghi nhận điểm. Tránh trả tiền cho một giao dịch mất người dùng tiền phí chuyển khoản."
          >
            <input className="input tabular-nums" type="number" min={0} step={1000} defaultValue={FEE.minNet} />
          </Field>

          <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
            <button type="submit" disabled={!dirty} className="btn-primary h-11 px-6">
              Lưu phí giao dịch
            </button>
            {flash && (
              <p role="status" className="text-[13px] font-semibold text-brand">
                {flash}
              </p>
            )}
          </div>
        </form>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat label="Phí thu được 30 ngày" value={fmtVnd(147_360_000)} note="Toàn hệ thống" />
            <Stat label="Giao dịch 30 ngày" value={fmtInt(3_640)} note="Bình quân 40.484 đ/giao dịch phí" />
          </div>

          <section className="card p-5">
            <h2 className="text-base font-bold text-ink">
              Ví dụ giao dịch 500.000 đồng
            </h2>
            <dl className="mt-4 flex flex-col gap-2 text-sm">
              {[
                ["Tiền người dân bán rác", sample.gross],
                [`Phí nền tảng ${(rate * 100).toFixed(0)}%`, -sample.fee],
                ["Cơ sở thu mua thực nhận", sample.net],
              ].map(([k, v]) => (
                <div
                  key={k as string}
                  className="flex justify-between gap-3 border-b border-line-soft pb-2"
                >
                  <dt className="text-muted">{k}</dt>
                  <dd
                    className={`font-semibold tabular-nums ${
                      Number(v) < 0 ? "text-warn" : "text-ink"
                    }`}
                  >
                    {fmtVnd(Number(v))}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[13px] leading-5 text-muted">
              Cùng công thức này chạy ở giải ngân tự động và ở biên nhận của cơ sở
              thu mua, nên số tiền người dân thấy và số tiền người thu gom thấy
              luôn khớp.
            </p>
          </section>

          <p className="text-[13px] leading-5 text-muted">
            Đổi tỷ lệ phí không được làm cho một giao dịch nhỏ thành số tiền âm.
            Công thức hiện tại đã kẹp bằng ngưỡng tiền về tối thiểu ở trên.
          </p>
        </div>
      </div>
    </div>
  )
}