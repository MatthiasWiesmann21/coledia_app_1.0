"use client";

import { useState, useTransition } from "react";
import {
  startPlanCheckout,
  startConnectOnboarding,
  openBillingPortal,
} from "@/lib/stripe-actions";

type ConnectStatus = {
  connected: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
} | null;

const PLAN_DETAILS: Record<string, { name: string; price: string; features: string[] }> = {
  starter: {
    name: "Starter",
    price: "Free",
    features: ["50 members", "1 GB storage", "Core community features"],
  },
  club: {
    name: "Club",
    price: "29 CHF/mo",
    features: ["250 members", "10 GB storage", "Custom branding", "Quizzes & certificates", "User groups", "Live events"],
  },
  organization: {
    name: "Organization",
    price: "69 CHF/mo",
    features: ["Unlimited members", "Unlimited storage", "Everything in Club", "API access & webhooks", "Custom pages", "Audit logs", "Sell courses (Stripe Connect)"],
  },
};

export function BillingPanel({
  plan,
  status,
  currentPeriodEnd,
  hasSubscription,
  isOwner,
  connectStatus,
}: {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  hasSubscription: boolean;
  isOwner: boolean;
  connectStatus: ConnectStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleUpgrade(newPlan: string) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await startPlanCheckout(newPlan);
        window.location.href = res.url;
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handleConnect() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await startConnectOnboarding();
        window.location.href = res.url;
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handlePortal() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await openBillingPortal();
        window.location.href = res.url;
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Current plan */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Current Plan</h2>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">{PLAN_DETAILS[plan]?.name ?? plan}</span>
          <span className="text-sm text-muted-foreground">{PLAN_DETAILS[plan]?.price}</span>
          {status !== "active" && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {status}
            </span>
          )}
        </div>
        {currentPeriodEnd && (
          <p className="mt-1 text-xs text-muted-foreground">
            Renews on {new Date(currentPeriodEnd).toLocaleDateString()}
          </p>
        )}
        {isOwner && hasSubscription && (
          <button
            onClick={handlePortal}
            disabled={pending}
            className="mt-3 rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Manage subscription
          </button>
        )}
      </div>

      {/* Plan options */}
      {isOwner && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Object.entries(PLAN_DETAILS).map(([key, info]) => {
            const isCurrent = key === plan;
            const isUpgrade = ["starter", "club", "organization"].indexOf(key) >
              ["starter", "club", "organization"].indexOf(plan);
            return (
              <div
                key={key}
                className={`rounded-lg border p-4 ${isCurrent ? "border-primary bg-primary/5" : "border-border bg-card"}`}
              >
                <h3 className="text-sm font-semibold">{info.name}</h3>
                <p className="mb-3 text-lg font-bold">{info.price}</p>
                <ul className="mb-4 space-y-1 text-xs text-muted-foreground">
                  {info.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                {isCurrent ? (
                  <span className="block rounded-md bg-primary/10 py-1.5 text-center text-xs font-medium text-primary">
                    Current plan
                  </span>
                ) : (
                  <button
                    onClick={() => handleUpgrade(key)}
                    disabled={pending}
                    className="block w-full rounded-md bg-primary py-1.5 text-center text-xs font-medium text-primary-foreground disabled:opacity-40"
                  >
                    {isUpgrade ? "Upgrade" : "Switch"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stripe Connect (course sales) */}
      {isOwner && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Course Sales (Stripe Connect)</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Connect your Stripe account to sell paid courses. Payments go directly to your account,
            minus a platform fee.
          </p>
          {connectStatus?.connected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className={`rounded px-2 py-0.5 text-xs ${connectStatus.chargesEnabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
                  {connectStatus.chargesEnabled ? "Charges enabled" : "Setup incomplete"}
                </span>
              </div>
              <button
                onClick={handleConnect}
                disabled={pending}
                className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-40"
              >
                {connectStatus.detailsSubmitted ? "Update account" : "Complete setup"}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={pending}
              className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-40"
            >
              Connect with Stripe
            </button>
          )}
        </div>
      )}
    </div>
  );
}
