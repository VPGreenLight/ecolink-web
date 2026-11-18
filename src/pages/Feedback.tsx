import { useEffect, useRef, useState } from "react"
import { ApiError } from "@/lib/api"
import {
  fetchSyncedHandoverOrders,
  type SyncedHandoverOrder,
} from "@/lib/recyclerWorkflowApi"
import {
  COMPLAINT_CATEGORY_LABELS,
  fetchMyComplaints,
  submitComplaint,
  uploadComplaintEvidence,
  type ComplaintCategoryCode,
  type ComplaintSummaryDto,
} from "@/lib/reviewComplaintApi"
import {
  CATEGORIES,
  DESC_MAX,
  DESC_MIN,
  FAQ,
  ISSUES,
  MAX_PHOTO_MB,
  MAX_PHOTOS,
  makeRef,
  SLA,
  STEPS,
  validate,
  type Category,
  type Errors,
} from "@/data/feedback"
import { SUPPORT } from "@/data/nav"
import { getAccessToken, useSession, useUser } from "@/lib/session"

export default function Feedback() {
  const user = useUser()
  const session = useSession()
  const [cat, setCat] = useState<Category>("complaint")
  const [issue, setIssue] = useState("")
  const [desc, setDesc] = useState("")
  const [contact, setContact] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const [errs, setErrs] = useState<Errors>({})
  const [ref, setRef] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  // Liên kết đơn bàn giao thật (U-11) & danh sách "Khiếu nại của tôi" (STT 110-111)
  const [handoverOrders, setHandoverOrders] = useState<SyncedHandoverOrder[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState("")
  const [backendCategory, setBackendCategory] =
    useState<ComplaintCategoryCode>("ScaleDiscrepancy")
  const [myComplaints, setMyComplaints] = useState<ComplaintSummaryDto[]>([])

  useEffect(() => {
    if (!getAccessToken()) return
    const scope = session?.role === "recycler" ? "recycler" : "user"
    void fetchSyncedHandoverOrders(scope).then((orders) => {
      setHandoverOrders(orders.filter((o) => /^[0-9a-f-]{36}$/i.test(o.id)))
    })
    void fetchMyComplaints({ role: "all", pageSize: 20 })
      .then((res) => {
        if (res.success && res.data) setMyComplaints(res.data.items)
      })
      .catch(() => {})
  }, [session?.role])

  const list = ISSUES[cat]
  const pickCat = (c: Category) => {
    if (c === cat) return
    setCat(c)
    setIssue("") // id của 2 nhóm không trùng nhau, giữ lại sẽ gửi sai loại
    setErrs((e) => ({ ...e, issue: undefined }))
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError("")

    if (cat === "complaint" && selectedOrderId) {
      const cleanDesc = desc.trim()
      if (cleanDesc.length < 15) {
        setErrs({ desc: "Nội dung mô tả khiếu nại giao dịch tối thiểu 15 ký tự." })
        return
      }
      setSubmitting(true)
      try {
        const evidenceUrls: string[] = []
        for (const f of photos.slice(0, 5)) {
          const up = await uploadComplaintEvidence(f)
          if (up.data?.fileUrl) evidenceUrls.push(up.data.fileUrl)
        }
        const created = await submitComplaint({
          handoverRequestId: selectedOrderId,
          category: backendCategory,
          description: cleanDesc,
          evidencePhotoUrls: evidenceUrls,
        })
        setRef(created.data.complaintCode)
      } catch (err) {
        setSubmitError(
          err instanceof ApiError
            ? err.message
            : "Không thể gửi phiếu khiếu nại giao dịch.",
        )
      } finally {
        setSubmitting(false)
      }
      return
    }

    const found = validate({ category: cat, issue, desc, contact, photos })
    setErrs(found)
    if (Object.values(found).some(Boolean)) return
    setRef(makeRef())
  }

  if (ref) return <Done refCode={ref} cat={cat} />

  return (
    <div className="page flex flex-col pb-16">
      <header className="pt-10 md:pt-14">
        <h1 className="display text-[28px] leading-9 md:text-[34px] md:leading-11">
          Khiếu nại và góp ý
        </h1>
        <p className="mt-2 max-w-[62ch] text-base leading-7 text-body">
          Thu gom bị trễ, điểm cộng sai, app lỗi, hay bạn nghĩ EcoLink nên làm khác
          đi. Gửi ở đây, chúng tôi xử lý và báo lại kết quả.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:gap-10">
        <form onSubmit={send} noValidate className="min-w-0">
          {/* 1. Nhóm: khiếu nại hay góp ý. Radio gốc nên bàn phím chuyển được
              bằng mũi tên, không phải tự viết xử lý phím. */}
          <fieldset>
            <legend className="text-sm font-bold text-ink">Loại nội dung</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {CATEGORIES.map((c) => {
                const on = c.id === cat
                return (
                  <label
                    key={c.id}
                    className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                      on
                        ? "border-brand bg-brand/8"
                        : "border-line bg-surface hover:bg-surface-2"
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={c.id}
                      checked={on}
                      onChange={() => pickCat(c.id)}
                      className="sr-only"
                    />
                    <span className="flex items-center gap-2">
                      <span
                        className={`grid size-4 shrink-0 place-items-center rounded-full border-2 ${
                          on ? "border-brand" : "border-sage-line"
                        }`}
                      >
                        {on && <span className="size-1.5 rounded-full bg-brand" />}
                      </span>
                      <span className="text-sm font-bold text-ink">{c.label}</span>
                    </span>
                    <span className="mt-1.5 block text-[13px] leading-5 text-muted">
                      {c.blurb}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* 1b. Chọn đơn bàn giao nếu muốn gửi phiếu khiếu nại U-11 trực tiếp tới Staff */}
          {cat === "complaint" && handoverOrders.length > 0 && (
            <div className="mt-6 rounded-xl border border-brand/25 bg-surface-2/60 p-4">
              <label htmlFor="fb-order" className="text-sm font-bold text-ink">
                Đính kèm đơn bàn giao tranh chấp (tùy chọn — gửi thẳng Staff S-05)
              </label>
              <select
                id="fb-order"
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="input mt-2 h-10 bg-white text-sm"
              >
                <option value="">— Không chọn đơn (chỉ gửi phản hồi chung) —</option>
                {handoverOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.displayCode} · {o.recycler || o.citizenName || "Đối tác"} · {o.status}
                  </option>
                ))}
              </select>

              {selectedOrderId && (
                <div className="mt-3">
                  <label htmlFor="fb-cat-code" className="text-xs font-semibold text-ink">
                    Nhóm nguyên nhân khiếu nại chính thức (BR-DSP-02)
                  </label>
                  <select
                    id="fb-cat-code"
                    value={backendCategory}
                    onChange={(e) =>
                      setBackendCategory(e.target.value as ComplaintCategoryCode)
                    }
                    className="input mt-1 h-10 bg-white text-sm"
                  >
                    {Object.entries(COMPLAINT_CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* 2. Loại vấn đề */}
          <fieldset className="mt-7">
            <legend className="text-sm font-bold text-ink">
              Vấn đề cụ thể{" "}
              <span className="font-normal text-muted">(bắt buộc)</span>
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {list.map((it) => {
                const on = issue === it.id
                return (
                  <label
                    key={it.id}
                    className={`cursor-pointer rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                      on
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-surface text-body hover:bg-surface-2"
                    }`}
                  >
                    <input
                      type="radio"
                      name="issue"
                      value={it.id}
                      checked={on}
                      onChange={() => {
                        setIssue(it.id)
                        setErrs((e) => ({ ...e, issue: undefined }))
                      }}
                      className="sr-only"
                    />
                    {it.label}
                  </label>
                )
              })}
            </div>
            {issue && (
              <p className="mt-3 text-[13px] text-brand">
                {SLA[issue as keyof typeof SLA]}
              </p>
            )}
            {errs.issue && <FieldError text={errs.issue} />}
          </fieldset>

          {/* 3. Mô tả */}
          <div className="mt-7">
            <label htmlFor="fb-desc" className="text-sm font-bold text-ink">
              Mô tả chi tiết <span className="font-normal text-muted">(bắt buộc)</span>
            </label>
            <textarea
              id="fb-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value.slice(0, DESC_MAX))}
              rows={5}
              aria-invalid={!!errs.desc}
              aria-describedby="fb-desc-hint"
              placeholder="Ngày giờ, địa chỉ, mã lịch thu gom nếu có. Càng cụ thể càng xử lý nhanh."
              className={`input mt-2 h-auto resize-y py-3 leading-6 ${
                errs.desc ? "border-warn" : ""
              }`}
            />
            <div
              id="fb-desc-hint"
              className="mt-1.5 flex flex-wrap justify-between gap-2 text-[13px]"
            >
              {errs.desc ? (
                <span className="text-warn">{errs.desc}</span>
              ) : (
                <span className="text-muted">
                  Nêu rõ điều bạn mong đổi xảy ra, không chỉ điều đã xảy ra.
                </span>
              )}
              <span className="tabular-nums text-muted">
                {desc.trim().length} / {DESC_MAX}
                {desc.trim().length < DESC_MIN && ` (tối thiểu ${DESC_MIN})`}
              </span>
            </div>
          </div>

          {/* 4. Ảnh minh hoạ */}
          <Photos
            photos={photos}
            setPhotos={setPhotos}
            error={errs.photos}
            clearError={() => setErrs((e) => ({ ...e, photos: undefined }))}
          />

          {/* 5. Liên hệ */}
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="fb-name" className="text-sm font-bold text-ink">
                Họ tên
              </label>
              <input
                id="fb-name"
                defaultValue={user}
                placeholder={user ? "" : "Không bắt buộc"}
                className="input mt-2"
              />
            </div>
            <div>
              <label htmlFor="fb-contact" className="text-sm font-bold text-ink">
                Email hoặc số điện thoại{" "}
                <span className="font-normal text-muted">(bắt buộc)</span>
              </label>
              <input
                id="fb-contact"
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value)
                  setErrs((x) => ({ ...x, contact: undefined }))
                }}
                inputMode="email"
                autoComplete="email"
                placeholder="ban@email.vn hoặc 0901234567"
                aria-invalid={!!errs.contact}
                aria-describedby="fb-contact-err"
                className={`input mt-2 ${errs.contact ? "border-warn" : ""}`}
              />
              {errs.contact && (
                <p id="fb-contact-err" className="mt-1.5 text-[13px] text-warn">
                  {errs.contact}
                </p>
              )}
            </div>
          </div>

          {submitError && (
            <p role="alert" className="mt-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-warn">
              {submitError}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button type="submit" disabled={submitting} className="btn btn-primary h-12 px-7">
              {submitting ? "Đang gửi..." : "Gửi nội dung"}
            </button>
            <p className="text-[13px] text-muted">
              Miễn phí. Thông tin chỉ dùng để xử lý việc bạn báo.
            </p>
          </div>
        </form>

        <aside className="min-w-0">
          {/* Cam kết xử lý: nói trước để người gửi biết mình chờ được gì, không
              phải gửi xong rồi mới hỏi "bao lâu thì có tin". */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-base font-bold text-ink">Sau khi bạn gửi</h2>
            <ol className="mt-4 flex flex-col gap-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{s.title}</p>
                    <p className="mt-0.5 text-[13px] leading-5 text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-line-soft pt-4 text-sm leading-6 text-body">
              Gấp hơn? Gọi{" "}
              <a href={`tel:${SUPPORT.links[0].split(" ")[0]}`} className="font-semibold text-brand hover:text-brand-deep">
                {SUPPORT.links[0]}
              </a>{" "}
              hoặc{" "}
              <a href={`mailto:${SUPPORT.links[1]}`} className="font-semibold text-brand hover:text-brand-deep">
                {SUPPORT.links[1]}
              </a>
              .
            </p>
          </div>

          {/* FAQ dùng <details> gốc: mở/đóng do trình duyệt lo, không cần
              state, không cần animation, vẫn đóng được bằng bàn phím. */}
          <div className="mt-6">
            <h2 className="text-base font-bold text-ink">Câu hỏi thường gặp</h2>
            <div className="mt-3 divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-surface">
              {FAQ.map((f) => (
                <details key={f.q} className="group px-5 py-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-ink marker:content-none">
                    <span className="flex items-start justify-between gap-3">
                      {f.q}
                      <span className="mt-0.5 shrink-0 text-muted transition-transform group-open:rotate-45">
                        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                    </span>
                  </summary>
                  <p className="mt-2.5 text-[13px] leading-6 text-body">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {myComplaints.length > 0 && (
        <section className="mt-10 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-bold text-ink">
            Khiếu nại giao dịch của tôi ({myComplaints.length})
          </h2>
          <p className="mt-1 text-xs text-muted">
            Theo dõi trạng thái xử lý và biên bản phán quyết trọng tài từ bộ phận vận hành EcoLink (STT 111).
          </p>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {myComplaints.map((c) => (
              <li key={c.complaintId} className="rounded-xl border border-line-soft bg-white p-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-ink">{c.complaintCode}</span>
                  <span className="rounded-full bg-surface-3 px-2.5 py-0.5 font-semibold text-brand-deep">
                    {c.status}
                  </span>
                </div>
                <p className="mt-1 text-muted">
                  Đơn {c.requestCode} · {COMPLAINT_CATEGORY_LABELS[c.category] || c.category} · Vai trò:{" "}
                  <b>{c.complainantRole}</b>
                </p>
                <p className="mt-2 text-body">{c.description}</p>
                {c.resolutionOutcome && (
                  <div className="mt-2 rounded-lg border border-brand/20 bg-mint/10 p-2.5 text-brand-deep">
                    <b>Kết luận ({c.resolutionOutcome}):</b> {c.resolutionNote}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function FieldError({ text }: { text: string }) {
  return <p className="mt-2.5 text-[13px] text-warn">{text}</p>
}

function Photos({
  photos,
  setPhotos,
  error,
  clearError,
}: {
  photos: File[]
  setPhotos: (f: File[]) => void
  error?: string
  clearError: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState("")

  const add = (list: FileList | null) => {
    if (!list) return
    const next: File[] = []
    let skipped = 0
    for (const f of Array.from(list)) {
      if (!f.type.startsWith("image/") || f.size > MAX_PHOTO_MB * 1024 * 1024) {
        skipped++
        continue
      }
      if (photos.length + next.length >= MAX_PHOTOS) {
        skipped++
        continue
      }
      next.push(f)
    }
    if (skipped) setNote(`Bỏ qua ${skipped} ảnh: sai định dạng, quá ${MAX_PHOTO_MB}MB hoặc vượt quá ${MAX_PHOTOS} ảnh.`)
    else setNote("")
    if (next.length) {
      setPhotos([...photos, ...next])
      clearError()
    }
    if (input.current) input.current.value = "" // cho chọn lại cùng file được
  }

  return (
    <div className="mt-7">
      <span className="text-sm font-bold text-ink">Ảnh minh hoạ</span>
      <span className="ml-2 text-[13px] text-muted">không bắt buộc, tối đa {MAX_PHOTOS} ảnh</span>

      <div className="mt-2.5 flex flex-wrap gap-3">
        {photos.map((f, i) => (
          <div key={`${f.name}-${i}`} className="relative">
            <Thumb file={f} alt={`Ảnh đính kèm ${i + 1}`} />
            <button
              type="button"
              onClick={() => setPhotos(photos.filter((_, n) => n !== i))}
              aria-label={`Xoá ảnh ${i + 1}`}
              className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-ink text-white"
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {photos.length < MAX_PHOTOS && (
          <label className="grid aspect-square w-28 cursor-pointer place-items-center rounded-xl border border-dashed border-sage-line bg-surface text-center transition-colors hover:bg-surface-2">
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => add(e.target.files)}
              className="sr-only"
            />
            <span className="px-2">
              <svg viewBox="0 0 24 24" className="mx-auto size-6 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 16V4M8 8l4-4 4 4M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
              </svg>
              <span className="mt-1.5 block text-[11px] leading-4 text-muted">Chọn ảnh</span>
            </span>
          </label>
        )}
      </div>

      {(note || error) && <p className="mt-2.5 text-[13px] text-warn">{error || note}</p>}
    </div>
  )
}

function Thumb({ file, alt }: { file: File; alt: string }) {
  // Tạo objectURL trong effect chứ không dùng useMemo: StrictMode ở dev gọi
  // effect 2 lần, cleanup lần một sẽ huỷ URL nếu tạo ở useMemo và ảnh vỡ.
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  if (!url) return <span className="size-28 rounded-xl border border-line bg-surface-2" />
  return <img src={url} alt={alt} className="size-28 rounded-xl border border-line object-cover" />
}

/** Màn hình xác nhận. Mã tiếp nhận là thứ duy nhất người gửi cần mang đi. */
function Done({ refCode, cat }: { refCode: string; cat: Category }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="page flex flex-col pb-16">
      <div className="mt-10 max-w-[60ch] md:mt-14">
        <span className="grid size-12 place-items-center rounded-full bg-brand text-white">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 13 4 4L19 7" />
          </svg>
        </span>
        <h1 className="display mt-5 text-[26px] leading-9 md:text-[32px]">
          Đã ghi nhận {cat === "complaint" ? "khiếu nại" : "góp ý"} của bạn
        </h1>
        <p className="mt-3 text-base leading-7 text-body">
          Chúng tôi gửi mã này qua email và sẽ liên hệ trong thời hạn đã cam kết.
          Nếu gấp, gọi 1900 8828 và đưa mã dưới đây.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
              Mã tiếp nhận
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-ink">
              {refCode}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(refCode)
              setCopied(true)
            }}
            className="btn btn-outline ml-auto"
          >
            {copied ? "Đã chép" : "Chép mã"}
          </button>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a href="/" className="btn btn-primary h-12 px-6">
            Về trang chủ
          </a>
          <button
            type="button"
            onClick={() => location.reload()}
            className="btn btn-ghost h-12 px-6"
          >
            Gửi thêm nội dung
          </button>
        </div>
      </div>
    </div>
  )
}
