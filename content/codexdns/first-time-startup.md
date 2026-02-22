# First-Time Startup Behavior

**CodexDNS** is designed for **zero-configuration startup**. When the application runs for the first time with no existing database or certificates, it automatically initializes everything needed to operate.

---

## Automatic Initialization

### 1. Database Creation & Schema Setup

**What happens**: On first run, CodexDNS automatically:

1. **Creates the SQLite database file** (`codexdns.db` or path from config)
2. **Creates all required tables** via GORM AutoMigrate
3. **Applies indexes and constraints**

**Tables created**:
- User management: `users`, `profiles`, `permissions`
- DNS management: `zones`, `records`, `dns_stats`, `forwarding_rules`
- Client tracking: `clients`, `client_query_stats`, `client_groups`
- DNS filtering: `filter_lists`, `filter_rules`, `filter_policies`
- Server configuration: `server_settings`, `configs`
- TLS management: `certificates`
- DHCP integration: `dhcp_integration_configs`

**Location**: Database is created in the working directory unless overridden by config:
```json
{
  "db_driver": "sqlite",
  "db_dsn": "./data/codexdns.db"
}
```

**Exit conditions**: Application exits with error if:
- Database cannot be opened
- Schema migration fails
- Disk space exhausted

---

### 2. Default Admin User Seeding

**What happens**: If no users exist in the database, a default admin account is automatically created.

**Default credentials**:
```
Username: admin
Email:    admin@codexdns.local
Password: admin123
Profile:  Administrator (full permissions)
```

**Security notes**:
- ⚠️ **CHANGE THE PASSWORD IMMEDIATELY** after first login
- Password is bcrypt-hashed before storage (never stored in plaintext)
- Only created if database is completely empty (no users)

**First login flow**:
1. Navigate to `http://localhost:8080` (or configured HTTP port)
2. Log in with `admin` / `admin123`
3. Go to Settings → Users → Edit admin user
4. Update password and email
5. Optionally enable 2FA for additional security

---

### 3. Default Client Group Creation

**What happens**: The system creates a hardcoded "All Clients" group (ID=1).

**Purpose**: 
- Acts as a fallback for DNS filter policies
- Any client not explicitly assigned to a group belongs to "All Clients"
- Required for the filter policy system to function

**Details**:
- Name: "All Clients"
- Description: "Default group for all clients"
- Cannot be deleted (system group)
- Can be edited to customize default filter behavior

---

### 4. Configuration Defaults

**What happens**: If no configuration exists in the database, hard-coded defaults are used.

#### Web Server Defaults
```json
{
  "http_enabled": true,
  "http_port": 8080,
  "https_enabled": false,
  "https_port": 8443,
  "http_redirect_to_https": false,
  "hsts_enabled": false,
  "hsts_max_age_seconds": 31536000
}
```

#### TLS Defaults
```json
{
  "tls_enabled": false,
  "certificate_source": "file",
  "cert_file_path": "./certs/server.crt",
  "key_file_path": "./certs/server.key"
}
```

#### DNS Server Defaults (from config.json)
```json
{
  "dns_listen_addresses": ["0.0.0.0:53"],
  "dns_enabled": true,
  "upstream_servers": ["8.8.8.8:53", "8.8.4.4:53"],
  "cache_enabled": true,
  "cache_backend": "memory",
  "cache_ttl": 300
}
```

**Behavior**: 
- Settings are loaded from database if they exist
- Falls back to defaults if database is empty
- Does NOT automatically write defaults to database
- User can modify and save settings via web UI

---

### 5. Certificate Handling

#### Certificate Table Creation
The `certificates` table is automatically created during schema migration. It supports:
- Multiple certificates with different purposes
- Database-backed storage (no file system dependency)
- Certificate lifecycle tracking (uploaded, expires, revoked)

#### Auto-Import on Startup (Optional)
If enabled in config (`certificate_import_on_startup: true`):

```go
certSvc.ScanAndImportCertificates("./certs", "system")
```

**What it does**:
1. Scans `./certs` directory for `.crt`, `.pem`, `.cert` files
2. Imports valid certificates into database
3. Associates them with "system" source tag

**If certificates don't exist**:
- ⚠️ Warning logged: "failed to auto-import certificates"
- Application continues normally
- HTTP server starts (port 8080)
- HTTPS/DoH servers remain disabled

**Certificate sources supported**:
- **File-based**: Load from `./certs/server.crt` and `./certs/server.key`
- **Database-backed**: Upload via web UI, stored in `certificates` table
- **Auto TLS**: Let's Encrypt ACME (requires domain and port 80/443 access)

---

## Startup Sequence

### Complete Initialization Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Load Configuration (config.json or env vars)            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Open Database Connection                                 │
│    - Creates codexdns.db if doesn't exist                   │
│    - Applies SQLite optimizations (WAL mode, etc.)          │
│    EXIT on failure ❌                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Run AutoMigrate (GORM)                                   │
│    - Creates all tables, indexes, constraints              │
│    - Fixes legacy indexes if upgrading                      │
│    EXIT on failure ❌                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Seed Admin User (if no users exist)                     │
│    - Username: admin                                        │
│    - Password: admin123 (bcrypt hashed)                     │
│    EXIT on failure ❌                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Ensure Admin Permissions                                │
│    - Fixes existing admin users missing permissions        │
│    EXIT on failure ❌                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Seed Default Client Group (ID=1)                        │
│    - Name: "All Clients"                                    │
│    EXIT on failure ❌                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Initialize Services                                      │
│    - Authentication Service                                 │
│    - DNS Service (zones, records, cache)                    │
│    - Filter Service (blocklists, policies)                  │
│    - Client Service (tracking, stats)                       │
│    - Certificate Service                                    │
│    - OUI Service (MAC vendor database)                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Auto-Import Certificates (if enabled)                   │
│    - Scans ./certs directory                                │
│    - Imports valid certificates to database                 │
│    WARN on failure ⚠️ (continues)                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Start HTTP Server                                        │
│    - Default port: 8080                                     │
│    - Always starts (no cert required)                       │
│    - Web UI available immediately                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. Start HTTPS Server (if enabled & certs available)      │
│     - Default port: 8443                                    │
│     - Requires valid certificate                            │
│     WARN if disabled ⚠️ (HTTP still works)                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. Start DNS Server (UDP/TCP)                             │
│     - Default port: 53                                      │
│     - No certificates required                              │
│     - DoH/DoT disabled if no certs                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 12. Application Ready                                       │
│     - HTTP UI: http://localhost:8080                        │
│     - DNS Server: udp://0.0.0.0:53                          │
│     - Admin Login: admin / admin123                         │
└─────────────────────────────────────────────────────────────┘
```

---

## What Works Immediately (No Setup)

After first-time startup, the following features are **fully functional** without any configuration:

### ✅ HTTP Web Interface
- **URL**: `http://localhost:8080`
- **Login**: `admin` / `admin123`
- Full management UI available:
  - Dashboard with DNS statistics
  - Zone and record management
  - Client tracking and stats
  - Filter list configuration
  - User and permission management
  - Settings and configuration

### ✅ DNS Server (UDP/TCP)
- **Port**: 53 (configurable)
- **Protocols**: UDP, TCP
- **Features**:
  - Authoritative zones (configured via UI)
  - Forwarding to upstream servers (default: 8.8.8.8, 8.8.4.4)
  - Caching (memory backend, 300s TTL)
  - DNS filtering (blocklists, allowlists)
  - Client tracking and statistics

### ✅ Client Discovery
- **Methods**:
  - DNS query tracking (automatic)
  - DHCP integration (requires configuration)
  - mDNS/NetBIOS discovery (if enabled)
  - ARP scanning (requires network permissions)

### ✅ DNS Filtering
- **Default**: "All Clients" group with no restrictions
- **Configurable**: Add filter lists, blocklists, allowlists
- **Sources**: Import from URLs, upload files, or manual entry

---

## What Requires Setup

### ⚠️ HTTPS Web Interface
**Status**: Disabled by default

**Requirements**:
1. Valid TLS certificate (one of):
   - Upload via Settings → Certificates → Upload
   - Import from `./certs` directory
   - Generate with Let's Encrypt (requires domain)
2. Enable HTTPS in Settings → Server → Web Settings
3. Restart HTTP server

**Without certificates**:
- HTTP still works on port 8080
- HTTPS attempts will fail with "no valid certificate"

### ⚠️ DNS over HTTPS (DoH)
**Status**: Disabled if no certificates

**Requirements**:
- Valid TLS certificate (same as HTTPS)
- Enable DoH in DNS settings
- Configure DoH endpoint (default: `/dns-query`)

**Fallback**: UDP/TCP DNS still works without DoH

### ⚠️ DNS over TLS (DoT)
**Status**: Disabled if no certificates

**Requirements**:
- Valid TLS certificate
- Enable DoT in DNS settings
- Port 853 (default)

**Fallback**: UDP/TCP DNS still works without DoT

### ⚠️ DHCP Integration
**Status**: Not configured by default

**Requirements**:
- External DHCP server details (IP, protocol)
- Authentication credentials (if required)
- Configure via Settings → DHCP Integration

**Without DHCP**:
- Client discovery still works via DNS queries
- Manual client addition via UI

---

## Failure Scenarios

### Application Exits (Fatal Errors)

The application will **exit immediately** with an error message if:

| Condition | Error Message | Resolution |
|-----------|---------------|------------|
| Database cannot be opened | `failed to open database: <error>` | Check file permissions, disk space, DSN path |
| Schema migration fails | `failed to run migrations: <error>` | Check database integrity, SQLite version |
| Admin user seeding fails | `failed to seed admin user: <error>` | Check database write permissions |
| Admin permissions update fails | `failed to ensure admin permissions: <error>` | Check database constraints |
| Default group seeding fails | `failed to seed default client group: <error>` | Check database integrity |

**Recovery**: Fix the underlying issue and restart the application.

### Application Continues (Warnings)

The application will **log a warning** and continue if:

| Condition | Warning Message | Impact |
|-----------|-----------------|--------|
| Certificate import fails | `Warning: failed to auto-import certificates` | HTTP works, HTTPS/DoH/DoT disabled |
| Server settings load fails | `Warning: failed to load server settings from database` | Uses hard-coded defaults |
| OUI database load fails | `Warning: failed to initialize OUI database` | MAC vendor names unavailable |
| Filter cache load fails (first query) | `cache load error: <error>` | DNS filtering uses passthrough mode |

**Recovery**: Fix the issue and restart, or configure via web UI.

---

## Post-Installation Checklist

After first-time startup, complete these steps:

### 🔒 Security (Immediate)
- [ ] Change admin password from `admin123`
- [ ] Update admin email from `admin@codexdns.local`
- [ ] Enable 2FA for admin account (recommended)
- [ ] Review and restrict admin permissions if multiple admins

### 🌐 Network Configuration
- [ ] Configure DNS zones for your network
- [ ] Add authoritative records (A, AAAA, PTR, CNAME, etc.)
- [ ] Set up forwarding rules for external domains
- [ ] Test DNS resolution: `dig @localhost example.local`

### 🔐 TLS Certificates (Optional)
- [ ] Upload or generate TLS certificates
- [ ] Enable HTTPS in web settings
- [ ] Enable DoH/DoT if needed
- [ ] Configure HTTPS redirect if desired

### 🚫 DNS Filtering (Optional)
- [ ] Add filter lists (AdGuard, Steven Black, etc.)
- [ ] Create client groups for different filter policies
- [ ] Assign clients to groups
- [ ] Test blocked domains: `dig @localhost ads.example.com`

### 👥 Client Management
- [ ] Review discovered clients
- [ ] Set friendly names for known devices
- [ ] Create client groups for organization
- [ ] Configure client-specific DNS settings

### 📊 Monitoring
- [ ] Check dashboard for DNS statistics
- [ ] Review client query logs
- [ ] Monitor cache hit ratio
- [ ] Set up external monitoring (optional)

---

## Configuration File vs Database Settings

CodexDNS uses a **hybrid configuration** approach:

### Configuration File (`config.json`)
**Purpose**: Bootstrap settings and infrastructure

**Stored here**:
- Database connection (driver, DSN)
- Initial HTTP/HTTPS ports
- DNS listen addresses
- Log file paths and rotation
- Debug flags
- Upstream DNS servers (bootstrap)

**When read**: Application startup only

**Location**: Working directory or specified with `-config` flag

### Database Settings (`configs` table)
**Purpose**: Runtime settings that can be changed via UI

**Stored here**:
- Web server settings (ports, redirect, HSTS)
- TLS settings (enabled, source, paths)
- Auto TLS settings (Let's Encrypt config)
- DNS filter settings
- DHCP integration settings

**When read**: Application startup + dynamic reload

**Modified via**: Web UI → Settings pages

### Priority Order
1. **Command-line flags** (highest priority)
2. **Environment variables** (override config file)
3. **Configuration file** (`config.json`)
4. **Database settings** (runtime modifiable)
5. **Hard-coded defaults** (fallback if nothing else)

---

## Database File Location

### Default Location
```
./codexdns.db
```
(In the current working directory)

### Recommended Production Location
```json
{
  "db_dsn": "./data/codexdns.db"
}
```

**Why**: Keeps data separate from application binary

### Docker/Container Location
```json
{
  "db_dsn": "/app/data/codexdns.db"
}
```

**Mount point**: Volume mount `/app/data` for persistence

### Alternative Database Drivers

#### PostgreSQL
```json
{
  "db_driver": "postgres",
  "db_dsn": "host=localhost user=codexdns password=secret dbname=codexdns port=5432 sslmode=disable"
}
```

#### MySQL
```json
{
  "db_driver": "mysql",
  "db_dsn": "codexdns:secret@tcp(localhost:3306)/codexdns?charset=utf8mb4&parseTime=True&loc=Local"
}
```

**Note**: PostgreSQL and MySQL require the database to be created manually before first run:
```sql
CREATE DATABASE codexdns;
```

---

## Troubleshooting First-Time Startup

### Database Creation Fails

**Error**: `failed to open database: unable to open database file`

**Causes**:
- Directory doesn't exist
- No write permissions
- Disk full

**Fix**:
```bash
# Create data directory
mkdir -p ./data

# Check permissions
ls -la ./data

# Check disk space
df -h
```

### Admin User Already Exists

**Error**: None (skipped silently)

**Cause**: Database already has users from previous installation

**Fix**: 
- Reset database: `rm codexdns.db && restart`
- Or: Use existing credentials
- Or: Reset password via direct database edit

### Port Already in Use

**Error**: `bind: address already in use`

**Cause**: Another service using port 8080 or 53

**Fix**:
```json
{
  "http_port": 8081,
  "dns_listen_addresses": ["0.0.0.0:5353"]
}
```

Or stop conflicting service:
```bash
# Check what's using port 53
sudo lsof -i :53

# Check what's using port 8080
sudo lsof -i :8080
```

### Permission Denied (Port 53)

**Error**: `listen udp 0.0.0.0:53: bind: permission denied`

**Cause**: Ports below 1024 require root/admin privileges

**Fix** (Linux):
```bash
# Option 1: Run as root (not recommended)
sudo ./codexdns

# Option 2: Grant capability (recommended)
sudo setcap 'cap_net_bind_service=+ep' ./codexdns

# Option 3: Use alternate port
# Set dns_listen_addresses to ["0.0.0.0:5353"]
```

**Fix** (Windows):
```powershell
# Run PowerShell as Administrator
.\codexdns.exe
```

### SQLite Lock Errors During Startup

**Error**: `database is locked`

**Cause**: Another CodexDNS instance is running

**Fix**:
```bash
# Find and kill existing process
ps aux | grep codexdns
kill <pid>

# Or use systemctl (if service)
sudo systemctl stop codexdns
```

---

## Upgrade Path (Existing Installation)

If upgrading from a previous version:

1. **Backup database**:
   ```bash
   cp codexdns.db codexdns.db.backup
   ```

2. **Run new version**: AutoMigrate applies schema changes automatically

3. **Verify migration**:
   - Check logs for migration errors
   - Test login with existing credentials
   - Verify zones and records are intact

4. **New features**: Check release notes for new settings/features

**Note**: AutoMigrate is **additive only**. It:
- ✅ Creates new tables
- ✅ Adds new columns
- ✅ Creates new indexes
- ❌ Does NOT delete columns
- ❌ Does NOT modify existing data

---

## Summary

CodexDNS is designed for **effortless first-time startup**:

✅ **Zero-configuration** - Works immediately with sensible defaults  
✅ **Automatic database setup** - Creates schema and seeds data  
✅ **Secure by default** - Admin user with strong password hashing  
✅ **Graceful degradation** - HTTP works even without certificates  
✅ **Clear failure messages** - Exits with helpful error messages  
✅ **Production-ready** - All services functional out-of-the-box  

**First-time startup takes**: < 5 seconds  
**Manual setup required**: None (but password change recommended)  
**Services ready**: HTTP UI, DNS server, client tracking, filtering  
**Optional setup**: HTTPS, DoH, DoT, DHCP integration  

Start the application and log in at `http://localhost:8080` with `admin` / `admin123`. 🚀
