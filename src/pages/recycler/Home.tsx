import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Check, Crown, Lock, QrCode, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Star } from "lucide-react"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import { PageHead, Stat, Status } from "@/components/Portal"
import SponsoredAdBanner from "@/components/SponsoredAdBanner"
import VietQrCheckoutModal from "@/components/VietQrCheckoutModal"
import { initApiLoading, initApiState } from "@/lib/hydration"
import { MY_HANDOVERS, type HandoverStatus } from "@/data/handover"
import { FLOWS } from "@/data/cashflow"
import { STATS, fmtVnd } from "@/data/ops"
import {
  fetchHandoverOrdersResult,
  fetchRecyclerStatus,
  toggleRecyclerOnlineStatus,
  updateRecyclerWarehousePin,
  type RecyclerProfileDto,
} from "@/lib/recyclerWorkflowApi"
import {
  CANONICAL_FALLBACK_PACKAGES,
  createServicePaymentOrder,
  getAvailableServicePackages,
  getMyServiceOrders,
  getMyServiceSubscriptions,
  setLocalEntitlements,
  useEntitlements,
  type ActiveSubscriptionDto,
  type PayInOrderDto,
  type ServicePackageCatalogDto,
} from "@/lib/servicePackageApi"
import { getAccessToken, getSession, hasLiveBackendAuth } from "@/lib/session"

type UpcomingRow = {
  id: string
  address: string
  date: string
  slot: string
  status: HandoverStatus
  pickupLat?: number
  pickupLng?: number
}

function getTierRank(
  tierOrCode?: string | null,
  isDefaultFree = false,
  requiresVerifiedKyb = false,
): number {
  const code = (tierOrCode ?? "").trim().toUpperCase()
  if (requiresVerifiedKyb || code === "PRO") return 2
  if (isDefaultFree || !code || code === "BASIC") return 0
  return 1
}

/** R-02 Bật/tắt trạng thái hoạt động trực tiếp trên bản đồ (`/map`) + R-01 Cập nhật ghim kho bãi.
 *
 *  Công tắc thật có `role="switch"` và `aria-checked`, kết nối trực tiếp tới
 *  `PATCH /api/v1/recycler/availability` của `RecyclerController`:
 *  - Khi tắt (`Offline`), ghim cơ sở lập tức ẩn khỏi `/map`, còn các lịch đang chờ xử lý vẫn giữ nguyên (`BR-MTH-06`).
 *  - Khi bật (`Online`), ghim cơ sở hiện trở lại ngay trên `/map`. */
export default function RecyclerHome() {
  const [open, setOpen] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [flash, setFlash] = useState("")
  const [syncedBackend, setSyncedBackend] = useState(false)

  const liveAuth = hasLiveBackendAuth()
  const [profile, setProfile] = useState<RecyclerProfileDto>(() =>
    liveAuth
      ? {
          recyclerId: "",
          facilityName: getSession()?.name || "Đang tải hồ sơ cơ sở...",
          representativeName: getSession()?.name || "",
          businessAddress: "",
          latitude: 21.0182,
          longitude: 105.5345,
          operatingHours: "07:30 - 19:00",
          contactPhone: "",
          verificationStatus: "Verified",
          activeStatus: "Online",
          activePriceCount: 0,
        }
      : {
          recyclerId: "22222222-2222-2222-2222-222222222222",
          facilityName: "Vựa phế liệu EcoGreen",
          representativeName: "Trần Thu Gom",
          businessAddress: "123 Đường Nguyễn Hữu Cảnh, P. 22, Bình Thạnh, TP.HCM",
          latitude: 10.7938,
          longitude: 106.7182,
          operatingHours: "07:30 - 18:30",
          contactPhone: "0988776655",
          verificationStatus: "Verified",
          activeStatus: "Online",
          activePriceCount: 4,
        },
  )

  const entitlements = useEntitlements()
  const [packages, setPackages] = useState<ServicePackageCatalogDto[]>(() =>
    initApiState([], CANONICAL_FALLBACK_PACKAGES),
  )
  const [activeSubs, setActiveSubs] = useState<ActiveSubscriptionDto[]>([])
  const [recentOrders, setRecentOrders] = useState<PayInOrderDto[]>([])
  const [buyingCode, setBuyingCode] = useState<string | null>(null)
  const [activeQrOrder, setActiveQrOrder] = useState<PayInOrderDto | null>(null)
  const [pkgNotice, setPkgNotice] = useState("")
  const [pkgErr, setPkgErr] = useState("")

  const [editingLocation, setEditingLocation] = useState(false)
  const [draftLat, setDraftLat] = useState(21.0182)
  const [draftLng, setDraftLng] = useState(105.5345)
  const [draftAddress, setDraftAddress] = useState(() =>
    initApiState("", "123 Đường Nguyễn Hữu Cảnh, P. 22, Bình Thạnh, TP.HCM"),
  )
  const [savingPin, setSavingPin] = useState(false)

  const [loadingHandovers, setLoadingHandovers] = useState<boolean>(() => initApiLoading(true))
  const [handovers, setHandovers] = useState<UpcomingRow[]>(() =>
    initApiState([], MY_HANDOVERS.filter((h) => h.status !== "done")),
  )

  const payin = liveAuth
    ? 0
    : FLOWS.filter((f) => f.kind === "payin").reduce((s, f) => s + f.amount, 0)

  const refreshRecyclerPackages = useCallback(async () => {
    try {
      const pkgRes = await getAvailableServicePackages("Recycler")
      if (pkgRes.success && Array.isArray(pkgRes.data) && pkgRes.data.length > 0) {
        setPackages(pkgRes.data)
      }
      if (getAccessToken()) {
        const [subRes, ordRes] = await Promise.allSettled([
          getMyServiceSubscriptions(),
          getMyServiceOrders({ pageNumber: 1, pageSize: 5 }),
        ])
        if (subRes.status === "fulfilled" && subRes.value.success) {
          setActiveSubs(subRes.value.data.activeSubscriptions ?? [])
        }
        if (ordRes.status === "fulfilled" && ordRes.value.success) {
          setRecentOrders(ordRes.value.data.items ?? [])
        }
      }
    } catch {
      // fallback to canonical catalog
    }
  }, [])

  useEffect(() => {
    let active = true
    void fetchRecyclerStatus().then((res) => {
      if (!active) return
      setProfile(res.profile)
      setOpen(res.isOnline)
      setDraftLat(res.profile.latitude)
      setDraftLng(res.profile.longitude)
      setDraftAddress(res.profile.businessAddress)
      setSyncedBackend(res.fromBackend)
    })

    void refreshRecyclerPackages()

    void fetchHandoverOrdersResult("recycler")
      .then((res) => {
        if (!active) return
        if (res.fromBackend) {
          const openRows: UpcomingRow[] = res.orders
            .filter((s) => s.status === "pending" || s.status === "accepted")
            .map((s) => ({
              id: s.id,
              address: s.address,
              date: s.date,
              slot: s.slot,
              status: s.status === "accepted" ? "accepted" : "pending",
              pickupLat: s.pickupLat,
              pickupLng: s.pickupLng,
            }))
          setHandovers(openRows)
        } else {
          const existingIds = new Set(MY_HANDOVERS.map((m) => m.id))
          const fresh: UpcomingRow[] = res.orders
            .filter((s) => !existingIds.has(s.id))
            .map((s) => ({
              id: s.id,
              address: s.address,
              date: s.date,
              slot: s.slot,
              status: s.status === "accepted" ? "accepted" : "pending",
              pickupLat: s.pickupLat,
              pickupLng: s.pickupLng,
            }))
          if (fresh.length > 0) {
            setHandovers([...fresh, ...MY_HANDOVERS.filter((h) => h.status !== "done")])
          }
        }
      })
      .finally(() => {
        if (active) setLoadingHandovers(false)
      })

    return () => {
      active = false
    }
  }, [])

  const handleToggleAvailability = async () => {
    const nextOnline = !open
    setToggling(true)
    try {
      const res = await toggleRecyclerOnlineStatus(nextOnline)
      setOpen(res.isOnline)
      setSyncedBackend(res.fromBackend)
      setFlash(res.message)
    } catch (err) {
      setFlash(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật trạng thái hoạt động lúc này.",
      )
    } finally {
      setToggling(false)
    }
  }

  const handleSaveWarehousePin = async () => {
    setSavingPin(true)
    try {
      const res = await updateRecyclerWarehousePin(profile, draftLat, draftLng, draftAddress)
      setProfile(res.profile)
      setSyncedBackend(res.fromBackend)
      setEditingLocation(false)
      setFlash(
        res.fromBackend
          ? "Đã cập nhật toạ độ kho bãi lên hệ thống. Ghim trên bản đồ /map đã dời sang vị trí mới."
          : "Đã lưu vị trí kho bãi mới và đồng bộ với bản đồ.",
      )
    } finally {
      setSavingPin(false)
    }
  }

  const isKybVerified =
    String(profile.verificationStatus ?? "").toLowerCase() === "verified"
  const currentTierRank = getTierRank(entitlements.currentTier)

  const handleBuyPackage = async (pkg: ServicePackageCatalogDto) => {
    const pkgRank = getTierRank(pkg.packageCode, pkg.isDefaultFree, pkg.requiresVerifiedKyb)
    const isPro = pkg.requiresVerifiedKyb || pkg.packageCode.toUpperCase() === "PRO"
    const isCurrent = !pkg.isIncludedInHigherPlan && currentTierRank === pkgRank && (pkg.isCurrentPlan || !pkg.isDefaultFree)

    if (pkg.isDefaultFree) return
    if (pkg.isIncludedInHigherPlan || currentTierRank > pkgRank) {
      setPkgErr(`Tài khoản đang sử dụng gói ${entitlements.currentTier} cao hơn (đã bao gồm quyền lợi này).`)
      return
    }
    if (isPro && isCurrent) {
      setPkgErr("Gói Tích xanh Pro không hỗ trợ gia hạn cộng dồn trước hạn. Vui lòng xác thực lại sau khi hết kỳ.")
      return
    }
    if (isPro && (!isKybVerified || !pkg.isEligible)) {
      setPkgErr(
        pkg.ineligibleReason ||
          "Cơ sở thu mua cần hoàn tất xác minh hồ sơ KYB và đạt đầy đủ tiêu chí uy tín trước khi mua gói Pro.",
      )
      return
    }

    setPkgErr("")
    setPkgNotice("")
    setBuyingCode(pkg.packageCode)
    try {
      if (!getAccessToken()) {
        const rand = Math.floor(100000 + Math.random() * 900000)
        const orderCode = `ECO${new Date().toISOString().slice(2, 10).replace(/-/g, "")}${rand}`
        const transferContent = `ECOLINK ${orderCode}`
        const demoOrder: PayInOrderDto = {
          id: `demo-${orderCode}`,
          userId: profile.recyclerId,
          packageId: pkg.id,
          packageCode: pkg.packageCode,
          packageName: pkg.packageName,
          durationDays: pkg.durationDays,
          orderCode,
          amount: pkg.priceVnd,
          paidAmount: null,
          description: `Thanh toán gói ${pkg.packageName}`,
          transferContent,
          bankCode: "MB",
          bankName: "MB Bank (Ngân hàng Quân đội)",
          accountNo: "090123456789",
          accountName: "CONG TY CO PHAN ECOLINK",
          qrCodeUrl: `https://img.vietqr.io/image/970422-090123456789-compact2.png?amount=${pkg.priceVnd}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent("CONG TY CO PHAN ECOLINK")}`,
          status: "Pending",
          reconciliationStatus: "Pending",
          anomalyType: "None",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        }
        setRecentOrders((prev) => [demoOrder, ...prev])
        setActiveQrOrder(demoOrder)
        return
      }

      const res = await createServicePaymentOrder({
        packageId: pkg.id,
        packageCode: pkg.packageCode,
        description: `Nâng cấp cơ sở ${pkg.packageName}`,
      })
      setActiveQrOrder(res.data)
      setRecentOrders((prev) => [
        res.data,
        ...prev.filter((o) => o.orderCode !== res.data.orderCode),
      ])
    } catch (err) {
      setPkgErr(
        err instanceof Error ? err.message : "Không thể khởi tạo đơn VietQR lúc này.",
      )
    } finally {
      setBuyingCode(null)
    }
  }

  const handleRecyclerOrderUpdated = (updated: PayInOrderDto) => {
    setActiveQrOrder(updated)
    setRecentOrders((prev) => {
      const exists = prev.some((o) => o.orderCode === updated.orderCode)
      return exists
        ? prev.map((o) => (o.orderCode === updated.orderCode ? updated : o))
        : [updated, ...prev]
    })

    if (updated.status.toUpperCase() === "PAID") {
      if (updated.id.startsWith("demo-")) {
        const isPro = updated.packageCode.toUpperCase() === "PRO"
        setLocalEntitlements({
          currentTier: isPro ? "Pro" : "Premium",
          isAdFree: true,
          dailyPointMultiplier: isPro ? 1.5 : 1.2,
          hasEcoPlusBadge: true,
          hasVerifiedBlueBadge: isPro,
          isFeaturedMapMarker: isPro,
          mapPriorityBoost: isPro ? 100 : 0,
        })
        setActiveSubs([
          {
            subscriptionId: `sub-${updated.orderCode}`,
            packageId: updated.packageId,
            packageCode: updated.packageCode,
            packageName: updated.packageName,
            sourceOrderCode: updated.orderCode,
            startsAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + updated.durationDays * 86_400_000).toISOString(),
            remainingDays: updated.durationDays,
            status: "Active",
            features: {
              tierName: isPro ? "Pro" : "Premium",
              adFree: true,
              dailyPointMultiplier: isPro ? 1.5 : 1.2,
              ecoPlusBadge: true,
              verifiedBlueBadge: isPro,
              featuredMapMarker: isPro,
              mapPriorityBoost: isPro ? 100 : 0,
            },
          },
        ])
      } else {
        void refreshRecyclerPackages()
      }
      setPkgNotice(
        `Đã kích hoạt gói ${updated.packageName} (${updated.orderCode}) thành công qua VietQR!`,
      )
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="VẬN HÀNH"
        title="Tổng quan cơ sở thu mua"
        body="Bật trạng thái hoạt động để hiện trên bản đồ và nhận yêu cầu mới. Tắt khi bạn không ra thu gom được."
        action={
          <a
            href="#recycler-packages"
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/6 px-3 py-1.5 text-xs font-semibold text-brand-deep hover:bg-brand/12"
          >
            {entitlements.hasVerifiedBlueBadge ? (
              <>
                <Star className="size-3.5 text-amber-500" />
                Gói Pro · Tích xanh &amp; Ghim nổi bật
              </>
            ) : (
              `Gói ${entitlements.currentTier} · Nâng cấp Pro`
            )}
          </a>
        }
      />

      <SponsoredAdBanner upgradeTo="#recycler-packages" compact />

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-ink">Trạng thái hoạt động</p>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-muted">
              {profile.facilityName} · {syncedBackend ? "Đồng bộ CSDL trực tiếp" : "Chế độ trình duyệt"}
            </span>
            {entitlements.hasVerifiedBlueBadge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200">
                <ShieldCheck className="size-3.5" />
                Tích xanh Pro
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-6 text-body">
            {open
              ? "Cơ sở của bạn đang hiện trên bản đồ và nhận yêu cầu mới."
              : "Đã ẩn khỏi bản đồ. Người dân không đặt được lịch cho tới khi bật lại."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          disabled={toggling}
          onClick={() => void handleToggleAvailability()}
          className={`inline-flex h-12 shrink-0 items-center gap-3 rounded-full border px-5 text-sm font-semibold transition-colors ${
            open
              ? "border-brand bg-brand/10 text-brand-deep"
              : "border-line bg-surface-2 text-body"
          }`}
        >
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              open ? "bg-brand" : "bg-sage-line"
            }`}
          >
            <span
              className={`absolute top-1 size-4 rounded-full bg-white transition-all ${
                open ? "left-6" : "left-1"
              }`}
            />
          </span>
          {toggling ? "Đang lưu..." : open ? "Đang hoạt động" : "Đã tắt"}
        </button>
      </section>

      {flash && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/25 bg-brand/6 px-4 py-3">
          <p role="status" className="text-[13px] font-semibold text-brand-deep">
            {flash}
          </p>
          <Link to="/map" className="text-xs font-semibold text-brand hover:underline">
            Kiểm tra trên trang Bản đồ →
          </Link>
        </div>
      )}

      {/* Khung R-01: Quản lý vị trí ghim kho bãi trên bản đồ */}
      <section className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-ink">Vị trí kho bãi trên bản đồ</h2>
            <p className="mt-0.5 text-sm text-body">{profile.businessAddress}</p>
            <p className="mt-0.5 text-xs tabular-nums text-muted">
              Toạ độ hiện tại: {profile.latitude.toFixed(5)}, {profile.longitude.toFixed(5)} · Giờ mở cửa: {profile.operatingHours}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/map" className="btn-ghost h-9 px-3 text-xs">
              Xem trên /map
            </Link>
            <button
              type="button"
              onClick={() => setEditingLocation((v) => !v)}
              className="btn-outline h-9 px-3.5 text-xs"
            >
              {editingLocation ? "Đóng chỉnh vị trí" : "Cập nhật ghim kho bãi"}
            </button>
          </div>
        </div>

        {editingLocation && (
          <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
              Địa chỉ hiển thị công khai
              <input
                className="input"
                value={draftAddress}
                onChange={(e) => setDraftAddress(e.target.value)}
              />
            </label>
            <LocationPinPickerMap
              lat={draftLat}
              lng={draftLng}
              pinTitle={profile.facilityName}
              onChange={(nextLat, nextLng, hint) => {
                setDraftLat(nextLat)
                setDraftLng(nextLng)
                if (hint) setDraftAddress(hint)
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={savingPin}
                onClick={() => void handleSaveWarehousePin()}
                className="btn-primary h-10 px-5 text-xs"
              >
                {savingPin ? "Đang lưu toạ độ..." : "Lưu vị trí kho bãi"}
              </button>
              <span className="text-xs text-muted">
                Vị trí mới sẽ cập nhật ngay trên truy vấn bán kính của người dân.
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Khung R-07: Gói thương mại Cơ sở thu mua (Basic - Premium - Pro 365 ngày) & VietQR */}
      <section id="recycler-packages" className="card flex flex-col gap-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft pb-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] text-brand uppercase">
              R-07 · GÓI THƯƠNG MẠI CƠ SỞ THU MUA (BASIC - PREMIUM - PRO)
            </p>
            <h2 className="mt-1 text-base font-bold text-ink">
              Nâng cấp Tích xanh Xác minh &amp; Ghim nổi bật trên Bản đồ
            </h2>
            <p className="mt-1 text-xs leading-5 text-body">
              Gói <b>PRO (1.000.000 đ / 365 ngày)</b> cấp Tích xanh thương hiệu, tắt quảng cáo và
              đẩy ghim cơ sở lên đầu kết quả tìm kiếm bản đồ khu vực (<code className="rounded bg-surface-2 px-1 py-0.5">+100 ưu tiên</code>).
              Nâng cấp từ Premium sang Pro sẽ kích hoạt Pro ngay lập tức (<code>BR-PAY-04</code>).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshRecyclerPackages()}
            className="btn-outline inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <RefreshCw className="size-3.5" />
            Đồng bộ gói
          </button>
        </div>

        {!isKybVerified && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              <b>MSG-PAY-06:</b> Cơ sở thu mua cần hoàn tất xác minh hồ sơ KYB (<code>VerificationStatus = Verified</code>)
              trước khi mua gói Tích xanh &amp; Ghim nổi bật <b>PRO</b>.
            </span>
          </div>
        )}

        {pkgNotice && (
          <p role="status" className="rounded-xl border border-brand/30 bg-brand/8 px-4 py-2.5 text-xs font-semibold text-brand-deep">
            {pkgNotice}
          </p>
        )}
        {pkgErr && (
          <p role="alert" className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-xs font-semibold text-warn">
            {pkgErr}
          </p>
        )}

        {activeSubs.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/25 bg-brand/6 px-4 py-3 text-xs">
            <div>
              <span className="font-bold text-brand-deep">
                Thuê bao hiệu lực: {activeSubs[0].packageName}
              </span>
              <span className="ml-2 text-muted">
                · Còn {activeSubs[0].remainingDays} ngày (Hết hạn{" "}
                {new Date(activeSubs[0].expiresAt).toLocaleDateString("vi-VN")})
              </span>
            </div>
            <Link to="/map" className="font-semibold text-brand hover:underline">
              Kiểm tra ghim nổi bật trên /map →
            </Link>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {packages.map((pkg) => {
            const isBasic = pkg.isDefaultFree || pkg.packageCode.toUpperCase() === "BASIC"
            const isPro = pkg.requiresVerifiedKyb || pkg.packageCode.toUpperCase() === "PRO"
            const pkgRank = getTierRank(pkg.packageCode, pkg.isDefaultFree, pkg.requiresVerifiedKyb)
            const isIncludedInHigherPlan =
              Boolean(pkg.isIncludedInHigherPlan) || currentTierRank > pkgRank
            const isCurrent =
              !isIncludedInHigherPlan &&
              (pkg.isCurrentPlan || currentTierRank === pkgRank)
            const blockedPro =
              isPro && !isCurrent && (!isKybVerified || pkg.isEligible === false)
            const proEval = isPro ? pkg.proEligibility : null

            return (
              <article
                key={pkg.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 ${
                  isPro
                    ? "border-amber-400 bg-amber-50/35 shadow-xs"
                    : "border-line bg-surface"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-brand uppercase">
                      {isPro ? (
                        <Crown className="size-3.5 text-amber-600" />
                      ) : pkg.packageCode === "PREMIUM" ? (
                        <Sparkles className="size-3.5" />
                      ) : (
                        <ShieldCheck className="size-3.5" />
                      )}
                      {pkg.packageCode}
                    </span>
                    {isCurrent && <Status tone="ok">Đang sử dụng</Status>}
                  </div>

                  <h3 className="mt-1.5 text-base font-bold text-ink">{pkg.packageName}</h3>
                  <p className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-ink tabular-nums">
                      {pkg.priceVnd === 0 ? "0 đ" : fmtVnd(pkg.priceVnd)}
                    </span>
                    <span className="text-xs text-muted">
                      {pkg.durationDays > 0 ? `/ ${pkg.durationDays} ngày` : "/ Trọn đời"}
                    </span>
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-body">{pkg.description}</p>

                  <ul className="mt-3 flex flex-col gap-1.5 text-xs text-body">
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 shrink-0 text-brand" />
                      {pkg.features.adFree ? "Tắt toàn bộ quảng cáo" : "Gói mặc định có banner"}
                    </li>
                    {pkg.features.verifiedBlueBadge && (
                      <li className="flex items-center gap-2 font-medium text-sky-800">
                        <ShieldCheck className="size-3.5 shrink-0 text-[#0284c7]" />
                        Tích xanh xác minh cơ sở thu mua
                      </li>
                    )}
                    {pkg.features.featuredMapMarker && (
                      <li className="flex items-center gap-2 font-medium text-amber-800">
                        <Star className="size-3.5 shrink-0 text-amber-600" />
                        Ghim nổi bật &amp; Ưu tiên hiển thị bản đồ (+{pkg.features.mapPriorityBoost})
                      </li>
                    )}
                  </ul>

                  {isPro && (
                    <div className="mt-3 rounded-xl border border-amber-200/80 bg-white/85 p-3 text-[11px] leading-4">
                      <p className="font-bold text-ink">
                        Điều kiện xét duyệt Pro{proEval?.isReRegistration ? " (Đăng ký lại)" : ""}
                      </p>
                      <ul className="mt-1.5 space-y-1 text-body">
                        <li className="flex items-start gap-1.5">
                          <span className={proEval ? (proEval.isKybAndProfileValid ? "text-brand font-bold" : "text-warn font-bold") : isKybVerified ? "text-brand font-bold" : "text-warn font-bold"}>
                            {proEval ? (proEval.isKybAndProfileValid ? "✓" : "✕") : isKybVerified ? "✓" : "✕"}
                          </span>
                          <span>
                            KYB &amp; Hồ sơ:{" "}
                            {proEval?.requiresProfileReverification
                              ? "Cần cập nhật lại sau cảnh cáo"
                              : (proEval?.isKybAndProfileValid ?? isKybVerified)
                                ? "Đã xác minh (Verified)"
                                : "Chưa xác minh KYB"}
                          </span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className={proEval ? (proEval.isWarningLimitOk ? "text-brand font-bold" : "text-warn font-bold") : "text-brand font-bold"}>
                            {proEval ? (proEval.isWarningLimitOk ? "✓" : "✕") : "✓"}
                          </span>
                          <span>
                            Cảnh cáo: {proEval?.currentWarningCount ?? 0}/{proEval?.maxAllowedWarnings ?? 5} lần (Tối đa 5)
                          </span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className={proEval ? (proEval.isPositiveFeedbackMet ? "text-brand font-bold" : "text-warn font-bold") : "text-brand font-bold"}>
                            {proEval ? (proEval.isPositiveFeedbackMet ? "✓" : "✕") : "✓"}
                          </span>
                          <span>
                            Đánh giá:{" "}
                            {proEval && proEval.totalReviews > 0
                              ? `${proEval.averageRating.toFixed(1)}/5.0 ★ (${proEval.totalReviews} lượt · >= 4.0)`
                              : proEval?.isReRegistration
                                ? "Tái đăng ký cần >= 1 đánh giá >= 4.0 ★"
                                : "Đạt chuẩn (Duy trì >= 4.0 ★)"}
                          </span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className={(proEval ? proEval.isNotCurrentlyActivePro : !isCurrent) ? "text-brand font-bold" : "text-amber-700 font-bold"}>
                            {(proEval ? proEval.isNotCurrentlyActivePro : !isCurrent) ? "✓" : "•"}
                          </span>
                          <span>
                            {(proEval ? proEval.isNotCurrentlyActivePro : !isCurrent)
                              ? "Sẵn sàng đăng ký chu kỳ mới"
                              : "Đang trong kỳ hiệu lực (Không cộng dồn)"}
                          </span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-line-soft pt-3">
                  {isIncludedInHigherPlan ? (
                    <p className="rounded-lg border border-brand/20 bg-brand/6 px-3 py-2 text-center text-xs font-semibold text-brand-deep">
                      Đã bao gồm trong gói {entitlements.currentTier} hiện tại
                    </p>
                  ) : isBasic ? (
                    <button
                      type="button"
                      disabled
                      className="btn-outline h-9 w-full cursor-default text-xs opacity-75"
                    >
                      Gói mặc định của hệ thống
                    </button>
                  ) : isPro && isCurrent ? (
                    <div className="rounded-lg border border-amber-300/80 bg-amber-100/60 px-3 py-2 text-center text-[11px] leading-4 font-semibold text-amber-950">
                      Đang hiệu lực
                      {pkg.currentActiveExpiresAt
                        ? ` đến ${new Date(pkg.currentActiveExpiresAt).toLocaleDateString("vi-VN")}`
                        : ""}
                      {" · "}Không gia hạn cộng dồn (xét duyệt lại khi hết kỳ)
                    </div>
                  ) : blockedPro ? (
                    <button
                      type="button"
                      disabled
                      title={pkg.ineligibleReason || "Chưa đáp ứng đủ điều kiện đăng ký gói Pro"}
                      className="btn-outline inline-flex h-9 w-full cursor-not-allowed items-center justify-center gap-1.5 text-xs opacity-75"
                    >
                      <Lock className="size-3.5" />
                      Chưa đủ điều kiện lên Pro
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={buyingCode === pkg.packageCode}
                      onClick={() => void handleBuyPackage(pkg)}
                      className="btn-primary inline-flex h-9 w-full items-center justify-center gap-1.5 text-xs font-semibold"
                    >
                      <QrCode className="size-3.5" />
                      {buyingCode === pkg.packageCode
                        ? "Đang tạo VietQR..."
                        : isCurrent && !isPro
                          ? `Gia hạn cộng dồn (+${pkg.durationDays} ngày)`
                          : `Mua gói ${pkg.packageCode} qua VietQR`}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        {recentOrders.length > 0 && (
          <div className="border-t border-line-soft pt-3">
            <p className="mb-2 text-xs font-bold text-ink">Đơn thanh toán VietQR gần đây</p>
            <ul className="flex flex-col gap-2">
              {recentOrders.slice(0, 4).map((ord) => (
                <li
                  key={ord.orderCode}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-ink">{ord.orderCode}</span>
                    <span className="ml-2 text-muted">
                      {ord.packageName} · {fmtVnd(ord.amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Status tone={ord.status.toUpperCase() === "PAID" ? "ok" : "wait"}>
                      {ord.status.toUpperCase() === "PAID" ? "Đã kích hoạt" : ord.status}
                    </Status>
                    {ord.status.toUpperCase() === "PENDING" && (
                      <button
                        type="button"
                        onClick={() => setActiveQrOrder(ord)}
                        className="btn-outline h-7 px-2 text-[11px]"
                      >
                        Mở QR
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Yêu cầu đang mở"
          value={String(handovers.length)}
          note="Chờ xác nhận hoặc đã nhận"
        />
        <Stat
          label="Cơ sở thu mua"
          value={STATS.recyclers.toLocaleString("vi-VN")}
          note="Toàn hệ thống"
        />
        <Stat label="Tiền đã thu gom" value={fmtVnd(payin)} note="Đã chuyển qua VietQR" />
        <Stat
          label="Giao dịch 30 ngày"
          value={STATS.handovers30d.toLocaleString("vi-VN")}
          note="Toàn hệ thống"
        />
      </div>

      <section className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-base font-bold text-ink">Lịch sắp tới</h2>
          <Link
            to="/recycler/requests"
            className="text-[13px] font-semibold text-brand hover:text-brand-deep"
          >
            Xem tất cả yêu cầu →
          </Link>
        </div>
        {loadingHandovers ? (
          <p className="text-sm text-muted">Đang tải lịch thu gom...</p>
        ) : handovers.length === 0 ? (
          <p className="text-sm text-muted">Chưa có lịch nào đang mở.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {handovers.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">
                    {h.address}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {h.date} · {h.slot}
                    {typeof h.pickupLat === "number" && typeof h.pickupLng === "number" && (
                      <span className="ml-2 tabular-nums text-brand-deep">
                        · Điểm hẹn GPS: {h.pickupLat.toFixed(4)}, {h.pickupLng.toFixed(4)}
                      </span>
                    )}
                  </span>
                </span>
                <Status tone={h.status === "pending" ? "wait" : "todo"}>
                  {h.status === "pending" ? "Chờ xác nhận" : "Đã nhận"}
                </Status>
              </li>
            ))}
          </ul>
        )}
      </section>

      <VietQrCheckoutModal
        order={activeQrOrder}
        onClose={() => setActiveQrOrder(null)}
        onOrderUpdated={handleRecyclerOrderUpdated}
      />
    </div>
  )
}
