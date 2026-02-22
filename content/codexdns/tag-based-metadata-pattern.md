# Tag-Based Metadata Pattern for CodexDNS Configuration

## Overview

The tag-based metadata pattern is a **single-source-of-truth** approach for defining configuration categories and fields in CodexDNS. Instead of manually duplicating field definitions across multiple files, you define all metadata using struct tags directly on the `Config` struct, and the system automatically generates the necessary metadata infrastructure via reflection.

### Benefits

✅ **Zero Duplication**: Field definitions live only in `config.go` struct tags  
✅ **Type Safety**: Compile-time checks for field names and types  
✅ **Consistency**: Automatic validation, defaults, and UI rendering  
✅ **Maintainability**: Add/modify fields in one place only  
✅ **Code Reduction**: ~76% less code compared to manual metadata files  
✅ **Runtime Registration**: Categories self-register via `init()` functions  

### Architecture

```
config.go (struct tags)
     │
     ├─── ui:"..." tags define all metadata
     │
     ▼
tag_parser.go (reflection)
     │
     ├─── ParseStructTags()
     ├─── BuildFieldMetadata()
     └─── BuildCategoryFromTags()
     │
     ▼
*_metadata.go files (auto-generation)
     │
     ├─── CategoryXYZ constant
     └─── init() → BuildCategoryFromTags()
     │
     ▼
registry.go (global registry)
     │
     └─── MustRegisterCategory()
     │
     ▼
Runtime: Handlers use GetCategory() / GetParameter()
```

---

## Quick Start: Adding a New Category

### Step 1: Add UI Tags to Config Struct

In `internal/config/config.go`, add comprehensive `ui` tags to your fields:

```go
type Config struct {
    // ... other fields

    // MyFeature configuration
    MyFeatureEnabled bool   `json:"my_feature_enabled" mapstructure:"my_feature_enabled" ui:"label=Enable My Feature,group=General,order=1,help=Turn this feature on or off,default=true"`
    MyFeatureTimeout int    `json:"my_feature_timeout" mapstructure:"my_feature_timeout" validate:"min=100,max=30000" ui:"label=Timeout (ms),group=Settings,order=2,help=Timeout in milliseconds,default=5000"`
    MyFeatureMode    string `json:"my_feature_mode" mapstructure:"my_feature_mode" validate:"required,oneof=auto manual" ui:"label=Mode,group=Settings,order=3,help=How to operate,type=select,options=auto|manual,default=auto"`
}
```

### Step 2: Create Metadata File

Create `internal/config/myfeature_metadata.go`:

```go
package config

const CategoryMyFeature = "myfeature"

func init() {
    cat, err := BuildCategoryFromTags(
        CategoryMyFeature,           // Internal category name
        "My Feature",                // Display name (shown in UI)
        "Configuration for my feature", // Description
        &Config{},                   // Pointer to config struct
        "MyFeature",                 // Field prefix (fields starting with this)
    )
    if err != nil {
        panic("Failed to build MyFeature category: " + err.Error())
    }
    MustRegisterCategory(cat)
}
```

### Step 3: Test

```bash
go test ./internal/config/... -v
```

That's it! Your category is now:
- ✅ Registered globally
- ✅ Available in UI settings pages
- ✅ Validated automatically
- ✅ Exportable/importable
- ✅ Documented via metadata

---

## UI Tag Reference

### Syntax

```
ui:"key1=value1,key2=value2,key3=value3"
```

**Important**: Values with commas must be quoted with double quotes:
```
ui:"help=This is a help text, with a comma,label=My Field"
```

### Available Attributes

| Attribute | Type | Required? | Description | Example |
|-----------|------|-----------|-------------|---------|
| `label` | string | ✅ **Yes** | Display label shown in UI | `label=Enable Feature` |
| `group` | string | ✅ **Yes** | Group name for organizing fields | `group=General` or `group=Security` |
| `order` | int | ✅ **Yes** | Display order within group (1-indexed) | `order=1` |
| `help` | string | Recommended | Help text shown in UI tooltips | `help=Turn this feature on or off` |
| `type` | string | Optional | HTML input type or special type | `type=text`, `type=password`, `type=select`, `type=textarea`, `type=email`, `type=url` |
| `default` | string | Recommended | Default value (as string, converted by type) | `default=true`, `default=5000`, `default=auto` |
| `placeholder` | string | Optional | Input placeholder text | `placeholder=example.com` |
| `sensitive` | bool | Optional | Mask value in logs/exports | `sensitive=true` |
| `rows` | int | Optional | Textarea rows (when type=textarea) | `rows=5` |
| `options` | string | Optional | Pipe-separated options for select | `options=option1\|option2\|option3` |

### Type Reference

#### Basic Types (Inferred from Go Type)
- `bool` → Checkbox
- `int` → Number input
- `string` → Text input

#### Special Types (via `type=...` tag)
- `type=select` → Dropdown (requires `options=...`)
- `type=textarea` → Multi-line text (optional `rows=...`)
- `type=password` → Password input (auto-masks, consider `sensitive=true`)
- `type=email` → Email input with validation
- `type=url` → URL input with validation

---

## Field Prefix Patterns

### Standard Pattern (Single Prefix)

Most categories have a single prefix that all fields share:

```go
// All fields start with "Cache"
CacheBackend       string `json:"cache_backend" ui:"label=Backend,group=General,order=1,..."`
CacheTTL           int    `json:"cache_ttl" ui:"label=TTL,group=Settings,order=2,..."`
CacheMaxSize       int    `json:"cache_max_size" ui:"label=Max Size,group=Settings,order=3,..."`

// Metadata file:
BuildCategoryFromTags(CategoryCache, "Cache", "Cache configuration", &Config{}, "Cache")
```

### Multiple Prefix Pattern (Advanced)

Some categories have fields with different prefixes but logically belong together. Use the **merge pattern**:

```go
// Logging category has both "Log" and "Debug" prefixes
LogLevel           string `json:"log_level" ui:"label=Log Level,group=General,order=1,..."`
LogMaxSizeMB       int    `json:"log_max_size_mb" ui:"label=Max Size (MB),group=Rotation,order=2,..."`
DebugDNS           bool   `json:"debug_dns" ui:"label=DNS Server,group=Debug Flags,order=10,..."`
DebugResolver      bool   `json:"debug_resolver" ui:"label=DNS Resolver,group=Debug Flags,order=11,..."`
```

Metadata file merges both:

```go
func init() {
    // Get fields with "Log" prefix
    catLog, err := BuildCategoryFromTags(CategoryLogging, "Logging", "...", &Config{}, "Log")
    if err != nil {
        panic("Failed to build Logging (Log prefix): " + err.Error())
    }

    // Get fields with "Debug" prefix
    catDebug, err := BuildCategoryFromTags(CategoryLogging, "Logging", "...", &Config{}, "Debug")
    if err != nil {
        panic("Failed to build Logging (Debug prefix): " + err.Error())
    }

    // Merge Debug fields into Log category
    for fieldName, field := range catDebug.Fields {
        catLog.Fields[fieldName] = field
        catLog.FieldOrder = append(catLog.FieldOrder, fieldName)
    }

    MustRegisterCategory(catLog)
}
```

### No Prefix (Rare)

If your fields don't share a prefix, you can use empty string `""` to match all fields, but this is **not recommended** because it will include unrelated fields.

---

## Complete Example: Creating a "Backup" Category

### 1. Add Fields to config.go

```go
type Config struct {
    // ... existing fields ...

    // Backup configuration
    BackupEnabled       bool   `json:"backup_enabled" mapstructure:"backup_enabled" ui:"label=Enable Backups,group=General,order=1,help=Enable automatic database backups,default=true"`
    BackupInterval      int    `json:"backup_interval" mapstructure:"backup_interval" validate:"min=1,max=24" ui:"label=Interval (hours),group=Schedule,order=2,help=Backup interval in hours,default=24"`
    BackupPath          string `json:"backup_path" mapstructure:"backup_path" ui:"label=Backup Path,group=Storage,order=3,help=Directory path for backup files,placeholder=/var/backups/codexdns"`
    BackupMaxFiles      int    `json:"backup_max_files" mapstructure:"backup_max_files" validate:"min=1,max=100" ui:"label=Max Files,group=Storage,order=4,help=Maximum backup files to keep,default=7"`
    BackupCompression   string `json:"backup_compression" mapstructure:"backup_compression" validate:"oneof=none gzip zstd" ui:"label=Compression,group=Storage,order=5,help=Backup compression algorithm,type=select,options=none|gzip|zstd,default=gzip"`
    BackupNotifyEmail   string `json:"backup_notify_email" mapstructure:"backup_notify_email" validate:"omitempty,email" ui:"label=Notification Email,group=Notifications,order=6,help=Email to notify on backup completion,type=email,placeholder=admin@example.com"`
    BackupNotifyOnError bool   `json:"backup_notify_on_error" mapstructure:"backup_notify_on_error" ui:"label=Notify on Error,group=Notifications,order=7,help=Send email notifications only on errors,default=false"`
}
```

### 2. Create backup_metadata.go

```go
package config

const CategoryBackup = "backup"

func init() {
    cat, err := BuildCategoryFromTags(
        CategoryBackup,
        "Database Backups",
        "Automatic database backup configuration and scheduling",
        &Config{},
        "Backup", // All fields start with "Backup"
    )
    if err != nil {
        panic("Failed to build Backup category: " + err.Error())
    }
    MustRegisterCategory(cat)
}
```

### 3. Test

```bash
go test ./internal/config/... -v
```

Expected output:
```
2025/12/22 18:01:55 [INFO] [Config] Registered Database Backups metadata with 7 fields
```

### 4. Use in Code

```go
// In handlers or services:
backupCat, err := config.GetCategory("backup")
if err != nil {
    return err
}

// Get specific field metadata
intervalField, err := backupCat.GetField("BackupInterval")
if err != nil {
    return err
}

fmt.Println("Label:", intervalField.UILabel)        // "Interval (hours)"
fmt.Println("Help:", intervalField.UIHelpText)      // "Backup interval in hours"
fmt.Println("Default:", intervalField.DefaultInt)   // 24
```

---

## Grouping Best Practices

### Common Group Names

Use consistent group names across categories:

| Group Name | Purpose | Example Fields |
|------------|---------|----------------|
| `General` | Core enable/disable and basic settings | `BackupEnabled`, `CacheEnabled` |
| `Settings` / `Configuration` | Main operational settings | `BackupInterval`, `CacheTTL` |
| `Storage` | File paths, directories, size limits | `BackupPath`, `BackupMaxFiles` |
| `Security` | Authentication, encryption, keys | `DHCPIntKeySecret`, `SMTPPassword` |
| `Network` / `Servers` | Addresses, ports, network settings | `UpstreamServers`, `SMTPHost` |
| `Performance` | Timeouts, workers, caching | `UpstreamTimeout`, `CacheMaxSize` |
| `Schedule` / `Timing` | Intervals, timeouts, scheduling | `BackupInterval`, `FilterUpdateIntervalHours` |
| `Notifications` | Email, alerts, webhooks | `BackupNotifyEmail`, `SMTPFrom` |
| `Debug Flags` | Subsystem debug logging | `DebugDNS`, `DebugResolver` |
| `Rotation` | Log rotation settings | `LogMaxSizeMB`, `LogMaxBackups` |
| `Maintenance` | Cleanup, purging, housekeeping | `DHCPIntCleanupStale` |

### Order Guidelines

Within each group, order fields logically:

1. **Enable flag** (if present) should be `order=1`
2. **Primary settings** next (`order=2-5`)
3. **Advanced/optional settings** later (`order=6-10+`)
4. **Debug/logging flags** last (`order=10+`)

Example:
```go
// General group
BackupEnabled       ui:"...,group=General,order=1,..."
BackupInterval      ui:"...,group=Schedule,order=2,..."
BackupPath          ui:"...,group=Storage,order=3,..."
BackupMaxFiles      ui:"...,group=Storage,order=4,..."
BackupCompression   ui:"...,group=Storage,order=5,..."
BackupNotifyEmail   ui:"...,group=Notifications,order=6,..."
BackupNotifyOnError ui:"...,group=Notifications,order=7,..."
```

---

## Validation Integration

The `validate` struct tag works seamlessly with `ui` tags:

```go
BackupInterval int `json:"backup_interval" 
    mapstructure:"backup_interval" 
    validate:"min=1,max=24"  // Validator rules
    ui:"label=Interval (hours),group=Schedule,order=2,help=Backup interval (1-24 hours),default=24"`
```

Supported validate tags:
- `required` - Field must be present
- `omitempty` - Validation runs only if value is set
- `min=N`, `max=N` - Numeric range (int)
- `oneof=a b c` - Must be one of the values
- `email` - Valid email format
- `url` - Valid URL format
- `ip` - Valid IP address
- `fqdn` - Fully qualified domain name

---

## All 10 Current Categories

As of Session 63, CodexDNS has **10 categories** with **64 total fields**:

| # | Category | Display Name | Fields | Prefix(es) | Metadata File |
|---|----------|--------------|--------|------------|---------------|
| 1 | `cache` | Cache Configuration | 7 | `Cache` | cache_metadata.go |
| 2 | `dhcp_integration` | DHCP Integration | 14 | `DHCPInt` | dhcp_integration_metadata.go |
| 3 | `discovery` | Client Discovery | 4 | `Discovery` | discovery_metadata.go |
| 4 | `email` | Email/SMTP Configuration | 8 | `SMTP` | email_metadata.go |
| 5 | `filter` | DNS Filtering | 6 | `Filter` | filter_metadata.go |
| 6 | `logging` | Logging & Debug | 13 | `Log`, `Debug` | logging_metadata.go |
| 7 | `oui` | OUI Database | 4 | `OUI` | oui_metadata.go |
| 8 | `twofa` | Two-Factor Authentication | 1 | `TwoFA` | twofa_metadata.go |
| 9 | `upstream` | Upstream DNS Servers | 4 | `Upstream` | upstream_metadata.go |
| 10 | `webauthn` | WebAuthn / Passkeys | 3 | `WebAuthn` | webauthn_metadata.go |

**Total**: 64 fields, ~250 lines of metadata code (vs ~1038 manual approach = **76% reduction**)

---

## Troubleshooting

### Problem: Fields not appearing in category

**Cause**: Field name doesn't match prefix

**Solution**: Check that field names start with the exact prefix (case-sensitive):
```go
// ❌ WRONG - doesn't start with "Backup"
AutoBackupEnabled bool `ui:"..."`

// ✅ CORRECT
BackupEnabled bool `ui:"..."`
```

### Problem: "no fields found with prefix X"

**Cause**: No fields in `Config` struct match the prefix, or all matching fields lack `ui` tags

**Solution**: 
1. Verify at least one field has both prefix and `ui` tag
2. Check spelling of prefix in metadata file
3. Ensure `json` tag is present (fields without `json` are skipped)

### Problem: Compilation error "undefined: CategoryXYZ"

**Cause**: Typo in category constant name

**Solution**: Ensure constant name matches usage:
```go
const CategoryBackup = "backup" // ← Must match in GetCategory("backup")
```

### Problem: Tests pass but category doesn't appear in UI

**Cause**: Category constant not used in route handlers

**Solution**: Add category to handler:
```go
// In internal/http/handlers/config.go
func (h *ConfigHandler) GetCategories(c *gin.Context) {
    cats := []string{
        config.CategoryCache,
        config.CategoryDHCPIntegration,
        config.CategoryBackup, // ← Add new category here
        // ...
    }
    // ...
}
```

### Problem: Values not saving correctly

**Cause**: Mismatch between JSON key in struct tag and what UI sends

**Solution**: Ensure `json:"..."` tag matches expected API field name:
```go
BackupEnabled bool `json:"backup_enabled"` // ← Must match {"backup_enabled": true}
```

---

## Performance Considerations

### Reflection Overhead

- Reflection happens **once per category** during `init()` (startup time)
- After registration, all lookups are **map-based** (O(1))
- **No runtime reflection overhead** for request processing

### Memory Usage

- Each category: ~1-2 KB (fields + metadata)
- 10 categories: ~10-20 KB total
- **Negligible** compared to other app components

### Compilation Time

- Tag parsing adds **<100ms** to compilation time
- **No impact** on hot reload (air) after first build

---

## Migration Guide (Manual → Tag-Based)

### Before (Manual Metadata)

```go
// OLD: manual_metadata.go (54 lines)
func init() {
    cat := config.NewCategoryMetadata("backup", "Backups", "Backup configuration")
    
    cat.AddField(&config.FieldMetadata{
        Name:          "BackupEnabled",
        JSONKey:       "backup_enabled",
        Type:          config.FieldTypeBool,
        DefaultBool:   true,
        UILabel:       "Enable Backups",
        UIGroupName:   "General",
        UIOrder:       1,
        UIHelpText:    "Enable automatic database backups",
    })
    
    cat.AddField(&config.FieldMetadata{
        Name:          "BackupInterval",
        JSONKey:       "backup_interval",
        Type:          config.FieldTypeInt,
        DefaultInt:    24,
        MinValue:      intPtr(1),
        MaxValue:      intPtr(24),
        UILabel:       "Interval (hours)",
        UIGroupName:   "Schedule",
        UIOrder:       2,
        UIHelpText:    "Backup interval in hours",
    })
    
    // ... 5 more fields, 40+ more lines
    
    config.MustRegisterCategory(cat)
}
```

### After (Tag-Based)

```go
// NEW: config.go (struct tags only)
BackupEnabled   bool `json:"backup_enabled" ui:"label=Enable Backups,group=General,order=1,help=Enable automatic database backups,default=true"`
BackupInterval  int  `json:"backup_interval" validate:"min=1,max=24" ui:"label=Interval (hours),group=Schedule,order=2,help=Backup interval in hours,default=24"`

// NEW: backup_metadata.go (21 lines)
package config

const CategoryBackup = "backup"

func init() {
    cat, err := BuildCategoryFromTags(CategoryBackup, "Backups", "Backup configuration", &Config{}, "Backup")
    if err != nil {
        panic("Failed to build Backup category: " + err.Error())
    }
    MustRegisterCategory(cat)
}
```

**Result**: 54 lines → 21 lines (**61% reduction**)

---

## Future Enhancements

Potential improvements to the tag-based system:

1. **Conditional Fields**: Show/hide fields based on other values
   ```go
   ui:"...,visible_if=BackupEnabled==true"
   ```

2. **Dynamic Defaults**: Compute defaults from other fields
   ```go
   ui:"...,default_func=computeBackupPath"
   ```

3. **Field Dependencies**: Validate based on other fields
   ```go
   ui:"...,required_if=BackupEnabled==true"
   ```

4. **Custom Validators**: Hook into validation functions
   ```go
   ui:"...,validate_func=isValidBackupPath"
   ```

5. **UI Layouts**: Control field width/positioning
   ```go
   ui:"...,width=half,position=left"
   ```

---

## Summary

### Single-Source-of-Truth Checklist

When adding a new configuration category:

1. ✅ Add fields to `Config` struct with comprehensive `ui` tags
2. ✅ Create `<category>_metadata.go` with 21-line template
3. ✅ Run tests to verify registration
4. ✅ (Optional) Add category to UI route handlers

### Tag-Based Pattern Benefits

- ✅ **76% less code** on average
- ✅ **Zero duplication** - metadata lives in struct tags only
- ✅ **Type safety** - compile-time checks
- ✅ **Automatic validation** - from `validate` tags
- ✅ **Consistent UI rendering** - from `ui` tags
- ✅ **Self-documenting** - help text in tags
- ✅ **Runtime registration** - via `init()` functions

### When NOT to Use This Pattern

- ⚠️ If you need **runtime-computed metadata** (very rare)
- ⚠️ If you need **complex inter-field dependencies** (future enhancement)
- ⚠️ If you have **fields without struct representation** (use manual metadata)

For 99% of configuration categories, the tag-based pattern is the recommended approach.
