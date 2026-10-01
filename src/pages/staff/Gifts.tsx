import { useState } from "react"
import { PageHead, Field, Status, Table, Td } from "@/components/Portal"
import { GIFTS, type Gift } from "@/data/ops"

/** S-10 Quản lý kho quà tặng.
 *
 *  `stock: null` nghĩa là không giới hạn (voucher), không phải "chưa nhập số".
 *  Khoảng trống đó dễ gây hiểu nhầm nên trong bảng hiện thành chữ "Không giới
 *  hạn" chứ không để ô số trống. */
export default function Gifts() {
  const [list, setList] = useState<Gift[]>(GIFTS)
  const [name, setName] = useState("")
  const [cost, setCost] = useState(2_000)
  const [stock, setStock] = useState(50)
  const [flash, setFlash] = useState("")

  const set = (id: string, patch: Partial<Gift>) =>
    setList((ls) => ls.map((g) => (g.id === id ? { ...g, ...patch } : g)))

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 5) {
      setFlash("Tên quà cần ít nhất 5 ký tự.")
      return
    }
    const id = `g-${Date.now().toString(36)}`
    setList((ls) => [...ls, { id, name: name.trim(), cost, stock, kind: "gift", active: true }])
    setName("")
    setFlash(`Đã thêm ${name.trim()}. Người dùng thấy nó ngay ở trang đổi thưởng.`)
  }

  const remove = (id: string) => {
    setList((ls) => ls.filter((g) => g.id !== id))
    setFlash("Đã xoá món quà khỏi kho.")
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="KHO QUÀ"
        title="Quà tặng và voucher"
        body="Tồn kho là thứ người dùng thấy trước khi đổi. Số vượt 15 món thì gắn nhãn khan hiếm, số 0 thì ẩn khỏi trang đổi."
      />

      <form onSubmit={add} noValidate className="card flex flex-col gap-5 p-5 md:p-6">
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr_1fr]">
          <Field label="Tên quà">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Bộ dụng cụ thu gom gia đình"
            />
          </Field>
          <Field label="Điểm đổi">
            <input
              className="input tabular-nums"
              type="number"
              min={0}
              step={500}
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
            />
          </Field>
          <Field label="Tồn kho">
            <input
              className="input tabular-nums"
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button type="submit" className="btn-primary h-11 px-6">
            Thêm vào kho
          </button>
          {flash && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {flash}
            </p>
          )}
        </div>
      </form>

      <Table head={["Quà", "Loại", "Điểm", "Tồn kho", "Trạng thái", ""]}>
        {list.map((g) => (
          <tr key={g.id}>
            <Td className="font-semibold text-ink">{g.name}</Td>
            <Td className="whitespace-nowrap">
              {g.kind === "voucher" ? "Voucher" : "Quà vật lý"}
            </Td>
            <Td>
              <input
                className="input h-9 w-28 tabular-nums"
                type="number"
                min={0}
                step={500}
                value={g.cost}
                onChange={(e) => set(g.id, { cost: Number(e.target.value) })}
                aria-label={`Điểm đổi của ${g.name}`}
              />
            </Td>
            <Td>
              {g.stock === null ? (
                <span className="text-[13px] text-muted">Không giới hạn</span>
              ) : (
                <input
                  className="input h-9 w-24 tabular-nums"
                  type="number"
                  min={0}
                  value={g.stock}
                  onChange={(e) => set(g.id, { stock: Number(e.target.value) })}
                  aria-label={`Tồn kho của ${g.name}`}
                />
              )}
            </Td>
            <Td>
              <Status tone={g.active ? "ok" : "off"}>
                {g.active ? "Đang mở" : "Đang ẩn"}
              </Status>
            </Td>
            <Td>
              <span className="flex gap-3">
                <button
                  type="button"
                  onClick={() => set(g.id, { active: !g.active })}
                  className="text-[13px] font-semibold text-brand hover:text-brand-deep"
                >
                  {g.active ? "Ẩn" : "Hiện"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(g.id)}
                  className="text-[13px] font-semibold text-warn hover:underline"
                >
                  Xoá
                </button>
              </span>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  )
}