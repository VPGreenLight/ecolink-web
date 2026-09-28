import { NavLink } from "react-router-dom"
import { MOBILE_LINKS } from "@/data/nav"

/** Bottom tab bar, only visible below the `lg` breakpoint. */
export default function MobileNav() {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed right-3 bottom-3 left-3 z-50 grid grid-cols-4 overflow-hidden rounded-[14px] border border-line/80 bg-white/94 shadow-[0_8px_28px_rgba(15,31,21,0.14)] backdrop-blur-xl lg:hidden"
    >
      {MOBILE_LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/"}
          className={({ isActive }) =>
            `grid min-h-12 place-items-center border-0 border-r border-line/60 px-1 text-xs font-semibold last:border-r-0 ${
              isActive ? "bg-surface-2 text-brand-deep" : "text-body"
            }`}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
