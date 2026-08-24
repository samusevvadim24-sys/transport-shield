import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ТЩ | Кабинет водителя',
  icons: {
    icon: '/logo.png',
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}