# Log Rotation Settings Fix

## Issue
The log rotation parameters (Max Size, Max Backups, Max Age, Compress) on the Logging tab were not being saved.

## Root Cause
The `UpdateConfig` handler in `internal/http/handlers/config.go` was missing code to:
1. Parse the log rotation form fields
2. Update the config struct with the values
3. Reinitialize the file log writers with the new settings

## Changes Made

### 1. Parse Form Fields
Added parsing of the 4 log rotation parameters:
```go
logMaxSizeMB := c.PostForm("log_max_size_mb")
logMaxBackups := c.PostForm("log_max_backups")
logMaxAgeDays := c.PostForm("log_max_age_days")
logCompress := c.PostForm("log_compress")
```

### 2. Update Config Struct
Added code to validate and update the config:
```go
// Update log rotation settings
if logMaxSizeMB != "" {
    if maxSizeMB, err := strconv.Atoi(logMaxSizeMB); err == nil && maxSizeMB > 0 {
        h.config.LogMaxSizeMB = maxSizeMB
    }
}
if logMaxBackups != "" {
    if maxBackups, err := strconv.Atoi(logMaxBackups); err == nil && maxBackups >= 0 {
        h.config.LogMaxBackups = maxBackups
    }
}
if logMaxAgeDays != "" {
    if maxAgeDays, err := strconv.Atoi(logMaxAgeDays); err == nil && maxAgeDays >= 0 {
        h.config.LogMaxAgeDays = maxAgeDays
    }
}
h.config.LogCompress = (logCompress == "true" || logCompress == "on")
```

### 3. Reinitialize File Log Writers
Added code to reinitialize log writers after config is saved:
```go
// Reinitialize file log writers with updated rotation settings
fileLogWriter := service.GetFileLogWriter()
if err := fileLogWriter.InitializeWithConfig(service.FileLogConfig{
    HTTPPath:     h.config.HTTPLogPath,
    AccessPath:   h.config.HTTPAccessLog,
    ErrorPath:    h.config.HTTPErrorLog,
    DNSPath:      h.config.DNSLogPath,
    DNSQueryPath: h.config.DNSQueryLogPath,
    DHCPPath:     h.config.DHCPLogPath,
    FilterPath:   h.config.FilterLogPath,
    MaxSizeMB:    h.config.LogMaxSizeMB,
    MaxBackups:   h.config.LogMaxBackups,
    MaxAgeDays:   h.config.LogMaxAgeDays,
    Compress:     h.config.LogCompress,
}); err != nil {
    log.Printf("[Config] Warning: failed to reinitialize file logging with new rotation settings: %v", err)
} else {
    log.Printf("[Config] File logging reinitialized with rotation settings: %dMB, %d backups, %d days, compress=%v",
        h.config.LogMaxSizeMB, h.config.LogMaxBackups, h.config.LogMaxAgeDays, h.config.LogCompress)
}
```

## Testing

### Build Verification
```bash
go build -o bin/codexdns.exe ./cmd/codexdns
# Exit code: 0 (success)
```

### Manual Testing Steps
1. Start the application
2. Navigate to Configuration → Logging tab
3. Modify the "Log Rotation & Retention" widget settings:
   - Change Max Size (MB)
   - Change Max Backups
   - Change Max Age (Days)
   - Toggle "Compress Rotated Logs"
4. Click "Save Configuration"
5. Verify changes persist by:
   - Checking `config.json` file
   - Reloading the page to see saved values
   - Checking log output for reinitialize message

## Expected Behavior

After saving:
1. Configuration file (`config.json`) should contain updated values
2. Log should show: `[Config] File logging reinitialized with rotation settings: XMB, Y backups, Z days, compress=true/false`
3. Reloading the page should show the saved values
4. New log files should use the updated rotation settings (can be verified by letting logs grow past the new size limit)

## Files Modified
- `internal/http/handlers/config.go` - Added log rotation parameter handling
