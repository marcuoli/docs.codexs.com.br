# Production Database Migration Fix Guide

## Problem Summary

**Issue**: Production database shows migration version 10, but this version doesn't exist in current codebase.

**Root Cause**: 
- Original migration system used `000001_initial_schema.up.sql` (779 lines, 27 tables)
- Migration consolidation (commit 6376b00) removed this file and reorganized into subdirectories
- Migrations 7-17 were never created (numbering gap)
- Production database version 10 is meaningless - actual state is version 20

**Verification**:
```bash
# Check what tables exist
sqlite3 codexdns.db ".tables" | grep -E "(certificates|upstream_hourly|dns_stats)"
```

Expected output for version 20:
- ✅ `certificates` (migration 18)
- ✅ `upstream_hourly_latency_histograms` (migration 20)  
- ❌ NO `dns_stats_*_samples` tables (migrations 21-22)

---

## Solution Overview

1. **Fix database version** from 10 → 20
2. **Deploy new binary** with migrations 21-23 embedded
3. **Let auto-migration** upgrade 20 → 21 → 22 → 23

---

## Step-by-Step Fix

### Option A: Automated Script (Recommended)

```bash
# On production server
cd /var/log/codexdns

# Download and run fix script
wget https://raw.githubusercontent.com/marcuoli/codexdns/main/scripts/fix-production-migration-version.sh
chmod +x fix-production-migration-version.sh

# Run the fix (creates automatic backup)
./fix-production-migration-version.sh /opt/codexdns/data/codexdns.db
```

### Option B: Manual Fix

```bash
# 1. Stop CodexDNS
rc-service codexdns stop

# 2. Backup database
cp /opt/codexdns/data/codexdns.db /opt/codexdns/data/codexdns.db.backup.$(date +%Y%m%d-%H%M%S)

# 3. Verify current state
sqlite3 /opt/codexdns/data/codexdns.db "SELECT version, dirty FROM schema_migrations;"
# Should show: 10|0

# 4. Check tables (confirm version 20)
sqlite3 /opt/codexdns/data/codexdns.db ".tables" | grep certificates
# Should show: certificates

sqlite3 /opt/codexdns/data/codexdns.db ".tables" | grep upstream_hourly
# Should show: upstream_hourly_latency_histograms

# 5. Fix migration version
sqlite3 /opt/codexdns/data/codexdns.db <<EOF
DELETE FROM schema_migrations;
INSERT INTO schema_migrations (version, dirty) VALUES (20, 0);
SELECT version, dirty FROM schema_migrations;
EOF
# Should show: 20|0

# 6. Verify fix
sqlite3 /opt/codexdns/data/codexdns.db "SELECT version FROM schema_migrations;"
# Should show: 20
```

---

## Deploy New Binary

### Update APK Package

```bash
# 1. Download new APK (contains all migrations 1-23 embedded)
wget -O /tmp/codexdns-latest.apk https://github.com/marcuoli/codexdns/releases/latest/download/codexdns-0.5.20260128.15-r1.apk

# 2. Install/upgrade
apk add --allow-untrusted /tmp/codexdns-latest.apk

# 3. Verify new binary has all migrations
strings /usr/bin/codexdns | grep "000023_add_upstream_server_counters"
# Should show the migration filename (confirms it's embedded)

# 4. Configure forced migration (REQUIRED for first startup)
# Edit /etc/conf.d/codexdns and set:
echo 'CODEXDNS_OPTS="--db-force-migrate-from 20"' >> /etc/conf.d/codexdns

# 5. Start service (will apply migrations 21 → 22 → 23)
rc-service codexdns start

# 6. Check logs for migration success
tail -f /var/log/codexdns/application.log | grep -i migration
# Should show:
# [WARN] [DB] Forcing migration from version 20
# [INFO] [DB] Migration version forced to 20 (dirty: false)
# [INFO] [DB] Migrations applied successfully for sqlite (version: 23, dirty: false)

# 7. After successful migration, remove the force flag
sed -i '/CODEXDNS_OPTS/d' /etc/conf.d/codexdns

# 8. Restart to verify normal operation
rc-service codexdns restart
```

### Verify Migration Success

```bash
# Check final version
/usr/bin/codexdns --db-show-migration-version --config /opt/codexdns/config/config.json
# Expected: Current migration version: 23 (dirty: false)

# Verify new tables exist
sqlite3 /opt/codexdns/data/codexdns.db ".tables" | grep dns_stats
# Should show 5 new tables:
#   dns_stats_authoritative_samples
#   dns_stats_forward_rule_samples
#   dns_stats_non_authoritative_samples
#   dns_stats_upstream_server_counters
#   dns_stats_upstream_server_samples
```

---

## Troubleshooting

### Error: "no migration found for version 21"

**Cause**: Binary doesn't have migrations embedded (old build).

**Fix**: 
```bash
# Rebuild APK from current main branch
cd /path/to/codexdns
git pull origin main
make apk

# Or download latest release from GitHub
```

### Error: "dirty migration"

**Cause**: Previous migration failed halfway.

**Fix**:
```bash
# Reset dirty flag
sqlite3 /opt/codexdns/data/codexdns.db "UPDATE schema_migrations SET dirty = 0;"

# Then retry
rc-service codexdns restart
```

### Stats Not Persisting

**Symptom**: DNS stats reset on restart.

**Check**:
```bash
# Verify tables were created
sqlite3 /opt/codexdns/data/codexdns.db <<EOF
.tables
SELECT name FROM sqlite_master WHERE name LIKE 'dns_stats%';
EOF

# Should show 5 tables
```

**Fix**: Ensure migration version is 23:
```bash
/usr/bin/codexdns --db-show-migration-version --config /opt/codexdns/config/config.json
```

---

## Migration History Reference

| Version | Migration File | Description | Production Status |
|---------|---------------|-------------|-------------------|
| 1 | 000001_add_discovering_field | Add discovering column | ✅ Applied |
| 2 | 000002_remove_policy_priority | Remove priority field | ✅ Applied |
| 3 | 000003_add_update_client_name | Client name updates | ✅ Applied |
| 4 | 000004_add_server_settings | Server settings table | ✅ Applied |
| 5 | 000005_restructure_settings | Settings restructure | ✅ Applied |
| 6 | 000006_drop_server_settings | Drop old settings | ✅ Applied |
| 7-17 | *DOES NOT EXIST* | Gap in numbering | ⚠️ N/A |
| 18 | 000018_create_certificates_table | Certificates table | ✅ Applied |
| 19 | 000019_migrate_server_settings | Settings migration | ✅ Applied |
| 20 | 000020_add_upstream_hourly | Latency histograms | ✅ Applied |
| 21 | 000021_add_dns_response_time | Response time samples | ❌ **PENDING** |
| 22 | 000022_add_upstream_server | Upstream samples | ❌ **PENDING** |
| 23 | 000023_add_upstream_counters | Upstream counters | ❌ **PENDING** |

**Current State**: Production shows version 10, but is actually version 20.  
**Target State**: Version 23 with all stats persistence tables.

---

## Success Criteria

After completing all steps:

✅ Migration version: 23  
✅ No dirty flag: `dirty = 0`  
✅ All 5 stats tables exist  
✅ DNS stats persist across restarts  
✅ Application logs show successful migrations  
✅ No errors in `/var/log/codexdns/application.log`  

---

## Rollback Plan

If issues occur:

```bash
# 1. Stop service
rc-service codexdns stop

# 2. Restore backup
cp /opt/codexdns/data/codexdns.db.backup.YYYYMMDD-HHMMSS /opt/codexdns/data/codexdns.db

# 3. Downgrade package (if needed)
apk add --allow-untrusted /path/to/old/codexdns-package.apk

# 4. Restart
rc-service codexdns start
```

---

## Contact & Support

If issues persist:
- Check logs: `/var/log/codexdns/application.log`
- GitHub Issues: https://github.com/marcuoli/codexdns/issues
- Include: database version, error messages, table list
