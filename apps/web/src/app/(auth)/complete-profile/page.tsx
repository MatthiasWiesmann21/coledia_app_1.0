"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { updateProfile } from "@/lib/actions";

export default function CompleteProfilePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await updateProfile({ username, bio });
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError("Could not save profile");
    }
    setLoading(false);
  }

  function handleSkip() {
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-lg">
        <div className="mb-6 flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-bold">Complete your profile</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Help others find you by filling out your profile
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="bio">Bio (optional)</Label>
            <textarea
              id="bio"
              placeholder="Tell us about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="flex w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving..." : "Save profile"}
          </Button>
        </form>

        <button
          onClick={handleSkip}
          className="mt-4 w-full text-center text-sm text-[var(--muted-foreground)] hover:underline"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
