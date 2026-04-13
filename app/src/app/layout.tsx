import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OWTECスケジュール',
  description: 'OWTEC schedule app prototype',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
