import { Link } from "react-router-dom"
import { PageHead, Stat } from "@/components/Portal"
import { ECO_FACTS, GIFTS, POSTS, STATS, DATASET, fmtInt } from "@/data/ops"

/** Tổng quan nhân viên (Staff). Không phải bảng điều khiển số liệu lớn như
 *  của Admin (A-01) — nhân viên cần biết "hôm nay có bao nhiêu việc đang chờ
 *  mình", đó là toàn bộ màn hình này. */
export default function StaffHome() {
  const queue = [
    { to: "/staff/ai-review", label: "Ảnh AI nhận diện sai", n: STATS.pending.aiCases, unit: "ảnh" },
    { to: "/staff/applications", label: "Hồ sơ đối tác thu mua", n: STATS.pending.applications, unit: "hồ sơ" },
    { to: "/staff/complaints", label: "Khiếu nại giao dịch", n: STATS.pending.complaints, unit: "khiếu nại" },
    { to: "/staff/blog", label: "Bài blog chờ duyệt", n: STATS.pending.posts, unit: "bài" },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="VẬN HÀNH"
        title="Việc đang chờ bạn xử lý"
        body="Danh sách này là toàn bộ việc tồn đọng của đội ngũ. Xong hết thì báo Admin, không tự ý thêm việc ngoài danh sách này."
      />

      <ul className="grid gap-4 sm:grid-cols-2">
        {queue.map((q) => (
          <li key={q.to} className="card flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{q.label}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {q.n} {q.unit} đang chờ
              </p>
            </div>
            <Link to={q.to} className="btn-outline h-10 shrink-0 px-4 text-[13px]">
              Xử lý
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Độ chính xác AI"
          value={DATASET.accuracy + "%"}
          note={`${fmtInt(DATASET.labeled)} ảnh đã gán nhãn`}
        />
        <Stat
          label="Ảnh trong tập kiểm chứng"
          value={fmtInt(DATASET.total)}
          note={`${fmtInt(DATASET.total - DATASET.labeled)} ảnh chờ gán nhãn`}
        />
        <Stat
          label="Kho quà đang mở"
          value={String(GIFTS.filter((g) => g.active).length)}
          note={`${GIFTS.filter((g) => g.stock === 0).length} món hết hàng`}
        />
        <Stat
          label="Eco Fact đang mở"
          value={`${ECO_FACTS.filter((f) => f.open).length} / ${ECO_FACTS.length}`}
          note={`${POSTS.filter((p) => p.status === "published").length} bài blog đã xuất bản`}
        />
      </div>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Bạn không có quyền đổi cấu hình hệ thống, phí giao dịch hay tài khoản
        nhân viên — những phần đó thuộc Admin. Nếu cần thay đổi, gửi yêu cầu
        kèm lý do.
      </p>
    </div>
  )
}