"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: "default" | "sm";
  /** Class for the positioning wrapper div (e.g. "w-auto" for inline filters). */
  wrapperClassName?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, size = "default", children, ...props }, ref) => {
    return (
      <div
        className={cn(
          "relative",
          size === "default" ? "w-full" : "inline-block",
          wrapperClassName,
        )}
      >
        <select
          ref={ref}
          className={cn(
            "appearance-none rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            size === "default"
              ? "flex h-10 w-full px-3 pr-9 py-2 text-sm"
              : "h-7 pl-2 pr-7 text-xs",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]",
            size === "default" ? "right-3 h-4 w-4" : "right-1.5 h-3.5 w-3.5",
          )}
        />
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
