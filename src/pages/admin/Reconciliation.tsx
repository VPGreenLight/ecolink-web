import { useCallback, useEffect, useState } from "react"
import { Download, FileJson, RefreshCw, ShieldCheck, Wrench, X } from "lucide-react"
import PaginationBar, { extractPagedMeta, FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import { Empty, Field, FormRequiredLegend, PageHead, Stat, Status, Table, Td } from "@/components/admin/ui"
import { fmtInt, fmtVnd } from "@/data/ops"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { initApiLoading, initApiState } from "@/lib/hydration"
import { maskEmailClient, maskPhoneClient } from "@/lib/governanceApi"
import {
  exportReconciliationReportBlob,
  getAdminReconciliationLedger,
  resolveReconciliationAnomaly,
  type ReconciliationActionType,
  type ReconciliationLedgerItemDto,
  type ReconciliationSummaryDto,
} from "@/lib/servicePackageApi"
import { getAccessToken } from "@/lib/session"

const DEMO_SUMMARY: ReconciliationSummaryDto = {
  totalMatchedRevenueVnd: 1_118_000,
  pendingOrdersCount: 2,
  openAnomaliesCount: 4,
  totalDiscrepancyVnd: 65_000,
  totalRefundedVnd: 50_000,
}

const DEMO_LEDGER: ReconciliationLedgerItemDto[] = [
  {
    recordType: "Order",
    referenceCode: "ECO2611161001",
    userId: "u-demo-1",
    payerName: "Cơ sở Phế Liệu EcoGreen",
    payerEmail: "ecogreen@partner.vn",
    payerPhone: "0988776655",
    payerRole: "Recycler",
    packageCode: "PRO",
    packageName: "Pro (Tích xanh 365 ngày)",
    expectedAmountVnd: 1_000_000,
    paidAmountVnd: 1_000_000,
    discrepancyVnd: 0,
    bankCode: "MB",
    paymentReference: "FT261116000188",
    orderStatus: "Paid",
    reconciliationStatus: "Matched",
    anomalyType: "None",
    rawWebhookJson: JSON.stringify(
      {
        orderCode: "ECO2611161001",
        amount: 1_000_000,
        reference: "FT261116000188",
        description: "ECOLINK ECO2611161001",
        counterAccountBankName: "MB Bank",
      },
      null,
      2,
    ),
    createdAt: "2026-11-16T02:15:00Z",
    paidAt: "2026-11-16T02:16:12Z",
  },
  {
    recordType: "Order",
    referenceCode: "ECO2611161002",
    userId: "u-demo-2",
    payerName: "Nguyễn Minh Đức",
    payerEmail: "duc.nguyen@citizen.vn",
    payerPhone: "0912345678",
    payerRole: "User",
    packageCode: "PREMIUM",
    packageName: "Premium (Tắt quảng cáo)",
    expectedAmountVnd: 59_000,
    paidAmountVnd: 50_000,
    discrepancyVnd: -9_000,
    bankCode: "VCB",
    paymentReference: "FT261116000241",
    orderStatus: "Pending",
    reconciliationStatus: "Underpaid",
    anomalyType: "Underpaid",
    anomalyNote: "Khách chuyển thiếu 9.000 đ (nhận 50.000 đ / 59.000 đ). Gói chưa kích hoạt.",
    rawWebhookJson: JSON.stringify(
      {
        orderCode: "ECO2611161002",
        amount: 50_000,
        reference: "FT261116000241",
        description: "ECOLINK ECO2611161002",
      },
      null,
      2,
    ),
    createdAt: "2026-11-16T03:05:00Z",
    paidAt: "2026-11-16T03:06:30Z",
  },
  {
    recordType: "Order",
    referenceCode: "ECO2611161003",
    userId: "u-demo-3",
    payerName: "Trần Thu Hà",
    payerEmail: "thuha.tran@citizen.vn",
    payerPhone: "0933445566",
    payerRole: "User",
    packageCode: "PREMIUM",
    packageName: "Premium (Tắt quảng cáo)",
    expectedAmountVnd: 59_000,
    paidAmountVnd: 65_000,
    discrepancyVnd: 6_000,
    bankCode: "TCB",
    paymentReference: "FT261116000319",
    orderStatus: "Paid",
    reconciliationStatus: "Overpaid",
    anomalyType: "Overpaid",
    anomalyNote: "Đã kích hoạt Premium ngay cho khách; cần kiểm tra hoàn phần dư +6.000 đ.",
    rawWebhookJson: JSON.stringify(
      {
        orderCode: "ECO2611161003",
        amount: 65_000,
        reference: "FT261116000319",
        description: "ECOLINK ECO2611161003",
      },
      null,
      2,
    ),
    createdAt: "2026-11-16T03:45:00Z",
    paidAt: "2026-11-16T03:46:10Z",
  },
  {
    recordType: "Order",
    referenceCode: "ECO2611161004",
    userId: "u-demo-4",
    payerName: "Trạm Thu Gom Hòa Lạc",
    payerEmail: "hoalac@recycler.vn",
    payerPhone: "0968112233",
    payerRole: "Recycler",
    packageCode: "PRO",
    packageName: "Pro (Tích xanh 365 ngày)",
    expectedAmountVnd: 1_000_000,
    paidAmountVnd: 1_000_000,
    discrepancyVnd: 0,
    bankCode: "BIDV",
    paymentReference: "FT261116000490",
    orderStatus: "Expired",
    reconciliationStatus: "LateTransfer",
    anomalyType: "LateTransfer",
    anomalyNote: "Tiền vào sau khi mã QR 15 phút đã hết hạn; chờ Admin duyệt bù hoặc hoàn tiền.",
    rawWebhookJson: JSON.stringify(
      {
        orderCode: "ECO2611161004",
        amount: 1_000_000,
        reference: "FT261116000490",
        description: "ECOLINK ECO2611161004",
        receivedAfterQrExpiry: true,
      },
      null,
      2,
    ),
    createdAt: "2026-11-16T04:10:00Z",
    paidAt: "2026-11-16T04:32:00Z",
  },
  {
    recordType: "OrphanWebhook",
    referenceCode: "WH-202611160009",
    userId: null,
    payerName: "Tài khoản ngoài (Chưa khớp ECO)",
    payerEmail: null,
    payerPhone: null,
    payerRole: "Unknown",
    packageCode: null,
    packageName: "Chưa gán đơn",
    expectedAmountVnd: 0,
    paidAmountVnd: 59_000,
    discrepancyVnd: 59_000,
    bankCode: "ACB",
    paymentReference: "FT261116000912",
    orderStatus: "Orphan",
    reconciliationStatus: "UnmatchedReference",
    anomalyType: "UnmatchedReference",
    anomalyNote: "Nội dung CK thiếu mã ECO... Cần Admin tra cứu & ghép thủ công (ManualMatchOrder).",
    rawWebhookJson: JSON.stringify(
      {
        webhookRef: "WH-202611160009",
        amount: 59_000,
        reference: "FT261116000912",
        description: "CHUYEN KHOAN GOI PREMIUM ECOLINK",
      },
      null,
      2,
    ),
    createdAt: "2026-11-16T05:00:00Z",
    paidAt: "2026-11-16T05:00:02Z",
  },
]

function reconciliationBadge(status: string): {
  label: string
  tone: "todo" | "wait" | "ok" | "off"
} {
  const s = status.toUpperCase()
  if (s === "MATCHED" || s === "RESOLVED") return { label: s === "MATCHED" ? "Khớp tự động" : "Đã đối soát", tone: "ok" }
  if (s === "UNDERPAID") return { label: "Chuyển thiếu", tone: "wait" }
  if (s === "OVERPAID") return { label: "Chuyển dư", tone: "wait" }
  if (s === "LATETRANSFER") return { label: "Chuyển muộn", tone: "wait" }
  if (s === "UNMATCHEDREFERENCE") return { label: "Sai mã tham chiếu", tone: "wait" }
  if (s === "REFUNDED" || s === "EXCESSREFUNDED") return { label: "Đã hoàn tiền", tone: "off" }
  return { label: status, tone: "todo" }
}

const FILTER_TABS = [
  { key: "", label: "Tất cả" },
  { key: "Matched", label: "Khớp tự động" },
  { key: "Underpaid", label: "Chuyển thiếu (Underpaid)" },
  { key: "Overpaid", label: "Chuyển dư (Overpaid)" },
  { key: "LateTransfer", label: "Chuyển muộn (LateTransfer)" },
  { key: "UnmatchedReference", label: "Sai nội dung (Orphan)" },
  { key: "Resolved", label: "Đã xử lý" },
] as const

const RESOLUTION_ACTION_OPTIONS: {
  value: ReconciliationActionType
  label: string
  hint: string
}[] = [
  {
    value: "ApproveAndActivate",
    label: "Duyệt kích hoạt gói cho khách (Approve & Activate)",
    hint: "Dùng khi đơn thiếu nhỏ được du di hoặc khách chuyển muộn sau khi mã QR hết hạn.",
  },
  {
    value: "ManualMatchOrder",
    label: "Khớp thủ công vào mã đơn ECO khác (Manual Match)",
    hint: "Dùng cho giao dịch sai/thiếu mã tham chiếu (WH-...); bắt buộc nhập mã đơn ECO đích.",
  },
  {
    value: "MarkRefunded",
    label: "Xác nhận đã hoàn trả toàn bộ tiền (Mark Refunded)",
    hint: "Dùng khi khách chuyển sai/muộn và EcoLink đã hoàn trả lại ngân hàng.",
  },
  {
    value: "MarkExcessRefunded",
    label: "Xác nhận đã hoàn phần tiền dư (Mark Excess Refunded)",
    hint: "Dùng cho giao dịch Overpaid sau khi chuyển trả phần chênh lệch.",
  },
  {
    value: "CloseAnomaly",
    label: "Đóng cảnh báo đối soát (Close Anomaly)",
    hint: "Đóng hồ sơ bất thường sau khi đã kiểm tra và xác minh nội bộ.",
  },
]

/** A-11 Quản lý Sổ cái & Đối soát Tài chính VietQR (Admin Financial Reconciliation).
 *
 *  Kết nối trực tiếp tới:
 *   - `GET /api/v1/admin/reconciliations/ledger` (STT 127)
 *   - `PATCH /api/v1/admin/reconciliations/orders/{orderCode}/resolve` (STT 128)
 *   - `GET /api/v1/admin/reconciliations/export` (STT 129) */
export default function Reconciliation() {
  const [summary, setSummary] = useState<ReconciliationSummaryDto>(() =>
    initApiState(
      {
        totalMatchedRevenueVnd: 0,
        pendingOrdersCount: 0,
        openAnomaliesCount: 0,
        totalDiscrepancyVnd: 0,
        totalRefundedVnd: 0,
      },
      DEMO_SUMMARY,
    ),
  )
  const [rows, setRows] = useState<ReconciliationLedgerItemDto[]>(() =>
    initApiState([], DEMO_LEDGER),
  )
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 300)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = FIXED_PAGE_SIZE
  const [totalCount, setTotalCount] = useState(() => initApiState(0, DEMO_LEDGER.length))
  const [loading, setLoading] = useState(() => initApiLoading(Boolean(getAccessToken())))
  const [exportingFormat, setExportingFormat] = useState<"csv" | "xlsx" | null>(null)
  const [flash, setFlash] = useState("")
  const [errMsg, setErrMsg] = useState("")

  // Modal Inspect Webhook JSON
  const [inspectItem, setInspectItem] = useState<ReconciliationLedgerItemDto | null>(null)

  // Modal Đối soát thủ công (STT 128)
  const [resolvingItem, setResolvingItem] = useState<ReconciliationLedgerItemDto | null>(null)
  const [action, setAction] = useState<ReconciliationActionType>("ApproveAndActivate")
  const [targetOrderCode, setTargetOrderCode] = useState("")
  const [resolutionBankRef, setResolutionBankRef] = useState("")
  const [resolutionNote, setResolutionNote] = useState("")
  const [resolving, setResolving] = useState(false)
  const [resolveErr, setResolveErr] = useState("")

  const loadLedger = useCallback(async () => {
    if (!getAccessToken()) return
    setLoading(true)
    setErrMsg("")
    try {
      const res = await getAdminReconciliationLedger({
        reconciliationStatus: statusFilter || undefined,
        search: debouncedSearch.trim() || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        pageNumber: page,
        pageSize,
      })
      if (res.success && res.data) {
        setSummary(res.data.summary)
        setRows(res.data.items.items ?? [])
        setTotalCount(extractPagedMeta(res.data.items).totalCount)
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Không thể tải sổ cái đối soát.")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, debouncedSearch, fromDate, toDate, page, pageSize])

  useEffect(() => {
    void loadLedger()
  }, [loadLedger])

  const filteredRows = getAccessToken()
    ? rows
    : rows.filter((r) => {
        const hitStatus =
          !statusFilter ||
          r.reconciliationStatus.toUpperCase() === statusFilter.toUpperCase()
        const kw = debouncedSearch.trim().toLowerCase()
        const hitKw =
          !kw ||
          r.referenceCode.toLowerCase().includes(kw) ||
          r.payerName.toLowerCase().includes(kw) ||
          (r.paymentReference ?? "").toLowerCase().includes(kw)
        return hitStatus && hitKw
      })
  const displayedRows = getAccessToken()
    ? filteredRows
    : paginateItems(filteredRows, page, pageSize)
  const effectiveTotal = getAccessToken() ? totalCount : filteredRows.length

  const openResolveModal = (item: ReconciliationLedgerItemDto) => {
    const rec = item.reconciliationStatus.toUpperCase()
    const defaultAction: ReconciliationActionType =
      rec === "UNMATCHEDREFERENCE"
        ? "ManualMatchOrder"
        : rec === "OVERPAID"
          ? "MarkExcessRefunded"
          : "ApproveAndActivate"
    setResolvingItem(item)
    setAction(defaultAction)
    setTargetOrderCode("")
    setResolutionBankRef("")
    setResolutionNote("")
    setResolveErr("")
  }

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvingItem) return
    setResolveErr("")

    if (action === "ManualMatchOrder" && targetOrderCode.trim().length < 6) {
      setResolveErr("Vui lòng nhập mã đơn hàng ECO... cần khớp thủ công.")
      return
    }
    if (resolutionNote.trim().length < 10) {
      setResolveErr("Biên bản ghi chú đối soát phải dài tối thiểu 10 ký tự (BR-PAY-06).")
      return
    }

    setResolving(true)
    try {
      if (!getAccessToken()) {
        setRows((prev) =>
          prev.map((row) =>
            row.referenceCode === resolvingItem.referenceCode
              ? {
                  ...row,
                  reconciliationStatus:
                    action === "MarkRefunded"
                      ? "Refunded"
                      : action === "MarkExcessRefunded"
                        ? "ExcessRefunded"
                        : "Resolved",
                  resolvedAt: new Date().toISOString(),
                  resolvedByName: "Admin (Offline Demo)",
                  resolutionNote: resolutionNote.trim(),
                  resolutionBankRef: resolutionBankRef.trim() || null,
                }
              : row,
          ),
        )
        setFlash(
          `Đã xử lý đối soát ${resolvingItem.referenceCode} theo tác vụ ${action} (Offline Demo).`,
        )
        setResolvingItem(null)
        return
      }

      const res = await resolveReconciliationAnomaly(resolvingItem.referenceCode, {
        action,
        targetOrderCode: action === "ManualMatchOrder" ? targetOrderCode.trim() : undefined,
        resolutionBankRef: resolutionBankRef.trim() || undefined,
        resolutionNote: resolutionNote.trim(),
      })

      if (res.success) {
        setFlash(
          `Đã xử lý đối soát thành công giao dịch ${resolvingItem.referenceCode} (${action}) và ghi Audit Log bất biến.`,
        )
        setResolvingItem(null)
        void loadLedger()
      }
    } catch (err) {
      setResolveErr(
        err instanceof Error ? err.message : "Không thể lưu kết quả đối soát lúc này.",
      )
    } finally {
      setResolving(false)
    }
  }

  const handleExport = async (format: "csv" | "xlsx") => {
    setExportingFormat(format)
    setErrMsg("")
    try {
      if (!getAccessToken()) {
        const bom = "\uFEFF"
        const header = "MaThamChieu,KhachHang,EmailChe,SoDienThoaiChe,Goi,KienVongVND,ThucNhanVND,ChenhLechVND,TrangThai\n"
        const body = filteredRows
          .map((r) =>
            [
              r.referenceCode,
              `"${r.payerName}"`,
              r.payerEmail ? maskEmailClient(r.payerEmail) : "",
              r.payerPhone ? maskPhoneClient(r.payerPhone) : "",
              r.packageCode ?? "",
              r.expectedAmountVnd,
              r.paidAmountVnd,
              r.discrepancyVnd,
              r.reconciliationStatus,
            ].join(","),
          )
          .join("\n")
        const blob = new Blob([bom + header + body], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `ecolink-reconciliation-demo.${format === "xlsx" ? "csv" : "csv"}`
        a.click()
        URL.revokeObjectURL(url)
        setFlash(`Đã xuất bảng kê đối soát ẩn danh hóa PII (${filteredRows.length} dòng).`)
        return
      }

      const { blob, fileName, rowCount } = await exportReconciliationReportBlob({
        format,
        reconciliationStatus: statusFilter || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
      setFlash(
        `Đã tải xuống ${fileName} (${rowCount} dòng · PII Email/SĐT đã được che theo BR-ADM-06).`,
      )
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Không thể xuất báo cáo đối soát.")
    } finally {
      setExportingFormat(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="TÀI CHÍNH"
        title="Đối soát và dòng tiền"
        body="Sổ cái thu hộ VietQR tự động phân loại 5 trạng thái bất thường (Underpaid, Overpaid, LateTransfer, UnmatchedReference) và xuất bảng kê ẩn danh hóa PII."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadLedger()}
              disabled={loading}
              className="btn-outline inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </button>
            <button
              type="button"
              disabled={exportingFormat !== null}
              onClick={() => void handleExport("csv")}
              className="btn-outline inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold"
            >
              <Download className="size-3.5" />
              {exportingFormat === "csv" ? "Đang xuất CSV..." : "Xuất CSV (UTF-8)"}
            </button>
            <button
              type="button"
              disabled={exportingFormat !== null}
              onClick={() => void handleExport("xlsx")}
              className="btn-primary inline-flex h-9 items-center gap-1.5 px-3.5 text-xs font-semibold"
            >
              <Download className="size-3.5" />
              {exportingFormat === "xlsx" ? "Đang xuất XLSX..." : "Xuất Excel (.xlsx)"}
            </button>
          </div>
        }
      />

      {/* Dải 4 Stat tài chính chuẩn A-11 */}
      <div className="grid gap-6 border-b border-line-soft pb-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Doanh thu khớp lệnh"
          value={fmtVnd(summary.totalMatchedRevenueVnd)}
          note="Đơn đã thanh toán & đối soát chuẩn"
        />
        <Stat
          label="Bất thường chờ xử lý"
          value={fmtInt(summary.openAnomaliesCount)}
          note="Underpaid / Overpaid / Muộn / Sai mã"
        />
        <Stat
          label="Tổng chênh lệch phát hiện"
          value={fmtVnd(summary.totalDiscrepancyVnd)}
          note="Giá trị tuyệt đối các khoản lệch"
        />
        <Stat
          label="Đã ghi nhận hoàn tiền"
          value={fmtVnd(summary.totalRefundedVnd)}
          note={`Đơn chờ chuyển: ${fmtInt(summary.pendingOrdersCount)}`}
        />
      </div>

      {flash && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/8 px-3.5 py-2.5 text-xs font-semibold text-brand-deep">
          <ShieldCheck className="size-4 shrink-0" />
          {flash}
        </p>
      )}
      {errMsg && (
        <p role="alert" className="rounded-lg border border-warn/35 bg-warn/10 px-3.5 py-2.5 text-xs font-semibold text-warn">
          {errMsg}
        </p>
      )}

      {/* Thanh bộ lọc 5 kịch bản + tìm kiếm */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatusFilter(tab.key)
                setPage(1)
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === tab.key
                  ? "bg-brand text-white"
                  : "border border-line bg-surface text-body hover:bg-surface-2"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_160px_160px]">
          <input
            type="search"
            className="input h-9 text-xs"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Tìm theo mã đơn ECO..., webhook WH-... hoặc mã giao dịch ngân hàng..."
          />
          <input
            type="date"
            aria-label="Từ ngày"
            className="input h-9 text-xs"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value)
              setPage(1)
            }}
          />
          <input
            type="date"
            aria-label="Đến ngày"
            className="input h-9 text-xs"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {displayedRows.length === 0 ? (
        <Empty>Không có giao dịch đối soát nào khớp với bộ lọc hiện tại.</Empty>
      ) : (
        <>
        <Table
          head={[
            "Mã tham chiếu & NH",
            "Khách hàng (Che PII)",
            "Gói dịch vụ",
            "Kỳ vọng / Thực nhận",
            "Chênh lệch",
            "Trạng thái đối soát",
            "Thao tác",
          ]}
        >
          {displayedRows.map((item) => {
            const st = reconciliationBadge(item.reconciliationStatus)
            const sUpper = item.reconciliationStatus.toUpperCase()
            const needsResolve =
              sUpper === "UNDERPAID" ||
              sUpper === "OVERPAID" ||
              sUpper === "LATETRANSFER" ||
              sUpper === "UNMATCHEDREFERENCE"

            return (
              <tr key={`${item.recordType}-${item.referenceCode}`}>
                <Td>
                  <p className="font-mono text-xs font-bold text-ink">{item.referenceCode}</p>
                  <p className="text-[11px] text-muted">
                    {item.bankCode} {item.paymentReference ? `· ${item.paymentReference}` : ""}
                  </p>
                  <p className="text-[10px] text-muted">
                    {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </p>
                </Td>
                <Td>
                  <p className="font-semibold text-ink">{item.payerName}</p>
                  <p className="text-[11px] text-muted">
                    {item.payerEmail ? maskEmailClient(item.payerEmail) : "—"}
                    {item.payerPhone ? ` · ${maskPhoneClient(item.payerPhone)}` : ""}
                  </p>
                </Td>
                <Td>
                  <span className="font-medium text-ink">{item.packageName || "—"}</span>
                  {item.packageCode && (
                    <span className="block font-mono text-[10px] text-muted">{item.packageCode}</span>
                  )}
                </Td>
                <Td className="tabular-nums text-xs">
                  <span className="block text-muted">Đơn: {fmtVnd(item.expectedAmountVnd)}</span>
                  <span className="font-bold text-ink">Nhận: {fmtVnd(item.paidAmountVnd)}</span>
                </Td>
                <Td className="tabular-nums text-xs font-bold">
                  <span
                    className={
                      item.discrepancyVnd === 0
                        ? "text-muted"
                        : item.discrepancyVnd < 0
                          ? "text-warn"
                          : "text-amber-700"
                    }
                  >
                    {item.discrepancyVnd > 0 ? `+${fmtVnd(item.discrepancyVnd)}` : fmtVnd(item.discrepancyVnd)}
                  </span>
                </Td>
                <Td>
                  <Status tone={st.tone}>{st.label}</Status>
                  {item.anomalyNote && (
                    <p className="mt-1 max-w-xs text-[11px] leading-4 text-muted">
                      {item.anomalyNote}
                    </p>
                  )}
                  {item.resolutionNote && (
                    <p className="mt-1 max-w-xs text-[11px] font-medium text-brand-deep">
                      Biên bản ({item.resolvedByName ?? "Admin"}): {item.resolutionNote}
                    </p>
                  )}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {item.rawWebhookJson && (
                      <button
                        type="button"
                        onClick={() => setInspectItem(item)}
                        className="btn-outline inline-flex h-8 items-center gap-1 px-2 text-[11px]"
                        title="Xem dữ liệu Webhook thô bất biến từ ngân hàng"
                      >
                        <FileJson className="size-3.5" />
                        Log NH
                      </button>
                    )}
                    {needsResolve && (
                      <button
                        type="button"
                        onClick={() => openResolveModal(item)}
                        className="btn-primary inline-flex h-8 items-center gap-1 px-2.5 text-[11px]"
                      >
                        <Wrench className="size-3" />
                        Xử lý lệch
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            )
          })}
        </Table>
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalCount={effectiveTotal}
          onPageChange={setPage}
          itemLabel="giao dịch đối soát"
        />
        </>
      )}

      {/* Modal Inspector Raw Webhook JSON bất biến */}
      {inspectItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Bằng chứng Webhook ${inspectItem.referenceCode}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-xl rounded-2xl border border-line bg-white p-5 shadow-2xl">
            <button
              type="button"
              onClick={() => setInspectItem(null)}
              aria-label="Đóng cửa sổ log"
              className="absolute top-4 right-4 rounded-lg p-1.5 text-muted hover:bg-surface-2"
            >
              <X className="size-5" />
            </button>
            <p className="text-[11px] font-bold tracking-[0.12em] text-brand uppercase">
              BẰNG CHỨNG WEBHOOK NGÂN HÀNG (APPEND-ONLY)
            </p>
            <h2 className="mt-1 text-base font-bold text-ink">
              Bản ghi gốc: {inspectItem.referenceCode}
            </h2>
            <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-line bg-surface-2 p-3.5 font-mono text-xs leading-5 text-ink">
              {inspectItem.rawWebhookJson || "{}"}
            </pre>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="btn-outline h-9 px-4 text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Đối soát thủ công (STT 128 - BR-PAY-06) */}
      {resolvingItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Xử lý đối soát ${resolvingItem.referenceCode}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <form
            onSubmit={(e) => void handleResolveSubmit(e)}
            className="relative w-full max-w-xl rounded-2xl border border-line bg-white p-5 shadow-2xl md:p-6"
          >
            <button
              type="button"
              onClick={() => setResolvingItem(null)}
              aria-label="Đóng hộp thoại đối soát"
              className="absolute top-4 right-4 rounded-lg p-1.5 text-muted hover:bg-surface-2"
            >
              <X className="size-5" />
            </button>

            <p className="text-[11px] font-bold tracking-[0.12em] text-brand uppercase">
              A-11 · XỬ LÝ BẤT THƯỜNG ĐỐI SOÁT (BR-PAY-06)
            </p>
            <h2 className="mt-1 text-lg font-bold text-ink">
              Giao dịch: {resolvingItem.referenceCode} ({resolvingItem.reconciliationStatus})
            </h2>
            <p className="mt-1 text-xs text-muted">
              Kỳ vọng: <b>{fmtVnd(resolvingItem.expectedAmountVnd)}</b> · Thực nhận:{" "}
              <b>{fmtVnd(resolvingItem.paidAmountVnd)}</b> · Chênh lệch:{" "}
              <b>{fmtVnd(resolvingItem.discrepancyVnd)}</b>
            </p>

            <div className="mt-4 flex flex-col gap-4">
              <FormRequiredLegend />
              <Field label="Quyết định xử lý" required>
                <select
                  className="input"
                  value={action}
                  onChange={(e) => setAction(e.target.value as ReconciliationActionType)}
                >
                  {RESOLUTION_ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-muted">
                  {RESOLUTION_ACTION_OPTIONS.find((o) => o.value === action)?.hint}
                </span>
              </Field>

              {action === "ManualMatchOrder" && (
                <Field label="Mã đơn hàng ECO... cần khớp thủ công" required hint="Ví dụ: ECO2611161002">
                  <input
                    className="input font-mono uppercase"
                    value={targetOrderCode}
                    onChange={(e) => setTargetOrderCode(e.target.value.toUpperCase())}
                    placeholder="ECO..."
                  />
                </Field>
              )}

              <Field label="Mã tra soát / Giao dịch hoàn ngân hàng (Tùy chọn)">
                <input
                  className="input font-mono"
                  value={resolutionBankRef}
                  onChange={(e) => setResolutionBankRef(e.target.value)}
                  placeholder="VD: REFUND-FT261116..."
                />
              </Field>

              <Field
                label="Biên bản ghi chú đối soát (Bắt buộc >= 10 ký tự)"
                required
                hint="Ghi lại đầy đủ căn cứ tài chính để lưu Audit Log bất biến."
              >
                <textarea
                  rows={3}
                  className="input h-auto py-2"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="VD: Đã đối chiếu sao kê MB Bank mã FT... khách chuyển thiếu 9k đã bổ sung qua ví..."
                />
              </Field>
            </div>

            {resolveErr && (
              <p role="alert" className="mt-3 text-xs font-semibold text-warn">
                {resolveErr}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2 border-t border-line-soft pt-4">
              <button
                type="button"
                onClick={() => setResolvingItem(null)}
                className="btn-ghost h-10 px-4 text-xs"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={resolving}
                className="btn-primary h-10 px-5 text-xs font-semibold"
              >
                {resolving ? "Đang xác nhận..." : "Xác nhận đối soát & Ghi Audit Log"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
