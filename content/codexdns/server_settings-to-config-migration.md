# Migration from server_settings to config Table

## Overview

This document describes the migration from the legacy `server_settings` table (JSON blob storage) to the new `config` table (key-value storage) introduced in version 0.5.

## Background

### Old Structure (server_settings)
```sql
CREATE TABLE server_settings (
    category TEXT PRIMARY KEY,
    settings TEXT NOT NULL,        -- JSON blob
    config_override BOOLEAN DEFAULT 0
);
```

**Example data:**
```json
{
  "category": "web",
  "settings": "{\"http_enabled\":true,\"http_port\":8080,\"https_enabled\":false}",
  "config_override": false
}
```

### New Structure (config)
```sql
CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    value_type TEXT NOT NULL,
    description TEXT,
    config_override BOOLEAN DEFAULT 0,
    UNIQUE(category, key)
);
```

**Example data:**
```sql
('web', 'http_enabled', 'true', 'bool', 'Enable HTTP web server', 0)
('web', 'http_port', '8080', 'int', 'HTTP port number', 0)
('web', 'https_enabled', 'false', 'bool', 'Enable HTTPS web server', 0)
```

## Migration Timeline

| Version | Migration | Description |
|---------|-----------|-------------|
| 0.4.x | 000004 | Creates `server_settings` table |
| 0.5.0 | 000005 | Creates `config` table with defaults |
| 0.5.x | **000019** | **Migrates data from server_settings to config** |
| 0.6.0 | 000006 | Drops `server_settings` table (safe after 000019) |

## Migration 000019 Details

### Purpose
Safely copy existing configuration from `server_settings` JSON blobs into the new `config` key-value structure.

### Strategy
- **INSERT OR IGNORE**: Preserves existing config entries (if any)
- **JSON extraction**: Uses SQLite `json_extract()` to parse JSON blobs
- **Type conversion**: Converts boolean values correctly (true/false strings and 0/1 integers)
- **COALESCE**: Provides defaults for missing fields
- **config_override**: Preserves user override flags

### What Gets Migrated

#### Web Settings (11 fields)
- http_enabled, http_port
- https_enabled, https_port
- http_redirect_to_https
- hsts_enabled, hsts_max_age_seconds

#### DNS Settings (23 fields)
- **UDP/TCP**: udp_enabled, udp_address, udp_port, tcp_enabled, tcp_address, tcp_port
- **DNS-over-TLS (DoT)**: dot_enabled, dot_address, dot_port, dot_cert_path, dot_key_path
- **DNS-over-HTTPS (DoH)**: doh_enabled, doh_address, doh_port, doh_path, doh_http3_enabled, doh_cert_path, doh_key_path
- **DNS-over-QUIC (DoQ)**: doq_enabled, doq_address, doq_port, doq_cert_path, doq_key_path

#### TLS Settings (4 fields)
- cert_path, key_path
- use_wildcard, use_self_signed

#### Auto TLS Settings (6 fields)
- enabled, domain, email
- cache_dir, staging, auto_renew

**Total: 40 configuration fields migrated**

### Idempotency
The migration is **idempotent** - safe to run multiple times:
- Uses `INSERT OR IGNORE` to skip existing keys
- Won't duplicate data
- Won't overwrite manually configured values

### Rollback
Migration 000019 down rollback:
```sql
DELETE FROM config WHERE category IN ('web', 'dns', 'tls', 'auto_tls');
```

**Warning**: Rollback deletes ALL migrated config entries, including any manual changes made after migration.

## Upgrade Scenarios

### Scenario 1: Fresh Install (No server_settings)
**Result**: Migration runs successfully but finds no data to copy. Default values from migration 000005 are used.

**Expected behavior:**
1. Migration 000005 creates `config` table with defaults
2. Migration 000019 attempts to copy from `server_settings` (empty or doesn't exist)
3. No data copied, defaults remain
4. Application starts with default configuration

### Scenario 2: Existing Installation (Has server_settings)
**Result**: User's custom configuration is preserved and migrated to new structure.

**Expected behavior:**
1. Migration 000005 creates `config` table with defaults
2. Migration 000019 copies custom settings from `server_settings` to `config`
   - Uses `INSERT OR IGNORE` to preserve any defaults from 000005
   - Custom settings override defaults
3. Migration 000006 safely drops `server_settings` (data already migrated)
4. Application starts with user's custom configuration

### Scenario 3: Partial Migration (config exists, server_settings exists)
**Result**: Existing config entries preserved, missing entries filled from server_settings.

**Expected behavior:**
1. Migration 000019 uses `INSERT OR IGNORE`
2. Existing config entries are NOT overwritten
3. Only missing keys are copied from server_settings
4. User's manual changes to config table are preserved

### Scenario 4: Rollback Required
**Steps:**
1. Stop application
2. Run migration down: `migrate -path migrations -database sqlite3://data/codexdns.db down 1`
3. Migration 000019 down deletes migrated entries
4. Migration 000006 down recreates `server_settings` table (if needed)
5. Restore from backup or manually re-enter configuration

## Application Code Changes

### Before Migration
```go
// internal/config/merge.go - OLD CODE
err := r.db.Table("server_settings").
    Select("settings, config_override").
    Where("category = ?", "web").
    First(&setting).Error
```

### After Migration
```go
// internal/config/merge.go - NEW CODE
var configs []storage.Config
err := r.db.Where("category = ?", category).Find(&configs).Error
```

### Files Updated
- `internal/config/merge.go`: Query `config` table instead of `server_settings`
- `internal/storage/seed.go`: Remove `ServerSetting{}` from AutoMigrate (after 000006 runs)

## Testing Checklist

### Pre-Migration Testing
- [ ] Create test database with server_settings data
- [ ] Verify all 4 categories have JSON settings (web, dns, tls, auto_tls)
- [ ] Run migrations 000001-000018
- [ ] Backup database before migration 000019

### Migration Testing
- [ ] Run migration 000019
- [ ] Verify config table has entries for all categories
- [ ] Verify custom settings preserved (compare with server_settings JSON)
- [ ] Verify default values used for missing fields
- [ ] Verify config_override flags preserved
- [ ] Verify no duplicate entries

### Post-Migration Testing
- [ ] Run migration 000006 (drop server_settings)
- [ ] Application starts successfully
- [ ] Web server uses migrated HTTP/HTTPS settings
- [ ] DNS server uses migrated UDP/TCP/DoT/DoH/DoQ settings
- [ ] TLS certificates load correctly
- [ ] Auto TLS works if enabled
- [ ] Settings page shows migrated values
- [ ] Can update settings via UI/API

### Rollback Testing
- [ ] Run migration down from 000019
- [ ] Verify config entries deleted
- [ ] Run migration down from 000006
- [ ] Verify server_settings table recreated
- [ ] Restore original data from backup

## Data Mapping Examples

### Example 1: HTTP Settings
**Before (server_settings JSON):**
```json
{
  "http_enabled": true,
  "http_port": 8080,
  "https_enabled": true,
  "https_port": 8443,
  "http_redirect_to_https": true
}
```

**After (config rows):**
```
| category | key                     | value | value_type | config_override |
|----------|-------------------------|-------|------------|-----------------|
| web      | http_enabled            | true  | bool       | 0               |
| web      | http_port               | 8080  | int        | 0               |
| web      | https_enabled           | true  | bool       | 0               |
| web      | https_port              | 8443  | int        | 0               |
| web      | http_redirect_to_https  | true  | bool       | 0               |
```

### Example 2: DNS-over-HTTPS Settings
**Before (server_settings JSON):**
```json
{
  "doh_enabled": true,
  "doh_address": "0.0.0.0",
  "doh_port": 443,
  "doh_path": "/dns-query",
  "doh_http3_enabled": false,
  "doh_cert_path": "/etc/codexdns/certs/doh.crt",
  "doh_key_path": "/etc/codexdns/certs/doh.key"
}
```

**After (config rows):**
```
| category | key              | value                       | value_type | config_override |
|----------|------------------|----------------------------|------------|-----------------|
| dns      | doh_enabled      | true                       | bool       | 0               |
| dns      | doh_address      | 0.0.0.0                    | string     | 0               |
| dns      | doh_port         | 443                        | int        | 0               |
| dns      | doh_path         | /dns-query                 | string     | 0               |
| dns      | doh_http3_enabled| false                      | bool       | 0               |
| dns      | doh_cert_path    | /etc/codexdns/certs/doh.crt| string     | 0               |
| dns      | doh_key_path     | /etc/codexdns/certs/doh.key| string     | 0               |
```

## Known Issues & Limitations

### Issue 1: Boolean Type Variations
SQLite JSON can store booleans as:
- JSON strings: `"true"` or `"false"`
- JSON booleans: `true` or `false`
- Integers: `0` or `1`

**Solution**: Migration uses CASE statements to normalize all variations to `"true"` or `"false"` strings.

### Issue 2: Missing Fields
If a field exists in the new schema but not in old server_settings JSON:
- Migration uses COALESCE with sensible defaults
- Example: `COALESCE(json_extract(settings, '$.doh_http3_enabled'), 'false')`

### Issue 3: Custom Fields
If users added custom fields to server_settings JSON that aren't in new schema:
- **These fields are NOT migrated**
- Only known fields with explicit migration logic are copied
- Custom fields remain in server_settings until table is dropped

### Issue 4: config_override Flag
The `config_override` boolean flag from server_settings is preserved per-category, but new config table has per-key granularity.

**Behavior:**
- If server_settings.config_override = true for "web" category
- All migrated web.* config entries get config_override = true
- More granular control available after migration

## Troubleshooting

### Problem: Migration fails with "no such table: server_settings"
**Cause**: Fresh install, no legacy data to migrate.  
**Solution**: This is expected. Migration completes successfully with no data copied.

### Problem: Migration fails with "UNIQUE constraint failed"
**Cause**: config table already has entries from previous migration attempt.  
**Solution**: Migration uses INSERT OR IGNORE, so this shouldn't happen. If it does, check for corrupted migration state.

### Problem: Settings lost after upgrade
**Cause**: Migration 000006 ran before 000019, dropping server_settings prematurely.  
**Solution**: Restore from backup and run migrations in correct order.

### Problem: Application queries wrong table after migration
**Cause**: Application code not updated to use new config table.  
**Solution**: Update to version 0.5.x or later with updated code.

## Maintenance

### Adding New Configuration Fields
When adding new fields to config table:

1. **Add migration**: Create new up/down migration files
2. **Add to model**: Update `Config` struct in `internal/storage/config.go`
3. **Add defaults**: Insert default value in migration
4. **Update UI**: Add field to settings page
5. **Update docs**: Document new field in README

### Removing server_settings References
After migration 000006 runs and server_settings is dropped:

- [ ] Remove `ServerSetting` model from `internal/storage/server_settings.go`
- [ ] Remove `&ServerSetting{}` from AutoMigrate in `internal/storage/seed.go`
- [ ] Remove any remaining server_settings queries in application code
- [ ] Update tests that referenced server_settings

## Summary

Migration 000019 provides a **safe, idempotent data migration** from the legacy server_settings table to the new config table structure. It:

✅ Preserves user's custom configuration  
✅ Provides sensible defaults for missing fields  
✅ Handles boolean type variations correctly  
✅ Can be run multiple times safely (INSERT OR IGNORE)  
✅ Enables clean transition before dropping legacy table

After this migration, CodexDNS can safely drop the server_settings table in migration 000006 without data loss.
