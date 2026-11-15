import { useEffect, useState } from "react"
import { Empty, Field, PageHead, Stat, Status, Table, Td } from "@/components/admin/ui"
import { FLOWS } from "@/data/cashflow"
import { MY_HANDOVERS } from "@/data/handover"
import { ACCOUNTS, STATS, fmtInt, fmtVnd } from "@/data/ops"
import {
  exportAdminReportBlob,
  getAdminAuditLogs,
  getAdminKpiSummary,
  maskEmailClient,
  type AuditLogItemDto,
  type ReportDatasetType,
  type ReportExportFormat,
} from "@/lib/governanceApi"

type Row = Record<string, string | number>

/** Dữ liệu dự phòng khi chưa kết nối Backend — Email vẫn được che dấu chuẩn BR-ADM-06. */
const FALLBACK_SHEETS: Record<
  ReportDatasetType,
  { label: string; desc: string; head: string[]; rows: () => Row[] }
> = {
  users: {
    label: "Người dùng và cơ sở thu mua (PII Masked)",
    desc: "Email & SĐT tự động ẩn danh một phần theo quy tắc bảo mật BR-ADM-06.",
    head: ["Mã", "Tên", "Email (Masked)", "Vai trò", "Khu vực", "Ngày tham gia", "Giao dịch"],
    rows: () =>
      ACCOUNTS.map((a) => ({
        Mã: a.id,
        Tên: a.name,
        "Email (Masked)": maskEmailClient(a.email),
        "Vai trò": a.role === "user" ? "Người dân" : "Cơ sở thu mua",
        "Khu vực": a.area,
        "Ngày tham gia": a.joined,
        "Giao dịch": a.deals,
      })),
  },
  handovers: {
    label: "Yêu cầu bàn giao & Thu gom",
    desc: "Tổng hợp lịch hẹn thu gom, khối lượng thực cân và đối tác xử lý.",
    head: ["Mã", "Đối tác", "Ngày", "Khung giờ", "Trạng thái"],
    rows: () =>
      MY_HANDOVERS.map((h) => ({
        Mã: h.id,
        "Đối tác": h.recycler,
        Ngày: h.date,
        "Khung giờ": h.slot,
        "Trạng thái": h.status,
      })),
  },
  cashflow: {
    label: "Đối soát dòng tiền & Phí dịch vụ VietQR",
    desc: "Biên nhận giao dịch hoàn tất và hoá đơn gói dịch vụ nền tảng.",
    head: ["Ngày", "Mã giao dịch", "Mã bàn giao", "Loại", "Số tiền", "Đối tác"],
    rows: () =>
      FLOWS.map((f) => ({
        Ngày: f.date,
        "Mã giao dịch": f.id,
        "Mã bàn giao": f.handoverId,
        Loại: f.kind,
        "Số tiền": f.amount,
        "Đối tác": f.party,
      })),
  },
  audit: {
    label: "Nhật ký kiểm toán hệ thống (Audit Logs)",
    desc: "Bản ghi bất biến mọi thao tác quản trị, phân quyền, khoá tài khoản và xuất dữ liệu.",
    head: ["Thời điểm", "Người thực hiện", "Hành động", "Thực thể", "Lý do"],
    rows: () => [
      {
        "Thời điểm": "2026-09-28 09:15",
        "Người thực hiện": "ad***@ecolink.vn",
        "Hành động": "UPDATE_STAFF_PERMISSIONS",
        "Thực thể": "StaffProfile#NV-02",
        "Lý do": "Cấp quyền xử lý khiếu nại ca sáng",
      },
      {
        "Thời điểm": "2026-09-27 16:40",
        "Người thực hiện": "st***@ecolink.vn",
        "Hành động": "LOCK_ACCOUNT",
        "Thực thể": "User#B-0202",
        "Lý do": "Tái phạm cân thiếu khối lượng đã xác minh biên nhận",
      },
    ],
  },
}

const FALLBACK_AUDIT_LOGS: AuditLogItemDto[] = [
  {
    id: "aud-demo-01",
    actorEmail: "admin@ecolink.vn",
    actorRole: "Admin",
    action: "UPDATE_STAFF_PERMISSIONS",
    entityType: "StaffProfile",
    entityId: "NV-02",
    oldValues: JSON.stringify({ permissions: ["REVIEW_AI"] }),
    newValues: JSON.stringify({ permissions: ["REVIEW_AI", "CURATE_DATASET", "HANDLE_COMPLAINT"] }),
    reason: "Bổ sung quyền ca trực kiểm duyệt dữ liệu AI",
    ipAddress: "127.0.0.1",
    createdAt: "2026-09-28T09:15:00Z",
  },
  {
    id: "aud-demo-02",
    actorEmail: "staff@ecolink.vn",
    actorRole: "Staff",
    action: "LOCK_ACCOUNT",
    entityType: "User",
    entityId: "B-0202",
    oldValues: JSON.stringify({ status: "Active", warningCount: 0 }),
    newValues: JSON.stringify({ status: "Suspended", warningCount: 1, revokedTokens: 2 }),
    reason: "Vi phạm quy tắc cân đo thực tế tại điểm thu gom Quận 5",
    ipAddress: "127.0.0.1",
    createdAt: "2026-09-27T16:40:00Z",
  },
]

const cell = (v: string | number) =>
  /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)

function toCsv(head: string[], rows: Row[]) {
  return [head, ...rows.map((r) => head.map((h) => r[h]))]
    .map((line) => line.map(cell).join(","))
    .join("\r\n")
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function downloadFallbackCsv(sheet: ReportDatasetType, fromDate: string, toDate: string) {
  const { head, rows } = FALLBACK_SHEETS[sheet]
  const blob = new Blob(["\uFEFF" + toCsv(head, rows())], {
    type: "text/csv;charset=utf-8",
  })
  triggerBlobDownload(blob, `ecolink-${sheet}-${fromDate || "all"}-${toDate || "now"}.csv`)
}

/**
 * A-02 Xuất báo cáo dữ liệu (CSV / XLSX) & Tra cứu Nhật ký kiểm toán bất biến (Audit Log).
 *
 *  - BR-ADM-05: Nhật ký kiểm toán chỉ cho phép ĐỌC (Append-Only), không có nút sửa/xoá.
 *  - BR-ADM-06: Tự động che dấu PII (Email/SĐT) khi trích xuất báo cáo và ghi log EXPORT_REPORT.
 */
export default function Reports() {
  const [tab, setTab] = useState<"export" | "audit">("export")
  const [fromDate, setFromDate] = useState("2026-09-01")
  const [toDate, setToDate] = useState("2026-11-30")
  const [format, setFormat] = useState<ReportExportFormat>("csv")
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [flash, setFlash] = useState("")

  // Số liệu tổng quan đồng bộ từ A-01
  const [kpi, setKpi] = useState({
    users: STATS.users,
    handovers30d: STATS.handovers30d,
    gross30d: STATS.gross30d,
    fee30d: STATS.fee30d,
  })

  // Trạng thái tab Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogItemDto[]>(FALLBACK_AUDIT_LOGS)
  const [auditTotal, setAuditTotal] = useState<number>(FALLBACK_AUDIT_LOGS.length)
  const [actionFilter, setActionFilter] = useState("")
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<AuditLogItemDto | null>(null)

  useEffect(() => {
    let cancelled = false
    getAdminKpiSummary("30d")
      .then((res) => {
        if (cancelled || !res.data) return
        setKpi({
          users: res.data.totalCitizens + res.data.activeRecyclers,
          handovers30d: res.data.completedHandovers,
          gross30d: res.data.grossMerchandiseValueVnd,
          fee30d: res.data.platformFeeRevenueVnd + res.data.vietQrServiceRevenueVnd,
        })
      })
      .catch(() => {
        // Giữ fallback STATS
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadAuditLogs = (targetPage = page) => {
    getAdminAuditLogs({
      action: actionFilter || undefined,
      keyword: keyword || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      pageNumber: targetPage,
      pageSize: 15,
    })
      .then((res) => {
        if (!res.data) return
        setAuditLogs(res.data.items)
        setAuditTotal(res.data.totalCount)
      })
      .catch(() => {
        // Giữ dữ liệu mẫu khi chưa đăng nhập Admin
      })
  }

  useEffect(() => {
    if (tab === "audit") {
      loadAuditLogs(page)
    }
  }, [tab, page, actionFilter])

  const handleExport = async (dataset: ReportDatasetType) => {
    setBusyKey(dataset)
    setFlash("")
    try {
      const { blob, fileName, rowCount } = await exportAdminReportBlob({
        dataset,
        format,
        fromDate,
        toDate,
      })
      triggerBlobDownload(blob, fileName)
      setFlash(
        `Đã trích xuất ${fileName} (${rowCount} dòng, đã ẩn danh PII theo BR-ADM-06 và ghi nhận Audit Log).`,
      )
      if (tab === "audit") loadAuditLogs(1)
    } catch {
      downloadFallbackCsv(dataset, fromDate, toDate)
      setFlash(
        `Đã tải bản trích xuất CSV cục bộ cho "${FALLBACK_SHEETS[dataset].label}" (đã che dấu PII chuẩn BR-ADM-06).`,
      )
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="BÁO CÁO & KIỂM TOÁN · A-02"
        title="Xuất báo cáo dữ liệu & Nhật ký kiểm toán"
        body="Trích xuất dữ liệu vận hành ra chuẩn CSV (UTF-8 BOM) hoặc Excel (.xlsx) có che dấu thông tin định danh cá nhân (PII), đồng thời tra cứu sổ cái kiểm toán bất biến."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Tài khoản hệ thống" value={fmtInt(kpi.users)} />
        <Stat label="Giao dịch 30 ngày" value={fmtInt(kpi.handovers30d)} />
        <Stat label="Giá trị 30 ngày" value={fmtVnd(kpi.gross30d)} />
        <Stat label="Doanh thu & phí" value={fmtVnd(kpi.fee30d)} />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-line pb-3" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "export"}
          onClick={() => setTab("export")}
          className={`h-10 rounded-lg px-4 text-[13px] font-semibold transition-colors ${
            tab === "export"
              ? "bg-brand text-white"
              : "border border-line bg-white text-body hover:bg-surface-2"
          }`}
        >
          Xuất báo cáo dữ liệu (CSV / XLSX)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "audit"}
          onClick={() => setTab("audit")}
          className={`h-10 rounded-lg px-4 text-[13px] font-semibold transition-colors ${
            tab === "audit"
              ? "bg-brand text-white"
              : "border border-line bg-white text-body hover:bg-surface-2"
          }`}
        >
          Nhật ký kiểm toán (Audit Trail)
        </button>
      </div>

      {tab === "export" ? (
        <>
          <section className="card flex flex-col gap-4 p-5 md:p-6">
            <div className="flex flex-wrap items-end gap-5">
              <Field
                label="Khoảng thời gian trích xuất"
                hint="Áp dụng lọc dữ liệu trên máy chủ và ghi dấu vào Nhật ký kiểm toán."
              >
                <div className="flex flex-wrap gap-2">
                  <input
                    className="input w-44"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    aria-label="Từ ngày"
                  />
                  <input
                    className="input w-44"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    aria-label="Đến ngày"
                  />
                </div>
              </Field>

              <Field label="Định dạng tệp xuất">
                <div className="flex gap-2">
                  {(["csv", "xlsx"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      aria-pressed={format === fmt}
                      className={`h-12 rounded-lg border px-4 text-[13px] font-semibold uppercase transition-colors ${
                        format === fmt
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-surface text-body hover:bg-surface-2"
                      }`}
                    >
                      .{fmt}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="border-t border-line-soft pt-4">
              <ul className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(FALLBACK_SHEETS) as ReportDatasetType[]).map((key) => {
                  const s = FALLBACK_SHEETS[key]
                  const loading = busyKey === key
                  return (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{s.label}</p>
                        <p className="mt-0.5 text-[12px] leading-5 text-muted">{s.desc}</p>
                      </div>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleExport(key)}
                        className="btn-outline h-10 shrink-0 px-4 text-[13px]"
                      >
                        {loading ? "Đang xuất..." : `Tải ${format.toUpperCase()}`}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {flash && (
              <p role="status" className="text-[13px] font-semibold text-brand">
                {flash}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
              Xem trước dữ liệu đối soát dòng tiền
            </h2>
            <p className="mt-1 text-sm text-muted">
              Xem trước cấu trúc bản ghi tài chính trước khi mở trong Excel, Google Sheets hoặc LibreOffice.
            </p>
            <div className="mt-4">
              <Table head={["Ngày", "Mã bàn giao", "Loại", "Số tiền"]}>
                {FALLBACK_SHEETS.cashflow.rows().map((r, i) => (
                  <tr key={i}>
                    <Td className="tabular-nums whitespace-nowrap">{r["Ngày"]}</Td>
                    <Td className="tabular-nums whitespace-nowrap">{r["Mã bàn giao"]}</Td>
                    <Td className="whitespace-nowrap">{r["Loại"]}</Td>
                    <Td className="tabular-nums">{fmtVnd(Number(r["Số tiền"]))}</Td>
                  </tr>
                ))}
              </Table>
            </div>
          </section>
        </>
      ) : (
        <section className="flex flex-col gap-5">
          <div className="card flex flex-wrap items-end gap-3 p-4">
            <Field label="Tìm từ khoá">
              <input
                className="input w-64"
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Email, mã thực thể hoặc lý do..."
              />
            </Field>
            <Field label="Loại hành động">
              <select
                className="input w-56"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Tất cả hành động</option>
                <option value="LOCK_ACCOUNT">LOCK_ACCOUNT</option>
                <option value="UNLOCK_ACCOUNT">UNLOCK_ACCOUNT</option>
                <option value="DEACTIVATE_ACCOUNT">DEACTIVATE_ACCOUNT</option>
                <option value="CREATE_STAFF">CREATE_STAFF</option>
                <option value="UPDATE_STAFF_PERMISSIONS">UPDATE_STAFF_PERMISSIONS</option>
                <option value="EXPORT_REPORT">EXPORT_REPORT</option>
              </select>
            </Field>
            <button
              type="button"
              onClick={() => {
                setPage(1)
                loadAuditLogs(1)
              }}
              className="btn-outline h-12 px-4 text-[13px]"
            >
              Tra cứu
            </button>
            <span className="ml-auto text-[12px] text-muted">
              Tổng cộng <b className="tabular-nums text-ink">{auditTotal}</b> bản ghi bất biến (BR-ADM-05)
            </span>
          </div>

          {auditLogs.length === 0 ? (
            <Empty>Chưa có bản ghi kiểm toán nào khớp bộ lọc hiện tại.</Empty>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
              <Table head={["Thời gian", "Tác nhân", "Hành động", "Đối tượng", "Lý do", ""]}>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <Td className="tabular-nums whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("vi-VN")}
                    </Td>
                    <Td>
                      <span className="font-semibold text-ink">{log.actorEmail ?? "System"}</span>
                      {log.actorRole && (
                        <span className="ml-1.5 text-[11px] text-muted">({log.actorRole})</span>
                      )}
                    </Td>
                    <Td>
                      <Status tone="wait">{log.action}</Status>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {log.entityType}
                      {log.entityId ? ` · ${log.entityId.slice(0, 10)}` : ""}
                    </Td>
                    <Td className="max-w-[220px] truncate">{log.reason ?? "—"}</Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="text-[12px] font-semibold text-brand hover:underline"
                      >
                        Đối chiếu JSON
                      </button>
                    </Td>
                  </tr>
                ))}
              </Table>

              <aside className="card flex flex-col gap-3 p-5">
                {!selectedLog ? (
                  <p className="text-sm text-muted">
                    Chọn &ldquo;Đối chiếu JSON&rdquo; ở một dòng nhật ký để xem trạng thái trước/sau (`oldValues` / `newValues`) và địa chỉ IP thực thi. Bản ghi kiểm toán bị khoá sửa/xoá ở tầng CSDL.
                  </p>
                ) : (
                  <>
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.1em] text-brand uppercase">
                        CHI TIẾT BẢN GHI BẤT BIẾN
                      </p>
                      <p className="mt-1 text-base font-bold text-ink">{selectedLog.action}</p>
                      <p className="text-[12px] text-muted">
                        {new Date(selectedLog.createdAt).toLocaleString("vi-VN")} · IP:{" "}
                        {selectedLog.ipAddress ?? "N/A"}
                      </p>
                    </div>
                    {selectedLog.reason && (
                      <p className="rounded-md bg-surface-2 px-3 py-2 text-[12px] text-body">
                        <b className="text-ink">Lý do:</b> {selectedLog.reason}
                      </p>
                    )}
                    <div>
                      <p className="text-[11px] font-bold text-muted uppercase">
                        Giá trị trước (old_values)
                      </p>
                      <pre className="mt-1 max-h-36 overflow-auto rounded-md border border-line-soft bg-surface p-2.5 text-[11px] text-body">
                        {selectedLog.oldValues || "null"}
                      </pre>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-muted uppercase">
                        Giá trị mới (new_values)
                      </p>
                      <pre className="mt-1 max-h-36 overflow-auto rounded-md border border-line-soft bg-surface p-2.5 text-[11px] text-body">
                        {selectedLog.newValues || "null"}
                      </pre>
                    </div>
                  </>
                )}
              </aside>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn-ghost h-9 px-3 text-[13px]"
            >
              ← Trang trước
            </button>
            <span className="text-[12px] tabular-nums text-muted">Trang {page}</span>
            <button
              type="button"
              disabled={page * 15 >= auditTotal}
              onClick={() => setPage((p) => p + 1)}
              className="btn-ghost h-9 px-3 text-[13px]"
            >
              Trang tiếp →
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
