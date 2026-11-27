import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { BookOpen, Droplets, Lock, Sprout, TriangleAlert, X } from "lucide-react"
import PaginationBar, { FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import { PageHead, Stat } from "@/components/Portal"
import SearchFilterBar from "@/components/SearchFilterBar"
import { fmt, getSpendPoints } from "@/data/rewards"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import {
  fetchMyUnlockedEcoFacts,
  fetchMyVirtualTree,
  fetchPointWallet,
  upgradeVirtualTree,
  type EcoFactItemDto,
  type TreeLevelInfoDto,
  type VirtualTreeDto,
  type WalletDto,
} from "@/lib/gamificationApi"
import { isSsrSmokeTest } from "@/lib/hydration"
import { hasLiveBackendAuth } from "@/lib/session"
import {
  getDefaultFrameForStage,
  getEcoFactLevelNumbers,
  getFrameSrc,
  getStageName,
  stageForBackendLevel,
} from "@/lib/virtualTree"

const OFFLINE_LEVELS: TreeLevelInfoDto[] = [
  { level: 1, title: "Seedling", requiredPoints: 0, reached: true },
  { level: 2, title: "Sprout", requiredPoints: 100, reached: true },
  { level: 3, title: "Young Tree", requiredPoints: 300, reached: false },
  { level: 4, title: "Ancient Canopy", requiredPoints: 700, reached: false },
]

const OFFLINE_FACTS: EcoFactItemDto[] = [
  {
    id: "offline-ef-1",
    code: "EF-DEMO01",
    title: "Nhựa PET tái chế thành sợi áo thể thao",
    content:
      "Khoảng 10 chai nhựa PET sạch sau khi nghiền vụn và kéo sợi đủ dệt một chiếc áo thun thể thao thoáng khí.",
    unlockTreeLevel: 1,
    isUnlocked: true,
    status: "ACTIVE",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "offline-ef-2",
    code: "EF-DEMO02",
    title: "Tái chế 1 lon nhôm tiết kiệm 95% năng lượng",
    content:
      "Sản xuất lon nhôm mới từ phế liệu tái chế tiêu tốn ít hơn tới 95% điện năng so với luyện nhôm từ quặng bauxite nguyên khai.",
    unlockTreeLevel: 1,
    isUnlocked: true,
    status: "ACTIVE",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "offline-ef-3",
    code: "EF-DEMO03",
    title: "Thủy tinh có thể tái chế vô hạn lần",
    content:
      "Không giống nhựa bị suy giảm mạch polymer, thủy tinh sạch có thể nấu chảy tái chế 100% vô số lần mà vẫn giữ nguyên độ tinh khiết.",
    unlockTreeLevel: 2,
    isUnlocked: true,
    status: "ACTIVE",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "offline-ef-4",
    code: "EF-DEMO04",
    title: "Pin Li-ion cần thu gom riêng để tránh cháy nổ",
    content:
      "Nâng cấp cây ảo đến cấp tương ứng để mở khóa nội dung kiến thức chi tiết.",
    unlockTreeLevel: 3,
    isUnlocked: false,
    status: "ACTIVE",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "offline-ef-5",
    code: "EF-DEMO05",
    title: "Bìa carton khô giữ giá trị sợi giấy cao",
    content:
      "Nâng cấp cây ảo đến cấp tương ứng để mở khóa nội dung kiến thức chi tiết.",
    unlockTreeLevel: 3,
    isUnlocked: false,
    status: "ACTIVE",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "offline-ef-6",
    code: "EF-DEMO06",
    title: "Trách nhiệm mở rộng của nhà sản xuất (EPR)",
    content:
      "Nâng cấp cây ảo đến cấp tương ứng để mở khóa nội dung kiến thức chi tiết.",
    unlockTreeLevel: 4,
    isUnlocked: false,
    status: "ACTIVE",
    createdAt: "",
    updatedAt: "",
  },
]

/** U-15 · Thư viện Eco Fact & Tiến trình nâng cấp Cây ảo. */
export default function Gamification() {
  const [liveMode] = useState(() => hasLiveBackendAuth())
  const [wallet, setWallet] = useState<WalletDto | null>(null)
  const [tree, setTree] = useState<VirtualTreeDto | null>(null)
  const [facts, setFacts] = useState<EcoFactItemDto[]>([])
  const [upgrading, setUpgrading] = useState(false)
  const [flash, setFlash] = useState("")
  const [factSearch, setFactSearch] = useState("")
  const debouncedFactSearch = useDebouncedValue(factSearch, 250)
  const [factLevelFilter, setFactLevelFilter] = useState<number | "all">("all")
  const [factPage, setFactPage] = useState(1)
  const [selectedFact, setSelectedFact] = useState<EcoFactItemDto | null>(null)

  const loadAll = async () => {
    try {
      const [wRes, tRes, fRes] = await Promise.all([
        fetchPointWallet(),
        fetchMyVirtualTree(),
        fetchMyUnlockedEcoFacts(true),
      ])
      if (wRes.data) setWallet(wRes.data)
      if (tRes.data) setTree(tRes.data)
      if (fRes.data) setFacts(fRes.data)
    } catch {
      // Giữ trạng thái hiện tại
    }
  }

  useEffect(() => {
    if (isSsrSmokeTest()) return
    if (liveMode) void loadAll()
  }, [liveMode])

  useEffect(() => {
    if (!selectedFact) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedFact(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedFact])

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

  const activeFacts = liveMode ? facts : OFFLINE_FACTS
  const displayLevels = liveMode && tree?.levels?.length ? tree.levels : OFFLINE_LEVELS
  const levelNumbers = useMemo(
    () => getEcoFactLevelNumbers(liveMode ? tree?.levels : OFFLINE_LEVELS, activeFacts),
    [liveMode, tree?.levels, activeFacts],
  )

  const unlockedCount = liveMode
    ? (tree?.unlockedFactCount ??
      facts.filter(
        (f) => f.isUnlocked === true || (f.isUnlocked === undefined && tree ? f.unlockTreeLevel <= tree.level : false),
      ).length)
    : OFFLINE_FACTS.filter((f) => f.isUnlocked).length
  const totalCount = liveMode ? (tree?.totalFactCount ?? facts.length) : OFFLINE_FACTS.length
  const unlockPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0

  const spendLabel = liveMode ? (wallet ? fmt(wallet.balance) : "—") : fmt(getSpendPoints())
  const rankLabel = liveMode ? (wallet ? fmt(wallet.totalEarned) : "—") : "400"
  const stageValue = liveMode ? (tree ? `Cấp ${tree.level} · ${tree.levelTitle}` : "—") : "Cấp 2 · Sprout"
  const stageNote = liveMode
    ? tree
      ? tree.isMaxLevel
        ? "Đã đạt cấp cây tối đa"
        : `Cần ${fmt(tree.upgradeCost ?? 0)} điểm lên ${tree.nextLevelTitle ?? `Cấp ${tree.nextLevel}`}`
      : "Đang tải..."
    : "Cần 300 điểm lên Young Tree"
  const factStatValue = liveMode ? (tree ? `${tree.unlockedFactCount} / ${tree.totalFactCount}` : "—") : `${unlockedCount} / ${totalCount}`
  const factStatNote = liveMode
    ? tree
      ? `Tưới: ${tree.dailyWaterCount}/${tree.dailyLimit} · Bón phân: ${tree.dailyFertilizeCount}/${tree.dailyFertilizeLimit}${tree.fertilizerPacks > 0 ? ` (+${tree.fertilizerPacks} túi)` : ""}`
      : "Mở khoá qua từng cấp cây"
    : "Mở khoá qua từng cấp cây"

  const visualStage =
    liveMode && tree ? (tree.harvestReady ? "fruiting" : stageForBackendLevel(tree.level)) : "sprout"
  const hydrationPct = liveMode && tree ? tree.hydrationPercent : 75
  const isWilted = liveMode && tree ? tree.isWilted : false
  const careExp = liveMode && tree ? tree.careExp : 20
  const maxCareExp = liveMode && tree && tree.maxCareExp > 0 ? tree.maxCareExp : 80

  const filteredFacts = useMemo(() => {
    const fkw = debouncedFactSearch.trim().toLowerCase()
    return activeFacts.filter((f) => {
      const matchesLevel = factLevelFilter === "all" || f.unlockTreeLevel === factLevelFilter
      const matchesQuery = !fkw || `${f.title} ${f.content} ${f.code}`.toLowerCase().includes(fkw)
      return matchesLevel && matchesQuery
    })
  }, [activeFacts, factLevelFilter, debouncedFactSearch])

  const pagedFacts = useMemo(
    () => paginateItems(filteredFacts, factPage, FIXED_PAGE_SIZE),
    [filteredFacts, factPage],
  )

  return (
    <div className="page flex flex-col gap-6 py-6 sm:gap-8 lg:py-8">
      <PageHead
        eyebrow="ECO FACT"
        title="Thư viện kiến thức Eco Fact"
        body="Nâng cấp Cây ảo bằng Điểm Xanh để mở khóa các cột mốc kiến thức phân loại và tái chế bền vững."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Điểm tiêu dùng" value={spendLabel} note="Dùng để đổi quà, bấm mới trừ" />
        <Stat label="Điểm xếp hạng" value={rankLabel} note="Tích luỹ trọn đời, không bao giờ trừ" />
        <Stat label="Hạng hiện tại" value={stageValue} note={stageNote} />
        <Stat label="Eco Fact đã mở" value={factStatValue} note={factStatNote} />
      </div>

      {/* Tầng 1: Tiến trình Cây Ảo & Các mốc Cấp độ */}
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
              className="btn-primary min-h-11 w-full shrink-0 px-4 text-sm sm:h-10 sm:min-h-0 sm:w-auto"
            >
              {upgrading
                ? "Đang nâng cấp..."
                : `Nâng lên Cấp ${tree.nextLevel} (-${fmt(tree.upgradeCost ?? 0)} điểm)`}
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

        <div className="grid items-stretch gap-5 p-4 sm:p-5 lg:grid-cols-[260px_1fr] lg:gap-6">
          <Link
            to="/ecofacts"
            aria-label="Mở trang Cây ảo EcoLink để tưới nước và bón phân"
            className="group relative flex aspect-[4/3] w-full flex-col justify-between overflow-hidden rounded-2xl border border-line bg-slate-100 shadow-2xs transition-shadow hover:shadow-md lg:aspect-auto lg:min-h-[220px]"
          >
            <img
              src={getFrameSrc(getDefaultFrameForStage(visualStage))}
              alt={`Cây ảo EcoLink - ${isWilted ? "Héo khô" : getStageName(visualStage)}`}
              className={`absolute inset-0 size-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03] ${
                isWilted ? "grayscale contrast-125 opacity-75" : ""
              }`}
            />

            <div className="relative z-10 flex items-center justify-between gap-2 p-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-2xs backdrop-blur-md">
                {isWilted ? (
                  <TriangleAlert className="size-3 text-rose-600" />
                ) : (
                  <span className="size-2 rounded-full bg-emerald-500" />
                )}
                {isWilted ? "Héo khô" : getStageName(visualStage)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold tabular-nums text-sky-800 shadow-2xs backdrop-blur-md">
                <Droplets className="size-3 text-sky-600" />
                Ẩm {hydrationPct}%
              </span>
            </div>

            <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t border-white/50 bg-white/90 px-3 py-2 text-xs backdrop-blur-md">
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-ink">
                <Sprout className="size-3.5 text-brand" />
                EXP vụ này: {careExp}/{maxCareExp}
              </span>
              <span className="font-bold text-brand-deep group-hover:underline">
                Chăm cây →
              </span>
            </div>
          </Link>

          <div className="flex flex-col justify-between gap-4">
            <div className="rounded-xl border border-line-soft bg-surface-2 p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-ink">Tiến trình mở khóa Eco Fact</span>
                <span className="font-bold tabular-nums text-brand-deep">
                  Đã mở {unlockedCount}/{totalCount} bài ({unlockPct}%)
                </span>
              </div>
              <div
                className="mt-2 h-2.5 w-full overflow-hidden rounded-full border border-slate-200/70 bg-white p-0.5"
                role="progressbar"
                aria-valuenow={unlockPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Tiến trình mở khóa Eco Fact"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-500 transition-all duration-500"
                  style={{ width: `${unlockPct}%` }}
                />
              </div>
              {liveMode && tree && (
                <p className="mt-2 text-xs text-muted">
                  Đã đầu tư <span className="font-semibold text-ink">{fmt(tree.growthPoints)} điểm</span>{" "}
                  · Đã thu hoạch <span className="font-semibold text-ink">{tree.totalHarvested} vụ</span>
                </p>
              )}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {displayLevels.map((lv) => {
                const factCountAtLevel = activeFacts.filter((f) => f.unlockTreeLevel === lv.level).length
                const isNext = liveMode && tree ? lv.level === tree.nextLevel : lv.level === 3
                return (
                  <div
                    key={lv.level}
                    className={`flex flex-col justify-between rounded-xl border px-3.5 py-3 text-sm ${
                      lv.reached
                        ? "border-brand/30 bg-brand/6 text-ink"
                        : isNext
                          ? "border-brand/40 bg-white text-ink shadow-2xs"
                          : "border-line bg-surface text-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold">
                        Cấp {lv.level}: {lv.title}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          lv.reached
                            ? "bg-white text-brand-deep"
                            : isNext
                              ? "bg-brand/10 text-brand-deep"
                              : "bg-surface-2 text-muted"
                        }`}
                      >
                        {lv.reached ? "Đã đạt ✓" : isNext ? "Cấp kế tiếp" : "Chưa mở"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                      <span>
                        {lv.level === 1 ? "Cấp khởi đầu" : `Chi phí: ${fmt(lv.requiredPoints)} điểm`}
                      </span>
                      {factCountAtLevel > 0 && (
                        <span className="font-medium text-muted">
                          {factCountAtLevel} Eco Fact
                        </span>
                      )}
                    </div>
                    {isNext && liveMode && tree && (
                      <div className="mt-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                          <div
                            className="h-full rounded-full bg-brand transition-all duration-300"
                            style={{ width: `${tree.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Tầng 2: Thư viện Eco Fact toàn chiều ngang (đồng bộ thiết kế với /ecofacts) */}
      <section className="card flex flex-col gap-4 p-4 sm:p-5 lg:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-ink sm:text-lg">
              Thư viện Eco Fact ({unlockedCount}/{totalCount} đã mở)
            </h2>
            <p className="mt-0.5 text-xs text-muted sm:text-sm">
              Lọc theo cấp độ cây hoặc tìm nhanh theo từ khóa, mã kiến thức.
            </p>
          </div>
          <Link to="/rewards" className="text-xs font-semibold text-brand-deep hover:underline">
            Điểm danh &amp; đổi quà →
          </Link>
        </div>

        <SearchFilterBar
          label="Tìm kiếm kiến thức Eco Fact"
          value={factSearch}
          onChange={(v) => {
            setFactSearch(v)
            setFactPage(1)
          }}
          placeholder="Tìm tiêu đề, mã EF-... hoặc nội dung..."
          totalCount={filteredFacts.length}
          countLabel="bài kiến thức"
        >
          <div className="no-scrollbar -mx-1 flex w-full items-center gap-1.5 overflow-x-auto px-1 py-0.5 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0">
            <button
              type="button"
              onClick={() => {
                setFactLevelFilter("all")
                setFactPage(1)
              }}
              className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold whitespace-nowrap sm:h-8 sm:px-3 ${
                factLevelFilter === "all"
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-body hover:bg-surface-2"
              }`}
            >
              Tất cả cấp
            </button>
            {levelNumbers.map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => {
                  setFactLevelFilter(lv)
                  setFactPage(1)
                }}
                className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold whitespace-nowrap sm:h-8 sm:px-3 ${
                  factLevelFilter === lv
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-white text-body hover:bg-surface-2"
                }`}
              >
                Cấp {lv}
              </button>
            ))}
          </div>
        </SearchFilterBar>

        {pagedFacts.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
            Chưa có Eco Fact nào khớp bộ lọc. Hãy nâng cấp Cây ảo để mở thêm kiến thức!
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {pagedFacts.map((fact) => {
              const unlocked =
                fact.isUnlocked === true ||
                (fact.isUnlocked === undefined && (tree ? fact.unlockTreeLevel <= tree.level : false))
              return (
                <li
                  key={fact.id}
                  className={`flex flex-col rounded-2xl border p-4 transition-colors ${
                    unlocked
                      ? "border-brand/20 bg-brand/5"
                      : "border-line bg-surface-2/70 opacity-85"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-brand">
                      {fact.code}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        unlocked ? "bg-white text-brand-deep" : "bg-surface-3 text-muted"
                      }`}
                    >
                      {!unlocked && <Lock className="size-3" />}
                      {unlocked
                        ? `Mốc Cấp ${fact.unlockTreeLevel}`
                        : `Khóa · Cần Cấp ${fact.unlockTreeLevel}`}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-bold text-ink">{fact.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-body">
                    {unlocked
                      ? fact.content
                      : "Nâng cấp cây ảo đến cấp tương ứng để mở khóa nội dung kiến thức chi tiết."}
                  </p>
                  {unlocked && (
                    <div className="mt-3 flex items-center justify-between border-t border-brand/10 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedFact(fact)}
                        className="inline-flex min-h-9 items-center gap-1.5 py-1 text-xs font-semibold text-brand-deep hover:underline lg:min-h-0 lg:py-0"
                      >
                        <BookOpen className="size-3.5" />
                        Đọc chi tiết
                      </button>
                      {fact.sourceUrl && (
                        <a
                          href={fact.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 items-center py-1 text-[11px] font-medium text-muted hover:text-brand lg:min-h-0 lg:py-0"
                        >
                          Nguồn ↗
                        </a>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <PaginationBar
          page={factPage}
          pageSize={FIXED_PAGE_SIZE}
          totalCount={filteredFacts.length}
          onPageChange={setFactPage}
          itemLabel="Eco Fact"
        />
      </section>

      {selectedFact && (
        <div
          onClick={() => setSelectedFact(null)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={selectedFact.title}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card relative max-h-[86dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl rounded-b-none bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6"
          >
            <button
              type="button"
              onClick={() => setSelectedFact(null)}
              aria-label="Đóng chi tiết Eco Fact"
              className="absolute top-3.5 right-3.5 grid size-10 place-items-center rounded-full border border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink sm:top-4 sm:right-4 sm:size-8 sm:rounded-lg sm:border-0"
            >
              <X className="size-4" />
            </button>
            <div className="flex flex-wrap items-center gap-2 pr-8">
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 font-mono text-xs font-bold text-brand-deep">
                {selectedFact.code}
              </span>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink">
                Mốc Cấp {selectedFact.unlockTreeLevel}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-bold text-ink">{selectedFact.title}</h3>
            {selectedFact.imageUrl && (
              <img
                src={selectedFact.imageUrl}
                alt={selectedFact.title}
                className="mt-3 max-h-56 w-full rounded-xl border border-line object-cover"
              />
            )}
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-body">
              {selectedFact.content}
            </p>
            {selectedFact.sourceUrl && (
              <p className="mt-4 border-t border-line-soft pt-3 text-xs text-muted">
                Nguồn tham khảo:{" "}
                <a
                  href={selectedFact.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-semibold text-brand-deep hover:underline"
                >
                  {selectedFact.sourceUrl} ↗
                </a>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
