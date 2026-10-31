# 11b · Khu Quản trị II — cấu hình, nội dung, tài khoản nội bộ

Chín trang còn lại của khu admin, ~1.240 dòng:

| Trang | Dòng | UC | Việc chính |
| --- | --- | --- | --- |
| `Categories.tsx` | 171 | A-05 | danh mục rác: giá, nhóm, luật xử lý |
| `Policy.tsx` | 81 | A-06 | câu chữ chính sách phân loại |
| `Gamification.tsx` | 144 | A-07 | điểm/độ khó lên hạng cây ảo |
| `Leaderboard.tsx` | 92 | A-08 | chu kỳ bảng xếp hạng |
| `BlogReview.tsx` | 113 | A-09 | duyệt / huỷ bài blog |
| `StaffAccounts.tsx` | 119 | A-03 | tạo, khoá, xoá tài khoản nhân viên |
| `Permissions.tsx` | 144 | A-04 | ma trận phân quyền |
| `AccountProfile.tsx` | 211 | — | hồ sơ người đang đăng nhập |
| `AccountPassword.tsx` | 117 | — | đổi mật khẩu nội bộ |

Chín trang này có **một điểm chung đáng nói trước khi đọc từng trang**: chúng đều
là màn hình *cấu hình*, và **bảy trong chín trang không thay đổi được gì ngoài
chính trang đó**. Xem mục 10 để hiểu đây là một sự thật kiến trúc, không phải bảy
lỗi riêng lẻ.

---

# 1. `Categories.tsx` — bảng danh mục rác

## 1.1 Bảng sửa trực tiếp

```tsx
const [rows, setRows] = useState(WASTES)

const set = (id: string, patch: Partial<(typeof WASTES)[number]>) =>
  setRows((rs) => rs.map((w) => (w.id === id ? { ...w, ...patch } : w)))
```

`useState(WASTES)` — chú ý: **không** có `[...WASTES]` hay `.map(w => ({...w}))` như
`Policy.tsx` bên dưới. `rows` và `WASTES` là **cùng một mảng** lúc khởi tạo. Không
gây hại ở đây (`set` luôn tạo mảng mới, không `push`), nhưng là chi tiết cần để ý:
chỉ cần một chỗ viết `rows.push(...)` là mảng dữ liệu gốc bị sửa và mọi trang khác
đọc `WASTES` sẽ thấy dữ liệu lạ. `Policy` chép lại từng object (`{ ...w }`) nên
miễn nhiễm với loại lỗi đó — hai file cùng việc, hai mức phòng hờ khác nhau.

`Partial<(typeof WASTES)[number]>` là TypeScript thuần: `typeof WASTES[number]` =
"kiểu của một phần tử trong mảng", `Partial<...>` = "mọi trường của kiểu đó, có thể
thiếu". Nghĩa là `set(w.id, { price: 3000 })` hợp lệ, không phải truyền cả object.

Bốn cột, bốn kiểu input khác nhau:

| Cột | Control | Chi tiết đáng học |
| --- | --- | --- |
| Nhóm | `<select>` | loại trừ `WASTE_GROUPS[0]` (xem 1.2) |
| Giá | `<input type="number">` | `disabled={!w.recyclable}`, `step={100}` |
| Thu gom được | `<input type="checkbox">` | `accent-brand` để checkbox ăn màu thương hiệu |
| Luật xử lý | `<input type="text">` | `aria-label` vì không có nhãn nhìn thấy |

`aria-label={\`Giá của ${w.name}\`}` trên từng ô: bảng không có `<label>` nhìn thấy
được cho mỗi ô, nên trình đọc màn hình sẽ đọc "spin button" trống nghĩa nếu thiếu.
Đây là cách bù đúng chỗ — và tên loại rác nằm ngay trong nhãn nên người khiếm thị
biết mình đang sửa giá của món nào.

## 1.2 `WASTE_GROUPS.filter((g) => g !== WASTE_GROUPS[0])`

```ts
// data/waste.ts
export const WASTE_GROUPS = ["Tất cả", "Nhựa", "Kim loại", ...] as const
```

`"Tất cả"` ở vị trí 0 là **giá trị dành cho bộ lọc** ở trang `/waste`, không phải
một nhóm rác thật. Ô chọn nhóm ở đây phải bỏ nó ra, nếu không admin có thể gán một
loại rác vào nhóm "Tất cả" — và bộ lọc tra cứu sẽ hiểu sai.

Cách viết `g !== WASTE_GROUPS[0]` hoạt động, nhưng **phụ thuộc vào thứ tự mảng**:
ai đó sắp xếp lại `WASTE_GROUPS` theo alphabet là "Kim loại" bị bỏ khỏi dropdown và
"Tất cả" xuất hiện. Cách chắc hơn: đặt hằng riêng
(`export const ALL_GROUPS = "Tất cả"`) rồi so với hằng đó. Đây là cùng loại vấn đề
với việc dùng `WASTE_GROUPS[0]` làm giá trị mặc định ở trang `/waste` (tài liệu 06c).

## 1.3 ⚠️ Nút "Lưu thay đổi" nói sai sự thật

```tsx
onClick={() => setFlash("Đã lưu. Tra cứu và hướng dẫn phân loại dùng luôn giá mới.")}
```

Câu này khẳng định hai trang khác đã dùng giá mới. Kiểm tra bằng code:

```
/admin/categories  → useState(WASTES)          ← bản sao trong state của trang này
/waste             → đọc WASTES trực tiếp      ← không biết gì về bản sao kia
/guidance          → đọc WASTES trực tiếp
/recycler/catalog  → useState(WASTES.filter(...))  ← bản sao thứ ba
/waste             → cũng có bộ lọc riêng theo WASTE_GROUPS
```

Sửa giá carton ở `/admin/categories` từ 2.200 → 3.000, bấm Lưu, mở `/waste`: vẫn
2.200. **Không trang nào khác thay đổi**, vì mỗi trang giữ bản sao của riêng nó
(đã giải thích ở tài liệu 09 §0).

Nghiêm trọng hơn cả bug: câu thông báo khiến người vận hành **tin rằng việc đã
xong**. Họ sẽ không kiểm tra lại trang tra cứu. Cùng loại lỗi với `Reports` §2.4 và
`Fees` §4.3 (tài liệu 11) — chữ trên màn hình khẳng định một hành vi mà code không
có.

Ở đây có ghi chú trung thực ở cuối trang:

```tsx
<Status tone="wait">
  Giá mới chỉ áp dụng cho các yêu cầu tạo sau này. Yêu cầu đã chốt giữ nguyên giá đã báo.
</Status>
```

Đây là **quy tắc nghiệp vụ đúng** (không hồi tố giá đã chốt) — nhưng nó lại củng cố
cảm giác "giá mới đã được áp dụng". Hai câu trong cùng một trang nói hai điều khác
nhau về cùng một nút bấm.

## 1.4 `AddForm` — form con, và lỗi im lặng

```tsx
function AddForm({ onAdd }: { onAdd: (w: (typeof WASTES)[number]) => void }) {
  ...
  onSubmit={(e) => {
    e.preventDefault()
    if (name.trim().length < 3 || rule.trim().length < 10) return   // ← không nói gì
    onAdd({ id: `w-${Date.now().toString(36)}`, name: name.trim(), group: "Nhựa", ... })
  }}
```

Hai điều:

1. **`onAdd` là prop, không phải state chung.** `AddForm` không biết gì về `rows`;
   nó chỉ gọi `onAdd(w)` và trang cha làm phần còn lại. Nhờ vậy form con ngắn và có
   thể test riêng. Đây là cách tách "form nhập" khỏi "danh sách" — cùng cấu trúc với
   `Field` (tài liệu 10) nhưng ở cấp lớn hơn.
2. ⚠️ **Validate thất bại mà không báo gì.** Gõ tên `"Cốc"` (3 ký tự, đủ) nhưng luật
   xử lý 5 ký tự → bấm "Thêm vào danh mục" → không có gì xảy ra, không có chữ nào
   giải thích. Người dùng bấm lại vài lần rồi bỏ. Mọi form khác trong repo đều
   `setFlash(...)` (tài liệu 09 §4.1), riêng hai chỗ im lặng: đây và `recycler/Receipt`.

Giá trị mặc định khi thêm mới:

```tsx
group: "Nhựa",        // luôn là Nhựa, admin phải sửa lại ngay sau khi thêm
recyclable: true,     // luôn thu gom được
prep: "Làm sạch và tách vật liệu khác nếu có.",   // câu chung cho mọi loại
```

Ba giá trị cứng nghĩa là form mới tạo được **một loại rác kiểu duy nhất**; sau khi
thêm, admin phải quay lại bảng để sửa nhóm và luật. Không sai (mặc định hợp lý, sửa
được ngay), nhưng nếu thêm 5 loại nhựa liên tiếp thì 5 lần gõ `prep` giống nhau.

Mã sinh bằng `Date.now().toString(36)` — **cách sinh mã đúng nhất trong repo** (đã
khen ở tài liệu 09 §9.2). Điểm đáng chú ý: chính file này vừa có một lỗi lớn (1.3)
vừa có một chi tiết làm đúng nhất. Không file nào "tốt" hay "xấu" toàn bộ.

## 1.5 `Math.max(...rows.map((w) => w.price))` — và ca rỗng

```tsx
Giá cao nhất {VND(Math.max(...rows.map((w) => w.price)))}/kg.
```

Xoá hết mọi loại rác khỏi danh mục (không có nút xoá, nhưng dữ liệu có thể rỗng)
→ `Math.max()` với mảng rỗng = `-Infinity` → câu hiện ra: *"Giá cao nhất -Infinity
đ/kg"*. Cùng loại với `peak` ở `admin/Home` (tài liệu 11 §1.3).

`...` (spread) còn có giới hạn: với mảng vài trăm nghìn phần tử, `Math.max(...arr)`
tràn ngăn xếp vì mỗi phần tử là một đối số hàm. Ở đây có ~14 loại rác.

---

# 2. `Policy.tsx` — câu chữ, và hai trang cùng sửa một trường

## 2.1 Một dòng đáng học: sao chép cạn

```tsx
const [rules, setRules] = useState(
  WASTES.filter((w) => w.recyclable).map((w) => ({ ...w })),
)
```

`filter` **và** `map((w) => ({ ...w }))`. Nếu chỉ có `filter`, `rules` là mảng mới
nhưng **các phần tử vẫn là object của `WASTES`** — `set` sẽ tạo object mới bằng
spread nên vẫn an toàn, nhưng lúc đó chỉ cần một chỗ viết `r.rule = "..."` là sửa
thẳng dữ liệu gốc. Chép cạn từng phần tử là **cách nói rõ ý định**: "trang này sở
hữu bản sao của riêng nó". Chi phí: một vòng lặp thừa 14 lần chạy. Đáng.

## 2.2 ⚠️ Cùng trường `rule` với `Categories`

```tsx
// Policy.tsx
<Field label="Câu luật hiện cho người dân">
  <input value={r.rule} onChange={(e) => set(r.id, { rule: e.target.value })} />
</Field>
```

`rule` cũng chính là cột "Luật xử lý" của `/admin/categories`. **Hai trang admin
khác nhau sửa cùng một trường của cùng một bản ghi, trong hai bản sao khác nhau.**
Sửa ở trang này thì trang kia không đổi; tải lại thì cả hai về như cũ.

Đây không phải "hai màn hình cho hai mục đích" (như `Portal` vs `admin/ui` ở tài
liệu 10 §3) — đây là **cùng một việc, hai cửa vào**. Với app có backend thì đây là
chỗ tranh chấp dữ liệu (hai admin sửa một trường, người sau ghi đè người trước).

Câu chữ ở nút Lưu cũng khẳng định điều không xảy ra:

```tsx
setFlash("Đã lưu. Hướng dẫn phân loại và kết quả AI hiện câu mới ngay.")
```

## 2.3 Thẻ "Điểm thưởng theo khối lượng" tự mâu thuẫn

```tsx
<p className="text-sm leading-6 text-body">
  Người dùng nhận <b>{GAMIFICATION.pointsPerKg}</b> điểm xanh cho mỗi kg bàn giao...
  Đây là con số dùng chung với bảng xếp hạng và đổi thưởng — đổi ở đây thì cả hai nơi đổi theo.
</p>
<Status tone="wait">
  Bảng điểm hiện ở trang đổi thưởng là dữ liệu mô phỏng. Nối API thì đọc từ cấu hình này, đừng hardcode ở trang.
</Status>
```

Câu đầu nói "dùng chung, đổi là cả hai nơi đổi"; khung ngay dưới nói "hiện là dữ
liệu mô phỏng, nối API thì hãy đọc từ đây". **Người viết biết sự thật** — đó là lý
do khung cảnh báo tồn tại — nhưng câu phía trên vẫn ở thể khẳng định hiện tại. Trong
một tài liệu cho người mới, đây là ví dụ tốt nhất về **chú thích cũ không được xoá
khi code đổi**: khung cảnh báo là bản sửa của câu trên, nhưng câu trên chưa bị sửa.

Và sự thật kỹ thuật: grep `GAMIFICATION` trong toàn bộ `src/`, chỉ có **hai** chỗ
đọc nó — chính trang này (hiển thị chữ) và `/admin/gamification` (sửa). Không phép
tính điểm nào trong `data/rewards.ts` đọc `pointsPerKg`. Xem §3.2.

---

# 3. `Gamification.tsx` — màn hình cấu hình, và bản sao thứ hai của `TIERS`

## 3.1 Bảng hạng: sửa được, và một chỗ khoá đúng

```tsx
<Table head={["Hạng", "Điểm tối thiểu", "Chi phí mở Eco Fact"]}>
  {tiers.map((t, i) => (
    <tr key={t.name}>
      ...
      <input value={t.min} disabled={i === 0} onChange={...} />
```

`disabled={i === 0}` — hạng đầu tiên (Mầm) luôn ở mốc 0; cho sửa là tạo ra "hạng
Mầm cần 3.000 điểm", nghĩa là người mới không có hạng nào. Một chỗ khoá đúng, kèm
`aria-label` cho từng ô.

🔍 Nhưng **thứ tự tăng dần của các mốc không được kiểm**. Đặt Cây = 99.000 (trong
khi Rừng = 15.000) là hợp lệ với form, và mọi phép tính hạng đều sai từ đó:
`tierProgress()` trong `data/rewards.ts` tìm hạng bằng `TIERS.filter(t => RANK_POINTS >= t.min).at(-1)` và hạng kế bằng `find(t => RANK_POINTS < t.min)` — với mốc không tăng dần, `cur` và `next` có thể trùng nhau hoặc nhảy cóc, và `need = next.min - RANK_POINTS` có thể ra số âm. Thêm hai dòng kiểm khi Lưu là chặn được cả lớp lỗi này.

## 3.2 ⚠️ Bảng hạng ở đây là **bản sao** của `TIERS`

Đây là phát hiện quan trọng nhất của tài liệu này.

```
   data/ops.ts                          data/rewards.ts
   ┌──────────────────────────┐         ┌──────────────────────────┐
   │ GAMIFICATION = {         │         │ export const TIERS = [   │
   │   pointsPerKg: 10,       │         │   { min: 0,     Mầm }    │
   │   labelBonus: 5,         │         │   { min: 5_000, Cây }    │
   │   tiers: [               │         │   { min: 15_000, Rừng }  │
   │     { min: 0,     Mầm,   │ ══════  │   { min: 30_000, Đại    │
   │       factCost: 0 },     │  CÙNG   │              dương }     │
   │     { min: 5_000, Cây }  │  SỐ LIỆU└──────────────────────────┘
   │     { min: 15_000, Rừng }│                  │
   │     { min: 30_000, ... } │                  │ đọc bởi
   │   ] }                    │                  ▼
   └───────────┬──────────────┘         tierProgress(), Profile,
               │ đọc bởi                Rewards, user/Gamification
               ▼
      /admin/gamification (sửa)
      /admin/policy (chỉ hiện chữ)
```

Hai định nghĩa về **cùng một thứ** — ngưỡng lên hạng — nằm ở hai file, trùng khớp
nhau hôm nay. Sửa "Rừng" từ 15.000 → 20.000 trong màn hình admin: màn hình này đổi,
`Profile`, `Rewards`, `user/Gamification` **không đổi**, vì chúng đọc `TIERS`.

Đây là gốc rễ của lỗi `UNLOCKED = 2` đã ghi ở tài liệu 07: khi có hai nguồn cho
cùng một con số, người viết trang thứ ba chọn cách thứ ba — gõ tay.

Cách sửa (một dòng, và là cách đúng): `data/ops.ts` xoá mảng `tiers` của mình, import
`TIERS` từ `rewards.ts`, và bổ sung `factCost` vào đó — hoặc ngược lại, để
`rewards.ts` import `GAMIFICATION.tiers`. Chỉ cần **một** trong hai file sở hữu dữ
liệu. Cũng nên chọn `rewards.ts` vì đó là nơi phép tính hạng đang sống.

Một điểm nữa: `factCost` (chi phí mở Eco Fact) tính theo **hạng**, còn `ECO_FACTS[].cost` tính theo **từng Eco Fact**. Hai hệ giá cho cùng một hành động "mở khoá nội dung". Comment trong `data/ops.ts` nói `factCost` là chi phí mở khoá của nhánh cây; nếu đúng vậy thì nên đặt tên `treeCost` — chữ `fact` đang gợi ý nhầm.

## 3.3 `Thêm hạng mới` — nút mở ra một trạng thái không tồn tại ở nơi khác

```tsx
onClick={() => setTiers((ts) => [...ts, { name: `Hạng ${ts.length + 1}`, min: last.min + 10_000, factCost: 2_500 }])}
```

Thêm hạng thứ 5 tên "Hạng 5": nó chỉ tồn tại trong state trang này. `TIERS` vẫn 4
hạng, và `Status`/`tierProgress` không biết "Hạng 5" là gì. Người dùng thật sẽ không
bao giờ lên được hạng đó.

🔍 Hai nút "Lưu" khác nhau trong một trang:

```
form (điểm mỗi kg + điểm gán nhãn)  → có nút "Lưu cấu hình" (cần bấm)
bảng hạng (mốc + chi phí)           → KHÔNG có nút lưu (đổi là đổi ngay trong state)
```

Hai cơ chế trong một màn hình. Không sai về kỹ thuật (cái sau là "sửa trực tiếp như
bảng tính"), nhưng người dùng phải tự đoán xem thay đổi nào đã được ghi. Nếu mọi thứ
là state cục bộ thì cả hai đều "đã lưu" như nhau — và cả hai đều mất khi tải lại.

## 3.4 Đoạn chữ cuối trang — vì sao tách hai loại điểm

```tsx
Điểm xếp hạng tích luỹ trọn đời và không bị trừ khi đổi quà; điểm tiêu dùng mới bị
trừ. Tách hai loại là để người dùng dám đổi — nếu một con số vừa xếp hạng vừa là
tiền thì đổi quà là tụt hạng, họ sẽ không đổi.
```

Đây là **thiết kế kinh tế**, và là đoạn giải thích tốt nhất trong cả khu admin: nó
nói rõ một quyết định sản phẩm bằng lý lẽ hành vi (người ta không tiêu nếu tiêu là
mất vị trí). Cùng tinh thần với `RANK_POINTS` / `SPEND_POINTS` trong `data/rewards.ts`
(tài liệu 05).

---

# 4. `Leaderboard.tsx` — radio chọn một chu kỳ

```tsx
const [on, setOn] = useState<string>(CYCLES.find((c) => c.active)!.id)
...
<input type="radio" name="cycle" checked={on === c.id}
       onChange={() => { setOn(c.id); setFlash(`Đã chuyển ... ${c.label.toLowerCase()}.`) }} />
```

- **Chỉ một chu kỳ**: comment giải thích vì sao (bật nhiều thì người dùng phải tự
  đoán quý khác tuần thế nào). `on` là **một chuỗi**, không phải mảng boolean — kiểu
  dữ liệu tự nói lên luật. Đây là cách ràng buộc bằng kiểu, rẻ hơn mọi lời nhắc trong
  comment.
- `name="cycle"` + `type="radio"`: trình duyệt tự đảm bảo chỉ một ô được chọn, và
  phím mũi tên di chuyển giữa các ô hoạt động miễn phí. Đây là lựa chọn **đúng chuẩn
  ARIA** (so với nhóm sao ở `user/Receipt` dùng `role="radio"` mà không có phím mũi
  tên — tài liệu 07).
- `CYCLES.find((c) => c.active)!` — dấu `!` lần thứ sáu của repo. An toàn: dữ liệu
  có `week: active === true`.
- `<Status tone={on === c.id ? "ok" : "off"}>` + chữ "Đang tính"/"Tắt": trạng thái
  hiện bằng chữ, không chỉ bằng viền sáng.

⚠️ Nhưng: `CYCLES` được đọc **duy nhất** ở trang này (grep toàn repo xác nhận). Bảng
xếp hạng của người dân (`components/Leaderboard.tsx`) đọc `LEADERBOARD` và không biết
"chu kỳ" là gì. Chuyển sang "Tháng" ở đây rồi mở `/leaderboard`: **cùng 8 người, cùng
số điểm**, chỉ khác chữ tiêu đề ở trang admin. Cấu hình này chưa nối tới thứ nó đang
nói tới điều khiển.

---

# 5. `BlogReview.tsx` — và hai kho bài blog khác nhau

## 5.1 Cơ chế duyệt

Giống `staff/Applications` (§4 tài liệu 09) và cùng triết lý:

```tsx
const decide = (id: string, ok: boolean) => {
  let note: string | undefined
  if (!ok) {
    const reason = window.prompt(`Hủy bài ${id}. Lý do (tác giả sẽ thấy lý do này):`)
    if (!reason?.trim()) return
    note = reason.trim()
  }
  setList((ls) => ls.map((p) => p.id === id ? { ...p, status: ok ? "published" : "rejected", note } : p))
```

Duyệt thì một bấm; huỷ thì phải có lý do. Bảng "Đã xử lý" có cột **Lý do** — đối
xứng với form, đúng như đã học ở `staff/Applications`.

Hai chi tiết nhỏ:

- **Từ ngữ lệch giữa hai khu**: ở đây gọi là "Hủy bài" và mã trạng thái là
  `rejected`; ở `staff/Applications` cùng hành động gọi là "Từ chối". Cùng nghĩa,
  hai từ. Trong trang nhân viên, "huỷ" được dùng cho một việc khác
  (`recycler/Requests.cancel` → `broken`, `user/Handover` huỷ). Nên thống nhất: từ
  chối (người duyệt chặn) ≠ huỷ (người tạo rút lại).
- `Status tone={p.status === "published" ? "ok" : "off"}` — chỉ hai nhánh, vì trang
  chỉ hiện bài đã xử lý. Đúng phạm vi, không viết thừa nhánh.

## 5.2 ⚠️ Bài "xuất bản" không đi tới trang Blog công khai

Câu cuối trang:

```tsx
Bài đã xuất bản xuất hiện ở trang Blog công khai. Hủy một bài đang chạy sẽ gỡ nó
khỏi trang công khai ngay lập tức.
```

Kiểm tra bằng import của trang công khai:

```tsx
// src/pages/Blog.tsx  —  dòng 1
import { ARTICLES, FEATURED, METRICS } from "@/data/insights"
```

Trang `/blog` đọc **`data/insights.ts`**, còn `BlogReview` duyệt **`POSTS` trong
`data/ops.ts`**. Hai kho dữ liệu khác nhau, không liên quan:

```
   staff/BlogEditor ──viết vào──▶ POSTS (ops.ts) ──đọc──▶ admin/BlogReview ✅
                                     │
                                     └──────── ✗ không ai khác đọc

   data/insights.ts (ARTICLES)  ──đọc──▶ pages/Blog.tsx (công khai) ✅
```

Hệ quả: duyệt/xuất bản một bài trong console **không** làm nó xuất hiện trên
`/blog`; huỷ một bài cũng không gỡ gì (bài "đang chạy" đó không nằm trong `POSTS`).
Đây là họ hàng của lỗi ở `Categories` §1.3, nhưng nặng hơn vì nó là **toàn bộ luồng
nghiệp vụ** (S-08 viết → A-09 duyệt → công khai) chứ không chỉ một trường.

Cùng nhóm: `staff/Home` đếm *"X bài blog đã xuất bản"* từ `POSTS`, và
`admin/AccountProfile` đếm *"Bài Blog chờ duyệt"* từ `POSTS` — cả hai đang đếm một
kho mà người dùng không đọc được.

🔍 Đây cũng là chỗ để nói một điều đúng: **hai kho dữ liệu riêng cho hai mục đích
riêng là hợp lý** khi chúng thật sự khác nhau (bài marketing của EcoLink vs bài do
cơ sở đối tác gửi). Vấn đề không phải "phải gộp", mà là **không được nói với người
vận hành rằng hai thứ đó là một**. Một dòng sửa ở câu chữ (hoặc một trường
`source: "partner"` rồi lọc) là đủ.

---

# 6. `StaffAccounts.tsx` — tạo, khoá, xoá nhân viên

## 6.1 ⚠️ Chú thích hứa một ràng buộc không tồn tại

```tsx
/** A-03 Quản lý tài khoản nhân viên.
 *
 *  Không cho nhân viên tự khoá chính mình: người đang đăng nhập mà bị khoá thì
 *  mất đường vào hệ thống cho tới khi có Admin khác sửa. */
export default function StaffAccounts() {
  ...
  const toggle = (id: string) =>
    setList((ls) => ls.map((s) => (s.id === id ? { ...s, status: s.status === "active" ? "locked" : "active" } : s)))
```

`toggle` nhận `id`, **không so với người đang đăng nhập**. Không có `useSession()`
trong file này (kiểm tra bằng import — file chỉ import `STAFF` và
`components/admin/ui`). Nghĩa là: admin bấm "Khoá" trên chính dòng của mình → khoá
được, không có cảnh báo, và không có admin nào khác trong dữ liệu (STAFF chỉ có 3
nhân viên, không có tài khoản admin) → mất đường vào cho tới khi sửa dữ liệu tay.

Đây là lỗi chú thích **nguy hiểm nhất trong repo** vì nó mô tả một biện pháp bảo vệ
mà người đọc sẽ tin là đã có. Bản sửa thật rất ngắn:

```tsx
const me = useSession()
const toggle = (id: string) => {
  if (id === myStaffId) return setFlash("Không thể tự khoá tài khoản đang đăng nhập.")
  ...
}
```

(Cần biết `myStaffId`: `STAFF.find(s => s.name === me?.name)?.id` — cùng cách
`AccountProfile` đang làm ở §8.1.)

## 6.2 Tạo tài khoản — hai điểm tốt, một điểm yếu

```tsx
if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
  setFlash("Email chưa đúng định dạng, nhân viên cần email để đặt lại mật khẩu.")
  return
}
```

Regex này kiểm: có ký tự trước `@`, có ký tự sau `@`, có dấu chấm, và phần đuôi từ
2 ký tự. Nó **không** kiểm mọi thứ (không chặn `a..b@c..d`) và **không nên** kiểm
mọi thứ: RFC 5322 đầy đủ dài hàng nghìn ký tự và vẫn không biết hộp thư có tồn tại
hay không. Cách kiểm email đúng duy nhất là gửi thử một mail. Với form nội bộ, regex
sơ bộ + câu giải thích **vì sao** cần email là mức đúng.

```tsx
// Nhân viên mới vào không có quyền nào: Admin cấp sau bằng trang phân quyền.
// Cấp sẵn ở đây là cách tạo tài khoản có toàn quyền mà không ai duyệt.
perms: [],
```

`perms: []` kèm 2 dòng giải thích — **mặc định an toàn** (deny by default). Cùng
nguyên tắc với "bài nhân viên luôn `pending`" (tài liệu 09 §7).

⚠️ Mã nhân viên:

```tsx
const id = `NV-${String(list.length + 1).padStart(2, "0")}`
```

STAFF có 3 người (`NV-01`..`NV-03`). Xoá `NV-02` → còn 2 phần tử → tạo mới =
`NV-03`, **trùng với nhân viên đang tồn tại**. Cùng lỗi đã ghi ở `staff/EcoFacts`
(tài liệu 09 §8.2): sinh mã từ **độ dài mảng** là công thức sai khi có xoá. Cách
đúng nằm ngay trong repo (`Categories` §1.4 và `staff/Gifts` dùng
`Date.now().toString(36)`).

## 6.3 Câu chữ cuối trang — nửa đúng nửa sai

```tsx
Nhân viên đã gán quyền sẽ mất toàn bộ quyền khi bị khoá. Xoá tài khoản không xoá
lịch sử công việc đã ghi nhận trong báo cáo.
```

`toggle` chỉ đổi `status`; `perms` **giữ nguyên**. Bảng phía trên vẫn hiện "Số quyền"
của người bị khoá. Vậy "mất toàn bộ quyền" chỉ đúng ở nghĩa "không đăng nhập được
nên không dùng được quyền" — nhưng nếu mở khoá lại, số quyền cũ quay lại nguyên vẹn,
chứ không phải cấp lại từ đầu. Câu chữ nên là: *"Nhân viên bị khoá không đăng nhập
được; quyền đã cấp vẫn giữ nguyên và có hiệu lực trở lại khi mở khoá."*

Đây lại là dạng lỗi quen thuộc của cả bộ tài liệu: **chú thích/chữ trên màn hình mô
tả hành vi không có trong code**. Lần này nó không nguy hiểm (không phải bảo mật),
nhưng là lần thứ bảy trong repo — đủ để coi đây là **thói quen cần sửa**, không phải
lỗi lẻ.

---

# 7. `Permissions.tsx` — ma trận phân quyền

## 7.1 Bảng checkbox dựng từ hai mảng

```tsx
{PERMS.map((p) => (
  <th key={p.id} scope="col">{p.label}</th>
))}
...
{list.map((s) => (
  <tr key={s.id}>
    <Td>{s.name}...<span>{s.id}</span></Td>
    {PERMS.map((p) => (
      <td key={p.id}>
        <input type="checkbox" checked={s.perms.includes(p.id)} onChange={() => flip(s.id, p.id)}
               aria-label={`${p.label} cho ${s.name}`} />
      </td>
    ))}
  </tr>
))}
```

`PERMS` × `STAFF` → bảng động, thêm một quyền mới chỉ cần thêm vào `PERMS`. Không
viết cứng cột nào. `scope="col"` trên `<th>` (bảng dữ liệu thật, không phải bảng bố
cục) và `aria-label` từng ô là **"Quyền X cho nhân viên Y"** — người khiếm thị đọc
được cả hai chiều của ma trận, điều mà bảng checkbox thường đánh mất.

```tsx
const flip = (id: string, perm: string) =>
  setList((ls) => ls.map((s) => s.id === id
    ? { ...s, perms: s.perms.includes(perm) ? s.perms.filter((p) => p !== perm) : [...s.perms, perm] }
    : s))
```

Bật = `[...perms, perm]`, tắt = `filter`. Hai thao tác mảng cơ bản (tài liệu 09 §8.1)
áp vào một mảng con — mẫu "sửa một trường là mảng" đáng nhớ.

## 7.2 ⚠️ Hai nút đổi toàn bộ hệ thống, một bấm, không hỏi

```tsx
<button onClick={() => { setList((ls) => ls.map((s) => ({ ...s, perms: PERMS.map((p) => p.id) }))); setFlash("Đã cấp toàn bộ quyền cho tất cả nhân viên.") }}>
  Cấp toàn quyền cho tất cả
</button>
<button onClick={() => { setList((ls) => ls.map((s) => ({ ...s, perms: [] }))); ... }}>
  Thu hồi toàn bộ quyền
</button>
```

Hai cú bấm này **không hỏi lại** trong khi `staff/Accounts.remove` và
`admin/StaffAccounts.remove` đều dùng `window.confirm`. Sai lệch chuẩn ngay trong
cùng một repo: xoá 1 tài khoản thì hỏi, cấp toàn quyền cho 3 người (gồm cả người
đang đăng nhập) thì không. Với hai nút tác động rộng như vậy, `window.confirm` là
mức tối thiểu — hoặc nói rõ hơn: nút "cấp toàn quyền" nên là thao tác từng người,
không phải hàng loạt.

## 7.3 🔍 Đoạn kết — kiến thức bảo mật quan trọng nhất của cả repo

```tsx
Quyền ở đây chỉ ẩn hiện màn hình. Backend vẫn phải tự kiểm tra quyền theo từng API
— nếu không, người dùng gọi thẳng URL là vẫn làm được việc bị cấm.
```

Đây là câu đúng và quan trọng nhất trong khu admin, và nó khớp với cách app đang
chạy: phân quyền ở client (**ẩn/hiện**) không phải bảo mật. Kiểm tra lại bằng
`RequireRole` (tài liệu 03): nó chặn *điều hướng*, nghĩa là chặn người dùng bình
thường bấm nhầm — còn người biết sửa `localStorage` thì vào được mọi khu. Với app
demo (không có backend) đó là đánh đổi chấp nhận được; điều **không** được phép là
quên câu này khi nối API.

Cùng chủ đề, ghi thêm một lần cho rõ: `checked={s.perms.includes(p.id)}` — quyền
được lưu trong state React, và trước khi quyền tải xong thì mặc định là "không có
quyền" (`perms: []`), không phải mặc định "có". Comment trong file nói rõ điều này
(§ngay đầu `Permissions`): *"nhân viên không có bất kỳ quyền nào trông giống nhân
viên có toàn quyền khi quyền chưa tải"*. Đây là nguyên tắc **fail closed** — mặc
định an toàn khi dữ liệu chưa về — được viết ra đúng lúc cần.

---

# 8. `AccountProfile.tsx` — hồ sơ người đang đăng nhập

## 8.1 Tra người đang đăng nhập — và không dùng dấu `!`

```tsx
const session = useSession()
const role = session?.role === "admin" ? "admin" : "staff"
const me = STAFF.find((s) => s.name === session?.name)   // ← KHÔNG có dấu !
...
<dd>{me?.id ?? "QT-01"}</dd>
<dd>{me ? "Vận hành nền tảng" : "Ban quản trị"}</dd>
<dd>{me?.status === "locked" ? "Đang khoá" : "Đang hoạt động"}</dd>
```

Đối chiếu với `AuthForm` (nơi đăng nhập): tài khoản demo `staff` có tên **"Lê Thu
Hà"** — khớp với một người trong `STAFF`, nên `me` tìm thấy. Tài khoản demo `admin`
tên **"Quản trị viên"** — **không** có trong `STAFF`, nên `me` là `undefined`. Cả
hai trường hợp đều chạy đúng, vì mọi chỗ dùng `me` đều có `??`.

🔍 Đây là ví dụ đẹp nhất trong repo về **phòng hờ không-cần-crash**: cùng bài toán
"tra một người trong mảng", `recycler/Receipt` và `user/Receipt` dùng `.find(...)!`
(sẽ trắng trang nếu không thấy), còn ở đây dùng `?.` + giá trị mặc định. Với vai trò
admin — người *không* nằm trong danh sách nhân viên — fallback còn là **thiết kế**:
"Bộ phận: Ban quản trị" là câu trả lời đúng cho một tài khoản quản trị, không phải
câu chữ giữ chỗ.

## 8.2 Validate và tô viền

```tsx
const [err, setErr] = useState("")
...
<input className={`input ${err && name.trim().length < 2 ? "border-warn" : ""}`} ... />
<input className={`input ${err && !/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, "")) ? "border-warn" : ""}`} ... />
```

- Regex số điện thoại: chấp nhận `+84` hoặc `0`, đuôi 9–10 chữ số, và **loại bỏ dấu
  cách/chấm/gạch/ngoặc trước khi kiểm** — nên `0901 234 567` (đúng cách người Việt
  gõ) hợp lệ. Đây là chi tiết mà form ngây thơ hay bỏ sót và chặn nhầm người dùng.
- Tô viền **dựa trên `err` cộng với phép kiểm**, không dựa trên việc so chuỗi thông
  báo: `err && name.trim().length < 2`. Nghĩa là chỉ tô khi *vừa có lỗi* vừa *trường
  này đang sai*. Cách này **tốt hơn** `err.startsWith(...)` đang dùng ở
  `AccountPassword` — không phụ thuộc vào câu chữ thông báo. Nếu ai đó sửa câu
  "Tên hiển thị phải có ít nhất 2 ký tự" thành "Tên cần từ 2 ký tự", cách
  `startsWith` sẽ hỏng còn cách này thì không. Cùng file, hai cách — nên chọn cách
  này.
- `onChange` đặt `setSaved(false)` — sửa xong thì dòng "Đã lưu hồ sơ." biến mất, để
  người dùng không tưởng thay đổi mới đã được lưu. Chi tiết nhỏ, đúng.
- `email` là `readOnly disabled` + câu giải thích *"Email là định danh đăng nhập,
  đổi ở phòng IT"*. Vừa đúng nghiệp vụ vừa dạy người dùng.
- `renameType="tel"` + regex: trên điện thoại bàn phím hiện số.

⚠️ `"Ngày bắt đầu": "12/03/2025"` gõ tay trong JSX (giống nhóm lỗi chép số tay), và
`số điện thoại` khởi tạo bằng `useState("0901 234 567")` — một số điện thoại mẫu
hiện sẵn cho **mọi** người dùng nội bộ.

## 8.3 `Queue` — link dựng theo vai trò, và lý do ghi lại

```tsx
/** Liệt kê RIÊNG theo vai trò, không dùng `/${role}/...` chung: staff và admin
 *  không có cùng bộ màn hình. Admin không có `/admin/applications` và
 *  `/admin/complaints` — dựng link bằng cách ghép chuỗi sẽ dẫn tới trang 404. */
function Queue({ role }: { role: "staff" | "admin" }) {
  const rows = role === "staff" ? [ 4 mục ... ] : [ 2 mục ... ]
```

Đây là **bài học về ghép chuỗi**: cách viết `to={\`/${role}/ai-review\`}` trông
thanh lịch nhưng chỉ đúng khi hai vai trò có cùng bộ màn hình. Một mảng tường minh
cho mỗi vai trò dài hơn 10 dòng nhưng không bao giờ 404. Cùng loại quyết định với
`ACCOUNT_ITEMS` trong `admin/Shell` (tài liệu 10 §2.1).

Và `open === 0 ? "Không có việc nào" : \`${open} việc\`` — trạng thái rỗng được xử
lý bằng chữ, không để "0 việc" trơ ra.

---

# 9. `AccountPassword.tsx` — bảo mật, và một lời hứa không giữ được

## 9.1 Luật mật khẩu

```tsx
if (current.length < 1)          → "Nhập mật khẩu hiện tại."
if (next.length < 12)            → "Mật khẩu mới cần ít nhất 12 ký tự."
if (!/\d/.test(next))            → "Mật khẩu mới phải có ít nhất một chữ số."
if (next !== again)              → "Hai mật khẩu mới không khớp nhau."
if (next === current)            → "Mật khẩu mới phải khác mật khẩu hiện tại."
```

Năm luật, kiểm **theo thứ tự từ chặt tới rộng**: dừng ở lỗi đầu tiên và không dồn
nhiều lỗi vào một dòng. So sánh với `user/Password` (mật khẩu người dân) — ngưỡng
ở đó thấp hơn, và comment đầu file giải thích vì sao hai ngưỡng khác nhau:

> Người dân đổi vì quên, nhân viên đổi vì nghi ngờ lộ; hai việc đó không nên dùng
> chung một ngưỡng.

Đây là suy nghĩ về **ngữ cảnh sử dụng**, không phải về độ dài chuỗi.

## 9.2 ⚠️ Ba lời khẳng định, không có dòng code nào thực hiện

```tsx
/** Bắt buộc mật khẩu hiện tại đúng mới cho đổi: đây là ranh giới tin cậy —
 *  không có nó thì ai đó ngồi máy đã mở khoá cũng đổi được mật khẩu của bạn. */
```

Code kiểm gì với `current`? **Chỉ độ dài ≥ 1.** `"x"` là mật khẩu hiện tại hợp lệ.
Không có gì để so sánh vì app không lưu mật khẩu ở đâu (đăng nhập demo dùng chung
`DEMO_PASS = "123"`).

Câu thứ hai, hiện ngay cho người dùng:

```tsx
setFlash("Đã đổi mật khẩu. Các phiên khác đã đăng xuất.")
```

Không có phiên nào bị đăng xuất; mật khẩu không được lưu; tải lại trang thì "mật
khẩu mới" không tồn tại. Và `PageHead` cũng khẳng định: *"Đổi xong mọi thiết bị khác
đang đăng nhập sẽ mất phiên ngay."*

Điểm đáng ghi nhận: **người viết biết rõ** —

```tsx
// ponytail: chưa có backend. Nối API thì thay đúng dòng này — và đăng xuất
// hết mọi phiên khác, nếu không thì đổi mật khẩu mà kẻ cũ vẫn vào được.
```

Comment này là một trong những dòng giá trị nhất repo: nó nói đúng việc phải làm khi
có backend. Nhưng **cảnh báo nằm trong code, còn lời hứa nằm trên màn hình người
dùng**. Nguyên tắc rút ra, dùng được cho mọi app: *khi tính năng chưa làm, chữ trên
màn hình phải nói "chưa làm" — đừng để comment biết sự thật còn giao diện thì không.*

Mức độ nghiêm trọng: **cao về mặt niềm tin, không phải về lỗ hổng** — vì app không
có backend để xâm nhập. Nhưng nếu copy nguyên khối này sang bản có backend, người
dùng sẽ tin rằng đổi mật khẩu đã ngắt phiên kẻ khác, và họ sẽ **không** báo sự cố.

## 9.3 Chi tiết đúng — và một thói quen xấu

```tsx
autoComplete="current-password"   // ô mật khẩu hiện tại
autoComplete="new-password"       // cả hai ô mật khẩu mới
```

`autoComplete` đúng giúp trình quản lý mật khẩu điền đúng ô và đề xuất mật khẩu mạnh
cho `new-password`. Nhiều form bỏ qua thuộc tính này và làm hỏng luồng của mọi
password manager.

⚠️ Nhưng cách tô viền lỗi thì giòn:

```tsx
<input className={`input ${err.startsWith("Nhập") ? "border-warn" : ""}`} />
<input className={`input ${err.startsWith("Mật khẩu mới cần") || err.startsWith("Mật khẩu mới phải có") ? "border-warn" : ""}`} />
<input className={`input ${err.startsWith("Hai mật khẩu") ? "border-warn" : ""}`} />
```

Viền đỏ phụ thuộc vào **câu chữ** của thông báo. Sửa "Hai mật khẩu mới không khớp
nhau" thành "Mật khẩu nhập lại không đúng" là mất luôn viền đỏ ở ô thứ ba, và không
có lỗi biên dịch nào. Đây là **lần thứ tư** trong repo (`JoinRecycler` — tài liệu 06c;
`user/Receipt`; và chỗ này) — xem §10.3.

Điểm hay: `onChange` của cả ba ô đều `setFlash("")` — gõ lại thì dòng "Đã đổi mật
khẩu..." biến mất, đúng như `AccountProfile` làm với `setSaved(false)`. Cách này đối
lập hẳn với `components/CheckIn` (`flash` giữ mãi, tài liệu 10 §5.3). Trong **cùng
một repo có cả cách đúng và cách sai** cho cùng một vấn đề.

---

# 10. Ba mẫu lỗi lặp lại của khu admin

## 10.1 Màn hình cấu hình không cấu hình được gì

| Trang | Người dùng làm gì | Thực tế xảy ra |
| --- | --- | --- |
| `Fees` | nhập phí cố định 5.000, tiền về tối thiểu | `settle()`/`calc()` chỉ đọc `rate`; hai trường không ai đọc |
| `Gamification` | đổi điểm/kg, thêm hạng | không phép tính điểm nào đọc `pointsPerKg`; `TIERS` là bản sao thứ hai |
| `Leaderboard` | chọn chu kỳ "Tháng" | `CYCLES` chỉ được đọc ở trang này; bảng công khai không biết chu kỳ |
| `Categories` | sửa giá, luật xử lý | các trang tra cứu giữ bản sao riêng |
| `Policy` | sửa câu luật/hướng dẫn | như trên; còn ghi vào cùng trường với `Categories` |
| `BlogReview` | duyệt bài, xuất bản | `/blog` công khai đọc `data/insights.ts`, không đọc `POSTS` |
| `StaffAccounts` | khoá nhân viên | khoá được (có hiệu lực trong state), nhưng chú thích hứa chặn tự khoá |

Bảy trang. Nhìn từng trang thì là bảy bug; nhìn kiến trúc thì là **một sự thật**:
app không có backend, dữ liệu nằm trong `src/data/*.ts`, nên không có cách nào một
thay đổi ở trang này đi tới trang khác. Sửa đúng là sửa **một chỗ** — tầng dữ liệu
(hoặc nối API) — không phải bảy lần.

Điều đáng sửa **ngay** và rẻ nhất không phải là logic, mà là **chữ**: 7 câu thông
báo khẳng định việc đã xong. Đổi `"Đã lưu. Tra cứu ... dùng luôn giá mới"` thành
`"Đã ghi vào bản nháp của phiên làm việc này. Bản thật sẽ đổi khi nối dữ liệu."` là
trung thực và tốn 7 lần sửa chuỗi.

## 10.2 Cặp dữ liệu trùng nguồn

| Khái niệm | Nơi 1 | Nơi 2 | Nơi nào được đọc |
| --- | --- | --- | --- |
| Ngưỡng lên hạng | `GAMIFICATION.tiers` (ops.ts) | `TIERS` (rewards.ts) | `TIERS` — bởi `tierProgress`, `Profile`, `Rewards` |
| Bài blog | `POSTS` (ops.ts) | `ARTICLES` (insights.ts) | cả hai, cho hai màn hình khác nhau |

Đây là bản đồ để tìm lỗi loại "sửa chỗ này chỗ kia không đổi". Quy tắc: **một khái
niệm — một mảng**. Khi cần hai góc nhìn, lọc từ một mảng (`MY_HANDOVERS` /
`INCOMING` là ví dụ làm sai điều này — tài liệu 08 §5).

## 10.3 Tô viền lỗi bằng cách so chuỗi thông báo

Năm chỗ trong repo — **bốn sai, một đúng**:

```
JoinRecycler.tsx        err.startsWith("Họ tên")        → tô viền ô họ tên
user/Receipt.tsx        err.startsWith("Số sao")        → tô viền nhóm sao
admin/AccountPassword   err.startsWith("Hai mật khẩu")  → tô viền ô nhập lại
account/Password.tsx    err.startsWith("Nhập")          → tô viền ô mật khẩu cũ
admin/AccountProfile    err && <phép kiểm>              ← cách đúng, cùng repo
account/Profile.tsx     err && <phép kiểm>              ← cách đúng, thứ hai
```

Hai cách đúng ở hai dòng cuối nằm trong **cặp file song sinh với chính hai file
sai phía trên** (`account/Profile` ↔ `admin/AccountProfile`,
`account/Password` ↔ `admin/AccountPassword`): cùng trang, cùng form, một bản làm
đúng một bản làm sai.

Cách đúng ở dòng cuối: điều kiện tô viền là **điều kiện đã sinh ra lỗi**, không phải
nội dung thông báo. Sửa 3 chỗ kia theo cùng khuôn là xoá được cả một lớp lỗi "sửa
chữ là hỏng giao diện".

## 10.4 Bảng phát hiện

| # | Trang | Vấn đề | Mức |
| --- | --- | --- | --- |
| 1 | `BlogReview` | Duyệt/huỷ bài không ảnh hưởng `/blog` công khai (hai kho dữ liệu) | cao |
| 2 | `StaffAccounts` | Chú thích hứa "không cho tự khoá chính mình"; code không kiểm | cao |
| 3 | `AccountPassword` | Màn hình khẳng định đã ngắt phiên thiết bị khác; không có gì xảy ra | cao |
| 4 | `Gamification` | `TIERS` là bản sao thứ hai; `pointsPerKg` không phép tính nào đọc; không kiểm mốc tăng dần | cao |
| 5 | `Policy` + `Categories` | Hai trang sửa cùng trường `rule`, hai bản sao, không thông nhau | trung bình |
| 6 | `Leaderboard` | Chọn chu kỳ chỉ đổi chữ tiêu đề | trung bình |
| 7 | `Categories` `AddForm` | Validate thất bại im lặng; nhóm/mặc định cứng | trung bình |
| 8 | `Permissions` | Cấp/thu hồi toàn quyền không hỏi lại (trong khi xoá 1 tài khoản thì hỏi) | trung bình |
| 9 | `StaffAccounts` | `NV-${length+1}` trùng mã sau khi xoá | trung bình |
| 10 | `AccountPassword` | Ba chỗ tô viền bằng `err.startsWith(...)` | thấp |
| 11 | `Categories` | Chính tả "Giá tham khảu"; `Math.max` mảng rỗng → `-Infinity` | thấp |
| 12 | `AccountProfile` | "Ngày bắt đầu" và số điện thoại gõ tay | thấp |

---

## Tự kiểm tra

1. Sửa giá carton ở `/admin/categories` rồi mở `/waste` — giá đổi không? Vì sao? → Không. Mỗi trang giữ bản sao riêng trong `useState`; không có tầng dữ liệu chung.
2. Vì sao `GAMIFICATION.tiers` và `TIERS` là hai định nghĩa của cùng một thứ? → Ngưỡng lên hạng nằm ở cả `ops.ts` và `rewards.ts`; phép tính hạng đọc `TIERS`, màn hình admin sửa bản trong `ops.ts`.
3. `StaffAccounts` có chặn admin tự khoá chính mình không? → Không; `toggle` chỉ nhận `id`, file không dùng `useSession` — dù chú thích đầu file nói có.
4. Điều gì thật sự được kiểm ở ô "mật khẩu hiện tại" trong `AccountPassword`? → Chỉ `length >= 1`; không có nơi nào lưu mật khẩu để so sánh.
5. Trang `/blog` công khai đọc dữ liệu từ đâu, và điều đó ảnh hưởng gì tới `BlogReview`? → Từ `data/insights.ts` (`ARTICLES`); `BlogReview` duyệt `POSTS` trong `ops.ts`, nên duyệt bài không làm bài xuất hiện trên blog.
6. Cách tô viền lỗi đúng là gì (xem `AccountProfile`)? → Dùng chính điều kiện đã sinh lỗi (`err && name.trim().length < 2`), không so nội dung chuỗi thông báo.

**Tiếp:** `12 · Kiểm thử & CSS` — `check.tsx`, `check-routes.tsx`, `index.css`, và cách chạy `npm run check`.
