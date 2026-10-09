import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Драйв Контроль | Вход',
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