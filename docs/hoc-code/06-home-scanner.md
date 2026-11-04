# 06 · Trang chủ & Scanner

Hai trang này đại diện cho hai cực của dự án:

- `Home.tsx` (192 dòng) — trang tĩnh, không state phức tạp, thuần trình bày.
- `Scanner.tsx` (849 dòng) — màn hình phức tạp nhất: máy trạng thái, camera thật,
  quản lý bộ nhớ ảnh, chuỗi animation nhiều nhịp.

Đọc xong hai file này, mọi trang còn lại chỉ là biến thể dễ hơn.

---

# PHẦN 1 — `pages/Home.tsx` (192 dòng)

## 1.1 Dữ liệu đặt ngay trong file (dòng 5–30)

```tsx
const FEATURES = [
  { to: "/scanner", kicker: "01", title: "Nhận diện bằng AI", body: "..." },
  ...
] as const

const STEPS = [
  "Chụp ảnh vật rác cần phân loại",
  ...
] as const
```

🔍 Vì sao hai mảng này **không** nằm trong `src/data/` như những file khác:
chúng chỉ được dùng ở **đúng một trang**. Quy tắc của repo:

```
Dùng ở 1 nơi  →  hằng số ngay trong file (dễ đọc, thấy nội dung cạnh bố cục)
Dùng ở ≥2 nơi →  src/data/ (một nguồn, sửa một chỗ)
```

`as const` làm mảng thành readonly và giữ nguyên literal type, nhờ vậy
`f.to` được hiểu là chuỗi cụ thể chứ không phải `string` chung chung.

## 1.2 Video hero và chính sách autoplay (dòng 32–45)

```tsx
const video = useRef<HTMLVideoElement>(null)
const [muted, setMuted] = useState(true)

const toggleSound = () => {
  const v = video.current
  if (!v) return
  v.muted = !v.muted
  setMuted(v.muted)
  if (!v.muted) void v.play()
}
```

Đây là đoạn code **thể hiện đúng một luật của trình duyệt**:

> Video chỉ được tự phát nếu **tắt tiếng**. Video có tiếng tự phát sẽ bị chặn.

Vì vậy:

1. Thẻ `<video>` có cả `autoPlay` **và** `muted` (dòng 81–82). Thiếu `muted`,
   video đứng im ở poster.
2. Khi người dùng bấm bật tiếng: gỡ `muted` **và gọi `play()` lại**. Chỉ gỡ
   thuộc tính là chưa đủ — trình duyệt coi đó là "phát tự động có tiếng" và
   từ chối. Lệnh `play()` nằm trong **thao tác của người dùng** (onClick) nên
   được phép.

`void v.play()` — `play()` trả Promise, có thể reject (bị chặn). `void` nói rõ
"tôi biết đây là promise, tôi không chờ". Không có `await` trong hàm đồng bộ.

`aria-pressed={!muted}` — nút bật/tắt cần nói trạng thái hiện tại cho screen
reader, không chỉ đổi icon.

## 1.3 Bố cục hero (dòng 55–107)

```tsx
<div className="grid items-center gap-10 lg:grid-cols-[0.71fr_1fr] lg:gap-12">
```

Hai cột **không bằng nhau**: chữ 0.71, video 1. Tỉ lệ này được ghi chú ngay
trong code (dòng 53): video lớn hơn ~20% so với bản gốc, cột chữ còn ~492px nên
tiêu đề hạ xuống 46px cho vừa.

```
Mobile:            Desktop (≥1024px):
┌───────────┐      ┌──────────┬──────────────┐
│   chữ     │      │  chữ     │    video     │
├───────────┤      │ 0.71fr   │    1fr       │
│   video   │      └──────────┴──────────────┘
└───────────┘
```

Video:

```tsx
<video ref={video} className="aspect-video w-full object-cover"
       autoPlay muted loop playsInline preload="auto"
       poster="/assets/video/poster.jpg" aria-label="...">
  <source src="/assets/video/intro.mp4" type="video/mp4" />
  Trình duyệt của bạn không hỗ trợ phát video.
</video>
```

| Thuộc tính | Tác dụng |
| --- | --- |
| `playsInline` | trên iPhone không tự nhảy sang trình phát toàn màn hình |
| `preload="auto"` | tải trước để phát mượt |
| `poster` | ảnh hiện trước khi video tải xong |
| `aspect-video` | giữ khung 16:9, **không nhảy layout** khi video load |
| `object-cover` | cắt cho đầy khung, không méo |
| dòng text cuối | fallback khi trình duyệt quá cũ |

## 1.4 Danh sách có số thứ tự (dòng 117–128)

```tsx
{STEPS.map((step, i) => (
  <li key={step} className="flex items-start gap-4">
    <span className="...">{i + 1}</span>
    <p>{step}</p>
  </li>
))}
```

`key={step}` — dùng chính nội dung làm key vì 3 bước là cố định, không chèn/xoá.
Nếu danh sách động, nên dùng `id`.

`i + 1` vì chỉ số mảng bắt đầu từ 0 nhưng người đọc cần "1, 2, 3".

## 1.5 Card có hiệu ứng nhóm (dòng 137–160)

```tsx
<Link className="card group flex flex-col p-6 ...">
  ...
  <span aria-hidden="true" className="... group-hover:translate-x-0.5">→</span>
</Link>
```

`group` đặt ở cha; `group-hover:` ở con nghĩa là "khi **cha** hover thì đổi cái
này". Nhờ vậy cả card là một vùng bấm, nhưng chỉ mũi tên nhích lên 2px.

`aria-hidden="true"` trên mũi tên: nó là trang trí, screen reader không cần đọc
"mũi tên phải".

## 1.6 Icon dùng chung object props (dòng 169–192)

```tsx
const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

<path d="..." {...stroke} />
```

`as const` ở hai thuộc tính cuối là bắt buộc: TypeScript cần literal type
`"round"` chứ không phải `string`, nếu không sẽ báo lỗi khi spread vào SVG.

---

# PHẦN 2 — `pages/Scanner.tsx` (849 dòng)

## 2.1 Bài toán

Một màn hình có **ba trạng thái**:

```
┌─────────┐   chọn ảnh    ┌───────────┐   2.6 giây   ┌────────┐
│  idle   │ ────────────▶ │ scanning  │ ───────────▶ │  done  │
│ chờ ảnh │               │ đang quét │              │ kết quả│
└─────────┘               └───────────┘              └────────┘
     ▲                          │                         │
     │        bấm "Bỏ ảnh"      │     bấm "Quét lại"      │
     └──────────────────────────┴─────────────────────────┘
```

Không có AI thật. `scan()` chỉ hẹn giờ 2.600ms rồi chuyển sang `done`, và
`done` luôn hiện cùng một kết quả trong `data/scanner.ts`.

## 2.2 State (dòng 26–34)

```tsx
const [phase, setPhase] = useState<Phase>("idle")
const [file, setFile] = useState<File | null>(null)
const [useSample, setUseSample] = useState(false)
const [camera, setCamera] = useState(false)
const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
```

| State | Nghĩa |
| --- | --- |
| `phase` | đang ở bước nào |
| `file` | ảnh người dùng chọn (đối tượng `File`, không phải đường dẫn) |
| `useSample` | người dùng bấm "dùng ảnh mẫu" |
| `camera` | đang mở camera |
| `timer` | id của hẹn giờ, để huỷ khi cần |

🔍 Vì sao `timer` là `useRef` chứ không `useState`: đổi timer **không cần vẽ
lại giao diện**. Nếu dùng state, mỗi lần hẹn giờ sẽ gây thêm một lần render vô ích.

`ReturnType<typeof setTimeout>` — kiểu trả về của `setTimeout`. Trong trình duyệt
nó là `number`, trong Node là `Timeout`. Viết theo `ReturnType` thì đúng ở cả hai
môi trường, không phải hardcode.

```tsx
useEffect(() => () => clearTimeout(timer.current), [])
```

Effect này **không làm gì khi mount**, chỉ trả về hàm dọn dẹp. Khi component bị
gỡ (rời trang), huỷ hẹn giờ. Nếu không, hẹn giờ vẫn chạy và gọi `setPhase` trên
component đã chết → cảnh báo của React.

Cách viết `() => () => ...` đọc là: "effect trả về một hàm; hàm đó là cleanup".

## 2.3 Ba hành động (dòng 36–55)

```tsx
const pick = (f: File | null) => {
  setFile(f); setUseSample(false); setPhase("idle")
}

const scan = () => {
  setPhase("scanning")
  clearTimeout(timer.current)
  timer.current = setTimeout(() => setPhase("done"), SCAN_MS)
}

const reset = () => {
  clearTimeout(timer.current)
  setFile(null); setUseSample(false); setPhase("idle")
}
```

`scan()` có `clearTimeout` trước khi đặt hẹn giờ mới — chống bấm "Quét lại"
nhiều lần tạo ra nhiều timer chồng nhau.

Dòng 55 là dòng tinh tế nhất của phần này:

```tsx
const preview = file ?? (useSample || phase !== "idle" ? sampleShot : null)
```

Đọc theo thứ tự ưu tiên:

```
1. có file thật            → dùng file
2. không có file, nhưng:
   - đã bấm "ảnh mẫu"      → dùng sampleShot
   - hoặc phase ≠ idle     → vẫn dùng sampleShot
3. còn lại                 → null
```

Vì sao `phase !== "idle"` cũng cho ra ảnh mẫu: người dùng bấm "Quét AI" khi chưa
chọn ảnh (nút bị disable nên thực tế không xảy ra), hoặc sau khi bấm "Quét lại"
từ trạng thái đã có ảnh mẫu — cần giữ ảnh trên màn hình thay vì nhảy về ô upload.

`sampleShot = "sample"` (dòng 146) là **sentinel**: một chuỗi đại diện cho "ảnh
mẫu", phân biệt với `File` thật. Nhờ vậy `preview` có kiểu `File | "sample" | null`,
và `Preview` biết cần hiện ảnh mẫu hay object URL.

## 2.4 Cây component

```
Scanner
├─ header (breadcrumb + tiêu đề + chip)
├─ cột trái
│   ├─ CameraPanel        nếu camera = true
│   │   hoặc UploadZone   nếu idle và chưa có ảnh
│   │   hoặc Preview      nếu có ảnh
│   └─ hướng dẫn xử lý    chỉ khi done
└─ cột phải
    └─ AiPanel
        ├─ AiFace          robot + chữ + nút
        └─ <div key={phase}>
             idle     → HowTo
             scanning → skeleton
             done     → ScanResult
```

## 2.5 Thứ tự rẽ nhánh — một bug thật đã sửa (dòng 84–107)

```tsx
{camera ? (
  <CameraPanel ... />
) : phase === "idle" && !preview ? (
  <UploadZone ... />
) : preview ? (
  <Preview ... />
) : null}
```

Comment dòng 81–83 ghi:

> Camera được kiểm **TRƯỚC** mọi nhánh khác, kể cả khi đã có ảnh. Đặt sau
> `preview` thì nút "Chụp trực tiếp" trên ảnh sẽ không mở được camera — đúng lỗi
> đã gặp: nút bấm mà không có gì xảy ra.

Đây là ví dụ về **thứ tự điều kiện có ý nghĩa**. Ba nhánh này không loại trừ
nhau về mặt logic (`camera` có thể true cùng lúc `preview` khác null), nên thứ
tự quyết định cái nào thắng. Nếu đặt `camera` sau, `Preview` luôn thắng và nút
camera thành vô dụng.

## 2.6 `Preview` — bài học về `URL.createObjectURL` (dòng 148–254)

```tsx
const [url, setUrl] = useState<string | null>(null)

useEffect(() => {
  if (file === sampleShot) {
    setUrl(null)
    return
  }
  const u = URL.createObjectURL(file)
  setUrl(u)
  return () => URL.revokeObjectURL(u)
}, [file])
```

`URL.createObjectURL(file)` tạo một địa chỉ tạm `blob:...` trỏ tới file trong bộ
nhớ. Phải `revokeObjectURL` khi không dùng nữa, nếu không bộ nhớ tăng mãi.

🔍 Vì sao tạo trong `useEffect` mà không phải `useMemo`:

```
StrictMode (dev) chạy:  setup → cleanup → setup

Nếu tạo trong useMemo:
  render 1: useMemo tạo URL A
  cleanup:  revoke(URL A)
  render 2: useMemo KHÔNG chạy lại (deps không đổi) → vẫn dùng URL A đã chết
  → ảnh vỡ

Nếu tạo trong effect:
  setup 1: tạo URL A
  cleanup: revoke(A)
  setup 2: tạo URL B còn sống
  → ảnh hiện đúng
```

Đây là lý do effect phù hợp cho **tài nguyên có vòng đời** (object URL, listener,
timer), còn `useMemo` chỉ để tính toán thuần.

`<img src={url ?? r.image}>` — ảnh mẫu thì dùng đường dẫn tĩnh, ảnh thật thì
dùng blob URL.

### Nút "Bỏ ảnh" phải luôn bấm được (dòng 215–225)

```tsx
{!scanning && (
  <button onClick={onReset} aria-label="Bỏ ảnh" ...>
```

Chỉ ẩn khi **đang quét**. Comment nói rõ: đã có kết quả vẫn phải bấm được, vì
đó là đường duy nhất quay về "Sẵn sàng quét" để chọn ảnh khác.

Nút "Chụp trực tiếp" thì ngược lại — chỉ hiện khi **không** quét. Hai nút đối
xứng hai góc, nhưng điều kiện hiện khác nhau vì mục đích khác nhau.

## 2.7 `AiPanel` — một thẻ, ba trạng thái (dòng 315–405)

Đây là phần quan trọng nhất về React trong cả file.

### Vấn đề nếu tách ba nhánh `return`

```tsx
// CÁCH SAI
if (phase === "idle") return <div>...</div>
if (phase === "scanning") return <div>...</div>
return <ScanResult />
```

React so khớp phần tử theo **vị trí và kiểu**. Ba nhánh trả về ba kiểu gốc khác
nhau (`div`, `div`, `ScanResult`) → khi đổi trạng thái, React **xoá hẳn cây cũ,
dựng cây mới**. Hệ quả:

- `<img>` robot bị mount lại → GIF/WebP động nhảy về frame 0 → trông như reload.
- Animation của khung ngoài chạy lại.
- Người dùng thấy "AI reload cùng lúc với nội dung", mất cảm giác AI đang xử lý.

### Cách đúng

```tsx
<div className="card flex flex-col gap-3 p-5">
  <AiFace {...FACE[phase]} action={<button>...</button>} />

  <div key={phase}>
    {phase === "idle" && <HowTo />}
    {phase === "scanning" && <Skeleton />}
    {phase === "done" && <ScanResult />}
  </div>
</div>
```

Một thẻ ngoài **duy nhất**, mount một lần. Chỉ vùng nội dung có `key={phase}` —
đổi key là React cố tình dựng lại vùng đó để animation chạy lại. `AiFace` không
có key nên `<img>` được giữ nguyên.

```
Trước:  [div] → [div] → [ScanResult]     ← 3 gốc khác nhau, xoá sạch
Sau:    [div card]                        ← giữ nguyên
          ├─ AiFace (img giữ nguyên)
          └─ [div key=phase]  ← chỉ vùng này đổi
```

🔍 Đây là kiến thức cốt lõi của React: **`key` là công cụ điều khiển việc
mount/unmount**, không chỉ để hết cảnh báo trong `.map()`. Đặt key sai chỗ →
mất animation, mất state con, hoặc ngược lại: state cũ rò rỉ sang dữ liệu mới.

### `AiFace` — vì sao `<img>` không có key (dòng 438–493)

```tsx
<img src={src} alt={alt} className="size-11 shrink-0 object-contain" loading="lazy" />

<h2 key={title} className="reveal" style={{ animationDuration: "260ms" }}>{title}</h2>
{note && <p key={note} ...>{note}</p>}
```

- `img` **không key** → giữ nguyên phần tử qua các trạng thái, animation WebP
  không nhảy frame.
- `h2`/`p` **có key là nội dung** → khi chữ đổi, React coi là phần tử mới, chạy
  lại `.reveal`. Nhịp "robot đổi trước, chữ đổi sau" nằm ở đây.

`loading="lazy"` — ảnh robot nặng ~1,3 MB, chỉ tải khi gần vào khung nhìn.

### Bảng thay vì rẽ nhánh (dòng 409–436)

```tsx
const CTA = { idle: "Quét AI", scanning: "Đang phân tích", done: "Quét lại" }
  as const satisfies Record<Phase, string>

const FACE = {
  idle:     { src: AI_IDLE,     title: "Sẵn sàng quét", ... },
  scanning: { src: AI_SCANNING, title: "AI đang quét ảnh", ... },
  done:     { src: AI_DONE,     title: "AI đã nhận diện xong", ... },
} as const satisfies Record<Phase, {...}>
```

`satisfies` (TypeScript 4.9+) = "kiểm tra khớp kiểu **nhưng vẫn giữ literal type**".
Khác `as` ở chỗ: `as` ép và có thể che lỗi; `satisfies` báo lỗi nếu thiếu một
trạng thái.

Nhờ bảng này, `AiPanel` không có một `if (phase === ...)` nào cho phần robot —
chỉ `FACE[phase]`. Thêm trạng thái thứ tư thì TypeScript bắt bạn bổ sung đủ 3 bảng.

## 2.8 `ScanResult` và dàn animation (dòng 512–614)

Kết quả hiện **lần lượt**, không bung ra cùng lúc:

```
320ms  vùng nội dung bắt đầu
340ms  viền chip vẽ ra        (draw-frame)
480ms  từng từ trong chip     (Words, mỗi từ +70ms)
700ms  tên vật liệu
860ms  mô tả
960ms  khối đơn giá
1060ms khối độ tin cậy
1160ms từng thanh %          (mỗi thanh +110ms)
1440ms nút "Tìm người thu gom"
```

Bảng `T` (dòng 690–701) giữ toàn bộ mốc. Comment giải thích vì sao `gap = 320`
chứ không phải 200: robot đổi xong ở 260ms, nội dung phải bắt đầu **sau** đó,
nếu không hai thứ chồng lên nhau và mất cảm giác tuần tự.

### `Words` — tách câu thành từ (dòng 655–680)

```tsx
const words = text.split(" ")
return (
  <>
    {words.map((w, i) => (
      <span key={i}>
        {i > 0 && " "}
        <span className="resolve inline-block" style={{ animationDelay: `${from + i * step}ms` }}>
          {w}
        </span>
      </span>
    ))}
  </>
)
```

Hai chi tiết comment cảnh báo:

1. **Khoảng trắng phải nằm ngoài span động**. Nếu để `" "` bên trong span, mỗi
   từ thành một khối riêng và trông như danh sách dọc.
2. **Cha phải là block**, không phải `inline-flex`. Nếu đặt trong `.chip`
   (`inline-flex`), mỗi span thành flex item và bị xếp thành cột.

`i > 0 && " "` — không thêm dấu cách trước từ đầu tiên.

### Thanh % (dòng 574–598)

```tsx
<div className="mt-1 h-1.5 overflow-clip rounded-full bg-line/70">
  <div className="bar-grow h-full rounded-full"
       style={{ width: `${b.value}%`, background: b.color,
                animationDelay: `${T.bar + i * T.barStep}ms` }} />
</div>
```

Bề rộng đặt bằng **inline style** vì giá trị đến từ dữ liệu (92%, 5%, 3%).
Tailwind không sinh class động được (`w-[92%]` phải biết trước), nên `style` là
cách đúng. Màu cũng vậy, và nó là token `var(--color-brand)` chứ không phải hex.

## 2.9 `CameraPanel` — camera thật (dòng 705–835)

Đây là phần "khó nhất" về mặt trình duyệt, và comment đầu hàm liệt kê đúng 3 cái bẫy.

### Bẫy 1 — phải tắt track khi đóng

```tsx
let stream: MediaStream | undefined
...
stream = s
...
return () => {
  alive = false
  stream?.getTracks().forEach((t) => t.stop())
}
```

Không `stop()` → đèn camera vẫn sáng, camera bị khoá cho tới khi đóng tab. Đây
là lỗi người dùng thấy ngay và rất khó chịu.

### Bẫy 2 — StrictMode gọi effect hai lần

```tsx
let alive = true

getUserMedia(...).then((s) => {
  if (!alive) {                       // ← cờ sống/chết
    s.getTracks().forEach((t) => t.stop())
    return
  }
  ...
})

return () => { alive = false; stream?.getTracks().forEach(...) }
```

`getUserMedia` là **bất đồng bộ**. Ở dev, StrictMode chạy setup → cleanup → setup.
Lần gọi đầu có thể trả về **sau khi cleanup đã chạy**. Không có cờ `alive`, ta sẽ
gán stream của lần đầu vào video và mở **hai** camera cùng lúc.

```
setup 1: gọi getUserMedia (chưa xong)
cleanup: alive = false, stream chưa có gì để stop
setup 2: gọi getUserMedia lần 2
promise 1 resolve → alive = false → stop ngay  ✅
promise 2 resolve → alive = true  → dùng      ✅
```

### Bẫy 3 — quyền bị từ chối là chuyện thường

```tsx
.catch((e: DOMException) => {
  setErr(
    e.name === "NotAllowedError" || e.name === "SecurityError"
      ? "Bạn chưa cấp quyền dùng camera..."
      : e.name === "NotFoundError" || e.name === "OverconstrainedError"
        ? "Máy này không có camera..."
        : "Không mở được camera..."
  )
})
```

Ba nhóm lỗi, ba câu khác nhau, **câu nào cũng có đường thoát** ("dùng nút tải ảnh
lên"). Không để người dùng kẹt ở màn hình đen.

Ngoài ra còn guard:

```tsx
if (!navigator.mediaDevices?.getUserMedia) {
  setErr("Trình duyệt này không mở được camera...")
  return
}
```

Trên HTTP (không phải HTTPS) hoặc trình duyệt cũ, `mediaDevices` là `undefined`.
Không guard thì crash ngay.

### Chụp ảnh bằng canvas (dòng 769–781)

```tsx
const c = document.createElement("canvas")
c.width = v.videoWidth
c.height = v.videoHeight
c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height)
c.toBlob((blob) => {
  if (blob) onShoot(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }))
}, "image/jpeg", 0.9)
```

- Kích thước lấy từ `videoWidth/videoHeight` (độ phân giải gốc của camera),
  **không** phải kích thước hiển thị. Nếu lấy theo khung 16:9 trên màn hình, ảnh
  chỉ còn ~600px và AI "nhìn" kém hơn.
- `toBlob` bất đồng bộ, trả Blob. Bọc thành `File` để đi chung đường với ảnh
  upload — `pick()` chỉ cần biết đó là `File`.
- `0.9` là chất lượng JPEG.
- `if (!v || !v.videoWidth) return` — camera chưa có frame thì không chụp.

---

## 3. Ba bài học lớn nhất từ hai file này

| Bài học | Ở đâu | Áp dụng khi nào |
| --- | --- | --- |
| Dữ liệu dùng 1 nơi để trong file, ≥2 nơi đưa vào `data/` | `Home.tsx` | thêm bất kỳ mảng nội dung |
| Trình duyệt chặn autoplay có tiếng, phải `play()` trong gesture | `toggleSound` | mọi video/audio |
| Thứ tự điều kiện = hành vi | `Scan` render branches | nhiều state chồng nhau |
| Effect cho tài nguyên có vòng đời, không dùng `useMemo` | `Preview` objectURL | blob URL, listener, timer |
| `key` điều khiển mount, không chỉ cho `.map()` | `AiPanel` | animation, state con |
| Cờ `alive` cho promise trong effect | `CameraPanel` | mọi `getUserMedia`/fetch trong effect |

## 4. Tự kiểm tra

1. Vì sao `Home` phải có `muted` trên `<video>`? → Trình duyệt chỉ cho autoplay khi tắt tiếng.
2. Vì sao `Preview` tạo object URL trong `useEffect` mà không trong `useMemo`? → StrictMode cleanup sẽ revoke URL mà `useMemo` không tạo lại, ảnh vỡ.
3. `key={phase}` ở `AiPanel` có tác dụng gì? → Dựng lại **chỉ vùng nội dung** khi đổi trạng thái, giữ `<img>` robot không bị mount lại.
4. Vì sao `camera` phải kiểm trước `preview` trong chuỗi điều kiện? → Nếu không, khi đã có ảnh thì `Preview` luôn thắng và nút "Chụp trực tiếp" không mở được camera.
5. `shoot()` lấy kích thước từ đâu? → `video.videoWidth/videoHeight` (độ phân giải gốc), không phải kích thước hiển thị.

**Tiếp:** `06b · Feedback & Rewards` — form có validate và logic điểm danh.
