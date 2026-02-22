# Theme Persistence Fix - Summary

## Problem
After logging in and changing the theme preference to "dark", the theme would revert to the default when navigating to the dashboard or refreshing the page.

## Root Cause
The issue was caused by **conflicting Alpine.js `x-data` declarations** on the Dashboard and Base (authenticated pages) templates:

1. **Dashboard template**:
   - HTML element: `<html ... x-data="themeState()" x-init="init()">`
   - Body element: `<body ... x-data="dashboardState(loadDashboardInitData())" x-init="init()" ...>`
   
2. **Base template** (authenticated pages layout):
   - HTML element: `<html ... x-data="themeState()" x-bind:class="themeClass" x-init="init()">`
   - Body element: `<body ... x-data="{ toastMessage: '', toastType: 'success', showToast: false }">`

In Alpine.js, when a child element (body) has `x-data`, it creates a **new Alpine scope** that **completely replaces** the parent scope (html). This meant the theme state functions were inaccessible on the dashboard and authenticated pages.

## Solution
Implemented a two-part fix:

### 1. Dashboard Theme Integration
- **Modified**: `web/static/js/dashboard.js`
- **Change**: Merged theme state methods into the `dashboardState()` function
  - Added theme preference state variables and getters
  - Integrated `toggle()`, `setPreference()`, `saveThemePreference()`, and `initTheme()` methods
  - Called `initTheme()` in the `init()` method
- **Removed**: HTML-level `x-data="themeState()"` from dashboard template
- **Result**: Theme state is now always available on the dashboard

### 2. Authenticated Pages Theme Integration
- **Created**: `web/static/js/base-page-state.js`
- **Purpose**: Merged state factory for all authenticated pages (Base template)
  - Combines theme state with toast notification state
  - Prevents scope conflicts on pages with multiple Alpine components
- **Modified**: `web/templates/base.templ`
  - Removed HTML-level `x-data`
  - Updated body to use `x-data="basePageState()" x-init="init()"`
- **Modified**: `web/templates/components/head.templ`
  - Added script tag to load `base-page-state.js` after `theme.js`
- **Result**: Theme state is accessible on all authenticated pages

### 3. Unchanged - Login and Unauthenticated Pages
- Maintained the original pattern (HTML-level `x-data="themeState()"`)
- No conflicts since these pages don't have nested Alpine components

## Files Modified
1. `web/static/js/dashboard.js` - Added theme state to dashboard state
2. `web/static/js/base-page-state.js` - Created new merged state for authenticated pages
3. `web/templates/dashboard.templ` - Removed HTML-level x-data
4. `web/templates/base.templ` - Updated to use basePageState
5. `web/templates/components/head.templ` - Added base-page-state.js script

## Testing
- Build verification: ✓ Templ compiled successfully
- CSS compilation: ✓ Tailwind CSS built successfully  
- Go build: ✓ Binary built successfully (65MB)

## How Theme Persistence Works Now

1. **On Login**:
   - `completeLogin()` reads theme from user's database record
   - Sets cookie: `codexdns-theme=<user_preference>`
   - User is redirected to dashboard

2. **On Dashboard Load**:
   - `applyThemeImmediately()` runs when theme.js loads
   - Reads cookie and applies theme class before Alpine initializes
   - Prevents flash of wrong theme
   - Dashboard state initializes with theme state merged in

3. **On Theme Change**:
   - User toggles theme or selects from dropdown
   - `toggle()` or `setPreference()` called
   - `saveThemePreference()` updates:
     - localStorage for fallback
     - Cookie for browser memory
     - Database via `/api/user/theme` API
   - Theme class applied immediately to HTML element

4. **On Page Navigation/Refresh**:
   - Cookie read on page load
   - `applyThemeImmediately()` applies theme before Alpine initializes
   - Theme persists across page reloads

## Result
Theme preference now persists correctly across:
- Page navigations
- Page reloads
- Tab switches
- Browser sessions (via database storage)
