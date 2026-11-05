# EcoLink Web

## Chạy

```bash
npm install
cp .env.example .env.local   # điền VITE_CARTO_API_KEY (miễn phí tại carto.com/basemaps/apikey)
npm run dev                  # http://localhost:5173 (tự proxy /api và /hubs sang http://localhost:5000)
```

| Script | Việc |
| --- | --- |
| `npm run dev` | dev server + HMR + proxy sang `.NET WebApi` |
| `npm run build` | typecheck rồi build production vào `dist/` |
| `npm run preview` | serve `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | render 61 component/page lên HTML, fail nếu trang trắng hoặc mất nội dung |
| `npm run check:routes` | render toàn bộ cây route phân quyền & kiểm tra ổn định snapshot |

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
    LeafletRecyclerMap.tsx Bản đồ tương tác CARTO Voyager + vòng bán kính & ghim cơ sở
    LocationPinPickerMap.tsx Bản đồ mini ghim kho bãi, điểm hẹn bàn giao & đối chiếu hồ sơ KYB
  pages/                  1 file = 1 route
  data/                   nội dung tĩnh & dữ liệu dự phòng khi chạy offline
  lib/
    api.ts                HTTP client chuẩn hóa ApiResponse<T> & tự dò cổng Backend
    wasteScanApi.ts       API client Module AI Waste Classification & Rule Engine
    recyclerDiscoveryApi.ts API client Module Location-Based Recycler Discovery (U-05)
    recyclerWorkflowApi.ts Liên thông 4 mắt xích vai trò (đăng ký, duyệt KYB, bật/tắt vựa, đặt lịch)
    geocodingApi.ts       Tìm kiếm địa danh 2 tầng & làm mờ toạ độ ~500m (BR-MTH-05)
    vietnamMapSovereignty.ts Lớp phủ chuẩn hoá danh xưng Biển Đông, Hoàng Sa & Trường Sa (Việt Nam)
    session.ts            đăng nhập giả lập bằng localStorage
  check.tsx               smoke test, không dùng framework test
```

## Route chính

| Đường dẫn | Trang |
| --- | --- |
| `/` | Tổng quan (hero, bài báo, chỉ số) |
| `/scanner` | Nhận diện AI đa mô hình + Rule Engine + báo cáo nhãn sai (`/api/v1/waste-scan/*`) |
| `/guidance`, `/waste` | Tra cứu quy tắc xử lý rác từ Rule Engine & báo cáo nhãn sai |
| `/map` | Bản đồ tương tác CARTO Voyager tìm cơ sở thu mua, tra cứu địa danh 2 tầng & làm mờ vị trí `~500m` (`/api/v1/recyclers/*`, `/api/v1/geocoding/search`) |
| `/partners` | Đối tác tái chế & cơ sở thu mua trực tuyến |
| `/login`, `/register` | Đăng nhập / đăng ký |
| `*` | 404 |

## Sửa nội dung

Text và ảnh mặc định nằm trong `src/data/*.ts`, không nằm trong JSX. Đổi copy, đổi giá mẫu,
thêm bài viết, thêm đối tác → sửa file data, không đụng component.

```ts
// src/data/partners.ts
export const PARTNERS: Partner[] = [{ name: "...", logo: "/assets/...", ... }]
```

Đổi màu / font / class dùng lại → `src/index.css` (khối `@theme`).

## Còn thiếu (có chủ đích)

- **Đăng nhập là giả lập.** `lib/session.ts` chỉ lưu tên vào `localStorage`, chưa nối JWT thật (`/api/v1/auth/*`). `lib/api.ts` đã hỗ trợ tự đính kèm Bearer token ngay khi nối auth.
- **Deploy cần SPA fallback.** Vite dev đã có sẵn; khi deploy static phải trỏ
  mọi path về `index.html`, nếu không refresh `/scanner` sẽ 404.

## Nhật ký làm việc & Minh chứng đồ án

Để đảm bảo tính minh bạch học thuật và cung cấp bằng chứng cho Giảng viên hướng dẫn về quá trình tự nghiên cứu, phát triển và giải quyết vấn đề (không sao chép mã nguồn):

- **Quy định ghi nhật ký:** [docs/QUY_TRINH_GHI_NHAT_KY.md](docs/QUY_TRINH_GHI_NHAT_KY.md)
- **Nhật ký chi tiết các phiên làm việc:**
  - [Phiên 2026-09-28](docs/2026-09-28.md): Tinh chỉnh Navbar, căn lề, chuẩn hóa bảng màu thương hiệu theo WCAG, sửa 56 màn hình.
  - [Phiên 2026-10-31](docs/2026-10-31.md): Chuẩn hóa quy chế ghi nhật ký làm việc và minh chứng quá trình code.
  - [Phiên 2026-11-02: Tối ưu đăng xuất](docs/2026-11-02.md): Chuyển đổi đăng xuất sang Confirmation Dialog nội bộ, đồng bộ điều hướng về trang chủ.
  - [Phiên 2026-11-03: Kết nối AI Classification & Recycler Discovery](docs/2026-11-03.md): Tích hợp API nhận diện rác đa mô hình, Rule Engine, báo cáo nhãn sai và bản đồ tìm cơ sở thu mua theo GPS (`U-05`).
  - [Phiên 2026-11-04: Cloudflare Tunnel & AI Multi-Object Bounding Box](docs/2026-11-04.md): Mở `allowedHosts` trên Vite 8, tích hợp Cloudflare Quick Tunnel và nâng cấp nhận diện rác đa vật thể đóng khung tương tác (Đề xuất 1 + 2 + 3).
  - [Phiên 2026-11-05: Bản đồ CARTO Voyager, Liên thông 4 Vai trò & PostGIS `ST_DWithin`](docs/2026-11-05.md): Tích hợp `Leaflet 1.9.4` + `CARTO Voyager`, Backend Geocoding Proxy, bảo mật vị trí `~500m` (`BR-MTH-05`), liên thông không gian 4 vai trò (`U-17`, `R-02`, `S-04`, `U-07`) và truy vấn chỉ mục PostGIS `ST_DWithin`.
