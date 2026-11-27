import { useCallback, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { RequiredMark } from "@/components/Portal"
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
  fetchAiModels,
  fetchMyScanHistory,
  fetchSortingRules,
  getCategoryMeta,
  loadSampleImageAsFile,
  parsePreparationSteps,
  submitAiFeedback,
  type DetectedWasteObjectDto,
  type MyWasteScanHistoryItemDto,
  type WasteScanResponseDto,
  type WasteSortingGuideDto,
} from "@/lib/wasteScanApi"
import { fetchMyAiFeedback, type MyAiFeedbackReportDto } from "@/lib/aiCurationApi"
import { isSsrSmokeTest } from "@/lib/hydration"
import { openAuthPopup } from "@/lib/popupAuth"
import { getAccessToken, hasLiveBackendAuth, useSession } from "@/lib/session"
import { isDiscoverableCategory } from "@/lib/recyclerDiscoveryApi"

/** Trang này giữ bố cục gọn 2 cột (6/6) vừa màn hình 1440x900 và kết nối trực tiếp
 *  với API phân loại rác đa vật thể `/api/v1/waste-scan/classify` + Rule Engine. */
type Phase = "idle" | "scanning" | "done"

interface DetectedBoxItem {
  id: number
  categoryCode: string
  shortGroup: string
  displayName: string
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
  scanId?: string | null
  imageUrl?: string | null
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
  rawConfidence: number
  recyclable: boolean
  imageWidth?: number
  imageHeight?: number
  detectedCount: number
  categorySummary: Record<string, number>
  objects: DetectedBoxItem[]
  activeRank?: number
}

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

  const rawCode = (dto.sortingGuide?.categoryCode || dto.label || "unknown").toLowerCase()
  const guide =
    dto.sortingGuide ??
    (fallbackGuide && fallbackGuide.categoryCode?.toLowerCase() === rawCode
      ? fallbackGuide
      : null)

  const rawConf = dto.confidence ?? 0
  const isUnsupported = rawConf >= threshold && (!guide || rawCode === "unknown")
  const isOod = rawConf < threshold || isUnsupported
  if (isOod) {
    return {
      id: dto.id || 1,
      categoryCode: "unknown",
      shortGroup: isUnsupported ? "Không hỗ trợ" : "Chưa rõ",
      displayName: isUnsupported ? "Loại rác không hỗ trợ" : "Chưa đủ cơ sở kết luận",
      rawConfidence: rawConf,
      isPrimary: Boolean(dto.isPrimary),
      isOod: true,
      recyclable: false,
      bbox,
      material: "Không thể kết luận loại vật liệu",
      badge: isUnsupported
        ? "Danh mục tạm ngưng hoặc chưa hỗ trợ — Vui lòng quét loại rác khác"
        : "Chưa đủ rõ để kết luận — Cần chụp gần hơn",
      description: isUnsupported
        ? "Loại rác tại vị trí này hiện không nằm trong danh mục hỗ trợ phân loại của hệ thống. Vui lòng quét loại rác khác."
        : `Vật thể #${dto.id || 1} bị mờ hoặc khuất sáng nên hệ thống chưa đưa ra kết luận. Bạn có thể chọn khung khác hoặc chụp gần hơn.`,
      binColor: undefined,
      hazardWarning: null,
      steps: [],
      price: {
        label: "TRẠNG THÁI",
        value: isUnsupported ? "Chưa hỗ trợ" : "Chưa rõ",
        unit: "",
      },
    }
  }

  const meta = getCategoryMeta(rawCode)
  const parsedSteps = parsePreparationSteps(guide?.preparationSteps)

  return {
    id: dto.id || 1,
    categoryCode: rawCode,
    shortGroup: meta.boxLabel,
    displayName: dto.displayName || meta.shortName,
    rawConfidence: rawConf,
    isPrimary: Boolean(dto.isPrimary),
    isOod: false,
    recyclable: meta.recyclable,
    bbox,
    material: guide?.categoryName || dto.displayName || meta.shortName,
    badge: meta.badge,
    description:
      guide?.handlingAction ||
      "Phân loại đúng quy định giúp tăng giá trị thu mua và bảo vệ môi trường.",
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
  messageCode?: string | null,
): ViewModelResult {
  const { aiResult, sortingGuide } = payload
  const threshold = aiResult.confidenceThreshold || 0.6
  const top = aiResult.topPrediction
  const rawConf = top?.confidence ?? 0
  const rawCode = (sortingGuide?.categoryCode || top?.label || "unknown").toLowerCase()
  const isUnsupported =
    !aiResult.isOutOfDistribution &&
    Boolean(top) &&
    rawConf >= threshold &&
    (!sortingGuide || rawCode === "unknown")
  const isOod =
    messageCode === "MSG-CLS-02" ||
    aiResult.isOutOfDistribution ||
    !top ||
    rawConf < threshold ||
    isUnsupported

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

  if (isOod) {
    return {
      scanId: payload.scanId ?? null,
      imageUrl: payload.imageUrl ?? null,
      isOod: true,
      confidenceThreshold: threshold,
      messageCode: messageCode || "MSG-CLS-02",
      message: isUnsupported
        ? payload.message ||
          "Loại rác trong ảnh hiện không nằm trong danh mục hỗ trợ phân loại của hệ thống. Vui lòng quét loại rác khác."
        : payload.message,
      categoryCode: "unknown",
      material: "Không thể kết luận loại vật liệu",
      tag: "Chưa xác định",
      badge: isUnsupported
        ? "Danh mục tạm ngưng hoặc chưa hỗ trợ"
        : "Chưa đủ rõ để kết luận — Cần chụp gần hơn",
      description: isUnsupported
        ? "Loại rác trong ảnh hiện không nằm trong danh mục hỗ trợ phân loại của hệ thống. Vui lòng quét loại rác khác."
        : payload.message,
      binColor: undefined,
      hazardWarning: null,
      steps: [],
      price: {
        label: "TRẠNG THÁI",
        value: isUnsupported ? "Chưa hỗ trợ" : "Chưa rõ",
        unit: "",
      },
      rawConfidence: rawConf,
      recyclable: false,
      imageWidth: aiResult.imageWidth || undefined,
      imageHeight: aiResult.imageHeight || undefined,
      detectedCount: 0,
      categorySummary: {},
      objects: mappedObjects,
      activeRank: mappedObjects.length > 0 ? 1 : undefined,
    }
  }

  const meta = getCategoryMeta(rawCode)
  const summary: Record<string, number> =
    aiResult.categorySummary && Object.keys(aiResult.categorySummary).length > 0
      ? aiResult.categorySummary
      : mappedObjects.reduce<Record<string, number>>((acc, item) => {
          if (!item.isOod && item.categoryCode !== "unknown") {
            acc[item.categoryCode] = (acc[item.categoryCode] ?? 0) + 1
          }
          return acc
        }, {})

  const steps = parsePreparationSteps(sortingGuide?.preparationSteps)

  return {
    scanId: payload.scanId ?? null,
    imageUrl: payload.imageUrl ?? null,
    isOod: false,
    confidenceThreshold: threshold,
    messageCode,
    message: payload.message,
    categoryCode: rawCode,
    material: sortingGuide?.categoryName || top?.displayName || meta.shortName,
    tag: top?.displayName || meta.shortName,
    badge: meta.badge,
    description:
      sortingGuide?.handlingAction ||
      "Phân loại đúng quy định giúp tăng giá trị thu mua và bảo vệ môi trường.",
    binColor: sortingGuide?.standardBinColor || meta.defaultBinColor,
    hazardWarning: sortingGuide?.hazardWarning,
    steps: steps.length > 0 ? steps : meta.defaultSteps,
    price: {
      label: meta.recyclable ? "ĐƠN GIÁ THAM KHẢO" : "PHƯƠNG ÁN XỬ LÝ",
      value: meta.priceRange,
      unit: meta.priceUnit,
    },
    rawConfidence: rawConf,
    recyclable: meta.recyclable,
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

  // Vật thể #1 mặc định giữ nguyên bản đồ hiển thị gốc
  if (selectedIndex === 0) {
    return {
      ...base,
      activeRank: chosen.id,
    }
  }

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
    rawConfidence: chosen.rawConfidence,
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
    rawConfidence: r.confidence / 100,
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
  const session = useSession()
  const isGuest = !session && !isSsrSmokeTest()
  const [phase, setPhase] = useState<Phase>("idle")
  const [file, setFile] = useState<File | null>(null)
  const [useSample, setUseSample] = useState(false)
  const [camera, setCamera] = useState(false)

  const [apiOnline, setApiOnline] = useState<boolean | null>(null)

  const [scanResult, setScanResult] = useState<ViewModelResult | null>(null)
  const [selectedObjectIndex, setSelectedObjectIndex] = useState<number>(0)
  const [showBoxes, setShowBoxes] = useState<boolean>(true)
  const [myFeedbacks, setMyFeedbacks] = useState<MyAiFeedbackReportDto[]>([])
  const [myScanHistory, setMyScanHistory] = useState<MyWasteScanHistoryItemDto[]>([])
  const [hasSession, setHasSession] = useState<boolean>(false)
  const [showMyHistory, setShowMyHistory] = useState<boolean>(false)
  const [scanError, setScanError] = useState<{
    message: string
    code?: string
    canPreviewOffline: boolean
  } | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const refreshMyFeedbacks = () => {
    const loggedIn = Boolean(getAccessToken()) || hasLiveBackendAuth()
    setHasSession(loggedIn)
    if (!loggedIn) return
    fetchMyAiFeedback({ pageSize: 5 })
      .then((res) => {
        if (res.success && Array.isArray(res.data?.items)) {
          setMyFeedbacks(res.data.items)
        }
      })
      .catch(() => {
        // Bỏ qua êm nếu phiên hết hạn hoặc backend đang offline
      })
    fetchMyScanHistory({ pageSize: 5 })
      .then((res) => {
        if (res.success && Array.isArray(res.data?.items)) {
          setMyScanHistory(res.data.items)
        }
      })
      .catch(() => {
        // Bỏ qua êm nếu phiên hết hạn hoặc backend đang offline
      })
  }

  useEffect(() => {
    refreshMyFeedbacks()
  }, [])

  // Kiểm tra trạng thái sẵn sàng của AI Service khi mở trang
  useEffect(() => {
    const controller = new AbortController()
    fetchAiModels(controller.signal)
      .then(() => {
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
    if (isGuest) {
      openAuthPopup("login")
      return
    }
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

    if (isGuest) {
      if (!useSample || explicitFile || file) {
        openAuthPopup("login")
        return
      }
      // Khách được phép quét thử ảnh mẫu demo bằng mô phỏng nội bộ không tiêu tốn tài nguyên AI Backend
      setScanError(null)
      setSelectedObjectIndex(0)
      setShowBoxes(true)
      setPhase("scanning")
      setTimeout(() => {
        setScanResult({
          ...buildOfflineDemoViewModel(),
          message: "Kết quả quét thử ảnh mẫu dành cho Khách. Đăng nhập để chụp hoặc tải ảnh rác thật của bạn.",
        })
        setPhase("done")
      }, 450)
      return
    }

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
      const res = await classifyWasteImage(targetFile, "yolo26_detect", controller.signal)

      // Giữ hiệu ứng tia quét tối thiểu 550ms để mắt người dùng kịp quan sát nhịp quét
      const elapsed = Date.now() - startedAt
      if (elapsed < 550) {
        await new Promise((resolve) => setTimeout(resolve, 550 - elapsed))
      }
      if (controller.signal.aborted) return

      const vm = mapApiToViewModel(res.data, res.messageCode)
      setApiOnline(true)
      setScanResult(vm)
      setSelectedObjectIndex(0)
      setPhase("done")
      refreshMyFeedbacks()
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
          <p className="flex items-center gap-1.5 text-sm text-body">
            Hệ sinh thái
            <Separator />
            <span className="font-medium text-brand-deep">Nhận diện thông minh</span>
          </p>
          <h1 className="display mt-1 text-[22px] leading-7 md:text-2xl md:leading-8">
            Phân loại &amp; Định giá rác tái chế
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <p className="chip bg-surface-2 text-body">
            <i
              className={`size-1.5 rounded-full ${
                apiOnline === false ? "bg-warn" : "bg-brand"
              }`}
            />
            {apiOnline === false ? "Chưa kết nối máy chủ nhận diện" : "AI sẵn sàng"}
          </p>
          <Link
            to="/waste"
            className="btn-outline inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold"
          >
            Tra cứu loại rác
          </Link>
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
              isGuest={isGuest}
              onPick={pick}
              onSample={pickSample}
              onCamera={() => {
                if (isGuest) {
                  openAuthPopup("login")
                  return
                }
                setCamera(true)
              }}
            />
          ) : preview ? (
            <Preview
              isGuest={isGuest}
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
              onCamera={() => {
                if (isGuest) {
                  openAuthPopup("login")
                  return
                }
                setCamera(true)
              }}
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
                    <span className="text-sm leading-6 text-ink">{step}</span>
                  </li>
                ))}
              </ol>

              {activeResult.hazardWarning && (
                <p className="rounded-lg border border-warn/25 bg-warn/5 px-3 py-2 text-sm leading-6 text-body">
                  <b className="text-warn">Lưu ý an toàn:</b> {activeResult.hazardWarning}
                </p>
              )}
            </div>
          )}

          {hasSession && (
            <div className="rounded-2xl border border-line bg-surface p-3.5 sm:px-4 sm:py-3">
              <button
                type="button"
                aria-expanded={showMyHistory}
                onClick={() => {
                  const next = !showMyHistory
                  setShowMyHistory(next)
                  if (next) refreshMyFeedbacks()
                }}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6 font-semibold text-ink">
                    Lịch sử quét &amp; báo sai AI của tôi
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted">
                    {myScanHistory.length} lượt quét · {myFeedbacks.length} báo sai
                  </p>
                </div>
                <span className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-line bg-surface-2 px-3 text-[13px] font-semibold text-brand-deep transition-colors hover:border-sage-line hover:bg-surface-3">
                  {showMyHistory ? "Ẩn" : "Xem"}
                </span>
              </button>

              {showMyHistory && (
                <div className="mt-3 flex flex-col gap-3 border-t border-line-soft pt-3">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
                      Lần quét AI gần đây
                    </p>
                    {myScanHistory.length === 0 ? (
                      <p className="text-sm leading-6 text-muted">
                        Chưa có lượt quét ảnh AI nào được lưu.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {myScanHistory.map((item) => {
                          const meta = getCategoryMeta(item.predictedLabel)
                          return (
                            <div
                              key={item.scanId}
                              className="flex flex-col gap-1 rounded-xl border border-line-soft bg-surface-2/80 px-3 py-2.5 text-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                <p className="min-w-0 font-semibold text-ink [overflow-wrap:anywhere]">
                                  {meta.shortName}{" "}
                                  <span className="tabular-nums text-brand-deep">
                                    ({Math.round(item.confidenceScore * 100)}%)
                                  </span>
                                </p>
                                <span className="max-w-full shrink-0 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand-deep">
                                  {item.predictedLabel}
                                </span>
                              </div>
                              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-5 text-muted">
                                <span>
                                  {item.sortingGuide?.standardBinColor
                                    ? `Thùng ${item.sortingGuide.standardBinColor}`
                                    : item.pipelineUsed}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                  {new Date(item.scannedAt).toLocaleString("vi-VN")}
                                </span>
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
                      Báo cáo phân loại sai của tôi
                    </p>
                    {myFeedbacks.length === 0 ? (
                      <p className="text-sm leading-6 text-muted">
                        Bạn chưa gửi báo cáo phân loại sai nào.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {myFeedbacks.map((fb) => (
                          <div
                            key={fb.id}
                            className="flex flex-col gap-1.5 rounded-xl border border-line-soft bg-surface-2/80 px-3 py-2.5 text-sm"
                          >
                            <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                              <span className="min-w-0 leading-6 font-semibold text-ink [overflow-wrap:anywhere]">
                                AI: {fb.predictedLabel} → Đề xuất: {fb.userReportedLabel}
                              </span>
                              <span className="max-w-full shrink-0 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-semibold text-brand-deep">
                                {fb.status === "Reviewed"
                                  ? `Đã duyệt (${fb.adminVerifiedLabel ?? fb.userReportedLabel})`
                                  : fb.status === "Rejected"
                                    ? "Từ chối"
                                    : "Chờ duyệt"}
                              </span>
                            </div>
                            {fb.reviewNote && (
                              <p className="text-sm leading-6 text-muted [overflow-wrap:anywhere]">
                                Phản hồi Staff: {fb.reviewNote}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
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
            onFeedbackSubmitted={refreshMyFeedbacks}
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
  isGuest = false,
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
  isGuest?: boolean
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
        name: getCategoryMeta(code).boxLabel,
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
                    aria-label={`Chọn vật thể #${box.id}: ${box.displayName}`}
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
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {scanning && <div className="scan-line" aria-hidden="true" />}

        {scanning ? (
          <span className="absolute top-3 left-3 z-30 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-xs font-semibold text-white">
            <span className="pulse-bar size-1.5 rounded-full bg-mint-bright" />
            AI đang khoanh vùng &amp; phân loại
          </span>
        ) : (
          <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">
            {done && boxes.length > 0 && (
              <button
                type="button"
                onClick={onToggleBoxes}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line-soft bg-white/92 px-3 py-1.5 text-xs font-semibold text-brand-deep shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md transition hover:bg-white"
              >
                <BoxIcon />
                {showBoxes ? "Ẩn khung" : `Hiện khung (${boxes.length})`}
              </button>
            )}
            <button
              type="button"
              onClick={onCamera}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-soft bg-white/92 px-3 py-1.5 text-xs font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md transition hover:bg-white"
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
            className="absolute top-3 left-3 z-30 grid size-9 place-items-center rounded-full border border-line-soft bg-white/92 text-warn shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md transition hover:bg-warn hover:text-white"
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
          </span>
        )}
      </div>

      {/* Thanh chọn vật thể đa khung (Đề xuất 1 + 2) */}
      {done && result && (
        <div className="border-t border-surface-2 bg-surface/75 px-4 py-2.5">
          {boxes.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-ink">
                  {boxes.length > 1
                    ? `Đã khoanh vùng ${boxes.length} vật thể (ưu tiên gần tâm #1)`
                    : "Đã khoanh vùng vật thể chính (#1)"}
                </span>
                {summaryChips.length > 0 && (
                  <span className="text-xs text-muted">
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
                        className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition sm:min-h-9 ${
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
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted">
              Chế độ phân loại toàn khung ảnh — Hãy đưa vật thể lại gần giữa khung hình để AI đóng khung chính xác hơn.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-surface-2 bg-white px-4 py-2.5">
        <span className="truncate text-sm text-body">
          {file === sampleShot ? r.imageCaption : file.name}
        </span>
        <label
          onClick={(e) => {
            if (isGuest) {
              e.preventDefault()
              openAuthPopup("login")
            }
          }}
          className="btn-outline min-h-10 shrink-0 cursor-pointer px-3.5 text-[13px] font-semibold sm:min-h-9"
        >
          {isGuest ? "Đăng nhập để đổi ảnh" : "Đổi ảnh"}
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
  isGuest = false,
  onPick,
  onSample,
  onCamera,
}: {
  isGuest?: boolean
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
        <p className="mt-1.5 text-sm leading-6 text-muted">
          {isGuest
            ? "Khách có thể dùng thử ảnh mẫu AI bên dưới. Đăng nhập để chụp hoặc tải ảnh rác thật từ thiết bị."
            : "Hỗ trợ JPG, PNG, WEBP. AI tự động đóng khung từng món rác và ưu tiên vật thể ở giữa khung ngắm."}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onCamera} className="btn-primary min-h-11 px-5 text-sm font-semibold">
          <CameraIcon />
          Chụp ảnh
        </button>
        <label
          onClick={(e) => {
            if (isGuest) {
              e.preventDefault()
              openAuthPopup("login")
            }
          }}
          className="btn-outline min-h-11 cursor-pointer px-5 text-sm font-semibold"
        >
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
        className="min-h-10 px-3 text-sm font-semibold text-brand-deep underline underline-offset-4 hover:text-brand"
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
  onFeedbackSubmitted,
}: {
  phase: Phase
  canScan: boolean
  result: ViewModelResult | null
  error: { message: string; code?: string; canPreviewOffline: boolean } | null
  onScan: () => void
  onPreviewOffline: () => void
  onSelectPrimary?: () => void
  onFeedbackSubmitted?: () => void
}) {
  const faceMeta =
    phase === "done" && result?.isOod
      ? {
          src: AI_IDLE,
          alt: "Chưa thể xác định chính xác",
          title: "Chưa thể xác định chính xác",
          note: "Hình ảnh mờ hoặc vật thể ngoài danh mục hỗ trợ, bạn có thể chụp lại hoặc báo nhãn đúng.",
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
            className="btn-primary min-h-10 shrink-0 rounded-xl px-4 text-sm font-semibold sm:min-h-9"
          >
            <SparkIcon />
            {CTA[phase]}
          </button>
        }
      />

      {error && phase === "idle" && (
        <div
          role="alert"
          data-message-code={error.code || undefined}
          className="reveal rounded-xl border border-warn/30 bg-warn/5 p-3.5 text-sm leading-6 text-ink"
        >
          <p className="font-semibold text-warn">Không thể hoàn tất quét AI</p>
          <p className="mt-1 text-body">{error.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onScan}
              className="btn-primary min-h-10 px-4 text-[13px] font-semibold sm:min-h-9"
            >
              Thử quét lại
            </button>
            {error.canPreviewOffline && (
              <button
                type="button"
                onClick={onPreviewOffline}
                className="btn-ghost min-h-10 px-4 text-[13px] font-semibold sm:min-h-9"
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
            <OodResult
              result={result}
              onSelectPrimary={onSelectPrimary}
              onFeedbackSubmitted={onFeedbackSubmitted}
            />
          ) : (
            <ScanResult result={result} onFeedbackSubmitted={onFeedbackSubmitted} />
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
          className="reveal text-base leading-6 font-bold text-ink"
          style={{ animationDuration: "260ms" }}
        >
          {title}
        </h2>
        {note && (
          <p
            key={note}
            className="reveal text-sm leading-6 text-muted"
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

function getConfidenceDisplay(rawConfidence: number, threshold = 0.6) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(rawConfidence) ? rawConfidence : 0))
  const pctNumber = Math.round(clamped * 1000) / 10
  const pctText = `${pctNumber.toFixed(1)}%`
  const barWidth = `${Math.max(4, Math.min(100, Math.round(clamped * 100)))}%`
  if (clamped < threshold) {
    return {
      pctText,
      barWidth,
      levelText: "Dưới ngưỡng tin cậy",
      badgeClass: "border-warn/35 bg-warn/10 text-warn",
      barClass: "bg-warn",
    }
  }
  if (clamped >= 0.85) {
    return {
      pctText,
      barWidth,
      levelText: "Độ tin cậy rất cao",
      badgeClass: "border-brand/30 bg-brand/12 text-brand-deep",
      barClass: "bg-brand",
    }
  }
  return {
    pctText,
    barWidth,
    levelText: "Độ tin cậy khá",
    badgeClass: "border-brand/25 bg-mint/25 text-brand-deep",
    barClass: "bg-brand",
  }
}

function ScanResult({
  result,
  onFeedbackSubmitted,
}: {
  result: ViewModelResult
  onFeedbackSubmitted?: () => void
}) {
  const mapUrl =
    result.recyclable && isDiscoverableCategory(result.categoryCode)
      ? `/map?category=${encodeURIComponent(result.categoryCode)}`
      : "/map"
  const summaryEntries = Object.entries(result.categorySummary)
  const conf = getConfidenceDisplay(result.rawConfidence, result.confidenceThreshold)

  return (
    <div className="flex flex-col gap-3">
      <span
        className={`draw-frame block w-full truncate rounded-full border px-3.5 py-1.5 text-center text-xs leading-5 font-semibold ${
          result.recyclable
            ? "border-mint/40 bg-mint/25 text-brand-deep"
            : result.categoryCode === "battery"
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "border-amber-300 bg-amber-50 text-amber-800"
        }`}
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
          className="reveal mt-1 text-sm leading-6 text-body"
          style={{ animationDelay: `${T.desc}ms` }}
        >
          {result.description}
        </p>
        {!result.recyclable && result.hazardWarning && (
          <div
            role="alert"
            className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 font-medium text-rose-800"
          >
            {result.hazardWarning}
          </div>
        )}
      </div>

      <div
        className="reveal flex items-center justify-between rounded-lg border border-line-soft bg-surface-2 px-4 py-3"
        style={{ animationDelay: `${T.price}ms` }}
      >
        <div>
          <p className="text-xs font-semibold tracking-[0.5px] text-body uppercase">
            {result.price.label}
          </p>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <b className="text-xl leading-7 font-bold tracking-tight text-brand-deep">
              {result.price.value}
            </b>
            <span className="text-sm font-semibold text-body">{result.price.unit}</span>
          </p>
        </div>
        <PriceIcon />
      </div>

      <div
        data-message-code={result.messageCode || undefined}
        className="reveal rounded-lg border border-line-soft bg-surface-2 p-4"
        style={{ animationDelay: `${T.conf}ms` }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <ShieldIcon />
            Kết luận phân loại
            {result.objects.length > 1 && result.activeRank
              ? ` (Vật thể #${result.activeRank})`
              : ""}
          </p>
          <span className="rounded-full border border-brand/20 bg-mint/25 px-2.5 py-1 text-xs font-semibold text-brand-deep">
            {result.binColor
              ? `Thùng ${result.binColor}`
              : result.recyclable
                ? "Có thể tái chế"
                : "Rác sinh hoạt"}
          </span>
        </div>

        <div className="mt-3 rounded-lg border border-line bg-white px-3.5 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-ink">
              Độ tin cậy AI (Kết quả chắc chắn nhất)
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums ${conf.badgeClass}`}
            >
              <span>{conf.pctText}</span>
              <span>·</span>
              <span>{conf.levelText}</span>
            </span>
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-label="Độ tin cậy AI"
            aria-valuenow={Math.round(result.rawConfidence * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full transition-all ${conf.barClass}`}
              style={{ width: conf.barWidth }}
            />
          </div>
        </div>

        {result.detectedCount > 1 && summaryEntries.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {summaryEntries.map(([code, count]) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[13px] font-semibold text-ink"
                >
                  <span>{getCategoryMeta(code).boxLabel}</span>
                  <span className="text-brand-deep">×{count}</span>
                </span>
              ))}
            </div>
            <p className="text-sm leading-6 text-muted">
              Đã tìm thấy {result.detectedCount} vật rác trong ảnh. Bấm vào từng khung đánh số trên ảnh để xem hướng dẫn sơ chế riêng cho từng món.
            </p>
          </div>
        ) : (
          <p className="mt-2.5 text-sm leading-6 text-body">
            Đã xác định loại vật liệu phù hợp nhất và đối chiếu quy chuẩn phân loại hiện hành.
          </p>
        )}
      </div>

      <div className="reveal flex flex-col gap-2" style={{ animationDelay: `${T.actions}ms` }}>
        {result.recyclable ? (
          <Link to={mapUrl} className="btn-primary min-h-11 w-full rounded-xl px-4 text-sm font-semibold">
            Tìm cơ sở thu mua loại rác này
          </Link>
        ) : (
          <Link to="/guidance" className="btn-outline min-h-11 w-full rounded-xl px-4 text-sm font-semibold">
            Xem chi tiết hướng dẫn phân loại &amp; xử lý
          </Link>
        )}

        <InlineFeedbackReport
          scanId={result.scanId}
          imageUrl={result.imageUrl}
          predictedLabel={result.categoryCode}
          confidenceScore={result.rawConfidence}
          onSubmitted={onFeedbackSubmitted}
        />
      </div>
    </div>
  )
}

/** Hiển thị cảnh báo Out-of-Distribution (MSG-CLS-02) khi hình ảnh chưa đủ rõ để kết luận. */
function OodResult({
  result,
  onSelectPrimary,
  onFeedbackSubmitted,
}: {
  result: ViewModelResult
  onSelectPrimary?: () => void
  onFeedbackSubmitted?: () => void
}) {
  const conf = getConfidenceDisplay(result.rawConfidence, result.confidenceThreshold)
  const isLowConfidence =
    result.rawConfidence > 0 && result.rawConfidence < result.confidenceThreshold
  return (
    <div
      data-message-code={result.messageCode || "MSG-CLS-02"}
      className="reveal flex flex-col gap-3 pt-1"
    >
      <div className="rounded-xl border border-warn/30 bg-warn/5 p-4">
        <p className="flex items-center justify-between gap-2 text-sm font-semibold text-warn">
          <span>
            {isLowConfidence ? "Chưa đủ cơ sở kết luận" : "Không thể kết luận loại vật liệu"}
            {result.activeRank ? ` • Khung #${result.activeRank}` : ""}
          </span>
          <span>{isLowConfidence ? "Cần chụp rõ hơn" : "Vui lòng quét loại rác khác"}</span>
        </p>
        <p className="mt-1.5 text-sm leading-6 text-ink">
          {result.message ||
            "Loại rác trong ảnh hiện đang tạm ngưng hỗ trợ hoặc không nằm trong danh mục phân loại hiện hành. Vui lòng quét loại rác khác."}
        </p>
        {isLowConfidence && (
          <p className="mt-2 rounded-lg border border-warn/25 bg-white/80 px-3 py-2 text-sm leading-6 font-medium text-ink">
            Độ tin cậy cao nhất AI đo được:{" "}
            <b className="tabular-nums text-warn">{conf.pctText}</b> (thấp hơn ngưỡng an toàn tối thiểu{" "}
            {Math.round(result.confidenceThreshold * 100)}%).
          </p>
        )}
        {onSelectPrimary && (
          <button
            type="button"
            onClick={onSelectPrimary}
            className="btn-outline mt-3 min-h-10 px-3.5 text-[13px] font-semibold sm:min-h-9"
          >
            Quay về vật thể chính (#1)
          </button>
        )}
      </div>

      <div className="rounded-xl border border-line-soft bg-surface-2 p-3.5 text-sm leading-6 text-body">
        <p className="font-semibold text-ink">
          {isLowConfidence
            ? "Mẹo chụp lại để hệ thống kết luận chính xác:"
            : "Gợi ý tiếp theo:"}
        </p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-6 text-body">
          {isLowConfidence ? (
            <>
              <li>Đặt món rác vào giữa khung hình camera, cách 20–40 cm.</li>
              <li>Tránh chụp ngược sáng hoặc để tay che khuất phần lớn nhãn/thân chai.</li>
              <li>Đặt vật rác trên nền thoáng, đủ sáng để hệ thống nhận diện chính xác nhất.</li>
            </>
          ) : (
            <>
              <li>Hệ thống không áp dụng quy tắc phân loại hoặc thu mua cho danh mục đang tạm ngưng.</li>
              <li>Bạn có thể chụp ảnh một loại rác khác thuộc danh mục đang hỗ trợ trên EcoLink.</li>
            </>
          )}
        </ul>
      </div>

      <InlineFeedbackReport
        scanId={result.scanId}
        imageUrl={result.imageUrl}
        predictedLabel={result.categoryCode}
        confidenceScore={result.rawConfidence}
        defaultOpen
        onSubmitted={onFeedbackSubmitted}
      />
    </div>
  )
}

/** Gửi phản hồi AI nhận diện sai ngay tại màn hình quét (POST /api/v1/waste-scan/feedback). */
function InlineFeedbackReport({
  scanId,
  imageUrl,
  predictedLabel,
  confidenceScore,
  defaultOpen = false,
  onSubmitted,
}: {
  scanId?: string | null
  imageUrl?: string | null
  predictedLabel: string
  confidenceScore: number
  defaultOpen?: boolean
  onSubmitted?: () => void
}) {
  const session = useSession()
  const isGuest = !session && !isSsrSmokeTest()
  const [open, setOpen] = useState(defaultOpen)
  const [reportedLabel, setReportedLabel] = useState("")
  const [activeClassOptions, setActiveClassOptions] =
    useState<readonly { code: string; label: string }[]>(AI_CLASS_OPTIONS)
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [doneMsg, setDoneMsg] = useState("")
  const [errMsg, setErrMsg] = useState("")

  useEffect(() => {
    if (!open || isSsrSmokeTest()) return
    const controller = new AbortController()
    fetchSortingRules(controller.signal)
      .then((rules) => {
        if (controller.signal.aborted) return
        const activeCodes = new Set(rules.map((r) => r.categoryCode.toLowerCase()))
        const filtered = AI_CLASS_OPTIONS.filter((opt) =>
          activeCodes.has(opt.code.toLowerCase()),
        )
        setActiveClassOptions(filtered)
        setReportedLabel((prev) =>
          prev && filtered.some((o) => o.code === prev) ? prev : "",
        )
      })
      .catch(() => {})
    return () => controller.abort()
  }, [open])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (isGuest) {
      openAuthPopup("login")
      return
    }
    if (sending) return
    setErrMsg("")
    if (!reportedLabel) {
      setErrMsg("Vui lòng chọn loại rác đúng thực tế trước khi gửi phản hồi.")
      return
    }
    if (note.trim().length > 500) {
      setErrMsg("Ghi chú phản hồi AI không được vượt quá 500 ký tự.")
      return
    }
    setSending(true)
    try {
      const res = await submitAiFeedback({
        scanId,
        imageUrl: imageUrl ?? undefined,
        predictedLabel,
        confidenceScore,
        userReportedLabel: reportedLabel,
        note: note.trim() || undefined,
      })
      setDoneMsg(res.message)
      onSubmitted?.()
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
      <p role="status" className="rounded-lg border border-brand/25 bg-brand/8 px-3 py-2 text-sm leading-6 font-medium text-brand-deep">
        {doneMsg}
      </p>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          if (isGuest) {
            openAuthPopup("login")
            return
          }
          setOpen(true)
        }}
        className="min-h-10 self-center px-2 text-sm font-medium text-muted underline underline-offset-4 hover:text-brand-deep sm:min-h-9"
      >
        AI nhận diện chưa đúng? Báo nhãn đúng tại đây
      </button>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(e)}
      className="rounded-xl border border-line bg-surface p-3.5 text-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink">Báo cáo nhãn rác đúng (cải thiện AI)</span>
        {!defaultOpen && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-9 px-2 text-[13px] font-medium text-muted hover:text-ink"
          >
            Đóng
          </button>
        )}
      </div>

      <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          <span>
            Loại rác đúng theo bạn
            <RequiredMark />
          </span>
          <select
            aria-label="Chọn loại rác đúng"
            value={reportedLabel}
            onChange={(e) => {
              setReportedLabel(e.target.value)
              setErrMsg("")
            }}
            className="min-h-11 rounded-lg border border-sage-line bg-white px-3 text-base font-normal text-ink focus:border-brand focus:outline-none sm:text-[15px]"
          >
            <option value="">-- Chọn loại rác đúng --</option>
            {activeClassOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          <span>Ghi chú thêm</span>
          <input
            type="text"
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setErrMsg("")
            }}
            placeholder="Ghi chú thêm (tuỳ chọn)"
            className="min-h-11 rounded-lg border border-sage-line bg-white px-3 text-base font-normal text-ink placeholder:text-muted focus:border-brand focus:outline-none sm:text-[15px]"
          />
        </label>
      </div>

      {errMsg && (
        <p role="alert" className="mt-2 rounded-lg border border-warn/30 bg-warn/10 px-2.5 py-1.5 text-sm leading-6 font-medium text-warn">
          {errMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="btn-outline mt-3 min-h-10 px-4 text-sm font-semibold disabled:opacity-50 sm:min-h-9"
      >
        {sending ? "Đang gửi..." : "Gửi phản hồi"}
      </button>
    </form>
  )
}

function HowTo() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg leading-7 font-bold tracking-tight text-ink">
          Dùng trang này thế nào
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">
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
              <p className="text-sm leading-6 font-semibold text-ink">{s.title}</p>
              <p className="mt-0.5 text-sm leading-6 text-body">{s.desc}</p>
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
  actions: 1440,
} as const

/* ---------------------------------------------------------------- camera (chụp ảnh trực tiếp) */

function getCameraViewport() {
  if (typeof window === "undefined") {
    return { isLandscape: false, isFullScreen: false }
  }
  const w = document.documentElement.clientWidth || window.innerWidth
  const h = document.documentElement.clientHeight || window.innerHeight
  const mediaLandscape = window.matchMedia?.("(orientation: landscape)").matches ?? false
  const isLandscape = w !== h ? w > h : mediaLandscape
  // Giữ viewfinder toàn màn hình trên cả điện thoại xoay ngang (vd. 844×390, 932×430)
  const isFullScreen = w < 768 || (w < 1024 && h < 580)
  return { isLandscape, isFullScreen }
}

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
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [viewport, setViewport] = useState(getCameraViewport)

  useEffect(() => {
    let rafId = 0
    let timerId = 0
    const sync = () => {
      const next = getCameraViewport()
      setViewport((prev) =>
        prev.isLandscape === next.isLandscape && prev.isFullScreen === next.isFullScreen
          ? prev
          : next,
      )
    }
    // Trên iOS/Android, kích thước viewport có thể trễ 1 nhịp sau sự kiện orientationchange
    const scheduleSync = () => {
      sync()
      cancelAnimationFrame(rafId)
      clearTimeout(timerId)
      rafId = requestAnimationFrame(sync)
      timerId = window.setTimeout(sync, 120)
    }
    const mql = window.matchMedia?.("(orientation: landscape)")
    window.addEventListener("resize", scheduleSync)
    window.addEventListener("orientationchange", scheduleSync)
    mql?.addEventListener?.("change", scheduleSync)
    screen.orientation?.addEventListener?.("change", scheduleSync)
    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(timerId)
      window.removeEventListener("resize", scheduleSync)
      window.removeEventListener("orientationchange", scheduleSync)
      mql?.removeEventListener?.("change", scheduleSync)
      screen.orientation?.removeEventListener?.("change", scheduleSync)
    }
  }, [])

  // Khoá cuộn trang nền khi mở camera toàn màn hình trên mobile (kể cả khi xoay ngang)
  useEffect(() => {
    if (!viewport.isFullScreen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [viewport.isFullScreen])

  useEffect(() => {
    let stream: MediaStream | undefined
    let alive = true
    setReady(false)
    setErr("")

    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Trình duyệt này không mở được camera. Bạn dùng nút tải ảnh lên được.")
      return
    }

    const usePortraitStream = viewport.isFullScreen && !viewport.isLandscape

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: facingMode },
        aspectRatio: { ideal: usePortraitStream ? 9 / 16 : 16 / 9 },
        width: { ideal: usePortraitStream ? 1080 : 1280 },
        height: { ideal: usePortraitStream ? 1920 : 720 },
      },
      audio: false,
    }

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((s) => {
        if (!alive) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const v = video.current
        if (v) {
          v.srcObject = s
          const markReady = () => {
            if (!alive) return
            if (v.videoWidth > 0 && v.videoHeight > 0) setReady(true)
          }
          v.onloadedmetadata = markReady
          void v.play().then(markReady).catch(() => {})
          if (v.readyState >= 1) markReady()
        }
      })
      .catch((e: DOMException) => {
        if (!alive) return
        setErr(
          e.name === "NotAllowedError" || e.name === "SecurityError"
            ? "Bạn chưa cấp quyền dùng camera. Cho phép trong cài đặt trình duyệt rồi thử lại, hoặc dùng nút tải ảnh lên."
            : e.name === "NotFoundError" || e.name === "OverconstrainedError"
              ? "Không tìm thấy camera hoặc độ phân giải không được hỗ trợ."
              : "Không mở được camera. Bạn dùng nút tải ảnh lên được.",
        )
      })

    return () => {
      alive = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [facingMode, viewport.isFullScreen, viewport.isLandscape])

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
  }

  const shoot = useCallback(
    (autoScan: boolean) => {
      const v = video.current
      if (!v || !v.videoWidth || !v.videoHeight) return

      const vidW = v.videoWidth
      const vidH = v.videoHeight
      const rect = v.getBoundingClientRect()
      const dispW = rect.width || v.clientWidth
      const dispH = rect.height || v.clientHeight

      // Cắt đúng vùng đang hiển thị qua `object-cover` trên khung camera để ảnh chụp khớp hướng (dọc/ngang) và khung hình người dùng thấy
      let sx = 0
      let sy = 0
      let sw = vidW
      let sh = vidH
      if (dispW > 0 && dispH > 0) {
        const vidRatio = vidW / vidH
        const dispRatio = dispW / dispH
        if (vidRatio > dispRatio) {
          sw = vidH * dispRatio
          sx = (vidW - sw) / 2
        } else if (vidRatio < dispRatio) {
          sh = vidW / dispRatio
          sy = (vidH - sh) / 2
        }
      }

      const c = document.createElement("canvas")
      c.width = Math.max(1, Math.round(sw))
      c.height = Math.max(1, Math.round(sh))
      const ctx = c.getContext("2d")
      if (!ctx) return

      if (facingMode === "user") {
        ctx.translate(c.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height)
      c.toBlob(
        (blob) => {
          if (blob) {
            onShoot(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }), autoScan)
          }
        },
        "image/jpeg",
        0.92,
      )
    },
    [facingMode, onShoot],
  )

  // Phím Enter = chụp & quét ngay (giữ đúng hành vi của nút chính trên panel)
  useEffect(() => {
    if (!ready || err) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat) return
      e.preventDefault()
      shoot(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [ready, err, shoot])

  const isMobileFull = viewport.isFullScreen
  const isMobileLandscape = isMobileFull && viewport.isLandscape

  return (
    <div
      className={
        isMobileFull
          ? `fixed inset-0 z-[60] flex bg-black select-none ${
              isMobileLandscape ? "flex-row" : "flex-col"
            }`
          : "relative flex flex-col overflow-clip rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] select-none"
      }
    >
      {/* Mobile Top Bar (portrait) */}
      {isMobileFull && !isMobileLandscape && (
        <div className="z-20 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/40 to-transparent px-4 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
            <i className="pulse-bar size-1.5 rounded-full bg-mint-bright" />
            Camera AI trực tiếp
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFacingMode}
              aria-label="Đổi camera trước hoặc sau"
              className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/15 text-white backdrop-blur-md transition-transform active:scale-90"
            >
              <CameraRotateIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng camera"
              className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/15 text-white backdrop-blur-md transition-transform active:scale-90"
            >
              <CloseModalIcon className="size-5" />
            </button>
          </div>
        </div>
      )}

      {/* Viewfinder Frame Container */}
      <div
        className={`relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-black ${
          isMobileFull ? "" : "aspect-video flex-none"
        }`}
      >
        {err ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <p className="text-base font-semibold text-white">Không mở được camera</p>
              <p className="mt-1.5 text-sm leading-6 text-white/75">{err}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-white/20 px-4 text-sm font-semibold text-white hover:bg-white/30"
              >
                Đóng camera
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={video}
              playsInline
              muted
              autoPlay
              className={`absolute inset-0 size-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
              aria-label="Khung hình camera"
            />
            {!ready && (
              <p className="absolute inset-0 z-10 grid place-items-center bg-black/60 text-[13px] text-white/70">
                Đang bật camera...
              </p>
            )}

            {isMobileLandscape && (
              <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                <i className="pulse-bar size-1.5 rounded-full bg-mint-bright" />
                Camera AI trực tiếp
              </span>
            )}

            {!isMobileFull && (
              <>
                <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink/85 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                  <i className="pulse-bar size-1.5 rounded-full bg-mint-bright" />
                  Camera đang mở
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Đóng camera"
                  className="absolute top-3 right-3 z-10 grid size-8 place-items-center rounded-full bg-ink/70 text-white/80 transition-colors hover:bg-ink hover:text-white"
                >
                  <CloseModalIcon className="size-4" />
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Mobile Bottom / Side Control Bar */}
      {isMobileFull ? (
        <div
          className={
            isMobileLandscape
              ? "z-20 flex w-44 shrink-0 flex-col justify-between border-l border-white/10 bg-black/92 p-3 pr-[max(0.75rem,env(safe-area-inset-right))]"
              : "z-20 flex flex-col gap-3 bg-gradient-to-t from-black via-black/85 to-transparent p-4 pb-[max(2rem,env(safe-area-inset-bottom))]"
          }
        >
          {isMobileLandscape && (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={toggleFacingMode}
                aria-label="Đổi camera trước hoặc sau"
                className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/15 text-white backdrop-blur-md transition-transform active:scale-90"
              >
                <CameraRotateIcon className="size-5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng camera"
                className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/15 text-white backdrop-blur-md transition-transform active:scale-90"
              >
                <CloseModalIcon className="size-5" />
              </button>
            </div>
          )}

          <div className={isMobileLandscape ? "flex flex-col gap-2.5" : "flex items-center gap-3"}>
            <button
              type="button"
              onClick={() => shoot(false)}
              disabled={!!err || !ready}
              className={`${
                isMobileLandscape ? "h-12 w-full px-3 text-xs" : "h-13 flex-1 text-sm"
              } flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/15 font-semibold text-white backdrop-blur-md transition-all hover:bg-white/25 active:scale-95 disabled:opacity-40`}
            >
              <EyeScanIcon className="size-4 shrink-0 text-white/80" />
              Chụp xem lại
            </button>
            <button
              type="button"
              onClick={() => shoot(true)}
              disabled={!!err || !ready}
              className={`${
                isMobileLandscape ? "h-13 w-full px-3 text-xs" : "h-13 flex-[1.4] text-sm"
              } flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-emerald-600 font-bold text-white shadow-[0_8px_24px_rgba(0,135,74,0.4)] transition-all hover:from-brand-deep hover:to-emerald-700 active:scale-95 disabled:opacity-40`}
            >
              <SparkIcon />
              Chụp &amp; Quét ngay
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 bg-white px-5 py-3.5">
          <p className="text-sm text-muted">
            {err ? "Hoặc đóng rồi dùng nút tải ảnh lên" : "Nhấn Enter để chụp & quét ngay"}
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <button type="button" onClick={onClose} className="btn-ghost min-h-9 px-3.5 text-[13px] font-semibold">
              Huỷ
            </button>
            <button
              type="button"
              onClick={toggleFacingMode}
              className="btn-outline flex min-h-9 items-center gap-1.5 px-3 text-[13px] font-semibold"
              title="Đổi camera trước hoặc sau"
            >
              <CameraRotateIcon className="size-3.5 text-muted" />
              Đổi camera
            </button>
            <button
              type="button"
              onClick={() => shoot(false)}
              disabled={!!err || !ready}
              className="btn-outline min-h-9 px-3.5 text-[13px] font-semibold disabled:opacity-50"
            >
              Chụp xem lại
            </button>
            <button
              type="button"
              onClick={() => shoot(true)}
              disabled={!!err || !ready}
              className="btn-primary min-h-9 px-4 text-[13px] font-semibold shadow-sm disabled:opacity-50"
            >
              <SparkIcon />
              Chụp &amp; Quét ngay
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export const CameraRotateIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 640 640" aria-hidden="true" {...props}>
    <path fill="currentColor" d="m202.7 160l10.4-31.2c6.5-19.6 24.8-32.8 45.5-32.8h122.8c20.7 0 39 13.2 45.5 32.8l10.4 31.2H512c35.3 0 64 28.7 64 64v256c0 35.3-28.7 64-64 64H128c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64zM160 369.9c0 3.9 1.4 7.7 4 10.6l48 54c6.4 7.2 17.6 7.2 23.9 0l48-54c2.6-2.9 4-6.7 4-10.6V368c0-8.8-7.2-16-16-16h-24c0-39.8 32.2-72 72-72q6.6 0 12.9 1.2l34.9-39.3c-14.6-6.4-30.8-9.9-47.8-9.9c-66.3 0-120 53.7-120 120h-24c-8.8 0-16 7.2-16 16v1.9zm196-46.5c-2.6 2.9-4 6.7-4 10.6v1.9c0 8.8 7.2 16 16 16h24c0 39.8-32.2 72-72 72q-6.6 0-12.9-1.2L272.2 462c14.7 6.4 30.8 9.9 47.8 9.9c66.3 0 120-53.7 120-120h24c8.8 0 16-7.2 16-16V334c0-3.9-1.4-7.7-4-10.6l-48-54c-6.4-7.2-17.6-7.2-23.9 0l-48 54z"/>
  </svg>
);

function CloseModalIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function EyeScanIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
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
