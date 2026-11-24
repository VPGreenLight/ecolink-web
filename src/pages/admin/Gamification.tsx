import { useCallback, useEffect, useState } from "react"
import { ApiError } from "@/lib/api"
import { PageHead, Field, Stat, Table, Td } from "@/components/admin/ui"
import { GAMIFICATION, ECO_FACTS } from "@/data/ops"
import { initApiLoading, isSsrSmokeTest } from "@/lib/hydration"
import {
  fetchGamificationConfig,
  fetchStaffEcoFacts,
  resetGamificationConfig,
  updateGamificationConfig,
  type GamificationConfigDto,
} from "@/lib/gamificationApi"

/** A-07 Cấu hình gamification: tỷ lệ điểm và mốc level cây ảo.
 *
 *  Mốc level nối thẳng với Eco Fact: mỗi hạng có một "chi phí mở khoá" cho
 *  nhánh cây. Hai bảng đặt cạnh nhau vì sửa hạng mà quên nhánh cây thì người
 *  dùng lên hạng xong không mở được gì. */
export default function GamificationConfig() {
  const [liveMode] = useState(() => !isSsrSmokeTest())

  // Offline / SSR fallback state
  const [pointsPerKg, setPointsPerKg] = useState(GAMIFICATION.pointsPerKg)
  const [labelBonus, setLabelBonus] = useState(GAMIFICATION.labelBonus)
  const [tiers, setTiers] = useState([...GAMIFICATION.tiers])

  // Live Backend state
  const [config, setConfig] = useState<GamificationConfigDto | null>(null)
  const [ecoFactsCount, setEcoFactsCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(() => initApiLoading(true))
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const [flash, setFlash] = useState("")
  const [error, setError] = useState("")

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [cfgRes, factsRes] = await Promise.all([
        fetchGamificationConfig(),
        fetchStaffEcoFacts({ status: "ACTIVE", pageSize: 1 }).catch(() => null),
      ])
      if (cfgRes.data) {
        const sortedLevels = [...(cfgRes.data.treeLevels ?? [])].sort(
          (a, b) => a.level - b.level,
        )
        setConfig({
          ...cfgRes.data,
          pointRates: cfgRes.data.pointRates ?? [],
          treeLevels: sortedLevels,
        })
      }
      if (typeof factsRes?.data?.totalCount === "number") {
        setEcoFactsCount(factsRes.data.totalCount)
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Không tải được cấu hình gamification từ máy chủ.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!liveMode) return
    void loadConfig()
  }, [liveMode, loadConfig])

  const saveLiveConfig = async () => {
    if (!config) return
    setError("")
    setFlash("")
    if (!Number.isFinite(config.defaultPointsPerKg) || config.defaultPointsPerKg < 0) {
      setError("Điểm thưởng mặc định mỗi kg phải lớn hơn hoặc bằng 0.")
      return
    }
    if (
      !Number.isFinite(config.dailyNonTransactionCap) ||
      config.dailyNonTransactionCap < 0 ||
      !Number.isFinite(config.checkinBasePoints) ||
      config.checkinBasePoints < 0 ||
      !Number.isFinite(config.streakBonusIncrement) ||
      config.streakBonusIncrement < 0 ||
      !Number.isFinite(config.streakBonusCap) ||
      config.streakBonusCap < 0
    ) {
      setError("Giới hạn điểm mỗi ngày và điểm điểm danh không được âm.")
      return
    }
    if (
      !Number.isFinite(config.dailyTreeCareLimit) ||
      config.dailyTreeCareLimit < 1 ||
      !Number.isFinite(config.voucherValidityDays) ||
      config.voucherValidityDays < 1
    ) {
      setError("Giới hạn chăm sóc cây mỗi ngày và số ngày hiệu lực voucher phải từ 1 trở lên.")
      return
    }
    if (config.pointRates.some((r) => !Number.isFinite(r.pointsPerKg) || r.pointsPerKg < 0)) {
      setError("Tỷ lệ quy đổi điểm theo từng loại phế liệu phải lớn hơn hoặc bằng 0.")
      return
    }

    if (config.treeLevels.length === 0) {
      setError("Cần ít nhất 1 hạng cây ảo.")
      return
    }
    const normalizedLevels = config.treeLevels.map((lvl, idx) => ({
      level: idx + 1,
      title: lvl.title.trim(),
      requiredPoints: idx === 0 ? 0 : Math.max(0, Math.round(lvl.requiredPoints)),
    }))
    for (let i = 0; i < normalizedLevels.length; i += 1) {
      if (!normalizedLevels[i].title || normalizedLevels[i].title.length > 100) {
        setError(`Tên hạng cấp ${normalizedLevels[i].level} phải từ 1 đến 100 ký tự.`)
        return
      }
      if (i > 0 && normalizedLevels[i].requiredPoints <= normalizedLevels[i - 1].requiredPoints) {
        setError(
          `Điểm mốc của cấp ${normalizedLevels[i].level} (${normalizedLevels[i].title}) phải lớn hơn cấp ${normalizedLevels[i - 1].level}.`,
        )
        return
      }
    }

    setSaving(true)
    try {
      const payload: GamificationConfigDto = {
        ...config,
        defaultPointsPerKg: Math.max(0, Math.round(config.defaultPointsPerKg)),
        dailyNonTransactionCap: Math.max(0, Math.round(config.dailyNonTransactionCap)),
        checkinBasePoints: Math.max(0, Math.round(config.checkinBasePoints)),
        streakBonusIncrement: Math.max(0, Math.round(config.streakBonusIncrement)),
        streakBonusCap: Math.max(0, Math.round(config.streakBonusCap)),
        dailyTreeCareLimit: Math.max(1, Math.round(config.dailyTreeCareLimit)),
        voucherValidityDays: Math.max(1, Math.round(config.voucherValidityDays)),
        pointRates: config.pointRates.map((rate) => ({
          categoryCode: rate.categoryCode,
          pointsPerKg: Math.max(0, Math.round(rate.pointsPerKg)),
        })),
        treeLevels: normalizedLevels,
      }
      const res = await updateGamificationConfig(payload)
      if (res.data) {
        const sortedLevels = [...(res.data.treeLevels ?? [])].sort(
          (a, b) => a.level - b.level,
        )
        setConfig({
          ...res.data,
          pointRates: res.data.pointRates ?? [],
          treeLevels: sortedLevels,
        })
      }
      setConfirmReset(false)
      setFlash("Đã lưu toàn bộ cấu hình điểm, tỷ lệ quy đổi và mốc cây ảo.")
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể lưu cấu hình gamification.",
      )
    } finally {
      setSaving(false)
    }
  }

  const handleResetLive = async () => {
    setSaving(true)
    setError("")
    setFlash("")
    try {
      const res = await resetGamificationConfig()
      if (res.data) {
        const sortedLevels = [...(res.data.treeLevels ?? [])].sort(
          (a, b) => a.level - b.level,
        )
        setConfig({
          ...res.data,
          pointRates: res.data.pointRates ?? [],
          treeLevels: sortedLevels,
        })
      }
      setConfirmReset(false)
      setFlash("Đã khôi phục cấu hình gamification về giá trị mặc định.")
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể khôi phục cấu hình mặc định.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="CẤU HÌNH"
        title="Cấu hình điểm và hạng cây ảo"
        body="Điểm người dùng tích luỹ từ giao rác đúng phân loại và hoạt động xanh. Đổi hạng hoặc tỷ lệ điểm ở đây sẽ áp dụng cho toàn hệ thống."
        action={
          liveMode && config ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading || saving}
                onClick={() => void loadConfig()}
                className="btn-ghost h-10 px-4 text-sm"
              >
                Tải lại
              </button>
              {!confirmReset ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setConfirmReset(true)}
                  className="btn-ghost h-10 px-4 text-sm"
                >
                  Khôi phục mặc định
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleResetLive()}
                    className="btn-primary h-10 bg-bad px-4 text-sm hover:bg-bad/90"
                  >
                    Xác nhận khôi phục
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setConfirmReset(false)}
                    className="btn-ghost h-10 px-3 text-sm"
                  >
                    Huỷ
                  </button>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      {flash && (
        <p role="status" className="text-[13px] font-semibold text-brand">
          {flash}
        </p>
      )}
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}

      {liveMode ? (
        loading || !config ? (
          <div className="card px-5 py-10 text-center text-sm text-muted">
            {loading ? "Đang tải cấu hình gamification..." : "Không có dữ liệu cấu hình."}
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void saveLiveConfig()
            }}
            className="grid gap-6 lg:grid-cols-[1fr_1.4fr]"
          >
            {error && (
              <p
                role="alert"
                className="lg:col-span-2 rounded-xl border border-bad/25 bg-bad/5 px-4 py-3 text-[13px] font-semibold text-bad"
              >
                {error}
              </p>
            )}
            <div className="flex flex-col gap-5">
              <div className="card flex flex-col gap-4 p-5 md:p-6">
                <h2 className="text-base font-bold text-ink">Tham số tích điểm &amp; điểm danh</h2>

                <Field
                  label="Điểm mặc định mỗi kg bàn giao"
                  hint="Áp dụng khi loại phế liệu chưa có hệ số riêng."
                >
                  <input
                    className="input tabular-nums"
                    type="number"
                    min={0}
                    value={config.defaultPointsPerKg}
                    onChange={(e) =>
                      setConfig((c) =>
                        c ? { ...c, defaultPointsPerKg: Number(e.target.value) } : c,
                      )
                    }
                  />
                </Field>

                <Field
                  label="Trần điểm/ngày ngoài giao dịch"
                  hint="Giới hạn tổng điểm từ check-in và hoạt động phi giao dịch trong ngày."
                >
                  <input
                    className="input tabular-nums"
                    type="number"
                    min={0}
                    value={config.dailyNonTransactionCap}
                    onChange={(e) =>
                      setConfig((c) =>
                        c ? { ...c, dailyNonTransactionCap: Number(e.target.value) } : c,
                      )
                    }
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Điểm danh cơ bản" required>
                    <input
                      className="input tabular-nums"
                      type="number"
                      min={0}
                      value={config.checkinBasePoints}
                      onChange={(e) =>
                        setConfig((c) =>
                          c ? { ...c, checkinBasePoints: Number(e.target.value) } : c,
                        )
                      }
                    />
                  </Field>
                  <Field label="Thưởng chuỗi/ngày" required>
                    <input
                      className="input tabular-nums"
                      type="number"
                      min={0}
                      value={config.streakBonusIncrement}
                      onChange={(e) =>
                        setConfig((c) =>
                          c ? { ...c, streakBonusIncrement: Number(e.target.value) } : c,
                        )
                      }
                    />
                  </Field>
                  <Field label="Trần thưởng chuỗi" required>
                    <input
                      className="input tabular-nums"
                      type="number"
                      min={0}
                      value={config.streakBonusCap}
                      onChange={(e) =>
                        setConfig((c) =>
                          c ? { ...c, streakBonusCap: Number(e.target.value) } : c,
                        )
                      }
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Giới hạn tưới cây/ngày" required hint="Tối đa số lần chăm cây mỗi ngày.">
                    <input
                      className="input tabular-nums"
                      type="number"
                      min={1}
                      value={config.dailyTreeCareLimit}
                      onChange={(e) =>
                        setConfig((c) =>
                          c ? { ...c, dailyTreeCareLimit: Number(e.target.value) } : c,
                        )
                      }
                    />
                  </Field>
                  <Field label="Hạn dùng voucher (ngày)" required hint="Số ngày hiệu lực sau khi đổi quà.">
                    <input
                      className="input tabular-nums"
                      type="number"
                      min={1}
                      value={config.voucherValidityDays}
                      onChange={(e) =>
                        setConfig((c) =>
                          c ? { ...c, voucherValidityDays: Number(e.target.value) } : c,
                        )
                      }
                    />
                  </Field>
                </div>

                {config.pointRates.length > 0 && (
                  <div className="border-t border-line-soft pt-4">
                    <p className="text-sm font-semibold text-ink">
                      Hệ số điểm theo loại phế liệu (điểm/kg)
                    </p>
                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                      {config.pointRates.map((rate, idx) => (
                        <label
                          key={rate.categoryCode}
                          className="flex items-center justify-between gap-2 rounded-lg border border-line-soft px-3 py-2 text-xs"
                        >
                          <span className="font-semibold text-ink uppercase">
                            {rate.categoryCode}
                          </span>
                          <input
                            type="number"
                            min={0}
                            className="input h-8 w-24 tabular-nums"
                            value={rate.pointsPerKg}
                            onChange={(e) => {
                              const nextVal = Number(e.target.value)
                              setConfig((c) =>
                                c
                                  ? {
                                      ...c,
                                      pointRates: c.pointRates.map((r, rIdx) =>
                                        rIdx === idx ? { ...r, pointsPerKg: nextVal } : r,
                                      ),
                                    }
                                  : c,
                              )
                            }}
                            aria-label={`Điểm/kg cho ${rate.categoryCode}`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <button type="submit" disabled={saving} className="btn-primary h-11 px-6">
                  {saving ? "Đang lưu cấu hình..." : "Lưu cấu hình"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat
                  label="Hạng hiện có"
                  value={String(config.treeLevels.length)}
                  note={
                    config.treeLevels.length > 0
                      ? `Từ ${config.treeLevels[0].title} tới ${config.treeLevels[config.treeLevels.length - 1].title}`
                      : "Chưa có hạng"
                  }
                />
                <Stat
                  label="Eco Fact đang bật"
                  value={ecoFactsCount !== null ? String(ecoFactsCount) : "—"}
                  note="Mở khoá khi nâng cấp cây"
                />
                <Stat
                  label="Điểm cần cho hạng cao nhất"
                  value={
                    config.treeLevels.length > 0
                      ? config.treeLevels[config.treeLevels.length - 1].requiredPoints.toLocaleString(
                          "vi-VN",
                        )
                      : "0"
                  }
                  note="Điểm tăng trưởng cây ảo"
                />
              </div>

              <Table head={["Cấp", "Tên hạng cây", "Điểm mốc yêu cầu"]}>
                {config.treeLevels.map((t, i) => (
                  <tr key={t.level}>
                    <Td className="tabular-nums whitespace-nowrap font-semibold text-brand">
                      Cấp {t.level}
                    </Td>
                    <Td>
                      <input
                        className="input h-9 w-full min-w-[140px]"
                        type="text"
                        maxLength={100}
                        value={t.title}
                        onChange={(e) => {
                          const val = e.target.value
                          setConfig((c) =>
                            c
                              ? {
                                  ...c,
                                  treeLevels: c.treeLevels.map((x, n) =>
                                    n === i ? { ...x, title: val } : x,
                                  ),
                                }
                              : c,
                          )
                        }}
                        aria-label={`Tên hạng cấp ${t.level}`}
                      />
                    </Td>
                    <Td>
                      <input
                        className="input h-9 w-36 tabular-nums"
                        type="number"
                        min={0}
                        step={50}
                        value={i === 0 ? 0 : t.requiredPoints}
                        disabled={i === 0}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setConfig((c) =>
                            c
                              ? {
                                  ...c,
                                  treeLevels: c.treeLevels.map((x, n) =>
                                    n === i ? { ...x, requiredPoints: val } : x,
                                  ),
                                }
                              : c,
                          )
                        }}
                        aria-label={`Điểm tối thiểu của hạng ${t.title}`}
                      />
                    </Td>
                  </tr>
                ))}
              </Table>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={config.treeLevels.length >= 10}
                  onClick={() =>
                    setConfig((c) => {
                      if (!c || c.treeLevels.length >= 10) return c
                      const last = c.treeLevels[c.treeLevels.length - 1]
                      return {
                        ...c,
                        treeLevels: [
                          ...c.treeLevels,
                          {
                            level: c.treeLevels.length + 1,
                            title: `Hạng ${c.treeLevels.length + 1}`,
                            requiredPoints: (last?.requiredPoints ?? 0) + 500,
                          },
                        ],
                      }
                    })
                  }
                  className="btn-ghost h-11 px-5"
                >
                  Thêm hạng mới ({config.treeLevels.length}/10)
                </button>
                {config.treeLevels.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((c) =>
                        c && c.treeLevels.length > 1
                          ? { ...c, treeLevels: c.treeLevels.slice(0, -1) }
                          : c,
                      )
                    }
                    className="btn-ghost h-11 px-4 text-bad"
                  >
                    Xoá hạng cuối
                  </button>
                )}
                <button type="submit" disabled={saving} className="btn-primary h-11 px-6">
                  {saving ? "Đang lưu..." : "Lưu thay đổi hạng"}
                </button>
              </div>
            </div>
          </form>
        )
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              setFlash("Đã lưu cấu hình điểm.")
            }}
            className="card flex flex-col gap-5 p-5 md:p-6"
          >
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-bad/25 bg-bad/5 px-4 py-3 text-[13px] font-semibold text-bad"
              >
                {error}
              </p>
            )}
            <Field
              label="Điểm mỗi kg bàn giao đúng loại"
              hint="Tính trên khối lượng người dùng xác nhận, không phải khối lượng ước tính."
            >
              <input
                className="input tabular-nums"
                type="number"
                min={0}
                value={pointsPerKg}
                onChange={(e) => setPointsPerKg(Number(e.target.value))}
              />
            </Field>

            <Field label="Điểm thưởng khi gán nhãn AI đúng" required hint="Dành cho nhân viên vận hành.">
              <input
                className="input tabular-nums"
                type="number"
                min={0}
                value={labelBonus}
                onChange={(e) => setLabelBonus(Number(e.target.value))}
              />
            </Field>

            <button type="submit" className="btn-primary h-11 px-6">
              Lưu cấu hình
            </button>
          </form>

          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat
                label="Hạng hiện có"
                value={String(tiers.length)}
                note="Từ Mầm tới Đại dương"
              />
              <Stat
                label="Eco Fact đã gắn hạng"
                value={String(ECO_FACTS.length)}
                note="Mở khoá bằng điểm tiêu dùng"
              />
              <Stat
                label="Điểm cần cho hạng cao nhất"
                value={tiers[tiers.length - 1].min.toLocaleString("vi-VN")}
                note="Tích luỹ trọn đời"
              />
            </div>

            <Table head={["Hạng", "Điểm tối thiểu", "Chi phí mở Eco Fact"]}>
              {tiers.map((t, i) => (
                <tr key={t.name}>
                  <Td className="font-semibold text-ink">{t.name}</Td>
                  <Td>
                    <input
                      className="input h-9 w-32 tabular-nums"
                      type="number"
                      min={0}
                      step={1000}
                      value={t.min}
                      disabled={i === 0}
                      onChange={(e) =>
                        setTiers((ts) =>
                          ts.map((x, n) =>
                            n === i ? { ...x, min: Number(e.target.value) } : x,
                          ),
                        )
                      }
                      aria-label={`Điểm tối thiểu của hạng ${t.name}`}
                    />
                  </Td>
                  <Td>
                    <input
                      className="input h-9 w-32 tabular-nums"
                      type="number"
                      min={0}
                      step={100}
                      value={t.factCost}
                      onChange={(e) =>
                        setTiers((ts) =>
                          ts.map((x, n) =>
                            n === i ? { ...x, factCost: Number(e.target.value) } : x,
                          ),
                        )
                      }
                      aria-label={`Chi phí mở Eco Fact của hạng ${t.name}`}
                    />
                  </Td>
                </tr>
              ))}
            </Table>

            <button
              type="button"
              onClick={() =>
                setTiers((ts) => [
                  ...ts,
                  {
                    name: `Hạng ${ts.length + 1}`,
                    min: ts[ts.length - 1].min + 10_000,
                    factCost: 2_500,
                  },
                ])
              }
              className="btn-ghost h-11 w-fit px-5"
            >
              Thêm hạng mới
            </button>
          </div>
        </div>
      )}

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Điểm xếp hạng tích luỹ trọn đời và không bị trừ khi đổi quà; điểm tiêu
        dùng mới bị trừ. Tách hai loại là để người dùng dám đổi — nếu một con
        số vừa xếp hạng vừa là tiền thì đổi quà là tụt hạng, họ sẽ không đổi.
      </p>
    </div>
  )
}