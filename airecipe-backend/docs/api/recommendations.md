# API — `POST /api/recommendations`

테마(상황·날씨) 기반 요리 **5개** 추천. 인증 보호 · AI 호출 · 비-stream JSON.

- 관련 ADR: [ADR-011](../adr/ADR-011-recommendations.md)
- 계약 SSOT(상위): 미니앱 `airecipe-miniapp/src/lib/zod/recommendations.ts`, `airecipe-miniapp/docs/appsintoss-port/03-API-CONTRACT.md §3.8`, 미니앱 ADR-016
- 구현: `src/app/api/recommendations/route.ts` → `RecommendationService` → `AIRecommendationProvider`(Gemini/Claude) → 프롬프트 + 구조화 스키마 + zod 재검증
- 서버 무상태(D-R8): DB write 없음. 캐싱은 클라이언트 책임.

## 인증

보호 엔드포인트(옵션 P, ADR-010). 요청에 다음 중 하나 필요:

- `X-Toss-User-Id` 헤더(미니앱) — internal uuid로 매핑.
- 쿠키 세션(웹앱).

둘 다 없으면 **401 UNAUTHORIZED**. 인증은 본문 검증보다 **먼저** 평가된다(헤더 없으면 본문이 잘못돼도 401).

## 요청

`Content-Type: application/json`

```jsonc
{
  "theme": {
    "situation": "dinner", // 선택. enum: lunch|dinner|midnight|gathering|solo|special
    "weather": "cold"      // 선택. enum: hot|cold|rainy|sunny|chilly
  }
}
```

- `theme.situation`·`theme.weather`는 각각 선택이지만 **최소 1축**은 있어야 한다(refine). 둘 다 없으면 400.
- enum 외 값 → 400.

## 응답 (200)

계약 래퍼 `{ data: ... }`. `items`는 **정확히 5개**.

```jsonc
{
  "data": {
    "items": [
      {
        "dishName": "김치찌개",          // 1~60자
        "description": "추운 날 속을 데우는 얼큰한 한 그릇.", // 1~120자
        "tags": ["국물", "얼큰", "한식"]  // 0~5개, 각 1~16자
      }
      // ... 총 5개
    ],
    "meta": {
      "theme": { "situation": "dinner", "weather": "cold" }, // 요청 theme echo
      "generatedAt": "2026-05-29T12:34:56.789Z"              // 서버 생성 ISO 문자열
    }
  }
}
```

- `meta.theme`는 검증 통과한 요청 theme를 그대로 echo. `meta.generatedAt`은 서버에서 `new Date().toISOString()`로 생성.
- AI는 `items`만 생성하고, 받은 직후 서버 zod(`recommendationItemsSchema.length(5)`)로 재검증한다. shape/개수 위반 시 502.

## 에러

| HTTP | code | 발생 조건 |
|------|------|----------|
| 400 | `VALIDATION_ERROR` | JSON 파싱 실패, theme 누락/빈 객체, 잘못된 enum |
| 401 | `UNAUTHORIZED` | 인증 헤더·세션 없음 |
| 429 | `AI_RATE_LIMITED` | AI provider 레이트 리밋(429) |
| 502 | `AI_PROVIDER_ERROR` | AI 호출 실패 / AI 응답이 스키마(5개·길이) 불일치 |
| 500 | `INTERNAL_ERROR` | 기타 서버 오류(사용자 매핑 실패 포함) |

에러 본문: `{ "error": { "code": "...", "message": "..." } }`. (`AI_ERROR` 코드는 존재하지 않음.)

## CORS

- `OPTIONS` → 204 + CORS 헤더(`corsPreflightResponse`).
- 모든 POST 응답은 `withCors(response, request)`로 감싼다.
- Allow-Headers: `Content-Type, X-Toss-User-Id, Accept`. Allow-Methods: `GET, POST, PATCH, DELETE, OPTIONS`(SSOT).
- 허용 origin은 env `APPSINTOSS_ALLOWED_ORIGINS`(콤마 구분). 배포 시 미니앱 prod/staging origin 등록 필요.

## Provider 전환

`AI_PROVIDER` 환경변수: 미설정 또는 `gemini`(기본) / `claude`(롤백). 두 경로 응답 shape 동일.
모델 override: `GEMINI_MODEL` / `ANTHROPIC_MODEL`. 키: `GEMINI_API_KEY` / `ANTHROPIC_API_KEY`.
