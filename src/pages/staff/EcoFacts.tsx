import { useState } from "react"
import { PageHead, Field, Status } from "@/components/Portal"
import { ECO_FACTS, type EcoFact } from "@/data/ops"

/** S-09 Quản lý nội dung Eco Fact.
 *
 *  Nội dung Eco Fact là thứ người dùng đọc để biết vì sao họ làm đúng, nên
 *  phải có nguồn và phải mở được bằng điểm. Form bắt buộc có "chi phí mở
 *  khoá" vì đó là con số A-07 dùng chung — không nhập thì Eco Fact mới sẽ
 *  không ai mở nổi. */
export default function EcoFacts() {
  const [list, setList] = useState<EcoFact[]>(ECO_FACTS)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [cost, setCost] = useState(500)
  const [flash, setFlash] = useState("")

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim().length < 8) {
      setFlash("Tiêu đề cần ít nhất 8 ký tự.")
      return
    }
    if (body.trim().length < 40) {
      setFlash("Nội dung cần ít nhất 40 ký tự để đủ một kiến thức dùng được.")
      return
    }
    const id = `EF-${String(list.length + 1).padStart(2, "0")}`
    setList((ls) => [
      ...ls,
      { id, title: title.trim(), body: body.trim(), cost, open: false },
    ])
    setTitle("")
    setBody("")
    setFlash(`Đã thêm ${id}. Nội dung mới mở sau khi người dùng đủ điểm.`)
  }

  const remove = (id: string) => {
    setList((ls) => ls.filter((f) => f.id !== id))
    setFlash(`Đã xoá ${id}.`)
  }

  const toggle = (id: string) =>
    setList((ls) => ls.map((f) => (f.id === id ? { ...f, open: !f.open } : f)))

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="NỘI DUNG"
        title="Quản lý Eco Fact"
        body="Kiến thức ngắn gắn với cây ảo: người dùng mở bằng điểm đã tích luỹ. Nội dung sai thì cả cây ảo mất ý nghĩa."
      />

      <form onSubmit={add} noValidate className="card flex flex-col gap-5 p-5 md:p-6">
        <Field label="Tiêu đề kiến thức">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Vì sao nắp nhựa phải tách riêng"
          />
        </Field>

        <Field label="Nội dung" hint="Tối đa 3 câu. Có con số thì ghi rõ con số và nguồn của nó.">
          <textarea
            className="input h-auto resize-y py-3 leading-6"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>

        <Field label="Điểm cần để mở" hint="Số điểm tiêu dùng, tức là sẽ bị trừ một lần khi mở.">
          <input
            className="input w-40 tabular-nums"
            type="number"
            min={0}
            step={100}
            value={cost}
            onChange={(e) => setCost(Number(e.target.value))}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button type="submit" className="btn-primary h-11 px-6">
            Thêm Eco Fact
          </button>
          {flash && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {flash}
            </p>
          )}
        </div>
      </form>

      <ul className="grid gap-4 md:grid-cols-2">
        {list.map((f) => (
          <li key={f.id} className="card flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-brand">{f.id}</p>
                <h2 className="text-base leading-6 font-bold text-ink">{f.title}</h2>
              </div>
              <Status tone={f.open ? "ok" : "off"}>{f.open ? "Đang mở" : "Đang khoá"}</Status>
            </div>
            <p className="text-[13px] leading-5 text-body">{f.body}</p>
            <p className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3 text-[13px]">
              <span className="tabular-nums text-muted">
                {f.cost.toLocaleString("vi-VN")} điểm để mở
              </span>
              <span className="flex gap-3">
                <button
                  type="button"
                  onClick={() => toggle(f.id)}
                  className="font-semibold text-brand hover:text-brand-deep"
                >
                  {f.open ? "Khoá" : "Mở miễn phí"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  className="font-semibold text-warn hover:underline"
                >
                  Xoá
                </button>
              </span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}