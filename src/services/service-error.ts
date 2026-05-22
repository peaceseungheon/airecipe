/**
 * ServiceError — 비즈니스 로직 계층의 도메인 오류.
 * Route Handler가 ApiErrorCode + HTTP 상태로 매핑한다(src/lib/api-response.ts).
 * 계약 0.2의 ApiErrorCode와 1:1 대응한다.
 */
import type { ApiErrorCode } from "@/types";

export class ServiceError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
