import { useState } from "react"
import { PageHead, Field, Stat, Table, Td } from "@/components/admin/ui"
import { FLOWS } from "@/data/cashflow"
import { MY_HANDOVERS } from "@/data/handover"
import { ACCOUNTS, POSTS, STATS, fmtInt, fmtVnd } from "@/data/ops"

/** Các bảng có thể xuất. Dùng chung một cấu trúc hàng/nguồn để không phải viết
 *  bốn bộ dữ liệu riêng cho bốn nút. */
type Row = Record<string, string | number>
const SHEETS: Record<string, { label: string; head: string[]; rows: () => Row[] }> = {
  users: {
    label: "Người dùng và cơ sở thu mua",
    head: ["Mã", "Tên", "Email", "Vai trò", "Khu vực", "Ngày tham gia", "Giao dịch"],
    rows: () => ACCOUNTS.map((a) => ({
      "Mã": a.id, "Tên": a.name, "Email": a.email,
      "Vai trò": a.role === "user" ? "Người dân" : "Cơ sở thu mua",
      "Khu vực": a.area, "Ngày tham gia": a.joined, "Giao dịch": a.deals,
    })),
  },
  handovers: {
    label: "Yêu cầu bàn giao",
    head: ["Mã", "Đối tác", "Ngày", "Khung giờ", "Trạng thái"],
    rows: () => MY_HANDOVERS.map((h) => ({
      "Mã": h.id, "Đối tác": h.recycler, "Ngày": h.date,
      "Khung giờ": h.slot, "Trạng thái": h.status,
    })),
  },
  cashflow: {
    label: "Dòng tiền",
    head: ["Ngày", "Mã giao dịch", "Mã bàn giao", "Loại", "Số tiền", "Đối tác"],
    rows: () => FLOWS.map((f) => ({
      "Ngày": f.date, "Mã giao dịch": f.id, "Mã bàn giao": f.handoverId,
      "Loại": f.kind, "Số tiền": f.amount, "Đối tác": f.party,
    })),
  },
  posts: {
    label: "Bài Blog",
    head: ["Mã", "Tiêu đề", "Tác giả", "Ngày", "Trạng thái"],
    rows: () => POSTS.map((p) => ({
      "Mã": p.id, "Tiêu đề": p.title, "Tác giả": p.author,
      "Ngày": p.date, "Trạng thái": p.status,
    })),
  },
}

/** Một ô CSV cần nháy kép nếu chứa dấu phẩy, xuống dòng hoặc nháy kép —
 *  tiêu đề bài blog có dấu phẩy là chuyện thường, không escape thì file ra
 *  cột lệch hàng. */
const cell = (v: string | number) =>
  /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)

function toCsv(head: string[], rows: Row[]) {
  return [head, ...rows.map((r) => head.map((h) => r[h]))]
    .map((line) => line.map(cell).join(","))
    .join("\r\n")
}

/** A-02 Xuất báo cáo dữ liệu (CSV).
 *
 *  Xuất CSV chứ không xuất Excel (.xlsx): gói đọc/ghi xlsx cần thêm dependency
 *  và vài trăm KB vào bundle, còn CSV mở được bằng Excel, Sheets và LibreOffice
 *  mà không cần cài gì. Nếu sau này thật sự cần định dạng xlsx thì lúc đó thêm.
 *
 *  BOM `\uFEFF` ở đầu file là bắt buộc: không có nó thì Excel trên Windows mở
 *  tiếng Việt ra mojibake. */
function download(sheet: string) {
  const { head, rows } = SHEETS[sheet]
  const blob = new Blob(["\uFEFF" + toCsv(head, rows())], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `ecolink-${sheet}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const [flash, setFlash] = useState("")

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="BÁO CÁO"
        title="Xuất báo cáo dữ liệu"
        body="Tải dữ liệu ra file CSV để mở bằng Excel, Google Sheets hoặc LibreOffice. Cột và hàng giữ nguyên như bảng trên màn hình."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Người dùng" value={fmtInt(STATS.users)} />
        <Stat label="Giao dịch 30 ngày" value={fmtInt(STATS.handovers30d)} />
        <Stat label="Giá trị 30 ngày" value={fmtVnd(STATS.gross30d)} />
        <Stat label="Phí thu được" value={fmtVnd(STATS.fee30d)} />
      </div>

      <section className="card flex flex-col gap-4 p-5 md:p-6">
        <Field label="Khoảng thời gian" hint="Chỉ dùng để ghi vào tên file; dữ liệu mẫu không chia theo ngày.">
          <div className="flex flex-wrap gap-2">
            <input className="input w-44" type="date" defaultValue="2026-09-01" aria-label="Từ ngày" />
            <input className="input w-44" type="date" defaultValue="2026-09-30" aria-label="Đến ngày" />
          </div>
        </Field>

        <div className="border-t border-line-soft pt-4">
          <ul className="grid gap-3 sm:grid-cols-2">
            {Object.entries(SHEETS).map(([key, s]) => (
              <li
                key={key}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{s.label}</p>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {s.head.length} cột · {s.rows().length} dòng
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    download(key)
                    setFlash(`Đã tải ${s.label.toLowerCase()} về máy.`)
                  }}
                  className="btn-outline h-10 shrink-0 px-4 text-[13px]"
                >
                  Tải CSV
                </button>
              </li>
            ))}
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
          Xem trước dữ liệu dòng tiền
        </h2>
        <p className="mt-1 text-sm text-muted">
          Xem trước đúng những gì file CSV sẽ chứa, gồm cả dấu phẩy trong nội
          dung mà Excel có thể bỏ sót.
        </p>
        <div className="mt-4">
          <Table head={["Ngày", "Mã bàn giao", "Loại", "Số tiền"]}>
            {SHEETS.cashflow.rows().map((r, i) => (
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
    </div>
  )
}