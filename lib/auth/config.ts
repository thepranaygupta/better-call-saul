import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { connectDB } from '@/lib/db/connection';
import { UserModel, type IUser } from '@/lib/db/models';
import type { Model } from 'mongoose';
import '@/lib/auth/types';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();

        const User = UserModel as Model<IUser>;
        const user = await User.findOne({
          email: credentials.email as string,
        }).lean();

        if (!user) return null;

        const isValid = await compare(
          credentials.password as string,
          (user as { passwordHash: string }).passwordHash,
        );
        if (!isValid) return null;

        const doc = user as {
          _id: { toString(): string };
          name: string;
          email: string;
          role: 'admin' | 'sales_lead' | 'bda';
          assignedProjectIds: { toString(): string }[];
        };

        return {
          id: doc._id.toString(),
          name: doc.name,
          email: doc.email,
          role: doc.role,
          assignedProjectIds: doc.assignedProjectIds.map((id) => id.toString()),
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.assignedProjectIds = user.assignedProjectIds;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.assignedProjectIds = token.assignedProjectIds;
      return session;
    },
  },
});
