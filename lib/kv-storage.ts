/**
 * Persistent user and tenant storage using Upstash Redis (Vercel KV replacement)
 * This replaces the in-memory storage with persistent Redis storage
 */

import { Redis } from '@upstash/redis';
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

// Initialize Redis client
// In production, this uses KV_REST_API_URL and KV_REST_API_TOKEN from environment
// For local development, you can use Upstash Redis directly or mock it
let redis: Redis | null = null;

try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    console.log('[kv-storage] Redis client initialized');
  } else {
    console.log('[kv-storage] Redis not configured, using fallback in-memory storage');
  }
} catch (error) {
  console.error('[kv-storage] Failed to initialize Redis:', error);
}

// Fallback in-memory storage for development
const memoryUsers = new Map<string, User>();
const memoryTenants = new Map<string, Tenant>();

// Initialize default tenant and admin user
async function initializeDefaults() {
  const defaultTenant: Tenant = {
    subdomain: 'default',
    name: 'Default Race Club',
    status: 'active',
    createdAt: new Date().toISOString(),
    adminEmail: 'admin@example.com'
  };

  const defaultUser: User = {
    id: '1',
    email: 'admin@example.com',
    password: bcrypt.hashSync('admin123', 10),
    name: 'Super Admin',
    tenantId: 'default',
    role: 'super_admin'
  };

  if (redis) {
    try {
      // Check if default tenant exists
      const existingTenant = await redis.get(`tenant:default`);
      if (!existingTenant) {
        await redis.set(`tenant:default`, JSON.stringify(defaultTenant));
        await redis.sadd('tenants:all', 'default');
        console.log('[kv-storage] Created default tenant in Redis');
      }

      // Check if default user exists
      const existingUser = await redis.get(`user:admin@example.com`);
      if (!existingUser) {
        await redis.set(`user:admin@example.com`, JSON.stringify(defaultUser));
        await redis.sadd('users:all', 'admin@example.com');
        console.log('[kv-storage] Created default admin user in Redis');
      }
    } catch (error) {
      console.error('[kv-storage] Error initializing defaults in Redis:', error);
    }
  } else {
    // Fallback to memory
    if (!memoryTenants.has('default')) {
      memoryTenants.set('default', defaultTenant);
      memoryUsers.set('admin@example.com', defaultUser);
      console.log('[kv-storage] Initialized defaults in memory');
    }
  }
}

// Track if defaults have been initialized
let defaultsInitialized = false;

// Lazy initialization - only initialize when first accessed
async function ensureDefaults() {
  if (defaultsInitialized) return;
  defaultsInitialized = true;
  await initializeDefaults();
}

// User operations
export async function getUser(email: string): Promise<User | null> {
  await ensureDefaults();
  if (redis) {
    try {
      const data = await redis.get(`user:${email}`);
      return data ? (typeof data === 'string' ? JSON.parse(data) : data as User) : null;
    } catch (error) {
      console.error('[kv-storage] Error getting user from Redis:', error);
      return null;
    }
  }
  return memoryUsers.get(email) || null;
}

export async function setUser(email: string, user: User): Promise<void> {
  await ensureDefaults();
  if (redis) {
    try {
      await redis.set(`user:${email}`, JSON.stringify(user));
      await redis.sadd('users:all', email);
    } catch (error) {
      console.error('[kv-storage] Error setting user in Redis:', error);
      throw error;
    }
  } else {
    memoryUsers.set(email, user);
  }
}

export async function getAllUsers(): Promise<User[]> {
  await ensureDefaults();
  if (redis) {
    try {
      const emails = await redis.smembers('users:all');
      const users: User[] = [];
      for (const email of emails) {
        const user = await getUser(email as string);
        if (user) users.push(user);
      }
      return users;
    } catch (error) {
      console.error('[kv-storage] Error getting all users from Redis:', error);
      return [];
    }
  }
  return Array.from(memoryUsers.values());
}

// Tenant operations
export async function getTenant(subdomain: string): Promise<Tenant | null> {
  await ensureDefaults();
  if (redis) {
    try {
      const data = await redis.get(`tenant:${subdomain}`);
      return data ? (typeof data === 'string' ? JSON.parse(data) : data as Tenant) : null;
    } catch (error) {
      console.error('[kv-storage] Error getting tenant from Redis:', error);
      return null;
    }
  }
  return memoryTenants.get(subdomain) || null;
}

export async function setTenant(subdomain: string, tenant: Tenant): Promise<void> {
  await ensureDefaults();
  if (redis) {
    try {
      await redis.set(`tenant:${subdomain}`, JSON.stringify(tenant));
      await redis.sadd('tenants:all', subdomain);
    } catch (error) {
      console.error('[kv-storage] Error setting tenant in Redis:', error);
      throw error;
    }
  } else {
    memoryTenants.set(subdomain, tenant);
  }
}

export async function getAllTenants(): Promise<Tenant[]> {
  await ensureDefaults();
  if (redis) {
    try {
      const subdomains = await redis.smembers('tenants:all');
      const tenants: Tenant[] = [];
      for (const subdomain of subdomains) {
        const tenant = await getTenant(subdomain as string);
        if (tenant) tenants.push(tenant);
      }
      return tenants;
    } catch (error) {
      console.error('[kv-storage] Error getting all tenants from Redis:', error);
      return [];
    }
  }
  return Array.from(memoryTenants.values());
}

// Check if user exists
export async function userExists(email: string): Promise<boolean> {
  const user = await getUser(email);
  return user !== null;
}

// Check if tenant exists
export async function tenantExists(subdomain: string): Promise<boolean> {
  const tenant = await getTenant(subdomain);
  return tenant !== null;
}

// Made with Bob