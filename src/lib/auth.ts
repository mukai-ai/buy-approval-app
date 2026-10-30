import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma from "@/lib/prisma"
import { DRIVE_SCOPE } from "@/lib/googleDrive"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "dummy-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy-client-secret",
      // Workspaceアカウント再作成時などに既存ユーザーへ紐づける（signInで@tokyomf.co.jpに限定済み）
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "select_account",
          // 社内サーバーのパス(G:\共有ドライブ\...)をDriveリンクに変換するため、
          // Driveのファイル名・フォルダ構成の閲覧権限（中身は読めない）とリフレッシュトークンを取得する
          scope: `openid email profile ${DRIVE_SCOPE}`,
          access_type: "offline",
          include_granted_scopes: "true",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      console.log("Login attempt by:", user.email);
      if (user.email && user.email.toLowerCase().endsWith("@tokyomf.co.jp")) {
        return true;
      }
      return false;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email || session.user.email;
        // @ts-ignore
        session.user.id = token.sub || session.user.id;
      }
      return session;
    },
  },
  events: {
    // PrismaAdapterは初回連携時しかトークンを保存しないため、ログインのたびに最新のトークンで上書きする
    async signIn({ account }) {
      if (!account || account.provider !== "google") return;
      try {
        await prisma.account.updateMany({
          where: { provider: "google", providerAccountId: account.providerAccountId },
          data: {
            access_token: account.access_token ?? null,
            expires_at: account.expires_at ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
            // リフレッシュトークンは同意画面を通ったときしか返らないので、無いときは既存値を残す
            ...(account.refresh_token ? { refresh_token: account.refresh_token } : {}),
          },
        });
      } catch (error) {
        console.error("Failed to store Google tokens:", error);
      }
    },
  },
}
