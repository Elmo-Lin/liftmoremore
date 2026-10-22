/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL including /api, e.g. http://localhost:8080/api. Unset = offline demo mode. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
