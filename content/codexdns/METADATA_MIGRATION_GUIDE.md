# Configuration Metadata System Migration Guide

**Status**: AllParameters deprecated as of December 2025 (v0.1.20251222.x)  
**Removal**: Planned for v0.2.x (approximately 2-3 releases)

## Overview

CodexDNS has migrated from a hardcoded `AllParameters` array to a metadata-driven configuration system. The new system provides:

- **Type Safety**: Structured types instead of string-based types
- **Rich Metadata**: Validation rules, UI hints, grouping, ordering
- **Automatic Registration**: Generated from Config struct tags
- **Single Source of Truth**: Config struct drives everything
- **No Duplication**: Eliminates parallel maintenance

## Migration Status

### ✅ Systems Already Migrated

1. **Storage Layer** (`internal/storage/config_params.go`)
   - Now uses `buildConfigParamsFromMetadata()`
   - ConfigParams built from metadata system
   - 153 parameters across 15 categories

2. **Code Generators** (`tools/`)
   - `generate_migration.go` - Uses `GetAllCategories()`
   - `generate_defaults.go` - Uses `GetAllCategories()`
   - Generates for all 153 parameters

3. **HTTP Handlers** (`internal/http/handlers/`)
   - All settings pages use metadata via `GetCategory()`
   - Form generation from metadata
   - Type-safe field access

4. **UI Templates** (`web/templates/`)
   - Dynamic form generation from metadata
   - Automatic field type detection
   - Validation from metadata rules

### 📦 Legacy Code (Deprecated)

The following still reference `AllParameters` for backward compatibility:

- `internal/config/parameters.go` - Deprecated with migration notices
- `internal/config/parameters_test.go` - Tests backward compatibility
- Any external tools not yet updated

## Migration Examples

### 1. Iterating All Parameters

**OLD (Deprecated)**:
```go
for _, param := range config.AllParameters {
    fmt.Printf("Category: %s, Key: %s, Type: %s\n", 
        param.Category, param.Key, param.ValueType)
}
```

**NEW (Recommended)**:
```go
for _, category := range config.GetAllCategories() {
    for _, field := range category.Fields {
        fmt.Printf("Category: %s, Key: %s, Type: %s\n", 
            category.Name, field.JSONKey, field.Type)
    }
}
```

### 2. Getting Parameters by Category

**OLD (Deprecated)**:
```go
params := config.GetParametersByCategory("web")
for _, param := range params {
    fmt.Printf("Key: %s, Default: %s\n", param.Key, param.Default)
}
```

**NEW (Recommended)**:
```go
category, err := config.GetCategory("web")
if err != nil {
    log.Fatalf("Category not found: %v", err)
}

for _, field := range category.Fields {
    var defaultValue string
    switch field.Type {
    case "bool":
        defaultValue = fmt.Sprintf("%t", field.DefaultBool)
    case "int":
        defaultValue = fmt.Sprintf("%d", field.DefaultInt)
    case "string":
        defaultValue = field.DefaultString
    }
    fmt.Printf("Key: %s, Default: %s\n", field.JSONKey, defaultValue)
}
```

### 3. Getting a Specific Parameter

**OLD (Deprecated)**:
```go
param := config.GetParameter("web", "http_port")
if param != nil {
    fmt.Printf("Default: %s, Type: %s\n", param.Default, param.ValueType)
}
```

**NEW (Recommended)**:
```go
category, err := config.GetCategory("web")
if err != nil {
    log.Fatalf("Category not found: %v", err)
}

field, err := category.GetField("HTTPPort") // Note: struct field name, not JSON key
if err != nil {
    log.Fatalf("Field not found: %v", err)
}

fmt.Printf("Default: %d, Type: %s\n", field.DefaultInt, field.Type)
fmt.Printf("JSON Key: %s\n", field.JSONKey) // Access JSON key if needed
```

### 4. Validation

**OLD (Deprecated)**:
```go
if config.ValidateParameter("web", "http_port") {
    fmt.Println("Parameter exists")
}
```

**NEW (Recommended)**:
```go
category, err := config.GetCategory("web")
if err == nil {
    _, err := category.GetField("HTTPPort")
    if err == nil {
        fmt.Println("Parameter exists")
    }
}
```

### 5. Getting Default Value

**OLD (Deprecated)**:
```go
defaultValue := config.GetDefaultValue("web", "http_port")
fmt.Printf("Default: %s\n", defaultValue)
```

**NEW (Recommended)**:
```go
category, _ := config.GetCategory("web")
field, _ := category.GetField("HTTPPort")

// Type-specific default (better type safety)
fmt.Printf("Default: %d\n", field.DefaultInt)

// Or as string if needed
defaultValue := fmt.Sprintf("%d", field.DefaultInt)
fmt.Printf("Default: %s\n", defaultValue)
```

## Key Differences

### Struct Field Names vs JSON Keys

The metadata system uses **struct field names** (e.g., `HTTPPort`) while the old system used **JSON keys** (e.g., `http_port`).

```go
// OLD: JSON key based
param := config.GetParameter("web", "http_port")

// NEW: Struct field name based
category, _ := config.GetCategory("web")
field, _ := category.GetField("HTTPPort")

// Access JSON key from field if needed
jsonKey := field.JSONKey // "http_port"
```

### Type-Specific Defaults

The old system used string-only defaults. The new system has type-specific defaults:

```go
// OLD: String only
param := config.GetParameter("web", "http_port")
portStr := param.Default // "8080"
port, _ := strconv.Atoi(portStr)

// NEW: Type-specific
category, _ := config.GetCategory("web")
field, _ := category.GetField("HTTPPort")
port := field.DefaultInt // 8080 (already an int)
```

### Richer Metadata

The new system provides additional metadata not available in AllParameters:

```go
field, _ := category.GetField("HTTPPort")

// UI Information
fmt.Println(field.UILabel)       // "HTTP Port"
fmt.Println(field.UIHelpText)    // "Port number for HTTP server"
fmt.Println(field.UIPlaceholder) // "8080"
fmt.Println(field.UIGroupName)   // "Server"
fmt.Println(field.UIOrder)       // 2

// Validation
fmt.Println(field.Required)      // true/false
fmt.Println(field.MinValue)      // *int (e.g., 1)
fmt.Println(field.MaxValue)      // *int (e.g., 65535)

// Security
fmt.Println(field.UISensitive)   // true for passwords/secrets
```

## Creating New Config Parameters

### OLD Approach (Deprecated)

1. Add field to Config struct
2. Add entry to AllParameters array (duplication!)
3. Update mergeDefaults()
4. Hope they stay in sync

### NEW Approach (Recommended)

**Just add the field to Config struct with proper tags**:

```go
type Config struct {
    // ... existing fields ...

    MyNewField string `json:"my_new_field" ui:"key:my_new_field,label:My New Field,type:string,group:General,order:10,default:defaultValue,help:Help text here"`
}
```

Then update `mergeDefaults()`:

```go
func (c *Config) mergeDefaults() {
    // ... existing defaults ...
    
    if c.MyNewField == "" {
        c.MyNewField = "defaultValue"
    }
}
```

**That's it!** Metadata is automatically generated from the tags via `BuildCategoryFromTags()`.

## Testing Migration

### Verify Metadata Coverage

Run the metadata coverage test to ensure all parameters are in metadata:

```bash
go test ./internal/config -run TestMetadataCoverageComplete -v
```

Should output:
```
✓ All 40 parameters have corresponding metadata fields!
✓ Migration from AllParameters to metadata is COMPLETE
```

### Test Backward Compatibility

Ensure legacy code still works during transition:

```bash
go test ./internal/config -run TestAllParameters -v
go test ./internal/storage -run TestConfigParams -v
```

## Removal Timeline

| Version | Date | Action |
|---------|------|--------|
| v0.1.20251222.x | Dec 2025 | **Deprecation Notice** - All systems migrated, AllParameters marked deprecated |
| v0.2.x | ~Feb 2026 | **Planned Removal** - Delete parameters.go, update all references |

## Benefits Summary

### Before (AllParameters)
- ❌ 40 parameters only (hardcoded subset)
- ❌ String-based types ("bool", "int", "string")
- ❌ Manual duplication with Config struct
- ❌ No validation rules
- ❌ No UI hints
- ❌ Maintenance burden

### After (Metadata System)
- ✅ 153 parameters (all config fields)
- ✅ Type-safe enums (FieldType)
- ✅ Single source of truth (struct tags)
- ✅ Rich validation rules
- ✅ Complete UI metadata
- ✅ Automatic registration

## Support

For questions or migration assistance:
1. Review examples in `internal/config/*_metadata.go`
2. Check metadata types in `internal/config/metadata.go`
3. See test examples in `internal/config/metadata_coverage_test.go`
4. Check this migration guide: `docs/METADATA_MIGRATION_GUIDE.md`

## References

- **Metadata Types**: `internal/config/metadata.go`
- **Category Examples**: `internal/config/{web,dns,tls,auto_tls}_metadata.go`
- **Coverage Tests**: `internal/config/metadata_coverage_test.go`
- **Storage Migration**: `internal/storage/config_params.go`
- **Generator Migration**: `tools/generate_{migration,defaults}.go`
- **Deprecated Code**: `internal/config/parameters.go`
