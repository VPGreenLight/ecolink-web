import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import Navbar from "./Navbar"
import MobileNav from "./MobileNav"
import Footer from "./Footer"

/** Chrome shared by every public page. Auth pages render `AuthLayout` instead. */
export default function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="min-h-dvh bg-page pb-20 lg:pb-0">
      <Navbar />
      <main className="pt-[70px] md:pt-[76px]">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
    </div>
  )
}
