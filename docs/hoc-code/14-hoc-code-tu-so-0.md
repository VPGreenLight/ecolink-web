# 14 · Học lập trình từ số 0 — dùng chính dự án này làm sách giáo khoa

> Dành cho người **chưa biết gì về code**. Học xong bộ này, bạn hiểu được *mọi dòng* trong dự án `ecolink-web`, biết tự sửa và tự thêm tính năng nhỏ — và có nền để học tiếp tới mức đi làm.
>
> **Cách học:** 16 buổi, mỗi buổi 30–60 phút. Mỗi buổi có 4 phần: **Hiểu gì** → **Nhìn vào đâu** (file thật trong dự án) → **Bài tập 5 phút** → **Tự kiểm**. Đừng đọc liền một hơi — làm bài tập mới nhớ. Chuẩn bị: đọc tài liệu 13 §0 để biết cách bật app và "undo".

---

## Buổi 0 — Từ điển bách khoa (đọc lướt, quay lại tra khi gặp)

Mỗi từ gồm: **nghĩa đời thường** — *trong dự án này nằm ở đâu*.

**Về trang web:**
- **Trình duyệt (browser)** — Chrome/Edge: phần mềm "đọc" chữ và vẽ ra màn hình đẹp — *nơi bạn xem app tại `localhost:5173`*.
- **HTML** — "bộ xương" của trang: quy định chỗ nào là tiêu đề, đoạn văn, nút bấm — *file `index.html` và phần "return" trong mỗi file `.tsx`*.
- **CSS** — "quần áo và trang điểm": màu sắc, kích thước, khoảng cách — *src/index.css + các class viết trong từng file `.tsx`*.
- **JavaScript (JS)** — "bộ não": ra lệnh, tính toán, phản ứng khi bấm nút — *mọi file `.ts`/`.tsx`*.
- **TypeScript (TS)** — JavaScript mặc thêm "áo giáp kiểm tra": gõ sai kiểu dữ liệu là báo lỗi ngay khi viết — *toàn dự án dùng TS; nhận biết qua đuôi `.ts`/`.tsx`*.

**Về cách viết code:**
- **Biến (variable)** — cái hộp có dán nhãn để đựng một giá trị — *`const price = 2_200`*.
- **Hàm (function)** — cái máy: bỏ nguyên liệu vào (input) → nhận kết quả ra (output) — *`settle()` tính tiền, `tierProgress()` tính hạng*.
- **Mảng (array)** — danh sách có thứ tự — *`WASTES` là danh sách các loại rác*.
- **Đối tượng (object)** — một "thẻ hồ sơ" gồm nhiều dòng *tên: giá trị* — *mỗi loại rác là một object có `name`, `price`…*.
- **Điều kiện (if)** — ngã rẽ: nếu… thì… — *"nếu đủ điểm thì cho đổi quà"*.
- **Vòng lặp** — máy làm lặp một việc cho từng mục trong danh sách — *vẽ 15 thẻ quà bằng `.map()`*.

**Về React (thư viện làm giao diện):**
- **Component** — một "khuôn đúc" giao diện tái sử dụng: đúc ra nhiều chỗ giống nhau — *`Card`, `Field`, `Navbar`… trong `src/components/`*.
- **Props** — "nguyên liệu truyền vào khuôn" — *`<PageHead title="..." body="..." />`*.
- **State** — "trí nhớ ngắn hạn" của một màn hình (người dùng vừa gõ gì, đang chọn mục nào) — *`useState`*.
- **Render** — hành động "vẽ lại màn hình" khi state đổi — *gõ vào ô tìm kiếm là danh sách vẽ lại*.
- **Route (địa chỉ)** — đường dẫn mở một màn hình — *`/waste`, `/admin/fees`*.
- **Import / Export** — "mượn" và "cho mượn" giữa các file — *`import { WASTES } from "@/data/waste"`*.

**Về hạ tầng:**
- **Node.js / npm** — bộ máy + chợ công cụ chạy trên máy tính (không phải trong trình duyệt) — *bạn gõ `npm run dev`*.
- **Vite** — "máy chạy thử" kiêm "người đưa thư tốc hành": Ctrl+S là tự cập nhật trình duyệt — *ẩn bên trong `npm run dev`*.
- **Build** — đóng gói code thành bản chạy thật nhẹ và nhanh — *`npm run build`*.
- **Backend / API / Database** — "hậu trường": máy chủ xử lý + công thức nhận/gửi dữ liệu + kho lưu trữ lâu dài — *dự án CHƯA có, xem tài liệu 15*.
- **localStorage** — "ngăn kéo nhớ tạm" của trình duyệt, xoá là mất — *nơi app nhớ "bạn đang đăng nhập vai gì"*.
- **Git / Commit / Repo** — hệ thống điểm lưu + thư viện code — *xem tài liệu 13 §0.4*.

---

## Buổi 1 — Một trang web "chạy" nghĩa là gì?

**Hiểu gì.** Khi bạn mở `localhost:5173`:

```
BẠN                    MÁY CHẠY THỬ (Vite)                   TRÌNH DUYỆT
 │  mở địa chỉ     →    │  nhận yêu cầu, gom file code   →   │  nhận code, "chạy" nó
 │                      │  lại thành một gói gọn            │  → VẼ RA màn hình
 │  bấm nút        →    │  (Ctrl+S thì gom lại, HMR đẩy  →   │  code chạy lại phần vừa đổi
 │                      │   đúng phần vừa đổi qua)           │  → vẽ lại phần đó
```

App này **không hỏi Internet**: mọi dữ liệu (giá rác, quà, bài viết) đã nằm sẵn trong file code. Vì thế không có mạng vẫn chạy được.

**Nhìn vào đâu.** File `index.html` ở gốc dự án — "tờ khai sinh" của app: có tên app trên tab, và một dòng duy nhất "mời" toàn bộ app vào — dòng có `src="/src/main.tsx"`.

**Bài tập 5 phút.** Mở `index.html`, đổi chữ trong thẻ `<title>` thành `EcoLink của tôi`. Ctrl+S. Nhìn **tên tab** trình duyệt đổi ngay.

**Tự kiểm.** Vì sao sửa `index.html` là sửa được tên tab, mà tên các mục menu lại phải vào `src/data/nav.ts`? *(Gợi ý: mỗi thứ thuộc về file "khai sinh" ra nó.)*

---

## Buổi 2 — HTML: bộ xương của màn hình

**Hiểu gì.** HTML là các **thẻ** lồng nhau, như hộp trong hộp:

```
<div>  ← cái hộp
  <h1>Chào bạn!</h1>        ← tiêu đề lớn   (h1: heading 1)
  <p>Hôm nay thu gom nhé</p> ← đoạn văn       (p: paragraph)
  <button>Bấm tôi</button>  ← nút bấm
</div>
```

Thẻ mở `<div>` và thẻ đóng `</div>` (có dấu `/`) phải khớp từng cặp — như ngoặc đơn trong toán học.

**Nhìn vào đâu.** Trong trình duyệt, bấm **F12 → tab Elements**: bạn đang nhìn chính bộ xương HTML mà trình duyệt vẽ ra — do code React sinh ra (buổi 8 sẽ hiểu vì sao bạn không thấy chữ này trong `index.html`).

**Bài tập 5 phút.** Mở `/waste`, bấm F12, dùng nút mũi tên (⤢) chọn một dòng trong bảng giá — xem `Elements` sáng lên tương ứng. Tìm xem dòng "Bìa carton" là `<td>`, `<th>` hay `<div>`.

**Tự kiểm.** Ba loại thẻ quen thuộc nhất trong dự án này là gì? *(div = hộp chung, button = nút, h1/h2/p = tiêu đề và đoạn văn.)*

---

## Buổi 3 — CSS: quần áo và trang điểm

**Hiểu gì.** CSS gồm các "luật" gắn vào **class** — cái nhãn dán lên hộp HTML. Ví dụ dòng code này:

```tsx
<div className="page flex flex-col gap-6">
```

nghĩa là: hộp này thuộc các nhãn `page` (bề rộng chuẩn, canh giữa), `flex` (xếp con theo hàng/cột), `flex-col` (xếp thành cột dọc), `gap-6` (cách nhau 24px). Các nhãn kiểu `px-4`, `text-sm`, `gap-6` đến từ **Tailwind** — thư viện class đặt tên theo việc chúng làm (`px` = đệm trái phải, `text` = chữ).

Ngoài Tailwind, dự án có vài class "của nhà làm" trong `src/index.css`: `.page`, `.card`, `.btn`, `.btn-primary`, `.btn-outline`, `.btn-ghost` — làm sẵn để cả app dùng chung một kiểu.

**Nhìn vào đâu.** `src/index.css` — đọc phần `@theme` (bảng màu) và xem định nghĩa `.card`, `.btn-primary`.

**Bài tập 5 phút.** Theo tài liệu 13 §3, đổi `--color-brand`; sau đó bấm F12 vào một nút xanh bất kỳ, sang tab **Styles** để "bắt quả tang" màu đó đang áp từ class nào.

**Tự kiểm.** `class` và `className` khác gì nhau? *(Cùng nghĩa; React dùng tên `className` vì `class` là từ khoá dành riêng của JS.)*

---

## Buổi 4 — JavaScript (1): giá trị và chiếc hộp có nhãn

**Hiểu gì.** Có 3 kiểu giá trị bạn gặp suốt ngày:

```ts
const name = "Bìa carton"   // chuỗi — chữ, LUÔN bọc trong ngoặc kép
const price = 2_200          // số — KHÔNG ngoặc kép (gạch _ chỉ cho dễ đọc)
const recyclable = true      // đúng/sai — chỉ có hai giá trị: true, false
```

`const` = "tạo hộp dán nhãn". Đọc thành: "hộp tên là `name`, đựng chuỗi…".

**Nhìn vào đâu.** `src/data/waste.ts` — mỗi loại rác là một "thẻ hồ sơ" (object) chứa đủ ba kiểu trên.

**Bài tập 5 phút.** Mở `src/data/rewards.ts`, nhìn thẻ quà đầu tiên. Đọc to: "thẻ này có tên là…, giá điểm là…, còn kho…". Chỉ ra một giá trị `null` (rỗng) và giải thích nghĩa của nó ở quà đó *(null = không giới hạn)*.

**Tự kiểm.** Vì sao `price: "3_000"` là sai chủ ý, còn `name: "Bìa carton"` lại đúng? *(Số thì không bọc ngoặc kép; chữ thì bắt buộc — buổi 7 “áo giáp TypeScript” sẽ bắt được lỗi này.)*

---

## Buổi 5 — JavaScript (2): hàm — cái máy input → output

**Hiểu gì.**

```
        input (bỏ vào)              CÁI MÁY (hàm)              output (nhận ra)
   10 kg bìa carton, giá 2.200  →  settle(10, 2200)  →  10 × 2.200 = 22.000
                                                          trừ phí 8% (1.760)
                                                       →  thực nhận 20.240
```

Hàm viết ra một lần, gọi được nghìn lần với nguyên liệu khác nhau. Tên hàm luôn có dấu ngoặc đơn: `settle(...)`. Trong ngoặc là nguyên liệu, chữ `return` là phần máy nhả ra.

**Nhìn vào đâu.** `src/data/waste.ts` — tìm chữ `settle`; `src/data/rewards.ts` — tìm `tierProgress` (tính xem bạn còn cách hạng trên bao nhiêu điểm).

**Bài tập 5 phút.** Đọc thân hàm `tierProgress` và trả lời bằng lời của bạn: nếu `RANK_POINTS` = 23.400 thì nó trả về kết quả thế nào? *(23.400 nằm giữa mốc Rừng 15.000 và Đại dương 30.000 → đang hạng Rừng.)*

**Tự kiểm.** Hàm khác biến ở đâu? *(Biến đựng một giá trị; hàm là cái máy nhận nguyên liệu và trả kết quả — và làm được việc mỗi lần gọi.)*

---

## Buổi 6 — Mảng: danh sách và thẻ

**Hiểu gì.**

```ts
export const WASTES: Waste[] = [   // ← dấu [ ] = đây là DANH SÁCH
  { id: "pet", name: "Chai nhựa PET", ... },   // ← mỗi { } là MỘT THẺ
  { id: "carton", name: "Bìa carton", ... },
  ...
]
```

Ba động tác làm được với mọi danh sách:
- **.filter(** điều kiện **)** — "giữ lại những thẻ thỏa điều kiện" (ví dụ: chỉ nhóm "Giấy").
- **.map(** việc cần làm **)** — "với mỗi thẻ, làm việc này" (ví dụ: vẽ ra một hàng bảng).
- **.find(** điều kiện **)** — "tìm thẻ đầu tiên thỏa điều kiện".

**Nhìn vào đâu.** `src/pages/Guidance.tsx` — dòng `WASTE_GROUPS.filter(...)` (giữ các nhóm trừ "Tất cả nhóm") và `list.map(...)` (vẽ từng mục hướng dẫn).

**Bài tập 5 phút.** Mở `/guidance`, bấm thử một nhóm vật liệu (ví dụ "Kim loại"). Nhìn lại code: nút đó chạy `setGroup(g)` → danh sách `list` được lọc theo `group` → `.map` vẽ lại. Kể lại chuỗi 3 bước bằng lời.

**Tự kiểm.** Danh sách 15 phần quà ở `/rewards` được viết tay 15 lần trong code hay vẽ bằng cách nào? *(Một thẻ khuôn + `.map` — sửa 1 chỗ trong file dữ liệu là đổi cả danh sách.)*

---

## Buổi 7 — TypeScript: áo giáp của JavaScript

**Hiểu gì.** JS thường "dễ tính": gõ sai gì cũng chạy rồi lỗi lúc dùng. TS thêm **kiểu dữ liệu** — lời hứa về hình dạng dữ liệu:

```ts
export type Waste = {
  id: string
  name: string
  group: "Nhựa" | "Giấy" | "Kim loại" | "Thủy tinh" | "Điện tử" | "Hữu cơ"
  price: number
  recyclable: boolean
  rule: string
  prep: string
}
```

Đọc là: "một loại rác GỒM những dòng này; `group` CHỈ được là một trong 6 chữ kia". Dấu `|` đọc là "hoặc". Gõ `"Kim loai"` (thiếu dấu) là áo giáp báo đỏ ngay lúc gõ — chưa cần mở app.

**Nhìn vào đâu.** `src/data/waste.ts` — khối `type Waste` ở đầu file; và bất kỳ dòng lỗi đỏ nào khi bạn làm sai ở tài liệu 13 §4.

**Bài tập 5 phút.** Cố tình sửa `group: "Giấy"` của Bìa carton thành `group: "Giay"` → xem lỗi đỏ ở Terminal/VS Code → sửa lại đúng → lỗi biến mất. Cảm nhận "phanh an toàn" hoạt động.

**Tự kiểm.** Vì sao lỗi kiểu dữ liệu lại là *điều tốt*? *(Bị máy bắt lúc viết dễ hơn nhiều so với để người dùng gặp lỗi — người mới nên thấy lỗi đỏ là mừng.)*

---

## Buổi 8 — React (1): màn hình là Lego

**Hiểu gì.** Một màn hình không viết liền một cục, mà lắp từ các **component** — mỗi cái là một hàm trả về "bộ xương HTML". Component cha truyền **props** (nguyên liệu) cho con:

```tsx
<PageHead
  eyebrow="HƯỚNG DẪN"                        ← nguyên liệu 1
  title="Phân loại rác đúng cách"             ← nguyên liệu 2
  body="Chọn nhóm vật liệu để xem luật…"      ← nguyên liệu 3
/>
```

Danh sách component dùng chung nằm ở `src/components/` (Layout, Navbar, Portal, AuthForm…) và `src/components/admin/` (Shell, Assistant…).

**Nhìn vào đâu.** `src/components/Portal.tsx` — nơi định nghĩa `PageHead` và `Field`: xem phần khai báo "component này nhận những nguyên liệu gì" (gọi là **props**), và phần thân dùng chúng để dựng tiêu đề.

**Bài tập 5 phút.** Mở 3 trang bất kỳ trong `src/pages/`, tìm dòng `<PageHead` của mỗi trang, chép 3 tiêu đề ra giấy. Sau đó đổi thử `title` của một trang, Ctrl+S, xem đúng chữ đó đổi trên đầu trang.

**Tự kiểm.** Component giống và khác hàm bình thường ở đâu? *(Cũng là hàm; khác ở chỗ trả về "giao diện" và tên phải ViếtHoa để React phân biệt với thẻ HTML thường.)*

---

## Buổi 9 — React (2): state — trí nhớ ngắn hạn của màn hình

**Hiểu gì.** State là ô nhớ *chỉ sống trong lúc màn hình đang mở*:

```tsx
const [group, setGroup] = useState("Tất cả nhóm")
//     ↓          ↓
//  giá trị    cái nút để ĐỔI giá trị
```

Quy tắc vàng của React: **muốn màn hình đổi → phải đổi state**. Gõ chữ vào ô tìm kiếm không tự làm gì cả; chính dòng `onChange={...}` mới đưa chữ vào state, và state đổi thì React vẽ lại. Khác biệt với dữ liệu trong `src/data/`: state là "đồ dùng tạm", **F5 là quên** — đây là lý do gốc của cả "Mức 0" ở tài liệu 13.

**Nhìn vào đâu.** `src/pages/Guidance.tsx`: `useState` cho nhóm đang chọn; nút bấm có `onClick={() => setGroup(g)}`. Và `src/pages/Waste.tsx` nếu bạn muốn xem biến thể ô tìm kiếm.

**Bài tập 5 phút.** Mở `/guidance`, bấm nhóm "Nhựa", rồi bấm F5 — thấy nó về "Tất cả nhóm". Giải thích bằng 2 câu: state đổi ai vẽ lại, và vì sao F5 lại quên.

**Tự kiểm.** Nút "chết" ở tài liệu 13 §6 thiếu chính thứ gì? *(`onClick` — dòng dạy React "bấm thì chạy việc này".)*

---

## Buổi 10 — Danh sách trong React: `.map` và "chứng minh thư" key

**Hiểu gì.**

```tsx
{list.map((w, i) => (
  <li key={w.id}>          ← key = "chứng minh thư" để React phân biệt các mục
    ...
  </li>
))}
```

`key` phải **duy nhất** giữa các mục cùng danh sách. Vì sao? Khi danh sách đổi, React so sánh key cũ/mới để biết mục nào giữ nguyên, mục nào mới — thiếu key hoặc key trùng thì React "nhầm hồ sơ". Đây cũng là một câu phỏng vấn kinh điển.

**Nhìn vào đâu.** Cách dự án chọn key: dùng `w.id` (ổn định) — đúng chuẩn. Cách **sai** phát hiện được trong dự án: hai trang tự sinh mã mới bằng "số mục + 1" (tài liệu 13 §6, nhóm phụ) — đúng ví dụ thực tế cho câu "vì sao không được sinh mã từ độ dài danh sách".

**Bài tập 5 phút.** Trong `src/pages/`, tìm 3 chỗ có `key=` và ghi lại chúng dùng gì làm key (`id`? `i`? chữ?). Chỉ ra chỗ nào dùng số thứ tự `i` — và tự hỏi khi nào cách đó gây hại *(khi danh sách bị lọc/sắp xếp lại).*

**Tự kiểm.** Điểm `Guidance` vẽ số thứ tự cho từng mục — số đó là key hay chỉ là nội dung hiển thị? *(Là nội dung — `{i + 1}` nằm trong ruột thẻ; key nằm ở thuộc tính `key` của thẻ.)*

---

## Buổi 11 — Điều hướng: bảng địa chỉ và những cánh cửa

**Hiểu gì.** Toàn bộ "bản đồ địa chỉ" của app nằm ở `src/App.tsx`:

```tsx
<Route path="waste" element={<Waste />} />        // mở /waste → hiện trang Waste
```

Manh mối chia khối: có khối 3 trang "không khung" (đăng nhập…), khối công khai trong `<Route element={<Layout />}>`, các khối sau đăng nhập được "đóng cửa" bằng `<RequireRole roles={["user"]}>` (chỉ vai user vào được). Trong trang, điều hướng bằng "cửa" `<Link to="/waste">` — bấm vào là đổi địa chỉ *không tải lại trang* (khác thẻ `<a href>` thường ở chỗ đó).

**Nhìn vào đâu.** `src/App.tsx` (toàn bộ), rồi mở `/login` bấm Đăng nhập để xem `RequireRole` đưa bạn về đúng "nhà" theo vai.

**Bài tập 5 phút.** Lấy 3 mục menu ở `/`, tra từng mục vào `App.tsx`, điền bảng: tên menu → địa chỉ → file trang. (Menu ở `src/data/nav.ts`, địa chỉ ở `src/App.tsx` — hai file phải khớp; tài liệu 13 §5 gọi là "Bước 2 + Bước 3".)

**Tự kiểm.** Vì sao app cần hai chỗ khai báo (menu và bảng địa chỉ) thay vì một? *(Menu là "đường đi cho người", bảng địa chỉ là "đường đi cho máy" — có thể có địa chỉ không nằm trên menu, ví dụ trang con `/account/password`; muốn thêm đường vào thì phải thêm ở nơi con người nhìn thấy.)*

---

## Buổi 12 — `useEffect`: những việc cần "đợi" hoặc "theo dõi"

**Hiểu gì.** Bình thường React chạy code ngay khi vẽ. Một số việc phải chạy *sau khi vẽ xong* hoặc *khi có gì đó đổi*: hẹn giờ, theo dõi phím, dọn dẹp khi rời trang. Đó là `useEffect` — "sau khi màn hình vẽ xong thì làm việc này".

```
Gõ vào ô chat  ──→  state đổi  ──→  màn hình vẽ lại
                                        │
                              useEffect lắng nghe ──→ cuộn xuống tin mới nhất
```

**Nhìn vào đâu.** Dự án **cố tình rất ít dùng** `useEffect` — vì dữ liệu là tĩnh, không cần "hỏi máy chủ". Chỗ dùng thật: `src/pages/Scanner.tsx` (khi bạn bấm quét, nó `setTimeout` mô phỏng AI "suy nghĩ" vài giây rồi trả kết quả), `src/components/Layout.tsx` và `Navbar.tsx` (dõi đường dẫn để đóng menu khi đổi trang).

**Bài tập 5 phút.** Mở `/scanner`, bấm chạy nhận diện. Trong lúc chờ, mở `src/pages/Scanner.tsx` và tìm 2 chỗ có `useEffect` — đoán cái nào làm việc "đợi vài giây".

**Tự kiểm.** Vì sao một app "hỏi đáp với máy chủ" (có backend) sẽ dùng `useEffect` nhiều hơn hẳn app tĩnh này? *(Mỗi lần mở trang phải chạy ra ngoài Internet lấy dữ liệu — việc đó phải xảy ra "sau khi vẽ", không thể có sẵn trong file.)*

---

## Buổi 13 — Accessibility: làm app dùng được cho MỌI người

**Hiểu gì.** Accessibility (viết tắt a11y) là làm sao để người dùng bàn phím, người đọc màn hình (screen reader), người mắt kém… vẫn dùng được. Ba dấu hiệu trong dự án này:

1. **`alt`** — mô tả ảnh bằng chữ cho người không nhìn thấy ảnh.
2. **`aria-label` / `aria-pressed`** — nhãn phụ cho máy đọc màn hình: nút này là gì, đang được chọn chưa.
3. **Bàn phím đi được toàn bộ app**: phím Tab nhảy qua từng nút, Enter để bấm.

Dự án còn có "chế độ giảm chuyển động" (`prefers-reduced-motion` trong `src/index.css`): ai bật tuỳ chọn "giảm hiệu ứng" ở hệ điều hành thì app tự tắt animation.

**Nhìn vào đâu.** `src/pages/Guidance.tsx` dòng có `aria-pressed={group === g}`; bất kỳ `<img>` nào có `alt="..."`.

**Bài tập 5 phút.** Ấn phím Tab liên tục quanh trang chủ và trang `/waste` — thấy "ô sáng" nhảy qua từng nút/ô nhập. Sau đó tìm trong code 3 chỗ có `alt=` hoặc `aria-`.

**Tự kiểm.** Vì sao nhà tuyển dụng để ý a11y? *(Thể hiện bạn viết code cho người dùng thật, biết chuẩn nghề và biết kiểm tra bằng bàn phím — những thứ tự học rất khó, còn trong dự án này có sẵn để học.)*

---

## Buổi 14 — Kiểm thử: lưới an toàn của người viết code

**Hiểu gì.** "Test" là code viết ra để *tự kiểm tra code khác*: máy dựng thử từng màn hình, nếu có gì đó văng lỗi thì báo đỏ. Dự án có 2 bài kiểm:

| Lệnh | Làm gì | Số phép thử |
|---|---|---|
| `npm run check` | Dựng thử **mọi màn hình** (56 màn hình/tình huống) | 56 |
| `npm run check:routes` | Kiểm **bảng địa chỉ**: mỗi địa chỉ mở đúng trang, đúng người được vào | 38 |

Toàn bộ nằm trong 2 file: `src/check.tsx` và `src/check-routes.tsx` — đọc được như tiếng Việt.

**Nhìn vào đâu.** `src/check.tsx` — mở tìm chữ `Guidance` hoặc `Waste`, xem một phép thử viết thế nào: nó dựng trang ra "chưa có dữ liệu/đủ dữ liệu" và đòi trang không được văng lỗi.

**Bài tập 5 phút.** Chạy `npm run check`, đếm đủ 56 dòng OK. Sau đó đổi thử một chữ trong một trang (ví dụ xoá dấu `}` của `Guidance.tsx`) → chạy lại check → xem nó báo đỏ và chỉ đúng file → hoàn tác.

**Tự kiểm.** Khi bạn sửa file dữ liệu sai (như buổi 7), ai "cứu" bạn trước khi gửi app cho người khác? *(Áo giáp TypeScript bắt lỗi kiểu; `npm run check` bắt lỗi màn hình vỡ; git để hoàn tác — ba lớp lưới an toàn.)*

---

## Buổi 15 — Git: làm việc như một lập trình viên thật

**Hiểu gì.** Git ghi lại *từng điểm lưu* (commit) của dự án, kèm ghi chú. Ba thao tác đủ dùng hằng ngày: **xem mình sửa gì** → **tạo điểm lưu** → **hoàn tác khi cần**.

Trong VS Code (khu Source Control, biểu tượng rẽ nhánh cột trái): danh sách file đổi → hộp gõ ghi chú → nút **Commit** (điểm lưu) → nút ↩ để Discard (hoàn tác file).

Qua lệnh trong Terminal (tùy chọn, gõ khi đã quen):

```
git status                     # xem đang có gì thay đổi
git add src/data/waste.ts      # chọn file để đưa vào điểm lưu
git commit -m "doi gia bia carton"   # tạo điểm lưu kèm ghi chú
git log --oneline              # xem lịch sử các điểm lưu
```

Ghi chú commit nên ngắn, nói **việc đã làm** ("sửa lỗi giá carton"), không viết chung chung ("update"). Nhóm làm việc thật còn dùng nhánh (branch) + pull request — bạn sẽ gặp khi đi làm; hiện tại chỉ cần thuộc 4 lệnh trên.

**Bài tập 5 phút.** Tạo một điểm lưu trước khi nghịch: sửa thử tên một mục menu, Commit (`thu doi menu`), rồi Discard để xem nó về cũ, rồi sửa lại và Commit lại.

**Tự kiểm.** Vì sao lập trình viên được dạy "commit nhỏ, thường xuyên"? *(Mỗi commit là một điểm hoàn tác; điểm càng nhỏ càng dễ tìm thủ phạm và quay lui — liên hệ bài "nút chết" và "mã tự sinh" ở tài liệu 13 §6.)*

---

## Buổi 16 — Đồ nghề: npm, Vite, đóng gói

**Hiểu gì.** File `package.json` ở gốc dự án là "bảng đồ nghề":

```json
"scripts": {
  "dev": "vite",                       → npm run dev      (mở máy chạy thử)
  "build": "tsc --noEmit && vite build" → npm run build   (đóng gói bản thật)
  "check": "...", "check:routes": "...", "typecheck": "tsc --noEmit"
}
```

Bạn chỉ cần nhớ 4 lệnh: `dev` (xem), `check` (kiểm tra), `build` (đóng gói), `typecheck` (chỉ soi lỗi kiểu dữ liệu). Phần còn lại của file là danh sách thư viện app dùng (React, react-router-dom, vite…) — không cần sửa.

**Nhìn vào đâu.** `package.json` (phần scripts + dependencies, đọc mục ngoài cùng), và thư mục `public/` (ảnh, favicon — thứ được chép nguyên vào bản đóng gói).

**Bài tập 5 phút.** Chạy `npm run typecheck` khi mọi thứ đang sạch — xem nó "im lặng không lỗi". Rồi chạy `npm run build` một lần cho biết (kết quả nằm ở thư mục `dist/` — *không* sửa gì trong đó, đó là "hộp đã đóng gói").

**Tự kiểm.** Bản `dev` và bản `build` khác nhau thế nào? *(dev: chạy nhanh để xem, có tự cập nhật, nặng; build: đóng gói nén kỹ để đem đi triển khai — không sửa trực tiếp.)*

---

## Sân chơi tốt nghiệp: tự tay làm một trang nhỏ

Đủ lý thuyết rồi. Đây là bài tổng hợp — ghép **mọi buổi**: tạo trang `/playground` có **bộ đếm** (nút bấm, buổi 9) và **ô nhập tên** (buổi 8+9), rồi tự đưa đường vào menu (tài liệu 13 §5).

**Bước 1.** Tạo file `src/pages/Playground.tsx` với đúng nội dung này (đã kiểm tra lắp khớp với các "class" có sẵn của dự án):

```tsx
import { useState } from "react"

export default function Playground() {
  const [count, setCount] = useState(0)
  const [name, setName] = useState("")

  return (
    <div className="page flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Sân chơi của {name || "bạn"}</h1>

      <div className="card p-6">
        <p className="text-body">Bạn đã bấm nút {count} lần.</p>
        <button className="btn btn-primary mt-4" onClick={() => setCount(count + 1)}>
          Bấm tôi
        </button>
      </div>

      <div className="card p-6">
        <label className="text-body" htmlFor="ten">Tên bạn</label>
        <input
          id="ten"
          className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink"
          placeholder="Gõ tên vào đây"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
    </div>
  )
}
```

**Bước 2.** Mở `src/App.tsx`, thêm dòng `import Playground from "@/pages/Playground"` cạnh các dòng import khác, rồi thêm một dòng route trong khối `Layout`:

```tsx
          <Route path="playground" element={<Playground />} />
```

**Bước 3.** Mở `src/data/portal.ts`, thêm `{ to: "/playground", label: "Sân chơi" },` vào một mục `user` bất kỳ.

Ctrl+S → đăng nhập vai người dùng → mở `/playground`. Bấm nút, gõ tên. **Bạn vừa tự viết tính năng tương tác đầu tiên — chúc mừng.**

Bài tập cộng điểm (làm được thì bạn đã qua mức người mới):
1. Thêm nút `Đặt lại` để `setCount(0)`.
2. Đổi câu chào thành: nếu chưa gõ tên thì hiện "Người bí ẩn" (gợi ý: `name || "bạn"` chính là mẫu — đoán xem `||` nghĩa là gì).
3. Đổi màu chữ tiêu đề bằng cách thêm class `text-brand` cạnh `text-ink` rồi bỏ `text-ink` — xem màu thương hiệu xuất hiện.
4. Sửa `useState(0)` thành `useState(10)` — đoán trước điều gì xảy ra rồi mới Ctrl+S.

---

## Lộ trình 8 tuần (mỗi tuần 3 buổi, có ngày nghỉ)

| Tuần | Buổi | Việc lớn trong tuần |
|---|---|---|
| 1 | 0, 1, 2 | Chạy được app, hiểu màn hình "sinh ra" từ file nào; đổi được tên tab, đọc được bộ xương HTML |
| 2 | 3, 4 | Đổi màu cả app; đọc hiểu kho dữ liệu `src/data/` |
| 3 | 5, 6 | Kể được "hàm là cái máy"; dùng được `.filter`, `.map` bằng lời |
| 4 | 7, 8 | Thấy lỗi đỏ là mừng; lắp được 2 component với props |
| 5 | 9, 10 | Giải thích được vòng: gõ chữ → state đổi → vẽ lại; key là gì |
| 6 | 11, 12 | Đọc trọn `App.tsx`; hiểu vì sao dự án ít `useEffect` |
| 7 | 13, 14 | Kiểm tra a11y bằng phím Tab; chạy được cả 94 phép kiểm |
| 8 | 15, 16 | Commit gọn gàng; chạy `build` thành công; **làm sân chơi tốt nghiệp** |

**Cách tự chấm "đã hiểu":** đóng tài liệu → mở app → chỉ vào bất kỳ chỗ nào trên màn hình và trả lời được **2 câu**: "chữ/số này đến từ file nào?" và "muốn đổi nó thì sửa gì?". Buổi nào chưa trả lời trôi chảy → đọc lại buổi đó, đừng đi tiếp.

---

*Liên quan: **13** (tùy biến thực hành — bài tập ở đó là "áp dụng" của các buổi này) · **15** (phỏng vấn: biến kiến thức này thành câu trả lời và CV).*
