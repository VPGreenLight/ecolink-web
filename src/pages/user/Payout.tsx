import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Check, QrCode, RefreshCw, ShieldCheck, Sparkles, XCircle } from "lucide-react"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import SponsoredAdBanner from "@/components/SponsoredAdBanner"
import VietQrCheckoutModal from "@/components/VietQrCheckoutModal"
import { fmtVnd } from "@/data/ops"
import { initApiLoading, initApiState } from "@/lib/hydration"
import {
  CANONICAL_FALLBACK_PACKAGES,
  cancelPendingServiceOrder,
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
import { getAccessToken, hasLiveBackendAuth } from "@/lib/session"

function buildDemoQrOrder(pkg: ServicePackageCatalogDto): PayInOrderDto {
  const randomDigits = Math.floor(100000 + Math.random() * 900000)
  const orderCode = `ECO${new Date().toISOString().slice(2, 10).replace(/-/g, "")}${randomDigits}`
  const transferContent = `ECOLINK ${orderCode}`
  const qrCodeUrl = `https://img.vietqr.io/image/970422-090123456789-compact2.png?amount=${pkg.priceVnd}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent("CONG TY CO PHAN ECOLINK")}`
  return {
    id: `demo-${orderCode}`,
    userId: "demo-citizen",
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
    qrCodeUrl,
    status: "Pending",
    reconciliationStatus: "Pending",
    anomalyType: "None",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  }
}

function statusMeta(order: PayInOrderDto): { label: string; tone: "todo" | "wait" | "ok" | "off" } {
  const st = order.status.toUpperCase()
  const rec = order.reconciliationStatus.toUpperCase()
  if (st === "PAID") return { label: "Đã thanh toán", tone: "ok" }
  if (st === "CANCELLED") return { label: "Đã hủy", tone: "off" }
  if (st === "EXPIRED") return { label: "Hết hạn QR", tone: "off" }
  if (rec === "UNDERPAID" || rec === "LATETRANSFER") {
    return { label: "Chờ đối soát", tone: "wait" }
  }
  return { label: "Chờ chuyển khoản", tone: "wait" }
}

/** U-16 Gói dịch vụ Citizen & Thanh toán VietQR Động (nền tảng không giữ tiền hộ bán phế liệu — BR-DSP-04).
 *
 *  Kết nối trực tiếp tới:
 *   - `GET /api/v1/service-packages?targetRole=User` (STT 120)
 *   - `GET /api/v1/service-packages/subscriptions/me` (STT 121)
 *   - `POST /api/v1/service-payments/create` (STT 115)
 *   - `GET /api/v1/service-payments/orders` (STT 117)
 *   - `POST /api/v1/service-payments/orders/{orderCode}/cancel` (STT 122) */
export default function Payout() {
  const entitlements = useEntitlements()

  // Phần U-16: Gói dịch vụ & Thanh toán VietQR
  const [packages, setPackages] = useState<ServicePackageCatalogDto[]>(() =>
    initApiState([], CANONICAL_FALLBACK_PACKAGES),
  )
  const [activeSubs, setActiveSubs] = useState<ActiveSubscriptionDto[]>([])
  const [orders, setOrders] = useState<PayInOrderDto[]>([])
  const [loadingPackages, setLoadingPackages] = useState(() => initApiLoading(true))
  const [buyingCode, setBuyingCode] = useState<string | null>(null)
  const [activeQrOrder, setActiveQrOrder] = useState<PayInOrderDto | null>(null)
  const [pkgFlash, setPkgFlash] = useState("")
  const [pkgErr, setPkgErr] = useState("")

  const loadSubscriptionWorkspace = useCallback(async () => {
    setLoadingPackages(true)
    try {
      const pkgRes = await getAvailableServicePackages("User")
      if (pkgRes.success && Array.isArray(pkgRes.data) && pkgRes.data.length > 0) {
        setPackages(pkgRes.data)
      }

      if (getAccessToken() || hasLiveBackendAuth()) {
        const [subRes, ordRes] = await Promise.allSettled([
          getMyServiceSubscriptions(),
          getMyServiceOrders({ pageNumber: 1, pageSize: 10 }),
        ])
        if (subRes.status === "fulfilled" && subRes.value.success) {
          setActiveSubs(subRes.value.data.activeSubscriptions ?? [])
        }
        if (ordRes.status === "fulfilled" && ordRes.value.success) {
          setOrders(ordRes.value.data.items ?? [])
        }
      }
    } catch (errLoad) {
      if (hasLiveBackendAuth()) {
        setPkgErr(
          errLoad instanceof Error
            ? errLoad.message
            : "Không tải được thông tin gói dịch vụ từ máy chủ.",
        )
      }
    } finally {
      setLoadingPackages(false)
    }
  }, [])

  useEffect(() => {
    void loadSubscriptionWorkspace()
  }, [loadSubscriptionWorkspace])

  const handlePurchasePackage = async (pkg: ServicePackageCatalogDto) => {
    if (pkg.isDefaultFree || pkg.packageCode === "PRO") return
    setPkgErr("")
    setPkgFlash("")
    setBuyingCode(pkg.packageCode)

    try {
      if (!getAccessToken() && !hasLiveBackendAuth()) {
        const demoOrder = buildDemoQrOrder(pkg)
        setOrders((prev) => [demoOrder, ...prev])
        setActiveQrOrder(demoOrder)
        return
      }

      const res = await createServicePaymentOrder({
        packageId: pkg.id,
        packageCode: pkg.packageCode,
        description: `Nâng cấp gói ${pkg.packageName}`,
      })
      setActiveQrOrder(res.data)
      setOrders((prev) => [res.data, ...prev.filter((o) => o.orderCode !== res.data.orderCode)])
    } catch (e) {
      setPkgErr(
        e instanceof Error
          ? e.message
          : "Không thể khởi tạo mã thanh toán VietQR lúc này.",
      )
    } finally {
      setBuyingCode(null)
    }
  }

  const handleOrderUpdated = (updated: PayInOrderDto) => {
    setActiveQrOrder(updated)
    setOrders((prev) => {
      const exists = prev.some((item) => item.orderCode === updated.orderCode)
      return exists
        ? prev.map((item) => (item.orderCode === updated.orderCode ? updated : item))
        : [updated, ...prev]
    })

    if (updated.status.toUpperCase() === "PAID") {
      if (updated.id.startsWith("demo-")) {
        setLocalEntitlements({
          currentTier: "Premium",
          isAdFree: true,
          dailyPointMultiplier: 1.2,
          hasEcoPlusBadge: true,
          hasVerifiedBlueBadge: false,
          isFeaturedMapMarker: false,
          mapPriorityBoost: 0,
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
              tierName: "Premium",
              adFree: true,
              dailyPointMultiplier: 1.2,
              ecoPlusBadge: true,
              verifiedBlueBadge: false,
              featuredMapMarker: false,
              mapPriorityBoost: 0,
            },
          },
        ])
      } else {
        void loadSubscriptionWorkspace()
      }
      setPkgFlash(
        `Đã kích hoạt ${updated.packageName} thành công qua VietQR (${updated.orderCode}). Banner quảng cáo đã được tắt trên toàn hệ thống.`,
      )
    }
  }

  const handleCancelOrder = async (order: PayInOrderDto) => {
    setPkgErr("")
    try {
      if (order.id.startsWith("demo-")) {
        setOrders((prev) =>
          prev.map((o) =>
            o.orderCode === order.orderCode ? { ...o, status: "Cancelled" } : o,
          ),
        )
        return
      }
      const res = await cancelPendingServiceOrder(order.orderCode, "Người dân chủ động hủy đơn")
      handleOrderUpdated(res.data)
    } catch (e) {
      setPkgErr(e instanceof Error ? e.message : "Không thể hủy đơn lúc này.")
    }
  }

  const primaryActiveSub = activeSubs[0]
  const citizenPackages = packages.filter(
    (pkg) => pkg.targetRole !== "Recycler" && pkg.packageCode.toUpperCase() !== "PRO",
  )
  const isUpgradedTier = entitlements.currentTier.toUpperCase() !== "BASIC"

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="GÓI DỊCH VỤ & VIETQR · U-16"
        title="Gói dịch vụ & Tắt quảng cáo"
        body="Nâng cấp gói Premium (59.000 đ/30 ngày) qua mã VietQR động để tắt hoàn toàn banner quảng cáo và nhận x1.2 điểm điểm danh hằng ngày."
        action={
          <button
            type="button"
            onClick={() => void loadSubscriptionWorkspace()}
            disabled={loadingPackages}
            className="btn-outline inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <RefreshCw className={`size-3.5 ${loadingPackages ? "animate-spin" : ""}`} />
            Đồng bộ quyền lợi
          </button>
        }
      />

      <SponsoredAdBanner upgradeTo="#citizen-packages" compact />

      {/* Khu vực U-16: Bảng gói dịch vụ 3 cấp bậc & Thanh toán VietQR Động */}
      <section id="citizen-packages" className="card flex flex-col gap-5 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft pb-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] text-brand uppercase">
              U-16 · GÓI DỊCH VỤ NỘI BỘ &amp; VIETQR ĐỘNG
            </p>
            <h2 className="mt-1 text-lg font-bold text-ink">
              Nâng cấp đặc quyền EcoLink cho Người dân (Basic – Premium)
            </h2>
            <p className="mt-1 text-xs leading-5 text-body">
              Gia hạn sớm cùng hạng gói sẽ được cộng dồn trọn vẹn số ngày còn lại theo quy tắc{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">BR-PAY-04</code>.
            </p>
          </div>

          <div className="rounded-xl border border-brand/25 bg-brand/6 px-3.5 py-2 text-right">
            <p className="text-[11px] font-semibold text-muted uppercase">Gói hiện tại</p>
            <p className="text-sm font-bold text-brand-deep">
              {entitlements.currentTier}
              {entitlements.isAdFree ? " · Không quảng cáo" : " · Có quảng cáo"}
            </p>
            {primaryActiveSub && (
              <p className="text-[11px] text-muted">
                Còn {primaryActiveSub.remainingDays} ngày · Hết hạn{" "}
                {new Date(primaryActiveSub.expiresAt).toLocaleDateString("vi-VN")}
              </p>
            )}
          </div>
        </div>

        {pkgFlash && (
          <p role="status" className="rounded-xl border border-brand/30 bg-brand/8 px-4 py-2.5 text-xs font-semibold text-brand-deep">
            {pkgFlash}
          </p>
        )}
        {pkgErr && (
          <p role="alert" className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-xs font-semibold text-warn">
            {pkgErr}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {citizenPackages.map((pkg) => {
            const isBasic = pkg.isDefaultFree || pkg.packageCode.toUpperCase() === "BASIC"
            const isIncludedInHigherPlan =
              Boolean(pkg.isIncludedInHigherPlan) || (isBasic && isUpgradedTier)
            const isCurrent =
              !isIncludedInHigherPlan &&
              (pkg.isCurrentPlan ||
                entitlements.currentTier.toUpperCase() === pkg.packageCode.toUpperCase())

            return (
              <article
                key={pkg.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 transition-colors ${
                  pkg.packageCode === "PREMIUM"
                    ? "border-brand bg-mint/18 shadow-sm"
                    : "border-line bg-surface"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-brand uppercase">
                      {pkg.packageCode === "PREMIUM" ? (
                        <Sparkles className="size-3.5" />
                      ) : (
                        <ShieldCheck className="size-3.5" />
                      )}
                      {pkg.packageCode}
                    </span>
                    {isCurrent && <Status tone="ok">Đang sử dụng</Status>}
                  </div>

                  <h3 className="mt-2 text-base font-bold text-ink">{pkg.packageName}</h3>

                  <p className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold tracking-tight text-ink tabular-nums">
                      {pkg.priceVnd === 0 ? "0 đ" : fmtVnd(pkg.priceVnd)}
                    </span>
                    <span className="text-xs text-muted">
                      {pkg.durationDays > 0 ? `/ ${pkg.durationDays} ngày` : "/ Trọn đời"}
                    </span>
                  </p>

                  <p className="mt-2 text-xs leading-5 text-body">{pkg.description}</p>

                  <ul className="mt-4 flex flex-col gap-1.5 text-xs text-body">
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 shrink-0 text-brand" />
                      {pkg.features.adFree
                        ? "Tắt 100% banner quảng cáo trên cổng"
                        : "Hiển thị banner tài trợ sinh thái"}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 shrink-0 text-brand" />
                      Điểm điểm danh: x{pkg.features.dailyPointMultiplier} hằng ngày
                    </li>
                  </ul>
                </div>

                <div className="mt-5 border-t border-line-soft pt-4">
                  {isIncludedInHigherPlan ? (
                    <p className="rounded-lg border border-brand/20 bg-brand/6 px-3 py-2 text-center text-xs font-semibold text-brand-deep">
                      Đã bao gồm trong gói {entitlements.currentTier} hiện tại
                    </p>
                  ) : isBasic ? (
                    <button
                      type="button"
                      disabled
                      className="btn-outline h-10 w-full cursor-default text-xs opacity-75"
                    >
                      Mặc định không cần thanh toán
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={buyingCode === pkg.packageCode}
                      onClick={() => void handlePurchasePackage(pkg)}
                      className="btn-primary inline-flex h-10 w-full items-center justify-center gap-2 text-xs font-semibold"
                    >
                      <QrCode className="size-4" />
                      {buyingCode === pkg.packageCode
                        ? "Đang tạo mã VietQR..."
                        : isCurrent
                          ? "Gia hạn cộng dồn (+30 ngày)"
                          : "Mua gói Premium qua VietQR"}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        {/* Lịch sử hóa đơn thanh toán dịch vụ VietQR cá nhân */}
        {orders.length > 0 && (
          <div className="mt-2">
            <h3 className="mb-2.5 text-sm font-bold text-ink">Hóa đơn nâng cấp gói gần đây</h3>
            <Table head={["Mã đơn", "Gói dịch vụ", "Số tiền", "Trạng thái", "Thời gian", "Thao tác"]}>
              {orders.map((ord) => {
                const st = statusMeta(ord)
                const isPending = ord.status.toUpperCase() === "PENDING"
                return (
                  <tr key={ord.orderCode}>
                    <Td className="font-mono text-xs font-semibold text-ink">{ord.orderCode}</Td>
                    <Td>
                      <span className="font-semibold text-ink">{ord.packageName}</span>
                      <span className="block text-[11px] text-muted">{ord.durationDays} ngày</span>
                    </Td>
                    <Td className="tabular-nums font-semibold">{fmtVnd(ord.amount)}</Td>
                    <Td>
                      <Status tone={st.tone}>{st.label}</Status>
                    </Td>
                    <Td className="text-xs text-muted">
                      {new Date(ord.createdAt).toLocaleString("vi-VN")}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => setActiveQrOrder(ord)}
                              className="btn-outline inline-flex h-8 items-center gap-1 px-2.5 text-xs"
                            >
                              <QrCode className="size-3.5" />
                              Mở QR
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCancelOrder(ord)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-warn/30 px-2.5 text-xs font-semibold text-warn hover:bg-warn/10"
                            >
                              <XCircle className="size-3.5" />
                              Hủy
                            </button>
                          </>
                        )}
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </Table>
          </div>
        )}
      </section>

      {/* Kiến trúc thanh toán phế liệu trực tiếp P2P (không giữ tiền hộ / không payout) */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card flex flex-col gap-4 p-5 md:p-6">
          <div className="border-b border-line-soft pb-3">
            <h2 className="text-base font-bold text-ink">
              Quy chuẩn thanh toán tiền phế liệu trực tiếp (BR-DSP-04)
            </h2>
            <p className="mt-1 text-xs text-muted">
              Tiền bán phế liệu được hai bên giao dịch trực tiếp tại điểm thu gom — EcoLink không giữ tiền hộ và không thu phí hoa hồng.
            </p>
          </div>
          <ol className="flex flex-col gap-4">
            {[
              [
                "Thanh toán trực tiếp 100% tại chỗ",
                "Khi bàn giao phế liệu, Cơ sở thu mua thanh toán trực tiếp cho bạn bằng tiền mặt hoặc chuyển khoản cá nhân, không khấu trừ phí nền tảng.",
              ],
              [
                "Biên nhận số đính kèm ảnh cân",
                "Cơ sở thu mua tải ảnh mặt đồng hồ cân lên biên nhận điện tử (R-06). Khi bạn xác nhận biên nhận (U-09), hệ thống chốt chứng từ đối chiếu và cộng Điểm Xanh vào ví.",
              ],
              [
                "Bảo vệ hai chiều trong 7 ngày",
                "Nếu phát sinh sai lệch khối lượng hoặc thanh toán, bạn có thể bấm khiếu nại ngay trên biên nhận hoặc gửi phiếu Trọng tài 360° kèm bằng chứng (U-11).",
              ],
            ].map(([titleText, desc], i) => (
              <li key={titleText} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{titleText}</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-body">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="card flex flex-col justify-between gap-4 p-5 md:p-6">
          <div>
            <h2 className="text-base font-bold text-ink">Lối tắt biên nhận &amp; quyền lợi</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Theo dõi các biên nhận đã chốt, đánh giá uy tín cơ sở thu mua và sử dụng Điểm Xanh tích lũy từ mỗi lượt bàn giao.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              <Link
                to="/user/receipt"
                className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-[13px] font-semibold text-ink transition-colors hover:border-brand/40 hover:bg-surface-2"
              >
                <span>Xác nhận biên nhận &amp; Đánh giá sao (U-09 / U-10)</span>
                <span className="text-brand">→</span>
              </Link>
              <Link
                to="/user/transactions"
                className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-[13px] font-semibold text-ink transition-colors hover:border-brand/40 hover:bg-surface-2"
              >
                <span>Lịch sử biên nhận bàn giao</span>
                <span className="text-brand">→</span>
              </Link>
              <Link
                to="/rewards"
                className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-[13px] font-semibold text-ink transition-colors hover:border-brand/40 hover:bg-surface-2"
              >
                <span>Ví Điểm Xanh &amp; Đổi quà tặng (U-14)</span>
                <span className="text-brand">→</span>
              </Link>
            </div>
          </div>
          <p className="rounded-lg bg-surface-2 px-3.5 py-2.5 text-xs text-muted">
            Thanh toán VietQR ở mục trên chỉ áp dụng cho gói dịch vụ nội bộ (Premium) và không dùng để thu chi hộ tiền phế liệu.
          </p>
        </aside>
      </div>

      <VietQrCheckoutModal
        order={activeQrOrder}
        onClose={() => setActiveQrOrder(null)}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  )
}
