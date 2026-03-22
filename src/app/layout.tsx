import './globals.css';
import { ReactNode } from 'react';
import { Providers } from '../components/Providers';

export const metadata = {
  title: '承認ワークフロー',
  description: '社内承認ワークフローシステム',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Providers>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
