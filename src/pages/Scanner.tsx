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
  type DetectedWasteObjectDto,
  type WasteScanResponseDto,
  type WasteSortingGuideDto,
} from "@/lib/wasteScanApi"
import { isDiscoverableCategory } from "@/lib/recyclerDiscoveryApi"

/** Trang này giữ bố cục gọn 2 cột (6/6) vừa màn hình 1440x900 và kết nối trực tiếp
 *  với API phân loại rác đa vật thể `/api/v1/waste-scan/classify` + Rule Engine. */
type Phase = "idle" | "scanning" | "done"

interface DetectedBoxItem {
  id: number
  categoryCode: string
  shortGroup: string
  displayName: string
  confidencePct: number
  rawConfidence: number
  isPrimary: boolean
  isOod: boolean
  recyclable: boolean
  bbox: [number, number, number, number]
  material: string
  badge: string
  description: string
  binColor?: string
  hazardWarning?: string | null
  steps: string[]
  price: { label: string; value: string; unit: string }
}

interface ViewModelResult {
  isOfflineDemo?: boolean
  isOod: boolean
  confidenceThreshold: number
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
  imageWidth?: number
  imageHeight?: number
  detectedCount: number
  categorySummary: Record<string, number>
  objects: DetectedBoxItem[]
  activeRank?: number
}

const BAR_COLORS = [
  "var(--color-brand)",
  "var(--color-mint)",
  "var(--color-sage-line)",
] as const

function toValidBbox(raw?: number[] | null): [number, number, number, number] | null {
  if (!Array.isArray(raw) || raw.length < 4) return null
  const [x1, y1, x2, y2] = raw.map((n) => Number(n))
  if ([x1, y1, x2, y2].some((n) => Number.isNaN(n))) return null
  if (x2 <= x1 || y2 <= y1) return null
  return [x1, y1, x2, y2]
}

function buildBoxItem(
  dto: DetectedWasteObjectDto,
  threshold: number,
  fallbackGuide?: WasteSortingGuideDto | null,
): DetectedBoxItem | null {
  const bbox = toValidBbox(dto.bbox)
  if (!bbox) return null

  const code = (dto.sortingGuide?.categoryCode || dto.label || "unknown").toLowerCase()
  const meta = getCategoryMeta(code)
  const guide =
    dto.sortingGuide ??
    (fallbackGuide && fallbackGuide.categoryCode?.toLowerCase() === code
      ? fallbackGuide
      : null)

  const rawConf = dto.confidence ?? 0
  const confPct = Math.round(rawConf * 100)
  const isOod = rawConf < threshold
  const parsedSteps = parsePreparationSteps(guide?.preparationSteps)

  return {
    id: dto.id || 1,
    categoryCode: code,
    shortGroup: meta.group,
    displayName: dto.displayName || meta.shortName,
    confidencePct: confPct,
    rawConfidence: rawConf,
    isPrimary: Boolean(dto.isPrimary),
    isOod,
    recyclable: !isOod && meta.recyclable,
    bbox,
    material: guide?.categoryName || dto.displayName || meta.shortName,
    badge: isOod ? "Độ tin cậy thấp (< 60%) — Cần chụp rõ hơn" : meta.badge,
    description: isOod
      ? `Vật thể #${dto.id || 1} có độ tin cậy ${confPct}% (< ${Math.round(threshold * 100)}%). Bạn có thể chọn khung khác hoặc chụp gần hơn.`
      : guide?.handlingAction ||
        "Phân loại đúng quy định giúp tăng giá trị thu mua và tích Điểm Xanh.",
    binColor: guide?.standardBinColor || meta.defaultBinColor,
    hazardWarning: guide?.hazardWarning,
    steps: parsedSteps.length > 0 ? parsedSteps : meta.defaultSteps,
    price: {
      label: meta.recyclable ? "ĐƠN GIÁ THAM KHẢO" : "PHƯƠNG ÁN XỬ LÝ",
      value: meta.priceRange,
      unit: meta.priceUnit,
    },
  }
}

function mapApiToViewModel(
  payload: WasteScanResponseDto,
  messageCode: string | null | undefined,
  selectedModelName: string,
): ViewModelResult {
  const { aiResult, sortingGuide } = payload
  const threshold = aiResult.confidenceThreshold || 0.6
  const top = aiResult.topPrediction
  const rawConf = top?.confidence ?? 0
  const confPct = Math.round(rawConf * 1000) / 10
  const isOod =
    messageCode === "MSG-CLS-02" ||
    aiResult.isOutOfDistribution ||
    !top ||
    rawConf < threshold

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

  // Dựng danh sách vật thể đóng khung (hỗ trợ cả multi-object mới lẫn fallback croppedBbox đơn lẻ)
  const mappedObjects: DetectedBoxItem[] = []
  if (Array.isArray(aiResult.detectedObjects) && aiResult.detectedObjects.length > 0) {
    for (const obj of aiResult.detectedObjects) {
      const built = buildBoxItem(obj, threshold, sortingGuide)
      if (built) mappedObjects.push(built)
    }
  } else if (top) {
    const fallbackBox = toValidBbox(aiResult.croppedBbox)
    if (fallbackBox) {
      const singleBuilt = buildBoxItem(
        {
          id: 1,
          rawClass: top.label,
          label: top.label,
          displayName: top.displayName,
          confidence: top.confidence,
          centerScore: top.confidence,
          isPrimary: true,
          bbox: fallbackBox,
          sortingGuide,
        },
        threshold,
        sortingGuide,
      )
      if (singleBuilt) mappedObjects.push(singleBuilt)
    }
  }

  const summary: Record<string, number> =
    aiResult.categorySummary && Object.keys(aiResult.categorySummary).length > 0
      ? aiResult.categorySummary
      : mappedObjects.reduce<Record<string, number>>((acc, item) => {
          acc[item.categoryCode] = (acc[item.categoryCode] ?? 0) + 1
          return acc
        }, {})

  const steps = parsePreparationSteps(sortingGuide?.preparationSteps)
  const latencyText =
    aiResult.inferenceTimeMs > 0 ? ` • ${aiResult.inferenceTimeMs.toFixed(1)} ms` : ""
  const resolvedModelName =
    aiResult.modelName || selectedModelName || aiResult.modelUsed || "YOLOv8 Detection"

  return {
    isOod,
    confidenceThreshold: threshold,
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
    binColor: sortingGuide?.standardBinColor || meta.defaultBinColor,
    hazardWarning: sortingGuide?.hazardWarning,
    steps: steps.length > 0 ? steps : meta.defaultSteps,
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
    imageWidth: aiResult.imageWidth || undefined,
    imageHeight: aiResult.imageHeight || undefined,
    detectedCount: aiResult.detectedCount ?? mappedObjects.length,
    categorySummary: summary,
    objects: mappedObjects,
    activeRank: mappedObjects.length > 0 ? 1 : undefined,
  }
}

/** Chuyển đổi dữ liệu hiển thị sang đúng vật thể #k mà người dùng đang bấm chọn trên ảnh. */
function resolveSelectedViewModel(
  base: ViewModelResult | null,
  selectedIndex: number,
): ViewModelResult | null {
  if (!base || base.objects.length === 0) return base
  const chosen = base.objects[selectedIndex] ?? base.objects[0]
  if (!chosen) return base

  // Nếu đang xem vật thể #1 mặc định, giữ nguyên phân phối Top-3 gốc
  if (selectedIndex === 0) {
    return {
      ...base,
      activeRank: chosen.id,
    }
  }

  const altBreakdown = [
    {
      label: `${chosen.displayName} (Khung #${chosen.id})`,
      value: chosen.confidencePct,
      color: BAR_COLORS[0],
    },
    ...base.breakdown
      .filter((b) => b.label !== chosen.displayName)
      .slice(0, 2)
      .map((b, i) => ({
        ...b,
        color: BAR_COLORS[i + 1] ?? BAR_COLORS[2],
      })),
  ]

  return {
    ...base,
    isOod: chosen.isOod,
    messageCode: chosen.isOod ? "MSG-CLS-02" : "MSG-CLS-01",
    message: chosen.description,
    categoryCode: chosen.categoryCode,
    material: chosen.material,
    tag: chosen.displayName,
    badge: chosen.badge,
    description: chosen.description,
    binColor: chosen.binColor,
    hazardWarning: chosen.hazardWarning,
    steps: chosen.steps,
    price: chosen.price,
    confidencePct: chosen.confidencePct,
    rawConfidence: chosen.rawConfidence,
    breakdown: altBreakdown,
    recyclable: chosen.recyclable,
    activeRank: chosen.id,
  }
}

function buildOfflineDemoViewModel(): ViewModelResult {
  const demoBox: DetectedBoxItem = {
    id: 1,
    categoryCode: "plastic",
    shortGroup: "Nhựa",
    displayName: r.tag,
    confidencePct: r.confidence,
    rawConfidence: r.confidence / 100,
    isPrimary: true,
    isOod: false,
    recyclable: true,
    bbox: [217.4, 42.1, 295.2, 235.1],
    material: r.material,
    badge: `${r.badge} (Mô phỏng Offline)`,
    description: r.description,
    binColor: "Cam",
    hazardWarning: "Không trộn lẫn chai nhựa từng chứa hóa chất độc hại.",
    steps: r.steps,
    price: r.price,
  }

  return {
    isOfflineDemo: true,
    isOod: false,
    confidenceThreshold: 0.6,
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
    imageWidth: 512,
    imageHeight: 279,
    detectedCount: 1,
    categorySummary: { plastic: 1 },
    objects: [demoBox],
    activeRank: 1,
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
  const [selectedObjectIndex, setSelectedObjectIndex] = useState<number>(0)
  const [showBoxes, setShowBoxes] = useState<boolean>(true)
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
    setSelectedObjectIndex(0)
    setShowBoxes(true)
    setPhase("idle")
  }

  const pickSample = () => {
    abortRef.current?.abort()
    setFile(null)
    setUseSample(true)
    setScanError(null)
    setScanResult(null)
    setSelectedObjectIndex(0)
    setShowBoxes(true)
    setPhase("idle")
  }

  const reset = () => {
    abortRef.current?.abort()
    setFile(null)
    setUseSample(false)
    setScanError(null)
    setScanResult(null)
    setSelectedObjectIndex(0)
    setShowBoxes(true)
    setPhase("idle")
  }

  const runScan = async (explicitFile?: File) => {
    const hasInput = Boolean(explicitFile || file || useSample)
    if (!hasInput) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (explicitFile) {
      setFile(explicitFile)
      setUseSample(false)
    }

    setScanError(null)
    setSelectedObjectIndex(0)
    setShowBoxes(true)
    setPhase("scanning")

    const startedAt = Date.now()
    try {
      const targetFile =
        explicitFile ??
        file ??
        (await loadSampleImageAsFile(r.image, "sample-pet-bottle.png"))
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
      setSelectedObjectIndex(0)
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
    setSelectedObjectIndex(0)
    setShowBoxes(true)
    setScanResult(buildOfflineDemoViewModel())
    setPhase("done")
  }

  const activeResult = resolveSelectedViewModel(scanResult, selectedObjectIndex)
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
              onShoot={(capturedFile, autoScan) => {
                setCamera(false)
                if (autoScan) {
                  void runScan(capturedFile)
                } else {
                  pick(capturedFile)
                }
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
              result={activeResult}
              selectedIndex={selectedObjectIndex}
              showBoxes={showBoxes}
              onSelectObject={setSelectedObjectIndex}
              onToggleBoxes={() => setShowBoxes((v) => !v)}
              onReset={reset}
              onPick={pick}
              onCamera={() => setCamera(true)}
            />
          ) : null}

          {phase === "done" && !camera && activeResult && !activeResult.isOod && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base leading-6 font-bold tracking-tight text-ink">
                  Hướng dẫn xử lý nhanh (Rule Engine)
                  {activeResult.objects.length > 1 && activeResult.activeRank
                    ? ` — Khung #${activeResult.activeRank}`
                    : ""}
                </h2>
                {activeResult.binColor && (
                  <span className="rounded-full border border-brand/25 bg-brand/8 px-3 py-1 text-xs font-semibold text-brand-deep">
                    Thùng rác chuẩn: {activeResult.binColor}
                  </span>
                )}
              </div>

              <ol className="grid gap-2 sm:grid-cols-2">
                {activeResult.steps.map((step, i) => (
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

              {activeResult.hazardWarning && (
                <p className="rounded-lg border border-warn/25 bg-warn/5 px-3 py-2 text-xs leading-5 text-body">
                  <b className="text-warn">Lưu ý an toàn:</b> {activeResult.hazardWarning}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="md:col-span-6">
          <AiPanel
            phase={phase}
            canScan={!!preview}
            result={activeResult}
            error={scanError}
            onScan={() => void runScan()}
            onPreviewOffline={previewOfflineDemo}
            onSelectPrimary={
              activeResult && activeResult.objects.length > 1 && selectedObjectIndex !== 0
                ? () => setSelectedObjectIndex(0)
                : undefined
            }
          />
        </section>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- ảnh xem trước + Bounding Box đa vật thể */

const sampleShot = "sample" as const

function Preview({
  file,
  scanning,
  done,
  result,
  selectedIndex,
  showBoxes,
  onSelectObject,
  onToggleBoxes,
  onReset,
  onPick,
  onCamera,
}: {
  file: File | typeof sampleShot
  scanning: boolean
  done: boolean
  result: ViewModelResult | null
  selectedIndex: number
  showBoxes: boolean
  onSelectObject: (idx: number) => void
  onToggleBoxes: () => void
  onReset: () => void
  onPick: (f: File | null) => void
  onCamera: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  useEffect(() => {
    setNaturalSize({ w: 0, h: 0 })
    if (file === sampleShot) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const boxes = result?.objects ?? []
  const imgW = result?.imageWidth || naturalSize.w
  const imgH = result?.imageHeight || naturalSize.h

  const summaryChips = result
    ? Object.entries(result.categorySummary).map(([code, count]) => ({
        code,
        name: getCategoryMeta(code).group,
        count,
      }))
    : []

  return (
    <div className="overflow-clip rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="relative flex min-h-[240px] max-h-[390px] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-mint/12 via-surface-2 to-surface-3">
        {/* Khung neo khớp 100% tỷ lệ bitmap gốc để tọa độ Bounding Box không bị lệch trên mọi khung hình */}
        <div className="relative inline-flex max-h-[390px] max-w-full select-none">
          <img
            src={url ?? r.image}
            alt={file === sampleShot ? r.imageCaption : "Ảnh bạn đã chọn"}
            onLoad={(e) => {
              const el = e.currentTarget
              if (el.naturalWidth > 0 && el.naturalHeight > 0) {
                setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight })
              }
            }}
            className="block h-auto max-h-[390px] w-auto max-w-full"
          />

          {done && showBoxes && boxes.length > 0 && imgW > 0 && imgH > 0 && (
            <div className="pointer-events-none absolute inset-0">
              {boxes.map((box, idx) => {
                const isSelected = idx === selectedIndex
                const x1 = Math.max(0, Math.min(imgW, box.bbox[0]))
                const y1 = Math.max(0, Math.min(imgH, box.bbox[1]))
                const x2 = Math.max(x1 + 1, Math.min(imgW, box.bbox[2]))
                const y2 = Math.max(y1 + 1, Math.min(imgH, box.bbox[3]))

                const leftPct = (x1 / imgW) * 100
                const topPct = (y1 / imgH) * 100
                const widthPct = ((x2 - x1) / imgW) * 100
                const heightPct = ((y2 - y1) / imgH) * 100

                const placeLabelInside = topPct < 12
                const alignLabelRight = leftPct > 62

                const toneBorder = box.isOod
                  ? isSelected
                    ? "border-warn bg-warn/12 ring-2 ring-white/90"
                    : "border-warn/80 border-dashed bg-warn/5 hover:bg-warn/12"
                  : box.recyclable
                    ? isSelected
                      ? "border-[#16a34a] bg-[#22c55e]/12 ring-2 ring-white/90"
                      : "border-white/90 border-dashed bg-ink/10 hover:border-mint-bright hover:bg-[#22c55e]/12"
                    : isSelected
                      ? "border-amber-500 bg-amber-500/12 ring-2 ring-white/90"
                      : "border-white/85 border-dashed bg-ink/10 hover:border-amber-400"

                const pillTone = box.isOod
                  ? "bg-warn text-white"
                  : isSelected
                    ? "bg-brand-deep text-white"
                    : "bg-ink/85 text-white hover:bg-brand-deep"

                return (
                  <button
                    key={`${box.id}-${idx}`}
                    type="button"
                    onClick={() => onSelectObject(idx)}
                    aria-label={`Chọn vật thể #${box.id}: ${box.displayName}, độ tin cậy ${box.confidencePct}%`}
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                      zIndex: isSelected ? 20 : 10 + (boxes.length - idx),
                    }}
                    className={`pointer-events-auto absolute rounded-lg border-2 transition duration-150 focus:outline-none ${toneBorder} ${
                      isSelected
                        ? "shadow-[0_4px_16px_rgba(0,0,0,0.28)]"
                        : "opacity-90 hover:opacity-100"
                    }`}
                  >
                    {isSelected && (
                      <>
                        <span className="pointer-events-none absolute -top-0.5 -left-0.5 size-2.5 rounded-tl border-t-2 border-l-2 border-white" />
                        <span className="pointer-events-none absolute -top-0.5 -right-0.5 size-2.5 rounded-tr border-t-2 border-r-2 border-white" />
                        <span className="pointer-events-none absolute -bottom-0.5 -left-0.5 size-2.5 rounded-bl border-b-2 border-l-2 border-white" />
                        <span className="pointer-events-none absolute -right-0.5 -bottom-0.5 size-2.5 rounded-br border-r-2 border-b-2 border-white" />
                      </>
                    )}

                    <span
                      className={`pointer-events-auto absolute inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] leading-4 font-semibold whitespace-nowrap shadow-sm ${pillTone} ${
                        placeLabelInside ? "top-1" : "-top-6"
                      } ${alignLabelRight ? "right-0" : "left-0"}`}
                    >
                      <span>#{box.id}</span>
                      <span>{box.shortGroup}</span>
                      <span className="opacity-85">• {box.confidencePct}%</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {scanning && <div className="scan-line" aria-hidden="true" />}

        {scanning ? (
          <span className="absolute top-3 left-3 z-30 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[11px] font-semibold text-white">
            <span className="pulse-bar size-1.5 rounded-full bg-mint-bright" />
            AI đang khoanh vùng &amp; phân loại
          </span>
        ) : (
          <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">
            {done && boxes.length > 0 && (
              <button
                type="button"
                onClick={onToggleBoxes}
                className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-white/92 px-2.5 py-1.5 text-[11px] font-semibold text-brand-deep shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md transition hover:bg-white"
              >
                <BoxIcon />
                {showBoxes ? "Ẩn khung" : `Hiện khung (${boxes.length})`}
              </button>
            )}
            <button
              type="button"
              onClick={onCamera}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-white/92 px-3 py-1.5 text-[11px] font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md transition hover:bg-white"
            >
              <CameraIcon />
              Chụp trực tiếp
            </button>
          </div>
        )}

        {!scanning && (
          <button
            type="button"
            onClick={onReset}
            title="Bỏ ảnh"
            aria-label="Bỏ ảnh"
            className="absolute top-3 left-3 z-30 grid size-8 place-items-center rounded-full border border-line-soft bg-white/92 text-warn shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md transition hover:bg-warn hover:text-white"
          >
            <CloseIcon />
          </button>
        )}

        {done && result && (
          <span className="pointer-events-none absolute bottom-3 left-3 z-30 inline-flex max-w-[calc(100%-24px)] items-center gap-2 rounded-full border border-line-soft bg-white/92 px-3.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md">
            <i
              className={`size-2 shrink-0 rounded-full ${
                result.isOod ? "bg-warn" : "bg-brand-deep"
              }`}
            />
            <b
              className={`truncate text-xs font-semibold ${
                result.isOod ? "text-warn" : "text-brand-deep"
              }`}
            >
              {result.activeRank ? `#${result.activeRank} ` : ""}
              {result.isOod ? "Chưa xác định rõ" : result.tag}
            </b>
            <em className="shrink-0 text-[11px] font-medium text-muted not-italic">
              • {result.confidencePct}% độ tin cậy
            </em>
          </span>
        )}
      </div>

      {/* Thanh chọn vật thể đa khung (Đề xuất 1 + 2) */}
      {done && result && (
        <div className="border-t border-surface-2 bg-surface/75 px-4 py-2.5">
          {boxes.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-ink">
                  {boxes.length > 1
                    ? `Đã khoanh vùng ${boxes.length} vật thể (ưu tiên gần tâm #1)`
                    : "Đã khoanh vùng vật thể chính (#1)"}
                </span>
                {summaryChips.length > 0 && (
                  <span className="text-[11px] text-muted">
                    {summaryChips.map((s) => `${s.name} x${s.count}`).join(" • ")}
                  </span>
                )}
              </div>

              {boxes.length > 1 && (
                <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Danh sách vật thể nhận diện trên ảnh">
                  {boxes.map((box, idx) => {
                    const active = idx === selectedIndex
                    return (
                      <button
                        key={`chip-${box.id}-${idx}`}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onSelectObject(idx)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                          active
                            ? box.isOod
                              ? "border-warn bg-warn/12 font-semibold text-warn"
                              : "border-brand bg-brand/10 font-semibold text-brand-deep"
                            : "border-line bg-white text-body hover:border-sage-line hover:text-ink"
                        }`}
                      >
                        <span
                          className={`grid size-4 place-items-center rounded-full text-[10px] font-bold ${
                            active
                              ? box.isOod
                                ? "bg-warn text-white"
                                : "bg-brand-deep text-white"
                              : "bg-surface-3 text-ink"
                          }`}
                        >
                          {box.id}
                        </span>
                        <span>{box.shortGroup}</span>
                        <span className="text-[11px] opacity-80">{box.confidencePct}%</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted">
              Chế độ phân loại toàn khung ảnh — Hãy đưa vật thể lại gần giữa khung hình để AI đóng khung chính xác hơn.
            </p>
          )}
        </div>
      )}

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
          Hỗ trợ JPG, PNG, WEBP. AI tự động đóng khung từng món rác và ưu tiên vật thể ở giữa khung ngắm.
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
  onSelectPrimary,
}: {
  phase: Phase
  canScan: boolean
  result: ViewModelResult | null
  error: { message: string; code?: string; canPreviewOffline: boolean } | null
  onScan: () => void
  onPreviewOffline: () => void
  onSelectPrimary?: () => void
}) {
  const faceMeta =
    phase === "done" && result?.isOod
      ? {
          src: AI_IDLE,
          alt: "AI cần góc chụp rõ hơn",
          title: "Độ tin cậy chưa đạt 60%",
          note: "Vật thể lạ hoặc góc chụp mờ, bạn có thể chụp lại hoặc báo nhãn đúng.",
        }
      : phase === "done" && result && result.objects.length > 1
        ? {
            src: AI_DONE,
            alt: "AI đã nhận diện đa vật thể",
            title: `Đã nhận diện ${result.objects.length} vật thể (đang xem #${result.activeRank ?? 1})`,
            note: "Bấm vào khung bất kỳ trên ảnh để xem hướng dẫn & đơn giá từng món.",
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
          data-message-code={error.code || undefined}
          className="reveal rounded-xl border border-warn/30 bg-warn/5 p-3.5 text-[13px] leading-5 text-ink"
        >
          <p className="font-semibold text-warn">Không thể hoàn tất quét AI</p>
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

      <div key={`${phase}-${result?.activeRank ?? 0}`}>
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
          result.isOod ? (
            <OodResult result={result} onSelectPrimary={onSelectPrimary} />
          ) : (
            <ScanResult result={result} />
          )
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
    note: "Đưa ảnh vật rác vào, AI sẽ đóng khung vật thể và định giá giúp bạn.",
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
    note: "Đã khoanh vùng vật thể, khớp Rule Engine và tính đơn giá tham khảo.",
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
        className="draw-frame block w-full truncate rounded-full border border-mint/40 bg-mint/25 px-3.5 py-1.5 text-center text-[11px] leading-4 font-semibold text-brand-deep"
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
            {result.objects.length > 1 && result.activeRank
              ? ` (Khung #${result.activeRank})`
              : ""}
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

        <p
          data-message-code={result.messageCode || undefined}
          className="mt-3 flex items-center gap-1.5 truncate border-t border-line-soft pt-2.5 text-[11px] text-muted"
        >
          <InfoIcon />
          <span className="truncate">{result.modelLabel}</span>
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
function OodResult({
  result,
  onSelectPrimary,
}: {
  result: ViewModelResult
  onSelectPrimary?: () => void
}) {
  return (
    <div
      data-message-code={result.messageCode || "MSG-CLS-02"}
      className="reveal flex flex-col gap-3 pt-1"
    >
      <div className="rounded-xl border border-warn/30 bg-warn/5 p-4">
        <p className="flex items-center justify-between gap-2 text-xs font-semibold text-warn">
          <span>
            Cảnh báo ngưỡng nhận diện AI
            {result.activeRank ? ` • Khung #${result.activeRank}` : ""}
          </span>
          <span>Độ tin cậy: {result.confidencePct}% (&lt; 60%)</span>
        </p>
        <p className="mt-1.5 text-[13px] leading-5 text-ink">{result.message}</p>
        {result.breakdown.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Dự đoán gần nhất: <b className="text-ink">{result.breakdown[0].label}</b> (
            {result.breakdown[0].value}%) • {result.modelLabel}
          </p>
        )}
        {onSelectPrimary && (
          <button
            type="button"
            onClick={onSelectPrimary}
            className="btn-outline mt-3 h-8 px-3 text-xs"
          >
            Quay về vật thể chính (#1)
          </button>
        )}
      </div>

      <div className="rounded-xl border border-line-soft bg-surface-2 p-3.5 text-[13px] leading-5 text-body">
        <p className="font-semibold text-ink">Mẹo chụp lại để đạt độ chính xác cao:</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-body">
          <li>Đặt món rác vào <b>khung ngắm trung tâm</b> trên camera, cách 20–40 cm.</li>
          <li>Tránh chụp ngược sáng hoặc để tay che khuất phần lớn nhãn/thân chai.</li>
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

/* ---------------------------------------------------------------- camera + Khung ngắm trung tâm (Đề xuất 2) */

function CameraPanel({
  onShoot,
  onClose,
}: {
  onShoot: (f: File, autoScan: boolean) => void
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

  const shoot = (autoScan: boolean) => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const c = document.createElement("canvas")
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height)
    c.toBlob(
      (blob) => {
        if (blob) {
          onShoot(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }), autoScan)
        }
      },
      "image/jpeg",
      0.92,
    )
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

            {/* Khung ngắm trung tâm (Center Focus Reticle) — giúp AI ưu tiên đúng vật thể #1 */}
            {ready && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4"
              >
                <div className="relative h-[68%] w-[54%] max-w-[280px] rounded-2xl border border-white/25 bg-white/[0.02] shadow-[0_0_0_9999px_rgba(10,24,18,0.22)]">
                  <span className="absolute -top-0.5 -left-0.5 size-5 rounded-tl-xl border-t-[3px] border-l-[3px] border-mint-bright" />
                  <span className="absolute -top-0.5 -right-0.5 size-5 rounded-tr-xl border-t-[3px] border-r-[3px] border-mint-bright" />
                  <span className="absolute -bottom-0.5 -left-0.5 size-5 rounded-bl-xl border-b-[3px] border-l-[3px] border-mint-bright" />
                  <span className="absolute -right-0.5 -bottom-0.5 size-5 rounded-br-xl border-r-[3px] border-b-[3px] border-mint-bright" />
                  <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint-bright/80 ring-4 ring-mint-bright/20" />
                </div>
                <span className="mt-2.5 rounded-full bg-ink/80 px-3 py-1 text-[11px] font-medium text-white/95 backdrop-blur-sm">
                  Đặt vật rác vào khung ngắm trung tâm (AI ưu tiên #1)
                </span>
              </div>
            )}

            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[11px] font-semibold text-white">
              <i className="pulse-bar size-1.5 rounded-full bg-mint-bright" />
              Camera đang mở
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 px-4 py-2.5">
        <p className="text-[13px] text-muted">
          {err ? "Hoặc đóng rồi dùng nút tải ảnh lên" : "Giữ vật thể ở giữa khung ngắm rồi chụp"}
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={onClose} className="btn-ghost h-9 px-3.5 text-[13px]">
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => shoot(false)}
            disabled={!!err || !ready}
            className="btn-outline h-9 px-3.5 text-[13px] disabled:opacity-50"
          >
            Chụp xem trước
          </button>
          <button
            type="button"
            onClick={() => shoot(true)}
            disabled={!!err || !ready}
            className="btn-primary h-9 px-4 text-[13px] disabled:opacity-50"
          >
            <SparkIcon />
            Chụp &amp; Quét ngay
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

function BoxIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 5.5V3.5a1 1 0 011-1h2M10.5 2.5h2a1 1 0 011 1v2M13.5 10.5v2a1 1 0 01-1 1h-2M5.5 13.5h-2a1 1 0 01-1-1v-2" {...stroke} />
      <rect x="5.2" y="5.2" width="5.6" height="5.6" rx="1" {...stroke} />
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
