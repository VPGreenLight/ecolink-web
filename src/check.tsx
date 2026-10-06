/**
 * Render smoke-test: every page must render to HTML with its key content.
 * Run with `npm run check` (builds src/check.tsx as an SSR bundle, then runs it).
 *
 *  Trang sau đăng nhập được render trực tiếp (không qua RequireRole) vì trên
 *  server không có localStorage nên không có phiên — đi qua RequireRole sẽ bị
 *  đá về /login và in ra trang rỗng, test thành vô nghĩa.
 */
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import Navbar from "@/components/Navbar"
import MobileNav from "@/components/MobileNav"
import Footer from "@/components/Footer"

import Blog from "@/pages/Blog"
import Rewards from "@/pages/Rewards"
import LeaderboardPage from "@/pages/Leaderboard"
import Home from "@/pages/Home"
import Scanner from "@/pages/Scanner"
import MapPage from "@/pages/MapPage"
import Partners from "@/pages/Partners"
import Feedback from "@/pages/Feedback"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import NotFound from "@/pages/NotFound"
import Guidance from "@/pages/Guidance"
import Waste from "@/pages/Waste"
import Chat from "@/pages/Chat"
import JoinRecycler from "@/pages/JoinRecycler"
import ResetPassword from "@/pages/ResetPassword"

import Profile from "@/pages/account/Profile"
import Password from "@/pages/account/Password"

import UserHome from "@/pages/user/Home"
import Handover from "@/pages/user/Handover"
import Receipt from "@/pages/user/Receipt"
import Payout from "@/pages/user/Payout"
import Transactions from "@/pages/user/Transactions"
import Gamification from "@/pages/user/Gamification"

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
import AccountProfile from "@/pages/admin/AccountProfile"
import AccountPassword from "@/pages/admin/AccountPassword"

/** name, component, substring that must survive tag-stripping */
const CASES = [
  ["Navbar", Navbar, "Điểm thu gom"],
  ["MobileNav", MobileNav, "Đổi thưởng"],
  ["Footer", Footer, "TRUNG TÂM HỖ TRỢ"],
  ["Blog", Blog, "Bài viết về rác thải"],
  ["Home", Home, "Phân loại đúng"],
  ["Rewards", Rewards, "Điểm tiêu dùng"],
  ["Leaderboard", LeaderboardPage, "Xếp hạng người dùng"],
  // assert the idle state: result copy is only rendered after a scan
  ["Scanner", Scanner, "Dùng trang này thế nào"],
  ["MapPage", MapPage, "Cô Ba Thu Gom"],
  ["Partners", Partners, "Duy Tân"],
  ["Feedback", Feedback, "Khiếu nại và góp ý"],
  ["Login", Login, "Đăng nhập"],
  ["Register", Register, "Tạo tài khoản"],
  ["NotFound", NotFound, "Không tìm thấy trang"],

  // ---- công khai: U-02, U-03, U-04, U-05, U-09/R-05, U-18/R-07 ----
  ["Guidance", Guidance, "Phân loại rác đúng cách"],
  ["Waste", Waste, "Loại rác và cách xử lý"],
  ["Chat", Chat, "Tạo yêu cầu bàn giao"],
  ["JoinRecycler", JoinRecycler, "Đăng ký cơ sở thu mua"],
  ["ResetPassword", ResetPassword, "Đặt lại mật khẩu"],

  // ---- SU-01..SU-03 ----
  ["Profile", Profile, "Hồ sơ cá nhân"],
  ["Password", Password, "Đổi mật khẩu"],

  // ---- phân hệ USER ----
  ["user/Home", UserHome, "Xin chào"],
  ["user/Handover", Handover, "Yêu cầu thu gom rác"],
  ["user/Receipt", Receipt, "Xác nhận bàn giao rác"],
  ["user/Payout", Payout, "Tài khoản nhận tiền"],
  ["user/Transactions", Transactions, "Lịch sử tiền vào tài khoản"],
  ["user/Gamification", Gamification, "Cây ảo của bạn"],

  // ---- phân hệ RECYCLER ----
  ["recycler/Home", RecyclerHome, "Tổng quan cơ sở thu mua"],
  ["recycler/Requests", Requests, "Tiếp nhận yêu cầu bàn giao"],
  ["recycler/Catalog", Catalog, "Danh mục và bảng giá"],
  ["recycler/Receipt", RecyclerReceipt, "Tạo biên nhận thu gom"],

  // ---- phân hệ STAFF ----
  ["staff/Home", StaffHome, "Việc đang chờ bạn xử lý"],
  ["staff/AiReview", AiReview, "Ảnh AI nhận diện sai"],
  ["staff/Dataset", Dataset, "Tập dữ liệu kiểm chứng"],
  ["staff/Applications", Applications, "Thẩm định hồ sơ cơ sở thu mua"],
  ["staff/Complaints", Complaints, "Khiếu nại giao dịch"],
  ["staff/Accounts", Accounts, "Danh sách User và Buyer"],
  ["staff/BlogEditor", BlogEditor, "Soạn bài Blog"],
  ["staff/EcoFacts", EcoFacts, "Quản lý Eco Fact"],
  ["staff/Gifts", Gifts, "Quà tặng và voucher"],
  ["staff/CheckIn", StaffCheckIn, "Điểm danh hằng ngày"],
  ["staff/account", AccountProfile, "Thông tin được cấp"],
  ["staff/account/password", AccountPassword, "Đổi mật khẩu"],

  // ---- phân hệ ADMIN ----
  ["admin/Home", AdminHome, "Dashboard và thống kê"],
  ["admin/Reports", Reports, "Xuất báo cáo dữ liệu"],
  ["admin/StaffAccounts", StaffAccounts, "Tài khoản nhân viên"],
  ["admin/Permissions", Permissions, "Phân quyền nhân viên"],
  ["admin/BlogReview", BlogReview, "Duyệt bài Blog"],
  ["admin/Categories", Categories, "Danh mục rác hệ thống"],
  ["admin/Policy", Policy, "Chính sách phân loại rác"],
  ["admin/Gamification", GamificationConfig, "Cấu hình điểm và hạng cây ảo"],
  ["admin/Leaderboard", LeaderboardConfig, "Chu kỳ bảng xếp hạng"],
  ["admin/Fees", Fees, "Cấu hình phí giao dịch"],
  ["admin/Reconciliation", Reconciliation, "Đối soát và dòng tiền"],
  ["admin/account", AccountProfile, "Thông tin được cấp"],
  ["admin/account/password", AccountPassword, "Đổi mật khẩu"],
] as const

let failed = 0
for (const [name, Page, mustInclude] of CASES) {
  try {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    )
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()

    if (text.length < 20) throw new Error("rendered almost nothing")
    if (!text.includes(mustInclude)) throw new Error(`missing copy: "${mustInclude}"`)

    console.log(`OK   ${name.padEnd(24)} ${html.length} bytes html`)
  } catch (err) {
    failed++
    console.error(`FAIL ${name}: ${(err as Error).message}`)
  }
}

console.log(failed === 0 ? "\nall pages render" : `\n${failed} of ${CASES.length} failed`)
process.exit(failed === 0 ? 0 : 1)