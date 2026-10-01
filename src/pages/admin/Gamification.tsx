import { useState } from "react"
import { PageHead, Field, Stat, Table, Td } from "@/components/admin/ui"
import { GAMIFICATION, ECO_FACTS } from "@/data/ops"

/** A-07 Cấu hình gamification: tỷ lệ điểm và mốc level cây ảo.
 *
 *  Mốc level nối thẳng với Eco Fact: mỗi hạng có một "chi phí mở khoá" cho
 *  nhánh cây. Hai bảng đặt cạnh nhau vì sửa hạng mà quên nhánh cây thì người
 *  dùng lên hạng xong không mở được gì. */
export default function GamificationConfig() {
  const [pointsPerKg, setPointsPerKg] = useState(GAMIFICATION.pointsPerKg)
  const [labelBonus, setLabelBonus] = useState(GAMIFICATION.labelBonus)
  const [tiers, setTiers] = useState([...GAMIFICATION.tiers])
  const [flash, setFlash] = useState("")

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="CẤU HÌNH"
        title="Cấu hình điểm và hạng cây ảo"
        body="Điểm người dùng tích luỹ từ giao rác đúng phân loại. Đổi hạng hoặc đổi điểm thưởng ở đây sẽ áp dụng cho tất cả tài khoản."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setFlash("Đã lưu cấu hình điểm.")
          }}
          className="card flex flex-col gap-5 p-5 md:p-6"
        >
          <Field
            label="Điểm mỗi kg bàn giao đúng loại"
            hint="Tính trên khối lượng người dùng xác nhận, không phải khối lượng ước tính."
          >
            <input
              className="input tabular-nums"
              type="number"
              min={0}
              value={pointsPerKg}
              onChange={(e) => setPointsPerKg(Number(e.target.value))}
            />
          </Field>

          <Field label="Điểm thưởng khi gán nhãn AI đúng" hint="Dành cho nhân viên vận hành.">
            <input
              className="input tabular-nums"
              type="number"
              min={0}
              value={labelBonus}
              onChange={(e) => setLabelBonus(Number(e.target.value))}
            />
          </Field>

          <button type="submit" className="btn-primary h-11 px-6">
            Lưu cấu hình
          </button>
          {flash && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {flash}
            </p>
          )}
        </form>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Hạng hiện có"
              value={String(tiers.length)}
              note="Từ Mầm tới Đại dương"
            />
            <Stat
              label="Eco Fact đã gắn hạng"
              value={String(ECO_FACTS.length)}
              note="Mở khoá bằng điểm tiêu dùng"
            />
            <Stat
              label="Điểm cần cho hạng cao nhất"
              value={tiers[tiers.length - 1].min.toLocaleString("vi-VN")}
              note="Tích luỹ trọn đời"
            />
          </div>

          <Table head={["Hạng", "Điểm tối thiểu", "Chi phí mở Eco Fact"]}>
            {tiers.map((t, i) => (
              <tr key={t.name}>
                <Td className="font-semibold text-ink">{t.name}</Td>
                <Td>
                  <input
                    className="input h-9 w-32 tabular-nums"
                    type="number"
                    min={0}
                    step={1000}
                    value={t.min}
                    disabled={i === 0}
                    onChange={(e) =>
                      setTiers((ts) =>
                        ts.map((x, n) =>
                          n === i ? { ...x, min: Number(e.target.value) } : x,
                        ),
                      )
                    }
                    aria-label={`Điểm tối thiểu của hạng ${t.name}`}
                  />
                </Td>
                <Td>
                  <input
                    className="input h-9 w-32 tabular-nums"
                    type="number"
                    min={0}
                    step={100}
                    value={t.factCost}
                    onChange={(e) =>
                      setTiers((ts) =>
                        ts.map((x, n) =>
                          n === i ? { ...x, factCost: Number(e.target.value) } : x,
                        ),
                      )
                    }
                    aria-label={`Chi phí mở Eco Fact của hạng ${t.name}`}
                  />
                </Td>
              </tr>
            ))}
          </Table>

          <button
            type="button"
            onClick={() =>
              setTiers((ts) => [
                ...ts,
                {
                  name: `Hạng ${ts.length + 1}`,
                  min: ts[ts.length - 1].min + 10_000,
                  factCost: 2_500,
                },
              ])
            }
            className="btn-ghost h-11 w-fit px-5"
          >
            Thêm hạng mới
          </button>
        </div>
      </div>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Điểm xếp hạng tích luỹ trọn đời và không bị trừ khi đổi quà; điểm tiêu
        dùng mới bị trừ. Tách hai loại là để người dùng dám đổi — nếu một con
        số vừa xếp hạng vừa là tiền thì đổi quà là tụt hạng, họ sẽ không đổi.
      </p>
    </div>
  )
}