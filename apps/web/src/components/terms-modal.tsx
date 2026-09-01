"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@coledia/ui/button";
import { acceptTerms } from "@/lib/actions";

export function TermsModal({
  userId,
  needsTerms,
}: {
  userId: string;
  needsTerms: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (needsTerms) setOpen(true);
  }, [needsTerms]);

  async function handleAccept() {
    setLoading(true);
    try {
      await acceptTerms();
      setOpen(false);
      router.refresh();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
        <h2 className="text-xl font-bold">Privacy Policy & Terms of Use</h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Before you continue, please review and accept our Privacy Policy and
          Terms of Use. By clicking &quot;Accept&quot;, you agree to these terms.
        </p>

        <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
          <p className="mb-2 font-medium text-[var(--foreground)]">
            Privacy Policy
          </p>
          <p className="mb-3">
            We collect and process your data solely for the purpose of providing
            the platform services. Your email address is used for authentication
            and communication. Your profile information is visible to other
            members of your community.
          </p>
          <p className="mb-2 font-medium text-[var(--foreground)]">
            Terms of Use
          </p>
          <p>
            You agree to use the platform responsibly and not to post harmful,
            illegal, or abusive content. The platform owner reserves the right
            to remove content and suspend accounts that violate these terms.
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              router.push("/sign-in");
            }}
            className="flex-1"
          >
            Decline
          </Button>
          <Button onClick={handleAccept} disabled={loading} className="flex-1">
            {loading ? "Accepting..." : "Accept & Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
