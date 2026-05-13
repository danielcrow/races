import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTenantFromHost } from './lib/tenant';
import { auth } from './auth';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const host = req.headers.get('host');
  const currentTenant = getTenantFromHost(host);
  
  // Protect admin routes
  if (nextUrl.pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/auth/signin', nextUrl));
    }
    
    // Check if user's tenant matches the current domain's tenant
    const userTenantId = (req.auth?.user as any)?.tenantId;
    const effectiveTenant = currentTenant || 'default';
    const effectiveUserTenant = userTenantId || 'default';
    
    console.log(`[middleware] Admin access check:`, {
      host,
      currentTenant,
      effectiveTenant,
      userTenantId,
      effectiveUserTenant,
      pathname: nextUrl.pathname
    });
    
    // Normalize tenant IDs for comparison (handle hyphens vs underscores)
    const normalizedCurrentTenant = effectiveTenant.replace(/-/g, '_').toLowerCase();
    const normalizedUserTenant = effectiveUserTenant.replace(/-/g, '_').toLowerCase();
    
    // Allow access if:
    // 1. User tenant matches current tenant (with normalization)
    // 2. User is on root domain (effectiveTenant === 'default')
    // 3. User has 'default' tenant (super admin)
    // 4. Current tenant is 'default' (root domain access)
    const tenantMatch = normalizedUserTenant === normalizedCurrentTenant;
    const isRootDomain = effectiveTenant === 'default';
    const isSuperAdmin = effectiveUserTenant === 'default';
    
    if (!tenantMatch && !isRootDomain && !isSuperAdmin) {
      // User is trying to access a different tenant's admin
      console.log(`[middleware] Tenant mismatch - blocking access`);
      return NextResponse.redirect(new URL('/auth/signin?error=wrong-tenant', nextUrl));
    }
    
    console.log(`[middleware] Access granted`);
  }
  
  // Add tenant to request headers for API routes
  if (nextUrl.pathname.startsWith('/api/')) {
    const requestHeaders = new Headers(req.headers);
    // Use current tenant or default to 'default' for root domain
    const tenant = currentTenant || 'default';
    requestHeaders.set('x-tenant', tenant);
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/:path*',
  ],
};

// Made with Bob
