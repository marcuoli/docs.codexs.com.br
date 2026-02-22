---
title: "Docker"
description: "Run CodexDNS using Docker or Docker Compose."
weight: 30
---

# Docker Deployment

CodexDNS is available as a Docker image on the GitHub Container Registry. This is the fastest way to get started on any platform that runs Docker.

---

## Quick Start

```bash
docker run -d \
  --name codexdns \
  -p 8080:8080 \
  -p 53:53/udp \
  -p 53:53/tcp \
  -v codexdns-data:/app/data \
  -v codexdns-config:/app/config \
  -v codexdns-logs:/app/logs \
  ghcr.io/marcuoli/codexdns:latest
```

Open the web UI at `http://localhost:8080` and log in.

On first run, CodexDNS prints the auto-generated admin password to the container log:

```bash
docker logs codexdns 2>&1 | grep -A6 'FIRST-BOOT'
```

You will see a message like:
```
************************************************************
* CODEXDNS FIRST-BOOT: no CODEXDNS_ADMIN_PASSWORD set.     *
*   Username : admin                                         *
*   Password : <generated-password>                         *
************************************************************
```

> ⚠️ **Change the admin password immediately** after first login via **Settings → Profile**.

---

## Image Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest stable release |
| `x.y.z` | Specific version (e.g. `0.1.20260222.1`) |
| `edge` | Latest commit on `main` (unstable) |

```bash
# Pull a specific version
docker pull ghcr.io/marcuoli/codexdns:0.1.20260222.1
```

---

## Docker Compose (Recommended)

Create a `docker-compose.yml`:

```yaml
services:
  codexdns:
    image: ghcr.io/marcuoli/codexdns:latest
    container_name: codexdns
    restart: unless-stopped
    ports:
      - "8080:8080"   # Web UI
      - "53:53/udp"   # DNS UDP
      - "53:53/tcp"   # DNS TCP
    volumes:
      - codexdns-data:/app/data
      - codexdns-config:/app/config
      - codexdns-logs:/app/logs
    environment:
      - CODEXDNS_HTTP_PORT=8080
      - CODEXDNS_DNS_PORT=53
      - CODEXDNS_LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 512m
          cpus: "2"

volumes:
  codexdns-data:
  codexdns-config:
  codexdns-logs:
```

Start the stack:

```bash
docker compose up -d

# Follow logs
docker compose logs -f

# Stop
docker compose down
```

---

## Volumes

| Volume | Container path | Contents |
|--------|---------------|----------|
| `codexdns-data` | `/app/data` | SQLite database |
| `codexdns-config` | `/app/config` | `config.json` |
| `codexdns-logs` | `/app/logs` | HTTP, DNS, DHCP log files |
| `codexdns-certs` | `/app/certs` | TLS certificates (optional) |

You can also bind-mount a local directory instead of a named volume:

```yaml
volumes:
  - ./data:/app/data
  - ./config:/app/config
  - ./logs:/app/logs
```

---

## Configuration

The container reads configuration from environment variables or from `/app/config/config.json` mounted via volume.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CODEXDNS_ADMIN_PASSWORD` | *(auto-generated)* | Admin password on first boot. If set, used as-is and `MustChangePassword` is not set. If unset, a 24-char random password is printed to the log. |
| `CODEXDNS_HTTP_PORT` | `8080` | Web UI port |
| `CODEXDNS_DNS_PORT` | `53` | DNS listener port |
| `CODEXDNS_LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `CODEXDNS_DB_DRIVER` | `sqlite` | Database driver |
| `CODEXDNS_DB_DSN` | `/app/data/codexdns.db` | Database connection string |
| `CODEXDNS_REDIS_ADDR` | `` | Redis address (optional, e.g. `redis:6379`) |

### Config File

Mount a custom config file:

```bash
# Create config directory
mkdir -p ./config

# Write config
cat > ./config/config.json << 'EOF'
{
  "http_port": 8080,
  "dns_port": 53,
  "db_driver": "sqlite",
  "db_dsn": "/app/data/codexdns.db",
  "log_level": "info"
}
EOF
```

Then add to `docker-compose.yml`:

```yaml
volumes:
  - ./config:/app/config
```

---

## With Redis Cache

Add a Redis service to improve DNS caching performance:

```yaml
services:
  codexdns:
    image: ghcr.io/marcuoli/codexdns:latest
    environment:
      - CODEXDNS_REDIS_ADDR=redis:6379
    depends_on:
      - redis
    # ... other config

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

---

## DNS on Port 53 with systemd-resolved

On Ubuntu and some Debian systems, `systemd-resolved` binds to port 53. You need to free it before CodexDNS can listen:

```bash
# Disable systemd-resolved stub
sudo systemctl disable --now systemd-resolved
sudo rm /etc/resolv.conf
echo 'nameserver 8.8.8.8' | sudo tee /etc/resolv.conf
```

Alternatively, bind CodexDNS to a specific host interface only:

```yaml
ports:
  - "192.168.1.10:53:53/udp"
  - "192.168.1.10:53:53/tcp"
```

---

## Health Check

CodexDNS exposes a health endpoint:

```bash
curl http://localhost:8080/health
# {"status":"ok", "version":"0.1.20260222.1"}
```

Check container health status:

```bash
docker inspect --format='{{.State.Health.Status}}' codexdns
```

---

## Updating

```bash
# Pull the latest image
docker compose pull

# Recreate the container
docker compose up -d
```

Data volumes are preserved across updates.

---

## Troubleshooting

### View logs

```bash
# Container stdout/stderr
docker logs codexdns
docker logs --tail 50 -f codexdns

# Application log files (if logs volume is mounted)
cat ./logs/dns.log
cat ./logs/http.log
```

### Port already in use

```bash
# Find what is using port 53
ss -tulnp | grep :53

# Find what is using port 8080
ss -tulnp | grep :8080
```

### Container exits immediately

```bash
# View exit reason
docker logs codexdns

# Check config file syntax if using a config volume
cat ./config/config.json | python3 -m json.tool
```

