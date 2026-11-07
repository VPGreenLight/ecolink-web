/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public API key của CARTO Basemaps (`https://carto.com/basemaps/apikey`) cho lớp nền bản đồ `/map`. */
  readonly VITE_CARTO_API_KEY?: string
  /** Đích chuyển tiếp Vite dev/preview proxy cho `/api` và `/hubs` (mặc định `http://localhost:5000`). */
  readonly VITE_API_PROXY_TARGET?: string
  /** URL gốc ghi đè cho HTTP client gọi Backend API (để trống để tự đi qua Vite proxy). */
  readonly VITE_API_BASE_URL?: string
  /** Google OAuth 2.0 Client ID cho Google Identity Services (`POST /api/v1/auth/google`). */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
