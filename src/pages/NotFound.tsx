import { Link } from "react-router-dom"

export default function NotFound() {
  return (
    <div className="page grid min-h-[60dvh] place-items-center py-20 text-center">
      <div>
        <p className="eyebrow">LỖI 404</p>
        <h1 className="display mt-3 text-4xl">
          Không tìm thấy trang
        </h1>
        <p className="mt-3 text-sm text-body">
          Đường dẫn bạn mở không còn tồn tại trên EcoLink.
        </p>
        <Link to="/" className="btn-primary mt-8">
          Về trang chủ
        </Link>
      </div>
    </div>
  )
}
