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

## 다음 세션에서 할 일

### 🔴 즉시 필요 (환경 설정 — 개발 시작 전 필수)
```bash
cp .env.local.example .env.local
# 아래 값을 채워야 앱이 동작함:
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
# ANTHROPIC_API_KEY=
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
│   │   ├── ai/                   # ClaudeRecipeProvider (Adapter)
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
