# 05 · Lớp dữ liệu — 13 file trong `src/data/`

Đây là nơi chứa **toàn bộ nội dung** của app: giá rác, đơn hàng mẫu, bài blog,
danh sách nhân viên, cấu hình phí… Không có API, nên đây chính là "database"
của bản demo.

## 1. Vì sao tách riêng

Một trang như `pages/admin/Home.tsx` dài 300 dòng. Nếu nhét thêm 50 dòng số liệu
dashboard, 30 dòng danh sách khiếu nại vào, không ai đọc nổi phần bố cục. Tách ra:

```
src/data/          src/pages/
┌──────────┐       ┌──────────────────┐
│ con số   │──────▶│ bố cục + sự kiện │
│ danh sách│ import│ không biết số    │
│ câu chữ  │       │ đến từ đâu       │
└──────────┘       └──────────────────┘
```

Lợi ích cụ thể:

- Đổi giá PET từ 5.500 → 6.000: sửa **một** dòng, cả 5 màn hình đổi theo.
- Đọc một trang: biết ngay phần nào là "khung", phần nào là "nội dung".
- Không có chỗ nào tự bịa số riêng → hết cảnh "trang A ghi 214.500 kg, trang B
  ghi 214,5 tấn".

## 2. Bốn kiểu file trong `data/`

| Kiểu | File | Đặc điểm |
| --- | --- | --- |
| **Chỉ dữ liệu** | `insights.ts`, `partners.ts`, `map.ts`, `scanner.ts`, `nav.ts` | toàn hằng số, không hàm |
| **Dữ liệu + kiểu** | `portal.ts`, `ops.ts` | có `type` mô tả hình dạng |
| **Dữ liệu + hàm tính** | `waste.ts`, `handover.ts`, `cashflow.ts`, `rewards.ts`, `feedback.ts` | hàm thuần: vào số → ra số, không đụng DOM |
| **Dữ liệu + localStorage** | `checkin.ts` | ngoại lệ duy nhất, có đọc/ghi ổn định |

"Hàm thuần" (pure function) nghĩa là: cùng đầu vào luôn cho cùng đầu ra, không
đọc `localStorage`, không gọi mạng, không sửa biến bên ngoài. Nhờ vậy có thể
test bằng một dòng `assert` mà không cần trình duyệt.

## 3. Sơ đồ phụ thuộc

```
                    ┌──────────────┐
                    │  waste.ts    │  ← gốc: loại rác + giá + phí
                    └──────┬───────┘
                           │ FEE_RATE
              ┌────────────┼─────────────┐
              ▼            ▼             ▼
      ┌─────────────┐ ┌──────────┐ ┌──────────┐
      │ handover.ts │ │ cashflow │ │  ops.ts  │
      │  đơn hàng   │ │  dòng tiền│ │ vận hành │
      └──────┬──────┘ └──────────┘ └────┬─────┘
             │                          │
             ▼                          ▼
      pages/user/*              pages/staff/*, pages/admin/*
      pages/recycler/*
```

Chỉ `waste.ts` là không import file data nào khác — nó là nguồn gốc của mọi con
số tiền. Đây là lý do `FEE_RATE` được khai báo ở đó chứ không ở `cashflow.ts`.

---

# PHẦN A — Nhóm tiền và giao dịch

## 4. `waste.ts` (148 dòng) — danh mục rác, trái tim của miền nghiệp vụ

### 4.1 Kiểu `Waste` (dòng 9–19)

```ts
export type Waste = {
  id: string
  name: string
  group: "Nhựa" | "Giấy" | "Kim loại" | "Thủy tinh" | "Điện tử" | "Hữu cơ"
  price: number
  recyclable: boolean
  rule: string
  prep: string
}
```

`group` là union 6 chuỗi thay vì `string`. Nhờ vậy gõ `"Nhua"` là TypeScript báo
đỏ, và `WASTE_GROUPS` có thể dùng lại đúng 6 giá trị đó.

`rule` là câu mô tả **cái gì thuộc nhóm này**; `prep` là **cần làm gì trước khi
giao**. Hai câu trả lời cho hai câu hỏi khác nhau, nên tách.

### 4.2 Dữ liệu (dòng 31–122)

10 loại rác, mỗi loại 7 trường. Vài điểm đáng chú ý về nghiệp vụ:

| id | Giá/kg | Vì sao |
| --- | --- | --- |
| `aluminum` | 14.000 | cao nhất trong nhóm tái chế — nhôm tái sinh rẻ hơn luyện mới rất nhiều |
| `battery` | 25.000 | cao nhất bảng, nhưng `prep` yêu cầu dán băng keo cực pin — rủi ro cháy |
| `glass` | 900 | thấp, vì thủy tinh nặng và giá trị vật liệu thấp |
| `organic` | 0 | `recyclable: false` — không phải phế liệu bán được, chỉ là rác hữu cơ |

🔍 Con số `organic` là 0 **có chủ ý**, không phải thiếu dữ liệu. Nó khiến
`estimate()` tự động trả 0 đồng cho rác hữu cơ mà không cần câu `if` riêng.
Xem dòng 130 bên dưới.

### 4.3 `estimate()` (dòng 127–135) — tính tiền tạm tính

```ts
export function estimate(items: { wasteId: string; kg: number }[]) {
  const lines = items.map((it) => {
    const w = WASTES.find((x) => x.id === it.wasteId)
    const unit = w?.recyclable ? (w?.price ?? 0) : 0
    return { ...it, unit, total: unit * it.kg }
  })
  const gross = lines.reduce((s, l) => s + l.total, 0)
  return { lines, gross }
}
```

Từng bước với đầu vào `[{wasteId:"carton", kg:15}, {wasteId:"pet", kg:5}]`:

```
1. items.map(...)
   - it = { wasteId:"carton", kg:15 }
   - WASTES.find(x => x.id === "carton")  → { price:2200, recyclable:true, ... }
   - unit = recyclable ? price : 0        → 2200
   - return { ...it, unit:2200, total:33_000 }

2. lines = [
     { wasteId:"carton", kg:15, unit:2200, total:33_000 },
     { wasteId:"pet",    kg:5,  unit:5500, total:27_500 },
   ]

3. reduce((s,l) => s + l.total, 0)  →  60_500

4. return { lines, gross: 60_500 }
```

Ba chi tiết đáng học:

- `w?.` — nếu `wasteId` không tồn tại, `w` là `undefined`; `w?.price ?? 0` trả 0
  thay vì crash. **Không tin dữ liệu đầu vào**, kể cả khi nó đến từ chính app.
- `w?.recyclable ? ... : 0` — rác hữu cơ có `price: 0` **và** `recyclable: false`,
  nên dù sau này ai sửa giá hữu cơ thành 2.000 thì nó vẫn ra 0. Hai lớp bảo vệ.
- `{ ...it, unit, total }` — giữ nguyên `wasteId`, `kg`, thêm 2 trường tính ra.
  Không sửa object gốc.

`gross` = tổng trước phí. Chưa trừ gì.

### 4.4 `FEE_RATE` và `settle()` (dòng 139–146)

```ts
export const FEE_RATE = 0.08

export function settle(gross: number) {
  const fee = Math.round(gross * FEE_RATE)
  return { gross, fee, net: gross - fee }
}
```

Luồng tiền của một giao dịch:

```
   Người dân giao 60.500đ phế liệu
              │
              ▼
   ┌──────────────────────┐
   │ gross = 60.500       │  tổng giá trị
   └──────────┬───────────┘
              │ × 8%
              ▼
   ┌──────────────────────┐
   │ fee = 4.840          │  nền tảng giữ
   └──────────┬───────────┘
              │ gross - fee
              ▼
   ┌──────────────────────┐
   │ net = 55.660         │  về tài khoản người dân
   └──────────────────────┘
```

`Math.round` vì tiền Việt không có phần lẻ. Nếu cộng dồn nhiều dòng mà không
làm tròn, sai số sẽ tích tụ.

🔍 `FEE_RATE` nằm ở đây chứ không ở `cashflow.ts`: cả biên nhận, đối soát, cấu
hình phí đều dùng **một** con số. Nếu mỗi nơi khai báo riêng, đổi phí 8% → 10%
sẽ có chỗ vẫn 8% — và đó là lý do phát sinh khiếu nại.

## 5. `handover.ts` (164 dòng) — đơn bàn giao

### 5.1 Trạng thái là một máy trạng thái (dòng 13–30)

```ts
export type HandoverStatus =
  | "pending" | "accepted" | "collected" | "done"
  | "cancelled" | "declined" | "broken"
```

Bảy trạng thái, đi theo luồng:

```
              ┌──────────┐
   User tạo → │ pending  │
              └────┬─────┘
        ┌──────────┼───────────┐
        │          │           │
        ▼          ▼           ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ accepted │ │ declined │ │cancelled │  ← User huỷ
  └────┬─────┘ └──────────┘ └──────────┘
       │  (Recycler huỷ giữa chừng → broken)
       ▼
  ┌───────────┐
  │ collected │  Recycler đã cân, chờ User xác nhận
  └─────┬─────┘
        ▼
   ┌────────┐
   │  done  │  User xác nhận → giải ngân
   └────────┘
```

Vì sao tách `declined`, `cancelled`, `broken` thay vì một `cancelled` chung:

| Trạng thái | Ai làm | Ý nghĩa nghiệp vụ |
| --- | --- | --- |
| `cancelled` | User | người dân đổi ý |
| `declined` | Recycler | từ chối ngay từ đầu (quá xa, không đủ khối lượng) |
| `broken` | Recycler | đã nhận rồi mới huỷ → **phải có lý do**, ảnh hưởng uy tín |

Ba chuyện khác nhau, ba cách xử lý khác nhau. Gộp lại thì không biết ai có lỗi.

`STATUS_LABEL` (dòng 22–30) dịch mã sang tiếng Việt. `TONE` (dòng 146–154) map
sang 4 màu của component `Status`. Tách 2 bảng vì một bên là **chữ**, một bên là
**màu** — đổi màu không nên phải sửa chữ.

### 5.2 Kiểu `Handover` (dòng 36–50)

```ts
export type Handover = {
  id: string
  recycler: string
  address: string
  date: string
  slot: string
  lines: HandoverLine[]
  status: HandoverStatus
  reason?: string     // chỉ khi broken
  actual?: HandoverLine[]  // Recycler cân thực tế
  feeRate?: number    // chốt tại thời điểm nhận tiền
}
```

Hai trường `?` quan trọng:

- `actual` — User ước tính 5 kg, Recycler cân được 6,2 kg. **Số nào dùng để trả
  tiền?** Số thực. `calc()` xử lý việc này.
- `feeRate` — phí **chốt tại thời điểm giao**. Nếu Admin đổi phí từ 8% lên 10%
  hôm nay, đơn tuần trước vẫn phải tính 8%. Đây là lý do phải lưu phí vào đơn
  thay vì đọc `FEE_RATE` hiện tại.

🔍 Đây là bài học kinh điển về dữ liệu tài chính: **luôn lưu tỉ lệ đã áp dụng**,
đừng suy ra từ cấu hình hiện tại. Nếu không, báo cáo cũ sẽ tự thay đổi khi cấu
hình đổi.

### 5.3 `calc()` (dòng 158–164)

```ts
export function calc(h: Handover, priceOf: (id: string) => number) {
  const src = h.actual ?? h.lines
  const gross = src.reduce((s, l) => s + l.kg * priceOf(l.wasteId), 0)
  const rate = h.feeRate ?? FEE_RATE
  const fee = Math.round(gross * rate)
  return { gross, fee, net: gross - fee, rate }
}
```

- `h.actual ?? h.lines` — có số cân thực thì dùng, chưa có thì dùng ước tính của User.
- `priceOf` là **hàm truyền vào**, không import trực tiếp. Nhờ vậy `handover.ts`
  không phụ thuộc `waste.ts` (ngoài `FEE_RATE`), và test có thể truyền bảng giá giả.
  Đây gọi là **dependency injection** — nhưng chỉ là một tham số, không cần framework.
- `h.feeRate ?? FEE_RATE` — đơn cũ chưa có `feeRate` thì lấy mặc định.

---

# PHẦN B — Điểm và phần thưởng

## 6. `rewards.ts` (187 dòng) — hai loại điểm

Đây là quyết định thiết kế quan trọng nhất của file:

```ts
export const RANK_POINTS = 23_400   // điểm xếp hạng, tích luỹ trọn đời
export const SPEND_POINTS = 12_400  // điểm tiêu dùng, trừ khi đổi quà
```

```
Một người dùng có:
  RANK_POINTS  = 23.400   ── dùng để tính hạng: "Rừng" (≥15.000)
  SPEND_POINTS = 12.400   ── dùng để đổi quà

  Đã đổi = 23.400 - 12.400 = 11.000 điểm
```

Nếu chỉ có một con số, đổi một món quà 2.000 điểm sẽ làm **tụt hạng** — người
dùng bị phạt vì đã tiêu điểm. Tách hai số thì đổi quà không ảnh hưởng thứ hạng.

`TIERS` (dòng 16–21) là các ngưỡng. `tierProgress()` (dòng 95–102):

```ts
const span = next.min - cur.min        // khoảng cách giữa 2 hạng
const done = RANK_POINTS - cur.min     // đã đi được bao xa
pct = Math.round((done / span) * 100)
need = next.min - RANK_POINTS
```

Với 23.400 điểm: hạng hiện tại "Rừng" (≥15.000), hạng sau "Đại dương" (≥30.000).

```
  15.000 ────────●────────────── 30.000
                23.400
  done = 8.400   span = 15.000   pct = 56%
  need = 6.600 điểm nữa
```

`.at(-1)` lấy phần tử cuối mảng đã lọc — cần ES2022, đúng target trong `tsconfig`.

## 7. `checkin.ts` (76 dòng) — file duy nhất ghi localStorage

### 7.1 Vì sao được phép

`ponytail:` ở dòng 4–6 giải thích: điểm danh mà không nhớ trạng thái thì vô
nghĩa. Không có backend, nên phải lưu ở trình duyệt. Hàm vẫn được viết **thuần**
(nhận `key`, không tự biết key nào) để sau này thay bằng server chỉ cần đổi chỗ gọi.

### 7.2 `dayKey()` — bài học về múi giờ (dòng 14–17)

```ts
export function dayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
```

Vì sao không dùng `d.toISOString().slice(0,10)`: `toISOString` đổi sang **UTC**.
Ở Việt Nam (UTC+7), 6 giờ sáng ngày 1/10 giờ địa phương là 23 giờ ngày 30/9 UTC
→ `toISOString` trả `2026-09-30`. Điểm danh sáng 1/10 sẽ bị tính là 30/9.

`getMonth()` trả 0–11 nên phải `+1`. `padStart(2,"0")` để `9` thành `"09"`, giữ
định dạng `yyyy-mm-dd` so sánh chuỗi được.

### 7.3 Chuỗi 7 ngày (dòng 48–75)

```
CHECKIN_REWARDS = [20, 30, 50, 70, 100, 150, 500]

Ngày 1 → 20     Ngày 5 → 100
Ngày 2 → 30     Ngày 6 → 150
Ngày 3 → 50     Ngày 7 → 500
Ngày 4 → 70     rồi quay lại ngày 1
```

Tổng một chu kỳ = 920 điểm; riêng ngày 7 là 500 (hơn nửa). Đó là **cái móc**:
người dùng có lý do quay lại đúng ngày 7 thay vì bỏ giữa chừng.

`checkIn()` (dòng 66–76):

```ts
const carried = streakAlive(v, today) ? v.day : 0
return {
  next: { day: (carried + 1) % CHECKIN_DAYS, last: today },
  gained: CHECKIN_REWARDS[carried],
}
```

```
Chuỗi còn sống, đã 3 ngày  → carried = 3 → gained = 70  → next.day = 4
Chuỗi đứt,      đã 3 ngày  → carried = 0 → gained = 20  → next.day = 1
Đã 6 ngày, điểm danh tiếp   → carried = 6 → gained = 500 → next.day = 0
```

`% 7` là chỗ "quay vòng". `streakAlive` (dòng 57–63) kiểm tra `last` có phải
hôm qua không; đặc biệt `day === 0` **không** đủ để nói chuỗi đứt, vì sau ngày
7 `day` về 0 nhưng chuỗi vẫn sống.

---

# PHẦN C — Vận hành (staff/admin)

## 8. `ops.ts` (413 dòng) — "database" của khu nội bộ

File lớn nhất trong `data/`, gom 9 mảng:

| Mảng | Dùng ở | Nghiệp vụ |
| --- | --- | --- |
| `AI_CASES` | `/staff/ai-review` | ảnh AI đoán sai, chờ gán nhãn lại |
| `DATASET` | `/staff/dataset` | thống kê độ chính xác theo nhóm rác |
| `APPLICATIONS` | `/staff/applications` | hồ sơ xin làm cơ sở thu mua |
| `COMPLAINTS` | `/staff/complaints` | khiếu nại giao dịch |
| `ACCOUNTS` | `/staff/accounts` | tài khoản user/recycler |
| `STAFF`, `PERMS` | `/admin/staff`, `/admin/permissions` | nhân viên và quyền |
| `POSTS` | `/staff/blog`, `/admin/blog` | bài blog chờ duyệt |
| `ECO_FACTS`, `GIFTS` | `/staff/ecofacts`, `/staff/gifts` | nội dung và kho quà |
| `STATS` | `/admin` | dashboard |

### 8.1 `pending` — số liệu tự tính, không nhập tay (dòng 338–343)

```ts
pending: {
  aiCases: AI_CASES.filter((c) => !c.inDataset).length,
  applications: APPLICATIONS.filter((a) => a.status === "pending").length,
  complaints: COMPLAINTS.filter((c) => c.status !== "resolved").length,
  posts: POSTS.filter((p) => p.status === "pending").length,
}
```

Đây là điểm sáng của file. Nếu ai đó nhập cứng `aiCases: 3`, thì khi duyệt một
ảnh, con số trên dashboard vẫn là 3 → sai ngay. Tính từ mảng gốc thì **luôn khớp**
với danh sách bên dưới.

🔍 Nguyên tắc: **một dữ liệu, một nguồn**. Số đếm là *hàm* của dữ liệu, không
phải một con số độc lập.

### 8.2 `TREND_PEAK` và `AI_SCAN_PEAK` (dòng 373–379)

```ts
export const TREND_PEAK = Math.max(...STATS.trend.map((t) => t.handovers))
export const AI_SCAN_PEAK = Math.max(...STATS.aiByGroup.map((g) => g.scans))
```

Biểu đồ cột cần biết "cột cao nhất là bao nhiêu" để quy về 100%. Nếu hardcode
`3.640`, thêm tháng mới cao hơn là cột tràn ra ngoài.

`AI_SCAN_PEAK` có comment rất đáng đọc: hai dãi thanh (lượt quét / báo sai) phải
dùng **cùng** một thang đo. Nếu mỗi dãi tự chuẩn hoá theo max của nó, cột "báo
sai" nhỏ xíu vẫn dài bằng cột lớn nhất → mắt so sánh sai.

### 8.3 `GAMIFICATION` và `FEE` (dòng 383–410)

Hai khối cấu hình, hiển thị ở `/admin/gamification` và `/admin/fees`.
`FEE.rate` **import** `FEE_RATE` từ `waste.ts` thay vì khai báo lại — đúng
nguyên tắc một nguồn.

`FEE.fixed = 2.000` là phí cố định mỗi lượt thu gom, cộng thêm 8% biến đổi.
Trong `waste.ts` chỉ có phần biến đổi; phần cố định mới xuất hiện ở màn cấu hình.

---

# PHẦN D — Nội dung và cấu hình giao diện

## 9. `scanner.ts` (84 dòng) — "AI" giả lập

```ts
export const SCAN_RESULT = {
  image: "/assets/scanner/b7b43.png",
  tag: "Nhựa PET (#1)",
  confidence: 92,
  ...
  breakdown: [
    { label: "Chai nhựa (PET)", value: 92, color: "var(--color-brand)" },
    ...
  ],
}
```

Không có model AI nào. Bấm "quét" thì `Scanner.tsx` chờ `SCAN_MS = 2600` ms rồi
hiện đúng object này. Đó là lý do kết quả **luôn giống nhau** dù chụp gì.

Chi tiết đáng học ở dòng 12: `color: "var(--color-brand)"` thay vì `"#278733"`.
Dùng token màu thì đổi theme một chỗ là biểu đồ đổi theo; hardcode hex là tạo ra
sắc xanh thứ hai lệch tông.

Phần comment dài dòng 24–45 ghi lại lịch sử nén ảnh GIF → WebP (giảm 74%). Đây
là loại ghi chú cứu người sau: nếu không có nó, ai thấy 3 file `.webp` sẽ tưởng
làm mất file gốc.

## 10. `map.ts` (64 dòng) — ghim bản đồ bằng phần trăm

```ts
pos: { top: "49.03%", right: "47.92%", bottom: "45.03%", left: "43.92%" }
```

Ảnh bản đồ là một ảnh tĩnh, ghim định vị bằng **phần trăm** so với ảnh. Cách này
chạy được ở mọi kích thước màn hình mà không cần thư viện bản đồ (Leaflet/Mapbox).
Đánh đổi: không zoom, không kéo, không có toạ độ thật.

🔍 Với một trang demo, đây là lựa chọn đúng: thêm Leaflet là thêm 150 KB JS và
một API key, chỉ để hiển thị 4 cái ghim.

## 11. `partners.ts`, `insights.ts`, `nav.ts`, `portal.ts`

Bốn file thuần nội dung:

- `partners.ts` — 4 nhà máy tái chế + danh sách vật liệu/khu vực để lọc.
- `insights.ts` — bài nổi bật + 3 số liệu + 3 bài báo. `METRICS` có `tone: "warn" | "good"`
  vì comment ghi rõ: **không dùng màu xanh cho tin xấu**.
- `nav.ts` — menu ngang, menu mobile, cột footer. Sửa menu = sửa file này.
- `portal.ts` — menu sidebar của 4 vai trò. Đường dẫn ở đây **phải khớp** `App.tsx`;
  thêm route mà quên thêm menu thì người dùng không có đường vào.

⚠️ `portal.ts` và `App.tsx` là **hai danh sách song song**. Không có gì kiểm tra
chúng khớp nhau. Đây là nợ kỹ thuật đã được ghi trong comment, chấp nhận vì chỉ
có 4 vai trò. Nếu lên 10 vai trò, nên sinh menu từ chính bảng route.

---

# PHẦN E — Ba phát hiện khi review dữ liệu

Đây là những chỗ **số liệu không khớp nhau giữa các file**. Với demo thì không
crash, nhưng nếu đem đi bảo vệ/đánh giá, người xem sẽ thấy ngay.

## Phát hiện 1 — Tiền trong `cashflow.ts` không khớp `handover.ts`

Đơn `BH-2609-0184`: 15 kg carton (2.200đ) + 5 kg PET (5.500đ)

```
handover.calc()  → gross = 15×2.200 + 5×5.500 = 60.500đ
                     fee  = 4.840đ
                     net  = 55.660đ

cashflow.ts      → payin = 19.143đ
                     fee   =  1.543đ
                     payout= 17.600đ
```

Hai bộ số không liên quan gì đến nhau. Đơn `BH-2609-0121` cũng lệch
(86.160đ tính ra, 95.402đ trong cashflow). Chỉ đơn `BH-2608-0409` khớp
(18 kg × 900 = 16.200 → fee 1.296 → net 14.904).

**Ảnh hưởng:** trang Lịch sử dòng tiền và trang Biên nhận hiển thị hai con số
khác nhau cho cùng một đơn.

**Cách sửa:** sinh `FLOWS` từ `MY_HANDOVERS` bằng `calc()` thay vì nhập tay.

## Phát hiện 2 — `cashflow.ts` không đủ 3 dòng cho mọi giao dịch

Comment đầu file nói mỗi giao dịch có 3 dòng: `payin`, `fee`, `payout`. Thực tế:

| handoverId | payin | fee | payout |
| --- | --- | --- | --- |
| BH-2609-0184 | ✅ | ✅ | ✅ |
| BH-2609-0121 | ✅ | ✅ | ✅ |
| BH-2608-0409 | ❌ | ❌ | ✅ |

Đơn thứ ba thiếu 2 dòng → màn Đối soát của Admin sẽ thấy "thiếu tiền vào" giả tạo.

## Phát hiện 3 — Điểm danh hiển thị sai khi chuỗi đã đứt

`CheckIn.tsx` dòng 60 và 78:

```tsx
const next = nextReward(v, today)
...
{done ? "Đã điểm danh hôm nay" : `Còn ${fmt(next)} điểm hôm nay`}
```

`nextReward()` (dòng 48–51 của `checkin.ts`) tính theo `v.day` **mà không kiểm
tra chuỗi còn sống**:

```ts
return CHECKIN_REWARDS[(v.day % CHECKIN_DAYS)]
```

Kịch bản: điểm danh 5 ngày liên tiếp (`day = 5`), nghỉ 3 ngày.

```
Màn hình hiện:  "Còn 150 điểm hôm nay"   ← nextReward(day=5) = CHECKIN_REWARDS[5]
Bấm nút:        nhận 20 điểm, day quay về 1
```

Vì `checkIn()` có kiểm tra `streakAlive` và đặt `carried = 0`. Giao diện và hành
vi lệch nhau đúng 130 điểm. Lưới 7 ô bên dưới cũng tô 5 ô là "đã điểm danh"
dù chuỗi đã đứt (dòng 85: `const passed = i < v.day`).

**Cách sửa gợi ý:** trong `CheckIn.tsx`, dùng `const alive = streakAlive(v, today)`
rồi `const shownDay = alive ? v.day : 0`, và tính `next` từ `shownDay`. Hoặc sửa
`nextReward` để tự gọi `streakAlive`.

⚠️ Đây là bug **thật**, không phải chuyện thẩm mỹ: người dùng thấy một đằng,
nhận một nẻo.

---

# PHẦN F — Muốn đổi gì thì sửa ở đâu

| Muốn đổi | Sửa file | Ghi chú |
| --- | --- | --- |
| Giá một loại rác | `waste.ts` → `WASTES` | mọi màn hình tính tiền đổi theo |
| Phí nền tảng | `waste.ts` → `FEE_RATE` | `ops.ts` tự lấy theo |
| Thêm loại rác | `waste.ts` → `WASTES` + `WASTE_GROUPS` | nhớ cả 2 |
| Đơn hàng mẫu | `handover.ts` | |
| Lịch sử tiền | `cashflow.ts` | nên sinh từ `handover` (xem phát hiện 1) |
| Điểm/ngưỡng hạng | `rewards.ts` → `TIERS` | và `ops.ts` → `GAMIFICATION.tiers` |
| Thưởng điểm danh | `checkin.ts` → `CHECKIN_REWARDS` | mảng phải giữ 7 phần tử |
| Câu hỏi FAQ, SLA | `feedback.ts` | |
| Menu | `nav.ts`, `portal.ts` | `portal.ts` phải khớp `App.tsx` |
| Số liệu dashboard | `ops.ts` → `STATS` | `pending` tự tính, đừng nhập tay |
| Kết quả AI mẫu | `scanner.ts` → `SCAN_RESULT` | |
| Ghim bản đồ | `map.ts` → `PINS` | toạ độ là %so với ảnh |
| Bài blog | `insights.ts`, `ops.ts` → `POSTS` | |

---

## Tự kiểm tra

1. Vì sao `estimate()` trả 0 cho rác hữu cơ mà không cần `if`? → Vì `organic` có `price: 0` và `recyclable: false`; biểu thức `w?.recyclable ? price : 0` xử lý cả hai.
2. Vì sao `Handover` phải lưu `feeRate`? → Để đơn cũ giữ đúng phí lúc giao, không bị đổi khi Admin thay đổi cấu hình.
3. `RANK_POINTS` khác `SPEND_POINTS` ở đâu? → Rank là tích luỹ trọn đời dùng để xếp hạng; Spend là số còn lại để đổi quà, bị trừ khi đổi.
4. Vì sao `dayKey` không dùng `toISOString`? → Vì `toISOString` đổi sang UTC, ở UTC+7 sẽ lệch ngày vào buổi sáng.
5. Vì sao `pending` trong `STATS` được tính bằng `.filter().length`? → Để số trên dashboard luôn khớp với danh sách thật, không phải nhập tay rồi lệch.

**Tiếp:** `06 · Trang công khai` — bắt đầu từ `Home`, `Scanner`, `MapPage`.
