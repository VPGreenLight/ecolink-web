import { useState, useEffect, useRef } from "react"
import { PageHead } from "@/components/Portal"
import { getSpendPoints, addSpendPoints } from "@/data/rewards"
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
} from "lucide-react"

type TreeStage = "seed" | "sprout" | "sapling" | "mature" | "flowering" | "fruiting"

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

const STAGES: { id: TreeStage; name: string; reqExp: number; desc: string }[] = [
  { id: "seed", name: "Hạt mầm", reqExp: 40, desc: "Hạt mầm vừa gieo xuống lớp đất ẩm, cần tưới nước đều đặn." },
  { id: "sprout", name: "Chồi non", reqExp: 80, desc: "Chồi non vươn lên đón nắng, bắt đầu cần dinh dưỡng hữu cơ." },
  { id: "sapling", name: "Cây con", reqExp: 140, desc: "Thân cây cứng cáp dần, đâm chồi nảy lộc và tỏa bóng mát." },
  { id: "mature", name: "Cây trưởng thành", reqExp: 220, desc: "Cây xanh cổ thụ vững chãi, hấp thụ khí CO2 mỗi ngày." },
  { id: "flowering", name: "Ra hoa", reqExp: 300, desc: "Những đóa hoa nở rộ báo hiệu mùa quả ngọt sắp đến." },
  { id: "fruiting", name: "Kết quả ngọt", reqExp: 380, desc: "Cây trĩu quả tái chế! Thu hoạch để nhận thật nhiều EcoLink Coin." },
]

const STORAGE_KEY = "ecolink:virtual-tree-v1"

function getDefaultFrameForStage(stage: TreeStage): number {
  switch (stage) {
    case "seed":
      return 1
    case "sprout":
      return 15
    case "sapling":
      return 31
    case "mature":
      return 46
    case "flowering":
      return 60
    case "fruiting":
      return 70
    default:
      return 1
  }
}

function getFrameSrc(frame: number): string {
  const safeFrame = Math.max(1, Math.min(70, Math.floor(frame)))
  return `/assets/tree/tree_frame_${String(safeFrame).padStart(3, "0")}.webp`
}

function loadInitialState(): TreeState {
  const currentPoints = getSpendPoints()

  if (typeof window === "undefined") {
    return {
      stage: "sprout",
      exp: 20,
      maxExp: 80,
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
  const [tree, setTree] = useState<TreeState>(loadInitialState)
  const [currentFrame, setCurrentFrame] = useState<number>(() => {
    if (typeof window === "undefined") return 1
    return getDefaultFrameForStage(tree.stage)
  })
  const [floatingCoins, setFloatingCoins] = useState<{ id: number; amount: number; x: number; y: number }[]>([])
  const [isWatering, setIsWatering] = useState(false)
  const [isFertilizing, setIsFertilizing] = useState(false)
  const [showRewardInfo, setShowRewardInfo] = useState(false)
  const treeContainerRef = useRef<HTMLDivElement>(null)

  // Preload toàn bộ 70 frames vào bộ nhớ đệm trình duyệt để chuyển đổi mượt mà
  useEffect(() => {
    if (typeof window === "undefined") return
    for (let i = 1; i <= 70; i++) {
      const img = new Image()
      img.src = getFrameSrc(i)
    }
  }, [])

  // Lưu trạng thái vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tree))
    } catch {}
  }, [tree])

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

  // Chu kỳ sinh học: lượng nước giảm tự nhiên theo thời gian
  useEffect(() => {
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
    }, 4500) // Giảm 1% nước mỗi 4.5 giây để tăng tính tương tác

    return () => clearInterval(timer)
  }, [])

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

  // Trồng lại cây mới khi cây bị khô héo
  const handleReplant = () => {
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
  const triggerCoinReward = (amount: number) => {
    const id = Date.now() + Math.random()
    const x = 40 + Math.random() * 20
    const y = 30 + Math.random() * 20
    setFloatingCoins((prev) => [...prev, { id, amount, x, y }])
    setTimeout(() => {
      setFloatingCoins((prev) => prev.filter((c) => c.id !== id))
    }, 1200)

    // Điểm tiêu dùng đổi thưởng và điểm của EcoFacts là một
    const newBalance = addSpendPoints(amount)
    setTree((prev) => ({ ...prev, coins: newBalance }))
  }

  // Hành động 1: Tưới nước
  const handleWater = () => {
    if (isWatering) return
    setIsWatering(true)

    if (tree.isDead) {
      handleReplant()
      triggerCoinReward(3)
      setTimeout(() => setIsWatering(false), 900)
      return
    }

    setTree((prev) => {
      const newWater = Math.min(100, prev.water + 30)
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

  // Hành động 2: Bón phân hữu cơ
  const handleFertilize = () => {
    if (isFertilizing) return
    if (tree.isDead) return

    setIsFertilizing(true)

    setTree((prev) => {
      const expGain = 25
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
  // Khi người dùng ấn hái quả: cây trở về frame 46
  const handleHarvest = () => {
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

  const currentStageIndex = STAGES.findIndex((s) => s.id === tree.stage)
  const currentStage = STAGES[currentStageIndex]

  return (
    <div className="page flex flex-col gap-8 py-8">
      <PageHead title="Virtual Tree · Cây Ảo EcoLink" />

      {/* KHU VỰC CHÍNH: 2 CỘT CÂN ĐỐI - CÂY ẢO BÊN TRÁI & BẢNG ĐIỀU KHIỂN BÊN PHẢI */}
      <div className="grid gap-6 lg:grid-cols-2 items-stretch">
        {/* CỘT TRÁI: KHUNG CÂY ẢO CHIẾM TRỌN BORDER NGOÀI */}
        <div
          ref={treeContainerRef}
          className="relative flex h-full min-h-[480px] w-full items-center justify-center overflow-hidden rounded-3xl border border-line shadow-xs bg-slate-100"
        >
          {/* HÌNH ẢNH CÂY WEBP CHIẾM TOÀN BỘ KHUNG (KHUNG CỦA ẢNH LÀ BORDER NGOÀI LUÔN) */}
          <img
            src={getFrameSrc(currentFrame)}
            alt={`Cây EcoLink - Giai đoạn ${currentStage.name}`}
            className={`size-full object-cover select-none ${
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
          <div className="absolute top-4 inset-x-4 flex items-center justify-between z-30 pointer-events-none select-none">
            <div className="flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 backdrop-blur-md shadow-2xs text-slate-800">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold">
                Giai đoạn: {tree.isDead ? "Héo khô" : currentStage.name}
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 backdrop-blur-md shadow-2xs font-bold text-amber-950">
              <img src="/assets/AI/ecolink-coin.png" alt="Coin" className="size-4.5 object-contain" />
              <span className="text-sm tabular-nums">{tree.coins.toLocaleString("vi-VN")}</span>
              <span className="text-xs font-semibold text-amber-800">Coin</span>
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

        {/* CỘT PHẢI: BẢNG CHỈ SỐ SINH TRƯỞNG & ĐIỀU KIỆN SỐNG CÂN ĐỐI */}
        <div className="flex h-full flex-col justify-between rounded-3xl border border-line bg-white p-6 shadow-xs min-h-[480px]">
          <div>
            {/* TIÊU ĐỀ KÈM ICON INFO TRÒN THAY THẾ CHO PHẦN CƠ CHẾ TẶNG */}
            <div className="flex items-start gap-3">
              <div className="relative shrink-0 mt-0.5">
                <button
                  type="button"
                  onClick={() => setShowRewardInfo((prev) => !prev)}
                  onMouseEnter={() => setShowRewardInfo(true)}
                  className="flex size-7 items-center justify-center rounded-full text-muted hover:text-brand hover:bg-brand/10 transition-colors cursor-pointer"
                  title="Xem cơ chế nhận EcoLink Coin"
                  aria-label="Xem cơ chế nhận EcoLink Coin"
                >
                  <Info className="size-4.5" />
                </button>

                {/* Popover cơ chế nhận thưởng */}
                {showRewardInfo && (
                  <div
                    onMouseLeave={() => setShowRewardInfo(false)}
                    className="absolute left-0 top-9 z-30 w-72 rounded-2xl border border-line bg-white p-4 shadow-xl text-xs leading-relaxed animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-line-soft font-bold text-ink">
                      <span>Cơ chế tặng EcoLink Coin</span>
                      <button
                        type="button"
                        onClick={() => setShowRewardInfo(false)}
                        className="text-muted hover:text-ink text-sm font-bold cursor-pointer"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-col gap-2.5 text-body">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-6 shrink-0 items-center justify-center p-0.5">
                          <img src="/assets/tree/binhtuoi_icon.png" alt="Bình tưới" className="size-full object-contain scale-110 drop-shadow-xs" />
                        </div>
                        <span>Tưới nước bổ sung độ ẩm: <b className="text-blue-900">+3 Coin</b></span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-6 shrink-0 items-center justify-center p-0.5">
                          <img src="/assets/tree/phanbon_icon.png" alt="Phân bón" className="size-full object-contain drop-shadow-xs" />
                        </div>
                        <span>Bón phân kích thích lớn nhanh: <b className="text-emerald-900">+6 Coin</b></span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                          <Apple className="size-3.5" />
                        </div>
                        <span>Thu hoạch quả chín mùa vụ: <b className="text-amber-900">+25 Coin</b></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-lg font-bold text-ink">Chỉ số sinh tồn của cây</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Cây cần đủ độ ẩm để sống. Nếu nước về 0%, cây sẽ héo khô và ngừng tăng trưởng.
                </p>
              </div>
            </div>

            {/* Thanh đo lượng nước */}
            <div className="mt-5 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-1.5 text-blue-800">
                  <Droplets className="size-4 text-blue-600" />
                  <span>Lượng nước duy trì:</span>
                </span>
                {tree.water <= 20 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                    <TriangleAlert className="size-3.5 text-rose-500 shrink-0" />
                    <span>{tree.water}% (Báo động khô hạn!)</span>
                  </span>
                ) : (
                  <span className="text-blue-950 font-bold tabular-nums">
                    {tree.water}%
                  </span>
                )}
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200/60">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    tree.water <= 20 ? "bg-rose-500" : tree.water <= 50 ? "bg-amber-400" : "bg-blue-500"
                  }`}
                  style={{ width: `${tree.water}%` }}
                />
              </div>
            </div>

            {/* Thanh đo EXP phát triển */}
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-800">
                  <Sprout className="size-4 text-emerald-600" />
                  <span>Tiến trình lớn lên:</span>
                </span>
                <span className="text-emerald-950 tabular-nums">
                  {tree.exp} / {tree.maxExp} EXP
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (tree.exp / tree.maxExp) * 100)}%` }}
                />
              </div>
            </div>

            {/* HÀNH ĐỘNG CHĂM SÓC CÂY SANG BÊN PHẢI THEO THIẾT KẾ MỚI */}
            <div className="mt-6 flex flex-col gap-3 pt-5 border-t border-line-soft">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Hành động chăm sóc
                </span>
                <span className="text-[11px] text-muted">
                  {tree.isDead ? "Cây đang khô héo" : "Nhấn để bổ sung"}
                </span>
              </div>

              {tree.isDead ? (
                <button
                  type="button"
                  onClick={handleReplant}
                  className="group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand hover:bg-brand-deep p-3.5 text-sm font-semibold text-white shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer"
                >
                  <RotateCcw className="size-4.5 transition-transform duration-300 group-hover:-rotate-90" />
                  <span>Cây đã chết — Gieo hạt nuôi lại từ đầu</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleWater}
                    disabled={isWatering}
                    className="group relative flex items-center gap-3 rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-50/70 to-blue-100/50 p-3 text-left transition-all duration-150 hover:border-blue-300 hover:bg-blue-100/70 hover:shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    <div className="flex size-12 shrink-0 items-center justify-center p-0.5">
                      <img
                        src="/assets/tree/binhtuoi_icon.png"
                        alt="Bình tưới"
                        className="size-full object-contain scale-120 drop-shadow-xs"
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-bold text-slate-900 tracking-tight">Tưới nước</span>
                      <span className="text-[11px] font-medium text-blue-700">+30% • +3 xu</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleFertilize}
                    disabled={isFertilizing}
                    className="group relative flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/70 to-emerald-100/50 p-3 text-left transition-all duration-150 hover:border-emerald-300 hover:bg-emerald-100/70 hover:shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    <div className="flex size-12 shrink-0 items-center justify-center p-1">
                      <img
                        src="/assets/tree/phanbon_icon.png"
                        alt="Phân bón"
                        className="size-full object-contain drop-shadow-xs"
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-bold text-slate-900 tracking-tight">Bón phân</span>
                      <span className="text-[11px] font-medium text-emerald-700">+25 EXP • +6 xu</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tóm tắt giai đoạn hiện tại ở dưới cùng để cân bằng chiều cao với card trái */}
          <div
            className={`mt-5 rounded-2xl p-4 text-xs transition-colors ${
              tree.stage === "fruiting" && tree.harvestReady
                ? "bg-amber-50/90 border border-amber-300/80 text-amber-950 shadow-2xs"
                : "bg-surface-2 border border-line-soft text-ink"
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
    </div>
  )
}
