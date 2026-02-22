# Configuration Architecture

## Overview

CodexDNS uses a **hybrid configuration** system that combines file-based bootstrap settings with database-stored runtime settings. This architecture provides flexibility, persistence, and the ability to modify settings dynamically via the Web UI.

## Configuration Sources

### 1. Bootstrap Configuration (config.json file)

**Purpose**: Core infrastructure settings needed to start the application

**Stored in**: `config.json` (default), or path specified with `-config` flag

**Contains**:
- Database connection settings (`db_driver`, `db_dsn`)
- Initial HTTP/HTTPS ports (`http_port`)
- DNS listen addresses (`dns_host`, `dns_port`)
- Log file paths and rotation settings
- Redis connection (`redis_addr`)
- Cache settings (`cache_backend`, `cache_enabled`, `cache_ttl`)
- Debug flags (`debug_dns`, `debug_resolver`, etc.)
- Upstream DNS servers (`upstream_servers`)
- Email SMTP settings
- DHCP integration settings

**When read**: 
- Application startup (via `config.Load()`)
- Configuration GET requests (reloaded on each request)

**Modified via**:
- System Configuration page in Web UI
- Direct file editing
- Deployment scripts

### 2. Runtime Configuration (Database)

**Purpose**: Settings that can be changed dynamically via UI without file access

**Stored in**: `config` table (key-value pairs with category grouping)

**Schema**:
```sql
CREATE TABLE config (
  id INTEGER PRIMARY KEY,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  category VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value TEXT,
  value_type VARCHAR(20) DEFAULT 'string',
  description TEXT,
  config_override BOOLEAN DEFAULT false,
  UNIQUE(category, key)
);
```

**Contains**:
- Web server settings (ports, TLS, HSTS, redirect settings)
- DNS protocol settings (UDP/TCP/DoT/DoH/DoQ ports and features)
- TLS certificate settings (enabled, source, paths)
- Auto TLS settings (Let's Encrypt configuration)
- DNS filter settings (rules limits, fetch/process timeouts)
- Feature flags and advanced options

**When read**:
- Application startup (merged with file config)
- Settings page load (via SettingsService)
- Runtime configuration changes (via ConfigService)

**Modified via**:
- Web UI Settings pages (Web, DNS, TLS, Auto TLS)
- Web UI System Configuration page (also saves to file)

## Priority Order (Highest to Lowest)

1. **Command-line flags** (e.g., `-config`, `-port`)
2. **Environment variables** (e.g., `CODEXDNS_HTTP_PORT`, `CODEXDNS_DB_DSN`)
3. **Configuration file** (`config.json`) - Bootstrap values
4. **Database settings** (`config` table) - Runtime modifiable
5. **Hard-coded defaults** (fallback if nothing else set)

**Important**: File settings (priority 3) override database settings (priority 4), allowing file-based deployment overrides.

## Save Behavior

### System Configuration Page (File + Database)

When saving via System Configuration page:

1. **File Save**: Configuration written to `config.json`
   - Persists bootstrap settings
   - Survives application restarts
   - Source of truth on startup

2. **Database Save**: Key configuration values stored in `config` table
   - Enables runtime access without file reads
   - Provides UI display values
   - Allows database-only deployments (if file is read-only)

**Implementation**: Uses `ConfigService.SaveConfig()` which:
```go
func (s *ConfigService) SaveConfig(cfg *config.Config, category string) error {
    // 1. Save to config.json file
    if err := cfg.Save(""); err != nil {
        return fmt.Errorf("failed to save config file: %w", err)
    }
    
    // 2. Save to database (best effort - file is source of truth)
    if err := s.saveConfigToDB(cfg, category); err != nil {
        log.Printf("Warning: Failed to save config to database: %v", err)
        // Don't fail - file save succeeded
    }
    
    return nil
}
```

### Settings Pages (Database Only)

When saving via Settings pages (Web, DNS, TLS, Auto TLS):

1. **Database Save**: Settings stored in `config` table
   - Runtime modifiable
   - Does NOT write to file
   - Application restart may override with file values

**Implementation**: Uses `SettingsService.UpdateWebSettings()` which calls `ConfigManager.UpdateAllWebSettings()`

**Note**: Settings pages manage **runtime-only** settings that don't need file persistence.

## Unified Configuration Service

### ConfigService (`internal/service/config_service.go`)

Central service for all System Configuration operations.

**Key Methods**:

```go
// GetConfig - Reload configuration from file
func (s *ConfigService) GetConfig() (*config.Config, error)

// SaveConfig - Save to both file and database
func (s *ConfigService) SaveConfig(cfg *config.Config, category string) error

// LoadConfigFromDB - Load specific category from database
func (s *ConfigService) LoadConfigFromDB(category string) (map[string]interface{}, error)
```

**Benefits**:
- Single point of truth for config operations
- Consistent save behavior (file + database)
- Simplified error handling
- Better logging and debugging

### Settings Architecture

Settings uses separate dedicated services:

- **SettingsService** (`internal/service/settings.go`) - High-level settings operations
- **ConfigManager** (`internal/storage/config_params.go`) - Type-safe parameter access
- **SettingsRepository** (`internal/storage/settings_repository.go`) - Database CRUD operations

**Flow**:
```
Settings UI → SettingsHandler → SettingsService → ConfigManager → SettingsRepository → Database
```

## Configuration Categories

### System Configuration (File + Database)

| Category | Config File Fields | Database Category |
|----------|-------------------|-------------------|
| Server | `http_port` | `server.http_port` |
| Database | `db_driver`, `db_dsn` | `database.driver`, `database.dsn` |
| Logging | `log_level`, `*_log_path` | `logging.*` |
| Cache | `redis_addr`, `cache_*` | `cache.*` |
| Upstream | `upstream_servers` | `upstream.servers` |
| Email | `smtp_*` | `email.*` |
| DHCP Integration | `dhcp_integration_*` | `dhcp.*` |
| Advanced | `enable_pprof`, `oui_*` | `advanced.*` |
| Filter Configuration | `*_rules_limit`, `filter_*_timeout` | `filter.*` |
| Configuration | `config_auto_merge`, `config_backup_enabled` | `config.*` |

## DNS Blocking Modes (Filter)

CodexDNS supports multiple DNS blocking behaviors similar to AdGuard Home. The response mode is configurable via the filter settings.

**Modes:**
- **NXDOMAIN** (`nxdomain`): Responds with `NXDOMAIN` (default).
- **REFUSED** (`refused`): Responds with `REFUSED`.
- **Null IP** (`null_ip`): Responds with `NOERROR` and `0.0.0.0` (A) or `::` (AAAA).
- **Custom IP** (`custom_ip`): Responds with `NOERROR` and the configured custom IP (A/AAAA).

**Notes:**
- `null_ip` and `custom_ip` only return A/AAAA answers; other query types fall back to `NXDOMAIN`.
- When using `custom_ip`, provide at least one valid `blocking_ipv4` or `blocking_ipv6` value.

**Example (Null IP):**
```json
{
    "filter_enabled": true,
    "blocking_mode": "null_ip",
    "blocking_ipv4": "0.0.0.0",
    "blocking_ipv6": "::"
}
```

**Example (Custom IP):**
```json
{
    "filter_enabled": true,
    "blocking_mode": "custom_ip",
    "blocking_ipv4": "192.0.2.1",
    "blocking_ipv6": "2001:db8::1"
}
```

**Security considerations:**
- `NXDOMAIN` provides minimal information but may reveal blocking by pattern analysis.
- `REFUSED` can signal explicit policy enforcement.
- `Null IP` / `Custom IP` can be used for sinkholing or redirecting to internal warning pages.

### Settings Pages (Database Only)

| Page | Database Category | Key Settings |
|------|------------------|--------------|
| Web | `web` | `http_enabled`, `http_port`, `https_enabled`, `https_port`, `force_https`, `hsts_enabled` |
| DNS | `dns` | `udp_enabled`, `udp_port`, `tcp_enabled`, `tcp_port`, `dot_enabled`, `doh_enabled` |
| TLS | `tls` | `enabled`, `cert_source`, `cert_path`, `key_path` |
| Auto TLS | `auto_tls` | `enabled`, `email`, `domains`, `staging` |

## Migration from Legacy System

### Old System (Before ConfigService)

```go
// Handlers directly called cfg.Save()
if err := h.config.Save(""); err != nil {
    // Only saved to file
}
```

**Problems**:
- No database persistence
- Configuration lost after restart if file read-only
- No single source of truth
- Inconsistent save behavior

### New System (With ConfigService)

```go
// Handlers use ConfigService
if err := h.configSvc.SaveConfig(h.config, "Server"); err != nil {
    // Saves to both file and database
}
```

**Benefits**:
- ✅ Dual persistence (file + database)
- ✅ Single point of configuration logic
- ✅ Consistent error handling
- ✅ Better logging and debugging
- ✅ Database fallback if file unavailable

## Code Organization

```
internal/
├── config/
│   ├── config.go              # Config struct and file operations
│   └── config_params.go       # Parameter definitions (single source of truth)
│
├── service/
│   ├── config_service.go      # NEW: Unified config service (file + database)
│   └── settings.go            # Settings service (database only)
│
├── storage/
│   ├── config.go              # Config model (database table)
│   ├── config_params.go       # ConfigManager (type-safe DB access)
│   └── settings_repository.go # Database CRUD operations
│
└── http/handlers/
    ├── config.go              # System Configuration page handler
    ├── config_api.go          # Config API endpoints (uses ConfigService)
    ├── config_*.go            # Category-specific processors
    └── settings.go            # Settings pages handlers (uses SettingsService)
```

## Usage Examples

### System Configuration Handler

```go
// Update Server configuration
func (h *ConfigHandlers) UpdateServerConfig() gin.HandlerFunc {
    return h.UpdateConfigSection("Server", ProcessServerConfig, "Server configuration updated successfully")
}

// UpdateConfigSection uses ConfigService internally
func (h *ConfigHandlers) UpdateConfigSection(...) gin.HandlerFunc {
    // ...process input...
    
    // Save via ConfigService (file + database)
    if err := h.configSvc.SaveConfig(h.config, sectionName); err != nil {
        return error
    }
    
    return success
}
```

### GET Configuration

```go
// GetConfigJSON reloads from file via ConfigService
func (h *ConfigHandlers) GetConfigJSON() gin.HandlerFunc {
    return func(c *gin.Context) {
        cfg, err := h.configSvc.GetConfig()
        c.JSON(http.StatusOK, cfg)
    }
}
```

### Settings Handler

```go
// UpdateWebSettings saves to database only
func (h *SettingsHandler) UpdateWebSettings(c *gin.Context) {
    // ...bind input...
    
    // Save via SettingsService (database only)
    if err := h.settingsSvc.UpdateWebSettings(&settings); err != nil {
        return error
    }
    
    return success
}
```

## Best Practices

### 1. Use ConfigService for System Configuration

✅ **Correct**:
```go
h.configSvc.SaveConfig(h.config, "Server")
```

❌ **Incorrect**:
```go
h.config.Save("") // Only saves to file, no database persistence
```

### 2. Settings Go Through SettingsService

✅ **Correct**:
```go
h.settingsSvc.UpdateWebSettings(settings)
```

❌ **Incorrect**:
```go
h.db.Save(settings) // No validation, no type safety
```

### 3. Always Reload on GET

✅ **Correct**:
```go
cfg, err := h.configSvc.GetConfig() // Reloads from file
```

❌ **Incorrect**:
```go
c.JSON(http.StatusOK, h.config) // Returns stale in-memory struct
```

### 4. Category Names Must Match

When calling `SaveConfig()`, use exact category names:

```go
// Correct category names
"Server"
"Database"
"Logging"
"Cache"
"Upstream"
"Email"
"DHCP Integration"
"Advanced"
"Filter Configuration"
"Configuration"
```

**Why**: ConfigService routes by category to save correct fields to database.

## Testing

### Unit Tests

```go
func TestConfigService_SaveConfig(t *testing.T) {
    db := setupTestDB(t)
    cfg := &config.Config{HTTPPort: "8080"}
    svc := service.NewConfigService(db, cfg)
    
    err := svc.SaveConfig(cfg, "Server")
    assert.NoError(t, err)
    
    // Verify file saved
    reloaded, err := config.Load(false)
    assert.Equal(t, "8080", reloaded.HTTPPort)
    
    // Verify database saved
    var dbConfig storage.Config
    db.Where("category = ? AND key = ?", "server", "http_port").First(&dbConfig)
    assert.Equal(t, "8080", dbConfig.Value)
}
```

### Integration Tests

```go
func TestSystemConfigurationPage_E2E(t *testing.T) {
    // 1. Load page
    // 2. Edit Server settings
    // 3. Save
    // 4. Reload page
    // 5. Verify changes persisted
    // 6. Restart application
    // 7. Reload page
    // 8. Verify changes still present
}
```

## Troubleshooting

### Configuration Not Persisting

**Symptom**: Changes saved but don't show after reload

**Cause**: GET endpoint returning stale in-memory config

**Fix**: Ensure `GetConfigJSON` reloads via `ConfigService.GetConfig()`

### Database Values Not Used

**Symptom**: Database has correct values but app uses file values

**Expected Behavior**: This is correct! File values override database (priority 3 > 4)

**Reason**: Allows deployment-time overrides via config file

### Settings vs Configuration Confusion

**Question**: When to use System Configuration vs Settings pages?

**Answer**:
- **System Configuration** → Bootstrap settings (file + database)
  - Requires application restart for most changes
  - Example: Database connection, log paths, Redis address
  
- **Settings** → Runtime settings (database only)
  - May take effect without restart (depends on setting)
  - Example: Web ports, TLS configuration, filter settings

## Future Enhancements

### Planned Features

1. **Live Configuration Reload**
   - Watch config file for changes
   - Reload without restart for safe settings
   - Emit events on configuration changes

2. **Configuration Validation**
   - Schema validation on save
   - Port conflict detection
   - Path accessibility checks

3. **Configuration Backup**
   - Automatic backup before save
   - Configuration version history
   - Rollback capability

4. **Configuration Export/Import**
   - Export to JSON/YAML
   - Import from external sources
   - Configuration templates

5. **Configuration Audit**
   - Track who changed what and when
   - Configuration change history
   - Diff view between versions

## References

- Source Code: `internal/service/config_service.go`
- Settings Service: `internal/service/settings.go`
- Database Models: `internal/storage/config.go`
- Config Manager: `internal/storage/config_params.go`
- First-Time Startup: `docs/first-time-startup.md`
- Runtime Configuration: `docs/runtime-configuration.md`
