# 01 · React trong 20 phút

Bài này không dạy hết React. Nó dạy **đúng những thứ xuất hiện trong repo này**,
mỗi khái niệm kèm một đoạn code thật lấy từ dự án. Đọc xong bạn mở được bất kỳ
file `.tsx` nào và biết nó đang làm gì.

---

## 1. Một file `.tsx` là gì

`.tsx` = TypeScript + JSX. JSX là cách viết "HTML" ngay trong JavaScript:

```tsx
export default function NotFound() {
  return (
    <main className="page py-20 text-center">
      <h1 className="display text-3xl">Không tìm thấy trang</h1>
      <p className="mt-3 text-body">Đường dẫn không tồn tại.</p>
    </main>
  )
}
```

Nhìn như HTML nhưng thực chất là **một hàm trả về một object mô tả giao diện**.
React nhận object đó rồi tự tạo DOM thật. Vì vậy trong JSX:

| HTML | JSX | Lý do |
| --- | --- | --- |
| `class="..."` | `className="..."` | `class` là từ khoá của JS |
| `for="..."` | `htmlFor="..."` | `for` là từ khoá của JS |
| `<img>` | `<img />` | JSX bắt buộc thẻ tự đóng |
| `<br>` | `<br />` | như trên |
| `onclick="..."` | `onClick={...}` | sự kiện là hàm JS, không phải chuỗi |

**Quy tắc vàng:** một component phải trả về **đúng một** phần tử gốc. Muốn trả
nhiều phần tử thì bọc trong `<>...</>` (gọi là Fragment, không tạo thẻ HTML thật).

---

## 2. Component = một hàm, tên viết Hoa

```tsx
function Stat(...) { ... }        // ✅ component
function formatPrice(...) { ... } // ❌ hàm thường, không trả JSX
```

React phân biệt hai loại bằng **chữ cái đầu**: viết Hoa → React coi là component
và gọi nó; viết thường → thẻ HTML (`<div>`, `<span>`) hoặc hàm thường.

Trong repo, mỗi màn hình là một component cùng tên file:

```
pages/Scanner.tsx        → export default function Scanner()
components/Navbar.tsx    → export default function Navbar()
```

`export default` nghĩa là "file này xuất ra một thứ chính". Nhờ vậy `App.tsx`
chỉ cần `import Scanner from "@/pages/Scanner"` là dùng được.

---

## 3. Dấu `{}` — chỗ trộn JavaScript vào giao diện

Trong JSX, `{...}` nghĩa là "tính giá trị JS này rồi in ra đây".

```tsx
<h1>{title}</h1>                       // in biến
<p>{session?.name ?? "Khách"}</p>      // in biểu thức có fallback
<span>{items.length} mục</span>        // gọi hàm/thuộc tính
<div className={isActive ? "a" : "b"}> // truyền giá trị vào thuộc tính
```

Ba dạng có điều kiện bạn sẽ gặp khắp nơi:

```tsx
{open && <nav>...</nav>}                    // có open thì mới vẽ nav
{note && <p>{note}</p>}                     // có note thì mới có dòng ghi chú
{tone === "brand" ? <A/> : <B/>}            // chọn một trong hai
```

`{open && ...}` hoạt động vì `false && x` trả về `false`, và React bỏ qua
`false`/`null`/`undefined` — không in ra chữ "false".

---

## 4. Props — tham số của component

Component nhận dữ liệu từ bên ngoài qua **props**, giống hàm nhận tham số.

```tsx
// components/RequireRole.tsx
export default function RequireRole({
  roles,
  children,
}: {
  roles: readonly Role[]
  children: React.ReactNode
}) { ... }
```

Chỗ dùng:

```tsx
<RequireRole roles={["admin"]}>
  <AdminHome />
</RequireRole>
```

- `roles={["admin"]}` → prop `roles` là mảng.
- Nằm giữa hai thẻ → prop đặc biệt tên `children`, ở đây là `<AdminHome />`.
- `React.ReactNode` = "bất cứ thứ gì React vẽ được": chữ, số, JSX, mảng JSX.
- `readonly Role[]` = mảng không được sửa tại chỗ (chỉ đọc).

⚠️ Props **chỉ đọc**. Component con không được gán `roles = ...`. Muốn đổi dữ
liệu thì dữ liệu đó phải là **state** (mục 6), hoặc bên cha truyền hàm xuống.

---

## 5. JSX là kết quả của hàm — vẽ lại là gọi lại hàm

Đây là điểm khác biệt lớn nhất so với HTML thường:

```
State đổi  →  React gọi lại component  →  nhận JSX mới  →  so sánh với cũ
                                                          →  chỉ sửa DOM chỗ khác
```

Bạn **không** viết `document.querySelector(...).innerHTML = ...` ở đâu cả. Bạn
chỉ mô tả "với dữ liệu này thì giao diện trông thế nào", React lo phần cập nhật.
Đó gọi là **declarative** (khai báo) thay vì **imperative** (ra lệnh từng bước).

Vì hàm được gọi lại nhiều lần, **mọi biến khai báo trong thân hàm bị tạo mới mỗi
lần render**. Đó là lý do có hook (mục 7).

---

## 6. State — bộ nhớ của component

```tsx
const [open, setOpen] = useState(false)
```

Đọc từ phải sang trái:

- `useState(false)` — tạo một ô nhớ, giá trị đầu là `false`.
- Trả về mảng 2 phần tử: `[giá trị hiện tại, hàm để đổi giá trị]`.
- `const [open, setOpen]` — **destructuring**, lấy phần tử 0 đặt tên `open`,
  phần tử 1 đặt tên `setOpen`.

Khi gọi `setOpen(true)`:

```
setOpen(true)
   │
   ├─ React ghi nhớ giá trị mới
   ├─ đánh dấu component "bẩn"
   └─ gọi lại component  →  JSX mới  →  DOM cập nhật
```

Ví dụ thật (`components/Portal.tsx` dòng 14 và 26):

```tsx
const [open, setOpen] = useState(false)

<button onClick={() => setOpen((v) => !v)}>
  {open ? "Đóng" : "Menu"}
</button>
```

`setOpen((v) => !v)` — truyền **hàm** thay vì giá trị: "lấy giá trị cũ `v`, trả
về ngược lại". Cách này an toàn khi bấm nhanh nhiều lần, vì luôn dùng giá trị
mới nhất chứ không phải giá trị đã chụp lúc render.

⚠️ **Không bao giờ** làm `open = true`. Gán trực tiếp thì React không biết để vẽ lại.

### State nằm ở đâu?

State thuộc về **component khai báo nó**. `Portal` khai báo `open` thì `open`
sống trong `Portal`, không ai khác đọc được. Muốn chia sẻ thì **nâng state lên
cha** rồi truyền xuống bằng props.

Ngoại lệ duy nhất trong repo: phiên đăng nhập, vì nó cần cho hàng chục component
ở mọi nơi → dùng `useSyncExternalStore` (đọc ở tài liệu `03`).

---

## 7. Hook — hai cái tên bạn gặp nhiều nhất

Hook là hàm bắt đầu bằng `use`, chỉ được gọi **ở dòng đầu tiên của component**
(không gọi trong `if`, vòng lặp, hay hàm con). Lý do: React đếm thứ tự các hook
để biết ô nhớ nào là của ai; đổi thứ tự là lệch hết.

### `useState` — bộ nhớ (đã nói ở trên)

### `useEffect` — chạy code "phụ" sau khi vẽ xong

```tsx
// components/Layout.tsx
const { pathname } = useLocation()

useEffect(() => {
  window.scrollTo({ top: 0 })
}, [pathname])
```

Đọc: "sau mỗi lần vẽ, nếu `pathname` khác lần trước thì cuộn lên đầu trang".
Mảng `[pathname]` gọi là **dependency array**:

| Viết | Chạy khi nào |
| --- | --- |
| `useEffect(fn, [])` | 1 lần sau lần vẽ đầu |
| `useEffect(fn, [a, b])` | sau lần vẽ đầu + mỗi khi `a` hoặc `b` đổi |
| `useEffect(fn)` | sau **mọi** lần vẽ (hiếm dùng) |
| `return () => ...` | hàm dọn dẹp, chạy trước lần chạy sau hoặc khi component bị gỡ |

Không có `useEffect` để tính toán — tính toán thì viết thẳng trong thân hàm.

---

## 8. Sự kiện

```tsx
<button onClick={() => setOpen((v) => !v)}>Menu</button>
<input onChange={(e) => setName(e.target.value)} />
<form onSubmit={(e) => { e.preventDefault(); ... }}>
```

- `onClick={...}` nhận **hàm**, không nhận kết quả gọi hàm.
  `onClick={doSomething()}` là sai — nó gọi ngay lúc vẽ.
- `e` là event object. `e.target.value` là chữ trong ô input.
- `e.preventDefault()` chặn hành vi mặc định của trình duyệt (form gửi đi và tải
  lại trang). Gần như mọi form trong repo đều có dòng này.

---

## 9. Vẽ danh sách: `.map()` + `key`

```tsx
{PORTAL_NAV[role].map((sec) => (
  <Section key={sec.title} title={sec.title} role={role} />
))}
```

- `.map(fn)` biến mảng dữ liệu thành mảng JSX.
- `key` là **bắt buộc**: React dùng nó để biết phần tử nào giữ nguyên, phần tử
  nào mới/thừa khi mảng đổi. Thiếu `key` → React cảnh báo và có thể vẽ sai.
- `key` phải **ổn định và duy nhất** — thường là `id` hoặc chuỗi tên. **Không**
  dùng chỉ số mảng nếu danh sách có thể chèn/xoá ở giữa.

Các hàm mảng khác trong repo:

| Hàm | Nghĩa | Ví dụ trong repo |
| --- | --- | --- |
| `.map` | biến đổi từng phần tử | bày bảng, bày thẻ |
| `.filter` | giữ phần tử thoả điều kiện | lọc đối tác theo khu vực |
| `.find` | lấy **một** phần tử đầu tiên khớp | `PORTAL_NAV[role].find(...)` |
| `.some` | có ít nhất một phần tử khớp? | kiểm tra quyền |
| `.includes` | chuỗi/mảng có chứa? | `roles.includes(session.role)` |
| `.length` | số phần tử | đếm |

---

## 10. JavaScript căn bản xuất hiện ở mọi file

```ts
const { pathname } = useLocation()        // destructuring object
const [a, b] = useState(0)                // destructuring array
const next = { ...old, name: "A" }        // spread: copy rồi ghi đè
const all = [...list, newItem]            // spread mảng
session?.name                             // optional chaining: null thì trả undefined
session?.name ?? "Khách"                  // nullish: null/undefined thì lấy "Khách"
const role = x ? "admin" : "user"         // ternary
items.map((item) => item.label)           // arrow function
`${a} / ${b}`                             // template string
export const X = ...                      // xuất có tên
export default function Y() {}            // xuất mặc định
import type { Role } from "..."           // chỉ lấy kiểu, xoá lúc build
```

Phân biệt `??` và `||` (hay bị lẫn):

```ts
0 || 5    // 5   ← vì 0 là "falsy"
0 ?? 5    // 0   ← vì 0 không phải null/undefined
```

Dùng `??` khi số 0 hoặc chuỗi rỗng là giá trị hợp lệ.

### Alias `@/`

```ts
import Layout from "@/components/Layout"
```

`@` = thư mục `src`. Cấu hình ở **hai nơi** phải khớp nhau:

- `tsconfig.json` → `paths: { "@/*": ["./src/*"] }` (để TypeScript hiểu)
- `vite.config.ts` → `resolve.alias` (để Vite đóng gói đúng)

Nhờ alias, file ở sâu `pages/admin/Fees.tsx` vẫn import `@/components/Portal`
mà không cần `../../../components/Portal`.

---

## 11. TypeScript: chỉ cần 6 khái niệm

```ts
type Role = "user" | "recycler" | "staff" | "admin"   // union: chỉ 4 giá trị này
type Session = { name: string; role: Role }           // object type
Record<Role, string>                                  // object có đủ 4 khoá Role
readonly Role[]                                       // mảng chỉ đọc
children: React.ReactNode                             // thứ React vẽ được
function f(x?: string)                                // ? = có thể không truyền
```

Kiểu **không tồn tại lúc chạy**. Build xong, TypeScript bị xoá sạch, chỉ còn
JavaScript. Nó là "người soát lỗi trước khi chạy", không phải tính năng của app.

Vì thế khi đọc code bạn có thể bỏ qua mọi thứ sau dấu `:` trong khai báo, trừ khi
muốn biết dữ liệu có hình dạng gì.

`tsconfig.json` bật `strict: true` — nghĩa là không cho phép biến có thể `null`
mà dùng như chắc chắn có. Đó là lý do bạn thấy nhiều `?.` và `??` trong code:
không phải phòng xa thừa thãi, mà là **bắt buộc** để biên dịch được.

---

## 12. Tailwind: giao diện viết bằng class

Không có file `.css` riêng cho từng trang. Mọi style là class trong `className`:

```tsx
<main className="page py-20 text-center">
```

| Class | CSS sinh ra | Nghĩa |
| --- | --- | --- |
| `py-20` | `padding-block: 5rem` | đệm trên/dưới 80px |
| `text-center` | `text-align: center` | canh giữa |
| `text-body` | `color: var(--color-body)` | màu chữ xám xanh (token riêng) |
| `page` | `max-width:1280px; margin:auto; padding-inline:24px` | class tự định nghĩa |

Quy ước đặt tên hay gặp:

```
p-4  padding all      px-4 padding ngang     py-4 padding dọc
m-4  margin           mt-4 margin-top        gap-3 khoảng cách flex/grid
w-56 width 14rem      h-10 height 2.5rem     min-h-dvh cao tối thiểu 100% màn hình
text-sm cỡ 14px       font-bold              leading-6 line-height
bg-surface nền        border-line viền       rounded-lg bo góc
flex / grid           items-center           justify-between
hidden / lg:block     sm: md: lg: xl:        tiền tố = breakpoint
```

`lg:block` = "từ màn hình ≥1024px thì hiện". Mobile-first: class không tiền tố áp
dụng cho mọi cỡ, có tiền tố thì ghi đè từ breakpoint đó trở lên.

### Bảng màu nằm ở đâu

`src/index.css` có khối `@theme`:

```css
@theme {
  --color-brand: #278733;
  --color-ink: #0f1f15;
  --color-body: #404b44;
  ...
}
```

Tailwind tự sinh class từ biến: `--color-brand` → `bg-brand`, `text-brand`,
`border-brand`. Vì thế đổi một dòng hex là đổi cả app, và **không được** viết
`text-[#278733]` rải rác — đó là lỗi thẩm mỹ đã được sửa trong repo này.

Token đáng nhớ:

```
ink      chữ đậm nhất (tiêu đề)
body     chữ nội dung
muted    chữ phụ, ghi chú
brand    xanh chủ đạo (nút, link, eyebrow)
surface  nền thẻ        page  nền trang
line     viền           mint  xanh nhạt trang trí
```

---

## 13. Đọc một trang theo 4 câu hỏi

Lấy `pages/NotFound.tsx` làm mẫu tối giản:

```tsx
export default function NotFound() {
  return (
    <main className="page py-20 text-center">
      <h1 className="display text-3xl">Không tìm thấy trang</h1>
      <p className="mt-3 text-body">Đường dẫn không tồn tại.</p>
    </main>
  )
}
```

1. **Nhận vào gì?** Không có props.
2. **Giữ trạng thái gì?** Không có.
3. **Vẽ ra gì?** Một `<main>` canh giữa, tiêu đề + mô tả.
4. **Phản ứng gì?** Không có.

Trang phức tạp chỉ là 4 câu đó dài hơn. `Scanner.tsx` 846 dòng vẫn trả lời
đúng 4 câu: nhận props không có, giữ vài state (ảnh, kết quả AI, đang quét),
vẽ khung upload + kết quả, phản ứng với chọn ảnh / bấm quét / bấm xoá.

---

## 14. Từ điển nhanh

| Bạn thấy | Đọc là |
| --- | --- |
| `export default function X()` | "màn hình/component tên X" |
| `useState` | "biến nhớ, đổi là vẽ lại" |
| `useEffect` | "làm việc phụ sau khi vẽ" |
| `props` | "tham số truyền từ cha" |
| `children` | "nội dung nằm giữa hai thẻ" |
| `<Outlet />` | "chỗ trống để trang con chèn vào" |
| `onClick` | "khi bấm" |
| `onChange` | "khi gõ" |
| `className` | "style" |
| `??` | "nếu rỗng thì lấy cái sau" |
| `?.` | "nếu có thì lấy tiếp, không thì thôi" |
| `...` | "copy toàn bộ phần còn lại" |

---

**Tiếp:** [02 · Một trang được sinh ra thế nào](02-khoi-dong.md) — áp dụng đúng
những thứ vừa học vào 4 file đầu tiên của dự án.
