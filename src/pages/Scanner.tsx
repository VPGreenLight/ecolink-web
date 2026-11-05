import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  AI_DONE,
  AI_IDLE,
  AI_MSG,
  AI_SCANNING,
  HOW_TO,
  SCAN_RESULT as r,
} from "@/data/scanner"
import { ApiError } from "@/lib/api"
import {
  AI_CLASS_OPTIONS,
  classifyWasteImage,
  DEFAULT_AI_MODELS,
  fetchAiModels,
  getCategoryMeta,
  loadSampleImageAsFile,
  parsePreparationSteps,
  submitAiFeedback,
  type AiModelOption,
  type WasteScanResponseDto,
} from "@/lib/wasteScanApi"
import { isDiscoverableCategory } from "@/lib/recyclerDiscoveryApi"

/** Trang này giữ bố cục gọn 2 cột (6/6) vừa màn hình 1440x900 và kết nối trực tiếp
 *  với API phân loại rác đa mô hình `/api/v1/waste-scan/classify` + Rule Engine. */
type Phase = "idle" | "scanning" | "done"

interface ViewModelResult {
  isOfflineDemo?: boolean
  isOod: boolean
  messageCode?: string | null
  message: string
  categoryCode: string
  material: string
  tag: string
  badge: string
  description: string
  binColor?: string
  hazardWarning?: string | null
  steps: string[]
  price: { label: string; value: string; unit: string }
  confidencePct: number
  rawConfidence: number
  modelLabel: string
  breakdown: { label: string; value: number; color: string }[]
  recyclable: boolean
}

const BAR_COLORS = [
  "var(--color-brand)",
  "var(--color-mint)",
  "var(--color-sage-line)",
] as const

function mapApiToViewModel(
  payload: WasteScanResponseDto,
  messageCode: string | null | undefined,
  selectedModelName: string,
): ViewModelResult {
  const { aiResult, sortingGuide } = payload
  const top = aiResult.topPrediction
  const rawConf = top?.confidence ?? 0
  const confPct = Math.round(rawConf * 1000) / 10
  const isOod =
    messageCode === "MSG-CLS-02" ||
    aiResult.isOutOfDistribution ||
    !top ||
    rawConf < (aiResult.confidenceThreshold || 0.6)

  const code = (sortingGuide?.categoryCode || top?.label || "unknown").toLowerCase()
  const meta = getCategoryMeta(code)

  const preds =
    aiResult.predictions && aiResult.predictions.length > 0
      ? aiResult.predictions.slice(0, 3)
      : top
        ? [top]
        : []

  const breakdown = preds.map((p, idx) => ({
    label: p.displayName || p.label,
    value: Math.max(0, Math.min(100, Math.round(p.confidence * 100))),
    color: BAR_COLORS[idx] ?? BAR_COLORS[2],
  }))

  const steps = parsePreparationSteps(sortingGuide?.preparationSteps)
  const latencyText =
    aiResult.inferenceTimeMs > 0 ? ` • ${aiResult.inferenceTimeMs.toFixed(1)} ms` : ""
  const resolvedModelName =
    aiResult.modelName || selectedModelName || aiResult.modelUsed || "YOLOv8 Detection"

  return {
    isOod,
    messageCode,
    message: payload.message,
    categoryCode: code,
    material: sortingGuide?.categoryName || top?.displayName || meta.shortName,
    tag: top?.displayName || meta.shortName,
    badge: isOod ? "Độ tin cậy thấp (< 60%) — Cần chụp rõ hơn" : meta.badge,
    description: isOod
      ? payload.message
      : sortingGuide?.handlingAction ||
        "Phân loại đúng quy định giúp tăng giá trị thu mua và tích Điểm Xanh.",
    binColor: sortingGuide?.standardBinColor,
    hazardWarning: sortingGuide?.hazardWarning,
    steps: steps.length > 0 ? steps : r.steps,
    price: {
      label: meta.recyclable ? "ĐƠN GIÁ THAM KHẢO" : "PHƯƠNG ÁN XỬ LÝ",
      value: meta.priceRange,
      unit: meta.priceUnit,
    },
    confidencePct: Math.round(confPct),
    rawConfidence: rawConf,
    modelLabel: `${resolvedModelName}${latencyText}`,
    breakdown,
    recyclable: !isOod && meta.recyclable,
  }
}

function buildOfflineDemoViewModel(): ViewModelResult {
  return {
    isOfflineDemo: true,
    isOod: false,
    messageCode: "MSG-CLS-01",
    message: "Đang hiển thị kết quả mẫu nội bộ (Dịch vụ AI chưa kết nối).",
    categoryCode: "plastic",
    material: r.material,
    tag: r.tag,
    badge: `${r.badge} (Mô phỏng Offline)`,
    description: r.description,
    binColor: "Cam",
    hazardWarning: "Không trộn lẫn chai nhựa từng chứa hóa chất độc hại.",
    steps: r.steps,
    price: r.price,
    confidencePct: r.confidence,
    rawConfidence: r.confidence / 100,
    modelLabel: `${r.model} (Offline Preview)`,
    breakdown: r.breakdown,
    recyclable: true,
  }
}

export default function Scanner() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [file, setFile] = useState<File | null>(null)
  const [useSample, setUseSample] = useState(false)
  const [camera, setCamera] = useState(false)

  const [models, setModels] = useState<AiModelOption[]>(DEFAULT_AI_MODELS)
  const [selectedModel, setSelectedModel] = useState<string>("yolov8_detect")
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)

  const [scanResult, setScanResult] = useState<ViewModelResult | null>(null)
  const [scanError, setScanError] = useState<{
    message: string
    code?: string
    canPreviewOffline: boolean
  } | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  // Nạp danh sách mô hình AI thực tế từ Backend khi mở trang
  useEffect(() => {
    const controller = new AbortController()
    fetchAiModels(controller.signal)
      .then((payload) => {
        if (payload.models.length > 0) {
          setModels(payload.models)
        }
        if (payload.default_model) {
          // Ưu tiên giữ yolov8_detect nếu có trong danh sách vì hỗ trợ cắt nền tốt nhất
          const hasDetect = payload.models.some((m) => m.id === "yolov8_detect" && m.is_ready !== false)
          setSelectedModel(hasDetect ? "yolov8_detect" : payload.default_model)
        }
        setApiOnline(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setApiOnline(false)
        }
      })

    return () => {
      controller.abort()
      abortRef.current?.abort()
    }
  }, [])

  const pick = (f: File | null) => {
    abortRef.current?.abort()
    setFile(f)
    setUseSample(false)
    setScanError(null)
    setScanResult(null)
    setPhase("idle")
  }

  const pickSample = () => {
    abortRef.current?.abort()
    setFile(null)
    setUseSample(true)
    setScanError(null)
    setScanResult(null)
    setPhase("idle")
  }

  const reset = () => {
    abortRef.current?.abort()
    setFile(null)
    setUseSample(false)
    setScanError(null)
    setScanResult(null)
    setPhase("idle")
  }

  const scan = async () => {
    const hasInput = Boolean(file || useSample)
    if (!hasInput) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setScanError(null)
    setPhase("scanning")

    const startedAt = Date.now()
    try {
      const targetFile = file ?? (await loadSampleImageAsFile(r.image, "sample-pet-bottle.png"))
      const res = await classifyWasteImage(targetFile, selectedModel, controller.signal)

      // Giữ hiệu ứng tia quét tối thiểu 550ms để mắt người dùng kịp quan sát nhịp quét
      const elapsed = Date.now() - startedAt
      if (elapsed < 550) {
        await new Promise((resolve) => setTimeout(resolve, 550 - elapsed))
      }
      if (controller.signal.aborted) return

      const modelMeta = models.find((m) => m.id === selectedModel)
      const vm = mapApiToViewModel(res.data, res.messageCode, modelMeta?.name ?? selectedModel)
      setApiOnline(true)
      setScanResult(vm)
      setPhase("done")
    } catch (err) {
      if (controller.signal.aborted || (err as { name?: string })?.name === "AbortError") {
        return
      }
      if (err instanceof ApiError) {
        const isServiceDown = err.isNetworkError || err.messageCode === "MSG-CLS-03"
        if (err.isNetworkError) setApiOnline(false)
        setScanError({
          message: err.message,
          code: err.messageCode,
          canPreviewOffline: isServiceDown,
        })
      } else {
        setScanError({
          message: err instanceof Error ? err.message : "Đã xảy ra lỗi khi phân tích hình ảnh.",
          canPreviewOffline: true,
        })
      }
      setPhase("idle")
    }
  }

  const previewOfflineDemo = () => {
    setScanError(null)
    setScanResult(buildOfflineDemoViewModel())
    setPhase("done")
  }

  const preview = file ?? (useSample || phase !== "idle" ? sampleShot : null)

  return (
    <div className="page flex flex-col py-5 md:py-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
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

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-body">
            <span className="font-semibold text-ink">Mô hình AI:</span>
            <select
              aria-label="Chọn mô hình nhận diện AI"
              value={selectedModel}
              disabled={phase === "scanning"}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="max-w-[230px] truncate bg-transparent font-medium text-brand-deep focus:outline-none disabled:opacity-60"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} disabled={m.is_ready === false}>
                  {m.name}
                  {m.is_ready === false ? " (Chưa nạp)" : ""}
                </option>
              ))}
            </select>
          </label>

          <p className="chip bg-surface-2 text-body">
            <i
              className={`size-1.5 rounded-full ${
                apiOnline === false ? "bg-warn" : "bg-brand"
              }`}
            />
            {apiOnline === false
              ? "Chưa kết nối AI Server"
              : "AI Vision & Rule Engine sẵn sàng"}
          </p>
        </div>
      </header>

      <div className="mt-4 grid gap-5 md:grid-cols-12">
        <section className="flex flex-col gap-3 md:col-span-6">
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
              onSample={pickSample}
              onCamera={() => setCamera(true)}
            />
          ) : preview ? (
            <Preview
              file={preview}
              scanning={phase === "scanning"}
              done={phase === "done"}
              result={scanResult}
              onReset={reset}
              onPick={pick}
              onCamera={() => setCamera(true)}
            />
          ) : null}

          {phase === "done" && !camera && scanResult && !scanResult.isOod && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base leading-6 font-bold tracking-tight text-ink">
                  Hướng dẫn xử lý nhanh (Rule Engine)
                </h2>
                {scanResult.binColor && (
                  <span className="rounded-full border border-brand/25 bg-brand/8 px-3 py-1 text-xs font-semibold text-brand-deep">
                    Thùng rác chuẩn: {scanResult.binColor}
                  </span>
                )}
              </div>

              <ol className="grid gap-2 sm:grid-cols-2">
                {scanResult.steps.map((step, i) => (
                  <li
                    key={`${i}-${step}`}
                    className="flex items-start gap-2.5 rounded-lg border border-line-soft bg-surface-2/60 px-3 py-2"
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/10 text-[11px] font-bold text-brand-deep">
                      {i + 1}
                    </span>
                    <span className="text-[13px] leading-5 text-ink">{step}</span>
                  </li>
                ))}
              </ol>

              {scanResult.hazardWarning && (
                <p className="rounded-lg border border-warn/25 bg-warn/5 px-3 py-2 text-xs leading-5 text-body">
                  <b className="text-warn">Lưu ý an toàn:</b> {scanResult.hazardWarning}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="md:col-span-6">
          <AiPanel
            phase={phase}
            canScan={!!preview}
            result={scanResult}
            error={scanError}
            onScan={scan}
            onPreviewOffline={previewOfflineDemo}
          />
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
  result,
  onReset,
  onPick,
  onCamera,
}: {
  file: File | typeof sampleShot
  scanning: boolean
  done: boolean
  result: ViewModelResult | null
  onReset: () => void
  onPick: (f: File | null) => void
  onCamera: () => void
}) {
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
            AI đang phân tích
          </span>
        ) : (
          <button
            type="button"
            onClick={onCamera}
            className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-white/90 px-3 py-1.5 text-[11px] font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md transition hover:bg-white"
          >
            <CameraIcon />
            Chụp trực tiếp
          </button>
        )}

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

        {done && result && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border border-line-soft bg-white/90 px-3.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md">
            <i
              className={`size-2 rounded-full ${
                result.isOod ? "bg-warn" : "bg-brand-deep"
              }`}
            />
            <b
              className={`text-xs font-semibold ${
                result.isOod ? "text-warn" : "text-brand-deep"
              }`}
            >
              {result.isOod ? "Chưa xác định rõ" : result.tag}
            </b>
            <em className="text-[11px] font-medium text-muted not-italic">
              • {result.confidencePct}% độ tin cậy
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
            accept=".jpg,.jpeg,.png,.webp,.bmp,image/*"
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
          Hỗ trợ JPG, PNG, WEBP. Ảnh rõ, nền thoáng giúp AI phân loại và định giá chuẩn xác.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onCamera} className="btn-primary h-11 px-5">
          <CameraIcon />
          Chụp ảnh
        </button>
        <label className="btn-outline h-11 cursor-pointer px-5">
          Tải ảnh lên
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.bmp,image/*"
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
        Dùng luôn ảnh mẫu để quét thử AI
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------- AI panel */

function AiPanel({
  phase,
  canScan,
  result,
  error,
  onScan,
  onPreviewOffline,
}: {
  phase: Phase
  canScan: boolean
  result: ViewModelResult | null
  error: { message: string; code?: string; canPreviewOffline: boolean } | null
  onScan: () => void
  onPreviewOffline: () => void
}) {
  const faceMeta =
    phase === "done" && result?.isOod
      ? {
          src: AI_IDLE,
          alt: "AI cần góc chụp rõ hơn",
          title: "Độ tin cậy chưa đạt 60%",
          note: "Vật thể lạ hoặc góc chụp mờ, bạn có thể chụp lại hoặc báo nhãn đúng.",
        }
      : FACE[phase]

  return (
    <div className="card flex flex-col gap-3 p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
      <AiFace
        {...faceMeta}
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

      {!canScan && phase === "idle" && !error && (
        <p className="reveal -mt-1 text-[13px] text-muted" style={{ animationDelay: `${T.gap}ms` }}>
          Chọn hoặc chụp một ảnh để bắt đầu quét
        </p>
      )}

      {error && phase === "idle" && (
        <div
          role="alert"
          className="reveal rounded-xl border border-warn/30 bg-warn/5 p-3.5 text-[13px] leading-5 text-ink"
        >
          <p className="font-semibold text-warn">
            Không thể hoàn tất quét AI {error.code ? `(${error.code})` : ""}
          </p>
          <p className="mt-1 text-body">{error.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onScan}
              className="btn-primary h-9 px-3.5 text-xs"
            >
              Thử quét lại
            </button>
            {error.canPreviewOffline && (
              <button
                type="button"
                onClick={onPreviewOffline}
                className="btn-ghost h-9 px-3.5 text-xs"
              >
                Xem kết quả mẫu (Offline)
              </button>
            )}
          </div>
        </div>
      )}

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

        {phase === "done" && result && (
          result.isOod ? <OodResult result={result} /> : <ScanResult result={result} />
        )}
      </div>
    </div>
  )
}

const CTA = {
  idle: "Quét AI",
  scanning: "Đang phân tích",
  done: "Quét lại",
} as const satisfies Record<Phase, string>

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
    note: "Đã khớp vật liệu với Rule Engine và tính đơn giá tham khảo.",
  },
} as const satisfies Record<Phase, { src: string; alt: string; title: string; note?: string }>

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

/* ---------------------------------------------------------------- kết quả chuẩn & OOD */

function ScanResult({ result }: { result: ViewModelResult }) {
  const mapUrl =
    result.recyclable && isDiscoverableCategory(result.categoryCode)
      ? `/map?category=${encodeURIComponent(result.categoryCode)}`
      : "/map"

  return (
    <div className="flex flex-col gap-3">
      <span
        className="draw-frame block w-full rounded-full border border-mint/40 bg-mint/25 px-3.5 py-1.5 text-center text-[11px] leading-4 font-semibold whitespace-nowrap text-brand-deep"
        style={{ animationDelay: `${T.chipFrame}ms` }}
      >
        <Words text={result.badge} from={T.chipWord} />
      </span>

      <div>
        <h2
          className="text-[24px] leading-8 font-bold tracking-tight text-ink"
          style={{ animationDelay: `${T.title}ms` }}
        >
          <Words text={result.material} from={T.title} />
        </h2>
        <p
          className="reveal mt-1 text-[13px] leading-5 text-body"
          style={{ animationDelay: `${T.desc}ms` }}
        >
          {result.description}
        </p>
      </div>

      <div
        className="reveal flex items-center justify-between rounded-lg border border-line-soft bg-surface-2 px-4 py-3"
        style={{ animationDelay: `${T.price}ms` }}
      >
        <div>
          <p className="text-[10px] font-semibold tracking-[0.5px] text-body uppercase">
            {result.price.label}
          </p>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <b className="text-xl leading-7 font-bold tracking-tight text-brand-deep">
              {result.price.value}
            </b>
            <span className="text-xs font-semibold text-body">{result.price.unit}</span>
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
            Chính xác {result.confidencePct}%
          </span>
        </div>

        <ul className="mt-3 flex flex-col gap-2.5">
          {result.breakdown.map((b, i) => (
            <li key={`${b.label}-${i}`}>
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

        <p className="mt-3 flex items-center justify-between gap-2 border-t border-line-soft pt-2.5 text-[11px] text-muted">
          <span className="flex items-center gap-1.5 truncate">
            <InfoIcon />
            {result.modelLabel}
          </span>
          {result.messageCode && (
            <span className="shrink-0 font-mono text-[10px] text-muted/80">
              {result.messageCode}
            </span>
          )}
        </p>
      </div>

      <div className="reveal flex flex-col gap-2" style={{ animationDelay: `${T.actions}ms` }}>
        {result.recyclable ? (
          <Link to={mapUrl} className="btn-primary h-11 w-full rounded-xl px-4">
            Tìm cơ sở thu mua loại rác này
          </Link>
        ) : (
          <Link to="/guidance" className="btn-outline h-11 w-full rounded-xl px-4">
            Xem hướng dẫn xử lý rác sinh hoạt
          </Link>
        )}

        <InlineFeedbackReport
          predictedLabel={result.categoryCode}
          confidenceScore={result.rawConfidence}
        />
      </div>
    </div>
  )
}

/** Hiển thị cảnh báo Out-of-Distribution (MSG-CLS-02) khi độ tin cậy < 60%. */
function OodResult({ result }: { result: ViewModelResult }) {
  return (
    <div className="reveal flex flex-col gap-3 pt-1">
      <div className="rounded-xl border border-warn/30 bg-warn/5 p-4">
        <p className="flex items-center justify-between gap-2 text-xs font-semibold text-warn">
          <span>Cảnh báo ngưỡng an toàn AI (MSG-CLS-02)</span>
          <span>Độ tin cậy: {result.confidencePct}% (&lt; 60%)</span>
        </p>
        <p className="mt-1.5 text-[13px] leading-5 text-ink">{result.message}</p>
        {result.breakdown.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Dự đoán gần nhất: <b className="text-ink">{result.breakdown[0].label}</b> (
            {result.breakdown[0].value}%) • {result.modelLabel}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-line-soft bg-surface-2 p-3.5 text-[13px] leading-5 text-body">
        <p className="font-semibold text-ink">Mẹo chụp lại để đạt độ chính xác cao:</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-body">
          <li>Đặt món rác ở giữa khung hình, cách camera khoảng 20–40 cm.</li>
          <li>Tránh chụp ngược sáng hoặc để nhiều đồ vật khác lọt vào nền.</li>
          <li>Hoặc thử chuyển sang mô hình <b>EfficientNet-B0</b> ở góc phải phía trên.</li>
        </ul>
      </div>

      <InlineFeedbackReport
        predictedLabel={result.categoryCode}
        confidenceScore={result.rawConfidence}
        defaultOpen
      />
    </div>
  )
}

/** Gửi phản hồi AI nhận diện sai ngay tại màn hình quét (POST /api/v1/waste-scan/feedback). */
function InlineFeedbackReport({
  predictedLabel,
  confidenceScore,
  defaultOpen = false,
}: {
  predictedLabel: string
  confidenceScore: number
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [reportedLabel, setReportedLabel] = useState("")
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [doneMsg, setDoneMsg] = useState("")
  const [errMsg, setErrMsg] = useState("")

  const handleSubmit = async () => {
    if (!reportedLabel || sending) return
    setSending(true)
    setErrMsg("")
    try {
      const res = await submitAiFeedback({
        predictedLabel,
        confidenceScore,
        userReportedLabel: reportedLabel,
        note: note.trim() || undefined,
      })
      setDoneMsg(res.message)
    } catch (err) {
      setErrMsg(
        err instanceof Error
          ? err.message
          : "Chưa gửi được phản hồi. Vui lòng thử lại sau.",
      )
    } finally {
      setSending(false)
    }
  }

  if (doneMsg) {
    return (
      <p role="status" className="rounded-lg border border-brand/25 bg-brand/8 px-3 py-2 text-xs font-medium text-brand-deep">
        {doneMsg}
      </p>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-center text-xs font-medium text-muted underline underline-offset-4 hover:text-brand-deep"
      >
        AI nhận diện chưa đúng? Báo nhãn đúng tại đây
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink">Báo cáo nhãn rác đúng (cải thiện AI)</span>
        {!defaultOpen && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted hover:text-ink"
          >
            Đóng
          </button>
        )}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select
          aria-label="Chọn loại rác đúng"
          value={reportedLabel}
          onChange={(e) => setReportedLabel(e.target.value)}
          className="h-9 rounded-lg border border-sage-line bg-white px-2.5 text-xs text-ink focus:border-brand focus:outline-none"
        >
          <option value="">-- Chọn loại rác đúng --</option>
          {AI_CLASS_OPTIONS.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú thêm (tuỳ chọn)"
          className="h-9 rounded-lg border border-sage-line bg-white px-2.5 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
        />
      </div>

      {errMsg && <p className="mt-1.5 text-warn">{errMsg}</p>}

      <button
        type="button"
        disabled={!reportedLabel || sending}
        onClick={handleSubmit}
        className="btn-outline mt-2 h-8 px-3 text-xs disabled:opacity-50"
      >
        {sending ? "Đang gửi..." : "Gửi phản hồi"}
      </button>
    </div>
  )
}

function HowTo() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
          Dùng trang này thế nào
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-muted">
          Ba bước, chưa đến một phút là có đơn giá tham khảo và điểm thu mua.
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
