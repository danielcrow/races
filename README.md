# Race Timing Platform

Single-tenant race timing and results management platform with BTF age categories, athlete passcodes, and real-time analytics.

## Features

- 🏃 **Race Results** - Public results with filtering by gender, age category, and relay status
- 🔐 **Athlete Profiles** - Protected with secure passcodes, showing race history and statistics
- 📊 **BTF Age Categories** - British Triathlon Federation standard categories
- 📈 **Analytics** - Vercel Analytics and Speed Insights integrated
- 🎯 **Admin Dashboard** - Database upload, passcode management
- 🚀 **Simple Deployment** - Single-tenant architecture for easy setup and management

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL (Vercel Postgres)
- **Storage**: Vercel Blob Storage
- **Cache**: Vercel KV (Redis)
- **Auth**: NextAuth.js v5
- **Deployment**: Vercel

## Quick Start

### Prerequisites
- Node.js 18+
- Vercel account with Postgres, Blob Storage, and KV

### Setup

1. **Clone and Install**
   ```bash
   git clone <repo-url>
   cd races
   npm install
   ```

2. **Environment Variables**
   Copy `.env.example` to `.env.local` and fill in:
   - `POSTGRES_URL` - Database connection
   - `BLOB_READ_WRITE_TOKEN` - Blob storage
   - `KV_URL` - Redis cache
   - `AUTH_SECRET` - Auth secret key

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

4. **Deploy to Vercel**
   ```bash
   git push
   ```
   Vercel auto-deploys on push

### First-Time Setup

After deployment:

1. **Run Schema Migration**
   - Visit `/admin`
   - Click "Run Schema Migration"

2. **Upload Data**
   - Upload SQLite database via admin panel
   - System migrates data automatically

3. **Generate Passcodes**
   - Click "Generate All Passcodes"
   - View at `/admin/passcodes`

## Project Structure

```
app/
├── api/              # API routes
├── admin/            # Admin dashboard
├── race/             # Race results pages
├── athlete-profile/  # Protected athlete profiles
└── auth/             # Authentication

lib/
├── db/               # Database utilities
├── btf-age-categories.ts
└── passcode.ts
```

## Key Features

### BTF Age Categories
- Youth: U8, U10, U12, U14, U16
- Adult: JUN, SEN, V40-V80+
- Age calculated on December 31st of race year
- Filter results by category

### Athlete Passcodes
- 8-character secure codes (e.g., ABCD-EFGH)
- Protects athlete race history
- Admin management at `/admin/passcodes`
- Copy, regenerate, export to CSV

### Multiple Instances
- Each deployment is a separate instance for a single organization
- To run multiple organizations, deploy separate instances
- See [VERCEL_MULTI_TENANT_GUIDE.md](./VERCEL_MULTI_TENANT_GUIDE.md) for deploying multiple instances

### Analytics
- Vercel Analytics for user tracking
- Speed Insights for performance
- Core Web Vitals monitoring

## Documentation

See [DOCUMENTATION.md](./DOCUMENTATION.md) for complete documentation including:
- Architecture details
- API reference
- Database schema
- Troubleshooting guide

## Environment Variables

Required variables in `.env.local`:

```bash
# Database
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Blob Storage
BLOB_READ_WRITE_TOKEN=

# KV Store
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=

# Auth
AUTH_SECRET=
AUTH_URL=
```

## License

MIT

## Made with Bob 🤖