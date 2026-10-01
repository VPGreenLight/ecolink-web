import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  AI_DONE,
  AI_IDLE,
  AI_MSG,
  AI_SCANNING,
  HOW_TO,
  SCAN_MS,
  SCAN_RESULT as r,
} from "@/data/scanner"

/** Trang này phải vừa một màn hình 1440x900, không cuộn (trừ footer).
 *  Ba chỗ ăn nhiều chiều cao nhất, xử lý theo thứ tự:
 *   1. ảnh aspect-4/3 trong cột 7/12 = 660px rộng x 495px cao, đổi sang
 *      aspect-video cắt còn 371px. Tiết kiệm lớn nhất, mất gì? chỉ chiều cao ảnh.
 *   2. mỗi khối có padding 6-8 và gap 4-6, cộng lại ~120px. Giảm còn gap-3/p-4.
 *   3. thanh 3 nút xếp dọc ở đáy cột phải, 2 nút 48px + 44px. Xuống 44/40.
 *
 *  Ba trạng thái: idle -> scanning -> done. Chưa quét gì thì cột phải hiện
 *  hướng dẫn dùng và "hướng dẫn xử lý nhanh" ẩn hẳn. Tất cả giả lập, không
 *  có backend. */
type Phase = "idle" | "scanning" | "done"

export default function Scanner() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [file, setFile] = useState<File | null>(null)
  const [useSample, setUseSample] = useState(false)
  const [camera, setCamera] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Đổi ảnh trong lúc đang quét thì huỷ lượt đó, tránh kết quả của ảnh cũ
  useEffect(() => () => clearTimeout(timer.current), [])

  const pick = (f: File | null) => {
    setFile(f)
    setUseSample(false)
    setPhase("idle")
  }

  const scan = () => {
    setPhase("scanning")
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPhase("done"), SCAN_MS)
  }

  const reset = () => {
    clearTimeout(timer.current)
    setFile(null)
    setUseSample(false)
    setPhase("idle")
  }

  const preview = file ?? (useSample || phase !== "idle" ? sampleShot : null)

  return (
    <div className="page flex flex-col py-5 md:py-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="flex items-center gap-1.5 text-[13px] text-body">
            Hệ sinh thái
            <Separator />
            <span className="font-medium text-brand-deep">Nhận diện thông minh</span>
          </p>
          <h1 className="display mt-1 text-[22px] leading-7 md:text-2xl md:leading-8">
            Phân loại &amp; Định giá rác tái chế
          </h1>
        </div>
        <p className="chip bg-surface-2 text-body">
          <i className="size-1.5 rounded-full bg-brand" />
          Hệ thống sẵn sàng tại các tỉnh thành
        </p>
      </header>

      <div className="mt-4 grid gap-5 md:grid-cols-12">
        {/* 6/6 chứ không 7/5: cột trái là cột cao hơn (ảnh + hướng dẫn), cho
            nó hẹp lại một chút thì ảnh bớt cao và cột phải dư chỗ trống,
            tổng chiều cao trang giảm ~21px. */}
        <section className="flex flex-col gap-3 md:col-span-6">
          {/* Camera được kiểm TRƯỚC mọi nhánh khác, kể cả khi đã có ảnh. Đặt
              sau `preview` thì nút "Chụp trực tiếp" trên ảnh sẽ không mở được
              camera — đúng lỗi đã gặp: nút bấm mà không có gì xảy ra. */}
          {camera ? (
            <CameraPanel
              onShoot={(f) => {
                setCamera(false)
                pick(f)
              }}
              onClose={() => setCamera(false)}
            />
          ) : phase === "idle" && !preview ? (
            <UploadZone
              onPick={pick}
              onSample={() => setUseSample(true)}
              onCamera={() => setCamera(true)}
            />
          ) : preview ? (
            <Preview
              file={preview}
              scanning={phase === "scanning"}
              done={phase === "done"}
              onReset={reset}
              onPick={pick}
              onCamera={() => setCamera(true)}
            />
          ) : null}

          {/* Chỉ hiện khi đã có kết quả: chưa quét thì chưa có gì để hướng dẫn.
              Ẩn luôn lúc đang mở camera — hướng dẫn xử lý rác không liên quan
              gì tới việc chụp ảnh mới. */}
          {phase === "done" && !camera && (
            <div>
              <h2 className="text-base leading-6 font-bold tracking-tight text-ink">
                Hướng dẫn xử lý nhanh
              </h2>
              {/* 2 bước đứng cạnh nhau từ sm trở lên: xếp dọc tốn 2 hàng, đặt
                  cạnh nhau gọn bằng 1 hàng và đọc cân đối hơn. */}
              <ol className="mt-2 grid gap-2 sm:grid-cols-2">
                {r.steps.map((step, i) => (
                  <li
                    key={step}
                    className="flex items-start gap-2.5 rounded-lg border border-line-soft bg-surface-2/60 px-3 py-2"
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/10 text-[11px] font-bold text-brand-deep">
                      {i + 1}
                    </span>
                    <span className="text-[13px] leading-5 text-ink">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section className="md:col-span-6">
          <AiPanel phase={phase} canScan={!!preview} onScan={scan} />
        </section>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- ảnh xem trước */

const sampleShot = "sample" as const

function Preview({
  file,
  scanning,
  done,
  onReset,
  onPick,
  onCamera,
}: {
  file: File | typeof sampleShot
  scanning: boolean
  done: boolean
  onReset: () => void
  onPick: (f: File | null) => void
  onCamera: () => void
}) {
  // Tạo objectURL TRONG effect chứ không dùng useMemo. StrictMode ở dev gọi
  // effect 2 lần (setup -> cleanup -> setup): nếu tạo ở useMemo thì cleanup lần
  // một huỷ URL, setup lần hai lấy lại URL đã chết và ảnh vỡ. Tạo trong effect
  // thì lần setup sau sinh URL mới còn sống.
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

  return (
    <div className="overflow-clip rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="relative aspect-video bg-gradient-to-br from-mint/12 via-surface-2 to-surface-3">
        <img
          src={url ?? r.image}
          alt={file === sampleShot ? r.imageCaption : "Ảnh bạn đã chọn"}
          className="size-full object-cover"
        />

        {scanning && <div className="scan-line" aria-hidden="true" />}

        {scanning ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[11px] font-semibold text-white">
            <span className="pulse-bar size-1.5 rounded-full bg-mint-bright" />
            AI đang quét
          </span>
        ) : (
          /* Phải là <button> thật. Trước đây để <span> — nhìn như nút nhưng
             bấm không có gì xảy ra, không có onClick, không bấm được bằng
             bàn phím, không cho trình đọc màn hình biết đây là thao tác. */
          <button
            type="button"
            onClick={onCamera}
            className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-white/90 px-3 py-1.5 text-[11px] font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md transition hover:bg-white"
          >
            <CameraIcon />
            Chụp trực tiếp
          </button>
        )}

        {/* Bỏ ảnh: dấu X đỏ ở góc trái, đối xứng với "Chụp trực tiếp" ở góc
            phải. Không dùng pill dài như bên kia vì chỉ có một ký hiệu, không
            cần chữ.
            size-8 = 32px, bằng chiều cao pill kia (~28px) + chút để bấm
            trên điện thoại không chệch.
            CHỈ ẩn lúc đang quét. Đã có kết quả rồi vẫn phải bấm được — đó là
            đường duy nhất quay về "Sẵn sàng quét" để chọn ảnh khác. */}
        {!scanning && (
          <button
            type="button"
            onClick={onReset}
            title="Bỏ ảnh"
            aria-label="Bỏ ảnh"
            className="absolute top-3 left-3 grid size-8 place-items-center rounded-full border border-line-soft bg-white/90 text-warn shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md transition hover:bg-warn hover:text-white"
          >
            <CloseIcon />
          </button>
        )}

        {done && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border border-line-soft bg-white/90 px-3.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md">
            <i className="size-2 rounded-full bg-brand-deep" />
            <b className="text-xs font-semibold text-brand-deep">{r.tag}</b>
            <em className="text-[11px] font-medium text-muted not-italic">
              • {r.confidence}% độ tin cậy
            </em>
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-surface-2 bg-white px-4 py-2.5">
        <span className="truncate text-[13px] text-body">
          {file === sampleShot ? r.imageCaption : file.name}
        </span>
        <label className="btn-outline h-8 shrink-0 cursor-pointer px-3 text-[13px]">
          Đổi ảnh
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- vùng tải ảnh */

function UploadZone({
  onPick,
  onSample,
  onCamera,
}: {
  onPick: (f: File) => void
  onSample: () => void
  onCamera: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-sage-line bg-surface px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-brand/10 text-brand">
        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V4M8 8l4-4 4 4" />
          <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
        </svg>
      </span>
      <div>
        <p className="text-base font-bold text-ink">Đưa ảnh vật rác vào để bắt đầu</p>
        <p className="mt-1.5 text-[13px] leading-5 text-muted">
          Ảnh nên rõ, có nền đơn giản để AI nhận diện vật liệu chính xác.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {/* Chụp ảnh: mở camera thật qua getUserMedia (xem CameraPanel).
            Không dùng <input capture> vì thuộc tính đó chỉ có tác dụng trên
            điện thoại — trên desktop nó rơi về hộp thoại chọn file, y hệt
            nút bên cạnh nên thành hai nút giống hệt nhau. */}
        <button type="button" onClick={onCamera} className="btn-primary h-11 px-5">
          <CameraIcon />
          Chụp ảnh
        </button>
        <label className="btn-outline h-11 cursor-pointer px-5">
          Tải ảnh lên
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onSample}
        className="text-[13px] font-semibold text-brand-deep underline underline-offset-4 hover:text-brand"
      >
        Dùng luôn ảnh mẫu để xem thử
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------- AI panel */

/** Cột phải — MỘT component, MỘT cấu trúc, ba trạng thái.
 *
 *  Cấu trúc CỐ ĐỊNH cho cả ba trạng thái:
 *
 *      [robot] Sẵn sàng quét            [ Quét AI ]   ← nút CÙNG HÀNG, căn phải
 *              Đưa ảnh vật rác vào…
 *              Chọn hoặc chụp một ảnh…                ← chỉ hiện khi chưa có ảnh
 *      ─────────────────────────
 *      vùng nội dung  key={phase}                    ← đổi theo trạng thái
 *        idle     → hướng dẫn dùng
 *        scanning → skeleton
 *        done     → kết quả "Vật liệu có giá trị"
 *
 *  QUAN TRỌNG — vì sao không được tách thành ba nhánh `return`:
 *  React so khớp phần tử theo vị trí, mà ba nhánh trả về ba kiểu gốc khác nhau
 *  (`div` / `div` / `ScanResult`). Đổi trạng thái là React **xoá hẳn thẻ cũ, dựng
 *  thẻ mới** — viền nền vẽ lại, `AiFace` bên trong cũng mount lại nên animation
 *  chạy lại từ đầu. Người dùng thấy "AI reload cùng lúc với nội dung".
 *
 *  Cách sửa: **một thẻ duy nhất, mount đúng một lần.** Chỉ vùng nội dung bên
 *  dưới có `key={phase}`. Nhịp: robot đổi trước (260ms), nội dung tới sau
 *  (từ 320ms) — hai nhịp tách bạch. */
function AiPanel({
  phase,
  canScan,
  onScan,
}: {
  phase: Phase
  canScan: boolean
  onScan: () => void
}) {
  return (
    <div className="card flex flex-col gap-3 p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
      {/* Nút nằm TRONG hàng robot (cùng một flex row) chứ không phải hàng riêng
          bên dưới. Truyền vào qua prop `action` để `AiFace` giữ được một hàng
          duy nhất — tách ra ngoài thì phải lồng thêm một div, và hàng robot
          mất chiều cao cố định khi chữ dài/ngắn. */}
      <AiFace
        {...FACE[phase]}
        action={
          <button
            type="button"
            onClick={onScan}
            disabled={phase === "scanning" || !canScan}
            className="btn-primary h-10 shrink-0 rounded-xl px-4 text-[13px]"
          >
            <SparkIcon />
            {CTA[phase]}
          </button>
        }
      />

      {/* Dòng gợi ý CHỈ còn một trường hợp có ý nghĩa: chưa có ảnh thì bấm nút
          không được, phải nói rõ làm gì tiếp. Có ảnh rồi thì nút tự nói lý do
          (CTA = Quét AI / Đang phân tích / Quét lại), thêm dòng dưới chỉ là
          chữ lặp. */}
      {!canScan && phase === "idle" && (
        <p className="reveal -mt-1 text-[13px] text-muted" style={{ animationDelay: `${T.gap}ms` }}>
          Chọn hoặc chụp một ảnh để bắt đầu quét
        </p>
      )}

      {/* Vùng duy nhất đổi theo trạng thái. */}
      <div key={phase}>
        {phase === "idle" && (
          <div
            className="reveal mt-2 border-t border-line-soft pt-5"
            style={{ animationDelay: `${T.gap}ms` }}
          >
            <HowTo />
          </div>
        )}

        {phase === "scanning" && (
          // skeleton giữ đúng hình dáng thẻ kết quả nên khi xong không nhảy bố cục
          <div
            className="reveal mt-2 space-y-3"
            style={{ animationDelay: `${T.gap}ms` }}
          >
            <div className="pulse-bar h-7 w-2/5 rounded bg-surface-3" />
            <div className="pulse-bar h-3.5 w-4/5 rounded bg-surface-2" />
            <div className="pulse-bar h-16 w-full rounded-lg bg-surface-2" />
            <div className="pulse-bar h-32 w-full rounded-lg bg-surface-2" />
          </div>
        )}

        {phase === "done" && <ScanResult />}
      </div>
    </div>
  )
}

/** Chữ trên nút, đổi theo trạng thái. Nút tự nói lý do nên không cần dòng gợi ý
 *  riêng cho từng trạng thái. */
const CTA = {
  idle: "Quét AI",
  scanning: "Đang phân tích",
  done: "Quét lại",
} as const satisfies Record<Phase, string>

/** Nội dung robot + câu thoại của từng trạng thái. Tách ra để `AiPanel` đổi
 *  trạng thái chỉ bằng cách tra bảng, không phải rẽ nhánh JSX. */
const FACE = {
  idle: {
    src: AI_IDLE,
    alt: "AI sẵn sàng nhận diện rác",
    title: "Sẵn sàng quét",
    note: "Đưa ảnh vật rác vào, AI sẽ tìm vật liệu và định giá giúp bạn.",
  },
  scanning: {
    src: AI_SCANNING,
    alt: "AI đang phân tích hình ảnh",
    title: "AI đang quét ảnh",
    note: AI_MSG.scanning,
  },
  done: {
    src: AI_DONE,
    alt: "AI đã nhận diện xong",
    title: "AI đã nhận diện xong",
    note: "Đã tìm ra vật liệu và tính đơn giá tham khảo bên dưới.",
  },
} as const satisfies Record<Phase, { src: string; alt: string; title: string; note?: string }>

/** Hàng robot dùng chung cho cả ba trạng thái — một component duy nhất.
 *
 *  `<img>` CỐ TÌNH không có `key`: giữ nguyên phần tử đó qua các lần đổi
 *  trạng thái, nếu không GIF động sẽ nhảy về frame 0 và trông như bị reload
 *  dù trạng thái đã đổi xong. Chỉ chữ mới có `key` để chạy lại hiệu ứng
 *  `reveal` ngắn — nhịp "AI đổi trước" là ở đây.
 *
 *  `animationDuration` đặt cứng 260ms (thay vì 420ms mặc định của `.reveal`) vì
 *  đây là thay đổi trạng thái, cần xong sớm để nhịp nội dung phía dưới kịp
 *  nối tiếp.
 *
 *  `action` là chỗ trống bên phải của hàng — nút thao tác. Truyền qua prop thay
 *  vì đặt nút ở `AiPanel` sẽ phải lồng thêm một `div` bao quanh, mà `div` bao
 *  quanh chính là thứ phá vỡ yêu cầu "nút cùng hàng robot, căn phải". */
function AiFace({
  src,
  alt,
  title,
  note,
  action,
}: {
  src: string
  alt: string
  title: string
  note?: string
  action?: ReactNode
}) {
  return (
    // items-start: khối chữ 2 dòng cao hơn nút, canh đỉnh cho thẳng hàng với
    // mép trên robot. flex-1 + min-w-0 trên khối chữ để nó chiếm hết khoảng
    // giữa và đẩy nút sang hẳn bên phải, đồng thời chữ dài vẫn xuống dòng
    // thay vì đè lên nút.
    <div className="flex items-start gap-3">
      <img src={src} alt={alt} className="size-11 shrink-0 object-contain" loading="lazy" />
      <div className="min-w-0 flex-1">
        <h2
          key={title}
          className="reveal text-sm leading-5 font-bold text-ink"
          style={{ animationDuration: "260ms" }}
        >
          {title}
        </h2>
        {note && (
          <p
            key={note}
            className="reveal text-[12px] leading-4 text-muted"
            style={{ animationDuration: "260ms" }}
          >
            {note}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

/* ---------------------------------------------------------------- kết quả */

/** Nội dung KẾT QUẢ — tách riêng khỏi `AiPanel`.
 *
 *  `AiPanel` lo "AI đang ở trạng thái nào" (hàng robot `AiFace`) và đã cấp sẵn
 *  thẻ bao ngoài. Khối này chỉ lo "quét xong thì hiện gì": vật liệu, đơn giá,
 *  độ tin cậy, nút. Hai việc khác nhau — sau này đổi nội dung kết quả không
 *  đụng phần điều khiển trạng thái, và ngược lại.
 *
 *  Cố tình KHÔNG có `AiFace` ở đây: hàng robot phải nằm ở `AiPanel` để giữ
 *  nguyên phần tử `<img>` qua các lần đổi trạng thái. Nếu đặt ở đây, mỗi lần
 *  vào trạng thái `done` là GIF robot nhảy về frame 0 — thấy như bị reload.
 *
 *  Cũng cố tình KHÔNG có nút "Quét lại" ở đây: nút cùng hàng robot đã đổi chữ
 *  thành "Quét lại" ở trạng thái `done` và gọi đúng `scan()` — giữ lại thì hai
 *  nút làm cùng một việc. Muốn quét lại thì bấm nút đó, muốn đổi ảnh thì bấm
 *  "Đổi ảnh" ở thanh dưới ảnh, muốn bỏ hẳn thì bấm "Bỏ ảnh". */
function ScanResult() {
  return (
    <div className="flex flex-col gap-3">
      {/* viền xanh hiện trước, chữ hiện sau — chip tách 2 lớp: khung .draw-frame,
          chữ bên trong .resolve với delay muộn hơn.
          KHÔNG dùng class .chip ở đây: .chip là inline-flex, sẽ biến mỗi từ
          thành một flex item và xếp thành cột. Dùng khối thường + text-center,
          nowrap để câu luôn nằm trên một dòng. */}
      <span
        className="draw-frame block w-full rounded-full border border-mint/40 bg-mint/25 px-3.5 py-1.5 text-center text-[11px] leading-4 font-semibold whitespace-nowrap text-brand-deep"
        style={{ animationDelay: `${T.chipFrame}ms` }}
      >
        <Words text={r.badge} from={T.chipWord} />
      </span>

      <div>
        <h2
          className="text-[26px] leading-8 font-bold tracking-tight text-ink"
          style={{ animationDelay: `${T.title}ms` }}
        >
          <Words text={r.material} from={T.title} />
        </h2>
        <p
          className="reveal mt-1 text-[13px] leading-5 text-body"
          style={{ animationDelay: `${T.desc}ms` }}
        >
          {r.description}
        </p>
      </div>

      <div
        className="reveal flex items-center justify-between rounded-lg border border-line-soft bg-surface-2 px-4 py-3"
        style={{ animationDelay: `${T.price}ms` }}
      >
        <div>
          <p className="text-[10px] font-semibold tracking-[0.5px] text-body uppercase">
            {r.price.label}
          </p>
          <p className="mt-0.5 flex items-baseline gap-1">
            <b className="text-xl leading-7 font-bold tracking-tight text-brand-deep">
              {r.price.value}
            </b>
            <span className="text-xs font-semibold text-body">{r.price.unit}</span>
          </p>
        </div>
        <PriceIcon />
      </div>

      <div
        className="reveal rounded-lg border border-line-soft bg-surface-2 p-4"
        style={{ animationDelay: `${T.conf}ms` }}
      >
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <ShieldIcon />
            Độ tin cậy nhận diện AI
          </p>
          <span className="rounded-full border border-brand/20 bg-mint/25 px-2.5 py-1 text-[11px] font-semibold text-brand-deep">
            Chính xác {r.confidence}%
          </span>
        </div>

        <ul className="mt-3 flex flex-col gap-2.5">
          {r.breakdown.map((b, i) => (
            <li key={b.label}>
              <p className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  <i className="size-2 rounded-full" style={{ background: b.color }} />
                  {b.label}
                </span>
                <b className={b.value >= 50 ? "text-brand-deep" : "text-body"}>
                  {b.value}%
                </b>
              </p>
              <div className="mt-1 h-1.5 overflow-clip rounded-full bg-line/70">
                <div
                  className="bar-grow h-full rounded-full"
                  style={{
                    width: `${b.value}%`,
                    background: b.color,
                    animationDelay: `${T.bar + i * T.barStep}ms`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-3 flex items-center gap-1.5 border-t border-line-soft pt-2.5 text-[11px] text-muted">
          <InfoIcon />
          {r.model}
        </p>
      </div>

      {/* Chỉ còn một nút: quét lại đã lên hàng robot. */}
      <div className="reveal" style={{ animationDelay: `${T.actions}ms` }}>
        <Link to="/map" className="btn-primary h-11 w-full rounded-xl px-4">
          Tìm người thu gom ngay
        </Link>
      </div>
    </div>
  )
}

function HowTo() {
  return (
    // Không dùng class `card` ở đây: `AiPanel` đã cấp sẵn thẻ bao ngoài, thêm
    // card nữa là card-trong-card — nặng và sai thang độ sâu.
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
          Dùng trang này thế nào
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-muted">
          Ba bước, chưa đến một phút là có đơn giá tham khảo.
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {HOW_TO.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
              {i + 1}
            </span>
            <div>
              <p className="text-sm leading-5 font-semibold text-ink">{s.title}</p>
              <p className="mt-0.5 text-[13px] leading-5 text-body">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Tách chuỗi thành từng từ, mỗi từ hiện lệch nhau `step` ms — vẫn là MỘT câu
 *  liền mạch, không xuống dòng.
 *
 *  Hai điều dễ sai ở đây:
 *  1. Khoảng trắng phải là text node GIỮA các span, không nằm trong span.
 *     Nằm trong span thì mỗi từ là một khối khép kín, trông như danh sách.
 *  2. Cha PHẢI là khối thường (block), không phải flex. Đặt vào .chip là
 *     `inline-flex` thì mọi từ thành flex item, bị đẩy thành cột. */
function Words({
  text,
  from,
  step = 70,
}: {
  text: string
  from: number
  step?: number
}) {
  const words = text.split(" ")
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          {i > 0 && " "}
          <span
            className="resolve inline-block"
            style={{ animationDelay: `${from + i * step}ms` }}
          >
            {w}
          </span>
        </span>
      ))}
    </>
  )
}

/** Mốc thời gian các bước hiện nội dung (ms).
 *
 *  `gap` là ranh giới hai nhịp: robot đổi trạng thái xong ở 260ms, nội dung bắt
 *  đầu từ 320ms. Trước đây nội dung hiện ở 200ms — chồng lên robot đang mờ
 *  dần, đúng cảm giác "AI reload cùng lúc với nội dung".
 *
 *  Thứ tự từ trên xuống: nội dung → viền chip → chữ trong chip → tên vật liệu
 *  → mô tả → đơn giá → độ tin cậy → từng thanh → nút. */
const T = {
  gap: 320,
  chipFrame: 340,
  chipWord: 480,
  title: 700,
  desc: 860,
  price: 960,
  conf: 1060,
  bar: 1160,
  barStep: 110,
  actions: 1440,
} as const

/* ---------------------------------------------------------------- camera */

/** Camera thật, hiện ngay tại chỗ vùng tải ảnh — không dùng modal.
 *
 *  Ba thứ dễ sai và đều đã xử lý ở đây:
 *  1. **Phải tắt track khi đóng.** Quên thì đèn camera sáng và camera bị khoá
 *     tới khi đóng trang.
 *  2. **StrictMode ở dev gọi effect 2 lần.** getUserMedia là promise bất đồng
 *     bộ; lần gọi đầu có thể resolve SAU khi đã cleanup → phải có cờ `alive`
 *     để tắt luôn stream mồ côi, không thì hai camera cùng mở.
 *  3. **Quyền bị từ chối là chuyện thường**, phải có lời nhắc + đường về
 *     nút tải ảnh, không để người dùng kẹt ở màn hình đen. */
function CameraPanel({
  onShoot,
  onClose,
}: {
  onShoot: (f: File) => void
  onClose: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stream: MediaStream | undefined
    let alive = true

    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Trình duyệt này không mở được camera. Bạn dùng nút tải ảnh lên được.")
      return
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      .then((s) => {
        if (!alive) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (video.current) {
          video.current.srcObject = s
          void video.current.play()
          setReady(true)
        }
      })
      .catch((e: DOMException) => {
        if (!alive) return
        setErr(
          e.name === "NotAllowedError" || e.name === "SecurityError"
            ? "Bạn chưa cấp quyền dùng camera. Cho phép trong cài đặt trình duyệt rồi thử lại, hoặc dùng nút tải ảnh lên."
            : e.name === "NotFoundError" || e.name === "OverconstrainedError"
              ? "Máy này không có camera. Bạn dùng nút tải ảnh lên được."
              : "Không mở được camera. Bạn dùng nút tải ảnh lên được.",
        )
      })

    return () => {
      alive = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const shoot = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    // vẽ ở kích thước gốc của camera, không phải kích thước hiển thị, để ảnh
    // chụp đủ nét cho AI nhận diện
    const c = document.createElement("canvas")
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height)
    c.toBlob((blob) => {
      if (blob) onShoot(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }))
    }, "image/jpeg", 0.9)
  }

  return (
    <div className="overflow-clip rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="relative aspect-video bg-ink">
        {err ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <p className="text-sm font-semibold text-white">Không mở được camera</p>
              <p className="mt-1.5 text-[13px] leading-5 text-white/70">{err}</p>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={video}
              playsInline
              muted
              className="size-full object-cover"
              aria-label="Khung hình camera"
            />
            {!ready && (
              <p className="absolute inset-0 grid place-items-center text-[13px] text-white/70">
                Đang bật camera...
              </p>
            )}
            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[11px] font-semibold text-white">
              <i className="pulse-bar size-1.5 rounded-full bg-mint-bright" />
              Camera đang mở
            </span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-surface-2 px-4 py-2.5">
        <p className="text-[13px] text-muted">
          {err ? "Hoặc đóng rồi dùng nút tải ảnh lên" : "Đưa vật rác vào khung rồi chụp"}
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={onClose} className="btn-ghost h-9 px-4 text-[13px]">
            Huỷ
          </button>
          <button
            type="button"
            onClick={shoot}
            disabled={!!err || !ready}
            className="btn-primary h-9 px-4 text-[13px]"
          >
            Chụp
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- icon */

function Separator() {
  return (
    <svg width="6" height="10" viewBox="0 0 6 10" fill="none" aria-hidden="true">
      <path
        d="M1 1l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function CameraIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5.5A1.5 1.5 0 013.5 4h1L5.5 2.5h5L11.5 4h1A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-7z" {...stroke} />
      <circle cx="8" cy="9" r="2.4" {...stroke} />
    </svg>
  )
}

function PriceIcon() {
  return (
    <svg width="24" height="18" viewBox="0 0 26 19" fill="none" aria-hidden="true" className="text-brand-deep">
      <rect x="1" y="1" width="24" height="17" rx="3" {...stroke} />
      <circle cx="13" cy="9.5" r="3.2" {...stroke} />
      <path d="M4.5 5.5h3M4.5 13.5h3" {...stroke} />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="13" height="14" viewBox="0 0 14 15" fill="none" aria-hidden="true" className="text-brand-deep">
      <path d="M7 1l5 2v4c0 3.2-2.1 5.8-5 7-2.9-1.2-5-3.8-5-7V3l5-2z" {...stroke} />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" {...stroke} />
      <path d="M7 6.2v3.4M7 4.4v.6" {...stroke} />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  )
}
