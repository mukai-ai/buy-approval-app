import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "dummy-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy-client-secret",
      authorization: {
        params: {
          prompt: "select_account",
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
}
