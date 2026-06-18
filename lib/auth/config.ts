import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { JWT } from 'next-auth/jwt';

// Extend the built-in types to include our custom fields
declare module 'next-auth' {
  interface User {
    role?: string;
    assignedProjectIds?: string[];
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      assignedProjectIds?: string[];
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    assignedProjectIds?: string[];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize() {
        // Skeleton — will be implemented in Task 7 (Phase 1)
        // Will: connect to DB, find user by email, verify password with bcryptjs,
        // return user object with id, name, email, role, assignedProjectIds
        return null;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      // When user signs in, attach role and project IDs to token
      if (user) {
        token.role = user.role;
        token.assignedProjectIds = user.assignedProjectIds;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose role and project IDs on the session object
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.role = token.role;
        session.user.assignedProjectIds = token.assignedProjectIds;
      }
      return session;
    },
  },
});
