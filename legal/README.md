# legal/ — 이용약관·개인정보처리방침 공개 정적 페이지

앱인토스 콘솔의 **이용약관 URL / 개인정보처리방침 URL** 칸에 등록하기 위한 공개 `https` 정적 페이지다. 빌드·의존성 0 — 순수 HTML/CSS.

| 파일 | 용도 |
|------|------|
| `terms.html` | 서비스 이용약관 (콘솔 "이용약관 URL"에 등록) |
| `privacy.html` | 개인정보처리방침 (콘솔 "개인정보처리방침 URL"에 등록) |
| `index.html` | 두 문서 목록 (선택 — 홈페이지 칸에 쓰거나 생략) |
| `style.css` | 공용 스타일 |

> ⚠️ **본문은 미니앱 인앱 페이지(`airecipe-miniapp/pages/terms.tsx`·`privacy.tsx`)와 동일한 텍스트의 사본**이다. 약관을 수정하면 **양쪽 모두** 갱신해야 한다(인앱 화면 + 이 정적 페이지). 단일 출처가 아님에 유의.

## 배포 방법 (아무거나 1개 — 모두 무료·https 자동)

### A. Vercel (정적, 추천)
```bash
cd legal
npx vercel        # 프리뷰 배포 → 확인 후
npx vercel --prod # 프로덕션 배포
```
- 빌드 설정 불필요(Other/static 자동 감지). 출력 디렉토리는 현재 폴더.
- 결과 예: `https://airecipe-legal.vercel.app/terms.html`, `.../privacy.html`
- ⚠️ 백엔드(`airecipe-backend`, API 전용)와는 **별개 프로젝트**로 배포한다. 백엔드에 섞지 말 것.

### B. GitHub Pages
- 이 `legal/` 내용을 임의 repo(또는 `/docs`)에 올리고 Settings → Pages 활성화.
- 결과 예: `https://<user>.github.io/<repo>/terms.html`

### C. Cloudflare Pages
- 대시보드 → Pages → Direct Upload로 `legal/` 폴더 업로드.
- 결과 예: `https://airecipe-legal.pages.dev/terms.html`

## 콘솔 등록 (배포 후)

앱인토스 콘솔의 URL 칸에 배포된 주소를 그대로 입력한다:

| 콘솔 칸 | 입력할 URL |
|---------|-----------|
| 이용약관 | `https://<배포도메인>/terms.html` |
| 개인정보처리방침 | `https://<배포도메인>/privacy.html` |

> 깔끔한 경로(`/terms`, `/privacy`)를 원하면 Vercel `vercel.json`의 `cleanUrls: true`를 추가하거나, 파일명을 `terms/index.html` 구조로 바꾼다(현재는 단순화를 위해 `.html` 그대로).

## 출시 전 확정 필요 (placeholder)

본문에 `<span class="todo">[ ]</span>`로 강조된 항목을 실제 값으로 교체해야 한다 (콘솔 등록값과 동기):

- `terms.html` 제10조 — `[관할 법원]` (사업자 소재지 기준)
- `privacy.html` 제7절 — `[보호책임자 성명·직책]`, `[고객센터 채널]`
- 사업자 법인명·대표자 등 식별 정보(필요 시 본문에 추가)

생성된 본문은 표준 보일러플레이트이므로 **실제 운영 형태에 맞춘 법무 검토 후 확정**을 권장한다. (근거: `airecipe-miniapp/docs/adr/ADR-020-legal-static-pages.md`)
