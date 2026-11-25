"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, FileCode, GripVertical, Lock, Users } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { cn } from "@coledia/ui/lib/utils";
import { minPlanForFeature, PLAN_DETAILS, type FeatureKey } from "@coledia/shared";
import { navEntryId, type NavEntry } from "@/lib/navigation-config";
import { saveNavigation } from "@/lib/navigation-actions";

/**
 * Settings → Navigation: order (drag & drop or arrow buttons) and visibility
 * of the user sidebar. Disabled entries are hidden AND blocked for members.
 */
export function NavigationSettings({
  entries,
  planFeatures,
}: {
  entries: NavEntry[];
  planFeatures: Record<FeatureKey, boolean>;
}) {
  const t = useTranslations();
  const tn = useTranslations("navigationSettings");
  const [items, setItems] = useState<NavEntry[]>(entries);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function update(next: NavEntry[]) {
    setItems(next);
    setDirty(true);
    setMsg(null);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    update(next);
  }

  function toggle(index: number) {
    const item = items[index];
    if (item.kind === "module" && !item.canDisable) return;
    update(items.map((e, i) => (i === index ? { ...e, enabled: !e.enabled } : e)));
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await saveNavigation(
        items.map((e) =>
          e.kind === "module"
            ? { kind: "module" as const, key: e.key, enabled: e.enabled }
            : { kind: "page" as const, id: e.id, enabled: e.enabled },
        ),
      );
      setDirty(false);
      setMsg(tn("saved"));
    } catch {
      setMsg(tn("saveError"));
    }
    setSaving(false);
  }

  const hasPages = items.some((e) => e.kind === "page");

  return (
    <section className="max-w-3xl rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">{tn("title")}</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">{tn("description")}</p>

      <ul className="flex flex-col gap-2">
        {items.map((item, index) => {
          const locked =
            item.kind === "module"
              ? !!item.feature && !planFeatures[item.feature]
              : !planFeatures.customPages;
          const lockFeature: FeatureKey | undefined =
            item.kind === "module" ? item.feature : "customPages";
          const label = item.kind === "module" ? t(item.labelKey) : item.title;
          const canToggle = item.kind === "page" || item.canDisable;
          return (
            <li
              key={navEntryId(item)}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIndex !== null && dragIndex !== index) {
                  move(dragIndex, index);
                  setDragIndex(index);
                }
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2",
                dragIndex === index && "opacity-60",
                !item.enabled && "bg-muted/40",
              )}
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {item.kind === "page" && <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className={cn("truncate text-sm font-medium", !item.enabled && "text-muted-foreground line-through")}>
                  {label}
                </span>
                <code className="hidden truncate text-xs text-muted-foreground sm:inline">{item.href}</code>
                {item.kind === "page" && item.restricted && (
                  <span className="flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {tn("restricted")}
                  </span>
                )}
                {item.kind === "module" && !item.canDisable && (
                  <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {tn("alwaysOn")}
                  </span>
                )}
                {locked && lockFeature && (
                  <span className="flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    {PLAN_DETAILS[minPlanForFeature(lockFeature)].name}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  aria-label={tn("moveUp")}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, index + 1)}
                  disabled={index === items.length - 1}
                  aria-label={tn("moveDown")}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.enabled}
                  aria-label={item.enabled ? tn("enabled") : tn("hidden")}
                  disabled={!canToggle}
                  onClick={() => toggle(index)}
                  className={cn(
                    "relative ml-2 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
                    item.enabled ? "bg-primary" : "bg-muted-foreground/30",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white shadow transition",
                      item.enabled ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">
        {hasPages ? tn("disabledHint") : tn("pagesHint")}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" disabled={saving || !dirty} onClick={handleSave}>
          {saving ? tn("saving") : tn("save")}
        </Button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </div>
    </section>
  );
}
