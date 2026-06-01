/**
 * Granite plugin-env가 빌드 시점에 인라인하는 import.meta.env 타입 선언.
 * SSOT: 09-ENV-CONFIG §9.4.2 + granite.config.ts.
 */

interface ImportMetaEnv {
  readonly API_BASE_URL: string;
  readonly APP_ENV: 'local' | 'staging' | 'production';
  readonly LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  /** ADR-019 — Sentry DSN(공개 키). 미설정 시 빈 문자열 → init 스킵. */
  readonly SENTRY_DSN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
