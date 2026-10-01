/**
 * Render CÂY ROUTE THẬT, không render lẻ từng component.
 *
 *  `check.tsx` render từng page một — nó không bắt được lỗi ở phần ghép route:
 *  RequireRole, Portal, Layout, Outlet. Đây là chỗ mấy trang sau đăng nhập
 *  chết trắng mà `check.tsx` vẫn xanh.
 *
 *  localStorage được giả lập để có phiên đăng nhập: server-side không có
 *  localStorage nên nếu không giả thì RequireRole đá hết về /login và test
 *  thành vô nghĩa.
 */
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { AppRoutes } from "@/App"
import { getSession, signIn, signOut } from "@/lib/session"
import type { Role } from "@/lib/session"

// ponytail: localStorage chỉ cần 3 hàm. Stub tối thiểu thay vì kéo thêm
// jsdom vào devDependency cho một script kiểm.
const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

/** URL nào kiểm bằng vai trò nào — ở đây chỉ vào các route có RequireRole. */
const BY_ROLE: Record<Role, [string, string][]> = {
  user: [
    ["/me", "Xin chào"],
    ["/me/handover", "Yêu cầu thu gom rác"],
    ["/me/receipt", "Xác nhận bàn giao rác"],
    ["/me/payout", "Tài khoản nhận tiền"],
    ["/me/transactions", "Lịch sử tiền vào tài khoản"],
    ["/me/gamification", "Cây ảo của bạn"],
    ["/chat", "Tạo yêu cầu bàn giao"],
  ],
  recycler: [
    ["/recycler", "Trạng thái hoạt động"],
    ["/recycler/requests", "Tiếp nhận yêu cầu bàn giao"],
    ["/recycler/catalog", "Danh mục và bảng giá"],
    ["/recycler/receipt", "Tạo biên nhận thu gom"],
  ],
  staff: [
    ["/staff", "Việc đang chờ bạn xử lý"],
    ["/staff/ai-review", "Ảnh AI nhận diện sai"],
    ["/staff/dataset", "Tập dữ liệu kiểm chứng"],
    ["/staff/applications", "Thẩm định hồ sơ cơ sở thu mua"],
    ["/staff/complaints", "Khiếu nại giao dịch"],
    ["/staff/accounts", "Danh sách User và Buyer"],
    ["/staff/blog", "Soạn bài Blog"],
    ["/staff/ecofacts", "Quản lý Eco Fact"],
    ["/staff/gifts", "Quà tặng và voucher"],
    ["/staff/checkin", "Điểm danh hằng ngày"],
  ],
  admin: [
    ["/admin", "Dashboard và thống kê"],
    ["/admin/reports", "Xuất báo cáo dữ liệu"],
    ["/admin/staff", "Tài khoản nhân viên"],
    ["/admin/permissions", "Phân quyền nhân viên"],
    ["/admin/blog", "Duyệt bài Blog"],
    ["/admin/categories", "Danh mục rác hệ thống"],
    ["/admin/policy", "Chính sách phân loại rác"],
    ["/admin/gamification", "Cấu hình điểm và hạng cây ảo"],
    ["/admin/leaderboard", "Chu kỳ bảng xếp hạng"],
    ["/admin/fees", "Cấu hình phí giao dịch"],
    ["/admin/reconciliation", "Đối soát và dòng tiền"],
  ],
}

let failed = 0

for (const [role, cases] of Object.entries(BY_ROLE) as [Role, [string, string][]][]) {
  // signIn chứ không setItem trực tiếp: nó bỏ đệm của getSnapshot, đúng như
  // lúc chạy thật.
  signIn("Tài khoản thử", role)

  for (const [path, mustInclude] of cases) {
    try {
      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>,
      )
      const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()

      // trang bị chặn sai vai trò thì ra trang 404, vẫn có chữ — nên kiểm tra
      // thêm dấu hiệu của trang 404
      if (text.includes("LỖI 404")) throw new Error("bị chặn sai vai trò")
      if (text.length < 200) throw new Error(`rendered gần như rỗng (${text.length} ký tự)`)
      if (!text.includes(mustInclude)) throw new Error(`thiếu chữ: "${mustInclude}"`)

      console.log(`OK   ${role.padEnd(9)} ${path.padEnd(24)} ${html.length} bytes`)
    } catch (err) {
      failed++
      console.error(`FAIL ${role.padEnd(9)} ${path.padEnd(24)} ${(err as Error).message}`)
    }
  }
}

store.clear()

/**
 * Chốt chặn lỗi "Maximum update depth exceeded" — lỗi đã làm TRẮNG MỌI trang
 * khi đã đăng nhập, mà cả `check.tsx` lẫn phần render ở trên đều lọt: SSR chỉ
 * render một lần nên vòng lặp của `useSyncExternalStore` không xảy ra. Chỉ khi
 * đo được danh tính tham chiếu mới bắt được.
 *
 * `useSyncExternalStore` so `getSnapshot()` bằng `Object.is`. Trả object mới
 * mỗi lần gọi là vô hạn vòng render. Đây là bài học rút từ lần này: đổi
 * session từ chuỗi sang object mà không nhớ nguyên tắc này là trắng màn hình.
 */
function checkStableSnapshot() {
  // So HAI lần gọi liên tiếp, không ghi gì ở giữa. Nếu có ghi thì đệm bị bỏ và
  // so được là sai ý — chỗ cần kiểm là "đọc lại mà không có thay đổi thì phải
  // ra CÙNG một tham chiếu".
  const cases: [string, () => void][] = [
    ["đã đăng nhập", () => signIn("Nguyễn Đức", "user")],
    ["chưa đăng nhập", () => signOut()],
  ]

  for (const [label, setup] of cases) {
    setup()
    const a = getSession()
    const b = getSession()
    if (a !== b) {
      failed++
      console.error(
        `FAIL session     ${label.padEnd(24)} getSnapshot() trả object mới mỗi lần gọi ` +
          `-> useSyncExternalStore lặp vô hạn -> trang trắng`,
      )
      return
    }
    console.log(`OK   session     ${label.padEnd(24)} tham chiếu ổn định`)
  }
}

checkStableSnapshot()

console.log(failed === 0 ? "\nall routes render" : `\n${failed} route failed`)
process.exit(failed === 0 ? 0 : 1)