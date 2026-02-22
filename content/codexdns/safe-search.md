# Safe Search Implementation

## Overview

CodexDNS now supports **Safe Search enforcement** for major search engines. When enabled, DNS queries for search engine domains are automatically redirected to their safe search endpoints, providing an additional layer of content filtering.

## Supported Search Engines

### 1. Google Safe Search
- **ID**: `google`
- **Domains**: All Google country domains (google.com, google.co.uk, google.de, etc.) - 100+ TLDs
- **Safe Endpoint**: forcesafesearch.google.com
- **IPv4**: 216.239.38.120
- **IPv6**: 2001:4860:4802:32::78

### 2. YouTube Restricted Mode
- **ID**: `youtube`
- **Domains**: youtube.com, www.youtube.com, m.youtube.com, youtubei.googleapis.com
- **Safe Endpoint**: restrictmoderate.youtube.com
- **IPv4**: 216.239.38.120
- **IPv6**: 2001:4860:4802:32::78

### 3. Bing Safe Search
- **ID**: `bing`
- **Domains**: bing.com, www.bing.com
- **Safe Endpoint**: strict.bing.com
- **IPv4**: 204.79.197.220
- **IPv6**: 2620:1ec:c11::200

### 4. DuckDuckGo Safe Search
- **ID**: `duckduckgo`
- **Domains**: duckduckgo.com, www.duckduckgo.com
- **Safe Endpoint**: safe.duckduckgo.com
- **IPv4**: 54.251.178.20
- **IPv6**: 2a05:d014:9c8:2400::223

### 5. Ecosia Safe Search
- **ID**: `ecosia`
- **Domains**: ecosia.org, www.ecosia.org
- **Safe Endpoint**: safe.ecosia.org
- **IPv4**: 141.8.225.49
- **IPv6**: 2a02:1748:dd5c:f290::1

### 6. Yandex Family Search
- **ID**: `yandex`
- **Domains**: yandex.com, yandex.ru, www.yandex.com, www.yandex.ru
- **Safe Endpoint**: familysearch.yandex.ru
- **IPv4**: 213.180.193.56
- **IPv6**: 2a02:6b8::feed:a11

### 7. Pixabay Safe Search
- **ID**: `pixabay`
- **Domains**: pixabay.com, www.pixabay.com
- **Safe Endpoint**: safesearch.pixabay.com
- **IPv4**: 104.18.32.67, 104.18.33.67
- **IPv6**: 2606:4700:10::6812:2043, 2606:4700:10::6812:2143

## How It Works

1. **DNS Query Interception**: When a user queries a search engine domain (e.g., google.com)
2. **Domain Matching**: The SafeSearchService checks if the domain is a known search engine
3. **Safe Search Redirect**: If enabled, returns the IP address of the safe search endpoint instead
4. **Transparent Operation**: The user's browser connects to the safe search endpoint automatically

## Architecture

### Service Layer
- **Location**: `internal/service/safesearch.go`
- **Service**: `SafeSearchService`
- **Methods**:
  - `CheckDomain(ctx, domain, qtype)` - Check if a domain should be redirected
  - `SetEnabled(bool)` - Enable/disable safe search enforcement
  - `GetSupportedEngines()` - List all supported search engines
  - `GetEngineStats()` - Get statistics about safe search configuration

### Integration Points

The SafeSearchService is designed to integrate with the existing DNS resolver pipeline:

```go
// Pseudocode integration
if safeSearchService.IsEnabled() {
    result := safeSearchService.CheckDomain(ctx, domain, qtype)
    if result.ShouldRedirect {
        // Return pre-built safe search response
        return result.SafeResponse
    }
}
// Continue with normal resolution
```

## Configuration

### Master Toggle
Enable or disable all safe search enforcement:

```go
// In code
safeSearchService.SetEnabled(true)

// Check status
enabled := safeSearchService.IsEnabled()
```

### Per-Engine Toggles
Enable or disable individual search engines:

```go
// Disable YouTube specifically
safeSearchService.SetEngineEnabled("youtube", false)

// Enable Google
safeSearchService.SetEngineEnabled("google", true)

// Available engine IDs:
// - "google"
// - "youtube"
// - "bing"
// - "duckduckgo"
// - "ecosia"
// - "yandex"
// - "pixabay"
```

### Configuration Object
Set entire configuration at once:

```go
config := SafeSearchConfig{
    Enabled:           true,  // Master switch
    GoogleEnabled:     true,  // Per-engine toggles
    YouTubeEnabled:    true,
    BingEnabled:       true,
    DuckDuckGoEnabled: true,
    EcosiaEnabled:     true,
    YandexEnabled:     true,
    PixabayEnabled:    true,
}

safeSearchService.SetConfig(config)
```

### Configuration Priority
1. **Master Switch**: If `Enabled` is `false`, no redirection occurs regardless of per-engine settings
2. **Per-Engine Toggle**: If master is `true` but engine is `false`, that specific engine won't redirect
3. **Both Must Be True**: For redirection to occur, both master and engine-specific toggle must be enabled

### Per-Group Configuration (Future)
Safe search can be extended to support per-client-group enforcement using the `SafeSearchFilterPolicy` extension point.

## DNS Query Flow with Safe Search

```
┌─────────────────────────────────────────────────────────────┐
│                     DNS Query Received                       │
│                   (e.g., google.com A?)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │   Safe Search Check          │
          │   (if enabled)               │
          └──────┬───────────────┬───────┘
                 │               │
         Match   │               │  No Match
                 │               │
                 ▼               ▼
      ┌──────────────┐    ┌──────────────┐
      │ Return Safe  │    │ Continue     │
      │ Search IPs   │    │ Normal       │
      │              │    │ Resolution   │
      └──────────────┘    └──────────────┘
```

## Testing

Comprehensive test coverage is provided in `internal/service/safesearch_test.go`:

- ✅ Enable/disable functionality
- ✅ Google domain matching (including all country TLDs)
- ✅ Bing domain matching
- ✅ DuckDuckGo domain matching
- ✅ Yandex domain matching
- ✅ Case-insensitive domain matching
- ✅ Trailing dot handling
- ✅ IPv4 and IPv6 response building
- ✅ Query type filtering (A/AAAA only)
- ✅ Non-search-engine passthrough

### Run Tests
```bash
go test -v ./internal/service -run TestSafeSearch
```

### Benchmarks
```bash
go test -bench=BenchmarkSafeSearch ./internal/service
```

## Performance

The SafeSearchService uses:
- **O(1) HashMap lookup** for domain matching
- **Pre-built DNS responses** for zero overhead
- **Zero allocations** for lookups after initialization
- **~100ns per lookup** (estimated based on similar hashmap implementations)

## Future Enhancements

### 1. Configuration Storage
- Add safe search settings to `config.json`
- Add safe search settings to database (per-group configuration)
- Add UI controls for enabling/disabling safe search

### 2. Per-Group Enforcement
```go
// Example: Enable safe search only for "Kids" group
policy := SafeSearchFilterPolicy{
    FilterPolicy:      basePolicy,
    SafeSearchEnabled: true,
}
```

### 3. Additional Search Engines
- Yahoo
- Baidu
- Ecosia
- Startpage
- Other regional search engines

### 4. Metrics & Logging
- Track safe search redirections
- Log which search engines are being enforced
- Per-client safe search statistics

## API Usage Examples

### Basic Usage
```go
// Initialize service
svc := NewSafeSearchService()

// Enable safe search
svc.SetEnabled(true)

// Check a domain
ctx := context.Background()
result := svc.CheckDomain(ctx, "google.com", dns.TypeA)

if result.ShouldRedirect {
    // Use the pre-built safe response
    response := result.SafeResponse
    // ... send response to client
}
```

### Check if Domain is a Search Engine
```go
if svc.IsSearchEngineDomain("google.com") {
    engine := svc.GetEngineForDomain("google.com")
    fmt.Printf("Matched engine: %s\n", engine.Name)
    fmt.Printf("Safe domain: %s\n", engine.SafeDomain)
}
```

### Get Statistics
```go
stats := svc.GetEngineStats()
fmt.Printf("Safe Search Enabled: %v\n", stats["enabled"])
fmt.Printf("Total Engines: %d\n", stats["total_engines"])
fmt.Printf("Total Domains: %d\n", stats["total_domains"])
```

## Security Considerations

1. **No Bypassing**: Safe search IPs are hardcoded and cannot be easily bypassed by users
2. **All TLDs Covered**: Google safe search covers all country-specific Google domains
3. **IPv4 and IPv6**: Both IP versions are supported for comprehensive coverage
4. **Transparent**: No certificate warnings or connection issues for users

## References

- [Google Safe Search](https://support.google.com/websearch/answer/186669)
- [Bing Safe Search](https://www.bing.com/account/general)
- [DuckDuckGo Safe Search](https://help.duckduckgo.com/duckduckgo-help-pages/features/safe-search/)
- [Yandex Family Search](https://yandex.com/support/search/results/family.html)
