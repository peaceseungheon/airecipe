/**
 * AuthForm — 로그인/회원가입 공용 폼 (presentational + 콜백).
 * 이메일+비밀번호 입력, 제출 시 onSubmit으로 위임. 인증 로직은 상위(useAuth) 담당.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

interface AuthFormProps {
  mode: "login" | "signup";
  /** 성공/실패는 error 문자열(또는 null)로 반환. */
  onSubmit: (email: string, password: string) => Promise<{ error: string | null }>;
  /** 성공 후 후처리(리다이렉트 등). */
  onSuccess: () => void;
}

export function AuthForm({ mode, onSubmit, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submitLabel = mode === "login" ? "로그인" : "회원가입";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const { error: err } = await onSubmit(email.trim(), password);
      if (err) {
        setError(err);
        return;
      }
      onSuccess();
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="space-y-1.5">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="6자 이상"
          disabled={pending}
        />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner /> : submitLabel}
      </Button>
    </form>
  );
}
