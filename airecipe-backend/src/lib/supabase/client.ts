/**
 * 브라우저용 Supabase 클라이언트 팩토리 (@supabase/ssr).
 * Client Component에서 인증(로그인/회원가입/로그아웃)에 사용한다.
 * anon key만 사용 — service role key는 절대 클라이언트에 노출하지 않는다.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
