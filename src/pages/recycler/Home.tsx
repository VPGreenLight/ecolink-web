import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Camera, Check, Crown, Lock, QrCode, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Star } from "lucide-react"
import FacilityPhotoCard from "@/components/FacilityPhotoCard"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import { PageHead, Stat, Status, Table, Td } from "@/components/Portal"
import SponsoredAdBanner from "@/components/SponsoredAdBanner"
import VietQrCheckoutModal from "@/components/VietQrCheckoutModal"
import { initApiLoading, initApiState, isSsrSmokeTest } from "@/lib/hydration"
import { MY_HANDOVERS, type HandoverStatus } from "@/data/handover"
import { fmtVnd } from "@/data/ops"
import {
  fetchHandoverOrdersResult,
  fetchRecyclerStatus,
  fetchRecyclerTransactions,
  toggleRecyclerOnlineStatus,
  updateRecyclerProfile,
  updateRecyclerWarehousePin,
  updateRecyclerWeeklySchedule,
  uploadSingleDocument,
  type RecyclerProfileDto,
  type ScheduleDayDto,
  type TransactionHistoryItemDto,
} from "@/lib/recyclerWorkflowApi"
import {
  fetchRecyclerReviews,
  type RecyclerReviewsSummaryDto,
} from "@/lib/reviewComplaintApi"
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Thứ hai",
  2: "Thứ ba",
  3: "Thứ tư",
  4: "Thứ năm",
  5: "Thứ sáu",
  6: "Thứ bảy",
  0: "Chủ nhật",
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function buildDefaultWeeklySchedule(incoming?: ScheduleDayDto[]): ScheduleDayDto[] {
  const byDay = new Map<number, ScheduleDayDto>()
  for (const d of incoming ?? []) {
    byDay.set(d.dayOfWeek, d)
  }
  return WEEKDAY_ORDER.map((dayOfWeek) => {
    const existing = byDay.get(dayOfWeek)
    return existing
      ? {
          dayOfWeek,
          isClosed: Boolean(existing.isClosed),
          openTime: existing.openTime || "07:30",
          closeTime: existing.closeTime || "18:30",
        }
      : {
          dayOfWeek,
          isClosed: dayOfWeek === 0,
          openTime: "07:30",
          closeTime: "18:30",
        }
  })
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
  const [actionErr, setActionErr] = useState("")
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
          facilityName: "Vựa phế liệu EcoGreen Hòa Lạc",
          representativeName: "Trần Thu Gom",
          businessAddress: "Số 18 Đại lộ Thăng Long, Khu CNC Hòa Lạc, Thạch Thất, Hà Nội",
          latitude: 21.0138,
          longitude: 105.5256,
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
  const [draftLat, setDraftLat] = useState(21.0138)
  const [draftLng, setDraftLng] = useState(105.5256)
  const [draftAddress, setDraftAddress] = useState(() =>
    initApiState("", "Số 18 Đại lộ Thăng Long, Khu CNC Hòa Lạc, Thạch Thất, Hà Nội"),
  )
  const [savingPin, setSavingPin] = useState(false)
  const [pinErr, setPinErr] = useState("")

  const [loadingHandovers, setLoadingHandovers] = useState<boolean>(() => initApiLoading(true))
  const [handovers, setHandovers] = useState<UpcomingRow[]>(() =>
    initApiState([], MY_HANDOVERS.filter((h) => h.status !== "done")),
  )
  const [txSummary, setTxSummary] = useState(() =>
    initApiState(
      { totalCount: 0, totalAmountCash: 0, totalWeightKg: 0 },
      { totalCount: 18, totalAmountCash: 4250000, totalWeightKg: 312 },
    ),
  )
  const [txItems, setTxItems] = useState<TransactionHistoryItemDto[]>([])
  const [txSearch, setTxSearch] = useState("")
  const [reviewsSummary, setReviewsSummary] = useState<RecyclerReviewsSummaryDto | null>(null)
  const [reviewsErr, setReviewsErr] = useState("")

  const [editingProfile, setEditingProfile] = useState(false)
  const [draftFacilityName, setDraftFacilityName] = useState(() => profile.facilityName)
  const [draftRepresentativeName, setDraftRepresentativeName] = useState(() => profile.representativeName ?? "")
  const [draftContactPhone, setDraftContactPhone] = useState(() => profile.contactPhone)
  const [draftOperatingHours, setDraftOperatingHours] = useState(() => profile.operatingHours)
  const [draftDescription, setDraftDescription] = useState(() => profile.description ?? "")
  const [draftBusinessPhotoUrl, setDraftBusinessPhotoUrl] = useState(() => profile.businessPhotoUrl ?? "")
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileErr, setProfileErr] = useState("")

  const [editingSchedule, setEditingSchedule] = useState(false)
  const [weeklySchedule, setWeeklySchedule] = useState<ScheduleDayDto[]>(() => buildDefaultWeeklySchedule())
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleErr, setScheduleErr] = useState("")

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
  }, [])

  useEffect(() => {
    if (isSsrSmokeTest()) return
    let active = true
    void fetchRecyclerStatus()
      .then((res) => {
        if (!active) return
        setProfile(res.profile)
        setOpen(res.isOnline)
        setDraftLat(res.profile.latitude)
        setDraftLng(res.profile.longitude)
        setDraftAddress(res.profile.businessAddress)
        setDraftFacilityName(res.profile.facilityName)
        setDraftRepresentativeName(res.profile.representativeName ?? "")
        setDraftContactPhone(res.profile.contactPhone)
        setDraftOperatingHours(res.profile.operatingHours)
        setDraftDescription(res.profile.description ?? "")
        setDraftBusinessPhotoUrl(res.profile.businessPhotoUrl ?? "")
        setWeeklySchedule(buildDefaultWeeklySchedule(res.weeklySchedule))
        setSyncedBackend(res.fromBackend)

        if (UUID_REGEX.test(res.profile.recyclerId)) {
          void fetchRecyclerReviews(res.profile.recyclerId, { pageNumber: 1, pageSize: 5 })
            .then((rvRes) => {
              if (active && rvRes.success && rvRes.data) {
                setReviewsSummary(rvRes.data)
              }
            })
            .catch((err) => {
              if (active && liveAuth) {
                setReviewsErr(
                  err instanceof Error ? err.message : "Không thể tải danh sách đánh giá khách hàng.",
                )
              }
            })
        }
      })
      .catch((err) => {
        if (!active) return
        if (liveAuth) {
          setActionErr((prev) =>
            prev || (err instanceof Error ? err.message : "Không thể tải trạng thái cơ sở."),
          )
        }
      })

    void fetchRecyclerTransactions(undefined, undefined, 1, 20)
      .then((res) => {
        if (!active) return
        if (res.fromBackend || !liveAuth) {
          setTxSummary({
            totalCount: res.data.totalCount,
            totalAmountCash: res.data.totalAmountCash,
            totalWeightKg: res.data.totalWeightKg,
          })
          setTxItems(res.data.items ?? [])
        }
      })
      .catch((err) => {
        if (!active) return
        if (liveAuth) {
          setActionErr((prev) =>
            prev || (err instanceof Error ? err.message : "Không thể tải thống kê giao dịch cơ sở."),
          )
        }
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
      .catch((err) => {
        if (!active) return
        if (liveAuth) {
          setActionErr((prev) =>
            prev || (err instanceof Error ? err.message : "Không thể tải lịch thu gom đang mở."),
          )
        }
      })
      .finally(() => {
        if (active) setLoadingHandovers(false)
      })

    return () => {
      active = false
    }
  }, [liveAuth, refreshRecyclerPackages])

  const handleToggleAvailability = async () => {
    const nextOnline = !open
    setToggling(true)
    setActionErr("")
    setFlash("")
    try {
      const res = await toggleRecyclerOnlineStatus(nextOnline)
      setOpen(res.isOnline)
      setSyncedBackend(res.fromBackend)
      setFlash(res.message)
    } catch (err) {
      setActionErr(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật trạng thái hoạt động lúc này.",
      )
    } finally {
      setToggling(false)
    }
  }

  const handleSaveWarehousePin = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (savingPin) return
    setPinErr("")
    setActionErr("")
    setFlash("")
    const cleanAddress = draftAddress.trim()
    if (cleanAddress.length < 5 || cleanAddress.length > 255) {
      setPinErr("Địa chỉ kho bãi công khai phải từ 5 đến 255 ký tự.")
      return
    }
    if (!Number.isFinite(draftLat) || !Number.isFinite(draftLng) || (draftLat === 0 && draftLng === 0)) {
      setPinErr("Vui lòng chọn toạ độ vị trí kho bãi hợp lệ trên bản đồ.")
      return
    }
    setSavingPin(true)
    try {
      const res = await updateRecyclerWarehousePin(profile, draftLat, draftLng, cleanAddress)
      setProfile(res.profile)
      setSyncedBackend(res.fromBackend)
      setEditingLocation(false)
      setFlash(
        res.fromBackend
          ? "Đã cập nhật toạ độ kho bãi lên hệ thống. Ghim trên bản đồ /map đã dời sang vị trí mới."
          : "Đã lưu vị trí kho bãi mới và đồng bộ với bản đồ.",
      )
    } catch (err) {
      setPinErr(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật vị trí kho bãi lên hệ thống.",
      )
    } finally {
      setSavingPin(false)
    }
  }

  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingProfile) return
    setProfileErr("")
    setActionErr("")
    setFlash("")

    const cleanFacility = draftFacilityName.trim()
    const cleanRep = draftRepresentativeName.trim()
    const cleanPhone = draftContactPhone.trim()
    const cleanHours = draftOperatingHours.trim()

    if (cleanFacility.length < 2 || cleanFacility.length > 150) {
      setProfileErr("Tên cơ sở thu mua phải từ 2 đến 150 ký tự.")
      return
    }
    if (cleanRep.length > 100) {
      setProfileErr("Tên người đại diện tối đa 100 ký tự.")
      return
    }
    if (!cleanPhone || cleanPhone.length > 20 || !/^(?:\+84|0)\d{9,10}$/.test(cleanPhone.replace(/[\s.\-()]/g, ""))) {
      setProfileErr("Số điện thoại liên hệ chưa đúng định dạng Việt Nam (tối đa 20 ký tự).")
      return
    }
    if (cleanHours.length > 100) {
      setProfileErr("Giờ hoạt động tóm tắt tối đa 100 ký tự.")
      return
    }

    if (uploadingPhoto) {
      setProfileErr("Đang tải ảnh mặt tiền / kho bãi lên, vui lòng đợi xong rồi lưu.")
      return
    }

    setSavingProfile(true)
    try {
      const res = await updateRecyclerProfile(profile, {
        facilityName: cleanFacility,
        representativeName: cleanRep || null,
        contactPhone: cleanPhone,
        operatingHours: cleanHours || profile.operatingHours,
        description: draftDescription.trim() || null,
        businessPhotoUrl: draftBusinessPhotoUrl.trim() || null,
      })
      setProfile(res.profile)
      setDraftBusinessPhotoUrl(res.profile.businessPhotoUrl ?? "")
      setSyncedBackend(res.fromBackend)
      setEditingProfile(false)
      setFlash(res.message)
    } catch (err) {
      setProfileErr(
        err instanceof Error ? err.message : "Không thể cập nhật thông tin hồ sơ cơ sở.",
      )
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSelectFacilityPhoto = async (file: File | null) => {
    if (!file) return
    setProfileErr("")
    if (!file.type.startsWith("image/")) {
      setProfileErr("Vui lòng chọn tệp ảnh (JPG, PNG hoặc WebP).")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileErr("Kích thước ảnh kho bãi tối đa 5 MB.")
      return
    }
    setUploadingPhoto(true)
    try {
      const uploadedUrl = await uploadSingleDocument(file, "facility-photo")
      setDraftBusinessPhotoUrl(uploadedUrl)
    } catch (err) {
      if (hasLiveBackendAuth()) {
        setProfileErr(
          err instanceof Error ? err.message : "Không thể tải ảnh mặt tiền / kho bãi lên hệ thống.",
        )
      } else {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
          reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh."))
          reader.readAsDataURL(file)
        }).catch(() => "")
        if (dataUrl) {
          setDraftBusinessPhotoUrl(dataUrl)
        } else {
          setProfileErr("Không thể đọc tệp ảnh vừa chọn.")
        }
      }
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSaveWeeklySchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingSchedule) return
    setScheduleErr("")
    setActionErr("")
    setFlash("")

    if (!isKybVerified) {
      setScheduleErr("Hồ sơ cơ sở phải ở trạng thái Verified mới có thể cập nhật lịch hoạt động theo tuần.")
      return
    }

    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/
    for (const d of weeklySchedule) {
      if (d.isClosed) continue
      const openTime = (d.openTime ?? "").trim()
      const closeTime = (d.closeTime ?? "").trim()
      if (!timeRe.test(openTime) || !timeRe.test(closeTime)) {
        setScheduleErr(`${WEEKDAY_LABELS[d.dayOfWeek] ?? `Ngày ${d.dayOfWeek}`}: Giờ mở/đóng cửa phải theo định dạng HH:mm (ví dụ 07:30).`)
        return
      }
      if (closeTime <= openTime) {
        setScheduleErr(`${WEEKDAY_LABELS[d.dayOfWeek] ?? `Ngày ${d.dayOfWeek}`}: Giờ đóng cửa phải lớn hơn giờ mở cửa.`)
        return
      }
    }

    setSavingSchedule(true)
    try {
      const normalizedDays: ScheduleDayDto[] = weeklySchedule.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        isClosed: d.isClosed,
        openTime: d.isClosed ? null : (d.openTime ?? "07:30").trim(),
        closeTime: d.isClosed ? null : (d.closeTime ?? "18:30").trim(),
      }))
      const res = await updateRecyclerWeeklySchedule(normalizedDays)
      if (Array.isArray(res.availability.weeklySchedule)) {
        setWeeklySchedule(buildDefaultWeeklySchedule(res.availability.weeklySchedule))
      }
      setProfile((p) => ({
        ...p,
        operatingHours: res.availability.operatingHours || p.operatingHours,
        activeStatus: res.availability.activeStatus || p.activeStatus,
      }))
      setDraftOperatingHours(res.availability.operatingHours || profile.operatingHours)
      setOpen(res.availability.isOnline)
      setEditingSchedule(false)
      setFlash(res.message)
    } catch (err) {
      setScheduleErr(
        err instanceof Error ? err.message : "Không thể lưu lịch hoạt động theo tuần.",
      )
    } finally {
      setSavingSchedule(false)
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
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-brand/25 bg-brand/6 px-3.5 py-2 text-sm font-semibold text-brand-deep hover:bg-brand/12"
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

      {!isKybVerified && (
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex items-center gap-2 font-bold">
              <ShieldAlert className="size-4 shrink-0 text-amber-700" />
              Hồ sơ đối tác thu mua đang ở trạng thái:{" "}
              <span>
                {profile.verificationStatus === "Rejected" ? "Cần bổ sung (Rejected)" : "Chờ thẩm định (Pending)"}
              </span>
            </p>
            {profile.verificationStatus === "Rejected" ? (
              <p className="text-sm leading-6">
                <b>Lý do từ chối:</b> {profile.rejectionReason || "Hồ sơ chưa đạt yêu cầu xác minh."}{" "}
                Theo quy chuẩn <code>BR-MTH-02</code>, khi bạn cập nhật lại thông tin hoặc ghim kho bãi bên dưới, hồ sơ sẽ tự động chuyển về <b>Pending</b> để nhân viên xét duyệt lại.
              </p>
            ) : (
              <p className="text-sm leading-6">
                Nhân viên vận hành đang kiểm tra giấy phép pháp lý và tọa độ kho bãi của bạn. Khi được duyệt, cơ sở có thể bật trực tuyến trên bản đồ.
              </p>
            )}
          </div>
          <Link to="/join-recycler" className="btn-outline min-h-10 shrink-0 bg-white px-4 text-sm font-semibold">
            Xem / nộp lại hồ sơ KYB →
          </Link>
        </section>
      )}

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

      {actionErr && (
        <p
          role="alert"
          className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn"
        >
          {actionErr}
        </p>
      )}
      {flash && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/25 bg-brand/6 px-4 py-3">
          <p role="status" className="text-sm font-semibold text-brand-deep">
            {flash}
          </p>
          <Link to="/map" className="text-sm font-semibold text-brand hover:underline">
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
            <p className="mt-0.5 text-sm leading-6 tabular-nums text-muted">
              Toạ độ hiện tại: {profile.latitude.toFixed(5)}, {profile.longitude.toFixed(5)} · Giờ mở cửa: {profile.operatingHours}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/map" className="btn-ghost min-h-10 px-3.5 text-sm font-semibold">
              Xem trên /map
            </Link>
            <button
              type="button"
              onClick={() => {
                setEditingProfile((v) => !v)
                setProfileErr("")
              }}
              className="btn-outline min-h-10 px-4 text-sm font-semibold"
            >
              {editingProfile ? "Đóng mô tả cơ sở" : "Sửa mô tả & liên hệ"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingSchedule((v) => !v)
                setScheduleErr("")
              }}
              className="btn-outline min-h-10 px-4 text-sm font-semibold"
            >
              {editingSchedule ? "Đóng lịch tuần" : "Lịch hoạt động tuần (R-02)"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingLocation((v) => !v)
                setPinErr("")
              }}
              className="btn-outline min-h-10 px-4 text-sm font-semibold"
            >
              {editingLocation ? "Đóng chỉnh vị trí" : "Cập nhật ghim kho bãi"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,300px)_1fr] md:items-start">
          {profile.recyclerType === "Individual" ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm leading-6 text-sky-950">
              <strong className="font-semibold">Người thu mua lưu động (Cá nhân):</strong> Hoạt động thu gom tận nơi bằng xe cá nhân, được miễn Giấy phép ĐKKD và kho bãi cố định theo Nghị định 39/2007/NĐ-CP. Đã xác thực CCCD 2 mặt nội bộ.
            </div>
          ) : (
            <FacilityPhotoCard
              facilityName={profile.facilityName}
              address={profile.businessAddress}
              photoUrl={editingProfile ? draftBusinessPhotoUrl || null : profile.businessPhotoUrl}
              photoUrls={
                editingProfile && draftBusinessPhotoUrl
                  ? [
                      draftBusinessPhotoUrl,
                      ...(profile.businessPhotoUrls ?? []).filter(
                        (u) => u !== draftBusinessPhotoUrl,
                      ),
                    ].slice(0, 5)
                  : profile.businessPhotoUrls
              }
              partnerKey={profile.recyclerId}
              variant="detail"
            />
          )}
          <div className="flex flex-col gap-1.5 text-sm leading-6 text-body">
            <p className="font-semibold text-ink">Giới thiệu &amp; quy trình tiếp nhận</p>
            <p>
              {profile.description ||
                "Chưa có mô tả chi tiết. Bạn có thể bấm Chỉnh sửa hồ sơ để bổ sung ảnh thực tế mặt tiền / kho bãi và hướng dẫn giao hàng cho người dân."}
            </p>
          </div>
        </div>

        {editingProfile && (
          <form
            noValidate
            onSubmit={(e) => void handleSaveProfileDetails(e)}
            className="flex flex-col gap-3 border-t border-line-soft pt-4"
          >
            <h3 className="text-sm font-bold text-ink">Thông tin giới thiệu &amp; Liên hệ cơ sở</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                Tên cơ sở thu mua
                <input
                  className="input min-h-11 text-base sm:text-[15px]"
                  value={draftFacilityName}
                  onChange={(e) => setDraftFacilityName(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                Người đại diện
                <input
                  className="input min-h-11 text-base sm:text-[15px]"
                  value={draftRepresentativeName}
                  onChange={(e) => setDraftRepresentativeName(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                Số điện thoại liên hệ
                <input
                  className="input min-h-11 text-base sm:text-[15px] tabular-nums"
                  value={draftContactPhone}
                  onChange={(e) => setDraftContactPhone(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                Giờ mở cửa tóm tắt
                <input
                  className="input min-h-11 text-base sm:text-[15px]"
                  placeholder="Ví dụ: 07:30 - 18:30 (T2 - T7)"
                  value={draftOperatingHours}
                  onChange={(e) => setDraftOperatingHours(e.target.value)}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Mô tả năng lực thu mua / hướng dẫn gửi hàng
              <textarea
                className="input min-h-[88px] py-2.5 text-base sm:text-[15px]"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Giới thiệu dịch vụ thu gom tận nơi, cân điện tử tại chỗ..."
              />
            </label>
            <div className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              <span>Ảnh thực tế mặt tiền / kho bãi</span>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface-2 px-4 text-sm font-semibold text-ink transition-colors hover:border-sage-line hover:bg-surface-3">
                  <Camera className="size-4 text-brand" strokeWidth={1.7} aria-hidden="true" />
                  {uploadingPhoto
                    ? "Đang tải ảnh lên..."
                    : draftBusinessPhotoUrl
                      ? "Đổi ảnh mặt tiền / kho bãi"
                      : "Tải ảnh mặt tiền / kho bãi"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingPhoto}
                    onChange={(e) => {
                      const picked = e.target.files?.[0] ?? null
                      e.currentTarget.value = ""
                      void handleSelectFacilityPhoto(picked)
                    }}
                    className="sr-only"
                  />
                </label>
                {draftBusinessPhotoUrl && (
                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={() => setDraftBusinessPhotoUrl("")}
                    className="inline-flex min-h-10 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-muted transition-colors hover:text-warn"
                  >
                    Dùng ảnh mặc định
                  </button>
                )}
              </div>
              <p className="text-sm leading-6 font-normal text-muted">
                Chấp nhận JPG, PNG hoặc WebP tối đa 5 MB. Hiển thị ngay trong chi tiết cơ sở trên Bản đồ &amp; Đối tác.
              </p>
            </div>
            {profileErr && (
              <p
                role="alert"
                className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn"
              >
                {profileErr}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={savingProfile} className="btn-primary min-h-11 px-5 text-sm font-semibold">
                {savingProfile ? "Đang lưu hồ sơ..." : "Lưu thông tin cơ sở"}
              </button>
            </div>
          </form>
        )}

        {editingSchedule && (
          <form
            noValidate
            onSubmit={(e) => void handleSaveWeeklySchedule(e)}
            className="flex flex-col gap-3 border-t border-line-soft pt-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ink">Lịch hoạt động cố định theo tuần (R-02)</h3>
              {!isKybVerified && (
                <span className="text-sm font-medium text-warn">
                  Yêu cầu hồ sơ Verified trước khi cập nhật lịch tuần.
                </span>
              )}
            </div>
            <div className="grid gap-2">
              {weeklySchedule.map((day) => (
                <div
                  key={day.dayOfWeek}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm"
                >
                  <span className="w-24 font-semibold text-ink">
                    {WEEKDAY_LABELS[day.dayOfWeek] ?? `Ngày ${day.dayOfWeek}`}
                  </span>
                  <label className="inline-flex min-h-10 items-center gap-2 text-body">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand"
                      checked={!day.isClosed}
                      onChange={(e) => {
                        const openDay = e.target.checked
                        setWeeklySchedule((prev) =>
                          prev.map((x) =>
                            x.dayOfWeek === day.dayOfWeek ? { ...x, isClosed: !openDay } : x,
                          ),
                        )
                        setScheduleErr("")
                      }}
                    />
                    <span>{day.isClosed ? "Nghỉ" : "Mở cửa"}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      disabled={day.isClosed}
                      value={day.openTime || "07:30"}
                      onChange={(e) => {
                        const v = e.target.value
                        setWeeklySchedule((prev) =>
                          prev.map((x) =>
                            x.dayOfWeek === day.dayOfWeek ? { ...x, openTime: v } : x,
                          ),
                        )
                        setScheduleErr("")
                      }}
                      className="input min-h-11 w-32 text-base sm:text-[15px] tabular-nums disabled:opacity-50"
                      aria-label={`Giờ mở cửa ${WEEKDAY_LABELS[day.dayOfWeek]}`}
                    />
                    <span className="text-muted">đến</span>
                    <input
                      type="time"
                      disabled={day.isClosed}
                      value={day.closeTime || "18:30"}
                      onChange={(e) => {
                        const v = e.target.value
                        setWeeklySchedule((prev) =>
                          prev.map((x) =>
                            x.dayOfWeek === day.dayOfWeek ? { ...x, closeTime: v } : x,
                          ),
                        )
                        setScheduleErr("")
                      }}
                      className="input min-h-11 w-32 text-base sm:text-[15px] tabular-nums disabled:opacity-50"
                      aria-label={`Giờ đóng cửa ${WEEKDAY_LABELS[day.dayOfWeek]}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            {scheduleErr && (
              <p
                role="alert"
                className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn"
              >
                {scheduleErr}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingSchedule || !isKybVerified}
                className="btn-primary min-h-11 px-5 text-sm font-semibold disabled:opacity-50"
              >
                {savingSchedule ? "Đang lưu lịch tuần..." : "Lưu lịch hoạt động tuần"}
              </button>
              <span className="text-sm leading-6 text-muted">
                Giờ mở/đóng cửa sẽ tự đồng bộ để kiểm tra hợp lệ khi người dân đặt lịch hẹn.
              </span>
            </div>
          </form>
        )}

        {editingLocation && (
          <form
            noValidate
            onSubmit={(e) => void handleSaveWarehousePin(e)}
            className="flex flex-col gap-3 border-t border-line-soft pt-4"
          >
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Địa chỉ hiển thị công khai
              <input
                className="input min-h-11 text-base sm:text-[15px]"
                value={draftAddress}
                onChange={(e) => {
                  setDraftAddress(e.target.value)
                  setPinErr("")
                }}
              />
            </label>
            <LocationPinPickerMap
              lat={draftLat}
              lng={draftLng}
              pinTitle={profile.facilityName}
              onChange={(nextLat, nextLng, hint) => {
                setDraftLat(nextLat)
                setDraftLng(nextLng)
                setPinErr("")
                if (hint) setDraftAddress(hint)
              }}
            />
            {pinErr && (
              <p
                role="alert"
                className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn"
              >
                {pinErr}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingPin}
                className="btn-primary min-h-11 px-5 text-sm font-semibold"
              >
                {savingPin ? "Đang lưu toạ độ..." : "Lưu vị trí kho bãi"}
              </button>
              <span className="text-sm leading-6 text-muted">
                Vị trí mới sẽ cập nhật ngay trên truy vấn bán kính của người dân.
              </span>
            </div>
          </form>
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
            <p className="mt-1 text-sm leading-6 text-body">
              Gói <b>PRO (1.000.000 đ / 365 ngày)</b> cấp Tích xanh thương hiệu, tắt quảng cáo và
              đẩy ghim cơ sở lên đầu kết quả tìm kiếm bản đồ khu vực (<code className="rounded bg-surface-2 px-1 py-0.5">+100 ưu tiên</code>).
              Nâng cấp từ Premium sang Pro sẽ kích hoạt Pro ngay lập tức (<code>BR-PAY-04</code>).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshRecyclerPackages()}
            className="btn-outline inline-flex min-h-10 items-center gap-1.5 px-4 text-sm font-semibold"
          >
            <RefreshCw className="size-4" />
            Đồng bộ gói
          </button>
        </div>

        {!isKybVerified && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            <ShieldAlert className="mt-1 size-4 shrink-0" />
            <span>
              <b>MSG-PAY-06:</b> Cơ sở thu mua cần hoàn tất xác minh hồ sơ KYB (<code>VerificationStatus = Verified</code>)
              trước khi mua gói Tích xanh &amp; Ghim nổi bật <b>PRO</b>.
            </span>
          </div>
        )}

        {pkgNotice && (
          <p role="status" className="rounded-xl border border-brand/30 bg-brand/8 px-4 py-2.5 text-sm font-semibold text-brand-deep">
            {pkgNotice}
          </p>
        )}
        {pkgErr && (
          <p role="alert" className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn">
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
            const pkgRank = getTierRank(pkg.packageCode, pkg.isDefaultFree, pkg.requiresVerifiedKyb)
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
                    <span className="text-xl font-bold text-ink tabular-nums">
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
                          <span
                            className={
                              proEval?.isPositiveFeedbackMet
                                ? "text-brand font-bold"
                                : "text-warn font-bold"
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Yêu cầu đang mở"
          value={String(handovers.length)}
          note="Chờ xác nhận hoặc đã nhận"
        />
        <Stat
          label="Khối lượng đã thu gom"
          value={`${txSummary.totalWeightKg.toLocaleString("vi-VN")} kg`}
          note="Biên nhận đã hoàn tất"
        />
        <Stat
          label="Tổng giá trị đã chi trả"
          value={fmtVnd(txSummary.totalAmountCash)}
          note="Biên nhận thu mua hoàn tất"
        />
        <Stat
          label="Đơn đã hoàn tất"
          value={txSummary.totalCount.toLocaleString("vi-VN")}
          note="Lịch sử giao dịch của cơ sở"
        />
      </div>

      <section className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-base font-bold text-ink">Lịch sắp tới</h2>
          <Link
            to="/recycler/requests"
            className="text-sm font-semibold text-brand hover:text-brand-deep"
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
                  <span className="block text-sm text-muted">
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

      <section className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">
              Đánh giá từ khách hàng &amp; Tiến độ gói PRO
            </h2>
            <p className="mt-0.5 text-sm leading-6 text-muted">
              Điều kiện mở khóa gói Tích xanh PRO: Hồ sơ Verified, tối thiểu 50 đánh giá và điểm trung bình từ 4.0★ trở lên.
            </p>
          </div>
          {reviewsSummary && (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-sm">
              <Star className="size-4 fill-amber-400 text-amber-500" />
              <b className="text-sm tabular-nums text-ink">
                {reviewsSummary.averageRating.toFixed(1)}
              </b>
              <span className="text-muted">({reviewsSummary.totalReviews} lượt)</span>
            </div>
          )}
        </div>

        {reviewsErr && (
          <p
            role="alert"
            className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn"
          >
            {reviewsErr}
          </p>
        )}

        {reviewsSummary ? (
          <>
            <div className="grid gap-3 rounded-xl border border-line-soft bg-surface-2/60 p-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between text-sm font-semibold text-ink">
                  <span>Số lượng đánh giá hợp lệ</span>
                  <span className="tabular-nums">
                    {Math.min(reviewsSummary.totalReviews, 50)} / 50 lượt
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{
                      width: `${Math.min(100, Math.round((reviewsSummary.totalReviews / 50) * 100))}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm font-semibold text-ink">
                  <span>Điểm hài lòng trung bình</span>
                  <span className="tabular-nums">
                    {reviewsSummary.averageRating.toFixed(1)} / 5.0 ★ (cần ≥ 4.0)
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{
                      width: `${Math.min(100, Math.round((reviewsSummary.averageRating / 5) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {reviewsSummary.reviews.items.length === 0 ? (
              <p className="text-sm leading-6 text-muted">Chưa có đánh giá nào từ người dân.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {reviewsSummary.reviews.items.map((rv) => (
                  <li key={rv.reviewId} className="flex flex-col gap-1 py-2.5 text-sm leading-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{rv.reviewerDisplayName}</span>
                      <span className="font-semibold tabular-nums text-amber-600">
                        {rv.ratingStars} ★ · {new Date(rv.createdAt).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                    <p className="text-body">{rv.comment || "Người dùng không để lại nhận xét thêm."}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm leading-6 text-muted">
            Số liệu đánh giá sao sẽ tự động hiển thị khi kết nối với hồ sơ Recycler trên hệ thống.
          </p>
        )}
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">Giao dịch thu gom đã hoàn tất</h2>
            <p className="mt-0.5 text-sm leading-6 text-muted">
              Tổng hợp các biên nhận đã được người dân xác nhận hoàn tất (GET /api/v1/recycler/transactions).
            </p>
          </div>
          <input
            type="search"
            value={txSearch}
            onChange={(e) => setTxSearch(e.target.value)}
            placeholder="Lọc mã đơn, người dân, vật liệu..."
            aria-label="Lọc giao dịch đã hoàn tất"
            className="input min-h-11 w-full sm:w-72 text-base sm:text-[15px]"
          />
        </div>
        {(() => {
          const kw = txSearch.trim().toLowerCase()
          const filteredTx = txItems.filter(
            (it) =>
              !kw ||
              `${it.receiptCode} ${it.requestCode} ${it.counterpartName} ${it.categories.join(" ")}`
                .toLowerCase()
                .includes(kw),
          )
          if (filteredTx.length === 0) {
            return (
              <p className="text-sm text-muted">
                Chưa có giao dịch thu gom hoàn tất nào khớp bộ lọc.
              </p>
            )
          }
          return (
            <Table head={["Mã biên nhận", "Người dân", "Loại phế liệu", "Khối lượng", "Giá trị", "Thời điểm"]}>
              {filteredTx.map((it) => (
                <tr key={it.receiptId || it.requestId}>
                  <Td className="font-mono text-sm font-semibold text-ink whitespace-nowrap">
                    {it.receiptCode || it.requestCode}
                  </Td>
                  <Td>{it.counterpartName}</Td>
                  <Td className="text-sm">{it.categories.join(", ") || "—"}</Td>
                  <Td className="tabular-nums whitespace-nowrap">{it.totalWeightKg} kg</Td>
                  <Td className="tabular-nums font-semibold text-brand-deep whitespace-nowrap">
                    {fmtVnd(it.totalAmountCash)}
                  </Td>
                  <Td className="tabular-nums text-sm text-muted whitespace-nowrap">
                    {new Date(it.completedAt).toLocaleString("vi-VN")}
                  </Td>
                </tr>
              ))}
            </Table>
          )
        })()}
      </section>

      <VietQrCheckoutModal
        order={activeQrOrder}
        onClose={() => setActiveQrOrder(null)}
        onOrderUpdated={handleRecyclerOrderUpdated}
      />
    </div>
  )
}
