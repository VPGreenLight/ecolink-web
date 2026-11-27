import { Suspense, useEffect } from "react"
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom"
import AuthLayout from "@/components/AuthLayout"
import Layout from "@/components/Layout"
import Portal from "@/components/Portal"
import AdminShell from "@/components/admin/Shell"
import RequireRole from "@/components/RequireRole"
import { ROLE_HOME, signOut, syncSessionState, useSession, type Role } from "@/lib/session"

import { PAGES } from "@/lazyPages"

/** Trang nạp theo route (xem `src/lazyPages.ts`) - không import tĩnh ở đây
 *  nữa, để bundle không kéo toàn bộ project vào lần mở đầu tiên. */
const {
  Home, Blog, BlogDetail, Rewards, LeaderboardPage, Scanner, MapPage,
  Feedback, Guidance, Waste, Chat, JoinRecycler, ResetPassword, Terms, EcoFactsPage,
  Login, Register, Logout, NotFound,
  Profile, Password,
  Receipt, Payout, Transactions, Gamification,
  RecyclerHome, RecyclerFacility, RecyclerReviews, RecyclerPackages, Requests, Catalog, RecyclerReceipt,
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
function StaffWorkspaceShell() {
  const session = useSession()
  return <AdminShell role={session?.role === "admin" ? "admin" : "staff"} />
}

function GlobalAuthListener() {
  const navigate = useNavigate()

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "AUTH_SUCCESS") {
        const session = syncSessionState(e.data?.session)
        const role = (e.data?.role as Role) || session?.role || "user"
        navigate(role === "user" ? "/" : ROLE_HOME[role] || "/")
      } else if (e.data?.type === "AUTH_LOGOUT") {
        signOut()
        navigate("/")
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [navigate])

  return null
}

export function AppRoutes() {
  return (
    <>
    <GlobalAuthListener />
    <Suspense fallback={null}>
      <Routes>
        <Route path="/logout" element={<Logout />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* auth pages own the whole screen — no nav, no footer */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<Layout />}>
          {/* ---- công khai: G-01, và các trang khách xem được ---- */}
          <Route index element={<Home />} />
          <Route path="blog" element={<Blog />} />
          <Route path="blog/:slug" element={<BlogDetail />} />
          <Route path="rewards" element={<Rewards />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="scanner" element={<Scanner />} />
          <Route path="map" element={<MapPage />} />
          <Route path="feedback" element={<Feedback />} />
          {/* U-02 hướng dẫn phân loại · U-03 tra cứu loại rác · U-04 báo AI sai */}
          <Route path="guidance" element={<Guidance />} />
          <Route path="waste" element={<Waste />} />
          {/* U-05 đăng ký cơ sở thu mua */}
          <Route path="join-recycler" element={<JoinRecycler />} />
          <Route path="terms" element={<Terms />} />
          <Route path="ecofacts" element={<EcoFactsPage />} />

          {/* ---- sau đăng nhập, dùng chung SU-01..SU-04 ---- */}
          <Route
            path="account"
            element={
              <RequireRole roles={["user", "recycler", "staff", "admin"]}>
                <Outlet />
              </RequireRole>
            }
          >
            <Route path="profile" element={<Profile />} />
            <Route path="notifications" element={<Navigate to="/account/profile" replace />} />
            <Route path="password" element={<Password />} />
          </Route>

          {/* U-09 / R-05 chatbox: trang trò chuyện độc lập cho User & Recycler (không kèm Sidebar Portal) */}
          <Route
            element={
              <RequireRole roles={["user", "recycler"]}>
                <Outlet />
              </RequireRole>
            }
          >
            <Route path="chat" element={<Chat />} />
          </Route>

          {/* ---- phân hệ USER ---- */}
          <Route element={<RequireRole roles={["user"]}><Outlet /></RequireRole>}>
            <Route path="user/handover" element={<Navigate to="/chat?newHandover=1" replace />} />
            <Route path="user/receipt" element={<Receipt />} />
            <Route path="user/payout" element={<Payout />} />
            <Route path="user/subscription" element={<Payout />} />
            <Route path="user/transactions" element={<Transactions />} />
            <Route path="user/gamification" element={<Gamification />} />
          </Route>

          {/* ---- phân hệ RECYCLER ---- */}
          <Route element={<RequireRole roles={["recycler"]}><Outlet /></RequireRole>}>
            <Route path="recycler/packages" element={<RecyclerPackages />} />
          </Route>
          <Route element={<RequireRole roles={["recycler"]}><Portal role="recycler" /></RequireRole>}>
            <Route path="recycler">
              <Route index element={<RecyclerHome />} />
              <Route path="requests" element={<Requests />} />
              <Route path="catalog" element={<Catalog />} />
              <Route path="receipt" element={<RecyclerReceipt />} />
              <Route path="facility" element={<RecyclerFacility />} />
              <Route path="reviews" element={<RecyclerReviews />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>

          {/* ---- phân hệ STAFF ----
              Nằm NGOÀI <Layout> như admin: khu vực làm việc nội bộ không mượn
              navbar, footer và tab-bar của app công khai.
              Cho phép Admin điều hướng thẳng vào các hàng đợi xử lý từ Dashboard Admin. */}
          <Route
            path="/staff"
            element={
              <RequireRole roles={["staff", "admin"]}>
                <StaffWorkspaceShell />
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
  </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}