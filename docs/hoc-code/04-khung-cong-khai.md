# 04 · Khung giao diện công khai

Ba file tạo nên phần "khung" mà người dùng thấy trên mọi trang công khai:

| File | Dòng | Vai trò |
| --- | --- | --- |
| `components/Navbar.tsx` | 298 | thanh trên cùng: logo, menu, avatar, dropdown tài khoản |
| `components/MobileNav.tsx` | 26 | tab bar nổi ở đáy, chỉ hiện dưới `lg` |
| `components/Footer.tsx` | 81 | chân trang: 4 cột link + bản quyền |

Cả ba đều **không nhận props**. Chúng tự đọc `data/nav.ts` và `lib/session.ts`.
Đây là quyết định có chủ ý: khung là thứ duy nhất, không cần cấu hình lại ở từng
trang.

---

## 1. Bố cục tổng thể

```
┌──────────────────────────────────────────────────────────────┐
│ Navbar — position: fixed, top:0, z-50, cao 70/76px           │
│  ┌────────── page (max 1280px) ──────────────────────────┐   │
│  │ [logo]  Tổng quan  Nhận diện AI  Điểm thu gom  ...    │   │
│  │                              TP.HCM  [Tìm thu gom] (◉) │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
        ↕ Layout thêm padding-top 70/76px để bù
┌──────────────────────────────────────────────────────────────┐
│                     <Outlet/> — nội dung trang                │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Footer — 4 cột, border-top                                    │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ MobileNav — fixed bottom:12px, z-50, chỉ < 1024px            │
│  [ Tổng quan ][ Nhận diện ][ Thu gom ][ Đổi thưởng ]         │
└──────────────────────────────────────────────────────────────┘
```

Vì Navbar và MobileNav là `fixed`, chúng **không chiếm chỗ** trong luồng bố cục.
Đó là lý do `Layout` phải có `pt-[70px]` và `pb-20` (đã giải thích ở tài liệu 02).

---

# PHẦN 1 — `Navbar.tsx`

## 1.1 Import và ba hàm vẽ icon (dòng 1–60)

```tsx
import { useEffect, useRef, useState } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import { ROLE_HOME, ROLE_LABEL, signOut, useSession } from "@/lib/session"
import { NAV_LINKS } from "@/data/nav"
```

| Import | Dùng để |
| --- | --- |
| `useState` | mở/đóng dropdown tài khoản |
| `useRef` | trỏ tới vùng DOM của dropdown, để biết click có nằm trong hay ngoài |
| `useEffect` | gắn/gỡ listener click ngoài + phím Escape |
| `Link` | điều hướng thường |
| `NavLink` | như `Link` nhưng biết mình đang active |
| `useNavigate` | chuyển trang bằng code (sau khi đăng xuất) |

### `initialsOf` (dòng 6–13)

```tsx
function initialsOf(name: string) {
  return name
    .split(" ")
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}
```

Chuỗi hàm biến "Nguyễn Văn An" → "VA":

```
"Nguyễn Văn An"
   .split(" ")        → ["Nguyễn", "Văn", "An"]
   .slice(-2)         → ["Văn", "An"]        ← lấy 2 từ cuối
   .map(part => part[0]) → ["V", "A"]
   .join("")          → "VA"
   .toUpperCase()     → "VA"
```

🔍 Vì sao lấy 2 từ **cuối** chứ không phải đầu: tên Việt Nam đặt tên riêng ở
cuối. "Nguyễn Văn An" viết tắt "VA" dễ nhận ra hơn "NV".

`part[0]` lấy ký tự đầu. Nếu chuỗi rỗng thì `undefined` — nhưng `name` chỉ được
gọi khi đã có phiên, nên không xảy ra.

### `UserGlyph` (dòng 17–24)

```tsx
function UserGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="12" cy="8" r="4.25" />
      <path d="M12 13.75c-4.28 0-7.75 2.7-7.75 6.03V21h15.5v-1.22c0-3.33-3.47-6.03-7.75-6.03Z" />
    </svg>
  )
}
```

Icon người dùng vẽ bằng SVG thay vì file ảnh. Lợi ích:

- `fill="currentColor"` → icon lấy đúng màu chữ của chỗ đặt nó, đổi theme không cần file mới.
- `viewBox="0 0 24 24"` → hệ toạ độ 24×24, co giãn mọi kích thước không vỡ nét.
- `aria-hidden="true"` → screen reader bỏ qua, vì đây là trang trí; nhãn thật nằm ở nút cha.

`cx/cy/r` là tâm và bán kính hình tròn (đầu); `path` là phần thân.

### `Chevron` (dòng 26–40)

```tsx
function Chevron({ open }: { open: boolean }) {
  return (
    <svg ... className={`size-3.5 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
```

Mũi tên nhỏ cạnh avatar. `open` quyết định xoay 180°: đóng thì chỉ xuống, mở thì
chỉ lên. `transition-transform duration-200` làm hiệu ứng xoay 200ms.

Đây là ví dụ **state điều khiển style**: cùng một thẻ SVG, chỉ đổi class.

### `Avatar` (dòng 42–60)

```tsx
function Avatar({ user, size = "size-9" }: { user: string; size?: string }) {
  if (user) {
    return (
      <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-[linear-gradient(...)] ...`}>
        {initialsOf(user)}
      </span>
    )
  }
  return (
    <span className={`grid ${size} ... bg-surface-2`}>
      <UserGlyph className="size-1/2 text-sage-line" />
    </span>
  )
}
```

Hai trạng thái:

| `user` | Hiển thị |
| --- | --- |
| có tên | vòng tròn gradient xanh + 2 chữ viết tắt trắng |
| rỗng | vòng tròn xám + icon người |

`size` có mặc định `"size-9"` và được nội suy vào className. Đây là **prop để
tuỳ biến style** — component cha truyền `"size-11"` khi cần to hơn.

`place-items-center` = `align-items + justify-items` cho grid, căn giữa cả hai chiều.

---

## 1.2 Dữ liệu menu (dòng 62–76)

```tsx
const ACCOUNT_ITEMS = [
  ["/account/profile", "Hồ sơ và thông báo"],
  ["/account/password", "Đổi mật khẩu"],
] as const
```

Mảng các **cặp** `[đường dẫn, nhãn]`. `as const` làm TypeScript coi đây là bộ
giá trị cố định (readonly tuple) thay vì mảng chuỗi chung chung.

```tsx
const EXPLORE = [
  ["/scanner", "Nhận diện rác bằng AI"],
  ["/map", "Tìm người thu gom"],
  ["/partners", "Đối tác tái chế"],
  ["/leaderboard", "Xếp hạng người dùng"],
] as const
```

Comment dòng 68–70 giải thích: mục "Đăng ký cơ sở thu mua" **chỉ hiện khi đã
đăng nhập**, vì U-05 là bước nâng cấp từ tài khoản người dân lên đối tác. Người
chưa có tài khoản thì chưa ở trong hệ sinh thái, mời họ đăng ký đối tác là sai
thứ tự.

🔍 Đây là kiểu quyết định sản phẩm được ghi ngay trong code. Không có gì "kỹ
thuật" ở đây, nhưng nếu không ghi lại, người sau sẽ tưởng là thiếu sót và thêm vào.

---

## 1.3 `ExploreList` — một danh sách, hai biến thể (dòng 78–105)

```tsx
function ExploreList({ close, withRegister }: { close: () => void; withRegister: boolean }) {
  const items = withRegister
    ? [...EXPLORE, ["/join-recycler", "Đăng ký cơ sở thu mua"]]
    : EXPLORE
```

- `close` là **hàm** truyền từ cha, gọi khi bấm link để đóng dropdown.
- `withRegister` bật/tắt mục thứ năm.
- `[...EXPLORE, [...]]` = copy mảng cũ rồi thêm một phần tử. **Không** dùng
  `EXPLORE.push(...)` vì như vậy sẽ sửa hằng số dùng chung — lần render sau mục
  đó xuất hiện hai lần.

```tsx
      <p className="...">Khám phá</p>
      <div className="p-2 pt-0">
        {items.map(([to, label]) => (
          <Link key={to} to={to} onClick={close} className="...">
            {label}
            <svg ...><path d="m6 4 4 4-4 4" ... /></svg>
          </Link>
        ))}
      </div>
```

`items.map(([to, label]) => ...)` — **destructuring ngay trong tham số**: mỗi
phần tử là mảng 2 phần, lấy ra 2 biến. Viết `item[0]`, `item[1]` cũng được
nhưng khó đọc hơn nhiều.

`onClick={close}` — truyền thẳng hàm, không cần `() => close()`. Vì `close`
không nhận tham số nào đáng kể (event bị bỏ qua).

---

## 1.4 `AccountMenu` — phần phức tạp nhất (dòng 107–249)

Đây là dropdown mở ra khi bấm avatar. Nó có 4 thứ: state, ref, effect đóng khi
click ra ngoài, và hai nhánh giao diện (đã đăng nhập / chưa).

### State và ref (dòng 108–112)

```tsx
const session = useSession()
const user = session?.name ?? ""
const navigate = useNavigate()
const [open, setOpen] = useState(false)
const ref = useRef<HTMLDivElement>(null)
```

| Biến | Nghĩa |
| --- | --- |
| `session` | `{name, role}` hoặc `null` |
| `user` | tên, hoặc chuỗi rỗng nếu chưa đăng nhập |
| `navigate` | hàm chuyển trang |
| `open` | dropdown đang mở? |
| `ref` | "cánh tay" chỉ vào `<div>` bọc ngoài, để kiểm tra click có nằm trong không |

**`useRef` là gì:** một hộp giữ **một giá trị** xuyên qua các lần render mà
**không** gây render lại khi đổi. Khác `useState` ở chỗ đó. Ở đây nó giữ tham
chiếu tới phần tử DOM thật:

```tsx
<div ref={ref}> ... </div>
```

Sau khi React gắn phần tử vào trang, `ref.current` chính là thẻ `<div>` đó.
Trước lần render đầu, `ref.current` là `null`.

### Effect đóng dropdown (dòng 114–128)

```tsx
useEffect(() => {
  if (!open) return

  const onDocClick = (e: MouseEvent) => {
    if (!ref.current?.contains(e.target as Node)) setOpen(false)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false)
  }

  document.addEventListener("mousedown", onDocClick)
  document.addEventListener("keydown", onKey)

  return () => {
    document.removeEventListener("mousedown", onDocClick)
    document.removeEventListener("keydown", onKey)
  }
}, [open])
```

Từng dòng:

1. `if (!open) return` — dropdown đóng thì **không gắn listener**. Tránh nghe
   sự kiện toàn trang một cách vô ích.
2. `onDocClick` — khi bấm chuột ở bất kỳ đâu:
   - `e.target` là phần tử bị bấm.
   - `ref.current?.contains(...)` = "phần tử đó có nằm trong dropdown không?".
   - `!` đảo lại: **không** nằm trong → đóng.
   - `as Node` là ép kiểu vì TypeScript không biết chắc `e.target` là `Node`.
3. `onKey` — bấm `Escape` thì đóng. Đây là chuẩn accessibility cho mọi popup.
4. `document.addEventListener` — gắn ở cấp `document`, không phải ở nút, vì cần
   bắt cả click ra ngoài.
5. `return () => { ...remove... }` — **hàm dọn dẹp**. React gọi nó:
   - trước khi effect chạy lại (khi `open` đổi),
   - khi component bị gỡ khỏi trang.

🔍 Nếu quên hàm dọn dẹp: mỗi lần mở/đóng dropdown lại gắn thêm một listener.
Mở 10 lần → 10 listener → bấm một cái, `setOpen(false)` chạy 10 lần. Không
crash nhưng sai và rò rỉ bộ nhớ. Đây là lỗi kinh điển của React.

`[open]` trong dependency array: effect chạy lại mỗi khi `open` đổi. Mở → gắn.
Đóng → React gọi cleanup (gỡ), rồi thân effect chạy, thấy `!open` → return sớm.

```
open = false  →  effect chạy  →  return sớm, không listener
open = true   →  effect chạy  →  gắn 2 listener
open = false  →  cleanup chạy →  gỡ 2 listener → effect chạy → return sớm
```

### Đăng xuất (dòng 130–134)

```tsx
const logout = () => {
  signOut()
  setOpen(false)
  navigate("/")
}
```

Ba bước: xoá phiên → đóng menu → về trang chủ. Nếu chỉ `signOut()` mà không
`navigate`, người dùng đang ở `/admin` sẽ bị `RequireRole` đá về `/login` — cũng
được, nhưng về trang chủ dễ chịu hơn.

### Nút mở (dòng 137–149)

```tsx
<div className="relative" ref={ref}>
  <button
    type="button"
    aria-label={user ? `Tài khoản: ${user}` : "Đăng nhập hoặc đăng ký"}
    aria-haspopup="menu"
    aria-expanded={open}
    onClick={() => setOpen((v) => !v)}
    className="..."
  >
    <Avatar user={user} size="size-9 md:size-10" />
    <Chevron open={open} />
  </button>
```

- `className="relative"` trên div cha: để dropdown `absolute` neo vào đây, không
  neo vào `body`.
- `type="button"` — bắt buộc, vì mặc định `<button>` trong form là `submit`.
  Không có form ở đây nhưng đặt cho an toàn và đúng chuẩn.
- Ba thuộc tính ARIA:
  - `aria-label` — tên cho screen reader (nút chỉ có hình, không có chữ).
  - `aria-haspopup="menu"` — "nút này mở một menu".
  - `aria-expanded` — "menu đang mở hay đóng". Screen reader đọc được trạng thái.

### Nhánh đã đăng nhập (dòng 156–216)

```tsx
{user ? (
  <>
    <div className="...">
      <Avatar user={user} size="size-11" />
      <p>{user}</p>
      <p>{ROLE_LABEL[session!.role]}</p>
    </div>
```

`session!` — dấu `!` nói với TypeScript "chắc chắn không null". Vì sao chắc?
Vì ta đang ở trong nhánh `user ?`, mà `user` chỉ có giá trị khi `session` tồn tại.
TypeScript không tự suy ra mối liên hệ đó, nên cần xác nhận thủ công.

⚠️ Đây là chỗ dễ sai: nếu sau này đổi `const user = session?.name ?? ""` thành
thứ khác, `session!` có thể nổ lúc chạy. Cách an toàn hơn là kiểm tra
`session &&` thay vì `user ?`. Code hiện tại đúng nhưng dựa vào một bất biến
ngầm — khi sửa phải nhớ.

Tiếp theo là 2 link tài khoản, link "vào khu vực của tôi", nút đăng xuất:

```tsx
<Link to={ROLE_HOME[session!.role]} ...>
  {session!.role === "user" ? "Trang của tôi" : `Khu vực ${ROLE_LABEL[session!.role].toLowerCase()}`}
</Link>
```

Đây là **con đường duy nhất** từ giao diện công khai vào khu vận tới. Comment
dòng 183–185 nói rõ: nếu xoá link này, người dùng đăng nhập xong không có cách
nào sang `/admin` hay `/staff`. Đó là loại bug "mọi thứ đúng nhưng không dùng được".

Chữ thay đổi theo vai trò:

```
user      → "Trang của tôi"
recycler  → "Khu vực cơ sở thu mua"
staff     → "Khu vực nhân viên"
admin     → "Khu vực quản trị viên"
```

### Nhánh chưa đăng nhập (dòng 217–244)

```tsx
<div className="border-b border-line-soft p-4">
  <p>Chào mừng đến EcoLink</p>
  <p>Đăng nhập để theo dõi lịch thu gom</p>
  <div className="mt-3 grid grid-cols-2 gap-2">
    <Link to="/register">Tạo tài khoản</Link>
    <Link to="/login">Đăng nhập</Link>
  </div>
</div>
<ExploreList close={() => setOpen(false)} withRegister={false} />
```

Hai nút cạnh nhau, đăng ký là nút phụ (viền), đăng nhập là nút chính (nền xanh).
Thứ tự này có chủ ý: đa số khách đã có tài khoản, nên hành động chính là đăng nhập.

`withRegister={false}` — khách chưa có tài khoản thì không mời đăng ký làm đối tác.

🔍 Toàn bộ dropdown là **một component tự quản**. Navbar không biết nó mở hay
đóng, không cần biết. Đây là cách chia để trị: phần phức tạp bị nhốt trong một
hàm 140 dòng thay vì làm rối cả file 300 dòng.

---

## 1.5 Phần khung của Navbar (dòng 251–298)

```tsx
<header className="fixed inset-x-0 top-0 z-50 h-[70px] border-b border-sage/25 bg-white/95 shadow-... backdrop-blur-xl md:h-[76px]">
```

Từng class quan trọng:

| Class | Nghĩa |
| --- | --- |
| `fixed` | định vị theo khung nhìn, không theo luồng trang |
| `inset-x-0 top-0` | dính sát hai bên và trên |
| `z-50` | nằm trên nội dung (số lớn hơn = cao hơn) |
| `h-[70px] md:h-[76px]` | cao 70px, từ md cao 76px |
| `bg-white/95` | trắng 95% — nội dung cuộn bên dưới hơi xuyên qua |
| `backdrop-blur-xl` | làm nhoè phần phía sau → hiệu ứng kính |
| `border-b border-sage/25` | đường kẻ dưới mảnh |

```tsx
<div className="page flex h-full items-center gap-6 lg:gap-8">
```

`page` là class tự định nghĩa trong `index.css`:

```css
.page { max-width: 1280px; margin-inline: auto; padding-inline: 24px; }
```

Dùng chung class này ở Navbar, hero, section, Footer → **mọi thứ thẳng hàng theo
một trục dọc**. Đây là lý do logo không bị lệch so với tiêu đề bên dưới.

`h-full` = cao bằng cha (70/76px), nhờ vậy `items-center` căn giữa theo chiều dọc
chuẩn xác.

```tsx
<Link to="/" aria-label="EcoLink - Trang chủ" className="shrink-0">
  <img src="/assets/brand/logo1.png" alt="EcoLink" className="h-[42px] w-auto md:h-[46px]" />
</Link>
```

- `shrink-0` — không cho logo bị co lại khi màn hẹp. Không có nó, flexbox sẽ bóp
  logo méo trước khi menu xuống dòng.
- `h-[42px] w-auto` — đặt **chiều cao**, chiều rộng tự theo tỉ lệ. Comment trong
  `docs/2026-09-28.md` ghi lại: trước đây đặt theo chiều rộng `w-[146px]` nên
  logo lệch và méo khi đổi kích thước. Đặt theo chiều cao ổn định hơn vì navbar
  có chiều cao cố định.
- `alt="EcoLink"` — chữ thay thế khi ảnh không tải được / cho screen reader.

```tsx
<nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">
  {NAV_LINKS.map((link) => (
    <NavLink key={link.to} to={link.to} end={link.to === "/"} className={({ isActive }) => ...}>
```

- `hidden lg:flex` — **mobile-first**: mặc định ẩn, từ 1024px mới hiện. Trên
  mobile đã có MobileNav ở đáy nên menu ngang bị ẩn để không chật.
- `end={link.to === "/"}` — cực kỳ quan trọng, giải thích bên dưới.

### `NavLink` và prop `end`

`NavLink` tự thêm trạng thái active khi URL khớp. Mặc định nó khớp **theo tiền tố**:

```
URL = /scanner/result
to="/scanner"   → khớp  ✅ (vì bắt đầu bằng /scanner)
to="/"          → khớp  ✅ (vì mọi URL đều bắt đầu bằng /)  ← SAI!
```

Vì vậy với link trang chủ phải đặt `end`: chỉ khớp khi URL **đúng bằng** `/`.
Nếu không, mục "Tổng quan" sẽ sáng ở mọi trang.

### Gạch chân active bằng pseudo-element

```tsx
className={({ isActive }) =>
  `relative px-3 py-2 ... after:absolute after:right-3 after:bottom-0 after:left-3 after:h-[2px] after:rounded-full after:bg-brand after:transition-transform ${
    isActive
      ? "font-semibold text-brand-deep after:scale-x-100"
      : "font-medium text-body after:scale-x-0 hover:text-brand-deep hover:after:scale-x-100"
  }`
}
```

`after:` là **pseudo-element** `::after` của CSS, ở đây là một gạch 2px.

```
trạng thái thường:  after:scale-x-0   → gạch rộng 0 (ẩn)
hover / active:     after:scale-x-100 → gạch rộng đầy
```

Dùng `scale-x` thay vì đổi `width` để có animation mượt (transform không làm
layout tính lại). `after:right-3 after:left-3` = gạch thụt vào 12px mỗi bên, không
chạm mép chữ.

`NavLink` nhận `className` là **hàm**, không phải chuỗi — React Router gọi nó
với `{ isActive }` để bạn quyết định class.

### Cụm bên phải (dòng 282–294)

```tsx
<div className="ml-auto flex items-center gap-3">
  <span className="hidden ... xl:flex">
    <i className="size-1.5 rounded-full bg-brand-soft shadow-..." />
    TP. Hồ Chí Minh
  </span>
  <Link to="/map" className="hidden ... xl:inline-flex">Tìm người thu gom</Link>
  <AccountMenu />
</div>
```

- `ml-auto` — đẩy cụm này sang phải (auto margin hút hết khoảng trống).
- Chấm xanh + "TP. Hồ Chí Minh" chỉ hiện từ `xl` (1280px). Dưới ngưỡng đó không
  đủ chỗ, ẩn đi thay vì xuống dòng.
- Nút CTA "Tìm người thu gom" cũng chỉ từ `xl`. Đây là **ưu tiên thông tin**:
  giữ avatar (cần thiết) trước, bỏ CTA (có link ở nơi khác) sau.

---

# PHẦN 2 — `MobileNav.tsx` (26 dòng)

```tsx
import { NavLink } from "react-router-dom"
import { MOBILE_LINKS } from "@/data/nav"

export default function MobileNav() {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed right-3 bottom-3 left-3 z-50 grid grid-cols-4 overflow-hidden rounded-[14px] border border-line/80 bg-white/94 shadow-... backdrop-blur-xl lg:hidden"
    >
```

| Class | Nghĩa |
| --- | --- |
| `fixed right-3 bottom-3 left-3` | dính đáy, cách 3 cạnh 12px → thành "viên thuốc" nổi |
| `z-50` | ngang cấp Navbar, luôn nổi trên nội dung |
| `grid grid-cols-4` | chia đúng 4 cột bằng nhau |
| `overflow-hidden` | bo góc cắt luôn phần con tràn ra |
| `rounded-[14px]` | bo 14px (giá trị lẻ, không có trong thang mặc định) |
| `bg-white/94` | trắng 94%, hơi trong |
| `backdrop-blur-xl` | nhoè nền phía sau |
| `lg:hidden` | từ 1024px trở lên thì **biến mất** |

```tsx
      {MOBILE_LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/"}
          className={({ isActive }) =>
            `grid min-h-12 place-items-center border-0 border-r border-line/60 px-1 text-xs font-semibold last:border-r-0 ${
              isActive ? "bg-surface-2 text-brand-deep" : "text-body"
            }`
          }
        >
          {link.label}
        </NavLink>
      ))}
```

- `min-h-12` = cao tối thiểu 48px. **48px là ngưỡng chạm tối thiểu** theo
  WCAG/Apple HIG; nhỏ hơn thì ngón tay bấm dễ trượt.
- `border-r` + `last:border-r-0` — kẻ vách giữa các tab, trừ tab cuối.
- Chỉ đổi **màu nền + màu chữ** khi active, không đổi kích thước → không bị
  nhảy layout khi chuyển tab.
- `text-xs` (12px) vì 4 tab trên màn 320px rất chật; chữ phải ngắn ("Thu gom",
  không phải "Điểm thu gom").

Vì sao chỉ 4 mục (`data/nav.ts` dòng 10–20): 5 tab trên 320px sẽ chật, và Blog
là nội dung đọc thêm, không phải chức năng chính. "Đổi thưởng" được giữ vì nó
đóng vòng lặp giao rác → tích điểm → tiêu điểm; thiếu nó người dùng mobile
không có đường tiêu điểm.

---

# PHẦN 3 — `Footer.tsx` (81 dòng)

```tsx
const HEADING = "text-xs font-semibold tracking-[0.12em] text-brand uppercase"
const LINK = "text-sm leading-6 text-body transition-colors hover:text-brand-deep"
```

Hai chuỗi class đặt thành hằng số vì dùng lại nhiều lần. Đây là cách "component
hoá style" đơn giản nhất, không cần thư viện.

```tsx
<div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.3fr] lg:gap-8">
```

Bố cục 4 cột **không bằng nhau**:

```
lg: [ 1.6fr ][ 1fr ][ 1fr ][ 1.3fr ]
     thương hiệu  cột 1   cột 2   hỗ trợ
```

Vì sao: cột thương hiệu chứa logo 130px + đoạn văn dài; cột hỗ trợ có thêm đoạn
mô tả. Chia đều 4 cột thì mỗi cột ~180px ở màn md, chữ sẽ nhảy dòng liên tục.
Comment dòng 11–13 ghi đúng lý do này.

`sm:grid-cols-2` — trên tablet chia 2 cột; `lg:` mới chia 4 theo tỉ lệ trên.

## 3.1 `FooterList` — một hàm cho hai kiểu dữ liệu (dòng 49–81)

```tsx
function FooterList({ title, note, items }: {
  title: string
  note?: string
  items: readonly (string | { label: string; to: string })[]
}) {
```

`items` là mảng mà mỗi phần tử **hoặc** là chuỗi **hoặc** là object `{label, to}`.
Vì sao cho phép hai kiểu: phần lớn link trong footer là trang **chưa tồn tại**
(chỉ là chữ), một số ít đã có trang thật (Khiếu nại).

```tsx
{items.map((item) => (
  <li key={typeof item === "string" ? item : item.to}>
    {typeof item === "string" ? (
      <a href="#" className={LINK}>{item}</a>
    ) : (
      <Link to={item.to} className={LINK}>{item.label}</Link>
    )}
  </li>
))}
```

`typeof item === "string"` là **thu hẹp kiểu** (type narrowing): TypeScript hiểu
trong nhánh này `item` là chuỗi, nhánh kia là object. Nhờ vậy `item.to` không bị
báo lỗi.

🔍 Vì sao dùng `href="#"` thay vì `<Link>`: comment nói thẳng — "chưa có trang
thì href='#', không giả vờ là đã xong". Dùng `Link to="/"` sẽ khiến người dùng
bấm vào tưởng có trang rồi bị đưa về trang chủ — tệ hơn là không phản ứng gì.

## 3.2 Dòng bản quyền (dòng 40–43)

```tsx
<div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
  <span>© 2026 EcoLink Circular Platform. Bảo lưu mọi quyền.</span>
  <span>Hệ thống sẵn sàng tại các tỉnh thành</span>
</div>
```

`flex-col` trên mobile (hai dòng chồng), `sm:flex-row sm:justify-between` trên
tablet trở lên (hai bên). Đây là pattern responsive hay gặp: **xếp dọc khi hẹp,
xếp ngang khi đủ chỗ**.

---

## 4. Ba file này dạy được gì

| Kỹ thuật | Xuất hiện ở | Dùng lại khi nào |
| --- | --- | --- |
| `useState` cho UI tạm | dropdown `open` | mọi thứ mở/đóng |
| `useRef` + click ngoài | `AccountMenu` | modal, dropdown, tooltip |
| cleanup trong `useEffect` | gỡ listener | mọi listener/timer |
| `NavLink` + `end` | menu | mọi menu điều hướng |
| data-driven component | `FooterList`, `ExploreList` | bảng, danh sách lặp |
| responsive mobile-first | `hidden lg:flex` | mọi bố cục |
| a11y cơ bản | `aria-*`, `alt`, `min-h-12` | mọi component tương tác |
| hằng số class | `HEADING`, `LINK` | style lặp lại |

---

## 5. Tự kiểm tra

1. Vì sao `NavLink to="/"` cần `end`? → Mặc định khớp theo tiền tố, `/` khớp mọi URL nên mục Tổng quan sẽ sáng ở mọi trang.
2. `useRef` khác `useState` ở đâu? → Đổi `ref.current` không gây render lại; dùng để giữ tham chiếu DOM hoặc giá trị "phụ".
3. Nếu bỏ hàm `return () => removeEventListener` thì sao? → Mỗi lần mở dropdown gắn thêm listener, không bao giờ gỡ → chạy trùng, rò rỉ bộ nhớ.
4. Vì sao MobileNav có `lg:hidden` mà không phải `md:hidden`? → Vì menu ngang của Navbar chỉ hiện từ `lg`; ẩn tab bar sớm hơn sẽ không còn cách điều hướng nào.
5. Vì sao footer cho phép item là chuỗi? → Vì nhiều link chưa có trang; hiển thị chữ thay vì tạo link giả dẫn về trang chủ.

**Tiếp:** `05 · Lớp dữ liệu` — 13 file trong `src/data/`.
