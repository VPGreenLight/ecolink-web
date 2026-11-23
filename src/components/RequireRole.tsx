import { useEffect } from "react"
import { Navigate } from "react-router-dom"
import { ensureActiveAuthSession } from "@/lib/api"
import { openAuthPopup } from "@/lib/popupAuth"
import { ROLE_HOME, useSession, type Role } from "@/lib/session"

/** Chốt chặn route theo vai trò. Chưa đăng nhập -> về trang chủ / và mở hộp thoại đăng nhập nhỏ,
 *  đã đăng nhập sai vai trò -> về trang chủ của vai trò đó, đồng thời đối chiếu Cookie với Backend. */
export default function RequireRole({
  roles,
  children,
}: {
  roles: readonly Role[]
  children: React.ReactNode
}) {
  const session = useSession()
  const sessionIdentity = session
    ? `${session.id ?? session.username ?? session.name}:${session.role}`
    : null

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!sessionIdentity) {
      openAuthPopup("login")
      return
    }
    void ensureActiveAuthSession()
  }, [sessionIdentity])

  if (!session) return <Navigate to="/" replace />
  if (!roles.includes(session.role)) return <Navigate to={ROLE_HOME[session.role]} replace />
  return <>{children}</>
}