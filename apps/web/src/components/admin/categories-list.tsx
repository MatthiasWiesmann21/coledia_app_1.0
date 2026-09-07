"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/course-actions";
import { useConfirm } from "@/components/confirm-provider";

type Category = {
  id: string;
  name: string;
  isCourse: boolean;
  isNews: boolean;
  isEvent: boolean;
  color: string;
  textColorLight: string;
  textColorDark: string;
  published: boolean;
};

export function CategoriesList({ categories }: { categories: Category[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const confirm = useConfirm();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createCategory({ name: newName });
      setNewName("");
      setShowCreate(false);
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete this category?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteCategory(id);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        onClick={() => setShowCreate(!showCreate)}
        className="w-fit"
        size="sm"
      >
        <Plus className="mr-1 h-4 w-4" />
        New Category
      </Button>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="flex items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="newName">Category Name</Label>
            <Input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Web Development"
              required
            />
          </div>
          <Button type="submit" disabled={creating} size="sm">
            {creating ? "Creating..." : "Create"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(false)}
          >
            Cancel
          </Button>
        </form>
      )}

      {categories.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
          No categories yet. Create one to get started.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Types</th>
                <th className="px-4 py-3 font-medium">Color</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr
                  key={cat.id}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-4 py-3 text-sm font-medium">{cat.name}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-1">
                      {cat.isCourse && (
                        <span className="rounded bg-[var(--tenant-primary)]/15 px-1.5 py-0.5 text-xs text-[var(--tenant-primary)]">
                          Course
                        </span>
                      )}
                      {cat.isNews && (
                        <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-xs text-blue-500">
                          News
                        </span>
                      )}
                      {cat.isEvent && (
                        <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-xs text-orange-500">
                          Event
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block h-5 w-5 rounded"
                      style={{ backgroundColor: cat.color }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {cat.published ? (
                      <span className="flex items-center gap-1 text-sm text-green-500">
                        <CheckCircle2 className="h-4 w-4" />
                        Published
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-[var(--muted-foreground)]">
                        <Circle className="h-4 w-4" />
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/admin/categories/${cat.id}`}
                        className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(cat.id)}
                        className="text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
