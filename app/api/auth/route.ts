import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const auth = NextAuth({
    session: { strategy: "jwt" },
    providers: [
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(creds) {
                const email = String(creds?.email || "").trim();
                const password = String(creds?.password || "");
                if (!email || !password) return null;

                const user = await prisma.user.findUnique({ where: { email } });
                if (!user) return null;

                // Passwords must be bcrypt-hashed in the DB
                const ok = bcrypt.compareSync(password, user.password);
                if (!ok) return null;

                return { id: String(user.id), email: user.email, name: user.name, role: user.role };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) token.role = (user as any).role;
            return token;
        },
        async session({ session, token }) {
            if (session.user) (session.user as any).role = token.role;
            return session;
        },
    },
});

export { auth as GET, auth as POST };
