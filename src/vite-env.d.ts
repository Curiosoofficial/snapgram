/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPWRITE_URL?: string;
  readonly VITE_APPWRITE_PROJECT_ID?: string;
  readonly VITE_APPWRITE_DATABASE_ID?: string;
  readonly VITE_APPWRITE_STORAGE_ID?: string;
  readonly VITE_APPWRITE_USER_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_POST_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_SAVES_COLLECTION_ID?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// replaced by vite.config.ts at build time ("api" | "appwrite" | "demo")
declare const __SNAPGRAM_BACKEND__: "api" | "appwrite" | "demo";
