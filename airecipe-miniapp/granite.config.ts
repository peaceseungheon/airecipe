import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';
import { env } from '@granite-js/plugin-env';

export default defineConfig({
  scheme: 'intoss',
  appName: 'airecipe',

  plugins: [
    appsInToss({
      brand: {
        displayName: 'AI 레시피',
        primaryColor: '#FF6B35',
        icon: '',
      },
      permissions: [],
    }),

    env({
      API_BASE_URL: process.env.API_BASE_URL ?? 'http://localhost:3000',
      APP_ENV: process.env.APP_ENV ?? 'local',
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
      // Phase 4.5 — 토스 광고 SDK (ADR-014 D28·E)
      ADS_ENABLED: process.env.ADS_ENABLED ?? 'false',
      ADS_INLINE_GROUP_ID: process.env.ADS_INLINE_GROUP_ID ?? '',
      ADS_FULLSCREEN_GROUP_ID: process.env.ADS_FULLSCREEN_GROUP_ID ?? '',
    }),
  ],
});
