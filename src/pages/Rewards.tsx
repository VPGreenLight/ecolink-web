import { useEffect, useMemo, useState } from "react"
import CheckIn from "@/components/CheckIn"
import SearchFilterBar from "@/components/SearchFilterBar"
import PaginationBar, { paginateItems } from "@/components/PaginationBar"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import {
  EARN,
  fmt,
  GRAND_PRIZES,
  LOW_STOCK,
  RANK_POINTS,
  REDEEMED,
  REWARDS,
  TIERS,
  getSpendPoints,
  addSpendPoints,
  tierProgress,
  type Reward,
} from "@/data/rewards"
import {
  fetchAvailableGifts,
  fetchMyRedemptions,
  fetchMyVirtualTree,
  fetchPointWallet,
  redeemGift,
  type GiftItemDto,
  type RedemptionDto,
  type VirtualTreeDto,
} from "@/lib/gamificationApi"
import { isSsrSmokeTest } from "@/lib/hydration"
import { openAuthPopup } from "@/lib/popupAuth"
import { hasLiveBackendAuth, useSession } from "@/lib/session"

const COIN = "/assets/AI/ecolink-coin.webp"

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function RewardIcon({ kind }: { kind: Reward["kind"] }) {
  const box = "size-[18px]"
  if (kind === "discount")
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={box}>
        <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a3 3 0 0 1 3 3v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16V8.5Z" {...stroke} />
        <path d="M16 10.5h5v4h-5a2 2 0 0 1 0-4Z" {...stroke} />
      </svg>
    )
  if (kind === "tree")
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={box}>
        <path d="M12 21v-6" {...stroke} />
        <path d="M12 15c0-3 2-5 5-5 0 3-2 5-5 5Zm0 0c0-3-2-5-5-5 0 3 2 5 5 5Z" {...stroke} />
        <path d="M12 10c0-2.5 1.5-4 4-4 0 2.5-1.5 4-4 4Zm0 0c0-2.5-1.5-4-4-4 0 2.5 1.5 4 4 4Z" {...stroke} />
      </svg>
    )
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={box}>
      <path d="M4 9h16v11H4z" {...stroke} />
      <path d="M4 9 6.5 4h11L20 9" {...stroke} />
      <path d="M12 4v16" {...stroke} />
    </svg>
  )
}

function resolveGiftImageFallback(name: string, type?: string): string {
  const lower = name.toLowerCase()
  if (lower.includes("voucher") || lower.includes("10%") || type === "Voucher") return "/assets/rewards/coupon10.jpg"
  if (lower.includes("kit") || lower.includes("ươm")) return "/assets/rewards/kit.jpg"
  if (lower.includes("túi") || lower.includes("canvas")) return "/assets/rewards/bag.jpg"
  if (lower.includes("hạt") || lower.includes("cây")) return "/assets/rewards/seedling.jpg"
  if (lower.includes("ly") || lower.includes("bình") || lower.includes("thủy")) return "/assets/rewards/glasses.jpg"
  if (lower.includes("nén") || lower.includes("thùng")) return "/assets/rewards/compactor.jpg"
  return "/assets/rewards/bag.jpg"
}

function Thumb({ img, name, kind }: { img?: string | null; name: string; kind: Reward["kind"] }) {
  const resolved = img || resolveGiftImageFallback(name, kind === "discount" ? "Voucher" : "Physical")
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
  }, [resolved])

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
      {!resolved || broken ? (
        <span className="grid h-full place-items-center text-body">
          <RewardIcon kind={kind} />
        </span>
      ) : (
        <img
          src={resolved}
          alt={name}
          loading="lazy"
          decoding="async"
          width={800}
          height={600}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}

function computeTierFromPoints(points: number) {
  const cur = TIERS.filter((t) => points >= t.min).at(-1) ?? TIERS[0]
  const next = TIERS.find((t) => points < t.min) ?? null
  if (!next) return { cur, next: null, pct: 100, need: 0 }
  const span = next.min - cur.min
  const done = Math.max(0, points - cur.min)
  return {
    cur,
    next,
    pct: span > 0 ? Math.min(100, Math.round((done / span) * 100)) : 100,
    need: Math.max(0, next.min - points),
  }
}

const REDEMPTION_STATUS_LABEL: Record<string, string> = {
  Pending: "Chờ giao quà",
  Redeemed: "Đã phát mã voucher",
  Delivered: "Đã hoàn tất bàn giao",
  Expired: "Hết hạn",
  Cancelled: "Đã hủy & hoàn điểm",
}

export default function Rewards() {
  const session = useSession()
  const isGuest = !session && !isSsrSmokeTest()
  const liveRewardsUser =
    hasLiveBackendAuth() &&
    (session?.role === "user" || session?.role === "recycler")

  const offlineTier = tierProgress()
  const [spend, setSpend] = useState(() => (liveRewardsUser || isGuest ? 0 : getSpendPoints()))
  const [rankPoints, setRankPoints] = useState(() => (liveRewardsUser || isGuest ? 0 : RANK_POINTS))
  const [spentTotal, setSpentTotal] = useState(() => (liveRewardsUser || isGuest ? 0 : REDEEMED))
  const [gifts, setGifts] = useState<GiftItemDto[]>([])
  const [giftSearch, setGiftSearch] = useState("")
  const debouncedGiftSearch = useDebouncedValue(giftSearch, 250)
  const [giftTypeFilter, setGiftTypeFilter] = useState("")
  const [giftSort, setGiftSort] = useState<"points_asc" | "points_desc" | "newest">("points_asc")
  const [giftPage, setGiftPage] = useState(1)
  const giftPageSize = 10

  const [redemptions, setRedemptions] = useState<RedemptionDto[]>([])
  const [redTotal, setRedTotal] = useState(0)
  const [redPage, setRedPage] = useState(1)
  const redPageSize = 10

  const [tree, setTree] = useState<VirtualTreeDto | null>(null)
  const [loading, setLoading] = useState(liveRewardsUser)
  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [addressPromptId, setAddressPromptId] = useState<string | null>(null)
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null)

  const loadLiveData = async () => {
    setLoading(true)
    try {
      const [walletRes, giftRes, redRes] = await Promise.all([
        fetchPointWallet(),
        fetchAvailableGifts({ sort: giftSort }),
        fetchMyRedemptions({ page: redPage, pageSize: redPageSize }),
      ])
      if (walletRes.data) {
        setSpend(walletRes.data.balance)
        setRankPoints(walletRes.data.totalEarned)
        setSpentTotal(walletRes.data.totalSpent)
      }
      if (giftRes.data) setGifts(giftRes.data)
      if (redRes.data?.items) {
        setRedemptions(redRes.data.items)
        setRedTotal(redRes.data.totalCount ?? redRes.data.items.length)
      }
      if (session?.role === "user") {
        fetchMyVirtualTree()
          .then((tr) => {
            if (tr.data) setTree(tr.data)
          })
          .catch(() => {})
      }
    } catch {
      // Giữ trạng thái an toàn nếu lỗi mạng tạm thời
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (liveRewardsUser) {
      void loadLiveData()
    }
  }, [liveRewardsUser, giftSort, redPage, redPageSize])

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<number>
      if (typeof custom.detail === "number") setSpend(custom.detail)
    }
    window.addEventListener("ecolink:points-change", handler)
    return () => window.removeEventListener("ecolink:points-change", handler)
  }, [])

  const { cur, next, pct, need } = liveRewardsUser
    ? computeTierFromPoints(rankPoints)
    : offlineTier

  const offlineSorted = useMemo(() => {
    const q = debouncedGiftSearch.trim().toLowerCase()
    const base = [...REWARDS].sort((a, b) =>
      giftSort === "points_desc" ? b.cost - a.cost : a.cost - b.cost,
    )
    return base.filter((r) => {
      const matchesType =
        !giftTypeFilter ||
        (giftTypeFilter === "Voucher" ? r.kind === "discount" : r.kind !== "discount")
      const matchesQuery =
        !q || r.name.toLowerCase().includes(q) || (r.desc ?? "").toLowerCase().includes(q)
      return matchesType && matchesQuery
    })
  }, [debouncedGiftSearch, giftTypeFilter, giftSort])

  const filteredLiveGifts = useMemo(() => {
    const q = debouncedGiftSearch.trim().toLowerCase()
    return gifts.filter((g) => {
      const matchesType = !giftTypeFilter || g.type === giftTypeFilter
      const matchesQuery =
        !q ||
        g.name.toLowerCase().includes(q) ||
        (g.description ?? "").toLowerCase().includes(q)
      return matchesType && matchesQuery
    })
  }, [gifts, debouncedGiftSearch, giftTypeFilter])

  const pagedLiveGifts = useMemo(
    () => paginateItems(filteredLiveGifts, giftPage, giftPageSize),
    [filteredLiveGifts, giftPage, giftPageSize],
  )
  const pagedOfflineGifts = useMemo(
    () => paginateItems(offlineSorted, giftPage, giftPageSize),
    [offlineSorted, giftPage, giftPageSize],
  )

  const handleLiveRedeem = async (gift: GiftItemDto, address?: string) => {
    if (redeemingId) return
    setRedeemingId(gift.id)
    setNotice(null)
    try {
      const res = await redeemGift({
        giftId: gift.id,
        quantity: 1,
        deliveryAddress: address?.trim() || undefined,
      })
      if (res.data) {
        setSpend(res.data.walletBalance)
        const r = res.data.redemption
        const voucherMsg = r.voucherCode
          ? ` Mã E-Voucher của bạn: ${r.voucherCode}.`
          : " Bộ phận vận hành sẽ xác nhận giao quà theo địa chỉ đã nhập."
        setNotice({
          tone: "ok",
          text: `Đổi "${gift.name}" thành công (Mã đơn ${r.redemptionCode}).${voucherMsg}`,
        })
        setAddressPromptId(null)
        setDeliveryAddress("")
        await loadLiveData()
      }
    } catch (err) {
      setNotice({
        tone: "err",
        text: err instanceof Error ? err.message : "Đổi quà thất bại.",
      })
    } finally {
      setRedeemingId(null)
    }
  }

  return (
    <div className="page flex flex-col pb-16">
      <header className="pt-10 md:pt-14">
        <h1 className="display text-[28px] leading-9 md:text-[34px] md:leading-11">
          Đổi quà bằng điểm xanh
        </h1>
        <p className="mt-2 max-w-[62ch] text-base leading-7 text-body">
          Điểm xanh cộng dồn từ những lần bạn giao rác đúng phân loại. Dùng điểm
          để đổi quà của EcoLink và các đối tác tái chế.
        </p>
      </header>

      {/* Số dư + Điểm danh */}
      <section className="mt-7 grid overflow-hidden rounded-2xl border border-line bg-surface lg:grid-cols-[1.15fr_1fr]">
        <div className="px-5 py-6 md:px-8 md:py-7">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
            Điểm tiêu dùng
          </p>
          <p className="mt-1 text-4xl leading-none font-bold tracking-tight tabular-nums text-brand md:text-5xl">
            {loading || isGuest ? "—" : fmt(spend)}
          </p>
          <p className="mt-3 text-[13px] leading-5 text-muted">
            {isGuest ? (
              <>
                Đang ở chế độ Khách (chỉ xem danh mục quà).{" "}
                <button
                  type="button"
                  onClick={() => openAuthPopup("login")}
                  className="font-semibold text-brand-deep underline underline-offset-4 hover:text-brand"
                >
                  Đăng nhập để tích điểm &amp; đổi quà
                </button>
              </>
            ) : (
              "Dùng để đổi quà bên dưới. Đổi xong mới trừ."
            )}
          </p>

          <div className="mt-6 border-t border-line-soft pt-5">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              Điểm xếp hạng
            </p>
            <p className="mt-1 text-3xl leading-none font-bold tracking-tight tabular-nums text-ink md:text-4xl">
              {loading || isGuest ? "—" : fmt(rankPoints)}
            </p>

            {isGuest ? (
              <p className="mt-3 text-sm font-medium text-muted">
                Đăng nhập tài khoản Người dân để theo dõi hạng cây ảo &amp; lịch sử đổi quà.
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm font-semibold text-ink">
                  {tree ? `Cây ảo cấp ${tree.level}: ${tree.levelTitle}` : `Hạng ${cur.name}`}
                  {!tree && next && <span className="font-normal text-muted"> → {next.name}</span>}
                  {tree && tree.nextLevelTitle && (
                    <span className="font-normal text-muted"> → {tree.nextLevelTitle}</span>
                  )}
                </p>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
                  role="progressbar"
                  aria-valuenow={tree ? tree.progressPercent : pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={next ? `Tiến độ lên hạng ${next.name}` : "Tiến độ cây ảo"}
                >
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${tree ? tree.progressPercent : pct}%` }}
                  />
                </div>
                <p className="mt-2 text-[13px] leading-5 text-muted">
                  {tree
                    ? tree.isMaxLevel
                      ? "Cây ảo đã đạt cấp tối đa"
                      : `Cần ${fmt(tree.upgradeCost ?? 0)} điểm tiêu dùng để nâng cấp tiếp`
                    : next
                      ? `Cần thêm ${fmt(need)} điểm để lên hạng ${next.name}`
                      : "Đã đạt hạng cao nhất"}
                  {" · "}
                  đã chi {fmt(spentTotal)} điểm
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center border-t border-line-soft px-5 py-6 md:px-8 md:py-7 lg:border-t-0 lg:border-l">
          <CheckIn
            balance={spend}
            onEarn={(n) => setSpend(addSpendPoints(n))}
            onSyncBalance={(b) => {
              setSpend(b)
              if (liveRewardsUser) void loadLiveData()
            }}
          />
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className={`mt-6 rounded-xl border px-4 py-3 text-sm font-semibold ${
            notice.tone === "ok"
              ? "border-brand/30 bg-brand/8 text-brand-deep"
              : "border-rose-300 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Phần quà đang mở */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
            Phần quà đang mở
          </h2>
          <p className="text-sm text-muted">
            {liveRewardsUser
              ? loading
                ? "Đang tải kho quà..."
                : `${filteredLiveGifts.length} món từ hệ thống`
              : `${offlineSorted.length} món`}
          </p>
        </div>

        <SearchFilterBar
          className="mt-4"
          label="Tìm kiếm quà tặng / E-Voucher"
          value={giftSearch}
          onChange={(v) => {
            setGiftSearch(v)
            setGiftPage(1)
          }}
          placeholder="Nhập tên quà hoặc ưu đãi..."
          totalCount={liveRewardsUser ? filteredLiveGifts.length : offlineSorted.length}
          countLabel="phần quà"
        >
          <div className="w-full md:w-[11rem]">
            <select
              className="input"
              value={giftTypeFilter}
              onChange={(e) => {
                setGiftTypeFilter(e.target.value)
                setGiftPage(1)
              }}
              aria-label="Lọc loại quà"
            >
              <option value="">Tất cả loại quà</option>
              <option value="Physical">Quà vật lý</option>
              <option value="Voucher">E-Voucher</option>
            </select>
          </div>
          <div className="w-full md:w-[11rem]">
            <select
              className="input"
              value={giftSort}
              onChange={(e) => {
                const v = e.target.value
                setGiftSort(v === "points_desc" ? "points_desc" : v === "newest" ? "newest" : "points_asc")
                setGiftPage(1)
              }}
              aria-label="Sắp xếp quà tặng"
            >
              <option value="points_asc">Điểm tăng dần</option>
              <option value="points_desc">Điểm giảm dần</option>
              <option value="newest">Mới nhất</option>
            </select>
          </div>
        </SearchFilterBar>

        {liveRewardsUser ? (
          loading && gifts.length === 0 ? (
            <p className="card mt-5 px-5 py-8 text-center text-sm text-muted">
              Đang tải danh mục quà từ máy chủ...
            </p>
          ) : filteredLiveGifts.length === 0 ? (
            <p className="card mt-5 px-5 py-8 text-center text-sm text-muted">
              Không tìm thấy phần quà phù hợp.
            </p>
          ) : (
            <>
              <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {pagedLiveGifts.map((g) => {
                const enough = spend >= g.pointsRequired
                const soldOut = !g.inStock || g.stockQuantity <= 0
                const can = enough && !soldOut && redeemingId !== g.id
                const isPhysical = g.type === "Physical"
                const showingPrompt = addressPromptId === g.id

                const stockText = soldOut
                  ? "Hết hàng"
                  : g.stockQuantity <= LOW_STOCK
                    ? `Chỉ còn ${g.stockQuantity}`
                    : `Còn ${g.stockQuantity}`

                return (
                  <li key={g.id} className="card flex flex-col overflow-hidden">
                    <div className="relative">
                      <Thumb
                        img={g.imageUrl}
                        name={g.name}
                        kind={g.type === "Voucher" ? "discount" : "gift"}
                      />
                      <span
                        className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          soldOut
                            ? "bg-surface-3 text-ink"
                            : g.stockQuantity <= LOW_STOCK
                              ? "bg-brand text-white"
                              : "bg-surface text-body"
                        }`}
                      >
                        {stockText}
                      </span>
                      <span className="absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink">
                        {g.type === "Voucher" ? "E-Voucher" : "Quà vật lý"}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      <h3 className="text-[15px] leading-6 font-bold text-ink">{g.name}</h3>
                      {g.description && (
                        <p className="mt-1 text-sm leading-6 text-body">{g.description}</p>
                      )}

                      {showingPrompt && (
                        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3">
                          <label className="text-xs font-semibold text-ink">
                            Địa chỉ nhận quà:
                            <input
                              className="input mt-1 h-9 text-xs"
                              value={deliveryAddress}
                              onChange={(e) => setDeliveryAddress(e.target.value)}
                              placeholder="Số nhà, đường, phường/xã, quận/huyện..."
                            />
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={!deliveryAddress.trim() || redeemingId === g.id}
                              onClick={() => void handleLiveRedeem(g, deliveryAddress)}
                              className="btn-primary h-9 flex-1 text-xs"
                            >
                              {redeemingId === g.id ? "Đang đổi..." : "Xác nhận đổi"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAddressPromptId(null)
                                setDeliveryAddress("")
                              }}
                              className="btn-ghost h-9 px-3 text-xs"
                            >
                              Huỷ
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                        <div>
                          <p
                            className={`text-[15px] leading-6 font-bold tabular-nums ${
                              can ? "text-brand" : "text-muted"
                            }`}
                          >
                            {fmt(g.pointsRequired)}{" "}
                            <span className="text-xs font-medium">điểm</span>
                          </p>
                          {!enough && (
                            <p className="text-xs text-muted">
                              Thiếu {fmt(g.pointsRequired - spend)} điểm
                            </p>
                          )}
                        </div>

                        {!showingPrompt && (
                          <button
                            type="button"
                            disabled={!can}
                            onClick={() => {
                              if (!can) return
                              if (isPhysical) {
                                setAddressPromptId(g.id)
                                setNotice(null)
                              } else {
                                void handleLiveRedeem(g)
                              }
                            }}
                            className="btn btn-primary h-10 min-w-[104px]"
                          >
                            {redeemingId === g.id
                              ? "Đang xử lý..."
                              : soldOut
                                ? "Hết hàng"
                                : "Đổi ngay"}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
              </ul>
              <PaginationBar
                page={giftPage}
                pageSize={giftPageSize}
                totalCount={filteredLiveGifts.length}
                onPageChange={setGiftPage}
                itemLabel="phần quà"
              />
            </>
          )
        ) : (
          <>
            <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {pagedOfflineGifts.map((r) => {
              const enough = spend >= r.cost
              const soldOut = r.stock === 0
              const can = enough && !soldOut

              const stock =
                r.stock === null
                  ? "Không giới hạn"
                  : soldOut
                    ? "Hết hàng"
                    : r.stock <= LOW_STOCK
                      ? `Chỉ còn ${r.stock}`
                      : `Còn ${r.stock}`

              return (
                <li key={r.id} className="card flex flex-col overflow-hidden">
                  <div className="relative">
                    <Thumb img={r.img} name={r.name} kind={r.kind} />
                    {r.stock !== null && (
                      <span
                        className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          soldOut
                            ? "bg-surface-3 text-ink"
                            : r.stock <= LOW_STOCK
                              ? "bg-brand text-white"
                              : "bg-surface text-body"
                        }`}
                      >
                        {stock}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <h3 className="text-[15px] leading-6 font-bold text-ink">{r.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-body">{r.desc}</p>

                    <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                      <div>
                        <p
                          className={`text-[15px] leading-6 font-bold tabular-nums ${
                            isGuest || can ? "text-brand" : "text-muted"
                          }`}
                        >
                          {fmt(r.cost)} <span className="text-xs font-medium">điểm</span>
                        </p>
                        {!isGuest && !enough && (
                          <p className="text-xs text-muted">
                            Thiếu {fmt(r.cost - spend)} điểm
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={!isGuest && !can}
                        onClick={() => {
                          if (isGuest) {
                            openAuthPopup("login")
                            return
                          }
                          if (can) setSpend(addSpendPoints(-r.cost))
                        }}
                        className="btn btn-primary h-10 min-w-[104px]"
                      >
                        {soldOut ? "Hết hàng" : isGuest ? "Đăng nhập để đổi" : "Đổi ngay"}
                      </button>
                    </div>
                  </div>
                </li>
              )
              })}
            </ul>
            <PaginationBar
              page={giftPage}
              pageSize={giftPageSize}
              totalCount={offlineSorted.length}
              onPageChange={setGiftPage}
              itemLabel="phần quà"
            />
          </>
        )}

        <p className="mt-6 max-w-[68ch] text-sm leading-6 text-muted">
          Đổi quà chỉ trừ điểm tiêu dùng, điểm xếp hạng giữ nguyên nên bạn không
          bị tụt hạng. Quà vật lý được giao theo địa chỉ nhận hàng; phiếu giảm giá
          hiển thị mã E-Voucher ngay trong mục lịch sử bên dưới.
        </p>
      </section>

      {/* Lịch sử đổi quà cá nhân khi kết nối Backend */}
      {liveRewardsUser && redemptions.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
            Quà bạn đã đổi gần đây
          </h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className="px-4 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                    Mã đơn
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                    Quà tặng
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                    Chi tiết / Mã Voucher
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                    Điểm
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {redemptions.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">
                      {r.redemptionCode}
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink">{r.gift?.name}</td>
                    <td className="px-4 py-3 text-xs text-body">
                      {r.voucherCode ? (
                        <span className="rounded bg-brand/10 px-2 py-0.5 font-mono font-bold text-brand-deep">
                          {r.voucherCode}
                        </span>
                      ) : (
                        r.deliveryAddress || "—"
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-body">
                      -{fmt(r.pointsSpent)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-brand-deep">
                      {REDEMPTION_STATUS_LABEL[r.status] ?? r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={redPage}
            pageSize={redPageSize}
            totalCount={redTotal}
            onPageChange={setRedPage}
            itemLabel="đơn đổi quà"
          />
        </section>
      )}

      {/* Giải lớn mùa này (chỉ hiển thị bản showcase ở chế độ offline hoặc tham khảo) */}
      {!liveRewardsUser && (
        <section className="relative mt-10 overflow-hidden rounded-3xl bg-surface-2 px-5 py-6 md:px-8 md:py-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-28 -right-20 size-[440px] rounded-full border border-brand/12"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-14 -right-6 size-[280px] rounded-full border border-brand/12"
          />

          <header className="relative flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="text-2xl leading-8 font-bold tracking-tight text-brand">
              Giải lớn mùa này
            </h2>
            <p className="text-sm text-muted">Điểm gấp 4 đến 13 lần quà thường</p>
          </header>
          <p className="relative mt-1.5 max-w-[62ch] text-sm leading-6 text-body">
            Dành riêng cho người giữ chuỗi điểm dài. Đổi bằng điểm tiêu dùng như
            mọi món khác, điểm xếp hạng của bạn không bị trừ.
          </p>

          <ul className="relative mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GRAND_PRIZES.map((g) => {
              const short = Math.max(g.cost - spend, 0)
              const can = short === 0
              const pctItem = can ? 100 : Math.round((spend / g.cost) * 100)
              return (
                <li
                  key={g.id}
                  className="flex flex-col rounded-2xl bg-white shadow-[0_18px_40px_-26px_rgba(15,31,21,0.38)]"
                >
                  <div className="relative">
                    <img
                      src={g.img}
                      alt={g.name}
                      loading="lazy"
                      decoding="async"
                      width={400}
                      height={300}
                      className="aspect-[4/3] w-full rounded-t-2xl object-cover"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-1/2 size-5 -translate-x-1/2 translate-y-1/2 rounded-full bg-surface-2"
                    />
                  </div>

                  <div className="flex flex-1 flex-col p-4 pt-6">
                    <h3 className="text-[15px] leading-6 font-bold text-ink">{g.name}</h3>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted">
                      {g.desc}
                    </p>
                    <div
                      className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3"
                      role="progressbar"
                      aria-valuenow={pctItem}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`h-full rounded-full ${can ? "bg-brand-deep" : "bg-brand"}`}
                        style={{ width: `${pctItem}%` }}
                      />
                    </div>
                    <p
                      className={`mt-2 text-[13px] leading-5 ${
                        can ? "font-semibold text-brand-deep" : "text-muted"
                      }`}
                    >
                      {can ? "Đủ điểm, đổi được ngay" : `Cần thêm ${fmt(short)} điểm`}
                    </p>
                    <p className="mt-auto flex items-center gap-2 pt-4">
                      <img src={COIN} alt="" width={24} height={24} className="size-6 shrink-0" />
                      <span className="text-lg leading-6 font-bold tabular-nums text-ink">
                        {fmt(g.cost)}
                      </span>
                      <span className="text-xs font-medium text-muted">điểm</span>
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
          Kiếm điểm thế nào
        </h2>
        <ol className="mt-5 grid gap-y-5 sm:grid-cols-3 sm:gap-x-8">
          {EARN.map((e, i) => (
            <li key={e.title} className="flex items-start gap-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                {i + 1}
              </span>
              <div className="pt-0.5">
                <p className="text-sm leading-5 font-semibold text-ink">{e.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-muted">{e.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
