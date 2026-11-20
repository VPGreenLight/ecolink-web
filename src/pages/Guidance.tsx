import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { PageHead, Field } from "@/components/Portal"
import { WASTE_GROUPS, WASTES } from "@/data/waste"
import {
  AI_CLASS_OPTIONS,
  fetchSortingRules,
  getCategoryMeta,
  parsePreparationSteps,
  submitAiFeedback,
  type WasteSortingGuideDto,
} from "@/lib/wasteScanApi"
import { isDiscoverableCategory } from "@/lib/recyclerDiscoveryApi"

/** U-02 Tra cứu hướng dẫn phân loại rác & U-04 Báo cáo AI nhận diện sai.
 *
 *  Kết nối trực tiếp với Rule Engine tại `GET /api/v1/waste-scan/rules` để đồng bộ
 *  màu thùng rác chuẩn, các bước sơ chế và cảnh báo an toàn; đồng thời giữ dữ liệu
 *  nền `WASTES` để render tức thì (SSR-safe) ngay cả khi chưa bật Backend. */
export default function Guidance() {
  const [group, setGroup] = useState<string>(WASTE_GROUPS[1])
  const [liveRules, setLiveRules] = useState<WasteSortingGuideDto[]>([])
  const [syncedFromApi, setSyncedFromApi] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchSortingRules(controller.signal)
      .then((rules) => {
        if (rules.length > 0) {
          setLiveRules(rules)
          setSyncedFromApi(true)
        }
      })
      .catch(() => {
        // Giữ danh mục mặc định nếu Backend chưa bật
      })
    return () => controller.abort()
  }, [])

  const matchedLiveRules = liveRules.filter(
    (r) => getCategoryMeta(r.categoryCode).group === group,
  )
  const fallbackList = WASTES.filter((w) => w.group === group)

  return (
    <div className="page flex flex-col gap-6">
      <PageHead
        eyebrow="HƯỚNG DẪN"
        title="Phân loại rác đúng cách"
        body="Chọn nhóm vật liệu để xem quy định màu thùng rác, cách sơ chế sạch và hướng xử lý từ Rule Engine. Rác chuẩn bị đúng bán được giá cao hơn và không bị từ chối khi bàn giao."
        action={
          syncedFromApi ? (
            <span className="chip bg-surface-2 text-body">
              <i className="size-1.5 rounded-full bg-brand" />
              Đã đồng bộ Rule Engine
            </span>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        {WASTE_GROUPS.filter((g) => g !== WASTE_GROUPS[0]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            aria-pressed={group === g}
            className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${
              group === g
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-body hover:bg-surface-2"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {matchedLiveRules.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {matchedLiveRules.map((rule, i) => {
            const steps = parsePreparationSteps(rule.preparationSteps)
            const canTrade = isDiscoverableCategory(rule.categoryCode)
            return (
              <li key={rule.categoryCode} className="card flex flex-col gap-3 p-5 sm:flex-row sm:gap-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/12 text-sm font-bold text-brand-deep">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base leading-6 font-bold text-ink">
                      {rule.categoryName}
                    </h2>
                    <span className="rounded-full border border-brand/25 bg-brand/8 px-3 py-1 text-xs font-semibold text-brand-deep">
                      Thùng rác màu: {rule.standardBinColor}
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm leading-6 text-body">
                    {rule.handlingAction}
                  </p>

                  {steps.length > 0 && (
                    <div className="mt-2.5 rounded-lg border border-line-soft bg-surface-2 px-3.5 py-2.5 text-[13px] leading-5 text-ink">
                      <b>Các bước sơ chế chuẩn:</b>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-body">
                        {steps.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {rule.hazardWarning && (
                    <p className="mt-2 text-xs leading-5 text-warn">
                      <b>Lưu ý an toàn:</b> {rule.hazardWarning}
                    </p>
                  )}

                  {canTrade && (
                    <div className="mt-3">
                      <Link
                        to={`/map?category=${encodeURIComponent(rule.categoryCode)}`}
                        className="text-xs font-semibold text-brand-deep underline underline-offset-4 hover:text-brand"
                      >
                        Tìm cơ sở thu mua {rule.categoryName} gần bạn →
                      </Link>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <ol className="flex flex-col gap-3">
          {fallbackList.map((w, i) => (
            <li key={w.id} className="card flex gap-4 p-5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/12 text-sm font-bold text-brand-deep">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h2 className="text-base leading-6 font-bold text-ink">{w.name}</h2>
                <p className="mt-1 text-sm leading-6 text-body">{w.rule}</p>
                <p className="mt-2 text-[13px] leading-5 text-muted">
                  <b className="text-ink">Chuẩn bị:</b> {w.prep}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-base font-bold text-ink">Không chắc mình bỏ đúng nhóm?</h2>
          <p className="mt-1 text-sm text-muted">
            Chụp một ảnh, AI nhận diện vật liệu và trả lời luôn màu thùng rác kèm điểm thu mua.
          </p>
        </div>
        <Link to="/scanner" className="btn-primary h-11 shrink-0 px-5">
          Nhận diện bằng AI
        </Link>
      </section>

      <U04Report />
    </div>
  )
}

/** U-04 Báo cáo AI nhận diện sai — gửi thực tế lên POST /api/v1/waste-scan/feedback. */
function U04Report() {
  const [predicted, setPredicted] = useState("plastic")
  const [correct, setCorrect] = useState("")
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [sentMessage, setSentMessage] = useState("")
  const [errMessage, setErrMessage] = useState("")

  const handleReport = async () => {
    if (!correct || sending) return
    setSending(true)
    setErrMessage("")
    setSentMessage("")
    try {
      const res = await submitAiFeedback({
        predictedLabel: predicted,
        confidenceScore: 0.55,
        userReportedLabel: correct,
        note: note.trim() || undefined,
      })
      setSentMessage(res.message)
      setNote("")
    } catch (err) {
      setErrMessage(
        err instanceof Error
          ? err.message
          : "Không kết nối được máy chủ để gửi báo cáo. Vui lòng thử lại sau.",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="card flex flex-col gap-4 p-5 md:p-6">
      <div>
        <h2 className="text-base font-bold text-ink">AI chỉ sai loại rác</h2>
        <p className="mt-1 text-sm text-muted">
          Chọn nhãn AI đã báo nhầm và loại rác thực tế. Nhân viên vận hành kiểm chứng
          và đưa vào tập dữ liệu huấn luyện lại (Retrain Loop).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nhãn AI đã dự đoán nhầm">
          <select
            className="input"
            value={predicted}
            onChange={(e) => {
              setPredicted(e.target.value)
              setSentMessage("")
            }}
          >
            {AI_CLASS_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Loại rác đúng thực tế">
          <select
            className="input"
            value={correct}
            onChange={(e) => {
              setCorrect(e.target.value)
              setSentMessage("")
            }}
          >
            <option value="">Chọn loại rác đúng</option>
            {AI_CLASS_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ghi chú (không bắt buộc)">
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: ảnh chụp ngược sáng, nền tối"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={!correct || sending}
          onClick={handleReport}
          className="btn-primary h-11 px-6"
        >
          {sending ? "Đang gửi..." : "Gửi báo cáo"}
        </button>
        {sentMessage && (
          <p role="status" className="text-[13px] font-semibold text-brand">
            {sentMessage}
          </p>
        )}
        {errMessage && (
          <p role="alert" className="text-[13px] font-medium text-warn">
            {errMessage}
          </p>
        )}
      </div>
    </section>
  )
}
