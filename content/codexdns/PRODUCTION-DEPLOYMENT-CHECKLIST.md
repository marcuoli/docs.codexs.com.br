# Production Deployment Checklist

## Current Status

**Issue**: Production database shows migration version 10, preventing new migrations from running.

**Root Cause**: Migration consolidation removed `000001_initial_schema.up.sql` but production database schema_migrations table wasn't updated.

**Actual State**: Database contains all tables from migration 20, incorrectly labeled as version 10.

---

## Deployment Steps

### 1. Database Version Fix

Execute fix script on production server:

```bash
# Option A: Download and run script
cd /var/log/codexdns
wget https://raw.githubusercontent.com/marcuoli/codexdns/main/scripts/fix-production-migration-version.sh
chmod +x fix-production-migration-version.sh
./fix-production-migration-version.sh /var/lib/codexdns/codexdns.db
```

**Expected Output**:
```
[INFO] Database path: /var/lib/codexdns/codexdns.db
[INFO] Current migration version: 10 (dirty: 0)
[INFO] Creating backup: /var/lib/codexdns/codexdns.db.backup.20260128-153045
[INFO] Backup created successfully
[CHECK] Verifying actual migration state...
[INFO] Found 'certificates' table (migration 18) ✓
[INFO] Found 'upstream_hourly_latency_histograms' table (migration 20) ✓
[DECISION] Actual migration state is version 20
[ACTION] Updating schema_migrations: 10 → 20
[SUCCESS] Migration version updated to 20
[VERIFY] SELECT version, dirty FROM schema_migrations;
version|dirty
20|0
[NEXT] Deploy new binary and restart to apply migrations 21-23
```

### 2. Deploy New Binary

```bash
# Stop service
rc-service codexdns stop

# Install new APK
apk add --allow-untrusted /path/to/codexdns-0.5.20260128.15-r1.apk

# Configure forced migration (REQUIRED for first startup)
echo 'CODEXDNS_OPTS="--db-force-migrate-from 20"' >> /etc/conf.d/codexdns

# Start service (auto-migrates 20 → 21 → 22 → 23)
rc-service codexdns start

# Verify migration success in logs
tail -f /var/log/codexdns/application.log | grep -i migration

# After successful migration, remove the force flag
sed -i '/CODEXDNS_OPTS/d' /etc/conf.d/codexdns

# Restart to verify normal operation
rc-service codexdns restart
```

**Why `--db-force-migrate-from 20` is needed**: Migrations 7-17 don't exist (gap in numbering), so the migration system can't automatically detect version 20 as current. The flag explicitly tells it to start from 20 and apply only 21, 22, 23.

### 3. Verify Migrations

```bash
# Check migration version
/usr/bin/codexdns --db-show-migration-version --config /etc/codexdns/config.json

# Expected output:
Current migration version: 23 (dirty: false)
```

### 4. Verify Stats Tables

```bash
sqlite3 /var/lib/codexdns/codexdns.db ".tables" | grep dns_stats
```

**Expected Output**:
```
dns_stats
dns_stats_authoritative_samples
dns_stats_forward_rule_samples
dns_stats_non_authoritative_samples
dns_stats_upstream_server_counters
dns_stats_upstream_server_samples
```

### 5. Test Stats Persistence

```bash
# Restart service multiple times
rc-service codexdns restart
sleep 10

# Check if stats persist (should see data accumulated across restarts)
tail -f /var/log/codexdns/application.log | grep -i "stats loaded"
```

---

## Files Added

### `scripts/fix-production-migration-version.sh`

Automated bash script that:
- Backs up database with timestamp
- Detects actual migration state by checking table existence
- Updates `schema_migrations` from version 10 → 20
- Provides verification output

### `docs/production-migration-fix.md`

Comprehensive guide covering:
- Problem summary and root cause
- Automated and manual fix procedures
- Deployment steps for new APK
- Migration history reference table
- Troubleshooting guide
- Rollback plan

---

## Success Criteria

✅ Migration version: **23**  
✅ Dirty flag: **0** (clean state)  
✅ All 5 DNS stats tables exist  
✅ Stats persist across restarts  
✅ No errors in application logs  
✅ Query latency/response time data accumulates over time  

---

## Migration History

| Current State (Production) | Target State |
|----------------------------|--------------|
| Version 10 (incorrect label) | Version 23 |
| Has migrations 1-6, 18-20 | Add migrations 21-23 |
| Missing stats tables | Add 5 stats persistence tables |

### New Tables (Migrations 21-23)

1. `dns_stats_authoritative_samples` - Auth response times
2. `dns_stats_non_authoritative_samples` - Non-auth response times  
3. `dns_stats_forward_rule_samples` - Forward rule response times
4. `dns_stats_upstream_server_samples` - Per-upstream response times
5. `dns_stats_upstream_server_counters` - Upstream query counters

---

## Rollback Plan

If issues occur:

```bash
# Stop service
rc-service codexdns stop

# Restore database backup
cp /var/lib/codexdns/codexdns.db.backup.YYYYMMDD-HHMMSS \
   /var/lib/codexdns/codexdns.db

# Downgrade APK (if needed)
apk add --allow-untrusted /path/to/previous-codexdns.apk

# Start service
rc-service codexdns start
```

---

## Related Issues & PRs

- **Issue #150**: Production database migration version mismatch
- **PR #141**: Add DNS response time samples persistence
- **PR #142**: Add upstream server samples persistence  
- **PR #143**: Add upstream server counters persistence
- **PR #149**: Add sqlite CLI to APK, remove migration directory copies

---

## Post-Deployment Verification

After completing all steps:

```bash
# 1. Check version
/usr/bin/codexdns --db-show-migration-version --config /etc/codexdns/config.json

# 2. Check logs
tail -100 /var/log/codexdns/application.log | grep -E "(migration|stats|error)"

# 3. Verify tables
sqlite3 /var/lib/codexdns/codexdns.db <<EOF
.tables
SELECT COUNT(*) as stats_tables FROM sqlite_master 
WHERE type='table' AND name LIKE 'dns_stats_%_samples';
EOF

# 4. Check data is being saved
sqlite3 /var/lib/codexdns/codexdns.db <<EOF
SELECT COUNT(*) FROM dns_stats_authoritative_samples;
SELECT COUNT(*) FROM dns_stats_upstream_server_samples;
EOF
```

**All counts should be > 0 after service runs for a few minutes.**

---

## Timeline

- **Jan 27, 2026**: Implemented stats persistence (PRs #141-143)
- **Jan 28, 2026**: Discovered production migration version issue
- **Jan 28, 2026**: Root cause analysis - deleted initial_schema.up.sql
- **Jan 28, 2026**: Created fix script and deployment guide
- **Next**: Deploy to production and verify

---

## Documentation References

- Full deployment guide: [docs/production-migration-fix.md](production-migration-fix.md)
- Fix script source: [scripts/fix-production-migration-version.sh](../scripts/fix-production-migration-version.sh)
- Migration files: [migrations/sqlite/](../migrations/sqlite/)
