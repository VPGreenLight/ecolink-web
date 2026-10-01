import { Link } from "react-router-dom"
import { PageHead, Stat, StatRow, Table, Td } from "@/components/admin/ui"
import { STATS, TREND_PEAK, fmtInt, fmtVnd } from "@/data/ops"

/** A-01 Dashboard và thống kê.
 *
 *  Thứ tự: nhìn một giây ra tổng quan → đọc việc đang chờ mình quyết định →
 *  đào vào xu hướng. Trang quản trị mở ra bằng một biểu đồ đẹp thì người quản
 *  trị không biết phải làm gì.
 *
 *  Ba thay đổi so với bản đầu, cả ba đều là điều luật thiết kế cấm:
 *
 *  1. Bỏ dãy 4 thẻ số liệu giống hệt nhau (hero-metric template) — thay bằng
 *     `StatRow` kẻ ngang, số liệu đứng thẳng hàng như báo cáo tài chính.
 *  2. Bỏ biểu đồ cột: nó và bảng bên dưới in ra CÙNG 6 con số, tức hai cách
 *     biểu diễn một dữ liệu. Giữ bảng và vẽ thanh nhỏ trong từng dòng — một
 *     biểu diễn, số chính xác đọc được, thêm tháng sau không phải vẽ lại.
 *  3. Thanh bên trong ô chứ không phải 4 thẻ tách rời: số việc tồn đọng có
 *     thứ tự, nên danh sách phải cho thấy phần đóng góp của từng loại so với
 *     tổng, chứ không phải 4 hộp cùng cỡ.
 *
 *  Biểu đồ cũ còn animate `height` — thuộc tính layout, mỗi khung hình phải
 *  tính lại bố cục. Nay thanh có chiều rộng tĩnh, không animation: số liệu
 *  không phải chuyện trang trí để chờ động. */
export default function AdminHome() {
  const s = STATS

  /** Việc tồn đọng, sắp nhiều trước — tổng tính từ dữ liệu chứ không chốt số. */
  const queue = [
    { to: "/staff/ai-review", label: "Ảnh AI nhận diện sai", owner: "Nhân viên AI", n: s.pending.aiCases },
    { to: "/staff/applications", label: "Hồ sơ đối tác thu mua", owner: "Nhân viên đối tác", n: s.pending.applications },
    { to: "/staff/complaints", label: "Khiếu nại giao dịch", owner: "Nhân viên hỗ trợ", n: s.pending.complaints },
    { to: "/admin/blog", label: "Bài Blog chờ duyệt", owner: "Bạn (Admin)", n: s.pending.posts },
  ].sort((a, b) => b.n - a.n)

  const queueTotal = queue.reduce((t, x) => t + x.n, 0)
  const backlog = queue.map((b) => ({ ...b, share: b.n / queueTotal }))

  return (
    <div className="flex flex-col gap-8">
      <PageHead
        eyebrow="QUẢN TRỊ"
        title="Dashboard và thống kê"
        body="Tổng quan toàn hệ thống. Dùng để ra quyết định cấu hình, không phải để báo cáo ra ngoài."
        action={
          <Link to="/admin/reports" className="btn-outline h-11 shrink-0 px-5">
            Xuất báo cáo
          </Link>
        }
      />

      <StatRow>
        <Stat label="Người dùng" value={fmtInt(s.users)} />
        <Stat label="Cơ sở thu mua" value={fmtInt(s.recyclers)} />
        <Stat
          label="Khối lượng 30 ngày"
          value={fmtInt(s.volume30d)}
          unit="kg"
        />
        <Stat label="Giá trị 30 ngày" value={fmtVnd(s.gross30d)} />
      </StatRow>

      {/* Phí nền tảng không nhét làm ghi chú dưới "Giá trị 30 ngày": nó là
          con số khác hẳn, là tiền của chính nền tảng chứ không phải tiền của
          người dùng. Gộp vào ghi chú thì đọc nhầm là tỷ lệ của giá trị kia. */}
      <p className="text-sm text-body">
        Trong 30 ngày đó, EcoLink thu phí nền tảng{" "}
        <b className="tabular-nums text-ink">{fmtVnd(s.fee30d)}</b> từ{" "}
        <b className="tabular-nums text-ink">{fmtInt(s.handovers30d)}</b> giao
        dịch hoàn tất.
      </p>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
            Việc đang chờ xử lý
          </h2>
          <p className="text-sm text-muted">
            Cùng hàng đợi mà nhân viên thấy. Loại nào không giảm được là quy trình
            đang nghẽn.
          </p>
        </div>

        <ul className="mt-4 divide-y divide-line-soft border-y border-line-soft">
          {backlog.map((b) => (
            <li
              key={b.to}
              className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3.5"
            >
              {/* cột nhãn CỐ ĐỊNH 280px: nhãn dài ngắn khác nhau, nếu để nó co
                  giãn thì các thanh lệch nhau và không đọc được là cùng một
                  thang đo. */}
              <span className="w-[280px] max-w-full shrink-0">
                <span className="block text-sm font-semibold text-ink">{b.label}</span>
                <span className="block text-[13px] text-muted">{b.owner}</span>
              </span>

              <span className="h-1.5 w-[170px] max-w-full shrink-0 overflow-hidden rounded-full bg-surface-3">
                <span
                  className="block h-full rounded-full bg-brand"
                  style={{ width: `${Math.round(b.share * 100)}%` }}
                />
              </span>

              <span className="flex-1" />

              <span className="w-10 shrink-0 text-right text-lg leading-7 font-bold tabular-nums text-ink">
                {b.n}
              </span>

              <Link
                to={b.to}
                className="w-[68px] shrink-0 text-right text-[13px] font-semibold text-brand transition-colors hover:text-brand-deep"
              >
                Xử lý →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
            Giao dịch 6 tháng gần nhất
          </h2>
          <p className="text-sm text-muted">
            Thanh đo bằng số giao dịch của tháng cao nhất
          </p>
        </div>

        <div className="mt-4">
          <Table
            head={["Tháng", "Giao dịch", "So với tháng cao nhất", "Khối lượng (kg)", "Bình quân mỗi giao dịch"]}
          >
            {s.trend.map((t) => (
              <tr key={t.month}>
                <Td className="font-semibold whitespace-nowrap text-ink">{t.month}</Td>
                <Td className="tabular-nums whitespace-nowrap">{fmtInt(t.handovers)}</Td>
                <Td className="w-[220px]">
                  <span className="block h-2 overflow-hidden rounded-full bg-surface-3">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${Math.round((t.handovers / TREND_PEAK) * 100)}%` }}
                    />
                  </span>
                </Td>
                <Td className="tabular-nums whitespace-nowrap">{fmtInt(t.volume)}</Td>
                <Td className="tabular-nums whitespace-nowrap">
                  {Math.round(t.volume / t.handovers)} kg
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </section>
    </div>
  )
}