/**
 * Persistent user storage using Upstash Redis (Vercel KV replacement)
 * This replaces the in-memory storage with persistent Redis storage
 */

import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'member';
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

// Initialize default admin user
async function initializeDefaults() {
  const defaultUser: User = {
    id: '1',
    email: 'admin@example.com',
    password: bcrypt.hashSync('admin123', 10),
    name: 'Admin User',
    role: 'admin'
  };

  if (redis) {
    try {
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
    if (!memoryUsers.has('admin@example.com')) {
      memoryUsers.set('admin@example.com', defaultUser);
      console.log('[kv-storage] Initialized default admin user in memory');
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

// Check if user exists
export async function userExists(email: string): Promise<boolean> {
  const user = await getUser(email);
  return user !== null;
}

// Made with Bob