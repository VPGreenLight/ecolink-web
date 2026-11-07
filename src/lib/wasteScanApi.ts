import { apiRequest, type ApiResponse } from "@/lib/api"

export type AiModelId = "yolov8_detect" | "mobilenet_v3" | "efficientnet_b0" | "yolov8n"

export interface AiModelOption {
  id: string
  name: string
  family?: string
  is_ready?: boolean
}

export interface AiModelsPayload {
  default_model: string
  supported_classes?: string[]
  classes_count?: number
  models: AiModelOption[]
}

export interface WastePredictionDto {
  label: string
  confidence: number
  displayName: string
}

export interface WasteSortingGuideDto {
  categoryCode: string
  categoryName: string
  standardBinColor: string
  preparationSteps: string | string[]
  handlingAction: string
  hazardWarning?: string | null
}

export interface DetectedWasteObjectDto {
  id: number
  rawClass: string
  label: string
  displayName: string
  confidence: number
  centerScore: number
  isPrimary: boolean
  source?: string | null
  bbox: number[]
  sortingGuide?: WasteSortingGuideDto | null
}

export interface AiScanResultDto {
  success: boolean
  isOutOfDistribution: boolean
  confidenceThreshold: number
  modelUsed?: string | null
  modelName?: string | null
  modelFamily?: string | null
  imageWidth?: number
  imageHeight?: number
  topPrediction?: WastePredictionDto | null
  predictions: WastePredictionDto[]
  allProbabilities?: WastePredictionDto[]
  detectedCount?: number
  categorySummary?: Record<string, number>
  detectedObjects?: DetectedWasteObjectDto[]
  pipeline?: string | null
  croppedBbox?: number[] | null
  inferenceTimeMs: number
  errorMessage?: string | null
}

export interface WasteScanResponseDto {
  aiResult: AiScanResultDto
  sortingGuide?: WasteSortingGuideDto | null
  message: string
}

export interface SubmitFeedbackRequest {
  imageUrl?: string
  predictedLabel: string
  confidenceScore: number
  userReportedLabel: string
  note?: string
}

export const DEFAULT_AI_MODELS: AiModelOption[] = [
  {
    id: "yolov8_detect",
    name: "YOLOv8 Detection (Khuyên dùng - Đa vật thể & Cắt nền)",
    family: "Two-Stage Object Detection & Ensemble",
    is_ready: true,
  },
  {
    id: "efficientnet_b0",
    name: "EfficientNet-B0 (Độ chính xác cao 92.3%)",
    family: "CNN (Torchvision)",
    is_ready: true,
  },
  {
    id: "mobilenet_v3",
    name: "MobileNetV3-Small (Siêu nhẹ, tối ưu di động)",
    family: "CNN (Torchvision)",
    is_ready: true,
  },
  {
    id: "yolov8n",
    name: "YOLOv8 Nano Classifier (Tốc độ nhanh)",
    family: "CNN (Ultralytics)",
    is_ready: true,
  },
]

export interface WasteCategoryMeta {
  code: string
  shortName: string
  group: "Nhựa" | "Giấy" | "Kim loại" | "Thủy tinh" | "Hữu cơ"
  badge: string
  priceRange: string
  priceUnit: string
  recyclable: boolean
  handoverWasteId: string
  defaultBinColor: string
  defaultSteps: string[]
}

export const WASTE_CATEGORY_META: Record<string, WasteCategoryMeta> = {
  plastic: {
    code: "plastic",
    shortName: "Nhựa tái chế (PET / HDPE)",
    group: "Nhựa",
    badge: "Vật liệu có giá trị thu mua",
    priceRange: "5.000 – 7.500",
    priceUnit: "đ / kg",
    recyclable: true,
    handoverWasteId: "pet",
    defaultBinColor: "Vàng / Cam",
    defaultSteps: [
      "Đổ sạch chất lỏng còn thừa và tráng sơ bằng nước sạch.",
      "Tháo nắp, bóp dẹp chai nhựa để tiết kiệm thể tích lưu trữ.",
    ],
  },
  paper: {
    code: "paper",
    shortName: "Giấy báo & Văn phòng",
    group: "Giấy",
    badge: "Vật liệu có giá trị thu mua",
    priceRange: "3.800 – 5.000",
    priceUnit: "đ / kg",
    recyclable: true,
    handoverWasteId: "office-paper",
    defaultBinColor: "Xanh dương",
    defaultSteps: [
      "Giữ giấy khô ráo, không dính dầu mỡ hoặc thức ăn.",
      "Tháo ghim bấm kim loại, băng keo nhựa và xếp phẳng theo xấp.",
    ],
  },
  cardboard: {
    code: "cardboard",
    shortName: "Bìa Carton (OCC)",
    group: "Giấy",
    badge: "Vật liệu dễ thu gom tận nơi",
    priceRange: "3.200 – 4.500",
    priceUnit: "đ / kg",
    recyclable: true,
    handoverWasteId: "carton",
    defaultBinColor: "Xanh dương",
    defaultSteps: [
      "Bóc bỏ băng keo dán, mút xốp hoặc túi khí bên trong thùng.",
      "Gấp phẳng thùng carton và buộc gọn để tránh ẩm ướt.",
    ],
  },
  metal: {
    code: "metal",
    shortName: "Kim loại & Vỏ lon nhôm",
    group: "Kim loại",
    badge: "Phế liệu giá trị cao",
    priceRange: "14.000 – 28.000",
    priceUnit: "đ / kg",
    recyclable: true,
    handoverWasteId: "aluminum",
    defaultBinColor: "Vàng",
    defaultSteps: [
      "Đổ hết nước ngọt/bia thừa và tráng sơ để tránh thu hút côn trùng.",
      "Ép dẹp lon nhôm hoặc bọc kín cạnh sắc nhọn trước khi bàn giao.",
    ],
  },
  glass: {
    code: "glass",
    shortName: "Chai lọ Thủy tinh",
    group: "Thủy tinh",
    badge: "Vật liệu tái chế tuần hoàn",
    priceRange: "1.500 – 2.500",
    priceUnit: "đ / kg",
    recyclable: true,
    handoverWasteId: "glass",
    defaultBinColor: "Trắng / Xanh lá",
    defaultSteps: [
      "Tráng sạch cặn bên trong và tháo rời nắp kim loại hoặc nút nhựa.",
      "Đặt riêng vào thùng cứng, bọc kỹ nếu có vết nứt vỡ.",
    ],
  },
  trash: {
    code: "trash",
    shortName: "Rác sinh hoạt thông thường",
    group: "Hữu cơ",
    badge: "Không thuộc danh mục thu mua",
    priceRange: "Không thu mua",
    priceUnit: "Bỏ thùng rác đô thị",
    recyclable: false,
    handoverWasteId: "organic",
    defaultBinColor: "Xám / Xanh đậm",
    defaultSteps: [
      "Tách riêng khỏi nhóm nhựa, giấy, kim loại để không làm bẩn phế liệu sạch.",
      "Buộc kín túi rác và bỏ đúng giờ thu gom rác sinh hoạt tại địa phương.",
    ],
  },
}

export const AI_CLASS_OPTIONS = [
  { code: "plastic", label: "Nhựa tái chế (Plastic)" },
  { code: "paper", label: "Giấy báo & Tài liệu (Paper)" },
  { code: "cardboard", label: "Bìa Carton (Cardboard)" },
  { code: "metal", label: "Kim loại & Vỏ lon (Metal)" },
  { code: "glass", label: "Thủy tinh (Glass)" },
  { code: "trash", label: "Rác sinh hoạt khác (Trash)" },
] as const

export function getCategoryMeta(code?: string | null): WasteCategoryMeta {
  const normalized = (code ?? "").trim().toLowerCase()
  return (
    WASTE_CATEGORY_META[normalized] ?? {
      code: normalized || "unknown",
      shortName: code || "Chưa xác định",
      group: "Nhựa",
      badge: "Cần kiểm tra phân loại",
      priceRange: "Theo thỏa thuận",
      priceUnit: "đ / kg",
      recyclable: false,
      handoverWasteId: "pet",
      defaultBinColor: "Theo quy định",
      defaultSteps: [
        "Kiểm tra lại bề mặt vật liệu và tách riêng các thành phần khác loại.",
      ],
    }
  )
}

/** Tách chuỗi các bước sơ chế ("1. ...\n2. ...") hoặc mảng thành danh sách câu sạch. */
export function parsePreparationSteps(raw?: string | string[] | null): string[] {
  if (!raw) return []
  const items = Array.isArray(raw)
    ? raw
    : raw
        .split(/\r?\n|(?=\d+\.\s)/g)
        .map((s) => s.trim())
        .filter(Boolean)

  return items
    .map((line) => line.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean)
}

/** Gửi file ảnh rác tới POST /api/v1/waste-scan/classify (UC-CLS-01). */
export async function classifyWasteImage(
  file: File,
  model: string = "yolov8_detect",
  signal?: AbortSignal,
): Promise<ApiResponse<WasteScanResponseDto>> {
  const form = new FormData()
  form.append("file", file, file.name || "scan.jpg")
  form.append("model", model)

  return apiRequest<WasteScanResponseDto>("/api/v1/waste-scan/classify", {
    method: "POST",
    body: form,
    signal,
  })
}

/** Tải ảnh mẫu tĩnh trên trình duyệt thành đối tượng File thật để gửi qua AI pipeline. */
export async function loadSampleImageAsFile(
  assetUrl: string,
  fileName: string = "sample-pet-bottle.png",
): Promise<File> {
  const res = await fetch(assetUrl)
  if (!res.ok) {
    throw new Error("Không tải được ảnh mẫu để phân tích.")
  }
  const blob = await res.blob()
  const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png"
  const safeName = fileName.replace(/\.\w+$/, `.${ext}`)
  return new File([blob], safeName, { type: blob.type || "image/png" })
}

/** Lấy danh sách các mô hình AI sẵn sàng từ GET /api/v1/waste-scan/models. */
export async function fetchAiModels(signal?: AbortSignal): Promise<AiModelsPayload> {
  const res = await apiRequest<AiModelsPayload>("/api/v1/waste-scan/models", {
    method: "GET",
    signal,
  })
  if (res.data && Array.isArray(res.data.models) && res.data.models.length > 0) {
    return res.data
  }
  return {
    default_model: "yolov8_detect",
    models: DEFAULT_AI_MODELS,
  }
}

/** Lấy toàn bộ quy tắc phân loại rác tĩnh từ Rule Engine (GET /api/v1/waste-scan/rules). */
export async function fetchSortingRules(
  signal?: AbortSignal,
): Promise<WasteSortingGuideDto[]> {
  const res = await apiRequest<WasteSortingGuideDto[]>("/api/v1/waste-scan/rules", {
    method: "GET",
    signal,
  })
  return Array.isArray(res.data) ? res.data : []
}

/** Gửi báo cáo AI nhận diện sai (POST /api/v1/waste-scan/feedback - BR-CLS-05). */
export async function submitAiFeedback(
  payload: SubmitFeedbackRequest,
): Promise<{ success: boolean; message: string }> {
  const res = await apiRequest<unknown>("/api/v1/waste-scan/feedback", {
    method: "POST",
    body: JSON.stringify({
      imageUrl: payload.imageUrl ?? "",
      predictedLabel: payload.predictedLabel,
      confidenceScore: payload.confidenceScore,
      userReportedLabel: payload.userReportedLabel,
      note: payload.note ?? "",
    }),
  })
  return {
    success: res.success,
    message:
      res.message ||
      "Cảm ơn bạn đã phản hồi! Dữ liệu đã được chuyển tới Nhân viên vận hành để kiểm chứng.",
  }
}
