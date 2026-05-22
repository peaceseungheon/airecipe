# 세션 작업 기록 (SESSION_NOTES)

> 매 세션 시작 시 이 파일을 반드시 읽고, 완료된 작업과 다음 할 일을 파악한다.  
> 새 작업 완료 시 이 파일을 업데이트하여 누적 기록을 유지한다.

---

## 세션 #1 — 2026-05-21

### 완료된 작업 (Sprint 1 MVP)

**기능 구현**
- [x] 요리 이름으로 레시피 상세 생성 (Claude claude-sonnet-4-6, tool use, SSE 스트리밍)
- [x] 영양 정보 분석 (AI 자동 생성, 1인분 기준 칼로리·탄수화물·단백질·지방·식이섬유)
- [x] 레시피 저장 (Supabase PostgreSQL, 소유자 격리)
- [x] 즐겨찾기 토글 (멱등, isFavorite 목표값 명시 방식)
- [x] 회원가입/로그인 (Supabase Auth, 쿠키 기반 세션)
- [x] 레시피 삭제

**아키텍처 결정 (ADR-001~007)**
- ADR-001: Supabase (PostgreSQL + Auth + RLS)
- ADR-002: Claude AI Adapter 패턴 (AIRecipeProvider 인터페이스, ClaudeRecipeProvider 구현)
- ADR-003: 상태 관리 — SWR (캐싱·뮤테이션) + React hooks
- ADR-004: GET /api/recipes/[id] 단건 조회 엔드포인트 추가 (딥링크 지원)
- ADR-005: 소유권 위반 시 404 수렴 (RLS 특성상 403 구분 불가)
- ADR-006: pageSize > 50 시 400 거부 대신 50으로 clamp
- ADR-007: middleware.ts → proxy.ts 전환 (Next.js 16 규약)

**QA에서 발견·해소된 이슈 3건**
1. useRecipe 목록 캐시 매칭 → GET /api/recipes/[id] 직접 호출로 수정
2. middleware `/recipe/` 미가드 → PROTECTED_PREFIXES 추가 + /recipe/generate 공개 예외
3. pageSize .max(50) 거부 → clamp transform으로 변경

**커밋**: `391637e` — `feat: Sprint 1 MVP 완료 — AI 레시피 생성·영양 분석·저장·즐겨찾기`  
**GitHub**: https://github.com/peaceseungheon/AIReceipe

---

## 세션 #2 — 2026-05-22

### 변경
- AI 모델 기본값 `claude-sonnet-4-6` → `claude-haiku-4-5-20251001` (비용 ~70% 절감).
- 사유: F1·F2는 tool use로 출력 스키마가 강제되므로 모델 가중치 차이가 양식 안정성에 끼치는 영향이 작다. 동일 Anthropic family라 tool use·prompt caching 호환성 유지. Adapter 격리(ADR-002) 덕분에 1줄 변경.
- 오버라이드: `ANTHROPIC_MODEL` 환경변수로 sonnet/opus 지정 가능 (품질 부족 시).

### 수정 파일
- `src/lib/ai/claude-recipe-provider.ts` — `DEFAULT_MODEL` 변경
- `src/lib/ai/AGENTS.md`, `AGENTS.md` — 기본 모델 설명 갱신
- `docs/adr/ADR-002-ai-adapter.md` — 개정 노트 추가
- `_workspace/02_backend_summary.md` — 모델 기록 갱신
- `.claude/skills/ai-recipe-integration/SKILL.md` — 기본 시작 모델 가이드 갱신

### 다음 검증 필요
- 실 Anthropic API로 한국어 레시피 생성 품질 비교 (haiku 결과가 충분한지). 부족하면 `ANTHROPIC_MODEL=claude-sonnet-4-6`로 즉시 롤백.

---

## 세션 #3 — 2026-05-22

### 변경
- AI 기본 Provider **Claude → Gemini** (`gemini-3.1-flash-lite`, SDK `@google/genai`). 사용자 결정.
- **Factory 도입**: `src/lib/ai/ai-recipe-provider.factory.ts` 신규 — `AI_PROVIDER` 환경변수로 런타임 선택, 기본 `gemini`.
- **Claude 코드·SDK·env 비활성 보존** — 삭제하지 않음. `AI_PROVIDER=claude`로 즉시 롤백 가능 (운영 안전망).
- **구조화 출력 방식 분기**: Gemini는 `responseSchema`, Claude는 tool use. 두 스키마 모두 동일한 `GeneratedRecipe`로 수렴. zod 검증은 Provider-agnostic 단일 경로.
- `AIRecipeProvider` 인터페이스 불변 — Service·Route·UI 영향 없음 (ADR-002의 격리가 가치 실증).

### 수정/신규 파일 (역할별)

**코드 (backend 영역 — 본 세션에서는 문서만 처리)**
- 신규: `src/lib/ai/gemini-recipe-provider.ts`, `src/lib/ai/ai-recipe-provider.factory.ts`, `src/lib/ai/prompts/recipe-response-schema.ts`
- 보존: `src/lib/ai/claude-recipe-provider.ts`, `src/lib/ai/prompts/recipe-tool-schema.ts`
- 수정 완료: Composition Root(`composition.ts`) — Factory 호출로 변경, `package.json` — `@google/genai` 추가

**문서 (본 세션 산출물)**
- 신규: `docs/adr/ADR-008-gemini-default-with-claude-fallback.md`
- 신규: `.env.local.example`
- 수정: `docs/adr/ADR-002-ai-adapter.md` (Revision 2026-05-22 후속 추가)
- 수정: `src/lib/ai/AGENTS.md` (Provider-agnostic 재작성)
- 수정: `AGENTS.md` (다이어그램·디렉토리 책임·ADR 목록·환경변수)
- 수정: `README.md` (인트로·기술 스택·아키텍처 요약·환경변수)
- 수정: `docs/SESSION_NOTES.md` (이 파일)
- 수정: `.claude/skills/ai-recipe-integration/SKILL.md` (Provider-agnostic 일반화)

### 다음 검증 필요
- 실 `GEMINI_API_KEY`로 한국어 레시피 생성 품질을 기존 Claude haiku 대비 비교 (양식 안정성·조리 단계 디테일·영양 추정 정확도).
- Gemini `responseSchema` 출력이 zod 스키마(`recipe-schema.ts`)를 통과하는지 E2E 검증.
- 스트리밍 텍스트 델타가 UI에서 자연스러운지 확인 (Gemini는 부분 JSON이 흐를 수 있어 점진 렌더링 체감이 Claude와 다를 수 있음).
- `AI_PROVIDER=claude` 롤백 동작 확인 (환경변수 한 줄 변경만으로 Claude 경로 복귀하는지).

### 기술 부채에 추가
- [ ] 두 Provider의 응답 스키마(`recipe-response-schema.ts` ↔ `recipe-tool-schema.ts`) ↔ zod(`recipe-schema.ts`) ↔ 도메인 타입(`src/types/recipe.ts`) **4자 동기화 자동 검증 테스트** — 현재 수동 유지.
- [ ] Gemini `cachedContents` API 도입 평가 (현재 Gemini 캐싱 미사용; Claude는 `cache_control: ephemeral` 적용 중).
- [ ] **2026-11(6개월 후) Claude 비활성 코드 제거 평가** — Gemini 운영 안정성이 확인되면 별도 ADR로 제거 결정.

---

## 다음 세션에서 할 일

### 🔴 즉시 필요 (환경 설정 — 개발 시작 전 필수)
```bash
cp .env.local.example .env.local
# 아래 값을 채워야 앱이 동작함:
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
# AI_PROVIDER=gemini           # 기본 (ADR-008)
# GEMINI_API_KEY=              # AI_PROVIDER=gemini일 때 필수
# ANTHROPIC_API_KEY=           # AI_PROVIDER=claude(롤백) 모드에서만 필수
```
Supabase 대시보드에서 `supabase/schema.sql` 실행 (테이블 생성)

### 🟡 런타임 검증 (환경 키 확보 직후)
- [ ] 실 Supabase RLS 하 소유권 격리 통합 테스트 (내 레시피만 조회되는지)
- [ ] 실 Anthropic tool output의 zod 스키마 통과 확인 (레시피 생성 E2E)
- [ ] 인증 플로우 E2E: 회원가입 → 로그인 → 레시피 생성 → 저장 → 즐겨찾기 → 삭제

### 🟢 Sprint 2 후보 기능
우선순위 순:
1. **재료 기반 레시피 추천** — 보유 재료 입력 → 만들 수 있는 레시피 목록 AI 추천
2. **레시피 검색·필터** — 마이 레시피에서 키워드·즐겨찾기·난이도 필터
3. **소셜 공유** — 레시피 공유 링크 생성 (비로그인 읽기 허용)
4. **레시피 수정** — 저장된 레시피 편집 기능

### 🔵 기술 부채 / 개선사항
- [ ] `middleware.ts` 루트에 남아 있음 (삭제 필요, `src/proxy.ts`가 실제 엔트리)
- [ ] Supabase 타입 자동 생성 (`supabase gen types typescript`) 적용 고려
- [ ] 레시피 생성 스트리밍 UX 개선 — text 델타 점진 표시 완성도 향상
- [ ] 에러 토스트 UI — 현재 Alert 컴포넌트 기반, toast 라이브러리 전환 고려
- [ ] 페이지네이션 UI — GET /api/recipes의 meta.total·page 활용

---

## 파일 구조 (Sprint 1 기준)

```
AIReceipe/
├── src/
│   ├── app/
│   │   ├── api/recipes/          # 6개 엔드포인트
│   │   ├── auth/                 # login, signup
│   │   ├── my-recipes/           # 마이 레시피 목록
│   │   ├── recipe/               # generate, [id]
│   │   ├── layout.tsx
│   │   └── page.tsx              # 홈
│   ├── components/               # 14개 (RecipeCard, NutritionPanel 등)
│   ├── hooks/                    # 5개 (useRecipeGenerate, useMyRecipes, useRecipe, useAuth, api-client)
│   ├── lib/
│   │   ├── ai/                   # AI Providers (Gemini 기본 / Claude 보존, Factory) — ADR-008
│   │   └── supabase/             # client, server, middleware
│   ├── mappers/                  # snake_case ↔ camelCase
│   ├── repositories/             # RecipeRepository (추상) + SupabaseRecipeRepository
│   ├── services/                 # RecipeService, RecipeGenerationService
│   ├── types/                    # 공유 타입 SSOT (recipe.ts, api.ts, user.ts)
│   └── proxy.ts                  # Next.js proxy (ADR-007)
├── docs/
│   ├── adr/                      # ADR-001~007
│   ├── api/recipes.md            # API 문서
│   └── SESSION_NOTES.md          # ← 이 파일
├── supabase/
│   ├── schema.sql
│   └── migrations/
├── _workspace/                   # 에이전트 팀 산출물 (감사 추적용, 수정 X)
├── .claude/                      # 에이전트 정의 + 스킬
└── CLAUDE.md                     # 프로젝트 규칙
```

---

## 주요 참고 파일

| 파일 | 용도 |
|------|------|
| `_workspace/01_architect_api_contract.md` | API 계약 SSOT — 엔드포인트 요청/응답 shape |
| `_workspace/03_qa_report.md` | QA 리포트 — 검증된 경계면 목록 |
| `docs/adr/` | 아키텍처 결정 근거 |
| `src/types/` | 공유 TypeScript 타입 |
| `.env.local.example` | 필요한 환경변수 목록 |
