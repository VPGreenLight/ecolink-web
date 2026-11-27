import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Check, Crown, Lock, QrCode, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Star } from "lucide-react"
import { PageHead, Status } from "@/components/Portal"
import VietQrCheckoutModal from "@/components/VietQrCheckoutModal"
import { initApiState, isSsrSmokeTest } from "@/lib/hydration"
import { fmtVnd } from "@/data/ops"
import { fetchRecyclerStatus } from "@/lib/recyclerWorkflowApi"
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

/** R-07 Gói dịch vụ cơ sở thu mua (Basic - Premium - Pro 365 ngày) & Thanh toán VietQR. */
export default function RecyclerPackages() {
  const liveAuth = hasLiveBackendAuth()
  const entitlements = useEntitlements()
  const [recyclerId, setRecyclerId] = useState("")
  const [verificationStatus, setVerificationStatus] = useState("Verified")
  const [packages, setPackages] = useState<ServicePackageCatalogDto[]>(() =>
    initApiState([], CANONICAL_FALLBACK_PACKAGES),
  )
  const [activeSubs, setActiveSubs] = useState<ActiveSubscriptionDto[]>([])
  const [recentOrders, setRecentOrders] = useState<PayInOrderDto[]>([])
  const [buyingCode, setBuyingCode] = useState<string | null>(null)
  const [activeQrOrder, setActiveQrOrder] = useState<PayInOrderDto | null>(null)
  const [pkgNotice, setPkgNotice] = useState("")
  const [pkgErr, setPkgErr] = useState("")

  const refreshRecyclerPackages = useCallback(async () => {
    try {
      const pkgRes = await getAvailableServicePackages("Recycler")
      if (pkgRes.success && Array.isArray(pkgRes.data) && pkgRes.data.length > 0) {
        setPackages(pkgRes.data)
      }
      if (getAccessToken() || liveAuth) {
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
  }, [liveAuth])

  useEffect(() => {
    if (isSsrSmokeTest()) return
    let active = true
    void fetchRecyclerStatus()
      .then((res) => {
        if (!active) return
        setRecyclerId(res.profile.recyclerId)
        setVerificationStatus(res.profile.verificationStatus)
      })
      .catch(() => {})
    void refreshRecyclerPackages()
    return () => {
      active = false
    }
  }, [refreshRecyclerPackages])

  const isKybVerified = String(verificationStatus ?? "").toLowerCase() === "verified"
  const currentTierRank = getTierRank(entitlements.currentTier)

  const handleBuyPackage = async (pkg: ServicePackageCatalogDto) => {
    const pkgRank = getTierRank(pkg.packageCode, pkg.isDefaultFree, pkg.requiresVerifiedKyb)
    const isPro = pkg.requiresVerifiedKyb || pkg.packageCode.toUpperCase() === "PRO"
    const isCurrent =
      !pkg.isIncludedInHigherPlan &&
      currentTierRank === pkgRank &&
      (pkg.isCurrentPlan || !pkg.isDefaultFree)

    if (pkg.isDefaultFree) return
    if (pkg.isIncludedInHigherPlan || currentTierRank > pkgRank) {
      setPkgErr(
        `Tài khoản đang sử dụng gói ${entitlements.currentTier} cao hơn (đã bao gồm quyền lợi này).`,
      )
      return
    }
    if (isPro && isCurrent) {
      setPkgErr(
        "Gói Tích xanh Pro không hỗ trợ gia hạn cộng dồn trước hạn. Vui lòng xác thực lại sau khi hết kỳ.",
      )
      return
    }
    const proEval = isPro ? pkg.proEligibility : null
    if (isPro && (!isKybVerified || !pkg.isEligible || (liveAuth && !proEval?.isEligible))) {
      setPkgErr(
        pkg.ineligibleReason ||
          proEval?.blockingReasons?.[0] ||
          "Cơ sở thu mua cần hoàn tất xác minh hồ sơ KYB và đạt tối thiểu 50 lượt đánh giá (trung bình >= 4.0 ★) trước khi mua gói Pro.",
      )
      return
    }

    setPkgErr("")
    setPkgNotice("")
    setBuyingCode(pkg.packageCode)
    try {
      if (!getAccessToken() && !liveAuth) {
        const rand = Math.floor(100000 + Math.random() * 900000)
        const orderCode = `ECO${new Date().toISOString().slice(2, 10).replace(/-/g, "")}${rand}`
        const transferContent = `ECOLINK ${orderCode}`
        const demoOrder: PayInOrderDto = {
          id: `demo-${orderCode}`,
          userId: recyclerId || getSession()?.name || "recycler",
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
        eyebrow="GÓI DỊCH VỤ"
        title="Gói dịch vụ"
        body="Quản lý gói Basic, Premium và nâng cấp Pro (Tích xanh xác minh & Ghim nổi bật trên Bản đồ) qua thanh toán VietQR."
        action={
          <button
            type="button"
            onClick={() => void refreshRecyclerPackages()}
            className="btn-outline inline-flex min-h-10 items-center gap-1.5 px-4 text-sm font-semibold"
          >
            <RefreshCw className="size-4" />
            Đồng bộ gói
          </button>
        }
      />

      <section id="recycler-packages" className="card flex flex-col gap-5 p-5">
        <div className="border-b border-line-soft pb-4">
          <h2 className="text-base font-bold text-ink">
            Nâng cấp Tích xanh Xác minh &amp; Ghim nổi bật trên Bản đồ
          </h2>
          <p className="mt-1 text-sm leading-6 text-body">
            Gói <b>PRO (1.000.000 đ / 365 ngày)</b> cấp Tích xanh thương hiệu, tắt quảng cáo và
            đẩy ghim cơ sở lên đầu kết quả tìm kiếm bản đồ khu vực (
            <code className="rounded bg-surface-2 px-1 py-0.5">+100 ưu tiên</code>). Nâng cấp từ
            Premium sang Pro sẽ kích hoạt Pro ngay lập tức (<code>BR-PAY-04</code>).
          </p>
        </div>

        {!isKybVerified && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            <ShieldAlert className="mt-1 size-4 shrink-0" />
            <span>
              <b>MSG-PAY-06:</b> Cơ sở thu mua cần hoàn tất xác minh hồ sơ KYB (
              <code>VerificationStatus = Verified</code>) trước khi mua gói Tích xanh &amp; Ghim
              nổi bật <b>PRO</b>.
            </span>
          </div>
        )}

        {pkgNotice && (
          <p
            role="status"
            className="rounded-xl border border-brand/30 bg-brand/8 px-4 py-2.5 text-sm font-semibold text-brand-deep"
          >
            {pkgNotice}
          </p>
        )}
        {pkgErr && (
          <p
            role="alert"
            className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn"
          >
            {pkgErr}
          </p>
        )}

        {activeSubs.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/25 bg-brand/6 px-4 py-3 text-sm">
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
            const pkgRank = getTierRank(
              pkg.packageCode,
              pkg.isDefaultFree,
              pkg.requiresVerifiedKyb,
            )
            const isIncludedInHigherPlan =
              Boolean(pkg.isIncludedInHigherPlan) || currentTierRank > pkgRank
            const isCurrent =
              !isIncludedInHigherPlan &&
              (pkg.isCurrentPlan || currentTierRank === pkgRank)
            const proEval = isPro ? pkg.proEligibility : null
            const minReviews =
              proEval?.minRequiredReviews ?? proEval?.minRequiredReviewsForRenewal ?? 50
            const minRating = proEval?.minRequiredRating ?? 4.0
            const blockedPro =
              isPro &&
              !isCurrent &&
              (!isKybVerified || pkg.isEligible === false || (liveAuth && !proEval?.isEligible))

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
                    <span className="text-xl font-bold tabular-nums text-ink">
                      {pkg.priceVnd === 0 ? "0 đ" : fmtVnd(pkg.priceVnd)}
                    </span>
                    <span className="text-sm text-muted">
                      {pkg.durationDays > 0 ? `/ ${pkg.durationDays} ngày` : "/ Trọn đời"}
                    </span>
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-body">{pkg.description}</p>

                  <ul className="mt-3 flex flex-col gap-1.5 text-sm text-body">
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
                          <span
                            className={
                              proEval
                                ? proEval.isKybAndProfileValid
                                  ? "font-bold text-brand"
                                  : "font-bold text-warn"
                                : isKybVerified
                                  ? "font-bold text-brand"
                                  : "font-bold text-warn"
                            }
                          >
                            {proEval
                              ? proEval.isKybAndProfileValid
                                ? "✓"
                                : "✕"
                              : isKybVerified
                                ? "✓"
                                : "✕"}
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
                          <span
                            className={
                              proEval
                                ? proEval.isWarningLimitOk
                                  ? "font-bold text-brand"
                                  : "font-bold text-warn"
                                : "font-bold text-brand"
                            }
                          >
                            {proEval ? (proEval.isWarningLimitOk ? "✓" : "✕") : "✓"}
                          </span>
                          <span>
                            Cảnh cáo: {proEval?.currentWarningCount ?? 0}/
                            {proEval?.maxAllowedWarnings ?? 5} lần (Tối đa 5)
                          </span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span
                            className={
                              proEval?.isPositiveFeedbackMet
                                ? "font-bold text-brand"
                                : "font-bold text-warn"
                            }
                          >
                            {proEval?.isPositiveFeedbackMet ? "✓" : "✕"}
                          </span>
                          <span>
                            Đánh giá:{" "}
                            {!proEval || proEval.totalReviews < minReviews
                              ? `${proEval?.totalReviews ?? 0}/${minReviews} lượt${
                                  proEval && proEval.totalReviews > 0
                                    ? ` (${proEval.averageRating.toFixed(1)}/5.0 ★)`
                                    : ""
                                } · Cần >= ${minReviews} lượt & >= ${minRating.toFixed(1)} ★`
                              : proEval.isPositiveFeedbackMet
                                ? `${proEval.averageRating.toFixed(1)}/5.0 ★ (${proEval.totalReviews} lượt · Đạt chuẩn >= ${minRating.toFixed(1)} ★)`
                                : `${proEval.averageRating.toFixed(1)}/5.0 ★ (${proEval.totalReviews} lượt · Cần >= ${minRating.toFixed(1)} ★)`}
                          </span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span
                            className={
                              (proEval ? proEval.isNotCurrentlyActivePro : !isCurrent)
                                ? "font-bold text-brand"
                                : "font-bold text-amber-700"
                            }
                          >
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
                    <p className="rounded-lg border border-brand/20 bg-brand/6 px-3 py-2 text-center text-sm font-semibold text-brand-deep">
                      Đã bao gồm trong gói {entitlements.currentTier} hiện tại
                    </p>
                  ) : isBasic ? (
                    <button
                      type="button"
                      disabled
                      className="btn-outline min-h-10 w-full cursor-default text-sm font-semibold opacity-75"
                    >
                      Gói mặc định của hệ thống
                    </button>
                  ) : isPro && isCurrent ? (
                    <div className="rounded-lg border border-amber-300/80 bg-amber-100/60 px-3 py-2 text-center text-sm leading-6 font-semibold text-amber-950">
                      Đang hiệu lực
                      {pkg.currentActiveExpiresAt
                        ? ` đến ${new Date(pkg.currentActiveExpiresAt).toLocaleDateString("vi-VN")}`
                        : ""}
                      {" · "}Không gia hạn cộng dồn (xét duyệt lại khi hết kỳ)
                    </div>
                  ) : blockedPro ? (
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        disabled
                        title={
                          pkg.ineligibleReason ||
                          proEval?.blockingReasons?.[0] ||
                          "Chưa đáp ứng đủ điều kiện đăng ký gói Pro"
                        }
                        className="btn-outline inline-flex min-h-10 w-full cursor-not-allowed items-center justify-center gap-1.5 text-sm font-semibold opacity-75"
                      >
                        <Lock className="size-4" />
                        Chưa đủ điều kiện lên Pro
                      </button>
                      {(pkg.ineligibleReason || proEval?.blockingReasons?.[0]) && (
                        <p className="text-sm leading-6 text-warn">
                          {pkg.ineligibleReason || proEval?.blockingReasons?.[0]}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={buyingCode === pkg.packageCode}
                      onClick={() => void handleBuyPackage(pkg)}
                      className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-semibold"
                    >
                      <QrCode className="size-4" />
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
            <p className="mb-2 text-sm font-bold text-ink">Đơn thanh toán VietQR gần đây</p>
            <ul className="flex flex-col gap-2">
              {recentOrders.slice(0, 4).map((ord) => (
                <li
                  key={ord.orderCode}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
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
                        className="btn-outline min-h-10 px-3 text-sm font-semibold"
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

      <VietQrCheckoutModal
        order={activeQrOrder}
        onClose={() => setActiveQrOrder(null)}
        onOrderUpdated={handleRecyclerOrderUpdated}
      />
    </div>
  )
}
