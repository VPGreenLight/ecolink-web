/**
 * Client API cho Module Gamification & Rewards (FE-13 / M-10: STT 076 -> 102).
 * Tự động đồng bộ điểm tiêu dùng cục bộ (`setSpendPoints`) khi nhận dữ liệu ví / check-in / đổi quà / nâng cây.
 */

import { apiRequest, type ApiResponse } from "@/lib/api"
import { setSpendPoints } from "@/data/rewards"

export interface GamPagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}

export interface WalletDto {
  balance: number
  totalEarned: number
  totalSpent: number
  updatedAt: string
}

export interface PointTransactionDto {
  id: string
  points: number
  actionType: string
  sourceType?: string | null
  sourceId?: string | null
  description?: string | null
  createdAt: string
}

export interface CheckinDayDto {
  date: string
  checkedIn: boolean
  pointsAwarded: number
}

export interface CheckinStatusDto {
  checkedInToday: boolean
  currentStreak: number
  nextStreak: number
  streakWillReset: boolean
  todayRewardPreview: number
  dailyCapRemaining: number
  walletBalance: number
  calendar: CheckinDayDto[]
}

export interface CheckinResultDto {
  pointsAwarded: number
  streakCount: number
  walletBalance: number
  limitedByDailyCap: boolean
}

export interface GiftItemDto {
  id: string
  name: string
  type: "Physical" | "Voucher" | string
  description?: string | null
  imageUrl?: string | null
  pointsRequired: number
  stockQuantity: number
  inStock: boolean
  status: "ACTIVE" | "INACTIVE" | string
  createdAt: string
  updatedAt: string
}

export interface RedemptionGiftInfoDto {
  id: string
  name: string
  type: string
  imageUrl?: string | null
}

export interface RedemptionDto {
  id: string
  redemptionCode: string
  gift: RedemptionGiftInfoDto
  pointsSpent: number
  quantity: number
  voucherCode?: string | null
  expiresAt?: string | null
  status: "Pending" | "Redeemed" | "Delivered" | "Expired" | "Cancelled" | string
  deliveryAddress?: string | null
  redeemedAt: string
  fulfilledAt?: string | null
  userName?: string | null
}

export interface RedeemResultDto {
  redemption: RedemptionDto
  walletBalance: number
}

export interface SaveGiftPayload {
  name: string
  type: "Physical" | "Voucher"
  description?: string | null
  imageUrl?: string | null
  pointsRequired: number
  stockQuantity: number
}

export interface ImportVouchersResultDto {
  giftId: string
  importedCount: number
  newStockQuantity: number
}

export interface EcoFactItemDto {
  id: string
  code: string
  title: string
  content: string
  sourceUrl?: string | null
  imageUrl?: string | null
  unlockTreeLevel: number
  status: "ACTIVE" | "INACTIVE" | string
  createdAt: string
  updatedAt: string
}

export interface SaveEcoFactPayload {
  title: string
  content: string
  sourceUrl?: string | null
  imageUrl?: string | null
  unlockTreeLevel: number
}

export interface TreeLevelInfoDto {
  level: number
  title: string
  requiredPoints: number
  reached: boolean
}

export interface VirtualTreeDto {
  level: number
  levelTitle: string
  maxLevel: number
  isMaxLevel: boolean
  growthPoints: number
  totalWatered: number
  dailyWaterCount: number
  dailyLimit: number
  nextLevel?: number | null
  nextLevelTitle?: string | null
  upgradeCost?: number | null
  walletBalance: number
  progressPercent: number
  canUpgrade: boolean
  levels: TreeLevelInfoDto[]
  unlockedFactCount: number
  totalFactCount: number
}

export interface WaterTreeResultDto {
  tree: VirtualTreeDto
  pointsSpent: number
  unlockedFacts: EcoFactItemDto[]
}

export interface EcoProfileDto {
  userId: string
  currentGreenPoints: number
  totalLifetimePoints: number
  treeLevel: number
  treeStageTitle: string
  treeExperience: number
  experienceToNextLevel: number
  totalWasteScanned: number
  totalRecycledKg: number
  currentStreak: number
  co2SavedKg: number
}

export interface LeaderboardEntryDto {
  rank: number
  userId: string
  fullName: string
  area: string
  totalPoints: number
  periodPoints: number
  spendablePoints: number
  treeLevel: number
  totalRecycledKg: number
  isCurrentUser: boolean
  pointsNeededForNextRank: number
}

export interface LeaderboardWinnerDto {
  rank: number
  userId: string
  fullName: string
  area: string
  points: number
  bonusPointsAwarded: number
}

export interface LeaderboardCycleDto {
  id: string
  name: string
  periodType: "Weekly" | "Monthly" | "Quarterly" | string
  startsAt: string
  endsAt: string
  isActive: boolean
  status: "Upcoming" | "Active" | "Finalized" | "Cancelled" | string
  top1BonusPoints: number
  top2BonusPoints: number
  top3BonusPoints: number
  finalizedAt?: string | null
  winners: LeaderboardWinnerDto[]
  createdAt: string
  updatedAt: string
}

export interface LeaderboardViewDto {
  activeCycle?: LeaderboardCycleDto | null
  items: LeaderboardEntryDto[]
  myEntry?: LeaderboardEntryDto | null
}

export interface SaveLeaderboardCyclePayload {
  name: string
  periodType: "Weekly" | "Monthly" | "Quarterly"
  startsAt: string
  endsAt: string
  isActive: boolean
  top1BonusPoints: number
  top2BonusPoints: number
  top3BonusPoints: number
}

export interface PointRateDto {
  categoryCode: string
  pointsPerKg: number
}

export interface TreeLevelConfigDto {
  level: number
  title: string
  requiredPoints: number
}

export interface GamificationConfigDto {
  dailyNonTransactionCap: number
  checkinBasePoints: number
  streakBonusIncrement: number
  streakBonusCap: number
  dailyTreeCareLimit: number
  voucherValidityDays: number
  defaultPointsPerKg: number
  pointRates: PointRateDto[]
  treeLevels: TreeLevelConfigDto[]
  updatedAt?: string | null
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      sp.set(k, String(v))
    }
  }
  const qs = sp.toString()
  return qs ? `?${qs}` : ""
}

// ============================================================
// Public / Citizen / Recycler
// ============================================================

export function fetchMyEcoProfile(): Promise<ApiResponse<EcoProfileDto>> {
  return apiRequest<EcoProfileDto>("/api/v1/gamification/profile/me")
}

export function fetchLeaderboard(params?: {
  top?: number
  period?: string
  cycleId?: string
}): Promise<ApiResponse<LeaderboardViewDto>> {
  const qs = buildQuery({
    top: params?.top,
    period: params?.period,
    cycleId: params?.cycleId,
  })
  return apiRequest<LeaderboardViewDto>(`/api/v1/gamification/leaderboard${qs}`)
}

export async function fetchCheckinStatus(): Promise<ApiResponse<CheckinStatusDto>> {
  const res = await apiRequest<CheckinStatusDto>("/api/v1/gamification/check-in/status")
  if (typeof res.data?.walletBalance === "number") setSpendPoints(res.data.walletBalance)
  return res
}

export async function performDailyCheckin(): Promise<ApiResponse<CheckinResultDto>> {
  const res = await apiRequest<CheckinResultDto>("/api/v1/gamification/check-in", {
    method: "POST",
  })
  if (typeof res.data?.walletBalance === "number") setSpendPoints(res.data.walletBalance)
  return res
}

export async function fetchPointWallet(): Promise<ApiResponse<WalletDto>> {
  const res = await apiRequest<WalletDto>("/api/v1/gamification/points/wallet")
  if (typeof res.data?.balance === "number") setSpendPoints(res.data.balance)
  return res
}

export function fetchPointLedger(params?: {
  actionType?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<GamPagedResult<PointTransactionDto>>> {
  const qs = buildQuery({
    actionType: params?.actionType,
    page: params?.page,
    pageSize: params?.pageSize,
  })
  return apiRequest<GamPagedResult<PointTransactionDto>>(`/api/v1/gamification/points/ledger${qs}`)
}

export function fetchAvailableGifts(params?: {
  type?: string
  sort?: "points_asc" | "points_desc" | "newest"
  search?: string
}): Promise<ApiResponse<GiftItemDto[]>> {
  const qs = buildQuery({
    type: params?.type,
    sort: params?.sort,
    search: params?.search,
  })
  return apiRequest<GiftItemDto[]>(`/api/v1/gamification/gifts${qs}`)
}

export async function redeemGift(payload: {
  giftId: string
  quantity?: number
  deliveryAddress?: string
}): Promise<ApiResponse<RedeemResultDto>> {
  const res = await apiRequest<RedeemResultDto>("/api/v1/gamification/redemptions", {
    method: "POST",
    body: JSON.stringify({
      giftId: payload.giftId,
      quantity: payload.quantity ?? 1,
      deliveryAddress: payload.deliveryAddress,
    }),
  })
  if (typeof res.data?.walletBalance === "number") setSpendPoints(res.data.walletBalance)
  return res
}

export function fetchMyRedemptions(params?: {
  status?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<GamPagedResult<RedemptionDto>>> {
  const qs = buildQuery({
    status: params?.status,
    page: params?.page,
    pageSize: params?.pageSize,
  })
  return apiRequest<GamPagedResult<RedemptionDto>>(`/api/v1/gamification/redemptions/me${qs}`)
}

export async function fetchMyVirtualTree(): Promise<ApiResponse<VirtualTreeDto>> {
  const res = await apiRequest<VirtualTreeDto>("/api/v1/gamification/tree/me")
  if (typeof res.data?.walletBalance === "number") setSpendPoints(res.data.walletBalance)
  return res
}

export async function upgradeVirtualTree(): Promise<ApiResponse<WaterTreeResultDto>> {
  const res = await apiRequest<WaterTreeResultDto>("/api/v1/gamification/tree/upgrade", {
    method: "POST",
  })
  if (typeof res.data?.tree?.walletBalance === "number") {
    setSpendPoints(res.data.tree.walletBalance)
  }
  return res
}

export function fetchMyUnlockedEcoFacts(): Promise<ApiResponse<EcoFactItemDto[]>> {
  return apiRequest<EcoFactItemDto[]>("/api/v1/gamification/eco-facts/me")
}

// ============================================================
// Staff (S-09, S-10)
// ============================================================

export function fetchStaffEcoFacts(params?: {
  treeLevel?: number
  status?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<GamPagedResult<EcoFactItemDto>>> {
  const qs = buildQuery({
    treeLevel: params?.treeLevel,
    status: params?.status,
    search: params?.search,
    page: params?.page,
    pageSize: params?.pageSize,
  })
  return apiRequest<GamPagedResult<EcoFactItemDto>>(`/api/v1/staff/eco-facts${qs}`)
}

export function createStaffEcoFact(
  payload: SaveEcoFactPayload,
): Promise<ApiResponse<EcoFactItemDto>> {
  return apiRequest<EcoFactItemDto>("/api/v1/staff/eco-facts", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateStaffEcoFact(
  id: string,
  payload: SaveEcoFactPayload,
): Promise<ApiResponse<EcoFactItemDto>> {
  return apiRequest<EcoFactItemDto>(`/api/v1/staff/eco-facts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export function setStaffEcoFactStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<ApiResponse<EcoFactItemDto>> {
  return apiRequest<EcoFactItemDto>(`/api/v1/staff/eco-facts/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

export function deleteStaffEcoFact(id: string): Promise<ApiResponse<Record<string, never>>> {
  return apiRequest<Record<string, never>>(`/api/v1/staff/eco-facts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

export function fetchStaffGifts(params?: {
  type?: string
  status?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<GamPagedResult<GiftItemDto>>> {
  const qs = buildQuery({
    type: params?.type,
    status: params?.status,
    search: params?.search,
    page: params?.page,
    pageSize: params?.pageSize,
  })
  return apiRequest<GamPagedResult<GiftItemDto>>(`/api/v1/staff/gifts${qs}`)
}

export function createStaffGift(payload: SaveGiftPayload): Promise<ApiResponse<GiftItemDto>> {
  return apiRequest<GiftItemDto>("/api/v1/staff/gifts", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateStaffGift(
  id: string,
  payload: SaveGiftPayload,
): Promise<ApiResponse<GiftItemDto>> {
  return apiRequest<GiftItemDto>(`/api/v1/staff/gifts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export function restockStaffGift(
  id: string,
  quantity: number,
): Promise<ApiResponse<GiftItemDto>> {
  return apiRequest<GiftItemDto>(`/api/v1/staff/gifts/${encodeURIComponent(id)}/restock`, {
    method: "POST",
    body: JSON.stringify({ quantity }),
  })
}

export function importGiftVouchers(
  id: string,
  payload: { codes?: string[]; quantity?: number },
): Promise<ApiResponse<ImportVouchersResultDto>> {
  return apiRequest<ImportVouchersResultDto>(
    `/api/v1/staff/gifts/${encodeURIComponent(id)}/vouchers/import`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  )
}

export function setStaffGiftStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<ApiResponse<GiftItemDto>> {
  return apiRequest<GiftItemDto>(`/api/v1/staff/gifts/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

export function fetchStaffRedemptions(params?: {
  status?: string
  type?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<GamPagedResult<RedemptionDto>>> {
  const qs = buildQuery({
    status: params?.status,
    type: params?.type,
    search: params?.search,
    page: params?.page,
    pageSize: params?.pageSize,
  })
  return apiRequest<GamPagedResult<RedemptionDto>>(`/api/v1/staff/redemptions${qs}`)
}

export function fulfillStaffRedemption(
  id: string,
  payload?: { action?: "Fulfill" | "Cancel"; reason?: string },
): Promise<ApiResponse<RedemptionDto>> {
  return apiRequest<RedemptionDto>(`/api/v1/staff/redemptions/${encodeURIComponent(id)}/fulfill`, {
    method: "PATCH",
    body: JSON.stringify(payload ?? { action: "Fulfill" }),
  })
}

// ============================================================
// Admin (A-07, A-08)
// ============================================================

export function fetchGamificationConfig(): Promise<ApiResponse<GamificationConfigDto>> {
  return apiRequest<GamificationConfigDto>("/api/v1/admin/gamification/config")
}

export function updateGamificationConfig(
  payload: GamificationConfigDto,
): Promise<ApiResponse<GamificationConfigDto>> {
  return apiRequest<GamificationConfigDto>("/api/v1/admin/gamification/config", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export function resetGamificationConfig(): Promise<ApiResponse<GamificationConfigDto>> {
  return apiRequest<GamificationConfigDto>("/api/v1/admin/gamification/config/reset", {
    method: "POST",
  })
}

export function fetchLeaderboardCycles(): Promise<ApiResponse<LeaderboardCycleDto[]>> {
  return apiRequest<LeaderboardCycleDto[]>("/api/v1/admin/gamification/leaderboard-cycles")
}

export function createLeaderboardCycle(
  payload: SaveLeaderboardCyclePayload,
): Promise<ApiResponse<LeaderboardCycleDto>> {
  return apiRequest<LeaderboardCycleDto>("/api/v1/admin/gamification/leaderboard-cycles", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateLeaderboardCycle(
  cycleId: string,
  payload: SaveLeaderboardCyclePayload,
): Promise<ApiResponse<LeaderboardCycleDto>> {
  return apiRequest<LeaderboardCycleDto>(
    `/api/v1/admin/gamification/leaderboard-cycles/${encodeURIComponent(cycleId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  )
}

export function activateLeaderboardCycle(
  cycleId: string,
): Promise<ApiResponse<LeaderboardCycleDto>> {
  return apiRequest<LeaderboardCycleDto>(
    `/api/v1/admin/gamification/leaderboard-cycles/${encodeURIComponent(cycleId)}/activate`,
    { method: "PATCH" },
  )
}

export function finalizeLeaderboardCycle(
  cycleId: string,
): Promise<ApiResponse<LeaderboardCycleDto>> {
  return apiRequest<LeaderboardCycleDto>(
    `/api/v1/admin/gamification/leaderboard-cycles/${encodeURIComponent(cycleId)}/finalize`,
    { method: "POST" },
  )
}
