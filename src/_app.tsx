import React, { type PropsWithChildren } from 'react';
import { AppsInToss } from '@apps-in-toss/framework';
import { InitialProps } from '@granite-js/react-native';

import { context } from '../require.context';
import { TossUserIdProvider } from './hooks/useTossUserId';

/**
 * AppContainer — 전역 Provider 마운트 지점. baseline §A.8.
 *
 * TossUserIdProvider가 자식 화면 전체에 식별자(`getAnonymousKey()` hash)를 노출한다.
 * 보호 API 호출은 `useTossUserId()` 훅으로 hash를 받아 services/recipes.ts 함수에 전달한다.
 */
function AppContainer({ children }: PropsWithChildren<InitialProps>) {
  return <TossUserIdProvider>{children}</TossUserIdProvider>;
}

export default AppsInToss.registerApp(AppContainer, { context });
