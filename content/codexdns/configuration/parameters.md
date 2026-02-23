---
title: "Configuration Parameters Reference"
description: "Complete reference for all CodexDNS configuration file parameters, organized by group."
weight: 40
---

# Configuration Parameters Reference

This page is the complete reference for every parameter accepted by the CodexDNS JSON configuration file (default: `config.json`). Parameters are organized by functional group.

Every parameter can also be set via an environment variable — see [Environment Variables](environment-variables.md) for the naming convention and special variables.

The JSON config file is the **bootstrap source**: it is read once at startup. A subset of settings can also be changed at runtime via the Web UI without restarting — see [Runtime Configuration](runtime.md).

---

## Server

Core startup addresses and ports.

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `http_port` | `string` | `8080` | `CODEXDNS_HTTP_PORT` | Port for the web UI and REST API |
| `dns_host` | `string` | `0.0.0.0` | `CODEXDNS_DNS_HOST` | IP address the DNS server binds to |
| `dns_port` | `string` | `53` | `CODEXDNS_DNS_PORT` | Port for the DNS server (UDP and TCP) |

---

## Web Server (HTTP / HTTPS)

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `http_enabled` | `bool` | `true` | `CODEXDNS_HTTP_ENABLED` | Enable the HTTP web server |
| `https_enabled` | `bool` | `false` | `CODEXDNS_HTTPS_ENABLED` | Enable the HTTPS web server |
| `https_port` | `int` | `8443` | `CODEXDNS_HTTPS_PORT` | HTTPS port number |
| `https_cert_path` | `string` | — | `CODEXDNS_HTTPS_CERT_PATH` | Certificate file for the HTTPS listener (overrides `tls_cert_path`) |
| `https_key_path` | `string` | — | `CODEXDNS_HTTPS_KEY_PATH` | Private key for the HTTPS listener (overrides `tls_key_path`) |
| `http_redirect_to_https` | `bool` | `false` | `CODEXDNS_HTTP_REDIRECT_TO_HTTPS` | Redirect all HTTP requests to HTTPS |
| `hsts_enabled` | `bool` | `false` | `CODEXDNS_HSTS_ENABLED` | Send `Strict-Transport-Security` headers |
| `hsts_max_age_seconds` | `int` | `31536000` | `CODEXDNS_HSTS_MAX_AGE_SECONDS` | `max-age` value for HSTS header (seconds) |
| `gin_mode` | `string` | `release` | `CODEXDNS_GIN_MODE` | Gin framework mode: `debug`, `release`, or `test`. Use `release` in production |
| `session_secret` | `string` | — | `CODEXDNS_SESSION_SECRET` | **Secret key for signing sessions (minimum 32 characters). Set via env var only — never store in config file.** Required in production; startup aborts if missing or too short. Generate: `openssl rand -hex 32` |

---

## TLS Certificates

Default certificate paths shared across all encrypted services (DoT, DoH, DoQ, HTTPS). Per-service overrides take precedence when set.

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `tls_cert_path` | `string` | — | `CODEXDNS_TLS_CERT_PATH` | Default TLS certificate file (PEM) |
| `tls_key_path` | `string` | — | `CODEXDNS_TLS_KEY_PATH` | Default TLS private key file (PEM) |
| `tls_use_wildcard` | `bool` | `false` | `CODEXDNS_TLS_USE_WILDCARD` | Use a wildcard certificate |
| `tls_use_self_signed` | `bool` | `false` | `CODEXDNS_TLS_USE_SELF_SIGNED` | Use a self-signed certificate |

---

## Auto TLS (Let's Encrypt)

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `auto_tls_enabled` | `bool` | `false` | `CODEXDNS_AUTO_TLS_ENABLED` | Enable automatic certificate management via Let's Encrypt |
| `auto_tls_domain` | `string` | — | `CODEXDNS_AUTO_TLS_DOMAIN` | Primary domain for the certificate (FQDN) |
| `auto_tls_email` | `string` | — | `CODEXDNS_AUTO_TLS_EMAIL` | Contact email for expiry notifications |
| `auto_tls_cache_dir` | `string` | `./certs/autocert` | `CODEXDNS_AUTO_TLS_CACHE_DIR` | Directory to store issued certificates |
| `auto_tls_staging` | `bool` | `false` | `CODEXDNS_AUTO_TLS_STAGING` | Use Let's Encrypt staging environment (for testing) |
| `auto_tls_auto_renew` | `bool` | `true` | `CODEXDNS_AUTO_TLS_AUTO_RENEW` | Automatically renew certificates before expiry |

---

## DNS Protocols

### UDP

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `udp_enabled` | `bool` | `true` | `CODEXDNS_UDP_ENABLED` | Enable DNS over UDP |
| `udp_address` | `string` | `0.0.0.0` | `CODEXDNS_UDP_ADDRESS` | UDP listen address |
| `udp_port` | `int` | `53` | `CODEXDNS_UDP_PORT` | UDP port number |

### TCP

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `tcp_enabled` | `bool` | `true` | `CODEXDNS_TCP_ENABLED` | Enable DNS over TCP |
| `tcp_address` | `string` | `0.0.0.0` | `CODEXDNS_TCP_ADDRESS` | TCP listen address |
| `tcp_port` | `int` | `53` | `CODEXDNS_TCP_PORT` | TCP port number |

### DNS-over-TLS (DoT)

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `dot_enabled` | `bool` | `false` | `CODEXDNS_DOT_ENABLED` | Enable DNS-over-TLS |
| `dot_address` | `string` | `0.0.0.0` | `CODEXDNS_DOT_ADDRESS` | DoT listen address |
| `dot_port` | `int` | `853` | `CODEXDNS_DOT_PORT` | DoT port number |
| `dot_cert_path` | `string` | — | `CODEXDNS_DOT_CERT_PATH` | Certificate for DoT (falls back to `tls_cert_path`) |
| `dot_key_path` | `string` | — | `CODEXDNS_DOT_KEY_PATH` | Private key for DoT (falls back to `tls_key_path`) |

### DNS-over-HTTPS (DoH)

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `doh_enabled` | `bool` | `false` | `CODEXDNS_DOH_ENABLED` | Enable DNS-over-HTTPS |
| `doh_address` | `string` | `0.0.0.0` | `CODEXDNS_DOH_ADDRESS` | DoH listen address |
| `doh_port` | `int` | `443` | `CODEXDNS_DOH_PORT` | DoH port number |
| `doh_path` | `string` | `/dns-query` | `CODEXDNS_DOH_PATH` | URL path for the DoH endpoint |
| `doh_http3_enabled` | `bool` | `false` | `CODEXDNS_DOH_HTTP3_ENABLED` | Enable HTTP/3 (QUIC) for DoH |
| `doh_cert_path` | `string` | — | `CODEXDNS_DOH_CERT_PATH` | Certificate for DoH (falls back to `tls_cert_path`) |
| `doh_key_path` | `string` | — | `CODEXDNS_DOH_KEY_PATH` | Private key for DoH (falls back to `tls_key_path`) |

### DNS-over-QUIC (DoQ)

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `doq_enabled` | `bool` | `false` | `CODEXDNS_DOQ_ENABLED` | Enable DNS-over-QUIC |
| `doq_address` | `string` | `0.0.0.0` | `CODEXDNS_DOQ_ADDRESS` | DoQ listen address |
| `doq_port` | `int` | `853` | `CODEXDNS_DOQ_PORT` | DoQ port number |
| `doq_cert_path` | `string` | — | `CODEXDNS_DOQ_CERT_PATH` | Certificate for DoQ (falls back to `tls_cert_path`) |
| `doq_key_path` | `string` | — | `CODEXDNS_DOQ_KEY_PATH` | Private key for DoQ (falls back to `tls_key_path`) |

---

## DNS Server Tuning

Advanced parameters controlling DNS server concurrency, timeouts, and connection pooling.

| Key | Type | Default | Range | Env Var | Description |
|-----|------|---------|-------|---------|-------------|
| `dns_query_timeout_ms` | `int` | `5000` | 100–600000 | `CODEXDNS_DNS_QUERY_TIMEOUT_MS` | Maximum time (ms) to process a DNS query before timing out |
| `dns_tcp_read_timeout_ms` | `int` | `5000` | 100–600000 | `CODEXDNS_DNS_TCP_READ_TIMEOUT_MS` | Maximum time (ms) to read a DNS query over TCP |
| `dns_tcp_write_timeout_ms` | `int` | `5000` | 100–600000 | `CODEXDNS_DNS_TCP_WRITE_TIMEOUT_MS` | Maximum time (ms) to write a DNS response over TCP |
| `dns_tcp_idle_timeout_ms` | `int` | `30000` | 100–600000 | `CODEXDNS_DNS_TCP_IDLE_TIMEOUT_MS` | Maximum idle time (ms) before closing a TCP connection |
| `dns_max_concurrent_queries` | `int` | `5000` | 1–100000 | `CODEXDNS_DNS_MAX_CONCURRENT_QUERIES` | Maximum simultaneous DNS query handlers; requests are dropped above this limit |
| `dns_goroutine_warn_threshold` | `int` | `3000` | 100–200000 | `CODEXDNS_DNS_GOROUTINE_WARN_THRESHOLD` | Log a warning when total goroutine count exceeds this value |
| `dns_upstream_max_concurrent` | `int` | `200` | 0–100000 | `CODEXDNS_DNS_UPSTREAM_MAX_CONCURRENT` | Maximum in-flight queries per upstream server (0 = unlimited) |
| `dns_upstream_pool_min` | `int` | `0` | 0–1000 | `CODEXDNS_DNS_UPSTREAM_POOL_MIN` | Minimum idle DoT connections to keep per upstream server (0 = no warm pool) |
| `dns_upstream_pool_max` | `int` | `4` | 0–1000 | `CODEXDNS_DNS_UPSTREAM_POOL_MAX` | Maximum idle DoT connections to keep per upstream server (0 = disable pooling) |

---

## Upstream DNS

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `upstream_servers` | `[]string` | `["8.8.8.8:53", "1.1.1.1:53"]` | `CODEXDNS_UPSTREAM_SERVERS` | DNS servers to forward queries to when no local authoritative record is found |
| `upstream_strategy` | `string` | `ordered` | `CODEXDNS_UPSTREAM_STRATEGY` | Server selection strategy: `ordered`, `round-robin`, `fastest-response`, `lowest-latency` |
| `upstream_timeout` | `int` | `5000` | `CODEXDNS_UPSTREAM_TIMEOUT` | Timeout (ms) for upstream DNS queries (100–30000) |
| `edns0_udp_size` | `int` | `1232` | `CODEXDNS_EDNS0_UDP_SIZE` | EDNS0 UDP payload size advertised to upstream servers (512–4096). Recommended: 1232 |
| `local_records_override` | `bool` | `false` | `CODEXDNS_LOCAL_RECORDS_OVERRIDE` | Check local authoritative records before forwarding to upstream |
| `latency_measurement_interval` | `int` | `30` | `CODEXDNS_LATENCY_MEASUREMENT_INTERVAL` | Seconds between upstream latency probes (10–300) |

---

## Cache

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `cache_enabled` | `bool` | `true` | `CODEXDNS_CACHE_ENABLED` | Enable DNS response caching |
| `cache_backend` | `string` | `redis` | `CODEXDNS_CACHE_BACKEND` | Cache backend: `redis`, `memory`, or `none` |
| `cache_forwarded_requests` | `bool` | `true` | `CODEXDNS_CACHE_FORWARDED_REQUESTS` | Cache forwarded (non-authoritative) query responses |
| `cache_ttl` | `int` | `300` | `CODEXDNS_CACHE_TTL` | Default TTL (s) for cached entries (1–86400) |
| `cache_negative_ttl` | `int` | `60` | `CODEXDNS_CACHE_NEGATIVE_TTL` | TTL (s) for NXDOMAIN and empty responses (0 = use `cache_ttl`) |
| `cache_max_size` | `int` | `10000` | `CODEXDNS_CACHE_MAX_SIZE` | Maximum number of cached entries |
| `cache_memory_max_mb` | `int` | `100` | `CODEXDNS_CACHE_MEMORY_MAX_MB` | Maximum memory (MB) for the `memory` cache backend |
| `cache_eviction_policy` | `string` | `allkeys-lru` | `CODEXDNS_CACHE_EVICTION_POLICY` | Redis eviction policy when memory limit is reached. Options: `allkeys-lru`, `allkeys-lfu`, `allkeys-random`, `volatile-lru`, `volatile-lfu`, `volatile-random`, `volatile-ttl`, `noeviction` |
| `cache_local_lru_enabled` | `bool` | `true` | `CODEXDNS_CACHE_LOCAL_LRU_ENABLED` | Enable in-process LRU layer to short-circuit Redis for hot keys |
| `cache_local_lru_max_entries` | `int` | `2048` | `CODEXDNS_CACHE_LOCAL_LRU_MAX_ENTRIES` | Maximum entries in the in-process LRU cache |
| `cache_local_lru_ttl` | `int` | `5` | `CODEXDNS_CACHE_LOCAL_LRU_TTL` | TTL (s) for in-process LRU entries (1–3600) |
| `cache_redis_dial_timeout_ms` | `int` | `2000` | `CODEXDNS_CACHE_REDIS_DIAL_TIMEOUT_MS` | Redis connection dial timeout (ms) (100–10000) |
| `cache_redis_read_timeout_ms` | `int` | `1000` | `CODEXDNS_CACHE_REDIS_READ_TIMEOUT_MS` | Redis read timeout (ms) (100–10000) |
| `cache_redis_write_timeout_ms` | `int` | `1000` | `CODEXDNS_CACHE_REDIS_WRITE_TIMEOUT_MS` | Redis write timeout (ms) (100–10000) |
| `cache_warmup_enabled` | `bool` | `true` | `CODEXDNS_CACHE_WARMUP_ENABLED` | Pre-populate the cache on startup from most-queried domains |
| `cache_warmup_domains` | `int` | `100` | `CODEXDNS_CACHE_WARMUP_DOMAINS` | Number of top domains to pre-warm on startup (1–1000) |

---

## Database & Redis

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `db_driver` | `string` | `sqlite` | `CODEXDNS_DB_DRIVER` | Database backend: `sqlite`, `postgres`, `mysql`, `oracle` |
| `db_dsn` | `string` | `codexdns.db` | `CODEXDNS_DB_DSN` | Connection string for the chosen database backend. For SQLite: file path. For others: standard DSN |
| `redis_addr` | `string` | `localhost:6379` | `CODEXDNS_REDIS_ADDR` | Redis server address (`host:port`) used for the `redis` cache backend |

---

## Logging

### Log Paths

Each subsystem writes to its own log file. Paths are relative to the application working directory unless absolute.

| Key | Default | Env Var | Description |
|-----|---------|---------|-------------|
| `application_log_path` | `logs/application.log` | `CODEXDNS_APPLICATION_LOG_PATH` | General application logs (HTTP server, config, auth, services) |
| `http_access_log` | `logs/access.log` | `CODEXDNS_HTTP_ACCESS_LOG` | HTTP requests, status codes, response times |
| `http_error_log` | `logs/error.log` | `CODEXDNS_HTTP_ERROR_LOG` | HTTP errors, exceptions, middleware failures |
| `dns_log_path` | `logs/dns.log` | `CODEXDNS_DNS_LOG_PATH` | DNS server start/stop, listener binding, protocol events |
| `dns_query_log_path` | `logs/dns_queries.log` | `CODEXDNS_DNS_QUERY_LOG_PATH` | DNS query resolution, zone lookups, upstream forwarding |
| `dns_query_failed_log_path` | — *(disabled)* | `CODEXDNS_DNS_QUERY_FAILED_LOG_PATH` | Failed DNS queries (upstream timeouts, SERVFAIL, errors). Leave empty to disable |
| `dhcp_log_path` | `logs/dhcp.log` | `CODEXDNS_DHCP_LOG_PATH` | DHCP requests, leases, lifecycle events |
| `dhcp_dns_log_path` | `logs/dhcp_dns.log` | `CODEXDNS_DHCP_DNS_LOG_PATH` | RFC 2136 dynamic DNS updates from DHCP |
| `ntp_log_path` | `logs/ntp.log` | `CODEXDNS_NTP_LOG_PATH` | NTP server operations, time sync, lifecycle events |
| `ntp_query_log_path` | — *(disabled)* | `CODEXDNS_NTP_QUERY_LOG_PATH` | Individual NTP client requests and responses |
| `cleanup_log_path` | `logs/cleanup.log` | `CODEXDNS_CLEANUP_LOG_PATH` | Database cleanup/purge operations |
| `db_log_path` | — *(disabled)* | `CODEXDNS_DB_LOG_PATH` | SQL queries and execution times |
| `filter_log_path` | `logs/filter.log` | `CODEXDNS_FILTER_LOG_PATH` | Blocklist/allowlist matches, policy decisions, filter cache operations |

### Log Rotation

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `log_level` | `string` | `info` | `CODEXDNS_LOG_LEVEL` | Global log level: `debug`, `info`, `warn`, `error` |
| `log_max_size_mb` | `int` | `100` | `CODEXDNS_LOG_MAX_SIZE_MB` | Rotate log files when they exceed this size in MB (0 = disabled, max 10000) |
| `log_max_backups` | `int` | `10` | `CODEXDNS_LOG_MAX_BACKUPS` | Number of rotated backup files to keep (0 = unlimited) |
| `log_max_age_days` | `int` | `30` | `CODEXDNS_LOG_MAX_AGE_DAYS` | Delete backup files older than this many days (0 = disabled) |
| `log_compress_method` | `string` | `gzip` | `CODEXDNS_LOG_COMPRESS_METHOD` | Compression for rotated files: `none` or `gzip` |

> **Note:** `log_compress` (boolean) is deprecated. Use `log_compress_method` instead.

---

## Debug Flags

Enable verbose diagnostic logging for individual subsystems without changing the global log level.

| Key | Default | Env Var | Description |
|-----|---------|---------|-------------|
| `debug_dns` | `false` | `CODEXDNS_DEBUG_DNS` | Verbose logging for DNS server operations |
| `debug_resolver` | `false` | `CODEXDNS_DEBUG_RESOLVER` | Verbose logging for DNS resolver activity |
| `debug_discovery` | `false` | `CODEXDNS_DEBUG_DISCOVERY` | Verbose logging for hostname discovery (reverse DNS, NetBIOS, mDNS, LLMNR) |
| `debug_cache` | `false` | `CODEXDNS_DEBUG_CACHE` | Verbose logging for cache operations |
| `debug_http` | `false` | `CODEXDNS_DEBUG_HTTP` | Verbose logging for HTTP requests and middleware |
| `debug_ntp` | `false` | `CODEXDNS_DEBUG_NTP` | Verbose logging for NTP server operations |
| `debug_dhcp` | `false` | `CODEXDNS_DEBUG_DHCP` | Verbose logging for DHCP server operations |
| `debug_dhcp_dns` | `false` | `CODEXDNS_DEBUG_DHCP_DNS` | Verbose logging for DHCP-DNS integration and dynamic record updates |
| `debug_auth` | `false` | `CODEXDNS_DEBUG_AUTH` | Verbose logging for authentication and permission checks |
| `debug_latency` | `false` | `CODEXDNS_DEBUG_LATENCY` | Verbose logging for upstream latency measurements |
| `debug_db` | `false` | `CODEXDNS_DEBUG_DB` | Log all SQL queries and execution times |
| `debug_cleanup` | `false` | `CODEXDNS_DEBUG_CLEANUP` | Verbose logging for database cleanup operations |
| `disable_limits` | `false` | `CODEXDNS_DISABLE_LIMITS` | **Disable all DNS concurrency and throttling limits. For load/stress testing only — never use in production** |

---

## Monitoring

### Prometheus

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `prometheus_enabled` | `bool` | `false` | `CODEXDNS_PROMETHEUS_ENABLED` | Enable Prometheus `/metrics` endpoint on a dedicated port |
| `prometheus_port` | `int` | `9190` | `CODEXDNS_PROMETHEUS_PORT` | Port for the Prometheus metrics endpoint |
| `prometheus_path` | `string` | `/metrics` | `CODEXDNS_PROMETHEUS_PATH` | URL path for the metrics endpoint |
| `prometheus_auth_token` | `string` | — | `CODEXDNS_PROMETHEUS_AUTH_TOKEN` | Optional Bearer token for metrics endpoint authentication. Leave empty for public access |
| `prometheus_allowed_networks` | `string` | — | `CODEXDNS_PROMETHEUS_ALLOWED_NETWORKS` | CIDR networks allowed to scrape metrics (newline-separated). Leave empty to allow any source |
| `prometheus_use_forwarded_for` | `bool` | `false` | `CODEXDNS_PROMETHEUS_USE_FORWARDED_FOR` | Parse `X-Forwarded-For` header for client IP detection (reverse proxy deployments) |

### pprof

> ⚠️ **Security:** Never expose pprof publicly in production. Restrict access via `pprof_allowed_networks`.

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `pprof_enabled` | `bool` | `false` | `CODEXDNS_PPROF_ENABLED` | Enable Go pprof profiling endpoint on a dedicated port |
| `pprof_port` | `int` | `6060` | `CODEXDNS_PPROF_PORT` | Port for the pprof endpoint |
| `pprof_allowed_networks` | `string` | `127.0.0.1/8` | `CODEXDNS_PPROF_ALLOWED_NETWORKS` | CIDR networks allowed to access pprof (newline-separated). Leave empty to allow any source |

---

## NTP Server

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `ntp_enabled` | `bool` | `false` | `CODEXDNS_NTP_ENABLED` | Enable the built-in NTP server (RFC 5905) |
| `ntp_listen_address` | `string` | `0.0.0.0` | `CODEXDNS_NTP_LISTEN_ADDRESS` | IP address the NTP server binds to |
| `ntp_listen_port` | `int` | `123` | `CODEXDNS_NTP_LISTEN_PORT` | UDP port for the NTP server |
| `ntp_protocol` | `string` | `ipv4` | `CODEXDNS_NTP_PROTOCOL` | IP protocol version: `ipv4`, `ipv6`, or `both` |
| `ntp_time_sync_enabled` | `bool` | `false` | `CODEXDNS_NTP_TIME_SYNC_ENABLED` | Enable upstream NTP time synchronization |
| `ntp_time_sync_server` | `string` | `pool.ntp.org:123` | `CODEXDNS_NTP_TIME_SYNC_SERVER` | Upstream NTP server (`host:port`) used to keep the system time updated |
| `ntp_configure_system` | `bool` | `false` | `CODEXDNS_NTP_CONFIGURE_SYSTEM` | Write `/etc/chrony/chrony.conf` and start `chronyd`. Requires root on Linux |

---

## Localization

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `timezone` | `string` | *(system default)* | `CODEXDNS_TIMEZONE` | IANA timezone name for timestamp formatting (e.g. `UTC`, `America/Sao_Paulo`). Leave empty to use the system timezone |

---

## DHCP Built-in Server

> **Note:** The built-in DHCP server is not yet fully implemented. This flag is locked to `false` in the UI.

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `dhcp_enabled` | `bool` | `false` | `CODEXDNS_DHCP_ENABLED` | Enable the built-in DHCP server (not yet available) |

---

## DHCP Integration (RFC 2136 Dynamic DNS)

Accepts dynamic DNS update requests from external DHCP servers via RFC 2136.

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `dhcp_int_enabled` | `bool` | `false` | `CODEXDNS_DHCP_INT_ENABLED` | Enable RFC 2136 dynamic DNS updates from external DHCP servers |
| `dhcp_int_domain` | `string` | — | `CODEXDNS_DHCP_INT_DOMAIN` | Domain for DHCP client registrations (e.g. `lan.example.com`) |
| `dhcp_int_listen_address` | `string` | `0.0.0.0` | `CODEXDNS_DHCP_INT_LISTEN_ADDRESS` | IP address to accept DHCP-DNS update requests. Leave empty to use the main DNS address |
| `dhcp_int_key_name` | `string` | — | `CODEXDNS_DHCP_INT_KEY_NAME` | TSIG key name configured in your DHCP server |
| `dhcp_int_key_secret` | `string` | — | `CODEXDNS_DHCP_INT_KEY_SECRET` | **Base64-encoded TSIG key secret. Treat as sensitive — prefer setting via env var** |
| `dhcp_int_key_algorithm` | `string` | `hmac-sha256` | `CODEXDNS_DHCP_INT_KEY_ALGORITHM` | HMAC algorithm for TSIG authentication: `hmac-sha256`, `hmac-sha384`, `hmac-sha512` |
| `dhcp_int_default_ttl` | `int` | `3600` | `CODEXDNS_DHCP_INT_DEFAULT_TTL` | TTL (s) for dynamically created DNS records (60–86400) |
| `dhcp_int_reverse_zone` | `string` | — | `CODEXDNS_DHCP_INT_REVERSE_ZONE` | Reverse DNS zone for PTR records (e.g. `1.168.192.in-addr.arpa`). Leave empty to auto-calculate |
| `dhcp_int_auto_create_zone` | `bool` | `false` | `CODEXDNS_DHCP_INT_AUTO_CREATE_ZONE` | Automatically create the DNS zone if it does not exist |
| `dhcp_int_create_ptr` | `bool` | `true` | `CODEXDNS_DHCP_INT_CREATE_PTR` | Create PTR (reverse) records for DHCP leases |
| `dhcp_int_update_client_name` | `bool` | `true` | `CODEXDNS_DHCP_INT_UPDATE_CLIENT_NAME` | Update client display names from DHCP hostnames (only when the name is system-generated and not locked) |
| `dhcp_int_allowed_networks` | `string` | — | `CODEXDNS_DHCP_INT_ALLOWED_NETWORKS` | CIDR networks allowed to send DHCP-DNS updates (newline-separated). Leave empty to allow any source |
| `dhcp_int_cleanup_stale` | `bool` | `true` | `CODEXDNS_DHCP_INT_CLEANUP_STALE` | Remove DNS records that have not been refreshed within the cleanup window |
| `dhcp_int_cleanup_after_hours` | `int` | `168` | `CODEXDNS_DHCP_INT_CLEANUP_AFTER_HOURS` | Remove stale DHCP-created records after this many hours without an update (1–8760) |

---

## Client Discovery

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `discovery_enabled` | `bool` | `true` | `CODEXDNS_DISCOVERY_ENABLED` | Enable automatic client hostname discovery |
| `discovery_methods` | `[]string` | `["reverse_dns", "netbios", "mdns", "llmnr"]` | `CODEXDNS_DISCOVERY_METHODS` | Ordered list of discovery methods to try. Valid values: `reverse_dns`, `netbios`, `mdns`, `llmnr`, `ssdp`, `dhcp`, `finger`, `arp` |
| `discovery_stop_on_first` | `bool` | `true` | `CODEXDNS_DISCOVERY_STOP_ON_FIRST` | Stop discovery after the first method successfully returns a hostname |
| `discovery_timeout` | `int` | `5000` | `CODEXDNS_DISCOVERY_TIMEOUT` | Timeout (ms) for each individual discovery method (100–30000) |

---

## OUI (MAC Vendor Lookup)

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `oui_enabled` | `bool` | `true` | `CODEXDNS_OUI_ENABLED` | Enable IEEE OUI database lookups for MAC address vendor identification |
| `oui_auto_update` | `bool` | `false` | `CODEXDNS_OUI_AUTO_UPDATE` | Automatically update the OUI database on startup if older than 7 days |
| `oui_update_url` | `string` | `https://standards-oui.ieee.org/oui/oui.csv` | `CODEXDNS_OUI_UPDATE_URL` | URL to download the OUI database from |
| `oui_database_path` | `string` | `data/oui.txt` | `CODEXDNS_OUI_DATABASE_PATH` | Local path where the OUI database file is stored |

---

## Authentication

### WebAuthn (Passkeys)

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `webauthn_rp_id` | `string` | `localhost` | `CODEXDNS_WEBAUTHN_RP_ID` | Relying Party ID — typically the bare domain name (e.g. `example.com`) |
| `webauthn_rp_display_name` | `string` | `CodexDNS` | `CODEXDNS_WEBAUTHN_RP_DISPLAY_NAME` | Human-readable name shown in passkey prompts |
| `webauthn_rp_origins` | `[]string` | `["http://localhost:8080"]` | `CODEXDNS_WEBAUTHN_RP_ORIGINS` | Allowed origins for WebAuthn (must match the browser URL exactly) |

### Two-Factor Authentication (TOTP)

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `twofa_issuer` | `string` | `CodexDNS` | `CODEXDNS_TWOFA_ISSUER` | Issuer name shown in authenticator apps (e.g. Google Authenticator) |

### Certificates

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `certificate_import_on_startup` | `bool` | `false` | `CODEXDNS_CERTIFICATE_IMPORT_ON_STARTUP` | Scan the `./certs` directory on startup and import any certificate/key pairs not already in the database |

---

## SMTP (Email)

Used for email-based 2FA codes and notifications.

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `smtp_host` | `string` | — | `CODEXDNS_SMTP_HOST` | SMTP server hostname or IP address |
| `smtp_port` | `int` | `587` | `CODEXDNS_SMTP_PORT` | SMTP port. Common values: `25` (SMTP), `465` (implicit TLS), `587` (STARTTLS) |
| `smtp_username` | `string` | — | `CODEXDNS_SMTP_USERNAME` | SMTP authentication username |
| `smtp_password` | `string` | — | `CODEXDNS_SMTP_PASSWORD` | **SMTP authentication password. Treat as sensitive — prefer setting via env var** |
| `smtp_from` | `string` | — | `CODEXDNS_SMTP_FROM` | From email address for sent messages |
| `smtp_from_name` | `string` | `CodexDNS` | `CODEXDNS_SMTP_FROM_NAME` | From display name for sent messages |
| `smtp_use_tls` | `bool` | `true` | `CODEXDNS_SMTP_USE_TLS` | Use implicit TLS (port 465). For STARTTLS (port 587), leave this `false` |
| `smtp_skip_verify` | `bool` | `false` | `CODEXDNS_SMTP_SKIP_VERIFY` | Skip TLS certificate verification. Only use on trusted networks with self-signed certs |

---

## Filter & Blocking

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `filter_enabled` | `bool` | `true` | `CODEXDNS_FILTER_ENABLED` | Master switch for DNS filtering and blocklists |
| `filter_load_mode` | `string` | `background` | `CODEXDNS_FILTER_LOAD_MODE` | How filter rules are loaded at startup: `background` (non-blocking), `sync` / `blocking` (wait for completion) |
| `filter_cache_method` | `string` | `radix` | `CODEXDNS_FILTER_CACHE_METHOD` | Data structure for wildcard domain matching: `radix` (recommended), `trie`, `hashmap` |
| `filter_debug` | `bool` | `false` | `CODEXDNS_FILTER_DEBUG` | Enable verbose logging for filter rule matching and cache operations |
| `filter_update_interval_hours` | `int` | `24` | `CODEXDNS_FILTER_UPDATE_INTERVAL_HOURS` | Hours between automatic filter list updates from remote sources (1–720, 0 = disable) |
| `blocking_mode` | `string` | `nxdomain` | `CODEXDNS_BLOCKING_MODE` | DNS response for blocked domains: `nxdomain`, `refused`, `null_ip`, `custom_ip` |
| `blocking_ipv4` | `string` | `0.0.0.0` | `CODEXDNS_BLOCKING_IPV4` | IPv4 address returned for blocked domains when `blocking_mode` is `null_ip` or `custom_ip` |
| `blocking_ipv6` | `string` | `::` | `CODEXDNS_BLOCKING_IPV6` | IPv6 address returned for blocked domains when `blocking_mode` is `null_ip` or `custom_ip` |

---

## Safe Search

Redirect DNS queries for major search engines to their safe search variants.

| Key | Default | Env Var | Description |
|-----|---------|---------|-------------|
| `safe_search_enabled` | `false` | `CODEXDNS_SAFE_SEARCH_ENABLED` | Master switch for safe search enforcement across all supported engines |
| `safe_search_google` | `false` | `CODEXDNS_SAFE_SEARCH_GOOGLE` | Redirect `google.com` (and TLDs) to `forcesafesearch.google.com` |
| `safe_search_youtube` | `false` | `CODEXDNS_SAFE_SEARCH_YOUTUBE` | Redirect `youtube.com` and `youtu.be` to `restrictmoderate.youtube.com` |
| `safe_search_bing` | `false` | `CODEXDNS_SAFE_SEARCH_BING` | Redirect `bing.com` to `strict.bing.com` |
| `safe_search_duckduckgo` | `false` | `CODEXDNS_SAFE_SEARCH_DUCKDUCKGO` | Redirect `duckduckgo.com` with safe search enabled |
| `safe_search_ecosia` | `false` | `CODEXDNS_SAFE_SEARCH_ECOSIA` | Redirect `ecosia.org` with adult content disabled |
| `safe_search_yandex` | `false` | `CODEXDNS_SAFE_SEARCH_YANDEX` | Redirect `yandex.com` and `yandex.ru` to `family.yandex.com` |
| `safe_search_pixabay` | `false` | `CODEXDNS_SAFE_SEARCH_PIXABAY` | Redirect `pixabay.com` with safe search enabled |

---

## Blocked Services

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `blocked_services` | `map[string]bool` | `{}` | — | Map of service IDs to their blocked status. When a service ID is `true`, all DNS domains associated with that service are blocked. Examples: `"facebook"`, `"tiktok"`, `"youtube"` |

---

## Worker Pools

Fine-tune goroutine pool sizes for client tracking and hostname discovery.

| Key | Type | Default | Range | Env Var | Description |
|-----|------|---------|-------|---------|-------------|
| `client_tracking_workers` | `int` | `100` | 1–500 | `CODEXDNS_CLIENT_TRACKING_WORKERS` | Goroutines for processing client DNS query tracking events |
| `client_tracking_queue_size` | `int` | `10000` | 100–50000 | `CODEXDNS_CLIENT_TRACKING_QUEUE_SIZE` | Buffer size for the client tracking work queue |
| `client_discovery_workers` | `int` | `10` | 1–100 | `CODEXDNS_CLIENT_DISCOVERY_WORKERS` | Goroutines for background client hostname discovery |
| `client_discovery_queue_size` | `int` | `1000` | 100–10000 | `CODEXDNS_CLIENT_DISCOVERY_QUEUE_SIZE` | Buffer size for the discovery work queue |

---

## Stats & Maintenance

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `stats_retention_days` | `int` | `90` | `CODEXDNS_STATS_RETENTION_DAYS` | Days to keep statistics data (0 = never purge, max 3650) |
| `stats_async_enabled` | `bool` | `true` | `CODEXDNS_STATS_ASYNC_ENABLED` | Buffer stats updates asynchronously to reduce hot-path lock contention |
| `stats_async_buffer_size` | `int` | `10000` | `CODEXDNS_STATS_ASYNC_BUFFER_SIZE` | Buffered channel size for async stats updates (100–100000) |
| `cleanup_interval_hours` | `int` | `24` | `CODEXDNS_CLEANUP_INTERVAL_HOURS` | How often the database cleanup job runs, in hours (1–168) |
| `cleanup_dns_query_retention_days` | `int` | `30` | `CODEXDNS_CLEANUP_DNS_QUERY_RETENTION_DAYS` | Days to retain DNS query log records (0 = never purge) |
| `cleanup_client_history_retention_days` | `int` | `90` | `CODEXDNS_CLEANUP_CLIENT_HISTORY_RETENTION_DAYS` | Days to retain client history records (0 = never purge) |
| `cleanup_dhcp_update_retention_days` | `int` | `30` | `CODEXDNS_CLEANUP_DHCP_UPDATE_RETENTION_DAYS` | Days to retain DHCP integration update logs (0 = never purge) |
| `cleanup_vacuum_enabled` | `bool` | `true` | `CODEXDNS_CLEANUP_VACUUM_ENABLED` | Run SQLite `VACUUM` after cleanup to reclaim disk space (SQLite only) |
