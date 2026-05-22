/**
 * useAuth — Supabase Auth(email+password) 상태 관리 훅.
 *
 * 책임(클라이언트 상태): 현재 세션 사용자 추적, 로그인/회원가입/로그아웃.
 * 출처: _workspace/01_architect_architecture.md 6절, 계약 0.3.
 *
 * 서버 세션은 쿠키 기반(@supabase/ssr)이며, 보호 페이지 가드는 proxy.ts(구 middleware 컨벤션, ADR-007)가 담당한다.
 * 이 훅은 클라이언트 UI(네비게이션 표시, 폼 동작)용 상태만 노출한다.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthError } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@/types";

export interface UseAuthResult {
  user: User | null;
  loading: boolean;
  /** 로그인. 성공 시 user 갱신, 실패 시 한국어 메시지 반환. */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** 회원가입. 성공 시 user 갱신(또는 이메일 확인 필요), 실패 시 메시지 반환. */
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  /** 로그아웃. */
  signOut: () => Promise<void>;
}

function authErrorMessage(error: AuthError): string {
  // Supabase 영문 메시지를 사용자 친화 한국어로 매핑(주요 케이스만, 나머지는 원문).
  const msg = error.message.toLowerCase();
  if (msg.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (msg.includes("user already registered")) {
    return "이미 가입된 이메일입니다.";
  }
  if (msg.includes("password should be at least")) {
    return "비밀번호는 최소 6자 이상이어야 합니다.";
  }
  if (msg.includes("email") && msg.includes("invalid")) {
    return "올바른 이메일 형식이 아닙니다.";
  }
  return error.message;
}

export function useAuth(): UseAuthResult {
  // 클라이언트 한정: 컴포넌트 생명주기 동안 단일 클라이언트 인스턴스 유지.
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(
        data.user ? { id: data.user.id, email: data.user.email ?? "" } : null,
      );
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? "" } : null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error ? authErrorMessage(error) : null };
    },
    [supabase],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error ? authErrorMessage(error) : null };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  return { user, loading, signIn, signUp, signOut };
}
