import { Outlet } from "react-router-dom"

/** Khung dùng chung cho form đăng nhập / đăng ký.
 *
 *  Chỉ còn MỘT kiểu hiển thị: thẻ form gọn ở giữa màn hình — đúng giao diện của
 *  cửa sổ popup (`openAuthPopup`) mà người dùng mở từ Navbar. Trang login/register
 *  full-screen cũ (panel marketing bên trái + ảnh leaves) đã bỏ.
 */
export default function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col justify-center bg-page px-6 py-8">
      <main className="mx-auto w-full max-w-[420px]">
        <Outlet />
      </main>
    </div>
  )
}
