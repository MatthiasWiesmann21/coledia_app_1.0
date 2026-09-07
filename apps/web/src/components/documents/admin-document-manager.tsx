"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Folder,
  FolderPlus,
  Upload,
  ChevronRight,
  Home,
  Search,
  Trash2,
  Pencil,
  Eye,
  Download,
  FileText,
  Users,
  X,
} from "lucide-react";
import { formatFileSize, getFileIcon } from "@/lib/file-utils";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { cn } from "@coledia/ui/lib/utils";
import { UserGroupMultiSelect } from "@/components/admin/usergroup-multiselect";
import { useAlert } from "@/components/confirm-provider";

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  userGroups: { id: string; name: string }[];
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
  userGroups: { id: string; name: string }[];
  visible: boolean;
  published: boolean;
  createdAt: string;
}

interface UserGroupItem {
  id: string;
  name: string;
}

export function AdminDocumentManager() {
  const router = useRouter();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [userGroups, setUserGroups] = useState<UserGroupItem[]>([]);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New folder state
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderUserGroupIds, setNewFolderUserGroupIds] = useState<string[]>([]);

  // Settings panel state (folders)
  const [settingsFolderId, setSettingsFolderId] = useState<string | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(true);
  const [settingsPublished, setSettingsPublished] = useState(false);
  const [settingsUserGroupIds, setSettingsUserGroupIds] = useState<string[]>([]);

  // Settings panel state (documents)
  const [settingsDocId, setSettingsDocId] = useState<string | null>(null);
  const [settingsDocVisible, setSettingsDocVisible] = useState(true);
  const [settingsDocPublished, setSettingsDocPublished] = useState(false);
  const [settingsDocUserGroupIds, setSettingsDocUserGroupIds] = useState<string[]>([]);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameType, setRenameType] = useState<"folder" | "document">("folder");
  const alert = useAlert();

  // Confirm delete state
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "folder" | "document";
    id: string;
    name: string;
  } | null>(null);

  const loadContent = useCallback(async (folderId: string | null) => {
    setLoading(true);
    try {
      const folderParams = new URLSearchParams();
      if (folderId) folderParams.append("parentId", folderId);
      folderParams.append("includeAll", "true");
      const foldersRes = await fetch(`/api/folders?${folderParams.toString()}`);
      const foldersData = await foldersRes.json();
      setFolders(foldersData.folders ?? []);

      const docParams = new URLSearchParams();
      docParams.append("folderId", folderId ?? "");
      docParams.append("includeAll", "true");
      const docsRes = await fetch(`/api/documents?${docParams.toString()}`);
      const docsData = await docsRes.json();
      setDocuments(docsData.documents ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadUserGroups() {
    try {
      const res = await fetch("/api/usergroups");
      if (res.ok) {
        const data = await res.json();
        setUserGroups(data.userGroups ?? []);
      }
    } catch {
      // silently fail
    }
  }

  useEffect(() => {
    loadContent(currentFolderId);
    loadUserGroups();
  }, [currentFolderId, loadContent]);

  async function handleFolderClick(folder: FolderItem) {
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
    } else {
      const folder = breadcrumbs[index];
      setCurrentFolderId(folder.id);
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    }
    setSearchQuery("");
    setShowNewFolder(false);
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
          userGroupIds: newFolderUserGroupIds,
          visible: true,
          published: false, // Default to draft so admin can review before going live
        }),
      });
      if (res.ok) {
        setNewFolderName("");
        setNewFolderUserGroupIds([]);
        setShowNewFolder(false);
        loadContent(currentFolderId);
      }
    } catch {
      // ignore
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        if (currentFolderId) {
          formData.append("folderId", currentFolderId);
        }

        const res = await fetch("/api/upload/documents", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const error = await res.json();
          await alert({ title: "Upload failed", description: error.error ?? undefined });
        }
      }
      loadContent(currentFolderId);
    } catch {
      await alert({ title: "Upload failed" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleUpload(files);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    try {
      const url =
        type === "folder" ? `/api/folders/${id}` : `/api/documents/${id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        setConfirmDelete(null);
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

  function openSettings(folder: FolderItem) {
    setSettingsFolderId(folder.id);
    setSettingsVisible(folder.visible);
    setSettingsPublished(folder.published);
    setSettingsUserGroupIds(folder.userGroups.map((g) => g.id));
  }

  async function saveSettings() {
    if (!settingsFolderId) return;
    try {
      await fetch(`/api/folders/${settingsFolderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visible: settingsVisible,
          published: settingsPublished,
          userGroupIds: settingsUserGroupIds,
        }),
      });
      setSettingsFolderId(null);
      loadContent(currentFolderId);
    } catch {
      // ignore
    }
  }

  function openDocSettings(doc: DocumentItem) {
    setSettingsDocId(doc.id);
    setSettingsDocVisible(doc.visible);
    setSettingsDocPublished(doc.published);
    setSettingsDocUserGroupIds(doc.userGroups.map((g) => g.id));
  }

  async function saveDocSettings() {
    if (!settingsDocId) return;
    try {
      await fetch(`/api/documents/${settingsDocId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visible: settingsDocVisible,
          published: settingsDocPublished,
          userGroupIds: settingsDocUserGroupIds,
        }),
      });
      setSettingsDocId(null);
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
    <div
      className="flex flex-col gap-4"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & drop overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-(--tenant-primary)/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-(--tenant-primary) bg-card p-8">
            <Upload className="h-12 w-12 text-(--tenant-primary)" />
            <p className="text-lg font-medium text-(--tenant-primary)">
              Drop files to upload
            </p>
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <button
          onClick={() => handleBreadcrumbClick(-1)}
          className="flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-muted"
        >
          <Home className="h-3.5 w-3.5" />
          Browse
        </button>
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => handleBreadcrumbClick(i)}
              className="rounded-md px-2 py-1 transition hover:bg-muted"
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      {/* Action bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in this folder..."
            className="pl-10"
          />
        </div>
        <Button size="sm" onClick={() => setShowNewFolder(!showNewFolder)}>
          <FolderPlus className="mr-1 h-4 w-4" />
          New Folder
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-1 h-4 w-4" />
          {uploading ? "Uploading..." : "Upload Files"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* New folder form */}
      {showNewFolder && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") setShowNewFolder(false);
              }}
            />
            <UserGroupMultiSelect
              userGroups={userGroups}
              selectedIds={newFolderUserGroupIds}
              onChange={setNewFolderUserGroupIds}
            />
            <Button size="sm" onClick={handleCreateFolder}>
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNewFolder(false)}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Select a user group to restrict access, or leave as &quot;All users&quot;.
          </p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Folders */}
          {filteredFolders.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Folders
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="group relative flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-4 transition hover:bg-muted"
                  >
                    <button
                      onClick={() => handleFolderClick(folder)}
                      className="flex w-full flex-col items-center gap-2"
                    >
                      <Folder
                        className={cn(
                          "h-8 w-8",
                          folder.visible
                            ? "text-(--tenant-primary)"
                            : "text-muted-foreground",
                        )}
                      />
                      <span className="w-full truncate text-center text-sm font-medium">
                        {folder.name}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>
                          {folder.fileCount}
                          {folder.folderCount > 0 ? ` + ${folder.folderCount}` : ""} items
                        </span>
                        {!folder.published && (
                          <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-yellow-600">
                            Draft
                          </span>
                        )}
                        {folder.userGroups.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Users className="h-3 w-3" />
                            {folder.userGroups.map((g) => g.name).join(", ")}
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => openSettings(folder)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Settings"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setRenameType("folder");
                          setRenamingId(folder.id);
                          setRenameValue(folder.name);
                        }}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ type: "folder", id: folder.id, name: folder.name })}
                        className="rounded-md p-1 text-red-500 hover:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {filteredDocuments.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Documents
              </h3>
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground">
                  <span>Name</span>
                  <span className="hidden sm:block">Size</span>
                  <span className="hidden md:block">Modified</span>
                  <span>Actions</span>
                </div>
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="group grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border px-4 py-3 last:border-0 hover:bg-(--muted)/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {getFileIcon(doc.mimeType, doc.fileType)}
                      </span>
                      <span className="truncate text-sm font-medium">{doc.name}</span>
                      {!doc.published && (
                        <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-xs text-yellow-600">
                          Draft
                        </span>
                      )}
                    </div>
                    <span className="hidden text-sm text-muted-foreground sm:block">
                      {formatFileSize(BigInt(doc.fileSize))}
                    </span>
                    <span className="hidden text-sm text-muted-foreground md:block">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(`/api/documents/${doc.id}/download`, "_blank")}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDocSettings(doc)}
                        title="Settings"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setRenameType("document");
                          setRenamingId(doc.id);
                          setRenameValue(doc.name);
                        }}
                        title="Rename"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete({ type: "document", id: doc.id, name: doc.name })}
                        className="text-red-500 hover:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {filteredFolders.length === 0 && filteredDocuments.length === 0 && !loading && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Folder className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This folder is empty — upload files or create subfolders to get started
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
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">
              {renameType === "folder" ? "Rename Folder" : "Rename File"}
            </h3>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="New name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenamingId(null);
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRenamingId(null)}>
                Cancel
              </Button>
              <Button onClick={handleRename}>Rename</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDelete(null);
          }}
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold">Confirm Delete</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete &ldquo;{confirmDelete.name}&rdquo;?
              {confirmDelete.type === "folder"
                ? " All contents will be permanently deleted."
                : ""}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Folder settings modal */}
      {settingsFolderId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSettingsFolderId(null);
          }}
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Folder Settings</h3>
              <button
                onClick={() => setSettingsFolderId(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Label>Visible to users</Label>
                <button
                  onClick={() => setSettingsVisible(!settingsVisible)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition",
                    settingsVisible ? "bg-(--tenant-primary)" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                      settingsVisible ? "left-5" : "left-0.5",
                    )}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <Label>Published</Label>
                <button
                  onClick={() => setSettingsPublished(!settingsPublished)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition",
                    settingsPublished ? "bg-(--tenant-primary)" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                      settingsPublished ? "left-5" : "left-0.5",
                    )}
                  />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Restrict to User Groups</Label>
                <UserGroupMultiSelect
                  userGroups={userGroups}
                  selectedIds={settingsUserGroupIds}
                  onChange={setSettingsUserGroupIds}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setSettingsFolderId(null)}>
                  Cancel
                </Button>
                <Button onClick={saveSettings}>Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document settings modal */}
      {settingsDocId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSettingsDocId(null);
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Document Settings</h2>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Label>Visible</Label>
                <button
                  type="button"
                  onClick={() => setSettingsDocVisible(!settingsDocVisible)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition",
                    settingsDocVisible ? "bg-(--tenant-primary)" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                      settingsDocVisible ? "left-5" : "left-0.5",
                    )}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <Label>Published</Label>
                <button
                  type="button"
                  onClick={() => setSettingsDocPublished(!settingsDocPublished)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition",
                    settingsDocPublished ? "bg-(--tenant-primary)" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                      settingsDocPublished ? "left-5" : "left-0.5",
                    )}
                  />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Restrict to User Groups</Label>
                <UserGroupMultiSelect
                  userGroups={userGroups}
                  selectedIds={settingsDocUserGroupIds}
                  onChange={setSettingsDocUserGroupIds}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setSettingsDocId(null)}>
                  Cancel
                </Button>
                <Button onClick={saveDocSettings}>Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

