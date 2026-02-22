# ConfigParams Refactoring - Single Source of Truth

## Overview
Successfully eliminated duplicate parameter definitions by refactoring `internal/storage/config_params.go` to use `internal/config/parameters.go` as the single source of truth.

## Problem
The application had **two separate sources** for configuration parameter definitions:
1. `internal/config/parameters.go` - Used by migration generator
2. `internal/storage/config_params.go` - Hard-coded 320 lines, used by runtime app

This created maintenance burden and risk of inconsistencies.

## Solution
Refactored `config_params.go` to auto-generate the `ConfigParams` map from `config.AllParameters`:

### Before (320 lines of hard-coded data)
```go
var ConfigParams = map[string]ConfigParam{
    "web.http_enabled": {
        Category:     "web",
        Key:          "http_enabled",
        DefaultValue: "true",
        ValueType:    "bool",
        Description:  "Enable HTTP web server",
    },
    // ... 39 more parameters hard-coded ...
}
```

### After (30 lines of builder function)
```go
func buildConfigParamsMap() map[string]ConfigParam {
    params := make(map[string]ConfigParam)
    
    for _, p := range config.AllParameters {
        key := fmt.Sprintf("%s.%s", p.Category, p.Key)
        param := ConfigParam{
            Category:     p.Category,
            Key:          p.Key,
            DefaultValue: p.Default,
            ValueType:    p.ValueType,
            Description:  p.Description,
        }
        
        // Add validation functions for port parameters
        if p.Key == "http_port" || p.Key == "https_port" || 
           p.Key == "udp_port" || p.Key == "tcp_port" ||
           p.Key == "dot_port" || p.Key == "doh_port" || p.Key == "doq_port" {
            param.ValidationFunc = validatePortRange
        }
        
        params[key] = param
    }
    
    return params
}

var ConfigParams = buildConfigParamsMap()
```

## Changes Made

### File: `internal/storage/config_params.go`
- **Lines removed**: ~320 lines of hard-coded parameter definitions
- **Lines added**: 30-line `buildConfigParamsMap()` function
- **Import added**: `github.com/marcuoli/codexdns/internal/config`
- **Type preserved**: `ConfigParam` struct maintained for backward compatibility
- **Validation preserved**: Port validation functions still attached to port parameters
- **Net change**: **-290 lines** (94% reduction in code)

## Verification

### Compilation
```bash
✓ go build ./internal/storage
```

### Tests
```bash
✓ All existing tests pass (internal/service settings tests)
✓ 40 parameters successfully loaded into ConfigParams map
✓ ConfigManager.Get() returns correct defaults
✓ ConfigManager.GetDefaultParameters() returns 40 config entries
✓ Validation functions work (port range checks)
```

### Backward Compatibility
- ✅ ConfigParam struct unchanged
- ✅ ConfigParams map still accessible
- ✅ ConfigManager methods work identically
- ✅ All consumers (handlers, services) unaffected
- ✅ Existing tests pass without modification

## Benefits

### Code Maintenance
- **Single source of truth**: One place to add/modify/remove parameters
- **DRY principle**: No duplicate definitions
- **Auto-sync**: Migration generator and runtime always consistent
- **Less code**: 290 fewer lines to maintain

### Reliability
- **No drift**: Parameters can't get out of sync between systems
- **Type safety**: Same validation rules everywhere
- **Testability**: Single set of tests validates everything

### Future Work
- **Easy additions**: Add parameter to `parameters.go` → automatically available everywhere
- **Migration generation**: Run `go run tools/generate_migration.go` → migration created
- **Runtime access**: ConfigManager immediately has new parameter with defaults

## Architecture

```
                     ┌────────────────────────────────┐
                     │  internal/config/parameters.go  │
                     │  THE SINGLE SOURCE OF TRUTH     │
                     │  • 40 ConfigParameter entries   │
                     │  • Categories, Keys, Defaults   │
                     │  • Type information             │
                     └───────────┬────────────────────┘
                                 │
                  ┌──────────────┴───────────────┐
                  │                              │
                  ▼                              ▼
    ┌─────────────────────────┐    ┌─────────────────────────┐
    │  tools/generate_*.go    │    │  storage/config_params  │
    │  • Migration generator  │    │  • buildConfigParamsMap()│
    │  • Defaults generator   │    │  • ConfigManager        │
    │  • Creates SQL          │    │  • Runtime access       │
    └─────────────────────────┘    └─────────────────────────┘
                  │                              │
                  ▼                              ▼
    ┌─────────────────────────┐    ┌─────────────────────────┐
    │  migrations/000019.sql  │    │  HTTP Handlers          │
    │  • Data migration       │    │  • Settings UI          │
    │  • server_settings→cfg  │    │  • Runtime config       │
    └─────────────────────────┘    └─────────────────────────┘
```

## Next Steps

### Completed ✅
- [x] Create single source of truth (`parameters.go`)
- [x] Refactor `config_params.go` to use source of truth
- [x] Verify compilation and tests
- [x] Confirm backward compatibility

### Pending (Future PR)
- [ ] Create `SeedConfigParameters()` function in `seed.go`
- [ ] Call seeding function at startup in `main.go`
- [ ] Update migration 000005 with generated defaults
- [ ] Test fresh install scenario (empty config table)

## Commit Message Suggestion

```
refactor: unify config params to single source of truth

Eliminate duplicate configuration parameter definitions by refactoring
config_params.go to build ConfigParams map from config.AllParameters.

Before:
- 320 lines of hard-coded parameter definitions in config_params.go
- Separate definitions in parameters.go for migration generator
- Risk of inconsistencies between runtime and migrations

After:
- buildConfigParamsMap() generates map from config.AllParameters
- Single source of truth for all 40 configuration parameters
- 94% code reduction (-290 lines) in config_params.go
- Maintains full backward compatibility

All existing tests pass. ConfigManager behavior unchanged.
```

## Files Changed
- **Modified**: `internal/storage/config_params.go` (-290 lines)
- **Created**: `docs/config-params-refactoring.md` (this file)

## Testing Checklist
- [x] Storage package compiles
- [x] Existing tests pass (`go test ./internal/service`)
- [x] ConfigParams has 40 entries
- [x] Port validation works
- [x] ConfigManager.Get() returns defaults
- [x] ConfigManager.GetDefaultParameters() returns 40 configs
- [ ] Integration test with seeding (pending SeedConfigParameters creation)

## Performance Impact
**None** - Map is built once at package initialization, identical runtime behavior.

## Breaking Changes
**None** - Fully backward compatible API.
