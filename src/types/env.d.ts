/**
 * Granite plugin-env가 빌드 시점에 인라인하는 import.meta.env 타입 선언.
 * SSOT: 09-ENV-CONFIG §9.4.2 + granite.config.ts.
 */

interface ImportMetaEnv {
  readonly API_BASE_URL: string;
  readonly APP_ENV: 'local' | 'staging' | 'production';
  readonly LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
