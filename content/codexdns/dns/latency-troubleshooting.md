---
title: "Latency Troubleshooting"
description: "Diagnose and resolve DNS latency issues."
weight: 30
---

# Upstream Latency Troubleshooting Guide

## Overview

This document explains the upstream server latency measurement system in CodexDNS and how to troubleshoot when latency shows "N/A" in the dashboard.

## How Latency Measurement Works

### Architecture

1. **Background Goroutine**: When the DNS server starts with upstream servers configured, a background goroutine is launched to periodically measure latency.

2. **Measurement Interval**: Configurable via `latency_measurement_interval` (default: 30 seconds, range: 10-300 seconds).

3. **Measurement Method**:
   - For UDP/TCP servers: Sends a minimal DNS query (NS record for root ".") and measures round-trip time
   - For DoH/DoT/DoQ: Uses protocol-specific client ping methods
   - Stores last 10 measurements per server and calculates average

4. **Dashboard Display**: Queries the average latency from the forwarder and displays in milliseconds.

## Configuration

### Required Settings (config.json)

```json
{
  "latency_measurement_interval": 30,
  "debug_latency": false,
  "upstream_servers": [
    "8.8.8.8:53",
    "https://cloudflare-dns.com/dns-query",
    "tls://dns.google",
    "quic://dns.adguard.com"
  ]
}
```

## Troubleshooting "N/A" Latency

### Symptoms

- Dashboard shows "N/A" in the Latency column for upstream servers
- Status shows "unknown" instead of "online"

### Diagnostic Steps

#### 1. Check Latency Measurement Initialization

Look for this log message during DNS server startup:

```log
[INFO] [DNS] Latency measurement started for upstream servers (interval: 30s)
```

If missing, the latency measurement goroutine was not started. Possible causes:
- No upstream servers configured (`upstream_servers` is empty)
- DNS server failed to start
- Configuration not loaded properly

#### 2. Check for Ping Failures

New in this version: Failed ping attempts are logged as warnings:

```bash
# Look for ping failures
docker logs codexdns | grep "ping failed"

# Or for all latency warnings
docker logs codexdns | grep -i "latency" | grep -i "failed"
```

Example warning messages:

```log
[WARN] [DNS] Upstream server 8.8.8.8:53 ping failed: context deadline exceeded
[WARN] [DNS] Upstream latency measurement failed for https://cloudflare-dns.com/dns-query (returned 0)
[WARN] [DNS] All upstream latency measurements failed (4 servers configured)
```

#### 3. Enable Debug Logging

Set `"debug_latency": true` in config.json to see detailed measurement attempts:

```json
{
  "debug_latency": true
}
```

Debug logs show:
- When measurement cycle starts
- Each server being pinged
- Success/failure with specific latency values
- Completion summary with success count

#### 4. Common Causes and Solutions

| Cause | Symptom | Solution |
|-------|---------|----------|
| **Firewall Blocking** | UDP ping timeouts | Allow outbound UDP/TCP port 53 |
| **DoH/DoT Unreachable** | HTTPS/TLS connection failures | Check firewall rules for port 443/853 |
| **Network Issues** | All servers timing out | Verify container network connectivity |
| **Wrong Server Format** | Client initialization failures | Check server address format (see below) |
| **Server Rate Limiting** | Intermittent failures | Increase `latency_measurement_interval` |
| **Container Network Mode** | Cannot reach external servers | Use `--network bridge` or `--network host` |

#### 5. Server Address Formats

Ensure upstream servers use correct format:

```text
✅ UDP:  8.8.8.8:53
✅ DoH:  https://cloudflare-dns.com/dns-query
✅ DoT:  tls://dns.google
✅ DoQ:  quic://dns.adguard.com

❌ UDP:  8.8.8.8 (missing port)
❌ DoH:  cloudflare-dns.com (missing protocol)
❌ DoT:  dns.google:853 (use tls:// prefix)
```

#### 6. Test Connectivity

Test network connectivity from within the container:

```bash
# Enter container shell
docker exec -it codexdns sh

# Test UDP DNS
nslookup google.com 8.8.8.8

# Test HTTPS (for DoH)
wget -O- https://cloudflare-dns.com/dns-query

# Test TLS connection (for DoT)
nc -zv dns.google 853
```

## Best Practices

1. **Default Interval**: 30 seconds is usually sufficient. Increase to 60-120 seconds if upstream servers rate-limit.

2. **Mixed Protocols**: Use a mix of UDP and DoH/DoT/DoQ for redundancy:
   ```json
   "upstream_servers": [
     "8.8.8.8:53",
     "1.1.1.1:53",
     "https://cloudflare-dns.com/dns-query"
   ]
   ```

3. **Monitor Logs**: Watch for latency warnings during the first 2-3 minutes after startup.

4. **Debug Mode**: Only enable `debug_latency` for troubleshooting (generates verbose logs).

5. **Firewall Rules**: Ensure outbound connections are allowed:
   - UDP/TCP port 53 (for UDP/TCP DNS)
   - TCP port 443 (for DoH)
   - TCP port 853 (for DoT)
   - UDP port 853 (for DoQ)

## Support

If latency continues to show "N/A" after following this guide:

1. Collect logs: `docker logs codexdns > codexdns.log`
2. Enable debug logging: `"debug_latency": true`
3. Restart container: `docker restart codexdns`
4. Wait 60 seconds
5. Collect debug logs: `docker logs codexdns > codexdns-debug.log`
6. Open issue on GitHub with both log files
