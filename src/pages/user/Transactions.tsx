import { useEffect, useState } from "react"
import { PageHead, Stat, Status, Table, Td } from "@/components/Portal"
import { FLOWS, KIND_LABEL } from "@/data/cashflow"
import { fmtVnd } from "@/data/ops"
import { fetchUserTransactions, type TransactionHistoryDto } from "@/lib/recyclerWorkflowApi"
import { hasLiveBackendAuth } from "@/lib/session"

/** U-14 Xem lịch sử dòng tiền + SYS-01 giải ngân tự động.
 *
 *  Gộp vì SYS-01 là cách những dòng tiền này được tạo ra: không có hàng
 *  "PayOS" nào trên đời mà có hàng này mà không giải thích được nó. Ba loại
 *  dòng dùng chung một bảng để thấy mỗi giao dịch có đủ 3 dòng không —
 *  thiếu dòng nghĩa là tiền bị kẹt, đó là việc người dùng cần thấy. */
export default function Transactions() {
  const liveAuth = hasLiveBackendAuth()
  const [liveData, setLiveData] = useState<TransactionHistoryDto | null>(null)
  const [fromBackend, setFromBackend] = useState(false)
  const [loading, setLoading] = useState<boolean>(() => liveAuth)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await fetchUserTransactions()
        if (!active) return
        if (res.fromBackend || res.data.items.length > 0) {
          setLiveData(res.data)
          setFromBackend(res.fromBackend)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const showOfflineDemo = !loading && !fromBackend && !liveAuth
  const payout = showOfflineDemo
    ? FLOWS.filter((f) => f.kind === "payout").reduce((s, f) => s + f.amount, 0)
    : 0
  const fee = showOfflineDemo
    ? FLOWS.filter((f) => f.kind === "fee").reduce((s, f) => s + f.amount, 0)
    : 0
  const last = FLOWS[0]

  const totalPayout = liveData ? liveData.totalAmountCash : payout
  const totalWeight = liveData ? liveData.totalWeightKg : 0
  const totalPoints = liveData ? liveData.totalPoints : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="DÒNG TIỀN"
        title="Lịch sử tiền vào tài khoản"
        body="Mỗi lần bàn giao thành công tạo ra ba dòng: người thu gom chuyển vào, phí nền tảng giữ lại, và khoản tiền bị bắn về bạn."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Đã nhận"
          value={fmtVnd(totalPayout)}
          note={
            fromBackend
              ? "Tổng tiền thu được từ các đơn hoàn tất (PostgreSQL)"
              : "Tổng tiền về tài khoản"
          }
        />
        <Stat
          label={liveData || liveAuth ? "Tổng rác bàn giao" : "Phí nền tảng"}
          value={liveData || liveAuth ? `${totalWeight.toLocaleString("vi-VN")} kg` : fmtVnd(fee)}
          note={
            liveData || liveAuth
              ? `Tích lũy ${totalPoints} điểm xanh`
              : "Trích trên giao dịch thành công"
          }
        />
        <Stat
          label="Giao dịch gần nhất"
          value={
            liveData?.items[0]?.completedAt.slice(0, 10) || (showOfflineDemo ? last.date : "—")
          }
          note={liveData?.items[0]?.requestCode || (showOfflineDemo ? last.handoverId : "Chưa có giao dịch")}
        />
      </div>

      {loading ? (
        <p className="card px-5 py-8 text-center text-sm text-muted">
          Đang tải lịch sử giao dịch...
        </p>
      ) : liveData && liveData.items.length > 0 ? (
        <Table head={["Ngày", "Mã đơn", "Đối tác", "Khối lượng", "Số tiền nhận", "Điểm xanh"]}>
          {liveData.items.map((item) => (
            <tr key={item.receiptId} className="bg-brand/6">
              <Td className="whitespace-nowrap tabular-nums">
                {new Date(item.completedAt).toLocaleDateString("vi-VN")}
              </Td>
              <Td className="whitespace-nowrap tabular-nums font-medium text-ink">
                {item.requestCode}
              </Td>
              <Td className="whitespace-nowrap">{item.counterpartName}</Td>
              <Td className="tabular-nums font-semibold text-ink">
                {item.totalWeightKg.toLocaleString("vi-VN")} kg
              </Td>
              <Td className="font-semibold tabular-nums text-brand">
                {fmtVnd(item.totalAmountCash)}
              </Td>
              <Td className="tabular-nums font-semibold text-mint-leaf">
                +{item.pointsAwarded} pts
              </Td>
            </tr>
          ))}
        </Table>
      ) : fromBackend || liveAuth ? (
        <p className="card px-5 py-8 text-center text-sm text-muted">
          Tài khoản chưa có giao dịch hoàn tất nào trên hệ thống. Khi bạn xác nhận biên nhận thu
          gom, tiền thanh toán và Điểm Xanh sẽ tự động ghi nhận tại đây.
        </p>
      ) : (
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
      )}

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Nếu một giao dịch có dòng &quot;Thu vào từ đối tác&quot; mà thiếu dòng &quot;Bắn ra về
        tài khoản&quot;, tiền đang bị giữ lại do chưa đối chiếu xong. Báo giúp chúng
        tôi bằng mã giao dịch ở cột Mã.
      </p>
    </div>
  )
}
