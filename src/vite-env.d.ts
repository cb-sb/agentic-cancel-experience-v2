/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LAYOUT?: 'v5' | 'threads' | 'tabs' | 'v7' | 'v8' | 'v9'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
