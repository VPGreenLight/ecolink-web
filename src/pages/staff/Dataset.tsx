import { useEffect, useState } from "react"
import { PageHead, RequiredMark, Stat, Status, Table, Td } from "@/components/Portal"
import { DATASET, fmtInt } from "@/data/ops"
import { ApiError } from "@/lib/api"
import { initApiState } from "@/lib/hydration"
import { getAccessToken, hasLiveBackendAuth } from "@/lib/session"
import {
  createAiDatasetVersion,
  downloadDatasetVersionZip,
  fetchAiDatasetDashboard,
  type AiDatasetDashboardDto,
} from "@/lib/aiCurationApi"

function buildFallbackDashboard(): AiDatasetDashboardDto {
  return {
    summary: {
      totalPoolItems: DATASET.total,
      verifiedLabeledCount: DATASET.labeled,
      unlabeledCount: DATASET.total - DATASET.labeled,
      excludedCount: 0,
      stickyTrainCount: Math.round(DATASET.labeled * 0.7),
      stickyValidationCount: Math.round(DATASET.labeled * 0.2),
      stickyTestCount: Math.round(DATASET.labeled * 0.1),
      imbalanceRatio: 7.4,
      isBalanced: false,
      weakestCategory: "glass",
      empiricalAccuracyPercent: DATASET.accuracy,
    },
    byCategory: DATASET.byClass.map((c) => ({
      categoryCode: c.label.toLowerCase(),
      categoryName: c.label,
      totalVerified: c.count,
      trainCount: Math.round(c.count * 0.7),
      valCount: Math.round(c.count * 0.2),
      testCount: Math.round(c.count * 0.1),
      unassignedCount: 0,
      verifiedFeedbackCount: 0,
      falseReportCount: 0,
      accuracyPercent: c.accuracy,
      needsMoreSamples: c.accuracy < 90,
    })),
    versions: [],
  }
}

function buildEmptyDashboard(): AiDatasetDashboardDto {
  return {
    summary: {
      totalPoolItems: 0,
      verifiedLabeledCount: 0,
      unlabeledCount: 0,
      excludedCount: 0,
      stickyTrainCount: 0,
      stickyValidationCount: 0,
      stickyTestCount: 0,
      imbalanceRatio: 0,
      isBalanced: true,
      weakestCategory: null,
      empiricalAccuracyPercent: 0,
    },
    byCategory: [],
    versions: [],
  }
}

/** S-03 Cập nhật tập dữ liệu kiểm chứng & đóng gói Sticky Stratified Split 70/20/10. */
export default function Dataset() {
  const [dashboard, setDashboard] = useState<AiDatasetDashboardDto>(() =>
    initApiState(buildEmptyDashboard(), buildFallbackDashboard()),
  )
  const [liveConnected, setLiveConnected] = useState(false)

  const [versionCode, setVersionCode] = useState("v1.0.0")
  const [versionName, setVersionName] = useState("Tập dữ liệu kiểm chứng EcoLink")
  const [description, setDescription] = useState("")
  const [syncToAiService, setSyncToAiService] = useState(true)
  const [creating, setCreating] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [flash, setFlash] = useState("")
  const [errMsg, setErrMsg] = useState("")

  const loadDashboard = async () => {
    const token = getAccessToken()
    if (!token && !hasLiveBackendAuth()) return
    try {
      const res = await fetchAiDatasetDashboard()
      if (res.success && res.data) {
        setLiveConnected(true)
        setDashboard(res.data)
        const nextMinor = (res.data.versions?.length ?? 0) + 1
        setVersionCode(`v1.${nextMinor}.0`)
      }
    } catch (err) {
      if (hasLiveBackendAuth()) {
        setErrMsg(
          err instanceof ApiError
            ? err.message
            : "Không tải được dữ liệu Dashboard AI Dataset.",
        )
      }
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrMsg("")
    setFlash("")
    const cleanCode = versionCode.trim()
    const cleanName = versionName.trim()
    const cleanDesc = description.trim()
    if (!/^v?\d+\.\d+\.\d+$/i.test(cleanCode)) {
      setErrMsg("Mã phiên bản phải theo chuẩn SemVer (ví dụ: v1.0.0).")
      return
    }
    if (cleanName.length < 2 || cleanName.length > 100) {
      setErrMsg("Tên phiên bản phải từ 2 đến 100 ký tự.")
      return
    }
    if (cleanDesc.length > 500) {
      setErrMsg("Ghi chú phát hành không được vượt quá 500 ký tự.")
      return
    }
    setCreating(true)
    try {
      const res = await createAiDatasetVersion({
        versionCode: cleanCode,
        versionName: cleanName,
        description: cleanDesc || undefined,
        trainRatio: 70,
        valRatio: 20,
        testRatio: 10,
        syncToAiService,
      })
      const warn = res.data?.aiSyncWarning ? ` (Lưu ý: ${res.data.aiSyncWarning})` : ""
      setFlash((res.message || "Đã đóng gói phiên bản Dataset mới.") + warn)
      await loadDashboard()
    } catch (err) {
      setErrMsg(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Không thể đóng gói phiên bản Dataset.")
    } finally {
      setCreating(false)
    }
  }

  const handleDownloadZip = async (versionId: string, format: "yolo" | "imagefolder") => {
    setExportingId(`${versionId}-${format}`)
    setFlash("")
    setErrMsg("")
    try {
      const { blob, fileName, sampleCount } = await downloadDatasetVersionZip(versionId, format)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setFlash(`Đã tải xuống ${fileName} (${sampleCount} ảnh chuẩn hóa).`)
    } catch (err) {
      setErrMsg(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Xuất tệp .zip thất bại.")
    } finally {
      setExportingId(null)
    }
  }

  const { summary, byCategory, versions } = dashboard

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="DỮ LIỆU AI"
        title="Tập dữ liệu kiểm chứng"
        body="Tập ảnh có nhãn dùng để đo độ chính xác mô hình và đóng gói tập huấn luyện Sticky Stratified Split 70/20/10 chống rò rỉ dữ liệu."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Tổng ảnh trong kho"
          value={fmtInt(summary.totalPoolItems)}
          note={liveConnected ? "Dữ liệu đồng bộ hệ thống" : "Số liệu mẫu nội bộ"}
        />
        <Stat
          label="Đã gán nhãn (Verified)"
          value={fmtInt(summary.verifiedLabeledCount)}
          note={`${fmtInt(summary.unlabeledCount)} ảnh chờ gán nhãn`}
        />
        <Stat
          label="Phân tập Sticky (70/20/10)"
          value={`${summary.stickyTrainCount}/${summary.stickyValidationCount}/${summary.stickyTestCount}`}
          note="Train / Validation / Test"
        />
        <Stat
          label="Độ chính xác thực nghiệm"
          value={`${summary.empiricalAccuracyPercent}%`}
          note={`Tỷ lệ lệch lớp: ${summary.imbalanceRatio}x`}
        />
      </div>

      {!summary.isBalanced && summary.weakestCategory && (
        <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-xs leading-5 text-ink">
          <b className="text-warn">Cảnh báo mất cân bằng lớp ({summary.imbalanceRatio}x &gt; 2.5x):</b>{" "}
          Nhóm <span className="font-semibold">{summary.weakestCategory}</span> đang có ít mẫu nhất. Nên bổ sung ảnh cho nhóm này trước khi huấn luyện lại mô hình.
        </div>
      )}

      <ul className="flex flex-col gap-3 md:hidden">
        {[...byCategory]
          .sort((a, b) => a.accuracyPercent - b.accuracyPercent || a.totalVerified - b.totalVerified)
          .map((c) => (
            <li key={c.categoryCode} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-ink">{c.categoryName}</span>
                <span className="text-sm font-bold tabular-nums text-ink">{c.accuracyPercent}%</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted tabular-nums">
                <span>Đã chuẩn hóa: {fmtInt(c.totalVerified)}</span>
                <span>
                  {c.trainCount}/{c.valCount}/{c.testCount}
                  {c.unassignedCount > 0 ? ` (+${c.unassignedCount})` : ""}
                </span>
              </div>
              <div className="text-xs font-semibold">
                {c.needsMoreSamples || c.accuracyPercent < 90 ? (
                  <span className="text-brand">Cần ưu tiên thu thập</span>
                ) : (
                  <span className="text-muted">Đạt</span>
                )}
              </div>
            </li>
          ))}
      </ul>

      <div className="hidden md:block">
      <Table head={["Lớp vật liệu", "Đã chuẩn hóa", "Train / Val / Test", "Độ chính xác", "Trạng thái"]}>
        {[...byCategory]
          .sort((a, b) => a.accuracyPercent - b.accuracyPercent || a.totalVerified - b.totalVerified)
          .map((c) => (
            <tr key={c.categoryCode}>
              <Td className="font-semibold text-ink">{c.categoryName}</Td>
              <Td className="tabular-nums">{fmtInt(c.totalVerified)}</Td>
              <Td className="tabular-nums text-xs text-muted">
                {c.trainCount} / {c.valCount} / {c.testCount}
                {c.unassignedCount > 0 ? ` (+${c.unassignedCount} mới)` : ""}
              </Td>
              <Td className="tabular-nums">{c.accuracyPercent}%</Td>
              <Td>
                {c.needsMoreSamples || c.accuracyPercent < 90 ? (
                  <span className="font-semibold text-brand">Cần ưu tiên thu thập</span>
                ) : (
                  <span className="text-muted">Đạt</span>
                )}
              </Td>
            </tr>
          ))}
      </Table>
      </div>

      <form noValidate onSubmit={handleCreateVersion} className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-ink">
              Đóng gói phiên bản Dataset mới (Sticky Stratified Split 70/20/10)
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Giữ cố định tập Test/Validation cũ theo SHA-256 (BR-CLS-07) để đảm bảo đo kiểm chính xác qua các phiên bản.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-ink">
            <input
              type="checkbox"
              checked={syncToAiService}
              onChange={(e) => setSyncToAiService(e.target.checked)}
              className="size-4 accent-brand"
            />
            Đồng bộ ngay sang AI Service
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
            <span>
              Mã phiên bản (SemVer)
              <RequiredMark />
            </span>
            <input
              className="input font-mono"
              value={versionCode}
              onChange={(e) => setVersionCode(e.target.value)}
              placeholder="v1.1.0"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
            <span>
              Tên phiên bản
              <RequiredMark />
            </span>
            <input
              className="input"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="Dataset tháng 11/2026"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
            Ghi chú phát hành
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bổ sung ảnh OOD thực địa..."
            />
          </label>
        </div>

        {errMsg && (
          <p
            role="alert"
            className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-xs font-medium text-warn"
          >
            {errMsg}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={creating}
            className="btn-primary h-10 px-5 text-[13px] disabled:opacity-50"
          >
            {creating ? "Đang đóng gói..." : "Đóng gói phiên bản Dataset"}
          </button>
          {flash && (
            <p role="status" className="text-xs font-semibold text-brand">
              {flash}
            </p>
          )}
        </div>
      </form>

      {versions.length > 0 && (
        <>
        <ul className="flex flex-col gap-3 md:hidden">
          {versions.map((v) => (
            <li key={v.id} className="card flex flex-col gap-2.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-mono text-xs font-bold text-ink">{v.versionCode}</span>
                  <p className="text-sm font-semibold text-ink">{v.versionName}</p>
                </div>
                <Status tone={v.status === "SyncedToAi" ? "ok" : "wait"}>
                  {v.status === "SyncedToAi" ? "Đã sync AI" : v.status}
                </Status>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted tabular-nums">
                <span>Tổng: {fmtInt(v.totalSamples)}</span>
                <span>Split: {v.trainCount}/{v.valCount}/{v.testCount}</span>
                <span>Lệch: {v.imbalanceRatio}x {v.isBalanced ? "(Cân bằng)" : "(Lệch)"}</span>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-line-soft pt-2.5">
                <button
                  type="button"
                  disabled={exportingId === `${v.id}-yolo`}
                  onClick={() => void handleDownloadZip(v.id, "yolo")}
                  className="btn-outline min-h-9 px-3 text-xs"
                >
                  YOLO (.zip)
                </button>
                <button
                  type="button"
                  disabled={exportingId === `${v.id}-imagefolder`}
                  onClick={() => void handleDownloadZip(v.id, "imagefolder")}
                  className="btn-outline min-h-9 px-3 text-xs"
                >
                  ImageFolder
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden md:block">
        <Table head={["Phiên bản", "Tổng mẫu", "Train/Val/Test", "Lệch lớp", "Trạng thái", "Xuất gói (.zip)"]}>
          {versions.map((v) => (
            <tr key={v.id}>
              <Td>
                <span className="font-mono text-xs font-bold text-ink">{v.versionCode}</span>
                <p className="text-xs text-muted">{v.versionName}</p>
              </Td>
              <Td className="tabular-nums">{fmtInt(v.totalSamples)}</Td>
              <Td className="tabular-nums text-xs">
                {v.trainCount} / {v.valCount} / {v.testCount}
              </Td>
              <Td className="tabular-nums text-xs">
                {v.imbalanceRatio}x {v.isBalanced ? "(Cân bằng)" : "(Lệch)"}
              </Td>
              <Td>
                <Status tone={v.status === "SyncedToAi" ? "ok" : "wait"}>
                  {v.status === "SyncedToAi" ? "Đã sync AI" : v.status}
                </Status>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={exportingId === `${v.id}-yolo`}
                    onClick={() => void handleDownloadZip(v.id, "yolo")}
                    className="btn-outline h-8 px-2.5 text-xs"
                  >
                    YOLO (.zip)
                  </button>
                  <button
                    type="button"
                    disabled={exportingId === `${v.id}-imagefolder`}
                    onClick={() => void handleDownloadZip(v.id, "imagefolder")}
                    className="btn-outline h-8 px-2.5 text-xs"
                  >
                    ImageFolder
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
        </div>
        </>
      )}
    </div>
  )
}
