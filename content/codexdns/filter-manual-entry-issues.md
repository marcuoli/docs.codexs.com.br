# Filter Manual Entry Test Failures

## Overview
Three test failures in `internal/service/filter_manual_entry_test.go` are pre-existing issues that need to be addressed separately. These are NOT related to the filter updater or update interval features recently added.

## Test Failures

### 1. TestUpdateFilterListClearsDomains

**Status**: ❌ FAILING

**Expected Behavior**:
```go
updateInput := UpdateFilterListInput{
    // ... other fields ...
    InitialDomains: "", // Empty = clear all rules
}
```
Passing an empty `InitialDomains` string should delete all existing rules from a manual filter list.

**Actual Behavior**:
Rules are NOT deleted. The code skips processing when `InitialDomains` is empty.

**Root Cause**:
```go
// File: internal/service/filter.go, line 2019
if input.InitialDomains != "" && list.URL == "" {
    // Delete existing rules
    // Add new rules
}
```

The condition `input.InitialDomains != ""` prevents processing when the string is empty.

**Fix Required**:
```go
// Process InitialDomains for manual lists (URL empty) even if InitialDomains is empty
if list.URL == "" {
    if input.InitialDomains == "" {
        // Clear all rules
        if err := s.db.Where("filter_list_id = ?", list.ID).Delete(&storage.FilterRule{}).Error; err != nil {
            return nil, fmt.Errorf("failed to delete rules: %w", err)
        }
    } else {
        // Delete old rules and add new ones
        // ... existing logic ...
    }
}
```

---

### 2. TestUpdateFilterListAutoDetectsFormat

**Status**: ❌ FAILING

**Expected Behavior**:
```go
input := CreateFilterListInput{
    Format: "auto", // Auto-detect format
}
updateInput := UpdateFilterListInput{
    InitialDomains: `example.com
*.wildcard.net
/^regex\\.pattern\\.org$/`,
}
```

When format is `"auto"`, the system should detect:
- `*.wildcard.net` → `RuleTypeWildcard`
- `/^regex\\.pattern\\.org$/` → `RuleTypeRegex`
- `example.com` → `RuleTypeDomain`

**Actual Behavior**:
All rules are created as `RuleTypeDomain` because `parseRule()` doesn't handle `"auto"` format.

**Root Cause**:
```go
// File: internal/service/filter.go, line 2186
func (s *FilterService) parseRule(line, format string) (*storage.FilterRule, error) {
    switch format {
    case "adblock", "":
        // ... handles adblock format
    case "hosts":
        // ... handles hosts format
    case "domains":
        // ... simple domain list
    default:
        // Falls through to auto-detect, but doesn't work for all patterns
    }
}
```

The `default` case has auto-detection logic but it's incomplete and only checks for adblock/hosts prefixes.

**Fix Required**:
```go
case "auto":
    // Auto-detect based on pattern characteristics
    if strings.HasPrefix(line, "/") && strings.HasSuffix(line, "/") {
        pattern = strings.Trim(line, "/")
        ruleType = storage.RuleTypeRegex
    } else if strings.Contains(line, "*") {
        pattern = line
        ruleType = storage.RuleTypeWildcard
    } else if strings.HasPrefix(line, "||") && strings.HasSuffix(line, "^") {
        pattern = strings.TrimPrefix(strings.TrimSuffix(line, "^"), "||")
        ruleType = storage.RuleTypeDomain
    } else if strings.Contains(line, " ") && (strings.HasPrefix(line, "0.0.0.0") || strings.HasPrefix(line, "127.0.0.1")) {
        // Hosts file format
        parts := strings.Fields(line)
        if len(parts) >= 2 {
            pattern = parts[1]
            ruleType = storage.RuleTypeDomain
        }
    } else {
        // Plain domain
        pattern = line
        ruleType = storage.RuleTypeDomain
    }
```

---

### 3. TestUpdateFilterListFieldMapping

**Status**: ❌ FAILING (3 sub-tests)

**Failing Sub-tests**:
- `TestUpdateFilterListFieldMapping/Type`
- `TestUpdateFilterListFieldMapping/Format`
- `TestUpdateFilterListFieldMapping/UpdateIntervalHours`

**Root Cause**:
Same as issue #2 - the test creates rules with `Format: "auto"` and expects proper type detection. The UpdateIntervalHours field itself is working correctly, but the test fails because rule creation fails due to format detection.

**Fix Required**:
Same as issue #2 - implement proper `"auto"` format detection in `parseRule()`.

---

## Impact Analysis

### ✅ No Impact On Production Features
These test failures do NOT affect:
- Filter list downloads from URLs (uses different code path)
- Filter service CheckDomain() functionality (all tests passing)
- Filter list updater background service (uses DownloadAndUpdateList, not manual entry)
- Update interval column display (field storage/retrieval works correctly)
- Web UI manual entry (doesn't use "auto" format - users select explicit format)

### ⚠️ Affected Functionality
These issues only affect:
- API/programmatic calls that use `UpdateFilterList()` with:
  - Empty `InitialDomains` to clear rules
  - `Format: "auto"` for auto-detection

### Recommended Action
1. Create separate issue/PR to fix these 3 test failures
2. Implement proper handling of:
   - Empty `InitialDomains` for rule clearing
   - `"auto"` format for pattern detection
3. Consider adding integration tests for manual list management workflow

## Testing Notes

**Current Test Results**:
```
=== RUN   TestUpdateFilterListClearsDomains
    filter_manual_entry_test.go:209: rule count = 2, want 0 (all rules should be deleted)
--- FAIL: TestUpdateFilterListClearsDomains (0.00s)

=== RUN   TestUpdateFilterListAutoDetectsFormat
    filter_manual_entry_test.go:278: rule "*.wildcard.net" has type "domain", want "wildcard"
    filter_manual_entry_test.go:274: unexpected rule pattern: "/^regex\\\\.pattern\\\\.org$/"
--- FAIL: TestUpdateFilterListAutoDetectsFormat (0.00s)

=== RUN   TestUpdateFilterListFieldMapping
    filter_manual_entry_test.go:353: rule type = "domain", want "wildcard"
--- FAIL: TestUpdateFilterListFieldMapping (0.00s)
```

**All Other Tests**: PASSING ✅
- Total service tests: 147 tests
- Passing: 144 tests
- Failing: 3 tests (documented above)

## Related Files
- `internal/service/filter.go` - Lines 2019, 2186-2240
- `internal/service/filter_manual_entry_test.go` - Lines 190-356
- `internal/storage/filter.go` - FilterList and FilterRule models
