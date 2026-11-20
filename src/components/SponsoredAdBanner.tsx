import { Link } from "react-router-dom"
import { Sparkles, VolumeX } from "lucide-react"
import { useEntitlements } from "@/lib/servicePackageApi"

/** Banner quảng cáo / tài trợ sinh thái hiển thị cho tài khoản gói Basic (0đ).
 *  Tự động ẩn hoàn toàn ngay khi tài khoản nâng cấp Premium (59k) hoặc Pro (1tr) có `isAdFree === true`. */
export default function SponsoredAdBanner({
  upgradeTo = "/user/payout",
  compact = false,
}: {
  upgradeTo?: string
  compact?: boolean
}) {
  const entitlements = useEntitlements()

  if (entitlements.isAdFree) {
    return null
  }

  return (
    <aside
      aria-label="Quảng cáo đối tác tài trợ"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-gradient-to-r from-mint/55 via-white to-surface-2 ${
        compact ? "px-4 py-3" : "px-5 py-4"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand-deep">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-muted uppercase">
              Quảng cáo · Gói Basic
            </span>
            <p className="text-sm font-bold text-ink">
              Thu gom sạch xanh cùng Đối tác Bao bì Sinh học GreenPack
            </p>
          </div>
          <p className="mt-0.5 text-xs leading-5 text-body">
            Nâng cấp gói <b>Premium (59.000 đ/30 ngày)</b> để tắt toàn bộ quảng cáo và nhận thêm +20% điểm điểm danh hằng ngày.
          </p>
        </div>
      </div>

      {upgradeTo.startsWith("#") ? (
        <a
          href={upgradeTo}
          className="btn-outline inline-flex h-9 shrink-0 items-center gap-1.5 px-3.5 text-xs font-semibold"
        >
          <VolumeX className="size-3.5" aria-hidden="true" />
          Tắt quảng cáo
        </a>
      ) : (
        <Link
          to={upgradeTo}
          className="btn-outline inline-flex h-9 shrink-0 items-center gap-1.5 px-3.5 text-xs font-semibold"
        >
          <VolumeX className="size-3.5" aria-hidden="true" />
          Tắt quảng cáo
        </Link>
      )}
    </aside>
  )
}
