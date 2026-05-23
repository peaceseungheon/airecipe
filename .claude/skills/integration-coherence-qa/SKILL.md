---
name: integration-coherence-qa
description: "airecipe-miniapp의 통합 정합성(경계면 불일치)을 검증하는 QA 절차 — 백엔드 응답 shape ↔ api-client 타입, SSE 청크 ↔ 소비 훅, 인증 헤더 ↔ 식별자 훅, 라우팅 ↔ navigation 호출, TDS 매핑 ↔ 실제 패키지 API, 환경변수 ↔ granite.config 등을 교차 비교한다. 모듈을 검증하거나, QA를 수행하거나, 통합 버그를 찾을 때 반드시 이 스킬을 사용할 것. '검증', 'QA', '경계면 점검', '통합 확인' 요청 시에도 사용."
---

# 통합 정합성 검증 절차 (airecipe-miniapp QA)

개별 모듈이 각각 올바라도 연결 지점에서 계약이 어긋나는 **경계면 버그**가 런타임 에러의 주원인이다. `pnpm typecheck` 통과나 "메서드 존재 확인"은 이를 잡지 못한다. 핵심은 **양쪽을 동시에 읽고 교차 비교**하는 것이다.

본 미니앱은 다음 외부 의존이 많아 경계면이 많다:
- 백엔드(별 저장소 `AIReceipe`) HTTPS API
- Toss SDK(`getAnonymousKey`, granite framework)
- TDS RN 패키지(`@toss/tds-react-native`)
- 앱인토스 검수 정책

## 왜 정적 리뷰로 못 잡나

- TypeScript 제네릭의 한계: `fetchJson<RecipeListResponse>()`는 런타임 응답이 `{ data: { recipes } }`여도 컴파일 통과.
- 빌드 통과 ≠ 정상 동작: 캐스팅·`any`·제네릭이 있으면 빌드는 성공해도 런타임 실패.
- 존재 검증 ≠ 연결 검증: "메서드가 있는가"와 "반환 타입이 03 응답과 일치하는가"는 전혀 다른 검증.
- TDS 컴포넌트는 SDK 버전마다 시그니처가 바뀔 수 있어 06-UI-MAPPING 인용이 실제 패키지와 일치하는지 별도 검증 필요.

## 검증 영역별 절차

### 1. 백엔드 응답 shape ↔ api-client 반환 타입
1. `docs/appsintoss-port/03-API-CONTRACT.md` 각 엔드포인트 응답 shape 추출.
2. `src/services/api-client.ts` 대응 메서드의 반환 타입 확인.
3. shape과 타입 일치, 래핑(`{ data, meta }`) unwrap이 api-client에서 단일 위치인지 비교.
4. snake_case(있다면)→camelCase 변환이 Mapper(또는 백엔드 측 일관 처리)에 의해 적용되는지 확인.

### 2. api-client 메서드 ↔ 화면/훅 소비
1. `src/services/api-client.ts` exported 메서드 목록 추출.
2. `pages/`·`src/components/`·`src/hooks/`의 import + 호출 위치 검색.
3. 호출되지 않는 메서드 식별 → 누락 화면 또는 dead code 판단.
4. 직접 `fetch(`·`XMLHttpRequest` 호출이 화면 코드에 있는지 검색 — 발견 시 api-client 위반.

### 3. SSE 청크 ↔ 소비 훅
1. `docs/appsintoss-port/08-STREAMING.md`의 청크 타입 매트릭스(`meta`/`text`/`recipe`/`error`/`done`) 추출.
2. api-client의 스트림 어댑터에서 모든 청크 타입에 분기가 있는지 확인.
3. `useRecipeGenerate`(또는 동등) 훅에서 모든 청크 타입을 소비하고 상태 전환에 반영하는지 확인.
4. `AbortController`로 취소 시 정리(cleanup)되는지.

### 4. 인증 헤더 ↔ 식별자 훅 ↔ 백엔드 검증
1. `docs/appsintoss-port/05-AUTH.md`의 `X-Toss-User-Id` 헤더 명세 추출.
2. api-client에서 자동 주입되는지 (모든 메서드 또는 명시 제외).
3. `useTossUserId` 훅이 `getAnonymousKey()` SDK 호출 → SecureStore·메모리 캐시하는지.
4. 401 응답 시 재발급+1회 재시도 로직이 api-client에 있는지.

### 5. 라우팅 ↔ navigation 호출
1. `pages/` 하위 `createRoute('/...')` 경로 추출.
2. 코드 내 모든 `navigation.navigate('...')`·딥링크 값 수집.
3. 각 호출이 실제 경로와 매칭되는지 확인. `_404`·`_app`은 호출 대상이 아님.

### 6. TDS 매핑 실재성 (이 앱 특유)
1. `docs/appsintoss-port/06-UI-MAPPING.md`의 TDS 컴포넌트 인용 목록 추출.
2. **AppsInToss MCP**의 `search_tds_rn_docs`/`get_tds_rn_doc`로 표본 ≥5 검증 (Button, TextInput, BottomSheet 등 핵심부터).
3. 06의 props 매핑이 실제 패키지 시그니처와 일치하는지 (필수 props 누락·이름 불일치 등).
4. 실재 안 하는 컴포넌트 인용 → 06 갱신 필요.

### 7. 환경변수 ↔ granite.config ↔ 실제 사용처
1. `docs/appsintoss-port/09-ENV-CONFIG.md` §9.1.1 변수 목록 추출.
2. `granite.config.ts`의 `env(...)` 플러그인 인자와 비교.
3. `.env.example`과의 일치 확인.
4. `import.meta.env.*` 사용처가 09 §9.1.1에 정의된 변수만 사용하는지 (정의되지 않은 변수 사용 금지).

### 8. 검수 정책 ↔ 구현
1. `docs/appsintoss-port/09-ENV-CONFIG.md` §9.6, `appsintoss-publish-checklist` 스킬 체크리스트 추출.
2. 권한(`permissions: []`), 번들 크기, AI 면책, TDS 의무 등 항목별 구현 상태 점검.
3. 위반 가능성 발견 시 architect에게 통지·ADR로 우회 결정 요청.

## 검증 리포트 형식

`_workspace/03_qa_report.md`에 작성:

```markdown
# QA 통합 정합성 리포트 — {날짜}

## 검증 매트릭스 요약
| # | 영역 | 결과 |
|---|------|------|
| 1 | 응답 shape ↔ api-client | PASS / FAIL / N/A |
| 2 | api-client ↔ 소비 | ... |
| ... | ... | ... |

## 통과
- [영역] {검증 항목}: OK

## 실패 (수정 필요)
- [경계면] {파일A}:{라인} ↔ {파일B}:{라인}
  - 문제: {불일치 설명}
  - 수정: {구체적 방법}
  - 통지 대상: {생산자 에이전트}, {소비자 에이전트}

## 미검증
- {이유와 함께 명시}
```

## 점진적 검증 원칙

전체 완성 후 1회가 아니라, **각 메서드/화면 완성 직후** 해당 경계면을 즉시 검증한다. 버그 누적·후속 모듈 전파 방지. 발견 즉시 생산자·소비자 양쪽 에이전트에게 파일:라인 + 수정 방법 통지.

## TDS 실재성 검증 시 유의

- TDS RN 버전 충돌 가능: `@toss/tds-react-native@^2.0.x`와 06에서 인용한 시그니처가 차이 날 수 있음.
- MCP 응답 캐시 가능성: 동일 컴포넌트 두 번 조회해 일치 확인.
- 표본은 화면별 핵심 컴포넌트 1개 이상 포함.
