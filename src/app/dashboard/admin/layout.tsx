import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decodeSessionValue, SESSION_COOKIE } from '@/lib/auth-session';

export const metadata: Metadata = {
  title: 'ТЩ | Кабинет администратора',
  icons: {
    icon: '/logo.png',
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  const session = value ? decodeSessionValue(value) : null;

  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'admin') {
    redirect('/login');
  }

  return <>{children}</>;
}
