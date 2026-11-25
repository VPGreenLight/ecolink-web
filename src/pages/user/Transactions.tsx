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

/** U-09 / U-14 Lịch sử biên nhận bàn giao phế liệu.
 *
 *  Tiền mua phế liệu do cơ sở thu mua thanh toán trực tiếp tại chỗ (P2P);
 *  hệ thống lưu trữ chứng từ biên nhận và khối lượng thực cân đối chiếu. */
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
  const receiptFlows = FLOWS.filter((f) => f.kind !== "fee")
  const payout = showOfflineDemo
    ? receiptFlows.filter((f) => f.kind === "payout").reduce((s, f) => s + f.amount, 0)
    : 0
  const last = receiptFlows[0] ?? FLOWS[0]

  const totalPayout = liveData ? liveData.totalAmountCash : payout
  const totalWeight = liveData ? liveData.totalWeightKg : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="BIÊN NHẬN & GIAO DỊCH"
        title="Lịch sử biên nhận bàn giao"
        body="Lưu trữ các biên nhận bàn giao phế liệu đã xác nhận hoàn tất và tổng giá trị đối tác thanh toán trực tiếp."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Giá trị biên nhận"
          value={fmtVnd(totalPayout)}
          note="Tổng tiền đối tác thanh toán trực tiếp"
        />
        <Stat
          label="Tổng rác bàn giao"
          value={`${totalWeight.toLocaleString("vi-VN")} kg`}
          note="Khối lượng phế liệu đã xác nhận"
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
        const offlineItems = receiptFlows.filter(
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
                <Table head={["Ngày", "Mã đơn", "Đối tác", "Khối lượng", "Số tiền nhận", "Thao tác"]}>
                  {pagedLive.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-xs text-muted">
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
                        <Td className="whitespace-nowrap">
                          <div className="flex flex-wrap gap-2 text-xs font-semibold">
                            <Link
                              to={`/user/receipt?orderId=${encodeURIComponent(item.requestId)}`}
                              className="text-brand-deep hover:underline"
                            >
                              Biên nhận &amp; Đánh giá
                            </Link>
                            <span className="text-line">·</span>
                            <Link
                              to={`/chat?orderId=${encodeURIComponent(item.requestId)}`}
                              className="text-brand hover:underline"
                            >
                              Chat
                            </Link>
                            <span className="text-line">·</span>
                            <Link
                              to={`/feedback?orderId=${encodeURIComponent(item.requestId)}`}
                              className="text-warn hover:underline"
                            >
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
                gom, thông tin biên nhận và giá trị thanh toán sẽ tự động ghi nhận tại đây.
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
        Tiền mua phế liệu được cơ sở thu mua thanh toán trực tiếp 100% khi bàn giao
        (nền tảng không giữ tiền hộ và không thu phí hoa hồng). Nếu phát hiện sai
        lệch khối lượng hoặc thanh toán, bạn có thể bấm &ldquo;Khiếu nại&rdquo; trên
        dòng giao dịch tương ứng trong vòng 7 ngày.
      </p>
    </div>
  )
}
