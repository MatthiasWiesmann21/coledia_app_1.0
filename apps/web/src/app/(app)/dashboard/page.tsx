import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@coledia/db";
import { getTenantId } from "@/lib/tenant";
import { TermsModal } from "@/components/terms-modal";
import { DashboardContent } from "@/components/dashboard-content";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const tenantId = getTenantId();

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  });

  const needsTerms = !profile?.acceptedTermsAt;

  // Fetch real data where available, use mock for courses (Phase 3)
  const [enrollments, onlineMembers] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId: session.user.id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            price: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
    }),
    prisma.userProfile.count({
      where: { status: "online" },
    }),
  ]);

  // Calculate stats from real enrollments
  const inProgress = enrollments.filter((e) => e.progressPct > 0 && e.progressPct < 100).length;
  const completed = enrollments.filter((e) => e.progressPct >= 100).length;

  // Mock data for chapters (Phase 3 will make this real)
  const completedChapters = 12; // TODO: count ChapterProgress
  const popularChapters = [
    { id: "1", name: "Intro to React Hooks", course: "React Fundamentals", category: "Web Dev", likes: 142 },
    { id: "2", name: "CSS Grid Mastery", course: "Advanced CSS", category: "Web Dev", likes: 98 },
    { id: "3", name: "TypeScript Generics", course: "TypeScript Deep Dive", category: "Web Dev", likes: 87 },
    { id: "4", name: "Node.js Streams", course: "Backend with Node", category: "Backend", likes: 65 },
  ];

  const myCourses = enrollments.slice(0, 5).map((e) => ({
    id: e.course.id,
    title: e.course.title,
    category: e.course.category?.name ?? "Uncategorized",
    categoryColor: e.course.category?.color ?? "#008080",
    progress: Math.round(e.progressPct),
    paymentStatus: e.course.price ? "Paid" : "Free",
  }));

  return (
    <>
      <TermsModal userId={session.user.id} needsTerms={needsTerms} />
      <DashboardContent
        stats={{
          inProgress,
          completed,
          completedChapters,
          onlineMembers,
        }}
        popularChapters={popularChapters}
        myCourses={myCourses}
      />
    </>
  );
}
