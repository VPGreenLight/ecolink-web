import { PageHead, Stat, Table, Td } from "@/components/Portal"
import { DATASET, fmtInt } from "@/data/ops"

/** S-03 Cập nhật tập dữ liệu kiểm chứng: xem độ phủ theo lớp và độ chính xác
 *  từng lớp. Lớp có độ chính xác thấp là lớp cần thêm ảnh, nên bảng sắp theo
 *  độ chính xác tăng dần để thấy ngay chỗ yếu ở trên cùng. */
export default function Dataset() {
  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="DỮ LIỆU AI"
        title="Tập dữ liệu kiểm chứng"
        body="Tập ảnh có nhãn dùng để đo độ chính xác mô hình. Bảng sắp theo độ chính xác tăng dần: lớp yếu nhất ở trên cùng."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Tổng ảnh trong tập" value={fmtInt(DATASET.total)} />
        <Stat
          label="Đã gán nhãn"
          value={fmtInt(DATASET.labeled)}
          note={`${fmtInt(DATASET.total - DATASET.labeled)} ảnh chờ gán`}
        />
        <Stat
          label="Độ chính xác"
          value={`${DATASET.accuracy}%`}
          note="Đo trên tập kiểm chứng"
        />
      </div>

      <Table head={["Lớp vật liệu", "Số ảnh", "Độ chính xác", "Trạng thái"]}>
        {[...DATASET.byClass]
          .sort((a, b) => a.accuracy - b.accuracy)
          .map((c) => (
            <tr key={c.label}>
              <Td className="font-semibold text-ink">{c.label}</Td>
              <Td className="tabular-nums">{fmtInt(c.count)}</Td>
              <Td className="tabular-nums">{c.accuracy}%</Td>
              <Td>
                {/* Ngưỡng 90%: dưới ngưỡng là lớp đang nhận nhầm trên sản
                    phẩm thật, nên nó đứng hẳn lên bằng chữ đậm. */}
                {c.accuracy < 90 ? (
                  <span className="font-semibold text-brand">Cần ưu tiên thu thập</span>
                ) : (
                  <span className="text-muted">Đạt</span>
                )}
              </Td>
            </tr>
          ))}
      </Table>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Ảnh gán từ báo cáo của người dùng được đưa vào đây tự động khi nhân viên
        xác nhận ở trang đánh giá ảnh AI. Muốn bổ sung ảnh chủ động thì tải lên tập
        riêng và ghi rõ nguồn, để không trộn ảnh chưa kiểm tra vào tập đo lười.
      </p>
    </div>
  )
}