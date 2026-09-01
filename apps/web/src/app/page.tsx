import { Button } from "@coledia/ui";

export default function MarketingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-sm font-medium text-[var(--muted-foreground)]">
          Made for clubs, teams &amp; small businesses
        </span>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Connecting Knowledge.{" "}
          <span className="text-brand-gradient">Empowering Futures.</span>
        </h1>
        <p className="max-w-2xl text-lg text-[var(--muted-foreground)]">
          Coledia brings learning, community and organization onto one modern
          platform — without the enterprise price tag.
        </p>
        <div className="flex gap-4">
          <Button size="lg">Start for free</Button>
          <Button size="lg" variant="outline">
            See how it works
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          { value: "120+", label: "Clubs & teams on board" },
          { value: "8k", label: "Active members" },
          { value: "98%", label: "Would recommend us" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"
          >
            <span className="text-3xl font-bold text-brand-gradient">
              {stat.value}
            </span>
            <span className="text-sm text-[var(--muted-foreground)]">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
