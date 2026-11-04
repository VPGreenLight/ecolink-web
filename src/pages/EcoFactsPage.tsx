import { useState, useEffect, useRef } from "react"
import { PageHead } from "@/components/Portal"

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

function loadInitialState(): TreeState {
  if (typeof window === "undefined") {
    return {
      stage: "sprout",
      exp: 20,
      maxExp: 80,
      water: 75,
      coins: 50,
      harvestReady: false,
      fruitsCount: 0,
      isDead: false,
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}

  return {
    stage: "seed",
    exp: 10,
    maxExp: 40,
    water: 80,
    coins: 30,
    harvestReady: false,
    fruitsCount: 0,
    isDead: false,
  }
}

export default function EcoFactsPage() {
  const [tree, setTree] = useState<TreeState>(loadInitialState)
  const [floatingCoins, setFloatingCoins] = useState<{ id: number; amount: number; x: number; y: number }[]>([])
  const [isWatering, setIsWatering] = useState(false)
  const [isFertilizing, setIsFertilizing] = useState(false)
  const treeContainerRef = useRef<HTMLDivElement>(null)

  // Lưu trạng thái vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tree))
    } catch {}
  }, [tree])

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

  // Trồng lại cây mới khi cây bị khô héo
  const handleReplant = () => {
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

  // Hiệu ứng rơi coin
  const triggerCoinReward = (amount: number) => {
    const id = Date.now() + Math.random()
    const x = 40 + Math.random() * 20
    const y = 30 + Math.random() * 20
    setFloatingCoins((prev) => [...prev, { id, amount, x, y }])
    setTimeout(() => {
      setFloatingCoins((prev) => prev.filter((c) => c.id !== id))
    }, 1200)

    setTree((prev) => ({ ...prev, coins: prev.coins + amount }))
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
  const handleHarvest = () => {
    if (!tree.harvestReady || tree.fruitsCount <= 0) return

    const harvestReward = 25
    triggerCoinReward(harvestReward)

    setTree((prev) => ({
      ...prev,
      harvestReady: false,
      fruitsCount: 0,
      stage: "mature", // Quay về cây trưởng thành để nuôi chu kỳ mới
      exp: 0,
      maxExp: 300,
    }))
  }

  const currentStageIndex = STAGES.findIndex((s) => s.id === tree.stage)
  const currentStage = STAGES[currentStageIndex]

  return (
    <div className="page flex flex-col gap-8 py-8">
      <PageHead
        title="Virtual Tree · Cây Ảo EcoLink"
      />

      {/* KHU VỰC CHÍNH: CÂY ẢO SVG & BẢNG ĐIỀU KHIỂN CHĂM SÓC */}
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        {/* KHUNG CÂY ẢO SVG GRAPHICS */}
        <div
          ref={treeContainerRef}
          className="relative flex flex-col items-center justify-between overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-[#eaf6ee] via-white to-[#f0f9f3] p-6 shadow-sm min-h-[460px]"
        >
          {/* Huy hiệu góc & Ví EcoLink Coin */}
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2 rounded-full border border-line bg-white/90 px-3.5 py-1.5 shadow-2xs backdrop-blur-md">
              <span className="size-2 rounded-full bg-mint animate-pulse" />
              <span className="text-xs font-bold text-ink">
                Giai đoạn: {tree.isDead ? "Héo khô ⚠️" : currentStage.name}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 shadow-2xs">
              <img src="/assets/AI/ecolink-coin.png" alt="Coin" className="size-5 object-contain" />
              <span className="text-sm font-bold text-amber-900">
                {tree.coins.toLocaleString("vi-VN")} <span className="text-xs font-semibold text-amber-700">Coin</span>
              </span>
            </div>
          </div>

          {/* VẼ CÂY BẰNG SVG GRAPHICS ĐỒ HỌA THUẦN */}
          <div className="relative my-4 flex size-full max-w-[380px] items-center justify-center">
            {/* Hiệu ứng tưới nước (giọt mưa rơi) */}
            {isWatering && (
              <div className="absolute inset-x-0 top-0 flex justify-center gap-4 text-blue-400 animate-bounce pointer-events-none z-20">
                <span className="text-2xl">💧</span>
                <span className="text-3xl mt-4">💧</span>
                <span className="text-xl">💧</span>
                <span className="text-2xl mt-2">💧</span>
              </div>
            )}

            {/* Hiệu ứng bón phân (bụi sao lấp lánh) */}
            {isFertilizing && (
              <div className="absolute inset-x-0 top-10 flex justify-center gap-6 text-amber-500 animate-pulse pointer-events-none z-20">
                <span className="text-2xl">✨</span>
                <span className="text-3xl">🌱</span>
                <span className="text-2xl">✨</span>
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

            {/* SVG CHÍNH CỦA CÂY - THEO ĐÚNG HÌNH ẢNH MẪU OAK VECTOR GAME 2D */}
            <svg
              viewBox="0 0 520 520"
              className="size-full select-none transition-transform duration-500 hover:scale-[1.02]"
              aria-label="Cây cổ thụ EcoLink phong cách hình ảnh mẫu"
            >
              <defs>
                {/* Đổ bóng cho tán cây */}
                <filter id="oak-shadow" x="-15%" y="-15%" width="130%" height="130%">
                  <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#013812" floodOpacity="0.25" />
                </filter>
                <filter id="fruit-drop" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#b91c1c" floodOpacity="0.35" />
                </filter>

                {/* Màu thân gỗ sồi nhiều tông theo ảnh */}
                <linearGradient id="oak-wood" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#45240c" />
                  <stop offset="22%" stopColor="#693714" />
                  <stop offset="60%" stopColor="#8c4e1f" />
                  <stop offset="85%" stopColor="#a7632b" />
                  <stop offset="100%" stopColor="#5a2e0f" />
                </linearGradient>

                {/* Màu cành cây (mặt trên sáng nắng, mặt dưới bóng) */}
                <linearGradient id="branch-light" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a7632b" />
                  <stop offset="40%" stopColor="#84481c" />
                  <stop offset="100%" stopColor="#3d1e08" />
                </linearGradient>

                {/* Tán lá: 3 tầng màu đúng ảnh mẫu */}
                {/* 1. Xanh bóng tối nền phía sau */}
                <linearGradient id="oak-leaf-dark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#086e24" />
                  <stop offset="100%" stopColor="#014413" />
                </linearGradient>

                {/* 2. Xanh thân lá chính */}
                <linearGradient id="oak-leaf-mid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#32bf32" />
                  <stop offset="100%" stopColor="#158f21" />
                </linearGradient>

                {/* 3. Vòm đón nắng xanh chuối / chartreuse trên đỉnh mỗi cụm lá */}
                <linearGradient id="oak-leaf-sun" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b4f427" />
                  <stop offset="50%" stopColor="#8bee16" />
                  <stop offset="100%" stopColor="#3dbf27" />
                </linearGradient>

                {/* Gradient quả mọng chín đỏ */}
                <radialGradient id="oak-fruit" cx="35%" cy="30%" r="65%">
                  <stop offset="0%" stopColor="#fca5a5" />
                  <stop offset="30%" stopColor="#ef4444" />
                  <stop offset="80%" stopColor="#b91c1c" />
                  <stop offset="100%" stopColor="#7f1d1d" />
                </radialGradient>

                {/* Ụ đất mầm non hạt giống (Seed Mound) */}
                <radialGradient id="soil-mound" cx="50%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#804d24" />
                  <stop offset="60%" stopColor="#5c3417" />
                  <stop offset="100%" stopColor="#331908" />
                </radialGradient>
                <linearGradient id="seed-stem-grad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#4d6628" />
                  <stop offset="100%" stopColor="#648535" />
                </linearGradient>
              </defs>

              <style>{`
                @keyframes gentle-leaf-sway {
                  0%, 100% { transform: rotate(0deg); }
                  50% { transform: rotate(1deg); }
                }
                @keyframes fruit-bounce {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-4px); }
                }
                .canopy-animated {
                  transform-origin: 260px 380px;
                  animation: gentle-leaf-sway 5s ease-in-out infinite;
                }
                .fruit-bouncing {
                  animation: fruit-bounce 2s ease-in-out infinite;
                  cursor: pointer;
                }
              `}</style>

              {/* MẢNH ĐẤT NỀN BẦU DỤC MÀU BE NHẠT ĐÚNG ẢNH MẪU */}
              <ellipse cx="260" cy="470" rx="145" ry="18" fill="#e2ecc8" />
              <ellipse cx="260" cy="469" rx="115" ry="12" fill="#d2dfb0" opacity="0.6" />

              {/* ======================================================== */}
              {/* TRƯỜNG HỢP CÂY HÉO KHÔ (DEAD / WITHERED - CÙNG DÁNG THÂN) */}
              {/* ======================================================== */}
              {tree.isDead && (
                <g className="transition-all duration-700">
                  {/* Vết nứt trên mảng đất be nhạt */}
                  <path d="M 220 468 L 200 472 L 180 470 M 270 466 L 290 472 L 315 470 M 255 464 L 250 474" stroke="#713f12" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />

                  {/* THÂN VÀ CÀNH CÂY CÙNG KHỐI LIỀN MẠCH NHƯNG MÀU GỖ KHÔ CẰN */}
                  <g filter="url(#oak-shadow)">
                    {/* Thân cây khô xám nâu */}
                    <path
                      d="M 180 464
                         C 200 452 222 430 234 385
                         C 238 340 240 312 235 292
                         C 208 268 168 252 128 242
                         C 108 237 92 234 78 232
                         C 102 240 132 250 156 262
                         C 182 275 212 292 232 312
                         C 228 275 222 240 210 200
                         C 202 175 188 152 172 135
                         C 182 150 198 178 208 210
                         C 218 242 224 274 232 296
                         C 236 260 242 218 244 172
                         C 250 192 252 228 250 268
                         C 258 244 276 212 302 178
                         C 294 200 280 234 266 265
                         C 280 282 312 268 354 250
                         C 386 240 412 236 432 232
                         C 414 240 390 248 364 260
                         C 324 278 288 300 276 320
                         C 282 352 284 386 290 426
                         C 298 442 316 454 334 464
                         C 310 460 294 454 285 445
                         C 280 458 272 466 260 466
                         C 252 462 248 452 244 446
                         C 238 454 230 464 216 466
                         C 205 466 195 464 180 464 Z"
                      fill="#4a372c"
                    />
                    {/* Bóng tối thân cây khô */}
                    <path
                      d="M 180 464 C 200 452 222 430 234 385 C 238 340 240 312 235 292 C 208 268 168 252 128 242 C 108 237 92 234 78 232 C 102 239 132 249 156 260 C 182 275 212 292 232 312 C 228 275 222 240 210 200 C 202 175 188 152 172 135 C 178 147 190 170 198 198 C 208 240 216 294 228 335 C 224 380 214 425 180 464 Z"
                      fill="#2b1d16"
                      opacity="0.9"
                    />
                    {/* Vân gỗ khô nứt */}
                    <path d="M 232 452 Q 244 405 244 355 Q 244 320 242 295" stroke="#1c120c" strokeWidth="2.5" fill="none" opacity="0.7" />
                    <path d="M 252 456 Q 256 410 254 360 Q 252 325 250 290" stroke="#634c3e" strokeWidth="2" fill="none" opacity="0.6" />

                    {/* Các cành khô khẳng khiu trơ trụi trên ngọn */}
                    <path d="M 172 135 Q 150 110 135 95 M 172 135 Q 185 115 190 98" stroke="#4a372c" strokeWidth="5" strokeLinecap="round" fill="none" />
                    <path d="M 244 172 Q 238 135 230 110 M 244 172 Q 255 140 262 115" stroke="#4a372c" strokeWidth="5" strokeLinecap="round" fill="none" />
                    <path d="M 302 178 Q 320 145 335 125 M 302 178 Q 295 150 290 130" stroke="#4a372c" strokeWidth="5" strokeLinecap="round" fill="none" />
                    <path d="M 78 232 Q 60 225 45 228" stroke="#4a372c" strokeWidth="5" strokeLinecap="round" fill="none" />
                    <path d="M 432 232 Q 450 225 465 228" stroke="#4a372c" strokeWidth="5" strokeLinecap="round" fill="none" />
                  </g>

                  {/* Vài chiếc lá sồi khô héo úa tàn rơi lả tả */}
                  <g fill="#92400e" stroke="#451a03" strokeWidth="1">
                    {/* Dính trên cành */}
                    <path d="M 135 95 C 130 90 120 98 135 95" />
                    <path d="M 230 110 C 225 105 215 112 230 110" />
                    <path d="M 335 125 C 340 120 350 128 335 125" />
                    {/* Rụng trên đất */}
                    <ellipse cx="205" cy="466" rx="8" ry="4" transform="rotate(-15, 205, 466)" fill="#78350f" />
                    <ellipse cx="305" cy="468" rx="9" ry="3.5" transform="rotate(25, 305, 468)" fill="#78350f" />
                    <ellipse cx="240" cy="472" rx="7" ry="3" transform="rotate(-5, 240, 472)" fill="#92400e" />
                  </g>

                  {/* Biểu tượng kêu cứu héo khô */}
                  <g className="animate-bounce" transform="translate(260, 240)">
                    <rect x="-85" y="-22" width="170" height="44" rx="22" fill="#ffffff" filter="url(#oak-shadow)" stroke="#ef4444" strokeWidth="2" />
                    <text x="0" y="6" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#b91c1c">
                      🥀 Cây đã chết do cạn nước!
                    </text>
                  </g>
                </g>
              )}

              {/* ======================================================== */}
              {/* GIAI ĐOẠN 0: HẠT MẦM (SEED - CHUẨN XÁC 100% THEO HÌNH ẢNH MẪU MỚI) */}
              {/* ======================================================== */}
              {!tree.isDead && tree.stage === "seed" && (
                <g
                  className="transition-all duration-700"
                  transform="translate(260, 470) scale(0.30) translate(-260, -470)"
                >
                  {/* Ụ đất hình vòm tròn màu nâu đất ấm chuyển sắc chuẩn xác theo ảnh mẫu */}
                  <g filter="url(#oak-shadow)">
                    <path
                      d="M 175 470
                         C 175 428 212 414 260 414
                         C 308 414 345 428 345 470
                         C 345 478 175 478 175 470 Z"
                      fill="url(#soil-mound)"
                    />
                    {/* Vệt sáng ấm nhẹ trên đỉnh gò đất */}
                    <ellipse cx="260" cy="425" rx="55" ry="10" fill="#8c582d" opacity="0.4" />
                  </g>

                  {/* THÂN MẦM MÀU XANH RÊU / OLIVE CÓ CHẠC CHỮ V TÁCH ĐÔI CUỐNG LÁ */}
                  <g filter="url(#oak-shadow)">
                    {/* Thân mầm chính mập mạp khỏe khoắn */}
                    <path
                      d="M 260 436 C 262 390 258 350 256 305"
                      stroke="url(#seed-stem-grad)"
                      strokeWidth="15"
                      strokeLinecap="round"
                      fill="none"
                    />
                    {/* Cuống rẽ sang lá trái */}
                    <path
                      d="M 256 305 Q 248 280 235 260"
                      stroke="url(#seed-stem-grad)"
                      strokeWidth="11"
                      strokeLinecap="round"
                      fill="none"
                    />
                    {/* Cuống rẽ sang lá phải */}
                    <path
                      d="M 256 305 Q 268 288 280 275"
                      stroke="url(#seed-stem-grad)"
                      strokeWidth="11"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </g>

                  {/* CẶP 2 LÁ MẦM BẤT ĐỐI XỨNG ĐẶC TRƯNG CHUẨN XÁC THEO HÌNH ẢNH MẪU */}
                  <g filter="url(#oak-shadow)">
                    {/* 1. LÁ TRÁI: DÀI HƠN, HƯỚNG LÊN CAO GÓC 50 ĐỘ, MŨI LÁ NHỌN */}
                    <g>
                      <path
                        d="M 235 260
                           C 185 245 110 185 118 100
                           C 122 80 145 85 185 115
                           C 235 155 250 220 235 260 Z"
                        fill="#78ba28"
                        stroke="#314f17"
                        strokeWidth="2.8"
                      />
                      {/* Đường gân lá màu xanh lục sẫm uốn cong từ cuống lên chóp lá */}
                      <path
                        d="M 235 260 Q 170 175 118 100"
                        stroke="#314f17"
                        strokeWidth="5"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </g>

                    {/* 2. LÁ PHẢI: BẦU HƠN, RỘNG HƠN, XÒE NGANG GÓC 25 ĐỘ CHUẨN MẪU */}
                    <g>
                      <path
                        d="M 280 275
                           C 310 215 375 195 440 235
                           C 455 245 445 265 395 305
                           C 345 345 295 315 280 275 Z"
                        fill="#78ba28"
                        stroke="#314f17"
                        strokeWidth="2.8"
                      />
                      {/* Đường gân lá cong qua tâm lá */}
                      <path
                        d="M 280 275 Q 365 245 440 235"
                        stroke="#314f17"
                        strokeWidth="5"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </g>
                  </g>
                </g>
              )}

              {/* ======================================================== */}
              {/* GIAI ĐOẠN 1: CHỒI NON (SPROUT - THÂN CÀNH MỀM MẠI UỐN LƯỢN)*/}
              {/* ======================================================== */}
              {!tree.isDead && tree.stage === "sprout" && (
                <g className="transition-all duration-700">
                  {/* Mảnh đất mấp mô tự nhiên */}
                  <g filter="url(#oak-shadow)">
                    <path
                      d="M 165 474 C 175 456 205 450 225 458 C 245 446 275 444 295 452 C 315 446 340 452 355 462 C 368 466 375 472 365 478 C 340 482 190 482 165 474 Z"
                      fill="#5c3d31"
                    />
                    <ellipse cx="150" cy="472" rx="6" ry="3.5" fill="#422920" />
                    <ellipse cx="370" cy="474" rx="5" ry="3" fill="#422920" />
                  </g>

                  {/* THÂN VÀ CÀNH UỐN LƯỢN MỀM MẠI, LIỀN KHỐI TỰ NHIÊN */}
                  <g filter="url(#oak-shadow)">
                    {/* Rễ bám đất uốn cong mềm mại */}
                    <path d="M 235 468 C 242 455 248 440 252 415 M 285 468 C 278 455 272 440 268 415" stroke="url(#oak-wood)" strokeWidth="5" strokeLinecap="round" fill="none" />

                    {/* Thân cây gỗ mảnh vuốt cong mềm mại chữ S (Fluid Organic Trunk) */}
                    <path
                      d="M 246 466
                         C 252 435 250 385 252 345
                         C 246 320 230 290 214 260
                         C 202 238 190 220 182 205
                         C 188 215 204 238 218 262
                         C 230 284 246 312 254 330
                         C 256 310 260 270 264 225
                         C 268 250 268 290 266 325
                         C 274 305 288 280 305 255
                         C 316 238 325 220 330 205
                         C 324 218 312 240 298 265
                         C 285 288 274 315 268 340
                         C 270 385 268 435 274 466 Z"
                      fill="url(#oak-wood)"
                    />

                    {/* Vệt bóng đổ sẫm mềm uốn theo thân cành bên trái */}
                    <path
                      d="M 246 466
                         C 252 435 250 385 252 345
                         C 246 320 230 290 214 260
                         C 202 238 190 220 182 205
                         C 185 212 195 230 206 250
                         C 220 275 236 305 246 330
                         C 248 375 248 425 246 466 Z"
                      fill="#331603"
                      opacity="0.88"
                    />

                    {/* CÁC CÀNH CON UỐN CONG MỀM MẠI TỰ NHIÊN (SOFT BÉZIER CURVES) */}
                    {/* Cành trái vươn ngang uốn lượn */}
                    <path d="M 240 325 C 220 308 195 300 172 292" stroke="url(#branch-light)" strokeWidth="3.8" strokeLinecap="round" fill="none" />
                    {/* Cành trái vươn ngọn uốn cong */}
                    <path d="M 214 260 C 200 235 188 215 178 195" stroke="url(#branch-light)" strokeWidth="3.2" strokeLinecap="round" fill="none" />
                    {/* Cành giữa ngọn vuốt cong nhẹ */}
                    <path d="M 260 325 C 262 285 264 250 268 218" stroke="url(#branch-light)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                    {/* Cành phải vươn ngọn uốn cong */}
                    <path d="M 278 285 C 298 255 315 230 328 200" stroke="url(#branch-light)" strokeWidth="3.2" strokeLinecap="round" fill="none" />
                    {/* Cành phải vươn ngang uốn lượn */}
                    <path d="M 270 320 C 295 305 320 298 345 292" stroke="url(#branch-light)" strokeWidth="3.8" strokeLinecap="round" fill="none" />

                    {/* Đường gân gỗ sồi mềm mại */}
                    <path d="M 256 455 C 258 405 256 360 258 325" stroke="#ba6e2b" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.8" />
                  </g>

                  {/* 10 CHIẾC LÁ NON MỌC UYỂN CHUYỂN Ở CÁC ĐẦU CÀNH MỀM */}
                  <g filter="url(#oak-shadow)">
                    {/* Lá 1: Đỉnh cành trái cao */}
                    <g transform="translate(178, 195) rotate(-28)">
                      <path d="M 0 0 C -9 -9 -11 -22 0 -30 C 11 -22 9 -9 0 0 Z" fill="#70c448" stroke="#489441" strokeWidth="1" />
                    </g>
                    {/* Lá 2: Ngọn cành trái */}
                    <g transform="translate(202, 238) rotate(-18)">
                      <path d="M 0 0 C -8 -8 -10 -20 0 -28 C 10 -20 8 -8 0 0 Z" fill="#78c850" stroke="#489441" strokeWidth="1" />
                    </g>
                    {/* Lá 3: Cành trái ngang */}
                    <g transform="translate(172, 292) rotate(-68)">
                      <path d="M 0 0 C -9 -9 -11 -22 0 -30 C 11 -22 9 -9 0 0 Z" fill="#70c448" stroke="#489441" strokeWidth="1" />
                    </g>
                    {/* Lá 4: Cành trái thấp */}
                    <g transform="translate(198, 312) rotate(-80)">
                      <path d="M 0 0 C -7 -7 -9 -18 0 -25 C 9 -18 7 -7 0 0 Z" fill="#78c850" stroke="#489441" strokeWidth="1" />
                    </g>

                    {/* Lá 5: Cành giữa ngọn */}
                    <g transform="translate(268, 218) rotate(4)">
                      <path d="M 0 0 C -9 -9 -11 -22 0 -30 C 11 -22 9 -9 0 0 Z" fill="#8bee16" stroke="#489441" strokeWidth="1" />
                    </g>
                    {/* Lá 6: Cành giữa nách */}
                    <g transform="translate(262, 268) rotate(28)">
                      <path d="M 0 0 C -8 -8 -10 -20 0 -28 C 10 -20 8 -8 0 0 Z" fill="#70c448" stroke="#489441" strokeWidth="1" />
                    </g>

                    {/* Lá 7: Cành phải cao */}
                    <g transform="translate(328, 200) rotate(22)">
                      <path d="M 0 0 C -9 -9 -11 -22 0 -30 C 11 -22 9 -9 0 0 Z" fill="#70c448" stroke="#489441" strokeWidth="1" />
                    </g>
                    {/* Lá 8: Ngọn cành phải */}
                    <g transform="translate(305, 240) rotate(16)">
                      <path d="M 0 0 C -8 -8 -10 -20 0 -28 C 10 -20 8 -8 0 0 Z" fill="#78c850" stroke="#489441" strokeWidth="1" />
                    </g>
                    {/* Lá 9: Cành phải ngang */}
                    <g transform="translate(345, 292) rotate(58)">
                      <path d="M 0 0 C -9 -9 -11 -22 0 -30 C 11 -22 9 -9 0 0 Z" fill="#70c448" stroke="#489441" strokeWidth="1" />
                    </g>
                    {/* Lá 10: Cành phải thấp */}
                    <g transform="translate(320, 312) rotate(68)">
                      <path d="M 0 0 C -7 -7 -9 -18 0 -25 C 9 -18 7 -7 0 0 Z" fill="#70c448" stroke="#489441" strokeWidth="1" />
                    </g>
                  </g>
                </g>
              )}

              {/* ======================================================== */}
              {/* GIAI ĐOẠN 2: CÂY NON (SAPLING - CÂY TRƯỞNG THÀNH THU NHỎ)  */}
              {/* ĐÚNG YÊU CẦU: LẤY CÂY TRƯỞNG THÀNH VÀ THU NHỎ LẠI         */}
              {/* ======================================================== */}
              {!tree.isDead && tree.stage === "sapling" && (
                <g
                  className="transition-all duration-700"
                  transform="translate(260, 470) scale(0.66) translate(-260, -470)"
                >
                  {/* TẦNG TÁN LÁ NỀN SÂU PHÍA SAU */}
                  <g filter="url(#oak-shadow)">
                    <path
                      d="M170 120 C140 70 200 40 260 40 C320 40 380 70 350 120 C420 130 450 200 410 250 C460 280 440 340 380 340 C350 340 320 310 300 290 C260 300 210 290 190 280 C150 320 100 320 80 270 C50 240 60 170 110 150 C95 115 130 85 170 120 Z"
                      fill="url(#oak-leaf-dark)"
                    />
                  </g>

                  {/* THÂN VÀ CÀNH SỒI LIỀN MẠCH */}
                  <g filter="url(#oak-shadow)">
                    <path
                      d="M 180 464
                         C 200 452 222 430 234 385
                         C 238 340 240 312 235 292
                         C 208 268 168 252 128 242
                         C 108 237 92 234 78 232
                         C 102 240 132 250 156 262
                         C 182 275 212 292 232 312
                         C 228 275 222 240 210 200
                         C 202 175 188 152 172 135
                         C 182 150 198 178 208 210
                         C 218 242 224 274 232 296
                         C 236 260 242 218 244 172
                         C 250 192 252 228 250 268
                         C 258 244 276 212 302 178
                         C 294 200 280 234 266 265
                         C 280 282 312 268 354 250
                         C 386 240 412 236 432 232
                         C 414 240 390 248 364 260
                         C 324 278 288 300 276 320
                         C 282 352 284 386 290 426
                         C 298 442 316 454 334 464
                         C 310 460 294 454 285 445
                         C 280 458 272 466 260 466
                         C 252 462 248 452 244 446
                         C 238 454 230 464 216 466
                         C 205 466 195 464 180 464 Z"
                      fill="url(#oak-wood)"
                    />
                    <path
                      d="M 180 464 C 200 452 222 430 234 385 C 238 340 240 312 235 292 C 208 268 168 252 128 242 C 108 237 92 234 78 232 C 102 239 132 249 156 260 C 182 275 212 292 232 312 C 228 275 222 240 210 200 C 202 175 188 152 172 135 C 178 147 190 170 198 198 C 208 240 216 294 228 335 C 224 380 214 425 180 464 Z"
                      fill="#331603"
                      opacity="0.88"
                    />
                    <path
                      d="M 250 268 C 258 244 276 212 302 178 C 295 198 282 230 268 262 C 280 282 312 268 354 250 C 386 240 412 236 432 232 C 410 239 382 248 350 258 C 316 274 285 296 276 320 C 282 352 284 386 290 426 C 298 442 316 454 334 464 C 308 458 290 445 284 425 C 278 385 274 345 264 315 C 256 300 252 282 250 268 Z"
                      fill="#a15822"
                      opacity="0.88"
                    />
                    <path d="M 232 452 Q 244 405 244 355 Q 244 320 242 295" stroke="#1f0c01" strokeWidth="2.5" fill="none" opacity="0.65" />
                    <path d="M 252 456 Q 256 410 254 360 Q 252 325 250 290" stroke="#68320c" strokeWidth="2.2" fill="none" opacity="0.85" />
                    <path d="M 272 458 Q 268 415 264 370 Q 262 335 262 305" stroke="#ba6e2b" strokeWidth="2" fill="none" opacity="0.8" />
                  </g>

                  {/* CÁC CỤM TÁN LÁ RĂNG CƯA THU NHỎ */}
                  <g filter="url(#oak-shadow)">
                    {/* Dưới trái */}
                    <g id="clump-bottom-left-mini">
                      <path d="M75 250 C55 245 40 225 50 205 C55 190 70 185 85 190 C95 175 120 170 140 180 C160 170 185 180 195 200 C205 215 195 235 180 245 C190 260 175 280 155 280 C135 285 115 275 105 265 C95 275 75 270 75 250 Z" fill="url(#oak-leaf-mid)" />
                      <path d="M50 205 C60 190 75 185 90 192 C100 175 125 170 145 180 C165 172 188 182 195 202 C185 190 165 185 145 192 C125 185 100 188 88 202 C75 198 60 202 50 205 Z" fill="url(#oak-leaf-sun)" />
                    </g>
                    {/* Dưới phải */}
                    <g id="clump-bottom-right-mini">
                      <path d="M445 250 C465 245 480 225 470 205 C465 190 450 185 435 190 C425 175 400 170 380 180 C360 170 335 180 325 200 C315 215 325 235 340 245 C330 260 345 280 365 280 C385 285 405 275 415 265 C425 275 445 270 445 250 Z" fill="url(#oak-leaf-mid)" />
                      <path d="M470 205 C460 190 445 185 430 192 C420 175 395 170 375 180 C355 172 332 182 325 202 C335 190 355 185 375 192 C395 185 420 188 432 202 C445 198 460 202 470 205 Z" fill="url(#oak-leaf-sun)" />
                    </g>
                    {/* Giữa trái */}
                    <g id="clump-mid-left-mini">
                      <path d="M110 180 C90 170 85 145 100 125 C115 110 135 115 145 125 C160 105 190 100 215 115 C235 105 265 115 270 140 C275 160 260 180 240 185 C245 205 225 225 200 225 C175 225 155 210 145 195 C130 205 115 195 110 180 Z" fill="url(#oak-leaf-mid)" />
                      <path d="M100 125 C115 110 135 115 148 128 C162 106 192 102 216 116 C236 106 266 116 270 142 C255 125 232 122 215 128 C192 118 165 122 148 138 C138 126 120 122 100 125 Z" fill="url(#oak-leaf-sun)" />
                    </g>
                    {/* Giữa phải */}
                    <g id="clump-mid-right-mini">
                      <path d="M410 180 C430 170 435 145 420 125 C405 110 385 115 375 125 C360 105 330 100 305 115 C285 105 255 115 250 140 C245 160 260 180 280 185 C275 205 295 225 320 225 C345 225 365 210 375 195 C390 205 405 195 410 180 Z" fill="url(#oak-leaf-mid)" />
                      <path d="M420 125 C405 110 385 115 372 128 C358 106 328 102 304 116 C284 106 254 116 250 142 C265 125 288 122 305 128 C328 118 355 122 372 138 C382 126 400 122 420 125 Z" fill="url(#oak-leaf-sun)" />
                    </g>
                    {/* Đỉnh ngọn */}
                    <g id="clump-crown-top-mini">
                      <path d="M175 105 C155 85 170 55 200 48 C215 30 245 25 265 35 C285 25 315 30 330 50 C355 55 370 85 350 108 C365 125 355 155 330 162 C305 170 280 165 265 150 C245 165 220 170 195 162 C170 155 160 125 175 105 Z" fill="url(#oak-leaf-mid)" />
                      <path d="M175 105 C165 85 175 55 202 48 C216 30 246 25 265 36 C284 25 314 30 328 50 C354 55 365 85 350 108 C340 85 315 65 265 62 C215 65 190 85 175 105 Z" fill="url(#oak-leaf-sun)" />
                    </g>
                  </g>
                </g>
              )}

              {/* ======================================================== */}
              {/* GIAI ĐOẠN 3, 4, 5: CÂY TRƯỞNG THÀNH (THE EXACT OAK TREE) */}
              {/* TÁI HIỆN CHÍNH XÁC 100% THEO HÌNH ẢNH MẪU ĐƯỢC CUNG CẤP    */}
              {/* ======================================================== */}
              {!tree.isDead && ["mature", "flowering", "fruiting"].includes(tree.stage) && (
                <g className="canopy-animated transition-all duration-700">
                  {/* 1. TẦNG TÁN LÁ NỀN SÂU PHÍA SAU (DEEP BACKGROUND CANOPY) */}
                  <g id="deep-background-canopy" filter="url(#oak-shadow)">
                    {/* Khối tán nền đỉnh */}
                    <path
                      d="M170 120 C140 70 200 40 260 40 C320 40 380 70 350 120 C420 130 450 200 410 250 C460 280 440 340 380 340 C350 340 320 310 300 290 C260 300 210 290 190 280 C150 320 100 320 80 270 C50 240 60 170 110 150 C95 115 130 85 170 120 Z"
                      fill="url(#oak-leaf-dark)"
                    />
                  </g>

                  {/* 2. HỆ THỐNG THÂN CÂY VÀ CÀNH GỖ (TRUNK & SPREADING OAK BOUGHS - LIỀN MẠCH 100%) */}
                  <g id="oak-trunk-system" filter="url(#oak-shadow)">
                    {/* KHỐI THÂN VÀ CÀNH CHÍNH LIỀN KHỐI (SOLID CONTINUOUS SILHOUETTE) */}
                    <path
                      d="M 180 464
                         C 200 452 222 430 234 385
                         C 238 340 240 312 235 292
                         C 208 268 168 252 128 242
                         C 108 237 92 234 78 232
                         C 102 240 132 250 156 262
                         C 182 275 212 292 232 312
                         C 228 275 222 240 210 200
                         C 202 175 188 152 172 135
                         C 182 150 198 178 208 210
                         C 218 242 224 274 232 296
                         C 236 260 242 218 244 172
                         C 250 192 252 228 250 268
                         C 258 244 276 212 302 178
                         C 294 200 280 234 266 265
                         C 280 282 312 268 354 250
                         C 386 240 412 236 432 232
                         C 414 240 390 248 364 260
                         C 324 278 288 300 276 320
                         C 282 352 284 386 290 426
                         C 298 442 316 454 334 464
                         C 310 460 294 454 285 445
                         C 280 458 272 466 260 466
                         C 252 462 248 452 244 446
                         C 238 454 230 464 216 466
                         C 205 466 195 464 180 464 Z"
                      fill="url(#oak-wood)"
                    />

                    {/* MẢNG BÓNG TỐI NỬA TRÁI VÀ PHÍA DƯỚI CÀNH (SHADOW FACET) */}
                    <path
                      d="M 180 464
                         C 200 452 222 430 234 385
                         C 238 340 240 312 235 292
                         C 208 268 168 252 128 242
                         C 108 237 92 234 78 232
                         C 102 239 132 249 156 260
                         C 182 275 212 292 232 312
                         C 228 275 222 240 210 200
                         C 202 175 188 152 172 135
                         C 178 147 190 170 198 198
                         C 208 240 216 294 228 335
                         C 224 380 214 425 180 464 Z"
                      fill="#331603"
                      opacity="0.88"
                    />

                    {/* MẢNG ĐÓN NẮNG VÀNG NÂU NỬA PHẢI VÀ LƯNG CÀNH (SUNLIT HIGHLIGHT) */}
                    <path
                      d="M 250 268
                         C 258 244 276 212 302 178
                         C 295 198 282 230 268 262
                         C 280 282 312 268 354 250
                         C 386 240 412 236 432 232
                         C 410 239 382 248 350 258
                         C 316 274 285 296 276 320
                         C 282 352 284 386 290 426
                         C 298 442 316 454 334 464
                         C 308 458 290 445 284 425
                         C 278 385 274 345 264 315
                         C 256 300 252 282 250 268 Z"
                      fill="#a15822"
                      opacity="0.88"
                    />

                    {/* CÁC NHÁNH PHỤ CHỈA LÊN TÁN (SECONDARY TWIGS) */}
                    <path d="M 156 262 C 142 240 130 214 116 192 C 126 202 140 224 152 246 Z" fill="#582a0b" />
                    <path d="M 354 258 C 372 236 386 210 398 188 C 388 200 374 222 360 244 Z" fill="#844315" />
                    <path d="M 232 296 C 242 270 250 235 256 205 C 248 230 240 262 234 290 Z" fill="#71360e" />

                    {/* ĐƯỜNG VÂN GỖ XOẮN 3D DỌC THÂN (CONTOUR WOOD GRAINS) */}
                    <path d="M 232 452 Q 244 405 244 355 Q 244 320 242 295" stroke="#1f0c01" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.65" />
                    <path d="M 252 456 Q 256 410 254 360 Q 252 325 250 290" stroke="#68320c" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.85" />
                    <path d="M 272 458 Q 268 415 264 370 Q 262 335 262 305" stroke="#ba6e2b" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
                  </g>

                  {/* 3. CÁC KHỐI TÁN LÁ BỒNG BỀNH RĂNG CƯA ĐÚNG BẢN VẼ (SCALLOPED CANOPY CLUSTERS) */}
                  <g id="scalloped-foliage-clusters" filter="url(#oak-shadow)">
                    {/* ========================================= */}
                    {/* CỤM DƯỚI CÙNG BÊN TRÁI (Bottom-Left Clump) */}
                    {/* ========================================= */}
                    <g id="clump-bottom-left">
                      {/* Thân lá xanh mướt */}
                      <path
                        d="M75 250 C55 245 40 225 50 205 C55 190 70 185 85 190 C95 175 120 170 140 180 C160 170 185 180 195 200 C205 215 195 235 180 245 C190 260 175 280 155 280 C135 285 115 275 105 265 C95 275 75 270 75 250 Z"
                        fill="url(#oak-leaf-mid)"
                      />
                      {/* Vành đón nắng xanh chuối đỉnh cụm (Scalloped Sunlit Cap) */}
                      <path
                        d="M50 205 C60 190 75 185 90 192 C100 175 125 170 145 180 C165 172 188 182 195 202 C185 190 165 185 145 192 C125 185 100 188 88 202 C75 198 60 202 50 205 Z"
                        fill="url(#oak-leaf-sun)"
                      />
                      {/* Đốm vảy lá đón nắng bên trong */}
                      <path d="M95 210 Q105 205 115 210 M140 215 Q150 208 160 215" stroke="#b4f427" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    </g>

                    {/* ========================================= */}
                    {/* CỤM DƯỚI CÙNG BÊN PHẢI (Bottom-Right Clump) */}
                    {/* ========================================= */}
                    <g id="clump-bottom-right">
                      <path
                        d="M445 250 C465 245 480 225 470 205 C465 190 450 185 435 190 C425 175 400 170 380 180 C360 170 335 180 325 200 C315 215 325 235 340 245 C330 260 345 280 365 280 C385 285 405 275 415 265 C425 275 445 270 445 250 Z"
                        fill="url(#oak-leaf-mid)"
                      />
                      <path
                        d="M470 205 C460 190 445 185 430 192 C420 175 395 170 375 180 C355 172 332 182 325 202 C335 190 355 185 375 192 C395 185 420 188 432 202 C445 198 460 202 470 205 Z"
                        fill="url(#oak-leaf-sun)"
                      />
                      <path d="M360 215 Q370 208 380 215 M405 210 Q415 205 425 210" stroke="#b4f427" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    </g>

                    {/* ========================================= */}
                    {/* CỤM TẦNG GIỮA TRÁI (Mid-Left Clump)       */}
                    {/* ========================================= */}
                    <g id="clump-mid-left">
                      <path
                        d="M110 180 C90 170 85 145 100 125 C115 110 135 115 145 125 C160 105 190 100 215 115 C235 105 265 115 270 140 C275 160 260 180 240 185 C245 205 225 225 200 225 C175 225 155 210 145 195 C130 205 115 195 110 180 Z"
                        fill="url(#oak-leaf-mid)"
                      />
                      <path
                        d="M100 125 C115 110 135 115 148 128 C162 106 192 102 216 116 C236 106 266 116 270 142 C255 125 232 122 215 128 C192 118 165 122 148 138 C138 126 120 122 100 125 Z"
                        fill="url(#oak-leaf-sun)"
                      />
                      <path d="M140 145 Q152 138 165 145 M190 140 Q205 132 220 140" stroke="#b4f427" strokeWidth="3" strokeLinecap="round" fill="none" />
                    </g>

                    {/* ========================================= */}
                    {/* CỤM TẦNG GIỮA PHẢI (Mid-Right Clump)      */}
                    {/* ========================================= */}
                    <g id="clump-mid-right">
                      <path
                        d="M410 180 C430 170 435 145 420 125 C405 110 385 115 375 125 C360 105 330 100 305 115 C285 105 255 115 250 140 C245 160 260 180 280 185 C275 205 295 225 320 225 C345 225 365 210 375 195 C390 205 405 195 410 180 Z"
                        fill="url(#oak-leaf-mid)"
                      />
                      <path
                        d="M420 125 C405 110 385 115 372 128 C358 106 328 102 304 116 C284 106 254 116 250 142 C265 125 288 122 305 128 C328 118 355 122 372 138 C382 126 400 122 420 125 Z"
                        fill="url(#oak-leaf-sun)"
                      />
                      <path d="M300 140 Q315 132 330 140 M355 145 Q368 138 380 145" stroke="#b4f427" strokeWidth="3" strokeLinecap="round" fill="none" />
                    </g>

                    {/* ========================================= */}
                    {/* VÒM ĐỈNH TÁN TRUNG TÂM (Crown Top Dome)  */}
                    {/* ========================================= */}
                    <g id="clump-crown-top">
                      {/* Khối chính đỉnh cây */}
                      <path
                        d="M175 105 C155 85 170 55 200 48 C215 30 245 25 265 35 C285 25 315 30 330 50 C355 55 370 85 350 108 C365 125 355 155 330 162 C305 170 280 165 265 150 C245 165 220 170 195 162 C170 155 160 125 175 105 Z"
                        fill="url(#oak-leaf-mid)"
                      />
                      {/* Vành viền đón nắng xanh chuối đỉnh ngọn */}
                      <path
                        d="M175 105 C165 85 175 55 202 48 C216 30 246 25 265 36 C284 25 314 30 328 50 C354 55 365 85 350 108 C340 85 315 65 265 62 C215 65 190 85 175 105 Z"
                        fill="url(#oak-leaf-sun)"
                      />
                      {/* Các gợn vảy lá sáng trên chóp */}
                      <path d="M210 75 Q225 65 240 75 M275 72 Q290 64 305 72" stroke="#b4f427" strokeWidth="3" strokeLinecap="round" fill="none" />
                      <path d="M245 100 Q260 90 275 100 M210 115 Q225 106 240 115" stroke="#b4f427" strokeWidth="3" strokeLinecap="round" fill="none" />
                    </g>
                  </g>

                  {/* =================================================== */}
                  {/* HOA NỞ RỘ TRÊN TÁN SỒI (KHI STAGE === FLOWERING)    */}
                  {/* =================================================== */}
                  {tree.stage === "flowering" && (
                    <g className="animate-pulse">
                      {[
                        [130, 220], [390, 220], [170, 150], [350, 150],
                        [260, 90], [210, 80], [310, 80], [220, 230], [300, 230]
                      ].map(([fx, fy], idx) => (
                        <g key={idx} transform={`translate(${fx}, ${fy})`}>
                          <circle cx="0" cy="-6" r="5.5" fill="#ffffff" />
                          <circle cx="0" cy="6" r="5.5" fill="#ffffff" />
                          <circle cx="-6" cy="0" r="5.5" fill="#ffffff" />
                          <circle cx="6" cy="0" r="5.5" fill="#ffffff" />
                          <circle cx="-4" cy="-4" r="5" fill="#fce7f3" />
                          <circle cx="4" cy="4" r="5" fill="#fce7f3" />
                          <circle cx="0" cy="0" r="4" fill="#facc15" />
                        </g>
                      ))}
                    </g>
                  )}

                  {/* =================================================== */}
                  {/* KẾT QUẢ MỌNG TRÊN TÁN SỒI (KHI STAGE === FRUITING)  */}
                  {/* =================================================== */}
                  {tree.stage === "fruiting" && tree.fruitsCount > 0 && (
                    <g>
                      {[
                        [140, 235], [380, 235], [185, 160], [335, 160], [260, 110]
                      ].slice(0, tree.fruitsCount).map(([rx, ry], idx) => (
                        <g
                          key={idx}
                          onClick={handleHarvest}
                          className="fruit-bouncing"
                          transform={`translate(${rx}, ${ry})`}
                          filter="url(#fruit-drop)"
                        >
                          <path d="M0 -14 Q4 -20 10 -18" stroke="#14532d" strokeWidth="2.5" fill="none" />
                          <path d="M6 -19 C12 -23 16 -18 10 -17" fill="#4ade80" />
                          <circle cx="0" cy="0" r="13" fill="url(#oak-fruit)" />
                          <ellipse cx="-4" cy="-4" rx="4" ry="2" fill="#ffffff" opacity="0.8" transform="rotate(-30, -4, -4)" />
                          <circle cx="3" cy="5" r="1.5" fill="#ffffff" opacity="0.4" />
                        </g>
                      ))}
                    </g>
                  )}
                </g>
              )}
            </svg>
          </div>

          {/* DỤNG CỤ LÀM VƯỜN & NÚT HÀNH ĐỘNG TƯƠNG TÁC */}
          <div className="flex w-full flex-wrap items-center justify-center gap-3 pt-2 border-t border-line-soft">
            {tree.isDead ? (
              <button
                type="button"
                onClick={handleReplant}
                className="flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-brand-deep active:scale-95 animate-pulse"
              >
                <span className="text-base">🌱</span>
                <span>Cây đã chết — Gieo hạt nuôi lại từ đầu</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleWater}
                  disabled={isWatering}
                  className="flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition-[background-color,transform] hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                >
                  <span className="text-base">🚰</span>
                  <span>Tưới nước (+30%)</span>
                </button>

                <button
                  type="button"
                  onClick={handleFertilize}
                  disabled={isFertilizing}
                  className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition-[background-color,transform] hover:bg-emerald-800 active:scale-95 disabled:opacity-50"
                >
                  <span className="text-base">🧪</span>
                  <span>Bón phân (+25 EXP)</span>
                </button>

                {tree.stage === "fruiting" && tree.harvestReady && (
                  <button
                    type="button"
                    onClick={handleHarvest}
                    className="flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-md animate-bounce hover:bg-amber-600 active:scale-95"
                  >
                    <span className="text-base">🍎</span>
                    <span>Thu hoạch quả (+25 xu)</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* BẢNG CHỈ SỐ SINH TRƯỞNG & ĐIỀU KIỆN SỐNG */}
        <div className="flex flex-col gap-6">
          <div className="rounded-3xl border border-line bg-white p-6 shadow-xs">
            <h2 className="text-lg font-bold text-ink">Chỉ số sinh tồn của cây</h2>
            <p className="mt-1 text-xs text-muted">
              Cây cần đủ độ ẩm để sống. Nếu nước về 0%, cây sẽ héo khô và ngừng tăng trưởng.
            </p>

            {/* Thanh đo lượng nước */}
            <div className="mt-5 flex flex-col gap-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-blue-700">
                  <span>💧</span> Lượng nước duy trì:
                </span>
                <span className={tree.water <= 20 ? "text-red-600 font-extrabold" : "text-blue-900"}>
                  {tree.water}% {tree.water <= 20 && "(Báo động khô hạn!)"}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-blue-100">
                <div
                  className={`h-full transition-all duration-500 ${
                    tree.water <= 20 ? "bg-red-500" : tree.water <= 50 ? "bg-amber-400" : "bg-blue-500"
                  }`}
                  style={{ width: `${tree.water}%` }}
                />
              </div>
            </div>

            {/* Thanh đo EXP phát triển */}
            <div className="mt-5 flex flex-col gap-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-800">
                  <span>🌱</span> Tiến trình lớn lên:
                </span>
                <span className="text-emerald-950">
                  {tree.exp} / {tree.maxExp} EXP
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full bg-brand transition-all duration-500"
                  style={{ width: `${Math.min(100, (tree.exp / tree.maxExp) * 100)}%` }}
                />
              </div>
            </div>

            {/* Tóm tắt giai đoạn hiện tại */}
            <div className="mt-6 rounded-2xl bg-surface-2 p-4 text-xs">
              <p className="font-bold text-ink">Giai đoạn: {currentStage.name}</p>
              <p className="mt-1 leading-relaxed text-muted">{currentStage.desc}</p>
            </div>
          </div>

          {/* VÍ XU VÀ CƠ CHẾ NHẬN THƯỞNG */}
          <div className="rounded-3xl border border-line bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-ink">Cơ chế tặng EcoLink Coin</h3>
            <div className="mt-3.5 flex flex-col gap-3 text-xs leading-relaxed text-body">
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800 font-bold">
                  +3
                </span>
                <p>Mỗi lần tưới nước bổ sung độ ẩm, cây sẽ tặng bạn 3 EcoLink Coin.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800 font-bold">
                  +6
                </span>
                <p>Mỗi lần bón phân hữu cơ kích thích cây lớn nhanh, bạn nhận 6 EcoLink Coin.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800 font-bold">
                  +25
                </span>
                <p>Khi cây đơm hoa kết trái, bấm thu hoạch để nhận ngay 25 EcoLink Coin!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
