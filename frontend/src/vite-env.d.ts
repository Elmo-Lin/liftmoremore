/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL including /api, e.g. http://localhost:8080/api. Unset = offline demo mode. */
  readonly VITE_API_URL?: string
  /** Google OAuth client ID (Web application); unset hides "Sign in with Google". */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
