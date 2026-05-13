/**
 * Shared user and tenant storage
 * In production, this would be replaced with a proper database
 */

import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  tenantId: string;
  role: 'super_admin' | 'tenant_admin' | 'tenant_member';
}

export interface Tenant {
  subdomain: string;
  name: string;
  status: 'active' | 'suspended';
  createdAt: string;
  adminEmail: string;
}

// Shared storage maps
export const users = new Map<string, User>();
export const tenants = new Map<string, Tenant>();

// Initialize with default tenant and admin user
function initializeDefaults() {
  if (!tenants.has('default')) {
    console.log('[user-storage] Initializing default tenant and admin user');
    
    tenants.set('default', {
      subdomain: 'default',
      name: 'Default Race Club',
      status: 'active',
      createdAt: new Date().toISOString(),
      adminEmail: 'admin@example.com'
    });

    users.set('admin@example.com', {
      id: '1',
      email: 'admin@example.com',
      password: bcrypt.hashSync('admin123', 10),
      name: 'Admin User',
      tenantId: 'default',
      role: 'super_admin'
    });
    
    console.log('[user-storage] Initialized. Users count:', users.size, 'Tenants count:', tenants.size);
  }
}

// Initialize immediately
initializeDefaults();

// Made with Bob