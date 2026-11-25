"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import Link from "next/link";
import { Suspense } from "react";

const RESEND_COOLDOWN_S = 60;

/**
 * Signed-in but unverified member of a community that requires email
 * verification (AppShell redirects here with ?pending=1).
 */
function PendingVerification() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    authClient
      .getSession()
      .then((res) => setEmail(res.data?.user.email ?? null))
      .finally(() => setIsPending(false));
  }, []);

  async function handleResend() {
    if (!email) return;
    setSending(true);
    setMessage(null);
    const res = await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" });
    setSending(false);
    setMessage(res.error ? (res.error.message ?? "Could not send the email") : "Verification email sent.");
    if (!res.error) setCooldown(RESEND_COOLDOWN_S);
  }

  function handleContinue() {
    setChecking(true);
    // AppShell re-checks the verification state and sends us back if needed
    router.replace("/dashboard");
    router.refresh();
  }

  async function handleSwitchAccount() {
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">
          This community requires a verified email address.{" "}
          {isPending ? (
            "Loading…"
          ) : email ? (
            <>
              We sent a verification link to{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </>
          ) : (
            "Please sign in again."
          )}
        </p>
      </div>

      {message && (
        <p className="rounded-lg bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <Button onClick={handleContinue} disabled={checking} className="w-full">
        {checking ? "Checking..." : "I've verified my email"}
      </Button>
      <Button
        variant="outline"
        onClick={handleResend}
        disabled={!email || sending || cooldown > 0}
        className="w-full"
      >
        {sending
          ? "Sending..."
          : cooldown > 0
            ? `Resend email (${cooldown}s)`
            : "Resend verification email"}
      </Button>
      <button
        type="button"
        onClick={handleSwitchAccount}
        className="text-center text-sm text-muted-foreground hover:underline"
      >
        Use a different account
      </button>
    </div>
  );
}

function VerifyEmailSwitch() {
  const params = useSearchParams();
  return params.get("pending") === "1" ? <PendingVerification /> : <VerifyEmailForm />;
}

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

    // autoSignInAfterVerification is enabled — the user is signed in now.
    router.push("/dashboard");
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
      callbackURL: `${window.location.origin}/dashboard`,
    });
    setResending(false);
    setResent(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold">Verify your email</h1>
        <p className="text-sm text-muted-foreground">
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
        <p className="text-center text-sm text-muted-foreground">
          Verification email sent to{" "}
          <span className="font-medium text-foreground">{email}</span>.
          Check your inbox.
        </p>
      ) : (
        <form
          onSubmit={handleResend}
          className="flex flex-col gap-3 rounded-lg border border-border p-4"
        >
          <p className="text-sm text-muted-foreground">
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
        className="text-center text-sm text-muted-foreground hover:underline"
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
        <div className="flex justify-center p-8 text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <VerifyEmailSwitch />
    </Suspense>
  );
}
