import { AppShell } from "@/components/app-shell";

// Always render dynamically so AppShell re-reads the user's locale
// from the database on every request (needed for language switching)
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
