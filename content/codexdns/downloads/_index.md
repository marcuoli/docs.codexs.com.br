---
title: "Downloads"
description: "Download CodexDNS packages for Linux or run with Docker."
weight: 15
---

# Downloads

CodexDNS is available as native Linux packages (RPM, APK, DEB) and as Docker images for both Docker Hub and GHCR. All packages target **x86_64 / amd64** architecture.

---

## Linux Packages

<div x-data="pkgDownloads()" x-init="init()">

  {{/* Loading */}}
  <div x-show="loading" class="flex items-center gap-3 py-10 text-lt-text-muted dark:text-gh-muted">
    <svg class="animate-spin w-5 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
    <span class="text-sm">Loading packages…</span>
  </div>

  {{/* Error */}}
  <div x-show="!loading && error" class="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-300">
    <strong>Could not load package information.</strong>
    <span x-text="' ' + error"></span>
    <p class="mt-1 text-xs text-red-400">Try refreshing the page or check back later.</p>
  </div>

  {{/* No releases yet */}}
  <div x-show="!loading && !error && manifest.releases.length === 0"
       class="rounded-lg border border-lt-border dark:border-gh-border bg-lt-bg dark:bg-gh-canvas p-6 text-sm text-lt-text-muted dark:text-gh-muted">
    Package builds have not been published yet. Check back after the next release.
  </div>

  {{/* Releases */}}
  <div x-show="!loading && !error && manifest.releases.length > 0" x-cloak>

    {{/* Latest version badge */}}
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-gh-primary/15 dark:bg-gh-primary/20 px-3 py-1 text-sm font-semibold text-gh-primary dark:text-gh-accent border border-gh-primary/30 dark:border-gh-accent/30">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
        Latest: v<span x-text="manifest.latest"></span>
      </span>
      <span class="text-sm text-lt-text-muted dark:text-gh-muted" x-text="'Released ' + formatDate(manifest.updated)"></span>
    </div>

    {{/* One block per release */}}
    <template x-for="(rel, idx) in manifest.releases" :key="rel.version">
      <div class="mb-8">

        {{/* Version header for older releases */}}
        <div x-show="idx > 0" class="flex items-center gap-3 mb-4 pb-2 border-b border-lt-border dark:border-gh-border">
          <span class="text-sm font-medium text-lt-text dark:text-gh-light" x-text="'v' + rel.version"></span>
          <span class="text-xs text-lt-text-muted dark:text-gh-muted" x-text="formatDate(rel.release_date)"></span>
          <span class="text-xs bg-lt-border dark:bg-gh-border rounded px-1.5 py-0.5 text-lt-text-muted dark:text-gh-muted">older</span>
        </div>

        {{/* Download cards — 3 columns on desktop */}}
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {{/* RPM */}}
          <a :href="rel.rpm.url"
             class="group flex flex-col gap-3 rounded-lg border border-lt-border dark:border-gh-border bg-lt-bg dark:bg-gh-canvas p-5 hover:border-gh-primary dark:hover:border-gh-accent transition-colors no-underline"
             download>
            <div class="flex items-center gap-2">
              <div class="flex items-center justify-center w-9 h-9 rounded-md bg-red-900/20 border border-red-800/40 shrink-0">
                <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              </div>
              <div>
                <div class="text-sm font-semibold text-lt-text dark:text-gh-light group-hover:text-gh-primary dark:group-hover:text-gh-accent transition-colors">.rpm</div>
                <div class="text-xs text-lt-text-muted dark:text-gh-muted">RHEL · Oracle Linux · Fedora</div>
              </div>
            </div>
            <div class="text-xs font-mono text-lt-text-muted dark:text-gh-muted break-all" x-text="rel.rpm.filename"></div>
            <div class="mt-auto flex items-center gap-1.5 text-xs text-lt-text-muted dark:text-gh-muted">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span class="font-mono truncate" x-text="rel.rpm.sha256.slice(0,16) + '…'"></span>
              <button @click.prevent="navigator.clipboard.writeText(rel.rpm.sha256).then(() => $el.textContent='✓').catch(()=>{})"
                      class="ml-auto shrink-0 text-lt-text-muted dark:text-gh-muted hover:text-gh-primary dark:hover:text-gh-accent transition-colors text-xs px-1 rounded">copy</button>
            </div>
          </a>

          {{/* APK */}}
          <a :href="rel.apk.url"
             class="group flex flex-col gap-3 rounded-lg border border-lt-border dark:border-gh-border bg-lt-bg dark:bg-gh-canvas p-5 hover:border-gh-primary dark:hover:border-gh-accent transition-colors no-underline"
             download>
            <div class="flex items-center gap-2">
              <div class="flex items-center justify-center w-9 h-9 rounded-md bg-blue-900/20 border border-blue-800/40 shrink-0">
                <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              </div>
              <div>
                <div class="text-sm font-semibold text-lt-text dark:text-gh-light group-hover:text-gh-primary dark:group-hover:text-gh-accent transition-colors">.apk</div>
                <div class="text-xs text-lt-text-muted dark:text-gh-muted">Alpine Linux 3.18+</div>
              </div>
            </div>
            <div class="text-xs font-mono text-lt-text-muted dark:text-gh-muted break-all" x-text="rel.apk.filename"></div>
            <div class="mt-auto flex items-center gap-1.5 text-xs text-lt-text-muted dark:text-gh-muted">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span class="font-mono truncate" x-text="rel.apk.sha256.slice(0,16) + '…'"></span>
              <button @click.prevent="navigator.clipboard.writeText(rel.apk.sha256).then(() => $el.textContent='✓').catch(()=>{})"
                      class="ml-auto shrink-0 text-lt-text-muted dark:text-gh-muted hover:text-gh-primary dark:hover:text-gh-accent transition-colors text-xs px-1 rounded">copy</button>
            </div>
          </a>

          {{/* DEB */}}
          <a :href="rel.deb.url"
             class="group flex flex-col gap-3 rounded-lg border border-lt-border dark:border-gh-border bg-lt-bg dark:bg-gh-canvas p-5 hover:border-gh-primary dark:hover:border-gh-accent transition-colors no-underline"
             download>
            <div class="flex items-center gap-2">
              <div class="flex items-center justify-center w-9 h-9 rounded-md bg-orange-900/20 border border-orange-800/40 shrink-0">
                <svg class="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              </div>
              <div>
                <div class="text-sm font-semibold text-lt-text dark:text-gh-light group-hover:text-gh-primary dark:group-hover:text-gh-accent transition-colors">.deb</div>
                <div class="text-xs text-lt-text-muted dark:text-gh-muted">Debian 11+ · Ubuntu 22.04+</div>
              </div>
            </div>
            <div class="text-xs font-mono text-lt-text-muted dark:text-gh-muted break-all" x-text="rel.deb.filename"></div>
            <div class="mt-auto flex items-center gap-1.5 text-xs text-lt-text-muted dark:text-gh-muted">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span class="font-mono truncate" x-text="rel.deb.sha256.slice(0,16) + '…'"></span>
              <button @click.prevent="navigator.clipboard.writeText(rel.deb.sha256).then(() => $el.textContent='✓').catch(()=>{})"
                      class="ml-auto shrink-0 text-lt-text-muted dark:text-gh-muted hover:text-gh-primary dark:hover:text-gh-accent transition-colors text-xs px-1 rounded">copy</button>
            </div>
          </a>

        </div>
      </div>
    </template>

  </div>

</div>

<script>
function pkgDownloads() {
  return {
    loading: true,
    error: null,
    manifest: { latest: '', updated: '', releases: [] },

    async init() {
      try {
        const resp = await fetch('/codexdns/packages.json?_=' + Date.now());
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        this.manifest = data;
      } catch (e) {
        this.error = e.message || 'Unknown error';
      } finally {
        this.loading = false;
      }
    },

    formatDate(d) {
      if (!d) return '';
      try {
        return new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
        });
      } catch (_) { return d; }
    }
  };
}
</script>

---

## Supported Distributions

| Package | Architecture | Tested Distributions |
|---------|-------------|----------------------|
| **RPM** | x86_64 | RHEL 9+, Oracle Linux 9+, CentOS Stream 9, Fedora 38+ |
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
