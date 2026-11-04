import { useState } from "react"
import { PageHead, Status } from "@/components/admin/ui"
import { CYCLES } from "@/data/ops"
import { LEADERBOARD, fmt } from "@/data/rewards"

/** A-08 Cấu hình chu kỳ bảng xếp hạng (Tuần / Tháng / Quý).
 *
 *  Bật nhiều chu kỳ cùng lúc thì người dùng phải tự hiểu "quý" tính khác gì
 *  "tuần". Cho phép bật tối đa một chu kỳ, và hiện bảng xếp hạng tương ứng với
 *  chu kỳ đang bật — bảng nào không bật thì không render, không phải render
 *  rồi ghi "tạm thời không xếp hạng". */
export default function LeaderboardConfig() {
  const [on, setOn] = useState<string>(CYCLES.find((c) => c.active)!.id)
  const [flash, setFlash] = useState("")

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="CẤU HÌNH"
        title="Chu kỳ bảng xếp hạng"
        body="Chỉ một chu kỳ được tính tại một thời điểm. Bật thêm chu kỳ thứ hai thì người dùng phải tự đoán cái nào tính điểm gì."
      />

      <ul className="grid gap-4 sm:grid-cols-3">
        {CYCLES.map((c) => (
          <li
            key={c.id}
            className={`card flex flex-col gap-3 p-5 transition-colors ${
              on === c.id ? "border-brand bg-brand/6" : ""
            }`}
          >
            <label className="flex items-center justify-between gap-3">
              <span className="text-base font-bold text-ink">{c.label}</span>
              <input
                type="radio"
                name="cycle"
                className="size-4 accent-brand"
                checked={on === c.id}
                onChange={() => {
                  setOn(c.id)
                  setFlash(`Đã chuyển bảng xếp hạng sang chu kỳ ${c.label.toLowerCase()}.`)
                }}
              />
            </label>
            <p className="text-[13px] text-muted">
              Từ {c.from} đến {c.to}
            </p>
            <div className="mt-auto">
              <Status tone={on === c.id ? "ok" : "off"}>
                {on === c.id ? "Đang tính" : "Tắt"}
              </Status>
            </div>
          </li>
        ))}
      </ul>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
            Bảng xếp hạng {CYCLES.find((c) => c.id === on)?.label.toLowerCase()}
          </h2>
          <p className="text-sm text-muted">
            Theo điểm xếp hạng, đổi quà không làm tụt hạng
          </p>
        </div>

        <ol className="card mt-4 divide-y divide-line-soft overflow-hidden">
          {LEADERBOARD.map((r, i) => (
            <li
              key={r.name}
              className={`flex items-center gap-3 px-4 py-3 ${r.you ? "bg-brand/8" : ""}`}
            >
              <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {r.name}
                  {r.you && <span className="ml-1.5 text-xs text-brand">(tài khoản mẫu)</span>}
                </p>
                <p className="truncate text-xs text-muted">{r.area}</p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                {fmt(r.points)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {flash && (
        <p role="status" className="text-[13px] font-semibold text-brand">
          {flash}
        </p>
      )}
    </div>
  )
}