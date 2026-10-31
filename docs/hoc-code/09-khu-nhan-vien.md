# 09 · Khu Nhân viên (`src/pages/staff/`)

Mười trang, ~1.190 dòng. Đây là khu **duyệt và dọn**: nhân viên không tạo ra dữ
liệu mới, chỉ xử lý thứ người khác đẩy tới và sửa nội dung hệ thống.

| Trang | Dòng | UC | Việc chính |
| --- | --- | --- | --- |
| `Home.tsx` | 65 | — | hàng đợi việc đang chờ |
| `AiReview.tsx` | 162 | S-01, S-02, S-03 | gán nhãn ảnh AI đoán sai |
| `Dataset.tsx` | 58 | S-03 | độ phủ, độ chính xác theo lớp |
| `Applications.tsx` | 131 | S-04 | duyệt / từ chối hồ sơ cơ sở |
| `Complaints.tsx` | 102 | S-05 | khiếu nại giao dịch |
| `Accounts.tsx` | 177 | S-06, S-07 | khoá / xoá tài khoản |
| `BlogEditor.tsx` | 133 | S-08 | soạn bài gửi Admin duyệt |
| `EcoFacts.tsx` | 133 | S-09 | quản lý Eco Fact |
| `Gifts.tsx` | 148 | S-10 | kho quà |
| `CheckIn.tsx` | 57 | S-11 | điểm danh nhân viên (dùng lại component) |

---

# 0. Đọc trước: khuôn mẫu chung của cả mười trang

**Chín trong mười trang mở đầu bằng đúng một dòng:**

```tsx
const [list, setList] = useState<Application[]>(APPLICATIONS)
```

Đây không phải chi tiết vụn — nó là **kiến trúc** của toàn bộ app. Đọc kỹ một lần,
áp dụng cho mọi trang còn lại:

```
   src/data/ops.ts                        Trang staff
   ┌────────────────┐    useState(DATA)   ┌──────────────────┐
   │ export const   │ ──────────────────▶ │ list (bản sao)   │
   │ APPLICATIONS   │                     │  ↓ setList(map)  │
   │ (mảng gốc)     │ ◀── không bao giờ ── │ thao tác trên    │
   └────────────────┘      bị sửa          │ bản sao          │
                                           └──────────────────┘
```

Ba hệ quả, phải nhớ cả ba:

1. **Không có trang nào sửa dữ liệu gốc.** `setList` chỉ đổi bản sao trong state
   của chính trang đó.
2. **Rời trang là mất thay đổi.** Duyệt hồ sơ ở `Applications`, sang trang khác,
   quay lại → mọi thứ về như cũ. Comment `// ponytail: chưa có backend` xuất hiện
   rải rác chính là để đánh dấu những chỗ này.
3. **Hai trang cùng đọc một mảng thì không thấy thay đổi của nhau.** Sửa giá ở
   `Catalog` (khu recycler) không làm đổi giá ở `/waste` (khu người dân). Không
   phải bug — là hệ quả tất yếu của "dữ liệu tĩnh, chưa có backend".

Khi nối backend, **đúng những dòng `useState(DATA)` này** là chỗ thay bằng
`useEffect` + `fetch`. Biết chỗ đó ở đâu là toàn bộ giá trị của việc nhận ra khuôn
mẫu.

Khuôn mẫu phụ, xuất hiện 5 lần: **hai danh sách `pending` và `đã xử lý`**.

```tsx
const pending = list.filter((a) => a.status === "pending")
const done    = list.filter((a) => a.status !== "pending")
```

Cái đang chờ hiện dạng **thẻ lớn** (cần hành động), cái đã xử lý hiện dạng
**bảng** (chỉ tra cứu). Nhất quán ở `Applications`, `Complaints`, `BlogEditor`,
`Requests` (khu recycler). Đọc một lần là đọc được cả năm.

---

# 1. `Home.tsx` — hàng đợi, không phải bảng điều khiển

```tsx
const queue = [
  { to: "/staff/ai-review",    label: "Ảnh AI nhận diện sai",  n: STATS.pending.aiCases,      unit: "ảnh" },
  { to: "/staff/applications", label: "Hồ sơ đối tác thu mua", n: STATS.pending.applications, unit: "hồ sơ" },
  { to: "/staff/complaints",   label: "Khiếu nại giao dịch",   n: STATS.pending.complaints,   unit: "khiếu nại" },
  { to: "/staff/blog",         label: "Bài blog chờ duyệt",    n: STATS.pending.posts,        unit: "bài" },
]
```

🔍 Đây là ví dụ đẹp nhất về **cấu hình bằng dữ liệu**: một mảng 4 phần tử, một
`map`, ra 4 thẻ. Thêm việc thứ năm = thêm một dòng, không đụng JSX.

🔍 Và bốn con số `n` **không được đếm lại** — chúng lấy từ `STATS.pending` trong
`data/ops.ts`, nơi tính sẵn:

```ts
pending: {
  aiCases: AI_CASES.filter((c) => !c.inDataset).length,
  applications: APPLICATIONS.filter((a) => a.status === "pending").length,
  complaints: COMPLAINTS.filter((c) => c.status !== "resolved").length,
  posts: POSTS.filter((p) => p.status === "pending").length,
},
```

Bốn công thức này **định nghĩa** "việc đang chờ" theo đúng luật mà từng trang
dùng. Nếu `AiReview` đổi luật (ví dụ tính cả ảnh đã gán nhưng chưa vào tập), chỉ
sửa **một chỗ** ở `ops.ts`. So với `Gamification.tsx` khu user (tài liệu 07) —
chỗ đó chép tay `"23.400"` và đã lệch ngay khi dữ liệu đổi. Cùng một repo, hai
cách làm, đây là cách đúng.

Khối `Stat` còn lại cũng đều là phép tính:

```tsx
value={String(GIFTS.filter((g) => g.active).length)}
note={`${GIFTS.filter((g) => g.stock === 0).length} món hết hàng`}
```

Đoạn chữ cuối trang nói rõ giới hạn quyền của nhân viên ("không có quyền đổi cấu
hình hệ thống, phí giao dịch hay tài khoản nhân viên"). Đây là **tài liệu sống
cho người dùng** — người dùng là nhân viên, và họ cần biết ranh giới trước khi đi
tìm nút không tồn tại.

---

# 2. `AiReview.tsx` — trang phức tạp nhất của khu

## 2.1 Ba state rời, một state "đang chọn"

```tsx
const [list, setList] = useState<AiCase[]>(AI_CASES)
const [pick, setPick] = useState(AI_CASES[0].id)  // đang xem ảnh nào
const [label, setLabel] = useState(AI_CASES[0].correct) // nhãn đang chọn
const [note, setNote] = useState("")
const [flash, setFlash] = useState("")

const cur = list.find((c) => c.id === pick)!
```

`cur` là giá trị **dẫn xuất** từ `list` + `pick` — không phải state, nên không bao
giờ lệch với `list`. Đây là luật được giữ ở mọi trang: *cái gì tính được thì không
lưu*.

Dấu `!` ở `cur` là dấu `!` thứ **năm** trong repo, và **an toàn**: `pick` chỉ được
gán từ `choose()`, mà `choose` chỉ nhận id nằm trong `list`.

## 2.2 `choose` — đổi ảnh thì reset bản nháp

```tsx
const choose = (id: string) => {
  const c = list.find((x) => x.id === id)
  setPick(id)
  setLabel(c?.correct ?? "")
  setNote("")
  setFlash("")
}
```

Ba việc reset cùng lúc. Nếu quên `setNote("")`, ghi chú của ảnh trước sẽ đi theo
sang ảnh sau — và bấm lưu là **ghi chú của ảnh A nằm trong hồ sơ ảnh B**. Loại lỗi
này rất khó phát hiện vì UI trông vẫn bình thường.

Đây là lý do trong React, mỗi khi "đổi đối tượng đang chọn", luôn phải hỏi: *những
state phụ thuộc đối tượng đó đã được reset chưa?*

`c?.correct ?? ""` — dùng `?.` vì `find` có thể trả `undefined`; nhãn rỗng nghĩa
là bắt người dùng chọn lại (option đầu `<option value="">Chọn nhãn đúng</option>`).

## 2.3 Một thao tác làm hai việc (dòng 29–42)

```tsx
setList((ls) =>
  ls.map((c) => (c.id === pick ? { ...c, correct: label, inDataset: true } : c)),
)
setFlash(`Đã gán nhãn ${cur.id} và đưa vào tập kiểm chứng.`)
```

Comment giải thích vì sao gán nhãn và "đưa vào tập kiểm chứng" là **một** hành
động:

> hai việc luôn đi cùng nhau, tách ra thì có ảnh đã gán mà chưa vào tập, và cũng
> có ảnh vào tập mà vẫn chưa ai xác nhận nhãn.

Đây là cách suy nghĩ **bất biến nghiệp vụ** (invariant): nếu hai dữ liệu luôn phải
đi cùng nhau, đừng cho người dùng tạo ra trạng thái chỉ có một trong hai. Rẻ hơn
nhiều so với việc viết code kiểm tra "ảnh gán mà chưa vào tập" ở mười chỗ khác.

`if (!label.trim())` chặn trước khi lưu — không cho lưu ảnh mà nhãn là chuỗi rỗng.

Nhãn được so bằng **`w.name`** (`<option value={w.name}>`), nghĩa là tên hiển thị
của loại rác. Đây lại đúng loại "dùng chuỗi hiển thị làm khoá" đã gây lỗi ở
`Partners` (tài liệu 06c): đổi tên một loại rác trong `data/waste.ts` là mọi nhãn
cũ lệch theo. Ở đây chưa gây lỗi vì nhãn chỉ để đọc, nhưng cùng một thói quen.

## 2.4 Cột phải — hàng chờ

```tsx
<h2>Hàng chờ ({list.filter((c) => !c.inDataset).length} chưa xử lý)</h2>
```

Ảnh đã gán vẫn nằm trong danh sách (chỉ đổi nhãn `Status` thành "Đã gán"), nghĩa
là *hàng chờ* là số dẫn xuất, còn danh sách là đủ. Đúng tinh thần: không xoá dữ
liệu khỏi danh sách chỉ vì nó đã xử lý — người dùng có thể muốn sửa lại.

`<img alt="" loading="lazy">` trong danh sách — `alt=""` cố ý: ảnh nhỏ đóng vai trò
trang trí vì `c.correct` ngay cạnh đã là nội dung. Ảnh lớn ở khung chính thì có
`alt` mô tả. Đây là cách dùng `alt` đúng: **ảnh nào mang thông tin thì mô tả, ảnh
nào lặp lại thông tin đã có thì để rỗng** (để rỗng, không phải bỏ thuộc tính).

---

# 3. `Dataset.tsx` — trang đọc, 58 dòng

Không state. Điểm đáng học nằm ở hai chỗ.

## 3.1 Sắp xếp trên bản sao

```tsx
{[...DATASET.byClass]
  .sort((a, b) => a.accuracy - b.accuracy)
  .map((c) => ( ... ))}
```

`[...]` là **bắt buộc**: không có nó, `.sort` sửa thẳng mảng trong `DATASET` — đúng
cái lỗi đã ghi ở tài liệu 05/07 (`REWARDS.sort(...)`). Ở đây tác giả đã nhớ. Trong
repo, phép sort nào cũng phải tự hỏi: *đang sort mảng gốc hay bản sao?*

Sắp **tăng dần** độ chính xác là quyết định UX: lớp yếu nhất nằm trên cùng, nơi
mắt đọc trước. Comment dòng 39–40 ghi lý do rõ.

## 3.2 Ngưỡng 90% là chữ, không phải màu

```tsx
{c.accuracy < 90 ? (
  <span className="font-semibold text-brand">Cần ưu tiên thu thập</span>
) : (
  <span className="text-muted">Đạt</span>
)}
```

Ngưỡng 90 viết cứng trong JSX — chỗ này trái với chính quy ước của repo (ngưỡng
thưởng, phí, giá đều nằm trong `data/`). Nếu Admin muốn đổi ngưỡng "lớp yếu", phải
sửa file này. Ở `Fees.tsx` khu admin thì đúng: ngưỡng, phí đều tập trung ở
`data/`. Đây là chỗ lệch nhỏ.

---

# 4. `Applications.tsx` — duyệt hồ sơ

## 4.1 Chỉ nhánh từ chối mới hỏi lý do (dòng 12–29)

```tsx
const decide = (id: string, ok: boolean) => {
  let note: string | undefined
  if (!ok) {
    const reason = window.prompt(`Từ chối hồ sơ ${id}. Lý do (cơ sở sẽ thấy lý do này):`)
    if (!reason?.trim()) return
    note = reason.trim()
  }
  setList((ls) => ls.map((a) => a.id === id ? { ...a, status: ok ? "approved" : "rejected", note } : a))
```

Một hàm cho hai nút, phân nhánh bằng tham số `ok`. Đúng chuỗi `duyệt = không cần
lý do`, `từ chối = bắt buộc lý do` — vì cơ sở đã nộp giấy tờ và chờ kết quả, từ
chối im lặng thì họ nộp lại y hệt.

Chi tiết TypeScript: `let note: string | undefined` — với nhánh duyệt, `note` ở
lại `undefined` nên trường không được ghi (toàn `undefined` thì `{ ...a, note }`
ghi `note: undefined`; JSON sẽ bỏ, React thì vô hại). Cách viết khác cũng được
(`note: ok ? undefined : reason`), nhưng cách này tránh biến `reason` nằm ngoài
phạm vi nhánh.

⚠️ `window.prompt` là hộp thoại mặc định: chặn luồng, không style được, nhiều
trình duyệt chặn trong iframe. Nó xuất hiện **4 lần** trong repo (`Applications`,
`recycler/Requests`, `user/Handover`, `admin/BlogReview`) và `window.confirm`
**2 lần** (`staff/Accounts`, `admin/StaffAccounts`). Bản thật phải thay bằng
modal trong app — nhưng vì cả 6 chỗ đều là "hỏi một câu rồi thôi", dùng hộp thoại
hệ thống vẫn là lựa chọn lười đúng cho demo: bỏ 6 chỗ này là bỏ luôn nhu cầu về
một hệ thống modal.

## 4.2 Bảng "Đã xử lý" có cột Lý do

Đối xứng với form: từ chối bắt nhập lý do thì lịch sử phải hiện lý do
(`{a.note ?? "—"}`). Nếu cột này không có, người duyệt sau không biết vì sao hồ sơ
bị từ chối — và chính nhân viên cũng quên sau hai tuần.

---

# 5. `Complaints.tsx` — bắt buộc trả lời mới được đóng

```tsx
const [reply, setReply] = useState<Record<string, string>>({})
...
const resolve = (id: string) => {
  const text = (reply[id] ?? "").trim()
  if (text.length < 10) { setFlash("Cần viết phản hồi ít nhất 10 ký tự trước khi đóng khiếu nại."); return }
  setList((ls) => ls.map((c) => (c.id === id ? { ...c, status: "resolved", reply: text } : c)))
}
```

🔍 Điểm đáng học nhất của trang: comment dòng 7–9 nói **vì sao** có luật này:

> nếu cho đóng không cần trả lời thì hầu hết ca sẽ đóng im lặng.

Đây là suy nghĩ về **hành vi con người**, không phải về code. Người ta chọn đường
ngắn nhất; nếu đường ngắn nhất là "đóng", họ sẽ đóng. Ràng buộc mềm trong UI là
cách duy nhất giữ chất lượng dịch vụ. Cùng loại suy nghĩ với "từ chối phải có lý
do" ở `Applications`.

**`Record<string, string>` cho bản nháp theo id** — cách lưu nhiều textarea trong
một state:

```tsx
value={reply[c.id] ?? ""}
onChange={(e) => setReply((r) => ({ ...r, [c.id]: e.target.value }))}
```

`(r) => ({ ...r, [c.id]: ... })` — copy toàn bộ rồi ghi đè một khoá. `[c.id]` là
**khoá động** (computed key). Nếu viết `setReply((r) => { r[c.id] = ...; return r })`
thì đã sửa object cũ → React không thấy thay đổi → ô nhập đứng im. Đây là lỗi kinh
điển của React và cách viết spread chính là để tránh nó.

So sánh với `AiReview`: ở đó chỉ **một** ảnh được chọn nên chỉ cần 2 state
(`label`, `note`). Ở đây nhiều khiếu nại cùng mở nên phải là `Record`. Hai cách,
chọn theo số đối tượng cùng lúc — không phải theo sở thích.

---

# 6. `Accounts.tsx` — khoá và xoá là hai việc khác nhau

## 6.1 Hai hành động, hai mức đảo ngược (dòng 5–10, 31–42)

```tsx
const lock = (id: string) =>
  setList((ls) => ls.map((a) => a.id === id ? { ...a, status: a.status === "locked" ? "active" : "locked" } : a))

const remove = (a: Account) => {
  if (a.deals > 0) { setFlash(`${a.name} đã có ${a.deals} giao dịch nên không xoá được — dữ liệu đối soát còn cần. Hãy khoá tài khoản.`); return }
  if (!window.confirm(`Xoá ${a.name} (${a.id})? Không khôi phục được.`)) return
  setList((ls) => ls.filter((x) => x.id !== a.id))
  setPick(null)
  setFlash(`Đã xoá ${a.name}.`)
}
```

Ba lớp bảo vệ theo mức độ nguy hiểm, đáng học theo thứ tự:

| Hành động | Bảo vệ | Vì sao |
| --- | --- | --- |
| `lock` | không hỏi gì | đảo ngược được, bấm sai thì bấm lại |
| `remove` khi có giao dịch | **chặn hẳn** + giải thích + gợi ý thay thế | xoá là mất dữ liệu đối soát tiền |
| `remove` khi chưa có giao dịch | `window.confirm` | không đảo ngược được |

Câu thông báo khi bị chặn nói cả **vì sao** và **làm gì thay thế** ("Hãy khoá tài
khoản") — không chỉ "không xoá được". Đây là chuẩn mực cho mọi thông báo lỗi.

`setPick(null)`: đóng bảng chi tiết sau khi xoá, vì bảng đang trỏ tới tài khoản
không còn tồn tại.

## 6.2 Tìm kiếm ba trường

```tsx
const hitQ = !k || a.name.toLowerCase().includes(k) || a.email.includes(k) || a.id.includes(k)
```

`a.name` phải `.toLowerCase()` vì tên tiếng Việt; `a.email` và `a.id` không cần vì
email đã thường, id là mã. Bỏ sót `toLowerCase()` ở một trường là lỗi rất khó thấy
— đúng loại lỗi đã làm hỏng bộ lọc `Partners` (tài liệu 06c). Người viết ở đây đã
để ý.

`k = q.trim().toLowerCase()` tính **một lần** ở đầu `filter`, không gọi lại trong
từng `||`. Nhỏ nhưng đúng.

⚠️ Thông báo dùng chung một biến `flash` cho **cả tin thành công và tin bị chặn**,
và cả hai đều tô `text-warn` (dòng 84):

```tsx
{flash && <p className="text-[13px] font-semibold text-warn">{flash}</p>}
```

Nghĩa là "Đã xoá Nguyễn Văn A." hiện bằng **màu cảnh báo**. So với `RecyclerHome`
và `AiReview` (tin thành công dùng `text-brand` + `role="status"`), đây là chỗ lệch.
Với người đọc lướt, màu là tín hiệu duy nhất — tin tốt màu đỏ là tín hiệu sai.

Ngoài ra thiếu `role="status"`: trình đọc màn hình không tự đọc thông báo.

---

# 7. `BlogEditor.tsx` — nhân viên không được tự xuất bản

```tsx
setList((ls) => [{ id, title, excerpt, author: "Lê Thu Hà", date: "30/09/2026", status: "pending" }, ...ls])
```

🔍 `status: "pending"` viết cứng cùng comment dòng 7–9:

> Bài của nhân viên luôn ở trạng thái "chờ duyệt" — không có đường xuất bản thẳng.
> Nếu để nhân viên tự xuất bản thì A-09 mất hết ý nghĩa, và người đọc tin giả là
> tin thật.

Đây là **phân quyền nằm trong dữ liệu**, không nằm ở menu: trang này *không có*
nút "Xuất bản", nên không có cách nào vi phạm. Cách làm này khác hẳn "ẩn nút đi
nhưng ai biết đường dẫn vẫn gọi được" — vì toàn bộ trạng thái là dữ liệu tĩnh,
chỉ có một đường duy nhất để một bài thành `published`: qua trang duyệt của Admin.

Mã bài dùng `list.length + 89`:

```tsx
const id = `BL-${String(list.length + 89).padStart(4, "0")}`
```

`POSTS` có 4 bài `BL-0085`…`BL-0088`; `4 + 89 = 93` → bài mới là `BL-0093`. Con số
89 là **offset viết cứng cho hợp với dữ liệu mẫu** — nó không suy ra từ đâu. Thêm
một bài nữa: `5 + 89 = 94` → `BL-0094`. Nó "đúng" cho tới lúc ai đó thêm bài
`BL-0093` vào dữ liệu mẫu; từ đó ID trùng và React báo duplicate key.

Cùng loại vấn đề với `let seq` ở `Handover` (tài liệu 07) và `list.length + 1` ở
`EcoFacts` bên dưới. Xem mục phát hiện #1.

## `Field` — component bọc nhãn

```tsx
<Field label="Tóm tắt" hint="Hai ba câu, hiện ở đầu bài và trong danh sách bài mới.">
  <textarea ... />
</Field>
```

`Field` lấy từ `@/components/Portal` (sẽ đọc ở tài liệu 10). Nó gộp `<label>` +
chữ gợi ý + slot cho input, để mọi form trong repo có cùng khoảng cách và nhãn.
Đây là lý do các form trông giống nhau dù viết ở 6 file khác nhau.

`noValidate` trên `<form>`: tắt kiểm tra HTML5 của trình duyệt để thông báo do app
tự quản (tiếng Việt, có định lượng cụ thể: "ít nhất 10 ký tự"). Không có
`noValidate` thì trình duyệt hiện "Please fill out this field" — vừa tiếng Anh, vừa
không khớp luật app.

---

# 8. `EcoFacts.tsx` — nội dung là dữ liệu

## 8.1 Bốn thao tác, bốn hàm một dòng

```tsx
const add    = (e) => { ... setList((ls) => [...ls, {...}]) }
const remove = (id) => setList((ls) => ls.filter((f) => f.id !== id))
const toggle = (id) => setList((ls) => ls.map((f) => (f.id === id ? { ...f, open: !f.open } : f)))
```

Ba hình dạng thao tác mảng, đủ dùng cho gần như mọi màn CRUD:

```
thêm   → [...ls, item]
xoá    → ls.filter(≠)
sửa    → ls.map(khớp ? {...f, sửa} : f)
```

Nhớ ba dòng này là đọc được một nửa số trang của app. Chúng xuất hiện lại nguyên
xi ở `Gifts`, `Applications`, `Accounts`, `Complaints`, `AiReview`, `BlogEditor`.

## 8.2 ⚠️ Sinh mã bằng `list.length + 1` — có lỗi thật

```tsx
const id = `EF-${String(list.length + 1).padStart(2, "0")}`
```

`ECO_FACTS` có `EF-01` … `EF-06`. Kịch bản hỏng, tái hiện được ngay trên UI:

```
1. Vào /staff/eco-facts
2. Bấm "Xoá" ở EF-03        → list còn 5 phần tử (EF-01,02,04,05,06)
3. Thêm một Eco Fact mới    → id = "EF-0" + (5+1) = "EF-06"  ✗ TRÙNG với EF-06 cũ
4. React cảnh báo duplicate key trong console, và nếu bấm "Khoá/Mở" thì cả hai
   thẻ EF-06 cùng đổi trạng thái
```

Vì sao React hành xử như vậy: `key` là cách React nhận ra "phần tử này vẫn là nó"
giữa hai lần render. Hai phần tử cùng `key` → React coi chúng là một → state/DOM
bị dùng lẫn. Xem lại tài liệu 01 (list và key) để nhớ cơ chế; đây là ví dụ đời
thực của nó.

Cách sửa rẻ nhất: đừng suy mã từ số lượng.

```tsx
const id = `EF-${Date.now().toString(36)}`   // Gifts đã làm đúng kiểu này
```

## 8.3 `Mở miễn phí` — nút vượt luật

```tsx
{f.open ? "Khoá" : "Mở miễn phí"}
```

`toggle` đặt `open: true` bất kể `cost`. Trong mô hình, `open` = "người dùng đã mở
khoá"; bấm "Mở miễn phí" là nhân viên tự mở nội dung **không qua điểm**. Nhãn nói
đúng sự thật ("miễn phí"), nên không lừa ai — nhưng cần biết: đây là đường bỏ qua
economy của Eco Fact, và nó không dành cho nhân viên trong app thật.

`remove` không có `window.confirm` (khác `Accounts.remove` có). Xoá nội dung mà
không hỏi. Mức thấp (nội dung là dữ liệu tĩnh, tải lại là về như cũ), nhưng lệch
chuẩn với chính repo này.

---

# 9. `Gifts.tsx` — tồn kho và hai loại quà

## 9.1 `stock: null` là dữ liệu có nghĩa (dòng 5–9)

```tsx
/** `stock: null` nghĩa là không giới hạn (voucher), không phải "chưa nhập số".
 *  Khoảng trống đó dễ gây hiểu nhầm nên trong bảng hiện thành chữ "Không giới
 *  hạn" chứ không để ô số trống. */
```

```tsx
{g.stock === null ? (
  <span className="text-[13px] text-muted">Không giới hạn</span>
) : (
  <input type="number" ... value={g.stock} />
)}
```

🔍 Bài học: **`null` và `0` là hai chuyện khác nhau.** `stock: 0` = hết hàng (quà
đó biến mất khỏi trang đổi thưởng), `stock: null` = vô hạn (voucher không có tồn
kho). Nếu ai đó "gọn hoá" bằng cách bỏ `null` và dùng `0` cho cả hai, voucher sẽ
thành "hết hàng" ngay. Và vì UI có **hai dạng hiển thị khác nhau**, nhân viên
không thể nhập chữ "0" vào ô vô hạn để nhầm.

⚠️ Nhưng form "Thêm vào kho" **không cho tạo** món `stock: null`:

```tsx
const [stock, setStock] = useState(50)
...
{ id, name, cost, stock, kind: "gift", active: true }
```

Mọi quà mới đều là `kind: "gift"` với tồn kho là số. Muốn thêm voucher vô hạn phải
sửa dữ liệu gốc. Nhánh `null` chỉ bảo vệ được **quà đang có**, không tạo được quà
mới. Với demo thì đủ; khi nối backend cần thêm ô chọn loại.

## 9.2 Mã quà — cách làm đúng, đáng chép

```tsx
const id = `g-${Date.now().toString(36)}`
```

`Date.now()` trả số mili-giây (13 chữ số); `.toString(36)` chuyển sang hệ 36 →
ngắn hơn nhiều, chỉ gồm chữ và số. `g-m3k8xq1z`. Không đoán trước được, không
trùng trong vài chục năm, không phụ thuộc mảng. So sánh trực tiếp với `EF-06` ở
mục 8.2 — cùng là "thêm mới", cách sinh mã đúng ở ngay file bên cạnh.

`kind: "gift"` viết cứng ở form thêm mới, còn nhãn `kind` trong bảng thì có phân
biệt voucher/quà vật lý. Form thiếu lựa chọn, bảng thừa nhánh. Cùng vấn đề với
`stock: null`.

---

# 10. `CheckIn.tsx` — dùng lại component, không chép luật

```tsx
import CheckIn from "@/components/CheckIn"

<CheckIn balance={points} onEarn={(n) => setPoints((p) => p + n)} />
```

🔍 Đây là ví dụ đẹp nhất về tái sử dụng trong repo. Nhân viên và người dân cùng
luật điểm danh (chuỗi 7 ngày, ngày thứ 7 thưởng gấp rưỡi). Nếu viết bản thứ hai
cho nhân viên, mỗi lần đổi công thức thưởng phải sửa hai chỗ — và chắc chắn có lần
quên một chỗ.

Điểm đáng học về **thiết kế props**: `CheckIn` **không tự sở hữu** số điểm. Nó
nhận `balance` và gọi `onEarn(n)` khi người dùng nhận thưởng. Nhờ vậy:

- Khu người dân truyền `SPEND_POINTS` + setter có lưu trữ.
- Khu nhân viên truyền `useState(0)` — điểm nhận việc bắt đầu từ 0 mỗi lần mở,
  dùng để xếp giải thưởng cuối tháng, không quy ra tiền.

Nếu `CheckIn` tự giữ điểm trong state của nó, hai khu không thể có nguồn điểm khác
nhau. Đây gọi là **component không sở hữu dữ liệu** (uncontrolled-agnostic) —
nghe nặng nhưng nội dung chỉ là: *ai cần dùng số đó thì người đó giữ, component chỉ
hiển thị và báo sự kiện.*

⚠️ Nhưng màn này vẫn còn một số viết cứng:

```tsx
<dd>42</dd>   {/* "Công việc đã xử lý" */}
```

Cùng loại lỗi với `Gamification.tsx` khu user (tài liệu 07). Con số thật phải đến
từ `STATS`.

---

# 11. Sáu phát hiện khi review khu nhân viên

| # | Vấn đề | Mức | Sửa thế nào |
| --- | --- | --- | --- |
| 1 | `EcoFacts` sinh mã bằng `list.length + 1` → **trùng key** sau khi xoá | cao | dùng `Date.now().toString(36)` như `Gifts` |
| 2 | `BlogEditor` sinh mã bằng `list.length + 89` (số ma) | trung bình | cùng cách sửa trên |
| 3 | `Accounts` tô `text-warn` cho cả tin thành công, thiếu `role="status"` | thấp | tách `flash`/`error` như `AiReview` |
| 4 | `staff/CheckIn` viết cứng "42" | thấp | lấy từ `STATS` |
| 5 | `Dataset` viết cứng ngưỡng 90% trong JSX | thấp | đưa vào `data/ops.ts` |
| 6 | `EcoFacts` xoá không hỏi; `Gifts` không tạo được voucher vô hạn | thấp | thêm `confirm`; thêm chọn loại |

**Ba cách sinh mã khác nhau trong cùng một repo:** `let seq` (Handover), `length + 1`
(EcoFacts), `length + 89` (BlogEditor), `Date.now().toString(36)` (Gifts),
`HS-${năm}-${random}` (JoinRecycler). Chỉ **một** trong năm cách là không sinh ra
mã trùng. Khi review code, đây là dấu hiệu cần tìm: **cùng một việc, nhiều cách
làm** = chỗ hệ thống sẽ vỡ đầu tiên.

---

## Tự kiểm tra

1. Vì sao chín trang staff đều mở đầu bằng `useState(DATA)`? → Để thao tác trên bản sao, không sửa mảng gốc; hệ quả là rời trang thì mất thay đổi và các trang không thấy thay đổi của nhau.
2. `AiReview.choose` phải reset những gì? → `label` (về nhãn của ảnh mới) và `note` (về rỗng), nếu không ghi chú ảnh trước đi theo ảnh sau.
3. Vì sao "đóng khiếu nại" bắt buộc ≥10 ký tự? → Nếu cho đóng im lặng, hầu hết ca sẽ bị đóng mà người dùng không nhận được câu trả lời nào.
4. Ba thao tác mảng cơ bản? → thêm `[...ls, item]`, xoá `ls.filter`, sửa `ls.map`.
5. Vì sao `EF-${list.length + 1}` sinh mã trùng? → Vì độ dài mảng giảm khi xoá; xoá `EF-03` còn 5 phần tử nên phần tử mới cũng thành `EF-06`.
6. `CheckIn` dùng lại được cho hai vai trò nhờ đâu? → Nhờ nó không tự giữ điểm: nhận `balance` và phát `onEarn`, còn nguồn điểm do trang cha quyết định.

**Tiếp:** `10 · Khu Quản trị` — 13 trang + khung `AdminShell`/`Portal`/`Assistant`.
