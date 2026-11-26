import { Suspense, useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { ensureActiveAuthSession } from "@/lib/api"
import Navbar from "./Navbar"
import MobileNav from "./MobileNav"
import Footer from "./Footer"
import VirtualTreeFab from "./VirtualTreeFab"

const TREE_FAB_ROUTES = new Set(["/", "/scanner", "/map", "/rewards"])

/** Khung dùng chung cho mọi trang công khai và portal (hộp thoại đăng nhập/đăng ký Trang Nhỏ được render toàn cục). */
export default function Layout() {
  const { pathname } = useLocation()
  const showTreeFab = TREE_FAB_ROUTES.has(pathname)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    void ensureActiveAuthSession()
  }, [pathname])

  return (
    <div className="min-h-dvh bg-page pb-20 lg:pb-0">
      <Navbar />
      <main className="pt-[70px] md:pt-[76px]">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      {showTreeFab && <VirtualTreeFab />}
      <MobileNav />
    </div>
  )
}
