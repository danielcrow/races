import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { isValidSubdomain } from '@/lib/tenant';
import {
  getUser,
  setUser,
  getTenant,
  setTenant,
  getAllTenants,
  userExists,
  tenantExists,
  type User,
  type Tenant
} from '@/lib/kv-storage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subdomain, name, adminEmail, adminPassword, adminName } = body;

    // Validation
    if (!subdomain || !name || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate subdomain format
    if (!isValidSubdomain(subdomain)) {
      return NextResponse.json(
        { error: 'Invalid subdomain format. Use 3-50 characters, alphanumeric and hyphens only.' },
        { status: 400 }
      );
    }

    // Check if tenant already exists
    if (await tenantExists(subdomain)) {
      return NextResponse.json(
        { error: 'Subdomain already taken' },
        { status: 409 }
      );
    }

    // Check if admin email already exists
    if (await userExists(adminEmail)) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Create tenant
    const tenant: Tenant = {
      subdomain,
      name,
      status: 'active',
      createdAt: new Date().toISOString(),
      adminEmail
    };
    await setTenant(subdomain, tenant);

    // Create admin user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const newUser: User = {
      id: userId,
      email: adminEmail,
      password: hashedPassword,
      name: adminName || 'Admin User',
      tenantId: subdomain,
      role: 'tenant_admin'
    };
    await setUser(adminEmail, newUser);

    // In production, you would:
    // 1. Create tenant record in database
    // 2. Create admin user in database
    // 3. Initialize empty database blob for tenant
    // 4. Send welcome email

    return NextResponse.json({
      success: true,
      tenant: {
        subdomain: tenant.subdomain,
        name: tenant.name,
        status: tenant.status,
        createdAt: tenant.createdAt
      },
      message: 'Tenant created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating tenant:', error);
    return NextResponse.json(
      { error: 'Failed to create tenant' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin (tenant_admin or super_admin)
    const userRole = (session.user as any).role;
    if (userRole !== 'tenant_admin' && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get all tenants
    const tenants = await getAllTenants();
    
    // Filter tenants based on user role
    const userTenantId = (session.user as any).tenantId;
    let tenantList;
    
    if (userRole === 'super_admin' && userTenantId === 'default') {
      // Super admin can see all tenants
      tenantList = tenants.map(t => ({
        subdomain: t.subdomain,
        name: t.name,
        status: t.status,
        createdAt: t.createdAt,
        adminEmail: t.adminEmail
      }));
    } else {
      // Tenant admin can only see their own tenant
      tenantList = tenants
        .filter(t => t.subdomain === userTenantId)
        .map(t => ({
          subdomain: t.subdomain,
          name: t.name,
          status: t.status,
          createdAt: t.createdAt,
          adminEmail: t.adminEmail
        }));
    }

    return NextResponse.json({
      tenants: tenantList,
      count: tenantList.length
    });

  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenants' },
      { status: 500 }
    );
  }
}

// Made with Bob