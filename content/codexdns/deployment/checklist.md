---
title: "Production Checklist"
description: "Pre-launch checklist for deploying CodexDNS in production."
weight: 10
---

# Production Deployment Checklist

Use this checklist for every new production deployment or major upgrade. Work through each section in order.

---

## 1. Pre-Deployment Planning

- [ ] **Choose an installation method**: Docker (recommended), APK (Alpine Linux), DEB (Debian/Ubuntu), or RPM (RHEL/Fedora/Oracle Linux). See [Package Formats](packaging) and [Docker](../installation/docker) docs.
- [ ] **Review breaking changes** in [CHANGELOG.md](https://github.com/marcuoli/codexdns/blob/main/CHANGELOG.md) since your current version.
- [ ] **Back up the database** before upgrading an existing installation:

```bash
# SQLite
cp /var/lib/codexdns/codexdns.db \
   /var/lib/codexdns/codexdns.db.backup.$(date +%Y%m%d-%H%M%S)
```

- [ ] **Plan a maintenance window** — DNS queries will be briefly interrupted when the service restarts.
- [ ] **Prepare a rollback path**: keep the previous binary/package accessible and the database backup safe.

---

## 2. System Prerequisites

- [ ] **OS**: Alpine Linux 3.18+, Debian 12+, Ubuntu 22.04+, RHEL/Oracle Linux 9+, or any Linux with Docker.
- [ ] **RAM**: minimum 256 MB; recommended 512 MB+ for in-memory cache and filter lists.
- [ ] **Disk**: minimum 500 MB for the binary, database, and logs; more for large filter lists or long log retention.
- [ ] **Ports available** on the host:

| Port | Protocol | Service |
|------|----------|---------|
| `8080` | TCP | Web UI / API (customizable) |
| `53` | UDP + TCP | DNS (UDP + TCP) |
| `853` | TCP | DNS-over-TLS (DoT) — if enabled |
| `443` | TCP | DNS-over-HTTPS (DoH) — if enabled |
| `853` | UDP | DNS-over-QUIC (DoQ) — if enabled |
| `123` | UDP | NTP server — if enabled |
| `9190` | TCP | Prometheus metrics — if enabled |
| `6060` | TCP | pprof profiling — **restrict to loopback** |

- [ ] **Redis available** (if using the `redis` cache backend): accessible at the configured `redis_addr`.
- [ ] **Chrony (NTP sync) available** if `ntp_configure_system=true`.
- [ ] **TLS certificates** prepared if enabling HTTPS/DoT/DoH/DoQ with custom certs.

---

## 3. Session Secret

The `session_secret` is **required** in production (`gin_mode=release`). The application **will not start** if it is missing or shorter than 32 characters.

- [ ] **Generate a session secret**:

```bash
openssl rand -hex 32
```

- [ ] **Set it as an environment variable** — never store it in `config.json` committed to source control:

```bash
# systemd
echo "CODEXDNS_SESSION_SECRET=$(openssl rand -hex 32)" >> /etc/codexdns/env

# OpenRC (Alpine)
echo "CODEXDNS_SESSION_SECRET=$(openssl rand -hex 32)" >> /etc/conf.d/codexdns

# Docker / Compose
export CODEXDNS_SESSION_SECRET="$(openssl rand -hex 32)"
```

See [Environment Variables](../configuration/environment-variables) for full details.

---

## 4. Configuration File

- [ ] **Create `/etc/codexdns/config.json`** (or use environment variables only — see [Environment Variables](../configuration/environment-variables)):

```json
{
  "http_port": "8080",
  "gin_mode": "release",
  "db_driver": "sqlite",
  "db_dsn": "/var/lib/codexdns/codexdns.db",
  "log_level": "info",
  "upstream_servers": ["8.8.8.8:53", "1.1.1.1:53"],
  "application_log_path": "/var/log/codexdns/application.log",
  "http_access_log": "/var/log/codexdns/access.log",
  "dns_log_path": "/var/log/codexdns/dns.log",
  "dns_query_log_path": "/var/log/codexdns/dns_queries.log"
}
```

- [ ] **Set `gin_mode` to `release`** — this is mandatory in production and activates the session secret check.
- [ ] **Set log paths** to writable directories. The `logs/` directory is created automatically if it does not exist.
- [ ] **Review all parameters** in [Configuration Parameters Reference](../configuration/parameters) before deploying.

---

## 5. Installation

### Docker

```bash
docker run -d \
  --name codexdns \
  --restart unless-stopped \
  -p 8080:8080 \
  -p 53:53/udp \
  -p 53:53/tcp \
  -v codexdns-data:/app/data \
  -v codexdns-logs:/app/logs \
  -e CODEXDNS_SESSION_SECRET="$(openssl rand -hex 32)" \
  -e CODEXDNS_ADMIN_PASSWORD="ChangeMe123!" \
  -e CODEXDNS_GIN_MODE=release \
  ghcr.io/marcuoli/codexdns:latest
```

See the full [Docker guide](../installation/docker) for Compose configuration, Redis integration, and volume mapping.

### APK (Alpine Linux)

```bash
apk add --allow-untrusted codexdns-<version>-r1.apk
rc-service codexdns start
rc-update add codexdns default
```

### DEB (Debian / Ubuntu)

```bash
dpkg -i codexdns_<version>_amd64.deb
systemctl enable --now codexdns
```

### RPM (RHEL / Oracle Linux / Fedora)

```bash
rpm -i codexdns-<version>.x86_64.rpm
systemctl enable --now codexdns
```

See [Package Formats](packaging) for a full comparison of platform packages.

---

## 6. First Boot & Admin Account

- [ ] **Find the auto-generated admin password** in the startup log if `CODEXDNS_ADMIN_PASSWORD` was not set:

```bash
# Docker
docker logs codexdns 2>&1 | grep -A6 'FIRST-BOOT'

# Systemd
journalctl -u codexdns --no-pager | grep -A6 'FIRST-BOOT'

# OpenRC / file log
grep -A6 'FIRST-BOOT' /var/log/codexdns/application.log
```

- [ ] **Log in** at `http://<host>:8080` with username `admin` and the password above.
- [ ] **Change the admin password** immediately if using the auto-generated one (you will be forced to on first login).
- [ ] **Update the admin email** under **Settings → Profile**.

---

## 7. Security Hardening

### Web Interface

- [ ] **Enable HTTPS** (Settings → Server Settings → Web tab) and disable plain HTTP in production, or at minimum enable HTTP → HTTPS redirect.
- [ ] **Enable HSTS** once HTTPS is confirmed working (Settings → Server Settings → Web tab). Wait at least 24 hours before enabling to avoid locking yourself out.
- [ ] **Use a TLS certificate** from Let's Encrypt (AutoTLS), a trusted CA, or an internal CA. Avoid self-signed certs in production. See [HTTPS configuration](https).
- [ ] **Restrict `session_secret`**: already done in step 3, but verify it is not present in any config file accessible to unprivileged users.

### Monitoring Endpoints

- [ ] **Prometheus** (`prometheus_enabled`): if enabled, set `prometheus_auth_token` and restrict `prometheus_allowed_networks` to your monitoring subnet.
- [ ] **pprof** (`pprof_enabled`): **only enable on loopback** (`127.0.0.1/32`). Never expose pprof to the network in production.

### Network Firewall

- [ ] **Allow DNS traffic** (port `53` UDP+TCP) from all intended client networks.
- [ ] **Restrict the Web UI port** (`8080` / `8443`) to your admin networks — do not expose it to the public internet unless behind a reverse proxy with authentication.
- [ ] **Block pprof and Prometheus ports** at the firewall as a defense-in-depth measure.

### File & Directory Permissions

- [ ] Config file readable only by the `codexdns` service user: `chmod 640 /etc/codexdns/config.json`
- [ ] Database directory owned by service user: `chown codexdns:codexdns /var/lib/codexdns`
- [ ] Log directory writable by service user: `chown codexdns:codexdns /var/log/codexdns`

---

## 8. DNS Configuration

- [ ] **Verify upstream DNS servers** are reachable from the host:

```bash
dig @8.8.8.8 example.com
```

- [ ] **Create at least one authoritative zone** (if managing local DNS) via **DNS → Zones**.
- [ ] **Configure forwarding rules** for any domains that should be resolved by specific upstream servers (e.g. internal corporate domains).
- [ ] **Test DNS resolution** from a client:

```bash
dig @<server-ip> example.com
dig @<server-ip> local.yourdomain.com
```

- [ ] **Enable DNS filtering** if required and import or configure at least one block list via **Filtering → Block Lists**.

---

## 9. Health Check Verification

After the service has been running for at least 2 minutes:

- [ ] **HTTP health endpoint** returns `200 OK`:

```bash
curl -sSf http://localhost:8080/health
# or
curl -sSf http://localhost:8080/healthz
```

- [ ] **DNS is responding** on both UDP and TCP:

```bash
dig @localhost example.com
dig @localhost +tcp example.com
```

- [ ] **Web UI is reachable** and shows the dashboard with green status indicators.
- [ ] **Application log shows no errors**:

```bash
# Systemd
journalctl -u codexdns -n 100 --no-pager | grep -iE "error|fatal|panic"

# File log
tail -100 /var/log/codexdns/application.log | grep -iE "error|fatal|panic"
```

- [ ] **Database migrations completed cleanly** (you will see `all migrations applied` or similar in the startup log — no `dirty` state).

---

## 10. Monitoring & Alerting

- [ ] **Configure a health check** in your monitoring system against `/health` or `/healthz` (HTTP 200 expected).
- [ ] **Monitor port `53`** UDP and TCP connectivity from at least one external probe.
- [ ] **Set up log rotation** — defaults (`log_max_size_mb=100`, `log_max_backups=10`, `log_max_age_days=30`) are suitable for most setups; adjust in config as needed.
- [ ] **Enable Prometheus** and ingest metrics into your monitoring stack if you need DNS query throughput, upstream latency, and cache hit rate dashboards.

---

## 11. Backup Strategy

- [ ] **Database backup**: schedule a daily backup of the SQLite database file. The database is a single file — a simple `cp` or `sqlite3 .backup` command is sufficient.

```bash
# Daily cron example
sqlite3 /var/lib/codexdns/codexdns.db \
  ".backup /backups/codexdns.db.$(date +%Y%m%d)"

# Keep 30 days
find /backups -name "codexdns.db.*" -mtime +30 -delete
```

- [ ] **Config backup**: keep `config.json` and the session secret in a secure secrets manager or encrypted vault.
- [ ] **TLS certificates backup**: back up certificates and keys if managing them manually.

---

## 12. Upgrade Procedure

For future upgrades:

1. **Back up the database** (step 1 of this checklist).
2. **Review the CHANGELOG** for breaking changes.
3. **Replace the binary / upgrade the package**:
   - Docker: `docker pull ghcr.io/marcuoli/codexdns:latest && docker compose up -d`
   - APK: `apk add --allow-untrusted codexdns-<new-version>-r1.apk`
   - DEB: `dpkg -i codexdns_<new-version>_amd64.deb`
   - RPM: `rpm -U codexdns-<new-version>.x86_64.rpm`
4. **Restart the service** — CodexDNS automatically applies any pending database migrations on startup.
5. **Verify** using the health check from step 9.

---

## Post-Deployment Sign-Off

| Check | Pass |
|-------|------|
| `/health` returns HTTP 200 | ☐ |
| `dig @<host>` resolves public domains | ☐ |
| `dig @<host>` resolves local zones (if configured) | ☐ |
| Web UI accessible and dashboard shows green status | ☐ |
| Admin password changed from first-boot default | ☐ |
| HTTPS enabled (or HTTP-only with firewall restriction) | ☐ |
| No `error` / `fatal` lines in application log | ☐ |
| Database backup scheduled | ☐ |
| Monitoring / health check configured | ☐ |

---

## Related Documentation

- [Docker Deployment](../installation/docker)
- [Package Formats](packaging)
- [HTTPS Configuration](https)
- [Configuration Parameters Reference](../configuration/parameters)
- [Environment Variables](../configuration/environment-variables)
- [First-Time Startup](../installation/first-time-startup)
