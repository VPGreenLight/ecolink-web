import { useEffect, useState } from "react"
import { PageHead, Field, Status, Table, Td } from "@/components/Portal"
import { GIFTS, type Gift } from "@/data/ops"
import {
  createStaffGift,
  fetchStaffGifts,
  fetchStaffRedemptions,
  fulfillStaffRedemption,
  importGiftVouchers,
  restockStaffGift,
  setStaffGiftStatus,
  updateStaffGift,
  type GiftItemDto,
  type RedemptionDto,
} from "@/lib/gamificationApi"
import { hasLiveBackendAuth } from "@/lib/session"

/** S-10 Quản lý kho quà tặng & xử lý đơn đổi quà. */
export default function Gifts() {
  const [liveMode] = useState(() => hasLiveBackendAuth())
  const [offlineList, setOfflineList] = useState<Gift[]>(GIFTS)
  const [liveGifts, setLiveGifts] = useState<GiftItemDto[]>([])
  const [redemptions, setRedemptions] = useState<RedemptionDto[]>([])
  const [loading, setLoading] = useState(liveMode)

  const [name, setName] = useState("")
  const [giftType, setGiftType] = useState<"Physical" | "Voucher">("Physical")
  const [cost, setCost] = useState(200)
  const [stock, setStock] = useState(20)
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState("")

  const loadAll = async () => {
    setLoading(true)
    try {
      const [gRes, rRes] = await Promise.all([
        fetchStaffGifts({ pageSize: 50 }),
        fetchStaffRedemptions({ pageSize: 50 }),
      ])
      if (gRes.data?.items) setLiveGifts(gRes.data.items)
      if (rRes.data?.items) setRedemptions(rRes.data.items)
    } catch {
      // Giữ trạng thái hiện tại
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (liveMode) void loadAll()
  }, [liveMode])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!liveMode) {
      if (name.trim().length < 5) {
        setFlash("Tên quà cần ít nhất 5 ký tự.")
        return
      }
      const id = `g-${Date.now().toString(36)}`
      setOfflineList((ls) => [
        ...ls,
        { id, name: name.trim(), cost, stock, kind: "gift", active: true },
      ])
      setName("")
      setFlash(`Đã thêm ${name.trim()}. Người dùng thấy nó ngay ở trang đổi thưởng.`)
      return
    }

    if (busy) return
    setBusy(true)
    setFlash("")
    try {
      await createStaffGift({
        name: name.trim(),
        type: giftType,
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        pointsRequired: cost,
        stockQuantity: stock,
      })
      setName("")
      setDescription("")
      setImageUrl("")
      setFlash("Đã thêm quà vào kho.")
      await loadAll()
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Không thể thêm quà.")
    } finally {
      setBusy(false)
    }
  }

  const updateOffline = (id: string, patch: Partial<Gift>) =>
    setOfflineList((ls) => ls.map((g) => (g.id === id ? { ...g, ...patch } : g)))

  const removeOffline = (id: string) => {
    setOfflineList((ls) => ls.filter((g) => g.id !== id))
    setFlash("Đã xoá món quà khỏi kho.")
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="KHO QUÀ"
        title="Quà tặng và voucher"
        body="Quản lý vật phẩm đổi thưởng, bổ sung tồn kho / lô mã E-Voucher và xác nhận bàn giao đơn đổi quà."
      />

      <form onSubmit={(e) => void add(e)} noValidate className="card flex flex-col gap-5 p-5 md:p-6">
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr_1fr]">
          <Field label="Tên quà">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Bộ dụng cụ thu gom gia đình"
            />
          </Field>
          <Field label="Điểm đổi">
            <input
              className="input tabular-nums"
              type="number"
              min={0}
              step={10}
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
            />
          </Field>
          <Field label="Tồn kho">
            <input
              className="input tabular-nums"
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
            />
          </Field>
        </div>

        {liveMode && (
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Loại quà">
              <select
                className="input"
                value={giftType}
                onChange={(e) =>
                  setGiftType(e.target.value === "Voucher" ? "Voucher" : "Physical")
                }
              >
                <option value="Physical">Quà vật lý (Physical)</option>
                <option value="Voucher">E-Voucher</option>
              </select>
            </Field>
            <Field label="URL ảnh (tuỳ chọn)">
              <input
                className="input"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="/assets/rewards/bag.jpg"
              />
            </Field>
            <Field label="Mô tả ngắn (tuỳ chọn)">
              <input
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Điều kiện sử dụng / chi tiết quà"
              />
            </Field>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button type="submit" disabled={busy} className="btn-primary h-11 px-6">
            {busy ? "Đang thêm..." : "Thêm vào kho"}
          </button>
          {flash && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {flash}
            </p>
          )}
        </div>
      </form>

      {liveMode ? (
        <>
          <section>
            <h2 className="mb-3 text-base font-bold text-ink">
              Danh mục kho quà ({liveGifts.length})
            </h2>
            {loading && liveGifts.length === 0 ? (
              <p className="text-sm text-muted">Đang tải kho quà...</p>
            ) : (
              <Table head={["Quà", "Loại", "Điểm đổi", "Tồn kho", "Trạng thái", "Thao tác"]}>
                {liveGifts.map((g) => {
                  const active = g.status === "ACTIVE"
                  return (
                    <tr key={g.id}>
                      <Td className="font-semibold text-ink">{g.name}</Td>
                      <Td className="whitespace-nowrap">
                        {g.type === "Voucher" ? "E-Voucher" : "Quà vật lý"}
                      </Td>
                      <Td>
                        <input
                          className="input h-9 w-24 tabular-nums"
                          type="number"
                          min={0}
                          value={g.pointsRequired}
                          onChange={(e) => {
                            const nextPts = Number(e.target.value)
                            setLiveGifts((prev) =>
                              prev.map((x) =>
                                x.id === g.id ? { ...x, pointsRequired: nextPts } : x,
                              ),
                            )
                          }}
                          aria-label={`Điểm đổi của ${g.name}`}
                        />
                      </Td>
                      <Td className="tabular-nums font-semibold text-ink">
                        {g.stockQuantity.toLocaleString("vi-VN")}
                      </Td>
                      <Td>
                        <Status tone={active ? "ok" : "off"}>
                          {active ? "Đang mở" : "Đang ẩn"}
                        </Status>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-2.5 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await updateStaffGift(g.id, {
                                  name: g.name,
                                  type: g.type === "Voucher" ? "Voucher" : "Physical",
                                  description: g.description,
                                  imageUrl: g.imageUrl,
                                  pointsRequired: g.pointsRequired,
                                  stockQuantity: g.stockQuantity,
                                })
                                setFlash(`Đã cập nhật điểm đổi cho "${g.name}".`)
                                await loadAll()
                              } catch (err) {
                                setFlash(err instanceof Error ? err.message : "Cập nhật thất bại.")
                              }
                            }}
                            className="text-brand-deep hover:underline"
                          >
                            Lưu giá
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                if (g.type === "Voucher") {
                                  await importGiftVouchers(g.id, { quantity: 10 })
                                  setFlash(`Đã nhập thêm 10 mã E-Voucher cho "${g.name}".`)
                                } else {
                                  await restockStaffGift(g.id, 10)
                                  setFlash(`Đã nhập thêm 10 món vào kho "${g.name}".`)
                                }
                                await loadAll()
                              } catch (err) {
                                setFlash(err instanceof Error ? err.message : "Nhập kho thất bại.")
                              }
                            }}
                            className="text-brand hover:underline"
                          >
                            +10 kho
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await setStaffGiftStatus(g.id, active ? "INACTIVE" : "ACTIVE")
                                setFlash(
                                  `Đã ${active ? "ẩn" : "mở"} quà "${g.name}".`,
                                )
                                await loadAll()
                              } catch (err) {
                                setFlash(err instanceof Error ? err.message : "Đổi trạng thái thất bại.")
                              }
                            }}
                            className="text-muted hover:text-ink"
                          >
                            {active ? "Ẩn" : "Mở"}
                          </button>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </Table>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-base font-bold text-ink">
              Đơn đổi quà của người dùng ({redemptions.length})
            </h2>
            <Table head={["Mã đơn", "Người đổi", "Quà tặng", "Giao nhận / Mã", "Trạng thái", "Xử lý"]}>
              {redemptions.map((r) => {
                const actionable = r.status === "Pending" || r.status === "Redeemed"
                return (
                  <tr key={r.id}>
                    <Td className="font-mono text-xs whitespace-nowrap">{r.redemptionCode}</Td>
                    <Td>{r.userName || "Thành viên"}</Td>
                    <Td className="font-semibold text-ink">{r.gift?.name}</Td>
                    <Td className="max-w-[220px] truncate text-xs">
                      {r.voucherCode || r.deliveryAddress || "—"}
                    </Td>
                    <Td>
                      <Status
                        tone={
                          r.status === "Delivered"
                            ? "ok"
                            : r.status === "Pending" || r.status === "Redeemed"
                              ? "wait"
                              : "off"
                        }
                      >
                        {r.status}
                      </Status>
                    </Td>
                    <Td>
                      {actionable ? (
                        <div className="flex gap-2.5 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await fulfillStaffRedemption(r.id, { action: "Fulfill" })
                                setFlash(`Đã xác nhận bàn giao đơn ${r.redemptionCode}.`)
                                await loadAll()
                              } catch (err) {
                                setFlash(err instanceof Error ? err.message : "Xử lý thất bại.")
                              }
                            }}
                            className="text-brand hover:underline"
                          >
                            Đã giao
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await fulfillStaffRedemption(r.id, {
                                  action: "Cancel",
                                  reason: "Nhân viên hủy đơn và hoàn điểm",
                                })
                                setFlash(`Đã hủy và hoàn điểm đơn ${r.redemptionCode}.`)
                                await loadAll()
                              } catch (err) {
                                setFlash(err instanceof Error ? err.message : "Hủy thất bại.")
                              }
                            }}
                            className="text-warn hover:underline"
                          >
                            Hủy &amp; hoàn điểm
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </Table>
          </section>
        </>
      ) : (
        <Table head={["Quà", "Loại", "Điểm", "Tồn kho", "Trạng thái", ""]}>
          {offlineList.map((g) => (
            <tr key={g.id}>
              <Td className="font-semibold text-ink">{g.name}</Td>
              <Td className="whitespace-nowrap">
                {g.kind === "voucher" ? "Voucher" : "Quà vật lý"}
              </Td>
              <Td>
                <input
                  className="input h-9 w-28 tabular-nums"
                  type="number"
                  min={0}
                  step={500}
                  value={g.cost}
                  onChange={(e) => updateOffline(g.id, { cost: Number(e.target.value) })}
                  aria-label={`Điểm đổi của ${g.name}`}
                />
              </Td>
              <Td>
                {g.stock === null ? (
                  <span className="text-[13px] text-muted">Không giới hạn</span>
                ) : (
                  <input
                    className="input h-9 w-24 tabular-nums"
                    type="number"
                    min={0}
                    value={g.stock}
                    onChange={(e) => updateOffline(g.id, { stock: Number(e.target.value) })}
                    aria-label={`Tồn kho của ${g.name}`}
                  />
                )}
              </Td>
              <Td>
                <Status tone={g.active ? "ok" : "off"}>
                  {g.active ? "Đang mở" : "Đang ẩn"}
                </Status>
              </Td>
              <Td>
                <span className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => updateOffline(g.id, { active: !g.active })}
                    className="text-[13px] font-semibold text-brand hover:text-brand-deep"
                  >
                    {g.active ? "Ẩn" : "Hiện"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOffline(g.id)}
                    className="text-[13px] font-semibold text-warn hover:underline"
                  >
                    Xoá
                  </button>
                </span>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
