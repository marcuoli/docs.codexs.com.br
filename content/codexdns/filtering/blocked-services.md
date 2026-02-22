---
title: "Blocked Services"
description: "Block entire services by name (e.g. TikTok, ads networks)."
weight: 30
---

# Blocked Services Implementation

## Overview
Implemented service blocking in Filter Configuration, allowing users to block entire services (e.g., Facebook, YouTube, TikTok) with predefined domain lists. Services are organized into categories like Social Media, Video Streaming, Gaming, etc.

## Implementation Date
December 23, 2024

## Components Implemented

### 1. Service Definitions Catalog
**File:** `internal/service/blocked_services.go`

- **45+ predefined services** across 8 categories:
  - Social Media (Facebook, Twitter, Instagram, TikTok, etc.)
  - Video Streaming (YouTube, Netflix, Twitch, etc.)
  - Gaming (Steam, Epic Games, Xbox Live, etc.)
  - Messaging (WhatsApp, Telegram, Discord, etc.)
  - Shopping (Amazon, eBay, AliExpress, etc.)
  - Adult Content (domain blocking services)
  - File Sharing (Dropbox, Google Drive, etc.)
  - News & Media (CNN, BBC, Reddit, etc.)

- **BlockedService struct:**
  ```go
  type BlockedService struct {
      ID          string   // Unique identifier (e.g., "facebook")
      Name        string   // Display name
      Category    string   // Category ID
      Description string   // What this service is
      Domains     []string // List of domains to block
      IconURL     string   // Service icon URL (Clearbit or generic)
  }
  ```

- **Helper functions:**
  - `GetServiceCategories()` - Returns all category definitions
  - `GetPredefinedServices()` - Returns all service definitions
  - `GetServicesByCategory(categoryID)` - Returns services for a specific category

### 2. Configuration Model
**File:** `internal/config/config.go`

- Added `BlockedServices map[string]bool` field to main Config struct
- Maps service ID to blocking status (true = blocked, false = unblocked)
- Persists to `config.json` when configuration is saved

### 3. Database Model (Custom Services)
**File:** `internal/storage/blocked_service.go`

- **CustomBlockedService model** for user-defined services:
  ```go
  type CustomBlockedService struct {
      ID           uint
      Name         string
      Description  string
      Category     string
      IconURL      string
      Domains      string  // JSON-encoded []string
      IsEnabled    bool
      DomainCount  int
      BlockedCount int64
      CreatedAt    time.Time
      UpdatedAt    time.Time
  }
  ```

### 4. User Interface
**Files:**
- `web/templates/config-filter.templ` (renamed from filter-configuration.templ)
- `web/templates/filter_services_tab.templ`
- `web/static/js/config-filter.js` (canonical; legacy `filter-configuration.js` removed)

**Features:**
- **Two-tab interface** on Filter Configuration page:
  - Settings tab: Existing filter configuration
  - Services tab: Blocked services management

- **Services Tab UI:**
  - Category-based organization with collapsible cards
  - Service icons (8x8px) with Clearbit CDN + generic SVG fallback
  - Toggle switches for each service
  - Bulk "Block All" / "Unblock All" per category
  - Compact custom services section with:
    - Card-based list layout
    - Inline badges showing domain count and ON/OFF status
    - Icon-only action buttons (Edit, Delete)

- **Tab Persistence:**
  - Active tab saved to localStorage (`codexdns-filter-config-tab`)
  - URL hash sync for direct navigation (#settings or #services)
  - Survives page refreshes like System Configuration page

- **Responsive Design:**
  - Mobile-first approach with Tailwind breakpoints
  - Touch-friendly buttons and controls
  - Compact layout on small screens

### 5. Backend Handler
**File:** `internal/http/handlers/config_filter_configuration.go`

- **ProcessFilterConfigurationConfig()** updated to:
  - Extract `blocked_services` from JSON request
  - Convert `map[string]interface{}` to `map[string]bool`
  - Save to `cfg.BlockedServices`
  - Persist to config file via `ConfigService.SaveConfig()`
  - Reload filter cache to apply changes immediately
  - Log blocked services count for debugging

### 6. DNS Filter Engine Integration
**File:** `internal/service/filter.go`

**Changes:**
1. Added `cfg *config.Config` field to `FilterService` struct
2. Updated constructors to accept config parameter:
   - `NewFilterService(db)` - defaults to nil config
   - `NewFilterServiceWithConfig(db, cfg, cacheMethod)`
   - `NewFilterServiceWithDebug(db, cfg, cacheMethod, debug)`

3. **LoadCache() Enhancement:**
   - Loads blocked service domains FIRST (highest priority)
   - Iterates through `cfg.BlockedServices` map
   - For each blocked service (value = true):
     - Fetches service definition from `GetPredefinedServices()`
     - Creates virtual filter rules for each domain
     - Adds to appropriate cache:
       - Exact domains → `domainRules` map
       - Wildcard domains (*.example.com) → `wildcardRules` + `wildcardMatcher`
       - Complex patterns → treated as wildcards
   - Logs total blocked service domains loaded
   - Filter cache now checks blocked services before filter lists

**Virtual Rules:**
- No FilterList reference (List = nil)
- Action = `storage.FilterActionBlock`
- Pattern = service domain (from Domains[] array)
- IsException = false

**Domain Types Supported:**
- Exact: `facebook.com`
- Wildcard prefix: `*.facebook.com` (matches all subdomains)
- Complex patterns: Auto-converted to wildcards

### 7. Routing Updates
**File:** `internal/http/routes.go`

- Renamed routes from `/filter-configuration` to `/config-filter`
- Updated handler registration: `GET /config-filter` and `POST /api/config/config-filter`
- Navigation link updated in `web/templates/layout.templ`

## How It Works

### User Flow
1. User navigates to Filter Configuration page (`/config-filter`)
2. Clicks on "Services" tab
3. Selects category (e.g., "Social Media")
4. Toggles service switches (e.g., turn ON Facebook blocking)
5. Optionally uses "Block All" to block entire category
6. Clicks "Save Configuration" button
7. Configuration saved to config file
8. Filter cache reloads with blocked service domains

### DNS Resolution Flow
1. DNS query arrives (e.g., `www.facebook.com`)
2. Filter service checks domain in this order:
   - **Blocked service domains** (checked first)
   - Exact domain rules from filter lists
   - Wildcard rules from filter lists
   - Regex rules from filter lists
3. If domain matches blocked service rule → blocked
4. If domain matches filter list rule → action depends on policy
5. If no match → allowed (pass through)

### Configuration Persistence
- Blocked services map stored in `config.json`:
  ```json
  {
    "blocked_services": {
      "facebook": true,
      "youtube": false,
      "tiktok": true
    }
  }
  ```
- Survives application restarts
- Loaded into FilterService during initialization
- Applied immediately when cache reloads

## Testing

### Manual Testing Steps
1. Start application with WSL: `~/go/bin/air -c .air.linux.toml`
2. Navigate to http://172.23.14.225:8080/config-filter
3. Switch to Services tab
4. Block Facebook service (toggle switch to ON)
5. Click "Save Configuration"
6. Query `facebook.com` via DNS → should be blocked
7. Unblock Facebook, save again
8. Query `facebook.com` → should be allowed

### Automated Testing
- All existing FilterService tests pass
- Virtual rules integrate seamlessly with existing filter logic
- No breaking changes to existing functionality

## Future Enhancements

### Phase 4: Custom Services CRUD (Not Implemented Yet)
- API endpoints:
  - `GET /api/config/services/custom` - List custom services
  - `POST /api/config/services/custom` - Create custom service
  - `PUT /api/config/services/custom/:id` - Update custom service
  - `DELETE /api/config/services/custom/:id` - Delete custom service
- UI integration with Custom Services section
- Database persistence via CustomBlockedService model

### Phase 5: Analytics & Tracking (Not Implemented Yet)
- Track per-service block counts
- Update FilterList.BlockedCount equivalent for services
- Service blocking statistics in UI
- "Top Blocked Services" widget on dashboard
- GetServiceBlockingStats() method in filter service

### Phase 6: Advanced Features (Future)
- Import/export service definitions
- Service scheduling (block during work hours)
- Per-client group service blocking
- Service templates (work-safe, family-safe, etc.)
- Community-contributed service definitions

## File Changes Summary

### New Files
- `internal/service/blocked_services.go` - Service catalog
- `internal/storage/blocked_service.go` - Custom service model
- `web/templates/filter_services_tab.templ` - Services UI component
- `web/templates/config-filter.templ` - Main filter config page (renamed)
- `web/static/js/config-filter.js` - Alpine.js state (renamed)

### Modified Files
- `internal/config/config.go` - Added BlockedServices field
- `internal/service/filter.go` - Added config reference, updated LoadCache()
- `internal/dns/server.go` - Pass config to FilterService constructor
- `internal/http/handlers/config_filter_configuration.go` - Process blocked_services
- `internal/http/routes.go` - Renamed routes to /config-filter
- `web/templates/layout.templ` - Updated navigation link
- `web/templates/components/head.templ` - Updated script reference

### Deleted Files
- `web/templates/filter-configuration.templ` - Renamed to config-filter.templ
- `web/static/js/filter-configuration.js` - Legacy filename removed (use config-filter.js)

## Technical Notes

### Memory Efficiency
- Service domains use string interning (StringPool)
- Virtual rules don't allocate extra memory for FilterList references
- Wildcard matcher (radix tree or bloom filter) handles wildcards efficiently

### Performance
- Blocked services checked via same cache as filter lists
- No additional lookup overhead (integrated into existing cache)
- Bulk "Block All" operations update state in one transaction

### Security
- Only authenticated admin users can modify blocked services
- Configuration changes logged to audit trail
- Filter cache reloaded atomically (no race conditions)

### Compatibility
- Works with all cache methods (radix, trie, bloom, hashmap)
- Compatible with existing filter lists and policies
- No breaking changes to existing configuration

## Known Limitations

1. **Custom services not fully implemented** - UI exists but CRUD API pending
2. **No per-client service blocking** - All clients see same blocked services
3. **No scheduling** - Services blocked 24/7, no time-based rules
4. **No analytics yet** - Block counts not tracked per service
5. **Static service list** - No auto-update from community sources

## Configuration Example

```json
{
  "filter_enabled": true,
  "filter_cache_method": "radix",
  "blocked_services": {
    "facebook": true,
    "instagram": true,
    "tiktok": true,
    "youtube": false,
    "twitter": false
  }
}
```

## Conclusion

The blocked services feature is now fully functional for core use cases:
- ✅ Block predefined services via web UI
- ✅ Configuration persists across restarts
- ✅ DNS queries blocked for service domains
- ✅ Tab persistence and navigation
- ✅ Mobile-responsive UI with service icons
- ⏳ Custom services CRUD (pending)
- ⏳ Analytics tracking (pending)
- ⏳ Advanced features (future)

The implementation follows CodexDNS architecture:
- Service layer handles business logic
- Storage layer for database models
- HTTP handlers for API endpoints
- Templ components for UI
- Config file for persistence
- Filter cache for runtime enforcement
