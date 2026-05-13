# Deployment Checklist

## Pre-Deployment

### ✅ Code Complete
- [x] BTF age categories implemented
- [x] Athlete passcode system
- [x] Vercel Analytics & Speed Insights
- [x] Multi-tenant architecture
- [x] Admin dashboard
- [x] All API endpoints

### ✅ Documentation
- [x] README.md - Quick start guide
- [x] DOCUMENTATION.md - Complete reference

### ✅ Environment Variables
Ensure these are set in Vercel:
- [ ] `POSTGRES_URL`
- [ ] `POSTGRES_PRISMA_URL`
- [ ] `POSTGRES_URL_NON_POOLING`
- [ ] `BLOB_READ_WRITE_TOKEN`
- [ ] `KV_URL`
- [ ] `KV_REST_API_URL`
- [ ] `KV_REST_API_TOKEN`
- [ ] `KV_REST_API_READ_ONLY_TOKEN`
- [ ] `AUTH_SECRET`
- [ ] `AUTH_URL`

## Deployment Steps

### 1. Deploy to Vercel
```bash
git add .
git commit -m "Production ready: BTF categories, passcodes, analytics"
git push
```

Wait 2-3 minutes for build to complete.

### 2. Run Schema Migration
1. Visit `https://yourdomain.com/admin`
2. Login as admin
3. Click **"🔧 Run Schema Migration"**
4. Wait for success message

This adds:
- `passcode` column to athletes table
- `passcode_created_at` column to athletes table

### 3. Upload Data
1. In admin panel, select migration mode:
   - **Full Migration**: Replace all data (recommended for first upload)
   - **Incremental**: Add only new races
2. Upload SQLite database file
3. Wait for migration to complete
4. Verify data in race results pages

### 4. Generate Passcodes
1. In admin panel, click **"🔑 Generate All Passcodes"**
2. Wait for confirmation
3. Click **"📋 View All Passcodes"**
4. Export to CSV if needed

### 5. Verify Analytics
1. Visit https://vercel.com/dashboard
2. Select your project
3. Check **Analytics** tab (may take 5-10 minutes for data)
4. Check **Speed Insights** tab

## Post-Deployment Testing

### Test Race Results
- [ ] Visit a race results page
- [ ] Test gender filter
- [ ] Test age category filter
- [ ] Test relay filter
- [ ] Check "Age Categories" tab
- [ ] Verify export to CSV works

### Test Athlete Profiles
- [ ] Visit `/athlete-profile/[athleteId]`
- [ ] Enter passcode
- [ ] Verify access granted
- [ ] Check race history displays
- [ ] Check performance charts
- [ ] Test in new browser (should require passcode again)

### Test Admin Functions
- [ ] Login to `/admin`
- [ ] View passcodes at `/admin/passcodes`
- [ ] Search for athlete
- [ ] Copy passcode to clipboard
- [ ] Regenerate a passcode
- [ ] Export passcodes to CSV
- [ ] Upload new data (incremental mode)

### Test Multi-Tenancy
- [ ] Access via subdomain (e.g., `club1.yourdomain.com`)
- [ ] Verify correct tenant data loads
- [ ] Test on different tenant subdomain
- [ ] Verify data isolation

## Troubleshooting

### Schema Migration Fails
- Check database connection in Vercel logs
- Verify environment variables are set
- Try running migration again (it's idempotent)

### Passcodes Not Working
- Ensure schema migration completed
- Check database has `passcode` column
- Verify passcodes were generated

### Analytics Not Showing
- Wait 5-10 minutes after deployment
- Check Vercel dashboard project settings
- Verify components are in `app/layout.tsx`

### 404 on New Pages
- Ensure code is deployed (check Vercel dashboard)
- Clear browser cache
- Try incognito/private mode

## Maintenance

### Regular Tasks
- **Weekly**: Check analytics for issues
- **Monthly**: Review Core Web Vitals
- **As Needed**: Upload new race data
- **As Needed**: Generate passcodes for new athletes

### Monitoring
- Set up Vercel alerts for:
  - Performance degradation
  - Error rate spikes
  - High traffic alerts

### Backups
- Database: Automatic backups via Vercel Postgres
- Blob Storage: Automatic redundancy
- Code: Git repository

## Support

### Resources
- README.md - Quick start
- DOCUMENTATION.md - Complete reference
- Vercel Dashboard - Logs and analytics
- GitHub Issues - Bug reports

### Common Issues
See DOCUMENTATION.md → Troubleshooting section

## Made with Bob 🤖