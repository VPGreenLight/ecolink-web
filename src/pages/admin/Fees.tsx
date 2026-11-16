import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Lock, Pencil, Plus, RefreshCw, ShieldAlert, X } from "lucide-react"
import { Field, PageHead, Stat, Status, Table, Td } from "@/components/admin/ui"
import { fmtInt, fmtVnd } from "@/data/ops"
import {
  CANONICAL_FALLBACK_PACKAGES,
  createAdminServicePackage,
  getAdminServicePackages,
  toggleAdminServicePackageStatus,
  updateAdminServicePackage,
  type AdminServicePackageDto,
  type UpsertServicePackageRequest,
} from "@/lib/servicePackageApi"
import { getAccessToken } from "@/lib/session"

type PackageFormState = {
  packageId: string | null
  packageCode: string
  packageName: string
  targetRole: "User" | "Recycler" | "All"
  description: string
  priceVnd: string
  durationDays: string
  requiresVerifiedKyb: boolean
  displayOrder: string
  isActive: boolean
  isDefaultFree: boolean
  tierName: string
  adFree: boolean
  dailyPointMultiplier: string
  ecoPlusBadge: boolean
  verifiedBlueBadge: boolean
  featuredMapMarker: boolean
  mapPriorityBoost: string
}

function emptyFormState(pkg?: AdminServicePackageDto): PackageFormState {
  if (!pkg) {
    return {
      packageId: null,
      packageCode: "",
      packageName: "",
      targetRole: "All",
      description: "",
      priceVnd: "99000",
      durationDays: "30",
      requiresVerifiedKyb: false,
      displayOrder: "40",
      isActive: true,
      isDefaultFree: false,
      tierName: "Premium",
      adFree: true,
      dailyPointMultiplier: "1.2",
      ecoPlusBadge: true,
      verifiedBlueBadge: false,
      featuredMapMarker: false,
      mapPriorityBoost: "0",
    }
  }

  const normalizedRole: "User" | "Recycler" | "All" =
    pkg.targetRole === "User" || pkg.targetRole === "Recycler" ? pkg.targetRole : "All"

  return {
    packageId: pkg.id,
    packageCode: pkg.packageCode,
    packageName: pkg.packageName,
    targetRole: normalizedRole,
    description: pkg.description ?? "",
    priceVnd: String(pkg.priceVnd),
    durationDays: String(pkg.durationDays),
    requiresVerifiedKyb: pkg.requiresVerifiedKyb,
    displayOrder: String(pkg.displayOrder),
    isActive: pkg.isActive,
    isDefaultFree: pkg.isDefaultFree,
    tierName: pkg.features.tierName || "Basic",
    adFree: pkg.features.adFree,
    dailyPointMultiplier: String(pkg.features.dailyPointMultiplier),
    ecoPlusBadge: pkg.features.ecoPlusBadge,
    verifiedBlueBadge: pkg.features.verifiedBlueBadge,
    featuredMapMarker: pkg.features.featuredMapMarker,
    mapPriorityBoost: String(pkg.features.mapPriorityBoost),
  }
}

const ROLE_LABEL: Record<string, string> = {
  All: "Tất cả (User + Recycler)",
  User: "Người dân (Citizen)",
  Recycler: "Cơ sở thu mua (KYB)",
}

/** A-10 Cấu hình phí giao dịch & Bảng giá Gói dịch vụ Nội bộ (BASIC - PREMIUM - PRO).
 *
 *  Kết nối trực tiếp với:
 *   - `GET /api/v1/admin/service-packages` (STT 123)
 *   - `POST /api/v1/admin/service-packages` (STT 124)
 *   - `PUT /api/v1/admin/service-packages/{packageId}` (STT 125)
 *   - `PATCH /api/v1/admin/service-packages/{packageId}/status` (STT 126) */
export default function Fees() {
  const [packages, setPackages] = useState<AdminServicePackageDto[]>(
    () => CANONICAL_FALLBACK_PACKAGES,
  )
  const [roleFilter, setRoleFilter] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [flash, setFlash] = useState("")
  const [errMsg, setErrMsg] = useState("")

  const [editing, setEditing] = useState<PackageFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState("")

  const loadPackages = useCallback(async () => {
    setLoading(true)
    setErrMsg("")
    try {
      const res = await getAdminServicePackages(
        roleFilter ? { targetRole: roleFilter } : {},
      )
      if (res.success && Array.isArray(res.data)) {
        setPackages(res.data)
      }
    } catch (e) {
      if (getAccessToken()) {
        setErrMsg(
          e instanceof Error ? e.message : "Không thể tải danh sách gói dịch vụ từ máy chủ.",
        )
      }
    } finally {
      setLoading(false)
    }
  }, [roleFilter])

  useEffect(() => {
    void loadPackages()
  }, [loadPackages])

  const filteredPackages = roleFilter
    ? packages.filter((p) => p.targetRole === roleFilter)
    : packages

  const totalSubscribers = packages.reduce((s, p) => s + p.activeSubscribersCount, 0)
  const totalPaidOrders = packages.reduce((s, p) => s + p.totalPaidOrdersCount, 0)
  const totalRevenue = packages.reduce((s, p) => s + p.totalRevenueVnd, 0)

  const handleToggleStatus = async (pkg: AdminServicePackageDto) => {
    if (pkg.isDefaultFree || pkg.packageCode.toUpperCase() === "BASIC") {
      setErrMsg("Không thể tạm ngừng gói mặc định miễn phí BASIC theo chính sách hệ thống.")
      return
    }
    setErrMsg("")
    setFlash("")
    const nextActive = !pkg.isActive
    try {
      if (!getAccessToken()) {
        setPackages((prev) =>
          prev.map((item) =>
            item.id === pkg.id ? { ...item, isActive: nextActive } : item,
          ),
        )
        setFlash(`Đã ${nextActive ? "mở bán lại" : "tạm ngừng mở bán"} gói ${pkg.packageName} (Offline Demo).`)
        return
      }

      const res = await toggleAdminServicePackageStatus(
        pkg.id,
        nextActive,
        nextActive ? "Admin mở bán lại gói" : "Admin tạm ngừng mở bán gói mới",
      )
      setPackages((prev) => prev.map((item) => (item.id === pkg.id ? res.data : item)))
      setFlash(
        `Đã ${nextActive ? "mở bán" : "tạm ngừng"} gói ${pkg.packageName}. Thuê bao cũ vẫn tiếp tục hoạt động đến hết hạn (BR-PAY-05).`,
      )
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Không thể thay đổi trạng thái gói lúc này.")
    }
  }

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setFormErr("")

    const code = editing.packageCode.trim().toUpperCase()
    const name = editing.packageName.trim()
    const price = Number(editing.priceVnd)
    const duration = Number(editing.durationDays)
    const displayOrder = Number(editing.displayOrder) || 10
    const multiplier = Number(editing.dailyPointMultiplier) || 1.0
    const boost = Number(editing.mapPriorityBoost) || 0

    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
      setFormErr("Mã gói chỉ gồm chữ in hoa, số, dấu '-' hoặc '_' (3–40 ký tự).")
      return
    }
    if (name.length < 3) {
      setFormErr("Tên gói dịch vụ phải từ 3 ký tự trở lên.")
      return
    }
    if (editing.isDefaultFree || code === "BASIC") {
      if (price !== 0 || duration !== 0) {
        setFormErr("Gói mặc định BASIC bắt buộc giữ mức phí 0 VNĐ và thời hạn 0 ngày.")
        return
      }
    } else {
      if (!Number.isFinite(price) || price < 2000) {
        setFormErr("Gói trả phí phải có đơn giá tối thiểu 2.000 VNĐ (ngưỡng sàn PayOS VietQR).")
        return
      }
      if (!Number.isInteger(duration) || duration < 1 || duration > 730) {
        setFormErr("Chu kỳ hiệu lực của gói trả phí phải từ 1 đến 730 ngày.")
        return
      }
    }

    const payload: UpsertServicePackageRequest = {
      packageCode: code,
      packageName: name,
      targetRole: editing.targetRole,
      description: editing.description.trim() || undefined,
      priceVnd: price,
      durationDays: duration,
      requiresVerifiedKyb: editing.requiresVerifiedKyb,
      displayOrder,
      isActive: editing.isDefaultFree ? true : editing.isActive,
      features: {
        tierName: editing.tierName.trim() || "Basic",
        adFree: editing.adFree,
        dailyPointMultiplier: multiplier,
        ecoPlusBadge: editing.ecoPlusBadge,
        verifiedBlueBadge: editing.verifiedBlueBadge,
        featuredMapMarker: editing.featuredMapMarker,
        mapPriorityBoost: boost,
      },
    }

    setSaving(true)
    try {
      if (!getAccessToken()) {
        if (editing.packageId) {
          setPackages((prev) =>
            prev.map((item) =>
              item.id === editing.packageId ? { ...item, ...payload } : item,
            ),
          )
        } else {
          const demoPkg: AdminServicePackageDto = {
            ...payload,
            id: `demo-pkg-${Date.now()}`,
            displayOrder: payload.displayOrder ?? 40,
            isDefaultFree: false,
            isEligible: true,
            isCurrentPlan: false,
            activeSubscribersCount: 0,
            totalPaidOrdersCount: 0,
            totalRevenueVnd: 0,
            createdAt: new Date().toISOString(),
          }
          setPackages((prev) => [...prev, demoPkg])
        }
        setFlash(`Đã lưu cấu hình gói ${payload.packageName} (Offline Demo).`)
        setEditing(null)
        return
      }

      if (editing.packageId) {
        const res = await updateAdminServicePackage(editing.packageId, payload)
        setPackages((prev) =>
          prev.map((item) => (item.id === editing.packageId ? res.data : item)),
        )
        setFlash(
          `Đã cập nhật biểu phí gói ${res.data.packageName}. Các thuê bao đã mua trước đây vẫn giữ nguyên quyền lợi đến hết hạn (BR-PAY-05).`,
        )
      } else {
        const res = await createAdminServicePackage(payload)
        setPackages((prev) => [...prev, res.data])
        setFlash(`Đã khởi tạo gói dịch vụ mới ${res.data.packageName}.`)
      }
      setEditing(null)
    } catch (err) {
      setFormErr(
        err instanceof Error ? err.message : "Không thể lưu cấu hình gói dịch vụ.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="CẤU HÌNH"
        title="Cấu hình phí giao dịch"
        body="Quản lý biểu phí và chu kỳ các gói thành viên nội bộ (Basic – Premium – Pro). Mọi thay đổi được ghi nhật ký Audit Log bất biến."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadPackages()}
              disabled={loading}
              className="btn-outline inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Tải lại
            </button>
            <button
              type="button"
              onClick={() => {
                setFormErr("")
                setEditing(emptyFormState())
              }}
              className="btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-xs font-semibold"
            >
              <Plus className="size-4" />
              Tạo gói dịch vụ mới
            </button>
          </div>
        }
      />

      {/* Dải KPI tổng quan biểu phí */}
      <div className="grid gap-6 border-b border-line-soft pb-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Số gói trong catalog" value={fmtInt(packages.length)} note="Gồm gói mặc định & trả phí" />
        <Stat label="Thuê bao đang hoạt động" value={fmtInt(totalSubscribers)} note="Tất cả vai trò" />
        <Stat label="Đơn thanh toán thành công" value={fmtInt(totalPaidOrders)} note="Qua VietQR Động" />
        <Stat label="Doanh thu gói nội bộ" value={fmtVnd(totalRevenue)} note="Đã đối soát" />
      </div>

      {/* Khuyến cáo Grandfathering BR-PAY-05 */}
      <div className="flex items-start gap-3 rounded-xl border border-brand/25 bg-brand/6 px-4 py-3 text-xs leading-5 text-brand-deep">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <div>
          <b>Nguyên tắc bảo toàn giá cũ (Grandfathering · BR-PAY-05):</b> Khi Admin điều chỉnh đơn giá
          hoặc chu kỳ gói dịch vụ, mức giá mới chỉ áp dụng cho các đơn thanh toán VietQR tạo sau thời điểm
          lưu. Tài khoản đang dùng gói vẫn giữ nguyên đơn giá và quyền lợi đã mua đến hết hạn.
        </div>
      </div>

      {flash && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/8 px-3.5 py-2.5 text-xs font-semibold text-brand-deep">
          <CheckCircle2 className="size-4 shrink-0" />
          {flash}
        </p>
      )}
      {errMsg && (
        <p role="alert" className="rounded-lg border border-warn/35 bg-warn/10 px-3.5 py-2.5 text-xs font-semibold text-warn">
          {errMsg}
        </p>
      )}

      {/* Bộ lọc đối tượng áp dụng */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "", label: "Tất cả đối tượng" },
          { key: "All", label: "Mọi vai trò (All)" },
          { key: "User", label: "Người dân (User)" },
          { key: "Recycler", label: "Cơ sở thu mua (Recycler)" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setRoleFilter(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              roleFilter === tab.key
                ? "bg-brand text-white"
                : "border border-line bg-surface text-body hover:bg-surface-2"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Table
        head={[
          "Mã & Tên gói",
          "Đối tượng",
          "Đơn giá",
          "Chu kỳ",
          "Quyền lợi JSONB",
          "Thuê bao / Doanh thu",
          "Trạng thái",
          "Thao tác",
        ]}
      >
        {filteredPackages.map((pkg) => {
          const isBasicLocked = pkg.isDefaultFree || pkg.packageCode.toUpperCase() === "BASIC"
          return (
            <tr key={pkg.id}>
              <Td>
                <div className="flex items-center gap-1.5 font-semibold text-ink">
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-brand-deep">
                    {pkg.packageCode}
                  </span>
                  <span>{pkg.packageName}</span>
                </div>
                {pkg.description && (
                  <p className="mt-1 max-w-xs text-[11px] leading-4 text-muted">
                    {pkg.description}
                  </p>
                )}
              </Td>
              <Td>
                <span className="text-xs font-medium text-ink">
                  {ROLE_LABEL[pkg.targetRole] ?? pkg.targetRole}
                </span>
                {pkg.requiresVerifiedKyb && (
                  <span className="mt-0.5 block text-[11px] font-semibold text-amber-700">
                    Bắt buộc KYB Verified
                  </span>
                )}
              </Td>
              <Td className="font-bold text-ink tabular-nums">
                {pkg.priceVnd === 0 ? "0 đ (Mặc định)" : fmtVnd(pkg.priceVnd)}
              </Td>
              <Td className="tabular-nums text-xs">
                {pkg.durationDays === 0 ? "Vĩnh viễn" : `${pkg.durationDays} ngày`}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  {pkg.features.adFree && (
                    <span className="rounded bg-brand/10 px-1.5 py-0.5 font-semibold text-brand-deep">
                      Tắt QC
                    </span>
                  )}
                  {pkg.features.dailyPointMultiplier > 1 && (
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 font-semibold text-ink">
                      x{pkg.features.dailyPointMultiplier} điểm
                    </span>
                  )}
                  {pkg.features.verifiedBlueBadge && (
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-800">
                      Tích xanh
                    </span>
                  )}
                  {pkg.features.featuredMapMarker && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                      Ghim +{pkg.features.mapPriorityBoost}
                    </span>
                  )}
                  {!pkg.features.adFree && !pkg.features.verifiedBlueBadge && (
                    <span className="text-muted">Cơ bản</span>
                  )}
                </div>
              </Td>
              <Td className="tabular-nums text-xs">
                <span className="font-semibold text-ink">
                  {fmtInt(pkg.activeSubscribersCount)} đang dùng
                </span>
                <span className="block text-[11px] text-muted">
                  {fmtInt(pkg.totalPaidOrdersCount)} đơn · {fmtVnd(pkg.totalRevenueVnd)}
                </span>
              </Td>
              <Td>
                <Status tone={pkg.isActive ? "ok" : "off"}>
                  {pkg.isActive ? "Đang mở bán" : "Tạm ngừng"}
                </Status>
              </Td>
              <Td>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFormErr("")
                      setEditing(emptyFormState(pkg))
                    }}
                    className="btn-outline inline-flex h-8 items-center gap-1 px-2.5 text-xs"
                  >
                    <Pencil className="size-3" />
                    Sửa
                  </button>
                  {isBasicLocked ? (
                    <span
                      title="Gói mặc định BASIC không thể tắt"
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 text-[11px] font-medium text-muted"
                    >
                      <Lock className="size-3" />
                      Khóa
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleToggleStatus(pkg)}
                      className={`inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-semibold ${
                        pkg.isActive
                          ? "border-warn/30 text-warn hover:bg-warn/10"
                          : "border-brand/30 text-brand-deep hover:bg-brand/10"
                      }`}
                    >
                      {pkg.isActive ? "Tạm ngừng" : "Mở bán"}
                    </button>
                  )}
                </div>
              </Td>
            </tr>
          )
        })}
      </Table>

      {/* Modal tạo / cập nhật gói dịch vụ */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cấu hình biểu phí gói dịch vụ"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <form
            onSubmit={(e) => void handleSaveForm(e)}
            className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-2xl md:p-6"
          >
            <button
              type="button"
              onClick={() => setEditing(null)}
              aria-label="Đóng biểu mẫu"
              className="absolute top-4 right-4 rounded-lg p-1.5 text-muted hover:bg-surface-2"
            >
              <X className="size-5" />
            </button>

            <p className="text-[11px] font-bold tracking-[0.12em] text-brand uppercase">
              A-10 · BIỂU PHÍ DỊCH VỤ NỘI BỘ
            </p>
            <h2 className="mt-1 text-lg font-bold text-ink">
              {editing.packageId ? `Cập nhật gói ${editing.packageCode}` : "Tạo gói dịch vụ mới"}
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Mã gói (packageCode)">
                <input
                  className="input font-mono uppercase"
                  value={editing.packageCode}
                  disabled={!!editing.packageId}
                  onChange={(e) =>
                    setEditing({ ...editing, packageCode: e.target.value.toUpperCase() })
                  }
                  placeholder="VD: PREMIUM_YEARLY"
                />
              </Field>

              <Field label="Tên hiển thị">
                <input
                  className="input"
                  value={editing.packageName}
                  onChange={(e) => setEditing({ ...editing, packageName: e.target.value })}
                  placeholder="Premium 1 năm"
                />
              </Field>

              <Field label="Đối tượng áp dụng">
                <select
                  className="input"
                  value={editing.targetRole}
                  disabled={editing.isDefaultFree}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      targetRole: e.target.value as "User" | "Recycler" | "All",
                    })
                  }
                >
                  <option value="All">Tất cả (All)</option>
                  <option value="User">Người dân (User)</option>
                  <option value="Recycler">Cơ sở thu mua (Recycler)</option>
                </select>
              </Field>

              <Field label="Hạng quyền lợi (tierName)">
                <select
                  className="input"
                  value={editing.tierName}
                  disabled={editing.isDefaultFree}
                  onChange={(e) => setEditing({ ...editing, tierName: e.target.value })}
                >
                  <option value="Basic">Basic</option>
                  <option value="Premium">Premium</option>
                  <option value="Pro">Pro</option>
                </select>
              </Field>

              <Field
                label="Đơn giá (VNĐ)"
                hint={editing.isDefaultFree ? "Gói BASIC cố định 0 đ" : "Tối thiểu 2.000 VNĐ cho VietQR PayOS"}
              >
                <input
                  type="number"
                  min={editing.isDefaultFree ? 0 : 2000}
                  step={1000}
                  className="input tabular-nums"
                  value={editing.priceVnd}
                  disabled={editing.isDefaultFree}
                  onChange={(e) => setEditing({ ...editing, priceVnd: e.target.value })}
                />
              </Field>

              <Field
                label="Chu kỳ hiệu lực (Ngày)"
                hint={editing.isDefaultFree ? "Gói mặc định = 0 ngày" : "Từ 1 đến 730 ngày"}
              >
                <input
                  type="number"
                  min={editing.isDefaultFree ? 0 : 1}
                  max={730}
                  className="input tabular-nums"
                  value={editing.durationDays}
                  disabled={editing.isDefaultFree}
                  onChange={(e) => setEditing({ ...editing, durationDays: e.target.value })}
                />
              </Field>

              <Field label="Hệ số điểm điểm danh">
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  className="input tabular-nums"
                  value={editing.dailyPointMultiplier}
                  onChange={(e) =>
                    setEditing({ ...editing, dailyPointMultiplier: e.target.value })
                  }
                />
              </Field>

              <Field label="Điểm cộng ưu tiên bản đồ">
                <input
                  type="number"
                  min="0"
                  max="1000"
                  className="input tabular-nums"
                  value={editing.mapPriorityBoost}
                  onChange={(e) =>
                    setEditing({ ...editing, mapPriorityBoost: e.target.value })
                  }
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Mô tả quyền lợi">
                <textarea
                  rows={2}
                  className="input h-auto py-2"
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-2.5 rounded-xl border border-line bg-surface-2 p-3.5 sm:grid-cols-2">
              {[
                { key: "adFree", label: "Tắt toàn bộ quảng cáo (adFree)" },
                { key: "ecoPlusBadge", label: "Nhãn hội viên EcoPlus" },
                { key: "verifiedBlueBadge", label: "Cấp Tích xanh cơ sở (Pro)" },
                { key: "featuredMapMarker", label: "Ghim nổi bật trên /map (Pro)" },
                { key: "requiresVerifiedKyb", label: "Bắt buộc xác minh KYB khi mua" },
              ].map((chk) => (
                <label key={chk.key} className="flex items-center gap-2 text-xs font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={Boolean(editing[chk.key as keyof PackageFormState])}
                    onChange={(e) =>
                      setEditing({ ...editing, [chk.key]: e.target.checked })
                    }
                  />
                  {chk.label}
                </label>
              ))}
            </div>

            {formErr && (
              <p role="alert" className="mt-3 text-xs font-semibold text-warn">
                {formErr}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2 border-t border-line-soft pt-4">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="btn-ghost h-10 px-4 text-xs"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary h-10 px-5 text-xs font-semibold"
              >
                {saving ? "Đang lưu..." : "Lưu cấu hình & Ghi Audit Log"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
