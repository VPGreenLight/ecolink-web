import { useCallback, useEffect, useState } from "react"
import { Award, Sparkles, Trees } from "lucide-react"
import { ApiError } from "@/lib/api"
import { PageHead, Field, Table, Td } from "@/components/admin/ui"
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
      setFlash("Đã lưu cấu hình điểm danh, chăm sóc cây ảo và mốc hạng.")
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
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHead
        eyebrow="CẤU HÌNH"
        title="Cấu hình điểm và hạng cây ảo"
        body="Cấu hình điểm danh hằng ngày, giới hạn chăm sóc cây ảo, thời hạn voucher và các mốc hạng cây ảo áp dụng cho toàn hệ thống."
        action={
          liveMode && config ? (
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <button
                type="button"
                disabled={loading || saving}
                onClick={() => void loadConfig()}
                className="btn-ghost h-10 w-full px-3.5 text-[13px] sm:w-auto sm:px-4 sm:text-sm"
              >
                Tải lại
              </button>
              {!confirmReset ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setConfirmReset(true)}
                  className="btn-ghost h-10 w-full px-3.5 text-[13px] sm:w-auto sm:px-4 sm:text-sm"
                >
                  Khôi phục mặc định
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleResetLive()}
                    className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-red-600 px-3.5 text-[13px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-red-700 sm:w-auto sm:px-4 sm:text-sm"
                  >
                    Xác nhận khôi phục
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setConfirmReset(false)}
                    className="btn-ghost col-span-2 h-10 w-full px-3 text-[13px] sm:col-span-1 sm:w-auto sm:text-sm"
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
        <p
          role="status"
          className="rounded-2xl border border-brand/25 bg-brand/5 px-4 py-3 text-[13px] font-semibold text-brand-deep"
        >
          {flash}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-warn/35 bg-warn/10 px-4 py-3 text-[13px] font-semibold text-warn"
        >
          {error}
        </p>
      )}

      {liveMode ? (
        loading || !config ? (
          <div className="flex flex-col gap-5" aria-hidden="true">
            <div className="h-44 animate-pulse rounded-3xl bg-surface-2 sm:h-28" />
            <div className="grid gap-6 xl:grid-cols-[minmax(380px,1.05fr)_1.35fr]">
              <div className="h-96 animate-pulse rounded-3xl bg-surface-2" />
              <div className="h-96 animate-pulse rounded-3xl bg-surface-2" />
            </div>
            <p className="text-center text-sm text-muted">
              {loading ? "Đang tải cấu hình gamification..." : "Không có dữ liệu cấu hình."}
            </p>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void saveLiveConfig()
            }}
            className="flex flex-col gap-5 sm:gap-6"
          >
            {/* Dải KPI Double-Bezel thống nhất: 3 hàng gọn trên Mobile, 3 cột có gạch chia trên Desktop */}
            <KpiStrip
              items={[
                {
                  icon: Trees,
                  label: "Hạng hiện có",
                  value: String(config.treeLevels.length),
                  note:
                    config.treeLevels.length > 0
                      ? `${config.treeLevels[0].title} → ${config.treeLevels[config.treeLevels.length - 1].title}`
                      : "Chưa có hạng",
                },
                {
                  icon: Sparkles,
                  label: "Eco Fact đang bật",
                  value: ecoFactsCount !== null ? String(ecoFactsCount) : "—",
                  note: "Mở khoá khi nâng cấp cây",
                },
                {
                  icon: Award,
                  label: "Điểm cần cho hạng cao nhất",
                  value:
                    config.treeLevels.length > 0
                      ? config.treeLevels[config.treeLevels.length - 1].requiredPoints.toLocaleString(
                          "vi-VN",
                        )
                      : "0",
                  note: "Điểm tăng trưởng cây ảo",
                },
              ]}
            />

            <div className="grid gap-6 xl:grid-cols-[minmax(380px,1.05fr)_1.35fr] xl:items-start">
              <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
                <section className="flex flex-col gap-4 rounded-2xl border border-line-soft bg-white p-4 shadow-[0_12px_32px_-14px_rgba(15,31,21,0.08)] sm:p-6">
                  <div className="border-b border-line-soft pb-3">
                    <h2 className="text-base font-bold tracking-tight text-ink">
                      Tham số tích điểm &amp; điểm danh
                    </h2>
                    <p className="mt-0.5 text-xs leading-5 text-muted">
                      Thiết lập điểm thưởng check-in theo chuỗi, giới hạn chăm cây và thời hạn voucher.
                    </p>
                  </div>

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

                  <div className="grid items-end gap-3.5 sm:grid-cols-2 sm:gap-4">
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
                  </div>

                  <div className="grid items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
                    <Field
                      label="Trần thưởng chuỗi"
                      required
                      hint="Điểm cộng thêm tối đa từ chuỗi điểm danh."
                    >
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
                    <Field
                      label="Giới hạn tưới cây/ngày"
                      required
                      hint="Tối đa số lần chăm cây mỗi ngày."
                    >
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
                  </div>

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

                  <p className="rounded-xl border border-line-soft bg-surface-2/60 px-3.5 py-2.5 text-xs leading-5 text-muted">
                    Công thức nhận điểm:{" "}
                    <strong className="tabular-nums text-ink">{config.checkinBasePoints} điểm</strong> cơ bản +{" "}
                    <strong className="tabular-nums text-ink">{config.streakBonusIncrement}/ngày</strong> chuỗi (tối đa{" "}
                    <strong className="tabular-nums text-brand-deep">
                      {config.checkinBasePoints + config.streakBonusCap} điểm/lần
                    </strong>
                    ).
                  </p>

                  <button type="submit" disabled={saving} className="btn-primary h-11 w-full px-6 sm:w-fit">
                    {saving ? "Đang lưu cấu hình..." : "Lưu cấu hình"}
                  </button>
                </section>
              </div>

              <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
                <section className="flex flex-col gap-4 rounded-2xl border border-line-soft bg-white p-4 shadow-[0_12px_32px_-14px_rgba(15,31,21,0.08)] sm:p-5">
                  <div className="flex items-start justify-between gap-2 border-b border-line-soft pb-3">
                    <div>
                      <h2 className="text-base font-bold tracking-tight text-ink">
                        Mốc hạng cây ảo
                      </h2>
                      <p className="mt-0.5 text-xs leading-5 text-muted">
                        Điểm xếp hạng của cấp sau phải cao hơn cấp trước. Cấp 1 luôn bắt đầu từ 0 điểm.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand-deep">
                      {config.treeLevels.length}/10 hạng
                    </span>
                  </div>

                  {/* Mobile cards: tối ưu cảm ứng và đầy đủ nhãn trên màn 360px+ */}
                  <ul className="flex flex-col gap-3 md:hidden">
                    {config.treeLevels.map((t, i) => (
                      <li
                        key={t.level}
                        className="flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface-2/40 p-3.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-brand-deep uppercase tabular-nums">
                            Cấp {t.level}
                          </span>
                          <span className="text-[11px] font-medium tabular-nums text-muted">
                            {i === 0 ? "Mốc khởi đầu · 0 điểm" : `${t.requiredPoints.toLocaleString("vi-VN")} điểm`}
                          </span>
                        </div>
                        <div className="grid gap-3">
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
                              Tên hạng cây
                            </span>
                            <input
                              className="input !min-h-11 h-11 w-full py-2 text-[15px]"
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
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
                              Điểm mốc yêu cầu
                            </span>
                            <input
                              className="input !min-h-11 h-11 w-full py-2 text-[15px] tabular-nums disabled:bg-surface-2 disabled:text-muted"
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
                          </label>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table head={["Cấp", "Tên hạng cây", "Điểm mốc yêu cầu"]}>
                      {config.treeLevels.map((t, i) => (
                        <tr key={t.level}>
                          <Td className="tabular-nums whitespace-nowrap font-semibold text-brand">
                            Cấp {t.level}
                          </Td>
                          <Td>
                            <input
                              className="input !min-h-10 h-10 w-full min-w-[140px] py-1.5"
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
                              className="input !min-h-10 h-10 w-36 py-1.5 tabular-nums disabled:bg-surface-2 disabled:text-muted"
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
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1 sm:flex sm:flex-wrap sm:items-center">
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
                      className={`btn-ghost h-11 px-4 text-[13px] sm:px-5 sm:text-sm ${
                        config.treeLevels.length > 1 ? "" : "col-span-2"
                      }`}
                    >
                      Thêm hạng ({config.treeLevels.length}/10)
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
                        className="inline-flex h-11 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 text-[13px] font-semibold whitespace-nowrap text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 sm:text-sm"
                      >
                        Xoá hạng cuối
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-primary col-span-2 h-11 w-full px-6 sm:ml-auto sm:w-auto"
                    >
                      {saving ? "Đang lưu..." : "Lưu thay đổi hạng"}
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </form>
        )
      ) : (
        <div className="flex flex-col gap-5 sm:gap-6">
          <KpiStrip
            items={[
              {
                icon: Trees,
                label: "Hạng hiện có",
                value: String(tiers.length),
                note: "Từ Mầm tới Đại dương",
              },
              {
                icon: Sparkles,
                label: "Eco Fact đã gắn hạng",
                value: String(ECO_FACTS.length),
                note: "Mở khoá bằng điểm tiêu dùng",
              },
              {
                icon: Award,
                label: "Điểm cần cho hạng cao nhất",
                value: tiers[tiers.length - 1].min.toLocaleString("vi-VN"),
                note: "Tích luỹ trọn đời",
              },
            ]}
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(360px,1fr)_1.4fr] xl:items-start">
            <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault()
                  setFlash("Đã lưu cấu hình điểm.")
                }}
                className="flex flex-col gap-5 rounded-2xl border border-line-soft bg-white p-4 shadow-[0_12px_32px_-14px_rgba(15,31,21,0.08)] sm:p-6"
              >
                <Field label="Điểm thưởng khi gán nhãn AI đúng" required hint="Dành cho nhân viên vận hành.">
                  <input
                    className="input tabular-nums"
                    type="number"
                    min={0}
                    value={labelBonus}
                    onChange={(e) => setLabelBonus(Number(e.target.value))}
                  />
                </Field>

                <button type="submit" className="btn-primary h-11 w-full px-6 sm:w-fit">
                  Lưu cấu hình
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
              <div className="flex flex-col gap-4 rounded-2xl border border-line-soft bg-white p-4 shadow-[0_12px_32px_-14px_rgba(15,31,21,0.08)] sm:p-5">
                <ul className="flex flex-col gap-3 md:hidden">
                  {tiers.map((t, i) => (
                    <li
                      key={t.name}
                      className="flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface-2/40 p-3.5"
                    >
                      <span className="text-sm font-bold text-ink">{t.name}</span>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
                            Điểm tối thiểu
                          </span>
                          <input
                            className="input !min-h-11 h-11 w-full py-2 text-[15px] tabular-nums"
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
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
                            Mở Eco Fact
                          </span>
                          <input
                            className="input !min-h-11 h-11 w-full py-2 text-[15px] tabular-nums"
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
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="hidden md:block">
                  <Table head={["Hạng", "Điểm tối thiểu", "Chi phí mở Eco Fact"]}>
                    {tiers.map((t, i) => (
                      <tr key={t.name}>
                        <Td className="font-semibold text-ink">{t.name}</Td>
                        <Td>
                          <input
                            className="input !min-h-10 h-10 w-32 py-1.5 tabular-nums"
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
                            className="input !min-h-10 h-10 w-32 py-1.5 tabular-nums"
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
                </div>

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
                  className="btn-ghost h-11 w-full px-5 sm:w-fit"
                >
                  Thêm hạng mới
                </button>
              </div>
            </div>
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

function KpiStrip({
  items,
}: {
  items: readonly {
    icon: typeof Trees
    label: string
    value: string
    note: string
  }[]
}) {
  return (
    <div className="rounded-3xl border border-line/80 bg-surface-2/50 p-1.5">
      <div className="grid divide-y divide-line-soft rounded-2xl border border-line-soft bg-white shadow-[0_12px_32px_-16px_rgba(15,31,21,0.1)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 px-4 py-3.5 sm:flex-col sm:items-stretch sm:justify-between sm:gap-3 sm:p-5"
            >
              <div className="flex min-w-0 items-center gap-3 sm:flex-row-reverse sm:justify-between sm:gap-2">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-deep sm:size-8"
                  aria-hidden="true"
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
                    {item.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted sm:hidden">{item.note}</p>
                </div>
              </div>
              <div className="shrink-0 text-right sm:text-left">
                <p className="text-2xl leading-none font-bold tracking-tight tabular-nums text-ink sm:text-[26px]">
                  {item.value}
                </p>
                <p className="mt-1.5 hidden truncate text-xs text-muted sm:block">{item.note}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}