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

/** Đơn vị điểm của phần điểm danh: xu EcoLink.
 *
 *  Dùng bản `.webp` chứ không dùng `.png`: file gốc 1254px nặng 897KB, mà icon
 *  này hiển thị 12–16px — thừa ~80 lần. Bản webp 128px nặng 2.4KB, giảm 99,7%
 *  và vẫn giữ alpha (đã kiểm bằng cách ép nền xanh sau ảnh).
 *    ffmpeg -i ecolink-coin.png -vf "scale=128:128:flags=lanczos" \
 *           -c:v libwebp -lossless 0 -quality 82 -an ecolink-coin.webp
 *  File gốc PNG giữ nguyên trong `public/assets/AI/` để dựng lại, y hệt bộ
 *  ảnh robot AI. */
const COIN = "/assets/AI/ecolink-coin.webp"

function Coin({ className }: { className: string }) {
  return (
    <img
      src={COIN}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={128}
      height={128}
      className={`shrink-0 object-contain ${className}`}
    />
  )
}

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
              {/* Ô vuông, xu ở trên số ở dưới chứ KHÔNG đặt cạnh nhau: ở 320px mỗi ô
                chỉ ~28px rộng, "+500" + xu nằm ngang là 44px là tràn sang ô
                bên cạnh. Xếp dọc thì bề rộng cần = số rộng nhất, đúng bằng
                dòng nhãn "Ngày 7" đã vừa sẵn ở đó. Ô vuông rộng từ 28px (320px)
                tới ~104px (desktop) nên xu và số cùng phóng to theo breakpoint —
                dùng chung một cỡ thì chỗ này nhỏ như hạt, chỗ kia chật. */}
              <span
                className={`flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-lg font-bold tabular-nums ${
                  isLast
                    ? "bg-brand text-white"
                    : passed
                      ? "bg-brand/12 text-brand"
                      : isNext
                        ? "bg-surface-2 text-ink"
                        : "bg-surface-2/60 text-muted"
                }`}
              >
                {passed ? (
                  "✓"
                ) : (
                  <>
                    <Coin className="size-3.5 sm:size-7" />
                    <span className="text-[10px] sm:text-base">+{fmt(r)}</span>
                  </>
                )}
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
          {done ? "Đã điểm danh" : `Nhận ${fmt(next)}`}
          {!done && <Coin className="size-4" />}
        </button>
        <p className="text-[13px] leading-5 text-muted" role="status">
          {flash > 0 ? (
            <span className="inline-flex flex-wrap items-center gap-1 font-semibold text-brand">
              <span>
                +{fmt(flash)} điểm · số dư {fmt(balance)}
              </span>
              <Coin className="size-4" />
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
