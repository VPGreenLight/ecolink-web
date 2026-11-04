# 12 · Kiểm thử bằng render, và `index.css`

Tài liệu này nói về hai thứ **không phải màn hình** nhưng quyết định chất lượng cả
app:

1. Hai script tự kiểm (`src/check.tsx`, `src/check-routes.tsx`) — chạy bằng
   `npm run check` / `npm run check:routes`, không cần mở trình duyệt.
2. `src/index.css` (366 dòng) — **toàn bộ hệ màu, nút, khung, và chuyển động** của
   app. Mọi class như `text-ink`, `bg-brand`, `btn-primary` đều sinh ra từ file này.

---

# 1. Vì sao cần tự kiểm, khi app chưa có backend

Dự án **không** dùng Vitest/Jest/Playwright. Thay vào đó có hai script trong
`package.json`:

```jsonc
"dev":           "vite",
"build":         "tsc --noEmit && vite build",
"preview":       "vite preview",
"typecheck":     "tsc --noEmit",
"check":         "vite build --ssr src/check.tsx --outDir .check --logLevel error && node .check/check.js",
"check:routes":  "vite build --ssr src/check-routes.tsx --outDir .check-routes --logLevel error && node .check-routes/check-routes.js"
```

Hai dòng cần hiểu:

- **`tsc --noEmit`** trong `build`: trình biên dịch TypeScript là **cổng chặn đầu
  tiên** — sai kiểu thì `vite build` không bao giờ chạy. `--noEmit` nghĩa là "chỉ
  kiểm, không ghi file `.js`".
- **`vite build --ssr src/check.tsx`**: Vite có thể đóng gói **bất kỳ file nào**
  thành một chương trình chạy trên Node, không chỉ app web. `--ssr` bảo Vite đừng
  giả định môi trường trình duyệt. `--outDir .check` là thư mục nháp (bắt đầu bằng
  dấu chấm nên không lẫn với `dist`). Rồi `&& node .check/check.js` — `&&` nghĩa là
  bước trước **phải thành công** mới chạy bước sau.

```
   src/check.tsx ──vite build --ssr──▶ .check/check.js ──node──▶ in ra OK/FAIL
        (JSX, import @/)                 (JS thường)              mã thoát 0/1
```

Nhờ vậy bài kiểm dùng được **đúng** cú pháp của app (JSX, alias `@/`, import CSS
nếu cần) mà không cần một test runner nào. `react-dom/server` đã nằm sẵn trong gói
`react-dom`, nên **không thêm dependency nào**.

## 1.1 `check.tsx` — render từng trang

Cấu trúc: import toàn bộ page, một bảng `CASES`, một vòng lặp.

```tsx
/** name, component, substring that must survive tag-stripping */
const CASES = [
  ["Navbar", Navbar, "Điểm thu gom"],
  ["MobileNav", MobileNav, "Đổi thưởng"],
  ...
  ["admin/Reconciliation", Reconciliation, "Đối soát và dòng tiền"],
] as const
```

Định dạng **ba cột**: tên (để đọc log), component (để render), chuỗi phải xuất hiện
(để chứng minh trang render ra nội dung thật, không phải khung rỗng). 56 dòng —
đúng một dòng cho mỗi màn hình của app, và các nhóm được ngăn bằng comment theo mã
UC (`// ---- phân hệ STAFF ----`).

```tsx
let failed = 0
for (const [name, Page, mustInclude] of CASES) {
  try {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    )
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()

    if (text.length < 20) throw new Error("rendered almost nothing")
    if (!text.includes(mustInclude)) throw new Error(`missing copy: "${mustInclude}"`)

    console.log(`OK   ${name.padEnd(24)} ${html.length} bytes html`)
  } catch (err) {
    failed++
    console.error(`FAIL ${name}: ${(err as Error).message}`)
  }
}

console.log(failed === 0 ? "\nall pages render" : `\n${failed} of ${CASES.length} failed`)
process.exit(failed === 0 ? 0 : 1)
```

Từng chi tiết, và lý do:

| Dòng | Việc | Vì sao viết như vậy |
| --- | --- | --- |
| `renderToStaticMarkup` | React render ra **chuỗi HTML** trên Node | không cần trình duyệt; đây là hàm của `react-dom/server` |
| `<MemoryRouter>` | router giả, đường dẫn giữ **trong RAM** | `BrowserRouter` cần `window.history` — Node không có |
| `.replace(/<[^>]+>/g, " ")` | bỏ mọi thẻ HTML | đổi thẻ thành **khoảng trắng**, không phải chuỗi rỗng: `</h1><p>` nếu bỏ sạch sẽ dính hai chữ vào nhau |
| `.replace(/\s+/g, " ").trim()` | gộp khoảng trắng | so chuỗi ổn định dù JSX xuống dòng ở đâu |
| `text.length < 20` | trang rỗng/chỉ khung | bắt lỗi "render mà không có gì" — nếu chỉ kiểm `mustInclude` thì thông báo lỗi khó hiểu |
| `throw` trong `try` | lỗi của **một trang** không dừng cả bài kiểm | các trang còn lại vẫn được đếm |
| `failed++` rồi `process.exit(1)` | **mã thoát** khác 0 khi có lỗi | đây là thứ máy đọc: `npm run check && ...` hay CI sẽ dừng đúng lúc |

🔍 **Chuỗi `mustInclude` được chọn là câu chữ ổn định** — tiêu đề `PageHead`, nhãn
khu vực — không phải dữ liệu động (tên người, số tiền). Nếu chọn số tiền thì mỗi lần
sửa `data/` là bài kiểm đỏ dù app không hỏng. Đây là bài học chung của mọi bài kiểm:
**kiểm thứ ít thay đổi, đủ đặc trưng.**

Hai chi tiết đáng chú ý trong bảng:

```tsx
// assert the idle state: result copy is only rendered after a scan
["Scanner", Scanner, "Dùng trang này thế nào"],
```

Trang `/scanner` có 3 trạng thái (chưa quét / đang quét / có kết quả). Bài kiểm chỉ
render được trạng thái đầu — nó kiểm **trạng thái nghỉ**, và comment nói rõ điều đó.
Đây là giới hạn thật của kiểm thử render, xem §1.2.

```tsx
/** Trang sau đăng nhập được render trực tiếp (không qua RequireRole) vì trên
 *  server không có localStorage nên không có phiên — đi qua RequireRole sẽ bị
 *  đá về /login và in ra trang rỗng, test thành vô nghĩa. */
```

Vì sao `check.tsx` render **từng page trực tiếp** chứ không render cây route: trên
Node không có `localStorage` → `RequireRole` thấy "chưa đăng nhập" → đá về `/login`
→ mọi bài kiểm đều đọc chữ của trang đăng nhập và **đều xanh dù app hỏng**. Đây là
lý do tồn tại của file thứ hai.

## 1.2 Giới hạn phải biết: SSR không chạy `useEffect`

`renderToStaticMarkup` render **một lần**, đúng như chữ "static" trong tên. Nghĩa là:

```
   ✅ có bắt: lỗi biên dịch, import sai, thiếu chữ, component ném lỗi khi render
   ❌ không bắt: mọi thứ chỉ xảy ra SAU lần render đầu
                — bấm nút, gõ ô nhập, useEffect, vòng lặp render
```

Hệ quả cụ thể đã từng xảy ra trong dự án này: sau khi đổi phiên đăng nhập từ chuỗi
sang object, app **trắng mọi trang khi đã đăng nhập** — mà `check.tsx` vẫn xanh. Lý
do: lỗi nằm trong `useSyncExternalStore` lặp vô hạn, chỉ xảy ra khi component **đọc
lại** store sau khi mount; SSR chỉ render một lần nên không có vòng lặp nào để bắt.
Đó chính là lý do `check-routes.tsx` có phần `checkStableSnapshot()` (§2.3).

## 1.3 Cách đọc kết quả

```
$ npm run check

OK   Navbar                   1234 bytes html
OK   MobileNav                2345 bytes html
...
OK   admin/account/password   4567 bytes html

all pages render
```

56 dòng `OK` = 56 màn hình render được. Khi có lỗi:

```
FAIL user/Payout: missing copy: "Tài khoản nhận tiền"
```

Nghĩa là: render được, nhưng chữ đó **không còn** trong HTML. Ba nguyên nhân có thể:
đổi tiêu đề (bài kiểm cần cập nhật theo), component render nhánh rỗng, hoặc trang
bị lỗi và render ra thứ khác. Cả ba đều đáng mở xem — đây là điều tốt của một bài
kiểm rẻ.

⚠️ Đánh đổi cần biết: đổi một tiêu đề trong `PageHead` **sẽ** làm bài kiểm đỏ dù app
vẫn đúng. Đây là bản chất "kiểm theo ảnh chụp chuỗi" — nó vừa bắt lỗi thật, vừa là
cái loa nhắc bạn cập nhật. Với 56 trang, chi phí đó rẻ hơn nhiều so với việc tự mở
56 trang bằng tay mỗi lần sửa `src/data/`.

---

# 2. `check-routes.tsx` — render cây route thật, có phiên đăng nhập

```tsx
/** Render CÂY ROUTE THẬT, không render lẻ từng component.
 *
 *  `check.tsx` render từng page một — nó không bắt được lỗi ở phần ghép route:
 *  RequireRole, Portal, Layout, Outlet. Đây là chỗ mấy trang sau đăng nhập
 *  chết trắng mà `check.tsx` vẫn xanh.
 *
 *  localStorage được giả lập để có phiên đăng nhập: server-side không có
 *  localStorage nên nếu không giả thì RequireRole đá hết về /login và test
 *  thành vô nghĩa. */
```

Hai file kiểm **hai tầng khác nhau** của cùng một app — đây là cấu trúc đáng học:

```
   check.tsx         "từng viên gạch có lành không?"     56 viên
                     render lẻ từng page, không qua router/layout

   check-routes.tsx  "bức tường ghép có đúng không?"    36 đường dẫn
                     render cả <AppRoutes/>, qua RequireRole + Portal + Outlet
                     + kiểm luôn tầng quyền: URL nào vào vai trò nào
```

## 2.1 Stub `localStorage` — 6 hàm, không kéo jsdom

```tsx
// ponytail: localStorage chỉ cần 3 hàm. Stub tối thiểu thay vì kéo thêm
// jsdom vào devDependency cho một script kiểm.
const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage
```

- `Map` là "tủ khoá–giá trị" có sẵn trong JS — đúng thứ `localStorage` mô phỏng. Ba
  hàm chính (`getItem/setItem/removeItem`) đủ cho `lib/session.ts`.
- `?? null` — `Map.get` trả `undefined` khi thiếu khoá, còn `localStorage.getItem`
  trả `null`. Phải quy đổi, nếu không `session.ts` kiểm `if (raw === null)` sẽ trượt.
- `void store.set(...)` — `set` trả về `this`, `void` nói "không dùng giá trị trả
  về", giữ đúng chữ ký `void`. Ba hàm phụ (`clear/key/length`) là để thoả kiểu
  `Storage` — không phải để đúng nhu cầu, mà để **trình biên dịch hài lòng**.
- 🔍 So sánh: `jsdom` (thư viện giả cả trình duyệt) nặng vài chục MB và chậm hàng
  giây mỗi lần chạy. Stub 8 dòng ở đây làm đúng việc. **Chỉ dựng công cụ to khi cái
  nhỏ không đủ** — nguyên tắc `ponytail` của cả dự án.

## 2.2 Bảng `BY_ROLE` — mỗi vai trò một danh sách URL

```tsx
/** URL nào kiểm bằng vai trò nào — ở đây chỉ vào các route có RequireRole. */
const BY_ROLE: Record<Role, [string, string][]> = {
  user: [
    ["/user", "Xin chào"],
    ["/user/handover", "Yêu cầu thu gom rác"],
    ...
    ["/chat", "Tạo yêu cầu bàn giao"],
  ],
  recycler: [...], staff: [...], admin: [...],
}
```

```tsx
for (const [role, cases] of Object.entries(BY_ROLE) as [Role, [string, string][]][]) {
  // signIn chứ không setItem trực tiếp: nó bỏ đệm của getSnapshot, đúng như
  // lúc chạy thật.
  signIn("Tài khoản thử", role)

  for (const [path, mustInclude] of cases) {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>,
    )
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()

    // trang bị chặn sai vai trò thì ra trang 404, vẫn có chữ — nên kiểm tra
    // thêm dấu hiệu của trang 404
    if (text.includes("LỖI 404")) throw new Error("bị chặn sai vai trò")
    if (text.length < 200) throw new Error(`rendered gần như rỗng (${text.length} ký tự)`)
    if (!text.includes(mustInclude)) throw new Error(`thiếu chữ: "${mustInclude}"`)
```

Ba kỹ thuật đáng học:

1. **`signIn(...)` thay vì `localStorage.setItem(...)`** — comment nói rõ lý do:
   `signIn` xoá bộ đệm của `getSnapshot` giống lúc chạy thật. Nếu tự ghi thẳng vào
   storage, bài kiểm đang kiểm một tình huống **không bao giờ xảy ra trong app**.
   *Dùng đúng API nghiệp vụ để dựng tình huống — hơn là dựng tình huống bằng tay.*
2. **Kiểm "không có chữ X"** — `if (text.includes("LỖI 404"))`. Đây là chi tiết
   thông minh nhất của file và có comment giải thích: khi `RequireRole` chặn sai,
   trang **vẫn có chữ** (trang 404), nên bài kiểm "có chữ mong đợi" và "đủ dài" đều
   vượt qua. Muốn bắt, phải kiểm **sự vắng mặt** của dấu hiệu sai. Quy tắc: *bài
   kiểm chỉ mạnh bằng thứ nó phủ định được.*
3. **Ngưỡng khác `check.tsx`** — ở đây `text.length < 200` (không phải 20) vì trang
   đã qua `Portal`/`AdminShell` nên luôn có navbar/menu/sidebar; 200 ký tự mới là
   "khung trang đã render nhưng nội dung trống".

`MemoryRouter initialEntries={[path]}` — cách duy nhất để "mở" một URL ở Node: nói
trước router đang ở đâu. Mỗi vòng lặp render lại từ đầu, không cần điều hướng.

## 2.3 `checkStableSnapshot()` — bài kiểm đắt giá nhất của repo

```tsx
/** Chốt chặn lỗi "Maximum update depth exceeded" — lỗi đã làm TRẮNG MỌI trang
 *  khi đã đăng nhập, mà cả `check.tsx` lẫn phần render ở trên đều lọt: SSR chỉ
 *  render một lần nên vòng lặp của `useSyncExternalStore` không xảy ra. Chỉ khi
 *  đo được danh tính tham chiếu mới bắt được.
 *
 *  `useSyncExternalStore` so `getSnapshot()` bằng `Object.is`. Trả object mới
 *  mỗi lần gọi là vô hạn vòng render. Đây là bài học rút từ lần này: đổi
 *  session từ chuỗi sang object mà không nhớ nguyên tắc này là trắng màn hình. */
function checkStableSnapshot() {
  const cases: [string, () => void][] = [
    ["đã đăng nhập", () => signIn("Nguyễn Đức", "user")],
    ["chưa đăng nhập", () => signOut()],
  ]

  for (const [label, setup] of cases) {
    setup()
    const a = getSession()
    const b = getSession()
    if (a !== b) {
      failed++
      console.error(`FAIL session ... getSnapshot() trả object mới mỗi lần gọi`)
      return
    }
    console.log(`OK   session     ${label.padEnd(24)} tham chiếu ổn định`)
  }
}
```

Đây là **bài kiểm hồi quy cho một lỗi đã từng xảy ra thật** — loại bài kiểm giá trị
nhất, vì nó không kiểm một tính năng mà kiểm **một cái bẫy cụ thể**:

```
   useSyncExternalStore hoạt động thế nào:

   React cloud (store)  ──getSnapshot()──▶  trả về gì đó
        │                                        │
        │ nếu trả OBJECT MỚI mỗi lần gọi          │ React so bằng Object.is
        │ → React tưởng store vừa đổi  ───────────┘
        ▼
   render lại → lại thấy "khác" → render lại → ...
   "Maximum update depth exceeded" → trắng màn hình
```

Cách `lib/session.ts` chống: giữ **một** object phiên trong biến đệm, chỉ tạo object
mới khi `signIn`/`signOut` thật sự được gọi (tài liệu 03). Bài kiểm ở đây đo đúng
tính chất đó:

```tsx
const a = getSession()   // đọc lần 1
const b = getSession()   // đọc lần 2, giữa hai lần KHÔNG ghi gì
if (a !== b) ...         // phải là CÙNG một tham chiếu
```

Comment còn giải thích cả một bẫy *của chính bài kiểm*:

> So HAI lần gọi liên tiếp, không ghi gì ở giữa. Nếu có ghi thì đệm bị bỏ và so được
> là sai ý — chỗ cần kiểm là "đọc lại mà không có thay đổi thì phải ra CÙNG một tham
> chiếu".

Và nó chạy cho **cả hai** trạng thái (`đã đăng nhập` / `chưa đăng nhập`) — vì hàm
`getSession()` có thể trả `null` (một giá trị nguyên thuỷ luôn ổn) mà vẫn sai ở
nhánh có dữ liệu. Kiểm đủ hai nhánh là thói quen tốt: lỗi thường nằm ở nhánh "có dữ
liệu", còn nhánh rỗng thì luôn xanh.

Kết quả chạy:

```
$ npm run check:routes

OK   user      /user                    ...bytes
OK   user      /user/handover           ...
...
OK   admin     /admin/account/password  ...
OK   session     đã đăng nhập            tham chiếu ổn định
OK   session     chưa đăng nhập          tham chiếu ổn định

all routes render
```

36 đường dẫn + 2 bài kiểm session. Đây là bộ "kiểm thử" của cả dự án: 94 phép kiểm
(56 + 38) chạy trong vài giây, không cần cài gì thêm.

⚠️ Điều **không** có: một bài kiểm bấm thử nút. Nút "Lưu" ở 30 trang đều chưa từng
được bài kiểm nào bấm. Với app demo thì chấp nhận được (toàn bộ nút chỉ đổi state cục
bộ, và các lỗi `onClick` thiếu đã ghi trong tài liệu 06–11 đều do **mắt người** tìm
ra). Khi có backend, đây là việc đầu tiên cần thêm — Playwright hoặc test bằng
`react-dom/client` + `act()`.

---

# 3. `index.css` — Tailwind v4, và cả hệ màu trong một khối

## 3.1 `@theme` — nơi khai báo "chất liệu" của app

```css
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap");
@import "tailwindcss";

@theme {
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;

  --color-ink: #0f1f15;   /*    L22  C.029 */
  --color-body: #404b44;  /*   L40  C.018 */
  --color-muted: #606d64; /*  L52  C.021  5.4:1 on surface */
  ...
}
```

- **Tailwind v4 đọc cấu hình bằng CSS, không bằng `tailwind.config.js`.** Mọi biến
  `--color-x` trong `@theme` **tự động sinh ra class**: `--color-brand` → `text-brand`,
  `bg-brand`, `border-brand`, `bg-brand/10`… Đây là lý do trong JSX không có một
  mã màu nào — chỉ có `text-ink`, `bg-surface-2`. Muốn đổi cả app sang sắc xanh
  khác: sửa **một dòng** ở đây.
- `L` và `C` trong comment là **Lightness / Chroma đo trong không gian màu OKLCH** —
  cách đo màu theo cảm nhận mắt người, chính xác hơn mã hex khi so hai màu khác
  hue. Các con số `4.57:1`, `5.4:1` là **tỉ lệ tương phản WCAG** — chuẩn bắt buộc
  để chữ đọc được (chữ thường cần ≥ 4.5:1).
- 🔍 Quyết định quan trọng nhất của cả khối, ghi trong comment:

  > MỘT sắc xanh duy nhất cho cả tiêu đề lẫn nền tô đậm. … Tối hơn #299236 đúng 3
  > điểm sáng: #299236 để chữ trắng lên trên chỉ 3.99:1, dưới ngưỡng 4.5 của WCAG
  > cho chữ 14px trong nút. Ở đây là 4.57:1 mà nhìn gần như không khác.

  Đây là ví dụ **chuẩn mực** của việc chọn màu: không chọn theo mắt ("xanh này đẹp"),
  mà chọn theo **con số đo được** rồi ghi lại con số đó vào comment. Và toàn bộ 12
  sắc (`ink`, `body`, `muted`, `page`, `surface`, `surface-2`, `surface-3`, `line`,
  `line-soft`, `sage`, `sage-line`, `warn`) đều được kèm L/C — nghĩa là lần sau
  thêm một sắc mới, người viết có sẵn thang để đặt nó vào đúng chỗ.

- Comment ở dòng 58 còn ghi lại **một sắc đã bị xoá**:

  > Xoá `--color-leaf`: tiêu đề dùng chính màu brand, không cần một sắc xanh thứ hai
  > cùng hue. Trước đây `.display` dùng leaf #299236 còn nút dùng brand #00703d nên
  > nhìn lệch nhau.

  Xoá mã mà để lại lý do — cách ghi sổ đúng, chặn việc "thêm lại cho có vẻ đầy đủ".

- `--color-warn` có **chính sách sử dụng** trong comment, gồm tên hai chỗ dùng và
  câu cấm:

  > Không dùng để tô nền hay làm nút thường, không thì hết nghĩa "sai".

  Màu cảnh báo là loại màu dễ bị lạm dụng nhất (mọi thứ "quan trọng" đều đỏ). Đặt
  luật ngay cạnh định nghĩa màu là chỗ đúng.

⚠️ Nhưng đây là chỗ có một mâu thuẫn cần biết (xem §4): comment ở `.btn-primary`
vẫn nói *"Trắng trên brand = 6.2:1"* trong khi comment ở `--color-brand` nói
*"4.57:1"* — hai con số cho cùng một cặp màu. Con số đúng là **4.57:1** (khớp với
giá trị `#278733` hiện tại); câu 6.2:1 còn sót lại từ màu xanh đậm cũ.

## 3.2 `@layer base` — ba luật nền

```css
@layer base {
  html { min-width: 320px; background: var(--color-page); }
  body {
    margin: 0;
    min-height: 100dvh;
    color: var(--color-ink);
    background: var(--color-page);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }
  button, [role="button"] { cursor: pointer; }
  :focus-visible { outline: 2px solid var(--color-brand); outline-offset: 2px; }
}
```

- **`min-width: 320px`** — chiều ngang nhỏ nhất của mọi thiết bị còn dùng (iPhone SE
  đời đầu). Chặn cảnh bố cục bị bóp méo dưới ngưỡng đó; thay vào đó xuất hiện thanh
  cuộn ngang.
- **`100dvh`** — đơn vị chiều cao mới: `vh` trên điện thoại tính cả phần bị thanh
  địa chỉ che, nên `100vh` làm tràn; `dvh` (dynamic viewport height) tự trừ phần đó.
  `min-height` chứ không `height` để nội dung dài vẫn cuộn đúng.
- **`cursor: pointer` cho `button`** — trình duyệt mặc định *không* đổi con trỏ thành
  bàn tay trên `<button>` (chỉ đổi trên `<a href>`). Một luật Tailwind nhỏ ở đây sửa
  cho **cả app**, và `[role="button"]` phủ thêm các phần tử giả nút.
- **`:focus-visible`** — viền xanh 2px + cách ra 2px, cho **mọi** phần tử có thể nhận
  bàn phím, trong một luật. `:focus-visible` khác `:focus`: trình duyệt chỉ hiện viền
  khi người dùng **đang dùng bàn phím** (Tab), không hiện khi click chuột — đúng ý
  "ai cần thì thấy". Đây là nền tảng accessibility của cả app.

## 3.3 `@layer components` — "class" của app

```css
.page { @apply mx-auto w-full max-w-[1280px] px-6; }
.card { @apply rounded-xl border border-line bg-surface; }
.input { @apply h-12 w-full rounded-lg border border-sage-line bg-white px-3.5 ... }
```

🔍 **Vì sao gom vào class, không viết thẳng utility trong từng JSX?** `.page` được
dùng ở **mọi** màn hình; nếu mỗi trang viết
`className="mx-auto w-full max-w-[1280px] px-6 fixed inset-x-0 top-0"` thì muốn đổi
bề rộng tối đa phải sửa 50 file và dễ sót 3 file. Class ở đây là **hợp đồng**: sửa
một chỗ, cả app theo. Comment ở `.page` ghi đúng lý do con số 1280:

> 1280 thay vì 1152: trên màn 1536px, 1152 để thừa 192px mỗi bên. Nới Ở ĐÂY chứ
> không nới riêng hero — mọi trang đều dùng `.page` nên navbar, hero, các section và
> footer vẫn thẳng hàng với nhau.

Đây là suy nghĩ về **toàn hệ thống**: thay đổi kích thước ở một class dùng chung thì
tất cả các tầng vẫn thẳng lề. Nếu nới riêng hero, hero sẽ lệch khỏi navbar.

Nút bấm — một hệ nhỏ bốn biến thể:

```css
.btn, .btn-primary, .btn-outline, .btn-ghost {
  @apply inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2
    text-sm font-semibold whitespace-nowrap transition-colors;
}
.btn-primary { @apply bg-brand text-white hover:bg-brand-deep
  disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted
  disabled:hover:bg-surface-3; }
.btn-outline { @apply border border-brand/30 bg-brand/10 text-brand ...; }
.btn-ghost   { @apply border border-sage-line bg-surface text-brand ...; }
```

- Selector đầu là **danh sách 4 tên viết chung**: bất kỳ nút nào mang một trong bốn
  class đều có chung phần nền (kiểu chữ, đệm, bo góc). Đúng bằng "lớp cha" của một
  hệ nút, mà không cần thêm class thứ hai vào JSX.
- `disabled:*` — trạng thái nút bị khoá được định nghĩa **một lần**: nền xám
  (`surface-3`), chữ mờ, con trỏ "cấm". Nếu không có, mỗi trang phải tự nhớ
  (`disabled:bg-...`) và sẽ có trang quên → nút khoá mà trông như bấm được.
  `disabled:hover:bg-surface-3` để nền **không đổi khi hover nút đã khoá** — chi tiết
  nhỏ nhưng là thứ khiến giao diện "có người chăm".
- `whitespace-nowrap` — nhãn nút không bị xuống dòng khi cột hẹp (nút cao bất ngờ là
  lỗi bố cục rất hay gặp ở tiếng Việt vì chữ dài hơn tiếng Anh).

```css
/* ponytail: sage-line not sage/40 -> 3.0:1 border, WCAG 1.4.11 */
.input {
  @apply h-12 w-full rounded-lg border border-sage-line bg-white px-3.5 text-sm text-ink
    transition-shadow outline-none placeholder:text-muted
    focus:border-brand focus:shadow-[0_0_0_3px_rgba(0,112,61,0.14)];
}
```

- Dòng `ponytail:` ghi lại một quyết định accessibility **đo được**: viền ô nhập cần
  **3:1** (WCAG 1.4.11 — không phải 4.5:1 như chữ), nên `sage/40` không đủ mà phải là
  `sage-line` đặc. Đây là loại chi tiết mà hầu hết dự án bỏ qua.
- **Hiệu ứng focus bằng `box-shadow` chứ không `outline`**: `0 0 0 3px` là một viền
  phát sáng **không chiếm chỗ trong bố cục**, nên không đẩy các ô khác khi focus —
  khác với viền `border` dày lên. Kèm `outline-none` để tắt viền mặc định (đã thay
  bằng `shadow`). Màu `rgba(0,112,61,0.14)` là xanh brand mờ 14%.
- `.chip` (nhãn tròn nhỏ), `.link-underline` (link có gạch dưới dày lên khi hover) —
  hai class nhỏ, dùng vài chỗ, gom ở đây cho khỏi lặp.

## 3.4 Chuyển động — và cách tắt đúng

Bảy `@keyframes` trong file, mỗi cái một mục đích:

| Tên | Dùng ở | Điểm đáng học |
| --- | --- | --- |
| `auth-in` | `/login` ↔ `/register` | hướng trượt truyền qua biến `--auth-from` (tài liệu 03b §4.2) |
| `sheen` | quà đặc biệt | comment: "chỗ **duy nhất** trong app được phép lấp lánh" — quy luật về hiệu ứng |
| `scan-sweep` | `/scanner` | xem đoạn dưới — bài học về `translateY(%)` |
| `pulse-bar` | khung chờ AI | skeleton thay spinner, có lý do |
| `reveal` | kết quả AI | dùng `animation-delay` thay `setTimeout` |
| `resolve` | từng chữ kết quả | blur nhẹ 5px (bản gõ chữ dùng 8px) |
| `bar-grow` | thanh độ tin cậy | `scaleX` thay `width` |

Ba đoạn đáng đọc kỹ:

**a. Vì sao `.scan-line` đặt trên khung ảnh, không trên đường 2px**

```css
/* Vệt quét của AI.
   Lớp .scan-line phủ kín khung ảnh (inset: 0) nên chiều cao của nó BẰNG
   chiều cao khung — translateY(100%) vì thế dịch đúng một khung, khác với
   trường hợp đặt vệt trên chính đường 2px (khi đó % tính theo 2px nên vệt
   đứng yên). Đường sáng và dải mờ là ::before/::after nên chạy theo. */

@keyframes scan-sweep {
  0%   { transform: translateY(-2%); }
  100% { transform: translateY(108%); }
}
.scan-line { position: absolute; inset: 0; pointer-events: none;
             animation: scan-sweep 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite; }
.scan-line::before { /* dải mờ 56px phía trên */ }
.scan-line::after  { /* lõi sáng 2px */ }
```

Đây là **bẫy CSS hay nhất trong file**: `translateY(100%)` dịch theo **chiều cao của
chính phần tử**. Nếu gắn animation lên đường sáng 2px, thì `100%` = 2px → vệt gần như
không nhúc nhích. Cách làm ở đây: cho lớp phủ **to bằng khung ảnh**, animation chạy
trên lớp đó, rồi vẽ đường sáng và dải mờ bằng hai pseudo-element nằm trong lớp — cả
hai tự đi theo. Ba dòng comment tiết kiệm cho người sau nửa buổi debug.

**b. Vì sao dùng `animation-delay` thay vì `setTimeout`**

```css
/* Kết quả AI hiện ra lần lượt. Dùng animation-delay đặt trong JSX thay vì
   chuỗi setTimeout trong React: không cần state, không cần dọn timer, và tự
   tắt dưới prefers-reduced-motion. */
```

So sánh hai cách làm hiệu ứng "hiện lần lượt 5 dòng kết quả":

```
   setTimeout trong React              animation-delay trong CSS
   ─────────────────────────           ────────────────────────
   state: số dòng đã hiện              state: không có
   cleanup khi unmount                 không có gì để dọn
   mỗi lần đổi → render lại 5 lần      một lần render, CSS lo phần còn lại
   phải tự kiểm reduced-motion         @media lo sẵn
```

Đây là câu trả lời mẫu cho câu hỏi "hiệu ứng nên làm bằng JS hay CSS?" — nếu hiệu
ứng chỉ là *thời gian và hình dáng*, CSS làm gọn hơn ở mọi mặt.

**c. `scaleX` thay `width`**

```css
/* Thanh độ tin cậy nở ra. Dùng scaleX thay vì animate width: width là thuộc
   tính layout, mỗi frame phải tính lại bố cục; scaleX chạy trên GPU. */
.bar-grow { transform: scaleX(0); transform-origin: left;
            animation: bar-grow 560ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```

`width` là thuộc tính **bố cục**: đổi nó bắt trình duyệt tính lại vị trí của mọi thứ
xung quanh, mỗi khung hình. `transform: scaleX` chỉ là **phép biến hình** trên ảnh
đã vẽ — chạy trên GPU, không ảnh hưởng ai khác. `transform-origin: left` để thanh nở
từ trái thay vì từ giữa. Đây là kiến thức cơ bản của web hiệu năng cao, gói trong
2 dòng comment.

**d. Khối `prefers-reduced-motion` — và hai chỗ không chỉ "tắt"**

```css
@media (prefers-reduced-motion: reduce) {
  .auth-enter, .sheen::after, .scan-line, .pulse-bar,
  .reveal, .resolve, .draw-frame, .bar-grow { animation: none; }

  /* Tắt hiệu ứng quét nhưng GIỮ dải sáng đứng yên ở giữa khung — bỏ hẳn thì
     người dùng không thấy dấu hiệu có gì đang chạy. Dải nằm ở mép trên
     lớp phủ nên translateY(50%) mới đưa nó ra giữa khung. */
  .scan-line { transform: translateY(50%); }

  /* thanh phải hết scaleX(0) thì mới thấy, nên reset tường minh */
  .bar-grow { transform: none; }
}
```

`prefers-reduced-motion` là thiết lập hệ điều hành: người bị rối loạn tiền đình hoặc
nhạy cảm chuyển động bật nó lên, và **mọi** animation phải tôn trọng. Đa số dự án chỉ
viết dòng `animation: none` cho tất cả — và ở đây sẽ **hỏng hai chỗ**, chính vì lý do
được ghi trong comment:

- `.bar-grow` có `transform: scaleX(0)` làm **trạng thái đầu**. Tắt animation mà
  không reset thì thanh độ tin cậy **biến mất** — người cần trợ giúp lại là người mất
  thông tin.
- `.scan-line` tắt đi thì mất luôn dấu hiệu "ảnh đang được xử lý". Ở đây giữ dải sáng
  **đứng yên** ở giữa khung.

Nguyên tắc rút ra, dùng được ở mọi dự án: **tắt hiệu ứng phải giữ lại kết quả cuối
cùng** (`both` giữ trạng thái cuối — nên nếu animation đã chạy xong thì nội dung vẫn
hiện). Hai dòng reset tường minh ở đây là bản mẫu của việc làm đúng.

## 3.5 ⚠️ Phông chữ tải từ internet

```css
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans...");
```

Đây là **tài nguyên mạng duy nhất** của app nằm ngoài gói build. Mọi ảnh trong repo
đều tải về local kèm comment lý do (`data/rewards.ts`: *"ảnh món quà, tải về local để
không phụ thuộc mạng lúc chạy"*), nhưng phông chữ thì không. Hệ quả: mở app khi
không có mạng → chữ rơi về `ui-sans-serif` của hệ điều hành, mọi bố cục vẫn chạy
nhưng khác chữ. Đây là đánh đổi phổ biến; nếu muốn nhất quán với phần còn lại của
repo thì tải font về `public/assets/fonts/` và khai báo `@font-face`. Ở mức độ
nghiêm trọng: không phải bug, chỉ là một chỗ chưa nhất quán.

---

# 4. Bảng phát hiện của tài liệu này

| # | Chỗ | Vấn đề | Mức |
| --- | --- | --- | --- |
| 1 | `index.css` `.btn-primary` | Comment nói "Trắng trên brand = 6.2:1" nhưng `--color-brand` là `#278733` (đo được 4.57:1) — câu cũ sót lại | trung bình |
| 2 | `check.tsx` | Không kiểm được tương tác/`useEffect` (giới hạn của SSR, đã ghi rõ trong comment đầu file) | trung bình |
| 3 | `index.css` | Phông chữ nạp từ `fonts.googleapis.com` — tài nguyên ngoài duy nhất, khác quy ước "asset local" của repo | thấp |
| 4 | `check.tsx` | Cả 56 `mustInclude` phải khớp chữ hiện tại — đổi tiêu đề là bài kiểm đỏ (đã biết, là đánh đổi) | thấp |
| 5 | `check-routes.tsx` | Không kiểm trường hợp **đăng nhập sai vai trò** (`user` mở `/admin`) — mới kiểm chiều "đúng vai trò vào được" | thấp |

Về #5, cách thêm chỉ tốn 6 dòng và rất đáng làm khi có dịp — nó biến `RequireRole`
từ "được kiểm một nửa" thành "được kiểm cả hai chiều":

```tsx
signIn("Nguyễn Đức", "user")
for (const path of ["/admin", "/staff", "/recycler"]) {
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>)
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
  if (!text.includes("LỖI 404")) { failed++; console.error(`FAIL role-gate ${path} lẽ ra phải bị chặn`) }
}
```

---

## Tự kiểm tra

1. `npm run check` chạy những gì, theo mấy bước? → `vite build --ssr src/check.tsx` đóng gói thành `.check/check.js`, rồi `node` chạy file đó; kết quả là 56 dòng OK/FAIL và mã thoát 0/1.
2. Vì sao `check.tsx` thay thẻ HTML bằng **khoảng trắng** chứ không phải chuỗi rỗng? → Vì bỏ sạch thì `</h1><p>` làm hai chữ dính liền, chuỗi cần tìm có thể bị cắt ngang.
3. Vì sao phải có file `check-routes.tsx` khi đã có `check.tsx`? → `check.tsx` không render cây route (RequireRole/Portal/Layout/Outlet); lỗi ở phần ghép route vẫn lọt.
4. Vì sao `check-routes.tsx` gọi `signIn()` mà không ghi thẳng `localStorage`? → `signIn` xoá bộ đệm `getSnapshot` như lúc chạy thật; ghi thẳng tạo tình huống không bao giờ xảy ra trong app.
5. Bài kiểm route dùng cách gì để phát hiện trang bị chặn sai vai trò? → Kiểm **sự vắng mặt** của dấu hiệu trang 404 (`text.includes("LỖI 404")` → báo lỗi).
6. `checkStableSnapshot()` kiểm tính chất gì, và vì sao không thể kiểm bằng render? → Hai lần `getSession()` liên tiếp phải trả **cùng một tham chiếu** (`Object.is`); lỗi vòng lặp vô hạn chỉ xảy ra khi component đọc lại store, mà SSR chỉ render một lần.
7. Tailwind v4 khai báo màu ở đâu, và `--color-brand` sinh ra class nào? → Trong `@theme` của `index.css`; sinh ra `text-brand`, `bg-brand`, `border-brand`, `bg-brand/10`…
8. Vì sao hiệu ứng quét nằm trên lớp phủ kín khung thay vì trên đường sáng 2px? → Vì `translateY(%)` tính theo chiều cao phần tử; trên phần tử 2px thì `100%` = 2px nên vệt đứng yên.
9. Khi bật `prefers-reduced-motion`, hai chỗ nào cần reset tường minh và vì sao? → `.bar-grow` (nếu không, `scaleX(0)` làm thanh tàng hình) và `.scan-line` (giữ dải sáng đứng yên để còn thấy dấu hiệu đang xử lý).

**Hết lộ trình.** Quay lại `README.md` để xem bảng tổng hợp và thứ tự đọc nếu cần ôn lại.
