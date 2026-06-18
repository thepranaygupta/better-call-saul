import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Saul — Lead Prioritization Console',
  description: 'Ranked lead queue for edtech sales floors',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
