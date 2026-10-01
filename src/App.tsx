import { BrowserRouter, Route, Routes } from "react-router-dom"
import Layout from "@/components/Layout"
import Portal from "@/components/Portal"
import AdminShell from "@/components/admin/Shell"
import RequireRole from "@/components/RequireRole"

import Home from "@/pages/Home"
import Blog from "@/pages/Blog"
import Rewards from "@/pages/Rewards"
import LeaderboardPage from "@/pages/Leaderboard"
import Scanner from "@/pages/Scanner"
import MapPage from "@/pages/MapPage"
import Partners from "@/pages/Partners"
import Feedback from "@/pages/Feedback"
import Guidance from "@/pages/Guidance"
import Waste from "@/pages/Waste"
import Chat from "@/pages/Chat"
import JoinRecycler from "@/pages/JoinRecycler"
import ResetPassword from "@/pages/ResetPassword"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import NotFound from "@/pages/NotFound"

import Profile from "@/pages/account/Profile"
import Password from "@/pages/account/Password"

import UserHome from "@/pages/me/Home"
import Handover from "@/pages/me/Handover"
import Receipt from "@/pages/me/Receipt"
import Payout from "@/pages/me/Payout"
import Transactions from "@/pages/me/Transactions"
import Gamification from "@/pages/me/Gamification"

import RecyclerHome from "@/pages/recycler/Home"
import Requests from "@/pages/recycler/Requests"
import Catalog from "@/pages/recycler/Catalog"
import RecyclerReceipt from "@/pages/recycler/Receipt"

import StaffHome from "@/pages/staff/Home"
import AiReview from "@/pages/staff/AiReview"
import Dataset from "@/pages/staff/Dataset"
import Applications from "@/pages/staff/Applications"
import Complaints from "@/pages/staff/Complaints"
import Accounts from "@/pages/staff/Accounts"
import BlogEditor from "@/pages/staff/BlogEditor"
import EcoFacts from "@/pages/staff/EcoFacts"
import Gifts from "@/pages/staff/Gifts"
import StaffCheckIn from "@/pages/staff/CheckIn"

import AdminHome from "@/pages/admin/Home"
import Reports from "@/pages/admin/Reports"
import StaffAccounts from "@/pages/admin/StaffAccounts"
import Permissions from "@/pages/admin/Permissions"
import BlogReview from "@/pages/admin/BlogReview"
import Categories from "@/pages/admin/Categories"
import Policy from "@/pages/admin/Policy"
import GamificationConfig from "@/pages/admin/Gamification"
import LeaderboardConfig from "@/pages/admin/Leaderboard"
import Fees from "@/pages/admin/Fees"
import Reconciliation from "@/pages/admin/Reconciliation"

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
    <Routes>
        {/* auth pages own the whole screen — no nav, no footer */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<Layout />}>
          {/* ---- công khai: G-01, và các trang khách xem được ---- */}
          <Route index element={<Home />} />
          <Route path="blog" element={<Blog />} />
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

          {/* ---- sau đăng nhập, dùng chung SU-01..SU-04 ---- */}
          <Route path="account">
            <Route path="profile" element={<Profile />} />
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
            <Route path="me">
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

          {/* ---- phân hệ STAFF ---- */}
          <Route element={<RequireRole roles={["staff"]}><Portal role="staff" /></RequireRole>}>
            <Route path="staff">
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
            </Route>
          </Route>

          {/* ---- phân hệ ADMIN ----
              CỐ TÌNH nằm NGOÀI <Layout>: console quản trị có khung riêng
              (components/admin/Shell), không mượn navbar, footer và tab-bar của
              app công khai. */}
          <Route
            path="/admin"
            element={
              <RequireRole roles={["admin"]}>
                <AdminShell />
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
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}