import type { VirtualTreeDto } from "@/lib/gamificationApi"

/** Tiện ích và trạng thái dùng chung cho Cây Ảo EcoLink (`/ecofacts` & nút truy cập nhanh). */

export type TreeStage = "seed" | "sprout" | "sapling" | "mature" | "flowering" | "fruiting"

export const STAGES: { id: TreeStage; name: string; reqExp: number; desc: string }[] = [
  { id: "seed", name: "Hạt mầm", reqExp: 40, desc: "Hạt mầm vừa gieo xuống lớp đất ẩm, cần tưới nước đều đặn." },
  { id: "sprout", name: "Chồi non", reqExp: 80, desc: "Chồi non vươn lên đón nắng, bắt đầu cần dinh dưỡng hữu cơ." },
  { id: "sapling", name: "Cây con", reqExp: 140, desc: "Thân cây cứng cáp dần, đâm chồi nảy lộc và tỏa bóng mát." },
  { id: "mature", name: "Cây trưởng thành", reqExp: 220, desc: "Cây xanh cổ thụ vững chãi, hấp thụ khí CO2 mỗi ngày." },
  { id: "flowering", name: "Ra hoa", reqExp: 300, desc: "Những đóa hoa nở rộ báo hiệu mùa quả ngọt sắp đến." },
  { id: "fruiting", name: "Kết quả ngọt", reqExp: 380, desc: "Cây trĩu quả tái chế! Thu hoạch để nhận thật nhiều EcoLink Coin." },
]

export const STORAGE_KEY = "ecolink:virtual-tree-v1"
export const LIVE_PREVIEW_KEY = "ecolink:tree-fab-live-v1"

export interface TreePreviewSnapshot {
  stage: TreeStage
  label: string
  water: number | null
  isDead: boolean
  harvestReady: boolean
}

export function buildLiveTreePreview(dto: VirtualTreeDto): TreePreviewSnapshot {
  const stage = dto.harvestReady ? "fruiting" : stageForBackendLevel(dto.level)
  const water = dto.isWilted
    ? 0
    : Math.min(100, Math.max(0, Math.round(dto.hydrationPercent)))
  return {
    stage,
    label: dto.isWilted ? "Héo khô" : dto.levelTitle || getStageName(stage),
    water,
    isDead: dto.isWilted,
    harvestReady: dto.harvestReady,
  }
}

export function saveLiveTreePreview(userKey: string, dto: VirtualTreeDto): TreePreviewSnapshot {
  const snapshot = buildLiveTreePreview(dto)
  if (typeof window !== "undefined" && userKey) {
    try {
      localStorage.setItem(LIVE_PREVIEW_KEY, JSON.stringify({ userKey, data: snapshot }))
    } catch {}
  }
  return snapshot
}

export function readLiveTreePreview(userKey: string): TreePreviewSnapshot | null {
  if (typeof window === "undefined" || !userKey) return null
  try {
    const raw = localStorage.getItem(LIVE_PREVIEW_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { userKey?: string; data?: Partial<TreePreviewSnapshot> }
    if (parsed.userKey !== userKey || !parsed.data) return null
    const d = parsed.data
    if (!d.stage || !STAGE_IDS.has(d.stage)) return null
    const water =
      typeof d.water === "number" && Number.isFinite(d.water)
        ? Math.min(100, Math.max(0, Math.round(d.water)))
        : null
    return {
      stage: d.stage,
      label: typeof d.label === "string" && d.label ? d.label : getStageName(d.stage),
      water,
      isDead: Boolean(d.isDead),
      harvestReady: Boolean(d.harvestReady),
    }
  } catch {
    return null
  }
}

export function clearLiveTreePreview(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(LIVE_PREVIEW_KEY)
  } catch {}
}

const STAGE_IDS = new Set<TreeStage>(STAGES.map((s) => s.id))

export function getDefaultFrameForStage(stage: TreeStage): number {
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

export function getFrameSrc(frame: number): string {
  const safeFrame = Math.max(1, Math.min(70, Math.floor(frame)))
  return `/assets/tree/tree_frame_${String(safeFrame).padStart(3, "0")}.webp`
}

export function stageForBackendLevel(level: number): TreeStage {
  if (level <= 1) return "seed"
  if (level === 2) return "sprout"
  if (level === 3) return "sapling"
  if (level === 4) return "mature"
  if (level === 5) return "flowering"
  return "fruiting"
}

export function getStageName(stage: TreeStage): string {
  return STAGES.find((s) => s.id === stage)?.name ?? "Hạt mầm"
}

export function getEcoFactLevelNumbers(
  levels?: { level: number }[] | null,
  facts?: { unlockTreeLevel: number }[] | null,
): number[] {
  const set = new Set<number>()
  if (levels && levels.length > 0) {
    for (const lv of levels) {
      if (lv.level >= 1) set.add(lv.level)
    }
  } else {
    for (const lv of [1, 2, 3, 4]) set.add(lv)
  }
  if (facts) {
    for (const f of facts) {
      if (f.unlockTreeLevel >= 1) set.add(f.unlockTreeLevel)
    }
  }
  return Array.from(set).sort((a, b) => a - b)
}

/** Căn chỉnh và phóng to khung ảnh cây WebP theo đúng tỷ lệ từng giai đoạn trong lòng nút tròn. */
export function getTreeAvatarImgClass(stage: TreeStage): string {
  switch (stage) {
    case "seed":
      return "size-full object-cover object-[50%_78%] origin-[50%_78%] scale-[2.65]"
    case "sprout":
      return "size-full object-cover object-[50%_70%] origin-[50%_70%] scale-[2.05]"
    case "sapling":
      return "size-full object-cover object-[50%_54%] origin-[50%_54%] scale-[1.34]"
    case "mature":
      return "size-full object-cover object-[50%_52%] origin-[50%_52%] scale-[1.35]"
    case "flowering":
    case "fruiting":
      return "size-full object-cover object-[50%_52%] origin-[50%_52%] scale-[1.38]"
    default:
      return "size-full object-cover object-center scale-[1.35]"
  }
}

export interface StoredTreePreview {
  stage: TreeStage
  water: number
  isDead: boolean
  harvestReady: boolean
}

export function readStoredTreePreview(): StoredTreePreview | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      stage?: TreeStage
      water?: number
      isDead?: boolean
      harvestReady?: boolean
    }
    if (!parsed.stage || !STAGE_IDS.has(parsed.stage)) return null
    const isDead = Boolean(parsed.isDead)
    const rawWater = typeof parsed.water === "number" && Number.isFinite(parsed.water) ? parsed.water : 80
    const water = isDead ? 0 : Math.min(100, Math.max(0, Math.round(rawWater)))
    return {
      stage: parsed.stage,
      water,
      isDead,
      harvestReady: Boolean(parsed.harvestReady),
    }
  } catch {
    return null
  }
}
