import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Check, Crown, Lock, QrCode, RefreshCw, ShieldCheck, Sparkles, XCircle } from "lucide-react"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import SponsoredAdBanner from "@/components/SponsoredAdBanner"
import VietQrCheckoutModal from "@/components/VietQrCheckoutModal"
import { BANKS, validAccount } from "@/data/cashflow"
import { fmtVnd } from "@/data/ops"
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
import { getAccessToken } from "@/lib/session"

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

/** U-13 Thiết lập tài khoản nhận tiền + U-16 Gói dịch vụ Citizen & Thanh toán VietQR Động.
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
  const [packages, setPackages] = useState<ServicePackageCatalogDto[]>(
    () => CANONICAL_FALLBACK_PACKAGES,
  )
  const [activeSubs, setActiveSubs] = useState<ActiveSubscriptionDto[]>([])
  const [orders, setOrders] = useState<PayInOrderDto[]>([])
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [buyingCode, setBuyingCode] = useState<string | null>(null)
  const [activeQrOrder, setActiveQrOrder] = useState<PayInOrderDto | null>(null)
  const [pkgFlash, setPkgFlash] = useState("")
  const [pkgErr, setPkgErr] = useState("")

  // Phần U-13: Tài khoản ngân hàng nhận tiền bán phế liệu
  const [bank, setBank] = useState<string>(BANKS[0])
  const [no, setNo] = useState("007012345678")
  const [holder, setHolder] = useState("Nguyễn Đức")
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState("")

  const loadSubscriptionWorkspace = useCallback(async () => {
    setLoadingPackages(true)
    try {
      const pkgRes = await getAvailableServicePackages("User")
      if (pkgRes.success && Array.isArray(pkgRes.data) && pkgRes.data.length > 0) {
        setPackages(pkgRes.data)
      }

      if (getAccessToken()) {
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
    } catch {
      // Giữ danh sách gói chuẩn khi chạy ngoại tuyến
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
      if (!getAccessToken()) {
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

  const submitBankForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validAccount(no)) {
      setErr("Số tài khoản phải là 6 đến 20 chữ số.")
      setSaved(false)
      return
    }
    if (holder.trim().length < 3) {
      setErr("Tên chủ tài khoản phải khớp với tên trên giấy tờ.")
      setSaved(false)
      return
    }
    setErr("")
    setSaved(true)
  }

  const primaryActiveSub = activeSubs[0]

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="DÒNG TIỀN"
        title="Tài khoản nhận tiền"
        body="Quản lý gói thành viên VietQR không quảng cáo và cài đặt tài khoản ngân hàng nhận tiền bán phế liệu tự động."
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
              Nâng cấp đặc quyền EcoLink (Basic – Premium – Pro)
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

        <div className="grid gap-4 lg:grid-cols-3">
          {packages.map((pkg) => {
            const isBasic = pkg.isDefaultFree || pkg.packageCode === "BASIC"
            const isPro = pkg.packageCode === "PRO" || pkg.targetRole === "Recycler"
            const isCurrent =
              pkg.isCurrentPlan ||
              entitlements.currentTier.toUpperCase() === pkg.packageCode.toUpperCase()

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
                    {!isCurrent && isPro && <Status tone="off">Cơ sở thu mua</Status>}
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
                    {pkg.features.verifiedBlueBadge && (
                      <li className="flex items-center gap-2">
                        <Check className="size-3.5 shrink-0 text-[#0284c7]" />
                        Tích xanh xác minh &amp; Ghim ưu tiên bản đồ
                      </li>
                    )}
                  </ul>
                </div>

                <div className="mt-5 border-t border-line-soft pt-4">
                  {isBasic ? (
                    <button
                      type="button"
                      disabled
                      className="btn-outline h-10 w-full cursor-default text-xs opacity-75"
                    >
                      Mặc định không cần thanh toán
                    </button>
                  ) : isPro ? (
                    <button
                      type="button"
                      disabled
                      className="btn-outline inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-1.5 text-xs opacity-75"
                    >
                      <Lock className="size-3.5" />
                      Dành riêng cho Cơ sở thu mua (KYB)
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

      {/* Khu vực U-13: Tài khoản ngân hàng nhận tiền bán phế liệu */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <form onSubmit={submitBankForm} noValidate className="card flex flex-col gap-5 p-5 md:p-6">
          <div className="border-b border-line-soft pb-3">
            <h2 className="text-base font-bold text-ink">
              Tài khoản ngân hàng nhận tiền bán phế liệu
            </h2>
            <p className="mt-1 text-xs text-muted">
              Tiền bán rác được EcoLink chuyển thẳng về tài khoản này sau khi bàn giao hoàn tất.
            </p>
          </div>

          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Ngân hàng
            <select className="input" value={bank} onChange={(e) => setBank(e.target.value)}>
              {BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Số tài khoản
            <input
              className={`input tabular-nums ${err && !validAccount(no) ? "border-warn" : ""}`}
              inputMode="numeric"
              value={no}
              onChange={(e) => setNo(e.target.value)}
              placeholder="007012345678"
            />
            <span className="text-[12px] font-normal text-muted">
              Nhập dấu cách hoặc dấu chấm cũng được, hệ thống tự bỏ.
            </span>
          </label>

          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Chủ tài khoản
            <input
              className={`input ${err && holder.trim().length < 3 ? "border-warn" : ""}`}
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
            />
            <span className="text-[12px] font-normal text-muted">
              Phải là chính bạn. EcoLink không chuyển tiền vào tài khoản của người khác.
            </span>
          </label>

          {err && <p className="text-[13px] text-warn">{err}</p>}

          <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
            <button type="submit" className="btn-primary h-11 px-6">
              Lưu tài khoản
            </button>
            {saved && (
              <p role="status" className="text-[13px] font-semibold text-brand">
                Đã lưu. Các khoản chi tiếp theo sẽ về tài khoản này.
              </p>
            )}
          </div>
        </form>

        <aside className="card flex flex-col gap-4 p-5 md:p-6">
          <h2 className="text-base font-bold text-ink">Tiền về từ đâu</h2>
          <ol className="flex flex-col gap-4">
            {[
              [
                "Người thu gom nhận rác",
                "Sau khi bàn giao xong, cơ sở thu mua chuyển tiền qua VietQR về EcoLink.",
              ],
              [
                "Hệ thống nhận tiền",
                "Webhook VietQR báo nhận đủ. EcoLink trừ phí nền tảng rồi tính số tiền về của bạn.",
              ],
              [
                "PayOS bắn tiền về tài khoản",
                "Thường trong vài phút. Xem từng khoản ở Lịch sử dòng tiền.",
              ],
            ].map(([t, b], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{t}</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-muted">{b}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            to="/user/transactions"
            className="mt-1 text-[13px] font-semibold text-brand hover:text-brand-deep"
          >
            Xem lịch sử dòng tiền →
          </Link>
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
