# 11 · Khu Quản trị I — theo dõi, báo cáo, đối soát, phí

Khu admin có 13 trang, ~1.890 dòng — lớn nhất trong bốn vai trò. Chia làm hai
tài liệu:

- **Tài liệu này (11)** — bốn trang "số và tiền": `Home`, `Reports`,
  `Reconciliation`, `Fees`.
- **Tài liệu 11b** — chín trang còn lại: danh mục, chính sách, gamification, nội
  dung, tài khoản nội bộ.

Tất cả nằm trong `AdminShell` (tài liệu 10) và import từ `@/components/admin/ui`.
Không trang nào có navbar hay footer.

```
/admin                 → Home.tsx           319 dòng   A-01 dashboard & thống kê
/admin/reports         → Reports.tsx        163 dòng   A-02 xuất báo cáo
/admin/reconciliation  → Reconciliation.tsx 122 dòng   A-11 đối soát dòng tiền
/admin/fees            → Fees.tsx           138 dòng   A-10 cấu hình phí
```

---

# 1. `Home.tsx` — bảng điều khiển, và ba thứ đã bị bỏ đi

File dài nhất của khu (319 dòng), nhưng phần lớn độ dài nằm ở **comment ghi lại
lịch sử thiết kế**. Đây là thứ đáng đọc trước.

## 1.1 Ba lần sửa, ba luật thiết kế bị vi phạm

Comment dòng 11–22:

```
1. Bỏ dãy 4 thẻ số liệu giống hệt nhau (hero-metric template)
   → thay bằng StatRow kẻ ngang, số thẳng hàng như báo cáo tài chính

2. Bỏ biểu đồ cột: nó và bảng bên dưới in ra CÙNG 6 con số
   → giữ bảng, vẽ thanh nhỏ trong từng dòng
     (một biểu diễn, số chính xác đọc được, thêm tháng sau không phải vẽ lại)

3. Thanh bên trong ô thay vì 4 thẻ tách rời
   → danh sách có thứ tự, phải cho thấy phần đóng góp của từng loại so với tổng
```

Ba luật bị vi phạm, gọi tên được:

| Luật | Bị vi phạm ở | Sửa bằng |
| --- | --- | --- |
| **Hero-metric template** — 4 hộp to giống nhau, ai cũng làm | dãy thẻ `Stat` | `StatRow` kẻ ngang, không viền |
| **Trùng lặp biểu diễn** — cùng dữ liệu vẽ hai kiểu | biểu đồ cột + bảng 6 tháng | bỏ biểu đồ, thanh trong ô |
| **Mất thứ tự** — 4 ô cùng cỡ cho 4 mức độ khác nhau | 4 thẻ việc tồn đọng | thanh tỉ lệ trong một danh sách |

🔍 Đọc comment này là đọc được **cách người viết tự review**: không phải "đẹp/xấu"
mà "vi phạm luật nào, sửa bằng gì, được gì". Ai làm bảng điều khiển lần sau có sẵn
ba cái bẫy để tránh.

## 1.2 Hàng đợi việc — có `share` để thấy trọng số

```tsx
const queue = [
  { to: "/staff/ai-review",  label: "Ảnh AI sai",  n: STATS.pending.aiCases },
  ...
].sort((a, b) => b.n - a.n)

const queueTotal = queue.reduce((s, q) => s + q.n, 0)
...
<div style={{ width: `${(q.n / queueTotal) * 100}%` }} className="h-full bg-brand" />
```

Hai chi tiết:

1. **`.sort((a, b) => b.n - a.n)` chạy trên mảng tạm** — `queue` là mảng vừa khai
   báo ngay trên, không phải `const` nhập từ `data/`. Nên `sort` ở đây an toàn.
   Đúng câu hỏi phải hỏi mọi lần gặp `.sort` (đã ghi ở tài liệu 09/10).
2. **`share` biến con số thành bề rộng** — 7 ảnh AI trên tổng 10 việc thì thanh
   dài 70%. Nhìn một giây biết việc nào ngốn nhất. Bốn ô số rời không cho được
   thông tin đó: `3, 3, 2, 2` không nói lên là bằng nhau một nửa.

⚠️ `queueTotal` bằng 0 (hết sạch việc, admin dọn xong) thì `q.n / queueTotal` =
`0 / 0` = **`NaN`**, và `width: NaN%` là CSS không hợp lệ nên trình duyệt bỏ qua
thanh đó. Tác dụng thực tế: thanh biến mất — trùng hợp là kết quả đúng, nhưng là
đúng do may. Cách viết chắc: `const share = queueTotal ? (q.n / queueTotal) * 100 : 0`.

## 1.3 Xu hướng: số + thanh, dùng chung một thang

```tsx
const peak = Math.max(...s.trend.map((t) => t.value), 1)
...
<Scale value={t.value} peak={peak} />
```

`peak` tính **một lần** cho cả 6 dòng, rồi truyền xuống. Nếu mỗi dòng tự chia cho
`Math.max(...)` của riêng nó thì mọi thanh đều dài 100% — biểu đồ vô nghĩa. Đây là
lỗi rất hay gặp khi vẽ thanh bằng CSS, và đây là cách tránh: **một thang cho cả
nhóm**.

`Math.max(..., 1)` — thêm 1 vào phép so để nếu 6 tháng đều bằng `0` thì mẫu số
không bằng 0. Cùng loại phòng hờ với `Math.max(..., 1.5)` ở `ColumnChart`.

## 1.4 Tăng trưởng — giá trị dẫn xuất, có xử lý tháng đầu

```tsx
const growth = (i: number) => {
  const prev = s.trend[i - 1]?.value
  if (!prev) return null                       // tháng đầu: chưa có gì để so
  return ((s.trend[i].value - prev) / prev) * 100
}
...
{g === null ? "—" : `${g >= 0 ? "+" : ""}${g.toFixed(1)}%`}
```

Ba điều đáng học trong 6 dòng:

1. `s.trend[i - 1]?.value` — tháng thứ nhất (`i = 0`) truy cập `trend[-1]` = 
   `undefined`; `?.` biến nó thành `null` thay vì ném lỗi.
2. `if (!prev) return null` — chặn chia cho 0. Không có nó, tăng trưởng tháng 1 là
   `Infinity`.
3. Dấu `+` thêm tay vì `toFixed` không thêm dấu dương.

Giá trị tăng trưởng **không được lưu ở đâu** — nó là hàm, tính lại mỗi render. Đây
là luật xuyên suốt repo (tài liệu 08 §3.2): không lưu cái tính được.

## 1.5 `sr-only` — chữ cho trình đọc màn hình

```tsx
<span className="sr-only">xu hướng giảm</span>
```

Thanh giảm vẽ màu khác, nhưng "màu đỏ" không nói được gì với trình đọc màn hình.
`sr-only` là class Tailwind: phần tử vẫn nằm trong DOM và được đọc, nhưng bị đẩy
khỏi tầm mắt bằng kỹ thuật CSS (1px, cắt tràn). Đây là cách bổ sung thông tin chỉ
có bằng thị giác — cùng tinh thần với `Status` luôn kèm chữ.

## 1.6 ⚠️ Lỗi chính tả

```tsx
body="...là lớm đang mất tiền..."
```

`lớm` → `lớp`. Lỗi thứ ba trong bộ sưu tập chính tả của repo (`Bãn ra`,
`Hãi hỏi`). Cả ba đều nằm trong **chuỗi hiển thị cho người dùng** — loại lỗi mà
`tsc` và mọi bài kiểm thử render đều không bắt được.

---

# 2. `Reports.tsx` — bốn bảng, một cấu trúc

## 2.1 `SHEETS`: cấu hình bằng dữ liệu, lần thứ hai

```tsx
type Row = Record<string, string | number>
const SHEETS: Record<string, { label: string; head: string[]; rows: () => Row[] }> = {
  users: {
    label: "Người dùng và cơ sở thu mua",
    head: ["Mã", "Tên", "Email", "Vai trò", "Khu vực", "Ngày tham gia", "Giao dịch"],
    rows: () => ACCOUNTS.map((a) => ({
      "Mã": a.id, "Tên": a.name, "Email": a.email,
      "Vai trò": a.role === "user" ? "Người dân" : "Cơ sở thu mua",
      ...
    })),
  },
  handovers: { ... },
  cashflow:  { ... },
  posts:     { ... },
}
```

Bốn nút xuất file, **một** cấu trúc. Điểm đáng chú ý: `rows` là **hàm**, không phải
mảng — cùng lý do với `answer` trong `Assistant` (tài liệu 10 §4.1): dữ liệu được
đọc lúc bấm nút, không phải lúc nạp file.

🔍 `Row = Record<string, string | number>` và khoá là **chuỗi tiếng Việt** (`"Mã"`,
`"Tên"`). Vì sao không dùng mảng `string[]`? Vì chính những khoá đó là tiêu đề cột
trong file CSV. Dùng `Record` thì thêm/xoá cột là sửa một chỗ, và không sợ lệch thứ
tự giữa `head` và từng ô dữ liệu. Tên khoá tiếng Việt trong code là điều bình
thường khi tên đó **chính là nội dung xuất ra**.

## 2.2 Hàm `toCsv` — chuẩn RFC 4180 trong 12 dòng

```tsx
const cell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const toCsv = (head: string[], rows: Row[]) =>
  [head.join(","), ...rows.map((r) => head.map((h) => cell(r[h])).join(","))].join("\r\n")
```

Bốn thứ đang được làm đúng, và đều là **bắt buộc** để Excel mở file không hỏng:

1. **Bọc dấu ngoặc kép khi ô chứa `,`, `"` hoặc xuống dòng.** Địa chỉ
   `"Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1"` có dấu phẩy — không bọc thì nó bị
   cắt thành 3 cột và cả file lệch từ đó trở đi.
2. **Nhân đôi dấu ngoặc kép bên trong** (`""`). Đây là quy ước của CSV, không phải
   lỗi.
3. **`\r\n`** chứ không `\n`: RFC 4180 yêu cầu CRLF, và Excel trên Windows đọc chắc
   nhất với nó.
4. **`String(v)`** ở đầu — dữ liệu có `number` (tiền, số giao dịch), và `cell` chỉ
   làm việc với chuỗi.

⚠️ Hai chỗ chưa hoàn hảo, nêu để biết mức độ:

- Ô chứa ký tự tab cũng nên bọc; ở đây không, vì dữ liệu app không có tab.
- `/["\n]/` không bắt `\r` đơn lẻ. Dữ liệu nhập từ form không thể có `\r` một mình.

## 2.3 Tải file: Blob + BOM

```tsx
const csv = "\uFEFF" + toCsv(sheet.head, sheet.rows())
const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }))
const a = document.createElement("a")
a.href = url
a.download = `ecolink-${key}-${new Date().toISOString().slice(0, 10)}.csv`
a.click()
URL.revokeObjectURL(url)
```

- **`"\uFEFF"` (BOM)** — 3 byte vô hình ở đầu file. Không có nó, Excel mở CSV UTF-8
  bằng bảng mã ANSI và `"Nguyễn Đức"` thành `"Nguyá»…n Äá»©c"`. Đây là chi tiết mà
  ai từng xuất CSV tiếng Việt đều phải biết, và ở đây có kèm cả chú thích vì sao.
- **`URL.createObjectURL`** — biến chuỗi trong bộ nhớ thành một địa chỉ tạm
  (`blob:...`) để gán vào `a.href`. Không có nó thì phải làm việc với file thật
  hoặc mã base64 dài ngoẵng.
- **`a.click()` trên thẻ không gắn vào DOM** — trình duyệt vẫn xử lý tải xuống. Đây
  là cách tải file bằng JS gọn nhất, không cần thư viện.
- **`revokeObjectURL`** — giải phóng địa chỉ tạm.

⚠️ `revokeObjectURL` gọi **ngay** sau `click()` là điểm cần biết: hầu hết trình
duyệt đã sao chép dữ liệu xuống ổ đĩa theo cách bất đồng bộ, nên thu hồi ngay vẫn
tải được. Safari đời cũ thì có thể hỏng. Cách chắc chắn hơn là
`setTimeout(() => URL.revokeObjectURL(url), 0)` — hoặc đơn giản cứ để vậy; đánh đổi
một dòng cho một rủi ro nhỏ trên trình duyệt hiếm dùng.

## 2.4 ⚠️ Hai ô ngày là đồ trang trí, và chú thích nói sai

```tsx
<Field label="Từ ngày" hint="Chỉ dùng để ghi vào tên file, không lọc dữ liệu xuất.">
  <input type="date" className={input} />
</Field>
```

Chữ nói: ngày này *được ghi vào tên file*. Đọc code tải file:

```tsx
a.download = `ecolink-${key}-${new Date().toISOString().slice(0, 10)}.csv`
```

Ngày trong tên file **không** lấy từ ô nhập — nó là ngày hôm nay. Hai ô `date` không
nằm trong state nào, không được truyền đi đâu, không ảnh hưởng gì. Chúng là **ảnh
chụp giả của một tính năng chưa có**, và tệ hơn: câu chú thích khiến người dùng tin
rằng chúng có tác dụng.

Đây là dạng lỗi đáng nhớ nhất trong bộ tài liệu này: **chú thích nói dối còn nguy
hiểm hơn không có chú thích**, vì nó làm người sau *thôi* kiểm tra. Đã gặp ba lần:
`UNLOCKED = 2` (tài liệu 07), `Không cho nhân viên tự khoá chính mình`
(tài liệu 11b §6), và chỗ này.

Kèm một chi tiết nhỏ cùng chủ đề: `new Date().toISOString()` là giờ **UTC**. Ở
Việt Nam (UTC+7), từ 0h đến 7h sáng, `toISOString()` vẫn là ngày hôm qua — file tải
lúc 6h sáng ngày 2/10 sẽ tên là `...-2026-10-01.csv`. `data/checkin.ts` đã tránh
đúng cái bẫy này bằng `dayKey()` (tài liệu 10 §5.1), nhưng ở đây thì chưa. Nếu
định sửa, dùng luôn `dayKey()` ở đó — hàm đã có sẵn trong repo.

## 2.5 CSV xuất mã thô, màn hình hiện nhãn

```tsx
cashflow: {
  head: ["Mã giao dịch", "Mã bàn giao", "Loại", "Số tiền", "Đối tác", "Ngày", "Ghi chú"],
  rows: () => FLOWS.map((f) => ({ ..., "Loại": f.kind, ... })),
}
```

`f.kind` là `"payin" | "fee" | "payout"`; trên màn hình `/admin/reconciliation`
người ta thấy "Thu vào từ đối tác", "Phí nền tảng", "Bãn ra về tài khoản"
(`KIND_LABEL`). File xuất ra cho kế toán thì toàn mã tiếng Anh. Cùng vấn đề với
`"Trạng thái": h.status` (`"collected"`, `"broken"`).

Đây là **lần thứ ba trong repo** gặp cặp bài toán "mã dữ liệu vs nhãn hiển thị", và
là lần đầu nó lộ ra ở đầu ra cho người ngoài (kế toán, kiểm toán). Sửa một dòng:
`"Loại": KIND_LABEL[f.kind]`, `"Trạng thái": STATUS_LABEL[h.status]` — cả hai bảng
nhãn đã tồn tại sẵn.

## 2.6 Bảng xem trước

```tsx
<table className="...">
  <thead><tr>{sheet.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
  <tbody>
    {sheet.rows().slice(0, 8).map((r, i) => (
      <tr key={i}>{sheet.head.map((h) => <td key={h}>{r[h]}</td>)}</tr>
    ))}
  </tbody>
</table>
```

`key={i}` ở đây **được phép**: dữ liệu xem trước là tĩnh, chỉ cắt 8 dòng, không có
thao tác nào làm thay đổi thứ tự. `key={i}` chỉ thành lỗi khi danh sách bị sắp xếp
lại, chèn, xoá (như `EcoFacts` ở tài liệu 09 §8.2). Phân biệt được hai trường hợp
này là một trong những thứ hữu ích nhất khi đọc React.

`sheet.rows()` gọi **hai lần** trong một render (một cho tải file, một cho xem
trước) — với 4 bảng vài chục dòng thì không đáng bận tâm. Chỉ nên nhớ: nếu `rows`
làm việc nặng thì chỗ này là chỗ tính lại thừa.

---

# 3. `Reconciliation.tsx` — trang đối soát, và nó đang bắt được lỗi thật

## 3.1 Gom nhóm thay vì liệt kê

```tsx
const groups = [...new Set(FLOWS.map((f) => f.handoverId))]
  .map((id) => {
    const rows = FLOWS.filter((f) => f.handoverId === id)
    const payin  = rows.find((r) => r.kind === "payin")?.amount  ?? 0
    const fee    = rows.find((r) => r.kind === "fee")?.amount    ?? 0
    const payout = rows.find((r) => r.kind === "payout")?.amount ?? 0
    const expectedFee = Math.round(payin * FEE.rate)
    const ok = payin - fee === payout && fee === expectedFee
    return { id, payin, fee, payout, expectedFee, ok, date: rows[0].date }
  })
  .sort((a, b) => (a.id < b.id ? 1 : -1))
```

```tsx
new Set(FLOWS.map(f => f.handoverId))
   │
   ├─ "BH-2609-0184"
   ├─ "BH-2609-0121"
   └─ "BH-2608-0409"
        │  .map(id => lọc 3 dòng của id đó, tính ok)
        ▼
   [{ payin 19.143, fee 1.543, payout 17.600, ok: false }, ...]
```

`Set` là cách lấy danh sách giá trị **không trùng** — 9 dòng tiền → 3 mã bàn giao,
không cần tự viết vòng lặp kiểm tra "đã thấy mã này chưa". `?? 0` cho trường hợp
thiếu dòng (chính là ca của `BH-2608-0409`).

🔍 Comment dòng 7–9 ghi vì sao gom nhóm: *"mỗi giao dịch có 3 dòng và việc cần
chứng minh là 3 dòng đó khớp nhau. Bảng theo dòng sẽ phải tự dò ba dòng cạnh nhau
 bằng mắt."* Đây là suy nghĩ về **việc người dùng đang làm**, không phải về cấu
trúc dữ liệu. Dữ liệu là 9 dòng; việc cần làm là 3 phép so sánh bộ ba.

## 3.2 Trạng thái là kết luận tính ra, không phải cờ lưu sẵn

```tsx
const ok = payin - fee === payout && fee === expectedFee
```

Comment dòng 11–13:

> Trạng thái tính từ dữ liệu chứ không lưu: đã đủ 3 dòng và tổng khớp là "Đã đối
> soát", lệch là "Chênh lệch". Lưu kết luận riêng là có thêm chỗ để trạng thái và
> dữ liệu lệch nhau.

Đây là nguyên tắc quan trọng nhất của trang, và nó đúng ở mọi hệ thống tài chính:
**trạng thái đối soát là một phép tính, không phải một trường**. Nếu lưu
`status: "matched"` vào dữ liệu rồi sau đó sửa số tiền, bạn có một bản ghi nói
"khớp" với số không khớp. Không lưu thì không thể lệch.

Hai vế của phép `&&`:

```
vế 1: payin - fee === payout     → phí bị trừ đúng bằng phần chênh
vế 2: fee === expectedFee        → phí đó đúng bằng tỉ lệ 8% đã cấu hình
```

Chỉ kiểm vế 1 thì một giao dịch bị trừ phí 50% vẫn "khớp". Chỉ kiểm vế 2 thì thiếu
dòng pay-out vẫn "khớp". Cần cả hai — và đây là ví dụ tốt về một điều kiện đúng
được chia thành hai câu hỏi độc lập.

## 3.3 Mở trang này sẽ thấy gì (đối chiếu tài liệu 05)

Ba nhóm trong `FLOWS`:

| Mã | payin | fee | payout | `expectedFee` | Kết quả hiện trên màn hình |
| --- | --- | --- | --- | --- | --- |
| `BH-2609-0184` | 19.143 | 1.543 | 17.600 | `round(19143 × 0.08)` = 1.531 | ❌ **Chênh lệch** |
| `BH-2609-0121` | 95.402 | 7.632 | 87.770 | `round(95402 × 0.08)` = 7.632 | ✅ Đã đối soát |
| `BH-2608-0409` | 0 (thiếu dòng) | 0 (thiếu dòng) | 14.904 | 0 | ❌ **Chênh lệch** |

Đây là điều đáng chú ý nhất của cả tài liệu: **trang đối soát đang hoạt động đúng
và nó chỉ ra lỗi dữ liệu thật.** Hai dòng "Chênh lệch" không phải lỗi của trang —
chúng là hai lỗi của `data/cashflow.ts` đã ghi ở tài liệu 05:

1. `BH-2609-0184`: phí ghi 1.543 nhưng 8% của 19.143 là 1.531 — lệch 12 đồng. (Và
   như tài liệu 05 đã chỉ ra, cả 19.143 cũng không khớp với con số 60.500 mà
   `calc()` tính từ `handover.ts` cho cùng mã đó.)
2. `BH-2608-0409`: chỉ có dòng payout, thiếu pay-in và phí — trái với chính chú
   thích trong file ("mỗi giao dịch thành công tạo ra 3 dòng"). Hệ quả: 14.904 đồng
   được bắn cho người dân mà không có dòng tiền nào chứng minh nó vào.

Bài học: dựng đúng một màn hình kiểm tra chéo có thể phát hiện lỗi dữ liệu mà
không cần viết một dòng kiểm thử nào. Đây chính là lý do các bảng đối soát tồn tại
trong hệ thống thật.

## 3.4 Chi tiết nhỏ

- `rows[0].date` — lấy ngày của dòng đầu trong nhóm. An toàn vì nhóm luôn có ít
  nhất một dòng (nó được sinh ra từ chính `FLOWS.map`).
- `.sort((a, b) => (a.id < b.id ? 1 : -1))` — so **chuỗi**, giảm dần. Với
  `BH-2609-*` và `BH-2608-*` thì cho kết quả đúng (mới nhất lên đầu) vì mã có cùng
  độ dài và số đứng sau `BH-`. Nếu mã đổi định dạng (`BH-1`, `BH-10`) thì thứ tự
  sai ngay (`"BH-10" < "BH-9"`). Sắp theo chuỗi chỉ đúng khi các chuỗi có cùng hình
  dạng — ghi nhớ điều này khi thấy `.sort` trên mã.
- Dòng tổng kết dưới bảng ghi rõ phải làm gì với phần lệch ("Cần tra webhook
  VietQR"). Thông báo nói **bước tiếp theo**, không chỉ nói "có lỗi".
- Ô chi tiết tiền dùng `fmtInt(f.amount) + " đ"` thay vì `fmtVnd(f.amount)` đã có
  sẵn — cùng kết quả, hai cách viết. Không sai, chỉ là chỗ nên thống nhất.

---

# 4. `Fees.tsx` — cấu hình phí, và ba điều nó không làm

## 4.1 Một con số, một nguồn — phần đúng

```ts
// data/waste.ts
export const FEE_RATE = 0.08

// data/ops.ts
import { FEE_RATE } from "@/data/waste"
export const FEE = { rate: FEE_RATE, fixed: 2_000, minNet: 5_000, effectiveFrom: "01/09/2026" }
```

`ops.ts` **import** con số từ `waste.ts` chứ không chép lại. Comment trong
`Fees.tsx` ghi lịch sử:

> Đổi ở đây thì cả ba nơi cùng đổi — trước khi gộp, mỗi nơi một hằng số và cả ba đã
> lệch nhau một lần.

Ba nơi dùng: `settle()` (giải ngân), `calc()` (`handover.ts` — biên nhận), và trang
này. Một hằng số, ba chỗ đọc. Đây là mô hình đúng (đối chiếu với `pointsPerKg` ở
tài liệu 11b).

## 4.2 Vì sao KHÔNG có nút "Áp dụng"

Comment dòng 12–14:

> Không có nút "Áp dụng" vì con số này quyết định tiền thật cho hàng nghìn giao
> dịch đang chạy: ô số bị sửa dở thì đổi luôn là sai tiền. Ở đây chỉ ghi ra giá
> trị đang áp dụng.

Đây là quyết định **an toàn theo thiết kế**: bỏ tính năng để không tạo ra đường
làm sai. Nút "Lưu phí" hiện tại chỉ hiện thông báo, không đổi `FEE` — và với mức độ
nghiêm trọng của con số này thì đó là lựa chọn hợp lý cho demo. Trong app thật, chỗ
này cần thêm: người duyệt thứ hai, ngày hiệu lực (`effectiveFrom` đã có sẵn trong
dữ liệu nhưng chưa dùng), và một màn hình lịch sử thay đổi phí.

## 4.3 ⚠️ Ô xem trước trộn số đang gõ với hằng số

```tsx
const [rate, setRate] = useState(FEE.rate)
...
<label>Phí nền tảng {Math.round(rate * 100)}%</label>   ← đọc STATE (số đang gõ)
...
const sample = settle(500_000)                           ← đọc HẰNG SỐ FEE_RATE
...
<dd>{fmtVnd(sample.fee)}</dd>
```

Gõ `12` vào ô tỉ lệ:

```
   "Phí nền tảng 12%"          ← nhãn: theo số vừa gõ   ✅ phản hồi ngay
   Số tiền phí:    40.000 đ    ← tiền: theo 8% cũ        ✗ không đổi
   Số tiền về:    460.000 đ    ← tiền: theo 8% cũ        ✗ không đổi
```

Bảng "Ví dụ với giao dịch 500.000 đ" nằm ngay cạnh, chú thích nói nó dùng *"cùng
công thức chạy ở giải ngân tự động và ở biên nhận"* — nhưng một nửa bảng đọc state,
một nửa đọc hằng số. Người cấu hình gõ 12% và thấy 40.000 (đúng ra là 60.000), rồi
tin rằng phí mới đã được tính đúng.

Cách sửa rẻ nhất — cho cả hai nửa cùng đọc state:

```tsx
const sampleFee = Math.round(500_000 * rate) + fixed
const sampleNet = 500_000 - sampleFee
```

(Đây cũng là chỗ để nói luôn về `FEE.fixed`, xem 4.4.)

## 4.4 ⚠️ Hai trường cấu hình không được dùng ở đâu

```ts
export const FEE = {
  rate: FEE_RATE,
  fixed: 2_000,       // "phần phí cố định trên mỗi lượt thu gom, đồng"
  minNet: 5_000,      // "Số tiền về tối thiểu"
  effectiveFrom: "01/09/2026",
}
```

Khắp repo chỉ có **hai** chỗ tính phí, cả hai chỉ dùng `rate`:

```ts
// data/waste.ts
export function settle(gross: number) {
  const fee = Math.round(gross * FEE_RATE)     // không có `fixed`
  return { gross, fee, net: gross - fee }      // không có `minNet`
}

// data/handover.ts  (hàm calc)
const fee = Math.round(gross * rate)           // không có `fixed`, không có `minNet`
```

Nghĩa là: Admin có thể gõ "phí cố định 5.000 đ" và "số tiền về tối thiểu 50.000 đ"
trong form này, bấm Lưu, và **không một phép tính nào trong toàn bộ ứng dụng đọc
hai con số đó**. `effectiveFrom` cũng vậy — hiện trên màn hình, không ai đọc.

Ba trường "cấu hình" chỉ để trang trí. Đây là phiên bản số học của vấn đề đã gặp ở
`Reports` §2.4: form tạo ra cảm giác điều khiển được một thứ mà nó không điều khiển.
Khác biệt có ý nghĩa: `FEE.fixed` và `minNet` là **quy tắc nghiệp vụ có thật** trong
mô hình (một lượt thu gom nhỏ có phí cố định, và không ai muốn chuyển 200 đồng), nên
đây là thứ sẽ được dùng khi nối backend — `settle` và `calc` là hai hàm cần sửa.

## 4.5 ⚠️ Ba số liệu chép tay

```tsx
<Stat label="Tổng phí thu 30 ngày" value="147.360.000 đ" note="Bình quân 40.484 đ/giao dịch phí" />
<Stat label="Giao dịch thành công" value="3.640" note="0,24% lỗi đối soát" />
```

`STATS` trong `data/ops.ts` đã có `fee30d` và `handovers30d`. Ba con số trên (kể cả
"40.484" và "0,24%") được gõ tay vào JSX. Đây là **lần thứ ba** trong repo (sau
`user/Gamification` và `staff/CheckIn`) — cùng một thói quen, và đây là môi trường
dễ thấy nhất vì `STATS` nằm ngay trong file dữ liệu mà trang này đã import.

## 4.6 ⚠️ `dirty` không bao giờ trở về `false`

```tsx
const [rate, setRate] = useState(FEE.rate)
const dirty = rate !== FEE.rate || fixed !== FEE.fixed
...
<button disabled={!dirty}>{saving ? "..." : "Lưu phí giao dịch"}</button>
```

`dirty` so **state với hằng số**, mà `FEE` là hằng số không bao giờ đổi. Nên sau khi
bấm Lưu (thông báo "Đã lưu phí mới"), `dirty` vẫn `true` → nút vẫn bật, thông báo
nói đã lưu nhưng form vẫn báo còn thay đổi chưa lưu. Hai tín hiệu mâu thuẫn đứng
cạnh nhau.

Ba input, hai vào state:

```tsx
<input type="number" value={rate}  onChange={(e) => setRate(Number(e.target.value))} />
<input type="number" value={fixed} onChange={(e) => setFixed(Number(e.target.value))} />
<input type="number" defaultValue={FEE.minNet} />   ← không state, không vào `dirty`
```

Ô "Số tiền về tối thiểu" dùng `defaultValue` (không kiểm soát) nên gõ vào cũng không
làm `dirty` bật lên, không ai đọc giá trị. Đây là hệ quả trực tiếp của 4.4.

---

# 5. Bảng phát hiện của bốn trang

| # | Trang | Vấn đề | Mức |
| --- | --- | --- | --- |
| 1 | `Fees` | Bảng xem trước trộn state (`rate`) và hằng số (`settle`) → gõ 12% mà tiền vẫn theo 8% | cao |
| 2 | `Fees` | `FEE.fixed` và `FEE.minNet` cho nhập nhưng không phép tính nào đọc | trung bình |
| 3 | `Reports` | Hai ô ngày trang trí; chú thích nói chúng vào tên file, thực tế không | trung bình |
| 4 | `Reconciliation` | Hiện 2/3 nhóm "Chênh lệch" — do lỗi dữ liệu `cashflow.ts` (đã ghi ở tài liệu 05), không phải lỗi trang | — (bằng chứng) |
| 5 | `Reports` | CSV xuất mã thô (`payin`, `collected`) trong khi màn hình có nhãn tiếng Việt | thấp |
| 6 | `Fees` | Ba số liệu chép tay dù `STATS` có sẵn; `dirty` không về `false` sau khi lưu | thấp |
| 7 | `Home` | Chính tả "lớm"; `queueTotal = 0` → `width: NaN%` | thấp |
| 8 | `Reports` | Tên file dùng ngày UTC (sai ngày trong 7 giờ đầu ngày ở VN) | thấp |

**Đối chiếu nhanh với khu nhân viên (tài liệu 09):** khu staff hầu như chỉ có lỗi
"chép số tay" và "sinh mã", còn khu admin có hai lỗi ở mức cao — đều nằm ở chỗ
**màn hình cấu hình tiền** (phí). Không phải ngẫu nhiên: đây là màn hình khó nhất
trong cả app vì nó vừa hiển thị số, vừa cho sửa số, vừa phải khớp với công thức
đang chạy ở nơi khác. Mọi app thật đều vỡ ở đúng chỗ này.

---

## Tự kiểm tra

1. Vì sao `Home` tính `peak` một lần rồi truyền xuống? → Để cả 6 thanh dùng chung một thang; mỗi dòng tự chia cho cực đại riêng thì thanh nào cũng đầy 100%.
2. `toCsv` phải bọc ngoặc kép khi nào? → Khi ô chứa dấu phẩy, dấu ngoặc kép hoặc xuống dòng; và phải nhân đôi ngoặc kép bên trong.
3. Vì sao file CSV cần `"\uFEFF"` ở đầu? → Excel không có BOM sẽ đọc UTF-8 bằng bảng mã ANSI và làm hỏng chữ tiếng Việt.
4. Vì sao trạng thái đối soát không được lưu thành trường dữ liệu? → Vì nó là kết luận tính từ 3 dòng tiền; lưu riêng thì sửa số tiền xong kết luận sẽ nói sai.
5. `Reconciliation` đang báo "Chênh lệch" ở nhóm nào và vì sao? → `BH-2609-0184` (phí 1.543 ≠ 8% của 19.143) và `BH-2608-0409` (thiếu dòng pay-in và phí).
6. Vì sao `Fees` không có nút "Áp dụng"? → Vì phí quyết định tiền thật cho nhiều giao dịch đang chạy; một ô số sửa dở mà áp dụng ngay là sai tiền.
7. Bảng "Ví dụ giao dịch" ở `Fees` sai thế nào? → Nhãn `%` đọc state `rate`, còn tiền đọc hằng số `FEE_RATE` — gõ tỉ lệ mới thì nhãn đổi mà tiền không đổi.

**Tiếp:** `11b · Khu Quản trị II` — danh mục, chính sách, gamification, nội dung, tài khoản nội bộ (9 trang).
