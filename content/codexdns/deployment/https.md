---
title: "HTTPS Web Server"
description: "Configure TLS/HTTPS for the CodexDNS web interface."
weight: 30
---

# HTTPS Web Server Configuration

CodexDNS includes a built-in HTTPS web server for secure access to the administrative interface.

## Features

### Dual HTTP/HTTPS Operation
- Run HTTP and HTTPS servers simultaneously
- Independent port configuration (default: 8080 HTTP, 8443 HTTPS)
- Automatic HTTP → HTTPS redirect (optional)
- Session persistence across both protocols

### HTTP Strict Transport Security (HSTS)
- Enforce HTTPS connections via browser policy
- Configurable max-age (default: 31536000 seconds = 1 year)
- Prevents downgrade attacks
- Works with browser HSTS preload lists

### TLS Certificate Options
1. **Self-Signed Certificates**: For internal/development use
2. **Custom Certificates**: Provide your own cert/key files
3. **Let's Encrypt (AutoTLS)**: Automatic certificate issuance and renewal

## Configuration

### Web Server Settings

Navigate to **Server Settings → Web tab**:

| Setting | Description | Default |
|---------|-------------|---------|
| HTTP Enabled | Enable HTTP server | `true` |
| HTTP Port | Port for HTTP server (1-65535) | `8080` |
| HTTPS Enabled | Enable HTTPS server | `true` |
| HTTPS Port | Port for HTTPS server (1-65535) | `8443` |
| HTTP → HTTPS Redirect | Redirect all HTTP traffic to HTTPS | `false` |
| HSTS Enabled | Enable HTTP Strict Transport Security | `false` |
| HSTS Max-Age | HSTS policy duration (seconds) | `31536000` |

**Validation Rules**:
- At least one protocol (HTTP or HTTPS) must be enabled
- Ports must be unique (HTTP ≠ HTTPS)
- HTTP redirect requires both HTTP and HTTPS enabled
- HSTS requires HTTPS enabled

### TLS Certificate Settings

Navigate to **Server Settings → TLS tab**:

#### Self-Signed Certificates

For development or internal networks:

1. **Enable**: Check "Use self-signed certificate"
2. **Wildcard**: Optional, covers `*.yourdomain.com`
3. **Generate**: Click "Generate Self-Signed Certificate"
   - Prompts for domain name
   - Creates 365-day certificate
   - Saves to configured cert/key paths

**Note**: Browsers will show security warnings for self-signed certificates. Add exception or install CA certificate to trust.

#### Custom Certificates

For production with existing certificates:

1. **Disable**: Uncheck "Use self-signed certificate"
2. **Certificate Path**: Absolute path to `.crt` or `.pem` file
3. **Key Path**: Absolute path to `.key` file
4. **Wildcard**: Check if certificate is wildcard (optional)

**Requirements**:
- Certificate and key must be PEM-encoded
- Certificate must be valid (not expired)
- Key must be unencrypted (no passphrase)
- Server must have read permission for both files

#### Let's Encrypt (AutoTLS)

Navigate to **Server Settings → AutoTLS tab**:

For automatic certificate management:

1. **Enable AutoTLS**: Check the enable box
2. **Domain**: Your public domain name (e.g., `dns.example.com`)
3. **Email**: Contact email for renewal notifications
4. **Cache Directory**: Where to store certificates (default: `/var/lib/codexdns/autocert`)
5. **Staging**: Use Let's Encrypt staging environment (for testing)

**Requirements**:
- Server must be accessible on port 80 (HTTP-01 challenge)
- Domain must resolve to server's public IP
- Not behind CDN/proxy for initial validation
- Rate limits: 50 certificates/domain/week (production)

**Warning**: Let's Encrypt enforces strict rate limits. Use staging environment for testing!

## Setup Examples

### Internal Network (HTTP Only)

For internal use where HTTPS is not required:

```json
{
  "http_enabled": true,
  "http_port": 8080,
  "https_enabled": false
}
```

Access: `http://your-server.local:8080`

### Development (Self-Signed HTTPS)

For local development with HTTPS:

1. Enable both HTTP and HTTPS
2. Use self-signed certificate
3. No redirect, no HSTS
4. Generate certificate for `localhost`

```json
{
  "http_enabled": true,
  "http_port": 8080,
  "https_enabled": true,
  "https_port": 8443,
  "http_redirect_to_https": false,
  "hsts_enabled": false
}
```

Access: `https://localhost:8443` (accept browser warning)

### Production (Let's Encrypt)

For public-facing production servers:

1. Enable both HTTP (for redirect) and HTTPS
2. Enable AutoTLS with your domain
3. Enable HTTP → HTTPS redirect
4. Enable HSTS

```json
{
  "http_enabled": true,
  "http_port": 80,
  "https_enabled": true,
  "https_port": 443,
  "http_redirect_to_https": true,
  "hsts_enabled": true,
  "hsts_max_age_seconds": 31536000
}
```

AutoTLS Settings:
```json
{
  "enabled": true,
  "domain": "dns.example.com",
  "email": "admin@example.com",
  "cache_dir": "/var/lib/codexdns/autocert",
  "staging": false,
  "auto_renew": true
}
```

Access: `https://dns.example.com` (HTTP redirects automatically)

### Reverse Proxy (HTTPS Termination)

When behind nginx/Apache handling HTTPS:

1. Enable HTTP only
2. Disable HTTPS, redirect, and HSTS
3. Proxy passes HTTP traffic from reverse proxy

```json
{
  "http_enabled": true,
  "http_port": 8080,
  "https_enabled": false
}
```

Nginx configuration example:
```nginx
server {
    listen 443 ssl http2;
    server_name dns.example.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Certificate Management

### Viewing Certificate Info

Dashboard shows certificate details:
- **Subject**: Certificate owner (CN)
- **Issuer**: Who signed the certificate
- **Type**: Let's Encrypt / Self-Signed / Custom
- **Expires**: Days until expiration
- **Warning**: Orange banner if < 30 days

Or via API:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-server.com/api/settings/certificates/info?cert_path=/path/to/cert.pem
```

### Generating Self-Signed Certificates

Via Web UI:
1. Navigate to Server Settings → TLS tab
2. Enable "Use self-signed certificate"
3. Click "Generate Self-Signed Certificate"
4. Enter domain name when prompted
5. Certificate saves to configured paths

Via API:
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "dns.example.com",
    "cert_path": "/etc/codexdns/certs/cert.pem",
    "key_path": "/etc/codexdns/certs/key.pem",
    "wildcard": false,
    "days_valid": 365
  }' \
  https://your-server.com/api/settings/certificates/generate
```

### Certificate Renewal

#### Self-Signed Certificates
- Manually generate new certificate before expiration
- No automatic renewal
- Dashboard warns at < 30 days

#### Custom Certificates
- Renew via your certificate authority
- Replace files at configured paths
- Restart HTTPS server (via API or UI)
- Dashboard warns at < 30 days

#### Let's Encrypt (AutoTLS)
- Automatic renewal at 30 days before expiration
- No manual intervention required
- Renewal notifications sent to configured email
- Monitor renewal status in logs: `/logs/http.log`

### Certificate Expiry Monitoring

Dashboard displays certificate status in real-time:
- **Green**: > 30 days until expiry
- **Orange**: < 30 days until expiry (warning banner)
- **Red**: Expired (HTTPS will fail)

Set up external monitoring:
```bash
# Check certificate expiry via openssl
echo | openssl s_client -connect dns.example.com:443 2>/dev/null \
  | openssl x509 -noout -dates
```

## Security Best Practices

### HTTPS Configuration

1. **Always use HTTPS in production**
   - Protects credentials during login
   - Prevents session hijacking
   - Encrypts sensitive DNS configurations

2. **Enable HTTP → HTTPS redirect**
   - Prevents accidental HTTP access
   - Simplifies user experience

3. **Enable HSTS**
   - Prevents downgrade attacks
   - Forces HTTPS even if user types `http://`
   - Protects against SSL stripping

4. **Use strong certificates**
   - Let's Encrypt for public servers (free, trusted)
   - Valid CA-signed certificates for internal servers
   - Avoid self-signed in production

### TLS Configuration

CodexDNS uses secure TLS defaults:
- **TLS 1.2** minimum (TLS 1.3 preferred)
- **Strong cipher suites** (ECDHE, AES-GCM)
- **Forward secrecy** (ephemeral key exchange)
- **No weak ciphers** (RC4, 3DES, MD5 disabled)

### Port Considerations

**Standard Ports** (require root/capabilities):
- Port 80 (HTTP): Required for Let's Encrypt HTTP-01 challenges
- Port 443 (HTTPS): Standard HTTPS, no port in URL

**High Ports** (no special privileges):
- Port 8080 (HTTP): Common alternative
- Port 8443 (HTTPS): Common alternative, requires port in URL

**Firewall Rules**:
```bash
# Allow HTTPS (standard port)
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow HTTP (for Let's Encrypt)
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
```

### Reverse Proxy Best Practices

When using nginx/Apache in front of CodexDNS:
1. Terminate TLS at reverse proxy
2. Use HTTP between proxy and CodexDNS
3. Set `X-Forwarded-Proto` header for HTTPS detection
4. Enable rate limiting on reverse proxy
5. Use WAF (ModSecurity) for additional protection

## Troubleshooting

### Certificate Errors

**Problem**: Browser shows "NET::ERR_CERT_AUTHORITY_INVALID"

**Solution**:
- Self-signed certificates are not trusted by default
- Add CA certificate to browser's trust store
- Or use Let's Encrypt for publicly trusted certificates

**Problem**: "Certificate expired" error

**Solution**:
- Check certificate expiry: Dashboard → Web Server & TLS card
- Generate new self-signed certificate
- Or enable AutoTLS for automatic renewal

### Let's Encrypt Issues

**Problem**: "Failed to obtain certificate"

**Solution**:
1. Verify port 80 is accessible from internet
2. Check DNS resolution: `dig +short yourdomain.com`
3. Disable CDN/proxy temporarily for initial validation
4. Check rate limits: 50 certs/domain/week
5. Use staging environment for testing

**Problem**: "Rate limit exceeded"

**Solution**:
- Wait 7 days for rate limit reset
- Use staging environment: `staging: true`
- Consider using DNS-01 challenge (requires DNS API)

### Port Binding Errors

**Problem**: "Address already in use"

**Solution**:
- Check if another service uses the port: `lsof -i :PORT`
- Change port in Server Settings
- For ports < 1024, ensure CAP_NET_BIND_SERVICE capability

**Problem**: "Permission denied" on ports < 1024

**Solution**:
```bash
# Run as root
sudo ./codexdns

# Or grant capabilities (Linux)
sudo setcap CAP_NET_BIND_SERVICE=+eip ./codexdns
```

### HSTS Issues

**Problem**: "Can't access HTTP after enabling HSTS"

**Solution**:
- HSTS policy cached in browser for configured max-age
- Clear browser HSTS cache:
  - Chrome: `chrome://net-internals/#hsts` → Delete domain
  - Firefox: Delete `SiteSecurityServiceState.txt` in profile
- Wait for max-age to expire
- Disable HSTS in Server Settings

## Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [HSTS Specification (RFC 6797)](https://tools.ietf.org/html/rfc6797)
- [TLS Best Practices (Mozilla)](https://wiki.mozilla.org/Security/Server_Side_TLS)
- [Certificate Transparency](https://certificate.transparency.dev/)
