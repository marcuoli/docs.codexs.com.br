---
title: "Performance Profiling"
description: "Use pprof to profile and optimize CodexDNS performance."
weight: 40
---

# Go pprof Profiling Endpoints

## Overview

CodexDNS includes optional Go profiling endpoints via `net/http/pprof` for performance analysis and troubleshooting. These endpoints provide detailed runtime profiling data for CPU usage, memory allocation, goroutines, and more.

## Configuration

Add to `config.json`:

```json
{
  "enable_pprof": true
}
```

**Default**: `false` (disabled)

**Security Note**: Only enable pprof in development or when actively troubleshooting performance issues. These endpoints expose internal runtime information and should not be publicly accessible in production.

## Available Endpoints

When `enable_pprof: true`, the following endpoints become available at `/debug/pprof/`:

| Endpoint | Description | Usage |
|----------|-------------|-------|
| `/debug/pprof/` | Index page listing all profiles | Web browser |
| `/debug/pprof/goroutine` | Stack traces of all current goroutines | `go tool pprof` or browser |
| `/debug/pprof/heap` | Memory allocation sampling | `go tool pprof` |
| `/debug/pprof/allocs` | All past memory allocations | `go tool pprof` |
| `/debug/pprof/threadcreate` | Stack traces of thread creation | `go tool pprof` |
| `/debug/pprof/block` | Stack traces of blocking operations | `go tool pprof` |
| `/debug/pprof/mutex` | Stack traces of mutex contention | `go tool pprof` |
| `/debug/pprof/profile` | CPU profile (30s by default) | `go tool pprof` |
| `/debug/pprof/trace` | Execution trace (1s) | `go tool trace` |
| `/debug/pprof/cmdline` | Command-line arguments | Browser |
| `/debug/pprof/symbol` | Symbol lookup | Internal use |

## Usage Examples

### View Goroutine Stack Traces (Browser)

```bash
# Navigate to:
http://localhost:8080/debug/pprof/goroutine?debug=2
```

This shows the stack trace of every running goroutine, useful for:
- Identifying goroutine leaks
- Understanding concurrency patterns
- Debugging deadlocks or stuck goroutines

### Analyze CPU Profile

```bash
# Collect 30-second CPU profile
go tool pprof http://localhost:8080/debug/pprof/profile?seconds=30

# Interactive commands:
# top10     - Show top 10 CPU consumers
# list main - Show annotated source for main package
# web       - Open graph visualization (requires Graphviz)
# exit      - Exit pprof
```

### Analyze Memory Heap

```bash
# Collect current heap snapshot
go tool pprof http://localhost:8080/debug/pprof/heap

# Interactive commands:
# top10          - Top 10 memory allocators
# list dns       - Show source for dns package
# png > heap.png - Export graph to PNG
```

### Analyze Memory Allocations

```bash
# Show all allocations (including freed)
go tool pprof http://localhost:8080/debug/pprof/allocs
```

### Identify Goroutine Leaks

```bash
# Compare goroutine counts over time
curl http://localhost:8080/debug/pprof/goroutine?debug=1 > goroutines_before.txt
# ... run workload ...
curl http://localhost:8080/debug/pprof/goroutine?debug=1 > goroutines_after.txt
diff goroutines_before.txt goroutines_after.txt
```

### Generate Execution Trace

```bash
# Download 5-second trace
curl http://localhost:8080/debug/pprof/trace?seconds=5 -o trace.out

# Analyze with trace tool
go tool trace trace.out
```

## Common Troubleshooting Scenarios

### High CPU Usage

**Symptom**: CodexDNS consuming excessive CPU

**Diagnosis**:
```bash
# Collect 60-second CPU profile
go tool pprof http://localhost:8080/debug/pprof/profile?seconds=60

# In pprof:
(pprof) top20
(pprof) list <function_name>  # Examine hot functions
```

**Look for**:
- Tight loops without yielding
- Excessive regex compilation
- Inefficient DNS query processing

### Memory Leak

**Symptom**: Memory usage grows unbounded

**Diagnosis**:
```bash
# Compare heap before and after workload
go tool pprof -base http://localhost:8080/debug/pprof/heap http://localhost:8080/debug/pprof/heap

# Show functions allocating most memory
(pprof) top20 -cum
```

**Look for**:
- Growing caches without eviction
- Unclosed connections/files
- Accumulated DNS response buffers

### Goroutine Leak

**Symptom**: Number of goroutines grows continuously

**Diagnosis**:
```bash
# View goroutine count and stacks
curl http://localhost:8080/debug/pprof/goroutine?debug=1 | grep "goroutine profile:" -A 1
```

**Look for**:
- Goroutines blocked on channels that never close
- Goroutines waiting on mutexes
- Background workers not being cleaned up

### Slow DNS Resolution

**Symptom**: High latency in DNS responses

**Diagnosis**:
```bash
# Trace DNS query path
curl http://localhost:8080/debug/pprof/trace?seconds=10 -o trace.out
go tool trace trace.out

# Look at:
# - Goroutine analysis: Identify blocked goroutines
# - Network wait times
# - Synchronization primitives
```

### Mutex Contention

**Symptom**: High lock contention degrading performance

**Diagnosis**:
```bash
go tool pprof http://localhost:8080/debug/pprof/mutex

(pprof) top10
(pprof) list <function_with_lock>
```

**Look for**:
- Hot paths holding locks too long
- Global locks protecting frequently-accessed data
- Reader/writer lock imbalances

## Integration with Monitoring Tools

### Grafana + Prometheus

Expose pprof metrics to Prometheus:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'codexdns-pprof'
    scrape_interval: 60s
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/debug/pprof/allocs'
```

### Continuous Profiling (Pyroscope)

```bash
# Install Pyroscope agent
pip install pyroscope-io

# Profile continuously
pyroscope agent \
  --application-name=codexdns \
  --server-address=http://pyroscope.example.com \
  --spy-name=gospy \
  --detect-subprocesses \
  http://localhost:8080/debug/pprof
```

## Production Considerations

### Security

**Do NOT expose pprof publicly**:
- Use firewall rules to restrict access
- Bind HTTP server to localhost only
- Use reverse proxy with authentication
- Enable only when needed, disable immediately after

### Performance Impact

Profiling has minimal overhead when idle, but:
- **CPU profiling**: ~5% overhead during 30s collection
- **Heap profiling**: Negligible overhead (sampling-based)
- **Trace**: Can generate large files (5-50MB for 10s)
- **Goroutine**: No overhead, instant snapshot

### Docker Deployment

If running in Docker, expose pprof port carefully:

```yaml
# docker-compose.yml
services:
  codexdns:
    ports:
      - "8080:8080"  # HTTP API
      # Do NOT expose pprof to host unless needed:
      # - "6060:6060"  # pprof (use SSH tunnel instead)
```

**Recommended**: Use SSH tunnel for production profiling:
```bash
ssh -L 8080:localhost:8080 user@server
go tool pprof http://localhost:8080/debug/pprof/heap
```

## Logs

When pprof is enabled/disabled, check startup logs:

```
[INFO] [HTTP] pprof profiling enabled at /debug/pprof/
```

or

```
[INFO] [HTTP] pprof profiling disabled (set enable_pprof: true to enable)
```

## Reference

- [Official pprof documentation](https://pkg.go.dev/net/http/pprof)
- [Go profiling guide](https://go.dev/blog/pprof)
- [Profiling Go programs](https://go.dev/blog/profiling-go-programs)
- [Execution tracer](https://go.dev/blog/execution-tracer)
