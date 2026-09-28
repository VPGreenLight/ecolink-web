import { Link } from "react-router-dom"
import { FOOTER_COLUMNS, SUPPORT } from "@/data/nav"

const HEADING = "text-xs font-semibold tracking-[0.12em] text-brand uppercase"
const LINK = "text-sm leading-6 text-body transition-colors hover:text-brand-deep"

export default function Footer() {
  return (
    <footer className="border-t border-line-soft bg-white">
      <div className="page pt-12 pb-8">
        {/* cột thương hiệu rộng hơn vì chứa logo 190px + đoạn văn dài;
            cột hỗ trợ rộng hơn vì có thêm đoạn mô tả. 4 cột flex-1 như cũ
            sẽ ép mỗi cột còn ~180px từ md trở xuống và bị chật. */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.3fr] lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" aria-label="EcoLink - Trang chủ" className="inline-block">
              <img src="/assets/brand/logo1.png" alt="EcoLink" className="w-[130px]" />
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-[1.7] text-body">
              Hạ tầng số hóa kết nối chuỗi giá trị thu gom, phân loại và tái chế
              tuần hoàn tại Việt Nam vì một tương lai không phát thải rác.
            </p>
            <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-brand">
              <i className="size-2.5 rounded-full bg-mint" />
              100% Cam kết minh bạch dữ liệu
            </p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <FooterList key={col.title} title={col.title} items={col.links} />
          ))}

          <FooterList
            title={SUPPORT.title}
            note={SUPPORT.note}
            items={SUPPORT.links}
          />
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 EcoLink Circular Platform. Bảo lưu mọi quyền.</span>
          <span>Hệ thống sẵn sàng tại các tỉnh thành</span>
        </div>
      </div>
    </footer>
  )
}

function FooterList({
  title,
  note,
  items,
}: {
  title: string
  note?: string
  items: readonly (string | { label: string; to: string })[]
}) {
  return (
    <div>
      <h3 className={HEADING}>{title}</h3>
      {note && <p className="mt-4 text-sm leading-6 text-body">{note}</p>}
      <ul className={`flex flex-col gap-2.5 ${note ? "mt-3" : "mt-4"}`}>
        {items.map((item) => (
          <li key={typeof item === "string" ? item : item.to}>
            {/* link nội bộ dùng Link để điều hướng client-side; còn lại chưa có
                trang thì href="#" như cũ, không giả vờ là đã xong. */}
            {typeof item === "string" ? (
              <a href="#" className={LINK}>
                {item}
              </a>
            ) : (
              <Link to={item.to} className={LINK}>
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
