import { lazy } from "react"
import type { ComponentType } from "react"

/** Nạp trang theo route thay vì import tĩnh trong `App.tsx`.
 *
 *  Trước đây `App.tsx` import tĩnh cả 56 trang nên trình duyệt phải tải toàn
 *  bộ cây module của project ngay lần mở đầu tiên (một chunk 1.1 MB). Ở đây
 *  mỗi trang là một chunk riêng, chỉ tải khi vào route đó.
 *
 *  `preloadPages()` dùng cho `check-routes.tsx`: `renderToStaticMarkup` chạy
 *  đồng bộ, `lazy` chưa resolve sẽ render ra fallback nên phải nạp trước. */
const loaders = {
  Home: () => import("@/pages/Home"),
  Blog: () => import("@/pages/Blog"),
  BlogDetail: () => import("@/pages/BlogDetail"),
  Rewards: () => import("@/pages/Rewards"),
  LeaderboardPage: () => import("@/pages/Leaderboard"),
  Scanner: () => import("@/pages/Scanner"),
  MapPage: () => import("@/pages/MapPage"),
  Feedback: () => import("@/pages/Feedback"),
  Guidance: () => import("@/pages/Guidance"),
  Waste: () => import("@/pages/Waste"),
  Chat: () => import("@/pages/Chat"),
  JoinRecycler: () => import("@/pages/JoinRecycler"),
  ResetPassword: () => import("@/pages/ResetPassword"),
  Terms: () => import("@/pages/Terms"),
  EcoFactsPage: () => import("@/pages/EcoFactsPage"),
  Login: () => import("@/pages/Login"),
  Register: () => import("@/pages/Register"),
  Logout: () => import("@/pages/Logout"),
  NotFound: () => import("@/pages/NotFound"),

  Profile: () => import("@/pages/account/Profile"),
  Password: () => import("@/pages/account/Password"),

  Receipt: () => import("@/pages/user/Receipt"),
  Payout: () => import("@/pages/user/Payout"),
  Transactions: () => import("@/pages/user/Transactions"),
  Gamification: () => import("@/pages/user/Gamification"),

  RecyclerHome: () => import("@/pages/recycler/Home"),
  Requests: () => import("@/pages/recycler/Requests"),
  Catalog: () => import("@/pages/recycler/Catalog"),
  RecyclerReceipt: () => import("@/pages/recycler/Receipt"),

  StaffHome: () => import("@/pages/staff/Home"),
  AiReview: () => import("@/pages/staff/AiReview"),
  Dataset: () => import("@/pages/staff/Dataset"),
  Applications: () => import("@/pages/staff/Applications"),
  Complaints: () => import("@/pages/staff/Complaints"),
  Accounts: () => import("@/pages/staff/Accounts"),
  BlogEditor: () => import("@/pages/staff/BlogEditor"),
  EcoFacts: () => import("@/pages/staff/EcoFacts"),
  Gifts: () => import("@/pages/staff/Gifts"),
  StaffCheckIn: () => import("@/pages/staff/CheckIn"),

  AdminHome: () => import("@/pages/admin/Home"),
  Reports: () => import("@/pages/admin/Reports"),
  StaffAccounts: () => import("@/pages/admin/StaffAccounts"),
  Permissions: () => import("@/pages/admin/Permissions"),
  BlogReview: () => import("@/pages/admin/BlogReview"),
  Categories: () => import("@/pages/admin/Categories"),
  Policy: () => import("@/pages/admin/Policy"),
  GamificationConfig: () => import("@/pages/admin/Gamification"),
  LeaderboardConfig: () => import("@/pages/admin/Leaderboard"),
  Fees: () => import("@/pages/admin/Fees"),
  Reconciliation: () => import("@/pages/admin/Reconciliation"),
  AccountProfile: () => import("@/pages/admin/AccountProfile"),
  AccountPassword: () => import("@/pages/admin/AccountPassword"),
}

export type PageName = keyof typeof loaders

export const PAGES = Object.fromEntries(
  (Object.keys(loaders) as PageName[]).map((name) => [
    name,
    lazy(loaders[name] as () => Promise<{ default: ComponentType }>),
  ]),
) as unknown as Record<PageName, ComponentType>

export function preloadPages(): Promise<unknown> {
  return Promise.all(Object.values(loaders).map((load) => load()))
}