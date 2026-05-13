'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense, useEffect } from 'react';
import { getTenantFromHost } from '@/lib/tenant';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);

  const callbackUrl = searchParams.get('callbackUrl') || '/admin';

  // Redirect to tenant subdomain after successful login
  useEffect(() => {
    if (session?.user && !hasRedirected) {
      const userTenantId = (session.user as any).tenantId;
      const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
      const currentHost = window.location.host;
      const currentTenant = getTenantFromHost(currentHost);
      
      console.log('[signin] User logged in, tenantId:', userTenantId);
      console.log('[signin] Current host:', currentHost);
      console.log('[signin] Current tenant (from getTenantFromHost):', currentTenant);
      console.log('[signin] Root domain:', rootDomain);
      
      setHasRedirected(true);
      
      // Normalize tenant IDs for comparison (handle hyphens vs underscores)
      const normalizedUserTenant = (userTenantId || 'default').replace(/-/g, '_').toLowerCase();
      const normalizedCurrentTenant = (currentTenant || 'default').replace(/-/g, '_').toLowerCase();
      
      // Check if we're already on the correct subdomain
      const isOnCorrectSubdomain = normalizedUserTenant === normalizedCurrentTenant;
      
      console.log('[signin] Normalized user tenant:', normalizedUserTenant);
      console.log('[signin] Normalized current tenant:', normalizedCurrentTenant);
      console.log('[signin] Is on correct subdomain:', isOnCorrectSubdomain);
      
      if (isOnCorrectSubdomain) {
        // Already on correct subdomain, just navigate to callback
        console.log('[signin] Already on correct subdomain, navigating to:', callbackUrl);
        router.push(callbackUrl);
        return;
      }
      
      // If user has a tenant and not on default, redirect to their tenant subdomain
      if (userTenantId && userTenantId !== 'default') {
        const tenantHost = `${userTenantId}.${rootDomain}`;
        const protocol = rootDomain.includes('localhost') ? 'http' : 'https';
        const tenantUrl = `${protocol}://${tenantHost}${callbackUrl}`;
        console.log('[signin] Redirecting to tenant URL:', tenantUrl);
        window.location.href = tenantUrl;
        return;
      }
      
      // Default tenant, navigate to callback
      console.log('[signin] Default tenant, navigating to:', callbackUrl);
      router.push(callbackUrl);
    }
  }, [session, callbackUrl, router, hasRedirected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
        setLoading(false);
      }
      // Session will be updated and useEffect will handle redirect
    } catch (error) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Demo credentials: admin@example.com / admin123
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}

// Made with Bob
