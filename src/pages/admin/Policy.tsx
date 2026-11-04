import { useState } from "react"
import { PageHead, Field, Status } from "@/components/admin/ui"
import { GAMIFICATION } from "@/data/ops"
import { WASTES } from "@/data/waste"

/** A-06 Thiết lập chính sách phân loại (Rule Engine).
 *
 *  Rule ở đây là câu chữ hiện cho người dân ở `/guidance` và ở trang nhận
 *  diện AI. Không có bộ luật điều kiện riêng: nếu cần một luật phức tạp (rác
 *  nào ở khu vực nào thì giá bao nhiêu) thì viết thành câu rõ ràng ở đây —
 *  Rule Engine chỉ lấy câu đó ra hiển thị, không tự suy luận. */
export default function Policy() {
  const [rules, setRules] = useState(
    WASTES.filter((w) => w.recyclable).map((w) => ({ ...w })),
  )
  const [flash, setFlash] = useState("")

  const set = (id: string, patch: Partial<(typeof rules)[number]>) =>
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="CẤU HÌNH"
        title="Chính sách phân loại rác"
        body="Câu chữ ở đây hiện thẳng cho người dân ở hướng dẫn phân loại và trong kết quả nhận diện AI. Viết sao cho người đọc không phải đoán."
      />

      <ul className="grid gap-4 lg:grid-cols-2">
        {rules.map((r) => (
          <li key={r.id} className="card flex flex-col gap-3 p-5">
            <p className="text-base font-bold text-ink">{r.name}</p>
            <Field label="Câu luật hiện cho người dân">
              <input
                className="input"
                value={r.rule}
                onChange={(e) => set(r.id, { rule: e.target.value })}
              />
            </Field>
            <Field label="Hướng dẫn chuẩn bị">
              <textarea
                className="input h-auto resize-y py-3 leading-6"
                rows={2}
                value={r.prep}
                onChange={(e) => set(r.id, { prep: e.target.value })}
              />
            </Field>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() =>
            setFlash("Đã lưu. Hướng dẫn phân loại và kết quả AI hiện câu mới ngay.")
          }
          className="btn-primary h-11 px-6"
        >
          Lưu chính sách
        </button>
        {flash && (
          <p role="status" className="text-[13px] font-semibold text-brand">
            {flash}
          </p>
        )}
      </div>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-base font-bold text-ink">
          Điểm thưởng theo khối lượng
        </h2>
        <p className="text-sm leading-6 text-body">
          Người dùng nhận{" "}
          <b className="tabular-nums text-ink">{GAMIFICATION.pointsPerKg}</b> điểm
          xanh cho mỗi kg bàn giao đúng loại đã thẩm định. Đây là con số dùng
          chung với bảng xếp hạng và đổi thưởng — đổi ở đây thì cả hai nơi đổi
          theo.
        </p>
        <Status tone="wait">
          Bảng điểm hiện ở trang đổi thưởng là dữ liệu mô phỏng. Nối API thì đọc
          từ cấu hình này, đừng hardcode ở trang.
        </Status>
      </section>
    </div>
  )
}