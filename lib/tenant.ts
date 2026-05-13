/**
 * Tenant Detection and Management Utilities
 * Handles subdomain-based tenant identification
 */

export interface Tenant {
  subdomain: string;
  name: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

/**
 * Extract tenant subdomain from host header
 * Examples:
 *   - "club1.racetiming.app" -> "club1"
 *   - "club1.localhost:3000" -> "club1"
 *   - "localhost:3000" -> null (no tenant)
 *   - "racetiming.app" -> null (root domain)
 */
export function getTenantFromHost(host: string | null): string | null {
  if (!host) return null;

  // Remove port if present
  const hostname = host.split(':')[0];

  // Check if it's a subdomain
  const parts = hostname.split('.');
  
  // For localhost development with subdomains (e.g., club1.localhost)
  if (parts.length === 2 && parts[1] === 'localhost') {
    const subdomain = parts[0];
    // Reserved subdomains that shouldn't be tenants
    const reserved = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'blog'];
    if (reserved.includes(subdomain.toLowerCase())) {
      return null;
    }
    return subdomain;
  }

  // For plain localhost development (no subdomain)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'default'; // Use 'default' tenant for local dev
  }

  // For production domains (e.g., club1.racetiming.app or dan-race.danergy.tech)
  // Need at least 3 parts for subdomain
  if (parts.length < 3) {
    return null; // Root domain or invalid
  }

  // Get the root domain from environment or detect it
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || '';
  
  // For multi-part subdomains (e.g., dan-race.danergy.tech where root is danergy.tech)
  // Extract everything before the root domain as the tenant
  if (rootDomain) {
    const rootParts = rootDomain.split('.');
    const rootLength = rootParts.length;
    
    // If we have more parts than the root domain, extract the subdomain
    if (parts.length > rootLength) {
      // Join all parts except the root domain parts
      const subdomainParts = parts.slice(0, parts.length - rootLength);
      const subdomain = subdomainParts.join('-');
      
      // Reserved subdomains that shouldn't be tenants
      const reserved = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'blog'];
      if (reserved.includes(subdomain.toLowerCase())) {
        return null;
      }
      
      return subdomain;
    }
  }

  // Fallback: First part is the subdomain
  const subdomain = parts[0];

  // Reserved subdomains that shouldn't be tenants
  const reserved = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'blog'];
  if (reserved.includes(subdomain.toLowerCase())) {
    return null;
  }

  return subdomain;
}

/**
 * Validate subdomain format
 * Rules:
 * - 3-50 characters
 * - Alphanumeric and hyphens only
 * - Must start and end with alphanumeric
 * - No consecutive hyphens
 */
export function isValidSubdomain(subdomain: string): boolean {
  if (!subdomain || subdomain.length < 3 || subdomain.length > 50) {
    return false;
  }

  // Check format: alphanumeric, hyphens, no consecutive hyphens
  const pattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  if (!pattern.test(subdomain)) {
    return false;
  }

  // No consecutive hyphens
  if (subdomain.includes('--')) {
    return false;
  }

  // Reserved words
  const reserved = [
    'www', 'api', 'admin', 'app', 'mail', 'ftp', 'blog',
    'help', 'support', 'docs', 'status', 'cdn', 'assets',
    'static', 'media', 'images', 'files', 'download',
    'test', 'demo', 'staging', 'dev', 'localhost'
  ];

  if (reserved.includes(subdomain.toLowerCase())) {
    return false;
  }

  return true;
}

/**
 * Generate database filename for tenant
 */
export function getTenantDatabaseName(tenant: string): string {
  return `${tenant}_RaceTiming.db`;
}

/**
 * Get tenant display name (for UI)
 */
export function getTenantDisplayName(tenant: string): string {
  // Capitalize first letter of each word
  return tenant
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Check if request is for root domain (no tenant)
 */
export function isRootDomain(host: string | null): boolean {
  if (!host) return true;
  
  const hostname = host.split(':')[0];
  
  // Localhost is considered root for development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return false; // We use 'default' tenant for localhost
  }

  const parts = hostname.split('.');
  
  // Root domain has 2 parts (e.g., racetiming.app)
  // or starts with www
  return parts.length === 2 || parts[0] === 'www';
}

/**
 * Build tenant URL
 */
export function getTenantUrl(subdomain: string, path: string = ''): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const protocol = rootDomain.includes('localhost') ? 'http' : 'https';
  
  return `${protocol}://${subdomain}.${rootDomain}${path}`;
}

/**
 * Get root domain URL
 */
export function getRootUrl(path: string = ''): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const protocol = rootDomain.includes('localhost') ? 'http' : 'https';
  
  return `${protocol}://${rootDomain}${path}`;
}

// Made with Bob
