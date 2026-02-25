---
title: "Downloads"
description: "Download CodexDNS packages for Linux or run with Docker."
weight: 15
---

# Downloads

CodexDNS is available as native Linux packages (RPM, APK, DEB) and as Docker images for both Docker Hub and GHCR. All packages target **x86_64 / amd64** architecture.

---

## Linux Packages

{{< pkg-downloads >}}

---

## Supported Distributions

| Package | Architecture | Tested Distributions |
|---------|-------------|----------------------|
| **RPM (el9)** | x86_64 | RHEL 9, Oracle Linux 9, CentOS Stream 9, Fedora 38+ |
| **RPM (el10)** | x86_64 | RHEL 10, Oracle Linux 10 |
| **APK** | x86_64 | Alpine Linux 3.18, 3.19, 3.20 |
| **DEB** | amd64 | Debian 11 (Bullseye), Debian 12 (Bookworm), Ubuntu 22.04, Ubuntu 24.04 |

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
