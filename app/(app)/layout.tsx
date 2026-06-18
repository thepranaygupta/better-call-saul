import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { Sidebar } from '@/components/sidebar';

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const user = {
    name: session.user?.name,
    email: session.user?.email,
    role: session.user?.role,
  };

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
