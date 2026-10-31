# 00 · Bản đồ dự án

## 1. Đây là app gì

EcoLink là một **website demo nghiệp vụ** về thu gom – phân loại – tái chế rác.
Bốn loại người dùng đăng nhập vào bốn khu vực khác nhau:

```
NGƯỜI DÂN (user)      chụp ảnh rác → AI đoán loại → đặt lịch bàn giao → nhận tiền/điểm
CƠ SỞ THU MUA (recycler)  nhận yêu cầu bàn giao → cân → lập biên nhận → trả tiền
NHÂN VIÊN (staff)     duyệt ảnh AI sai, duyệt hồ sơ đối tác, xử lý khiếu nại, viết blog
QUẢN TRỊ (admin)      xem dashboard, phân quyền, cấu hình điểm/phí/chính sách, đối soát
```

Điểm quan trọng nhất, quyết định cách đọc toàn bộ code:

> **Đây là frontend thuần, không có backend, không có API, không có database.**
>
> - Mọi con số, danh sách, bài viết nằm trong `src/data/*.ts` dưới dạng hằng số.
> - "Đăng nhập" chỉ là ghi tên + vai trò vào `localStorage` của trình duyệt.
> - Bấm nút "Duyệt" thì chữ trên màn hình đổi, nhưng **không có gì được lưu** —
>   tải lại trang là về như cũ.
>
> Đây là bản dựng để trình diễn luồng nghiệp vụ và giao diện, không phải hệ thống thật.

Hiểu điều này thì bạn sẽ không đi tìm `fetch`, `axios`, `.env` API URL — chúng
không tồn tại, và đó là chủ ý.

## 2. Công nghệ, và vai trò của từng thứ

| Thứ | Phiên bản | Nó làm gì trong dự án này |
| --- | --- | --- |
| **Vite** | 8 | Dev server + bộ đóng gói. Chạy `npm run dev` là nó biên dịch TSX thành JS và tự nạp lại trang khi bạn sửa file (HMR). |
| **React** | 19 | Thư viện dựng giao diện. Bạn mô tả giao diện bằng hàm, React gọi hàm đó mỗi khi dữ liệu đổi. |
| **react-router-dom** | 7 | Đọc URL trên thanh địa chỉ và chọn component tương ứng. Không tải lại trang khi bấm link. |
| **TypeScript** | 5.7 | JavaScript + kiểm tra kiểu. Sai kiểu thì `npm run build` báo đỏ ngay, không cần chạy. |
| **Tailwind CSS** | 4 | Viết giao diện bằng class ngắn (`px-4` = padding ngang 16px) thay vì file CSS riêng. |
| **Node.js** | — | Chỉ dùng để chạy Vite và `tsc`. Không có server Node nào trong dự án. |

Không có: Redux, Zustand, Axios, Next.js, Prisma, Express, Supabase. Cố ý — dự án
nhỏ, thêm thư viện chỉ làm người đọc khó hiểu.

## 3. Cây thư mục và nhiệm vụ từng nhánh

```
ecolink-web/
├─ index.html          ← vỏ HTML. Cả app chỉ có MỘT file html này.
├─ vite.config.ts      ← cấu hình: plugin React, plugin Tailwind, alias "@" → "src"
├─ tsconfig.json       ← luật TypeScript: strict = true (bắt lỗi gắt)
├─ public/assets/      ← ảnh/video. File ở đây được phục vụ nguyên bản tại /assets/...
└─ src/
   ├─ main.tsx         ← 10 dòng. "Gắn" React vào <div id="root">.
   ├─ App.tsx          ← 181 dòng. Toàn bộ bản đồ URL → trang.
   ├─ index.css        ← Tailwind + bảng màu + class dùng lại (.page, .card, .btn-primary)
   ├─ lib/session.ts   ← "đăng nhập" giả: đọc/ghi localStorage, phát sự kiện cho React
   ├─ components/      ← 12 file khung dùng chung, KHÔNG phải màn hình
   ├─ data/            ← 13 file nội dung tĩnh, KHÔNG phải code giao diện
   └─ pages/           ← 51 màn hình, mỗi file = một URL
```

### Vì sao `data/` tách khỏi `pages/`

Một trang trung bình 160 dòng; nếu nhét cả 20 dòng văn bản marketing, 30 dòng
bảng giá vào thì không ai đọc nổi phần logic. Tách ra thì:

- Sửa chữ, đổi giá → chỉ mở `src/data/...`, không sợ làm hỏng giao diện.
- Xem một trang → biết ngay "phần nào là bố cục, phần nào là nội dung".

Ví dụ thật (`src/data/partners.ts`):

```ts
export const PARTNERS: Partner[] = [{ name: "...", logo: "/assets/...", ... }]
```

Trang `Partners.tsx` chỉ việc `PARTNERS.map(...)` để bày ra.

## 4. Bốn vai trò và ba cái khung

### 4.1 Vai trò

`src/lib/session.ts` định nghĩa đúng 4 vai trò:

```ts
export type Role = "user" | "recycler" | "staff" | "admin"
```

| Vai trò | Nhãn hiển thị | Trang chủ sau đăng nhập | Khu vực |
| --- | --- | --- | --- |
| `user` | Người dân | `/user` | sidebar `Portal` nằm trong `Layout` công khai |
| `recycler` | Cơ sở thu mua | `/recycler` | sidebar `Portal` nằm trong `Layout` công khai |
| `staff` | Nhân viên | `/staff` | `AdminShell` riêng, không có navbar công khai |
| `admin` | Quản trị viên | `/admin` | `AdminShell` riêng, không có navbar công khai |

Chưa đăng nhập = **khách**. Khách vẫn xem được trang chủ, blog, bản đồ, scanner…
Vào `/user` thì bị đá về `/login`.

### 4.2 Ba cái khung (layout)

Mỗi trang không tự vẽ header/footer. Nó được **bọc** trong một khung:

```
① KHUNG AUTH — /login /register /reset-password
   ┌──────────────────────────────┐
   │      (không navbar/footer)    │
   │    form đăng nhập / đăng ký   │
   └──────────────────────────────┘
   Nằm NGOÀI <Layout> trong App.tsx → toàn màn hình, không menu.

② KHUNG CÔNG KHAI — mọi trang khách xem + khu user/recycler
   ┌──────────────────────────────┐
   │ Navbar (logo, menu, avatar)   │  ← sticky, cao 70/76px
   ├───────────┬──────────────────┤
   │ sidebar   │  <Outlet/>       │  ← chỉ có khi ở /user/* hoặc /recycler/*
   │ (Portal)  │  nội dung trang  │
   ├───────────┴──────────────────┤
   │ Footer                        │
   │ MobileNav (tab bar dưới)      │  ← chỉ hiện trên mobile
   └──────────────────────────────┘

③ KHUNG LÀM VIỆC — /staff/* và /admin/*
   ┌──────────┬───────────────────┐
   │ sidebar  │  nội dung trang   │  ← AdminShell, không navbar/footer
   │ tối      │                   │
   └──────────┴───────────────────┘
```

Trong `App.tsx` bạn thấy đúng ba nhóm đó: các `<Route>` auth đứng riêng, các
route công khai nằm trong `<Route element={<Layout />}>`, còn `/staff` và
`/admin` đứng ngoài `Layout`.

## 5. Một cú click đi qua những file nào

Ví dụ: khách bấm menu "Nhận diện AI" → URL đổi thành `/scanner`.

```
 BẠN BẤM LINK
      │
      ▼
┌─────────────────┐
│ <Link to=...>   │  Navbar.tsx
└────────┬────────┘
         │ react-router chặn click, KHÔNG tải lại trang,
         │ gọi history.pushState("/scanner")
         ▼
┌─────────────────┐
│ BrowserRouter   │  App.tsx dòng 193 — lắng nghe URL
└────────┬────────┘
         ▼
┌─────────────────┐
│ <Routes>        │  so URL với bảng route, khớp "scanner"
└────────┬────────┘
         ▼
┌─────────────────┐
│ <Layout>        │  vẽ Navbar + Footer + MobileNav
│   <Outlet/>     │  ← chỗ này được thay bằng trang con
└────────┬────────┘
         ▼
┌─────────────────┐
│ <Scanner/>      │  Scanner.tsx — vẽ toàn bộ nội dung
└─────────────────┘
```

Nếu URL là `/admin/reports` thì chuỗi bọc là:
`<RequireRole roles={["admin"]}>` → `<AdminShell role="admin">` → `<Reports/>`.
`RequireRole` kiểm tra phiên trước; sai vai trò thì không bao giờ tới `Reports`.

## 6. Luồng dữ liệu: một chiều

```
        ┌───────────────┐
        │  src/data/*   │  hằng số, không đổi
        └───────┬───────┘
                │ import
                ▼
        ┌───────────────┐      setState      ┌──────────────┐
        │   page.tsx    │ ─────────────────▶ │  state React │
        │  (component)  │ ◀───────────────── │  (bộ nhớ)    │
        └───────┬───────┘      render lại    └──────────────┘
                │ JSX
                ▼
        ┌───────────────┐
        │  DOM trình    │  những gì bạn nhìn thấy
        │  duyệt        │
        └───────────────┘
```

Không có vòng nào quay ngược lên `data/`. Dữ liệu chỉ chảy một chiều:
hằng số → state → giao diện. Đó là lý do toàn bộ app đọc rất dễ: mỗi màn hình
là một hàm thuần, đầu vào rõ ràng, không có "ma trận" cập nhật chéo.

Khách duy nhất phá vẻ "thuần" đó là `session.ts`, vì nó là trạng thái dùng chung
cho cả app — sẽ đọc kỹ ở tài liệu `03`.

## 7. Bảng URL đầy đủ

| URL | File | Ai vào được |
| --- | --- | --- |
| `/` | `pages/Home.tsx` | tất cả |
| `/blog` | `pages/Blog.tsx` | tất cả |
| `/rewards` | `pages/Rewards.tsx` | tất cả |
| `/leaderboard` | `pages/Leaderboard.tsx` | tất cả |
| `/scanner` | `pages/Scanner.tsx` | tất cả |
| `/map` | `pages/MapPage.tsx` | tất cả |
| `/partners` | `pages/Partners.tsx` | tất cả |
| `/feedback` | `pages/Feedback.tsx` | tất cả |
| `/guidance` | `pages/Guidance.tsx` | tất cả |
| `/waste` | `pages/Waste.tsx` | tất cả |
| `/join-recycler` | `pages/JoinRecycler.tsx` | tất cả |
| `/login` `/register` `/reset-password` | `pages/Login|Register|ResetPassword.tsx` | tất cả |
| `/account/profile` `/account/password` | `pages/account/*` | tất cả (khách thấy lời mời đăng nhập) |
| `/chat` | `pages/Chat.tsx` | user, recycler |
| `/user` + 5 trang con | `pages/user/*` | user |
| `/recycler` + 3 trang con | `pages/recycler/*` | recycler |
| `/staff` + 11 trang con | `pages/staff/*` | staff |
| `/admin` + 13 trang con | `pages/admin/*` | admin |
| còn lại | `pages/NotFound.tsx` | tất cả |

## 8. Chạy thử

```bash
npm install     # lần đầu, tải thư viện vào node_modules/
npm run dev     # mở http://localhost:5173
```

Đăng nhập thử: vào `/login`, nhập tên bất kỳ. Ô chọn vai trò quyết định bạn vào
khu nào. Không có mật khẩu thật — mật khẩu nào cũng được.

Ba lệnh kiểm tra (chạy trước khi commit):

```bash
npm run typecheck    # TypeScript có báo lỗi kiểu không
npm run check        # render 56 trang/màn hình ra HTML, xem có trang trắng/mất nội dung không
npm run check:routes # render cây route thật, kiểm tra RequireRole/Portal/Layout
```

---

**Tiếp:** [01 · React trong 20 phút](01-react-co-ban.md) — nếu bạn chưa từng viết
React, đọc bài này trước khi đọc code, nếu không mọi thứ sẽ như tiếng nước ngoài.
