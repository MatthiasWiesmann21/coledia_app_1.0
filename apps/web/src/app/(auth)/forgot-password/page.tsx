"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Could not send reset email");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            We&apos;ve sent a password reset link to{" "}
            <span className="font-medium text-[var(--foreground)]">{email}</span>
          </p>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Didn&apos;t receive an email? Check your spam folder or{" "}
          <button
            onClick={() => setSent(false)}
            className="font-medium text-[var(--tenant-primary)] hover:underline"
          >
            try again
          </button>
        </p>
        <Link
          href="/sign-in"
          className="text-sm font-medium text-[var(--tenant-primary)] hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold">Forgot password?</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <Link
        href="/sign-in"
        className="text-center text-sm font-medium text-[var(--tenant-primary)] hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}
