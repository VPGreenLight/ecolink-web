import { useState } from "react"
import { PageHead, Status, Table, Td } from "@/components/admin/ui"
import { POSTS, type Post } from "@/data/ops"

/** A-09 Duyệt / hủy bài đăng Blog.
 *
 *  Hủy bài luôn bắt buộc có lý do: tác giả đã viết và chờ, họ cần biết sửa
 *  chỗ nào thay vì thấy bài biến mất. Cùng lý do với S-04 từ chối hồ sơ. */
export default function BlogReview() {
  const [list, setList] = useState<Post[]>(POSTS)
  const [flash, setFlash] = useState("")

  const decide = (id: string, ok: boolean) => {
    let note: string | undefined
    if (!ok) {
      const reason = window.prompt(`Hủy bài ${id}. Lý do (tác giả sẽ thấy lý do này):`)
      if (!reason?.trim()) return
      note = reason.trim()
    }
    setList((ls) =>
      ls.map((p) =>
        p.id === id
          ? { ...p, status: ok ? "published" : "rejected", note }
          : p,
      ),
    )
    setFlash(
      ok
        ? `${id} đã xuất bản, hiện công khai ngay.`
        : `${id} đã bị hủy với lý do "${note}".`,
    )
  }

  const pending = list.filter((p) => p.status === "pending")
  const done = list.filter((p) => p.status !== "pending")

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="DUYỆT NỘI DUNG"
        title="Duyệt bài Blog"
        body="Chỉ bài đã duyệt mới hiện công khai. Hủy bài thì phải nói lý do để tác giả sửa được, không biến mất im lặng."
      />

      {flash && (
        <p role="status" className="text-[13px] font-semibold text-brand">
          {flash}
        </p>
      )}

      <section>
        <h2 className="text-base font-bold text-ink">Chờ duyệt ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="card mt-3 px-5 py-8 text-center text-sm text-muted">
            Không có bài nào chờ duyệt.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {pending.map((p) => (
              <li key={p.id} className="card flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-brand">{p.id}</p>
                    <h2 className="text-base leading-6 font-bold text-ink">{p.title}</h2>
                  </div>
                  <Status tone="wait">Chờ duyệt</Status>
                </div>
                <p className="text-sm leading-6 text-body">{p.excerpt}</p>
                <p className="text-[13px] text-muted">
                  {p.author} · {p.date}
                </p>
                <div className="flex flex-wrap gap-3 border-t border-line-soft pt-4">
                  <button
                    type="button"
                    onClick={() => decide(p.id, true)}
                    className="btn-primary h-11 px-6"
                  >
                    Duyệt và xuất bản
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(p.id, false)}
                    className="btn-ghost h-11 px-5"
                  >
                    Hủy bài
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold text-ink">Đã xử lý</h2>
        <div className="mt-3">
          <Table head={["Mã", "Tiêu đề", "Tác giả", "Kết quả", "Lý do"]}>
            {done.map((p) => (
              <tr key={p.id}>
                <Td className="tabular-nums whitespace-nowrap">{p.id}</Td>
                <Td className="font-semibold text-ink">{p.title}</Td>
                <Td className="whitespace-nowrap">{p.author}</Td>
                <Td>
                  <Status tone={p.status === "published" ? "ok" : "off"}>
                    {p.status === "published" ? "Đã xuất bản" : "Đã hủy"}
                  </Status>
                </Td>
                <Td>{p.note ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        </div>
      </section>

      <p className="max-w-[70ch] text-sm leading-6 text-muted">
        Bài đã xuất bản xuất hiện ở trang Blog công khai. Hủy một bài đang chạy sẽ
        gỡ nó khỏi trang công khai ngay lập tức.
      </p>
    </div>
  )
}