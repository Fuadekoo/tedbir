import NextAuth, { CredentialsSignin, NextAuthConfig } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import prisma from "./db";
import { loginSchema } from "./zodSchema";
// import { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id?: string;
    // role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    // role: string;
  }
}

export class CustomError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/en/login",
    signOut: "/en/signout",
  },
  callbacks: {
    authorized: async ({ auth, request: { nextUrl } }) => {
      const { pathname } = nextUrl;
      // If logged-in user hits /en/login, send to dashboard
      if (auth && pathname.startsWith("/en/login")) {
        return Response.redirect(new URL("/en/dashboard", nextUrl));
      }

      // Public pages accessible without login
      const publicPaths = ["/en/about", "/en/login"];
      if (publicPaths.some((p) => pathname.startsWith(p))) {
        return true;
      }

      // Protect all other /en/* routes
      if (!auth && pathname.startsWith("/en")) {
        return false; // NextAuth will redirect to pages.signIn
      }

      return true;
    },

    jwt: async ({ token, user }) => {
      return { ...token, ...user };
    },
    session: async ({ session, token }) => {
      return { ...session, user: { ...session.user, ...token } };
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const { username, password } = await loginSchema.parseAsync(
          credentials
        );
        const user = await prisma.user.findFirst({
          where: { username },
          select: { id: true, password: true },
        });
        if (!user) throw new CustomError("Invalid Phone Number");
        if (!user.password) throw new CustomError("Password Not Set");
        if (!(await bcryptjs.compare(password, user.password)))
          throw new CustomError("Invalid Password");
        return { id: user.id };
      },
    }),
  ],
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
