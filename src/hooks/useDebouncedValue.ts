import { useEffect, useState } from "react"

/** Trì hoãn giá trị thay đổi liên tục (ví dụ từ ô tìm kiếm) trước khi gửi truy vấn API. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
