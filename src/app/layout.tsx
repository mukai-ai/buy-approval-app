import './globals.css';
import { ReactNode } from 'react';
import { Providers } from '../components/Providers';
import MainLayout from './components/MainLayout';

export const metadata = {
  title: '承認ワークフロー',
  description: '社内承認ワークフローシステム',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Providers>
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}
