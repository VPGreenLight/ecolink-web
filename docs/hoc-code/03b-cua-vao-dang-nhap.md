# 03b · Cửa vào: đăng nhập, đăng ký, đặt lại mật khẩu

Ba màn hình mà **mọi** người dùng đi qua trước khi thấy app:

| File | Dòng | Việc |
| --- | --- | --- |
| `pages/Login.tsx` | 5 | route `/login` → `<AuthForm mode="login" />` |
| `pages/Register.tsx` | 5 | route `/register` → `<AuthForm mode="register" />` |
| `components/AuthForm.tsx` | 341 | toàn bộ giao diện + logic của cả hai |
| `pages/ResetPassword.tsx` | 189 | `/reset-password` — máy 3 bước, không dùng `AuthForm` |

Hai file 5 dòng đáng đọc vì chúng **nói một điều quan trọng bằng cách rất ngắn**:

```tsx
// pages/Login.tsx
import AuthForm from "@/components/AuthForm"

export default function Login() {
  return <AuthForm mode="login" />
}
```

Vì sao không để luôn trong `AuthForm` rồi tự đoán đang ở `/login` hay `/register`?
Bởi vì **URL là một phần của ứng dụng, `mode` là một phần của component**. Khi URL
là `/login`, người dùng có thể gửi link, đánh dấu trang, bấm Back — trình duyệt xử
lý hết. Nếu `AuthForm` tự đoán theo URL, nó phải import `useLocation`, và hai route
sẽ phụ thuộc vào nhau theo cách khó thấy. Cách ở đây: route quyết định URL, page
truyền một prop, component còn lại chỉ biết `mode`. Ba tầng, mỗi tầng một việc.

```
/login    ──▶ Login.tsx    ──mode="login"────▶ ┌────────────┐
/register ──▶ Register.tsx ──mode="register"─▶ │ AuthForm   │──▶ Layout? KHÔNG
                                               └────────────┘
   Cả hai NẰM NGOÀI `Layout`: không navbar, không footer.
   Đây là hai trang duy nhất trong nhóm công khai không có navbar.
```

🔍 Màn đăng nhập là **trang duy nhất chiếm trọn màn hình** (`min-h-dvh`) trong app.
Có lý do: người dùng chưa ở trong app, không có gì để điều hướng tới. Đưa navbar lên
đây là mời họ rời trang trước khi đăng nhập.

---

# 1. `AuthForm` — cấu trúc và hai bảng dữ liệu

## 1.1 Bảng `DEMO` — tài khoản thử, và một quyết định bảo mật

```tsx
/** Tài khoản dùng thử. Vai trò lấy từ tên đăng nhập, KHÔNG có ô chọn vai trò:
 *  hệ thống thật không ai tự chọn quyền cho mình, vai trò do backend trả về theo
 *  tài khoản. Bảng này chỉ để bản demo vào được cả 4 khu vực để xem. */
const DEMO: Record<string, { role: Role; name: string }> = {
  user:     { role: "user",     name: "Nguyễn Đức" },
  recycler: { role: "recycler", name: "Cô Ba Thu Gom" },
  staff:    { role: "staff",    name: "Lê Thu Hà" },
  admin:    { role: "admin",    name: "Quản trị viên" },
}

const DEMO_PASS = "123"
```

Đây là chi tiết đáng học nhất của file, và nó là **một quyết định đúng về bảo mật
được viết ra bằng lời**:

- **Không có ô "chọn vai trò"** trên form đăng nhập. Nếu có, người dùng tự khai mình
  là admin — đó là lỗi phân quyền kinh điển. Vai trò **suy ra từ tài khoản**, ở đây
  là khoá của bảng `DEMO`.
- Khoá là tên tài khoản thử (`user`, `staff`…), giá trị chứa `role` **và** `name`.
  Tên hiển thị được truyền vào `signIn(name, role)` và lưu cùng phiên (tài liệu 03)
  — nên sau khi đăng nhập, `useUser()` trả về đúng tên người, không phải tên tài
  khoản.
- `Record<string, { role: Role; name: string }>`: với TypeScript, `DEMO[login]` có
  kiểu `{ role, name } | undefined` — và chính kiểu đó buộc đoạn kiểm dưới phải xử
  lý trường hợp `undefined`. **Kiểu dữ liệu đang tự nhắc viết code đúng.**

So với `BANKS` (mảng chuỗi) trong `data/cashflow.ts`, cùng là tra cứu nhưng bảng này
là **object khoá theo giá trị nhập vào** — dạng "tra cứu một phát", không cần
`.find()`. Cả hai dạng đều đúng, chọn theo nhu cầu: cần duyệt/lọc → mảng; cần tra
theo khoá → object.

## 1.2 Bảng `COPY` — chữ của hai chế độ

```tsx
const COPY = {
  login: {
    title: "Đăng nhập",
    body: "Đăng nhập để quản lý lịch thu gom và theo dõi đóng góp xanh của bạn.",
    submit: "Đăng nhập",
    switchText: "Chưa có tài khoản?",
    switchLink: "Đăng ký miễn phí",
    switchTo: "login" as const,
  },
  register: { ... },
} as const

const copy = COPY[mode]
```

Mọi câu chữ khác nhau giữa hai chế độ nằm trong một object, và JSX chỉ đọc
`copy.xxx`. Nghĩa là phần `return` (200 dòng) viết **một lần** cho cả hai màn hình:

```tsx
<h1>{copy.title}</h1>
<p>{copy.body}</p>
<button>{copy.submit}</button>
```

Đây là cách chuẩn để làm "hai biến thể của một màn hình". So sánh với việc
`if (mode === "login") return <LoginUI/>; return <RegisterUI/>` — cách đó nhân đôi
toàn bộ JSX và mọi lần sửa bố cục phải sửa hai chỗ.

`as const` cần cho `switchTo` để kiểu của nó là `"login"` chứ không phải `string`:
`to={\`/${copy.switchTo}\`}` phải là một trong hai giá trị hợp lệ.

## 1.3 `PERKS` — ba việc thật, kèm ghi chú

```tsx
/** Ba việc app thật sự làm, không bịa thêm tính năng */
const PERKS = [
  { title: "Nhận diện bằng AI", body: "Chụp ảnh rác, biết vật liệu và giá tham khảo trong vài giây.", icon: "scan" },
  { title: "Thu gom tận nhà",   body: "Đặt lịch người thu gom gần bạn và theo dõi lộ trình.",        icon: "pin" },
  { title: "Nối chuỗi giá trị", body: "Kết nối trực tiếp với nhà máy tái chế đạt chuẩn.",           icon: "recycle" },
] as const
```

Comment dòng 41 nói lên một nguyên tắc **rất dễ vi phạm ở trang đăng nhập**: không
hứa tính năng chưa có. Ba việc này đều tồn tại trong app (`/scanner`, `/user/handover`
+ `/map`, `/partners`). Một trang đăng nhập có 5 gạch đầu dòng trong đó 2 cái không
tồn tại là **nợ** phải trả bằng niềm tin người dùng.

`icon` là **mã chuỗi**, không phải component. Nghĩa là `PERKS` thuần dữ liệu, và
việc chọn hình nằm ở `PerkIcon` (§4.1). Khi phải truyền "cái để vẽ" vào một mảng dữ
liệu, hãy truyền **mã**, đừng truyền JSX.

---

# 2. `submit` — toàn bộ logic đăng nhập nằm trong 22 dòng

```tsx
const submit = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  const data = new FormData(e.currentTarget)

  if (mode === "login") {
    const login = String(data.get("email") ?? "").trim().toLowerCase()
    const pass = String(data.get("password") ?? "")
    if (!DEMO[login] || pass !== DEMO_PASS) {
      setErr("Email hoặc mật khẩu không đúng. Kiểm tra lại rồi thử.")
      return
    }
    signIn(DEMO[login].name, DEMO[login].role)
    navigate(ROLE_HOME[DEMO[login].role])
    return
  }

  const raw = String(data.get("name") || data.get("email") || "EcoLink")
  const name = raw.includes("@") ? raw.split("@")[0] : raw
  signIn(name, "user")
  navigate(ROLE_HOME.user)
}
```

Năm điều đáng học, đọc theo thứ tự dòng:

**1. `e.preventDefault()` đầu tiên.** Không có nó, trình duyệt gửi form theo cách
cổ điển (tải lại cả trang, URL có `?email=...&password=...`). Đây là dòng bắt buộc
đầu tiên của **mọi** form trong React — và trong repo này có ở mọi form.

**2. `new FormData(e.currentTarget)` — đọc cả form một lần.** `e.currentTarget` là
phần tử `<form>`, `FormData` bóc ra mọi ô có thuộc tính `name`. Đây là cách thay thế
cho việc giữ 3 `useState` cho 3 ô nhập. So sánh:

```
AuthForm (không state cho ô nhập)     các form khác trong repo (có state)
3 ô → 0 useState                      3 ô → 3 useState
đọc một lần lúc submit                đọc từng ký tự lúc gõ
không validate tức thời               validate/tô viền được từng ô
```

Đánh đổi rất rõ: form này **không** cần phản hồi theo từng ký tự (không kiểm email
hợp lệ khi đang gõ, không hiện gợi ý độ mạnh mật khẩu), nên `FormData` là cách gọn
nhất. Đây là lựa chọn đúng phạm vi, không phải "thiếu state".

**3. `.trim().toLowerCase()` cho tài khoản.** Gõ `ADMIN ` hay `Admin` đều vào được.
Mật khẩu **không** bị đổi — `"123 "` khác `"123"`. Quy tắc: làm sạch định danh, tuyệt
đối không sửa mật khẩu (khoảng trắng ở cuối có thể là ký tự người dùng cố ý đặt).

**4. Một câu lỗi cho hai nguyên nhân.**

```tsx
if (!DEMO[login] || pass !== DEMO_PASS) {
  setErr("Email hoặc mật khẩu không đúng. Kiểm tra lại rồi thử.")
```

Không nói "tài khoản không tồn tại" hay "mật khẩu sai". Đây là **quy tắc bảo mật
chuẩn**: thông báo tách biệt giúp kẻ tấn công dò xem email nào có tài khoản (user
enumeration). Với demo thì không quan trọng, nhưng thói quen viết đúng ở đây đáng
giữ; và câu chữ cũng đúng với người dùng thật (họ không cần biết cái nào sai).

**5. Chế độ đăng ký: tên hiển thị suy ra từ email.**

```tsx
const raw = String(data.get("name") || data.get("email") || "EcoLink")
const name = raw.includes("@") ? raw.split("@")[0] : raw
```

Đọc theo thứ tự **ưu tiên**: ô "Họ và tên" nếu có, không thì email, cuối cùng là
`"EcoLink"`. `||` hoạt động vì chuỗi rỗng là giá trị "falsy" trong JS — đây là ví dụ
đầu tiên trong tài liệu dùng tính chất đó (tài liệu 01 nói về falsy).

`raw.split("@")[0]` lấy phần trước `@` (`ban@ecolink.vn` → `ban`). Nghĩa là đăng ký
mà bỏ trống tên vẫn có tên hiển thị dùng được, thay vì hiện chuỗi rỗng ở navbar.
Vai trò đăng ký **luôn** là `"user"` — không có đường tự tạo tài khoản nhân viên.

Nếu form đăng ký bị trình duyệt chặn (`required` trên ô name), `raw` sẽ luôn có giá
trị — nhưng `|| "EcoLink"` vẫn nên giữ: nó là **chốt chặn cuối**, và chỉ tốn 8 ký tự.

## 2.1 `navigate(ROLE_HOME[...])` — sau đăng nhập đi đâu

```ts
// lib/session.ts
export const ROLE_HOME: Record<Role, string> = {
  user: "/user", recycler: "/recycler", staff: "/staff", admin: "/admin",
}
```

Một bảng, bốn vai trò: nơi đến **không** viết trong `AuthForm`. Thêm vai trò thứ năm
= thêm một dòng ở `session.ts`, không sửa màn đăng nhập. Đây là lần thứ hai trong
file gặp nguyên tắc "cấu hình bằng dữ liệu" (`DEMO`, `COPY`, `PERKS`, `ROLE_HOME` —
bốn bảng trong một component, không `if/else` nào cho chúng).

---

# 3. Giao diện — những chi tiết đáng bắt chước

## 3.1 Không dùng `type="email"` ở ô tài khoản

```tsx
<input
  name="email"
  /* đăng nhập nhận cả tên tài khoản dùng thử ("admin") nên không dùng
     type=email: trình duyệt chặn "admin" là hỏng trước khi submit có kịp chạy. */
  type={mode === "login" ? "text" : "email"}
  placeholder={mode === "login" ? "admin" : "ban@ecolink.vn"}
  autoComplete={mode === "login" ? "username" : "email"}
  required
/>
```

Đây là **cái bẫy thật** mà comment ghi lại được: `type="email"` khiến trình duyệt
kiểm định dạng **trước** khi `submit` chạy. Người xem app muốn đăng nhập bằng
`admin` sẽ thấy ô viền đỏ và câu tiếng Anh *"Please include an '@'..."*, và **không
bao giờ tới được code của mình**. Với một dự án demo dùng tên tài khoản thay email,
`type="text"` là bắt buộc.

🔍 Ba thuộc tính `autoComplete` khác nhau theo chế độ: `username` (đăng nhập) vs
`email` (đăng ký) vs `current-password` / `new-password`. Đây là cách nói với **trình
quản lý mật khẩu** đang ở màn nào: cùng một ô, nhưng khi đăng nhập thì "điền tài
khoản đã lưu", khi đăng ký thì "đề xuất mật khẩu mạnh mới". Bỏ `autoComplete` là
làm hỏng luồng của 1Password/Bitwarden.

## 3.2 Nút "Hiện/Ẩn" mật khẩu

```tsx
const [showPassword, setShowPassword] = useState(false)
...
<input type={showPassword ? "text" : "password"} className="input pr-16" />
<button type="button" onClick={() => setShowPassword((v) => !v)}
        className="absolute inset-y-0 right-0 my-auto h-7 ...">
  {showPassword ? "Ẩn" : "Hiện"}
</button>
```

Ba điều đúng và một điều thiếu:

- `type="button"` — **bắt buộc**. Nút nằm trong form, không có `type` thì mặc định là
  `submit`, bấm "Hiện" sẽ gửi form luôn. Đây là lỗi kinh điển của nút phụ trong form.
- `pr-16` trên input: chừa chỗ cho nút, không để chữ chui xuống dưới nút.
- Nút nằm **trong** `<span className="relative">`, không phải trong input — HTML
  không cho phần tử con trong `<input>`, nên phải bọc bằng thẻ ngoài rồi đặt nút
  `absolute`.
- ⚠️ Thiếu `aria-pressed={showPassword}`. Chữ "Hiện/Ẩn" đã nói trạng thái nên vẫn
  dùng được, nhưng `aria-pressed` là cách nói cho trình đọc màn hình rằng đây là nút
  *bật/tắt*, không phải nút hành động.

## 3.3 Nút submit to nhất màn hình

```tsx
<button type="submit"
  className="group mt-1 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-brand
             text-[15px] font-bold text-white shadow-[0_10px_26px_-10px_rgba(15,31,21,0.38)]
             transition-[background-color,box-shadow,transform] duration-200 ease-out
             hover:bg-brand-deep hover:shadow-[0_14px_30px_-10px_rgba(15,31,21,0.42)] active:scale-[0.985]">
  {copy.submit}
  <svg className="group-hover:translate-x-1" ...>→</svg>
</button>
```

- `h-14` (56px) — vùng bấm lớn hơn ngưỡng 44px, đúng cho hành động chính của trang.
- `w-full` — trên điện thoại, nút rộng hết chiều ngang là dễ bấm nhất.
- **`group` + `group-hover:translate-x-1` trên mũi tên**: mũi tên dịch sang phải khi
  hover **cả nút**. `group` là cách Tailwind cho một phần tử con phản ứng với trạng
  thái hover của phần tử cha — nếu không có, phải hover đúng lên mũi tên mới thấy
  hiệu ứng (vô nghĩa vì mũi tên chỉ 16px).
- `active:scale-[0.985]` — phản hồi khi bấm (nút lún nhẹ). Trên điện thoại cảm giác
  này thay cho trạng thái `:hover` không tồn tại.

## 3.4 ⚠️ Thông báo lỗi chỉ hiện ở chế độ đăng nhập

```tsx
{mode === "login" && err && (
  <p role="alert" className="-mt-2 text-[13px] text-warn">{err}</p>
)}
```

`role="alert"` là đúng: trình đọc màn hình đọc ngay khi phần tử xuất hiện. `-mt-2` để
không làm form nhảy bề cao. Nhưng `mode === "login" &&` phản ánh sự thật: `setErr`
chỉ được gọi ở nhánh đăng nhập. Chế độ đăng ký **không có** thông báo lỗi nào —
không kiểm email trùng, không thông báo gì ngoài các kiểm tra HTML5 của trình duyệt
(`required`, `minLength={8}`). Với demo chấp nhận được; khi nối API, chỗ này là nơi
phải hiện "Email này đã có tài khoản".

Hệ quả cần biết: thông báo HTML5 của trình duyệt là **tiếng Anh** và không theo style
app. `BlogEditor`, `Applications`… đã dùng `noValidate` để tránh chuyện đó. Ở đây
`noValidate` **không** có — là lựa chọn có lý (muốn `minLength` chạy miễn phí) nhưng
là chỗ duy nhất trong repo cố ý dùng thông báo của trình duyệt. Hai hướng đều được,
miễn là biết mình đang chọn gì.

---

# 4. Bố cục và hiệu ứng

## 4.1 Panel xanh đổi bên theo chế độ — và một cái bẫy CSS Grid

```tsx
const side  = mode === "register" ? "lg:col-start-1" : "lg:col-start-2"
const other = mode === "register" ? "lg:col-start-2" : "lg:col-start-1"
```

```
/register                                  /login
┌───────────────┬───────────────┐         ┌───────────────┬───────────────┐
│ FORM          │ panel xanh    │         │ panel xanh    │ FORM          │
│ (col-start-1) │ (col-start-2) │         │ (col-start-1) │ (col-start-2) │
└───────────────┴───────────────┘         └───────────────┴───────────────┘
```

Cả hai phần đều có `lg:row-start-1`, và comment `ponytail:` trong code giải thích vì
sao nó **bắt buộc**:

> phải khoá row-start-1. Nếu không, khi main đứng ở col-start-2 thì con trỏ grid dịch
> sang cột 3; item sau muốn col-start-1 (nhỏ hơn con trỏ) sẽ bị đẩy xuống hàng 2 →
> panel xanh rơi xuống dưới form.

Đây là chi tiết đáng nhớ nhất về CSS Grid: **đặt item vào một cột nhỏ hơn con trỏ thì
nó tự nhảy xuống hàng mới**. Triệu chứng nếu thiếu: màn đăng nhập (form ở cột 2, panel
cột 1) bị panel rơi xuống dưới — chỉ ở chế độ login, không ở register. Một lỗi "tuỳ
từng trang" như vậy rất khó đoán nguyên nhân nếu không biết luật grid.

## 4.2 `--auth-from`: truyền dữ liệu từ JSX vào CSS

```tsx
<main style={{ "--auth-from": "-180px" } as CSSProperties}
      className={`auth-enter ... ${side}`}>
...
<aside style={{ "--auth-from": "180px" } as CSSProperties}
       className={`auth-enter ... ${other}`}>
```

```css
/* index.css */
@keyframes auth-in {
  0%   { opacity: 0; transform: translateX(var(--auth-from, 0)); }
  30%  { opacity: 1; }
  100% { opacity: 1; transform: translateX(0); }
}
.auth-enter { animation: auth-in 700ms cubic-bezier(0.4, 0, 0.2, 1) both; }
```

```
   đăng nhập → đăng ký:  form  trượt từ  −180px về 0   (từ trái)
                         panel trượt từ  +180px về 0   (từ phải)
   cùng một keyframes, hai hướng, vì hướng nằm trong biến CSS
```

Vì sao cần `as CSSProperties`? Vì TypeScript chỉ biết các thuộc tính CSS chuẩn trong
`style`; biến `--auth-from` là thuộc tính mở rộng nên phải ép kiểu. Đây là giao diện
duy nhất giữa JSX và `@keyframes`: **JS truyền tham số, CSS giữ luật chuyển động** —
so với việc viết hai animation `auth-in-left`/`auth-in-right` trùng nhau 90%.

Comment trong CSS giải thích vì sao `opacity` đạt 1 ngay ở 30%:

> opacity nhanh hơn translateX để nửa đường đi luôn nhìn thấy rõ, nếu fade chậm như
> slide thì phần lớn thời gian nằm mờ và không thấy trượt.

Đây là loại tinh chỉnh chỉ phát hiện được khi **nhìn** animation chạy, và cách ghi
lại nó (một dòng trong CSS) là để người sau không "sửa cho đối xứng" rồi làm hỏng.

## 4.3 Ảnh nền panel — chỉnh bằng `brightness`, không bằng lớp phủ

```css
/* Giảm sáng riêng ảnh (brightness) thay vì tăng tối lớp phủ: như vậy vẫn thấy lá
   nhưng chữ trắng không bị chói. Ảnh 3:2 ngang đặt vào panel dọc phải cắt,
   object-position 18% để lấy phần lá sắc nét ở trên thay vì vùng bokeh mờ ở giữa. */
```

```tsx
<img src="/assets/auth/leaves.jpg" alt="" aria-hidden="true"
     className="absolute inset-0 size-full object-cover object-[50%_18%] brightness-[0.6] saturate-[1.25]" />
```

Bốn quyết định trong một thẻ:

| Class | Việc | Nếu bỏ |
| --- | --- | --- |
| `absolute inset-0 size-full` | ảnh phủ kín panel | ảnh hiện đúng kích thước gốc, chảy khỏi panel |
| `object-cover` | phủ kín, cắt phần thừa, không méo | tỉ lệ ảnh bị bóp |
| `object-[50%_18%]` | lấy vùng **trên** của ảnh | `object-cover` cắt giữa → lấy đúng vùng mờ nhoè |
| `brightness-[0.6] saturate-[1.25]` | ảnh tối hơn nhưng màu lá đậm hơn | chữ trắng trên lá sáng không đọc được |
| `alt="" aria-hidden="true"` | ảnh trang trí, bỏ khỏi trình đọc màn hình | đọc "leaves.jpg" vô nghĩa |

Đây là **lần thứ ba** gặp quy ước `alt=""` cho ảnh trang trí (tài liệu 06 §, 10 §4.5).
Ba lần, cùng một cách làm — đó là quy ước của repo, không phải chuyện từng chỗ.

⚠️ Con số cuối panel:

```tsx
<p className="relative flex items-baseline gap-3 border-t border-white/15 pt-6">
  <b className="text-3xl font-bold tracking-tight">12.4k</b>
  <span className="text-[13px] text-white/60">tấn phế liệu đã số hoá qua EcoLink</span>
</p>
```

Gõ tay trong JSX, trong khi `STATS` trong `data/ops.ts` là nơi chứa số liệu đó. Cùng
nhóm lỗi "chép số" đã gặp 4 lần (tài liệu 07, 09, 11, 11b).

## 4.4 `PerkIcon` — và bản sao thứ tư của `Field`

```tsx
const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function PerkIcon({ name }: { name: (typeof PERKS)[number]["icon"] }) {
  const box = "size-[18px]"
  if (name === "scan") {
    return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={box}>
      <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8..." {...stroke} />
```

- **`{...stroke}`**: mọi icon dùng chung 4 thuộc tính SVG, viết một lần rồi rải vào
  từng `<path>`. Vì sao cần `as const` ở `strokeLinecap`/`strokeLinejoin`? Vì
  TypeScript hiểu `"round"` trong object là `string`, còn SVG chỉ nhận đúng
  `"round" | "inherit" | ...`. `as const` khoá nó thành giá trị cụ thể. Đây là chỗ
  gặp `as const` lần thứ ba trong file.
- **Kiểu prop từ dữ liệu**: `name: (typeof PERKS)[number]["icon"]` — TypeScript tự
  suy ra `"scan" | "pin" | "recycle"`. Thêm một perk với icon mới mà quên vẽ icon
  mới → không có lỗi biên dịch, nhưng icon mặc định (`recycle`) hiện ra. Nếu muốn
  trình biên dịch bắt, phải khai báo một `Record<IconName, JSX.Element>` — dài hơn.
  Đánh đổi hợp lý: 3 nhánh `if`, nhánh cuối là mặc định.
- **`aria-hidden="true"` trên mọi icon**: chữ ngay cạnh đã mang nghĩa. Đây là lần
  thứ 5 trong repo, cùng quy ước.

```tsx
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
      {label}
      {children}
    </label>
  )
}
```

Đây là **bản sao thứ tư** của cùng một component trong repo:

```
components/Portal.tsx        export function Field  → <label> + hint
components/admin/ui.tsx      export function Field  → <label> + hint (kiểu console)
components/AuthForm.tsx      function Field         → <label>  ← bản này (cục bộ)
pages/ResetPassword.tsx      không dùng Field — viết thẳng
                             <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
```

Bốn nơi, cùng 5 class Tailwind. Hai bản là component có `hint`, một bản cục bộ không
`hint`, một bản viết thẳng trong JSX. **Không sai về kết quả** (mọi form trông giống
nhau — đó là mục tiêu), nhưng là dấu hiệu: quy ước đã tồn tại như component mà vẫn bị
chép tay 2 lần. Cách gọn: `AuthForm` và `ResetPassword` cùng import một `Field` tối
giản từ `Portal` (bản đã có đủ tính năng và `hint` là tuỳ chọn).

---

# 5. `ResetPassword.tsx` — máy ba bước

## 5.1 Trạng thái là một union, không phải hai boolean

```tsx
type Step = "email" | "code" | "done"
const [step, setStep] = useState<Step>("email")
```

```
   email ──(email hợp lệ)──▶ code ──(mã 6 số + mk ≥ 8)──▶ done
```

🔍 Vì sao không dùng `const [sent, setSent] = useState(false)` +
`const [ok, setOk] = useState(false)`? Vì hai boolean cho **4** trạng thái, trong đó
một trạng thái (`sent && ok`) là vô nghĩa. Union `Step` chỉ có 3 trạng thái và trình
biên dịch biết hết. Quy tắc: **số trạng thái đúng bằng số bước, không phải số cờ**.

Tương ứng trong JSX:

```tsx
{step === "email" && (<form>...</form>)}
{step === "code"  && (<form>...</form>)}
{step === "done"  && (<div>...</div>)}
```

Ba khối loại trừ nhau bằng `&&` — chỉ một khối render. Đây là cách viết "router thu
nhỏ" chỉ bằng ba dòng, và nó là biến thể của `if` mà không cần `return` sớm.

## 5.2 Không đưa bước vào URL — có lý do ghi rõ

```tsx
/** Trạng thái 3 bước giữ trong state của trang chứ không đoán lại từ URL:
 *  người dùng bấm lại trình duyệt thì trang quay về bước đầu, và đó mới đúng
 *  vì đặt lại mật khẩu là một thao tác một lần, không phải một nơi để quay lại sau. */
```

Đối chiếu với `Pages/user/Handover` — nơi URL **có** mang trạng thái (route riêng cho
từng bước). Sự khác nhau: đặt lịch thu gom có thể bị bỏ dở và cần quay lại; đặt lại
mật khẩu thì không. **Cùng một câu hỏi kỹ thuật ("state có nên nằm trong URL?") có
hai câu trả lời đúng khác nhau** — và cách chọn là hỏi *"người dùng có cần quay lại
chỗ này không?"*.

## 5.3 Chi tiết nhập mã OTP

```tsx
<input className="input tabular-nums" inputMode="numeric" maxLength={6}
       value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
       placeholder="6 chữ số" />
```

```tsx
if (!/^\d{6}$/.test(code)) { setFlash("Mã xác thực gồm 6 chữ số."); return }
```

- `inputMode="numeric"` — điện thoại hiện bàn phím số (khác `type="number"`, vốn cho
  phép cuộn chuột làm đổi giá trị — không ai muốn điều đó với mã OTP).
- `maxLength={6}` chặn nhập dài.
- **`replace(/\D/g, "")` ngay khi gõ**: bỏ mọi ký tự không phải số. Dán `"12 34 56"`
  từ email → thành `"123456"`. Người dùng không bao giờ gặp lỗi "mã có khoảng trắng".
- `tabular-nums` để 6 chữ số không nhảy bề rộng.
- Kiểm cuối cùng vẫn dùng regex `^\d{6}$` vì `maxLength` có thể bị vượt qua bằng cách
  dán (một số trình duyệt cắt, một số không) — hai lớp bảo vệ cho hai đường vào khác
  nhau.

## 5.4 Thanh tiến trình 3 bước

```tsx
{[["Nhập email", "email"], ["Nhập mã và mật khẩu mới", "code"], ["Hoàn tất", "done"]]
  .map(([label, id], i) => (
    <li key={id}>
      <span className={step === id || done(step, id) ? "bg-brand text-white" : "bg-surface-2 text-muted"}>
        {i + 1}
      </span>
```

Hàm đo "đã đi qua":

```tsx
/** một bước đã đi qua = có id nằm sau `step` trong thứ tự email → code → done */
function done(step: Step, id: string): boolean {
  const order: Step[] = ["email", "code", "done"]
  return order.indexOf(step) > order.indexOf(id as Step)
}
```

Cách làm: lấy **vị trí** của trạng thái hiện tại và của bước đang xét, so sánh. Bước
nào có vị trí nhỏ hơn thì đã qua. Cách này **không** cần cộng trừ chỉ số (`i <= index`),
nên thứ tự ba bước chỉ định nghĩa ở **một chỗ** (`order`) và không bị lệch khi thêm
bước.

⚠️ Hai chi tiết nhỏ: `function done(...)` là khai báo hàm nên được "hoisting" — dùng
được **trước** khi khai báo trong file (dòng 39 gọi, dòng 186 định nghĩa). Chạy được,
nhưng tên `done` trùng ý nghĩa với biến trạng thái `"done"` nên đọc file phải phân
biệt hai thứ cùng tên. `order.indexOf(id as Step)` trả `-1` nếu `id` không có trong
`order` — và `-1` nhỏ hơn mọi vị trí nên mọi bước đều thành "đã qua". Với mảng cứng
thì không xảy ra, nhưng nếu thanh tiến trình được sinh từ dữ liệu khác thì đây là lỗi.

## 5.5 ⚠️ Ba khẳng định không có code đằng sau

```tsx
// ponytail: chưa có dịch vụ gửi email, chuyển thẳng sang bước nháp mã.
// Nối API thì thay dòng này bằng lệnh gửi OTP.
setStep("code")
```

Comment trung thực. Nhưng màn hình thì không:

| Chỗ | Chữ hiện ra | Sự thật |
| --- | --- | --- |
| Nút bước 1 | "Gửi mã xác thực" | không gửi gì |
| Bước 2 | "Mã đã gửi tới **ban@email.vn**" | không có mã nào tồn tại |
| Bước 2 | "Mã có hiệu lực 10 phút" | không có đồng hồ, không có hạn |
| Nút "Gửi lại mã" | "Đã gửi lại mã. Kiểm tra hộp thư trong vài phút nữa." | không gửi lại gì |
| Bước 3 | "Đã đặt lại mật khẩu" | không có mật khẩu nào được ghi |
| Bước 3 | "Nếu có đăng nhập ở thiết bị khác mà không phải bạn, báo ngay..." | hợp lý, giữ nguyên |

Và **không có chỗ nào kiểm mã OTP**: mọi chuỗi 6 chữ số đều đúng. Đây là màn hình
"giả" nhiều nhất trong app, vì quy trình OTP không thể mô phỏng bằng state cục bộ —
nó cần dịch vụ email thật.

So sánh để thấy mức độ: ở `AccountPassword` (tài liệu 11b §9.2), người viết **cũng**
biết giới hạn và ghi comment. Vậy mà cả hai nơi chữ trên màn hình vẫn ở thể khẳng
định "đã xong". Đây là **thói quen của cả dự án**, không phải lỗi của một file: khi
chưa làm được bước backend, hãy để chữ nói "chưa có" — hoặc gắn một nhãn "demo".

## 5.6 ⚠️ `flash` dùng chung cho lỗi và tin thành công

```tsx
{flash && <p className="text-[13px] text-warn">{flash}</p>}
```

`setFlash` được gọi cho cả **lỗi** ("Email chưa đúng định dạng.") và **tin tốt**
("Đã gửi lại mã. Kiểm tra hộp thư trong vài phút nữa."). Tin tốt hiện bằng **màu
cảnh báo đỏ** — cùng lỗi đã gặp ở `staff/Accounts` (tài liệu 09 §6.2). Và thiếu
`role="alert"`/`role="status"` nên trình đọc màn hình không được báo.

Cùng một repo, `AuthForm` làm đúng hơn: tách biến `err` riêng và có `role="alert"`.

## 5.7 ⚠️ `<a href="/login">` thay vì `<Link to="/login">`

```tsx
<a href="/login" className="btn-primary h-11 w-fit px-6">Đi tới đăng nhập</a>
```

Trong app React Router, `<a href>` là **tải lại toàn bộ ứng dụng** — chậm hơn, mất
mọi state trong RAM, và phá vỡ cảm giác một ứng dụng. `<Link>` chỉ đổi URL và render
lại phần cần thiết. Đây là **lần thứ hai** trong repo (`Feedback.tsx` dùng `<a href="/">`
— tài liệu 06b). Một dòng sửa: đổi thẻ, thêm import.

Trong **cùng file này**, nút bước 2 dùng `<button type="button">` (đúng), chỉ nút
cuối đi sai đường. Không phải thiếu hiểu biết về React Router — là quên ở dòng cuối.

---

# 6. Bảng phát hiện của cửa vào

| # | File | Vấn đề | Mức |
| --- | --- | --- | --- |
| 1 | `ResetPassword` | Sáu câu khẳng định về OTP/mật khẩu không có code (không có mã, không gửi email, không kiểm OTP) | cao |
| 2 | `ResetPassword` | `<a href="/login">` → tải lại toàn app; tin thành công hiện màu cảnh báo; thiếu `role="status"` | trung bình |
| 3 | `AuthForm` | `"12.4k"` tấn gõ tay (đáng lẽ đọc từ `STATS`) | trung bình |
| 4 | `AuthForm` | `Field` cục bộ là bản sao thứ tư; `ResetPassword` chép tay cùng 5 class | thấp |
| 5 | `AuthForm` | Nút hiện/ẩn mật khẩu thiếu `aria-pressed` | thấp |
| 6 | `AuthForm`/`Register` | Chế độ đăng ký không có thông báo lỗi nào của app (chỉ dựa vào HTML5 tiếng Anh) | thấp |

**Mặt đúng của khu này cần ghi lại**, vì nó là phần tử tế nhất của repo về mặt bảo mật
và khả năng truy cập:

- Không có ô chọn vai trò; vai trò lấy từ tài khoản.
- Một câu lỗi cho cả hai nguyên nhân sai (không tiết lộ tài khoản có tồn tại).
- `role="alert"` cho lỗi; `aria-label`/`aria-hidden` dùng đúng chỗ.
- `autoComplete` đúng cho từng chế độ (trình quản lý mật khẩu hoạt động).
- `type="button"` trên nút phụ trong form (nút "Hiện", "Gửi lại mã").
- `noValidate` có/không đều là quyết định có lý, không phải quên.
- Comment `ponytail:` ghi đúng việc phải làm khi nối API (gửi OTP, đăng xuất phiên khác).

---

## Tự kiểm tra

1. Vì sao `Login.tsx` chỉ có 5 dòng và không tự xử lý gì? → Route quyết định URL, page chỉ chọn `mode`, `AuthForm` giữ logic; hai chế độ dùng chung một JSX nên sửa một lần.
2. Vì sao ô "Email" ở màn đăng nhập dùng `type="text"` chứ không `type="email"`? → Vì trình duyệt kiểm định dạng trước khi `submit` chạy; tài khoản thử `admin` sẽ bị chặn và không bao giờ tới code của app.
3. Vì sao thông báo lỗi không nói rõ "tài khoản không tồn tại"? → Tránh lộ thông tin tài khoản nào có thật (user enumeration); câu "Email hoặc mật khẩu không đúng" đúng cho cả hai trường hợp.
4. Vì sao cả hai panel trong `AuthForm` cần `lg:row-start-1`? → Grid đẩy item vào cột nhỏ hơn con trỏ xuống hàng mới; thiếu nó thì panel xanh rơi xuống dưới form ở chế độ đăng nhập.
5. `--auth-from` để làm gì? → Truyền hướng trượt (−180px / +180px) từ JSX vào `@keyframes`; một hiệu ứng dùng cho hai chiều.
6. Vì sao `ResetPassword` giữ bước trong state mà không đưa vào URL? → Vì đặt lại mật khẩu là thao tác một lần, không phải nơi người dùng cần quay lại; bấm Back phải về bước đầu.
7. `done(step, id)` so sánh gì? → Vị trí của `step` và `id` trong mảng `order`; bước nào có vị trí nhỏ hơn là đã đi qua.

**Tiếp:** `07b · Tài khoản người dân` — `pages/account/Profile.tsx`, `pages/account/Password.tsx`.
