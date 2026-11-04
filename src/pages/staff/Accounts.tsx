import { useState } from "react"
import { PageHead, Status, Table, Td } from "@/components/Portal"
import { ACCOUNTS, type Account } from "@/data/ops"

/** S-06 Xem danh sách & chi tiết User/Buyer · S-07 Khoá / xoá tài khoản.
 *
 *  Khoá là hành động đảo ngược được (mở khoá lại được), xoá thì không — nên
 *  UI tách rõ hai việc. Xoá chỉ cho tài khoản chưa từng có giao dịch: tài
 *  khoản đã có `deals` thì xoá là mất dữ liệu đối soát dòng tiền, phải khoá
 *  thôi. */
export default function Accounts() {
  const [list, setList] = useState<Account[]>(ACCOUNTS)
  const [role, setRole] = useState<"all" | "user" | "recycler">("all")
  const [q, setQ] = useState("")
  const [pick, setPick] = useState<Account | null>(null)
  const [flash, setFlash] = useState("")

  const view = list.filter((a) => {
    const k = q.trim().toLowerCase()
    const hitQ = !k || a.name.toLowerCase().includes(k) || a.email.includes(k) || a.id.includes(k)
    return hitQ && (role === "all" || a.role === role)
  })

  const lock = (id: string) =>
    setList((ls) =>
      ls.map((a) =>
        a.id === id ? { ...a, status: a.status === "locked" ? "active" : "locked" } : a,
      ),
    )

  const remove = (a: Account) => {
    if (a.deals > 0) {
      setFlash(
        `${a.name} đã có ${a.deals} giao dịch nên không xoá được — dữ liệu đối soát còn cần. Hãy khoá tài khoản.`,
      )
      return
    }
    if (!window.confirm(`Xoá ${a.name} (${a.id})? Không khôi phục được.`)) return
    setList((ls) => ls.filter((x) => x.id !== a.id))
    setPick(null)
    setFlash(`Đã xoá ${a.name}.`)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="TÀI KHOẢN"
        title="Danh sách User và Buyer"
        body="Xem tài khoản và sửa xử lý vi phạm. Tài khoản đã có giao dịch chỉ khoá được, không xoá — dữ liệu đối soát dòng tiền còn cần tới."
      />

      <div className="card flex flex-col gap-4 p-4 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-ink">
            Tìm tài khoản
            <input
              className="input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tên, email hoặc mã tài khoản"
            />
          </label>
        </div>
        <div className="flex gap-2">
          {(["all", "user", "recycler"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={`h-12 rounded-lg border px-4 text-[13px] font-semibold transition-colors ${
                role === r
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-body hover:bg-surface-2"
              }`}
            >
              {r === "all" ? "Tất cả" : r === "user" ? "Người dân" : "Cơ sở thu mua"}
            </button>
          ))}
        </div>
      </div>

      {flash && <p className="text-[13px] font-semibold text-warn">{flash}</p>}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Table head={["Mã", "Tên", "Vai trò", "Khu vực", "Giao dịch", "Trạng thái", ""]}>
          {view.map((a) => (
            <tr key={a.id}>
              <Td className="tabular-nums whitespace-nowrap">{a.id}</Td>
              <Td className="font-semibold text-ink">{a.name}</Td>
              <Td className="whitespace-nowrap">
                {a.role === "user" ? "Người dân" : "Cơ sở thu mua"}
              </Td>
              <Td className="whitespace-nowrap">{a.area}</Td>
              <Td className="tabular-nums">{a.deals}</Td>
              <Td>
                <Status tone={a.status === "active" ? "ok" : "off"}>
                  {a.status === "active" ? "Hoạt động" : "Đã khoá"}
                </Status>
              </Td>
              <Td>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPick(a)}
                    className="text-[13px] font-semibold text-brand hover:text-brand-deep"
                  >
                    Chi tiết
                  </button>
                  <button
                    type="button"
                    onClick={() => lock(a.id)}
                    className="text-[13px] font-semibold text-warn hover:underline"
                  >
                    {a.status === "active" ? "Khoá" : "Mở khoá"}
                  </button>
                </span>
              </Td>
            </tr>
          ))}
        </Table>

        <aside className="card flex flex-col gap-4 p-5">
          {!pick ? (
            <p className="text-sm text-muted">
              Chọn "Chi tiết" ở một dòng để xem đầy đủ và xử lý vi phạm.
            </p>
          ) : (
            <>
              <div>
                <p className="text-base font-bold text-ink">{pick.name}</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  {pick.id} · {pick.email}
                </p>
              </div>
              <dl className="flex flex-col gap-2 text-sm">
                {[
                  ["Vai trò", pick.role === "user" ? "Người dân" : "Cơ sở thu mua"],
                  ["Khu vực", pick.area],
                  ["Ngày tham gia", pick.joined],
                  ["Giao dịch hoàn tất", String(pick.deals)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-line-soft pb-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-semibold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
                <button
                  type="button"
                  onClick={() => lock(pick.id)}
                  className="btn-outline h-10 px-4 text-[13px]"
                >
                  {pick.status === "active" ? "Khoá tài khoản" : "Mở khoá"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(pick)}
                  className="btn-ghost h-10 px-4 text-[13px] text-warn"
                >
                  Xoá tài khoản
                </button>
              </div>
              <p className="text-[13px] leading-5 text-muted">
                {pick.deals > 0
                  ? `Tài khoản này có ${pick.deals} giao dịch nên không xoá được.`
                  : "Tài khoản chưa có giao dịch nên xoá được."}
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}