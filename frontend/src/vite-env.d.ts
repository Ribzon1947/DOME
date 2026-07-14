/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KIOSK_INACTIVITY_SECONDS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
