import { requireAdmin } from "@/lib/admin-guard";
import { AdminDocumentManager } from "@/components/documents/admin-document-manager";

export default async function AdminDocumentsPage() {
  await requireAdmin();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Doc-Hub Management</h1>
      <AdminDocumentManager />
    </div>
  );
}
