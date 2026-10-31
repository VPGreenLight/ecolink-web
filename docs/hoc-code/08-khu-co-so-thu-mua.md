# 08 · Khu Cơ sở thu mua (`src/pages/recycler/`)

Bốn trang, ~460 dòng — khu **nhỏ nhất** trong bốn vai trò, nhưng là khu chạm vào
tiền thật nhiều nhất: đặt giá, nhận lịch, cân khối lượng, sinh con số cho lần
giải ngân.

```
/recycler             → Home.tsx      129 dòng   bật/tắt hoạt động + tổng quan
/recycler/catalog     → Catalog.tsx    93 dòng   bảng giá thu mua
/recycler/requests    → Requests.tsx  157 dòng   nhận / từ chối / huỷ
/recycler/receipt     → Receipt.tsx   127 dòng   tạo biên nhận (cân thực tế)
```

Nằm trong `Layout` + `Portal role="recycler"` — cùng khung với khu user, khác mục
menu.

## Năm việc, một vòng

```
  R-01 Danh mục & bảng giá        R-02 Bật/tắt hoạt động
        ┌──────────────┐               ┌──────────────┐
        │  Catalog     │               │    Home      │  tắt = ẩn khỏi bản đồ
        │ giá tôi trả  │               │ role=switch  │
        └──────┬───────┘               └──────┬───────┘
               │                              │
               └──────────────┬───────────────┘
                              ▼
                   ┌──────────────────────┐
                   │  Requests  (R-03/R-04)│
                   │  Nhận → accepted      │
                   │  Từ chối → declined   │
                   │  Huỷ kèm lý do → broken│
                   └──────────┬───────────┘
                              │ sau khi tới nhà và cân
                              ▼
                   ┌──────────────────────┐
                   │  Receipt  (R-06)      │
                   │  nhập kg thực  ───────┼──▶  chờ User xác nhận (U-10)
                   │  tiền tự tính         │     → PayOS giải ngân
                   └──────────────────────┘
```

---

# 1. `Home.tsx` — công tắc hoạt động

## 1.1 Công tắc thật cho trình đọc màn hình (dòng 40–51)

```tsx
<button
  type="button"
  role="switch"
  aria-checked={open}
  onClick={() => {
    setOpen((v) => !v)
    setFlash(
      open
        ? "Đã tắt. Cơ sở không còn hiện trên bản đồ..."
        : "Đã bật. Cơ sở hiện trên bản đồ ngay.",
    )
  }}
>
```

Ba chi tiết đáng học:

1. `role="switch"` + `aria-checked={open}` — nếu chỉ có màu đổi, người khiếm thị
   không biết đang bật hay tắt. Nút thường không mang trạng thái; `switch` thì có.
2. Nút chứa **cả** một hình công tắc `<span>` **và** chữ ("Đang hoạt động"/"Đã
   tắt"): màu là phụ, chữ là chính. Cách này chịu được người mù màu.
3. `setOpen((v) => !v)` dùng hàm — an toàn khi bấm nhanh liên tục, vì React luôn
   đưa giá trị mới nhất vào `v`.

## 1.2 Đọc state cũ trong chính handler

⚠️ Trong `onClick` ở trên, `setOpen` được gọi **trước** nhưng biến `open` vẫn giữ
giá trị **cũ**:

```tsx
open === true   → sắp tắt, nên thông báo phải là "Đã tắt..."   ✅
```

Handler chạy xong cả khối mới tới lần render kế tiếp. Đây là lý do câu thông báo
viết được bằng `open` (giá trị trước khi bấm) mà vẫn đúng. Nếu ai đó "sửa" thành
`!open` cho "hợp lý", thông báo sẽ lộn ngược. Đây là loại chi tiết rất dễ phá khi
refactor.

## 1.3 Bốn con số, ba trong đó lấy từ dữ liệu dùng chung (dòng 79–96)

```tsx
const handovers = MY_HANDOVERS.filter((h) => h.status !== "done")
const payin = FLOWS.filter((f) => f.kind === "payin").reduce((s, f) => s + f.amount, 0)
```

`payin` = tổng tiền cơ sở đã chuyển cho người dân. "Tiền đã thu gom" ở đây là **tiền
đi ra**, đúng nghĩa với người thu gom. Cùng một mảng `FLOWS`, khu user cộng `payout`
(tiền nhận vào) — cùng dữ liệu, hai góc nhìn.

`STATS.recyclers`, `STATS.handovers30d` lấy từ `data/ops.ts` — đúng nguyên tắc một
nguồn. So sánh với `Gamification.tsx` (tài liệu 07) — chỗ đó đã chép tay con số thay
vì import.

## 1.4 Nhãn trạng thái — chỗ bắt đầu lệch

```tsx
<Status tone={h.status === "pending" ? "wait" : "todo"}>
  {h.status === "pending" ? "Chờ xác nhận" : "Đã nhận"}
</Status>
```

Trong khi bên `Requests.tsx` làm **đúng**:

```tsx
<Status tone={TONE[h.status]}>{STATUS_LABEL[h.status]}</Status>
```

`data/handover.ts` có sẵn `STATUS_LABEL` (7 trạng thái) và `TONE` (7 trạng thái). Việc
tự viết lại `pending ? ... : ...` ở Home là **chép lại bảng nhãn bằng tay**:

- Hôm nay chỉ có 1 dòng trong danh sách (`BH-2609-0184`, `accepted`) nên hiển thị
  "Đã nhận" — đúng.
- Thêm một yêu cầu `cancelled`, `declined` hoặc `broken` vào `MY_HANDOVERS` → nó
  hiện **"Đã nhận"** với màu `todo`, tức là sai hoàn toàn.

Đây là lỗi tiềm ẩn (latent bug), không phải lỗi đang xảy ra — nhưng nó chỉ cách
người dùng một lần thêm dữ liệu.

Ngoài ra tiêu đề khối là "Lịch sắp tới" mà điều kiện lọc là `status !== "done"`, nên
mọi trạng thái phủ định (đã huỷ, bị từ chối) đều lọt vào "sắp tới" nếu có trong dữ
liệu — trong khi `Handover.tsx` bên khu user lọc đúng theo danh sách trắng
(`pending || accepted || collected`). Hai khu, hai luật lọc cho cùng một mảng.

---

# 2. `Requests.tsx` — nhận, từ chối, huỷ

## 2.1 Chia danh sách thành hai phần (dòng 33–34)

```tsx
const pending = list.filter((h) => h.status === "pending")
const active = list.filter((h) => h.status !== "pending")
```

`pending` hiện dạng **thẻ lớn** (có nút hành động, cần chỗ), phần còn lại hiện dạng
**bảng** (chỉ để tra cứu). Cùng một mảng, hai cách trình bày theo nhu cầu — hợp lý.

⚠️ Tiêu đề phần hai là "Lịch đã nhận", nhưng `status !== "pending"` cũng kéo theo
`declined` và `broken`. Trong `INCOMING` có sẵn một đơn `broken`
(`BH-2609-0150`, lý do "Xe tải hỏng bơm…"), và nó đang nằm dưới tiêu đề "Lịch đã
nhận". Chữ tiêu đề nói một đằng, dữ liệu một nẻo. Sửa rẻ nhất: đổi tiêu đề thành
"Đã xử lý" hoặc lọc thêm.

## 2.2 Ba hành động, ba trạng thái đích

```tsx
const act = (id, next: "accepted" | "declined") =>
  setList((ls) => ls.map((l) => (l.id === id ? { ...l, status: next } : l)))

const cancel = (id: string) => {
  const reason = window.prompt("Lý do huỷ lịch thu gom (người dùng sẽ thấy lý do này):")
  if (!reason?.trim()) return
  setList((ls) => ls.map((l) => (l.id === id ? { ...l, status: "broken", reason: reason.trim() } : l)))
}
```

Cả ba đều là `map` + `{ ...l, ... }`: tạo mảng mới, chỉ đổi phần tử khớp. Không có
chỗ nào sửa `INCOMING` gốc — nhưng cũng chính vì thế **tải lại là mọi thao tác mất
sạch**, kể cả lý do huỷ vừa nhập.

Nút hành động theo trạng thái (dòng 124–142):

| Trạng thái | Hiện gì | Vì sao |
| --- | --- | --- |
| `collected` | Link "Tạo biên nhận" | đã cân xong, bước kế là R-06 |
| `accepted` | Nút "Huỷ lịch" (kèm lý do) | đã cam kết giờ, không sửa lặng lẽ |
| khác | dấu "—" | không còn việc gì làm |

Điểm đáng chú ý: **không** có nút "Đã tới, bắt đầu cân" để chuyển `accepted →
collected`. Nghĩa là đường đi hợp lệ duy nhất tới màn hình biên nhận là dữ liệu mẫu
đã có sẵn `collected`. Với demo thì chấp nhận; với app thật thì thiếu một chặng, và
`Requests` sẽ không bao giờ mở được `Receipt`.

## 2.3 `busy` — state mô phỏng việc chưa có

```tsx
const [busy, setBusy] = useState("")
...
<button disabled={busy === h.id} onClick={() => { setBusy(h.id); act(h.id, "accepted") }}>
```

`setBusy` là để chặn bấm hai lần khi đang gọi API. Nhưng ở đây **không có API**,
thao tác xong ngay trong cùng lần render, và đơn vừa nhận biến khỏi danh sách
`pending`. Kết quả:

- `setBusy` **không bao giờ** được đặt lại `""`.
- `disabled` không thực sự chặn được gì (nút đã biến mất trước khi nó có tác dụng).

Đây là chỗ đánh dấu chỗ nối API sau này (`ponytail:` ngầm định). Giữ hay bỏ đều
được; nếu giữ thì nên có nhánh `finally { setBusy("") }` khi nối API thật, để người
đọc sau biết đây là chỗ chờ tải.

---

# 3. `Receipt.tsx` — nhập kg, tiền tự tính

## 3.1 Chỉ một thứ nhập được: khối lượng (dòng 9–14)

Comment giải thích rõ vì sao **không** có ô "số tiền":

> có ô "số tiền" ở đây thì cơ sở có thể nhập số tiền tuỳ ý, mà đối soát (A-11)
> không còn đối chiếu được với gì.

Đây là nguyên tắc **một nguồn sự thật** áp vào nghiệp vụ: tiền là **giá trị dẫn
xuất** từ (khối lượng × giá niêm yết × biểu phí). Nếu cho nhập tiền, ta có hai
nguồn và phải tin nhau. Cùng tinh thần với `Rewards.tsx` không cho nhập điểm.

## 3.2 Tiền tính lại ở mọi lần render (dòng 23)

```tsx
const money = calc({ ...h, actual: rows, feeRate: FEE_RATE }, priceOf)
```

Không có state nào tên `money`. Người dùng gõ `20` → `rows` đổi → render → `money`
mới. Không cần `useEffect` đồng bộ, không sợ lệch. Đây là **hệ quả trực tiếp** của
luật "không lưu cái tính được".

Ba số hiển thị (dòng 98–111):

| Nhãn | Công thức | Ý nghĩa |
| --- | --- | --- |
| Tổng tiền đối tác nhận | `gross` | giá × kg thực |
| Phí nền tảng 8% | `fee` | `gross × FEE_RATE` |
| Bạn thực nhận | `net` | `gross − fee` |

⚠️ Nhãn dòng ba sai chủ thể. Trong mô hình của app (`data/cashflow.ts`, trang
`/user/payout`): người thu gom **chuyển** `gross` vào hệ thống, hệ thống giữ `fee`,
PayOS bắn `net` về **tài khoản người dân**. Vậy `net` là tiền **người dân** nhận,
không phải "bạn" (cơ sở thu mua). Trên màn hình cơ sở, con số này nên ghi "Người
dân nhận" hoặc "Chuyển về người dân".

Đối chiếu bằng `BH-2608-0409`: 20 kg → 18 kg thực, đơn giá 900đ → `gross` 16.200,
`fee` 1.296, `net` 14.904. Cơ sở trả 16.200, người dân nhận 14.904. Nhãn "Bạn thực
nhận 14.904" đọc lên thành "cơ sở nhận 14.904" — ngược hoàn toàn với luồng tiền.

## 3.3 Không cho gửi kg ≤ 0 (dòng 27)

```tsx
if (rows.some((r) => r.kg <= 0)) return
```

Không hiện lỗi, chỉ **không gửi**. Đây là điểm khác biệt với các form khác trong
repo (đều hiện thông báo). Chấp nhận được vì input có `min={0}`, nhưng nếu người
dùng xoá trắng ô nhập: `Number("")` = **0** → cũng bị chặn im lặng. Người dùng bấm
Gửi, không có gì xảy ra, không biết vì sao.

Ai sửa chỗ này: đổi thành `if (rows.some((r) => !(r.kg > 0))) { setErr("Khối lượng
phải lớn hơn 0 kg."); return }` — ba dòng, và khớp cách làm của các form khác.

## 3.4 Dấu `!` lần thứ ba (dòng 16)

```tsx
const h = INCOMING.find((x) => x.status === "collected")!
```

Giống `pages/user/Receipt.tsx` và `main.tsx`: ba dấu `!` trong repo. Ở đây còn thêm
`h.lines.map(...)` (dòng 18) không có `?? []`. Nếu `INCOMING` không còn đơn
`collected`, cả hai trang `Receipt` cùng trắng xoá. Cách sửa đã ghi ở tài liệu 07:
return sớm một khối "Không có bàn giao nào chờ".

🔍 Ngược lại, đây là **ví dụ tốt** đáng chú ý: `useState(() => h.lines.map(...))`
truyền hàm khởi tạo, giống hệt `pages/user/Receipt.tsx`. Nhất quán giữa hai khu.

---

# 4. `Catalog.tsx` — bảng giá

## 4.1 Bảng giá là ảnh chụp lúc mở trang (dòng 16–18)

```tsx
const [rows, setRows] = useState<Row[]>(() =>
  WASTES.filter((w) => w.recyclable).map((w) => ({ id: w.id, on: true, price: w.price })),
)
```

Chỉ lấy loại `recyclable`, mỗi dòng bắt đầu bằng giá hệ thống và `on: true`. `Row`
là **kiểu cục bộ** (`{ id, on, price }`) — cố ý không dùng `Waste` từ
`data/waste.ts` vì ở đây chỉ cần 3 trường và `price` sẽ bị sửa; giữ nguyên kiểu gốc
sẽ khiến người đọc tưởng đang sửa dữ liệu hệ thống.

🔍 `dirty` (dòng 19) — cờ "có thay đổi chưa lưu": nút "Lưu thay đổi" `disabled` tới
khi có gì đó đổi. Nhỏ nhưng đúng: nút bấm được nhưng vô tác dụng là loại nút gây
nghi ngờ.

## 4.2 Điểm mâu thuẫn: luật ghi rõ nhưng không kiểm (dòng 82–85)

Chữ dưới bảng nói:

> Giá hệ thống là mức trần EcoLink hiển thị cho người dân. Không đặt cao hơn mức
> đó — yêu cầu sẽ bị từ chối khi đối soát dòng tiền.

Nhưng ô nhập **không có** `max`, không có kiểm tra trong `set()`, không tô đỏ. Cột
"Giá hệ thống" nằm ngay cạnh nên người dùng *có thể* tự so, nhưng với một luật có
hậu quả (yêu cầu bị từ chối, tức là mất đơn thật), im lặng là sai.

Cách sửa tối thiểu, đúng tinh thần repo (giống viền đỏ ở `Payout.tsx`):

```tsx
const over = rows.filter((r) => r.on && r.price > priceOf(r.id))
```

Rồi chặn `Lưu` khi `over.length > 0` và hiện `role="alert"` liệt kê số dòng vượt
trần. Không cần modal, không cần thư viện.

## 4.3 Lưu xong không nói gì (dòng 36)

```tsx
onClick={() => setDirty(false)}
```

Bấm "Lưu thay đổi": nút tự chuyển sang `disabled`, và **hết**. Không thông báo.

So sánh: `RecyclerHome` hỏi `role="status"` cho công tắc, `Payout` và `JoinRecycler`
đều có phản hồi. Đây là chỗ duy nhất trong khu recycler phá quy ước đó. Thêm một
`const [saved, setSaved] = useState(false)` + một dòng `role="status"` là đủ.
Trong app thật còn phải có trạng thái "đang lưu" và "lỗi khi lưu" — chỗ này chính
là nơi chúng sẽ sống.

## 4.4 Chi tiết nhỏ đúng

```tsx
const w = WASTES.find((x) => x.id === r.id)!
```

Dấu `!` thứ tư của repo, nhưng lần này hợp lý: `rows` được **sinh ra từ chính
`WASTES`** ngay phía trên, nên không thể có `id` lạ. `!` chỉ đáng nghi khi dữ liệu
tra cứu đến từ nguồn khác (như `INCOMING`).

`disabled={!r.on}` trên ô giá: tắt "Thu mua" thì khoá luôn ô giá — không cho đặt giá
cho món không thu mua. Đúng nghiệp vụ, và nhắc người dùng rằng giá đó vô nghĩa.

---

# 5. Bốn phát hiện khi review khu recycler

| # | Vấn đề | Mức | Sửa thế nào |
| --- | --- | --- | --- |
| 1 | `BH-2609-0184` mang **hai trạng thái khác nhau** ở hai danh sách: `accepted` (`MY_HANDOVERS`) và `collected` (`INCOMING`) | cao | tách bản ghi chung hoặc chấp nhận rằng đây là hai màn demo rời |
| 2 | `Catalog` cho nhập giá quá trần dù chữ nói không được | trung bình | chặn `Lưu` khi `price > priceOf(id)` |
| 3 | `Catalog` lưu im lặng, không `role="status"` | thấp | thêm `saved` |
| 4 | `Home` tự viết bảng nhãn trạng thái thay vì dùng `STATUS_LABEL`/`TONE` | trung bình | dùng bảng có sẵn; và đổi tiêu đề "Lịch sắp tới" |
| 5 | `Receipt` (recycler): nhãn "Bạn thực nhận" hiển thị `net` — tiền **người dân** nhận | trung bình | đổi chữ thành "Người dân nhận" |
| 6 | `Requests`: `busy` không bao giờ được đặt lại; thiếu chặng `accepted → collected` | thấp | `finally setBusy("")` khi nối API; thêm nút "Đã tới nơi" |

## Phát hiện 1 nói kỹ hơn

Hai danh sách cùng chứa `BH-2609-0184`, cùng địa chỉ, cùng ngày, cùng 15 kg carton +
5 kg pet:

```
MY_HANDOVERS (màn user)      status: "accepted"   → "Đã nhận"
INCOMING     (màn recycler)  status: "collected"  → "Chờ xác nhận bàn giao"
```

Cùng một công việc, hai trạng thái. Với demo thì tiện (mỗi màn có sẵn ví dụ đúng
bước của nó), nhưng đây là **hai bản sao của một sự thật** — đúng loại dữ liệu sẽ
lệch ngay khi có backend. Nguyên tắc: nếu hai màn hình nói về cùng một đối tượng,
dữ liệu phải là **một** mảng, lọc theo góc nhìn, đúng như comment ở `handover.ts`
tuyên bố ("chỉ khác góc nhìn, không khác dữ liệu") — còn thực tế đang khác.

---

## Tự kiểm tra

1. Vì sao thông báo công tắc ở `Home` viết bằng `open` (giá trị cũ) mà vẫn đúng? → Vì `setOpen` chỉ có hiệu lực ở lần render sau; trong handler, `open` vẫn là trạng thái trước khi bấm, nên câu chữ mô tả đúng việc vừa xảy ra.
2. Vì sao màn biên nhận **không** cho nhập số tiền? → Tiền là giá trị dẫn xuất từ kg × giá × biểu phí; cho nhập tay sẽ tạo hai nguồn dữ liệu và phá đối soát.
3. `Catalog` dùng `!` ở `WASTES.find(...)` có nguy hiểm không? → Không, vì `rows` được sinh từ chính `WASTES`; khác với `!` trên `INCOMING` (nguồn ngoài).
4. `Requests` chia danh sách thế nào và có vấn đề gì? → `pending` hiện thẻ lớn, `status !== "pending"` hiện bảng; nhưng bảng gộp cả đơn đã huỷ/bị từ chối dưới tiêu đề "Lịch đã nhận".
5. Vì sao "Bạn thực nhận" ở màn cơ sở là sai? → `net` là tiền người dân nhận sau phí; cơ sở trả `gross`. Nhãn đang gán sai chủ thể.

**Tiếp:** `09 · Khu Nhân viên` — 11 trang (điều phối, đối soát, xử lý tranh chấp).
