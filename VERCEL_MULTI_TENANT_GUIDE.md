# Vercel Multi-Tenant Deployment Guide

## Table of Contents
1. [Overview](#overview)
2. [Architectural Change](#architectural-change)
3. [Deployment Strategy](#deployment-strategy)
4. [Environment Variables](#environment-variables)
5. [Database Options](#database-options)
6. [Deployment Workflow](#deployment-workflow)
7. [Benefits](#benefits)
8. [Migration Guide](#migration-guide)
9. [Cost Considerations](#cost-considerations)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This guide explains how to deploy and manage multiple single-tenant instances of the Race Timing Platform using Vercel. Each tenant (club/organization) gets their own completely isolated deployment with dedicated resources.

### What Changed

**Before**: Single codebase with subdomain-based multi-tenancy
- `club1.racetiming.app`, `club2.racetiming.app`
- Shared database with `tenant_id` column
- Complex tenant isolation logic in middleware
- Shared infrastructure and resources

**After**: Multiple independent single-tenant deployments
- `club1.com`, `club2.com` (or any custom domains)
- Separate Vercel project per tenant
- No multi-tenant complexity in code
- Complete resource isolation

---

## Architectural Change

### Old Multi-Tenant Architecture

```
┌─────────────────────────────────────┐
│     Single Vercel Project           │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Middleware (Tenant Router) │  │
│  └──────────────────────────────┘  │
│              ↓                      │
│  ┌──────────────────────────────┐  │
│  │   Shared Application Code    │  │
│  └──────────────────────────────┘  │
│              ↓                      │
│  ┌──────────────────────────────┐  │
│  │  Shared PostgreSQL Database  │  │
│  │  (tenant_id filtering)       │  │
│  └──────────────────────────────┘  │
│              ↓                      │
│  ┌──────────────────────────────┐  │
│  │   Shared Blob Storage        │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Challenges**:
- Complex tenant isolation logic
- Risk of data leakage between tenants
- Difficult to scale individual tenants
- Shared resource contention
- Hard to customize per tenant

### New Single-Tenant Architecture

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Club 1 Project  │  │  Club 2 Project  │  │  Club 3 Project  │
│                  │  │                  │  │                  │
│  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │
│  │    App     │  │  │  │    App     │  │  │  │    App     │  │
│  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │
│       ↓          │  │       ↓          │  │       ↓          │
│  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │
│  │ PostgreSQL │  │  │  │ PostgreSQL │  │  │  │ PostgreSQL │  │
│  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │
│       ↓          │  │       ↓          │  │       ↓          │
│  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │
│  │    Blob    │  │  │  │    Blob    │  │  │  │    Blob    │  │
│  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │
│                  │  │                  │  │                  │
│  club1.com       │  │  club2.com       │  │  club3.com       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Benefits**:
- Complete data isolation
- Independent scaling
- Simpler codebase (no tenant logic)
- Easy per-tenant customization
- Better security posture

---

## Deployment Strategy

### Core Principle

**One Vercel Project = One Tenant/Club**

Each tenant gets:
- ✅ Dedicated Vercel project
- ✅ Dedicated PostgreSQL database
- ✅ Dedicated Vercel Blob Storage
- ✅ Dedicated Vercel KV (optional, can be shared)
- ✅ Custom domain
- ✅ Independent environment variables
- ✅ Isolated deployments and rollbacks

### Project Naming Convention

Use a consistent naming scheme:
```
race-timing-{club-name}
race-timing-{club-slug}
{club-name}-race-timing
```

Examples:
- `race-timing-london-tri`
- `race-timing-manchester-runners`
- `race-timing-bristol-athletics`

### Repository Strategy

**Option A: Single Repository, Multiple Projects** (Recommended)
- One Git repository
- Multiple Vercel projects pointing to same repo
- Each project has unique environment variables
- Easier to maintain and update code

**Option B: Fork Per Tenant**
- Separate repository per tenant
- Allows tenant-specific customizations
- More maintenance overhead
- Harder to propagate updates

**Recommendation**: Use Option A unless tenants require significant customization.

---

## Environment Variables

### Required Variables Per Deployment

Each Vercel project needs these environment variables configured:

#### 1. Authentication
```bash
# Generate with: openssl rand -base64 32
AUTH_SECRET=your-unique-secret-key-here

# Your custom domain
NEXTAUTH_URL=https://club1.com
# or
NEXTAUTH_URL=https://club1.racetiming.app
```

**Important**: Each deployment MUST have a unique `AUTH_SECRET`.

#### 2. PostgreSQL Database
```bash
# Unique database per tenant
POSTGRES_URL=postgresql://user:pass@host:5432/club1_db
POSTGRES_PRISMA_URL=postgresql://user:pass@host:5432/club1_db?pgbouncer=true
POSTGRES_URL_NON_POOLING=postgresql://user:pass@host:5432/club1_db

# Alternative variable name (some providers use this)
DATABASE_URL=postgresql://user:pass@host:5432/club1_db
```

**Options**:
- Separate Vercel Postgres database per tenant
- Separate database on external provider (Supabase, Neon, Railway)
- Single database with separate schemas (see [Database Options](#database-options))

#### 3. Vercel Blob Storage
```bash
# Unique blob storage per tenant
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXXXXXXXXXX
```

Each tenant gets their own Blob Storage instance for complete data isolation.

#### 4. Vercel KV (Redis Cache)
```bash
# Can be shared across tenants or unique per tenant
KV_URL=redis://default:XXXXX@region.kv.vercel-storage.com:port
KV_REST_API_URL=https://region.kv.vercel-storage.com
KV_REST_API_TOKEN=XXXXXXXXXXXXX
KV_REST_API_READ_ONLY_TOKEN=XXXXXXXXXXXXX
```

**Recommendation**: 
- **Shared KV**: Cost-effective, cache data is temporary anyway
- **Separate KV**: Better isolation, slightly higher cost

### Setting Environment Variables

#### Via Vercel Dashboard
1. Go to project settings
2. Navigate to "Environment Variables"
3. Add each variable for Production, Preview, and Development
4. Click "Save"

#### Via Vercel CLI
```bash
# Set production variable
vercel env add AUTH_SECRET production

# Set all environments at once
vercel env add POSTGRES_URL production preview development

# Pull environment variables locally
vercel env pull .env.local
```

#### Via `vercel.json` (Not Recommended for Secrets)
```json
{
  "env": {
    "NEXTAUTH_URL": "https://club1.com"
  }
}
```

**Warning**: Never commit secrets to `vercel.json` or Git.

---

## Database Options

### Option A: Separate PostgreSQL Database Per Tenant (Recommended)

**Setup**: Create a new Vercel Postgres database for each tenant.

**Pros**:
- ✅ Complete data isolation
- ✅ Independent backups and restores
- ✅ Easy to scale per tenant
- ✅ Simple to manage
- ✅ No risk of cross-tenant queries

**Cons**:
- ❌ Higher cost (multiple databases)
- ❌ More databases to manage

**Cost**: ~$20/month per database (Vercel Postgres Pro)

**How to Create**:
```bash
# Via Vercel Dashboard
1. Go to Storage tab
2. Click "Create Database"
3. Select "Postgres"
4. Name it: "race-timing-club1"
5. Copy connection strings to project env vars

# Via Vercel CLI
vercel postgres create race-timing-club1
```

### Option B: Single Database with Separate Schemas

**Setup**: One PostgreSQL database with schema per tenant.

**Pros**:
- ✅ Lower cost (one database)
- ✅ Centralized management
- ✅ Easier backups

**Cons**:
- ❌ Requires schema-aware queries
- ❌ More complex application code
- ❌ Risk of cross-schema queries
- ❌ Shared resource pool

**Implementation**:

1. **Create schemas**:
```sql
-- Create schema for each tenant
CREATE SCHEMA club1;
CREATE SCHEMA club2;
CREATE SCHEMA club3;

-- Set search path per connection
SET search_path TO club1;
```

2. **Update connection strings**:
```bash
# Add schema to connection string
POSTGRES_URL=postgresql://user:pass@host:5432/race_timing?schema=club1
```

3. **Modify queries** (in [`lib/db/postgres.ts`](lib/db/postgres.ts:1)):
```typescript
// Set schema before each query
export async function query<T>(text: string, params?: any[]) {
  const schema = process.env.TENANT_SCHEMA || 'public';
  await pool.query(`SET search_path TO ${schema}`);
  return pool.query<T>(text, params);
}
```

**Recommendation**: Use Option A (separate databases) unless cost is a major constraint.

### Option C: External Database Provider

Use a third-party PostgreSQL provider:

**Providers**:
- **Supabase**: Free tier available, generous limits
- **Neon**: Serverless Postgres, pay-per-use
- **Railway**: Simple pricing, good performance
- **AWS RDS**: Enterprise-grade, more complex
- **Digital Ocean**: Managed databases, predictable pricing

**Example with Supabase**:
```bash
# Create project per tenant on Supabase
# Copy connection string
POSTGRES_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
```

---

## Deployment Workflow

### Step-by-Step: Deploy a New Tenant

#### Prerequisites
- Vercel account
- Git repository with race timing code
- Custom domain (optional)

#### Step 1: Create Vercel Project

**Via Vercel Dashboard**:
```
1. Go to https://vercel.com/new
2. Import your Git repository
3. Configure project:
   - Project Name: race-timing-club1
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: (leave default)
   - Output Directory: (leave default)
4. Click "Deploy" (will fail without env vars - that's OK)
```

**Via Vercel CLI**:
```bash
# Clone repository
git clone https://github.com/your-org/race-timing.git
cd race-timing

# Link to new Vercel project
vercel link --project race-timing-club1

# Deploy
vercel --prod
```

#### Step 2: Create PostgreSQL Database

**Via Vercel Dashboard**:
```
1. Go to project → Storage tab
2. Click "Create Database"
3. Select "Postgres"
4. Name: race-timing-club1-db
5. Region: Choose closest to users
6. Click "Create"
7. Click "Connect" → Copy environment variables
```

**Via Vercel CLI**:
```bash
# Create database
vercel postgres create race-timing-club1-db

# Link to project
vercel postgres link race-timing-club1-db
```

#### Step 3: Create Blob Storage

**Via Vercel Dashboard**:
```
1. Go to project → Storage tab
2. Click "Create Database"
3. Select "Blob"
4. Name: race-timing-club1-blob
5. Click "Create"
6. Copy BLOB_READ_WRITE_TOKEN
```

**Via Vercel CLI**:
```bash
# Create blob storage
vercel blob create race-timing-club1-blob

# Link to project
vercel blob link race-timing-club1-blob
```

#### Step 4: Create KV Store (Optional)

**Via Vercel Dashboard**:
```
1. Go to project → Storage tab
2. Click "Create Database"
3. Select "KV"
4. Name: race-timing-club1-kv (or use shared KV)
5. Click "Create"
6. Copy KV environment variables
```

**Via Vercel CLI**:
```bash
# Create KV store
vercel kv create race-timing-club1-kv

# Link to project
vercel kv link race-timing-club1-kv
```

#### Step 5: Configure Environment Variables

**Via Vercel Dashboard**:
```
1. Go to project → Settings → Environment Variables
2. Add each variable:

AUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://club1.com

POSTGRES_URL=<from Step 2>
POSTGRES_PRISMA_URL=<from Step 2>
POSTGRES_URL_NON_POOLING=<from Step 2>

BLOB_READ_WRITE_TOKEN=<from Step 3>

KV_URL=<from Step 4>
KV_REST_API_URL=<from Step 4>
KV_REST_API_TOKEN=<from Step 4>
KV_REST_API_READ_ONLY_TOKEN=<from Step 4>

3. Select environments: Production, Preview, Development
4. Click "Save"
```

**Via Vercel CLI**:
```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Add environment variables
vercel env add AUTH_SECRET production
vercel env add NEXTAUTH_URL production
vercel env add POSTGRES_URL production
# ... repeat for all variables

# Or use a script
cat > .env.production << EOF
AUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://club1.com
POSTGRES_URL=postgresql://...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
EOF

# Import from file
vercel env pull .env.local
```

#### Step 6: Deploy Application

**Trigger Deployment**:
```bash
# Via CLI
vercel --prod

# Or push to Git (auto-deploys)
git push origin main
```

**Monitor Deployment**:
```
1. Go to Vercel Dashboard → Deployments
2. Watch build logs
3. Wait for "Ready" status (~2-3 minutes)
```

#### Step 7: Initialize Database Schema

**Via Admin Panel**:
```
1. Visit https://club1.com/admin
2. Login with admin credentials
3. Click "🔧 Run Schema Migration"
4. Wait for success message
```

**Via API** (if admin panel not accessible):
```bash
curl -X POST https://club1.com/api/migrate-schema \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Step 8: Upload Initial Data

**Via Admin Panel**:
```
1. Go to https://club1.com/admin
2. Select migration mode: "Full Migration"
3. Upload SQLite database file
4. Wait for migration to complete
5. Verify data in race results pages
```

#### Step 9: Generate Athlete Passcodes

**Via Admin Panel**:
```
1. In admin panel, click "🔑 Generate All Passcodes"
2. Wait for confirmation
3. Click "📋 View All Passcodes"
4. Export to CSV for distribution
```

#### Step 10: Configure Custom Domain

**Via Vercel Dashboard**:
```
1. Go to project → Settings → Domains
2. Click "Add Domain"
3. Enter: club1.com
4. Follow DNS configuration instructions:
   - Add A record: 76.76.21.21
   - Or CNAME: cname.vercel-dns.com
5. Wait for DNS propagation (~5-60 minutes)
6. SSL certificate auto-generated
```

**Update Environment Variable**:
```bash
# Update NEXTAUTH_URL to custom domain
vercel env rm NEXTAUTH_URL production
vercel env add NEXTAUTH_URL production
# Enter: https://club1.com
```

**Redeploy**:
```bash
vercel --prod
```

#### Step 11: Verify Deployment

**Checklist**:
- [ ] Visit custom domain (https://club1.com)
- [ ] Check race results page loads
- [ ] Test athlete profile with passcode
- [ ] Login to admin panel
- [ ] Upload test data
- [ ] Generate passcodes
- [ ] Test all filters (gender, age category, relay)
- [ ] Export to CSV
- [ ] Check Vercel Analytics (wait 5-10 minutes)

---

## Benefits

### 1. Complete Data Isolation

**Security**: No risk of data leakage between tenants
- Separate databases = impossible to query wrong tenant's data
- No `tenant_id` filtering logic to bypass
- Each tenant's data physically separated

**Compliance**: Easier to meet data residency requirements
- Deploy tenant in specific region
- Separate backups per tenant
- Independent data retention policies

### 2. Independent Scaling

**Performance**: Scale resources per tenant's needs
- High-traffic tenant doesn't affect others
- Upgrade database size for specific tenant
- Add CDN or edge functions per tenant

**Cost Optimization**: Pay only for what each tenant uses
- Small tenants on free/hobby tier
- Large tenants on pro/enterprise tier
- No shared resource contention

### 3. Simpler Codebase

**No Multi-Tenant Complexity**:
```typescript
// OLD: Every query needs tenant filtering
const races = await query(
  'SELECT * FROM races WHERE tenant_id = $1',
  [tenantId]
);

// NEW: Simple queries, no tenant logic
const races = await query('SELECT * FROM races');
```

**Easier to Maintain**:
- No middleware for tenant detection
- No risk of forgetting `tenant_id` filter
- Simpler testing (no tenant mocking)
- Clearer code paths

### 4. Easy Customization

**Per-Tenant Features**:
- Custom branding (logo, colors)
- Tenant-specific features
- Different pricing tiers
- Custom integrations

**Implementation**:
```bash
# Fork repository for custom tenant
git clone https://github.com/your-org/race-timing.git race-timing-custom-club
cd race-timing-custom-club

# Make customizations
# ... edit files ...

# Deploy to separate Vercel project
vercel --prod
```

### 5. Better Reliability

**Fault Isolation**:
- One tenant's issues don't affect others
- Database problems isolated to single tenant
- Can take tenant offline for maintenance
- Independent rollbacks

**Deployment Safety**:
- Test changes on single tenant first
- Gradual rollout across tenants
- Easy rollback per tenant
- No "all or nothing" deployments

### 6. Flexible Infrastructure

**Mix and Match**:
- Some tenants on Vercel Postgres
- Others on Supabase or Neon
- Different regions per tenant
- Different backup strategies

**Migration Path**:
- Easy to move tenant to different infrastructure
- Can migrate one tenant at a time
- No impact on other tenants

---

## Migration Guide

### Migrating from Old Multi-Tenant System

#### Overview

If you have an existing multi-tenant deployment with shared database, here's how to migrate to separate single-tenant deployments.

#### Step 1: Identify Tenants

**Extract tenant list from database**:
```sql
-- Get all unique tenants
SELECT DISTINCT tenant_id, COUNT(*) as race_count
FROM races
GROUP BY tenant_id
ORDER BY tenant_id;
```

**Create migration plan**:
```
Tenant ID | Races | Athletes | Priority | Target Domain
----------|-------|----------|----------|---------------
club1     | 45    | 1,200    | High     | club1.com
club2     | 23    | 600      | Medium   | club2.com
club3     | 67    | 2,100    | High     | club3.com
```

#### Step 2: Export Tenant Data

**Create export script** (`scripts/export-tenant-data.ts`):
```typescript
import { query } from '../lib/db/postgres';
import fs from 'fs';

async function exportTenantData(tenantId: string) {
  // Export races
  const races = await query(
    'SELECT * FROM races WHERE tenant_id = $1',
    [tenantId]
  );
  
  // Export athletes
  const athletes = await query(
    'SELECT * FROM athletes WHERE tenant_id = $1',
    [tenantId]
  );
  
  // Export splits
  const splits = await query(
    'SELECT * FROM splits WHERE race_id IN (SELECT race_id FROM races WHERE tenant_id = $1)',
    [tenantId]
  );
  
  // Export race_results
  const results = await query(
    'SELECT * FROM race_results WHERE race_id IN (SELECT race_id FROM races WHERE tenant_id = $1)',
    [tenantId]
  );
  
  // Save to JSON
  const data = {
    tenant_id: tenantId,
    races: races.rows,
    athletes: athletes.rows,
    splits: splits.rows,
    race_results: results.rows,
    exported_at: new Date().toISOString()
  };
  
  fs.writeFileSync(
    `exports/${tenantId}-export.json`,
    JSON.stringify(data, null, 2)
  );
  
  console.log(`Exported ${tenantId}: ${races.rows.length} races, ${athletes.rows.length} athletes`);
}

// Export all tenants
const tenants = ['club1', 'club2', 'club3'];
for (const tenant of tenants) {
  await exportTenantData(tenant);
}
```

**Run export**:
```bash
mkdir exports
npx tsx scripts/export-tenant-data.ts
```

#### Step 3: Create New Tenant Projects

For each tenant, follow the [Deployment Workflow](#deployment-workflow):

```bash
# Tenant 1
vercel link --project race-timing-club1
vercel postgres create race-timing-club1-db
vercel blob create race-timing-club1-blob
# ... configure env vars ...
vercel --prod

# Tenant 2
vercel link --project race-timing-club2
vercel postgres create race-timing-club2-db
vercel blob create race-timing-club2-blob
# ... configure env vars ...
vercel --prod

# Repeat for all tenants
```

#### Step 4: Import Data to New Databases

**Create import script** (`scripts/import-tenant-data.ts`):
```typescript
import { query } from '../lib/db/postgres';
import fs from 'fs';

async function importTenantData(jsonFile: string) {
  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
  
  console.log(`Importing ${data.tenant_id}...`);
  
  // Import races (remove tenant_id column)
  for (const race of data.races) {
    await query(
      `INSERT INTO races (race_id, race_name, race_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (race_id) DO NOTHING`,
      [race.race_id, race.race_name, race.race_date, race.created_at, race.updated_at]
    );
  }
  
  // Import athletes (remove tenant_id column)
  for (const athlete of data.athletes) {
    await query(
      `INSERT INTO athletes (athlete_id, bib_number, first_name, last_name, gender, date_of_birth, passcode, passcode_created_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (athlete_id) DO NOTHING`,
      [athlete.athlete_id, athlete.bib_number, athlete.first_name, athlete.last_name, athlete.gender, athlete.date_of_birth, athlete.passcode, athlete.passcode_created_at, athlete.created_at, athlete.updated_at]
    );
  }
  
  // Import splits
  for (const split of data.splits) {
    await query(
      `INSERT INTO splits (race_id, athlete_id, split_description, split_datetime, previous_split_datetime, split_seconds, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [split.race_id, split.athlete_id, split.split_description, split.split_datetime, split.previous_split_datetime, split.split_seconds, split.created_at]
    );
  }
  
  // Import race_results
  for (const result of data.race_results) {
    await query(
      `INSERT INTO race_results (race_id, athlete_id, position, bib_number, first_name, last_name, full_name, gender, age_on_dec31, age_category, age_category_name, total_seconds, total_time, is_relay, relay_names, splits, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       ON CONFLICT (race_id, athlete_id) DO NOTHING`,
      [result.race_id, result.athlete_id, result.position, result.bib_number, result.first_name, result.last_name, result.full_name, result.gender, result.age_on_dec31, result.age_category, result.age_category_name, result.total_seconds, result.total_time, result.is_relay, result.relay_names, result.splits, result.created_at, result.updated_at]
    );
  }
  
  console.log(`✅ Imported ${data.tenant_id}`);
}

// Import tenant data
await importTenantData('exports/club1-export.json');
```

**Run import for each tenant**:
```bash
# Set database connection for tenant 1
export POSTGRES_URL="postgresql://...club1-db..."
npx tsx scripts/import-tenant-data.ts

# Set database connection for tenant 2
export POSTGRES_URL="postgresql://...club2-db..."
npx tsx scripts/import-tenant-data.ts

# Repeat for all tenants
```

#### Step 5: Update DNS

**For each tenant**:
```
1. Go to domain registrar (GoDaddy, Namecheap, etc.)
2. Update DNS records:
   - Old: club1.racetiming.app → CNAME → old-vercel-project
   - New: club1.com → A → 76.76.21.21 (Vercel)
3. Wait for DNS propagation (5-60 minutes)
4. Verify: https://club1.com
```

#### Step 6: Notify Users

**Email template**:
```
Subject: [Club Name] Race Timing Platform - New Domain

Hi [Club Admin],

We've upgraded your race timing platform to a dedicated deployment!

New URL: https://club1.com
Old URL: https://club1.racetiming.app (will redirect)

What's New:
✅ Faster performance
✅ Better security
✅ Dedicated resources
✅ Custom domain

Your data, passcodes, and settings have been migrated automatically.

Questions? Reply to this email.

Thanks,
[Your Team]
```

#### Step 7: Decommission Old System

**After all tenants migrated**:
```
1. Set up redirects from old domains to new domains
2. Keep old system running for 30 days (grace period)
3. Archive old database
4. Delete old Vercel project
5. Cancel old database subscription
```

**Redirect configuration** (in old project):
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  
  // Redirect old subdomains to new domains
  const redirects: Record<string, string> = {
    'club1.racetiming.app': 'https://club1.com',
    'club2.racetiming.app': 'https://club2.com',
    'club3.racetiming.app': 'https://club3.com',
  };
  
  if (redirects[hostname]) {
    return NextResponse.redirect(redirects[hostname] + request.nextUrl.pathname);
  }
  
  return NextResponse.next();
}
```

---

## Cost Considerations

### Per-Tenant Costs (Vercel)

**Hobby Tier** (Free):
- ✅ Unlimited deployments
- ✅ 100 GB bandwidth/month
- ✅ Serverless functions
- ❌ No commercial use
- ❌ No team features

**Pro Tier** ($20/month per project):
- ✅ Commercial use
- ✅ 1 TB bandwidth/month
- ✅ Advanced analytics
- ✅ Team collaboration
- ✅ Password protection
- ✅ Custom domains

**Enterprise** (Custom pricing):
- ✅ Everything in Pro
- ✅ SLA guarantees
- ✅ Dedicated support
- ✅ Advanced security
- ✅ SSO/SAML

### Database Costs

**Vercel Postgres**:
- Hobby: Free (256 MB, 60 hours compute/month)
- Pro: $20/month (512 MB, 100 hours compute/month)
- Enterprise: Custom

**External Providers**:
- **Supabase**: Free tier (500 MB), Pro $25/month (8 GB)
- **Neon**: Free tier (3 GB), Pro $19/month (unlimited)
- **Railway**: $5/month (1 GB), scales with usage

### Storage Costs

**Vercel Blob**:
- Free: 500 MB
- Pro: $0.15/GB/month

**Vercel KV**:
- Free: 256 MB
- Pro: $0.20/GB/month

### Example Cost Breakdown

**Small Club** (5 races/year, 200 athletes):
```
Vercel Pro:           $20/month
Vercel Postgres Pro:  $20/month
Vercel Blob:          ~$1/month (5 GB)
Vercel KV:            $0/month (shared)
Custom Domain:        $12/year
------------------------
Total:                ~$41/month + $12/year
```

**Large Club** (50 races/year, 2,000 athletes):
```
Vercel Pro:           $20/month
External DB (Neon):   $19/month
Vercel Blob:          ~$5/month (30 GB)
Vercel KV:            $0/month (shared)
Custom Domain:        $12/year
------------------------
Total:                ~$44/month + $12/year
```

**Cost Optimization Tips**:
1. Share KV store across tenants (cache data is temporary)
2. Use external database providers (often cheaper)
3. Start small clubs on Hobby tier (if non-commercial)
4. Use Vercel's bandwidth efficiently (CDN, image optimization)
5. Archive old race data to reduce database size

---

## Troubleshooting

### Common Issues

#### 1. Environment Variables Not Set

**Symptom**: Deployment succeeds but app crashes with "Missing environment variable"

**Solution**:
```bash
# Check which variables are set
vercel env ls

# Add missing variable
vercel env add MISSING_VAR production

# Redeploy
vercel --prod
```

#### 2. Database Connection Fails

**Symptom**: "Connection refused" or "SSL required"

**Solution**:
```bash
# Verify connection string format
echo $POSTGRES_URL

# Should be: postgresql://user:pass@host:5432/dbname

# Check SSL settings in lib/db/postgres.ts
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
```

#### 3. Custom Domain Not Working

**Symptom**: Domain shows "404: NOT_FOUND"

**Solution**:
```
1. Check DNS propagation: https://dnschecker.org
2. Verify A record: 76.76.21.21
3. Or CNAME: cname.vercel-dns.com
4. Wait 5-60 minutes for propagation
5. Check Vercel Dashboard → Domains for status
```

#### 4. Blob Storage Upload Fails

**Symptom**: "Unauthorized" or "Invalid token"

**Solution**:
```bash
# Verify token is set
vercel env get BLOB_READ_WRITE_TOKEN production

# Regenerate token if needed
1. Go to Vercel Dashboard → Storage → Blob
2. Click "Regenerate Token"
3. Update environment variable
4. Redeploy
```

#### 5. Passcodes Not Working

**Symptom**: "Passcode column does not exist"

**Solution**:
```
1. Visit /admin
2. Click "Run Schema Migration"
3. Wait for success message
4. Generate passcodes
```

#### 6. Analytics Not Showing

**Symptom**: No data in Vercel Analytics

**Solution**:
```
1. Wait 5-10 minutes after deployment
2. Check components in app/layout.tsx:
   - <Analytics />
   - <SpeedInsights />
3. Analytics only work in production (not dev)
4. Verify project is on Pro tier (required for analytics)
```

#### 7. Build Fails

**Symptom**: "Build failed" in Vercel deployment

**Solution**:
```bash
# Test build locally
npm run build

# Check for TypeScript errors
npm run type-check

# Check for linting errors
npm run lint

# Fix errors and redeploy
git add .
git commit -m "Fix build errors"
git push
```

#### 8. Slow Performance

**Symptom**: Pages load slowly

**Solution**:
```
1. Check database query performance:
   - Add indexes for frequently queried columns
   - Use EXPLAIN ANALYZE for slow queries
   
2. Enable caching:
   - Use Vercel KV for frequently accessed data
   - Add cache headers to API routes
   
3. Optimize images:
   - Use Next.js Image component
   - Enable Vercel image optimization
   
4. Check Vercel Speed Insights for bottlenecks
```

### Getting Help

**Resources**:
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Vercel Support](https://vercel.com/support)

**Support Channels**:
- Vercel Dashboard → Help
- GitHub Issues (for code issues)
- Email support (for deployment issues)

---

## Best Practices

### 1. Naming Conventions

**Consistent naming across all resources**:
```
Project:    race-timing-{club-slug}
Database:   race-timing-{club-slug}-db
Blob:       race-timing-{club-slug}-blob
KV:         race-timing-{club-slug}-kv (or shared-kv)
Domain:     {club-slug}.com or {club-name}.racetiming.app
```

### 2. Environment Management

**Use environment-specific variables**:
```bash
# Production
NEXTAUTH_URL=https://club1.com

# Preview (for testing)
NEXTAUTH_URL=https://race-timing-club1-preview.vercel.app

# Development
NEXTAUTH_URL=http://localhost:3000
```

### 3. Backup Strategy

**Regular backups**:
```bash
# Automated (Vercel Postgres)
- Daily automatic backups
- 7-day retention
- Point-in-time recovery

# Manual backups
pg_dump $POSTGRES_URL > backup-$(date +%Y%m%d).sql

# Store backups securely
aws s3 cp backup-*.sql s3://backups/race-timing/
```

### 4. Monitoring

**Set up alerts**:
```
1. Vercel Dashboard → Project → Settings → Notifications
2. Enable alerts for:
   - Deployment failures
   - High error rates
   - Performance degradation
   - Quota limits
```

### 5. Security

**Security checklist**:
- [ ] Unique `AUTH_SECRET` per deployment
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] Environment variables never in code
- [ ] Database credentials rotated regularly
- [ ] Admin panel protected with authentication
- [ ] Rate limiting on API routes
- [ ] Input validation on all forms
- [ ] SQL injection prevention (parameterized queries)

### 6. Documentation

**Maintain per-tenant documentation**:
```
docs/
├── club1/
│   ├── deployment-info.md
│   ├── custom-features.md
│   └── contact-info.md
├── club2/
│   ├── deployment-info.md
│   └── contact-info.md
└── template/
    └── deployment-info.md
```

### 7. Testing

**Test before deploying to production**:
```bash
# Local testing
npm run dev

# Preview deployment (automatic on PR)
git checkout -b feature/new-feature
git push origin feature/new-feature
# Vercel creates preview deployment

# Test on preview URL
https://race-timing-club1-git-feature-new-feature.vercel.app

# Merge to production
git checkout main
git merge feature/new-feature
git push origin main
```

---

## Conclusion

This guide provides a comprehensive approach to deploying and managing multiple single-tenant instances of the Race Timing Platform using Vercel. The single-tenant architecture offers:

✅ **Better Security**: Complete data isolation per tenant
✅ **Simpler Code**: No multi-tenant complexity
✅ **Independent Scaling**: Scale each tenant independently
✅ **Easier Maintenance**: Isolated deployments and rollbacks
✅ **Flexible Infrastructure**: Mix and match providers per tenant

### Next Steps

1. **Plan Your Migration**: Identify tenants and prioritize
2. **Create First Tenant**: Follow deployment workflow
3. **Test Thoroughly**: Verify all features work
4. **Migrate Remaining Tenants**: One at a time
5. **Monitor and Optimize**: Use Vercel Analytics

### Support

For questions or issues:
- Review this guide
- Check [DOCUMENTATION.md](DOCUMENTATION.md)
- Check [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
- Contact Vercel Support

---

## Made with Bob 🤖