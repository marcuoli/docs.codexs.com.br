# Multi-Protocol DNS Configuration

CodexDNS supports multiple DNS protocols simultaneously, allowing clients to query your DNS server using different transport methods.

## Supported Protocols

### UDP (User Datagram Protocol)
- **Port**: 53 (default), configurable
- **Description**: Traditional DNS protocol, fast but connectionless
- **Use Case**: Standard DNS queries from most clients
- **Configuration**: 
  - Enable via web UI: Server Settings → DNS tab → UDP section
  - Or via database: `dns_settings` table, `udp_enabled: true`
- **Client Example**:
  ```bash
  dig @your-server.com example.com
  nslookup example.com your-server.com
  ```

### TCP (Transmission Control Protocol)
- **Port**: 53 (default), configurable
- **Description**: Connection-based DNS protocol, reliable but higher overhead
- **Use Case**: Large DNS responses (> 512 bytes), zone transfers
- **Configuration**:
  - Enable via web UI: Server Settings → DNS tab → TCP section
  - Or via database: `dns_settings` table, `tcp_enabled: true`
- **Client Example**:
  ```bash
  dig +tcp @your-server.com example.com
  ```

### DoT (DNS over TLS)
- **Port**: 853 (standard), configurable
- **Description**: DNS queries encrypted with TLS
- **Use Case**: Privacy-focused clients, enterprise networks
- **Requirements**: 
  - Valid TLS certificate (self-signed, custom, or Let's Encrypt)
  - Configure certificate in Server Settings → TLS tab
- **Configuration**:
  - Enable via web UI: Server Settings → DNS tab → DoT section
  - Requires TLS settings configured first
- **Client Example**:
  ```bash
  # Using kdig (Knot DNS utilities)
  kdig +tls @your-server.com example.com
  
  # Using stubby
  stubby -g -s your-server.com@853#example.com
  ```

### DoH (DNS over HTTPS)
- **Port**: 443 (standard), configurable
- **Path**: `/dns-query` (default), configurable
- **Description**: DNS queries over HTTPS protocol
- **Use Case**: Web browsers (Firefox, Chrome), privacy-focused clients
- **Requirements**:
  - Valid TLS certificate
  - HTTPS web server enabled
- **Configuration**:
  - Enable via web UI: Server Settings → DNS tab → DoH section
  - Configure path (default: `/dns-query`)
  - HTTP/3 support optional (requires additional setup)
- **Client Example**:
  ```bash
  # Using curl
  curl -H 'accept: application/dns-json' \
    'https://your-server.com/dns-query?name=example.com&type=A'
  
  # Firefox configuration
  about:config → network.trr.uri = https://your-server.com/dns-query
  
  # Chrome configuration
  chrome://settings → Privacy and security → Use secure DNS
  → With: https://your-server.com/dns-query
  ```

### DoQ (DNS over QUIC)
- **Port**: 853 (standard), configurable
- **Description**: DNS queries over QUIC protocol (UDP-based, HTTP/3)
- **Use Case**: Modern clients requiring low latency and multiplexing
- **Requirements**:
  - Valid TLS certificate
  - QUIC protocol support
- **Configuration**:
  - Enable via web UI: Server Settings → DNS tab → DoQ section
  - Requires TLS settings configured first
- **Client Example**:
  ```bash
  # Using q (DoQ client)
  q example.com @quic://your-server.com
  ```

## Multi-Protocol Setup

### Recommended Configuration

For maximum compatibility and security, enable all protocols:

1. **UDP + TCP** (ports 53): Legacy and standard clients
2. **DoT** (port 853): Privacy-focused desktop clients
3. **DoH** (port 443): Web browsers and mobile apps
4. **DoQ** (port 853): Modern, low-latency clients

### Firewall Rules

Ensure your firewall allows inbound traffic on:
- UDP/TCP port 53 (UDP and TCP protocols)
- TCP port 853 (DoT)
- TCP port 443 (DoH, HTTPS web UI)
- UDP port 853 (DoQ)

Example `iptables` rules:
```bash
# UDP DNS
iptables -A INPUT -p udp --dport 53 -j ACCEPT

# TCP DNS
iptables -A INPUT -p tcp --dport 53 -j ACCEPT

# DoT
iptables -A INPUT -p tcp --dport 853 -j ACCEPT

# DoH (HTTPS)
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# DoQ
iptables -A INPUT -p udp --dport 853 -j ACCEPT
```

### Performance Considerations

- **UDP**: Fastest, lowest overhead, no connection state
- **TCP**: Slower than UDP, connection overhead, reliable delivery
- **DoT**: TLS handshake overhead, encrypted, slightly slower than TCP
- **DoH**: HTTPS overhead (headers), multiplexing benefits, encrypted
- **DoQ**: Low latency, connection migration, encrypted, best for modern clients

### Client Compatibility

| Protocol | Windows | Linux | macOS | iOS | Android | Browsers |
|----------|---------|-------|-------|-----|---------|----------|
| UDP      | ✅      | ✅    | ✅    | ✅  | ✅      | ✅       |
| TCP      | ✅      | ✅    | ✅    | ✅  | ✅      | ✅       |
| DoT      | ✅*     | ✅    | ✅    | ✅  | ✅      | ❌       |
| DoH      | ✅      | ✅    | ✅    | ✅  | ✅      | ✅       |
| DoQ      | ❌      | ✅*   | ❌    | ❌  | ❌      | ❌       |

*Requires third-party client software

## Runtime Configuration

All DNS protocol settings are configurable at runtime via:

1. **Web UI**: `/admin/server-settings` → DNS tab
2. **API**: `POST /api/settings/server/dns`

Changes take effect after DNS server restart (available in Web UI or API).

## Monitoring

Protocol status is visible on the dashboard:
- Green badge: Protocol running
- Red badge: Protocol stopped (enabled but server not running)
- Gray badge: Protocol disabled
- Real-time SSE updates every 2 seconds

## Troubleshooting

### DoT/DoH/DoQ Not Starting

**Problem**: Encrypted protocols show "stopped" status despite being enabled.

**Solution**:
1. Verify TLS certificate is configured: Server Settings → TLS tab
2. Check certificate paths exist and are readable
3. Ensure certificate is valid (not expired)
4. Check logs: `/logs/dns.log` for specific errors

### Certificate Errors

**Problem**: Clients report certificate validation errors.

**Solution**:
1. Use Let's Encrypt for publicly trusted certificates
2. For self-signed certificates, clients must trust the CA
3. Ensure certificate CN or SAN matches server hostname
4. Check certificate expiry: Dashboard → Web Server & TLS card

### Port Conflicts

**Problem**: Protocol fails to start due to port already in use.

**Solution**:
1. Change the port in Server Settings → DNS tab
2. Verify no other service is using the port: `lsof -i :PORT` (Linux)
3. For ports < 1024, ensure CodexDNS runs as root or has CAP_NET_BIND_SERVICE

### Performance Issues

**Problem**: DoH queries are slow.

**Solution**:
1. Enable HTTP/3: Server Settings → DNS tab → DoH → Enable HTTP/3
2. Increase connection limits in web server settings
3. Consider using DoT or DoQ for lower overhead
4. Check upstream server performance: Dashboard → Upstream Servers

## Security Best Practices

1. **Use encrypted protocols** (DoT/DoH/DoQ) for public-facing servers
2. **Enable HTTPS redirect** to prevent downgrade attacks
3. **Use Let's Encrypt** for automatic certificate renewal
4. **Monitor certificate expiry** (dashboard shows warnings at < 30 days)
5. **Restrict UDP/TCP** to internal networks if possible
6. **Enable HSTS** for web interface security
7. **Use strong TLS cipher suites** (configured automatically)

## Additional Resources

- [RFC 7858 - DNS over TLS](https://tools.ietf.org/html/rfc7858)
- [RFC 8484 - DNS over HTTPS](https://tools.ietf.org/html/rfc8484)
- [RFC 9250 - DNS over QUIC](https://tools.ietf.org/html/rfc9250)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [QUIC Protocol](https://www.chromium.org/quic/)
