import { useState } from "react"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import { VND, WASTES } from "@/data/waste"

const priceOf = (id: string) => WASTES.find((w) => w.id === id)?.price ?? 0

type Row = { id: string; on: boolean; price: number }

/** R-01 Danh mục thu mua & bảng giá.
 *
 *  Bảng giá đặt ở đây và giá ở `/waste` (tra cứu của người dân) là hai con số
 *  khác nhau có chủ ý: giá hệ thống là mức trần tham khảo để người dân biết
 *  mình bán được bao nhiêu, giá ở đây là giá cơ sở thật sự trả. Người dùng
 *  luôn thấy con số hệ thống nên không bị bất ngờ. */
export default function Catalog() {
  const [rows, setRows] = useState<Row[]>(() =>
    WASTES.filter((w) => w.recyclable).map((w) => ({ id: w.id, on: true, price: w.price })),
  )
  const [dirty, setDirty] = useState(false)

  const set = (id: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setDirty(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="THU MUA"
        title="Danh mục và bảng giá"
        body="Chọn loại rác bạn thu mua và đặt giá trả cho người dân. Loại tắt sẽ không hiện trên bản đồ và người dân không đặt được."
        action={
          <button
            type="button"
            disabled={!dirty}
            onClick={() => setDirty(false)}
            className="btn-primary h-11 shrink-0 px-5"
          >
            Lưu thay đổi
          </button>
        }
      />

      <Table head={["Loại rác", "Nhóm", "Thu mua", "Giá bạn trả", "Giá hệ thống"]}>
        {rows.map((r) => {
          const w = WASTES.find((x) => x.id === r.id)!
          return (
            <tr key={r.id}>
              <Td className="font-semibold text-ink">{w.name}</Td>
              <Td>{w.group}</Td>
              <Td>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    checked={r.on}
                    onChange={(e) => set(r.id, { on: e.target.checked })}
                  />
                  <span className="text-[13px] text-body">
                    {r.on ? "Có" : "Không"}
                  </span>
                </label>
              </Td>
              <Td>
                <input
                  className="input h-9 w-32 tabular-nums"
                  type="number"
                  min={0}
                  step={100}
                  disabled={!r.on}
                  value={r.price}
                  onChange={(e) => set(r.id, { price: Number(e.target.value) })}
                  aria-label={`Giá thu mua ${w.name}`}
                />
              </Td>
              <Td className="tabular-nums text-muted">{VND(priceOf(r.id))}</Td>
            </tr>
          )
        })}
      </Table>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Giá hệ thống là mức trần EcoLink hiển thị cho người dân. Không đặt cao
        hơn mức đó — yêu cầu sẽ bị từ chối khi đối soát dòng tiền.
      </p>

      <Status tone="wait">
        Đổi bảng giá chỉ áp dụng cho yêu cầu tạo sau đây, không đổi giá của các
        yêu cầu đã chốt.
      </Status>
    </div>
  )
}