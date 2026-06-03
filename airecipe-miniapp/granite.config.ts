import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';
import { env } from '@granite-js/plugin-env';
import { sentry } from '@granite-js/plugin-sentry';

const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN ?? '';

export default defineConfig({
  scheme: 'intoss',
  appName: 'airecipe',

  plugins: [
    appsInToss({
      brand: {
        displayName: 'AI 레시피',
        primaryColor: '#FF6B35',
        icon: 'https://pub-af1aa7fb010c4b21b82d84a9e7a97ab8.r2.dev/images/airecipe%E1%84%85%E1%85%A9%E1%84%80%E1%85%A9.png',
      },
      permissions: [],
    }),

    env({
      API_BASE_URL: process.env.API_BASE_URL ?? 'http://localhost:3000',
      APP_ENV: process.env.APP_ENV ?? 'local',
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
      // ADR-019 — Sentry DSN (런타임 init용, 공개 키). 미설정 시 빈 문자열 → init 스킵.
      SENTRY_DSN: process.env.SENTRY_DSN ?? '',
      // Phase 4.5 — 토스 광고 SDK (ADR-014 D28·E)
      ADS_ENABLED: process.env.ADS_ENABLED ?? 'false',
      ADS_INLINE_GROUP_ID: process.env.ADS_INLINE_GROUP_ID ?? '',
      ADS_FULLSCREEN_GROUP_ID: process.env.ADS_FULLSCREEN_GROUP_ID ?? '',
    }),

    sentry({
      enabled: SENTRY_AUTH_TOKEN !== '',
      authToken: SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    }),
  ],
});
