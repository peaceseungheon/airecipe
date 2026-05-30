# Vercel 배포 가이드 (airecipe-backend)

AIReceipe 백엔드(Next.js 16 App Router)를 Vercel에 배포하는 절차다. 이 프로젝트는 **monorepo의 서브디렉토리**(`airecipe-backend/`)이므로, Vercel 프로젝트의 **Root Directory를 `airecipe-backend`로 지정**하는 것이 가장 중요한 단계다. 이 한 가지를 놓치면 빌드가 실패한다.

> 대상 스택: Next.js 16 + React 19 + Supabase(PostgreSQL·Auth·RLS) + AI Provider(Kimi 기본 / Gemini·Claude 롤백). 미들웨어 기반 페이지 보호 + SSE 스트리밍을 사용하므로 **Node.js 서버리스 런타임**에서 동작한다(정적 export 불가).

---

## 0. 사전 준비 (체크리스트)

배포 전에 아래가 준비되어야 한다.

- [ ] **GitHub(또는 GitLab/Bitbucket) 저장소** — 이 monorepo가 푸시되어 있을 것.
- [ ] **Supabase 프로젝트** — URL, anon key, service role key 확보. 스키마 적용 완료(아래 2단계).
- [ ] **AI Provider API 키** — 기본은 Kimi(`KIMI_API_KEY`). Gemini·Claude는 롤백용이라 당장은 선택.
- [ ] **Vercel 계정** — GitHub 연동 권장.
- [ ] (선택) **미니앱 origin** — 앱인토스 미니앱이 이 백엔드를 호출한다면 그 origin을 CORS 화이트리스트에 넣을 것(아래 3단계).

---

## 1. Vercel 프로젝트 생성 및 Root Directory 지정 (★ 핵심)

### 1-1. 저장소 Import

1. [Vercel 대시보드](https://vercel.com/new) → **Add New… → Project**.
2. AIReceipe monorepo 저장소를 선택 → **Import**.

### 1-2. Root Directory 설정 (반드시!)

Configure Project 화면에서:

| 설정 | 값 | 비고 |
|------|-----|------|
| **Root Directory** | `airecipe-backend` | **Edit** 클릭 후 이 디렉토리 선택. monorepo이므로 필수. |
| Framework Preset | `Next.js` | Root를 잡으면 자동 감지된다. |
| Build Command | (비움 = `next build`) | 기본값 그대로. |
| Output Directory | (비움 = `.next`) | 기본값 그대로. |
| Install Command | (비움 = `npm install`) | `package-lock.json` 기준 자동. |
| Node.js Version | `20.x` 이상 | `@types/node`가 20 기준. 22.x도 무방. |

> **왜 Root Directory가 중요한가**: Vercel은 지정한 디렉토리를 프로젝트 루트로 보고 `package.json`·`next.config.ts`를 찾는다. monorepo 최상위에는 두 서브프로젝트(`airecipe-backend`, `airecipe-miniapp`)만 있고 빌드 가능한 `package.json`이 없으므로, Root를 `airecipe-backend`로 지정하지 않으면 빌드가 실패한다.

이 단계에서 **아직 Deploy를 누르지 말고**, 먼저 환경변수를 등록한다(아래 1-3). 환경변수 없이 배포하면 빌드는 통과해도 런타임에서 Supabase/AI 호출이 전부 실패한다.

### 1-3. 환경변수 등록

같은 Configure Project 화면의 **Environment Variables** 섹션에서 아래를 등록한다. (배포 후에도 **Settings → Environment Variables**에서 추가/수정 가능. 변경 시 재배포 필요.)

#### 필수

| 변수 | 환경 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | All | Supabase 프로젝트 URL. 브라우저 노출 OK. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Supabase anon key. 브라우저 노출 OK(RLS로 보호). |
| `SUPABASE_SERVICE_ROLE_KEY` | All | **서버 전용. 절대 노출 금지.** RLS 우회 권한. |
| `AI_PROVIDER` | All | `kimi`(기본) \| `gemini` \| `claude`. |
| `KIMI_API_KEY` | All | **서버 전용.** `AI_PROVIDER=kimi`(기본)일 때 필수. |

#### 조건부 / 선택

| 변수 | 언제 필요 | 설명 |
|------|----------|------|
| `GEMINI_API_KEY` | `AI_PROVIDER=gemini` 롤백 시 | 서버 전용. |
| `ANTHROPIC_API_KEY` | `AI_PROVIDER=claude` 롤백 시 | 서버 전용. |
| `APPSINTOSS_ALLOWED_ORIGINS` | 미니앱이 호출할 때 | 미니앱 origin 화이트리스트(콤마 구분). 빈 값이면 모든 cross-origin 거부. 웹앱(same-origin)은 무관. ADR-010. |
| `KIMI_MODEL` | 모델 오버라이드 | 기본 `kimi-k2`. |
| `KIMI_BASE_URL` | 엔드포인트 오버라이드 | 기본 `https://api.moonshot.ai/v1`. |
| `GEMINI_MODEL` | 모델 오버라이드 | 기본 `gemini-3.1-flash-lite`. |
| `ANTHROPIC_MODEL` | 모델 오버라이드 | 기본 `claude-haiku-4-5-20251001`. |

> ⚠️ **보안 불변식**: `SUPABASE_SERVICE_ROLE_KEY`, `KIMI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`에는 **절대 `NEXT_PUBLIC_` 접두사를 붙이지 말 것.** 붙이면 브라우저 번들에 그대로 노출되어 키가 유출된다. `NEXT_PUBLIC_*`은 anon key와 URL처럼 공개돼도 되는 값에만 쓴다.

> 💡 **환경 분리**: Vercel은 변수마다 `Production` / `Preview` / `Development` 적용 범위를 선택할 수 있다. 운영 Supabase와 별도의 스테이징 Supabase를 쓴다면 Preview에 다른 URL/키를 넣어 PR 미리보기를 분리하라.

등록을 마쳤으면 **Deploy**를 누른다.

---

## 2. Supabase 스키마 적용

Vercel은 DB 마이그레이션을 자동 실행하지 않는다. 최초 1회(또는 스키마 변경 시) 수동 적용한다.

1. [Supabase 대시보드](https://supabase.com/dashboard) → 해당 프로젝트 → **SQL Editor**.
2. [`supabase/schema.sql`](../supabase/schema.sql) 전체를 붙여넣고 실행 → 테이블 + RLS 정책 생성.
3. 이후 스키마 변경분은 [`supabase/migrations/`](../supabase/migrations/)의 파일(`0001_*`, `0002_*` …)을 번호 순서대로 실행한다.

> RLS(Row Level Security)가 소유자 격리의 핵심이다(ADR-005). 스키마를 적용하지 않거나 RLS 정책이 빠지면 `/api/recipes` 인증 엔드포인트가 전부 실패하거나 데이터가 노출될 수 있다.

---

## 3. CORS (미니앱이 호출하는 경우만)

웹앱은 same-origin이라 CORS 설정이 필요 없다. **앱인토스 미니앱**이 이 백엔드를 cross-origin으로 호출한다면:

1. 미니앱의 실제 origin(예: `https://your-miniapp.toss.im`)을 확인.
2. Vercel 환경변수 `APPSINTOSS_ALLOWED_ORIGINS`에 콤마로 구분해 등록.
   ```
   APPSINTOSS_ALLOWED_ORIGINS=https://your-miniapp.toss.im,https://staging-miniapp.toss.im
   ```
3. 재배포.

상세 동작은 ADR-010 및 [`docs/appsintoss-port/09-ENV-CONFIG.md`](appsintoss-port/09-ENV-CONFIG.md) 참고.

---

## 4. 배포 후 검증

배포가 끝나면 Vercel이 발급한 도메인(예: `https://airecipe-backend.vercel.app`)으로 다음을 확인한다.

| 항목 | 확인 방법 | 기대 결과 |
|------|----------|----------|
| 빌드 성공 | Vercel Deployment 로그 | `Compiled successfully`, 타입 오류 0 |
| 홈 렌더 | 브라우저로 `/` 접속 | 검색 화면 정상 표시 |
| AI 생성 | `/recipe/generate`에서 요리명 입력 | 레시피 + 영양 정보 반환(SSE 스트리밍 동작) |
| 인증 가드 | 비로그인으로 `/my-recipes` 접속 | `/auth/login?redirect=...`로 리다이렉트(미들웨어 동작) |
| API 직접 호출 | `POST /api/recipes/generate` (JSON) | `{ data, ... }` 래핑 응답 |
| 저장/조회 | 로그인 후 레시피 저장 → `/my-recipes` | 본인 레시피만 표시(RLS) |

AI 생성이 500으로 실패하면 거의 항상 **AI Provider 키 누락/오타** 또는 **`AI_PROVIDER` 값과 키 불일치**다. Vercel **Deployment → Functions/Logs**에서 서버 콘솔 로그(`logApiError`)를 확인한다.

---

## 5. AI Provider 롤백 (운영 중 즉시 전환)

코드 변경 없이 환경변수만으로 Provider를 바꾼다(ADR-008, ADR-012).

| 전환 대상 | 변경 변수 |
|----------|----------|
| Gemini로 | `AI_PROVIDER=gemini` + `GEMINI_API_KEY` 설정 |
| Claude로 | `AI_PROVIDER=claude` + `ANTHROPIC_API_KEY` 설정 |
| Kimi로 복귀 | `AI_PROVIDER=kimi` (기본) |

절차:

1. Vercel **Settings → Environment Variables**에서 `AI_PROVIDER` 수정 + 해당 키 추가.
2. **Deployments → 최신 배포 → Redeploy** (또는 재배포 트리거). 환경변수 변경은 재배포해야 반영된다.

---

## 6. 프로덕션 승격 · 커스텀 도메인

- **자동 배포**: 기본 브랜치(`main`)에 푸시하면 Production으로 자동 배포된다. 그 외 브랜치/PR은 Preview 배포(고유 URL)로 생성된다.
- **커스텀 도메인**: Vercel **Settings → Domains**에서 도메인 추가 후 DNS(A/CNAME) 설정. 미니앱 CORS 화이트리스트와 미니앱 콘솔의 도메인 화이트리스트도 새 도메인으로 갱신할 것.
- **즉시 롤백**: 문제가 생기면 **Deployments**에서 직전 정상 배포를 **Promote to Production**으로 되돌린다.

---

## 7. 트러블슈팅

| 증상 | 원인 / 해결 |
|------|------------|
| `No Next.js version detected` / 빌드 즉시 실패 | **Root Directory가 `airecipe-backend`로 지정되지 않음.** Settings → General → Root Directory 수정 후 재배포. |
| 빌드는 되나 모든 페이지 500 | Supabase 환경변수 누락/오타. `NEXT_PUBLIC_SUPABASE_URL`·`ANON_KEY` 확인. |
| AI 생성만 500 | `AI_PROVIDER`와 해당 키 불일치(예: `kimi`인데 `KIMI_API_KEY` 없음). Functions 로그 확인. |
| 인증/저장 API가 권한 오류 | Supabase 스키마·RLS 미적용. `schema.sql` 실행 여부 확인. |
| 미니앱 호출이 CORS로 차단 | `APPSINTOSS_ALLOWED_ORIGINS`에 미니앱 origin 누락. 정확한 origin(스킴·호스트) 등록 후 재배포. |
| 환경변수 바꿨는데 반영 안 됨 | 환경변수 변경은 **재배포 필요**. Redeploy 실행. |
| 타입 오류로 빌드 실패 | `npm run build`는 타입 체크를 포함한다(DoD: 타입 오류 0). 로컬에서 먼저 통과시킨 뒤 푸시. |
| 키를 실수로 `NEXT_PUBLIC_`로 등록 | 즉시 해당 키를 **폐기·재발급**하고 올바른 이름으로 재등록(이미 번들에 노출됨). |

---

## 참고 문서

- 환경변수 전체: [`.env.local.example`](../.env.local.example), [`README.md`](../README.md) "시작하기"
- AI Provider 결정: [`docs/adr/ADR-008-gemini-default-with-claude-fallback.md`](adr/ADR-008-gemini-default-with-claude-fallback.md), [`ADR-012-kimi-moonshot-provider.md`](adr/ADR-012-kimi-moonshot-provider.md)
- CORS / Toss 매핑: [`docs/adr/ADR-010-option-p-toss-user-mapping.md`](adr/ADR-010-option-p-toss-user-mapping.md), [`docs/appsintoss-port/09-ENV-CONFIG.md`](appsintoss-port/09-ENV-CONFIG.md)
- API 계약: [`docs/api/recipes.md`](api/recipes.md)
