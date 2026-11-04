# 15 · Phỏng vấn & đi làm — biến dự án này thành lợi thế

> Bạn đã có một dự án thật (web đa vai trò, 51 màn hình, có kiểm thử, có chú trọng khả năng tiếp cận). Tài liệu này dạy bạn **kể về nó**, **trả lời 40 câu hỏi hay gặp**, và **lộ trình học tiếp** để không bị "bí" khi nhà tuyển dụng hỏi sâu.
>
> Đọc kèm: **13** (bạn sửa được gì — nói ra được rất "chất") và **14** (nền kiến thức cho từng câu trả lời).

---

## §1. Trong tay bạn đang có gì (nói đúng, không nổ)

| Dự án này CÓ | Ý nghĩa khi phỏng vấn |
|---|---|
| Web app một trang (SPA) cho 4 vai trò: người dân, cơ sở thu mua, nhân viên, quản trị | Biết làm app nhiều vai trò, phân quyền giao diện |
| ~90 file mã nguồn, 51 màn hình, dữ liệu tách riêng khỏi giao diện | Tư duy cấu trúc, biết tách "nguồn sự thật" |
| React + TypeScript + react-router-dom + Tailwind | Đúng bộ công nghệ các công ty đang tuyển fresher/junior |
| Có xử lý khả năng tiếp cận: bàn phím, `alt`, `aria-`, giảm chuyển động | Điểm cộng khó tìm ở ứng viên mới |
| Có kiểm thử: 94 phép kiểm tự động (`npm run check` + `check:routes`) | Hiểu vì sao cần test — vượt xa mặt bằng fresher |
| Biết chỗ yếu của mình: chưa có backend/API/database | Nói ra được điều mình đang học là "chín chắn" |

| Dự án CHƯA có | Bạn nói thế nào (xem §5) |
|---|---|
| Backend, API, cơ sở dữ liệu | "Dữ liệu đang tĩnh trong file; tôi đang học Node + PostgreSQL để nối thật." |
| Đăng nhập thật, bảo mật | "Phiên đăng nhập hiện là mô phỏng để học luồng giao diện." |
| Thư viện test chuyên dụng (Vitest/RTL, Playwright) | "Tôi tự viết 2 bộ kiểm thử render; bước tiếp là React Testing Library + Playwright." |

---

## §2. Bài giới thiệu 90 giây (học thuộc lòng, nói tự nhiên)

> "Dự án gần nhất của tôi là **EcoLink** — một web app quản lý thu gom và tái chế rác, tôi xây bằng **React + TypeScript**. App có **4 vai trò**: người dân gửi yêu cầu thu gom, cơ sở thu mua nhận xử lý, nhân viên duyệt dữ liệu AI, quản trị viên cấu hình hệ thống — phân quyền theo từng khu vực màn hình.
>
> Điểm tôi tâm đắc nhất là **cách tổ chức dữ liệu**: mọi danh mục như giá thu mua, phần quà, bài viết đều là 'một nguồn sự thật' duy nhất trong thư mục `data`, nên nhiều màn hình dùng chung mà sửa một chỗ là xong. Tôi cũng viết **2 bộ kiểm thử tự động — 94 phép kiểm** cho toàn bộ màn hình và bảng địa chỉ, và chú trọng **khả năng tiếp cận**: app dùng được hoàn toàn bằng bàn phím, có nhãn cho screen reader, có tôn trọng tuỳ chọn 'giảm hiệu ứng' của người dùng.
>
> Vì đây là dự án học tập, nó **chưa có backend** — phần đó là mục tiêu học tiếp của tôi với Node.js và cơ sở dữ liệu."

**Bốn câu 'thần chú' để chèn ở bất kỳ đâu khi nói tiếp:** (1) nguồn sự thật duy nhất; (2) tách giao diện khỏi dữ liệu; (3) test để dám sửa; (4) a11y là cho người dùng thật.

**Nên / Kỵ:**
- ✅ Nói **vì sao** (tôi chọn một kho dữ liệu vì 5 màn hình cùng đọc) hơn là **cái gì** (tôi có 90 file).
- ✅ Nói thẳng phần chưa làm — kem kèm "đang học gì, học tới đâu".
- ❌ Đừng nói "app đang chạy thật cho hàng nghìn người" — người phỏng vấn hỏi lên là lộ ngay.

---

## §3. CV: 5 gạch đầu dòng mẫu cho dự án này

```
EcoLink — Web app thu gom & tái chế (dự án cá nhân)
• React + TypeScript + Vite + Tailwind CSS; 51 màn hình, 4 vai trò (người dùng/nhà thu mua/nhân viên/quản trị)
• Thiết kế tầng dữ liệu tập trung (một nguồn sự thật) giúp 13 file dữ liệu phục vụ toàn app, dễ tùy biến không cần sửa giao diện
• Viết 2 bộ kiểm thử tự động (94 phép kiểm) cho màn hình và route; phát hiện & xử lý lỗi sinh mã trùng bằng cách dùng mã lớn nhất thay vì độ dài danh sách
• Chú trọng WCAG: điều hướng bàn phím đầy đủ, aria cho màn hình đọc, hỗ trợ prefers-reduced-motion
• Sẵn sàng nối backend: đang học Node.js/PostgreSQL để chuyển dữ liệu tĩnh sang API thật
```

---

## §4. 40 câu hỏi phỏng vấn thường gặp (kèm đáp án ngắn + móc vào dự án)

### HTML (4 câu)
1. **`<!DOCTYPE html>` để làm gì?** Báo trình duyệt render theo chuẩn HTML5 hiện đại, tránh "chế độ cũ". *Dự án: dòng đầu `index.html`.*
2. **Vì sao dùng thẻ semantic (`nav`, `main`, `footer`) thay vì chỉ `div`?** Máy đọc màn hình và SEO hiểu cấu trúc; người sau đọc code dễ hơn. *Dự án: chia khối rõ — `Navbar.tsx`, phần nội dung, phần chân trang.*
3. **Thuộc tính `alt` của ảnh dùng làm gì?** Mô tả ảnh cho người không thấy ảnh; ảnh trang trí để `alt=""` để máy đọc bỏ qua.
4. **Vì sao `label` cần gắn với `input`?** Bấm vào nhãn là nhảy focus vào ô nhập; screen reader đọc đúng tên ô. *Dự án: các biểu mẫu đều có nhãn.*

### CSS (6 câu)
5. **Box model?** Mỗi phần tử là hộp: nội dung → đệm (`padding`) → viền (`border`) → khoảng ngoài (`margin`).
6. **Flexbox vs Grid, khi nào dùng cái nào?** Flex cho xếp hàng/cột một chiều (dự án dùng rất nhiều: `flex`, `gap`); Grid cho lưới hai chiều như bảng.
7. **Căn giữa một phần tử bằng cách hiện đại?** `display:flex; place-items:center` (hoặc `grid; place-items:center`) — dự án dùng `place-items-center` cho các vòng tròn số thứ tự.
8. **Responsive làm thế nào?** Mobile-first + breakpoint: viết kiểu cho màn nhỏ trước, màn lớn dùng tiền tố `sm:` `md:` `lg:`. *Dự án: menu desktop/mobile tách hai bộ dữ liệu trong `nav.ts`.*
9. **Tailwind là gì, lợi/hại?** Là utility-CSS: ráp class nhỏ thành kiểu; lợi là nhất quán, không chế tên class; hại là HTML dài nếu lạm dụng — nên gom các mẫu lặp thành class nhà làm như `.btn`.
10. **Độ tương phản màu là gì, ngưỡng nào?** Chênh sáng giữa chữ và nền, chuẩn WCAG cần ≥4.5:1 cho chữ thường. *Dự án: ghi chú ngay trong `src/index.css`.*

### JavaScript (8 câu)
11. **`var` / `let` / `const`?** `var` kiểu cũ (phạm vi lỏng, tránh dùng); `let` đổi được; `const` không gán lại được. Dự án dùng `const` mặc định.
12. **`==` vs `===`?** `==` tự đổi kiểu (nguy hiểm), `===` so cả kiểu. Luôn dùng `===`.
13. **Giá trị "falsy" nào hay gặp?** `false`, `0`, `""`, `null`, `undefined`. Ví dụ trong sân chơi tài liệu 14: `name || "bạn"` — chưa gõ tên (`""`) thì hiện "bạn".
14. **`map` / `filter` / `find` khác nhau?** `map` biến đổi từng mục; `filter` giữ mục thỏa điều kiện; `find` lấy một mục đầu tiên. *Dự án: danh sách rác/quà đều đi qua đúng ba hàm này.*
15. **Hàm trong JS là "công dân hạng nhất" nghĩa là gì?** Truyền được như giá trị: `onClick={() => ...}` là bỏ một hàm vào thuộc tính.
16. **Vì sao khi đổi state phải tạo giá trị mới (`setCount(count + 1)`) mà không sửa trực tiếp?** React so sánh "cũ vs mới" để biết cần vẽ lại; sửa chui thì nó không thấy.
17. **`setTimeout` / Promise để làm gì?** Việc xảy ra "sau đó" — không chặn giao diện. *Dự án: `Scanner` giả lập AI "suy nghĩ vài giây".*
18. **`localStorage` là gì, được nhớ đến khi nào?** Ngăn kéo của trình duyệt, tồn tại qua F5 cho tới khi xoá. *Dự án: nhớ "bạn đang đăng nhập vai gì" (`ecolink:user`).*

### TypeScript (4 câu)
19. **Dùng TS thay JS để làm gì?** Bắt lỗi kiểu lúc viết code, tự gợi ý chính xác; lỗi sớm rẻ hơn lỗi muộn.
20. **`type` vs `interface`?** Gần như tương đương cho hồ sơ dữ liệu; `type` hợp khi cần "hoặc" (`A | B`). *Dự án: `type Waste`.*
21. **Union type là gì, lợi chỗ nào?** "Hoặc": `group` chỉ được là 1 trong 6 chuỗi — gõ sai dấu là lỗi đỏ ngay. *Dự án: `Waste.group`, `Reward.kind`.*
22. **`Record<Role, PortalSection[]>` nghĩa là gì?** "Một bảng gồm 4 khóa (4 vai trò), mỗi khóa chứa danh sách mục menu". *Dự án: `PORTAL_NAV`.*

### React (10 câu)
23. **Component là gì?** Hàm trả về "giao diện"; tên viết hoa; lắp ghép như Lego.
24. **Props vs state?** Props: nguyên liệu truyền vào từ cha, chỉ đọc. State: trí nhớ nội bộ, đổi được bằng hàm `set`.
25. **`useState` hoạt động thế nào?** Trả về [giá trị, hàm đổi]; gọi hàm đổi → React vẽ lại màn hình với giá trị mới.
26. **Vì sao `key` cần duy nhất trong danh sách?** React dùng key để biết mục nào giữ nguyên/mới/xoá khi danh sách đổi; sai key là "lộn hồ sơ" (mất state mục, animation sai).
27. **Controlled input là gì?** Ô nhập lấy giá trị từ state (`value`) và cập nhật state khi gõ (`onChange`) — state là "nguồn sự thật" duy nhất.
28. **"Nâng state lên" (lifting state up) là gì?** Khi hai component cần chung một state, để state ở cha gần nhất rồi truyền xuống. *Dự án: bộ lọc nhóm ở trang hướng dẫn điều khiển cả danh sách.*
29. **`useEffect` dùng khi nào? Hàm dọn dẹp để làm gì?** Chạy việc sau khi vẽ (hẹn giờ, theo dõi sự kiện); hàm dọn dẹp chạy khi rời trang để tắt hẹn giờ tránh "rác". *Dự án: `Scanner` clearTimeout khi rời trang.*
30. **Context API hoặc Redux khi nào cần?** Khi nhiều nơi xa nhau cùng cần một mớ dữ liệu chung. *Dự án: chưa cần — phiên đăng nhập đi qua một hook + localStorage là đủ; đây là lựa chọn có chủ ý, nói ra khi phỏng vấn rất điểm cộng.*
31. **React Router: layout route là gì?** Một route bọc chung (navbar/footer) để các route con thay nhau hiện qua `Outlet`. *Dự án: `<Route element={<Layout />}>` bọc toàn bộ trang công khai; khu nội bộ có "khung" riêng.*
32. **Cách chặn người chưa đăng nhập?** Component guard: kiểm tra vai trò, không đủ thì chuyển hướng. *Dự án: `RequireRole`.* (Điểm cần nói thật: chặn phía trình duyệt chỉ để "đúng luồng giao diện" — chặn thật phải ở backend.)

### Router + công cụ (3 câu)
33. **Route động (`/user/:id`) vs route tĩnh?** Động để đọc phần thay đổi từ địa chỉ; dự án hiện dùng địa chỉ tĩnh.
34. **Trang 404 làm thế nào?** Route "bắt tất cả": `path="*"`. *Dự án: `NotFound`.*
35. **`npm run build` làm gì?** Chạy kiểm tra kiểu (`tsc --noEmit`) rồi đóng gói nén (`vite build`) ra thư mục `dist` để triển khai.

### Hành vi (5 câu)
36. **Kể một lỗi khó và cách bạn tìm ra.** *Dùng câu chuyện có thật trong repo:* "Trang tạo mã tự động sinh mã bằng 'độ dài danh sách + 1' — xoá một mục rồi thêm mục mới là hai mục trùng mã. Tôi sửa bằng cách lấy mã lớn nhất đã từng dùng rồi +1. Bài học: mã định danh phải nói về *đã từng dùng*, không phải *đang có*."
37. **Vì sao bạn viết test cho dự án cá nhân?** "Để dám sửa. 94 phép kiểm giúp tôi liều tái cấu trúc mà biết màn hình nào vỡ ngay."
38. **Bạn học công nghệ mới thế nào?** Nêu ví dụ thật: đọc tài liệu chính thức → làm dự án nhỏ → tự viết tài liệu học lại từ đầu (như bộ `docs/hoc-code` này — thể hiện khả năng diễn đạt, thứ được đánh giá cao).
39. **Điểm yếu lớn nhất?** "Tôi chưa từng làm việc với backend thật; tôi đang học Node.js + PostgreSQL theo lộ trình §6 và sẽ nối backend cho chính dự án này."
40. **Vì sao chọn frontend?** Trả lời thật + 1 lý do kỹ thuật: "Tôi thích phần 'chạm' được vào người dùng nhất — trạng thái, phản hồi tức thì, tiếp cận; và frontend cho tôi thấy kết quả ngay khi học."

---

## §5. Nói về phần "chưa có backend" mà không tự dìm mình

Công thức 3 nhịp — **thừa nhận → vì sao hợp lý → đang làm gì tiếp**:

> "Đúng, dữ liệu hiện là tĩnh trong file và phiên đăng nhập là mô phỏng — mục tiêu của phiên bản này là hoàn thiện **trải nghiệm và luồng nghiệp vụ**. Phần tôi chủ động làm trước khi có backend chính là: tách dữ liệu thành một nguồn sự thật duy nhất, viết kiểm thử, và một bảng route rõ ràng — nghĩa là khi nối API, tôi chỉ đổi tầng dữ liệu, giao diện gần như giữ nguyên. Đó chính là việc tôi đang làm tiếp với Node.js và PostgreSQL."

Ghi nhớ: người phỏng vấn fresher **không** trông đợi app có backend thật. Họ trông đợi bạn *hiểu mình có gì*, *vì sao làm vậy*, và *học tiếp thế nào*.

---

## §6. Lộ trình 6 tháng sau dự án này (từng chặng có sản phẩm)

| Tháng | Học | Sản phẩm để chứng minh |
|---|---|---|
| 1 | JavaScript sâu hơn: bất đồng bộ (Promise/async-await), mảng & đối tượng nâng cao | Viết lại sân chơi tài liệu 14 thành 1 app nhỏ nhiều màn hình |
| 2 | **React Testing Library + Vitest**: viết test theo cách công ty làm | Chuyển 20 phép kiểm trong `check.tsx` sang RTL |
| 2–3 | **Node.js + Express**: REST API, middleware, xử lý lỗi | API giả cho EcoLink: `GET /rewards`, `POST /handovers` |
| 3–4 | **PostgreSQL + Prisma**: bảng, quan hệ, truy vấn | Đưa WASTES/REWARDS/đơn hàng vào database thật |
| 4 | **Nối frontend ↔ backend**: fetch/React Query, trạng thái loading/error | EcoLink bản 2: dữ liệu từ API, đăng nhập thật (JWT) |
| 5 | **E2E với Playwright** + deploy (Vercel cho web, Render/Railway cho API) | Link demo công khai cho CV |
| 6 | Ôn phỏng vấn theo §4, làm lại bài giới thiệu §2 với bản 2 | — |

Nguyên tắc chọn học: **mỗi tháng phải có sản phẩm chạy được**. Học xong một khóa mà không có gì để chỉ thì coi như chưa học.

---

## §7. Câu bạn nên hỏi ngược nhà tuyển dụng (cuối buổi phỏng vấn)

1. Nhóm đang dùng React phiên bản nào, có dùng TypeScript không? Quy trình review code thế nào?
2. Một lập trình viên mới trong 3 tháng đầu được kỳ vọng làm được gì?
3. Nhóm đo chất lượng bằng gì — có viết test, có quy trình design review chứ?
4. Đây là vị trí tuyển mới hay thay thế? Lý do tuyển?
5. Trong 6 tháng tới, sản phẩm có cột mốc lớn nào mà tôi có thể góp phần?

---

## Tự kiểm

1. Nói bài giới thiệu 90 giây (§2) không nhìn tài liệu — quay video lại để tự xem.
2. Trả lời 10 câu bất kỳ trong §4 bằng lời của bạn, mỗi câu dưới 30 giây.
3. Kể trọn câu chuyện lỗi "sinh mã trùng" theo khung: hiện tượng → căn nguyên → cách sửa → bài học.
4. Viết bản CV với 5 gạch đầu dòng §3 theo cách diễn đạt của bạn.
5. Chọn 2 câu ở §7 mà bạn thấy thật sự muốn biết đáp án, và tự nghĩ xem đáp án lý tưởng là gì.

---

*Liên quan: **13** (bạn sửa được gì — nói ra được trong phỏng vấn) · **14** (nền kiến thức cho từng câu trả lời ở §4).*
