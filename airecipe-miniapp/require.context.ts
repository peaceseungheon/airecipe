// pages/ 라우팅 루트를 스캔해 라우트를 자동 등록한다.
// 정규식 필터(/\.tsx$/) 필수: 없으면 pages/AGENTS.md 같은 비-.tsx 파일까지 로드를 시도해
// 번들러가 "No loader is configured for .md files"로 빌드 실패한다. .tsx 라우트만 매칭할 것.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const context = require.context('./pages', true, /\.tsx$/);
