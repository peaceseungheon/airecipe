/**
 * 미니앱용 식별자 타입 — baseline §A.3 / 05-AUTH §5.2.1, §5.10
 *
 * 미니앱은 이메일/세션 개념이 없다. 백엔드 웹의 User { id, email } 타입은
 * 미니앱에 들이지 않는다 (00-OVERVIEW 0.5 인용).
 *
 * hash 노출 금지 (09 §9.5): UI/로깅 평문 포함 금지.
 */

export type TossUserId = string;

export interface TossUserIdentity {
  tossUserId: TossUserId;
}
