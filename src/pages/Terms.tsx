import { PageHead } from "@/components/Portal"

export default function Terms() {
  const sections = [
    {
      title: "1. Nguyên tắc phân loại rác tại nguồn",
      body: "Người tham gia cam kết phân loại rác đúng theo hướng dẫn 3 nhóm (Tái chế, Hữu cơ, Khác). Rác tái chế cần được làm sạch cơ bản, để khô ráo trước khi đặt lịch bàn giao nhằm đảm bảo an toàn vệ sinh và tối ưu giá trị thu gom.",
    },
    {
      title: "2. Quy chuẩn cân đo và biên nhận giao dịch",
      body: "Mọi giao dịch thu mua phế liệu qua nền tảng phải được cân đo minh bạch tại thời điểm bàn giao. Biên nhận điện tử được lập tức thì trên ứng dụng, ghi nhận khối lượng, đơn giá và số tiền/điểm xanh chuyển vào tài khoản.",
    },
    {
      title: "3. Cơ chế tích lũy điểm xanh và đổi quà",
      body: "Điểm xanh được cộng dồn theo khối lượng rác tái chế đã bàn giao thành công. Điểm tiêu dùng có thể dùng để đổi quà tặng hoặc voucher đối tác. Điểm xếp hạng được bảo lưu trọn đời để thăng hạng cây ảo và mở khóa các huy hiệu cộng đồng.",
    },
    {
      title: "4. Trách nhiệm của cơ sở thu gom và đối tác",
      body: "Cơ sở thu gom phải có giấy phép hoạt động hợp lệ, cam kết thu gom đúng hẹn và chuyển rác đến các nhà máy tái chế đạt chuẩn môi trường theo định hướng trách nhiệm mở rộng của nhà sản xuất (EPR).",
    },
    {
      title: "5. Bảo mật thông tin và quyền riêng tư",
      body: "EcoLink cam kết bảo vệ thông tin cá nhân và dữ liệu vị trí thu gom của người dùng. Dữ liệu chỉ được sử dụng cho mục đích điều phối lộ trình thu gom và thống kê báo cáo tác động môi trường số hóa.",
    },
  ]

  return (
    <div className="page flex flex-col gap-8 py-8">
      <PageHead
        eyebrow="ĐIỀU KHOẢN & QUY ĐỊNH"
        title="Điều khoản dịch vụ và chính sách môi trường"
        body="Quy chuẩn hoạt động, quyền lợi của người dân và cơ sở thu gom, cùng cam kết minh bạch trong chuỗi giá trị thu gom tuần hoàn tại EcoLink."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {sections.map((sec) => (
          <div key={sec.title} className="card p-6">
            <h2 className="text-base font-bold text-ink">{sec.title}</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-body">{sec.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
