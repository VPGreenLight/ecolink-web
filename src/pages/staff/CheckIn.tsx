import { useEffect, useState } from "react"
import CheckIn from "@/components/CheckIn"
import { Empty, Field, PageHead, Status, Table, Td } from "@/components/Portal"
import { fmt } from "@/data/rewards"
import { initApiState } from "@/lib/hydration"
import {
  checkInStaff,
  checkOutStaff,
  getMyAttendance,
  type StaffAttendanceItemDto,
} from "@/lib/governanceApi"
import { useUser } from "@/lib/session"

/**
 * S-11 Điểm danh ca trực hằng ngày của Nhân viên vận hành.
 *
 *  - BR-GAM-09: Tối đa 1 lần điểm danh bắt đầu ca trực mỗi ngày dương lịch (UTC+7);
 *    điểm ca trực (`workPointsEarned`) hoàn toàn tách biệt khỏi Điểm Mầm Xanh đổi quà
 *    của Người dân (`Users.CurrentGreenPoints`).
 *  - Hỗ trợ cả Bắt đầu ca trực (`check-in`), Kết thúc ca & Bàn giao (`check-out`),
 *    và bảng Nhật ký ca làm việc trong tháng.
 */
export default function StaffCheckIn() {
  const user = useUser()
  const [points, setPoints] = useState(0)
  const [tasksHandled, setTasksHandled] = useState(() => initApiState(0, 42))
  const [checkedInToday, setCheckedInToday] = useState(false)
  const [checkedOutToday, setCheckedOutToday] = useState(false)
  const [streak, setStreak] = useState(0)
  const [records, setRecords] = useState<StaffAttendanceItemDto[]>([])
  const [shiftNote, setShiftNote] = useState("")
  const [isLive, setIsLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState("")
  const [errMsg, setErrMsg] = useState("")

  useEffect(() => {
    let cancelled = false
    getMyAttendance()
      .then((res) => {
        if (cancelled || !res.data) return
        setPoints(res.data.totalWorkPointsMonth)
        setTasksHandled(res.data.totalTasksHandled)
        setCheckedInToday(res.data.checkedInToday)
        setCheckedOutToday(res.data.checkedOutToday)
        setStreak(res.data.currentStreak)
        setRecords(res.data.recentRecords ?? [])
        if (res.data.todayRecord?.shiftNote) {
          setShiftNote(res.data.todayRecord.shiftNote)
        }
        setIsLive(true)
      })
      .catch(() => {
        // Fallback giữ widget CheckIn cục bộ khi chưa kết nối Backend
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleServerCheckIn = async () => {
    setErrMsg("")
    setFlash("")
    if (shiftNote.trim().length > 500) {
      setErrMsg("Ghi chú bàn giao ca trực không được vượt quá 500 ký tự.")
      return
    }
    setBusy(true)
    try {
      const res = await checkInStaff(shiftNote.trim())
      if (res.data) {
        setPoints(res.data.totalWorkPointsMonth)
        setTasksHandled(res.data.totalTasksHandled)
        setCheckedInToday(res.data.checkedInToday)
        setCheckedOutToday(res.data.checkedOutToday)
        setStreak(res.data.currentStreak)
        setRecords(res.data.recentRecords ?? [])
      }
      setFlash(res.message || "Đã điểm danh bắt đầu ca trực thành công.")
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Điểm danh ca trực thất bại.")
    } finally {
      setBusy(false)
    }
  }

  const handleServerCheckOut = async () => {
    setErrMsg("")
    setFlash("")
    if (shiftNote.trim().length > 500) {
      setErrMsg("Ghi chú bàn giao ca trực không được vượt quá 500 ký tự.")
      return
    }
    setBusy(true)
    try {
      const res = await checkOutStaff(shiftNote.trim())
      if (res.data) {
        setCheckedOutToday(res.data.checkedOutToday)
        setRecords(res.data.recentRecords ?? [])
      }
      setFlash(res.message || "Đã kết thúc ca trực và lưu ghi chú bàn giao.")
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Chốt ca trực thất bại.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="NHÂN VIÊN · S-11"
        title="Điểm danh & Nhật ký ca trực hằng ngày"
        body={`${user || "Bạn"} điểm danh đầu ca để ghi nhận chuyên cần và lưu biên bản bàn giao cuối ca. Chuỗi 7 ngày liên tiếp được thưởng nhân hệ số chuyên cần.`}
      />

      <section className="card flex flex-col gap-6 p-5 md:p-7 lg:flex-row lg:items-center lg:gap-10">
        <div className="min-w-0 flex-1">
          <CheckIn
            balance={points}
            onEarn={(n) => {
              setPoints((p) => p + n)
              if (isLive && !checkedInToday) {
                void handleServerCheckIn()
              }
            }}
          />
        </div>

        <dl className="flex shrink-0 flex-col gap-3 border-t border-line-soft pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
          <div>
            <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              Điểm chuyên cần tháng
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
              {fmt(tasksHandled)}
            </dd>
          </div>
          {isLive && (
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                Chuỗi ca trực hiện tại
              </dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-ink">{streak} ngày</dd>
            </div>
          )}
        </dl>
      </section>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (!checkedInToday) {
            void handleServerCheckIn()
          } else if (!checkedOutToday) {
            void handleServerCheckOut()
          }
        }}
        className="card flex flex-col gap-4 p-5 md:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">Bàn giao & Kết thúc ca trực hôm nay</h2>
            <p className="mt-0.5 text-[13px] text-muted">
              Ghi chú tồn đọng (hồ sơ đối tác, khiếu nại đang chờ xác minh) cho ca kế tiếp.
            </p>
          </div>
          <Status tone={checkedOutToday ? "off" : checkedInToday ? "ok" : "wait"}>
            {checkedOutToday
              ? "Đã chốt ca hôm nay"
              : checkedInToday
                ? "Đang trong ca trực"
                : "Chưa mở ca"}
          </Status>
        </div>

        <Field label="Ghi chú bàn giao ca trực">
          <textarea
            className="input min-h-[84px] py-2"
            value={shiftNote}
            onChange={(e) => {
              setShiftNote(e.target.value)
              setErrMsg("")
            }}
            placeholder="Ví dụ: Đã xử lý 14 ảnh AI sai, còn hồ sơ HS-0231 chờ bổ sung ảnh cơ sở..."
          />
        </Field>

        {errMsg && (
          <p
            role="alert"
            className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn"
          >
            {errMsg}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!checkedInToday ? (
            <button
              type="submit"
              disabled={busy}
              className="btn-primary h-10 px-5 text-[13px]"
            >
              {busy ? "Đang ghi nhận..." : "Mở ca trực trên hệ thống"}
            </button>
          ) : (
            <button
              type="submit"
              disabled={busy || checkedOutToday}
              className="btn-outline h-10 px-5 text-[13px]"
            >
              {checkedOutToday
                ? "Đã kết thúc ca trực"
                : busy
                  ? "Đang chốt ca..."
                  : "Kết thúc ca & Lưu bàn giao"}
            </button>
          )}
          {flash && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {flash}
            </p>
          )}
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-ink">Nhật ký chấm công trong tháng</h2>
        {records.length === 0 ? (
          <Empty>
            Nhật ký chấm công máy chủ sẽ hiển thị tại đây ngay sau khi bạn mở ca trực đầu tiên.
          </Empty>
        ) : (
          <Table head={["Ngày trực", "Giờ vào ca", "Giờ ra ca", "Thời lượng", "Điểm ca", "Ghi chú bàn giao"]}>
            {records.map((r) => (
              <tr key={r.id}>
                <Td className="tabular-nums font-semibold text-ink whitespace-nowrap">
                  {r.workDate}
                </Td>
                <Td className="tabular-nums whitespace-nowrap">
                  {new Date(r.checkInAt).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Td>
                <Td className="tabular-nums whitespace-nowrap">
                  {r.checkOutAt
                    ? new Date(r.checkOutAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Đang trực"}
                </Td>
                <Td className="tabular-nums whitespace-nowrap">
                  {r.workedMinutes != null ? `${r.workedMinutes} phút` : "—"}
                </Td>
                <Td className="tabular-nums font-semibold text-brand">+{r.workPointsEarned}</Td>
                <Td>{r.shiftNote || "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Điểm chuyên cần dùng để đánh giá KPI vận hành nội bộ cuối tháng (BR-GAM-09), hoàn toàn tách biệt với ví Điểm Mầm Xanh của người dân và không quy đổi ra quà tặng dân sinh.
      </p>
    </div>
  )
}
