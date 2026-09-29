/**
 * Render smoke-test: every page must render to HTML with its key content.
 * Run with `pnpm check` (builds src/check.tsx as an SSR bundle, then runs it).
 */
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import Navbar from "@/components/Navbar"
import MobileNav from "@/components/MobileNav"
import Footer from "@/components/Footer"
import Insights from "@/pages/Blog"
import Rewards from "@/pages/Rewards"
import Home from "@/pages/Home"
import Scanner from "@/pages/Scanner"
import MapPage from "@/pages/MapPage"
import Partners from "@/pages/Partners"
import Feedback from "@/pages/Feedback"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import NotFound from "@/pages/NotFound"

/** name, component, substring that must survive tag-stripping */
const CASES = [
  ["Navbar", Navbar, "Điểm thu gom"],
  ["MobileNav", MobileNav, "Đổi thưởng"],
  ["Footer", Footer, "TRUNG TÂM HỖ TRỢ"],
  ["Blog", Insights, "Bài viết về rác thải"],
  ["Home", Home, "Phân loại đúng"],
  ["Rewards", Rewards, "Điểm tiêu dùng"],
  // assert the idle state: result copy is only rendered after a scan
  ["Scanner", Scanner, "Dùng trang này thế nào"],
  ["MapPage", MapPage, "Cô Ba Thu Gom"],
  ["Partners", Partners, "Duy Tân"],
  ["Feedback", Feedback, "Khiếu nại và góp ý"],
  ["Login", Login, "Đăng nhập"],
  ["Register", Register, "Tạo tài khoản"],
  ["NotFound", NotFound, "Không tìm thấy trang"],
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

    console.log(`OK   ${name.padEnd(10)} ${html.length} bytes html`)
  } catch (err) {
    failed++
    console.error(`FAIL ${name}: ${(err as Error).message}`)
  }
}

console.log(failed === 0 ? "\nall pages render" : `\n${failed} of ${CASES.length} failed`)
process.exit(failed === 0 ? 0 : 1)
