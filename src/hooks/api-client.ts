/**
 * 프론트엔드 API 클라이언트 — 계약(_workspace/01_architect_api_contract.md) 0.1/0.2 규약을 단일 위치에서 처리.
 *
 * 책임:
 * - 성공 응답 `{ data, meta? }`에서 `.data`(와 `.meta`)를 unwrap.
 * - 에러 응답 `{ error: { code, message } }`를 `ApiClientError`로 변환(코드 분기 가능).
 * - 네트워크/파싱 실패도 동일한 에러 형태로 정규화.
 *
 * 주의: 임의 제네릭 캐스팅으로 응답 shape을 추측하지 않는다. 호출부가 `@/types`의
 * 실제 응답 타입(ApiResponse<T>/ApiListResponse<T>)을 명시한다.
 */
import type {
  ApiError,
  ApiErrorCode,
  ApiListResponse,
  ApiResponse,
  ListMeta,
} from "@/types";

/** 계약의 통일 에러를 코드 분기 가능한 예외로 표현 */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode | "NETWORK_ERROR" | "PARSE_ERROR";
  readonly status: number;

  constructor(code: ApiClientError["code"], message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

function isApiError(body: unknown): body is ApiError {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as ApiError).error?.code === "string"
  );
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** 응답이 에러면 ApiClientError를 throw, 아니면 파싱된 본문을 반환 */
async function ensureOk(res: Response): Promise<unknown> {
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    if (isApiError(body)) {
      throw new ApiClientError(body.error.code, body.error.message, res.status);
    }
    throw new ApiClientError(
      "INTERNAL_ERROR",
      `요청이 실패했습니다 (HTTP ${res.status}).`,
      res.status,
    );
  }
  return body;
}

/** 단건 응답 `{ data: T }`에서 T를 unwrap */
export async function requestData<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiClientError(
      "NETWORK_ERROR",
      "서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.",
      0,
    );
  }
  const body = await ensureOk(res);
  return (body as ApiResponse<T>).data;
}

/** 목록 응답 `{ data: T[], meta }`에서 data와 meta를 함께 반환 */
export async function requestList<T>(
  input: string,
  init?: RequestInit,
): Promise<{ data: T[]; meta: ListMeta }> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new ApiClientError(
      "NETWORK_ERROR",
      "서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.",
      0,
    );
  }
  const body = await ensureOk(res);
  const list = body as ApiListResponse<T>;
  return { data: list.data, meta: list.meta };
}

/** SWR fetcher — 목록 키에 사용. 반환은 unwrap된 { data, meta }. */
export function listFetcher<T>(url: string) {
  return requestList<T>(url);
}

/** 사람이 읽는 에러 메시지 추출(컴포넌트 표시용) */
export function toErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "알 수 없는 오류가 발생했습니다.";
}
