"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Folder,
  FolderPlus,
  FileText,
  Upload,
  Download,
  ChevronRight,
  Home,
  Search,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Users,
} from "lucide-react";
import { formatFileSize, getFileIcon } from "@/lib/file-utils";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { cn } from "@coledia/ui/lib/utils";
import { useTranslations } from "next-intl";

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  userGroupId: string | null;
  userGroupName: string | null;
  visible: boolean;
  published: boolean;
  fileCount: number;
  folderCount: number;
  createdAt: string;
}

interface DocumentItem {
  id: string;
  name: string;
  fileUrl: string | null;
  fileSize: string;
  mimeType: string | null;
  fileType: string | null;
  folderId: string | null;
  visible: boolean;
  published: boolean;
  createdAt: string;
}

interface Props {
  initialFolders: FolderItem[];
  initialDocuments: DocumentItem[];
  isAdmin: boolean;
}

export function DocumentBrowser({ initialFolders, initialDocuments, isAdmin }: Props) {
  const router = useRouter();
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>(initialFolders);
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // New folder state
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameType, setRenameType] = useState<"folder" | "document">("folder");

  const loadContent = useCallback(async (folderId: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (folderId) {
        params.append("parentId", folderId);
      }
      const foldersRes = await fetch(`/api/folders?${params.toString()}`);
      const foldersData = await foldersRes.json();

      const docParams = new URLSearchParams();
      if (folderId) {
        docParams.append("folderId", folderId);
      } else {
        docParams.append("folderId", "");
      }
      const docsRes = await fetch(`/api/documents?${docParams.toString()}`);
      const docsData = await docsRes.json();

      setFolders(foldersData.folders ?? []);
      setDocuments(docsData.documents ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentFolderId === null) {
      // Root
      setFolders(initialFolders.filter((f) => f.parentId === null));
      setDocuments(initialDocuments);
    } else {
      loadContent(currentFolderId);
    }
  }, [currentFolderId, initialFolders, initialDocuments, loadContent]);

  async function handleFolderClick(folder: FolderItem) {
    // Try to get folder info for breadcrumb
    try {
      const res = await fetch(`/api/folders/${folder.id}`);
      if (res.ok) {
        const data = await res.json();
        setBreadcrumbs((prev) => [...prev, data.folder]);
      } else {
        setBreadcrumbs((prev) => [...prev, folder]);
      }
    } catch {
      setBreadcrumbs((prev) => [...prev, folder]);
    }
    setCurrentFolderId(folder.id);
    setSearchQuery("");
  }

  function handleBreadcrumbClick(index: number) {
    if (index === -1) {
      setCurrentFolderId(null);
      setBreadcrumbs([]);
      setFolders(initialFolders.filter((f) => f.parentId === null));
      setDocuments(initialDocuments);
    } else {
      const folder = breadcrumbs[index];
      setCurrentFolderId(folder.id);
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    }
    setSearchQuery("");
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName,
          parentId: currentFolderId,
        }),
      });
      if (res.ok) {
        setNewFolderName("");
        setShowNewFolder(false);
        loadContent(currentFolderId);
      }
    } catch {
      // ignore
    }
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm(t("deleteFolderConfirm"))) return;
    try {
      const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadContent(currentFolderId);
      }
    } catch {
      // ignore
    }
  }

  async function handleDeleteDocument(id: string) {
    if (!confirm(t("deleteFileConfirm"))) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadContent(currentFolderId);
      }
    } catch {
      // ignore
    }
  }

  async function handleRename() {
    if (!renamingId || !renameValue.trim()) return;
    try {
      const url =
        renameType === "folder"
          ? `/api/folders/${renamingId}`
          : `/api/documents/${renamingId}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue }),
      });
      if (res.ok) {
        setRenamingId(null);
        setRenameValue("");
        loadContent(currentFolderId);
      }
    } catch {
      // ignore
    }
  }

  async function handleToggleVisibility(type: "folder" | "document", id: string, field: "visible" | "published", value: boolean) {
    try {
      const url = type === "folder" ? `/api/folders/${id}` : `/api/documents/${id}`;
      await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      loadContent(currentFolderId);
    } catch {
      // ignore
    }
  }

  const filteredDocuments = searchQuery
    ? documents.filter((d) =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : documents;

  const filteredFolders = searchQuery
    ? folders.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : folders;

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-[var(--muted-foreground)]">
        <button
          onClick={() => handleBreadcrumbClick(-1)}
          className="flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-[var(--muted)]"
        >
          <Home className="h-3.5 w-3.5" />
          {t("browse")}
        </button>
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <button
              onClick={() => handleBreadcrumbClick(i)}
              className="rounded-md px-2 py-1 transition hover:bg-[var(--muted)]"
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      {/* Action bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchInFolder")}
            className="pl-10"
          />
        </div>
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNewFolder(!showNewFolder)}
          >
            <FolderPlus className="mr-1 h-4 w-4" />
            {t("newFolder")}
          </Button>
        )}
      </div>

      {/* New folder form */}
      {showNewFolder && isAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={t("folderName")}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") setShowNewFolder(false);
            }}
          />
          <Button size="sm" onClick={handleCreateFolder}>
            {t("create")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowNewFolder(false)}>
            {t("cancel")}
          </Button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center p-8 text-sm text-[var(--muted-foreground)]">
          {tc("loading")}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Folders */}
          {filteredFolders.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                {t("folders")}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="group relative flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:bg-[var(--muted)]"
                  >
                    <button
                      onClick={() => handleFolderClick(folder)}
                      className="flex w-full flex-col items-center gap-2"
                    >
                      <Folder className="h-8 w-8 text-[var(--tenant-primary)]" />
                      <span className="w-full truncate text-center text-sm font-medium">
                        {folder.name}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                        <span>{folder.fileCount} {tc("chapters").toLowerCase()}</span>
                        {folder.userGroupName && (
                          <span className="flex items-center gap-0.5">
                            <Users className="h-3 w-3" />
                            {folder.userGroupName}
                          </span>
                        )}
                      </div>
                    </button>
                    {isAdmin && (
                      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                        <button
                          onClick={() => {
                            setRenameType("folder");
                            setRenamingId(folder.id);
                            setRenameValue(folder.name);
                          }}
                          className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                          title={t("rename")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleVisibility("folder", folder.id, "visible", !folder.visible)}
                          className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                          title={folder.visible ? t("visible") : "Hidden"}
                        >
                          {folder.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDeleteFolder(folder.id)}
                          className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500"
                          title={t("delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {filteredDocuments.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                {t("documents")}
              </h3>
              <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-xs font-semibold text-[var(--muted-foreground)]">
                  <span>{t("name")}</span>
                  <span className="hidden sm:block">{t("size")}</span>
                  <span className="hidden md:block">{t("modified")}</span>
                  <span>{t("actions")}</span>
                </div>
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-[var(--border)] px-4 py-3 last:border-0 hover:bg-[var(--muted)]/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getFileIcon(doc.mimeType, doc.fileType)}</span>
                      <span className="truncate text-sm font-medium">{doc.name}</span>
                    </div>
                    <span className="hidden text-sm text-[var(--muted-foreground)] sm:block">
                      {formatFileSize(BigInt(doc.fileSize))}
                    </span>
                    <span className="hidden text-sm text-[var(--muted-foreground)] md:block">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(`/api/documents/${doc.id}/download`, "_blank")}
                        title={t("download")}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setRenameType("document");
                              setRenamingId(doc.id);
                              setRenameValue(doc.name);
                            }}
                            title={t("rename")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleVisibility("document", doc.id, "visible", !doc.visible)}
                            title={doc.visible ? t("visible") : "Hidden"}
                          >
                            {doc.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-red-500 hover:bg-red-500/10"
                            title={t("delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {filteredFolders.length === 0 && filteredDocuments.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Folder className="h-12 w-12 text-[var(--muted-foreground)]" />
              <p className="text-sm text-[var(--muted-foreground)]">
                {t("emptyState")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Rename modal */}
      {renamingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRenamingId(null);
          }}
        >
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">
              {renameType === "folder" ? t("renameFolder") : t("renameFile")}
            </h3>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={t("newName")}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenamingId(null);
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRenamingId(null)}>
                {t("cancel")}
              </Button>
              <Button onClick={handleRename}>
                {t("rename")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
