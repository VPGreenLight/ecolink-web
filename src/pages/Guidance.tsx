import { useState } from "react"
import { Link } from "react-router-dom"
import { PageHead, Field } from "@/components/Portal"
import { WASTE_GROUPS, WASTES } from "@/data/waste"

/** U-02 Tra cứu hướng dẫn phân loại rác.
 *
 *  Chọn nhóm vật liệu, xem luật xử lý của từng loại trong nhóm đó. Không có ô
 *  tìm kiếm ở đây vì `/waste` đã làm việc đó — hai trang cùng một dữ liệu thì
 *  chỉ một chỗ được tìm, chỗ kia dùng bộ lọc. */
export default function Guidance() {
  const [group, setGroup] = useState<string>(WASTE_GROUPS[1])
  const list = WASTES.filter((w) => w.group === group)

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="HƯỚNG DẪN"
        title="Phân loại rác đúng cách"
        body="Chọn nhóm vật liệu để xem luật thu gom và cách chuẩn bị. Rác chuẩn bị đúng giá cao hơn, và không bị từ chối khi người thu gom tới."
      />

      <div className="flex flex-wrap gap-2">
        {WASTE_GROUPS.filter((g) => g !== WASTE_GROUPS[0]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            aria-pressed={group === g}
            className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${
              group === g
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-body hover:bg-surface-2"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <ol className="flex flex-col gap-3">
        {list.map((w, i) => (
          <li key={w.id} className="card flex gap-4 p-5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/12 text-sm font-bold text-brand-deep">
              {i + 1}
            </span>
            <div className="min-w-0">
              <h2 className="text-base leading-6 font-bold text-ink">{w.name}</h2>
              <p className="mt-1 text-sm leading-6 text-body">{w.rule}</p>
              <p className="mt-2 text-[13px] leading-5 text-muted">
                <b className="text-ink">Chuẩn bị:</b> {w.prep}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-base font-bold text-ink">Không chắc mình bỏ đúng nhóm?</h2>
          <p className="mt-1 text-sm text-muted">
            Chụp một ảnh, AI nhận diện vật liệu và trả lời luôn là nhóm nào.
          </p>
        </div>
        <Link to="/scanner" className="btn-primary h-11 shrink-0 px-5">
          Nhận diện bằng AI
        </Link>
      </section>

      <U04Report />
    </div>
  )
}

/** U-04 Báo cáo AI nhận diện sai — để ngay dưới hướng dẫn vì cả hai là câu
 *  hỏi "cái này đúng không": người đọc hướng dẫn rồi vẫn thấy đường báo
 *  lỗi nếu AI vẫn chỉ sai. */
function U04Report() {
  const [correct, setCorrect] = useState("")
  const [note, setNote] = useState("")
  const [sent, setSent] = useState(false)

  return (
    <section className="card flex flex-col gap-4 p-5 md:p-6">
      <div>
        <h2 className="text-base font-bold text-ink">AI chỉ sai loại rác</h2>
        <p className="mt-1 text-sm text-muted">
          Chọn loại đúng. Nhân viên kiểm tra và đưa ảnh vào tập dữ liệu để lần sau
          AI không chỉ sai nữa.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Loại rác đúng là">
          <select
            className="input"
            value={correct}
            onChange={(e) => {
              setCorrect(e.target.value)
              setSent(false)
            }}
          >
            <option value="">Chọn loại rác</option>
            {WASTES.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ghi chú (không bắt buộc)">
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: ảnh chụp ngược, nền tối"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={!correct}
          onClick={() => setSent(true)}
          className="btn-primary h-11 px-6"
        >
          Gửi báo cáo
        </button>
        {sent && (
          <p role="status" className="text-[13px] font-semibold text-brand">
            Đã gửi. Cảm ơn bạn, lỗi này sẽ không lặp lại với bạn.
          </p>
        )}
      </div>
    </section>
  )
}