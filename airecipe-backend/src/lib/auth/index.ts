/**
 * Auth 모듈 barrel — 새 인증 진입점(`requireUser(request)`)과 Toss 매핑 어댑터.
 * 자세한 결정은 ADR-010, 시그니처는 `_workspace_option_p/01_architect_design.md` §1~§2.
 */
export { requireUser } from "./require-user";
export { resolveInternalUserId } from "./toss-user-resolver";
