# 09. 환경 구성 — granite.config.ts·환경변수·도메인 화이트리스트

> **이 챕터 전에 알아야 할 것**: [00-OVERVIEW.md](./00-OVERVIEW.md), [ADR-009](../adr/ADR-009-appsintoss-port-architecture.md), [02-DATA-MODEL.md](./02-DATA-MODEL.md).
>
> **이 챕터 완료 후 다음 챕터**: [10-SPRINT-PLAN.md](./10-SPRINT-PLAN.md) — Phase 0~5 구현 순서.

---

## 9.0 개요

본 챕터는 신규 RN+Granite 미니앱의 **빌드/실행 환경 구성**을 정의한다:

- 환경변수 분리 (미니앱 vs 백엔드)
- `granite.config.ts` 예시 (RFC-1123 appName, 한글 displayName, icon, scheme)
- 도메인 화이트리스트 (백엔드 베이스 URL을 미니앱에서 어떻게 호출하는가)
- `plugin-env`로 빌드 시점 환경변수 주입

핵심 원칙:

- **API 키는 미니앱에 절대 두지 않는다** (Gemini/Claude/Anthropic·Supabase service role 모두 백엔드 환경변수). 미니앱은 백엔드 베이스 URL과 환경 구분 값(`staging`/`production`)만 안다.
- **백엔드 환경변수는 본 챕터의 범위 외**(Vercel 콘솔에서 관리, 현재 운영 그대로). 단, 미니앱 도입에 따라 추가/변경되는 항목은 본 챕터 9.3에 명시.

## 9.1 환경변수 분리 (미니앱 vs 백엔드)

### 9.1.1 미니앱(신규 RN 저장소) 환경변수 — `plugin-env`로 주입

| 변수 | 값 (예) | 용도 | 비공개? |
|------|---------|------|---------|
| `API_BASE_URL` | `https://aireceipe.example.com` | 백엔드 베이스 URL (현재 Vercel 배포) | 공개 가능 (URL은 비밀이 아님) |
| `APP_ENV` | `"production"` \| `"staging"` \| `"local"` | 환경 구분 | 공개 |
| `SENTRY_DSN` (선택) | `https://...@sentry.io/...` | 에러 트래킹 런타임 init (ADR-019). 미설정 또는 `APP_ENV=local`이면 init 스킵 | 공개 (DSN은 공개 키) |
| `LOG_LEVEL` (선택) | `"info"` \| `"debug"` | 로깅 레벨 | 공개 |

> **Sentry 소스맵 업로드(CI 전용, ADR-019)**: `SENTRY_AUTH_TOKEN`·`SENTRY_ORG`·`SENTRY_PROJECT`는 `@granite-js/plugin-sentry`가 **빌드 시점에만** 사용하며 **미니앱 번들에 인라인되지 않는다**. CI 시크릿으로만 주입하고, 토큰 부재 시 plugin은 no-op(로컬/기여자 빌드 안전). `SENTRY_AUTH_TOKEN`은 비공개 — 절대 `.env`·번들·콘솔 공개 값에 두지 않는다.

> **금지 항목**: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`(미니앱 경로 미사용), DB URL — 모두 미니앱에 두지 않는다. 미니앱이 알 필요가 없으며, 클라이언트 번들에 노출되면 즉시 키 침해다.

### 9.1.2 백엔드(현재 Next.js — Vercel) 환경변수 — 운영 변경 없음

ADR-008 등에서 정의된 변수 그대로 유지. 미니앱 도입에 따른 추가/변경 항목은 9.3.

| 변수 | 값 | 용도 |
|------|-----|------|
| `AI_PROVIDER` | `gemini` (기본) \| `claude` | Provider 선택 (ADR-008) |
| `GEMINI_API_KEY` | (Google 콘솔) | Gemini 호출 |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` (기본) | 모델 오버라이드 |
| `ANTHROPIC_API_KEY` | (Anthropic 콘솔) | Claude 롤백 |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` (기본) | 모델 오버라이드 |
| `NEXT_PUBLIC_SUPABASE_URL` | (Supabase 프로젝트) | Supabase 엔드포인트 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (Supabase) | 클라이언트 anon 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | (Supabase) | service role 클라이언트 (옵션 P 후속 ADR에서 사용) |

### 9.1.3 환경 분리 매트릭스

| 환경 | 미니앱 `API_BASE_URL` | 백엔드 배포 |
|------|-----------------------|------------|
| local | `http://10.0.2.2:3000` (Android emulator) / `http://localhost:3000` (iOS sim) | `npm run dev` |
| staging | `https://aireceipe-staging.vercel.app` | Vercel preview |
| production | `https://aireceipe.example.com` (확정 도메인) | Vercel production |

> 로컬 개발 시 Android 에뮬레이터에서 호스트의 localhost는 `10.0.2.2`로 매핑된다. iOS 시뮬레이터는 `localhost`. 실 기기 테스트는 ngrok 등 터널 사용 권장.

## 9.2 granite.config.ts 예시 (비게임 미니앱 기준)

비게임 미니앱 + Granite >= 1.0 + TDS 의무. RFC-1123 호환 appName(소문자·숫자·하이픈).

```ts
// granite.config.ts
import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';
import { env } from '@granite-js/plugin-env';

export default defineConfig({
  // 1. 앱 라우팅 스킴 — 앱인토스 규약상 항상 'intoss'
  scheme: 'intoss',

  // 2. RFC-1123 호환 appName — 콘솔에 등록한 앱 ID와 동일해야 함
  //    소문자, 숫자, 하이픈만. 시작/끝은 영숫자. 1~63자.
  //    ⚠️ 본 앱의 정본은 'airecipe'(콘솔 등록명). 'airecipe-miniapp'으로 바꾸지 말 것(ADR-017 D62 폐기).
  appName: 'airecipe',

  plugins: [
    appsInToss({
      // 3. 브랜드 정보 — 사용자에게 보이는 부분
      brand: {
        displayName: 'AI 레시피',              // 한글 표시명 (콘솔 등록명과 일치)
        primaryColor: '#FF6B35',               // 브랜드 기본 색(요리/식욕 톤 예시)
        icon: 'https://static.toss.im/icons/...', // 콘솔에서 업로드 후 URL 복사
      },

      // 4. 런타임 권한 — 레시피 앱은 최소 권한
      //    Sprint 1에서는 카메라/사진 불필요. 향후 사진 첨부 도입 시 추가.
      permissions: [],
    }),

    // 5. 빌드 시점 환경변수 주입 — import.meta.env로 접근
    //    실제 배포 시는 .env 파일과 결합하거나 CI에서 주입.
    env({
      API_BASE_URL: process.env.API_BASE_URL ?? 'http://localhost:3000',
      APP_ENV: process.env.APP_ENV ?? 'local',
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
    }),
  ],
});
```

### 9.2.1 appName 규칙 검증 (RFC-1123)

- 패턴: `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`
- 길이: 1~63자
- 금지: 대문자, 언더스코어, 시작/끝 하이픈, 점

예: `aireceipe` ✓, `ai-receipe` ✓, `AI-Receipe` ✗, `ai_receipe` ✗, `-aireceipe` ✗.

> 콘솔에 등록한 앱 ID와 정확히 일치해야 한다. 콘솔 등록명을 먼저 결정한 뒤 본 파일에 반영.

### 9.2.2 displayName

- 한글 가능. 띄어쓰기 가능. 사용자에게 직접 노출.
- 콘솔에 등록한 이름과 동일하게 입력.
- 권장: `AI 레시피` 또는 `AIReceipe` (브랜딩 확정값을 따른다).

### 9.2.3 icon

- 콘솔에서 업로드한 이미지의 URL을 입력.
- 4x 해상도 권장 (Toss 표준 — 예: `https://static.toss.im/icons/png/4x/icon-*.png` 패턴).
- 미설정 시 콘솔 검수 반려 가능.

### 9.2.4 webViewProps / 카테고리 — 비게임

본 미니앱은 비게임 카테고리다. RN(Granite)은 `appsInToss` 플러그인이 비게임 기본을 제공한다. 만약 WebView 모드로 운영한다면 `webViewProps.type = 'partner'`로 설정해야 한다(본 포팅은 RN 모드).

## 9.3 도메인 화이트리스트 (미니앱 → 백엔드 호출)

미니앱은 백엔드의 절대 URL(`https://aireceipe.example.com/api/recipes/...`)로 HTTPS 호출한다. 다음을 점검한다:

### 9.3.1 백엔드 CORS 설정 (SSOT는 03-API-CONTRACT §3.1.4)

> **SSOT 위임**: CORS 헤더 값의 단일 진실은 [03-API-CONTRACT §3.1.4](./03-API-CONTRACT.md) 표 + [05-AUTH §5.5](./05-AUTH.md)다. 본 절은 미니앱 측에서 알아야 할 요약만 인용하며, 값이 다르면 03/05가 우선이다.

미니앱은 외부 도메인(앱인토스 WebView 또는 RN의 fetch origin)에서 백엔드를 호출한다. 백엔드 응답에 다음 헤더가 필요(03 §3.1.4 표·05 §5.5.4와 동일 값):

```
Access-Control-Allow-Origin: <미니앱 origin>
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Toss-User-Id, Accept
Access-Control-Allow-Credentials: false  (쿠키는 미니앱 경로에서 미사용)
Access-Control-Max-Age: 600
```

> `Accept` 헤더 포함 이유: 08-STREAMING의 SSE 호출이 `Accept: text/event-stream`을 송출하므로 화이트리스트에서 빠지면 RN preflight 차단.
>
> `Max-Age: 600`(10분): 보수적 preflight 캐시. 운영 정책 변경 시 캐시 잔류 시간을 짧게 유지.

권장: **명시적 화이트리스트** (와일드카드 `*` 금지). 토스 앱 내 WebView origin과 RN의 origin은 backend 합의 후 03-API-CONTRACT.md에 명시.

### 9.3.2 미니앱 측 호출 코드 (예)

```ts
// src/services/api-client.ts (미니앱 신규 저장소)

const API_BASE_URL = import.meta.env.API_BASE_URL;

export async function apiFetch(path: string, init?: RequestInit & { tossUserId?: string }) {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...init?.headers as Record<string, string>,
  };
  if (init?.tossUserId) {
    headers['X-Toss-User-Id'] = init.tossUserId;
  }
  return fetch(url, { ...init, headers });
}
```

> 헤더 이름·값 규칙은 [05-AUTH.md](./05-AUTH.md)에서 backend가 확정.

### 9.3.3 앱인토스 도메인 정책

앱인토스 미니앱은 외부 HTTPS 호출에 대한 별도 허용 도메인 등록이 콘솔에서 필요할 수 있다(서비스 정책 — `intro/guide.md` 및 콘솔 가이드 확인). 출시 검수 전:

- [ ] 백엔드 도메인을 콘솔의 외부 도메인 허용 목록에 등록.
- [ ] HTTPS 전용 (HTTP는 거부됨).
- [ ] 인증서 유효성 확인.

## 9.4 plugin-env 사용 패턴

`plugin-env`는 빌드 시점 주입이며 런타임 변경 불가. 다음 패턴 권장:

### 9.4.1 환경별 빌드

```bash
# package.json scripts (예시)
"scripts": {
  "dev:local":      "APP_ENV=local      API_BASE_URL=http://localhost:3000 granite dev",
  "dev:staging":    "APP_ENV=staging    API_BASE_URL=https://aireceipe-staging.vercel.app granite dev",
  "build:staging":  "APP_ENV=staging    API_BASE_URL=https://aireceipe-staging.vercel.app granite build",
  "build:prod":     "APP_ENV=production API_BASE_URL=https://aireceipe.example.com granite build"
}
```

또는 `.env.local`, `.env.staging`, `.env.production`을 두고 CI에서 환경에 맞는 파일을 선택.

### 9.4.2 import.meta.env 접근

```ts
// 어디서나
const baseUrl = import.meta.env.API_BASE_URL;
const appEnv  = import.meta.env.APP_ENV;

if (appEnv === 'production') {
  // 프로덕션 한정 동작
}
```

> 빌드 시점에 문자열로 인라인된다. 런타임에 `process.env` 또는 OS 환경변수 접근은 불가(RN 빌드 환경 차이).

## 9.5 보안 체크리스트

- [ ] 미니앱 번들에 AI Provider API 키·Supabase service role 키 **포함 안 됨** 확인 (빌드 산출물 grep).
- [ ] `API_BASE_URL`은 HTTPS만 (production/staging). HTTP는 local 한정.
- [ ] CORS 화이트리스트가 와일드카드 아님.
- [ ] `X-Toss-User-Id` 헤더 값은 `getAnonymousKey()` 반환 hash. UI 노출 금지.
- [x] Sentry PII 차단 (ADR-019 D68) — `sendDefaultPii: false` + `enableLogs: false`로 IP/쿠키/유저·자유 텍스트 자동 수집 차단. `enableNative: false`(미니앱 네이티브 Sentry 미탑재). `SENTRY_AUTH_TOKEN`은 CI 시크릿(번들 미포함).
- [ ] `permissions: []` — 본 Sprint는 추가 권한 불필요. 추가 시 검수 가이드 준수.

## 9.6 출시 정책 점검 (앱인토스 검수)

### 9.6.1 코드 측 통과 항목 (Phase 5 본 차 — ADR-015)

- [x] **비게임 출시 가이드** 준수 (`checklist/app-nongame.md`) — 디지털 자산/도박/자금세탁 미해당 (레시피 콘텐츠).
- [x] **TDS 의무** — `@toss/tds-react-native` 사용 (raw `<Text/>` 0건, hex 직접 사용 0건 — ADR-015 D39 토큰화 완료).
- [x] **AI 면책 문구** — `src/components/NutritionPanel.tsx` 하단 fixed 1줄 ("AI가 생성한 참고용 정보예요. 의료·영양 자문이 아닙니다.") — ADR-015 D40.
- [x] **권한 최소화** — `granite.config.ts`의 `permissions: []`.
- [x] **에러 처리 한국어 UI** — 5개 훅 매핑 일관 (ADR-015 D41).
- [x] **금지 환경변수 부재** — API 키·DB URL grep 0건 (§9.1.1).

### 9.6.2 외부 작업 PENDING (ADR-015 D43)

- [ ] **번들 100MB 이하** (압축 해제 기준) — `granite build` 산출물 측정 필요.
- [ ] **콘솔 등록**: appName(앱 ID), displayName, 아이콘 URL(`granite.config.ts` `brand.icon` 채움), 카테고리(비게임), 도메인 화이트리스트, 고객센터·홈페이지 링크.
- [ ] **CORS·도메인 화이트리스트** 백엔드 측 적용 (03-API-CONTRACT §3.1.4 SSOT — 별 저장소 `AIReceipe`).
- [ ] **백엔드 옵션 P 배포** — 별 저장소 `AIReceipe`.
- [ ] **실 디바이스 e2e** — staging 배포 후 6기능 무결성.
- [ ] **콘솔 검토 요청 제출** → 반려 사유 응답 대기.

## 9.7 SSOT 참조

- 본 챕터 SSOT (granite.config.ts 패턴): AppsInToss 공식 `bedrock/reference/framework/UI/Config.md`, `bedrock/reference/framework/환경/`(plugin-env)
- 환경변수 정책: ADR-008 (백엔드), 본 챕터 (미니앱)
- CORS 결정: backend 03-API-CONTRACT.md에서 확정
- 출시 정책: `checklist/app-nongame.md`, `intro/guide.md`
