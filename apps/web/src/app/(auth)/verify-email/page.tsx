"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import Link from "next/link";
import { Suspense } from "react";

function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token && !otp) {
      setError("Invalid verification link");
      return;
    }

    setLoading(true);

    const result = await authClient.verifyEmail({
      query: { token: token ?? otp },
    });

    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Could not verify email");
      return;
    }

    router.push("/sign-in");
    router.refresh();
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Enter your email address");
      return;
    }

    setResending(true);
    await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}/verify-email`,
    });
    setResending(false);
    setResent(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold">Verify your email</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {token
            ? "Click below to verify your email address"
            : "Enter the verification code sent to your email"}
        </p>
      </div>

      <form onSubmit={handleVerify} className="flex flex-col gap-4">
        {!token && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="otp">Verification code</Label>
            <Input
              id="otp"
              type="text"
              placeholder="Enter code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Verifying..." : "Verify email"}
        </Button>
      </form>

      {resent ? (
        <p className="text-center text-sm text-[var(--muted-foreground)]">
          Verification email sent to{" "}
          <span className="font-medium text-[var(--foreground)]">{email}</span>.
          Check your inbox.
        </p>
      ) : (
        <form
          onSubmit={handleResend}
          className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-4"
        >
          <p className="text-sm text-[var(--muted-foreground)]">
            Didn&apos;t receive an email? Resend verification:
          </p>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button
            type="submit"
            variant="outline"
            disabled={resending}
            size="sm"
          >
            {resending ? "Sending..." : "Resend verification email"}
          </Button>
        </form>
      )}

      <Link
        href="/sign-in"
        className="text-center text-sm text-[var(--muted-foreground)] hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8 text-sm text-[var(--muted-foreground)]">
          Loading...
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
