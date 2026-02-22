---
title: "NTP Query Logging"
description: "Log and monitor NTP queries and client activity."
weight: 20
---

# NTP Query Logging

## Overview

CodexDNS separates NTP logging into two distinct logs to provide better visibility into NTP server operations and individual client requests.

## Log Files

### 1. NTP Server Log (`ntp_log_path`)

**Default**: `logs/ntp-server.log`

**Purpose**: Server lifecycle events and operations

**Contains**:
- Server start/stop events
- Configuration changes
- Time synchronization events
- Server errors and warnings
- General operational messages

**Example entries**:
```
2025/01/25 10:30:15 [INFO] [NTP] NTP server started on 0.0.0.0:123
2025/01/25 10:30:16 [INFO] [NTP] Time synchronized with upstream server pool.ntp.org
2025/01/25 10:35:22 [INFO] [NTP] Request from 192.168.1.100 version=4 mode=3
2025/01/25 10:40:45 [ERROR] [NTP] Failed to sync with upstream: connection timeout
```

### 2. NTP Query Log (`ntp_query_log_path`)

**Default**: `logs/ntp-queries.log`

**Purpose**: Individual NTP client requests (NEW)

**Contains**:
- Every NTP client request with detailed parameters
- Client IP and port
- NTP version, mode, stratum
- Request payload size

**Format**: `timestamp client_ip:port v=VERSION mode=MODE stratum=STRATUM len=LENGTH`

**Example entries**:
```
2025/01/25 10:35:22.123456 192.168.1.100:52341 v=4 mode=3 stratum=0 len=48
2025/01/25 10:35:25.456789 192.168.1.101:51234 v=4 mode=3 stratum=0 len=48
2025/01/25 10:35:28.789012 10.0.0.50:49152 v=3 mode=3 stratum=0 len=48
```

## Configuration

### Via config.json

```json
{
  "ntp_log_path": "logs/ntp-server.log",
  "ntp_query_log_path": "logs/ntp-queries.log",
  "log_rotation": {
    "max_size_mb": 100,
    "max_backups": 10,
    "max_age_days": 30,
    "compress": true
  }
}
```

### Via Web UI

Navigate to **Settings → Logging Configuration** and configure:
- **NTP Server**: Path to NTP server operations log
- **NTP Queries**: Path to NTP client queries log

### Via Environment Variables

```bash
export NTP_LOG_PATH="logs/ntp-server.log"
export NTP_QUERY_LOG_PATH="logs/ntp-queries.log"
```

## NTP Field Reference

### Mode Values
- `0` - Reserved
- `1` - Symmetric active
- `2` - Symmetric passive
- `3` - Client
- `4` - Server
- `5` - Broadcast
- `6` - NTP control message
- `7` - Reserved for private use

### Version Values
- `3` - NTP version 3
- `4` - NTP version 4 (most common)

### Stratum Values
- `0` - Unspecified/invalid
- `1` - Primary reference (e.g., GPS, atomic clock)
- `2-15` - Secondary reference (distance from primary)
- `16` - Unsynchronized

## Use Cases

### Troubleshooting NTP Issues
Check the **NTP Server Log** for operational problems:
```bash
grep ERROR logs/ntp-server.log
```

### Monitoring Client Activity
Check the **NTP Queries Log** for client patterns:
```bash
# Count requests per client
awk '{print $2}' logs/ntp-queries.log | cut -d: -f1 | sort | uniq -c | sort -rn

# Find non-NTPv4 clients
grep -v "v=4" logs/ntp-queries.log

# Monitor request rate
tail -f logs/ntp-queries.log
```

### Analyzing Time Sync Patterns
```bash
# Group requests by hour
awk '{print substr($1, 1, 13)}' logs/ntp-queries.log | sort | uniq -c

# Find clients with unusual stratum values
grep -v "stratum=0" logs/ntp-queries.log
```

## Log Rotation

Both logs use the same rotation settings from `log_rotation` configuration:

- **max_size_mb**: Rotate when file reaches this size (default: 100MB)
- **max_backups**: Number of old log files to keep (default: 10)
- **max_age_days**: Delete files older than this (default: 30 days)
- **compress**: Gzip old files asynchronously (default: true)

Rotated files are named:
- `ntp-server.log.1`, `ntp-server.log.2.gz`, etc.
- `ntp-queries.log.1`, `ntp-queries.log.2.gz`, etc.

## Implementation Details

### Query Logging Flow

```
┌─────────────────┐
│  NTP Client     │
│  Request        │
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│ NTP Server (ntpserver)   │
│ - Receives packet        │
│ - Calls requestHook()    │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ requestHook()            │
│ - Logs to ntp.log        │ ← Server operations log
│ - Calls WriteNTPQuery()  │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ WriteNTPQuery()          │
│ - FileLogWriter          │
│ - Async buffered write   │ ← Dedicated queries log
│ - Rotation enabled       │
└──────────────────────────┘
```

### Async Buffered Writes

NTP query logging uses the same **async buffered architecture** as DNS queries:

1. **Non-blocking writes** - `WriteNTPQuery()` queues to channel (1000 capacity)
2. **Background worker** - Dedicated goroutine drains queue and writes to disk
3. **Fast rotation** - Size-based rotation happens asynchronously
4. **Async compression** - Old files compressed in separate goroutine

This ensures that logging NTP queries **never blocks** the NTP server from responding to clients.

## Comparison: DNS vs NTP Logging

CodexDNS uses a **consistent logging pattern** across services:

| Service | Operations Log | Queries Log | Failed Queries Log |
|---------|---------------|-------------|-------------------|
| DNS | `dns_log_path` | `dns_query_log_path` | `dns_query_failed_log_path` |
| NTP | `ntp_log_path` | `ntp_query_log_path` | *(future)* |
| DHCP | `dhcp_log_path` | *(future)* | *(future)* |

**Benefits**:
- Consistent troubleshooting across services
- Focused log analysis (operations vs queries)
- Reduced noise in operational logs
- Easier to monitor client patterns

## Performance Impact

- **Minimal** - Async buffered writes prevent blocking
- **Query logging overhead**: ~50-100 nanoseconds per request (channel write)
- **No DNS/NTP performance impact** - Writes happen in background
- **Disk I/O**: Batched writes reduce syscall overhead

## Migration from Previous Versions

**Before (single log)**:
```json
{
  "ntp_log_path": "logs/ntp.log"
}
```

**After (separated logs)**:
```json
{
  "ntp_log_path": "logs/ntp-server.log",
  "ntp_query_log_path": "logs/ntp-queries.log"
}
```

Existing installations will continue to work with `ntp_log_path` only. The new `ntp_query_log_path` is **optional**.

## See Also

- [DNS Query Failed Logging](dns-query-failed-logging.md)
- [Logging Standards](../. github/instructions/logging.instructions.md)
- [Async Buffered File Logging](../docs/lumberjack-migration.md)
