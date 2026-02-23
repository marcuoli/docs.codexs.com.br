---
title: "Environment Variables"
description: "Configure CodexDNS using environment variables, including special secrets and bootstrap-only variables."
weight: 50
---

# Environment Variables

Every parameter in the CodexDNS JSON configuration file has a corresponding environment variable. This page explains the naming convention, precedence rules, special variables that **only** work as environment variables, and how to run CodexDNS with no config file at all.

---

## Precedence Order

When the same setting is configured in multiple places, the following precedence applies (highest to lowest):

1. **CLI flags** (e.g. `-config /path/to/config.json`)
2. **Environment variables** (`CODEXDNS_*`)
3. **JSON configuration file** (values in `config.json`)
4. **Built-in defaults** (compiled into the binary)

Environment variables always override the JSON file value for the same key.

---

## Naming Convention

Every JSON key in `config.json` maps to an environment variable following this rule:

```
CODEXDNS_ + <JSON_KEY_IN_UPPERCASE>
```

The JSON key is uppercased; underscores are preserved. Examples:

| JSON key | Environment variable |
|----------|---------------------|
| `http_port` | `CODEXDNS_HTTP_PORT` |
| `dns_query_timeout_ms` | `CODEXDNS_DNS_QUERY_TIMEOUT_MS` |
| `cache_local_lru_ttl` | `CODEXDNS_CACHE_LOCAL_LRU_TTL` |
| `upstream_strategy` | `CODEXDNS_UPSTREAM_STRATEGY` |
| `doh_http3_enabled` | `CODEXDNS_DOH_HTTP3_ENABLED` |

For a complete list of all JSON keys and their types, defaults, and descriptions, see [Configuration Parameters Reference](parameters.md).

---

## Special Environment Variables

The following variables have extra significance and are not simply aliases for JSON keys. Some are **only** settable as environment variables (they should never be stored in a config file on disk).

### `CODEXDNS_SESSION_SECRET`

| | |
|---|---|
| **Required in production** | Yes — startup aborts when missing or too short in `gin_mode=release` |
| **Minimum length** | 32 characters |
| **Sensitive** | **Yes — never store in a config file or commit to version control** |
| **JSON key** | `session_secret` (write-protected in the UI) |

Signs all session cookies and CSRF tokens. If this value changes, all existing sessions are immediately invalidated.

Generate a secure value:

```bash
openssl rand -hex 32
```

Set it before starting the container or process:

```bash
export CODEXDNS_SESSION_SECRET="$(openssl rand -hex 32)"
```

Or in Docker Compose:

```yaml
environment:
  CODEXDNS_SESSION_SECRET: "${CODEXDNS_SESSION_SECRET}"
```

> ⚠️ **Never hardcode this value in a `config.json` that is committed to source control.** Use a secrets manager, `.env` file excluded from git, or an orchestrator secret (Docker secret, Kubernetes Secret, etc.).

---

### `CODEXDNS_ADMIN_PASSWORD`

| | |
|---|---|
| **When used** | First boot only (Docker / fresh installs) |
| **Sensitive** | Yes |
| **JSON key** | None — env-var only |

Sets the password for the initial `admin` account created at first boot. If this variable is **not set**, a random 24-character password is generated and printed to the application log once.

```bash
# Docker run — set a known admin password on first boot
docker run -e CODEXDNS_ADMIN_PASSWORD="MySecurePass123!" ...
```

After the admin account is created, this variable has no effect. Change the password via the Web UI.

---

### `CODEXDNS_CONFIG_FILE`

| | |
|---|---|
| **Purpose** | Override the config file path at startup |
| **JSON key** | None — env-var only |
| **Equivalent CLI flag** | `-config <path>` |

```bash
export CODEXDNS_CONFIG_FILE=/etc/codexdns/config.json
```

When both this variable and the `-config` CLI flag are set, the CLI flag takes precedence.

---

## Running Without a Config File

You can run CodexDNS entirely via environment variables, using only built-in defaults. This is the recommended pattern for container deployments.

**Minimal Docker `docker run` example:**

```bash
docker run -d \
  --name codexdns \
  -p 8080:8080 \
  -p 53:53/udp \
  -p 53:53/tcp \
  -e CODEXDNS_SESSION_SECRET="$(openssl rand -hex 32)" \
  -e CODEXDNS_ADMIN_PASSWORD="MySecurePass123!" \
  -e CODEXDNS_DB_DRIVER="sqlite" \
  -e CODEXDNS_DB_DSN="/data/codexdns.db" \
  -e CODEXDNS_UPSTREAM_SERVERS="8.8.8.8:53;1.1.1.1:53" \
  -v codexdns-data:/data \
  ghcr.io/marcuoli/codexdns:latest
```

**Docker Compose example (`compose.yml`):**

```yaml
services:
  codexdns:
    image: ghcr.io/marcuoli/codexdns:latest
    ports:
      - "8080:8080"
      - "53:53/udp"
      - "53:53/tcp"
    volumes:
      - codexdns-data:/data
    environment:
      CODEXDNS_SESSION_SECRET: "${CODEXDNS_SESSION_SECRET}"   # from .env or secrets manager
      CODEXDNS_ADMIN_PASSWORD: "${CODEXDNS_ADMIN_PASSWORD}"   # first-boot only
      CODEXDNS_DB_DRIVER: "sqlite"
      CODEXDNS_DB_DSN: "/data/codexdns.db"
      CODEXDNS_UPSTREAM_SERVERS: "8.8.8.8:53;1.1.1.1:53"
      CODEXDNS_LOG_LEVEL: "info"
      CODEXDNS_GIN_MODE: "release"
    restart: unless-stopped

volumes:
  codexdns-data:
```

Store `CODEXDNS_SESSION_SECRET` and `CODEXDNS_ADMIN_PASSWORD` in a `.env` file next to `compose.yml`:

```bash
# .env  (add this file to .gitignore)
CODEXDNS_SESSION_SECRET=<output of: openssl rand -hex 32>
CODEXDNS_ADMIN_PASSWORD=ChangeMe123!
```

---

## Sensitive Variables

The following variables contain secrets and should never be written to plain-text config files committed to version control:

| Variable | Description |
|----------|-------------|
| `CODEXDNS_SESSION_SECRET` | Session and CSRF signing key |
| `CODEXDNS_ADMIN_PASSWORD` | First-boot admin password |
| `CODEXDNS_DB_DSN` | May contain database credentials (PostgreSQL/MySQL DSN) |
| `CODEXDNS_SMTP_PASSWORD` | SMTP authentication password |
| `CODEXDNS_DHCP_INT_KEY_SECRET` | TSIG key secret for RFC 2136 DHCP integration |
| `CODEXDNS_PROMETHEUS_AUTH_TOKEN` | Bearer token for Prometheus metrics endpoint |

Use a secrets manager (Vault, AWS Secrets Manager, Kubernetes Secrets, Docker Secrets) or a `.env` file excluded from git to manage these values.

---

## Array Parameters

Some parameters accept a list of values. When setting these via environment variables, separate values with a semicolon (`;`):

| Parameter | Example |
|-----------|---------|
| `CODEXDNS_UPSTREAM_SERVERS` | `8.8.8.8:53;1.1.1.1:53;9.9.9.9:53` |
| `CODEXDNS_DISCOVERY_METHODS` | `reverse_dns;netbios;mdns` |
| `CODEXDNS_WEBAUTHN_RP_ORIGINS` | `https://dns.example.com;https://www.example.com` |

---

## Verifying the Active Configuration

Use the **System Configuration** page in the Web UI (**Settings → System Configuration**) to inspect the currently active values after startup — including which parameters come from environment variables vs the JSON file.

To dump the current effective configuration via the API (requires authentication):

```bash
curl -s -b "session=<your-session-cookie>" \
  http://localhost:8080/api/config | jq .
```
