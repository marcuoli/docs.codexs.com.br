---
title: "Downloads"
description: "Download CodexDNS packages for Linux or run with Docker."
weight: 15
---

# Downloads

CodexDNS is available as native Linux packages (RPM, APK, DEB) and as Docker images for both Docker Hub and GHCR. Packages are provided for **x86_64 / amd64** and **ARM64 / aarch64** architectures.

---

## Linux Packages

{{< pkg-downloads >}}

After downloading, follow the [Package Installation](../installation/) guide for step-by-step setup instructions.

---

## Docker

CodexDNS is available on both **Docker Hub** and **GitHub Container Registry (GHCR)**.

### Docker Hub

```bash
docker pull marcuoli/codexdns:latest
```

[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-marcuoli%2Fcodexdns-blue?logo=docker)](https://hub.docker.com/r/marcuoli/codexdns)

### GitHub Container Registry (GHCR)

```bash
docker pull ghcr.io/marcuoli/codexdns:latest
```

### Available Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest stable release |
| `0.5.YYYYMMDD.N` | Specific version — pin for production |

### Quick Start

```bash
docker run -d \
  --name codexdns \
  -p 8080:8080 \
  -p 53:53/udp \
  -p 53:53/tcp \
  -v codexdns-data:/app/data \
  -v codexdns-config:/app/config \
  -v codexdns-logs:/app/logs \
  marcuoli/codexdns:latest
```

Open the web UI at `http://localhost:8080`. See the [Docker installation guide](../installation/docker/) for the full setup including Docker Compose and configuration options.
