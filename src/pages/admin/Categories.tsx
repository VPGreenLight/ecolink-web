import { useState } from "react"
import { PageHead, Field, Status, Table, Td } from "@/components/admin/ui"
import { WASTE_GROUPS, WASTES, VND } from "@/data/waste"
import { fmtInt } from "@/data/ops"

/** A-05 Quản lý danh mục rác hệ thống.
 *
 *  Đây là bảng nguồn: giá và luật xử lý ở đây được đọc bởi `/waste` (tra cứu
 *  của người dân), `/guidance` (hướng dẫn phân loại) và trang bảng giá của cơ
 *  sở thu mua. Sửa ở đây là sửa cả ba nơi, không phải ba bản riêng. */
export default function Categories() {
  const [rows, setRows] = useState(WASTES)
  const [flash, setFlash] = useState("")

  const set = (id: string, patch: Partial<(typeof WASTES)[number]>) =>
    setRows((rs) => rs.map((w) => (w.id === id ? { ...w, ...patch } : w)))

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="CẤU HÌNH"
        title="Danh mục rác hệ thống"
        body="Giá và luật xử lý ở đây là nguồn cho trang tra cứu, hướng dẫn phân loại và bảng giá của cơ sở thu mua. Sửa một chỗ là cả ba nơi cùng đổi."
      />

      <Table head={["Tên loại rác", "Nhóm", "Giá tham khảu", "Thu gom được", "Luật xử lý"]}>
        {rows.map((w) => (
          <tr key={w.id}>
            <Td className="font-semibold text-ink">
              {w.name}
              <span className="block text-[12px] font-normal text-muted">{w.id}</span>
            </Td>
            <Td>
              <select
                className="input h-9 w-32"
                value={w.group}
                onChange={(e) => set(w.id, { group: e.target.value as typeof w.group })}
                aria-label={`Nhóm của ${w.name}`}
              >
                {WASTE_GROUPS.filter((g) => g !== WASTE_GROUPS[0]).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Td>
            <Td>
              <div className="flex items-center gap-2">
                <input
                  className="input h-9 w-28 tabular-nums"
                  type="number"
                  min={0}
                  step={100}
                  value={w.price}
                  disabled={!w.recyclable}
                  onChange={(e) => set(w.id, { price: Number(e.target.value) })}
                  aria-label={`Giá của ${w.name}`}
                />
                <span className="whitespace-nowrap text-[13px] text-muted">đ/kg</span>
              </div>
            </Td>
            <Td>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={w.recyclable}
                  onChange={(e) => set(w.id, { recyclable: e.target.checked })}
                />
                <span className="text-[13px] text-body">
                  {w.recyclable ? "Có" : "Không"}
                </span>
              </label>
            </Td>
            <Td>
              <input
                className="input h-9"
                value={w.rule}
                onChange={(e) => set(w.id, { rule: e.target.value })}
                aria-label={`Luật xử lý của ${w.name}`}
              />
            </Td>
          </tr>
        ))}
      </Table>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setFlash("Đã lưu. Tra cứu và hướng dẫn phân loại dùng luôn giá mới.")}
          className="btn-primary h-11 px-6"
        >
          Lưu thay đổi
        </button>
        <p className="text-[13px] text-muted">
          Tổng {fmtInt(rows.filter((w) => w.recyclable).length)} loại thu gom được,{" "}
          {fmtInt(rows.filter((w) => !w.recyclable).length)} loại không thu gom. Giá
          cao nhất {VND(Math.max(...rows.map((w) => w.price)))}/kg.
        </p>
        {flash && (
          <p role="status" className="text-[13px] font-semibold text-brand">
            {flash}
          </p>
        )}
      </div>

      <section>
        <h2 className="text-base font-bold text-ink">Thêm loại rác mới</h2>
        <AddForm onAdd={(w) => setRows((rs) => [...rs, w])} />
      </section>

      <Status tone="wait">
        Giá mới chỉ áp dụng cho các yêu cầu tạo sau này. Yêu cầu đã chốt giữ nguyên
        giá đã báo.
      </Status>
    </div>
  )
}

function AddForm({ onAdd }: { onAdd: (w: (typeof WASTES)[number]) => void }) {
  const [name, setName] = useState("")
  const [price, setPrice] = useState(2_000)
  const [rule, setRule] = useState("")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim().length < 3 || rule.trim().length < 10) return
        onAdd({
          id: `w-${Date.now().toString(36)}`,
          name: name.trim(),
          group: "Nhựa",
          price,
          recyclable: true,
          rule: rule.trim(),
          prep: "Làm sạch và tách vật liệu khác nếu có.",
        })
        setName("")
        setRule("")
      }}
      noValidate
      className="card mt-3 grid gap-4 p-5 md:grid-cols-[1fr_140px] md:p-6"
    >
      <div className="flex flex-col gap-4">
        <Field label="Tên loại rác">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Nhựa PVC ống nước"
          />
        </Field>
        <Field label="Luật xử lý" hint="Câu này hiện cho người dân ở trang hướng dẫn phân loại.">
          <input
            className="input"
            value={rule}
            onChange={(e) => setRule(e.target.value)}
            placeholder="Ống nước PVC, không thu gom chung với nhựa khác."
          />
        </Field>
      </div>
      <Field label="Giá (đ/kg)">
        <input
          className="input tabular-nums"
          type="number"
          min={0}
          step={100}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
      </Field>
      <div className="md:col-span-2">
        <button type="submit" className="btn-primary h-11 px-6">
          Thêm vào danh mục
        </button>
      </div>
    </form>
  )
}