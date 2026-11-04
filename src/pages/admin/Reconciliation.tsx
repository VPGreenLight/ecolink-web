import { PageHead, Stat, Status, Table, Td } from "@/components/admin/ui"
import { FLOWS, KIND_LABEL } from "@/data/cashflow"
import { FEE, fmtInt, fmtVnd } from "@/data/ops"

/** A-11 Đối soát dòng tiền.
 *
 *  Bảng đối soát gom theo mã bàn giao thay vì liệt kê từng dòng tiền: mỗi giao
 *  dịch có 3 dòng (pay-in, phí, pay-out) và việc cần chứng minh là 3 dòng đó
 *  khớp nhau. Bảng theo dòng sẽ phải tự dò ba dòng cạnh nhau bằng mắt.
 *
 *  Trạng thái tính từ dữ liệu chứ không lưu: đã đủ 3 dòng và tổng khớp là
 *  "Đã đối soát", lệch là "Chênh lệch". Lưu kết luận riêng là có thêm chỗ
 *  để trạng thái và dữ liệu lệch nhau. */
export default function Reconciliation() {
  const groups = [...new Set(FLOWS.map((f) => f.handoverId))]
    .map((id) => {
      const rows = FLOWS.filter((f) => f.handoverId === id)
      const payin = rows.find((r) => r.kind === "payin")?.amount ?? 0
      const fee = rows.find((r) => r.kind === "fee")?.amount ?? 0
      const payout = rows.find((r) => r.kind === "payout")?.amount ?? 0
      const expectedFee = Math.round(payin * FEE.rate)
      const ok = payin - fee === payout && fee === expectedFee
      return { id, rows, payin, fee, payout, expectedFee, ok }
    })
    .sort((a, b) => (a.id < b.id ? 1 : -1))

  const totalFee = groups.reduce((s, g) => s + g.fee, 0)
  const matched = groups.filter((g) => g.ok).length

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="TÀI CHÍNH"
        title="Đối soát và dòng tiền"
        body="Mỗi giao dịch có ba dòng: tiền đối tác chuyển vào, phí nền tảng giữ lại, và tiền bắn về người dân. Giao dịch khớp cả ba là đã đối soát."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Giao dịch trong kỳ" value={String(groups.length)} />
        <Stat label="Đã đối soát" value={String(matched)} note="Ba dòng khớp nhau" />
        <Stat
          label="Còn chênh lệch"
          value={String(groups.length - matched)}
          note="Cần tra webhook VietQR"
        />
        <Stat label="Phí thu được" value={fmtVnd(totalFee)} note={`Tỷ lệ đang áp dụng ${(FEE.rate * 100).toFixed(0)}%`} />
      </div>

      <section>
        <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
          Đối soát theo giao dịch
        </h2>
        <div className="mt-4">
          <Table
            head={[
              "Mã bàn giao",
              "Tiền vào từ đối tác",
              "Phí phải thu",
              "Phí thực thu",
              "Tiền về người dân",
              "Kết quả",
            ]}
          >
            {groups.map((g) => (
              <tr key={g.id}>
                <Td className="tabular-nums font-semibold whitespace-nowrap text-ink">
                  {g.id}
                </Td>
                <Td className="tabular-nums whitespace-nowrap">{fmtVnd(g.payin)}</Td>
                <Td className="tabular-nums whitespace-nowrap text-muted">
                  {fmtVnd(g.expectedFee)}
                </Td>
                <Td className="tabular-nums whitespace-nowrap">{fmtVnd(g.fee)}</Td>
                <Td className="tabular-nums whitespace-nowrap">{fmtVnd(g.payout)}</Td>
                <Td>
                  <Status tone={g.ok ? "ok" : "off"}>
                    {g.ok ? "Đã đối soát" : "Chênh lệch"}
                  </Status>
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </section>

      <section>
        <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
          Dòng tiền chi tiết
        </h2>
        <p className="mt-1 text-sm text-muted">
          Ba dòng của mỗi giao dịch nằm cạnh nhau để đối chiếu bằng mắt khi tra
          webhook.
        </p>
        <div className="mt-4">
          <Table head={["Ngày", "Mã bàn giao", "Loại", "Số tiền", "Đối tác / đích nhận"]}>
            {FLOWS.map((f) => (
              <tr key={f.id}>
                <Td className="tabular-nums whitespace-nowrap">{f.date}</Td>
                <Td className="tabular-nums whitespace-nowrap">{f.handoverId}</Td>
                <Td>
                  <Status tone={f.kind === "payout" ? "ok" : f.kind === "fee" ? "off" : "wait"}>
                    {KIND_LABEL[f.kind]}
                  </Status>
                </Td>
                <Td className="font-semibold tabular-nums whitespace-nowrap text-ink">
                  {fmtInt(f.amount)} đ
                </Td>
                <Td>{f.party}</Td>
              </tr>
            ))}
          </Table>
        </div>
      </section>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Giao dịch chênh lệch thường do webhook VietQR đến muộn hơn lúc người dùng
        xác nhận biên nhận: tiền chưa về nên hệ thống chưa giải ngân. Hệ thống tự
        bắn lại khi webhook tới, quá 24 giờ thì cần tra thủ công.
      </p>
    </div>
  )
}