# 10 · Khung làm việc & các component dùng chung

Sáu file, ~1.240 dòng, không page nào trong số này có route riêng — chúng là
**khung** mà 51 trang kia lắp vào.

| File | Dòng | Vai trò |
| --- | --- | --- |
| `components/Portal.tsx` | 314 | khung sau đăng nhập cho **user** và **recycler** |
| `components/admin/Shell.tsx` | 240 | khung riêng cho **staff** và **admin** (console) |
| `components/admin/ui.tsx` | 234 | bộ UI của console, tên trùng `Portal.tsx` nhưng khác kiểu |
| `components/admin/Assistant.tsx` | 204 | trợ lý tra số liệu, nằm trong `Shell` |
| `components/CheckIn.tsx` | 138 | điểm danh — dùng cho cả người dân và nhân viên |
| `components/Leaderboard.tsx` | 110 | bục xếp hạng, dùng ở `/leaderboard` và `/user/gamification` |

```
                        ┌──────────────────────────────┐
   /, /blog, ...  ────▶ │ Layout (navbar + footer)     │  khách chưa đăng nhập
                        └──────────────────────────────┘

                        ┌──────────────────────────────┐
   /user/*, /recycler/* │ Layout ▶ RequireRole ▶ Portal│  sidebar 224px + Outlet
                        └──────────────────────────────┘

                        ┌──────────────────────────────┐
   /staff/*, /admin/*   │ RequireRole ▶ AdminShell     │  topbar 56px + sidebar 232px
                        │    └ Assistant (nổi, mọi trang)│  KHÔNG navbar, KHÔNG footer
                        └──────────────────────────────┘
```

---

# 1. `Portal.tsx` — khung của khu người dân và cơ sở thu gom

## 1.1 `Outlet` — chỗ để trang con chui vào

```tsx
export default function Portal({ role }: { role: Role }) {
  ...
  <main className="min-w-0 flex-1">
    <Outlet />
  </main>
```

`Outlet` là chỗ React Router đặt trang con (`/user/handover`, `/user/payout`…).
Nhờ nó, `Portal` viết **một lần** và 13 trang kia không trang nào cần biết sidebar
tồn tại. Đây là lý do `App.tsx` (tài liệu 00) khai báo route lồng nhau:

```tsx
<Route element={<Portal role="user" />}>
  <Route path="/user" element={<UserHome />} />
  ...
</Route>
```

## 1.2 Hai bản menu, một định nghĩa (dòng 38–45 và 56–60)

```tsx
// mobile: chỉ hiện khi bấm nút Menu
{open && <nav id="portal-nav" className="page flex flex-col gap-4 pb-4">...}

// desktop: sidebar luôn hiện
<aside className="hidden w-56 shrink-0 lg:block">
  <nav aria-label="Điều hướng khu vực" className="mt-4">...</nav>
</aside>
```

Cả hai chỗ gọi **cùng** một component `Section`:

```tsx
function Section({ title, role }: { title: string; role: Role }) {
  const items = PORTAL_NAV[role].find((s) => s.title === title)?.items ?? []
  ...
  <NavLink to={item.to} end={item.to.split("/").length <= 2} ...>
```

🔍 Ba chi tiết đắt trong 3 dòng:

1. `Section` **tra lại** section từ `PORTAL_NAV[role]` theo `title` thay vì nhận
   thẳng `items` qua props. Nghe vòng vo, nhưng nhờ vậy props chỉ còn
   `{ title, role }` — hai chuỗi ngắn — thay vì một mảng object. React so sánh
   props nông, nên truyền mảng sẽ tạo tham chiếu mới mỗi render; truyền hai chuỗi
   thì không. Đây là mẹo nhỏ, không bắt buộc, nhưng giải thích được vì sao người
   viết chọn cách khó hơn.

2. `end={item.to.split("/").length <= 2}` — **mẹo nhận biết mục gốc**.
   `"/user".split("/")` → `["", "user"]` = 2 phần; `"/user/handover"` = 3 phần.
   `end` bảo `NavLink`: chỉ sáng khi URL **đúng bằng** đường dẫn này. Không có nó,
   đứng ở `/user/handover` thì cả mục "Tổng quan" (`/user`) cũng sáng — hai mục
   sáng cùng lúc. Viết bằng số phần của chuỗi là cách ngắn nhất để hỏi "đây có
   phải mục gốc không", khỏi phải gắn cờ `exact: true` vào từng mục trong dữ liệu.

3. `NavLink` nhận `className` dạng **hàm**:
   `({ isActive }) => "..."`. Chỉ `NavLink` (không phải `Link`) mới truyền được
   `isActive`, vì nó biết URL hiện tại. Đây là lý do menu dùng `NavLink`, còn nút
   "Xem tất cả yêu cầu →" trong trang dùng `Link` thường.

## 1.3 Vì sao mobile không có drawer

Comment dòng 8–10:

> Sidebar ẩn dưới `lg` thay vì có drawer: các màn hình sau đăng nhập đều dùng bảng
> và biểu mẫu, người dùng chủ yếu ở desktop. Ở mobile hiện thanh cuộn ngang ở đầu
> trang — 4 mục trở xuống vẫn bấm được.

Đây là quyết định **biết mình đang đánh đổi gì**: bỏ drawer = bỏ một component
(nền mờ, bẫy focus, khoá cuộn nền, phím Esc) đổi lấy một hàng nút. Với khu vực
dùng trên điện thoại chủ yếu là *xem*, đánh đổi này hợp lý. Nó chỉ sai nếu người
dùng thật sự làm việc trên điện thoại.

## 1.4 `PageHead`, `Stat`, `Table`, `Status`, `Empty`, `Field`

Năm component này là "bảng chữ của giao diện" — mọi trang sau đăng nhập đều ghép
từ chúng. Đọc kỹ một lần, 13 trang kia đọc nhanh gấp ba.

**`PageHead`** — một tiêu đề trang có đúng 4 phần:

```
eyebrow  →  nhãn nhỏ chữ hoa, cho biết đang ở khu nào ("TỔNG QUAN", "DÒNG TIỀN")
title    →  h1, câu hỏi/việc chính
body     →  một câu giải thích, tối đa 68ch
action?  →  nút bên phải, KHÔNG bắt buộc
```

`max-w-[68ch]`: 68 ký tự là ngưỡng đọc thoải mái của mắt người (55–75). Không có
nó, dòng chữ mô tả kéo hết chiều rộng màn hình và mắt phải "nhảy" khi xuống dòng.

**`Stat`** — con số + nhãn + đơn vị + ghi chú. Comment dòng 153–165 ghi lại **hai
lần sửa thiết kế**:

- Trước: 4 ô số liệu là 4 hộp `card` có viền, nằm cạnh nhau → "dãy hộp giống hệt
  nhau", trông như máy sinh. Nay: **không viền**, chỉ khoảng trắng + bóng mềm.
- `unit` tách khỏi `value` vì lý do **thị giác**: `"214.500 kg"` gộp chung thì con
  số dài bằng `"1.842.000.000"`, hàng số không thẳng. Để đơn vị thành chữ nhỏ thì
  mọi con số cùng cỡ và đọc như một hàng.

`tabular-nums` trên `value`: bắt các chữ số rộng bằng nhau, nên khi số đổi
(`1.234` → `9.999`) chữ không nhảy. Mọi chỗ hiện số trong app đều có class này —
nó là lý do các bảng trông đứng yên.

**Ba mức "màu" của số liệu** — `tone="plain" | "brand"`:

```
plain → nhãn xám, số ink             (mặc định, cho mọi trang)
brand → nhãn xanh, số to hơn         (1 lần/trang, cho dải tổng quan)
```

Comment nói rõ: tô cả 4 số thành xanh thì **mất thứ bậc** — cái gì cũng nổi thì
không gì nổi. Và có ghi lại số đo tương phản: `brand` 4,57:1, `brand-deep` 7,0:1,
cả hai đạt WCAG AA (ngưỡng 4,5:1 cho chữ thường). Đây là loại ghi chú cực có ích:
sáu tháng sau, ai định đổi màu sẽ biết mình đang phá một ngưỡng đã đo, chứ không
phải phá một "màu ai đó thích".

**`StatRow`** — dải số liệu. Hai kiểu:

```
plain → chỉ có đường kẻ dưới
brand → "double-bezel": vỏ mint bo 1.75rem ▸ lõi trắng bo 1.5rem ▸ bóng mềm lan to
```

```tsx
const grid = "grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-[1fr_0.8fr_1.15fr_1.5fr]"
```

Bốn cột **không bằng nhau**. Comment dòng 227–229 nói vì sao: `"1.842.000.000 ₫"`
dài hơn `"1.284"`, chia đều thì đơn vị rớt xuống dòng. Bề rộng đặt theo độ dài dữ
liệu, và vì thứ tự số liệu cố định nên vẫn thẳng hàng giữa các trang. Đây là kiểu
quyết định chỉ có được sau khi **nhìn** dữ liệu thật, không suy ra từ lý thuyết.

**`Table` + `Td`** — bảng dữ liệu:

```tsx
<div className="overflow-x-auto rounded-xl border border-line bg-surface">
  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
```

`min-w-[640px]` + `overflow-x-auto` là cặp bài trùng cho bảng nhiều cột trên điện
thoại: bảng không bị bóp méo, thay vào đó **cuộn ngang trong khung của nó**. Nếu
bỏ `min-w`, các cột sẽ bị ép và chữ rơi khỏi ô.

**`Status`** — nhãn trạng thái, 4 mức:

```tsx
todo: "bg-surface-3 text-body"   // việc trung tính, chưa cần gấp
wait: "bg-mint/25 text-brand-deep" // đang chờ ai đó
ok:   "bg-brand text-white"      // xong
off:  "bg-surface-2 text-muted"  // bị tắt / bị từ chối
```

🔍 Cả 4 mức dùng **cùng một hệ xanh**, phân biệt bằng độ đậm và nền — comment nói
rõ: "không thêm màu đỏ/vàng". Đây là quyết định thẩm mỹ có hệ quả kỹ thuật: một
hệ màu thì không bao giờ có hai sắc xanh hơi khác nhau cạnh nhau, cũng không có
chữ vàng trên nền vàng. Đổi lại, người dùng phải **đọc chữ** để biết trạng thái —
nên `Status` luôn cần `children` là chữ, không bao giờ chỉ có màu.

**`Empty`** — khối "chưa có gì". Nhỏ thôi nhưng là chi tiết dễ quên nhất khi làm
app: danh sách rỗng mà không có gì hiện thì người dùng nghĩ app lỗi.

**`Field`** — nhãn + control + gợi ý, bọc trong `<label>` thật:

```tsx
<label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
  {label}
  {children}
  {hint && <span className="text-[12px] font-normal text-muted">{hint}</span>}
</label>
```

Comment nói đúng trọng tâm: *bọc `<label>` thật nên bàn phím chuyển vòng qua các ô
bằng Tab là tự động* — nghĩa là bấm vào chữ "Tiêu đề" cũng focus vào ô nhập, và
trình đọc màn hình đọc được nhãn. Nếu thay `<label>` bằng `<div>`, cả hai mất miễn
phí.

---

# 2. `admin/Shell.tsx` — khung của console

## 2.1 Vì sao cố tình KHÔNG dùng `Portal`

Comment dòng 24–41 liệt kê khác biệt:

```
                        Portal (user/recycler)      AdminShell (staff/admin)
navbar công khai        có                          KHÔNG
footer                  có                          KHÔNG
thanh dưới mobile       có                          KHÔNG
chiều cao topbar        70/76px                     56px (nhường chỗ cho dữ liệu)
bề rộng sidebar         224px (w-56)                232px (w-58)
sidebar cuộn            không, cuộn cả trang        tự cuộn, nút Đăng xuất đứng yên
```

🔍 Lý do cốt lõi nằm ở câu: *đây là công cụ vận hành, không phải một trang trong
app của người dân*. Nếu dùng chung khung, nhân viên thẩm định hồ sơ sẽ thấy navbar
bán hàng và footer giới thiệu — ba thứ không liên quan tới việc đang làm. Đây là
bài học về **ranh giới sản phẩm**: cùng một codebase, cùng một React Router, nhưng
hai sản phẩm khác nhau thì nên có hai khung khác nhau. Cái sai thường gặp là gom
hết vào một `Layout` rồi thêm props `hideFooter`, `compactNav` — mỗi lần thêm một
trang lại thêm một cờ.

## 2.2 Sidebar tự cuộn, nút Đăng xuất đứng yên

```tsx
<aside className="flex w-58 shrink-0 flex-col border-r border-line-soft bg-white lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]">
  <nav className="... lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-4 lg:py-6">...</nav>
  <button className="... lg:mt-auto">Đăng xuất</button>
</aside>
```

Ba dòng class làm nên hành vi:

- `lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]` — cột đứng yên, cao đúng phần
  còn lại của màn hình (100dvh trừ topbar 56px = 3.5rem).
- `lg:min-h-0 lg:flex-1 lg:overflow-y-auto` trên `<nav>` — phần menu tự cuộn khi
  danh sách dài. `min-h-0` là chi tiết bắt buộc: mặc định flex item không co nhỏ
  hơn nội dung, thiếu nó thì `overflow-y-auto` **không có tác dụng**.
- `lg:mt-auto` trên nút → đẩy xuống đáy. Nút nằm **ngoài** `<nav>` nên không trôi
  theo menu. Comment dòng 121–123 nói thêm: nút màu đỏ vì đây là hành động phá
  phiên làm việc, phải khác hẳn các nút còn lại để không bấm nhầm.

`w-58` = 232px: Tailwind v4 cho phép **số tùy ý** theo thang 0.25rem, nên `w-58`
hợp lệ (không phải class tự chế như ở Tailwind v3).

## 2.3 ⚠️ Lỗi bố cục trên mobile: sidebar luôn chiếm 232px

```tsx
<aside className="flex w-58 shrink-0 flex-col border-r ... lg:sticky lg:top-14 ...">
  <nav className={`${open ? "block" : "hidden"} lg:block ...`}>
```

`<aside>` **không có** `hidden lg:flex` — nó luôn là một cột 232px. Còn `<nav>`
mới là thứ bị `hidden`. Kết quả trên màn 375px:

```
┌───────────────────────────────────────────────┐
│ topbar: [☰] logo [ADMIN]              [avatar]│
├────────────────┬──────────────────────────────┤
│                │                              │
│  (menu trống)  │  nội dung bị bóp còn ~143px  │
│  ← 232px       │                              │
│                │                              │
│ [Đăng xuất]    │                              │
└────────────────┴──────────────────────────────┘
```

Bấm `☰` thì menu hiện **bên trong cột 232px đó**, không phải dạng trượt phủ lên
nội dung. Ý định ban đầu (nút hamburger + nav ẩn) chỉ đúng nếu `<aside>` cũng được
ẩn dưới `lg`. Sửa một chỗ:

```tsx
<aside className="hidden w-58 shrink-0 flex-col border-r ... lg:flex lg:sticky ...">
```

Hệ quả của việc này với `Portal.tsx` là bài học đối chiếu: ở đó dùng đúng
`hidden ... lg:block` cho `<aside>`. Hai file cùng viết một việc, một file quên
đúng một class.

## 2.4 Menu tài khoản: bấm ra ngoài thì đóng

```tsx
const ref = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (!open) return
  const onDocClick = (e: MouseEvent) => {
    if (!ref.current?.contains(e.target as Node)) setOpen(false)
  }
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
  document.addEventListener("mousedown", onDocClick)
  document.addEventListener("keydown", onKey)
  return () => {
    document.removeEventListener("mousedown", onDocClick)
    document.removeEventListener("keydown", onKey)
  }
}, [open])
```

Bốn điểm cần đọc được:

1. **`useRef` giữ tham chiếu DOM thật** của menu. `ref.current.contains(e.target)`
   trả lời câu hỏi "cú bấm này có nằm trong menu không".
2. **`mousedown` chứ không `click`**: `click` chỉ bắn khi nhấn *và* thả trên cùng
   phần tử; bấm giữ rồi kéo ra ngoài sẽ không đóng menu. `mousedown` bắn ngay khi
   nhấn xuống — phản hồi sớm hơn và không bỏ sót.
3. **`if (!open) return`** — chưa mở thì không gắn listener. Listener gắn vào
   `document` là toàn cục; gắn vô điều kiện thì mọi cú bấm trong app đều chạy qua
   hàm này.
4. **Hàm `return` của `useEffect` dọn listener.** Đây là chỗ hay quên nhất và là
   nguồn rò rỉ bộ nhớ kinh điển: mỗi lần `open` đổi, effect cũ phải được gỡ trước
   khi effect mới gắn. `[open]` là mảng phụ thuộc — effect chạy lại mỗi khi `open`
   đổi.

⚠️ Hạn chế còn lại: `role="menu"` nhưng **không** có `role="menuitem"` con, không
di chuyển focus bằng mũi tên, không bẫy focus. Chuẩn ARIA cho menu đầy đủ đòi
khoảng 40 dòng nữa. Với menu 2 mục thì thực dụng chấp nhận: Tab vẫn tới được từng
mục vì chúng là `<Link>`/`<button>` thật.

## 2.5 `initialsOf` — hai chữ cái từ tên tiếng Việt

```tsx
name.split(" ").slice(-2).map((p) => p[0]).join("").toUpperCase()
```

`"Nguyễn Văn Đức"` → `["Nguyễn","Văn","Đức"]` → lấy 2 phần cuối → `"VĐ"`.
Lấy **hai phần cuối** chứ không hai phần đầu là quy ước phương Tây/Á Đông khác
nhau: tên gọi nằm cuối trong tiếng Việt, nên "VĐ" nhận ra người nhanh hơn "NV".
Avatar chỉ có 1–2 chữ cái nên đây là loại chi tiết nhỏ mà đúng/sai đều thấy ngay.

---

# 3. `admin/ui.tsx` — bộ UI thứ hai, tên trùng, kiểu khác

Đây là file gây bối rối nhất khi đọc repo lần đầu: nó export `PageHead`, `Stat`,
`Table`, `Td`, `Status`, `Field`, `Empty` — **y hệt tên** trong
`components/Portal.tsx`. Cùng tên, khác nội dung, khác kiểu dáng.

Comment đầu file giải thích và có cả bảng so sánh:

| | khu vực người dân | console quản trị |
| --- | --- | --- |
| tiêu đề | `.display` xanh 28px | chữ ink 20px, xanh chỉ ở eyebrow |
| bảng | trong khung bo tròn có viền | không khung, gọn, số tabular |
| nút | pill bo tròn | bo góc vừa, đều chiều cao |
| nhãn | 13px đậm | 11px uppercase xám |
| badge | pill tròn | bo góc nhẹ |

Vì sao cố tình trùng tên:

> đổi cái import trong từng trang là xong, không phải sửa lại JSX của cả 11 trang.

Đây là đánh đổi thật và **đáng sợ một cách hợp lý**: ở tầng JSX, `<Table>` ở hai
khu là một khái niệm. Cái khác là *mật độ thông tin* — console hiển thị 100 dòng
một màn cho người làm việc 8 tiếng, khu người dân hiển thị 3 dòng cho người ghé
5 phút. Hai mật độ thì phải hai bộ component.

⚠️ **Chế độ hỏng im lặng của cách này:** import sai file vẫn **biên dịch được**,
vẫn chạy, chỉ là giao diện hơi lệch (bảng có viền thay vì không, tiêu đề to hơn).
Không có lỗi TypeScript nào bắt được. Cách phòng: đặt tên khác nhau (`ConsoleTable`)
hoặc đường import luôn chỉ đúng một file trong khu đó. Hiện tại toàn bộ trang
`admin/*` import từ `@/components/admin/ui`, và toàn bộ trang còn lại từ
`@/components/Portal` — nhất quán, nên rủi ro chỉ còn ở người viết mới.

## 3.1 `ColumnChart` — biểu đồ cột bằng CSS

```tsx
export function ColumnChart({ data, format = (n) => fmtNum(n), height = 168 }) {
  const peak = Math.max(...data.map((d) => d.value))
  ...
  <span className="w-full rounded-t-md bg-brand"
        style={{ height: `${Math.max((d.value / peak) * 100, 1.5)}%` }} />
```

Ba quyết định:

1. **CSS chứ không SVG.** Cột là hình chữ nhật; cho cột một `height` phần trăm
   trong khung flex, trình duyệt lo hết phần tính toán. SVG sẽ phải tự tính toạ độ
   từng cột — nhiều code hơn cho cùng kết quả.
2. **`Math.max(..., 1.5)`** — cột nhỏ nhất vẫn cao 1,5%. Không có nó, tháng có
   giá trị quá nhỏ so với đỉnh (hoặc bằng 0) sẽ thành một vạch vô hình, và người
   xem tưởng tháng đó thiếu dữ liệu.
3. **`format` mặc định gọi `fmtNum`** — hàm được khai báo ở **cuối file** (dòng
   245). Điều này chạy được vì giá trị mặc định của tham số chỉ được tính **khi
   hàm được gọi**, không phải khi file được nạp. Nếu nó bị gọi lúc module đang
   chạy thì `fmtNum` chưa tồn tại (`const` có vùng "temporal dead zone") và sẽ ném
   lỗi. Chạy được, nhưng đọc thì nên biết đây là chỗ dựa vào một luật ngầm.

⚠️ `Math.max(...data.map(...))` với `data` rỗng → `-Infinity`, rồi `d.value / peak`
thành `NaN`; và `Math.max(...)` với mảng rất lớn có thể tràn ngăn xếp (hàng trăm
nghìn phần tử). Với 6 tháng dữ liệu thì không vấn đề gì.

## 3.2 Số âm trong bảng cần `tabular-nums` + dấu

Trong `ui.tsx` không có gì đặc biệt về dấu âm, nhưng đây là chỗ để nói một lần:
bảng của console hiện rất nhiều số, `tabular-nums` là bắt buộc, còn dấu âm phải
thêm bằng tay (`-` trong JSX hoặc `Intl` với `signDisplay`) vì `toLocaleString`
không thêm dấu `+`. Tài liệu 11 (CSS) sẽ nói kỹ về `tabular-nums`.

---

# 4. `admin/Assistant.tsx` — trợ lý hỏi đáp trên số liệu thật

Nằm trong `AdminShell` nên có mặt ở **mọi** trang staff/admin. Bấm vào 🟢 ở góc
phải dưới.

## 4.1 Bộ luật khớp từ khoá, không phải AI

```tsx
type Rule = { keys: string[]; answer: () => Omit<Msg, "id" | "from"> }

const REPLY: Rule[] = [
  { keys: ["chờ", "hàng đợi", "tồn đọng", "còn việc"], answer: () => ({
      text: `Đang có ${AI_CASES.filter((c) => !c.inDataset).length} ảnh AI chờ gán nhãn, ...`,
      link: { to: "/staff/ai-review", label: "Mở hàng đợi" },
  })},
  ...
]

function reply(text: string) {
  const q = text.toLowerCase()
  return REPLY.find((r) => r.keys.some((k) => q.includes(k)))?.answer() ?? {
    text: "Mình chỉ tra được số liệu đang mở trên console...",
  }
}
```

Luồng trả lời:

```
   câu hỏi người dùng
          │  .toLowerCase()
          ▼
   ┌──────────────────────────────────────────────┐
   │ REPLY[0].keys.some(k => q.includes(k)) ?      │──có──▶ gọi answer()
   │ REPLY[1].keys...                              │        (tính số từ data)
   │ REPLY[2].keys...                              │
   │ ...                                           │
   └──────────────┬───────────────────────────────┘
                  │ không luật nào khớp
                  ▼
         "Mình chỉ tra được số liệu đang mở trên console..."
```

Ba điểm thiết kế đáng học:

1. **`answer` là hàm, không phải chuỗi.** Nếu viết `text: "Đang có 3 ảnh..."` thì
   con số đóng băng ở lúc viết code. Là hàm, nó đọc `AI_CASES.filter(...).length`
   **mỗi lần hỏi** — luôn khớp với trang chi tiết. Comment dòng 13–15 nói rõ điều
   này: "không bao giờ lệch với trang đếm chi tiết".
2. **Câu trả lời không biết thì nói không biết.** Fallback nói thẳng phạm vi:
   "chỉ tra được số liệu đang mở trên console". Đây là chuẩn mực quan trọng nhất
   của một trợ lý: **thà nói không biết còn hơn bịa số**. So với việc để model sinh
   câu trả lời, hệ luật này không bao giờ bịa được vì mọi số đều đến từ biến.
3. **`.find()` dừng ở luật đầu tiên khớp → thứ tự mảng là thứ tự ưu tiên.** Đây là
   chi tiết cần biết khi thêm luật: câu "còn bao nhiêu khiếu nại chờ?" khớp cả
   luật 1 (`"chờ"`) và luật 5 (`"khiếu nại"`), và luật 1 thắng vì đứng trước.
   Không sai (luật 1 cũng đúng thông tin), nhưng người viết phải biết mình đang
   chọn ưu tiên theo **vị trí trong mảng**, không theo độ cụ thể của từ khoá.

## 4.2 Tự cuộn xuống cuối — chỗ này có, `Chat.tsx` không có

```tsx
const end = useRef<HTMLDivElement>(null)

useEffect(() => {
  end.current?.scrollIntoView({ block: "end" })
}, [msgs, open])

...
<div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
  {msgs.map(...)}
  <div ref={end} />
</div>
```

Kỹ thuật: đặt một `<div>` rỗng ở cuối danh sách, giữ tham chiếu tới nó, mỗi khi
`msgs` hoặc `open` đổi thì cuộn nó vào tầm nhìn. **Không** cần đo `scrollHeight`,
không cần tính `scrollTop`.

🔍 Đáng chú ý: tài liệu 06c đã ghi `Chat.tsx` thiếu đúng cơ chế này. Nghĩa là trong
**cùng một repo**, cách làm đúng đã tồn tại — ở file cách đó một thư mục. Đây là
bài học thực tế về review code: lỗi thường không phải "không ai biết làm", mà là
"người viết file thứ hai không biết file thứ nhất đã có".

## 4.3 Gửi hai tin trong một lần `setMsgs`

```tsx
setMsgs((ms) => [
  ...ms,
  { id: ms.length + 1, from: "me", text: t },
  { id: ms.length + 2, from: "ai", ...reply(t) },
])
setDraft("")
```

`reply(t)` được gọi **bên trong** hàm cập nhật nên `t` là giá trị vừa chốt. Id tăng
1 và 2 nên không đụng nhau. Với `Chat.tsx` (một tin mỗi lần, có xoá) thì `id` phải
cẩn thận hơn — ở đây không có xoá nên an toàn.

Điểm bắt chước được: **tin của người dùng và tin trả lời vào cùng một `setState`**
→ React render một lần, hai tin xuất hiện cùng lúc. Nếu tách hai `setMsgs` (kiểu
"hiện tin của tôi, rồi sau 500ms hiện tin AI"), phải thêm `setTimeout`, phải dọn
timeout khi unmount, và trạng thái trung gian (chỉ có tin người dùng) trở thành
một case phải xử lý. Bỏ hết.

## 4.4 ⚠️ Lỗi chính tả trong câu trả lời mặc định

```tsx
text: "Mình chỉ tra được số liệu đang mở trên console. Hãi hỏi về việc chờ, ..."
```

`Hãi` → `Hãy`. Chữ này hiện thẳng cho người dùng mỗi lần hỏi ngoài phạm vi — và vì
fallback là câu **hay gặp nhất** (người ta luôn thử vài câu lạ trước), đây là lỗi
đáng sửa nhất trong file. Đây là lỗi thứ hai cùng loại trong repo: `"Bãn ra"` ở
`data/cashflow.ts` (tài liệu 05/07).

## 4.5 Nhãn và a11y của nút nổi

```tsx
<button
  aria-expanded={open}
  aria-label={open ? "Đóng trợ lý" : "Mở trợ lý EcoLink"}
  className="grid size-16 place-items-center rounded-full bg-white shadow-... hover:scale-105 active:scale-95"
>
  <img src={AI_AVATAR} alt="" className="size-full scale-110 object-contain" />
</button>
```

- `alt=""` đúng: nút đã có `aria-label`, ảnh chỉ là hình thức. Nếu để `alt="robot"`
  thì trình đọc màn hình đọc "robot, Mở trợ lý EcoLink" — thừa.
- `size-16` (64px) — vùng bấm trên ngưỡng khuyến nghị 44px.
- `scale-110` trên ảnh + comment giải thích: ảnh robot có sẵn khoảng trắng nên nhìn
  nhỏ hơn nút; phóng nhẹ để bù. Loại chi tiết "mắt thấy mới sửa được".

---

# 5. `components/CheckIn.tsx` — và một lỗi thật ở đây

Dùng ở `/rewards` (khu người dân) và `/staff/checkin`. Nhận `balance` +
`onEarn` — không tự giữ điểm (đã nói ở tài liệu 09, mục 10).

## 5.1 Trạng thái và luật

```tsx
const CHECKIN_REWARDS = [20, 30, 50, 70, 100, 150, 500]   // data/checkin.ts
```

```
   Ngày   1    2    3    4    5     6    7
   Điểm  20   30   50   70  100   150  500     ← ngày 7 = 500, hơn nửa chuỗi (920)
   day    0 → 1 →  2 →  3 → 4 →  5 →  6 ─┐
                                        │  (6+1) % 7 = 0
                                        └────▶ quay lại ngày 1
```

```tsx
export type CheckIn = { day: number; last: string }   // day = số ngày liên tiếp, last = yyyy-mm-dd
```

`day` là **số ngày đã điểm danh liên tiếp** (0 = chưa ngày nào), `last` là ngày
gần nhất. Sau ngày 7, `day` quay về 0 nhưng chuỗi **vẫn còn** — nên cần
`streakAlive` để phân biệt "vừa đủ 7 ngày" với "chưa bao giờ điểm danh". Ngày tính
bằng `dayKey()` (giờ địa phương, không dùng `toISOString()` vì nó đổi sang UTC và
lệch ngày với người dùng Việt Nam).

## 5.2 ⚠️ Lỗi: màn hình hứa 150 điểm, bấm nhận được 20

Ba nơi trong component cùng nói về "phần thưởng hôm nay", và **chúng không dùng
cùng một công thức**:

```tsx
// A. Câu chữ + B. nút, cả hai lấy từ nextReward()
const next = nextReward(v, today)
<p>{done ? "Đã điểm danh hôm nay" : `Còn ${fmt(next)} điểm hôm nay`}</p>
<button>{done ? "Đã điểm danh" : `Nhận ${fmt(next)}`}</button>

// data/checkin.ts
export function nextReward(v, today) {
  if (doneToday(v, today)) return 0
  return CHECKIN_REWARDS[(v.day % CHECKIN_DAYS)]   // ← chỉ dựa vào v.day
}

// C. Hàm thật sự cộng điểm
export function checkIn(v, today) {
  const carried = streakAlive(v, today) ? v.day : 0  // ← chuỗi đứt thì về 0
  return { next: {...}, gained: CHECKIN_REWARDS[carried] }
}
```

Kịch bản tái hiện (ví dụ trong tài liệu này dùng `day = 5`):

```
1. Điểm danh 5 ngày liên tiếp → localStorage: { day: 5, last: "2026-09-25" }
2. Bỏ vài ngày, hôm nay là 2026-09-30 mở lại trang
3. Màn hình hiện:  "Còn 150 điểm hôm nay"
   Nút hiện:       "Nhận 150 🪙"
    Ô thứ 6 sáng:  "+150"
4. Bấm nút → nhận 20 điểm.
   Thông báo:      "+20 điểm · số dư 1.020"
```

Sai ở đâu: `nextReward` và ô `isNext` (dòng 86: `!done && i === v.day`) **quên áp
`streakAlive`**, còn `checkIn()` thì nhớ. Hai nơi dùng `v.day` trực tiếp, một nơi
dùng `streakAlive(v) ? v.day : 0`. Ba nơi, hai công thức.

Cách sửa đúng một chỗ, ở `data/checkin.ts`:

```ts
export function nextReward(v: CheckIn, today = dayKey()): number {
  if (doneToday(v, today)) return 0
  const carried = streakAlive(v, today) ? v.day : 0
  return CHECKIN_REWARDS[carried]
}
```

Sửa xong thì cả câu chữ, nút, ô sáng và hàm cộng điểm cùng một nguồn — không cần
đụng vào JSX.

🔍 Bài học tổng quát: khi cùng một con số được tính ở nhiều nơi, **sớm muộn sẽ lệch**.
Cách phòng là để đúng một hàm chịu trách nhiệm (`nextReward`) và mọi chỗ khác gọi
nó — chính là điều `CheckIn` đang làm với `next`; vấn đề chỉ nằm ở ruột hàm đó.
Trong repo có **bốn** nơi cùng nói về phần thưởng hôm nay, nên đây là lỗi có thể
xuất hiện lại: bất cứ ai viết `CHECKIN_REWARDS[...]` ở chỗ thứ năm đều phải nhớ
`streakAlive`.

## 5.3 `flash` không bao giờ được xoá

```tsx
const [flash, setFlash] = useState(0)
...
setFlash(r.gained)
...
{flash > 0 ? (
  <span>+{fmt(flash)} điểm · số dư {fmt(balance)}</span>
) : done ? (
  `Chuỗi ${v.day}/7 ngày${streakAlive(v, today) ? "" : " · chuỗi đã đứt"}`
) : (
  "Bỏ một ngày là chuỗi tính lại từ đầu."
)}
```

Vì `flash > 0` luôn thắng, sau lần bấm đầu tiên trong phiên, **dòng "Chuỗi 5/7
ngày · chuỗi đã đứt" không bao giờ hiện nữa** dù đó mới là thông tin hữu ích. Đây
là lý do lỗi ở 5.2 khó thấy: thông báo thay thế đúng chỗ cần đọc.

Cách sửa: xoá `flash` sau ~3 giây, hoặc ghép hai thông tin thay vì loại trừ nhau
(`+20 điểm · chuỗi 1/7 ngày`).

---

# 6. `components/Leaderboard.tsx` — bục hạng

## 6.1 Bục phải đảo thứ tự hiển thị

```tsx
const [first, second, third] = LEADERBOARD
const rest = LEADERBOARD.slice(3)
...
<ol className="mt-6 grid grid-cols-3 items-end gap-2 sm:gap-4">
  <PodiumCard rank={2} person={second} />   {/* trái  = hạng 2 */}
  <PodiumCard rank={1} person={first} />    {/* giữa  = hạng 1 */}
  <PodiumCard rank={3} person={third} />    {/* phải  = hạng 3 */}
</ol>
```

```tsx
const rise = top ? "-translate-y-8 pb-8 sm:-translate-y-10 sm:pb-12"
          : rank === 2 ? "-translate-y-2" : ""
```

🔍 Comment dòng 25–27 ghi rõ vì sao dùng `translate` chứ không `margin`:

> items-end cho đáy 3 thẻ thẳng nhau; translate nâng thẻ lên — dùng translate chứ
> không margin vì margin trong grid đáy sẽ dịch cả hẳn, hai bậc dưới bị bằng nhau.

Nói dễ hiểu: `items-end` neo **đáy** ba thẻ thẳng hàng. Thêm `padding-bottom` cho
thẻ hạng 1 làm chữ trong thẻ nó cao lên nhưng đáy vẫn thẳng. Nếu thay bằng
`margin-bottom`, thẻ hạng 1 bị **đẩy lên khỏi hàng**, và muốn hai bậc dưới lệch
nhau thì phải thêm margin cho từng thẻ. `translate` + `padding` là cách ngắn hơn và
không phá căn hàng.

Hạng nhất cũng được tô `bg-brand text-white` — vẫn một hệ xanh, không dùng vàng/bạc
(comment dòng 5–7). Đây là quyết định nhất quán với `Status`.

## 6.2 Dòng "cần bao nhiêu để vượt" — off-by-one làm đúng

```tsx
{rest.map((r, i) => {
  const rank = i + 4
  const above = LEADERBOARD[i + 2]?.points
```

`rest[0]` là người ở **index 3** trong `LEADERBOARD` (hạng 4, vì 3 người đầu lên
bục). Người ngay trên họ là index 2 → `i + 2` khi `i = 0` cho `LEADERBOARD[2]` ✅.
Với `i = 1` (hạng 5, index 4) → `LEADERBOARD[3]` ✅. Công thức `i + 2` là chỗ dễ
viết sai nhất của cả file, và ở đây đúng. `?.points` phòng trường hợp không có ai
trên (dòng cuối cùng thì luôn có, nhưng dữ liệu có thể vơi đi).

⚠️ Hạn chế tiềm ẩn: `const [first, second, third] = LEADERBOARD`. Nếu bảng dữ liệu
có dưới 3 người, `person` là `undefined` và `PodiumCard` sẽ ném lỗi ở
`person.name`. Hiện `LEADERBOARD` có đủ; đây là loại phụ thuộc dữ liệu cần biết
(giống `INCOMING.find(...)!` đã ghi ở tài liệu 07/08).

---

# 7. Bảng phát hiện của cụm khung

| # | Vấn đề | File | Mức |
| --- | --- | --- | --- |
| 1 | Sidebar luôn chiếm 232px trên mobile (thiếu `hidden lg:flex`); nút ☰ chỉ mở menu *trong* cột đó | `admin/Shell.tsx` | cao |
| 2 | `nextReward` bỏ qua `streakAlive` → màn hình hứa 150, nhận 20 | `data/checkin.ts` + `components/CheckIn.tsx` | cao |
| 3 | Chính tả "Hãi hỏi" trong câu trả lời mặc định của trợ lý | `admin/Assistant.tsx` | thấp |
| 4 | `flash` giữ mãi, che dòng thông tin chuỗi ngày | `components/CheckIn.tsx` | thấp |
| 5 | Hai bộ UI trùng tên, import sai vẫn chạy (chỉ lệch kiểu dáng) | `admin/ui.tsx` vs `Portal.tsx` | thấp (rủi ro tương lai) |
| 6 | `AccountMenu`: `role="menu"` nhưng thiếu `menuitem`, không có điều hướng bàn phím | `admin/Shell.tsx` | thấp |
| 7 | `ColumnChart`: `data` rỗng → `peak = -Infinity` → `NaN` | `admin/ui.tsx` | thấp |

Hai lỗi đầu là loại **người dùng thấy được**: (1) nhìn là thấy ngay trên điện
thoại, (2) chỉ thấy khi điểm danh bị đứt chuỗi — mà mất chuỗi là chuyện xảy ra
với hầu hết người dùng thật.

---

## Tự kiểm tra

1. `end={item.to.split("/").length <= 2}` để làm gì? → Chỉ cho mục menu gốc sáng khi URL đúng bằng nó; nếu không, đứng ở trang con thì cả mục "Tổng quan" cũng sáng.
2. Vì sao sidebar console phải có `lg:min-h-0`? → Vì flex item mặc định không co nhỏ hơn nội dung; thiếu nó thì `overflow-y-auto` trên `<nav>` không cuộn được.
3. `if (!open) return` trong `useEffect` của `AccountMenu` để làm gì? → Không gắn listener toàn cục khi menu chưa mở; và hàm `return` dọn listener mỗi khi effect chạy lại.
4. Vì sao `Assistant` để `answer` là hàm? → Để con số được tính lại mỗi lần hỏi, không đóng băng lúc viết code.
5. Ba nơi nào nói về "phần thưởng hôm nay" và chỗ nào sai? → `nextReward` (câu chữ + nút), ô `isNext` trong lưới, và `checkIn()` khi cộng điểm; hai chỗ đầu thiếu `streakAlive`.
6. `above = LEADERBOARD[i + 2]` — vì sao `+2`? → `rest` bắt đầu từ index 3; người ngay trên `rest[i]` là index `i + 2` vì 3 người đầu đã lên bục.

**Tiếp:** `11 · Khu Quản trị` — 13 trang `src/pages/admin/*`.
