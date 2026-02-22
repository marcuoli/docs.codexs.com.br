# Bug Analysis: Query Trends 1-Hour Range Shows No Data

## Issue Description

When selecting the "1 Hour" time range on the Query Trends page, both the "Response Time Distribution" and "Query Activity Over Time" charts show no data, despite DNS queries being successfully processed and persisted to the database.

## Investigation Process

### 1. Verified DNS Query Persistence

Generated 200 test DNS queries:
```bash
for i in {1..200}; do dig @172.23.14.225 test${i}.example.com A +short > /dev/null 2>&1 & done
```

**Result:** All queries were processed and persisted to `dns_queries` table (328 total queries as of investigation time).

### 2. Database Query Analysis

Tested different SQLite datetime functions:

```sql
-- UTC query (FAILS - returns 0)
SELECT COUNT(*) FROM dns_queries WHERE timestamp >= datetime('now', '-1 hour');

-- Local time query (WORKS - returns 228)
SELECT COUNT(*) FROM dns_queries WHERE timestamp >= datetime('now', 'localtime', '-1 hour');
```

**Finding:** Timestamp comparison fails when using UTC but succeeds with local time.

### 3. Timestamp Format Analysis

Sample timestamp from database:
```
2025-12-26 20:29:38.627984556-03:00
```

Format: `YYYY-MM-DD HH:MM:SS.nnnnnnnnn±HH:MM` (local time with timezone offset)

### 4. Frontend Time Range Generation

From `web/static/js/query-stats.js` line 245:

```javascript
getTimeRangeParams() {
    if (this.appliedRange === 'custom') {
        return { start: this.customStart, end: this.customEnd };
    }
    const range = this.timeRanges.find(r => r.value === this.appliedRange);
    const hours = range ? range.hours : 12;
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    return {
        start: start.toISOString(),  // ← Converts to UTC with Z suffix!
        end: end.toISOString()       // ← Converts to UTC with Z suffix!
    };
}
```

**Issue:** `toISOString()` returns UTC time (e.g., `2025-12-26T23:30:00.000Z`), not local time.

### 5. Backend Query Handling

From `internal/http/handlers/querystats.go` line 418:

```go
res := h.db.Model(&storage.DNSQuery{}).
    Where("timestamp >= ? AND timestamp <= ?", start, end).
    Select(selectSQL).
    Scan(&counts)
```

**Issue:** GORM receives Go `time.Time` objects that are in UTC, but the database timestamps are stored with local timezone offset.

## Root Cause

**Timezone Mismatch:**

1. **Frontend sends:** UTC times (e.g., `2025-12-26T22:30:00Z` to `2025-12-26T23:30:00Z`)
2. **Backend receives:** Go `time.Time` in UTC
3. **Database has:** Local timestamps (e.g., `2025-12-26 20:29:38-03:00`)
4. **Comparison fails:** UTC 22:30-23:30 doesn't match local 20:29 (which is UTC 23:29)

The 3-hour offset (`-03:00` timezone) causes the requested time window to miss all actual queries.

## Why Other Time Ranges Work

Longer time ranges (6h, 12h, 24h, etc.) work because:
- Their time windows are large enough to absorb the 3-hour timezone offset
- Example: 12-hour range (UTC 11:30-23:30) overlaps with local queries (19:30-20:30 local = 22:30-23:30 UTC)

The 1-hour range is too narrow and falls entirely outside the actual query timestamps.

## Solution Options

### Option 1: Store Timestamps as UTC in Database (Recommended)

**Changes Required:**
1. Update `storage.DNSQuery` model to use UTC timestamps
2. Modify `enqueueDNSQueryDB()` to convert timestamps to UTC before persisting
3. Add migration to convert existing timestamps to UTC
4. Ensure all GORM datetime columns use UTC

**Pros:**
- Standard practice for databases
- Eliminates timezone ambiguity
- Consistent with ISO 8601
- Easier to query across timezones

**Cons:**
- Requires data migration
- Breaking change for existing deployments

**Implementation:**
```go
// In internal/dns/server.go, modify logQueryToDB closure:
entry := storage.DNSQuery{
    Timestamp: queryTimestamp.UTC(),  // ← Convert to UTC
    // ... rest of fields
}
```

### Option 2: Convert Frontend Times to Local Timezone

**Changes Required:**
1. Modify `getTimeRangeParams()` in `query-stats.js` to use local time format
2. Ensure backend parser handles local time format

**Pros:**
- No database migration needed
- Matches current storage format

**Cons:**
- Browser timezone affects results
- Harder to maintain
- Not scalable for multi-timezone deployments

### Option 3: Add Timezone Handling in Backend Queries

**Changes Required:**
1. Parse frontend UTC times
2. Convert to local timezone before querying
3. Or normalize database timestamps to UTC on-the-fly

**Pros:**
- No frontend changes
- No migration needed

**Cons:**
- Performance overhead
- Complex SQL/GORM handling
- Doesn't solve root cause

## Recommended Fix

**Implement Option 3: Add Timezone Handling in Backend Queries**

Since the application has a configurable timezone setting (`"timezone": "America/Sao_Paulo"` in config) and uses `config.ApplyTimezone()` to set `time.Local`, we preserve local timezone storage and convert incoming UTC times to local before querying.

### Implementation

Modified all three API handler functions in `internal/http/handlers/querystats.go`:

1. **APIQueryStats** (line ~97)
2. **SSEQueryStats** (line ~130)  
3. **ExportQueryStats** (line ~195)

Added `.In(time.Local)` conversion when parsing RFC3339 (UTC) timestamps:

```go
if t, err := time.Parse(time.RFC3339, startStr); err == nil {
    // Convert UTC time from frontend to local time for DB query
    start = t.In(time.Local)
}
```

This ensures that when the frontend sends `2025-12-26T23:30:00Z` (UTC), it gets converted to `2025-12-26 20:30:00` (America/Sao_Paulo time) before querying the database, matching the stored timestamp format.

### Testing Checklist

- [ ] Generate test queries
- [ ] Verify 1-hour range shows data
- [ ] Verify other ranges still work
- [ ] Test custom date range
- [ ] Test across timezone changes (DST)
- [ ] Verify SSE updates work with new timestamps
- [ ] Check response time distribution buckets
- [ ] Verify query activity chart renders correctly

## Files to Modify

1. `internal/dns/server.go` - Update `logQueryToDB` to use `.UTC()`
2. `migrations/NNNN_normalize_dns_queries_to_utc.up.sql` - Add migration
3. `internal/storage/models.go` or relevant model file - Document UTC expectation
4. `internal/http/handlers/querystats.go` - Verify GORM queries handle UTC correctly

## Related Issues

This same timezone issue may affect:
- `client_hourly_stats` table (if it stores hourly timestamps)
- Any other analytics that rely on time-based aggregation
- SSE event timestamps

## References

- SQLite datetime functions: https://www.sqlite.org/lang_datefunc.html
- GORM time handling: https://gorm.io/docs/models.html#time-Time
- ISO 8601 / RFC 3339: https://datatracker.ietf.org/doc/html/rfc3339
