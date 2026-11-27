import { useState, useEffect, useMemo, useRef } from "react"
import { PageHead } from "@/components/Portal"
import SearchFilterBar from "@/components/SearchFilterBar"
import PaginationBar, { FIXED_PAGE_SIZE, paginateItems } from "@/components/PaginationBar"
import { getSpendPoints, addSpendPoints, fmt } from "@/data/rewards"
import {
  careVirtualTree,
  fetchMyUnlockedEcoFacts,
  fetchMyVirtualTree,
  fetchPointWallet,
  harvestVirtualTree,
  upgradeVirtualTree,
  type EcoFactItemDto,
  type VirtualTreeDto,
} from "@/lib/gamificationApi"
import { isSsrSmokeTest } from "@/lib/hydration"
import { openAuthPopup } from "@/lib/popupAuth"
import { hasLiveBackendAuth, useSession } from "@/lib/session"
import {
  Droplet,
  Droplets,
  Sprout,
  Sparkles,
  Apple,
  Info,
  TriangleAlert,
  RotateCcw,
  X,
  Lock,
  BookOpen,
} from "lucide-react"

import {
  getDefaultFrameForStage,
  getEcoFactLevelNumbers,
  getFrameSrc,
  saveLiveTreePreview,
  stageForBackendLevel,
  STAGES,
  STORAGE_KEY,
  type TreeStage,
} from "@/lib/virtualTree"

interface TreeState {
  stage: TreeStage
  exp: number
  maxExp: number
  water: number // 0 - 100
  coins: number
  harvestReady: boolean
  fruitsCount: number
  isDead: boolean
}

function loadInitialState(liveUser: boolean): TreeState {
  const currentPoints = liveUser ? 0 : getSpendPoints()

  if (typeof window === "undefined" || liveUser) {
    return {
      stage: liveUser ? "seed" : "sprout",
      exp: liveUser ? 0 : 20,
      maxExp: liveUser ? 40 : 80,
      water: 75,
      coins: currentPoints,
      harvestReady: false,
      fruitsCount: 0,
      isDead: false,
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...parsed,
        coins: currentPoints,
      }
    }
  } catch {}

  return {
    stage: "seed",
    exp: 10,
    maxExp: 40,
    water: 80,
    coins: currentPoints,
    harvestReady: false,
    fruitsCount: 0,
    isDead: false,
  }
}

export default function EcoFactsPage() {
  const session = useSession()
  const isGuest = !session && !isSsrSmokeTest()
  const hasLiveAuth = hasLiveBackendAuth()
  const isNonCitizenLiveRole = hasLiveAuth && Boolean(session && session.role !== "user")
  const liveTreeUser = hasLiveAuth && session?.role === "user"
  const [tree, setTree] = useState<TreeState>(() => loadInitialState(hasLiveAuth || isGuest))
  const [backendTree, setBackendTree] = useState<VirtualTreeDto | null>(null)
  const [unlockedFacts, setUnlockedFacts] = useState<EcoFactItemDto[]>([])
  const [factSearch, setFactSearch] = useState("")
  const [factLevelFilter, setFactLevelFilter] = useState<number | "all">("all")
  const [factPage, setFactPage] = useState(1)
  const factPageSize = FIXED_PAGE_SIZE
  const [selectedFact, setSelectedFact] = useState<EcoFactItemDto | null>(null)
  const [upgradingOfficial, setUpgradingOfficial] = useState(false)
  const [officialMsg, setOfficialMsg] = useState("")
  const [currentFrame, setCurrentFrame] = useState<number>(() => {
    if (typeof window === "undefined") return 1
    return getDefaultFrameForStage(tree.stage)
  })
  const [floatingCoins, setFloatingCoins] = useState<{ id: number; amount: number; x: number; y: number }[]>([])
  const [isWatering, setIsWatering] = useState(false)
  const [isFertilizing, setIsFertilizing] = useState(false)
  const [isHarvesting, setIsHarvesting] = useState(false)
  const [showRewardInfo, setShowRewardInfo] = useState(false)
  const treeContainerRef = useRef<HTMLDivElement>(null)

  const applyBackendTree = (dto: VirtualTreeDto) => {
    setBackendTree(dto)
    const userKey = session?.id || session?.name || ""
    if (userKey) saveLiveTreePreview(userKey, dto)
    const visualStage = dto.harvestReady ? "fruiting" : stageForBackendLevel(dto.level)
    setTree((prev) => ({
      ...prev,
      stage: visualStage,
      water: dto.hydrationPercent,
      exp: dto.careExp,
      maxExp: dto.maxCareExp > 0 ? dto.maxCareExp : prev.maxExp,
      coins: dto.walletBalance,
      harvestReady: dto.harvestReady,
      fruitsCount: dto.harvestReady ? 5 : 0,
      isDead: dto.isWilted,
    }))
    setCurrentFrame(getDefaultFrameForStage(visualStage))
  }

  const syncOfficialTree = async () => {
    if (!liveTreeUser) return
    try {
      const [wRes, tRes, fRes] = await Promise.all([
        fetchPointWallet(),
        fetchMyVirtualTree(),
        fetchMyUnlockedEcoFacts(true),
      ])
      if (wRes.data) {
        setTree((prev) => ({ ...prev, coins: wRes.data.balance }))
      }
      if (tRes.data) {
        applyBackendTree(tRes.data)
      }
      if (fRes.data) setUnlockedFacts(fRes.data)
    } catch {
      // Giữ trạng thái cục bộ nếu mất kết nối
    }
  }

  useEffect(() => {
    if (liveTreeUser) void syncOfficialTree()
  }, [liveTreeUser])

  const handleOfficialUpgrade = async () => {
    if (isGuest) {
      openAuthPopup("login")
      return
    }
    if (!liveTreeUser || upgradingOfficial) return
    setUpgradingOfficial(true)
    setOfficialMsg("")
    try {
      const res = await upgradeVirtualTree()
      if (res.data) {
        const t = res.data.tree
        applyBackendTree(t)
        setOfficialMsg(
          res.data.unlockedFacts.length > 0
            ? `Cây đã thăng cấp ${t.level} (${t.levelTitle}) và mở ${res.data.unlockedFacts.length} Eco Fact mới!`
            : `Cây đã thăng cấp ${t.level} (${t.levelTitle})!`,
        )
        const fRes = await fetchMyUnlockedEcoFacts(true)
        if (fRes.data) setUnlockedFacts(fRes.data)
      }
    } catch (err) {
      setOfficialMsg(err instanceof Error ? err.message : "Chưa đủ điểm để nâng cấp cây.")
    } finally {
      setUpgradingOfficial(false)
    }
  }

  // Preload toàn bộ 70 frames vào bộ nhớ đệm trình duyệt để chuyển đổi mượt mà
  useEffect(() => {
    if (typeof window === "undefined") return
    for (let i = 1; i <= 70; i++) {
      const img = new Image()
      img.src = getFrameSrc(i)
    }
  }, [])

  // Lưu trạng thái cục bộ chỉ cho chế độ xem thử nghiệm (khi chưa đăng nhập tài khoản thật)
  useEffect(() => {
    if (hasLiveAuth || isGuest) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tree))
    } catch {}
  }, [tree, hasLiveAuth, isGuest])

  // Đồng bộ số dư điểm tiêu dùng khi có thay đổi từ trang Đổi Thưởng hoặc các tab khác
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<number>
      if (typeof custom.detail === "number") {
        setTree((prev) => ({ ...prev, coins: custom.detail }))
      }
    }
    window.addEventListener("ecolink:points-change", handler)
    return () => window.removeEventListener("ecolink:points-change", handler)
  }, [])

  // Chu kỳ sinh học: chỉ giảm độ ẩm theo thời gian ở chế độ mô phỏng offline
  useEffect(() => {
    if (hasLiveAuth || isGuest) return
    const timer = setInterval(() => {
      setTree((prev) => {
        if (prev.isDead) return prev
        const newWater = Math.max(0, prev.water - 1)
        if (newWater === 0 && !prev.isDead) {
          return {
            ...prev,
            water: 0,
            isDead: true,
            stage: "seed",
            exp: 0,
            maxExp: 40,
            fruitsCount: 0,
            harvestReady: false,
          }
        }
        return { ...prev, water: newWater }
      })
    }, 4500)

    return () => clearInterval(timer)
  }, [hasLiveAuth, isGuest])

  // Điều khiển animation khung hình theo giai đoạn:
  // - seed: dừng ở frame 1
  // - sprout: chạy từ frame 1 đến 15, dừng ở 15
  // - sapling: chạy từ frame 15 đến 31, dừng ở 31
  // - mature: chạy từ frame 31 đến 46, dừng ở 46
  // - flowering: chạy từ 46 đến 60, dừng ở 60
  // - fruiting: chạy từ 60 đến 70, dừng ở 70
  useEffect(() => {
    if (tree.isDead) return

    const timer = setInterval(() => {
      setCurrentFrame((curr) => {
        switch (tree.stage) {
          case "seed":
            return 1

          case "sprout":
            if (curr < 15) return curr + 1
            return 15

          case "sapling":
            if (curr < 15) return 15
            if (curr < 31) return curr + 1
            return 31

          case "mature":
            if (curr < 31) return 31
            if (curr < 46) return curr + 1
            return 46

          case "flowering":
            if (curr < 46) return 46
            if (curr < 60) return curr + 1
            return 60

          case "fruiting":
            if (curr < 60) return 60
            if (curr < 70) return curr + 1
            return 70

          default:
            return curr
        }
      })
    }, 65)

    return () => clearInterval(timer)
  }, [tree.stage, tree.isDead])

  // Trồng lại / hồi sinh cây khi cây bị khô héo
  const handleReplant = () => {
    if (isGuest) {
      openAuthPopup("login")
      return
    }
    if (liveTreeUser) {
      void handleWater()
      return
    }
    if (hasLiveAuth) {
      setOfficialMsg("Theo quy định BR-GAM-08, tính năng Cây Ảo & mở khóa Eco Fact dành riêng cho tài khoản Người dân.")
      return
    }
    setCurrentFrame(1)
    setTree((prev) => ({
      ...prev,
      stage: "seed",
      exp: 0,
      maxExp: 40,
      water: 80,
      isDead: false,
      fruitsCount: 0,
      harvestReady: false,
    }))
  }

  // Hiệu ứng rơi coin / điểm tiêu dùng
  const showFloatingCoins = (amount: number, creditLocal: boolean) => {
    const id = Date.now() + Math.random()
    const x = 40 + Math.random() * 20
    const y = 30 + Math.random() * 20
    setFloatingCoins((prev) => [...prev, { id, amount, x, y }])
    setTimeout(() => {
      setFloatingCoins((prev) => prev.filter((c) => c.id !== id))
    }, 1200)

    if (creditLocal) {
      // Điểm tiêu dùng đổi thưởng và điểm của EcoFacts là một (chế độ xem thử ngoại tuyến)
      const newBalance = addSpendPoints(amount)
      setTree((prev) => ({ ...prev, coins: newBalance }))
    }
  }

  const triggerCoinReward = (amount: number) => showFloatingCoins(amount, true)

  // Hành động 1: Tưới nước (+35% ẩm, +10 EXP; chặn khi đã bão hòa >= 95%)
  const handleWater = async () => {
    if (isGuest) {
      openAuthPopup("login")
      return
    }
    if (isNonCitizenLiveRole) {
      setOfficialMsg("Theo quy định BR-GAM-08, tính năng Cây Ảo & mở khóa Eco Fact dành riêng cho tài khoản Người dân.")
      return
    }
    if (isWatering) return
    if (liveTreeUser) {
      if (backendTree) {
        if (backendTree.dailyWaterCount >= backendTree.dailyLimit) {
          setOfficialMsg(`Bạn đã tưới cây tối đa ${backendTree.dailyLimit} lần trong ngày hôm nay.`)
          return
        }
        if (backendTree.hydrationPercent >= 95) {
          setOfficialMsg("Độ ẩm đất đang ở mức bão hòa (≥ 95%), không cần tưới thêm lúc này.")
          return
        }
      }
      setIsWatering(true)
      setOfficialMsg("")
      try {
        const res = await careVirtualTree("water")
        if (res.data) {
          applyBackendTree(res.data)
          setOfficialMsg(res.data.lastCareEffect || res.message || `Đã ghi nhận tưới nước (${res.data.dailyWaterCount}/${res.data.dailyLimit}).`)
        }
      } catch (err) {
        setOfficialMsg(err instanceof Error ? err.message : "Không thể tưới nước cho cây lúc này.")
      } finally {
        setTimeout(() => setIsWatering(false), 700)
      }
      return
    }
    if (hasLiveAuth) return

    if (!tree.isDead && tree.water >= 95) {
      setOfficialMsg("Độ ẩm đất đang ở mức bão hòa (≥ 95%), hãy bón phân hoặc đợi đất thoáng hơn rồi tưới.")
      return
    }

    setIsWatering(true)

    if (tree.isDead) {
      handleReplant()
      triggerCoinReward(3)
      setTimeout(() => setIsWatering(false), 900)
      return
    }

    setTree((prev) => {
      const newWater = Math.min(100, prev.water + 35)
      const expGain = 10
      const currentStageIdx = STAGES.findIndex((s) => s.id === prev.stage)
      const currentStageDef = STAGES[currentStageIdx]

      let newExp = prev.exp + expGain
      let newStage = prev.stage
      let newMax = prev.maxExp
      let newHarvest = prev.harvestReady
      let newFruits = prev.fruitsCount

      // Kiểm tra thăng cấp giai đoạn
      if (newExp >= currentStageDef.reqExp && currentStageIdx < STAGES.length - 1) {
        const nextStage = STAGES[currentStageIdx + 1]
        newStage = nextStage.id
        newMax = nextStage.reqExp
        newExp = 0

        if (newStage === "fruiting") {
          newHarvest = true
          newFruits = 5
        }
      }

      return {
        ...prev,
        water: newWater,
        exp: newExp,
        maxExp: newMax,
        stage: newStage,
        harvestReady: newHarvest,
        fruitsCount: newFruits,
        isDead: false,
      }
    })

    triggerCoinReward(3)
    setTimeout(() => setIsWatering(false), 900)
  }

  // Hành động 2: Bón phân hữu cơ (-10% ẩm; +35 EXP tại vùng ẩm vàng 60-90%, ngược lại +25 EXP; yêu cầu >= 30% ẩm)
  const handleFertilize = async () => {
    if (isGuest) {
      openAuthPopup("login")
      return
    }
    if (isNonCitizenLiveRole) {
      setOfficialMsg("Theo quy định BR-GAM-08, tính năng Cây Ảo & mở khóa Eco Fact dành riêng cho tài khoản Người dân.")
      return
    }
    if (isFertilizing || tree.isDead) return
    if (liveTreeUser) {
      if (backendTree) {
        if (backendTree.hydrationPercent < 30) {
          setOfficialMsg("Độ ẩm dưới 30% rất dễ xót rễ! Hãy tưới nước đạt tối thiểu 30% trước khi bón phân.")
          return
        }
        if (backendTree.harvestReady) {
          setOfficialMsg("Cây đã tích đủ EXP và sẵn sàng thu hoạch quả! Hãy hái quả trước khi bón phân tiếp.")
          return
        }
        if (backendTree.dailyFertilizeCount >= backendTree.dailyFertilizeLimit && backendTree.fertilizerPacks <= 0) {
          setOfficialMsg(`Bạn đã hết ${backendTree.dailyFertilizeLimit} lượt bón phân miễn phí hôm nay và chưa còn túi phân hữu cơ dự trữ.`)
          return
        }
      }
      setIsFertilizing(true)
      setOfficialMsg("")
      try {
        const res = await careVirtualTree("fertilize")
        if (res.data) {
          applyBackendTree(res.data)
          setOfficialMsg(res.data.lastCareEffect || res.message || `Đã ghi nhận bón phân (${res.data.dailyFertilizeCount}/${res.data.dailyFertilizeLimit}).`)
        }
      } catch (err) {
        setOfficialMsg(err instanceof Error ? err.message : "Không thể bón phân cho cây lúc này.")
      } finally {
        setTimeout(() => setIsFertilizing(false), 700)
      }
      return
    }
    if (hasLiveAuth) return

    if (tree.water < 30) {
      setOfficialMsg("Độ ẩm dưới 30% rất dễ xót rễ! Hãy tưới nước trước khi bón phân.")
      return
    }

    setIsFertilizing(true)

    setTree((prev) => {
      const expGain = prev.water >= 60 && prev.water <= 90 ? 35 : 25
      const nextWater = Math.max(0, prev.water - 10)
      const currentStageIdx = STAGES.findIndex((s) => s.id === prev.stage)
      const currentStageDef = STAGES[currentStageIdx]

      let newExp = prev.exp + expGain
      let newStage = prev.stage
      let newMax = prev.maxExp
      let newHarvest = prev.harvestReady
      let newFruits = prev.fruitsCount

      // Kiểm tra thăng cấp giai đoạn
      if (newExp >= currentStageDef.reqExp && currentStageIdx < STAGES.length - 1) {
        const nextStage = STAGES[currentStageIdx + 1]
        newStage = nextStage.id
        newMax = nextStage.reqExp
        newExp = 0

        if (newStage === "fruiting") {
          newHarvest = true
          newFruits = 5
        }
      }

      return {
        ...prev,
        water: nextWater,
        exp: newExp,
        maxExp: newMax,
        stage: newStage,
        harvestReady: newHarvest,
        fruitsCount: newFruits,
      }
    })

    triggerCoinReward(6)
    setTimeout(() => setIsFertilizing(false), 900)
  }

  // Hành động 3: Thu hoạch quả ngọt
  // Khi người dùng ấn hái quả (offline: về frame 46; live: nhận Điểm Xanh thật vào ví)
  const handleHarvest = async () => {
    if (isGuest) {
      openAuthPopup("login")
      return
    }
    if (isNonCitizenLiveRole) {
      setOfficialMsg("Theo quy định BR-GAM-08, tính năng Cây Ảo & mở khóa Eco Fact dành riêng cho tài khoản Người dân.")
      return
    }
    if (liveTreeUser) {
      if (isHarvesting) return
      if (backendTree?.isWilted) {
        setOfficialMsg("Cây đang khô héo (0% ẩm). Hãy tưới nước hồi sinh trước khi thu hoạch.")
        return
      }
      if (!backendTree?.harvestReady) {
        setOfficialMsg("Chăm sóc đủ thanh EXP để kết quả chín thu hoạch Điểm Xanh, hoặc nâng cấp Cấp cây ở bên dưới.")
        return
      }
      setIsHarvesting(true)
      setOfficialMsg("")
      try {
        const res = await harvestVirtualTree()
        if (res.data) {
          applyBackendTree(res.data.tree)
          if (res.data.pointsAwarded > 0) {
            showFloatingCoins(res.data.pointsAwarded, false)
          }
          setOfficialMsg(res.data.tree.lastCareEffect || res.message || `Thu hoạch thành công +${res.data.pointsAwarded} Điểm Xanh!`)
        }
      } catch (err) {
        setOfficialMsg(err instanceof Error ? err.message : "Không thể thu hoạch lúc này.")
      } finally {
        setIsHarvesting(false)
      }
      return
    }
    if (!tree.harvestReady || tree.fruitsCount <= 0) return

    const harvestReward = 25
    triggerCoinReward(harvestReward)

    // Cây trở về frame 46 theo yêu cầu
    setCurrentFrame(46)

    setTree((prev) => ({
      ...prev,
      harvestReady: false,
      fruitsCount: 0,
      stage: "mature", // Quay về cây trưởng thành (dừng ở frame 46) để nuôi chu kỳ mới
      exp: 0,
      maxExp: 220,
    }))
  }

  const filteredFacts = useMemo(() => {
    const q = factSearch.trim().toLowerCase()
    return unlockedFacts.filter((f) => {
      const matchesLevel = factLevelFilter === "all" || f.unlockTreeLevel === factLevelFilter
      const matchesQ =
        !q ||
        f.title.toLowerCase().includes(q) ||
        f.content.toLowerCase().includes(q) ||
        f.code.toLowerCase().includes(q)
      return matchesLevel && matchesQ
    })
  }, [unlockedFacts, factLevelFilter, factSearch])

  const pagedFacts = useMemo(
    () => paginateItems(filteredFacts, factPage, factPageSize),
    [filteredFacts, factPage, factPageSize],
  )

  const waterDisabled = Boolean(
    isWatering ||
      isNonCitizenLiveRole ||
      (liveTreeUser && backendTree && !backendTree.canWater),
  )
  const fertilizeDisabled = Boolean(
    isFertilizing ||
      isNonCitizenLiveRole ||
      tree.isDead ||
      (liveTreeUser && backendTree && !backendTree.canFertilize),
  )

  const currentStageIndex = STAGES.findIndex((s) => s.id === tree.stage)
  const currentStage = STAGES[currentStageIndex]

  return (
    <div className="page flex flex-col gap-2.5 py-2.5 sm:gap-5 sm:py-5 lg:gap-8 lg:py-8">
      <div className="hidden lg:block">
        <PageHead title="Virtual Tree · Cây Ảo EcoLink" />
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-line pb-2 lg:hidden">
        <h1 className="display text-lg leading-6 sm:text-[22px] sm:leading-7">
          Virtual Tree · Cây Ảo EcoLink
        </h1>
      </div>

      {/* KHU VỰC CHÍNH: 2 CỘT CÂN ĐỐI - CÂY ẢO BÊN TRÁI & BẢNG ĐIỀU KHIỂN BÊN PHẢI */}
      <div className="grid items-stretch gap-2.5 sm:gap-4 lg:grid-cols-2 lg:gap-6">
        {/* CỘT TRÁI: KHUNG CÂY ẢO CHIẾM TRỌN BORDER NGOÀI */}
        <div
          ref={treeContainerRef}
          className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-2xl border border-line bg-slate-100 shadow-xs sm:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[480px] lg:rounded-3xl"
        >
          {/* HÌNH ẢNH CÂY WEBP CHIẾM TOÀN BỘ KHUNG (KHUNG CỦA ẢNH LÀ BORDER NGOÀI LUÔN) */}
          <img
            src={getFrameSrc(currentFrame)}
            alt={`Cây EcoLink - Giai đoạn ${currentStage.name}`}
            className={`size-full object-cover object-bottom select-none lg:object-center ${
              tree.isDead ? "grayscale contrast-125 opacity-70" : ""
            } ${
              tree.stage === "fruiting" && tree.harvestReady ? "cursor-pointer" : ""
            }`}
            onClick={() => {
              if (tree.stage === "fruiting" && tree.harvestReady) {
                handleHarvest()
              }
            }}
            title={tree.stage === "fruiting" && tree.harvestReady ? "Bấm vào cây để thu hoạch quả" : undefined}
            draggable={false}
          />

          {/* GIAI ĐOẠN VÀ COIN NẰM TRỰC TIẾP TRÊN ẢNH CỦA TREE (z-30 cao hơn lớp phủ z-20) */}
          <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-30 flex items-center justify-between gap-2 select-none lg:inset-x-4 lg:top-4">
            <div className="flex min-w-0 max-w-[58%] items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-slate-800 shadow-2xs backdrop-blur-md lg:max-w-none lg:gap-2 lg:px-3 lg:py-1.5">
              <span className="size-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
              <span className="truncate text-[11px] font-bold lg:text-xs">
                <span className="hidden sm:inline">Giai đoạn: </span>
                {tree.isDead ? "Héo khô" : currentStage.name}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 font-bold text-amber-950 shadow-2xs backdrop-blur-md lg:px-3 lg:py-1.5">
              <img src="/assets/AI/ecolink-coin.png" alt="Coin" className="size-4 object-contain lg:size-4.5" />
              <span className="text-xs tabular-nums lg:text-sm">{tree.coins.toLocaleString("vi-VN")}</span>
              <span className="text-[11px] font-semibold text-amber-800 lg:text-xs">Coin</span>
            </div>
          </div>

          {/* Hiệu ứng tưới nước (giọt mưa rơi vector mượt mà) */}
          {isWatering && (
            <div className="absolute inset-x-0 top-12 flex justify-center gap-6 text-blue-400 drop-shadow-md animate-bounce pointer-events-none z-20">
              <Droplets className="size-7" />
              <Droplet className="size-8 mt-4" />
              <Droplet className="size-6" />
              <Droplets className="size-7 mt-2" />
            </div>
          )}

          {/* Hiệu ứng bón phân (bụi sao vector lấp lánh) */}
          {isFertilizing && (
            <div className="absolute inset-x-0 top-16 flex justify-center gap-8 text-amber-400 drop-shadow-md animate-pulse pointer-events-none z-20">
              <Sparkles className="size-7" />
              <Sprout className="size-8 text-emerald-400" />
              <Sparkles className="size-7" />
            </div>
          )}

          {/* HIỆU ỨNG RƠI ĐỒNG XU ECOLINK-COIN.PNG */}
          {floatingCoins.map((fc) => (
            <div
              key={fc.id}
              style={{ left: `${fc.x}%`, top: `${fc.y}%` }}
              className="absolute flex items-center gap-1.5 -translate-x-1/2 -translate-y-6 pointer-events-none z-30 transition-all duration-1000 ease-out animate-fade-out"
            >
              <img src="/assets/AI/ecolink-coin.png" alt="EcoLink Coin" className="size-7 object-contain drop-shadow-md animate-bounce" />
              <span className="text-base font-extrabold text-amber-800 drop-shadow-xs">+{fc.amount}</span>
            </div>
          ))}

          {/* MÀN BÁO CÂY HÉO KHÔ KHI CẠN NƯỚC (chữ đè trực tiếp lên lớp phủ, không dùng form/border) */}
          {tree.isDead && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] z-20 p-6 text-center select-none pointer-events-none">
              <TriangleAlert className="size-10 text-rose-400 drop-shadow-md mb-2 animate-pulse" />
              <p className="text-base font-bold text-white drop-shadow-md">
                Cây bị khô héo do thiếu nước
              </p>
              <p className="mt-1 text-xs text-white/80 max-w-xs drop-shadow-sm leading-relaxed">
                Độ ẩm đã giảm về 0%. Hãy bấm nút tưới nước bên phải để hồi sinh cây xanh.
              </p>
            </div>
          )}
        </div>

        {/* CỘT PHẢI: BẢNG CHỈ SỐ SINH TRƯỞNG & ĐIỀU KIỂN CHĂM SÓC */}
        <div className="flex h-full flex-col justify-between rounded-2xl border border-line bg-white p-3.5 shadow-xs sm:p-5 lg:min-h-[480px] lg:rounded-3xl lg:p-6">
          <div>
            {/* TIÊU ĐỀ KÈM ICON INFO TRÒN THAY THẾ CHO PHẦN CƠ CHẾ TẶNG */}
            <div className="flex items-center gap-2 lg:items-start lg:gap-3">
              <div className="relative -ml-1.5 shrink-0 lg:mt-0.5 lg:ml-0">
                <button
                  type="button"
                  onClick={() => setShowRewardInfo((prev) => !prev)}
                  onMouseEnter={() => {
                    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
                      setShowRewardInfo(true)
                    }
                  }}
                  className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-brand/10 hover:text-brand cursor-pointer lg:size-7"
                  title="Xem cơ chế nhận EcoLink Coin"
                  aria-label="Xem cơ chế nhận EcoLink Coin"
                  aria-expanded={showRewardInfo}
                >
                  <Info className="size-4.5" />
                </button>

                {/* Popover cơ chế nhận thưởng: Bottom Sheet trên mobile (< sm), popover nổi trên desktop */}
                {showRewardInfo && (
                  <>
                    <div
                      onClick={() => setShowRewardInfo(false)}
                      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] sm:hidden"
                      aria-hidden="true"
                    />
                    <div
                      onMouseLeave={() => {
                        if (typeof window !== "undefined" && window.innerWidth >= 1024) {
                          setShowRewardInfo(false)
                        }
                      }}
                      className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-xs leading-relaxed shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-10 sm:z-30 sm:w-72 sm:rounded-2xl sm:border sm:p-4 sm:shadow-xl lg:top-9"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-line-soft font-bold text-ink">
                        <span>Cơ chế tặng EcoLink Coin</span>
                        <button
                          type="button"
                          onClick={() => setShowRewardInfo(false)}
                          aria-label="Đóng thông tin"
                          className="grid size-9 place-items-center rounded-full border border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink cursor-pointer sm:size-7 sm:rounded-lg sm:border-0"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <div className="mt-3 flex flex-col gap-2.5 text-body">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-6 shrink-0 items-center justify-center p-0.5">
                            <img src="/assets/tree/binhtuoi_icon.png" alt="Bình tưới" className="size-full object-contain scale-110 drop-shadow-xs" />
                          </div>
                          <span>
                            Tưới nước: <b className="text-blue-900">+35% ẩm · +10 EXP</b> (tưới hồi sinh khi 0%, chặn khi ≥ 95%)
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-6 shrink-0 items-center justify-center p-0.5">
                            <img src="/assets/tree/phanbon_icon.png" alt="Phân bón" className="size-full object-contain drop-shadow-xs" />
                          </div>
                          <span>
                            Bón phân (ẩm ≥ 30%): <b className="text-emerald-900">+25 EXP</b> hoặc <b className="text-emerald-900">+35 EXP</b> ở vùng ẩm vàng 60–90% (-10% ẩm)
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                            <Apple className="size-3.5" />
                          </div>
                          <span>
                            Thu hoạch mùa vụ khi đầy EXP: nhận Điểm Xanh thật theo cấp cây, tăng thêm túi phân khi Quét AI &amp; Bàn giao rác
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 lg:block">
                <h2 className="text-sm font-bold text-ink sm:text-base lg:text-lg">
                  Chỉ số sinh tồn của cây
                </h2>
                <span className="shrink-0 text-[11px] font-semibold text-muted lg:hidden">
                  {liveTreeUser && backendTree
                    ? `Tưới ${backendTree.dailyWaterCount}/${backendTree.dailyLimit} · Bón ${backendTree.dailyFertilizeCount}/${backendTree.dailyFertilizeLimit}`
                    : isGuest
                      ? "Xem trước"
                      : "-2% ẩm/giờ"}
                </span>
                <p className="mt-0.5 hidden text-xs text-muted lg:block">
                  Độ ẩm giảm dần theo thời gian (-2%/giờ). Về 0% cây sẽ héo tạm thời cho tới khi được tưới nước hồi sinh.
                </p>
              </div>
            </div>

            {/* 2 thanh chỉ số: xếp ngang gọn 2 cột trên mobile (< lg) để nút chăm sóc nằm ngay trong tầm tay */}
            <div className="mt-2.5 grid grid-cols-2 gap-3 lg:mt-5 lg:grid-cols-1 lg:gap-4">
              {/* Thanh đo lượng nước */}
              <div className="flex flex-col gap-1 lg:gap-2">
                <div className="flex items-center justify-between gap-1 text-[11px] font-bold lg:text-xs">
                  <span className="flex items-center gap-1 text-blue-800">
                    <Droplets className="size-3.5 text-blue-600 lg:size-4" />
                    <span className="lg:hidden">Độ ẩm</span>
                    <span className="hidden lg:inline">Lượng nước duy trì:</span>
                  </span>
                  {tree.water <= 20 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 tabular-nums">
                      <TriangleAlert className="size-3 shrink-0 text-rose-500 lg:size-3.5" />
                      <span>{tree.water}%</span>
                      <span className="hidden lg:inline">(Báo động khô hạn!)</span>
                    </span>
                  ) : tree.water < 30 ? (
                    <span className="text-[11px] font-bold text-amber-700 tabular-nums">
                      {tree.water}%
                      <span className="hidden lg:inline"> (Cần tưới ≥ 30% để bón phân)</span>
                    </span>
                  ) : tree.water >= 60 && tree.water <= 90 ? (
                    <span className="text-[11px] font-bold text-sky-700 tabular-nums">
                      {tree.water}%
                      <span className="hidden lg:inline"> · Ẩm vàng x1.4 EXP</span>
                    </span>
                  ) : (
                    <span className="font-bold text-blue-950 tabular-nums">
                      {tree.water}%
                    </span>
                  )}
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full border border-slate-200/60 bg-slate-100 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      tree.water <= 20
                        ? "bg-rose-500"
                        : tree.water < 30
                          ? "bg-amber-500"
                          : tree.water >= 60 && tree.water <= 90
                            ? "bg-sky-500"
                            : "bg-blue-500"
                    }`}
                    style={{ width: `${tree.water}%` }}
                  />
                </div>
              </div>

              {/* Thanh đo EXP phát triển */}
              <div className="flex flex-col gap-1 lg:gap-2">
                <div className="flex items-center justify-between gap-1 text-[11px] font-bold lg:text-xs">
                  <span className="flex items-center gap-1 text-emerald-800">
                    <Sprout className="size-3.5 text-emerald-600 lg:size-4" />
                    <span className="lg:hidden">EXP</span>
                    <span className="hidden lg:inline">Tiến trình lớn lên:</span>
                  </span>
                  <span className="text-emerald-950 tabular-nums">
                    {tree.exp}/{tree.maxExp}
                    <span className="hidden lg:inline"> EXP</span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full border border-slate-200/60 bg-slate-100 p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, (tree.exp / tree.maxExp) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* HÀNH ĐỘNG CHĂM SÓC CÂY */}
            <div className="mt-3 flex flex-col gap-2 border-t border-line-soft pt-3 lg:mt-6 lg:gap-3 lg:pt-5">
              <div className="hidden items-center justify-between gap-2 lg:flex">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Hành động chăm sóc
                </span>
                <span className="text-[11px] font-semibold text-muted">
                  {isGuest
                    ? "Chế độ xem trước cho Khách"
                    : isNonCitizenLiveRole
                      ? "Áp dụng cho Người dân"
                      : liveTreeUser && backendTree
                        ? `Tưới: ${backendTree.dailyWaterCount}/${backendTree.dailyLimit} · Bón: ${backendTree.dailyFertilizeCount}/${backendTree.dailyFertilizeLimit}${backendTree.fertilizerPacks > 0 ? ` (+${backendTree.fertilizerPacks} túi)` : ""}`
                        : tree.isDead
                          ? "Cây đang khô héo"
                          : "Nhấn để bổ sung"}
                </span>
              </div>

              {officialMsg && (
                <p
                  role="status"
                  className="rounded-xl border border-brand/25 bg-brand/6 px-3 py-2 text-xs font-semibold text-brand-deep"
                >
                  {officialMsg}
                </p>
              )}

              {isGuest && (
                <div className="order-last flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/25 bg-brand/6 px-3 py-2 text-xs text-ink lg:order-none lg:px-3.5 lg:py-2.5">
                  <span>Đăng nhập để chăm cây, nhận Coin và mở Eco Fact.</span>
                  <button
                    type="button"
                    onClick={() => openAuthPopup("login")}
                    className="inline-flex min-h-8 items-center font-bold text-brand-deep underline underline-offset-4 hover:text-brand lg:min-h-0"
                  >
                    Đăng nhập ngay
                  </button>
                </div>
              )}

              {tree.isDead ? (
                <button
                  type="button"
                  onClick={handleReplant}
                  disabled={isWatering}
                  className="group relative flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-brand p-3 text-sm font-semibold text-white shadow-xs transition-all duration-150 hover:bg-brand-deep active:scale-[0.98] disabled:opacity-50 cursor-pointer lg:p-3.5"
                >
                  <RotateCcw className="size-4.5 transition-transform duration-300 group-hover:-rotate-90" />
                  <span>
                    {liveTreeUser
                      ? "Cây đang khô héo (0% ẩm) — Tưới nước hồi sinh ngay (+35% ẩm)"
                      : "Cây đã chết — Gieo hạt nuôi lại từ đầu"}
                  </span>
                </button>
              ) : (
                <div className="flex flex-col gap-2 lg:gap-3">
                  {liveTreeUser && backendTree?.harvestReady && (
                    <button
                      type="button"
                      onClick={() => void handleHarvest()}
                      disabled={isHarvesting}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-400 to-amber-500 p-2.5 text-sm font-bold text-amber-950 shadow-xs transition-all duration-150 hover:from-amber-500 hover:to-amber-600 active:scale-[0.98] disabled:opacity-60 cursor-pointer lg:p-3"
                    >
                      <Apple className="size-4.5 shrink-0" />
                      <span>
                        {isHarvesting
                          ? "Đang thu hoạch..."
                          : `Thu hoạch quả chín (+${backendTree.harvestRewardPreview} Điểm Xanh)`}
                      </span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => void handleWater()}
                      disabled={waterDisabled}
                      className="group relative flex min-h-14 items-center gap-1.5 rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-50/70 to-blue-100/50 px-2 py-2 text-left transition-all duration-150 hover:border-blue-300 hover:bg-blue-100/70 hover:shadow-xs active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 cursor-pointer sm:gap-3 sm:p-3"
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center p-0.5 sm:size-12">
                        <img
                          src="/assets/tree/binhtuoi_icon.png"
                          alt="Bình tưới"
                          className="size-full object-contain scale-120 drop-shadow-xs"
                        />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[13px] font-bold tracking-tight text-slate-900 sm:text-sm">Tưới nước</span>
                        <span className="text-[11px] font-medium leading-tight text-blue-700 sm:text-xs">
                          {liveTreeUser && backendTree
                            ? backendTree.hydrationPercent >= 95
                              ? "Đủ ẩm (≥95%)"
                              : backendTree.dailyWaterCount >= backendTree.dailyLimit
                                ? `Hết lượt (${backendTree.dailyWaterCount}/${backendTree.dailyLimit})`
                                : "+35% ẩm · +10 EXP"
                            : "+35% ẩm · +10 EXP"}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleFertilize()}
                      disabled={fertilizeDisabled}
                      className="group relative flex min-h-14 items-center gap-1.5 rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/70 to-emerald-100/50 px-2 py-2 text-left transition-all duration-150 hover:border-emerald-300 hover:bg-emerald-100/70 hover:shadow-xs active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 cursor-pointer sm:gap-3 sm:p-3"
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center p-0.5 sm:size-12 sm:p-1">
                        <img
                          src="/assets/tree/phanbon_icon.png"
                          alt="Phân bón"
                          className="size-full object-contain drop-shadow-xs"
                        />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[13px] font-bold tracking-tight text-slate-900 sm:text-sm">Bón phân</span>
                        <span className="text-[11px] font-medium leading-tight text-emerald-700 sm:text-xs">
                          {liveTreeUser && backendTree
                            ? backendTree.harvestReady
                              ? "Thu hoạch trước"
                              : backendTree.hydrationPercent < 30
                                ? "Cần độ ẩm ≥ 30%"
                                : backendTree.dailyFertilizeCount >= backendTree.dailyFertilizeLimit
                                  ? backendTree.fertilizerPacks > 0
                                    ? `Dùng 1 túi (còn ${backendTree.fertilizerPacks})`
                                    : "Hết lượt & túi phân"
                                  : backendTree.inOptimalHydrationZone
                                    ? "+35 EXP (Ẩm vàng)"
                                    : "+25 EXP · -10% ẩm"
                            : tree.water >= 60 && tree.water <= 90
                              ? "+35 EXP (Ẩm vàng)"
                              : "+25 EXP · -10% ẩm"}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {isNonCitizenLiveRole && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-950">
                  Theo quy tắc <span className="font-bold">BR-GAM-08</span>, Cây Ảo và phần thưởng chăm cây áp dụng riêng cho tài khoản Người dân (Citizen).
                </div>
              )}

              {liveTreeUser && backendTree && backendTree.fertilizerPacks > 0 && (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2 text-xs text-emerald-950">
                  Túi phân hữu cơ dự trữ: <span className="font-bold">{backendTree.fertilizerPacks} túi</span> — tự động dùng khi hết lượt miễn phí trong ngày (nhận thêm khi Quét rác AI hoặc Bàn giao rác).
                </div>
              )}

              {liveTreeUser && backendTree && !backendTree.canWater && !backendTree.canFertilize && !backendTree.harvestReady && !backendTree.isWilted && (
                <div className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-xs text-body">
                  {backendTree.hydrationPercent >= 95
                    ? "Đất đang bão hòa độ ẩm (≥ 95%) nên tạm khóa tưới để tránh úng rễ. "
                    : "Đã dùng hết lượt tưới và bón phân miễn phí hôm nay (có thể Quét rác AI hoặc Bàn giao rác để nhận thêm túi phân hữu cơ). "}
                  <span className="font-medium text-brand-deep">
                    Nếu đủ Điểm Xanh, bạn vẫn có thể bấm Nâng cấp cấp cây ở bên dưới.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tóm tắt giai đoạn hiện tại ở dưới cùng để cân bằng chiều cao với card trái */}
          <div
            className={`mt-4 rounded-xl p-3.5 text-xs transition-colors lg:mt-5 lg:rounded-2xl lg:p-4 ${
              tree.stage === "fruiting" && tree.harvestReady
                ? "border border-amber-300/80 bg-amber-50/90 text-amber-950 shadow-2xs"
                : "border border-line-soft bg-surface-2 text-ink"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold">
                <Sprout className="size-4 text-brand" />
                <span>Giai đoạn: {currentStage.name}</span>
              </div>
              {tree.stage === "fruiting" && tree.harvestReady && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 animate-pulse">
                  <Apple className="size-3 text-amber-800" />
                  Sẵn sàng hái quả
                </span>
              )}
            </div>
            <p
              className={`mt-1.5 leading-relaxed ${
                tree.stage === "fruiting" && tree.harvestReady
                  ? "font-medium text-amber-900"
                  : "text-muted"
              }`}
            >
              {currentStage.desc}
            </p>
          </div>
        </div>
      </div>

      {/* Đồng bộ Cây Ảo chính thức & Thư viện Eco Fact khi đã đăng nhập */}
      {liveTreeUser && (
        <section className="card flex flex-col gap-3.5 p-4 sm:p-5 lg:gap-4 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink sm:text-lg">
                {backendTree
                  ? `Cấp độ chính thức: Cấp ${backendTree.level} — ${backendTree.levelTitle}`
                  : "Đang tải tiến độ Cây Ảo..."}
              </h2>
              {backendTree && (
                <p className="mt-1 text-xs text-muted sm:text-sm">
                  Đã đầu tư {fmt(backendTree.growthPoints)} điểm · Mở{" "}
                  {backendTree.unlockedFactCount}/{backendTree.totalFactCount} Eco Fact · Tưới{" "}
                  {backendTree.dailyWaterCount}/{backendTree.dailyLimit} · Bón{" "}
                  {backendTree.dailyFertilizeCount}/{backendTree.dailyFertilizeLimit}
                  {backendTree.fertilizerPacks > 0 ? ` (+${backendTree.fertilizerPacks} túi)` : ""} · Đã thu hoạch{" "}
                  {backendTree.totalHarvested} vụ
                </p>
              )}
            </div>
            {backendTree && !backendTree.isMaxLevel && (
              <button
                type="button"
                disabled={!backendTree.canUpgrade || upgradingOfficial}
                onClick={() => void handleOfficialUpgrade()}
                className="btn-primary min-h-11 w-full px-4 text-sm sm:h-10 sm:min-h-0 sm:w-auto"
              >
                {upgradingOfficial
                  ? "Đang nâng cấp..."
                  : `Nâng lên Cấp ${backendTree.nextLevel} (-${fmt(backendTree.upgradeCost ?? 0)} điểm)`}
              </button>
            )}
          </div>

          {unlockedFacts.length > 0 && (
            <div className="flex flex-col gap-4 pt-2">
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
                  {getEcoFactLevelNumbers(backendTree?.levels, unlockedFacts).map((lv) => (
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
                  Không có Eco Fact phù hợp với bộ lọc hiện tại.
                </p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {pagedFacts.map((fact) => {
                    const unlocked = fact.isUnlocked !== false
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
                              unlocked
                                ? "bg-white text-brand-deep"
                                : "bg-surface-3 text-muted"
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
                          {fact.content}
                        </p>
                        {unlocked && (
                          <div className="mt-3 pt-2 border-t border-brand/10 flex items-center justify-between">
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
                pageSize={factPageSize}
                totalCount={filteredFacts.length}
                onPageChange={setFactPage}
                itemLabel="Eco Fact"
              />
            </div>
          )}
        </section>
      )}

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
                className="mt-3 max-h-56 w-full rounded-xl object-cover border border-line"
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
                  className="font-semibold text-brand-deep hover:underline break-all"
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
