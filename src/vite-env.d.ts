/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHARED_LEARNING_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
