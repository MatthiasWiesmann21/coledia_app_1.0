import Link from "next/link";

export function NotFoundContent({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 p-6 text-center ${
        fullScreen ? "min-h-screen bg-background text-foreground" : "min-h-[60vh]"
      }`}
    >
      <p className="text-5xl font-bold text-muted-foreground">404</p>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you are looking for doesn&apos;t exist or you don&apos;t have access to it.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-lg bg-(--tenant-primary) px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
