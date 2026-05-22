/**
 * 서버용 Supabase 클라이언트 팩토리 (@supabase/ssr).
 * Route Handler / Server Component에서 세션 쿠키 기반으로 사용한다.
 * 출처: _workspace/01_architect_architecture.md 6절, ADR-001.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 요청 컨텍스트(쿠키)에 묶인 Supabase 클라이언트를 생성한다.
 * RLS가 auth.uid()를 인식하도록 세션 쿠키를 전달한다.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Route Handler/Server Action에서는 쓰기 가능, RSC에서는 무시될 수 있음.
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component 렌더 중 set 호출은 미들웨어가 세션 갱신을 담당하므로 무시.
          }
        },
      },
    },
  );
}
