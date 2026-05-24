# 0011. 미니앱 Phase 2 — 스트리밍·UI 규약 (SSE 어댑터 분리·AsyncGenerator·에러 청크 단일 매핑·text 청크 미표시·PageNavbar 채택·AbortSignal cast 2곳 한시 통과)

- 상태: 채택됨
- 날짜: 2026-05-24
- 적용 대상: 본 저장소(`airecipe-miniapp`) 클라이언트 한정 결정
- 영향 코드: `src/services/{sse-client,recipes,api-client}.ts`, `src/lib/zod/stream.ts`, `src/hooks/useRecipeGenerate.ts`, `src/components/{SearchForm,RecipeDisplay,NutritionPanel,recipe-format}.{tsx,ts}`, `src/pages/{index,recipe/generate}.tsx`
- 참조 baseline: `_workspace/01_architect_phase2_baseline.md` (§A·§B·§C·§D·§F)
- 참조 산출: `_workspace/02_api_client_summary.md`, `_workspace/02_frontend_summary.md`, `_workspace/03_qa_report.md`

---

## 맥락

[ADR-010](./ADR-010-miniapp-phase1-conventions.md)으로 Phase 1 공통 인프라(공유 타입·zod·`apiFetch`·`useTossUserId`)가 동결됐다. Phase 2는 그 위에 **레시피 생성 화면 + SSE 스트리밍**(기능 a/b)을 구현한다. baseline §C가 SSE 어댑터 구조·AsyncGenerator·에러 청크 매핑·text 청크 UX·PageNavbar 채택의 5 결정 + §D.3이 RN/ESNext `AbortSignal` 타입 충돌의 한시 통과를 추가로 동결했고, qa의 격리 단언이 모두 PASS로 종합되어 본 ADR로 6 결정을 묶어 동결한다.

본 ADR 작성 시점 결정해야 했던 사항:

1. **SSE 어댑터의 위치와 책임 분리** — `apiFetch`(ADR-010 D5 비스트리밍 한정)에 SSE를 얹을지 별 모듈로 분리할지.
2. **SSE 소비 시그니처** — 콜백 등록·EventEmitter·AsyncGenerator 중 어느 인터페이스로 청크를 노출할지.
3. **에러 청크의 호출 측 매핑 위치** — sse-client 어댑터에서 throw로 변환할지, 호출 측 훅에서 `for-await` 내부 분기로 처리할지.
4. **text 청크의 사용자 화면 표시 정책** — 점진 텍스트를 그대로 렌더할지(현재 웹과 동일), 숨길지(RN 컨텍스트 + Gemini 부분 JSON / Claude tool 모드 반영).
5. **TDS `Navbar` 단일 명칭 부재 처리** — 06 §6.4.6의 `Navbar`를 `@toss/tds-react-native@2.0.3` root에서 export되는 다른 명칭(`PageNavbar` / `ReactNavigationNavbar`)으로 어떻게 대체할지.
6. **`AbortSignal` 타입 충돌 처리** — RN globals.d.ts와 ESNext lib의 `AbortSignal`이 nominal 차이를 보여 fetch 호출 시 TS2769 발생. tsconfig 변경 vs cast vs 다른 정식 해법 중 어느 것을 채택할지.

본 결정의 **수명은 Phase 2 종료(본 ADR 채택 시점)부터 Phase 3 진입 시점까지**다. Phase 3가 도입하는 저장/목록/상세/즐겨찾기/삭제 화면에서 일부 결정(특히 D11 text 청크 정책, D12 공통 래퍼 미작성, D13 cast 격리)이 영향을 받을 수 있어 그 시점에 ADR-011 보강 또는 superseded 처리한다.

---

## 결정

### D8. SSE 어댑터를 `src/services/sse-client.ts` 신규 모듈로 분리한다 (apiFetch 우회)

- `apiFetch`(`src/services/api-client.ts`)는 ADR-010 D5에 따라 **비스트리밍 JSON 단일 응답**의 단일 책임(헤더 부착 + 401 재시도 + zod + raw 응답 unwrap)을 유지한다.
- SSE는 별 모듈 `src/services/sse-client.ts`의 `streamRecipe(req, options): AsyncGenerator<StreamChunk>`로 분리한다.
- `recipes.ts`의 신규 `generateRecipeStream`은 `streamRecipe`에 위임만 하는 Facade다. 기존 비스트리밍 `generateRecipe`는 그대로 보존 (Phase 1 ADR-010 D5 정책 유지).

### D9. SSE 소비 시그니처는 `AsyncGenerator<StreamChunk>`

- `for await (const chunk of stream) { handleChunk(chunk); }` 패턴으로 호출.
- 종료/취소는 try/catch/finally — `AbortError` 발생 시 generator finally가 `reader.releaseLock()` 후 자연 종료.
- 대안(콜백 등록·EventEmitter)은 청크 순서 보장이 약하고 cleanup이 분산되어 기각.

### D10. `error` 청크는 sse-client에서 `ApiClientError`로 throw하여 호출 측 try/catch 한 곳에서 통합 처리한다

- 어댑터가 청크 분기에서 `if (chunk.type === 'error') throw new ApiClientError(chunk.error.code, chunk.error.message);`를 적용.
- 훅(`useRecipeGenerate`)은 `for await` 외부 `catch (err)` 한 곳에서 모든 에러(에러 청크 / HTTP non-200 / AbortError / 네트워크 실패 / `!res.body`)를 통합 처리.
- 비스트리밍 `generateRecipe`도 `ApiClientError`로 throw하므로 SSE/비스트리밍 두 경로에서 호출 측 매핑 단일화.

### D11. `text` 청크 delta는 사용자 화면에 표시하지 않는다 (점진 인디케이터만)

- 백엔드 결정 #6 (08 §8.3.5) 채택. Gemini 부분 JSON / Claude tool 강제 모드 모두에서 text delta는 사용자에 보여줘선 안 됨.
- `useRecipeGenerate`는 `progressText`를 내부 상태(타임아웃 리셋 신호)로만 누적. UI는 인디케이터("AI가 레시피를 생성하고 있어요" + Spinner)만 표시.
- 최종 결과는 `recipe` 청크 도착 시 `setRecipe(chunk.recipe)` 1회 렌더(`RecipeDisplay` + `NutritionPanel`).
- 현재 웹 UX(progressText 회색 박스 노출)는 ADR-009 D4에 따라 본 미니앱에 옮기지 않는다.

### D12. TDS `Navbar` 단일 명칭 부재 → `PageNavbar`(extensions) 채택. 공통 래퍼(`AppNavbar.tsx`)는 만들지 않는다 (YAGNI)

- `@toss/tds-react-native@2.0.3` root export 확인 결과 단일 `Navbar`가 부재. `PageNavbar`(via `extensions/page-navbar`, compound `.Title`/`.AccessoryButtons`/`.AccessoryTextButton`/`.AccessoryIconButton`/`.TransparentScrollView`)와 `ReactNavigationNavbar`(via `components/navbar/ReactNavigationHelper`, React Navigation `screenOptions`용) 둘이 별개로 export.
- 본 미니앱은 Granite `createRoute` + `useNavigation` 추상화 위에서 컴포넌트 본문에 navbar를 직접 렌더하는 패턴(07 §7.8)이므로 **`PageNavbar` 채택**. `ReactNavigationNavbar`는 본 컨텍스트에 부적합으로 기각.
- Phase 2 화면 2개(`pages/index.tsx`, `pages/recipe/generate.tsx`)에서 직접 import. 공통 래퍼 `AppNavbar.tsx`는 만들지 않음 — Phase 3에서 화면이 늘면 그때 추출 검토.
- 06 §6.4.6과 §6.5 #6 행은 본 ADR 채택 시점에 갱신 완료 (2026-05-24).

### D13. `AbortSignal` 타입 충돌은 cast 2곳(sse-client + api-client) 한시 통과로 처리한다. tsconfig는 수정하지 않는다

- `tsconfig.json`이 `lib: ["ESNext"]` + `types: ["react-native"]`를 둘 다 포함하여 fetch의 `RequestInit.signal: global.AbortSignal`(RN globals.d.ts)과 사용자 코드의 `AbortController().signal: lib.dom AbortSignal`(ESNext lib)이 **TS nominal**로 다른 형태가 된다. 두 타입은 **런타임 동일 객체**(globalThis.AbortSignal).
- `signal: <source>.signal as RequestInit['signal']` cast를 적용 — **정확히 2곳**:
  1. `src/services/sse-client.ts:76` — SSE fetch 호출 (Phase 2 신규 모듈)
  2. `src/services/api-client.ts:100` — `apiFetch` 호출 (Phase 2 §A.2 허용 확장으로 `ApiFetchInit.signal?: AbortSignal` 옵션 추가의 자연 귀결)
- 두 위치 모두 `// baseline §D.3 — RN globals.d.ts AbortSignal vs ESNext lib union TS2769. ...` 동일 주석 동반.
- 다른 모듈(`recipes.ts`/`useRecipeGenerate.ts`/`hooks`/`pages`/`components`/`lib`) 전파 0건 (qa §8B grep 확인). 동등 cast(`as AbortSignal`/`as unknown as ... Signal`) 확산 0건.

---

## 근거

### D8 SSE 어댑터 별 모듈 분리

- **SRP**: `apiFetch`는 JSON 단일 응답(401 재시도 + zod + raw unwrap)의 단일 책임. SSE는 wire 파싱(`\n\n` 분리 + 다중 `data:` 라인) + AsyncIterable yield + `!res.body` 폴백 신호 + AbortSignal 전달 등 책임이 다름. 한 함수에 묶으면 두 책임의 변경 사유가 충돌.
- **ADR-010 D5 정합**: D5는 비스트리밍 한정의 raw 응답 정책을 동결했고, "Phase 2가 본 ADR D5의 비스트리밍 한정을 확장 — 별 경로(`streamFetch` 등)를 도입"으로 후속 변경 트리거를 예고했다. 본 D8이 그 트리거의 실현.
- **테스트성**: 별 모듈은 unit 테스트 시 reader/Decoder mock 격리 용이.

### D9 AsyncGenerator 시그니처

- **언어 표준 흐름**: try/catch/finally + abort에 의한 자연 throw → finally cleanup. 콜백/EventEmitter는 종료/cleanup이 호출자 책임이라 누락 가능성 높음.
- **순서 보장**: yield 순서가 wire 순서와 일치. 분기 없이 단일 stream.
- **타입 안전**: `StreamChunk` discriminated union이 그대로 yield 타입.

### D10 에러 청크 단일 매핑

- **단일 경로**: 호출 측이 에러 분기를 두 군데(`for await` 안의 청크 분기 + `try/catch`)에 작성하면 중복 + 누락 위험. 어댑터 측 throw로 한 곳에 통합.
- **일관성**: 비스트리밍 `generateRecipe`(Phase 1)는 이미 `ApiClientError`로 throw — 동일 에러 타입을 SSE 경로에서도 사용하면 훅 측 매핑이 단일화.
- **03 §3.10 #2(HTTP 상태 분기 금지) 정합**: 어댑터가 `error.code` 기반 분기를 강제하면 호출 측이 HTTP 상태로 분기할 여지가 사라진다.

### D11 text 청크 사용자 화면 미표시

- **Gemini 부분 JSON 회피**: text delta가 깨진 JSON 토큰(`{"dishName":"김치찌개","ing`)으로 흐르므로 사용자에 표시하면 깨진 텍스트가 보임. 백엔드 결정 #6(04 §4.3.3 + 백엔드 미니앱 정합) 인용.
- **Claude tool 모드 호환**: tool 강제 호출 중에는 text delta가 거의 비어있어 점진 표시가 무의미.
- **RN UX**: 인디케이터만 표시하면 깜빡임/디바운싱 자체가 불필요 — 단순화.
- **`recipe` 청크 결과 채널 유지**: 최종 결과는 `recipe` 청크 1회. text 청크 누적 → JSON.parse 시도 금지(03 §3.10 #1 + 08 §8.3.5 표).

### D12 PageNavbar 채택 + 공통 래퍼 미작성

- **실재성 확인**: `node_modules/@toss/tds-react-native/dist/esm/index.d.ts` 직접 검증 결과 단일 `Navbar` 명칭 부재. `PageNavbar`는 root에서 export 확인.
- **Granite 컨텍스트 적합**: 본 미니앱은 `createRoute`/`useNavigation` 위에서 컴포넌트 본문에 navbar를 직접 렌더. `ReactNavigationNavbar`는 React Navigation `screenOptions` 슬롯용으로 본 추상화 위에서 사용 시 추가 보일러플레이트 발생.
- **YAGNI — 공통 래퍼 보류**: Phase 2 화면 2개뿐. 추출은 중복이 실제로 나타날 때(Phase 3에서 4~5개 화면 도달 시점) 결정.

### D13 cast 2곳 한시 통과

- **격리 범위 최소**: cast는 fetch 호출의 RequestInit 빌드 한 행에만 격리. 다른 모듈·다른 호출 전파 0건(qa §8B grep). Phase 1 동결 코드 본질 로직(에러 매핑·401 재시도·zod·SDK 격리·Provider 마운트)에 0건 영향.
- **런타임 영향 0**: 두 타입은 동일 globalThis.AbortSignal 객체. cast는 TS 인지 차이만 좁힘.
- **광범위 변경 회피**: `lib: ["ESNext"]` 제거 시 ESNext built-in(Promise/Map/Set/iterators/`AbortController`/`URL`/`TextDecoder` 등) 가용성을 react-native types만으로 보장 가능한지 미검증 — ADR-010 D6(`import.meta.env` 사용) 안정성과 Phase 1 typecheck PASS에 회귀 위험. `types` 우선순위 활용은 TS의 lib·types 병합이 union이라 효과 없음.
- **2곳 적용 결정 근거**: §A.2 baseline 결정(`signal?: AbortSignal` 옵션 추가)이 동결된 시점에 apiFetch 측 fetch 호출에서 동일 충돌 발생은 자연 귀결. apiFetch에서 cast 제거 시 typecheck FAIL → `signal` 옵션 자체 후퇴 → 비스트리밍 폴백(08 §8.4.1) abort 불가 회귀.
- **격리 변경 우선 원칙**: ADR-010 D7(SDK 격리 단일 줄 한시 통과)과 같은 패턴. 추측 변경 금지 · 격리 한시 통과 · Phase 진입 시 정식 결정.

---

## 대안

### A. SSE를 `apiFetch`에 통합 (D8 대안)

- 장점: 호출점 단일화.
- 단점: 두 책임(JSON 단일 응답 vs stream 파싱) 결합. 401 재시도 정책이 SSE에 부적합(HTTP 200 + error 청크라 분기 불일치). ADR-010 D5(비스트리밍 한정 명시) 위배. 기각.

### B. 콜백 등록 / EventEmitter 시그니처 (D9 대안)

- 장점: 청크 도착 즉시 콜백 호출.
- 단점: 종료/cleanup이 호출자 책임이라 누락 가능, 청크 순서 보장이 약함, 단위 테스트 시 mock 복잡. 기각.

### C. 에러 청크를 호출 측 `for-await` 분기에서 처리 (D10 대안)

- 장점: 어댑터는 모든 청크를 균등하게 yield.
- 단점: 호출 측이 에러 분기를 두 군데(청크 분기 + try/catch)에 작성 → 중복/누락. 비스트리밍 경로(throw)와 SSE 경로(분기)의 에러 매핑 불일치. 기각.

### D. text 청크를 사용자에 표시 (D11 대안 — 웹과 동일)

- 장점: 점진 텍스트 UX.
- 단점: Gemini 부분 JSON 노출, Claude tool 모드에선 빈 화면. 디바운싱 복잡도 증가. 백엔드 결정 #6 위배. 기각.

### E. `ReactNavigationNavbar` 채택 (D12 대안)

- 장점: React Navigation `screenOptions`로 navbar 분리.
- 단점: 본 미니앱은 Granite `createRoute` 위에서 동작 — React Navigation `screenOptions`를 직접 다루지 않음. 추가 보일러플레이트 + 추상화 깨짐. 기각.

### F. 공통 래퍼 `AppNavbar.tsx` 즉시 추출 (D12 보완 대안)

- 장점: 화면 추가 시 일관성.
- 단점: Phase 2 화면 2개뿐 — 중복 미발생. YAGNI 위배. 기각 (Phase 3에서 화면 수 늘면 재검토).

### G. `lib: ["ESNext"]` 제거 (D13 대안 1)

- 장점: TS 타입 union 해소 → cast 제거.
- 단점: ESNext built-in 가용성을 react-native types만으로 보장 가능한지 미검증. ADR-010 D6 회귀 위험. Phase 1 typecheck PASS 상태 흔들림. 기각.

### H. tsconfig `types: ["react-native"]` 우선 적용 (D13 대안 2)

- 장점: 의도상 RN 타입 우선.
- 단점: TS의 lib·types 병합은 union이라 한쪽이 우선되지 않음. 효과 없음. 기각.

### I. `@types/node`의 `AbortSignal` 통합 시도 (D13 대안 3)

- 장점: Node `AbortSignal`이 lib.dom과 호환 형태.
- 단점: RN 환경에서 `@types/node` 도입은 별 globals 충돌 가능성. RN 0.84 + Granite 1.0.28에서 미검증. Phase 3 정식 검토 항목으로 보존.

---

## 결과

### 영향 받는 자산 (본 ADR로 동결)

- `src/services/sse-client.ts` — SSE → fetch+ReadableStream 어댑터. `streamRecipe` AsyncGenerator + parseSseEvents + extractChunk + `error` 청크 throw.
- `src/services/recipes.ts` — `generateRecipeStream` Facade 추가 + 기존 6 도메인 함수에 `signal?: AbortSignal` 옵션 추가.
- `src/services/api-client.ts` — `ApiFetchInit.signal?: AbortSignal` 옵션 추가 + fetch 호출에 §D13 cast 적용. apiFetch 본질(에러 매핑 + 401 재시도 + zod + raw unwrap) 변경 0건.
- `src/lib/zod/stream.ts` — `streamChunkSchema` discriminated union 5종 (`recipe` 청크는 Phase 1 `generatedRecipeSchema` 재사용).
- `src/hooks/useRecipeGenerate.ts` — 외부 인터페이스 (08 §8.3.2 그대로), 청크 분기, AbortController(명시 cancel + unmount cleanup), 비스트리밍 자동 폴백, 첫 청크 15s / 전체 90s 타임아웃.
- `src/components/{SearchForm,RecipeDisplay,NutritionPanel,recipe-format}.{tsx,ts}` — TDS primitives(Button/TextField/NumericSpinner/Badge/Txt/List/ListRow) + 순수 포맷 함수.
- `src/pages/index.tsx` — Phase 1 dev 트리거 일괄 제거 + PageNavbar + SearchForm.
- `src/pages/recipe/generate.tsx` — 신규. PageNavbar + SearchForm + 진행 인디케이터 + RecipeDisplay + NutritionPanel.

### 미니앱 인터페이스 (다음 Phase에서 의존)

- `streamRecipe(req, options): AsyncGenerator<StreamChunk>` — Phase 3 저장/목록/상세 흐름 중 생성 화면이 그대로 의존.
- `useRecipeGenerate()` — Phase 3가 저장 흐름(`saveRecipe` 호출 + `/recipe/[id]` 진입) 추가 시 본 훅의 외부 인터페이스 호환.
- `ApiFetchInit.signal?: AbortSignal` — Phase 3가 다른 도메인 호출의 abort 도입 시 그대로 사용.
- `<PageNavbar>` 사용 패턴 — Phase 3 화면(`my-recipes`, `recipe/[id]`) 추가 시 동일 패턴.

### 후속 결정으로 변경 가능 (다음 Phase 트리거)

| 결정 | 변경 트리거 | 변경 방향 |
|------|-----------|----------|
| D8 SSE 어댑터 분리 | Phase 3 다른 스트리밍 도입 시 | 공통 SSE 추상화로 확장 또는 본 모듈 그대로 재사용 |
| D9 AsyncGenerator | RN/Granite의 ReadableStream 미지원 확정 | 옵션 B(`react-native-sse`) 전환 — baseline §C.6 트리거 |
| D10 에러 청크 throw | Phase 3 다른 SSE/SSE-like 에러 형식 추가 | 어댑터 측 매핑 확장 (현 D10 유지) |
| D11 text 청크 미표시 | 백엔드가 text 청크에 완성된 문장을 보내는 새 정책 (별 저장소 후속 ADR) | 표시 정책 재검토 (선택적 표시 옵션) |
| D12 PageNavbar + 공통 래퍼 미작성 | Phase 3에서 화면 4~5개 도달 | 공통 래퍼 추출 결정 |
| D13 cast 2곳 한시 통과 | (a) `lib` 제거 + ESNext built-in 검증 PASS / (b) RN types 갱신 / (c) 다른 정식 해법 발견 | 2곳 동시 cast 제거 + tsconfig 정리 |
| **신규 — Phase 3 결정 일괄** | Phase 3 진입 (2026-05-24) | **[ADR-012](./ADR-012-miniapp-phase3-routing-cache-404.md) D14~D18** — Phase 2 동결(D8~D13) 위에 저장·목록·상세 라우팅 + 캐시 무효화 + 404 단일 컴포넌트 + 단순 페이지네이션 누적. 본 ADR D11(text 청크 미표시)·D12(PageNavbar)·D13(cast 2곳) 모두 Phase 3에서 유지(추가 cast 0건 검증 PASS). Phase 3 신규 코드는 SSE 0건 — D8~D10 직접 의존 0 |

### 미니앱이 알 필요가 없는 것 (재차 단언, Phase 2 baseline §D.2 격리)

본 ADR D8~D13 어느 결정도 다음을 알지 못한다 — 미니앱 코드·타입·테스트에 등장 금지:

- 백엔드 AI Provider 선택(Gemini/Claude) — 04-AI-PROVIDER. 미니앱은 호출만.
- 옵션 P 매핑(`profiles` 테이블·`internal_user_id`·service role·RLS) — 05 §5.10.
- `userId` 응답 키 — 03 §3.10 #4.
- `text` 청크 delta의 의미적 해석 (부분 JSON 파싱 시도) — 08 §8.3.5.
- `recipe.id` (저장 전 `GeneratedRecipe`는 id 없음) — 03 §3.10 #5.

---

## 검증

본 ADR이 채택된 시점에서 다음이 확인되어 있다 (`_workspace/03_qa_report.md` 인용):

- **AC2.1**~**AC2.6** 코드 경로 6/6 PASS (실호출 4건은 백엔드 옵션 P 배포 후)
- **03 §3.10** 본 Phase 적용 7건 PASS (15건 중)
- **06 §6.7** 6건 PASS
- **07 §7.9** 5건 PASS (+ 하드웨어 백 1건 Phase 2 선택)
- **08 §8.9** 7건 PASS (+ 첫 sse 호출 dev server 시점 검증 1건)
- **baseline §B.1** TDS 8종 실재성 PASS
- **baseline §D.2** Phase 2 격리 단언 10건 PASS
- **baseline §D.3** AbortSignal cast 격리 4건 PASS (적용 범위 2곳 확정 후)
- **통합 스윕** 12건 PASS (Phase 1 5 + Phase 2 5 + §D.3 2)
- **FAIL 누적 0건**

---

## 롤백

- **R1. RN `Response.body` / `TextDecoder` 미지원 환경 확정** (baseline §C.6 검증 미지원): D8/D9 어댑터 옵션 A → 옵션 B(`react-native-sse`) 전환. 본 ADR D8/D9의 외부 인터페이스(AsyncGenerator + StreamChunk)는 어댑터 내부에서 옵션 B SSE 라이브러리 위에 동일 모양으로 재구성 — 호출 측 훅·페이지 변경 0건. 본 ADR은 superseded되지 않고 D8/D9 구현 메커니즘만 교체.
- **R2. 백엔드가 `text` 청크에 완성된 의미 단위를 보내는 새 정책 도입** (별 저장소 후속 ADR): D11 미표시 정책을 선택적 표시 옵션으로 보강 (별 ADR). 본 ADR D11은 RN 컨텍스트 기본값으로 유지.
- **R3. `PageNavbar` API breaking change** (TDS 메이저 업데이트): D12 채택 자체는 유효, compound API 사용 위치(`pages/index.tsx`·`pages/recipe/generate.tsx`)와 06 §6.4.6 표를 갱신.
- **R4. `AbortSignal` 정식 해소 가능** (D13 해소 조건 (a)/(b)/(c) 충족): D13의 cast 2곳 동시 제거 + tsconfig 정리. 본 ADR D13은 superseded(한시 통과의 본질이 해소). 그 시점에 ADR-010 D6도 함께 정리 검토.

---

## 참고 ADR

- [ADR-001 (Supabase + Repository + Mapper + RLS)](./ADR-001-supabase.md) — 백엔드 격리. 본 ADR D10의 응답 검증이 ADR-001 Mapper 회귀의 안전망 확장.
- [ADR-002 (AI Adapter + Facade + Factory)](./ADR-002-ai-adapter.md) — 백엔드 격리. 본 ADR D11의 text 청크 정책이 ADR-002의 Provider 모드(Gemini 부분 JSON / Claude tool) 결정의 RN 컨텍스트 반영.
- [ADR-005 (소유권 위반 404)](./ADR-005-ownership-violation-404.md) — `ApiErrorCode`의 `FORBIDDEN` 예약 코드. 본 ADR D10의 단일 매핑이 ADR-005의 404 통일 정책과 정합.
- [ADR-008 (Gemini 기본 + Claude 비활성 보존)](./ADR-008-gemini-default-with-claude-fallback.md) — 본 ADR D11(text 청크 미표시)이 ADR-008의 Provider 차이 흡수 결정의 RN 측 귀결.
- [ADR-009 (앱인토스 미니앱 포팅)](./ADR-009-appsintoss-port-architecture.md) — 본 ADR D8~D13 모두 ADR-009 D4(미니앱/백엔드 분리) + D5(헤더 인증) 기반 위에서 동작.
- [ADR-010 (미니앱 Phase 1 공유 인프라)](./ADR-010-miniapp-phase1-conventions.md) — 본 ADR이 Phase 1 동결(D1~D7)을 그대로 유지하며 Phase 2 산출을 그 위에 누적. D5 비스트리밍 한정 → D8 SSE 별 모듈 분리로 확장. D7 SDK 한시 통과 → D13 cast 한시 통과로 격리 패턴 계승. **양방향 참조**: ADR-010 §결과 표의 "후속 결정으로 변경 가능" 행에 본 ADR-011 참조 추가 필요(별 갱신).

---

## 참고 SSOT

- `_workspace/01_architect_phase2_baseline.md` — Phase 2 baseline (§A 산출 매핑, §B TDS 실재성, §C SSE 어댑터 구조, §D.1~D.3 격리, §F.2 결정 카탈로그, §H AC 매핑).
- `_workspace/02_api_client_summary.md` — api-client 산출 요약 (D8/D9/D10/D13 구현 인덱스 + cast 격리 정책 표).
- `_workspace/02_frontend_summary.md` — frontend 산출 요약 (D11/D12 구현 인덱스 + 화면 구성).
- `_workspace/03_qa_report.md` — Phase 2 QA 매트릭스 (본 ADR 검증 근거).
- `docs/appsintoss-port/03-API-CONTRACT.md` §3.2.4·§3.10 — SSE wire 형식 + 경계면 불변식.
- `docs/appsintoss-port/04-AI-PROVIDER.md` §4.3.3·§4.4.3·§4.5.3 — Gemini/Claude 차이 + 4자 정합 단언.
- `docs/appsintoss-port/06-UI-MAPPING.md` §6.4.6 — PageNavbar 채택 (2026-05-24 본 ADR 채택과 동시 갱신).
- `docs/appsintoss-port/07-ROUTING.md` §7.3.1·§7.3.2·§7.8 — Granite 라우팅 + 화면별 Navbar 분산.
- `docs/appsintoss-port/08-STREAMING.md` §8.3·§8.4·§8.5·§8.9 — SSE 클라이언트 사양 + AbortController + 폴백.
