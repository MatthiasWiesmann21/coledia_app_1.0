import { cn } from "@coledia/ui/lib/utils";

/** Round avatar with initial fallback and optional online dot. */
export function ChatAvatar({
  name,
  avatarUrl,
  size = "md",
  online,
  className,
}: {
  name: string;
  avatarUrl: string | null;
  size?: "xs" | "sm" | "md";
  online?: boolean;
  className?: string;
}) {
  const box = size === "xs" ? "h-4 w-4 text-[8px]" : size === "sm" ? "h-6 w-6 text-xs" : "h-9 w-9 text-sm";
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className={cn(box, "rounded-full object-cover")} />
      ) : (
        <span className={cn(box, "flex items-center justify-center rounded-full bg-primary font-medium text-white")}>
          {name.charAt(0).toUpperCase() || "?"}
        </span>
      )}
      {online !== undefined && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
            online ? "bg-green-500" : "bg-muted-foreground/40",
          )}
        />
      )}
    </span>
  );
}
