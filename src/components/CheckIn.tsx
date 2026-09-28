import { useState } from "react"
import {
  CHECKIN_DAYS,
  CHECKIN_REWARDS,
  checkIn,
  dayKey,
  doneToday,
  nextReward,
  readCheckIn,
  streakAlive,
  writeCheckIn,
  type CheckIn,
} from "@/data/checkin"
import { fmt } from "@/data/rewards"

const KEY = "ecolink.checkin"

/** Điểm danh hằng ngày. Chuỗi 7 ngày, ngày thứ 7 trả gấp rưỡi cả chuỗi để
 *  có lý do phải quay lại. Bỏ một ngày là chuỗi đứt, về lại mốc 20.
 *
 *  Điểm cộng vào số dư của cha: bấm là thấy con số tăng ngay cạnh nút, nếu
 *  không thì nút bấm không có phản hồi gì. */
export default function CheckIn({
  balance,
  onEarn,
}: {
  balance: number
  onEarn: (n: number) => void
}) {
  const [v, setV] = useState<CheckIn>(() => readCheckIn(KEY))
  const [flash, setFlash] = useState(0)
  const today = dayKey()
  const done = doneToday(v, today)
  const next = nextReward(v, today)

  const press = () => {
    const r = checkIn(v, today)
    if (r.gained === 0) return
    setV(r.next)
    writeCheckIn(KEY, r.next)
    onEarn(r.gained)
    setFlash(r.gained)
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base leading-6 font-bold tracking-tight text-ink">
          Điểm danh hằng ngày
        </h2>
        <p className="text-[13px] text-muted">
          {done ? "Đã điểm danh hôm nay" : `Còn ${fmt(next)} điểm hôm nay`}
        </p>
      </div>

      <ol className="mt-4 grid grid-cols-7 gap-1.5">
        {CHECKIN_REWARDS.map((r, i) => {
          // i < v.day là những ngày đã điểm danh trong chuỗi hiện tại
          const passed = i < v.day
          const isNext = !done && i === v.day
          const isLast = i === CHECKIN_DAYS - 1
          return (
            <li key={r} className="flex flex-col items-center gap-1">
              <span
                className={`grid aspect-square w-full place-items-center rounded-lg text-[11px] font-bold tabular-nums ${
                  isLast
                    ? "bg-brand text-white"
                    : passed
                      ? "bg-brand/12 text-brand"
                      : isNext
                        ? "bg-surface-2 text-ink"
                        : "bg-surface-2/60 text-muted"
                }`}
              >
                {passed ? "✓" : fmt(r)}
              </span>
              <span className="text-[9px] whitespace-nowrap text-muted sm:text-[10px]">
                Ngày {i + 1}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <button type="button" onClick={press} disabled={done} className="btn btn-primary h-11 px-5">
          {done ? "Đã điểm danh" : `Nhận ${fmt(next)} điểm`}
        </button>
        <p className="text-[13px] leading-5 text-muted" role="status">
          {flash > 0 ? (
            <span className="font-semibold text-brand">
              +{fmt(flash)} điểm · số dư {fmt(balance)}
            </span>
          ) : done ? (
            `Chuỗi ${v.day}/7 ngày${streakAlive(v, today) ? "" : " · chuỗi đã đứt"}`
          ) : (
            "Bỏ một ngày là chuỗi tính lại từ đầu."
          )}
        </p>
      </div>
    </>
  )
}
