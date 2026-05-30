# AIReceipe

AI 기반 요리 레시피 안내 웹앱. 요리 이름을 입력하면 AI(기본 Kimi, Gemini·Claude로 롤백 가능)가 레시피와 영양 정보를 생성하고, 사용자가 자신의 레시피로 저장·관리할 수 있다.

> **상태:** Sprint 1 MVP 완료 (2026-05-21) — 레시피 생성·영양 분석·저장·즐겨찾기·인증.

## 주요 기능 (Sprint 1)

- **AI 레시피 생성** — 요리 이름 입력 → AI Provider(Kimi JSON 모드 기본 / Gemini `responseSchema`·Claude tool use 롤백)로 구조화된 레시피(재료·조리법·영양) 반환. SSE 스트리밍 지원.
- **영양 정보 분석** — 1인분 기준 칼로리·탄수화물·단백질·지방·식이섬유 자동 산출.
- **마이 레시피** — 생성 결과를 Supabase에 저장, 소유자 격리(RLS) 보장.
- **즐겨찾기** — 멱등 토글(목표값 명시 방식).
- **인증** — Supabase Auth, 쿠키 기반 세션.

## 기술 스택

| 영역 | 도구 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| 스타일링 | Tailwind CSS 4 |
| 데이터 | Supabase (PostgreSQL + Auth + RLS) |
| AI | Kimi / Moonshot AI (`kimi-k2` 기본, `openai` SDK + `baseURL`, OpenAI 호환 JSON 모드) — Gemini(`@google/genai`, `responseSchema`)·Claude(`@anthropic-ai/sdk`, tool use + prompt caching)로 즉시 롤백 가능 |
| 상태 관리 | SWR + React hooks |
| 검증 | zod |

## 아키텍처 (요약)

```
[UI 컴포넌트] → [훅] → (HTTP) → [Route Handler] → [Service] → [Repository] → [Supabase]
                                                       │
                                                       └→ [AIRecipeProvider 추상] ← Factory ─┬→ [KimiRecipeProvider] (기본)
                                                                                              ├→ [GeminiRecipeProvider] (롤백용, 보존)
                                                                                              └→ [ClaudeRecipeProvider] (롤백용, 보존)
```

- **Repository / Mapper** (ADR-001) — Supabase 격리, snake↔camel 단일 변환점.
- **Adapter + Facade + Factory** (ADR-002, ADR-008, ADR-012) — AI SDK는 어댑터(`KimiRecipeProvider`/`GeminiRecipeProvider`/`ClaudeRecipeProvider`)에만 격리, `RecipeGenerationService.generate()`가 생성+영양 분석을 단일 진입점으로 묶음, Provider 선택은 `ai-recipe-provider.factory.ts`가 `AI_PROVIDER` 환경변수로 수행.
- **Kimi 기본 + Gemini·Claude 보존** (ADR-008, ADR-012) — 운영 중 `AI_PROVIDER=gemini` 또는 `=claude` 한 줄로 즉시 롤백.
- **소유권 위반 시 404 수렴** (ADR-005) — RLS 특성과 IDOR 정보 누설 방지.
- **proxy.ts 전환** (ADR-007) — Next.js 16 규약, 페이지 보호는 `src/proxy.ts`가 담당.

전체 ADR은 [`docs/adr/`](docs/adr/) 참고.

## 디렉토리 구조

```
src/
├── app/
│   ├── api/recipes/        # 6개 엔드포인트 (generate, list, get, save, favorite, delete)
│   ├── auth/               # login, signup
│   ├── my-recipes/         # 마이 레시피
│   ├── recipe/             # generate, [id]
│   └── layout.tsx, page.tsx
├── components/             # 재사용 UI (RecipeCard, NutritionPanel 등)
├── hooks/                  # useRecipeGenerate, useMyRecipes, useRecipe, useAuth
├── lib/
│   ├── ai/                 # AIRecipeProvider + Gemini/Claude 어댑터 + Factory
│   └── supabase/           # client, server, middleware
├── mappers/                # snake↔camel 변환
├── repositories/           # RecipeRepository 추상 + Supabase 구현
├── services/               # RecipeService, RecipeGenerationService (Facade)
├── types/                  # 공유 타입 SSOT
└── proxy.ts                # Next.js 16 페이지 보호
docs/
├── adr/                    # ADR-001~009 (ADR-009: 앱인토스 미니앱 포팅)
├── api/recipes.md          # API 문서
├── appsintoss-port/        # 앱인토스 미니앱 포팅 사양서 11개 챕터 (00~10)
└── SESSION_NOTES.md        # 세션별 작업 기록
supabase/
├── schema.sql              # 테이블 정의
└── migrations/
```

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

루트에 `.env.local` 생성 후 아래 값을 채운다.

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # 서버 전용, 클라이언트 노출 금지

# AI Provider 선택 ("kimi" 기본 | "gemini" 롤백 | "claude" 롤백) — ADR-008, ADR-012
AI_PROVIDER=kimi

# Kimi / Moonshot AI (기본 Provider — ADR-012, OpenAI 호환)
KIMI_API_KEY=<api-key>                         # 서버 전용. AI_PROVIDER=kimi(기본)일 때 필수
# KIMI_MODEL=kimi-k2                           # 선택 (기본값)
# KIMI_BASE_URL=https://api.moonshot.ai/v1     # 선택 (기본값, 글로벌 엔드포인트)

# Gemini (롤백용 — AI_PROVIDER=gemini일 때 필수)
# GEMINI_API_KEY=<api-key>                     # 서버 전용
# GEMINI_MODEL=gemini-3.1-flash-lite           # 선택 (기본값)

# Claude (롤백용 — AI_PROVIDER=claude일 때 필수)
# ANTHROPIC_API_KEY=<api-key>                  # 서버 전용
# ANTHROPIC_MODEL=claude-haiku-4-5-20251001    # 선택. 품질 부족 시 claude-sonnet-4-6 / claude-opus-4-7
```

> `NEXT_PUBLIC_*`은 브라우저 번들에 포함된다. `SUPABASE_SERVICE_ROLE_KEY`·`KIMI_API_KEY`·`GEMINI_API_KEY`·`ANTHROPIC_API_KEY`는 절대 `NEXT_PUBLIC_` 접두사를 붙이지 말 것.
>
> **롤백 절차**: 기본은 Kimi다. Gemini로 롤백하려면 `AI_PROVIDER=gemini` + `GEMINI_API_KEY`, Claude로 롤백하려면 `AI_PROVIDER=claude` + `ANTHROPIC_API_KEY`를 설정하고 재배포한다. 코드 변경 없음(ADR-008, ADR-012).

### 3. Supabase 스키마 적용

Supabase 대시보드 SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql)을 실행한다 (테이블 + RLS 정책 생성).

### 4. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)을 연다.

## 페이지 / API

| 경로 | 인증 | 설명 |
|------|------|------|
| `/` | 공개 | 홈 — 요리 이름 검색 |
| `/recipe/generate` | 공개 | 레시피 생성 폼 + 결과 |
| `/recipe/[id]` | 필요 | 저장된 레시피 상세 |
| `/my-recipes` | 필요 | 마이 레시피 목록 |
| `/auth/login`, `/auth/signup` | 공개 | 인증 |

| API | 인증 | 설명 |
|-----|------|------|
| `POST /api/recipes/generate` | 공개 | 생성 + 영양 분석 (JSON 또는 SSE) |
| `GET /api/recipes` | 필요 | 내 레시피 목록 (favorite/page/pageSize 쿼리) |
| `GET /api/recipes/[id]` | 필요 | 단건 조회 |
| `POST /api/recipes` | 필요 | 저장 |
| `PATCH /api/recipes/[id]/favorite` | 필요 | 즐겨찾기 토글 (멱등) |
| `DELETE /api/recipes/[id]` | 필요 | 삭제 |

모든 성공 응답은 `{ data, meta? }` 래핑, 에러는 `{ error: { code, message } }` (ApiErrorCode 8종). 상세는 [`docs/api/recipes.md`](docs/api/recipes.md).

## 개발 명령

| 명령 | 용도 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 체크 + 프로덕션 빌드 (DoD: 타입 오류 0) |
| `npm run lint` | ESLint |
| `npm start` | 빌드 결과 실행 |

## 협업 규약 (요약)

1. **계약 우선(SSOT)** — API 요청/응답 타입은 `src/types/`에 정의, 백/프론트가 동일 타입 import.
2. **응답 래핑 일관성** — `{ data, meta? }` / `{ error }` 형식 준수.
3. **API 경계는 camelCase** — DB의 snake_case는 `src/mappers/`에서만 변환.
4. **Route는 얇게** — 비즈니스 로직은 Service로(SRP). 외부 SDK는 어댑터 뒤에 격리.
5. **패턴은 근거와 함께** — 도입 시 ADR 작성. 구현체 하나뿐인 추상화는 금지(YAGNI).

상세는 [`AGENTS.md`](AGENTS.md), 디자인 결정 근거는 [`docs/adr/`](docs/adr/).

## 배포

Vercel 배포 절차·환경변수·트러블슈팅은 [`docs/DEPLOY-vercel.md`](docs/DEPLOY-vercel.md) 참고. monorepo이므로 Vercel **Root Directory를 `airecipe-backend`로 지정**하는 것이 핵심이다.

## 다음 작업

[`docs/SESSION_NOTES.md`](docs/SESSION_NOTES.md)에 누적 기록과 다음 우선순위(Sprint 2 후보: 재료 기반 추천 · 검색·필터 · 소셜 공유 · 레시피 수정)가 있다. 세션 시작 시 반드시 이 파일을 먼저 읽는다.
