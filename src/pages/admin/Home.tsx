import { Link } from "react-router-dom"
import { ColumnChart, PageHead, Stat, StatRow, Table, Td } from "@/components/admin/ui"
import { AI_SCAN_PEAK, DATASET, STATS, fmtInt, fmtVnd } from "@/data/ops"

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
        <Chart
          title="Giao dịch 6 tháng gần nhất"
          note="Cột cao nhất là tháng T9. Bảng dưới cho khối lượng, bình quân mỗi giao dịch và tốc độ tăng."
        >
          <ColumnChart
            data={s.trend.map((t) => ({ label: t.month, value: t.handovers }))}
          />

          <div className="mt-5">
            <Table
              head={["Tháng", "Giao dịch", "Tăng so với tháng trước", "Khối lượng (kg)", "Bình quân mỗi giao dịch"]}
            >
              {s.trend.map((t, i) => {
                const prev = s.trend[i - 1]
                const growth = prev ? ((t.handovers - prev.handovers) / prev.handovers) * 100 : null
                return (
                  <tr key={t.month}>
                    <Td className="font-semibold whitespace-nowrap text-ink">{t.month}</Td>
                    <Td className="tabular-nums whitespace-nowrap">{fmtInt(t.handovers)}</Td>
                    <Td className="tabular-nums whitespace-nowrap">
                      {growth === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={growth >= 0 ? "text-brand-deep" : "text-warn"}>
                          {growth >= 0 ? "+" : ""}
                          {growth.toFixed(1)}%
                        </span>
                      )}
                    </Td>
                    <Td className="tabular-nums whitespace-nowrap">{fmtInt(t.volume)}</Td>
                    <Td className="tabular-nums whitespace-nowrap">
                      {Math.round(t.volume / t.handovers)} kg
                    </Td>
                  </tr>
                )
              })}
            </Table>
          </div>
        </Chart>
      </section>

      <section>
        <Chart
          title="AI quét đúng và khiếu nại sai, theo nhóm rác"
          note="Hai số này lệch tầng vài chục nghìn so với vài trăm nên đặt chung một trục là vô nghĩa: cột khiếu nại sẽ không còn gì để nhìn. Tách hai dải, cùng thang đo, mỗi dải một nhãn."
          to="/staff/ai-review"
          cta="Ảnh AI sai"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Scale
              title="AI nhận diện đúng"
              unit="lượt"
              rows={s.aiByGroup.map((g) => ({
                label: g.group,
                value: g.correct,
                note: `${((g.correct / g.scans) * 100).toFixed(1)}% chính xác`,
              }))}
            />
            <Scale
              title="Khiếu nại sai (báo nhầm, AI đúng)"
              unit="lượt"
              rows={s.aiByGroup
                .map((g) => ({
                  label: g.group,
                  value: g.falseReports,
                  note: `${((g.falseReports / g.scans) * 100).toFixed(1)}% tổng lượt quét`,
                }))
                .sort((a, b) => b.value - a.value)}
            />
          </div>
        </Chart>
      </section>

      <section>
        <Chart
          title="Độ chính xác nhận diện theo lớp rác"
          note={`Đo trên tập kiểm chứng, trung bình toàn hệ thống ${DATASET.accuracy}%. Lớp dưới đường cơ sở là lớm đang mất tiền và mất uy tín.`}
          to="/staff/dataset"
          cta="Tập dữ liệu"
        >
          <ul className="flex flex-col">
            {DATASET.byClass.map((c) => {
              const below = c.accuracy < DATASET.accuracy
              return (
                <li
                  key={c.label}
                  className="grid grid-cols-[minmax(0,132px)_1fr_92px] items-center gap-3 py-1.5"
                >
                  <span className="truncate text-[13px] text-body">{c.label}</span>
                  <span className="relative h-2 overflow-hidden rounded-full bg-surface-3">
                    {/* Đường cơ sở = trung bình toàn hệ thống. Tham chiếu chứ không
                        phải dữ liệu, nên vẽ bằng gradient cứng chứ không phải
                        thanh dữ liệu. */}
                    <span className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,var(--color-mint),var(--color-brand))]" style={{ width: `${c.accuracy}%` }} />
                    <span
                      className="absolute inset-y-0 w-px bg-ink/45"
                      style={{ left: `${DATASET.accuracy}%` }}
                    />
                  </span>
                  <span className="text-right text-[13px] font-semibold tabular-nums text-ink">
                    {c.accuracy}%
                  </span>
                  <span className="sr-only">
                    {below ? "Dưới trung bình toàn hệ thống" : "Bằng hoặc trên trung bình"}
                  </span>
                </li>
              )
            })}
          </ul>
        </Chart>
      </section>
    </div>
  )
}

/** Dải thanh ngang theo một thang đo DÙNG CHUNG cho mọi dải trên trang.
 *
 *  `AI_SCAN_PEAK` là mẫu số chung, không phải max của từng dải: hai dải phải
 *  so được với nhau, nếu mỗi dải tự chuẩn hoá thì cột ngắn nhất trông dài
 *  bằng cột dài nhất và con số phải mới là nơi duy nhất để tin — đúng thứ mà
 *  biểu đồ sinh ra để bỏ. */
function Scale({
  title,
  unit,
  rows,
}: {
  title: string
  unit: string
  rows: readonly { label: string; value: number; note: string }[]
}) {
  return (
    <div>
      <h3 className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">
        {title}
      </h3>
      <ul className="mt-2">
        {rows.map((r) => (
          <li
            key={r.label}
            className="grid grid-cols-[minmax(0,86px)_1fr_92px] items-center gap-x-3 gap-y-0.5 py-1.5"
          >
            <span className="truncate text-[13px] text-body">{r.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
              <span
                className="block h-full rounded-full bg-brand"
                style={{ width: `${Math.max((r.value / AI_SCAN_PEAK) * 100, 0.8)}%` }}
              />
            </span>
            <span className="text-right text-[13px] font-semibold tabular-nums text-ink">
              {fmtInt(r.value)}
            </span>
            <span className="col-start-2 col-end-3 text-[11px] tabular-nums text-muted">
              {r.note} · {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Khung biểu đồ: tiêu đề + chú giải + đường tới màn hình quản lý. Cùng một
 *  bố cục cho cả ba biểu đồ — lệch bố cục thì ba khối trông như ba sản phẩm
 *  khác nhau. */
function Chart({
  title,
  note,
  to,
  cta,
  children,
}: {
  title: string
  note: string
  to?: string
  cta?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">{title}</h2>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <p className="max-w-[52ch] text-sm text-muted">{note}</p>
          {to && cta && (
            <Link
              to={to}
              className="text-[13px] font-semibold text-brand whitespace-nowrap transition-colors hover:text-brand-deep"
            >
              {cta} →
            </Link>
          )}
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-line bg-white p-5">{children}</div>
    </div>
  )
}