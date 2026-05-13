import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getUser } from './lib/kv-storage';

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdmin = nextUrl.pathname.startsWith('/admin');
      
      if (isOnAdmin) {
        // Let middleware handle the redirect to signin
        // Just check if user is logged in
        return isLoggedIn;
      }
      
      return true; // Allow access to public pages
    },
    async redirect({ url, baseUrl }) {
      // After successful login, redirect to the requested URL or admin
      console.log('[auth] Redirect callback - url:', url, 'baseUrl:', baseUrl);
      return url.startsWith('/') ? `${baseUrl}${url}` : url;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('[auth] Missing credentials');
          return null;
        }

        console.log('[auth] Attempting login for:', credentials.email);
        
        const user = await getUser(credentials.email as string);
        
        if (!user) {
          console.log('[auth] User not found:', credentials.email);
          return null;
        }

        console.log('[auth] User found, checking password');
        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) {
          console.log('[auth] Password mismatch');
          return null;
        }

        console.log('[auth] Login successful for:', user.email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }
    })
  ],
};

// Made with Bob
