# 07b · Tài khoản người dân — hồ sơ và đổi mật khẩu

Hai trang dùng chung cho **cả hai vai trò công khai** (`user` và `recycler`), nằm
trong `Portal` nên có navbar và menu trái:

| Route | File | Dòng |
| --- | --- | --- |
| `/account/profile` | `pages/account/Profile.tsx` | 217 |
| `/account/password` | `pages/account/Password.tsx` | 104 |

Chúng có **cặp song sinh bên khu nội bộ** — `admin/AccountProfile.tsx` và
`admin/AccountPassword.tsx` (tài liệu 11b §8, §9). Đây là chủ ý, và mỗi file đều
có comment nói rõ vì sao tách:

```tsx
// admin/AccountProfile.tsx — dòng 9
/** TÁCH khỏi `/account/profile` của người dân, dù đều gọi là "hồ sơ": hai bên
 *  không hỏi cùng thông tin ... */

// admin/AccountPassword.tsx — dòng 7–10
/** Tách khỏi `/account/password` của người dân vì chính sách khác: tài khoản
 *  nội bộ đổi mật khẩu là hành động bảo mật, không phải thao tác tiện lợi —
 *  nên bắt mật khẩu mới dài hơn và phải có chữ số. Người dân đổi vì quên, nhân
 *  viên đổi vì nghi ngờ lộ; hai việc đó không nên dùng chung một ngưỡng. */
```

🔍 Đây là quyết định thiết kế **ngược với thói quen gộp code**. Cùng tên "hồ sơ",
cùng tên "đổi mật khẩu", nhưng hai bên khác nhau ở **chính sách** (8 ký tự vs 12
ký tự + chữ số), ở **dữ liệu hiển thị** (điểm xanh vs mã nhân viên), ở **hệ quả**
(quên mật khẩu vs nghi ngờ lộ). Gộp lại thành một component với 5 `if` theo vai trò
là trộn hai quy trình khác nhau vào một chỗ. Hai file riêng, mỗi file một chính
sách, và **một comment ở mỗi file ghi lại lý do** — người sau không tự hỏi "sao
không gộp cho gọn".

---

# 1. `Profile.tsx` — gộp hai việc, và một mảng cặp

## 1.1 Vì sao hồ sơ và thông báo nằm chung một trang

```tsx
/** SU-01 Xem và cập nhật hồ sơ · SU-03 Thông báo hệ thống.
 *
 *  Gộp vì cùng một nguồn dữ liệu: hồ sơ và danh sách thông báo đều là "việc
 *  của tài khoản này". Tách hai trang thì người dùng phải biết cái nào ở
 *  đâu, mà cả hai đều là việc người dùng làm hằng ngày.
 *
 *  Đổi mật khẩu (SU-02) tách riêng thành `/account/password` vì đó là thao tác
 *  có xác thực, không phải chỉnh sửa hồ sơ. */
```

Ba câu, hai quyết định:

| Việc | Quyết định | Lý do ghi trong comment |
| --- | --- | --- |
| SU-01 + SU-03 | **gộp** | cùng chủ thể ("việc của tài khoản này"), cùng tần suất dùng |
| SU-02 | **tách** | là thao tác có xác thực, không phải chỉnh sửa hồ sơ |

Tiêu chí gộp/tách ở đây **không** phải "số dòng" hay "cùng màn hình", mà là: việc
nào người dùng nghĩ tới cùng lúc thì để cạnh nhau; việc nào cần mật khẩu thì đứng
riêng. Đây là tiêu chí dùng được cho mọi app.

Kết quả trên màn hình:

```
┌──────────────────────────────────────────────────────────────┐
│ Hồ sơ cá nhân                     [Portal: navbar + menu trái]│
├────────────────────────────────┬─────────────────────────────┤
│ FORM hồ sơ                     │ Thẻ "Tài khoản của bạn"     │
│  Tên hiển thị                  │  6 dòng số liệu (dl)        │
│  Số điện thoại                 │  2 ô Stat (hạng, yêu cầu)   │
│  Khu vực                       ├─────────────────────────────┤
│  Email (disabled)              │ THÔNG BÁO                   │
│  [Lưu hồ sơ]                   │  3 thông báo, 1 "Cần xử lý" │
│                                │  [Đánh dấu đã đọc tất cả]   │
└────────────────────────────────┴─────────────────────────────┘
     1.3fr                             1fr
```

## 1.2 `self-start` — một dòng chống khoảng trắng chết

```tsx
{/* self-start: mặc định grid kéo phần tử cao bằng hàng, nên thẻ form
    bị dài bằng cột thông báo và để lại một khoảng trắng lớn dưới nút. */}
<form className="card flex flex-col gap-5 self-start p-5 md:p-6">
```

Luật CSS Grid: trong một grid, mọi ô trong cùng một hàng mặc định **cao bằng
nhau** (`align-items: stretch`). Form có 4 ô nhập, cột phải có thông báo cao hơn →
form bị kéo dài theo, nút "Lưu hồ sơ" nằm giữa thẻ với một khoảng trống bên dưới.

```
   không self-start                 có self-start
   ┌───────────┐ ┌───────────┐      ┌───────────┐ ┌───────────┐
   │ form      │ │ thông báo │      │ form      │ │ thông báo │
   │           │ │           │      └───────────┘ │           │
   │ [Lưu]     │ │           │      (đúng chiều    │           │
   │           │ │           │       cao nội dung) │           │
   │   ↑ trống │ │           │                    │           │
   └───────────┘ └───────────┘                    └───────────┘
```

Cách sửa: `self-start` (căn phần tử theo chiều cao nội dung của chính nó). Đây là
thủ thuật Tailwind đáng nhớ vì triệu chứng ("thẻ cao vô lý, có khoảng trắng dưới
nút") rất khó đoán nếu không biết luật stretch của grid.

## 1.3 Ba ô nhập, và một ô email "tính ra"

```tsx
const [name, setName] = useState(session?.name ?? "")
const [phone, setPhone] = useState("0901 234 567")
const [area, setArea] = useState("Quận 3, TP. Hồ Chí Minh")
```

- `session?.name ?? ""` — hồ sơ khởi tạo **từ phiên đăng nhập**, không tự bịa. Đây
  là lần thứ ba gặp `useSession()` trong một trang (tài liệu 03, 07).
- ⚠️ `phone` và `area` là **giá trị mẫu viết cứng** — mọi người dân và cả cơ sở thu
  mua mở trang này đều thấy cùng số điện thoại `0901 234 567` và `Quận 3`. Cùng
  nhóm lỗi "dữ liệu thật nằm ở đâu?: không ở đâu cả" (tài liệu 07/09 đã gặp).
- ⚠️ `useState(session?.name ?? "")` tính **một lần** lúc trang được mount. Nếu
  phiên đổi sau đó (đăng nhập tài khoản khác), form vẫn giữ tên cũ cho tới khi tải
  lại trang. Với app demo, điều này không lộ ra vì đăng nhập xong là điều hướng
  sang trang khác.

Ô email — đoạn thú vị nhất của form:

```tsx
<Field label="Email">
  <input
    className="input"
    value={session ? `${name.split(" ").slice(-1)[0]?.toLowerCase() ?? "ban"}@email.vn` : "ban@email.vn"}
    readOnly
    disabled
  />
  <span className="text-[12px] font-normal text-muted">
    Email là định danh đăng nhập, không đổi trên trang này.
  </span>
</Field>
```

```ts
"Nguyễn Đức".split(" ")      → ["Nguyễn", "Đức"]
         .slice(-1)          → ["Đức"]        // phần tử cuối, dưới dạng mảng
         [0]                 → "Đức"          // lấy ra phần tử
         .toLowerCase()      → "đức"
         + "@email.vn"       → "đức@email.vn"
```

Ba nhận xét:

1. **`slice(-1)[0]` là cách lấy từ cuối** — `split(" ")` cho mảng các từ, `slice(-1)`
   lấy **mảng chứa 1 phần tử cuối**, `[0]` mở nó ra. Muốn lấy cả họ và tên thì dùng
   luôn `name.toLowerCase().replace(/\s+/g, ".")` — nhưng ở đây họ muốn đúng **tên
   gọi** cuối cùng.
2. ⚠️ `?? "ban"` **không bao giờ chạy**. `??` chỉ đổi sang giá trị phải khi vế trái
   là `null`/`undefined`. Chuỗi rỗng `""` **không** phải hai giá trị đó → xoá hết
   tên rồi gõ dấu cách, email hiện thành `"@email.vn"`. Muốn bắt cả chuỗi rỗng phải
   dùng `||`. (Cùng cặp `??` vs `||` đã học ở tài liệu 09 §1.4.)
3. ⚠️ **`toLowerCase()` không bỏ dấu.** Email này giữ nguyên chữ `đ`/`ứ` →
   `đức@email.vn` không phải email hợp lệ ở đời thật (tên miền thì ASCII, nhưng
   phần trước `@` dùng ký tự có dấu cũng không ai gửi được). Và quan trọng hơn: email
   **tính từ tên hiển thị** nghĩa là sửa tên → email đổi theo, trong khi email là
   **định danh không đổi** (chính câu chữ dưới ô nhập nói vậy).

`readOnly` + `disabled`: `disabled` chặn nhập và xám ô; `readOnly` chặn sửa nhưng
vẫn cho chọn/copy. Dùng cả hai là hơi thừa nhưng vô hại — và cần `disabled` để tránh
trường hợp trình duyệt đưa giá trị này vào `FormData` nếu form được submit theo cách
cổ điển. Đây là **ô duy nhất trong repo mô phỏng "trường hệ thống không cho sửa"**,
đúng khuôn mẫu của `admin/AccountProfile` (email `readOnly`, kèm câu giải thích).

## 1.4 Validate + tô viền — cách đúng, và đã được trích làm chuẩn

```tsx
if (name.trim().length < 2)              → setErr("Tên hiển thị phải có ít nhất 2 ký tự.")
if (!/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, "")))
                                        → setErr("Số điện thoại chưa đúng định dạng Việt Nam.")
...
<input className={`input ${err && name.trim().length < 2 ? "border-warn" : ""}`} />
<input className={`input tabular-nums ${
  err && !/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, "")) ? "border-warn" : ""
}`} />
```

Hai điều đã học ở tài liệu 11b §8.2, nhắc lại ngắn vì đây là bản gốc:

- **Điều kiện tô viền = điều kiện sinh ra lỗi**, không phải `err.startsWith("Tên")`.
  Sửa câu chữ thông báo không làm hỏng giao diện.
- Regex số điện thoại **loại bỏ `\s . - ( )` trước khi kiểm**, nên `0901 234 567`
  hợp lệ. `^(?:\+84|0)` chấp nhận cả `+84` và `0` đầu số — cách gõ của cả hai nhóm
  người dùng Việt Nam.

⚠️ Một điểm chưa chặt: validate dùng `name.trim()`, nhưng khi lưu thì **không gán lại
giá trị đã trim**. Gõ `"  Đức  "` qua được kiểm tra và state vẫn giữ nguyên khoảng
trắng. Ở `StaffAccounts` (tài liệu 11b §6.2) có làm đúng (`name.trim()` khi lưu) —
chi tiết nhỏ, nhưng cùng một repo nên thống nhất.

`{err && <p className="text-[13px] text-warn">{err}</p>}` — thiếu `role="alert"`
(AuthForm có, tài liệu 03b §3.4). Tin thành công thì có `role="status"`:

```tsx
{saved && <p role="status" className="...">Đã lưu hồ sơ.</p>}
```

Và `setSaved(false)` nằm trong `onChange` của từng ô — gõ tiếp là dấu "đã lưu" biến
mất. **Đây là hành vi đúng** đã gặp ở `admin/AccountProfile` và `AccountPassword`;
bản song sinh đúng, đối lập với `components/CheckIn` (flash không bao giờ tự xoá —
tài liệu 10 §5.3).

## 1.5 Thẻ "Tài khoản của bạn" — mảng cặp thay vì 6 khối JSX

```tsx
<dl className="flex flex-col gap-2 text-sm">
  {[
    ["Vai trò", session?.role === "recycler" ? "Cơ sở thu mua"
              : session?.role === "staff"    ? "Nhân viên"
              : session?.role === "admin"    ? "Quản trị viên"
              : "Người dân"],
    ["Điểm tiêu dùng", fmt(SPEND_POINTS)],
    ["Điểm xếp hạng", fmt(RANK_POINTS)],
    ["Hạng cây ảo", tierProgress().cur.name],
    ["Giao dịch đã hoàn tất", String(MY_HANDOVERS.filter((h) => h.status === "done").length)],
    ["Khoản đã nhận", String(FLOWS.filter((f) => f.kind === "payout").length)],
  ].map(([k, v]) => (
    <div key={k} className="flex justify-between gap-3 border-b border-line-soft pb-2">
      <dt className="text-muted">{k}</dt>
      <dd className="font-semibold text-ink">{v}</dd>
    </div>
  ))}
</dl>
```

🔍 **Cách viết "bảng nhãn–giá trị" đáng học**: một mảng các cặp `[nhãn, giá trị]`,
rồi `.map` in ra. So với 6 khối `<div><dt>…</dt><dd>…</dd></div>` chép tay: thêm một
dòng số liệu = thêm **một dòng dữ liệu**, không phải một khối 6 dòng JSX. `key={k}`
ổn vì nhãn không trùng. `<dl>/<dt>/<dd>` là thẻ HTML nghĩa đúng cho "danh sách định
nghĩa" (tên ↔ giá trị) — không phải `<table>`.

Điều **không** ổn nằm trong chính mảng đó:

⚠️ **Nhãn vai trò viết tay bằng 3 tầng `?:`** trong khi `ROLE_LABEL` đã tồn tại:

```ts
// lib/session.ts — đã có sẵn
export const ROLE_LABEL: Record<Role, string> = { user: "Người dân", recycler: "...", staff: "...", admin: "..." }
```

`admin/AccountProfile` dùng đúng một dòng `["Vai trò", ROLE_LABEL[role]]` (tài liệu 11b
§8). Ở đây cùng dữ liệu đó được viết lại thành ba tầng điều kiện lồng nhau — khó đọc,
và thiếu một vai trò là âm thầm rơi về "Người dân". `Record<Role, string>` thì trình
biên dịch **bắt buộc** có đủ 4 vai trò. Cùng một bảng chữ, hai chỗ đọc, một chỗ nên
dùng.

⚠️ **Dữ liệu không theo tài khoản.** `SPEND_POINTS`, `RANK_POINTS`, `MY_HANDOVERS`,
`LEADERBOARD.find(r => r.you)` đều là số của **một người dân cụ thể** trong
`data/rewards.ts` / `data/handover.ts` (hằng số mô phỏng, tài liệu 05). Trang này
nằm trong `PORTAL_NAV` của **cả `user` và `recycler`**:

```ts
// data/portal.ts
const ACCOUNT: PortalItem[] = [
  { to: "/account/profile", label: "Hồ sơ và thông báo" },
  { to: "/account/password", label: "Đổi mật khẩu" },
]
export const PORTAL_NAV: Record<Role, PortalSection[]> = {
  user:     [ ..., { title: "Khác", items: [ ..., ...ACCOUNT ] } ],
  recycler: [ ...,            ...ACCOUNT ],          // ← cùng hai đường dẫn
}
```

Nghĩa là **"Cô Ba Thu Gom" mở `/account/profile` thấy "Điểm xanh 23.400, hạng Rừng,
5 yêu cầu bàn giao, xếp hạng #4"** — toàn bộ số liệu của người dân đối diện. Đây là
cùng một gia đình lỗi với nhãn "Bạn thực nhận" ở khu cơ sở thu mua (tài liệu 08 §6):
**dữ liệu đúng nhưng sai chủ thể**. Bản song sinh nội bộ (`admin/AccountProfile`)
không mắc lỗi này ở phần hồ sơ — nhưng ở đó lại có `Queue` riêng theo vai trò, đúng
bài học: *hiển thị theo vai trò là việc phải làm ở mọi trang dùng chung*.

⚠️ **"Khoản đã nhận" đếm từ bảng toàn cục.** `FLOWS` là `data/cashflow.ts` — sổ dòng
tiền của **cả hệ thống** (dùng ở `/admin/reconciliation`, tài liệu 11 §3). Lọc
`kind === "payout"` rồi đếm ra 3 — nhưng đó là 3 dòng payout **có trong bảng**, không
phải số khoản của người đang đăng nhập. Trùng khớp hôm nay vì cả ba dòng payout đều
ghi `party: "STK 0070 1234 5678 · Nguyễn Đức"`. Cách đúng là lọc theo chủ tài khoản,
hoặc dùng đúng bảng của người dùng. Đây cũng là ví dụ cho quy tắc: **trang người dùng
không bao giờ đọc bảng vận hành toàn cục**.

⚠️ `#${LEADERBOARD.findIndex((r) => r.you) + 1}` — hạng **tính ra** từ mảng (đúng
tinh thần "không lưu cái tính được", tài liệu 05). Nhưng `findIndex` trả `-1` khi
không ai mang cờ `you` → hạng hiện thành `#0`. Dữ liệu hiện tại luôn có đúng một cờ;
rủi ro nằm ở chỗ **cờ `you` nằm trong dữ liệu dùng chung** thay vì suy từ phiên.

## 1.6 `Notifications` — component con, và một cái bẫy ngôn ngữ

```tsx
type Note = { id: string; text: string; time: string; needsAction: boolean }

const NOTES: Note[] = [
  { id: "n1", text: "Cô Ba Thu Gom đã nhận yêu cầu của bạn và chốt khung giờ 10:00 - 12:00.", time: "Hôm nay, 09:34", needsAction: true },
  { id: "n2", text: "Tiền giao dịch BH-2609-0184 đã chuyển về tài khoản của bạn.", time: "Hôm nay, 11:02", needsAction: false },
  { id: "n3", text: "Bạn bỏ lỡ điểm danh hôm qua, chuỗi đã tính lại từ đầu.", time: "Hôm qua, 20:00", needsAction: true },
]
```

`needsAction` là **boolean trong dữ liệu**, không phải suy từ chữ. Nhờ vậy

```tsx
{n.needsAction && !read[n.id] && <Status tone="wait">Cần xử lý</Status>}
```

là một điều kiện đọc được. Nếu không có `needsAction`, code phải đi tìm chuỗi
`"chốt khung giờ"` trong `n.text` để quyết định — đúng loại phụ thuộc-chuỗi đang bị
phê ở §10.3 tài liệu 11b. **Muốn giao diện quyết định theo nghĩa của dữ liệu thì dữ
liệu phải chở nghĩa đó theo.**

Trạng thái đã đọc:

```tsx
const [read, setRead] = useState<Record<string, boolean>>({})
const unread = NOTES.filter((n) => !read[n.id]).length
...
setRead(Object.fromEntries(NOTES.map((n) => [n.id, true])))
```

- `Record<string, boolean>` khởi tạo `{}` — nghĩa là **tất cả chưa đọc**; không cần
  liệt kê 3 id. Trạng thái mặc định rỗng là mặc định tốt.
- `unread` **tính ra** mỗi render từ `read` — không có state `unread` thứ hai để lệch
  nhau. Cùng luật `dirty`/`growth`/`ok` gặp ở các tài liệu 09–11.
- `Object.fromEntries(pairs)` là phép đảo của `Object.entries`: mảng cặp → object.
  Ở đây `["n1", true]…` → `{ n1: true, n2: true, n3: true }`. Một dòng, đúng việc
  "đánh dấu tất cả".
- `disabled={unread === 0}` — nút tự tắt khi không còn gì để đánh dấu, và nhãn đổi
  thành "Đã đọc hết". Trạng thái rỗng được xử lý bằng **chữ**, không để "0 chưa đọc".

⚠️ Hai điểm nhỏ:

1. `n.needsAction && !read[n.id]` — **đọc xong là nhãn "Cần xử lý" biến mất**, dù
   việc chưa làm (n1: chốt khung giờ xong chưa?). Trong sản phẩm thật, "đã đọc" và
   "đã xử lý" là hai trạng thái khác nhau — xem lại `Notifications` khi nối backend.
   Hiện tại nó trung thực với dữ liệu (không có trạng thái xử lý nào để hiển thị).
2. `NOTES.length === 0 ? ...` là nhánh **không bao giờ chạy** vì `NOTES` là hằng có
   3 phần tử — nhưng đúng khuôn mẫu phòng hờ của repo (empty state hiện đúng khi
   dữ liệu đổi). Giữ lại là lựa chọn hợp lý; điều đáng nói là dữ liệu mẫu nên nằm
   ở `src/data/` như mọi màn hình khác (`checkin.ts`, `handover.ts`…), không phải
   trong file page. Màn hình này là **ngoại lệ duy nhất** trong nhóm công khai.

---

# 2. `Password.tsx` — bản người dân của trang đổi mật khẩu

## 2.1 Ngưỡng 8 ký tự, có lý do nằm ở file bên kia

```tsx
if (current.length < 1)  → "Nhập mật khẩu hiện tại."
if (next.length < 8)     → "Mật khẩu mới cần ít nhất 8 ký tự."
if (next !== again)      → "Hai mật khẩu mới không khớp nhau."
if (next === current)    → "Mật khẩu mới phải khác mật khẩu hiện tại."
```

Bốn luật, **thiếu đúng một luật** so với bản nội bộ: không có `/\d/` (bắt buộc có chữ
số). Và ngưỡng là 8 thay vì 12. Lý do không nằm trong file này — nó ở comment của
`admin/AccountPassword.tsx` (đã trích ở đầu tài liệu): *"Người dân đổi vì quên, nhân
viên đổi vì nghi ngờ lộ"*.

🔍 Đây là điểm sư phạm đáng chú ý: **cùng một thao tác, hai mức kiểm, và lý do được
viết ở file của mức chặt hơn**. Người đọc `/account/password` sẽ tự hỏi "sao chỉ 8?"
— câu trả lời nằm ở file khác. Cách tốt hơn: một dòng ngắn ở đây
(`{/* 8 ký tự: người dân đổi vì quên; bản nội bộ chặt hơn — xem admin/AccountPassword */}`).

## 2.2 ⚠️ Chú thích hứa ranh giới tin cậy, code chỉ kiểm độ dài ≥ 1

```tsx
/** Bắt buộc mật khẩu hiện tại đúng mới cho đổi: đây là ranh giới tin cậy —
 *  không có nó thì ai đó ngồi máy đã mở khoá cũng đổi được mật khẩu của bạn,
 *  và bạn mất tài khoản mà không hiểu vì sao. */
...
if (current.length < 1) {
  setErr("Nhập mật khẩu hiện tại.")
  return
}
```

Chữ `"x"` là "mật khẩu hiện tại" hợp lệ. **Cảnh báo của comment là đúng** — mối nguy
nó mô tả (người ngồi máy đã mở khoá) là mối nguy thật của mọi form đổi mật khẩu — và
cách kiểm duy nhất khả thi là gọi backend. Nhưng giống `admin/AccountPassword`
(tài liệu 11b §9.2), chữ trên màn hình lại ở thể khẳng định đã xong:

```tsx
body="Đổi mật khẩu sẽ đăng xuất mọi thiết bị khác đang đăng nhập tài khoản này."
...
setFlash("Đã đổi mật khẩu. Các phiên khác đã đăng xuất.")
```

Không phiên nào bị đăng xuất, không mật khẩu nào được lưu. Comment `ponytail:` ngay
trên dòng `setFlash` ghi đúng việc phải làm khi nối API. **Bốn lời khẳng định cùng
loại trong ba file** (hai trang password + ResetPassword §5.5 tài liệu 03b) — đủ để
gọi đây là một chủ đề của dự án, xem §3.1.

## 2.3 ⚠️ Tô viền bằng `err.startsWith("Nhập")` — và sự lệch giữa hai bản sao

```tsx
<input className={`input ${err.startsWith("Nhập") ? "border-warn" : ""}`} ... />
```

Chỉ một trong ba ô được tô viền, và cách tô phụ thuộc **câu chữ** thông báo. Sửa
`"Nhập mật khẩu hiện tại."` thành `"Cần mật khẩu hiện tại."` là mất viền đỏ ở ô đó,
không có lỗi nào báo. Đây là chỗ **thứ tư** trong repo dùng mẫu này (danh sách đầy
đủ ở tài liệu 11b §10.3), trong khi chính trang hồ sơ bên cạnh (§1.4) làm đúng.

So sánh hai bản song sinh, ba khác biệt nhỏ:

| Chi tiết | `account/Password` (người dân) | `admin/AccountPassword` (nội bộ) |
| --- | --- | --- |
| Tô viền | chỉ ô "hiện tại", bằng `startsWith("Nhập")` | cả 3 ô, bằng `startsWith` (2 nhánh `\|\|`) |
| Xoá `flash` khi gõ | **chỉ** ô "mật khẩu hiện tại" | **cả 3 ô** |
| Ngưỡng | 8 ký tự | 12 ký tự + phải có chữ số |

Dòng thứ hai là lỗi nhỏ nhưng đáng sửa: ở đây, sau khi đổi mật khẩu thành công (dòng
"Đã đổi mật khẩu..." hiện ra), gõ vào ô "Mật khẩu mới" thì dòng đó **vẫn còn** —
người dùng tưởng mật khẩu vừa gõ đã được lưu. Chỉ khi gõ vào ô "hiện tại" nó mới biến
mất. Bản nội bộ đã làm đúng cả ba; đây là chỗ bản người dân sao chép thiếu một dòng
trong hai `onChange`.

Phần còn lại giống hệt bản nội bộ: `noValidate` + thông báo tiếng Việt của app (tự
quản lý lỗi, không để trình duyệt hiện câu tiếng Anh), `autoComplete="current-password"` /
`new-password` (trình quản lý mật khẩu hoạt động), `type="button"` không xuất hiện vì
không có nút phụ, `role="status"` cho tin thành công. Ba ô `setCurrent("")`,
`setNext("")`, `setAgain("")` sau khi đổi xong — **xoá mật khẩu khỏi state**, thói
quen đúng cho trường nhạy cảm.

---

# 3. Hai chủ đề của khu tài khoản

## 3.1 Chữ trên màn hình khẳng định việc backend chưa làm

Bảng đầy đủ ba file, để thấy đây là một chủ đề chứ không phải lỗi lẻ:

| File | Câu khẳng định | Thực tế |
| --- | --- | --- |
| `account/Password` | "Đổi mật khẩu sẽ đăng xuất mọi thiết bị khác" | không có phiên nào để đăng xuất |
| `admin/AccountPassword` | "Đổi xong mọi thiết bị khác đang đăng nhập sẽ mất phiên ngay" | như trên |
| `ResetPassword` (03b) | "Mã đã gửi tới…", "Mã có hiệu lực 10 phút", "Đã đặt lại mật khẩu" | không gửi mail, không có mã, không lưu mật khẩu |
| `admin/StaffAccounts` (11b) | "Không cho nhân viên tự khoá chính mình" | không có kiểm tra |
| `admin/Fees` (11) | preview đổi % nhưng tiền không đổi | công thức đọc hằng số |

Điểm chung: **comment trong code nói đúng sự thật, chữ trên giao diện thì không.**
Cách sửa rẻ và đúng cho giai đoạn demo: thêm nhãn `(demo)` hoặc câu "chưa có hiệu
lực trong bản demo" vào chính chỗ khẳng định. Khi nối backend thì xoá nhãn. Người
dùng cuối không đọc code — họ đọc `PageHead`.

## 3.2 Dữ liệu của ai, cho ai

Khu tài khoản có ba tầng "ai là chủ dữ liệu":

```
   phiên đăng nhập (useSession)      → name, role        ✅ luôn đúng chủ
   data/*.ts (hằng số mô phỏng)      → điểm, giao dịch    ⚠️ là số của Nguyễn Đức
   bảng toàn cục (FLOWS, LEADERBOARD)→ dòng tiền, hạng    ⚠️ đọc không lọc chủ
```

Trang hồ sơ hiện tại trộn cả ba. Bản song sinh nội bộ
(`admin/AccountProfile`) trộn hai tầng đầu nhưng có một điểm đáng học: nó **không**
đọc bảng toàn cục cho phần hồ sơ, và mọi số liệu phụ đều thuộc `Queue` — nơi câu
chữ nói rõ đang đếm đầu việc của vai trò nào.

**Luật rút ra**: số liệu của một người phải lọc từ phiên; đọc bảng toàn cục rồi
"trông như đúng" là lỗi không có triệu chứng — nó chỉ lộ ra khi có người dùng thứ
hai. App demo chưa có người thứ hai, nên lỗi này sẽ tồn tại tới lúc nối API.

---

# 4. Bảng phát hiện

| # | File | Vấn đề | Mức |
| --- | --- | --- | --- |
| 1 | `account/Profile` | Số liệu (điểm, giao dịch, hạng) là của người dân nhưng trang dùng chung cho cả `recycler` | cao |
| 2 | `account/Profile` | "Khoản đã nhận" đếm từ `FLOWS` (bảng toàn cục) không lọc theo chủ tài khoản | trung bình |
| 3 | `account/Password` | Chữ "đăng xuất mọi thiết bị khác" + "đã đổi mật khẩu" không có code (cùng bản nội bộ) | cao |
| 4 | `account/Password` | Xoá `flash` chỉ ở 1/3 ô (bản nội bộ làm đủ 3) | trung bình |
| 5 | `account/Profile` | Vai trò viết tay 3 tầng `?:` dù `ROLE_LABEL` có sẵn; email tính từ tên (`?? "ban"` chết, giữ dấu tiếng Việt) | trung bình |
| 6 | `account/Profile` | `phone`/`area` là dữ liệu mẫu viết cứng cho mọi tài khoản | trung bình |
| 7 | `account/Profile` | `err` thiếu `role="alert"`; tên không được `trim()` khi lưu | thấp |
| 8 | `account/Password` | `err.startsWith("Nhập")` làm khoá logic tô viền | thấp |
| 9 | `account/Profile` | `NOTES` là dữ liệu mẫu nằm trong file page (khác quy ước `src/data/`); "Cần xử lý" biến mất khi chỉ mới *đọc* | thấp |

**So với hai bản song sinh nội bộ:** bản nội bộ làm đúng hơn ở 4 điểm (xoá flash đủ
3 ô, dùng `ROLE_LABEL`, tô viền bằng điều kiện, có `??` fallback cho mọi trường) và
kém hơn ở 1 điểm (giá trị `role` mặc định về `"staff"` khi phiên là `user`). Không
bản nào "tốt" toàn bộ — đúng như đã thấy ở `admin/Categories` (tài liệu 11b §1).

---

## Tự kiểm tra

1. Vì sao "Thông báo" nằm cùng trang hồ sơ mà "Đổi mật khẩu" thì tách riêng? → Vì gộp theo *chủ thể công việc* (việc của tài khoản này), tách theo *yêu cầu xác thực* (đổi mật khẩu là thao tác có xác thực).
2. `self-start` để làm gì? → Grid mặc định kéo mọi ô trong hàng cao bằng nhau; form sẽ dài theo cột thông báo và để khoảng trắng dưới nút. `self-start` cho form cao theo nội dung.
3. Vì sao `?? "ban"` trong đoạn email không chạy như ý muốn? → Vì `??` chỉ đổi khi gặp `null`/`undefined`; chuỗi rỗng `""` lọt qua, email thành `"@email.vn"`. Muốn bắt cả chuỗi rỗng thì dùng `||`.
4. Cách đúng để hiển thị nhãn vai trò là gì, và ở đây làm sai thế nào? → `ROLE_LABEL[role]` (đã có sẵn, `Record<Role, string>` đủ 4 vai trò); ở đây viết tay 3 tầng `?:`.
5. "Cô Ba Thu Gom" mở `/account/profile` thấy những gì đáng lẽ không nên thấy? → Điểm xanh, hạng cây ảo, số giao dịch, thứ hạng — toàn bộ số liệu của người dân Nguyễn Đức.
6. Ba khác biệt giữa `account/Password` và `admin/AccountPassword`? → Ngưỡng (8 vs 12 + chữ số), mức tô viền (1 ô vs 3 ô), và việc xoá `flash` (1 ô vs cả 3 ô).
7. Vì sao `unread` không cần một `useState` riêng? → Vì nó tính ra từ `read` bằng `filter`; lưu riêng là tạo hai nguồn có thể lệch nhau.

**Tiếp:** `12 · Kiểm thử & CSS` — `check.tsx`, `check-routes.tsx`, `index.css`, và cách `npm run check` bắt lỗi trước khi mở trình duyệt.
