---
name: granite-rn-development
description: "앱인토스 RN 미니앱(airecipe-miniapp) 개발 가이드 — Granite 프레임워크 파일 라우팅(pages/), _app.tsx 컨테이너, granite.config.ts 설정, plugin-env로 빌드 시점 환경변수 주입, TDS React Native 컴포넌트 사용, Toss SDK(getAnonymousKey, 토스 토큰), SSE→fetch ReadableStream 소비, 빌드/배포 명령(granite dev/ait build/ait deploy)을 다룬다. Granite/RN/TDS 코드를 작성·수정하거나, 페이지·화면·훅을 추가하거나, 프로젝트 구조를 결정할 때 반드시 이 스킬을 사용할 것."
---

# Granite RN 미니앱 개발 가이드 (airecipe-miniapp)

`@apps-in-toss/framework@^2.6.0` + `@granite-js/react-native@1.0.28` + `react-native@0.84.0` + `@toss/tds-react-native` 기준. 일관된 구조와 경계면 안전성 확보.

## 프로젝트 구조

```
airecipe-miniapp/
├── pages/                    # Granite 파일 기반 라우팅
│   ├── index.tsx             # intoss://airecipe-miniapp
│   ├── _404.tsx              # 404 화면
│   └── (추가 화면들)
├── src/
│   ├── _app.tsx              # 앱 컨테이너 (Provider 부착)
│   ├── components/           # TDS 기반 재사용 컴포넌트
│   ├── hooks/                # useTossUserId, useRecipeGenerate 등
│   ├── services/             # api-client.ts (단일 호출 경로)
│   ├── lib/                  # zod 스키마, 유틸
│   ├── types/                # 백엔드와 공유 타입 (복사)
│   └── pages/                # (스캐폴딩 시 생성된 sub) — 메인은 루트 pages/ 사용
├── granite.config.ts         # 앱 설정 + plugin-env
├── require.context.ts        # Granite 라우터 컨텍스트
├── index.ts                  # 앱 진입점
└── .env.example              # 환경변수 템플릿
```

> 루트 `pages/`가 파일 기반 라우팅의 정식 진입점. `intoss://airecipe-miniapp/<path>` 형태로 자동 매핑.

## Granite 파일 기반 라우팅

```tsx
// pages/recipe/generate.tsx → intoss://airecipe-miniapp/recipe/generate
import { createRoute } from '@granite-js/react-native';
import { Text, View } from 'react-native';

export const Route = createRoute('/recipe/generate', {
  component: Page,
});

function Page() {
  const navigation = Route.useNavigation();

  const goToDetail = (id: string) => {
    navigation.navigate('/recipe/[id]', { id });
  };

  return (
    <View>
      <Text>레시피 생성</Text>
    </View>
  );
}
```

규칙:
- 파일 경로 = URL 경로. `pages/recipe/[id].tsx` → `intoss://airecipe-miniapp/recipe/{id}`.
- `_404.tsx`, `_app.tsx`는 특수 파일 — 라우트가 아님.
- 라우트 정의는 `createRoute('/path', { component })` 패턴. `useNavigation()`으로 네비게이션 핸들.

## `_app.tsx` 앱 컨테이너

```tsx
// src/_app.tsx
import { AppsInToss } from '@apps-in-toss/framework';
import { PropsWithChildren } from 'react';
import { InitialProps } from '@granite-js/react-native';
import { context } from '../require.context';

function AppContainer({ children }: PropsWithChildren<InitialProps>) {
  // 전역 Provider (Toss 인증 컨텍스트, Error Boundary, Theme 등)
  return <>{children}</>;
}

export default AppsInToss.registerApp(AppContainer, { context });
```

규칙:
- 전역 상태·Provider는 여기에. 화면별이 아니라 앱 전체에 필요한 것만.
- `AppsInToss.registerApp`이 SDK 초기화·이벤트 바인딩 수행.

## `granite.config.ts` 핵심 설정

본 미니앱의 정확한 설정은 `docs/appsintoss-port/09-ENV-CONFIG.md`가 SSOT. 핵심 패턴:

```ts
import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';
import { env } from '@granite-js/plugin-env';

export default defineConfig({
  scheme: 'intoss',                      // 항상 'intoss'
  appName: 'airecipe-miniapp',           // RFC-1123 (소문자·숫자·하이픈)
  plugins: [
    appsInToss({
      brand: {
        displayName: 'AI 레시피',         // 한글 표시명 (콘솔 등록명과 일치)
        primaryColor: '#FF6B35',
        icon: '',                         // 콘솔 업로드 후 URL로 교체
      },
      permissions: [],                    // 최소 권한
    }),
    env({
      API_BASE_URL: process.env.API_BASE_URL ?? 'http://localhost:3000',
      APP_ENV: process.env.APP_ENV ?? 'local',
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
    }),
  ],
});
```

## plugin-env로 환경변수 주입

빌드 시점에 `import.meta.env.*`로 인라인되는 변수들. 런타임 변경 불가.

```ts
// 어디서나 사용
const baseUrl = import.meta.env.API_BASE_URL;
const appEnv = import.meta.env.APP_ENV;

if (appEnv === 'production') {
  // 프로덕션 한정 동작
}
```

**금지 항목** (절대 미니앱에 두지 않음):
- `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, DB URL — 모두 백엔드 전용.

## TDS RN 사용

비게임 미니앱은 TDS 의무. `@toss/tds-react-native`(framework >= 1.0).

```tsx
import { Button, TextInput, Card } from '@toss/tds-react-native';

function RecipeForm() {
  return (
    <Card>
      <TextInput placeholder="요리 이름" />
      <Button onPress={handleSubmit}>레시피 생성</Button>
    </Card>
  );
}
```

규칙:
- 매핑 전에 AppsInToss MCP `search_tds_rn_docs`/`get_tds_rn_doc`로 컴포넌트 실재·시그니처 확인.
- TDS 토큰(색·간격·타이포)을 직접 픽셀 값보다 우선.
- 커스텀 컴포넌트는 TDS 위 컴포지션.

## Toss SDK — 식별자 발급

```ts
import { getAnonymousKey } from '@apps-in-toss/framework';

// SDK 2.4.5+ 기준
const key = await getAnonymousKey();
// hash 값을 X-Toss-User-Id 헤더로 백엔드에 전달
```

규칙:
- 캐싱은 `useTossUserId` 훅 한 곳에. SecureStore 또는 메모리.
- 401 응답 시 재발급 후 재시도 (api-client에서 처리).
- 평문 노출 금지 — UI·로깅에 포함하지 않는다.

## SSE → fetch ReadableStream

상세는 `docs/appsintoss-port/08-STREAMING.md` SSOT. 핵심 패턴:

```ts
const controller = new AbortController();

const response = await fetch(`${API_BASE_URL}/api/recipes/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'X-Toss-User-Id': tossUserId,
  },
  body: JSON.stringify({ dishName, servings }),
  signal: controller.signal,
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  // event: ... \n data: ... \n\n 단위로 파싱
  const lines = buffer.split('\n\n');
  buffer = lines.pop() ?? '';
  for (const block of lines) {
    const { eventName, data } = parseSseBlock(block);
    switch (eventName) {
      case 'meta':   /* ... */ break;
      case 'text':   /* 점진 표시 누적 */ break;
      case 'recipe': /* 최종 결과 */ break;
      case 'error':  /* 한국어 UI */ break;
      case 'done':   reader.cancel(); return;
    }
  }
}
```

규칙:
- 모든 fetch 호출은 api-client 단일 경로 통과. 화면이 직접 호출 금지.
- `AbortController`로 뒤로가기·취소 처리.
- 청크 타입 누락 시 분기 추가, 미정의 청크는 무시 + 경고 로그.

## 빌드 / 테스트 / 배포 명령

| 명령 | 용도 |
|------|------|
| `pnpm dev` / `pnpm dev:local` | 로컬 dev 서버 (Metro + Granite) |
| `pnpm dev:staging` | 스테이징 백엔드로 dev |
| `pnpm build:staging` | 스테이징 번들 (`*.ait`) |
| `pnpm build:prod` | 프로덕션 번들 |
| `pnpm typecheck` | TypeScript 검증 |
| `pnpm lint` | ESLint |
| `pnpm test` | Jest |
| `pnpm deploy` | 콘솔 업로드 (ait deploy) |

> `pnpm typecheck` 통과는 캐스팅/제네릭으로 우회된 불일치를 잡지 못한다. QA의 경계면 검증을 거친다.

## 샌드박스에서 테스트하기

1. 토스 샌드박스 앱 설치 (iOS 시뮬레이터 또는 Android emulator).
2. `pnpm dev:local` 실행.
3. 샌드박스 앱에서 `intoss://airecipe-miniapp` 입력 → "스키마 열기" → Metro 연결 자동.
4. 화면 상단에 `Bundling {n}%...` 표시 → 연결 성공.

Android 실기기: `adb reverse tcp:8081 tcp:8081 && adb reverse tcp:5173 tcp:5173`.
iOS 실기기: 같은 Wi-Fi + 로컬 IP 입력.

## 흔한 함정

- `granite.config.ts`의 `icon: null` → 일부 SDK 버전에서 "플러그인 옵션이 올바르지 않습니다" 에러. 미설정 시 `''`(빈 문자열)로.
- `_app.tsx`는 `src/`에, 라우트는 `pages/`에 — 위치 혼동 주의.
- `import.meta.env` 사용 시 빌드 시점 인라인이므로 런타임 변경 불가. 환경별 빌드 필요.
- TDS RN의 일부 컴포넌트는 토스 앱 버전 의존 — `isSupported()` 또는 SDK 가이드 확인.
