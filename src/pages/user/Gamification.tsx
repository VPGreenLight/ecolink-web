import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import PaginationBar, { paginateItems } from "@/components/PaginationBar"
import { PageHead, Stat, Table, Td } from "@/components/Portal"
import SearchFilterBar from "@/components/SearchFilterBar"
import { GIFTS } from "@/data/ops"
import { GRAND_PRIZES, getSpendPoints, fmt } from "@/data/rewards"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import {
  fetchAvailableGifts,
  fetchMyUnlockedEcoFacts,
  fetchMyVirtualTree,
  fetchPointWallet,
  upgradeVirtualTree,
  type EcoFactItemDto,
  type GiftItemDto,
  type VirtualTreeDto,
  type WalletDto,
} from "@/lib/gamificationApi"
import { hasLiveBackendAuth } from "@/lib/session"

const BRANCHES = [
  { x: 70, y: 175, cost: 500, title: "Nhựa PET tái chế thành sợi" },
  { x: 130, y: 160, cost: 800, title: "Phân loại 3R tại Việt Nam" },
  { x: 68, y: 130, cost: 1_200, title: "Pin Li-ion gây hoạ hoả" },
  { x: 132, y: 112, cost: 1_500, title: "Màu nắp thùng rác có ý nghĩa" },
  { x: 74, y: 100, cost: 2_000, title: "Bìa carton thu gom giá 2.200đ/kg" },
  { x: 126, y: 96, cost: 3_000, title: "Thuế EPR và bài toán bao bì" },
]

const SVG_COORDS = [
  { x: 70, y: 175 },
  { x: 130, y: 160 },
  { x: 68, y: 130 },
  { x: 132, y: 112 },
  { x: 74, y: 100 },
  { x: 126, y: 96 },
]

/** U-13 Điểm danh · U-14 Đổi điểm lấy quà · U-15 Cây ảo & Eco Fact. */
export default function Gamification() {
  const [liveMode] = useState(() => hasLiveBackendAuth())
  const [wallet, setWallet] = useState<WalletDto | null>(null)
  const [tree, setTree] = useState<VirtualTreeDto | null>(null)
  const [facts, setFacts] = useState<EcoFactItemDto[]>([])
  const [gifts, setGifts] = useState<GiftItemDto[]>([])
  const [upgrading, setUpgrading] = useState(false)
  const [flash, setFlash] = useState("")
  const [factSearch, setFactSearch] = useState("")
  const debouncedFactSearch = useDebouncedValue(factSearch, 250)
  const [factPage, setFactPage] = useState(1)
  const [factPageSize, setFactPageSize] = useState(6)
  const [giftSearch, setGiftSearch] = useState("")
  const debouncedGiftSearch = useDebouncedValue(giftSearch, 250)
  const [giftPage, setGiftPage] = useState(1)
  const [giftPageSize, setGiftPageSize] = useState(8)

  const loadAll = async () => {
    try {
      const [wRes, tRes, fRes, gRes] = await Promise.all([
        fetchPointWallet(),
        fetchMyVirtualTree(),
        fetchMyUnlockedEcoFacts(true),
        fetchAvailableGifts({ sort: "points_asc" }),
      ])
      if (wRes.data) setWallet(wRes.data)
      if (tRes.data) setTree(tRes.data)
      if (fRes.data) setFacts(fRes.data)
      if (gRes.data) setGifts(gRes.data)
    } catch {
      // Giữ trạng thái hiện tại
    }
  }

  useEffect(() => {
    if (liveMode) void loadAll()
  }, [liveMode])

  const handleUpgrade = async () => {
    if (upgrading) return
    setUpgrading(true)
    setFlash("")
    try {
      const res = await upgradeVirtualTree()
      if (res.data) {
        setTree(res.data.tree)
        setFlash(
          res.data.unlockedFacts.length > 0
            ? `Cây đã lên cấp ${res.data.tree.level} (${res.data.tree.levelTitle}) và mở khoá thêm ${res.data.unlockedFacts.length} Eco Fact!`
            : `Cây đã lên cấp ${res.data.tree.level} (${res.data.tree.levelTitle})!`,
        )
        await loadAll()
      }
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Chưa đủ điều kiện nâng cấp cây.")
    } finally {
      setUpgrading(false)
    }
  }

  const spendLabel = liveMode
    ? wallet
      ? fmt(wallet.balance)
      : "—"
    : fmt(getSpendPoints())
  const rankLabel = liveMode
    ? wallet
      ? fmt(wallet.totalEarned)
      : "—"
    : "23.400"
  const stageValue = liveMode
    ? tree
      ? `Cấp ${tree.level} · ${tree.levelTitle}`
      : "—"
    : "Rừng"
  const stageNote = liveMode
    ? tree
      ? tree.isMaxLevel
        ? "Đã đạt cấp cây tối đa"
        : `Cần ${fmt(tree.upgradeCost ?? 0)} điểm lên ${tree.nextLevelTitle ?? `Cấp ${tree.nextLevel}`}`
      : "Đang tải..."
    : "Cần thêm 6.600 điểm để lên Đại dương"
  const factStatValue = liveMode
    ? tree
      ? `${tree.unlockedFactCount} / ${tree.totalFactCount}`
      : "—"
    : "2 / 6"
  const factStatNote = liveMode
    ? tree
      ? `Lượt chăm hôm nay: ${tree.dailyWaterCount}/${tree.dailyLimit}`
      : "Mở khoá qua từng cấp cây"
    : "Cần thêm 4.500 điểm cho tất cả"

  return (
    <div className="flex flex-col gap-8">
      <PageHead
        eyebrow="GAMIFICATION"
        title="Điểm xanh, quà tặng và cây ảo"
        body="Điểm xanh cộng dồn từ giao rác đúng phân loại. Dùng điểm để đổi quà, và nâng cấp cây ảo để mở khoá thêm Eco Fact."
        action={
          <Link to="/rewards" className="btn-primary h-11 shrink-0 px-5">
            Điểm danh và đổi quà
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Điểm tiêu dùng" value={spendLabel} note="Dùng để đổi quà, bấm mới trừ" />
        <Stat label="Điểm xếp hạng" value={rankLabel} note="Tích luỹ trọn đời, không bao giờ trừ" />
        <Stat label="Hạng hiện tại" value={stageValue} note={stageNote} />
        <Stat label="Eco Fact đã mở" value={factStatValue} note={factStatNote} />
      </div>

      {/* Cây ảo của bạn */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div>
            <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
              Cây ảo của bạn
            </h2>
            <p className="text-sm text-muted">
              Đầu tư điểm tiêu dùng để nâng cấp cây và mở khoá thư viện Eco Fact theo từng cột mốc.
            </p>
          </div>
          {liveMode && tree && !tree.isMaxLevel && (
            <button
              type="button"
              disabled={!tree.canUpgrade || upgrading}
              onClick={() => void handleUpgrade()}
              className="btn-primary h-10 shrink-0 px-4 text-sm"
            >
              {upgrading
                ? "Đang nâng cấp..."
                : `Tưới & Lên cấp ${tree.nextLevel} (-${fmt(tree.upgradeCost ?? 0)}đ)`}
            </button>
          )}
        </div>

        {flash && (
          <p
            role="status"
            className="border-b border-line-soft bg-brand/6 px-5 py-2.5 text-sm font-semibold text-brand-deep"
          >
            {flash}
          </p>
        )}

        <div className="grid gap-6 p-5 md:grid-cols-[260px_1fr]">
          <figure className="rounded-xl border border-line bg-surface-2 p-4">
            <svg
              viewBox="0 0 200 240"
              className="w-full"
              role="img"
              aria-label="Cây ảo EcoLink"
            >
              <path d="M100 230V120" stroke="var(--color-brand-deep)" strokeWidth="7" strokeLinecap="round" />
              {SVG_COORDS.map((pos, i) => {
                const unlockedCount = liveMode ? facts.length : 2
                const open = i < unlockedCount
                return (
                  <g key={i}>
                    <path
                      d={`M100 ${200 - i * 14}L${pos.x} ${pos.y}`}
                      stroke={open ? "var(--color-brand-deep)" : "var(--color-sage-line)"}
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="15"
                      fill={open ? "var(--color-brand)" : "var(--color-surface-3)"}
                      stroke={open ? "var(--color-brand-deep)" : "var(--color-sage-line)"}
                      strokeWidth="1.5"
                    />
                  </g>
                )
              })}
            </svg>
            <figcaption className="mt-2 text-center text-[13px] text-muted">
              {liveMode
                ? tree
                  ? `${tree.unlockedFactCount} / ${tree.totalFactCount} Eco Fact đã mở khoá`
                  : "Đang tải..."
                : `2 / ${BRANCHES.length} Eco Fact đã mở khoá`}
            </figcaption>
          </figure>

          {liveMode ? (
            <div className="flex flex-col gap-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {(tree?.levels ?? []).map((lv) => (
                  <div
                    key={lv.level}
                    className={`rounded-lg border px-3.5 py-2.5 text-sm ${lv.reached
                      ? "border-brand/30 bg-brand/6 text-ink"
                      : "border-line bg-surface text-muted"
                      }`}
                  >
                    <p className="font-bold">
                      Cấp {lv.level}: {lv.title} {lv.reached ? "✓" : ""}
                    </p>
                    <p className="text-xs">
                      {lv.level === 1
                        ? "Cấp khởi đầu"
                        : `Chi phí nâng cấp: ${fmt(lv.requiredPoints)} điểm`}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-ink">
                  Thư viện Eco Fact ({tree?.unlockedFactCount ?? facts.filter((f) => f.isUnlocked !== false).length}/{tree?.totalFactCount ?? facts.length} đã mở)
                </h3>
                <input
                  type="search"
                  value={factSearch}
                  onChange={(e) => {
                    setFactSearch(e.target.value)
                    setFactPage(1)
                  }}
                  placeholder="Tìm kiến thức Eco Fact..."
                  aria-label="Tìm Eco Fact"
                  className="input h-9 w-full max-w-xs text-xs"
                />
              </div>
              {(() => {
                const fkw = debouncedFactSearch.trim().toLowerCase()
                const filteredFacts = facts.filter(
                  (f) =>
                    !fkw ||
                    `${f.title} ${f.content} ${f.code}`.toLowerCase().includes(fkw),
                )
                const pagedFacts = paginateItems(filteredFacts, factPage, factPageSize)
                if (filteredFacts.length === 0) {
                  return (
                    <p className="text-sm text-muted">
                      Chưa có Eco Fact nào khớp tìm kiếm. Hãy nâng cấp cây để mở thêm kiến thức!
                    </p>
                  )
                }
                return (
                  <>
                    <ul className="flex flex-col gap-2">
                      {pagedFacts.map((f) => {
                        const unlocked = f.isUnlocked !== false
                        return (
                          <li
                            key={f.id}
                            className={`rounded-lg border px-4 py-3 ${
                              unlocked
                                ? "border-brand/25 bg-brand/6"
                                : "border-line bg-surface opacity-75"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-bold text-ink">{f.title}</p>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-brand-deep">
                                {unlocked ? `Mốc Cấp ${f.unlockTreeLevel} · Đã mở` : `Khóa · Mở ở Cấp ${f.unlockTreeLevel}`}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-body">
                              {unlocked ? f.content : "Nâng cấp cây ảo đến cấp tương ứng để mở khóa nội dung kiến thức chi tiết."}
                            </p>
                          </li>
                        )
                      })}
                    </ul>
                    <PaginationBar
                      page={factPage}
                      pageSize={factPageSize}
                      totalCount={filteredFacts.length}
                      onPageChange={setFactPage}
                      onPageSizeChange={setFactPageSize}
                      pageSizeOptions={[6, 12, 24]}
                      itemLabel="Eco Fact"
                    />
                  </>
                )
              })()}
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {BRANCHES.map((b, i) => (
                <li
                  key={b.cost}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${i < 2 ? "border-brand/30 bg-brand/6" : "border-line bg-surface"
                    }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${i < 2 ? "bg-brand text-white" : "bg-surface-2 text-muted"
                        }`}
                    >
                      {i < 2 ? "✓" : "·"}
                    </span>
                    <span className={`text-sm font-semibold ${i < 2 ? "text-ink" : "text-body"}`}>
                      {b.title}
                    </span>
                    <span className="text-[11px] font-semibold text-muted">
                      {i < 2 ? "Đã mở" : "Chưa mở"}
                    </span>
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums text-muted">
                    {b.cost.toLocaleString("vi-VN")} điểm
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Catalog quà */}
      <section>
        <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
          Quà đang mở
        </h2>
        <p className="mt-1 text-sm text-muted">
          Đổi bằng điểm tiêu dùng. Đổi xong mới trừ, và điểm xếp hạng giữ nguyên nên
          không bị tụt hạng.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <SearchFilterBar
            value={giftSearch}
            onChange={(v) => {
              setGiftSearch(v)
              setGiftPage(1)
            }}
            label="Tìm quà tặng"
            placeholder="Tìm theo tên quà tặng hoặc loại quà..."
          />
          {liveMode ? (
            (() => {
              const gkw = debouncedGiftSearch.trim().toLowerCase()
              const filteredGifts = gifts.filter(
                (g) =>
                  !gkw ||
                  `${g.name} ${g.type === "Voucher" ? "e-voucher" : "quà vật lý"}`
                    .toLowerCase()
                    .includes(gkw),
              )
              const pagedGifts = paginateItems(filteredGifts, giftPage, giftPageSize)
              return (
                <>
                  <Table head={["Quà tặng", "Loại", "Điểm", "Tồn kho"]}>
                    {pagedGifts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted">
                          Không tìm thấy quà tặng phù hợp.
                        </td>
                      </tr>
                    ) : (
                      pagedGifts.map((g) => (
                        <tr key={g.id}>
                          <Td className="font-semibold text-ink">{g.name}</Td>
                          <Td>{g.type === "Voucher" ? "E-Voucher" : "Quà vật lý"}</Td>
                          <Td className="tabular-nums">{fmt(g.pointsRequired)}</Td>
                          <Td>
                            {g.stockQuantity <= 0
                              ? "Hết hàng"
                              : `${fmt(g.stockQuantity)} món`}
                          </Td>
                        </tr>
                      ))
                    )}
                  </Table>
                  <PaginationBar
                    page={giftPage}
                    pageSize={giftPageSize}
                    totalCount={filteredGifts.length}
                    onPageChange={setGiftPage}
                    onPageSizeChange={setGiftPageSize}
                    pageSizeOptions={[8, 16, 32]}
                    itemLabel="quà tặng"
                  />
                </>
              )
            })()
          ) : (
            (() => {
              const gkw = debouncedGiftSearch.trim().toLowerCase()
              const offlineGifts = [
                ...GIFTS.filter((g) => g.active)
                  .sort((a, b) => a.cost - b.cost)
                  .map((g) => ({
                    id: g.id,
                    name: g.name,
                    kindLabel: g.kind === "voucher" ? "Phiếu giảm giá" : "Quà vật lý",
                    cost: g.cost,
                    stockLabel:
                      g.stock === null
                        ? "Không giới hạn"
                        : g.stock === 0
                          ? "Hết hàng"
                          : `${g.stock.toLocaleString("vi-VN")} món`,
                    isGrand: false,
                  })),
                ...GRAND_PRIZES.map((g) => ({
                  id: g.id,
                  name: g.name,
                  kindLabel: "Quà vật lý",
                  cost: g.cost,
                  stockLabel: "Giới hạn theo mùa",
                  isGrand: true,
                })),
              ].filter((g) => !gkw || `${g.name} ${g.kindLabel}`.toLowerCase().includes(gkw))
              const pagedOfflineGifts = paginateItems(offlineGifts, giftPage, giftPageSize)
              return (
                <>
                  <Table head={["Quà tặng", "Loại", "Điểm", "Tồn kho"]}>
                    {pagedOfflineGifts.map((g) => (
                      <tr key={g.id}>
                        <Td className="font-semibold text-ink">
                          {g.name}
                          {g.isGrand && (
                            <span className="ml-2 rounded-full bg-mint/30 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-brand-deep">
                              Giải lớn
                            </span>
                          )}
                        </Td>
                        <Td>{g.kindLabel}</Td>
                        <Td className="tabular-nums">{g.cost.toLocaleString("vi-VN")}</Td>
                        <Td>{g.stockLabel}</Td>
                      </tr>
                    ))}
                  </Table>
                  <PaginationBar
                    page={giftPage}
                    pageSize={giftPageSize}
                    totalCount={offlineGifts.length}
                    onPageChange={setGiftPage}
                    onPageSizeChange={setGiftPageSize}
                    pageSizeOptions={[8, 16, 32]}
                    itemLabel="quà tặng"
                  />
                </>
              )
            })()
          )}
        </div>
      </section>
    </div>
  )
}
