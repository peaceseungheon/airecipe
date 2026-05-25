/**
 * Service-role Supabase 클라이언트 팩토리 — ADR-010 D4.
 *
 * RLS 를 우회하므로 **반드시 헤더 경로(미니앱)에서만** 사용한다.
 * 격리는 애플리케이션 레이어에서 강제 — repository 가 `.eq('user_id', internalUserId)`
 * 필터를 부착한다. (이미 SupabaseRecipeRepository 가 모든 메서드에 필터를 두고 있음.)
 *
 * 환경변수: `SUPABASE_SERVICE_ROLE_KEY` (서버 전용). 클라이언트 번들 금지 — 본 모듈은
 * Route Handler/Service 계층에서만 import 한다.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _serviceRoleClient: SupabaseClient | null = null;

/**
 * service-role 키로 인증된 Supabase 클라이언트를 반환한다(프로세스 싱글턴).
 *
 * 쿠키 경로(웹앱) 와는 별 인스턴스다 — 세션 컨텍스트가 없으므로 요청별로
 * 새 클라이언트를 만들 필요가 없다.
 *
 * @throws Error 환경변수 누락 시.
 */
export function createSupabaseServiceRoleClient(): SupabaseClient {
  if (_serviceRoleClient) return _serviceRoleClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service-role 환경변수가 설정되지 않았습니다 " +
        "(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  _serviceRoleClient = createClient(url, serviceKey, {
    auth: {
      // 서버 전용 클라이언트 — 세션 지속/자동 갱신 불필요.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return _serviceRoleClient;
}
