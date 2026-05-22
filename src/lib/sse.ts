/**
 * SSE(Server-Sent Events) 인코딩 헬퍼 — 계약 1.3의 wire 형식.
 * 각 이벤트: `event: <type>\n` + `data: <json>\n\n`.
 * StreamChunk를 그대로 직렬화하므로 프론트는 type으로 분기한다.
 */
import type { StreamChunk } from "@/types";

/** StreamChunk 1건을 SSE wire 문자열로 인코딩한다. */
export function encodeSSE(chunk: StreamChunk): string {
  return `event: ${chunk.type}\ndata: ${JSON.stringify(chunk)}\n\n`;
}
