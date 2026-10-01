import { Navigate } from "react-router-dom"
import { ROLE_HOME, useSession, type Role } from "@/lib/session"

/** Chốt chặn route theo vai trò. Chưa đăng nhập -> về /login, đã đăng nhập sai
 *  vai trò -> về trang chủ của vai trò đó.
 *
 *  Đây chỉ là chốt chặn phía client để không ai thấy màn hình của vai trò
 *  khác. Bảo mật thật phải nằm ở backend: mỗi API tự kiểm tra token, nếu không
 *  thì A-04 "phân quyền" chỉ là trang trí. */
export default function RequireRole({
  roles,
  children,
}: {
  roles: readonly Role[]
  children: React.ReactNode
}) {
  const session = useSession()
  if (!session) return <Navigate to="/login" replace />
  if (!roles.includes(session.role)) return <Navigate to={ROLE_HOME[session.role]} replace />
  return <>{children}</>
}