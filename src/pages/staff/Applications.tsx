import { useState } from "react"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import { APPLICATIONS, type Application } from "@/data/ops"

/** S-04 Thẩm định hồ sơ đối tác thu mua. Hồ sơ từ chối phải có lý do vì cơ sở
 *  đã nộp giấy tờ và chờ kết quả — từ chối không nói lý do thì họ không biết
 *  phải bổ sung gì, và sẽ nộp lại y hệt. */
export default function Applications() {
  const [list, setList] = useState<Application[]>(APPLICATIONS)
  const [flash, setFlash] = useState("")

  const decide = (id: string, ok: boolean) => {
    let note: string | undefined
    if (!ok) {
      const reason = window.prompt(`Từ chối hồ sơ ${id}. Lý do (cơ sở sẽ thấy lý do này):`)
      if (!reason?.trim()) return
      note = reason.trim()
    }
    setList((ls) =>
      ls.map((a) =>
        a.id === id ? { ...a, status: ok ? "approved" : "rejected", note } : a,
      ),
    )
    setFlash(
      ok
        ? `${id}: đã duyệt.`
        : `${id}: đã từ chối với lý do "${note}".`,
    )
  }

  const pending = list.filter((a) => a.status === "pending")
  const done = list.filter((a) => a.status !== "pending")

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="ĐỐI TÁC"
        title="Thẩm định hồ sơ cơ sở thu mua"
        body="Chỉ duyệt khi giấy phép còn hiệu lực và địa chỉ trùng với nơi thu gom thực tế. Từ chối thì phải nói lý do để họ bổ sung được."
      />

      <section>
        <h2 className="text-base font-bold text-ink">Chờ thẩm định ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="card mt-3 px-5 py-8 text-center text-sm text-muted">
            Không có hồ sơ nào đang chờ.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {pending.map((a) => (
              <li key={a.id} className="card flex flex-col gap-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{a.name}</p>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {a.id} · {a.date} · {a.address}
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-[13px] text-body">
                    {a.materials}
                  </span>
                </div>

                <div>
                  <p className="text-[13px] font-semibold text-ink">
                    Giấy tờ đã đính kèm
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {a.docs.map((d) => (
                      <li
                        key={d}
                        className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-body"
                      >
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-line-soft pt-4">
                  <button
                    type="button"
                    onClick={() => decide(a.id, true)}
                    className="btn-primary h-11 px-6"
                  >
                    Duyệt hồ sơ
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(a.id, false)}
                    className="btn-ghost h-11 px-5"
                  >
                    Từ chối
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold text-ink">Đã xử lý</h2>
        <div className="mt-3">
          <Table head={["Mã", "Tên cơ sở", "Địa chỉ", "Ngày nộp", "Kết quả", "Lý do"]}>
            {done.map((a) => (
              <tr key={a.id}>
                <Td className="tabular-nums whitespace-nowrap">{a.id}</Td>
                <Td className="font-semibold text-ink">{a.name}</Td>
                <Td>{a.address}</Td>
                <Td className="tabular-nums whitespace-nowrap">{a.date}</Td>
                <Td>
                  <Status tone={a.status === "approved" ? "ok" : "off"}>
                    {a.status === "approved" ? "Đã duyệt" : "Từ chối"}
                  </Status>
                </Td>
                <Td>{a.note ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        </div>
      </section>

      {flash && (
        <p role="status" className="text-[13px] font-semibold text-brand">
          {flash}
        </p>
      )}
    </div>
  )
}