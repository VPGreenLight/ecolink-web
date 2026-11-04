# 06b · Feedback & Rewards

Hai trang này dạy hai kỹ năng khác nhau:

- `Feedback.tsx` (458 dòng) — **form có kiểm tra dữ liệu**: state từng ô, validate,
  hiện lỗi, màn hình xác nhận.
- `Rewards.tsx` (403 dòng) — **dữ liệu dẫn xuất**: từ một con số điểm, tính ra
  tiến độ, trạng thái nút, nhãn tồn kho.

---

# PHẦN 1 — `pages/Feedback.tsx`

## 1.1 Bài toán

Người dùng gửi khiếu nại/góp ý. Không có backend, nên "gửi" = kiểm tra dữ liệu
→ sinh mã tiếp nhận → hiện màn hình cảm ơn. Không có gì được lưu.

```
┌─────────────┐   bấm Gửi   ┌──────────────┐   hợp lệ   ┌────────────┐
│  FORM       │ ──────────▶ │  validate()  │ ─────────▶ │  DONE      │
│  7 ô nhập   │             │  data/feedback│            │  mã KN-... │
└─────────────┘             └──────┬───────┘            └────────────┘
       ▲                           │ có lỗi
       └───────────────────────────┘  hiện chữ đỏ dưới từng ô
```

## 1.2 State (dòng 20–28)

```tsx
const user = useUser()
const [cat, setCat] = useState<Category>("complaint")
const [issue, setIssue] = useState("")
const [desc, setDesc] = useState("")
const [contact, setContact] = useState("")
const [photos, setPhotos] = useState<File[]>([])
const [errs, setErrs] = useState<Errors>({})
const [ref, setRef] = useState("")
```

Bảy state, mỗi state một việc. Vì sao không gộp thành một object `form`:

| Gộp object | Tách riêng (cách repo làm) |
| --- | --- |
| `setForm({...form, desc: v})` — phải spread mỗi lần | `setDesc(v)` — một dòng |
| Dễ quên spread → mất field khác | Không thể quên |
| Chỉ đáng khi 15+ field hoặc cần reset cả form | 5 field thì tách dễ đọc hơn |

`errs` là object riêng, không trộn vào dữ liệu nhập: lỗi là **kết quả kiểm tra**,
không phải nội dung người dùng gõ.

`ref` là mã tiếp nhận. Khi nó có giá trị, component `return` sớm màn hình khác
(dòng 48) — không cần route mới, không cần modal.

## 1.3 Đổi loại khiếu nại phải xoá lựa chọn cũ (dòng 31–36)

```tsx
const pickCat = (c: Category) => {
  if (c === cat) return
  setCat(c)
  setIssue("")   // id của 2 nhóm không trùng nhau, giữ lại sẽ gửi sai loại
  setErrs((e) => ({ ...e, issue: undefined }))
}
```

Đây là **phụ thuộc giữa hai ô**. `ISSUES.complaint` có `collect-missed`, còn
`ISSUES.suggestion` không có. Nếu đổi sang "Góp ý" mà giữ `issue = "collect-missed"`,
form gửi lên một cặp (category, issue) không tồn tại.

`setErrs((e) => ({ ...e, issue: undefined }))` — copy object lỗi cũ, chỉ xoá lỗi
của ô vừa đổi. Không xoá hết lỗi của các ô khác (người dùng vẫn cần thấy).

`if (c === cat) return` — bấm lại ô đang chọn không làm gì, tránh xoá `issue`
một cách vô tình.

## 1.4 Gửi form (dòng 38–46)

```tsx
const send = (e: React.FormEvent) => {
  e.preventDefault()
  const found = validate({ category: cat, issue, desc, contact, photos })
  setErrs(found)
  if (Object.values(found).some(Boolean)) return
  setRef(makeRef())
}
```

- `e.preventDefault()` — chặn trình duyệt gửi form và tải lại trang. Không có
  dòng này, cả app biến mất sau khi bấm Gửi.
- `validate()` là **hàm thuần** trong `data/feedback.ts`: nhận dữ liệu, trả object
  lỗi. Không đụng React, nên test được riêng.
- `Object.values(found)` → mảng các thông báo lỗi (hoặc `undefined`).
  `.some(Boolean)` → có ít nhất một giá trị truthy? Nếu có, dừng lại.
- `setErrs(found)` chạy **trước** khi kiểm tra: người dùng thấy toàn bộ lỗi cùng
  lúc, không phải sửa từng cái một.

`<form onSubmit={send} noValidate>` (dòng 63):

`noValidate` tắt kiểm tra mặc định của trình duyệt (bong bóng "Please fill out this
field"). Lý do: thông báo mặc định bằng tiếng Anh, không nhất quán giữa các
trình duyệt, và không kiểm tra được logic như "email **hoặc** số điện thoại".
Ta tự kiểm tra để kiểm soát hoàn toàn câu chữ.

## 1.5 Radio "tự chế" nhưng vẫn đúng chuẩn (dòng 66–105)

```tsx
<label className={on ? "border-brand bg-brand/8" : "border-line ..."}>
  <input type="radio" name="category" value={c.id}
         checked={on} onChange={() => pickCat(c.id)} className="sr-only" />
  <span>...</span>
</label>
```

Kỹ thuật: **input thật bị ẩn bằng `sr-only`, label được vẽ đẹp**.

Vì sao không dùng `<div onClick>`:

| Input thật + label | Div giả |
| --- | --- |
| Tab tới được | Không |
| Mũi tên trái/phải đổi lựa chọn | Phải tự viết |
| Screen reader đọc "radio, 1 trên 2" | Không biết là gì |
| Bấm vào chữ cũng chọn (vì nằm trong label) | Phải tự xử lý |

`sr-only` = ẩn khỏi màn hình nhưng **vẫn còn** cho bàn phím và screen reader.
Khác `display:none` (biến mất hoàn toàn, không tab được).

`name="category"` giống nhau cho cả hai radio → trình duyệt hiểu chúng cùng một
nhóm, chỉ chọn được một.

## 1.6 Ba trạng thái của một ô nhập

Ô mô tả (dòng 150–182) là ví dụ đầy đủ nhất:

```tsx
<textarea
  value={desc}
  onChange={(e) => setDesc(e.target.value.slice(0, DESC_MAX))}
  aria-invalid={!!errs.desc}
  aria-describedby="fb-desc-hint"
  className={`input mt-2 ... ${errs.desc ? "border-warn" : ""}`}
/>
```

1. **Giá trị** — controlled: `value` + `onChange`. React là nguồn sự thật.
2. **Chặn cứng** — `.slice(0, DESC_MAX)`: không cho vượt 1000 ký tự ngay khi gõ,
   thay vì báo lỗi sau. Người dùng không bao giờ mất chữ vì gõ quá.
3. **Thông báo** — `aria-invalid` cho screen reader, `border-warn` cho mắt,
   `aria-describedby` trỏ tới dòng giải thích.

Dòng đếm ký tự:

```tsx
{desc.trim().length} / {DESC_MAX}
{desc.trim().length < DESC_MIN && ` (tối thiểu ${DESC_MIN})`}
```

Đếm trên `trim()` để khoảng trắng thừa không được tính là nội dung.

### Controlled vs uncontrolled trong cùng một form

Ô "Họ tên" (dòng 198–203) lại **không** có `value`/`onChange`:

```tsx
<input id="fb-name" defaultValue={user} placeholder={user ? "" : "Không bắt buộc"} />
```

Đây là **uncontrolled**: trình duyệt tự giữ giá trị, React chỉ đặt giá trị đầu.
Vì họ tên không tham gia validate và không cần đọc lúc gửi — dùng uncontrolled
cho gọn. `defaultValue` (không phải `value`) là điểm khác biệt.

⚠️ Nếu sau này cần gửi họ tên lên server, phải chuyển sang controlled hoặc đọc
bằng `FormData`. Hiện tại nó chỉ để hiển thị.

## 1.7 `Photos` — kiểm tra ảnh trước khi nhận (dòng 305–388)

```tsx
const add = (list: FileList | null) => {
  if (!list) return
  const next: File[] = []
  let skipped = 0
  for (const f of Array.from(list)) {
    if (!f.type.startsWith("image/") || f.size > MAX_PHOTO_MB * 1024 * 1024) {
      skipped++; continue
    }
    if (photos.length + next.length >= MAX_PHOTOS) { skipped++; continue }
    next.push(f)
  }
  ...
  setPhotos([...photos, ...next])
  if (input.current) input.current.value = ""
}
```

Bốn điểm đáng học:

1. **Kiểm tra ở client ngay khi chọn**, không đợi bấm Gửi. Người dùng biết ngay
   ảnh nào bị bỏ và vì sao.
2. `f.type.startsWith("image/")` — kiểm tra MIME. Không đủ để bảo mật (MIME giả
   được), nhưng đủ để chặn người dùng chọn nhầm file PDF.
3. `photos.length + next.length >= MAX_PHOTOS` — đếm cả ảnh đã có **và** ảnh
   đang thêm trong vòng lặp. Nếu chỉ đếm `photos.length`, chọn 10 ảnh một lần sẽ
   vượt giới hạn.
4. `input.current.value = ""` — **bắt buộc**. Nếu không xoá, chọn lại đúng file
   vừa xoá sẽ không kích hoạt `onChange` (trình duyệt thấy giá trị không đổi).

`skipped` gộp ba lý do vào một câu thông báo. Đánh đổi: người dùng không biết
chính xác ảnh nào bị loại vì lý do gì. Với tối đa 4 ảnh, chấp nhận được.

### `Thumb` — lại là objectURL trong effect (dòng 390–401)

```tsx
useEffect(() => {
  const u = URL.createObjectURL(file)
  setUrl(u)
  return () => URL.revokeObjectURL(u)
}, [file])
```

Giống hệt `Preview` của Scanner. Đây là pattern chuẩn của repo cho ảnh local:

```
File (từ input)  →  URL.createObjectURL  →  <img src="blob:...">
                     ↑ trong useEffect
                     ↓ cleanup revoke
```

Nếu tạo URL trong lúc render, mỗi lần render lại tạo thêm một URL mới → rò rỉ.

## 1.8 Màn hình xác nhận (dòng 404–458)

```tsx
const [copied, setCopied] = useState(false)

onClick={() => {
  navigator.clipboard?.writeText(refCode)
  setCopied(true)
}}
```

`navigator.clipboard?.` — API này không có trên HTTP không bảo mật hoặc trình
duyệt cũ. Dấu `?.` tránh crash; khi đó nút vẫn đổi chữ "Đã chép" nhưng thực ra
chưa chép. Với demo thì chấp nhận; bản thật nên kiểm tra `await` và báo lỗi.

Hai nút cuối:

```tsx
<a href="/" className="btn btn-primary h-12 px-6">Về trang chủ</a>
<button onClick={() => location.reload()} className="btn btn-ghost h-12 px-6">
  Gửi thêm nội dung
</button>
```

🔍 **Phát hiện khi review:** `href="/"` là link HTML thường → trình duyệt **tải
lại toàn bộ trang**, mất trạng thái SPA và chậm hơn. Trong dự án đã có
`<Link to="/">` ở mọi nơi khác. Đây là chỗ duy nhất dùng `a href` cho điều hướng
nội bộ (ngoài footer, nơi link chưa tồn tại).

`location.reload()` cũng là cách thô: tải lại cả app chỉ để reset form. Cách gọn
hơn là `setRef("")` + reset các state, hoặc `navigate(0)`.

---

# PHẦN 2 — `pages/Rewards.tsx`

## 2.1 Hai con số, một state (dòng 79–85)

```tsx
const { cur, next, pct, need } = tierProgress()
const [spend, setSpend] = useState(SPEND_POINTS)
const list = [...REWARDS].sort((a, b) => a.cost - b.cost)
```

`spend` là **bản sao có thể đổi** của `SPEND_POINTS`. Vì sao không dùng thẳng
hằng số: điểm danh cộng thêm điểm, giao diện phải cập nhật ngay.

`RANK_POINTS` thì **không** đổi trong trang này — đúng thiết kế hai loại điểm
(đọc lại tài liệu 05). Điểm danh chỉ cộng vào điểm tiêu dùng.

### `[...REWARDS].sort(...)` — copy trước khi sort

```tsx
const list = [...REWARDS].sort((a, b) => a.cost - b.cost)   // ✅
const list = REWARDS.sort((a, b) => a.cost - b.cost)        // ❌
```

`Array.prototype.sort` **sửa mảng gốc tại chỗ** và trả về chính mảng đó. Nếu sort
thẳng `REWARDS`, mảng import từ `data/` bị đảo thứ tự vĩnh viễn cho mọi component
khác trong cùng phiên. `[...REWARDS]` tạo bản sao nông trước.

Đây là lỗi rất dễ mắc vì câu lệnh vẫn "chạy đúng" ở trang này — chỉ hỏng ở trang
khác dùng cùng dữ liệu.

## 2.2 `tierProgress()` trả gì (dòng 80)

```ts
{ cur: { min: 15000, name: "Rừng" },
  next: { min: 30000, name: "Đại dương" },
  pct: 56,
  need: 6600 }
```

Component chỉ việc bày ra. Toàn bộ phép tính nằm trong `data/rewards.ts` — đó là
lý do có thể test riêng mà không cần render.

Thanh tiến độ có ARIA đầy đủ (dòng 125–134):

```tsx
<div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
     aria-label={`Tiến độ lên hạng ${next.name}`}>
  <div style={{ width: `${pct}%` }} />
</div>
```

`role="progressbar"` + `aria-valuenow` để screen reader đọc "56 phần trăm", thay
vì chỉ thấy một div trống.

## 2.3 Giải lớn — mỗi thẻ tự tính trạng thái (dòng 185–288)

```tsx
const short = Math.max(g.cost - spend, 0)
const can = short === 0
const pct = can ? 100 : Math.round((spend / g.cost) * 100)
```

```
spend = 12.400, cost = 150.000
short = 137.600   can = false   pct = 8%
```

`Math.max(..., 0)` chặn số âm: nếu có 200.000 điểm, `short` sẽ là -50.000 nếu
không chặn → hiện "Cần thêm -50.000 điểm".

`can ? 100 : ...` — khi đủ điểm, thanh luôn đầy, không hiện 133%.

## 2.4 Nhãn tồn kho — nested ternary (dòng 309–316)

```tsx
const stock =
  r.stock === null ? "Không giới hạn"
  : soldOut ? "Hết hàng"
  : r.stock <= LOW_STOCK ? `Chỉ còn ${r.stock}`
  : `Còn ${r.stock}`
```

Bốn nhánh lồng nhau. Đọc được nhưng **không nên nhân rộng**: từ 4 nhánh trở lên
nên tách hàm hoặc bảng tra. Ở đây chấp nhận vì chỉ dùng một lần và mỗi nhánh rất
ngắn.

`r.stock === null` = không giới hạn (voucher), khác `0` = hết hàng. Đây là lý do
kiểu là `number | null` chứ không phải `number`.

## 2.5 Nút "Đổi ngay" — phát hiện khi review (dòng 360–366)

```tsx
<button type="button" disabled={!can} className="btn btn-primary h-10 min-w-[104px]">
  {soldOut ? "Hết hàng" : "Đổi ngay"}
</button>
```

⚠️ **Nút không có `onClick`.** Khi đủ điểm, nút bấm được nhưng **không có gì xảy
ra**. Đây là CTA chính của trang, nên đây là lỗi đáng chú ý hơn cả bug điểm danh
ở tài liệu 05.

Comment dòng 374–375 thừa nhận backend chưa có, nhưng ngay cả demo cũng nên có
phản hồi: trừ `spend`, giảm `stock`, hiện thông báo. Nếu cố ý để trống, nên
`disabled` luôn hoặc ghi rõ "demo".

Ngoài ra `disabled={!can}` chỉ chặn khi thiếu điểm/hết hàng; còn khi đủ điểm thì
nút trông "sẵn sàng" nhưng không hành động → người dùng bấm 3 lần rồi mất niềm tin.

## 2.6 `Thumb` — ảnh hỏng vẫn có giao diện (dòng 55–77)

```tsx
const [broken, setBroken] = useState(false)
...
{broken ? <RewardIcon kind={reward.kind} /> : (
  <img src={reward.img} onError={() => setBroken(true)}
       width={800} height={600} loading="lazy" decoding="async" />
)}
```

- `onError` → đổi sang icon. Không để ô trắng vỡ.
- `width`/`height` + `aspect-[4/3]` → trình duyệt biết trước tỉ lệ, **không nhảy
  layout** khi ảnh tải xong. Đây là chỉ số CLS trong Core Web Vitals.
- `loading="lazy"` + `decoding="async"` → ảnh dưới màn hình không chặn render.

## 2.7 Cấu trúc "một chiều" của trang

```
spend (state)
   │
   ├──▶ fmt(spend)                    số dư
   ├──▶ CheckIn balance={spend}       hiện điểm, bấm → onEarn → setSpend(+n)
   ├──▶ grand prize: short/can/pct    tính lại mỗi render
   └──▶ reward list: enough/soldOut   tính lại mỗi render
```

Không có state trùng lặp. `short`, `can`, `pct`, `stock` đều là **giá trị dẫn
xuất** — tính từ `spend` và dữ liệu tĩnh, không lưu riêng. Nếu lưu riêng, mỗi
lần `spend` đổi phải nhớ cập nhật 4 chỗ → chắc chắn có lúc quên.

🔍 Nguyên tắc: **không lưu cái có thể tính**. State chỉ giữ thứ không suy ra được.

---

## 3. Tổng kết hai file

| Kỹ thuật | File | Ghi nhớ |
| --- | --- | --- |
| Validate ở ranh giới tin cậy | `feedback.ts` | không tin dữ liệu người dùng |
| `noValidate` + tự báo lỗi | `Feedback` | kiểm soát câu chữ, đa ngôn ngữ |
| Radio thật + label đẹp | `Feedback` | `sr-only`, không dùng div |
| Reset input file | `Photos` | `input.value = ""` |
| Copy mảng trước khi sort | `Rewards` | `sort` sửa mảng gốc |
| Không lưu giá trị dẫn xuất | `Rewards` | `short`, `can`, `pct` tính mỗi render |
| `onError` cho ảnh | `Thumb` | không để ô trắng |

## 4. Tự kiểm tra

1. Vì sao `pickCat` phải `setIssue("")`? → Hai nhóm có bộ issue khác nhau; giữ id cũ sẽ gửi cặp không tồn tại.
2. `noValidate` để làm gì? → Tắt thông báo mặc định của trình duyệt để dùng validate riêng, câu chữ tiếng Việt và logic "email hoặc SĐT".
3. Vì sao `[...REWARDS].sort()` chứ không `REWARDS.sort()`? → `sort` sửa mảng tại chỗ, sẽ đảo thứ tự dữ liệu gốc dùng chung.
4. `short = Math.max(g.cost - spend, 0)` để làm gì? → Chặn số âm khi người dùng có nhiều điểm hơn giá món.
5. Nút "Đổi ngay" hiện có làm gì không? → Không, thiếu `onClick`; đây là lỗi cần sửa nếu muốn demo đầy đủ.

**Tiếp:** `06c · Các trang nội dung` — Map, Partners, Blog, Guidance, Waste, Chat, JoinRecycler, Leaderboard.
