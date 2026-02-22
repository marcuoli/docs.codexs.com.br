# Configuration Architecture Refactoring Plan

## Problem Statement

Currently, `config.Config` mixes concerns:
1. **Data structure** (struct definition)
2. **File I/O** (reading/writing JSON)
3. **Orchestration** (Load with auto-merge, backup, Docker templates)
4. **Business logic** (default merging, validation)
5. **Environment variables** (applying overrides)

This violates separation of concerns and makes testing difficult.

## Proposed Architecture

### Layer 1: Config Struct (Data + Pure I/O)

**Location**: `internal/config/config.go`

**Responsibilities**:
- Config struct definition
- Pure file I/O: `loadFromJSON()`, `Save()` 
- Environment variable application: `applyEnvironmentOverrides()`
- Simple utility methods: `HTTPAddress()`, `DNSAddress()`
- Helper functions: `getenv()`, `fileExists()`, `getTimestamp()`

**What to REMOVE**:
- ❌ `Load()` orchestration → Move to ConfigService
- ❌ `mergeDefaults()` business logic → Move to ConfigService
- ❌ `SaveWithBackup()` orchestration → Move to ConfigService
- ❌ `Validate()` business rules → Move to ConfigService

### Layer 2: ConfigService (Business Logic + Orchestration)

**Location**: `internal/service/config_service.go`

**Responsibilities**:
- **Load orchestration**: File → Docker template → Defaults → Env vars → Database
- **Save orchestration**: Validation → File → Database → Backup
- **Business logic**: Default merging, validation rules
- **Priority management**: Env > File > Database > Defaults
- **Database integration**: Save to/load from config table

**Methods to ADD**:
```go
// Loading
func (s *ConfigService) Load(autoMerge bool) (*config.Config, error)
func (s *ConfigService) LoadWithDefaults() (*config.Config, error)
func (s *ConfigService) MergeDefaults(cfg *config.Config) bool

// Saving
func (s *ConfigService) SaveWithBackup(cfg *config.Config, category string) error
func (s *ConfigService) Save(cfg *config.Config, category string) error // Already exists as SaveConfig

// Validation
func (s *ConfigService) Validate(cfg *config.Config) []string
func (s *ConfigService) ValidateAndSave(cfg *config.Config, category string) error

// Defaults
func (s *ConfigService) GetDefaults() *config.Config
```

## Migration Strategy

### Phase 1: Add Methods to ConfigService (Non-Breaking)

1. Add `Load()` to ConfigService that calls current `config.Load()`
2. Add `MergeDefaults()` to ConfigService that calls `config.mergeDefaults()`
3. Add `SaveWithBackup()` to ConfigService
4. Add `Validate()` to ConfigService

### Phase 2: Update Callers

1. Update all `config.Load()` calls to `configSvc.Load()`
2. Update all `config.SaveWithBackup()` calls to `configSvc.SaveWithBackup()`
3. Add validation before saves

### Phase 3: Deprecate Old Methods (Breaking Change)

1. Mark `config.Load()` as deprecated
2. Mark `config.mergeDefaults()` as deprecated (make it private)
3. Mark `config.SaveWithBackup()` as deprecated

### Phase 4: Remove Deprecated Methods

1. Remove public `Load()` from config package
2. Keep private `loadFromJSON()` helper
3. Keep `Save()` for pure file writes

## Call Flow Examples

### Before (Current - Mixed Concerns)

```go
// main.go
cfg, err := config.Load(true) // Orchestration in config package ❌

// Handler
if err := cfg.Save(""); err != nil { // Only file, no database ❌
    return err
}
```

### After (Refactored - Clean Separation)

```go
// main.go
configSvc := service.NewConfigService(db, nil)
cfg, err := configSvc.Load(true) // Orchestration in service ✅

// Handler
if err := h.configSvc.SaveConfig(cfg, "Server"); err != nil { // File + DB ✅
    return err
}
```

## Detailed Method Responsibilities

### config.Config Methods (After Refactoring)

```go
// Pure data structure
type Config struct { /* fields */ }

// Pure file I/O
func loadFromJSON(path string, cfg *Config) error // Private helper
func (c *Config) Save(path string) error          // Public, pure file write

// Environment variables
func (c *Config) applyEnvironmentOverrides()      // Apply env vars to struct

// Utility methods
func (c *Config) HTTPAddress() string
func (c *Config) DNSAddress() string

// Helper functions
func getenv(key, def string) string
func fileExists(path string) bool
func getTimestamp() string
```

### ConfigService Methods (After Refactoring)

```go
// Loading orchestration
func (s *ConfigService) Load(autoMerge bool) (*config.Config, error) {
    // 1. Load from file (or Docker template)
    // 2. Merge defaults if autoMerge
    // 3. Apply environment overrides
    // 4. Merge database overrides (lower priority than env)
    // 5. Return complete config
}

// Saving orchestration
func (s *ConfigService) SaveConfig(cfg *config.Config, category string) error {
    // 1. Validate configuration
    // 2. Save to file
    // 3. Save to database
    // 4. Log results
}

func (s *ConfigService) SaveWithBackup(cfg *config.Config, category string) error {
    // 1. Create backup of existing file
    // 2. Call SaveConfig
}

// Business logic
func (s *ConfigService) MergeDefaults(cfg *config.Config) bool {
    // Apply all default values for missing fields
    // Return true if any fields were added
}

func (s *ConfigService) Validate(cfg *config.Config) []string {
    // Return list of validation warnings/errors
}

// Database operations (already implemented)
func (s *ConfigService) GetConfig() (*config.Config, error)
func (s *ConfigService) LoadConfigFromDB(category string) (map[string]interface{}, error)
func (s *ConfigService) saveConfigToDB(cfg *config.Config, category string) error
```

## Benefits

### 1. Separation of Concerns
- **Config**: Pure data + file I/O
- **ConfigService**: Business logic + orchestration

### 2. Testability
```go
// Test file I/O without business logic
func TestConfig_Save(t *testing.T) {
    cfg := &config.Config{HTTPPort: "8080"}
    err := cfg.Save("/tmp/test.json")
    // Simple file I/O test
}

// Test business logic without file system
func TestConfigService_MergeDefaults(t *testing.T) {
    cfg := &config.Config{}
    svc := service.NewConfigService(mockDB, cfg)
    changed := svc.MergeDefaults(cfg)
    // Business logic test
}
```

### 3. Single Responsibility
- Config struct doesn't care about Docker templates
- Config struct doesn't care about auto-merging
- File I/O is separate from business decisions

### 4. Dependency Injection
```go
// ConfigService knows about database
type ConfigService struct {
    db *gorm.DB      // ✅ Service layer can have DB dependency
}

// Config struct is pure
type Config struct {
    // ❌ No DB dependency
    // ❌ No file system coupling in business logic
}
```

### 5. Easier to Extend
Want to add YAML support? Change `loadFromJSON()` only.
Want to add Consul/etcd? Add to ConfigService.Load() orchestration.
Want to add config validation? Add to ConfigService.Validate().

## Implementation Checklist

### Phase 1: Add to ConfigService (This PR)
- [ ] Add `Load(autoMerge bool)` method
- [ ] Add `MergeDefaults(cfg)` method  
- [ ] Add `SaveWithBackup(cfg, category)` method
- [ ] Add `Validate(cfg)` method
- [ ] Update `GetConfig()` to use new `Load()`
- [ ] Add comprehensive tests

### Phase 2: Update Callers (Next PR)
- [ ] Update `main.go` to use `configSvc.Load()`
- [ ] Update handlers to use service methods
- [ ] Update tests to use service methods
- [ ] Verify no direct `config.Load()` calls remain

### Phase 3: Deprecate (Future PR)
- [ ] Add deprecation notices to old methods
- [ ] Update documentation
- [ ] Add migration guide

### Phase 4: Remove (Major Version)
- [ ] Remove deprecated methods
- [ ] Make helpers private
- [ ] Update all documentation

## Risk Assessment

### Low Risk
- Adding new methods to ConfigService (Phase 1)
- These are additive changes, no breaking changes

### Medium Risk
- Updating callers (Phase 2)
- Need thorough testing of all config load paths

### High Risk
- Removing old methods (Phase 4)
- Breaking change, requires major version bump
- Should be delayed until Phase 1-2 are stable

## Recommendation

**Implement Phase 1 NOW** in this PR:
1. Add orchestration methods to ConfigService
2. Keep old `config.Load()` working for backward compatibility
3. New code uses ConfigService, old code continues to work
4. Gradual migration over time

This approach:
- ✅ Non-breaking
- ✅ Testable
- ✅ Allows gradual migration
- ✅ Improves architecture immediately
- ✅ Doesn't force rewrite of all calling code

## Next Steps

1. Review and approve this plan
2. Implement Phase 1 methods in ConfigService
3. Write comprehensive tests for new methods
4. Update this document with actual implementation notes
5. Create Phase 2 migration plan after Phase 1 is stable
