import { useEffect, useState } from "react"
import { PageHead, Field, FormRequiredLegend, Status, Table, Td } from "@/components/Portal"
import SearchFilterBar from "@/components/SearchFilterBar"
import PaginationBar, { FIXED_PAGE_SIZE } from "@/components/PaginationBar"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { GIFTS, type Gift } from "@/data/ops"
import { ApiError } from "@/lib/api"
import { initApiLoading, isSsrSmokeTest } from "@/lib/hydration"
import { hasLiveBackendAuth } from "@/lib/session"
import {
  createStaffGift,
  fetchStaffGifts,
  fetchStaffRedemptions,
  fulfillStaffRedemption,
  importGiftVouchers,
  restockStaffGift,
  setStaffGiftStatus,
  updateStaffGift,
  uploadStaffGiftImage,
  type GiftItemDto,
  type RedemptionDto,
} from "@/lib/gamificationApi"

const PRESET_REWARD_IMAGES = [
  { label: "Voucher 10%", url: "/assets/rewards/coupon10.jpg" },
  { label: "Bộ kit cây xanh", url: "/assets/rewards/kit.jpg" },
  { label: "Túi vải canvas", url: "/assets/rewards/bag.jpg" },
  { label: "Ly thủy tinh", url: "/assets/rewards/glasses.jpg" },
  { label: "Hạt giống / cây", url: "/assets/rewards/seedling.jpg" },
  { label: "Thùng phân loại / ép", url: "/assets/rewards/compactor.jpg" },
  { label: "Bộ nồi cao cấp", url: "/assets/rewards/grand-cookware.jpg" },
  { label: "Xe điện xanh", url: "/assets/rewards/grand-scooter.jpg" },
  { label: "Chuyến du lịch xanh", url: "/assets/rewards/grand-trip.jpg" },
]

/** S-10 Quản lý kho quà tặng & xử lý đơn đổi quà. */
export default function Gifts() {
  const [liveMode] = useState(() => !isSsrSmokeTest())
  const [offlineList, setOfflineList] = useState<Gift[]>(GIFTS)
  const [liveGifts, setLiveGifts] = useState<GiftItemDto[]>([])
  const [giftsTotal, setGiftsTotal] = useState(0)
  const [giftSearch, setGiftSearch] = useState("")
  const debouncedGiftSearch = useDebouncedValue(giftSearch, 300)
  const [giftTypeFilter, setGiftTypeFilter] = useState("")
  const [giftPage, setGiftPage] = useState(1)
  const giftPageSize = FIXED_PAGE_SIZE

  const [redemptions, setRedemptions] = useState<RedemptionDto[]>([])
  const [redTotal, setRedTotal] = useState(0)
  const [redSearch, setRedSearch] = useState("")
  const debouncedRedSearch = useDebouncedValue(redSearch, 300)
  const [redStatusFilter, setRedStatusFilter] = useState("")
  const [redPage, setRedPage] = useState(1)
  const redPageSize = FIXED_PAGE_SIZE

  const [loading, setLoading] = useState(() => initApiLoading(true))

  const [name, setName] = useState("")
  const [giftType, setGiftType] = useState<"Physical" | "Voucher">("Physical")
  const [cost, setCost] = useState(200)
  const [stock, setStock] = useState(20)
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("/assets/rewards/bag.jpg")
  const [uploadingImg, setUploadingImg] = useState(false)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState("")
  const [formErr, setFormErr] = useState("")
  const [actionErr, setActionErr] = useState("")

  const loadGifts = async () => {
    setLoading(true)
    try {
      const gRes = await fetchStaffGifts({
        type: giftTypeFilter || undefined,
        search: debouncedGiftSearch.trim() || undefined,
        page: giftPage,
        pageSize: giftPageSize,
      })
      if (gRes.data?.items) {
        setLiveGifts(gRes.data.items)
        setGiftsTotal(gRes.data.totalCount ?? gRes.data.items.length)
      }
    } catch {
      // Giữ trạng thái hiện tại
    } finally {
      setLoading(false)
    }
  }

  const loadRedemptions = async () => {
    try {
      const rRes = await fetchStaffRedemptions({
        status: redStatusFilter || undefined,
        search: debouncedRedSearch.trim() || undefined,
        page: redPage,
        pageSize: redPageSize,
      })
      if (rRes.data?.items) {
        setRedemptions(rRes.data.items)
        setRedTotal(rRes.data.totalCount ?? rRes.data.items.length)
      }
    } catch {
      // Giữ trạng thái hiện tại
    }
  }

  const loadAll = async () => {
    await Promise.all([loadGifts(), loadRedemptions()])
  }

  useEffect(() => {
    if (liveMode) void loadGifts()
  }, [liveMode, giftTypeFilter, debouncedGiftSearch, giftPage, giftPageSize])

  useEffect(() => {
    if (liveMode) void loadRedemptions()
  }, [liveMode, redStatusFilter, debouncedRedSearch, redPage, redPageSize])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr("")
    setActionErr("")
    setFlash("")

    const cleanName = name.trim()
    const cleanDesc = description.trim()
    const cleanImg = imageUrl.trim()

    if (cleanName.length < 2 || cleanName.length > 150) {
      setFormErr("Tên quà tặng phải từ 2 đến 150 ký tự.")
      return
    }
    if (!Number.isInteger(cost) || cost <= 0) {
      setFormErr("Điểm đổi quà phải là số nguyên dương lớn hơn 0.")
      return
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setFormErr("Số lượng tồn kho phải là số nguyên không âm (>= 0).")
      return
    }

    if (!liveMode && !hasLiveBackendAuth()) {
      const id = `g-${Date.now().toString(36)}`
      setOfflineList((ls) => [
        ...ls,
        { id, name: cleanName, cost, stock, kind: "gift", active: true },
      ])
      setName("")
      setFlash(`Đã thêm ${cleanName}. Người dùng thấy nó ngay ở trang đổi thưởng.`)
      return
    }

    if (cleanDesc.length > 500) {
      setFormErr("Mô tả quà tặng không được vượt quá 500 ký tự.")
      return
    }
    if (!cleanImg) {
      setFormErr("Vui lòng nhập URL ảnh hoặc tải ảnh quà tặng lên.")
      return
    }

    if (busy) return
    setBusy(true)
    try {
      await createStaffGift({
        name: cleanName,
        type: giftType,
        description: cleanDesc || null,
        imageUrl: cleanImg,
        pointsRequired: cost,
        stockQuantity: stock,
      })
      setName("")
      setDescription("")
      setImageUrl("")
      setFlash("Đã thêm quà vào kho.")
      await loadAll()
    } catch (err) {
      setFormErr(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Không thể thêm quà.")
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
        <FormRequiredLegend />
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr_1fr]">
          <Field label="Tên quà" required>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Bộ dụng cụ thu gom gia đình"
            />
          </Field>
          <Field label="Điểm đổi" required>
            <input
              className="input tabular-nums"
              type="number"
              min={0}
              step={10}
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
            />
          </Field>
          <Field label="Tồn kho" required>
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
          <div className="flex flex-col gap-4">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Loại quà" required>
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
              <Field label="Mô tả ngắn (tuỳ chọn)">
                <input
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Điều kiện sử dụng / chi tiết quà"
                />
              </Field>
              <Field label="Nguồn ảnh (URL hoặc tải lên R2)" required>
                <div className="flex items-center gap-2">
                  <input
                    className="input min-w-0 flex-1"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="/assets/rewards/bag.jpg"
                  />
                  <label className="btn-outline h-10 shrink-0 cursor-pointer px-3 text-xs flex items-center">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ""
                        if (!file) return
                        setFormErr("")
                        setFlash("")
                        const validType =
                          /^image\/(jpeg|jpg|png|webp)$/i.test(file.type) ||
                          /\.(jpe?g|png|webp)$/i.test(file.name)
                        if (!validType) {
                          setFormErr(`Tệp "${file.name}" không phải ảnh JPG, PNG hoặc WEBP hợp lệ.`)
                          return
                        }
                        if (file.size > 10 * 1024 * 1024) {
                          setFormErr(`Ảnh "${file.name}" vượt quá dung lượng tối đa 10 MB.`)
                          return
                        }
                        setUploadingImg(true)
                        try {
                          const upRes = await uploadStaffGiftImage(file)
                          if (upRes.data?.fileUrl) {
                            setImageUrl(upRes.data.fileUrl)
                            setFlash("Đã tải ảnh quà tặng lên hệ thống.")
                          }
                        } catch (err) {
                          setFormErr(err instanceof Error ? err.message : "Tải ảnh thất bại.")
                        } finally {
                          setUploadingImg(false)
                        }
                      }}
                    />
                    {uploadingImg ? "Đang tải..." : "Tải ảnh"}
                  </label>
                </div>
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line-soft bg-surface p-3">
              {imageUrl.trim() && (
                <img
                  src={imageUrl.trim()}
                  alt="Xem trước ảnh quà"
                  className="size-12 shrink-0 rounded-lg border border-line object-cover"
                />
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted mr-1">Chọn nhanh ảnh mẫu:</span>
                {PRESET_REWARD_IMAGES.map((img) => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => setImageUrl(img.url)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      imageUrl.trim() === img.url
                        ? "border-brand bg-brand/10 text-brand-deep"
                        : "border-line bg-white text-body hover:bg-surface-2"
                    }`}
                  >
                    {img.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {formErr && (
          <p
            role="alert"
            className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn"
          >
            {formErr}
          </p>
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

      {actionErr && (
        <p
          role="alert"
          className="rounded-xl border border-warn/35 bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn"
        >
          {actionErr}
        </p>
      )}

      {liveMode ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-ink">
              Danh mục kho quà ({giftsTotal.toLocaleString("vi-VN")})
            </h2>
            <SearchFilterBar
              label="Tìm quà trong kho"
              value={giftSearch}
              onChange={(v) => {
                setGiftSearch(v)
                setGiftPage(1)
              }}
              placeholder="Tên quà tặng hoặc voucher..."
              totalCount={giftsTotal}
              countLabel="món quà"
            >
              <select
                className="input h-9 text-xs"
                value={giftTypeFilter}
                onChange={(e) => {
                  setGiftTypeFilter(e.target.value)
                  setGiftPage(1)
                }}
                aria-label="Lọc theo loại quà"
              >
                <option value="">Tất cả loại</option>
                <option value="Physical">Quà vật lý</option>
                <option value="Voucher">E-Voucher</option>
              </select>
            </SearchFilterBar>
            {loading && liveGifts.length === 0 ? (
              <p className="text-sm text-muted">Đang tải kho quà...</p>
            ) : (
              <>
                <Table head={["Ảnh", "Quà", "Loại", "Điểm đổi", "Tồn kho", "Trạng thái", "Thao tác"]}>
                  {liveGifts.map((g) => {
                    const active = g.status === "ACTIVE"
                    return (
                      <tr key={g.id}>
                        <Td>
                          {g.imageUrl ? (
                            <img
                              src={g.imageUrl}
                              alt={g.name}
                              className="size-10 rounded-lg border border-line object-cover"
                            />
                          ) : (
                            <span className="grid size-10 place-items-center rounded-lg border border-dashed border-line text-[10px] text-muted">
                              Trống
                            </span>
                          )}
                        </Td>
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
                              setActionErr("")
                              if (!Number.isInteger(g.pointsRequired) || g.pointsRequired <= 0) {
                                setActionErr(`Điểm đổi của "${g.name}" phải lớn hơn 0.`)
                                return
                              }
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
                                setActionErr(err instanceof Error ? err.message : "Cập nhật thất bại.")
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
                                setActionErr(err instanceof Error ? err.message : "Nhập kho thất bại.")
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
                                setActionErr(err instanceof Error ? err.message : "Đổi trạng thái thất bại.")
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
              <PaginationBar
                page={giftPage}
                pageSize={giftPageSize}
                totalCount={giftsTotal}
                onPageChange={setGiftPage}
                itemLabel="món quà"
              />
              </>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-ink">
              Đơn đổi quà của người dùng ({redTotal.toLocaleString("vi-VN")})
            </h2>
            <SearchFilterBar
              label="Tìm đơn đổi quà"
              value={redSearch}
              onChange={(v) => {
                setRedSearch(v)
                setRedPage(1)
              }}
              placeholder="Mã đơn RDM-..., mã voucher hoặc tên người đổi..."
              totalCount={redTotal}
              countLabel="đơn đổi quà"
            >
              <select
                className="input h-9 text-xs"
                value={redStatusFilter}
                onChange={(e) => {
                  setRedStatusFilter(e.target.value)
                  setRedPage(1)
                }}
                aria-label="Lọc trạng thái đơn đổi quà"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="Pending">Chờ giao (Pending)</option>
                <option value="Redeemed">Đã cấp mã (Redeemed)</option>
                <option value="Delivered">Đã giao (Delivered)</option>
                <option value="Cancelled">Đã hủy (Cancelled)</option>
              </select>
            </SearchFilterBar>
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
                                setActionErr(err instanceof Error ? err.message : "Xử lý thất bại.")
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
                                setActionErr(err instanceof Error ? err.message : "Hủy thất bại.")
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
            <PaginationBar
              page={redPage}
              pageSize={redPageSize}
              totalCount={redTotal}
              onPageChange={setRedPage}
              itemLabel="đơn đổi quà"
            />
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
