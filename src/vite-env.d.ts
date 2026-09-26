/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LAYOUT?: 'v5' | 'threads' | 'tabs'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
