# Cleanup/Purge Dedicated Logging

## Overview

Database cleanup and purge operations now log to a **dedicated cleanup log file** separate from the general application/service logs. This improves log organization and makes it easier to audit cleanup activities.

## Changes Made

### 1. New Log Prefix: `[Cleanup]`

Added a new log prefix constant specifically for cleanup/purge operations:

```go
LogPrefixCleanup = "[Cleanup]" // Database cleanup and purge operations
```

**Files Modified:**
- `internal/constants/logprefixes.go` - Added `LogPrefixCleanup` constant
- `internal/service/logprefixes.go` - Re-exported `LogPrefixCleanup`
- `.github/instructions/logging.instructions.md` - Documented new component

### 2. New Configuration Field: `cleanup_log_path`

Added configuration option to specify the cleanup log file path:

```json
{
  "cleanup_log_path": "logs/cleanup.log"
}
```

**Fields:**
- **JSON field**: `cleanup_log_path`
- **UI label**: "Database Cleanup"
- **Group**: "Log Paths"
- **Order**: 17.8 (between NTP and DB logs)
- **Default**: `logs/cleanup.log`

**File Modified:**
- `internal/config/config.go` - Added `CleanupLogPath` field

### 3. New Log Area: `LogAreaCleanup`

Added cleanup as a distinct log area for file routing:

```go
LogAreaCleanup LogArea = "cleanup" // Database cleanup/purge logs
```

**Pattern:**
```go
LogAreaCleanup: regexp.MustCompile(`(?i)\[Cleanup\]`)
```

**Files Modified:**
- `internal/constants/logprefixes.go` - Added `LogAreaCleanup` and `CleanupLogPrefixes`

### 4. File Log Writer Updates

Extended `FileLogWriter` to handle cleanup log routing:

**New Fields:**
```go
cleanupWriter *RotatingLogWriter // Database cleanup/purge operations
cleanupPath   string
```

**New Config Field:**
```go
CleanupPath string // Database cleanup/purge operations log
```

**File Modified:**
- `internal/service/filelogwriter.go`:
  - Added cleanup writer initialization
  - Added cleanup writer cleanup in `closeWriters()`
  - Added `LogAreaCleanup` case in `WriteEntry()`
  - Added cleanup pattern matching in `WriteRaw()`
  - Added `containsCleanupPattern()` helper

### 5. Cleanup Service Updates

Updated all cleanup log messages to use `[Cleanup]` instead of `[Service]`:

**Before:**
```go
log.Printf("%s Database cleanup service started...", constants.LogPrefixService)
log.Printf("%s Deleted %d DNS query logs...", constants.LogPrefixService, deleted)
```

**After:**
```go
log.Printf("%s Database cleanup service started...", constants.LogPrefixCleanup)
log.Printf("%s Deleted %d DNS query logs...", constants.LogPrefixCleanup, deleted)
```

**File Modified:**
- `internal/service/cleanup.go` - All log messages now use `LogPrefixCleanup`

### 6. Main Application Integration

Updated startup configuration to initialize cleanup log writer:

**Files Modified:**
- `cmd/codexdns/main.go` - Added `CleanupPath: cfg.CleanupLogPath` to `InitializeWithConfig()`
- `internal/http/handlers/config_logging.go` - Added cleanup path to config reinitialization

## Log Message Examples

### Service Lifecycle
```
2026/01/28 20:43:21 [Cleanup] Database cleanup service started (interval: 24h0m0s, DNS queries: 30d, client history: 90d, DHCP updates: 30d)
2026/01/28 20:43:21 [Cleanup] Database cleanup service stopped
```

### Cleanup Execution
```
2026/01/28 20:43:21 [Cleanup] Starting database cleanup job...
2026/01/28 20:43:21 [Cleanup] Deleted 824580 DNS query logs older than 30 days (cutoff: 2025-12-29)
2026/01/28 20:43:21 [Cleanup] Deleted 15000 DHCP integration update logs older than 30 days
2026/01/28 20:43:21 [Cleanup] Deleted 3 client history records and 0 associated stats (older than 90 days)
2026/01/28 20:43:21 [Cleanup] Deleted 5 legacy archived clients and 10 associated stats (migration cleanup)
2026/01/28 20:43:21 [Cleanup] Database cleanup completed: 839595 total records deleted in 2.15s
```

### No Cleanup Needed
```
2026/01/28 20:43:21 [Cleanup] Starting database cleanup job...
2026/01/28 20:43:21 [Cleanup] Database cleanup completed: no old records found (runtime: 46.657µs)
```

### Errors
```
2026/01/28 20:43:21 [Cleanup] Error cleaning DNS query logs: database connection lost
2026/01/28 20:43:21 [Cleanup] Error cleaning client history: context deadline exceeded
```

## Log File Structure

### Before (Mixed in Application Log)
```
logs/application.log:
  [HTTP] GET /dashboard
  [Service] Database cleanup service started
  [Auth] User admin logged in
  [Service] Deleted 824580 DNS query logs
  [Config] Configuration updated
  [Service] Database cleanup completed
```

### After (Separated Logs)
```
logs/application.log:
  [HTTP] GET /dashboard
  [Auth] User admin logged in
  [Config] Configuration updated

logs/cleanup.log:
  [Cleanup] Database cleanup service started
  [Cleanup] Deleted 824580 DNS query logs
  [Cleanup] Database cleanup completed
```

## Benefits

1. **Clear Separation**: Cleanup operations no longer clutter general application logs
2. **Easier Auditing**: Dedicated file for reviewing cleanup history and retention enforcement
3. **Better Debugging**: Isolated logs when troubleshooting cleanup issues
4. **Independent Rotation**: Cleanup logs can have different rotation settings if needed
5. **Grep-Friendly**: All cleanup messages in one file with consistent `[Cleanup]` prefix

## Configuration Example

```json
{
  "cleanup_log_path": "logs/cleanup.log",
  "log_max_size_mb": 100,
  "log_max_backups": 10,
  "log_max_age_days": 30,
  "log_compress_method": "gzip"
}
```

## Backward Compatibility

- ✅ **Fully backward compatible** - if `cleanup_log_path` is empty, cleanup logs continue to console/default output
- ✅ **No breaking changes** - existing configurations work without modification
- ✅ **All tests pass** - cleanup service tests verified with new log prefix

## Testing

All cleanup service tests pass with new `[Cleanup]` prefix:

```bash
$ go test ./internal/service -run TestCleanupService -v

✅ TestCleanupService_ChunkedDeletion_DNSQueries (0.31s)
✅ TestCleanupService_ChunkedDeletion_DHCP (0.07s)
✅ TestCleanupService_ChunkedDeletion_ProgressiveExecution (0.34s)
✅ TestCleanupService_Integration_ClientHistory (0.00s)
✅ TestCleanupService_Integration_MultipleCleanups (0.00s)
✅ TestCleanupService_Integration_EmptyDatabase (0.00s)
✅ TestCleanupService_Integration_LargeDataset (0.09s)
✅ TestCleanupService_ClientHistoryCleanup (0.00s)
✅ TestCleanupService_StartStop (0.15s)
```

## Related Documentation

- [Chunked Deletion Implementation](chunked-deletion-implementation.md)
- [Cleanup Effectiveness Analysis](cleanup-effectiveness-analysis.md)
- [Logging Standards](.github/instructions/logging.instructions.md)

## Files Changed

### Core Changes
1. `internal/constants/logprefixes.go` - New prefix and log area
2. `internal/service/logprefixes.go` - Re-export prefix
3. `internal/config/config.go` - New config field
4. `internal/service/cleanup.go` - Updated all log calls
5. `internal/service/filelogwriter.go` - Cleanup log routing

### Integration
6. `cmd/codexdns/main.go` - Startup config
7. `internal/http/handlers/config_logging.go` - Config handler

### Documentation
8. `.github/instructions/logging.instructions.md` - Added `[Cleanup]` component
9. `docs/cleanup-dedicated-logging.md` - This document

---

**Implementation Date**: January 28, 2026  
**Status**: ✅ Complete and tested  
**Breaking Changes**: None
