# Database Cleanup Service Implementation

**Date**: January 28, 2026  
**Version**: 0.5.20260128.1  
**Commit**: ec854f5

## Overview

Implemented a comprehensive database cleanup service (`CleanupService`) that automatically purges old data from multiple tables on a periodic schedule. All cleanup operations are logged to the main application log for tracking and auditing.

## Features

### 1. Automatic Periodic Cleanup
- Runs every 24 hours by default (configurable)
- Starts automatically with application launch
- Initial cleanup runs 10 seconds after startup
- Gracefully stops on application shutdown

### 2. Multi-Source Data Purging

The cleanup service handles four types of data:

#### DNS Query Logs
- **Default Retention**: 30 days
- **Table**: `dns_queries`
- **Service**: Uses `DNSQueryService.DeleteOlderThan()`
- **Purpose**: Prevents query log table from growing indefinitely

#### Client History Records
- **Default Retention**: 90 days
- **Tables**: `client_history` + associated stats (`client_query_stats`, `client_hourly_stats`, `client_top_domains`)
- **Service**: Uses `ClientService.PurgeOldHistory()`
- **Purpose**: Maintains audit trail while removing very old deleted client records

#### DHCP Integration Updates
- **Default Retention**: 30 days
- **Table**: `dhcp_integration_updates`
- **Service**: Uses `DHCPIntegrationService.ClearOldUpdates()`
- **Purpose**: Keeps DHCP sync logs manageable

#### Legacy Archived Clients
- **No Retention Period**: Cleans up immediately when found
- **Table**: `clients` where `client_type = 'archived'`
- **Service**: Uses `ClientService.DeleteArchivedClients()`
- **Purpose**: Migration cleanup for old-style archived clients

### 3. Comprehensive Logging

All cleanup operations log to the main log file:

**Startup Log**:
```
[Service] Database cleanup service started (interval: 24h, DNS queries: 30d, client history: 90d, DHCP updates: 30d)
```

**Cleanup Execution Logs**:
```
[Service] Starting database cleanup job...
[Service] Deleted 1234 DNS query logs older than 30 days (cutoff: 2025-12-29)
[Service] Deleted 56 client history records and 89 associated stats (older than 90 days)
[Service] Deleted 45 DHCP integration update logs older than 30 days
[Service] Deleted 2 legacy archived clients and 12 associated stats (migration cleanup)
[Service] Database cleanup completed: 1338 total records deleted in 245ms
```

**No Records Found**:
```
[Service] Database cleanup completed: no old records found (runtime: 56µs)
```

### 4. Configuration Options

```go
cleanupSvc := service.NewCleanupService(db, dnsQuerySvc, clientSvc, dhcpIntSvc, statsSvc)

// Configure retention periods
cleanupSvc.SetDNSQueryRetention(60)        // Keep DNS queries for 60 days
cleanupSvc.SetClientHistoryRetention(180)  // Keep client history for 180 days
cleanupSvc.SetDHCPUpdateRetention(45)      // Keep DHCP updates for 45 days

// Configure cleanup interval
cleanupSvc.SetCleanupInterval(12 * time.Hour) // Run every 12 hours

// Start the service
cleanupSvc.Start(ctx)

// Get current settings
settings := cleanupSvc.GetRetentionSettings()
```

## Implementation Details

### Files Created

1. **`internal/service/cleanup.go`** (233 lines)
   - `CleanupService` struct with configurable retention periods
   - `NewCleanupService()` - Creates service with default settings
   - `Start()` - Begins background goroutine
   - `Stop()` - Gracefully stops the service
   - `RunCleanup()` - Executes all cleanup tasks
   - Setter methods for configuring retention periods
   - `GetRetentionSettings()` - Returns current configuration

2. **`internal/service/cleanup_test.go`** (190 lines)
   - `TestCleanupService_DNSQueryCleanup` - Tests DNS query log purging
   - `TestCleanupService_ClientHistoryCleanup` - Tests client history purging
   - `TestCleanupService_SetRetentionPeriods` - Tests configuration
   - `TestCleanupService_InvalidRetentionPeriods` - Tests validation
   - `TestCleanupService_StartStop` - Tests service lifecycle
   - `TestCleanupService_GetRetentionSettings` - Tests settings retrieval

### Files Modified

1. **`cmd/codexdns/main.go`**
   - Added cleanup service initialization after stats service
   - Creates service instances (DNSQueryService, ClientService, DHCPIntegrationService)
   - Starts cleanup service with context
   - Registers cleanup service shutdown in defer

2. **`docs/todo.md`**
   - Marked cleanup job task as DONE
   - Added detailed implementation notes

## Architecture

### Service Dependencies

```
CleanupService
├── DNSQueryService (for DNS query log cleanup)
├── ClientService (for client history cleanup)
├── DHCPIntegrationService (for DHCP update cleanup)
└── StatsService (note: stats cleanup is handled separately by StatsService)
```

### Execution Flow

```
Application Start
    ↓
Initialize CleanupService
    ↓
Start(ctx)
    ↓
├─→ Initial cleanup (after 10s delay)
│   └─→ RunCleanup(ctx)
│       ├─→ Clean DNS queries (if retention > 0)
│       ├─→ Clean client history (if retention > 0)
│       ├─→ Clean DHCP updates (if retention > 0)
│       └─→ Clean legacy archived clients
│
└─→ Periodic cleanup (every 24h)
    └─→ RunCleanup(ctx)
        └─→ (same as above)

Application Shutdown
    ↓
Stop()
    ↓
Goroutine terminates
```

### Error Handling

- Each cleanup operation is wrapped in error handling
- Errors are logged but don't stop other cleanup tasks
- Service continues with next cleanup type on error
- Total deleted count includes successful operations only

### Performance Considerations

1. **Batched Deletes**: Uses GORM's batch delete operations
2. **Indexed Queries**: Relies on timestamp/date indexes
3. **Background Execution**: Runs in separate goroutine
4. **Graceful Shutdown**: Respects context cancellation
5. **No Blocking**: Doesn't block application startup

## Testing

All 6 tests pass:

```
✓ TestCleanupService_DNSQueryCleanup - Tests DNS query purging with cutoff date
✓ TestCleanupService_ClientHistoryCleanup - Tests client history purging with stats
✓ TestCleanupService_SetRetentionPeriods - Tests configuration setters
✓ TestCleanupService_InvalidRetentionPeriods - Tests validation (rejects ≤ 0)
✓ TestCleanupService_StartStop - Tests service lifecycle
✓ TestCleanupService_GetRetentionSettings - Tests settings retrieval
```

## Future Enhancements

Potential improvements for future versions:

1. **Configuration UI**: Add cleanup settings to web UI configuration pages
2. **Manual Trigger**: Add API endpoint to manually trigger cleanup
3. **Metrics**: Track cleanup statistics over time
4. **Email Reports**: Optional email notifications on cleanup completion
5. **Per-Table Configuration**: More granular control over each table's retention
6. **Dry Run Mode**: Preview what would be deleted without actual deletion
7. **Scheduled Windows**: Allow cleanup to run only during specific time windows
8. **Database Stats**: Track table sizes before/after cleanup

## Notes

- **Stats Service**: Statistics cleanup is handled separately by `StatsService.PurgeOldStats()` which runs independently every 24 hours with its own retention configuration.

- **Legacy Clients**: The cleanup of legacy archived clients (`client_type = 'archived'`) is a migration cleanup task. New client deletions automatically create history records instead of archiving.

- **Transaction Safety**: Client history cleanup uses transactions to ensure consistency between history deletion and stats cleanup.

- **Default Settings**: Chosen to balance data retention for troubleshooting vs. database size:
  - DNS queries: 30 days (most queries don't need long-term retention)
  - Client history: 90 days (longer for audit trail)
  - DHCP updates: 30 days (sync logs are temporary by nature)

## Related Services

- **StatsService**: Handles statistics data cleanup independently
- **FilterListUpdater**: Handles filter list refresh (not related to cleanup)
- **OrphanArchiver**: Preserves stats for deleted clients (runs before CleanupService purges)
