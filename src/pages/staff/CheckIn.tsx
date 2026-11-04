import { useState } from "react"
import { PageHead } from "@/components/Portal"
import CheckIn from "@/components/CheckIn"
import { fmt } from "@/data/rewards"
import { useUser } from "@/lib/session"

/** S-11 Điểm danh nhân viên.
 *
 *  Dùng lại đúng `CheckIn` của người dân thay vì viết bản thứ hai: cùng một
 *  quy tắc chuỗi 7 ngày, cùng một chỗ lưu trạng thái. Hai bản khác nhau sẽ
 *  phải sửa hai chỗ mỗi lần đổi công thức thưởng.
 *
 *  Điểm của nhân viên là điểm nhận việc, không dùng để đổi quà — nên ô số dư
 *  hiện dưới dạng liệt kê, không phải số dư như trang người dân. */
export default function StaffCheckIn() {
  const user = useUser()
  const [points, setPoints] = useState(0)

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="NHÂN VIÊN"
        title="Điểm danh hằng ngày"
        body={`${user || "Bạn"} điểm danh đầu ngày để nhận điểm làm việc. Chuỗi 7 ngày, ngày thứ 7 thưởng gấp rưỡi.`}
      />

      <section className="card flex flex-col gap-6 p-5 md:p-7 lg:flex-row lg:items-center lg:gap-10">
        <CheckIn balance={points} onEarn={(n) => setPoints((p) => p + n)} />

        <dl className="flex shrink-0 flex-col gap-3 border-t border-line-soft pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
          <div>
            <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              Điểm nhận việc
            </dt>
            <dd className="mt-1 text-3xl leading-9 font-bold tabular-nums text-brand">
              {fmt(points)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              Công việc đã xử lý
            </dt>
            <dd className="mt-1 text-3xl leading-9 font-bold tabular-nums text-ink">
              42
            </dd>
          </div>
        </dl>
      </section>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Điểm nhận việc dùng để xếp giải thưởng cuối tháng, không đổi được quà và
        không quy về tài khoản ngân hàng. Nếu bạn quên điểm danh một ngày thì chuỗi
        tính lại từ ngày 1.
      </p>
    </div>
  )
}