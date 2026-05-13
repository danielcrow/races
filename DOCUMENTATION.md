# Race Timing Platform - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup & Deployment](#setup--deployment)
4. [Features](#features)
5. [Authentication](#authentication)
6. [Multi-Tenancy](#multi-tenancy)
7. [Age Categories](#age-categories)
8. [Athlete Passcodes](#athlete-passcodes)
9. [Analytics](#analytics)
10. [Database](#database)
11. [API Reference](#api-reference)

---

## Overview

Multi-tenant race timing and results management platform built with Next.js 14, PostgreSQL, and Vercel.

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL (Vercel Postgres)
- **Storage**: Vercel Blob Storage
- **Cache**: Vercel KV (Redis)
- **Auth**: NextAuth.js v5
- **Deployment**: Vercel
- **Analytics**: Vercel Analytics & Speed Insights

---

## Architecture

### Multi-Tenant Model
- **Subdomain-based**: Each club gets a subdomain (e.g., `club1.racetiming.app`)
- **Tenant Isolation**: Data separated by `tenant_id` in all tables
- **Middleware**: Automatic tenant detection from subdomain

### Key Components
```
app/
├── api/              # API routes
├── admin/            # Admin dashboard
├── race/             # Race results pages
├── athlete-profile/  # Protected athlete profiles
└── auth/             # Authentication pages

lib/
├── db/               # Database utilities
├── btf-age-categories.ts
├── passcode.ts
└── tenant.ts
```

---

## Setup & Deployment

### Prerequisites
- Node.js 18+
- Vercel account
- PostgreSQL database (Vercel Postgres)
- Vercel Blob Storage
- Vercel KV (Redis)

### Environment Variables
Create `.env.local`:
```bash
# Database
POSTGRES_URL="postgresql://..."
POSTGRES_PRISMA_URL="postgresql://..."
POSTGRES_URL_NON_POOLING="postgresql://..."

# Blob Storage
BLOB_READ_WRITE_TOKEN="vercel_blob_..."

# KV Store
KV_URL="redis://..."
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="..."
KV_REST_API_READ_ONLY_TOKEN="..."

# Auth
AUTH_SECRET="your-secret-key"
AUTH_URL="https://yourdomain.com"
```

### Deployment Steps
1. **Push to Git**:
   ```bash
   git add .
   git commit -m "Deploy"
   git push
   ```

2. **Vercel Auto-Deploy**: Deploys in ~2 minutes

3. **Run Schema Migration**:
   - Visit `/admin`
   - Click "Run Schema Migration"

4. **Upload Data**:
   - Upload SQLite database via admin panel
   - System migrates data automatically

---

## Features

### Race Results
- ✅ Public race results pages
- ✅ Real-time split times
- ✅ Position tracking
- ✅ Gender and age category filtering
- ✅ Relay team support
- ✅ Export to CSV

### Athlete Profiles
- ✅ Protected with passcodes
- ✅ Race history and statistics
- ✅ Performance trends (charts)
- ✅ Best times and positions
- ✅ Session-based authentication

### Admin Dashboard
- ✅ Database upload (SQLite → PostgreSQL)
- ✅ Tenant management
- ✅ Passcode management
- ✅ Race filtering and search
- ✅ Export functionality

---

## Authentication

### NextAuth.js v5 Configuration
- **Providers**: Credentials (email/password)
- **Session**: JWT-based
- **Roles**: `user`, `admin`, `tenant_admin`, `super_admin`

### User Roles
- **user**: View race results
- **admin**: Upload data, manage races
- **tenant_admin**: Manage own tenant
- **super_admin**: Manage all tenants (desktop only)

### Protected Routes
- `/admin/*` - Requires authentication
- `/athlete-profile/*` - Requires passcode
- `/api/athletes/passcodes` - Admin only

---

## Multi-Tenancy

### Subdomain Detection
```typescript
// Middleware extracts tenant from subdomain
club1.racetiming.app → tenant_id: "club1"
localhost:3000 → tenant_id: "default"
```

### Tenant Isolation
All database queries include `tenant_id`:
```sql
SELECT * FROM races WHERE tenant_id = $1
```

### Creating Tenants
1. Visit `/register` (desktop only)
2. Enter subdomain, name, admin email
3. System creates tenant and admin user
4. Admin receives credentials

---

## Age Categories

### BTF (British Triathlon Federation) Categories

#### Youth Categories
- **U8**: Under 8 years
- **U10**: 8-9 years
- **U12**: 10-11 years
- **U14**: 12-13 years
- **U16**: 14-15 years

#### Adult Categories
- **JUN**: Junior (16-19 years)
- **SEN**: Senior (20-39 years)
- **V40**: Veteran 40-44
- **V45**: Veteran 45-49
- **V50**: Veteran 50-54
- **V55**: Veteran 55-59
- **V60**: Veteran 60-64
- **V65**: Veteran 65-69
- **V70**: Veteran 70-74
- **V75**: Veteran 75-79
- **V80**: Veteran 80+

### Age Calculation
- Age calculated as of **December 31st** of race year
- Athletes can compete in younger categories ("aging down")
- Stored in `race_results` table

### Filtering
Race results can be filtered by:
- Gender (Male/Female)
- Entry Type (Individual/Relay)
- Age Category (any BTF category)

---

## Athlete Passcodes

### Overview
Secure access control for athlete profile pages. Race results remain public.

### Passcode Format
- **Length**: 8 characters
- **Characters**: A-Z, 2-9 (excludes 0, O, I, 1)
- **Display**: ABCD-EFGH (with hyphen)
- **Storage**: ABCDEFGH (no hyphen)

### Admin Management
**Location**: `/admin/passcodes`

**Features**:
- View all athlete passcodes
- Search by name, ID, or passcode
- Copy to clipboard
- Regenerate individual passcodes
- Export to CSV
- Bulk generate for all athletes

### Athlete Access
1. Visit `/athlete-profile/[athleteId]`
2. Enter 8-character passcode
3. Access granted for browser session
4. View race history and statistics

### API Endpoints
```typescript
// Admin (auth required)
GET  /api/athletes/[athleteId]/passcode
POST /api/athletes/[athleteId]/passcode
GET  /api/athletes/passcodes
POST /api/athletes/passcodes

// Public
PUT  /api/athletes/[athleteId]/passcode/verify
```

---

## Analytics

### Vercel Analytics
- **Page Views**: Track popular pages
- **User Sessions**: Active users and duration
- **Geographic Data**: User locations
- **Device Types**: Desktop vs Mobile
- **Referrers**: Traffic sources

### Speed Insights
- **Core Web Vitals**: LCP, FID, CLS, TTFB
- **Performance Score**: Overall site speed
- **Real User Monitoring**: Actual user experience
- **Device Breakdown**: Performance by device

### Accessing Analytics
1. Go to https://vercel.com/dashboard
2. Select your project
3. Click "Analytics" or "Speed Insights" tabs

### Custom Events (Optional)
```typescript
import { track } from '@vercel/analytics'

track('race_upload', { raceId: 123, athleteCount: 50 })
```

---

## Database

### Schema Overview
```sql
-- Core Tables
races              # Race information
athletes           # Athlete profiles
splits             # Split times
race_results       # Materialized results
athlete_stats      # Pre-calculated statistics

-- Auth Tables
users              # User accounts
accounts           # OAuth accounts
sessions           # User sessions
verification_tokens
```

### Key Columns
**athletes**:
- `passcode` VARCHAR(8) - Athlete access code
- `date_of_birth` DATE - For age calculation

**race_results**:
- `age_on_dec31` INTEGER - Age on Dec 31st
- `age_category` VARCHAR(10) - BTF category code
- `age_category_name` VARCHAR(50) - Category name
- `is_relay` BOOLEAN - Relay team flag
- `relay_names` TEXT[] - Individual names

### Indexes
All tables indexed on:
- `tenant_id` (for multi-tenancy)
- Foreign keys
- Frequently queried columns

### Migration
**Schema updates**: `/api/migrate-schema`
**Data migration**: `/api/upload` (SQLite → PostgreSQL)

---

## API Reference

### Race Results
```typescript
GET /api/races
GET /api/race-results/[id]?gender=Male&relay=false&ageCategory=SEN
GET /api/athlete-races/[athleteId]
GET /api/athlete-splits/[raceId]/[athleteId]
```

### Admin Operations
```typescript
POST /api/upload              # Upload SQLite database
POST /api/migrate-schema      # Run schema migrations
GET  /api/tenants             # List tenants
POST /api/tenants             # Create tenant
```

### Passcode Management
```typescript
GET  /api/athletes/passcodes                    # List all
POST /api/athletes/passcodes                    # Generate all
GET  /api/athletes/[id]/passcode                # Get one
POST /api/athletes/[id]/passcode                # Generate one
PUT  /api/athletes/[id]/passcode/verify         # Verify
```

### Diagnostics
```typescript
GET /api/check-age-data       # Check age category data
GET /api/init-db              # Initialize database
```

---

## Troubleshooting

### Common Issues

**404 on new pages**:
- Deploy to production first
- Wait 2-3 minutes for build

**Passcode columns missing**:
- Run schema migration via admin panel
- Check database for columns

**Analytics not showing**:
- Wait 5-10 minutes after deployment
- Only works in production (not dev)

**Tenant not detected**:
- Check subdomain format
- Verify middleware is running
- Check `x-tenant` header

### Support
- Check documentation files
- Review error logs in Vercel dashboard
- Test locally first: `npm run dev`

---

## Made with Bob 🤖