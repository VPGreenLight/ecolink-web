import { useState } from "react"
import { PageHead, Status } from "@/components/Portal"
import { AI_CASES, type AiCase } from "@/data/ops"
import { WASTES } from "@/data/waste"

/** S-01 Đánh giá ảnh AI nhận diện sai · S-02 Gán nhãn dữ liệu ảnh.
 *
 *  Gộp vì S-02 là việc bắt buộc phải làm trong lúc S-01: nhân viên đang xem
 *  ảnh sai thì gán luôn nhãn đúng, không có lý do phải mở màn hình thứ hai để
 *  làm việc đang cầm trên tay. `inDataset` là S-03 (đã đưa vào tập kiểm
 *  chứng chưa) nên nó cũng chạy ở đây. */
export default function AiReview() {
  const [list, setList] = useState<AiCase[]>(AI_CASES)
  const [pick, setPick] = useState(AI_CASES[0].id)
  const [label, setLabel] = useState(AI_CASES[0].correct)
  const [note, setNote] = useState("")
  const [flash, setFlash] = useState("")

  const cur = list.find((c) => c.id === pick)!

  const choose = (id: string) => {
    const c = list.find((x) => x.id === id)
    setPick(id)
    setLabel(c?.correct ?? "")
    setNote("")
    setFlash("")
  }

  /** Gán nhãn và đánh dấu đã vào tập kiểm chứng trong một thao tác: hai việc
   *  luôn đi cùng nhau, tách ra thì có ảnh đã gán mà chưa vào tập, và cũng có
   *  ảnh vào tập mà vẫn chưa ai xác nhận nhãn. */
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) {
      setFlash("Cần chọn nhãn đúng trước khi lưu.")
      return
    }
    setList((ls) =>
      ls.map((c) => (c.id === pick ? { ...c, correct: label, inDataset: true } : c)),
    )
    setFlash(`Đã gán nhãn ${cur.id} và đưa vào tập kiểm chứng.`)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="DỮ LIỆU AI"
        title="Ảnh AI nhận diện sai"
        body="Mỗi lần người dùng báo sai là một cơ hội sửa mô hình. Gán nhãn đúng và đưa ảnh vào tập kiểm chứng trong một lần."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
          <figure className="overflow-hidden rounded-xl border border-line bg-surface-2">
            <img
              src={cur.image}
              alt={`Ảnh ${cur.id} người dùng báo AI nhận sai`}
              className="aspect-video w-full object-cover"
            />
            <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-4 py-2.5 text-[13px]">
              <span className="tabular-nums text-ink">{cur.id}</span>
              <span className="text-muted">
                {cur.date} · báo bởi {cur.reporter}
              </span>
            </figcaption>
          </figure>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface-2 px-4 py-3">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                AI đoán
              </p>
              <p className="mt-1 text-base font-bold text-body">{cur.predicted}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                Độ tin cậy {cur.confidence}%
              </p>
            </div>
            <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
              Nhãn đúng
              <select
                className="input"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value)
                  setFlash("")
                }}
              >
                <option value="">Chọn nhãn đúng</option>
                {WASTES.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Nhận xét (không bắt buộc)
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: nền tối, ảnh chụp ngược, vật liệu lẫn nhiều loại"
            />
          </label>

          <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
            <button type="submit" className="btn-primary h-11 px-6">
              Lưu nhãn và thêm vào tập kiểm chứng
            </button>
            {flash && (
              <p role="status" className="text-[13px] font-semibold text-brand">
                {flash}
              </p>
            )}
          </div>
        </form>

        <aside>
          <h2 className="text-sm font-bold text-ink">
            Hàng chờ ({list.filter((c) => !c.inDataset).length} chưa xử lý)
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => choose(c.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    pick === c.id
                      ? "border-brand bg-brand/8"
                      : "border-line bg-surface hover:bg-surface-2"
                  }`}
                >
                  <img
                    src={c.image}
                    alt=""
                    className="size-11 shrink-0 rounded object-cover"
                    loading="lazy"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {c.correct}
                    </span>
                    <span className="block truncate text-[12px] text-muted">
                      AI đoán {c.predicted}
                    </span>
                  </span>
                  <Status tone={c.inDataset ? "ok" : "wait"}>
                    {c.inDataset ? "Đã gán" : "Chờ"}
                  </Status>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}

