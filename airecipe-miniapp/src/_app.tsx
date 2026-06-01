import React, { type PropsWithChildren } from 'react';
import { AppsInToss } from '@apps-in-toss/framework';
import { InitialProps } from '@granite-js/react-native';

import { context } from '../require.context';
import { RecipeCacheProvider } from './hooks/useRecipeCache';
import { TossUserIdProvider } from './hooks/useTossUserId';

import * as Sentry from '@sentry/react-native';

/**
 * AppContainer — 전역 Provider 마운트 지점.
 *
 * Phase 1 §A.8: TossUserIdProvider가 자식 화면 전체에 식별자(`getAnonymousKey()` hash)를 노출.
 * Phase 3 §D.4: RecipeCacheProvider가 마이 레시피 목록 캐시 무효화 트리거를 노출.
 *   TossUserIdProvider 안쪽에 마운트 — 식별자가 있어야 캐시도 의미. 외부 의존 0.
 */
function AppContainer({ children }: PropsWithChildren<InitialProps>) {
  return (
    <TossUserIdProvider>
      <RecipeCacheProvider>{children}</RecipeCacheProvider>
    </TossUserIdProvider>
  );
}

const SENTRY_DSN = import.meta.env.SENTRY_DSN;

if (SENTRY_DSN && import.meta.env.APP_ENV !== 'local') {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.APP_ENV,
    sendDefaultPii: false,
    enableLogs: false,
    enableNative: false,
  });
}

const app = Sentry.wrap(AppContainer);

export default AppsInToss.registerApp(app, { context });
