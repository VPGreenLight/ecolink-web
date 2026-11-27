import { BookOpen, Gift, Home, MapPin, ScanLine, type LucideIcon } from "lucide-react"
import { NavLink } from "react-router-dom"
import { NAV_LINKS } from "@/data/nav"

const TAB_ICON: Record<(typeof NAV_LINKS)[number]["to"], LucideIcon> = {
  "/": Home,
  "/scanner": ScanLine,
  "/map": MapPin,
  "/rewards": Gift,
  "/blog": BookOpen,
}

/** Bottom tab bar, only visible below the `lg` breakpoint. */
export default function MobileNav() {
  return (
    <nav
      aria-label="Điều hướng chính (di động)"
      className="fixed right-2 bottom-2.5 left-2 z-40 grid grid-cols-5 overflow-hidden rounded-[14px] border border-line/80 bg-white/94 shadow-[0_8px_28px_rgba(15,31,21,0.14)] backdrop-blur-xl min-[360px]:right-2.5 min-[360px]:left-2.5 lg:hidden"
    >
      {NAV_LINKS.map((link) => {
        const Icon = TAB_ICON[link.to]
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `flex min-h-[54px] flex-col items-center justify-start gap-1 border-0 border-r border-line/60 px-0.5 pt-2 pb-1.5 text-center text-[10px] leading-[1.15] font-semibold tracking-[-0.015em] transition-colors last:border-r-0 min-[412px]:text-[11px] sm:px-1 sm:text-xs sm:tracking-normal ${
                isActive ? "bg-surface-2 text-brand-deep" : "text-body"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  aria-hidden="true"
                  strokeWidth={isActive ? 2.15 : 1.75}
                  className="size-[17px] shrink-0 sm:size-[18px]"
                />
                <span>{link.label}</span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
