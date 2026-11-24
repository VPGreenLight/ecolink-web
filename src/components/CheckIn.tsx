import { useEffect, useState } from "react"
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
import {
  fetchCheckinStatus,
  performDailyCheckin,
  type CheckinStatusDto,
} from "@/lib/gamificationApi"
import { isSsrSmokeTest } from "@/lib/hydration"
import { openAuthPopup } from "@/lib/popupAuth"
import { useSession, hasLiveBackendAuth } from "@/lib/session"

const KEY = "ecolink.checkin"
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

/** Điểm danh hằng ngày (U-13). Hỗ trợ cả chế độ ngoại tuyến (localStorage) lẫn API thật. */
export default function CheckIn({
  balance,
  onEarn,
  onSyncBalance,
}: {
  balance: number
  onEarn: (n: number) => void
  onSyncBalance?: (walletBalance: number) => void
}) {
  const session = useSession()
  const isGuest = !session && !isSsrSmokeTest()
  const useLiveApi =
    hasLiveBackendAuth() &&
    (session?.role === "user" || session?.role === "recycler")

  const [v, setV] = useState<CheckIn>(() => readCheckIn(KEY))
  const [liveStatus, setLiveStatus] = useState<CheckinStatusDto | null>(null)
  const [loadingLive, setLoadingLive] = useState(useLiveApi)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(0)
  const [capNotice, setCapNotice] = useState("")
  const [errMsg, setErrMsg] = useState("")

  useEffect(() => {
    if (!useLiveApi) return
    let active = true
    setLoadingLive(true)
    fetchCheckinStatus()
      .then((res) => {
        if (!active || !res.data) return
        setLiveStatus(res.data)
        onSyncBalance?.(res.data.walletBalance)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingLive(false)
      })
    return () => {
      active = false
    }
  }, [useLiveApi])

  const today = dayKey()
  const done = useLiveApi ? (liveStatus?.checkedInToday ?? false) : doneToday(v, today)
  const next = useLiveApi
    ? (liveStatus?.todayRewardPreview ?? 0)
    : nextReward(v, today)

  const currentStreak = useLiveApi ? (liveStatus?.currentStreak ?? 0) : v.day

  const press = async () => {
    if (isGuest) {
      openAuthPopup("login")
      return
    }
    if (done || busy) return
    if (useLiveApi) {
      setBusy(true)
      setCapNotice("")
      setErrMsg("")
      try {
        const res = await performDailyCheckin()
        if (res.data) {
          setFlash(res.data.pointsAwarded)
          if (res.data.limitedByDailyCap) {
            setCapNotice("Đã chạm giới hạn điểm thưởng phi giao dịch trong ngày.")
          }
          onSyncBalance?.(res.data.walletBalance)
          const updated = await fetchCheckinStatus()
          if (updated.data) setLiveStatus(updated.data)
        }
      } catch (err) {
        setErrMsg(
          err instanceof Error ? err.message : "Không thể điểm danh lúc này.",
        )
      } finally {
        setBusy(false)
      }
      return
    }

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
          {loadingLive
            ? "Đang đồng bộ..."
            : done
              ? "Đã điểm danh hôm nay"
              : `Còn ${fmt(next)} điểm hôm nay`}
        </p>
      </div>

      {useLiveApi && liveStatus?.calendar?.length ? (
        <ol className="mt-4 grid grid-cols-7 gap-1.5">
          {liveStatus.calendar.slice(-7).map((item, i) => {
            const passed = item.checkedIn
            const isTodayCell = i === liveStatus.calendar.slice(-7).length - 1
            return (
              <li key={item.date} className="flex flex-col items-center gap-1">
                <span
                  className={`flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-lg font-bold tabular-nums ${
                    passed
                      ? "bg-brand text-white"
                      : isTodayCell && !done
                        ? "bg-brand/12 text-brand"
                        : "bg-surface-2/60 text-muted"
                  }`}
                >
                  {passed ? (
                    <>
                      <span>✓</span>
                      <span className="text-[10px]">+{item.pointsAwarded}</span>
                    </>
                  ) : (
                    <>
                      <Coin className="size-3.5 sm:size-6" />
                      <span className="text-[10px] sm:text-xs">
                        {isTodayCell ? `+${fmt(next)}` : "—"}
                      </span>
                    </>
                  )}
                </span>
                <span className="text-[9px] whitespace-nowrap text-muted sm:text-[10px]">
                  {item.date.slice(5)}
                </span>
              </li>
            )
          })}
        </ol>
      ) : (
        <ol className="mt-4 grid grid-cols-7 gap-1.5">
          {CHECKIN_REWARDS.map((r, i) => {
            const passed = i < (currentStreak % CHECKIN_DAYS || (done && currentStreak > 0 ? CHECKIN_DAYS : 0))
            const isNext = !done && i === (currentStreak % CHECKIN_DAYS)
            const isLast = i === CHECKIN_DAYS - 1
            return (
              <li key={r} className="flex flex-col items-center gap-1">
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
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="button"
          onClick={() => void press()}
          disabled={!isGuest && (done || busy || loadingLive)}
          className="btn btn-primary h-11 px-5"
        >
          {isGuest
            ? "Đăng nhập để điểm danh"
            : busy
              ? "Đang nhận..."
              : done
                ? "Đã điểm danh"
                : `Nhận ${fmt(next)}`}
          {!isGuest && !done && !busy && <Coin className="size-4" />}
        </button>
        <p className="text-[13px] leading-5 text-muted" role="status">
          {isGuest ? (
            "Đăng nhập tài khoản để tích điểm điểm danh hằng ngày."
          ) : capNotice ? (
            <span className="font-medium text-brand-deep">{capNotice}</span>
          ) : flash > 0 ? (
            <span className="inline-flex flex-wrap items-center gap-1 font-semibold text-brand">
              <span>
                +{fmt(flash)} điểm · số dư {fmt(balance)}
              </span>
              <Coin className="size-4" />
            </span>
          ) : done ? (
            useLiveApi
              ? `Chuỗi ${liveStatus?.currentStreak ?? 1} ngày liên tiếp · Trần còn lại hôm nay: ${fmt(liveStatus?.dailyCapRemaining ?? 0)} điểm`
              : `Chuỗi ${v.day}/7 ngày${streakAlive(v, today) ? "" : " · chuỗi đã đứt"}`
          ) : useLiveApi && liveStatus?.streakWillReset ? (
            "Bạn đã bỏ lỡ hôm qua — điểm danh hôm nay sẽ bắt đầu lại chuỗi mới."
          ) : (
            "Bỏ một ngày là chuỗi tính lại từ đầu."
          )}
        </p>
        {errMsg && (
          <p role="alert" className="w-full text-[13px] font-medium text-warn">
            {errMsg}
          </p>
        )}
      </div>
    </>
  )
}
