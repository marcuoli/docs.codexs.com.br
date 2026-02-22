# Application Config Export/Import Feature

## Overview

The backup/restore system now supports exporting and importing application settings from `config.json`. This completes the backup functionality by including critical application configuration alongside database entities.

## Features

### Export

When exporting configuration, you can now check **"Application Settings (config.json)"** to include:

- **Upstream DNS servers** (critical for DNS forwarding and latency measurement)
- **Port configurations** (HTTP, DNS, DHCP)
- **Debug flags** and logging settings
- **Cache configuration** (Redis, memory limits)
- **Discovery settings**
- **DHCP integration settings**
- All other non-sensitive configuration values

### Security & Sanitization

Sensitive data is automatically **redacted** during export:

- `db_dsn` → `[REDACTED]`
- `redis_password` → `[REDACTED]`
- `smtp_username`, `smtp_password` → `[REDACTED]`
- `session_secret`, `csrf_secret` → `[REDACTED]`
- `webauthn_rp_id` → `[REDACTED]`
- `api_key`, `api_secret` → `[REDACTED]`

**Environment-specific fields** are preserved but flagged for review:
- Log file paths (`http_log_path`, `dns_log_path`, etc.)
- Database path (`db_dsn`)
- OUI database path (`oui_database_path`)

### Import

During import validation, if application settings are present:

1. A warning banner appears explaining that sensitive values are redacted
2. A checkbox allows you to opt-in: **"Apply application settings to config.json (after manual review)"**
3. The import process will:
   - Create a backup of the existing `config.json` → `config.json.backup`
   - Merge imported settings with existing config (imported values take precedence)
   - Skip `[REDACTED]` values (you must manually configure these)
   - Skip metadata fields (`_import_note`, `*_note`)
   - Write the updated config to `config.json`

**Important**: After import, you must:
1. Manually review `config.json`
2. Replace all `[REDACTED]` values with actual secrets
3. Verify environment-specific paths are correct for your system
4. Restart CodexDNS for changes to take effect

## Use Cases

### Complete Backup/Restore

**Before** (incomplete):
- Export only includes database entities
- Restoring requires manual reconfiguration of upstream servers, ports, debug flags, etc.

**Now** (complete):
- Export includes both database AND application settings
- Restoring preserves your upstream DNS servers, debug settings, cache config
- Only secrets need manual configuration (for security)

### Migration Between Environments

**Development → Production**:
1. Export from dev with app config
2. Import to production
3. Review and adjust:
   - Port numbers (dev: 8080 → prod: 80)
   - Log paths (dev: `./logs` → prod: `/var/log/codexdns`)
   - Database path (dev: SQLite → prod: PostgreSQL DSN)
   - Secrets (use production credentials)

### Configuration Templates

**Setup base configuration**:
1. Configure CodexDNS with your standard settings (upstream servers, debug flags, cache limits)
2. Export with app config
3. Use this export as a template for new instances
4. Import → adjust environment-specific fields → start

## Technical Details

### Export Format

```json
{
  "metadata": {
    "exportVersion": "1.0",
    "appVersion": "0.2.20251212.4",
    "exportedAt": "2025-12-12T10:30:00Z"
  },
  "app_config": {
    "http_port": 8080,
    "dns_host": "0.0.0.0",
    "dns_port": 53,
    "db_dsn": "[REDACTED]",
    "redis_password": "[REDACTED]",
    "smtp_username": "[REDACTED]",
    "smtp_password": "[REDACTED]",
    "session_secret": "[REDACTED]",
    "csrf_secret": "[REDACTED]",
    "upstream_servers": ["8.8.8.8", "1.1.1.1"],
    "debug_dns": false,
    "debug_resolver": true,
    "latency_measurement_interval": 30,
    "http_log_path": "logs/http.log",
    "dns_log_path": "logs/dns.log",
    "_import_note": "Review and adjust environment-specific settings (ports, paths, addresses) before importing"
  },
  "zones": [...],
  "records": [...],
  ...
}
```

### Import Process

1. **Validation** (`/settings/import/validate`):
   - Checks if `app_config` is present
   - Returns `hasAppConfig: true` and `appConfigSummary` for review
   - Warnings include:
     - List of redacted fields that need manual configuration
     - List of environment-specific fields that need review

2. **Execution** (`/settings/import/execute`):
   - User must check "Apply application settings to config.json"
   - Creates backup: `config.json.backup`
   - Reads existing config
   - Merges imported config (skipping `[REDACTED]` and metadata fields)
   - Writes updated config
   - Continues with database imports (zones, records, etc.)

3. **Post-Import**:
   - User manually edits `config.json` to replace `[REDACTED]` values
   - User verifies environment-specific paths
   - User restarts CodexDNS

### Files Modified

- `internal/service/export.go` - Added app config export/import logic
- `internal/service/export_appconfig.go` - Sanitization and import methods
- `internal/http/handlers/export.go` - Handler support for app config
- `web/templates/components/backup_restore.templ` - UI checkboxes and warnings

### API Changes

**ExportOptions**:
```go
type ExportOptions struct {
    // ... existing fields ...
    IncludeAppConfig bool // NEW
}
```

**ImportOptions**:
```go
type ImportOptions struct {
    SkipExisting      bool
    OverwriteExisting bool
    IncludeAppConfig  bool // NEW
}
```

**ValidationResult**:
```go
type ValidationResult struct {
    // ... existing fields ...
    HasAppConfig       bool                   // NEW
    AppConfigSummary   map[string]interface{} // NEW
}
```

**ImportResult**:
```go
type ImportResult struct {
    // ... existing fields ...
    Warnings []string // NEW - for app config import warnings
}
```

## Testing

Run app config export tests:
```bash
go test -v -run "TestExportSanitizedConfig|TestGetAppConfigForReview" ./internal/service
```

Manual testing:
1. Navigate to Settings → Backup & Restore
2. Check "Application Settings (config.json)" and export
3. Verify exported JSON has `app_config` section with `[REDACTED]` values
4. Attempt to import with app config checkbox unchecked (should skip)
5. Attempt to import with checkbox checked (should merge and create backup)
6. Verify `config.json.backup` exists and `config.json` was updated

## Security Considerations

- **Never commit exports to version control** - they may contain partial secrets or sensitive configuration
- **Always use HTTPS** when downloading exports over the network
- **Review before import** - validate the source is trusted
- **Manual secret configuration** - system never auto-fills secrets from exports (by design)
- **Backup created automatically** - `config.json.backup` allows rollback if import causes issues

## Limitations

1. **Manual review required** - Import does not automatically apply all settings
2. **Restart required** - Config changes only take effect after restart
3. **File-based config only** - Only applies to `config.json`, not database-stored config
4. **No validation** - Import does not validate config values (e.g., valid ports, reachable servers)

## Future Enhancements

- [ ] Config validation before applying import
- [ ] Hot-reload for non-critical settings
- [ ] Encrypted export option for sensitive data
- [ ] Config diff view during import
- [ ] Rollback mechanism (beyond simple backup)
- [ ] Import preview with highlighted changes
