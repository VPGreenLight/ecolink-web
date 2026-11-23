import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import PaginationBar, { FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import { PageHead, Stat, Status, Table, TableSkeleton, Td } from "@/components/Portal"
import SearchFilterBar from "@/components/SearchFilterBar"
import { FLOWS, KIND_LABEL } from "@/data/cashflow"
import { fmtVnd } from "@/data/ops"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { initApiLoading, isSsrSmokeTest } from "@/lib/hydration"
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
  const [loading, setLoading] = useState<boolean>(() => initApiLoading(true))
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)
  const [page, setPage] = useState(1)
  const pageSize = FIXED_PAGE_SIZE

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await fetchUserTransactions(undefined, undefined, 1, 100)
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

  const showOfflineDemo = isSsrSmokeTest() && !loading && !fromBackend && !liveAuth
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
        body="Lưu trữ biên nhận các lượt bàn giao đã xác nhận, tổng giá trị đối tác thanh toán và Điểm Xanh tích lũy của bạn."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Đã nhận"
          value={fmtVnd(totalPayout)}
          note={
            fromBackend
              ? "Tổng tiền thu được từ các đơn hoàn tất"
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

      {(() => {
        const kw = debouncedSearch.trim().toLowerCase()
        const liveItems = (liveData?.items ?? []).filter(
          (item) =>
            !kw ||
            `${item.requestCode} ${item.counterpartName} ${item.receiptId}`.toLowerCase().includes(kw),
        )
        const pagedLive = paginateItems(liveItems, page, pageSize)
        const offlineItems = FLOWS.filter(
          (f) => !kw || `${f.handoverId} ${f.party} ${f.note} ${KIND_LABEL[f.kind]}`.toLowerCase().includes(kw),
        )
        const pagedOffline = paginateItems(offlineItems, page, pageSize)

        return (
          <>
            <SearchFilterBar
              value={search}
              onChange={(v) => {
                setSearch(v)
                setPage(1)
              }}
              label="Tìm kiếm giao dịch"
              placeholder="Tìm theo mã đơn, tên cơ sở thu mua..."
              totalCount={liveData ? liveItems.length : fromBackend || liveAuth ? 0 : offlineItems.length}
              countLabel="giao dịch"
            />

            {loading ? (
              <TableSkeleton rows={4} />
            ) : liveData && liveData.items.length > 0 ? (
              <>
                <Table head={["Ngày", "Mã đơn", "Đối tác", "Khối lượng", "Số tiền nhận", "Điểm xanh", "Thao tác"]}>
                  {pagedLive.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-xs text-muted">
                        Không có giao dịch nào khớp từ khóa tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    pagedLive.map((item) => (
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
                        <Td className="whitespace-nowrap">
                          <div className="flex flex-wrap gap-2 text-xs font-semibold">
                            <Link to="/user/receipt" className="text-brand-deep hover:underline">
                              Biên nhận &amp; Đánh giá
                            </Link>
                            <span className="text-line">·</span>
                            <Link to="/chat" className="text-brand hover:underline">
                              Chat
                            </Link>
                            <span className="text-line">·</span>
                            <Link to="/feedback" className="text-warn hover:underline">
                              Khiếu nại
                            </Link>
                          </div>
                        </Td>
                      </tr>
                    ))
                  )}
                </Table>
                <PaginationBar
                  page={page}
                  pageSize={pageSize}
                  totalCount={liveItems.length}
                  onPageChange={setPage}
                  itemLabel="giao dịch"
                />
              </>
            ) : !isSsrSmokeTest() ? (
              <p className="card px-5 py-8 text-center text-sm text-muted">
                Tài khoản chưa có giao dịch hoàn tất nào trên hệ thống. Khi bạn xác nhận biên nhận thu
                gom, tiền thanh toán và Điểm Xanh sẽ tự động ghi nhận tại đây.
              </p>
            ) : (
              <>
                <Table head={["Ngày", "Mã", "Loại", "Số tiền", "Đối tác", "Ghi chú", "Thao tác"]}>
                  {pagedOffline.map((f) => (
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
                      <Td className="whitespace-nowrap">
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                          <Link
                            to={`/user/receipt?orderId=${encodeURIComponent(f.handoverId)}`}
                            className="text-brand-deep hover:underline"
                          >
                            Biên nhận &amp; Đánh giá
                          </Link>
                          <span className="text-line">·</span>
                          <Link
                            to={`/chat?orderId=${encodeURIComponent(f.handoverId)}`}
                            className="text-brand hover:underline"
                          >
                            Chat
                          </Link>
                          <span className="text-line">·</span>
                          <Link
                            to={`/feedback?orderId=${encodeURIComponent(f.handoverId)}`}
                            className="text-warn hover:underline"
                          >
                            Khiếu nại
                          </Link>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </Table>
                <PaginationBar
                  page={page}
                  pageSize={pageSize}
                  totalCount={offlineItems.length}
                  onPageChange={setPage}
                  itemLabel="giao dịch"
                />
              </>
            )}
          </>
        )
      })()}

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Nếu một giao dịch có dòng &quot;Thu vào từ đối tác&quot; mà thiếu dòng &quot;Bắn ra về
        tài khoản&quot;, tiền đang bị giữ lại do chưa đối chiếu xong. Báo giúp chúng
        tôi bằng mã giao dịch ở cột Mã.
      </p>
    </div>
  )
}
