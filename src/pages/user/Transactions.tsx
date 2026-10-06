import { PageHead, Stat, Status, Table, Td } from "@/components/Portal"
import { FLOWS, KIND_LABEL } from "@/data/cashflow"
import { fmtVnd } from "@/data/ops"

/** U-14 Xem lịch sử dòng tiền + SYS-01 giải ngân tự động.
 *
 *  Gộp vì SYS-01 là cách những dòng tiền này được tạo ra: không có hàng
 *  "PayOS" nào trên đời mà có hàng này mà không giải thích được nó. Ba loại
 *  dòng dùng chung một bảng để thấy mỗi giao dịch có đủ 3 dòng không —
 *  thiếu dòng nghĩa là tiền bị kẹt, đó là việc người dùng cần thấy. */
export default function Transactions() {
  const payout = FLOWS.filter((f) => f.kind === "payout").reduce((s, f) => s + f.amount, 0)
  const fee = FLOWS.filter((f) => f.kind === "fee").reduce((s, f) => s + f.amount, 0)
  const last = FLOWS[0]

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="DÒNG TIỀN"
        title="Lịch sử tiền vào tài khoản"
        body="Mỗi lần bàn giao thành công tạo ra ba dòng: người thu gom chuyển vào, phí nền tảng giữ lại, và khoản tiền bị bắn về bạn."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Đã nhận" value={fmtVnd(payout)} note="Tổng tiền về tài khoản" />
        <Stat label="Phí nền tảng" value={fmtVnd(fee)} note="Trích trên giao dịch thành công" />
        <Stat label="Giao dịch gần nhất" value={last.date} note={last.handoverId} />
      </div>

      <Table head={["Ngày", "Mã", "Loại", "Số tiền", "Đối tác", "Ghi chú"]}>
        {FLOWS.map((f) => (
          <tr key={f.id} className={f.kind === "payout" ? "bg-brand/6" : ""}>
            <Td className="whitespace-nowrap tabular-nums">{f.date}</Td>
            <Td className="whitespace-nowrap tabular-nums">{f.handoverId}</Td>
            <Td>
              <Status tone={f.kind === "payout" ? "ok" : f.kind === "fee" ? "off" : "wait"}>
                {KIND_LABEL[f.kind]}
              </Status>
            </Td>
            <Td className="font-semibold tabular-nums text-ink">
              {f.kind === "fee" ? "−" : ""}
              {fmtVnd(f.amount)}
            </Td>
            <Td className="whitespace-nowrap">{f.party}</Td>
            <Td>{f.note}</Td>
          </tr>
        ))}
      </Table>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Nếu một giao dịch có dòng "Thu vào từ đối tác" mà thiếu dòng "Bãn ra về
        tài khoản", tiền đang bị giữ lại do chưa đối chiếu xong. Báo giúp chúng
        tôi bằng mã giao dịch ở cột Mã.
      </p>
    </div>
  )
}