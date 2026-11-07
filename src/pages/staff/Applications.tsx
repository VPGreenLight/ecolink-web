import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import LocationPinPickerMap from "@/components/LocationPinPickerMap"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import {
  decideStaffApplication,
  fetchStaffApplications,
  getInitialStaffApplications,
  type StaffApplicationView,
} from "@/lib/recyclerWorkflowApi"

/** S-04 Thẩm định hồ sơ đối tác thu mua (kèm bản đồ đối chiếu vị trí ghim kho bãi `BR-MTH-01`).
 *
 *  Hồ sơ từ chối bắt buộc có lý do rõ ràng (tối thiểu 10 ký tự theo `BR-MTH-02`) để đối tác
 *  biết cần bổ sung chứng từ hay cập nhật lại ghim kho bãi rồi nộp lại.
 *  Khi phê duyệt, hồ sơ được kích hoạt và hiển thị ngay trên bản đồ tìm kiếm `/map`. */
export default function Applications() {
  const [list, setList] = useState<StaffApplicationView[]>(() =>
    getInitialStaffApplications(),
  )
  const [fromBackend, setFromBackend] = useState(false)
  const [inspectingMapId, setInspectingMapId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectErr, setRejectErr] = useState("")
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [flash, setFlash] = useState("")

  useEffect(() => {
    let active = true
    void fetchStaffApplications().then((res) => {
      if (!active) return
      setList(res.items)
      setFromBackend(res.fromBackend)
      const firstPending = res.items.find((x) => x.status === "pending")
      if (firstPending) {
        setInspectingMapId(firstPending.id)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const handleApprove = async (app: StaffApplicationView) => {
    setProcessingId(app.id)
    try {
      const res = await decideStaffApplication(app, true)
      setList((ls) => ls.map((a) => (a.id === app.id ? res.updated : a)))
      setFromBackend(res.fromBackend)
      setRejectingId(null)
      setFlash(
        `${app.name} (${app.id}): đã phê duyệt. Ghim kho bãi đã được kích hoạt trên trang Bản đồ /map.`,
      )
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Không thể phê duyệt hồ sơ lúc này.")
    } finally {
      setProcessingId(null)
    }
  }

  const handleConfirmReject = async (app: StaffApplicationView) => {
    const trimmed = rejectReason.trim()
    if (trimmed.length < 10) {
      setRejectErr("Lý do từ chối cần tối thiểu 10 ký tự để cơ sở biết hướng bổ sung (BR-MTH-02).")
      return
    }
    setRejectErr("")
    setProcessingId(app.id)
    try {
      const res = await decideStaffApplication(app, false, trimmed)
      setList((ls) => ls.map((a) => (a.id === app.id ? res.updated : a)))
      setFromBackend(res.fromBackend)
      setRejectingId(null)
      setRejectReason("")
      setFlash(`${app.name} (${app.id}): đã từ chối với lý do "${trimmed}".`)
    } catch (err) {
      setRejectErr(err instanceof Error ? err.message : "Không thể từ chối hồ sơ lúc này.")
    } finally {
      setProcessingId(null)
    }
  }

  const pending = list.filter((a) => a.status === "pending")
  const done = list.filter((a) => a.status !== "pending")

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="ĐỐI TÁC"
        title="Thẩm định hồ sơ cơ sở thu mua"
        body="Chỉ duyệt khi giấy phép còn hiệu lực và vị trí ghim kho bãi trùng khớp với địa chỉ thu gom thực tế. Từ chối bắt buộc ghi rõ lý do để đối tác bổ sung."
        action={
          <span className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted">
            {fromBackend ? "Nguồn: PostgreSQL + PostGIS" : "Nguồn: Hàng đợi trình duyệt"}
          </span>
        }
      />

      {flash && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/25 bg-brand/6 px-4 py-3">
          <p role="status" className="text-[13px] font-semibold text-brand-deep">
            {flash}
          </p>
          <Link to="/map" className="text-xs font-semibold text-brand hover:underline">
            Mở trang Bản đồ kiểm tra ghim →
          </Link>
        </div>
      )}

      <section>
        <h2 className="text-base font-bold text-ink">Chờ thẩm định ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="card mt-3 px-5 py-8 text-center text-sm text-muted">
            Không có hồ sơ nào đang chờ.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {pending.map((a) => {
              const mapOpen = inspectingMapId === a.id
              const isRejecting = rejectingId === a.id
              const busy = processingId === a.id

              return (
                <li key={a.id} className="card flex flex-col gap-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{a.name}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {a.id} · {a.date} · {a.address}
                      </p>
                      {(a.representativeName || a.phone) && (
                        <p className="mt-0.5 text-xs text-body">
                          {a.representativeName && <span>Đại diện: {a.representativeName}</span>}
                          {a.phone && <span className="ml-3 tabular-nums">SĐT: {a.phone}</span>}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-surface-2 px-3 py-1 text-[13px] text-body">
                      {a.materials}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-ink">
                        Giấy tờ & chứng từ đã đính kèm
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {a.docs.map((d) => (
                          <li
                            key={d}
                            className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-body"
                          >
                            {d}
                          </li>
                        ))}
                        {a.legalPermitUrl && (
                          <li>
                            <a
                              href={a.legalPermitUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block rounded-full border border-brand/30 bg-brand/8 px-3 py-1 text-xs font-semibold text-brand-deep hover:underline"
                            >
                              Mở file giấy phép ↗
                            </a>
                          </li>
                        )}
                        {a.businessPhotoUrl && (
                          <li>
                            <a
                              href={a.businessPhotoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block rounded-full border border-brand/30 bg-brand/8 px-3 py-1 text-xs font-semibold text-brand-deep hover:underline"
                            >
                              Xem ảnh kho bãi ↗
                            </a>
                          </li>
                        )}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInspectingMapId(mapOpen ? null : a.id)}
                      className="btn-outline h-9 px-3.5 text-xs"
                    >
                      {mapOpen
                        ? "Ẩn bản đồ kho bãi"
                        : `Kiểm tra ghim kho bãi (${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)})`}
                    </button>
                  </div>

                  {mapOpen && (
                    <LocationPinPickerMap
                      lat={a.latitude}
                      lng={a.longitude}
                      readOnly
                      pinTitle={`${a.name} (Chờ duyệt)`}
                      heightClass="h-[220px]"
                    />
                  )}

                  {isRejecting && (
                    <div className="flex flex-col gap-2.5 rounded-xl border border-warn/35 bg-surface-2 p-4">
                      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
                        Lý do từ chối hồ sơ {a.id} (cơ sở sẽ nhận được thông báo này)
                        <input
                          className="input bg-white"
                          value={rejectReason}
                          onChange={(e) => {
                            setRejectReason(e.target.value)
                            if (rejectErr) setRejectErr("")
                          }}
                          placeholder="Ví dụ: Ảnh giấy phép bị mờ góc phải hoặc vị trí ghim lệch địa chỉ đăng ký..."
                        />
                      </label>
                      {rejectErr && <p className="text-xs text-warn">{rejectErr}</p>}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleConfirmReject(a)}
                          className="btn-primary h-9 px-4 text-xs"
                        >
                          {busy ? "Đang xử lý..." : "Xác nhận từ chối"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(null)
                            setRejectReason("")
                            setRejectErr("")
                          }}
                          className="btn-ghost h-9 px-3 text-xs"
                        >
                          Huỷ
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 border-t border-line-soft pt-4">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleApprove(a)}
                      className="btn-primary h-11 px-6"
                    >
                      {busy ? "Đang duyệt..." : "Duyệt hồ sơ & Lên bản đồ"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setRejectingId(isRejecting ? null : a.id)
                        setRejectReason("")
                        setRejectErr("")
                      }}
                      className="btn-ghost h-11 px-5"
                    >
                      Từ chối
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold text-ink">Đã xử lý ({done.length})</h2>
        <div className="mt-3">
          <Table head={["Mã", "Tên cơ sở", "Địa chỉ & Toạ độ", "Ngày nộp", "Kết quả", "Lý do"]}>
            {done.map((a) => (
              <tr key={a.id}>
                <Td className="tabular-nums whitespace-nowrap">{a.id}</Td>
                <Td className="font-semibold text-ink">{a.name}</Td>
                <Td>
                  <span className="block">{a.address}</span>
                  <span className="text-[11px] tabular-nums text-muted">
                    GPS: {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
                  </span>
                </Td>
                <Td className="tabular-nums whitespace-nowrap">{a.date}</Td>
                <Td>
                  <Status tone={a.status === "approved" ? "ok" : "off"}>
                    {a.status === "approved" ? "Đã duyệt" : "Từ chối"}
                  </Status>
                </Td>
                <Td>{a.note ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        </div>
      </section>
    </div>
  )
}
