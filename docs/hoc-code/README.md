# Hiểu 100% EcoLink Web

Tài liệu này viết cho người **gần như chưa biết code**. Mỗi tài liệu đi kèm hình vẽ
(ASCII hiển thị đúng ở mọi editor; từ tài liệu `13` trở đi có thêm **hình SVG minh họa**
trong thư mục `anh/` — mở bằng mọi trình duyệt hoặc xem trước trong VS Code), giải thích
*code làm gì* và *tại sao viết như vậy*, không chỉ dịch từ khoá tiếng Anh sang tiếng Việt.

## Sự thật cần biết trước

Dự án có **82 file, 12.462 dòng code**. Không ai đọc hết trong một buổi, và cũng
không cần. Code được tổ chức thành 3 lớp:

```
LỚP KHUNG   (≈ 500 dòng)   App.tsx, Layout, RequireRole, session.ts
   ↓ quyết định "vào trang nào, ai được vào, khung trang trông ra sao"
LỚP DỮ LIỆU (≈ 1.600 dòng) src/data/*.ts
   ↓ toàn bộ chữ, giá, danh sách, bảng biểu nằm ở đây
LỚP MÀN HÌNH (≈ 10.300 dòng) src/pages/*, src/components/*
   ↓ mỗi file = một màn hình, chỉ việc bày dữ liệu ra và bắt sự kiện
```

Hiểu **lớp khung** thì mọi trang còn lại chỉ là biến thể của cùng một công thức.
Vì vậy lộ trình bên dưới học khung trước, màn hình sau.

## Cách học (5 lượt)

| Lượt | Việc làm | Mục tiêu |
| --- | --- | --- |
| 1. Chạy | `npm install` rồi `npm run dev`, mở http://localhost:5173 | Tay chạm mắt thấy app thật |
| 2. Khung | Đọc `00` → `03` | Biết một cú click đi qua những file nào |
| 3. Trang | Đọc lần lượt `03b` → `12`, mỗi ngày 1–2 file | Đọc được bất kỳ file nào |
| 4. Tùy biến | Đọc [13](13-tuy-bien.md) và tự sửa app theo từng mức (1 → 4) | Tự đổi giá, màu, thêm trang… mà không sợ hỏng |
| 5. Học sâu & phỏng vấn | [14](14-hoc-code-tu-so-0.md) (16 buổi từ số 0) → [15](15-phong-van.md) | Tự tin đi làm, bước vào phỏng vấn |

Quy tắc khi đọc một file code: **đọc từ trên xuống, nhưng chỉ cần trả lời 4 câu**

1. File này *nhận vào* cái gì? (props, tham số, import)
2. Nó *giữ* trạng thái gì? (`useState`, hằng số)
3. Nó *vẽ ra* cái gì? (phần `return (...)` — chiếm 80% độ dài)
4. Nó *phản ứng* với cái gì? (`onClick`, `onChange`, `useEffect`)

## Lộ trình

| # | Tài liệu | Nội dung | Trạng thái |
| --- | --- | --- | --- |
| 00 | [Bản đồ dự án](00-ban-do.md) | App là gì, stack, cây thư mục, 4 vai trò, luồng chạy | ✅ |
| 01 | [React trong 20 phút](01-react-co-ban.md) | Component, JSX, props, state, hook, TS, Tailwind — mọi ví dụ lấy từ repo này | ✅ |
| 02 | [Một trang được sinh ra thế nào](02-khoi-dong.md) | `index.html` → `main.tsx` → `App.tsx` → `Layout` — từng dòng | ✅ |
| 03 | [Đăng nhập và phân quyền](03-phien-dang-nhap.md) | `session.ts` + `RequireRole.tsx` — từng dòng, kèm biểu đồ | ✅ |
| 03b | [Cửa vào: đăng nhập, đăng ký, đặt lại mật khẩu](03b-cua-vao-dang-nhap.md) | `AuthForm.tsx` (+`Login`/`Register`), `ResetPassword.tsx` | ✅ |
| 04 | [Khung công khai](04-khung-cong-khai.md) | `Navbar`, `MobileNav`, `Footer` — từng dòng | ✅ |
| 05 | [Lớp dữ liệu](05-du-lieu.md) | 13 file `src/data/*`, công thức tiền, điểm, 3 phát hiện khi review | ✅ |
| 06 | [Trang chủ & Scanner](06-home-scanner.md) | `Home.tsx`, `Scanner.tsx` — màn hình phức tạp nhất | ✅ |
| 06b | [Góp ý & Đổi thưởng](06b-feedback-rewards.md) | `Feedback.tsx` (validate form), `Rewards.tsx` (điểm danh) | ✅ |
| 06c | [Các trang nội dung](06c-trang-cong-khai.md) | `MapPage`, `Partners`, `Blog`, `Guidance`, `Waste`, `Chat`, `JoinRecycler`, `Leaderboard` | ✅ |
| 07 | [Khu Người dân](07-khu-nguoi-dan.md) | `pages/user/*` (6 file) | ✅ |
| 07b | [Tài khoản người dân](07b-tai-khoan-nguoi-dan.md) | `account/Profile.tsx`, `account/Password.tsx` | ✅ |
| 08 | [Khu Cơ sở thu mua](08-khu-co-so-thu-mua.md) | `pages/recycler/*` (4 file) | ✅ |
| 09 | [Khu Nhân viên](09-khu-nhan-vien.md) | `pages/staff/*` (10 file) | ✅ |
| 10 | [Khung làm việc](10-khung-lam-viec.md) | `Portal`, `admin/Shell`, `admin/ui`, `Assistant`, `CheckIn`, `Leaderboard` | ✅ |
| 11 | [Khu Quản trị I](11-khu-quan-tri-1.md) | `Home`, `Reports`, `Reconciliation`, `Fees` — theo dõi & đối soát | ✅ |
| 11b | [Khu Quản trị II](11b-khu-quan-tri-2.md) | 9 trang cấu hình, nội dung, tài khoản nội bộ | ✅ |
| 12 | [Kiểm thử & CSS](12-kiem-thu-va-css.md) | `check.tsx`, `check-routes.tsx`, `index.css` | ✅ |
| 13 | [Tùy biến: sửa được gì, không sửa được gì](13-tuy-bien.md) | 5 mức tùy biến, bảng "trông sửa được mà không", nút chết, quy trình sửa an toàn | ✅ |
| 14 | [Học code từ số 0](14-hoc-code-tu-so-0.md) | 16 buổi (HTML/CSS/JS/TS/React/Git…), sân chơi tự làm, lộ trình 8 tuần | ✅ |
| 15 | [Phỏng vấn & đi làm](15-phong-van.md) | Bài giới thiệu 90 giây, CV, 40 câu hỏi phỏng vấn, lộ trình 6 tháng học tiếp | ✅ |
| NK | [Quy trình ghi nhật ký làm việc](../QUY_TRINH_GHI_NHAT_KY.md) | Quy định lưu lịch sử trao đổi, giải pháp kỹ thuật và kết quả test làm minh chứng nộp giảng viên | ✅ |

> **Hình minh họa** của các tài liệu `13`–`15` nằm trong thư mục [`anh/`](anh/) (file `.svg` — mở trực tiếp bằng trình duyệt cũng xem được).

Mỗi tài liệu từ `04` trở đi theo cùng một khuôn:

- **Màn hình này để làm gì** (nghiệp vụ, 2–3 câu)
- **Sơ đồ** luồng dữ liệu / luồng bấm
- **Từng khối code**: dải dòng nào, làm gì, tại sao làm thế, nếu xoá thì hỏng gì
- **Tự kiểm tra**: 3 câu hỏi + đáp án

## Bản đồ file (để tra nhanh)

```
ecolink-web/
├─ index.html            vỏ HTML duy nhất, chứa <div id="root">
├─ vite.config.ts        cấu hình dev server + alias @/ → src/
├─ tsconfig.json         luật của TypeScript
├─ public/assets/        ảnh, video, logo (10 MB, không qua bundler)
├─ docs/                 tài liệu (bạn đang ở đây; hình minh họa trong hoc-code/anh/)
└─ src/
   ├─ main.tsx           điểm khởi động React
   ├─ App.tsx            bảng route: URL nào → trang nào
   ├─ index.css          Tailwind + bảng màu + class dùng lại
   ├─ check.tsx          smoke test render 56 trang/màn hình
   ├─ check-routes.tsx   test cây route thật
   ├─ lib/session.ts     đăng nhập giả bằng localStorage
   ├─ components/        khung dùng chung (12 file)
   ├─ data/              nội dung tĩnh (13 file)
   └─ pages/             51 màn hình, chia theo vai trò
```

## Quy ước chữ trong tài liệu

| Ký hiệu | Nghĩa |
| --- | --- |
| `monospace` | tên file, tên biến, đoạn code thật |
| **đậm** | khái niệm cần nhớ |
| ⚠️ | chỗ dễ hiểu sai, hoặc bẫy đã từng gây bug thật trong repo |
| 🔍 | "tại sao", phần giải thích quyết định thiết kế |
| Dòng 42 | số dòng đúng như mở file trong editor |
