import { Suspense } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import Layout from "@/components/Layout"
import AuthLayout from "@/components/AuthLayout"
import Portal from "@/components/Portal"
import AdminShell from "@/components/admin/Shell"
import RequireRole from "@/components/RequireRole"

import { PAGES } from "@/lazyPages"

/** Trang nạp theo route (xem `src/lazyPages.ts`) - không import tĩnh ở đây
 *  nữa, để bundle không kéo toàn bộ project vào lần mở đầu tiên. */
const {
  Home, Blog, BlogDetail, Rewards, LeaderboardPage, Scanner, MapPage, Partners,
  Feedback, Guidance, Waste, Chat, JoinRecycler, ResetPassword, Terms, EcoFactsPage,
  Login, Register, Logout, NotFound,
  Profile, Notifications, Password,
  UserHome, Handover, Receipt, Payout, Transactions, Gamification,
  RecyclerHome, Requests, Catalog, RecyclerReceipt,
  StaffHome, AiReview, Dataset, Applications, Complaints, Accounts, BlogEditor,
  EcoFacts, Gifts, StaffCheckIn,
  AdminHome, Reports, StaffAccounts, Permissions, BlogReview, Categories, Policy,
  GamificationConfig, LeaderboardConfig, Fees, Reconciliation, AccountProfile,
  AccountPassword,
} = PAGES

/** Mọi route sau đăng nhập đều khai báo vai trò được vào. Không có route nào
 *  "ai cũng vào được": mọi chức năng đều thuộc đúng một vai trò trong tài
 *  liệu use case.
 *
 *  Tách `AppRoutes` ra khỏi `App` để test được: `check.tsx` render cây route
 *  thật với `MemoryRouter`, nếu không thì mọi route đều chỉ được test bằng
 *  cách render lẻ từng component — hỏng phần ghép route (RequireRole, Portal,
 *  Layout) thì test vẫn xanh. */
export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* auth pages own the whole screen — no nav, no footer */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
        <Route path="/logout" element={<Logout />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<Layout />}>
          {/* ---- công khai: G-01, và các trang khách xem được ---- */}
          <Route index element={<Home />} />
          <Route path="blog" element={<Blog />} />
          <Route path="blog/:slug" element={<BlogDetail />} />
          <Route path="rewards" element={<Rewards />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="scanner" element={<Scanner />} />
          <Route path="map" element={<MapPage />} />
          <Route path="partners" element={<Partners />} />
          <Route path="feedback" element={<Feedback />} />
          {/* U-02 hướng dẫn phân loại · U-03 tra cứu loại rác · U-04 báo AI sai */}
          <Route path="guidance" element={<Guidance />} />
          <Route path="waste" element={<Waste />} />
          {/* U-05 đăng ký cơ sở thu mua */}
          <Route path="join-recycler" element={<JoinRecycler />} />
          <Route path="terms" element={<Terms />} />
          <Route path="ecofacts" element={<EcoFactsPage />} />

          {/* ---- sau đăng nhập, dùng chung SU-01..SU-04 ---- */}
          <Route path="account">
            <Route path="profile" element={<Profile />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="password" element={<Password />} />
          </Route>

          {/* U-09 / R-05 chatbox: hai vai trò cùng chat với nhau */}
          <Route
            path="chat"
            element={
              <RequireRole roles={["user", "recycler"]}>
                <Chat />
              </RequireRole>
            }
          />

          {/* ---- phân hệ USER ---- */}
          <Route element={<RequireRole roles={["user"]}><Portal role="user" /></RequireRole>}>
            <Route path="user">
              <Route index element={<UserHome />} />
              <Route path="handover" element={<Handover />} />
              <Route path="receipt" element={<Receipt />} />
              <Route path="payout" element={<Payout />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="gamification" element={<Gamification />} />
            </Route>
          </Route>

          {/* ---- phân hệ RECYCLER ---- */}
          <Route element={<RequireRole roles={["recycler"]}><Portal role="recycler" /></RequireRole>}>
            <Route path="recycler">
              <Route index element={<RecyclerHome />} />
              <Route path="requests" element={<Requests />} />
              <Route path="catalog" element={<Catalog />} />
              <Route path="receipt" element={<RecyclerReceipt />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>

          {/* ---- phân hệ STAFF ----
              Nằm NGOÀI <Layout> như admin: khu vực làm việc nội bộ không mượn
              navbar, footer và tab-bar của app công khai. */}
          <Route
            path="/staff"
            element={
              <RequireRole roles={["staff"]}>
                <AdminShell role="staff" />
              </RequireRole>
            }
          >
            <Route index element={<StaffHome />} />
            <Route path="ai-review" element={<AiReview />} />
            <Route path="dataset" element={<Dataset />} />
            <Route path="applications" element={<Applications />} />
            <Route path="complaints" element={<Complaints />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="blog" element={<BlogEditor />} />
            <Route path="ecofacts" element={<EcoFacts />} />
            <Route path="gifts" element={<Gifts />} />
            <Route path="checkin" element={<StaffCheckIn />} />
            <Route path="account" element={<AccountProfile />} />
            <Route path="account/password" element={<AccountPassword />} />
          </Route>

          {/* ---- phân hệ ADMIN ----
              CÙNG khung với staff (components/admin/Shell), cùng lý do: không
              mượn navbar, footer và tab-bar của app công khai. */}
          <Route
            path="/admin"
            element={
              <RequireRole roles={["admin"]}>
                <AdminShell role="admin" />
              </RequireRole>
            }
          >
            <Route index element={<AdminHome />} />
            <Route path="reports" element={<Reports />} />
            <Route path="staff" element={<StaffAccounts />} />
            <Route path="permissions" element={<Permissions />} />
            <Route path="blog" element={<BlogReview />} />
            <Route path="categories" element={<Categories />} />
            <Route path="policy" element={<Policy />} />
            <Route path="gamification" element={<GamificationConfig />} />
            <Route path="leaderboard" element={<LeaderboardConfig />} />
            <Route path="fees" element={<Fees />} />
            <Route path="reconciliation" element={<Reconciliation />} />
            <Route path="account" element={<AccountProfile />} />
            <Route path="account/password" element={<AccountPassword />} />
          </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}