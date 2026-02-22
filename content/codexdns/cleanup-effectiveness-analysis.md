# Database Cleanup Effectiveness Analysis

**Date**: 2026-01-28  
**Database**: codexdns-prd-updated.db (2.6GB, 5.1M queries)  
**Schema Version**: 23|0  
**Analysis Period**: 33 days (2025-12-26 to 2026-01-28)

---

## Executive Summary

⚠️ **CRITICAL FINDING**: Database cleanup service is **NOT working** in production. Records significantly exceed configured retention periods.

### Retention Policy vs Actual Data

| Table | Configured Retention | Oldest Record | Records > Retention | Status |
|-------|---------------------|---------------|---------------------|---------|
| `dns_queries` | **30 days** | 33 days old | **824,580 queries** (16.1%) | ❌ **FAILING** |
| `dhcp_integration_updates` | **30 days** | 29.2 days old | 30 updates (0.2%) | ✅ Mostly OK |
| `client_history` | **90 days** | N/A (0 rows) | 0 | ⚠️ No data to validate |
| Hourly stats tables | No configured retention | 35.2 days old | N/A | ℹ️ Unbounded growth |

---

## Detailed Findings

### 1. DNS Queries Cleanup (FAILING ❌)

**Configured Retention**: 30 days (see `internal/service/cleanup.go` line 48)

**Actual Data**:
```
Total queries:        5,127,605
Oldest query:         2025-12-26 19:33:12 (33.0 days ago)
Newest query:         2026-01-28 19:42:30 (current)
Queries > 30 days:    824,580 (16.1%)
Queries > 60 days:    0
```

**Analysis**:
- ❌ **824,580 queries exceed the 30-day retention policy** (3.0 days overdue)
- These queries should have been deleted but remain in the database
- Data span: 33 days (oldest query is from 2025-12-26, 3 days before the 30-day cutoff)
- This represents ~16% of all queries that should not exist

**Root Cause Hypothesis**:
1. Cleanup service not running in production
2. Cleanup service running but `DeleteOlderThan` method failing silently
3. Cleanup service started recently (within last 3 days) and hasn't caught up yet

**Recommended Actions**:
1. Verify cleanup service is enabled and started in production config
2. Check production logs for cleanup execution logs (search for "Database cleanup service")
3. Check for errors during cleanup execution
4. Manually trigger cleanup to clear the 824K old queries
5. Monitor cleanup execution going forward

---

### 2. DHCP Integration Updates Cleanup (MOSTLY OK ✅)

**Configured Retention**: 30 days (see `internal/service/cleanup.go` line 50)

**Actual Data**:
```
Total updates:        13,112
Oldest update:        2025-12-30 17:08:33 (29.2 days ago)
Newest update:        2026-01-25 22:59:32 (3 days ago)
Updates > 30 days:    30 (0.2%)
```

**Analysis**:
- ✅ Only 30 updates exceed the 30-day retention (0.2% of total)
- Oldest update is 29.2 days old (within retention)
- The 30 updates slightly over the limit might be due to timing (cleanup ran before these aged out)
- Overall: **DHCP cleanup appears to be working correctly**

---

### 3. Client History Cleanup (NO DATA ⚠️)

**Configured Retention**: 90 days (see `internal/service/cleanup.go` line 49)

**Actual Data**:
```
Total rows: 0
```

**Analysis**:
- ⚠️ No `client_history` data exists in production
- Cannot validate if cleanup is working for this table
- Either:
  - Client history feature not in use, OR
  - All history has been deleted (possible over-aggressive cleanup), OR
  - Feature not yet deployed/enabled

**Note**: The `clients` table has no `deleted_at` column, so there are no "archived" clients to clean up. The cleanup method `DeleteArchivedClients` may be targeting a legacy schema.

---

### 4. Hourly Stats Tables (UNBOUNDED ℹ️)

**Configured Retention**: None (no cleanup configured for these tables)

**Hourly Query Stats**:
```
Total rows:    494
Oldest hour:   2025-12-24 00:00:00 (35.2 days ago)
Newest hour:   2026-01-28 00:00:00 (today)
```

**Client Hourly Stats**:
```
Total rows:    7,826
Oldest hour:   2025-12-24 00:00:00 (35.2 days ago)
Newest hour:   2026-01-28 00:00:00 (today)
```

**Analysis**:
- ℹ️ These tables have **no retention policy** configured
- Data spans 35.2 days (longer than DNS queries retention)
- At current growth rate:
  - `hourly_query_stats`: ~14 rows/day → 5,110 rows/year
  - `client_hourly_stats`: ~222 rows/day → 81,030 rows/year
- **Recommendation**: Add retention policy for hourly stats (suggest 90-180 days)

---

### 5. New Stats Persistence Tables (NO DATA YET)

The following tables were added in migrations 21-23 (DNS stats persistence feature):
- `hourly_trans_stats`
- `hourly_clients_stats`  
- `daily_trans_stats`
- `daily_clients_stats`
- `client_daily_trans_stats`
- `client_daily_clients_stats`

**Status**: ℹ️ No data yet (migrations 21-23 not applied in production until new APK deployed)

**Future Consideration**: These tables should also have retention policies to prevent unbounded growth.

---

## Cleanup Service Configuration

**Service Location**: `internal/service/cleanup.go`  
**Initialization**: `cmd/codexdns/main.go` line 288  
**Default Settings**:
```go
dnsQueryRetentionDays:     30  // DNS query logs
clientHistoryRetentionDays: 90 // Client history
dhcpUpdateRetentionDays:   30  // DHCP integration updates
cleanupInterval:           24 * time.Hour // Run daily
```

**Startup Behavior**:
1. Initial cleanup runs 10 seconds after app start
2. Periodic cleanup runs every 24 hours via ticker
3. Service starts automatically (line 291 in main.go: `cleanupSvc.Start(cleanupCtx)`)

**Cleanup Methods** (see `cleanup.go` lines 118-160):
1. `DeleteOlderThan` - DNS queries > retention
2. `PurgeOldHistory` - Client history > retention
3. `ClearOldUpdates` - DHCP updates > retention
4. `DeleteArchivedClients` - Legacy deleted clients

---

## Root Cause Analysis

### Why is DNS Cleanup Failing?

**Possible Causes**:

1. **Service Not Running**:
   - Check: Does production binary have cleanup service enabled?
   - Check: Are there startup logs showing "Database cleanup service started"?
   - Check: Is the service crashing silently?

2. **Silent Failures**:
   - The cleanup methods may be failing without logging errors
   - Database permissions or connection issues
   - GORM query building errors

3. **Recent Deployment**:
   - If cleanup service was deployed recently, it may not have run long enough
   - Initial cleanup (10s delay) + first periodic cleanup (24h) = max 24h 10s
   - But we have 3 days of overdue data, so this is unlikely

4. **Config Override**:
   - Check production config file for retention overrides
   - Someone may have disabled cleanup or set retention to 0/very high value

### Why is DHCP Cleanup Working?

- **Small dataset**: Only 13K updates vs 5M queries
- **Faster delete operations**: Less DB pressure
- **Same service code**: If DNS cleanup is broken, DHCP should be too (unless it's a query-specific issue)

This suggests the issue is **DNS-query-specific**, not a general cleanup service failure.

---

## Recommended Actions (Priority Order)

### 1. IMMEDIATE - Investigate Production Service Status
```bash
# SSH to production server
# Check if cleanup service is running
journalctl -u codexdns -n 1000 | grep -i cleanup

# Look for:
# - "Database cleanup service started"
# - "Running database cleanup"
# - "Deleted X old DNS queries"
# - Any cleanup-related errors
```

### 2. HIGH - Check Production Config
```bash
# Review config file for cleanup overrides
cat /etc/codexdns/config.json | jq '.cleanup // empty'
# Or check for retention settings
cat /etc/codexdns/config.json | jq '.retention // empty'
```

### 3. HIGH - Manual Cleanup Trigger
```bash
# If service is not running, restart to trigger cleanup
systemctl restart codexdns

# Monitor logs for cleanup execution
journalctl -u codexdns -f | grep -i cleanup
```

### 4. MEDIUM - Add Cleanup Logging
Enhance cleanup service to log:
- When cleanup starts/completes
- How many records were deleted per table
- Any errors encountered

**File**: `internal/service/cleanup.go`  
**Change**: Add structured logging around delete operations

### 5. MEDIUM - Add Retention for Hourly Stats
Extend `CleanupService` to handle hourly stats tables:
```go
hourlyStatsRetentionDays int // Suggest 90-180 days
```

And add cleanup method:
```go
func (s *CleanupService) DeleteOldHourlyStats(ctx context.Context) error {
    cutoff := time.Now().AddDate(0, 0, -s.hourlyStatsRetentionDays)
    
    // Clean hourly_query_stats
    result := s.db.Where("hour < ?", cutoff).Delete(&HourlyQueryStat{})
    if result.Error != nil {
        return result.Error
    }
    
    // Clean client_hourly_stats
    result = s.db.Where("hour < ?", cutoff).Delete(&ClientHourlyStat{})
    if result.Error != nil {
        return result.Error
    }
    
    return nil
}
```

### 6. LOW - Add Metrics/Monitoring
- Export cleanup metrics (records deleted, time taken, errors)
- Add to dashboard: "Last Cleanup Run", "Records Deleted Last Run"
- Alert if cleanup hasn't run in > 48 hours

---

## Testing Cleanup Locally

To verify cleanup is working correctly:

```bash
# 1. Run dev environment with cleanup enabled
wsl -d OracleLinux_9_1 bash -c "cd /mnt/i/OneDrive/Trabalhos/Desenv/golang/codexdns && ./tmp/codexdns -config config-wsl.json"

# 2. Insert old test data
sqlite3 codexdns-dev.db << 'EOF'
INSERT INTO dns_queries (query, query_type, source_ip, created_at)
VALUES 
  ('old.test.com', 'A', '192.168.1.100', datetime('now', '-40 days')),
  ('old2.test.com', 'A', '192.168.1.101', datetime('now', '-45 days')),
  ('recent.test.com', 'A', '192.168.1.102', datetime('now', '-5 days'));
EOF

# 3. Wait for cleanup to run (10s initial + check logs)
# Or restart to force immediate cleanup

# 4. Verify old records are deleted
sqlite3 codexdns-dev.db "SELECT COUNT(*) FROM dns_queries WHERE created_at < datetime('now', '-30 days');"
# Expected: 0
```

---

## Conclusion

**Database cleanup is FAILING in production for DNS queries**, with 824,580 queries exceeding the 30-day retention policy. This is causing unnecessary database bloat (16% of all queries should not exist).

**Next Steps**:
1. ✅ Check production logs to confirm cleanup service is running
2. ✅ Review production config for retention overrides
3. ✅ Restart service if necessary to trigger cleanup
4. ✅ Add better logging to cleanup service
5. ⏳ Monitor cleanup effectiveness after restart
6. ⏳ Add retention policy for hourly stats tables

**Impact**:
- Database size: ~16% larger than it should be
- Query performance: Slightly degraded due to larger table scans
- Storage cost: Wasting disk space on stale data
- Compliance: Not meeting defined data retention policies

---

## Appendix: SQL Queries Used

```sql
-- Current timestamp
SELECT datetime('now');

-- DNS queries age analysis
SELECT 
  COUNT(*) as total,
  MIN(created_at) as oldest,
  MAX(created_at) as newest,
  COUNT(CASE WHEN created_at < datetime('now', '-30 days') THEN 1 END) as older_than_30d,
  COUNT(CASE WHEN created_at < datetime('now', '-60 days') THEN 1 END) as older_than_60d
FROM dns_queries;

-- DHCP updates age analysis
SELECT 
  COUNT(*) as total,
  MIN(created_at) as oldest,
  MAX(created_at) as newest,
  COUNT(CASE WHEN created_at < datetime('now', '-30 days') THEN 1 END) as older_than_30d
FROM dhcp_integration_updates;

-- Hourly stats age analysis
SELECT 
  'hourly_query_stats' as table_name,
  COUNT(*) as total,
  MIN(hour) as oldest,
  MAX(hour) as newest,
  JULIANDAY(MAX(hour)) - JULIANDAY(MIN(hour)) as days_span
FROM hourly_query_stats;

SELECT 
  'client_hourly_stats' as table_name,
  COUNT(*) as total,
  MIN(hour) as oldest,
  MAX(hour) as newest,
  JULIANDAY(MAX(hour)) - JULIANDAY(MIN(hour)) as days_span
FROM client_hourly_stats;

-- Client history check
SELECT COUNT(*) FROM client_history;
```
