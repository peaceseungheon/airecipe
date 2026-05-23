import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';
import { env } from '@granite-js/plugin-env';

export default defineConfig({
  scheme: 'intoss',
  appName: 'airecipe-miniapp',

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
    }),
  ],
});
