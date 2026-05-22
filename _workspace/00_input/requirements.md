# Sprint 1 MVP 요구사항

## 프로젝트 개요
AI 기반 요리 레시피 안내 웹앱
- Framework: Next.js 14+ (App Router) + TypeScript
- UI: Tailwind CSS + shadcn/ui
- DB: Supabase (PostgreSQL)
- Auth: Supabase Auth
- AI: Claude API (claude-sonnet-4-6)
- 개발 방식: 애자일 (Sprint 단위)

---

## Sprint 1 기능 범위

### F1. 레시피 상세 생성
- 사용자가 **요리 이름**을 입력하면 Claude AI가 레시피 상세 정보를 생성
- 생성 내용:
  - 재료 목록 (양, 단위 포함)
  - 조리 순서 (단계별)
  - 요리 팁 (선택사항)
  - 예상 조리 시간 / 난이도
  - 몇 인분인지

### F2. 영양 정보 분석
- 레시피 생성 시 Claude AI가 자동으로 영양 정보를 함께 분석
- 분석 내용:
  - 1인분 기준 칼로리
  - 주요 영양소 (탄수화물, 단백질, 지방, 식이섬유)
  - 건강 포인트 (이 레시피의 건강 측면 간단 설명)

### F3. 레시피 저장·즐겨찾기
- Supabase Auth로 회원가입/로그인 (이메일+패스워드)
- 로그인한 사용자가 생성된 레시피를 저장
- 저장한 레시피 목록 조회 (마이 레시피)
- 즐겨찾기 토글 (저장된 레시피 중 즐겨찾기 표시)

---

## 페이지 구성 (예상)

| 경로 | 설명 |
|------|------|
| `/` | 홈 — 요리 이름 검색 입력창, 최근 생성 레시피 |
| `/recipe/generate` | 레시피 생성 폼 + 결과 페이지 |
| `/recipe/[id]` | 레시피 상세 페이지 (저장된 레시피) |
| `/my-recipes` | 마이 레시피 목록 (로그인 필요) |
| `/auth/login` | 로그인 |
| `/auth/signup` | 회원가입 |

---

## API 엔드포인트 (예상)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/recipes/generate` | 레시피 생성 + 영양 분석 (Claude AI) |
| GET | `/api/recipes` | 내 레시피 목록 |
| POST | `/api/recipes` | 레시피 저장 |
| PATCH | `/api/recipes/[id]/favorite` | 즐겨찾기 토글 |
| DELETE | `/api/recipes/[id]` | 레시피 삭제 |

---

## 인프라 / 환경

- Supabase 프로젝트: .env에 SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY 제공 예정
- Claude API: .env에 ANTHROPIC_API_KEY 제공 예정
- 배포: 로컬 개발 우선 (Vercel 배포는 이후 스프린트)

---

## 비기능 요구사항

- **소프트웨어 공학 원칙:** SOLID 원칙 준수, Repository/Service/Adapter 패턴 적용
- **철저한 문서화:** ADR(아키텍처 결정 기록), API 문서, AGENTS.md (모듈별)
- **TypeScript strict mode** 활성화
- **에러 핸들링:** AI 호출 실패, Supabase 오류 등 graceful handling
- **스트리밍:** 레시피 생성 시 스트리밍 응답으로 UX 향상 (가능하면)

---

## 개발 완료 기준 (Definition of Done)

1. `npm run build` 통과 (타입 오류 없음)
2. `npm run lint` 통과
3. QA 경계면 검증 통과 (API 응답 shape ↔ 프론트 타입 일치)
4. 모든 API 엔드포인트 문서화 (`docs/api/`)
5. ADR 작성 완료 (`docs/adr/`)
6. 각 모듈 AGENTS.md 작성 완료

---

## 스프린트 계획 (Agile)

### Sprint 1 (현재)
위 F1~F3 전체 구현

### Sprint 2 (예정)
- 재료 기반 추천 기능
- 소셜 공유
- 레시피 검색/필터

---

_생성일: 2026-05-21_
