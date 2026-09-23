"use client";
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../lib/utils";

/* Radix Select does not allow items with an empty-string value; options using
 * `""` (e.g. "No category") are remapped through this sentinel. */
const EMPTY_VALUE = "__empty__";

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: "default" | "sm";
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  /** Classes applied to the trigger button. */
  className?: string;
  /** Class for the positioning wrapper (e.g. "w-auto" for inline filters). */
  wrapperClassName?: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  size = "default",
  disabled,
  id,
  className,
  wrapperClassName,
  "aria-label": ariaLabel,
}: SelectProps) {
  const hasEmptyOption = options.some((o) => o.value === "");
  const internalValue =
    value === "" && hasEmptyOption
      ? EMPTY_VALUE
      : value === ""
        ? undefined
        : value;

  return (
    <div
      className={cn(
        size === "default" ? "w-full" : "inline-block",
        wrapperClassName,
      )}
    >
      <SelectPrimitive.Root
        value={internalValue}
        onValueChange={(v) => onValueChange(v === EMPTY_VALUE ? "" : v)}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          id={id}
          aria-label={ariaLabel}
          className={cn(
            "flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-left text-[var(--foreground)] transition-colors hover:border-[var(--muted-foreground)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-[var(--muted-foreground)] [&>span]:truncate",
            size === "default"
              ? "h-10 w-full px-3 text-sm"
              : "h-7 w-auto pl-2 pr-1.5 text-xs",
            className,
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown
              className={cn(
                "shrink-0 text-[var(--muted-foreground)]",
                size === "default" ? "h-4 w-4" : "h-3.5 w-3.5",
              )}
            />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1"
          >
            <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-[var(--muted-foreground)]">
              <ChevronUp className="h-3.5 w-3.5" />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="p-1">
              {options.map((o) => (
                <SelectPrimitive.Item
                  key={o.value === "" ? EMPTY_VALUE : o.value}
                  value={o.value === "" ? EMPTY_VALUE : o.value}
                  disabled={o.disabled}
                  className="relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-2 pr-8 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-[var(--tenant-primary)]/10 data-[highlighted]:text-[var(--tenant-primary)] data-[disabled]:opacity-50"
                >
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
                    <Check className="h-4 w-4 text-[var(--tenant-primary)]" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-[var(--muted-foreground)]">
              <ChevronDown className="h-3.5 w-3.5" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
