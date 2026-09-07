import { requireAdmin } from "@/lib/admin-guard";
import { requireFeature } from "@/lib/plan";
import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { AuditLogViewer } from "@/components/admin/audit-log-viewer";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entityType?: string; q?: string; page?: string }>;
}) {
  await requireAdmin();
  await requireFeature("auditLogs");

  const tenantId = getTenantId();
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 50;

  const where = {
    tenantId,
    ...(sp.action ? { action: sp.action } : {}),
    ...(sp.entityType ? { entityType: sp.entityType } : {}),
    ...(sp.q
      ? {
          OR: [
            { action: { contains: sp.q } },
            { entityType: { contains: sp.q } },
            { entityId: { contains: sp.q } },
          ],
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const actions = await prisma.auditLog.findMany({
    where: { tenantId },
    distinct: ["action"],
    select: { action: true },
    orderBy: { action: "asc" },
  });
  const entityTypes = await prisma.auditLog.findMany({
    where: { tenantId },
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Audit Logs</h1>
      <AuditLogViewer
        logs={logs.map((l) => ({
          id: l.id,
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          userId: l.userId,
          userName: l.user?.name ?? l.user?.email ?? null,
          metadata: l.metadata as Record<string, unknown> | null,
          createdAt: l.createdAt.toISOString(),
        }))}
        actions={actions.map((a) => a.action)}
        entityTypes={entityTypes.map((e) => e.entityType)}
        page={page}
        pageSize={pageSize}
        total={total}
        filters={{ action: sp.action, entityType: sp.entityType, q: sp.q }}
      />
    </div>
  );
}
