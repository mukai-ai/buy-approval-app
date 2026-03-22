import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "dummy-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy-client-secret",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      console.log("Login attempt by:", user.email);
      // 【デバッグ用】一旦全員許可して、何が起きているか確認します
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.email = user.email;
        // @ts-ignore
        session.user.id = user.id;
      }
      return session;
    },
  },
}
