import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { Sidebar } from '@/components/sidebar';
import { Footer } from '@/components/footer';
import { getSidebarStats, getNextLead } from '@/lib/sidebar-data';

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const { id, name, email, role, assignedProjectIds } = session.user;

  const [stats, nextLead] = await Promise.all([
    getSidebarStats(id, role, assignedProjectIds),
    getNextLead(id, role, assignedProjectIds),
  ]);

  const user = { name, email, role };

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <Sidebar
        user={user}
        stats={stats}
        nextLead={nextLead}
      />
      <div className="flex flex-1 flex-col overflow-y-auto bg-[#F5F5F0]">
        <main className="flex-1 p-4 md:p-6" role="main">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
