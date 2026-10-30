import { headers } from 'next/headers';

// 通知メールに載せるアプリのURL。
// リクエストのHostヘッダーは送り手が偽装できるため、NEXTAUTH_URL（Vercelの環境変数）を優先する
export async function getAppBaseUrl(): Promise<string> {
  const configured = process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/+$/, '');

  const host = (await headers()).get('host');
  const protocol = host?.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}
