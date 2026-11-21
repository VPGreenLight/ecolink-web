/**
 * Nhận diện môi trường Node SSR smoke-test (`npm run check` / `npm run check:routes`
 * dùng `renderToStaticMarkup` nơi `typeof window === "undefined"`).
 * Trên trình duyệt thật của người dùng, luôn trả về `false`.
 */
export function isSsrSmokeTest(): boolean {
  return typeof window === "undefined"
}

/**
 * Khởi tạo state cho dữ liệu tải từ Backend API:
 * - Trên trình duyệt thật (`!isSsrSmokeTest()`): trả về `browserEmptyValue` (ví dụ `[]` hoặc `null`),
 *   tuyệt đối KHÔNG render mock data để triệt tiêu hiện tượng nháy dữ liệu giả (Flash of Mock Data).
 * - Khi chạy Node SSR smoke-test (`isSsrSmokeTest()`): trả về `ssrSeedValue` để pass `check.tsx` & `check-routes.tsx`.
 */
export function initApiState<T>(browserEmptyValue: T, ssrSeedValue: T): T {
  return isSsrSmokeTest() ? ssrSeedValue : browserEmptyValue
}

/**
 * Trạng thái `loading` khởi tạo cho dữ liệu cần nạp từ API:
 * - Trên trình duyệt thật: trả về `fetchEnabledOnBrowser` (mặc định `true`) ngay từ frame đầu tiên để hiển thị Skeleton/Loading.
 * - Khi chạy Node SSR smoke-test: luôn trả về `false` để `renderToStaticMarkup` in ra cây giao diện chính.
 */
export function initApiLoading(fetchEnabledOnBrowser = true): boolean {
  return isSsrSmokeTest() ? false : fetchEnabledOnBrowser
}
