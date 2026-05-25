# 0009. 앱인토스 미니앱 포팅 — 백엔드 분리·Toss 인증 전환·Sprint 1 전 범위 포팅

- 상태: 채택됨
- 날짜: 2026-05-22
- 적용 대상: 신규 React Native + Granite 미니앱 프로젝트 (별 저장소)
- 현재 Next.js 코드: **변경하지 않음** (기존 ADR-001~008 그대로 유지)

---

## 맥락

세션 #1~#3을 거쳐 현재 AIReceipe(Next.js + TypeScript)는 Sprint 1 6기능을 완성했다 — 레시피 생성·영양 분석·저장·목록·즐겨찾기·삭제. 사용자는 이를 토스 플랫폼 내 미니앱(앱인토스)으로 별도 신규 개발하여 출시하고자 한다.

요구되는 결정:

1. **신규 미니앱이 백엔드를 새로 만들 것인가, 현재 Next.js 백엔드를 그대로 호출할 것인가?**
2. **인증을 어떻게 처리할 것인가?** 현재는 Supabase Auth(이메일+패스워드) 기반이지만 앱인토스에는 자체 사용자 식별 메커니즘이 있다.
3. **MVP 범위는?** Sprint 1 6기능 일부만 포팅인가, 전체인가?
4. **현재 코드와의 관계는?** 단일 코드베이스 통합인가, 분리 운영인가?

제약:

- 미니앱은 Granite >= 1.0(React Native) + TDS(`@toss/tds-react-native`) 필수 — 비게임 미니앱은 TDS 의무.
- 앱인토스 사용자 식별은 **비게임 한정 `getAnonymousKey`**(미니앱별 고유 hash, SDK 2.4.5+) 또는 별도 Toss 로그인. 본인확인(`tosscertRequest`)은 실명·생년월일·전화번호 검증용 — 레시피 앱에는 과잉.
- 현재 백엔드는 안정화된 SSOT 자산이 다수다: API 계약·zod 스키마·AI Adapter+Factory·RLS·Mapper.
- 사용자 명시 결정(세션 #4 입력): "백엔드는 그대로 두고 호출만, Supabase Auth 제거, Toss 식별자 사용, Sprint 1 전 기능."

## 결정

### D1. 백엔드는 현재 Next.js API를 Vercel에 배포·유지하고 미니앱은 HTTPS만 호출

- 현재 `src/app/api/recipes/**/route.ts` 6개 엔드포인트와 `_workspace/01_architect_api_contract.md`(SSOT)는 **그대로 운영**한다.
- 신규 RN 미니앱은 새 저장소에서 시작하며 백엔드 코드 없이 **클라이언트 전용**으로 빌드한다.
- API 호출은 환경변수 `EXPO_PUBLIC_API_BASE_URL` 또는 Granite `plugin-env`로 주입되는 백엔드 base URL을 통한 HTTPS 호출.

### D2. 인증을 Toss 식별자로 전환하고 미니앱에서 Supabase Auth는 제거

- 미니앱 측: **`getAnonymousKey()`**(`@apps-in-toss/web-framework`)로 미니앱별 고유 hash를 받아 이를 사용자 식별자로 사용한다.
  - 비게임 미니앱 SDK 표준이며 별도 인증 화면 없이 즉시 식별자 확보.
  - 레시피 앱은 실명·생년월일·전화번호가 불필요 → 토스 인증(`tosscertRequest`)을 도입하지 않는다.
- 백엔드 측: 미니앱 → 백엔드 요청은 `X-Toss-User-Id: <hash>` 헤더를 동반한다. 백엔드는 헤더에서 식별자를 추출해 소유자 격리에 사용한다.
- 회원가입/로그인 폼·`AuthForm` 컴포넌트·`useAuth` 훅·`/auth/login`·`/auth/signup` 페이지는 **미니앱에서 미구현**한다.
- 현재 Next.js 웹의 Supabase Auth 흐름·페이지·proxy는 **그대로 유지**(웹 사용자는 기존 방식 유지).

### D3. Sprint 1 6기능 전 범위를 v1으로 포팅

- 기능 a) 레시피 생성 (요리명 → AI 스트리밍 생성)
- 기능 b) 영양 정보 분석 (a의 응답 일부, 별도 API 아님)
- 기능 c) 레시피 저장
- 기능 d) 마이 레시피 목록 조회
- 기능 e) 즐겨찾기 토글
- 기능 f) 레시피 삭제

부분 포팅을 하지 않는 이유: 6기능이 단일 사용자 흐름(생성 → 저장 → 목록 → 즐겨찾기/삭제)으로 연결되어 있고, API 자산이 이미 완비되어 있어 분할 이득이 작다.

### D4. 현재 코드는 일절 수정하지 않는다 (분리 운영)

- 신규 미니앱은 별 저장소·별 빌드 파이프라인.
- 백엔드는 Vercel에서 단일 배포(현재 웹 + 미니앱 양쪽이 동일 API 사용).
- 추후 발견되는 백엔드 변경 필요사항은 별도 ADR/세션으로 처리 — 본 포팅 작업의 산출물은 **문서**만이다 (코드 변경 없음).

### D5. 채택한 사용자 식별 옵션은 **옵션 P**(profiles 매핑 테이블)

DATA-MODEL(02장)에서 두 옵션을 비교한 결과:

- 옵션 P: `profiles(toss_user_id text PK, internal_user_id uuid)` 매핑 테이블 추가. `recipes.user_id`는 기존 uuid 유지.
- 옵션 Q: `recipes.user_id` 컬럼 타입을 text(Toss userId)로 마이그레이션.

**옵션 P를 채택**한다. 이유:

- 현재 ADR-001의 RLS 정책(`auth.uid() = user_id`)·`recipes_user_id_idx`·외래키 제약(`references auth.users(id)`)·Mapper 표·Sprint 1의 모든 SSOT가 uuid 가정에 기반한다. 옵션 Q는 전체를 무너뜨린다.
- 옵션 P는 추가만 한다: 매핑 테이블 + 백엔드의 식별자 변환 레이어. 기존 ADR-001/005는 그대로 살아남는다.
- 웹/미니앱 사용자가 향후 통합되더라도 매핑 테이블이 그 다리 역할을 한다.

> 트레이드오프: 신규 사용자 첫 호출 시 매핑 행을 자동 upsert해야 한다. 백엔드 미들웨어 한 곳에서 처리(03-API-CONTRACT/05-AUTH 챕터 참조).

## 근거

- **현재 자산 보존(ADR-001/002/005/008)**: 백엔드를 분리해 호출만 하면 RLS·Mapper·AI Adapter+Factory·소유권 404 수렴 정책이 그대로 살아남는다. 자산 폐기 비용을 0으로 만든다.
- **출시 정책 부합**: 비게임 미니앱 표준 식별 API(`getAnonymousKey`)는 사용자 동의·인증 화면 없이 동작하므로 UX 단순화. 본인확인이 불필요한 도메인(레시피)에 토스 인증을 강제하지 않는다.
- **TDS·Granite 의무**: 비게임 미니앱은 TDS(`@toss/tds-react-native`)·Granite >= 1.0(`@apps-in-toss/framework`) 사용이 검수 통과 조건. 새 프로젝트로 시작해야 UI 라이브러리를 깔끔히 채택할 수 있다(웹의 Tailwind/shadcn을 재사용하는 것보다 검수 안전).
- **분리 운영**: 단일 코드베이스로 RN+Next를 합치는 비용(번들·빌드·의존성 충돌)이 신규 LLM이 따라야 할 포팅 사양서 자체보다 크다. 분리 + 백엔드 공유가 단순.

## 대안

### A. 풀스택 재작성 (백엔드까지 새로 만듦)

- 장점: 미니앱 단독 운영, 외부 서버 의존성 0.
- 단점: AI Provider·RLS·Mapper·계약을 모두 재작성. Sprint 1 자산 폐기. 추정 인력·시간 5배 이상.
- 기각.

### B. WebView 미니앱(현재 웹을 그대로 띄움)

- 장점: 최소 변경.
- 단점: 비게임 미니앱 TDS 의무와 충돌. 토스 검수 통과 어려움. 네이티브 UX 부재. AppsInToss 가이드는 RN 권장.
- 기각.

### C. 모노레포 통합

- 장점: 코드 공유 일부 가능.
- 단점: 두 빌드 시스템(Next + Granite) 공존 비용. 의존성 충돌(@toss/tds-* vs Tailwind). 단일 LLM이 따라야 할 포팅 사양이라는 본 작업의 목적과 어긋남(분리된 LLM 에이전트가 신규 저장소에서 작업).
- 기각.

### D. 채택: 모노레포 분리 + 백엔드 공유

- 신규 미니앱 저장소가 백엔드(Vercel 단일 배포)를 HTTPS로 호출.
- 현재 코드는 변경 없음.

## 영향

### 영향받지 않는 자산 (그대로 살아남음)

- ADR-001 (Supabase + Repository + Mapper + RLS) — 미니앱은 백엔드를 통해 간접적으로만 의존.
- ADR-002 (AI Adapter + Facade + Factory) — 백엔드 격리되어 있어 무영향.
- ADR-005 (소유권 위반 404 수렴) — 미니앱도 동일 404 의미를 따른다.
- ADR-008 (Gemini 기본 + Claude 비활성 보존) — 미니앱은 호출만, Provider 선택은 서버.
- API 계약(`_workspace/01_architect_api_contract.md`) 6개 엔드포인트 모두.
- 공유 타입(`src/types/recipe.ts`·`api.ts`).
- AI Provider 코드(`src/lib/ai/*`).
- zod 스키마(`recipe-schema.ts`).
- Supabase 스키마와 RLS(`supabase/schema.sql`).

### 변경되는 자산 (백엔드 — 별도 PR/ADR로 후속)

본 ADR은 미니앱 포팅의 결정이며 백엔드 코드 변경은 후속 ADR로 한다. 다만 옵션 P 채택에 따라 후속에 필요한 변경 항목을 명시한다:

- `profiles` 테이블 추가(매핑) + RLS 재설계 → 옵션 P 마이그레이션 (DATA-MODEL 챕터).
- API 인증 미들웨어가 Supabase 세션 외에 `X-Toss-User-Id` 헤더도 인식하도록 확장 (AUTH 챕터).
- 응답 shape·zod·camelCase·RLS 핵심은 **불변**.

### 미니앱에서 미구현되는 항목

- 회원가입/로그인 폼 → `getAnonymousKey()` 자동 식별
- `AuthForm` 컴포넌트 → 없음
- `useAuth` 훅 → 없음 (대신 `useTossUserId` 같은 식별자 훅)
- `/auth/login`·`/auth/signup` 화면 → 없음
- proxy 페이지 가드 → Granite 라우팅이 다름, 별도 처리(07-ROUTING 챕터)

## 검증

미니앱이 다음을 충족하면 본 ADR이 검증된다:

1. `getAnonymousKey()` 호출 → hash 획득 → 6개 API 호출 모두 성공 (목록·생성·저장·조회·즐겨찾기·삭제).
2. 두 명의 서로 다른 미니앱 사용자가 서로의 레시피를 볼 수 없음(소유자 격리, RLS 통과).
3. 백엔드 로그에 `X-Toss-User-Id` 헤더가 모든 보호 엔드포인트 호출에 포함됨.
4. TDS 컴포넌트로 14개 웹 컴포넌트 화면이 1:1 대응 (06-UI-MAPPING).
5. SSE → fetch stream으로 점진 렌더링 동작 (08-STREAMING).
6. 앱인토스 검수 통과 (게임/비게임 가이드 — `intro/guide.md`).

## 롤백

다음 시나리오 중 하나가 발생하면 본 ADR을 롤백·개정한다 (별 ADR 작성):

- **R1. Toss `getAnonymousKey` 정책이 레시피 앱(비게임)에 부적합 판정**: 미니앱 측에 Supabase Auth(또는 Toss 로그인 `AIT.AppLogin`)를 재도입한다. 백엔드의 옵션 P는 그대로 두고 매핑 키 원천만 바꾼다.
- **R2. 백엔드 분리 운영이 운영 부담 가중**: 미니앱 측 BFF(Backend For Frontend) 레이어 도입 검토.
- **R3. 옵션 P 매핑 테이블 성능 이슈**: 옵션 Q(uuid 마이그레이션) 재검토.

## 참고 ADR

- ADR-001 (Supabase + Repository + Mapper + RLS) — 본 ADR이 그 자산을 보존한다.
- ADR-002 (AI Adapter + Facade + Factory) — 그대로 백엔드에서 동작.
- ADR-005 (소유권 위반 404 수렴) — 미니앱에서도 404 UI를 동일 적용.
- ADR-007 (proxy 파일 컨벤션) — 미니앱은 proxy 없이 Granite 라우팅, 별도 처리.
- ADR-008 (Gemini 기본 + Claude 비활성 보존) — 미니앱은 Provider 선택을 인지하지 않음.

## 후속 ADR

- [ADR-010](ADR-010-option-p-toss-user-mapping.md) — 본 ADR D5(옵션 P 채택 선언)의 백엔드 구현 ADR. `profiles` 테이블 + FK 제거 + `requireUser(request)` 단일 추상 + service-role RLS 우회 + CORS·OPTIONS + generate 비인증 유지(D8). 본 ADR의 "변경되는 자산" 절을 구체 실행.

## 참고 SSOT

- `_workspace/01_architect_api_contract.md` — API 계약 SSOT
- `_workspace/01_architect_architecture.md` — 레이어/모듈 설계
- `src/types/recipe.ts`·`api.ts` — 공유 타입 SSOT
- `supabase/schema.sql` — DB 스키마 SSOT
- `docs/api/recipes.md` — API 구현 노트
- `docs/appsintoss-port/00-OVERVIEW.md` — 본 포팅 문서 묶음의 입구
