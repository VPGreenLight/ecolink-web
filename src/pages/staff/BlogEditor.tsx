import { useState } from "react"
import { PageHead, Field, Status, Table, Td } from "@/components/Portal"
import { POSTS, type Post } from "@/data/ops"

/** S-08 Soạn thảo bài đăng Blog.
 *
 *  Bài của nhân viên luôn ở trạng thái "chờ duyệt" — không có đường xuất bản
 *  thẳng. Nếu để nhân viên tự xuất bản thì A-09 mất hết ý nghĩa, và người
 *  đọc tin giả là tin thật. */
export default function BlogEditor() {
  const [list, setList] = useState<Post[]>(POSTS)
  const [title, setTitle] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [flash, setFlash] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim().length < 10) {
      setFlash("Tiêu đề cần ít nhất 10 ký tự.")
      return
    }
    if (excerpt.trim().length < 30) {
      setFlash("Tóm tắt cần ít nhất 30 ký tự để người đọc biết bài nói gì.")
      return
    }
    const id = `BL-${String(list.length + 89).padStart(4, "0")}`
    setList((ls) => [
      {
        id,
        title: title.trim(),
        excerpt: excerpt.trim(),
        author: "Lê Thu Hà",
        date: "30/09/2026",
        status: "pending",
      },
      ...ls,
    ])
    setTitle("")
    setExcerpt("")
    setFlash(`Đã gửi ${id} sang Admin duyệt. Bài chưa hiện công khai cho tới khi duyệt.`)
  }

  const pending = list.filter((p) => p.status === "pending")
  const rest = list.filter((p) => p.status !== "pending")

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="NỘI DUNG"
        title="Soạn bài Blog"
        body="Viết bài rồi gửi Admin duyệt. Bài ở trạng thái chờ duyệt không hiện công khai, và sẽ tự xuất bản ngay khi được duyệt."
      />

      <form onSubmit={submit} noValidate className="card flex flex-col gap-5 p-5 md:p-6">
        <Field label="Tiêu đề">
          <input
            className="input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setFlash("")
            }}
            placeholder="Nêu rõ điều bài nói, không dùng tiêu đề chung chung"
          />
        </Field>

        <Field label="Tóm tắt" hint="Hai ba câu, hiện ở đầu bài và trong danh sách bài mới.">
          <textarea
            className="input h-auto resize-y py-3 leading-6"
            rows={3}
            value={excerpt}
            onChange={(e) => {
              setExcerpt(e.target.value)
              setFlash("")
            }}
            placeholder="Đọc phần tóm tắt là người đọc biết có nên mở bài hay không."
          />
        </Field>

        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
          <button type="submit" className="btn-primary h-11 px-6">
            Gửi Admin duyệt
          </button>
          {flash && (
            <p role="status" className="text-[13px] font-semibold text-brand">
              {flash}
            </p>
          )}
        </div>
      </form>

      <section>
        <h2 className="text-base font-bold text-ink">Chờ duyệt ({pending.length})</h2>
        <div className="mt-3">
          <Table head={["Mã", "Tiêu đề", "Tác giả", "Ngày", "Trạng thái"]}>
            {pending.map((p) => (
              <tr key={p.id}>
                <Td className="tabular-nums whitespace-nowrap">{p.id}</Td>
                <Td className="font-semibold text-ink">{p.title}</Td>
                <Td className="whitespace-nowrap">{p.author}</Td>
                <Td className="tabular-nums whitespace-nowrap">{p.date}</Td>
                <Td>
                  <Status tone="wait">Chờ duyệt</Status>
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </section>

      <section>
        <h2 className="text-base font-bold text-ink">Đã xử lý</h2>
        <div className="mt-3">
          <Table head={["Mã", "Tiêu đề", "Ngày", "Kết quả", "Lý do"]}>
            {rest.map((p) => (
              <tr key={p.id}>
                <Td className="tabular-nums whitespace-nowrap">{p.id}</Td>
                <Td className="font-semibold text-ink">{p.title}</Td>
                <Td className="tabular-nums whitespace-nowrap">{p.date}</Td>
                <Td>
                  <Status tone={p.status === "published" ? "ok" : "off"}>
                    {p.status === "published" ? "Đã xuất bản" : "Bị từ chối"}
                  </Status>
                </Td>
                <Td>{p.note ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        </div>
      </section>
    </div>
  )
}