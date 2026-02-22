# Runtime Configuration Guide

CodexDNS supports runtime configuration changes without requiring application restarts (except for DNS server protocol changes). Configuration can be managed via the web interface or REST API.

## Configuration Sources

### Priority Order

1. **Configuration File** (`config.json`, `config-wsl.json`)
   - Read at application startup
   - Cannot be modified at runtime
   - Defines initial/default settings

2. **Database** (`server_settings` table)
   - Can be modified at runtime via Web UI or API
   - Takes effect immediately (or after service restart for DNS)
   - Persists across application restarts

### When Each Takes Effect

| Setting Category | Takes Effect | Requires Restart |
|-----------------|--------------|------------------|
| Web Server (HTTP/HTTPS ports) | Next request | No* |
| Web Server (redirect, HSTS) | Next request | No |
| DNS Protocols (enable/disable) | After DNS restart | Yes (DNS only) |
| DNS Protocols (address/port) | After DNS restart | Yes (DNS only) |
| TLS Certificate (path changes) | After DNS/web restart | Yes (affected services) |
| TLS Certificate (content) | Immediately (auto-reload) | No |
| AutoTLS (Let's Encrypt) | Certificate renewal automatic | No |

*Note: Changing HTTP/HTTPS ports requires application restart. Toggle enable/disable works immediately.

## Web Interface

### Access

Navigate to **Server Settings** page:
- URL: `https://your-server.com/admin/server-settings`
- Required Permission: `admin.users.manage`
- Authentication: Must be logged in

### Tabs

1. **Web**: HTTP/HTTPS server configuration
2. **DNS**: Multi-protocol DNS settings (UDP/TCP/DoT/DoH/DoQ)
3. **TLS**: Certificate configuration (self-signed, custom, paths)
4. **AutoTLS**: Let's Encrypt automatic certificates

### Workflow

1. Navigate to appropriate tab
2. Modify settings
3. Click **Save** button
4. For DNS protocol changes: Click **Restart DNS Server** button
5. Verify on Dashboard: Protocol status badges update in real-time

## REST API

### Authentication

All API endpoints require authentication via session cookie or Bearer token.

### Endpoints

#### Get All Settings
```bash
GET /api/settings/server
```

Response:
```json
{
  "web": {
    "http_enabled": true,
    "http_port": 8080,
    "https_enabled": true,
    "https_port": 8443,
    "http_redirect_to_https": false,
    "hsts_enabled": false,
    "hsts_max_age_seconds": 31536000
  },
  "dns": {
    "udp_enabled": true,
    "udp_address": "0.0.0.0",
    "udp_port": 53,
    "tcp_enabled": true,
    "tcp_address": "0.0.0.0",
    "tcp_port": 53,
    "dot_enabled": false,
    "dot_address": "0.0.0.0",
    "dot_port": 853,
    "doh_enabled": false,
    "doh_address": "0.0.0.0",
    "doh_port": 443,
    "doh_path": "/dns-query",
    "doh_http3_enabled": false,
    "doq_enabled": false,
    "doq_address": "0.0.0.0",
    "doq_port": 853
  },
  "tls": {
    "cert_path": "/etc/codexdns/certs/cert.pem",
    "key_path": "/etc/codexdns/certs/key.pem",
    "use_wildcard": false,
    "use_self_signed": true
  },
  "auto_tls": {
    "enabled": false,
    "domain": "",
    "email": "",
    "cache_dir": "/var/lib/codexdns/autocert",
    "staging": false,
    "auto_renew": true
  }
}
```

#### Update Web Settings
```bash
POST /api/settings/server/web
Content-Type: application/json

{
  "http_enabled": true,
  "http_port": 8080,
  "https_enabled": true,
  "https_port": 8443,
  "http_redirect_to_https": true,
  "hsts_enabled": true,
  "hsts_max_age_seconds": 31536000
}
```

#### Update DNS Settings
```bash
POST /api/settings/server/dns
Content-Type: application/json

{
  "udp_enabled": true,
  "udp_address": "0.0.0.0",
  "udp_port": 53,
  "tcp_enabled": true,
  "tcp_address": "0.0.0.0",
  "tcp_port": 53,
  "dot_enabled": true,
  "dot_address": "0.0.0.0",
  "dot_port": 853,
  "doh_enabled": true,
  "doh_address": "0.0.0.0",
  "doh_port": 443,
  "doh_path": "/dns-query",
  "doh_http3_enabled": false,
  "doq_enabled": false,
  "doq_address": "0.0.0.0",
  "doq_port": 853
}
```

#### Update TLS Settings
```bash
POST /api/settings/server/tls
Content-Type: application/json

{
  "cert_path": "/etc/codexdns/certs/cert.pem",
  "key_path": "/etc/codexdns/certs/key.pem",
  "use_wildcard": false,
  "use_self_signed": false
}
```

#### Update AutoTLS Settings
```bash
POST /api/settings/server/auto_tls
Content-Type: application/json

{
  "enabled": true,
  "domain": "dns.example.com",
  "email": "admin@example.com",
  "cache_dir": "/var/lib/codexdns/autocert",
  "staging": false,
  "auto_renew": true
}
```

#### Restart DNS Server
```bash
POST /api/settings/server/restart-dns
```

Response:
```json
{
  "message": "DNS server restart initiated"
}
```

#### Generate Self-Signed Certificate
```bash
POST /api/settings/certificates/generate
Content-Type: application/json

{
  "domain": "dns.example.com",
  "cert_path": "/etc/codexdns/certs/cert.pem",
  "key_path": "/etc/codexdns/certs/key.pem",
  "wildcard": false,
  "days_valid": 365
}
```

#### Get Certificate Info
```bash
GET /api/settings/certificates/info?cert_path=/etc/codexdns/certs/cert.pem
```

Response:
```json
{
  "subject": "CN=dns.example.com",
  "issuer": "CN=dns.example.com",
  "not_before": "2025-01-01T00:00:00Z",
  "not_after": "2026-01-01T00:00:00Z",
  "dns_names": ["dns.example.com", "*.example.com"]
}
```

## Configuration Validation

### Web Settings

| Rule | Description |
|------|-------------|
| At least one enabled | HTTP or HTTPS must be enabled |
| Unique ports | HTTP port ≠ HTTPS port |
| Port range | 1-65535 |
| Redirect requirement | Both HTTP and HTTPS must be enabled for redirect |
| HSTS requirement | HTTPS must be enabled for HSTS |
| HSTS max-age range | 0-63072000 seconds (0 = disabled, 2 years max) |

### DNS Settings

| Rule | Description |
|------|-------------|
| At least one enabled | At least one DNS protocol must be enabled |
| Valid addresses | IPv4 or IPv6 address, or `0.0.0.0`/`::` for all interfaces |
| Port range | 1-65535 |
| TLS requirement | DoT, DoH, DoQ require TLS settings configured |
| DoH path | Must start with `/`, e.g., `/dns-query` |

### TLS Settings

| Rule | Description |
|------|-------------|
| Path validation | Cert and key paths must be absolute |
| File existence | Files must exist when not using self-signed |
| PEM format | Certificate and key must be PEM-encoded |
| Key format | Private key must be unencrypted (no passphrase) |

### AutoTLS Settings

| Rule | Description |
|------|-------------|
| Domain required | Must provide valid domain name when enabled |
| Email required | Must provide contact email when enabled |
| Cache dir required | Must specify cache directory path |
| Port 80 requirement | HTTP server must listen on port 80 for challenges |

## Monitoring Configuration Changes

### Dashboard

Real-time status visible on dashboard:
- **Protocol Status**: Green (running), Red (stopped), Gray (disabled)
- **Certificate Expiry**: Days remaining, orange warning if < 30 days
- **Certificate Type**: Let's Encrypt, Self-Signed, or Custom
- **SSE Updates**: Status refreshes every 2 seconds

### Logs

Configuration changes are logged:
- **HTTP/Web**: `/logs/http.log`
- **DNS**: `/logs/dns.log`
- **Audit**: Security-sensitive changes in audit log

Example log entries:
```
2025-12-14 10:30:15 INFO [Settings] Web settings updated by admin@example.com
2025-12-14 10:30:20 INFO [Settings] DNS settings updated by admin@example.com
2025-12-14 10:30:25 INFO [Settings] DNS server restart initiated by admin@example.com
2025-12-14 10:30:30 INFO [DNS] UDP listener started on 0.0.0.0:53
2025-12-14 10:30:30 INFO [DNS] TCP listener started on 0.0.0.0:53
2025-12-14 10:30:31 INFO [DNS] DoT listener started on 0.0.0.0:853
```

### Audit Trail

All configuration changes are audited:
- **User**: Who made the change
- **Action**: What was changed
- **Timestamp**: When the change occurred
- **Details**: Previous and new values (sensitive data redacted)

View audit log: Navigate to Admin → Audit Logs (if implemented)

## Best Practices

### Development Environment

1. Use self-signed certificates for HTTPS
2. Keep HTTP enabled for easier debugging
3. Disable HSTS (avoids browser caching issues)
4. Use high ports (8080, 8443) to avoid root requirements

### Staging Environment

1. Use Let's Encrypt staging for testing AutoTLS
2. Enable HTTP redirect once HTTPS works
3. Test HSTS with short max-age (300 seconds)
4. Monitor certificate renewal behavior

### Production Environment

1. Use Let's Encrypt production (or valid CA certificate)
2. Enable HTTP redirect to enforce HTTPS
3. Enable HSTS with long max-age (31536000 seconds = 1 year)
4. Monitor certificate expiry (< 30 days warning)
5. Enable all DNS protocols for maximum compatibility
6. Document port configurations and firewall rules

### Configuration Backup

Settings are stored in the database. Back up regularly:
```bash
# SQLite
sqlite3 codexdns.db ".dump server_settings" > settings_backup.sql

# Restore
sqlite3 codexdns.db < settings_backup.sql
```

### Testing Configuration Changes

1. **Test in non-production first**: Avoid breaking live services
2. **Verify DNS changes**: Use `dig`, `nslookup`, `kdig` to test protocols
3. **Verify HTTPS changes**: Use browser and `curl` to test redirects and HSTS
4. **Monitor logs**: Watch `/logs/*.log` for errors after changes
5. **Check dashboard**: Verify protocol status badges show expected state

## Troubleshooting

### Settings Not Taking Effect

**Problem**: Changed settings via API but nothing happens.

**Solution**:
1. Check API response for validation errors
2. For DNS changes, restart DNS server
3. Verify settings saved: GET /api/settings/server
4. Check logs for error messages

### DNS Restart Fails

**Problem**: "DNS server restart initiated" but services don't restart.

**Solution**:
1. Check `/logs/dns.log` for specific errors
2. Verify TLS certificate exists (for encrypted protocols)
3. Verify ports not in use by other services
4. Check user has permission to bind to ports

### Configuration Reverting

**Problem**: Settings revert to defaults after application restart.

**Solution**:
- Settings are persisted in database and should survive restarts
- Check database connectivity
- Verify `server_settings` table exists and contains data
- Check for errors in `/logs/http.log` during startup

### Permission Denied

**Problem**: "Permission denied" when changing settings.

**Solution**:
- Verify user has `admin.users.manage` permission
- Check authentication: Session must be valid
- Admin account must have appropriate role/profile

## Additional Resources

- [Multi-Protocol DNS Configuration](multi-protocol-dns.md)
- [HTTPS Web Server Configuration](https-web-server.md)
- [Certificate Management](../README.md#certificates)
- [API Documentation](../README.md#api)
