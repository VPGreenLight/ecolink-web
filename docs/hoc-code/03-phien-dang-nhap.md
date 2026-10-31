# 03 · Đăng nhập và phân quyền

Hai file nhỏ nhưng là **cửa ngõ của toàn app**:

- `src/lib/session.ts` (112 dòng) — "ai đang đăng nhập", lưu ở `localStorage`
- `src/components/RequireRole.tsx` (21 dòng) — "người này có được vào không"

---

## 1. Bài toán

Cả app có hàng chục chỗ cần biết "ai đang đăng nhập":

```
Navbar          → hiện tên + avatar, hay nút "Đăng nhập"
MobileNav       → ẩn/hiện tab
Portal          → hiện tên trong sidebar
AdminShell      → hiện menu theo vai trò
RequireRole     → quyết định cho vào hay đá ra
Profile page    → hiện tên, email
```

Nếu mỗi nơi tự đọc `localStorage` thì:

- mỗi lần đăng nhập phải **báo cho 6 nơi** biết để vẽ lại → dễ quên;
- 6 nơi đọc 6 kiểu → dữ liệu lệch nhau;
- không ai dọn dẹp listener → rò rỉ bộ nhớ.

Giải pháp của repo: **một nguồn sự thật duy nhất** + cơ chế "ai quan tâm thì
đăng ký nghe". Đó chính là `session.ts`.

---

## 2. `session.ts` — từng phần

### 2.1 Kiểu dữ liệu (dòng 1–19)

```ts
import { useSyncExternalStore } from "react"
```

Hook có sẵn của React 18+ dùng để nối React với **một kho dữ liệu nằm ngoài
React** (ở đây là `localStorage`). Nó đảm bảo: kho đổi → component tự vẽ lại,
không cần Context/Redux.

```ts
export type Role = "user" | "recycler" | "staff" | "admin"
```

Union type: `Role` chỉ được là một trong **đúng 4 chuỗi** này. Truyền
`"khach"` vào là TypeScript báo đỏ ngay. Đây là cách "đóng" danh sách vai trò
để không ai gõ sai chính tả.

```ts
export const ROLE_LABEL: Record<Role, string> = {
  user: "Người dân",
  recycler: "Cơ sở thu mua",
  staff: "Nhân viên",
  admin: "Quản trị viên",
}
```

`Record<Role, string>` = "object có **đủ** 4 khoá là 4 vai trò, giá trị là chuỗi".
Thêm vai trò thứ 5 vào `Role` mà quên thêm nhãn ở đây → TypeScript báo lỗi.
Đó là lợi ích: **trình biên dịch nhắc bạn chỗ cần sửa**.

```ts
export const ROLE_HOME: Record<Role, string> = {
  user: "/user",
  recycler: "/recycler",
  staff: "/staff",
  admin: "/admin",
}
```

Trang chủ của từng vai trò. Dùng ở 2 chỗ: sau khi đăng nhập, và khi `RequireRole`
đá người sai vai trò về đúng nhà của họ.

### 2.2 Kho dữ liệu (dòng 21–26)

```ts
const KEY = "ecolink:user"
```
Tên khoá trong `localStorage`. Có tiền tố `ecolink:` để không đụng app khác chạy
cùng domain (localhost:5173 hay bị dùng chung cho nhiều dự án).

```ts
const listeners = new Set<() => void>()
```
Danh sách hàm "khi có thay đổi thì gọi tôi". `Set` thay vì mảng để **không đăng
ký trùng** — cùng một component mount 2 lần cũng chỉ có 1 entry.

```ts
const emit = () => listeners.forEach((l) => l())
```
Gọi tất cả người đăng ký. Tên `emit` = "phát tín hiệu".

```ts
export type Session = { name: string; role: Role }
```
Phiên đăng nhập chỉ có 2 thứ: tên hiển thị và vai trò. **Không có mật khẩu,
không có token** — vì không có backend để xác thực.

### 2.3 Cái bẫy object — đọc kỹ nhất (dòng 28–40)

```ts
let cached: Session | null = null
let primed = false
```

Đây là 2 biến **nằm ngoài mọi component**, tồn tại suốt vòng đời trang. Chúng
tồn tại chỉ để giải một bài toán rất cụ thể:

> `useSyncExternalStore` so sánh kết quả `getSnapshot()` bằng `Object.is`.
>
> - Trả về **chuỗi** `"An"` → `Object.is("An", "An")` = `true` → "không đổi".
> - Trả về **object mới** `{ name: "An" }` mỗi lần gọi → `Object.is({}, {})` = `false`
>   → React tưởng vừa có thay đổi → render lại → gọi `getSnapshot` → object mới
>   → lại thấy đổi → render lại → … → **"Maximum update depth exceeded"** → trang trắng.

Comment trong file ghi rõ đây **đã từng là bug thật**: trước kia `session.ts`
trả về chuỗi nên không sao; đổi sang object mà quên cache thì **mọi trang khi đã
đăng nhập đều trắng**, vì Navbar gọi `useSession()` ở khắp nơi.

Cách chữa: **chỉ đọc `localStorage` một lần**, giữ object đó trong `cached`,
mọi lần gọi sau trả về **đúng cùng một tham chiếu**.

```
getSnapshot() lần 1  → đọc localStorage → tạo object A → cached = A → trả A
getSnapshot() lần 2  → primed = true    → trả A          (cùng tham chiếu ✅)
getSnapshot() lần 3  → trả A                             (cùng tham chiếu ✅)
```

`primed` = "đã nạp lần đầu chưa". Không có nó thì không phân biệt được
"chưa nạp" với "đã nạp và kết quả là null".

### 2.4 Đọc phiên (dòng 42–57)

```ts
function readSession(): Session | null {
  if (typeof localStorage === "undefined") return null
```

`localStorage` không tồn tại trên Node. Lúc chạy `npm run check`, code được render
trên server → phải guard. Nếu không, cả script test crash ngay dòng đầu.

🔍 Tại sao guard ở **đây** mà không ở nhánh server: để `getSnapshot` và
`getServerSnapshot` đọc **cùng một nguồn**. Nếu hai nhánh trả hai giá trị khác
nhau, React báo lỗi lệch hydration, và mọi route có `RequireRole` render sai ở
lần đầu.

```ts
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
```
Chưa đăng nhập → không có gì → trả `null`.

```ts
    const v = JSON.parse(raw)
```
`localStorage` chỉ lưu **chuỗi**. Nên phải `JSON.stringify` khi ghi và
`JSON.parse` khi đọc. `JSON.parse` ném lỗi nếu chuỗi hỏng → cần `try`.

```ts
    if (typeof v?.name !== "string") return null
```
Kiểm tra hình dạng dữ liệu. `v?.name` vì `JSON.parse("null")` trả `null`, truy
cập `.name` trên null sẽ crash. Đây là **validate ở ranh giới tin cậy**: dữ liệu
trong `localStorage` do người dùng sửa được bằng DevTools, không được tin.

```ts
    return { name: v.name, role: ROLE_LABEL[v.role as Role] ? (v.role as Role) : "user" }
```
Dòng dài nhất file, tách ra:

| Phần | Nghĩa |
| --- | --- |
| `ROLE_LABEL[v.role as Role]` | tra nhãn; nếu `v.role` không phải vai trò hợp lệ thì `undefined` |
| `? (v.role as Role)` | hợp lệ → dùng đúng vai trò đó |
| `: "user"` | không hợp lệ → hạ xuống quyền thấp nhất |
| `as Role` | ép kiểu, vì TypeScript không biết `v.role` là gì (nó là `any`) |

Đây là **fail-safe**: ai sửa `localStorage` thành `role: "superadmin"` cũng chỉ
thành `user`, không leo thang được.

```ts
  } catch {
    return null
  }
```
`catch` không có tham số (ES2019) — không cần biết lỗi gì, hỏng thì coi như
chưa đăng nhập.

### 2.5 Xoá đệm (dòng 59–63)

```ts
function invalidate() {
  cached = null
  primed = false
}
```

"Quên đi, lần sau đọc lại từ `localStorage`". Bắt buộc gọi sau mỗi lần ghi/xoá,
nếu không `getSnapshot` vẫn trả object cũ và giao diện không đổi.

### 2.6 `getSession` (dòng 65–71)

```ts
export function getSession(): Session | null {
  if (!primed) {
    cached = readSession()
    primed = true
  }
  return cached
}
```

Đọc kiểu **lazy + memo**: lần đầu mới đọc `localStorage`, các lần sau trả cache.
Đây là hàm được truyền vào `useSyncExternalStore` làm `getSnapshot`, nên nó
**phải** trả cùng một tham chiếu khi dữ liệu không đổi.

Nó cũng được `export` để chỗ khác dùng trực tiếp (ví dụ trong hàm xử lý sự kiện,
nơi không cần hook).

### 2.7 Đăng nhập / đăng xuất (dòng 73–83)

```ts
export function signIn(name: string, role: Role = "user") {
  localStorage.setItem(KEY, JSON.stringify({ name, role }))
  invalidate()
  emit()
}
```

Ba bước, **thứ tự quan trọng**:

```
1. ghi localStorage        ← nguồn sự thật đổi
2. invalidate()            ← xoá cache, lần đọc sau thấy dữ liệu mới
3. emit()                  ← báo React "vẽ lại đi"
```

Nếu đảo 2 và 3: React được báo, gọi `getSnapshot`, nhưng cache cũ vẫn còn →
trả dữ liệu cũ → **không có gì thay đổi** → phải F5 mới thấy.

`role: Role = "user"` = tham số mặc định: gọi `signIn("An")` thì role là `"user"`.
Shorthand `{ name, role }` = `{ name: name, role: role }`.

```ts
export function signOut() {
  localStorage.removeItem(KEY)
  invalidate()
  emit()
}
```
Y hệt, chỉ khác là xoá khoá. Cố tình **không** `localStorage.clear()` — lệnh đó
xoá sạch mọi thứ của mọi app cùng domain.

### 2.8 Cầu nối với React (dòng 85–103)

```ts
function subscribe(onChange: () => void) {
  listeners.add(onChange)
```

React gọi `subscribe` khi component mount, truyền vào hàm `onChange` của nó.
Ta ghi hàm đó vào `Set`.

```ts
  const onStorage = () => {
    invalidate()
    onChange()
  }
  window.addEventListener("storage", onStorage)
```
Sự kiện `storage` của trình duyệt bắn ra ở **tab khác** khi `localStorage` đổi
(tab đang sửa không nhận được sự kiện này). Nhờ vậy mở 2 tab, đăng nhập ở tab A
thì tab B tự cập nhật.

🔍 Comment trong file nhấn mạnh: phải `invalidate()` **trước** `onChange()`.
Nếu báo trước rồi mới xoá cache, React sẽ so sánh với giá trị cũ và "vỡ".

```ts
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onStorage)
  }
}
```
Hàm dọn dẹp. React gọi nó khi component unmount. Không dọn thì `Set` giữ tham
chiếu tới component đã chết → rò rỉ bộ nhớ, và `emit` gọi vào component đã gỡ →
cảnh báo.

```ts
export function useSession() {
  return useSyncExternalStore(subscribe, getSession, getSession)
}
```

Ba tham số:

| Tham số | Khi nào React dùng |
| --- | --- |
| `subscribe` | một lần khi mount, để biết khi nào cần kiểm tra lại |
| `getSession` | mỗi lần cần giá trị hiện tại (client) |
| `getSession` (lặp lại) | lúc render trên server (SSR) |

Truyền cùng một hàm cho cả hai vì ta muốn server và client đọc **cùng logic** —
chính là điều `readSession` đã lo bằng guard `typeof localStorage`.

```ts
export function useUser() {
  return useSession()?.name ?? ""
}
export function useRole(): Role | null {
  return useSession()?.role ?? null
}
```
Hai hook tiện dụng: component chỉ cần tên thì không phải xử lý object.
`?? ""` để kiểu trả về luôn là `string`, không phải `string | undefined` — đỡ
phải kiểm tra null ở nơi dùng.

### 2.9 Toàn cảnh session.ts

```
                    ┌──────────────────────────────┐
   localStorage ───▶│ readSession()  (đọc 1 lần)    │
   "ecolink:user"   └──────────────┬───────────────┘
                                   │ Session | null
                                   ▼
                          ┌─────────────────┐
                          │ cached + primed │  ← bộ đệm tham chiếu
                          └────────┬────────┘
                                   │ getSession()
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        useSession()          useUser()            useRole()
              │
              ▼
    useSyncExternalStore(subscribe, getSession, getSession)
              │
              │  subscribe đăng ký vào listeners
              ▼
    ┌──────────────────────────────────────────┐
    │ signIn() / signOut() / tab khác đổi      │
    │      → invalidate() → emit()             │
    └──────────────────┬───────────────────────┘
                       │ gọi mọi listener
                       ▼
        Navbar, Portal, RequireRole… vẽ lại
```

---

## 3. `RequireRole.tsx` — từng dòng

```tsx
import { Navigate } from "react-router-dom"
import { ROLE_HOME, useSession, type Role } from "@/lib/session"
```

`Navigate` là component "đổi URL ngay khi được vẽ". `type Role` = chỉ import
kiểu, không sinh code lúc chạy (bắt buộc vì `verbatimModuleSyntax: true`).

```tsx
export default function RequireRole({
  roles,
  children,
}: {
  roles: readonly Role[]
  children: React.ReactNode
}) {
```

Nhận 2 props:

- `roles` — danh sách vai trò được vào. `readonly` = không sửa mảng.
- `children` — nội dung cần bảo vệ (là các `<Route>` con).

```tsx
  const session = useSession()
  if (!session) return <Navigate to="/login" replace />
```

Chưa đăng nhập → về `/login`.

`replace` rất quan trọng: nó **thay** entry hiện tại trong history thay vì thêm
entry mới. Không có `replace`, người dùng bấm Back sẽ quay lại đúng trang vừa bị
chặn → lại bị đá về login → **vòng lặp Back không thoát được**.

```tsx
  if (!roles.includes(session.role)) return <Navigate to={ROLE_HOME[session.role]} replace />
```

Đã đăng nhập nhưng sai vai trò → về trang chủ **của vai trò đó**. Ví dụ `staff`
gõ `/admin` → về `/staff`, không phải `/login`. Như vậy không ai bị "đăng xuất"
chỉ vì gõ nhầm URL.

```tsx
  return <>{children}</>
}
```

`<>...</>` = Fragment: trả nhiều phần tử mà không tạo thẻ HTML thừa. Ở đây
`children` thường là một `<Route>` nên Fragment chỉ để thoả quy tắc "một gốc".

### 3.1 Chuyện bảo mật — đọc kỹ

Comment trong file nói thẳng:

> Đây chỉ là chốt chặn phía client… Bảo mật thật phải nằm ở backend.

Vì sao: toàn bộ code chạy trên máy người dùng. Ai mở DevTools cũng sửa được
`localStorage`, thậm chí sửa luôn JavaScript. `RequireRole` chỉ ngăn **người
dùng bình thường** bấm nhầm, không ngăn được kẻ tấn công.

Trong một hệ thống thật, mỗi API phải tự kiểm tra token và quyền. Nếu không,
"phân quyền" chỉ là trang trí — đó chính là điều comment cảnh báo.

⚠️ Đừng vì thế mà bỏ `RequireRole`. Nó vẫn cần cho UX: không ai muốn thấy màn
hình trống rồi bị đá ra sau 2 giây.

---

## 4. Luồng đầy đủ: từ gõ tên đến vào dashboard

```
① Người dùng mở /login, gõ "An", chọn "Quản trị viên", bấm Đăng nhập
        │
        ▼
② Login.tsx gọi signIn("An", "admin")
        │
        ├─ localStorage.setItem("ecolink:user", '{"name":"An","role":"admin"}')
        ├─ invalidate()      → cached = null
        └─ emit()            → gọi mọi listener
        │
        ▼
③ useSyncExternalStore trong Navbar/Portal/RequireRole được báo
        │
        ├─ gọi getSession() → đọc lại localStorage → object mới
        └─ thấy tham chiếu khác → render lại
        │
        ▼
④ Login.tsx gọi navigate(ROLE_HOME["admin"]) → "/admin"
        │
        ▼
⑤ Routes khớp "/admin"
        │
        ▼
⑥ <RequireRole roles={["admin"]}>
        ├─ useSession() → { name:"An", role:"admin" }
        ├─ session != null            ✅
        └─ ["admin"].includes("admin") ✅
        │
        ▼
⑦ <AdminShell role="admin"> → <AdminHome/>
        │
        ▼
⑧ Navbar đổi thành avatar "AN" + menu tài khoản
```

### Còn khi bấm Đăng xuất

```
signOut()
  ├─ localStorage.removeItem("ecolink:user")
  ├─ invalidate()
  ├─ emit()
  └─ navigate("/")
        │
        ▼
RequireRole ở route hiện tại chạy lại → session = null → <Navigate to="/login" replace/>
```

Trong thực tế `Portal` và `AdminShell` gọi `signOut()` rồi `navigate("/")` luôn,
nên hiếm khi thấy cảnh bị đá. Nhưng cơ chế vẫn ở đó làm lưới an toàn.

---

## 5. Vì sao không dùng Context?

React có `useContext` — cách "chuẩn" để chia sẻ state. Vì sao repo chọn
`useSyncExternalStore`?

| | Context | useSyncExternalStore |
| --- | --- | --- |
| Cần bọc `<Provider>` ở gốc | ✅ | ❌ |
| Đọc được **ngoài** component (trong hàm thường) | ❌ | ✅ (`getSession`) |
| Đồng bộ giữa các tab | phải tự viết | có sẵn qua `storage` |
| Số dòng | ~15 | ~40 |
| Dễ hiểu với người mới | ✅ | ❌ |

Repo chọn cách thứ hai vì cần `getSession()` gọi được trong hàm xử lý sự kiện và
trong `check.tsx`. Đánh đổi là `session.ts` khó đọc hơn — bù lại nó là **file
duy nhất** trong toàn dự án phải hiểu cơ chế này.

---

## 6. Tự kiểm tra

1. Vì sao phải có `cached`? → Vì `useSyncExternalStore` so sánh bằng `Object.is`; trả object mới mỗi lần sẽ gây vòng lặp render vô hạn.
2. Vì sao `invalidate()` phải chạy **trước** `emit()`? → Để lần đọc ngay sau khi được báo đã thấy dữ liệu mới, không thấy cache cũ.
3. Sửa `localStorage` thành `role: "admin"` khi đang là user thì sao? → Đúng, bạn vào được `/admin` — nhưng đó chính là lý do comment nói bảo mật thật phải ở backend.
4. Vì sao `<Navigate replace>` chứ không phải `<Navigate>`? → Để nút Back không quay lại trang vừa bị chặn, tránh vòng lặp.
5. Vì sao `readSession` kiểm tra `typeof localStorage === "undefined"`? → Vì `npm run check` render trên Node, nơi không có `localStorage`.

**Tiếp:** `04 · Khung giao diện` (Navbar, MobileNav, Footer, Portal, AdminShell).
