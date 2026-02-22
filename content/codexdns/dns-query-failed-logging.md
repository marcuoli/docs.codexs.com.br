# DNS Query Failed Logging Implementation

## Overview

Added dedicated logging for failed DNS queries to a separate log file (`dns-queries-failed.log`). This allows easier troubleshooting and monitoring of DNS query failures without needing to parse through the general DNS query log.

## What Was Changed

### 1. Configuration

**File:** `internal/config/config.go`
- Added `DNSQueryFailedLogPath` field to Config struct
- Field metadata: `json:"dns_query_failed_log_path"`, UI label "DNS Queries Failed", order 14.5
- Help text: "Failed DNS queries (upstream timeouts, SERVFAIL, errors)"
- Placeholder: `logs/dns_queries_failed.log`

**File:** `internal/constants/defaults.go`
- Added constant: `DefaultLogDNSQueryFailedPath = "logs/dns_queries_failed.log"`

**File:** `config-wsl.json`
- Added field: `"dns_query_failed_log_path": "logs/dns-queries-failed.log"`

### 2. File Log Writer Infrastructure

**File:** `internal/service/filelogwriter.go`

**FileLogWriter struct:**
- Added `dnsQueryFailedWriter *RotatingLogWriter` field
- Added `dnsQueryFailedPath string` field

**FileLogConfig struct:**
- Added `DNSQueryFailedPath string` field with comment "Failed DNS queries (SERVFAIL, errors, timeouts)"

**InitializeWithConfig method:**
- Added initialization block for `dnsQueryFailedWriter` (lines 214-229)
- Creates rotating log writer with same settings as other logs (max size, backups, age, compression)
- Logs initialization message: "DNS Query Failed log: <path> (max: XMB, backups: Y, age: Zd, compress: true/false)"

**New struct DNSQueryFailedEntry:**
```go
type DNSQueryFailedEntry struct {
    Timestamp    time.Time
    ClientIP     string
    QueryName    string
    QueryType    string
    ErrorMessage string
    FailureType  string // "SERVFAIL", "TIMEOUT", "UPSTREAM_ERROR", "PANIC", "OVERLOAD"
    ResponseCode int    // DNS response code (e.g., SERVFAIL=2)
}
```

**New method WriteDNSQueryFailed:**
- Writes failed DNS query entries to dedicated log file
- Format: `timestamp client_ip query_name query_type failure_type: error_message [rcode=X]`
- Example: `2025/01/25 10:30:45.123456 192.168.1.100 example.com. A UPSTREAM_ERROR: upstream timeout [rcode=2]`

### 3. DNS Server Integration

**File:** `internal/dns/server.go`

**New helper function logFailedQuery:**
```go
func logFailedQuery(clientIP, queryName, queryType, failureType, errorMessage string, responseCode int)
```
- Centralizes failed query logging logic
- Calls `FileLogWriter.WriteDNSQueryFailed()` with entry details

**Panic Recovery (handleDNSQuery defer block):**
- Extracts query name, type, and client IP from request
- Logs panic details to failed queries log
- Failure type: `"PANIC"`
- Example: `panic: runtime error: invalid memory address or nil pointer dereference`

**Overload Protection (MaxConcurrentQueries check):**
- Logs overload events to failed queries log (sampled 1 in 100 to avoid spam)
- Failure type: `"OVERLOAD"`
- Error message includes active/max/dropped counts
- Example: `server overload: active=5001, max=5000, dropped=123`

**Upstream Forward Failure (forwarder.ForwardQuery error):**
- Logs when upstream DNS query fails
- Failure type: `"UPSTREAM_ERROR"`
- Error message: actual error from forwarder (timeout, connection refused, etc.)
- Example: `dial udp 8.8.8.8:53: i/o timeout`

**SERVFAIL Fallback Response:**
- Logs when returning SERVFAIL after upstream failure
- Failure type: `"SERVFAIL"`
- Error message: `"upstream query failed"`
- Logged at final fallback point before sending response

### 4. Initialization in main.go

**File:** `cmd/codexdns/main.go`
- Updated `InitializeWithConfig` call to include `DNSQueryFailedPath: cfg.DNSQueryFailedLogPath`
- Ensures failed query log writer is created at startup

**File:** `internal/http/handlers/config_logging.go`
- Updated `InitializeWithConfig` call in ProcessLoggingConfig
- Ensures failed query log writer is reinitialized when logging config changes

### 5. Web UI

**File:** `web/templates/config_logging.templ`
- Added input field for DNS Query Failed Log Path
- Positioned between DNS Query Log and Application Log fields
- Uses metadata-driven rendering (auto-populated from Config struct tags)
- Placeholder: `logs/dns_queries_failed.log`

## Failure Types Logged

| Failure Type      | Description | DNS Rcode | When Logged |
|------------------|-------------|-----------|-------------|
| `PANIC`          | DNS handler panic/crash | SERVFAIL (2) | Panic recovery catches runtime errors |
| `OVERLOAD`       | Server overload (too many concurrent queries) | SERVFAIL (2) | Active queries exceed MaxConcurrentQueries (sampled 1 in 100) |
| `UPSTREAM_ERROR` | Upstream DNS server error | SERVFAIL (2) | forwarder.ForwardQuery() returns error |
| `SERVFAIL`       | Generic server failure | SERVFAIL (2) | Final fallback when upstream fails |

## Log File Format

Each line follows this format:
```
<timestamp> <client_ip> <query_name> <query_type> <failure_type>: <error_message> [rcode=<code>]
```

**Example entries:**
```
2025/01/25 10:30:45.123456 192.168.1.100 example.com. A UPSTREAM_ERROR: dial udp 8.8.8.8:53: i/o timeout [rcode=2]
2025/01/25 10:31:12.789012 192.168.1.101 google.com. AAAA SERVFAIL: upstream query failed [rcode=2]
2025/01/25 10:32:00.456789 192.168.1.102 test.local. A PANIC: panic: runtime error: invalid memory address [rcode=2]
2025/01/25 10:33:45.012345 192.168.1.103 api.example.com. CNAME OVERLOAD: server overload: active=5001, max=5000, dropped=123 [rcode=2]
```

## Log Rotation

The failed queries log uses the same rotation settings as other logs:
- **Max Size:** Configured via `log_max_size_mb` (default: 100MB)
- **Max Backups:** Configured via `log_max_backups` (default: 10 files)
- **Max Age:** Configured via `log_max_age_days` (default: 30 days)
- **Compression:** Configured via `log_compress_method` (default: gzip)

Old log files are automatically:
1. Rotated when size limit reached (e.g., `dns-queries-failed.log.1`, `.log.2`, etc.)
2. Compressed asynchronously (e.g., `dns-queries-failed.log.1.gz`)
3. Deleted when exceeding max backups or max age

## Async Buffered Logging

Failed query logging uses the async buffered file logging architecture:
- **Non-blocking writes:** Queued to channel (1000 message capacity)
- **Background worker:** Processes writes in dedicated goroutine
- **Fast rotation:** No blocking of DNS query processing
- **Async compression:** Rotated files compressed separately

This ensures DNS query processing is never delayed by disk I/O operations.

## Testing

To test failed query logging:

### 1. Trigger Upstream Timeout
```bash
# Configure a non-existent upstream server in config-wsl.json
"upstream_servers": ["192.0.2.1:53"]  # TEST-NET-1 (guaranteed timeout)

# Query DNS server
dig @172.23.14.225 example.com A

# Check failed queries log
tail -f logs/dns-queries-failed.log
```

### 2. Trigger Server Overload
```bash
# Lower MaxConcurrentQueries in server.go (for testing only)
const MaxConcurrentQueries = 10

# Send many concurrent queries
for i in {1..100}; do dig @172.23.14.225 test$i.example.com A & done

# Check failed queries log (sampled 1 in 100)
tail -f logs/dns-queries-failed.log
```

### 3. View Failed Queries in Production
```bash
# Monitor failed queries in real-time
tail -f logs/dns-queries-failed.log

# Count failures by type
grep -oP 'UPSTREAM_ERROR|SERVFAIL|PANIC|OVERLOAD' logs/dns-queries-failed.log | sort | uniq -c

# Find most problematic clients
awk '{print $2}' logs/dns-queries-failed.log | sort | uniq -c | sort -rn | head -10
```

## Files Modified

1. `internal/config/config.go` - Added DNSQueryFailedLogPath field
2. `internal/constants/defaults.go` - Added DefaultLogDNSQueryFailedPath constant
3. `internal/service/filelogwriter.go` - Added writer, config, entry struct, and write method
4. `internal/dns/server.go` - Added logFailedQuery helper and 4 failure logging points
5. `cmd/codexdns/main.go` - Updated InitializeWithConfig call
6. `internal/http/handlers/config_logging.go` - Updated InitializeWithConfig call
7. `web/templates/config_logging.templ` - Added UI input field
8. `config-wsl.json` - Added dns_query_failed_log_path field

## Future Enhancements

Potential improvements for future iterations:

1. **Structured Logging:** Use JSON format for easier parsing by log aggregators (Elasticsearch, Splunk, etc.)
2. **Metrics Export:** Export failed query counts to Prometheus/Grafana
3. **Alerting:** Send notifications when failure rate exceeds threshold
4. **Client Blacklisting:** Auto-block clients causing excessive failures
5. **Upstream Health Tracking:** Track per-upstream failure rates and auto-disable problematic servers
6. **Query Sampling:** Make sampling rate configurable (currently hardcoded 1 in 100 for overload)
7. **Additional Failure Types:** Log timeout failures, malformed queries, blocked queries, etc.

## Deployment Notes

When deploying to production:

1. **Default Disabled:** If log path is empty, failed query logging is disabled
2. **Disk Space:** Monitor disk usage, especially with high failure rates
3. **Performance:** Async buffered writes ensure minimal DNS query impact
4. **Log Aggregation:** Consider shipping logs to centralized logging system
5. **Retention Policy:** Adjust max_backups and max_age_days based on audit requirements

## References

- Logging Architecture: `docs/logging.instructions.md`
- Log Rotation: `docs/lumberjack-migration.md`
- DNS Server Flow: `docs/dns-resolution-flow.md`
- File Log Writer: `internal/service/filelogwriter.go`
- Rotating Log Writer: `internal/service/logrotate.go`
