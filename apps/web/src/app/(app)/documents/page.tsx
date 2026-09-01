import { FileText, FolderOpen, Upload } from "lucide-react";

export default function DocumentsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Documents</h1>

      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--muted)]">
          <FolderOpen className="h-8 w-8 text-[var(--muted-foreground)]" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">Documents coming soon</h2>
          <p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">
            The documents module will allow admins to organize files into folders
            and share them with users or usergroups. File upload, preview, and
            download will be available in a future update.
          </p>
        </div>
        <div className="flex gap-4 text-sm text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            Folder structure
          </span>
          <span className="flex items-center gap-1.5">
            <Upload className="h-4 w-4" />
            File uploads
          </span>
        </div>
      </div>
    </div>
  );
}
