# EcoLink Web

## Chạy

```bash
npm install
npm run dev     # http://localhost:5173
```

| Script | Việc |
| --- | --- |
| `npm run dev` | dev server + HMR |
| `npm run build` | typecheck rồi build production vào `dist/` |
| `npm run preview` | serve `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | render 10 component/page lên HTML, fail nếu trang trắng hoặc mất nội dung |

## Cấu trúc

```
public/assets/            ảnh gốc từ Figma 
src/
  App.tsx                 route table (react-router)
  index.css               Tailwind v4 @theme: màu, font, class dùng lại
  components/
    Layout.tsx            Navbar + <Outlet/> + Footer + MobileNav
    Navbar.tsx            nav chính + menu tài khoản
    MobileNav.tsx         tab bar dưới màn hình (< lg)
    Footer.tsx
    AuthForm.tsx          dùng chung cho /login và /register
  pages/                  1 file = 1 route
  data/                   toàn bộ nội dung tĩnh nằm ở đây
  lib/session.ts          đăng nhập giả lập bằng localStorage
  check.tsx               smoke test, không dùng framework test
```

## Route

| Đường dẫn | Trang |
| --- | --- |
| `/` | Tổng quan (hero, bài báo, chỉ số) |
| `/scanner` | Nhận diện AI (kết quả mẫu) |
| `/map` | Điểm thu gom (bản đồ + khung chat) |
| `/partners` | Đối tác tái chế (tìm kiếm + lọc) |
| `/login`, `/register` | Đăng nhập / đăng ký |
| `*` | 404 |

## Sửa nội dung

Text và ảnh nằm trong `src/data/*.ts`, không nằm trong JSX. Đổi copy, đổi giá,
thêm bài viết, thêm đối tác → sửa file data, không đụng component.

```ts
// src/data/partners.ts
export const PARTNERS: Partner[] = [{ name: "...", logo: "/assets/...", ... }]
```

Đổi màu / font / class dùng lại → `src/index.css` (khối `@theme`).

## Còn thiếu (có chủ đích)

- **Đăng nhập là giả lập.** `lib/session.ts` chỉ lưu tên vào `localStorage`, không
  có API, không có token. Nối backend thật khi cần.
- **Trang /scanner dùng ảnh và kết quả tĩnh.** Chưa gọi model nhận diện, chưa
  upload ảnh. Muốn thật thì thay `src/data/scanner.ts` bằng fetch.
- **Bản đồ là ảnh nền tĩnh.** Pin đặt bằng % theo layout Figma, không có
  geolocation hay map thật. Thay bằng Leaflet/MapLibre khi cần.
- **Deploy cần SPA fallback.** Vite dev đã có sẵn; khi deploy static phải trỏ
  mọi path về `index.html`, nếu không refresh `/scanner` sẽ 404.
