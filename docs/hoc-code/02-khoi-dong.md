# 02 · Một trang được sinh ra thế nào

Tài liệu này giải thích **từng dòng** của 4 file đầu tiên theo đúng thứ tự trình
duyệt thực thi chúng. Đọc xong, bạn biết chính xác vì sao gõ
`http://localhost:5173/admin/reports` lại ra màn hình báo cáo.

```
index.html  →  main.tsx  →  App.tsx  →  Layout.tsx  →  (trang cụ thể)
   vỏ           gắn React     bảng URL     khung          nội dung
```

---

# PHẦN 1 — `index.html` (17 dòng)

Đây là file duy nhất trình duyệt tải đầu tiên. **Cả app 51 trang chỉ có một file
HTML này.** Mọi thứ khác do JavaScript dựng ra.

```html
<!doctype html>
```
Dòng 1. Khai báo "đây là HTML5". Thiếu dòng này trình duyệt rơi vào chế độ
tương thích ngược (quirks mode) và CSS sẽ hiển thị lệch.

```html
<html lang="vi">
```
Dòng 2. `lang="vi"` nói với trình duyệt và trình đọc màn hình rằng nội dung là
tiếng Việt. Ảnh hưởng đến cách screen reader phát âm và cách trình duyệt gợi ý
dịch. Không phải trang trí — là accessibility.

```html
<meta charset="UTF-8" />
```
Dòng 4. Bảng mã ký tự. Thiếu nó, chữ "Phân loại rác" thành "PhÃ¢n loáº¡i rÃ¡c".

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
Dòng 5. Cực kỳ quan trọng với giao diện mobile: bảo trình duyệt "đừng phóng to
thu nhỏ, hãy coi bề rộng thiết bị là bề rộng khung nhìn". Thiếu dòng này, trên
điện thoại cả trang bị thu nhỏ như xem ảnh, mọi class `lg:` `md:` vô nghĩa.

```html
<title>EcoLink — Nền tảng thu gom tuần hoàn</title>
```
Dòng 6. Chữ trên tab trình duyệt và kết quả Google.

```html
<meta name="description" content="Phân loại thông minh, ..." />
```
Dòng 7–10. Mô tả cho công cụ tìm kiếm. Không hiện trên trang.

```html
<link rel="icon" type="image/png" href="/assets/logo1.png" />
```
Dòng 11. Icon nhỏ trên tab. Đường dẫn bắt đầu bằng `/assets/` trỏ vào thư mục
`public/assets/` — Vite phục vụ nguyên file, **không** qua bundler. Vì thế ảnh
10 MB trong `public/` không làm chậm lần tải JS đầu tiên.

```html
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```
Dòng 13–16. Hai dòng quan trọng nhất:

- `<div id="root"></div>` — **cái hộp rỗng**. Toàn bộ giao diện sẽ được React
  nhét vào đây. Nhìn file HTML bạn không thấy nội dung nào cả, vì nội dung chưa
  tồn tại — nó do JS tạo ra sau.
- `<script type="module" src="/src/main.tsx">` — nạp điểm khởi động. `type="module"`
  cho phép dùng `import`/`export` chuẩn ES. Vite nhận request `/src/main.tsx`,
  biên dịch TSX → JS, biến đổi `@/` thành đường dẫn thật, rồi trả về.

```
Trình duyệt tải index.html
        │
        ├─ thấy <div id="root"> rỗng  →  trang trắng
        │
        └─ thấy <script>  →  tải /src/main.tsx
                                   │
                                   ▼
                            (chạy phần 2)
```

---

# PHẦN 2 — `src/main.tsx` (10 dòng)

Điểm khởi động. Chỉ làm một việc: **gắn React vào cái hộp `#root`**.

```tsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./index.css"
```

| Dòng | Việc |
| --- | --- |
| 1 | `StrictMode` — một component đặc biệt của React, giải thích bên dưới |
| 2 | `createRoot` — hàm biến một phần tử DOM thành "gốc" cho React quản lý |
| 3 | `App` — component gốc, `./App` nghĩa là file cùng thư mục |
| 4 | `"./index.css"` — **import CSS**! Không có biến nào nhận kết quả, đây là import "chỉ để chạy tác dụng phụ": Tailwind đọc file này, sinh toàn bộ CSS của app |

Dòng 4 là chỗ nhiều người mới bỏ sót: xoá nó đi, app vẫn chạy nhưng **mất sạch
giao diện** — chỉ còn chữ đen trên nền trắng.

```tsx
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Đọc từ trong ra ngoài:

1. `document.getElementById("root")` — tìm cái `<div id="root">` ở `index.html`.
   Kiểu trả về là `HTMLElement | null` (có thể không tìm thấy).
2. `!` — **non-null assertion**: "tôi cam đoan nó không null". TypeScript tin bạn
   và cho truyền vào `createRoot`. Nếu thật sự không có `#root`, app sẽ crash —
   nhưng `index.html` luôn có, nên đây là chỗ duy nhất trong repo được phép dùng `!`.
3. `createRoot(...)` — tạo bộ điều khiển React cho vùng DOM đó.
4. `.render(<App />)` — "vẽ cây giao diện này vào".
5. `<StrictMode>` — chỉ có tác dụng ở chế độ dev:
   - gọi component **2 lần** mỗi lần render để phát hiện tác dụng phụ không an toàn;
   - chạy `useEffect` hai lần (mount → unmount → mount) để kiểm tra hàm dọn dẹp.
   
   Đây là lý do bạn thấy log in hai lần khi dev. **Build production không bị.**
   Đừng "sửa" bằng cách xoá `StrictMode` — nó đang bắt bug cho bạn.

```
document ──▶ <div id="root"> ──▶ createRoot ──▶ .render(<App/>)
                                                      │
                                                      ▼
                                              (chạy phần 3)
```

---

# PHẦN 3 — `src/App.tsx` (197 dòng)

Đây là **bản đồ của toàn bộ website**. Không có logic nghiệp vụ nào ở đây; chỉ
có "URL này thì hiện trang kia, bọc trong khung nào, ai được vào".

## 3.1 Khối import (dòng 1–62)

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom"
```
Ba thứ của thư viện router:

| Tên | Vai trò |
| --- | --- |
| `BrowserRouter` | Lắng nghe thanh địa chỉ, giữ URL đồng bộ với giao diện |
| `Routes` | Cái hộp so khớp: duyệt danh sách route, chọn **một** cái khớp |
| `Route` | Một dòng khai báo: `path` + `element` |

```tsx
import Layout from "@/components/Layout"
import Portal from "@/components/Portal"
import AdminShell from "@/components/admin/Shell"
import RequireRole from "@/components/RequireRole"
```
Bốn cái khung (đọc ở tài liệu 03 và 04). Chú ý `AdminShell` nằm trong thư mục
con `admin/` nhưng được dùng cho **cả** staff và admin — vì hai khu vực dùng
chung một khung làm việc.

```tsx
import Home from "@/pages/Home"
...
```
Dòng 7–62: **danh sách import toàn bộ màn hình**. Nhìn thì dài nhưng không có gì để hiểu —
đây là danh sách "những màn hình tồn tại". Mỗi dòng nối tên component với file.

Quy ước đặt tên cần để ý:

| Tên import | File | Vì sao đổi tên |
| --- | --- | --- |
| `LeaderboardPage` | `pages/Leaderboard` | tránh trùng với `components/Leaderboard` |
| `Gamification` | `pages/user/Gamification` | trang của user |
| `GamificationConfig` | `pages/admin/Gamification` | trang cấu hình của admin |
| `RecyclerReceipt` | `pages/recycler/Receipt` | tránh trùng `pages/user/Receipt` |
| `StaffCheckIn` | `pages/staff/CheckIn` | tránh trùng `components/CheckIn` |

Đây không phải code thừa — hai file cùng tên trong hai thư mục khác nhau là
chuyện bình thường; chỉ có tên **trong cùng một file** mới phải khác nhau.

## 3.2 Khối chú thích dòng 64–71 — đọc kỹ, nó giải thích kiến trúc

```tsx
/** Mọi route sau đăng nhập đều khai báo vai trò được vào. ... */
export function AppRoutes() {
```

Hai quyết định được ghi lại ở đây:

1. **Không có route nào "ai cũng vào được" ở khu sau đăng nhập.** Mỗi màn hình
   thuộc đúng một vai trò. Đây là cách hiện thực hoá use case A-04 (phân quyền).
2. **Tách `AppRoutes` ra khỏi `App`.** `App` chỉ bọc `BrowserRouter`; phần bảng
   route nằm trong `AppRoutes` để **test được**. File `src/check-routes.tsx`
   import `AppRoutes` rồi bọc bằng `MemoryRouter` (router giả, không đụng thanh
   địa chỉ thật) để kiểm tra cây route.

🔍 Nếu gộp làm một, muốn test phải dùng `BrowserRouter` — mà cái đó cần trình
duyệt thật, không chạy được trên Node. Tách ra là để logic route trở thành hàm
thuần, test được bằng `renderToStaticMarkup`.

Đây là bài học chung: **tách phần "khó test" ra khỏi phần "dễ test"**.

## 3.3 Nhóm route AUTH (dòng 75–78)

```tsx
<Route path="/login" element={<Login />} />
<Route path="/register" element={<Register />} />
<Route path="/reset-password" element={<ResetPassword />} />
```

Ba route này **nằm ngoài `<Layout>`**. Nghĩa là vào `/login` bạn không thấy
navbar, footer, tab bar — đúng ý đồ thiết kế: trang đăng nhập là màn hình riêng,
tập trung vào form, không cho người dùng bấm đi đâu giữa chừng.

`path="/login"` có dấu `/` đầu vì đây là route tuyệt đối. Các route con bên
trong `Layout` viết không dấu `/` (`path="blog"`) vì chúng tương đối với cha.

## 3.4 Nhóm route CÔNG KHAI trong `Layout` (dòng 80–135)

```tsx
<Route element={<Layout />}>
  <Route index element={<Home />} />
  <Route path="blog" element={<Blog />} />
  ...
</Route>
```

Đây là kỹ thuật quan trọng nhất của react-router: **layout route**.

```
<Route element={<Layout />}>          ← KHÔNG có path
   │
   ├─ <Route index element={<Home/>}/>        → "/"
   ├─ <Route path="blog" element={<Blog/>}/>  → "/blog"
   └─ <Route path="scanner" .../>             → "/scanner"
```

Vì `Route` cha không có `path`, nó khớp với **mọi** URL con. `Layout` được vẽ
một lần, và bên trong nó `<Outlet/>` là chỗ trống để trang con rơi vào.

```
┌─────────────── Layout ───────────────┐
│ <Navbar/>                            │
│ <main>                               │
│    ┌─────── <Outlet/> ────────┐      │
│    │        <Blog/>           │      │   ← thay đổi theo URL
│    └──────────────────────────┘      │
│ </main>                              │
│ <Footer/>  <MobileNav/>              │
└──────────────────────────────────────┘
```

Nhờ vậy khi chuyển `/` → `/blog`, React **không dựng lại** Navbar/Footer. Chỉ
phần `<Outlet/>` đổi. Đó là lý do chuyển trang nhanh và không nháy màn hình.

### `<Route index>` là gì

`index` = "route mặc định khi URL đúng bằng cha". Cha ở đây là `/`, nên
`<Route index>` = trang chủ. Nếu không có nó, vào `/` sẽ ra trang trống.

### Bảng route công khai

| Dòng | path | Trang | Ghi chú |
| --- | --- | --- | --- |
| 82 | `index` | Home | `/` |
| 83 | `blog` | Blog | |
| 84 | `rewards` | Rewards | đổi thưởng, ai cũng xem được |
| 85 | `leaderboard` | LeaderboardPage | |
| 86 | `scanner` | Scanner | trái tim của sản phẩm |
| 87 | `map` | MapPage | bản đồ điểm thu gom |
| 88 | `partners` | Partners | |
| 89 | `feedback` | Feedback | |
| 91 | `guidance` | Guidance | U-02 hướng dẫn phân loại |
| 92 | `waste` | Waste | U-03 tra cứu loại rác |
| 94 | `join-recycler` | JoinRecycler | U-05 đăng ký làm đối tác |

Các comment `U-02`, `G-01`… là **mã use case** trong tài liệu đặc tả. Chúng
không ảnh hưởng code, chỉ để đối chiếu "yêu cầu này đã có màn hình chưa".

## 3.5 Nhóm route TÀI KHOẢN (dòng 97–100)

```tsx
<Route path="account">
  <Route path="profile" element={<Profile />} />
  <Route path="password" element={<Password />} />
</Route>
```

Route cha **không có `element`** — nó chỉ để gom nhóm cho URL đẹp. Kết quả:
`/account/profile`, `/account/password`. Không có `<Outlet/>` nào ở đây, nên
đừng nhầm với layout route ở mục 3.4: layout route có `element`, route nhóm
không có.

Hai trang này nằm ngoài `RequireRole`, tức **khách cũng mở được**. Bên trong
`Profile.tsx` tự kiểm tra phiên và hiện lời mời đăng nhập nếu chưa có — cách làm
mềm hơn so với đá thẳng về `/login`.

## 3.6 `/chat` — route có hai vai trò (dòng 103–110)

```tsx
<Route
  path="chat"
  element={
    <RequireRole roles={["user", "recycler"]}>
      <Chat />
    </RequireRole>
  }
/>
```

Đây là **ví dụ duy nhất** một chức năng dùng chung cho hai vai trò. Ghi nhớ cách
đọc: `RequireRole` nhận prop `roles` là mảng; nếu phiên hiện tại không nằm trong
mảng thì chuyển hướng. Chi tiết ở tài liệu `03`.

## 3.7 Khu USER (dòng 113–122)

```tsx
<Route element={<RequireRole roles={["user"]}><Portal role="user" /></RequireRole>}>
  <Route path="user">
    <Route index element={<UserHome />} />
    <Route path="handover" element={<Handover />} />
    ...
  </Route>
</Route>
```

Đây là **layout route lồng hai tầng bảo vệ**:

```
URL /user/handover
        │
        ▼
 RequireRole roles=["user"]      ← tầng 1: chưa đăng nhập? sai vai trò? chặn
        │ (đúng)
        ▼
 Portal role="user"              ← tầng 2: sidebar + tên + nút đăng xuất
        │
        ▼
 <Outlet/>  →  <Handover/>       ← nội dung trang
```

Chú ý route cha `path="user"` **không có element** — nó chỉ gom URL. Cái có
element là route bọc ngoài (không path), nên Portal bọc **mọi** trang con.

Vì Portal là layout route, sidebar **không dựng lại** khi bấm giữa các mục
Tổng quan / Bàn giao / Biên nhận.

## 3.8 Khu RECYCLER (dòng 125–132)

Y hệt khu user, chỉ đổi `roles={["recycler"]}` và `role="recycler"`. Bốn trang:
`/recycler`, `/recycler/requests`, `/recycler/catalog`, `/recycler/receipt`.

⚠️ Điểm dễ nhầm: `/recycler` là **đường dẫn**, `recycler` cũng là **tên vai
trò**. Nhưng `/recycler` nằm trong `Layout` công khai (vẫn có navbar trên cùng),
còn `/staff` và `/admin` thì không. Lý do: user/recycler là khách hàng, họ cần
menu công khai để quay ra xem blog, bản đồ; staff/admin là người làm việc nội
bộ, không nên thấy menu marketing.

## 3.9 404 (dòng 134)

```tsx
<Route path="*" element={<NotFound />} />
```

`*` khớp **mọi thứ còn lại**. Đặt ở cuối và bên trong `Layout` để trang 404 vẫn
có navbar — người dùng lạc đường còn đường quay về.

## 3.10 Khu STAFF (dòng 140–160)

```tsx
<Route
  path="/staff"
  element={
    <RequireRole roles={["staff"]}>
      <AdminShell role="staff" />
    </RequireRole>
  }
>
  <Route index element={<StaffHome />} />
  <Route path="ai-review" element={<AiReview />} />
  ...
</Route>
```

Ba điểm khác biệt so với khu user:

1. `path="/staff"` **có dấu `/`** — route tuyệt đối, đứng ngoài `Layout`.
2. Bọc bằng `AdminShell`, không phải `Portal`.
3. Các route con viết tương đối: `ai-review` → `/staff/ai-review`.

Vì `path="/staff"` nằm ngoài `Layout`, cây này **không có navbar/footer**. Đó là
chủ ý: khu làm việc nội bộ có sidebar riêng, màn hình rộng hơn cho bảng dữ liệu.

`<Route index>` = `/staff`. 11 route con còn lại là các màn hình nghiệp vụ.

## 3.11 Khu ADMIN (dòng 165–186)

Cùng cấu trúc, `roles={["admin"]}`, `AdminShell role="admin"`, 13 route con.
Khác biệt duy nhất là **tập màn hình**: dashboard, báo cáo, phân quyền, cấu hình.

⚠️ Đừng sửa `roles={["admin"]}` thành `roles={["admin", "staff"]}` để "cho staff
xem thử" — đó là mở cửa hậu, phá đúng cái phân quyền mà cả dự án đang mô phỏng.

## 3.12 Hàm `App` (dòng 191–197)

```tsx
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
```

`BrowserRouter` là thứ duy nhất trong cả app **gắn với thanh địa chỉ thật**:

- đọc `window.location.pathname` lần đầu;
- nghe sự kiện `popstate` (bấm Back/Forward);
- cung cấp hàm `navigate()` để đổi URL không tải lại trang.

Nó nằm ngoài cùng vì mọi thứ bên trong đều cần biết URL hiện tại.

```
<BrowserRouter>                 ← nguồn sự thật về URL
   <AppRoutes>                  ← bảng tra URL → trang
      <Routes>
         <Route element={<Layout/>}>
            <Navbar/> <Outlet/> <Footer/>
         </Route>
      </Routes>
   </AppRoutes>
</BrowserRouter>
```

## 3.13 Toàn bộ cây route, nhìn một lần

```
/                        
├─ /login                 ← ngoài Layout (không navbar)
├─ /register
├─ /reset-password
│
├─ <Layout>               ← có navbar + footer + mobile tab bar
│   ├─ /                   Home
│   ├─ /blog               Blog
│   ├─ /rewards            Rewards
│   ├─ /leaderboard        Leaderboard
│   ├─ /scanner            Scanner
│   ├─ /map                MapPage
│   ├─ /partners           Partners
│   ├─ /feedback           Feedback
│   ├─ /guidance           Guidance
│   ├─ /waste              Waste
│   ├─ /join-recycler      JoinRecycler
│   ├─ /account/profile    Profile      (khách xem được)
│   ├─ /account/password   Password
│   ├─ /chat               RequireRole(user|recycler) → Chat
│   ├─ /user/*             RequireRole(user) → Portal → 6 trang
│   ├─ /recycler/*         RequireRole(recycler) → Portal → 4 trang
│   └─ *                   404
│
├─ /staff/*               RequireRole(staff) → AdminShell → 12 trang
└─ /admin/*               RequireRole(admin) → AdminShell → 14 trang
```

---

# PHẦN 4 — `src/components/Layout.tsx` (25 dòng)

Khung của mọi trang công khai. Ngắn nhưng có 3 quyết định đáng hiểu.

```tsx
import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import Navbar from "./Navbar"
import MobileNav from "./MobileNav"
import Footer from "./Footer"
```

- `useLocation()` — hook đọc URL hiện tại. Trả về object có `pathname`, `search`, `hash`.
- `Outlet` — "cái lỗ" để trang con chui vào.
- Ba import `./Navbar` dùng đường dẫn tương đối vì cùng thư mục `components/`.

```tsx
export default function Layout() {
  const { pathname } = useLocation()
```
Destructuring: lấy đúng thuộc tính `pathname`, bỏ qua `search`/`hash` không dùng.

```tsx
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
```
Vì sao cần: react-router **không** tự cuộn lên đầu khi đổi trang (vì nó không
tải lại trang). Nếu đang cuộn ở cuối `/blog` rồi bấm sang `/scanner`, bạn sẽ
thấy mình ở giữa trang scanner — rất khó chịu.

`[pathname]` nghĩa là chỉ chạy lại khi **đường dẫn đổi**, không phải khi query
đổi. Ví dụ `/waste?q=nhua` → `/waste?q=giay` không cuộn, đúng ý (chỉ đổi bộ lọc).

```tsx
  return (
    <div className="min-h-dvh bg-page pb-20 lg:pb-0">
```
- `min-h-dvh` = cao tối thiểu bằng chiều cao khung nhìn (dvh xử lý đúng trên
  mobile khi thanh địa chỉ ẩn/hiện — `vh` thì không).
- `pb-20` = đệm dưới 80px, **để chừa chỗ cho MobileNav** đang `fixed` ở đáy.
  Thiếu nó, tab bar che mất dòng cuối của trang.
- `lg:pb-0` = từ desktop trở lên không cần chừa, vì MobileNav bị `lg:hidden`.

```tsx
      <Navbar />
      <main className="pt-[70px] md:pt-[76px]">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
```
- `<main>` là thẻ ngữ nghĩa: nội dung chính, chỉ nên có một cái mỗi trang.
  Screen reader dùng nó để nhảy thẳng tới nội dung.
- `pt-[70px]` = đệm trên đúng 70px. Vì Navbar `fixed` nên nó **không chiếm chỗ**
  trong luồng bố cục; không có padding này, nội dung sẽ chui xuống dưới navbar.
  `md:pt-[76px]` vì navbar cao hơn 6px từ breakpoint md.
- Thứ tự `<Outlet/>` nằm giữa Navbar và Footer là điều duy nhất khiến trang con
  xuất hiện đúng chỗ.

⚠️ Navbar, Footer, MobileNav **không** nhận prop nào. Chúng tự đọc dữ liệu từ
`data/nav.ts` và `lib/session.ts`. Đây là "component tự phục vụ" — đổi lại,
muốn dùng chúng ở nơi khác thì phải chấp nhận dữ liệu đi kèm.

---

# Tóm tắt bằng một hình

```
┌─────────────────────────────────────────────────────────────┐
│ index.html                                                   │
│   <div id="root"></div>                                      │
│   <script src="/src/main.tsx">                               │
└───────────────────────────┬─────────────────────────────────┘
                            │ 1. tải & chạy
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ main.tsx                                                     │
│   import "./index.css"        → Tailwind sinh toàn bộ CSS    │
│   createRoot(#root).render(                                  │
│     <StrictMode><App/></StrictMode>)                         │
└───────────────────────────┬─────────────────────────────────┘
                            │ 2. vẽ
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ App.tsx                                                      │
│   <BrowserRouter>          → biết URL hiện tại               │
│     <Routes>               → tra bảng                         │
│       <Route element={<Layout/>}>                            │
│         <Navbar/> <Outlet/> <Footer/> <MobileNav/>           │
│       </Route>                                               │
│     </Routes>                                                │
│   </BrowserRouter>                                           │
└───────────────────────────┬─────────────────────────────────┘
                            │ 3. URL = /scanner
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ pages/Scanner.tsx         → nội dung thật của trang          │
└─────────────────────────────────────────────────────────────┘
```

---

## Tự kiểm tra

1. Vì sao `/login` không có navbar? → Vì nó khai báo **ngoài** `<Route element={<Layout/>}>`.
2. Vì sao `<main>` có `pt-[70px]`? → Vì Navbar `fixed` không chiếm chỗ trong luồng bố cục.
3. `/staff/ai-review` được bọc bởi những gì? → `RequireRole(staff)` → `AdminShell` → `AiReview`.
4. Vì sao tách `AppRoutes` khỏi `App`? → Để `check-routes.tsx` test được bằng `MemoryRouter`, không cần trình duyệt thật.
5. Xoá `import "./index.css"` ở `main.tsx` thì sao? → App vẫn chạy, mất toàn bộ CSS (Tailwind không được nạp).

**Tiếp:** [03 · Đăng nhập và phân quyền](03-phien-dang-nhap.md)
