# pprof Performance Review — February 18, 2026

Source: Live pprof data from `http://192.168.77.253:6060/debug/pprof/`

## Baseline Snapshot

| Metric | Value |
|--------|-------|
| Goroutines | 103 |
| HeapAlloc | ~207 MB |
| HeapObjects | 2,270,913 |
| TotalAlloc | ~692 MB |
| Sys | ~254 MB |
| NumGC | 17 |
| GCCPUFraction | 0.18% |
| MaxRSS | ~271 MB |

The application is healthy overall — low GC pressure, reasonable goroutine count. The improvements below target unnecessary DB load, per-query allocations, and architectural inefficiencies found by correlating pprof stack traces with code review.

---

## Priority 1 — Dashboard Stats Collection (Biggest DB Impact)

### Problem

The dashboard broadcaster ([dashboard_broadcaster.go](../internal/http/handlers/dashboard_broadcaster.go)) has three independent tickers:

- **Fast**: every 3 seconds
- **Medium**: every 15 seconds
- **Slow**: every 60 seconds

Each ticker independently calls `collectStats()` ([dashboard.go~L375](../internal/http/handlers/dashboard.go)), which runs **ALL ~12 DB queries** and then discards fields not needed for its tier. This means the DB is hit ~36 times per 3-second cycle unnecessarily.

### Queries executed per `collectStats()` call

| Location | Query | Description |
|----------|-------|-------------|
| [~L401](../internal/http/handlers/dashboard.go) | `GetProtocolStats("24h")` | Protocol stats (5 protocols) |
| [~L462](../internal/http/handlers/dashboard.go) | `GetTotalStats()` | `SUM(total_queries, cache_hits, cache_misses)` from `dns_stats` — full table scan |
| [~L668-677](../internal/http/handlers/dashboard.go) | Raw SQL subquery | Counts zones, records, clients, forwarding_rules |
| [~L682](../internal/http/handlers/dashboard.go) | `getCachedDBMetadata()` | Cached 60s — table count + DB size |
| [~L696](../internal/http/handlers/dashboard.go) | `ListForwardZoneServers(true)` | Forward zone upstream servers |
| [~L834](../internal/http/handlers/dashboard.go) | `GetUpstreamHourlyServerSeriesLast24h()` | Heavy 24h upstream histogram query |
| [~L875](../internal/http/handlers/dashboard.go) | Zone model + subquery | Recent 10 zones with record counts |
| [~L973-1001](../internal/http/handlers/dashboard.go) | JOIN client_query_stats ↔ clients | Top 10 clients (last 24h) + total |
| [~L1048-1067](../internal/http/handlers/dashboard.go) | `client_top_domains` GROUP BY | Top 10 queried domains (last 24h) + total |
| [~L1081-1127](../internal/http/handlers/dashboard.go) | `dns_queries` scan | Top blocked domains (cached ~55s via `slowCacheMu`) |
| [~L1131-1135](../internal/http/handlers/dashboard.go) | `collectQueryHistory()` | 24-hour hourly buckets (cached ~55s) |

### Existing caching within `collectStats`

- `getCachedCertInfo`: 5-minute TTL ([~L1585](../internal/http/handlers/dashboard.go))
- `getCachedDBMetadata`: 60-second TTL ([~L1600](../internal/http/handlers/dashboard.go))
- Top blocked domains + query history: ~55-second TTL via `slowCacheMu` ([~L1080](../internal/http/handlers/dashboard.go))

### Recommended Fix

1. **Split `collectStats()` into tier-specific collectors**: `collectFast()`, `collectMedium()`, `collectSlow()` that each only run queries relevant to their tier.
2. **Add short-TTL cache for heavy queries**: `GetTotalStats()` refreshes every ~10s, `GetUpstreamHourlyServerSeriesLast24h()` refreshes every ~60s.
3. **Move expensive queries to slow tier only**: 24h upstream histogram, top clients/domains, zone listing — these only change slowly and should run on the 60s tick, not every 3s.

---

## Priority 2 — DNS Filter Radix Tree Lookup (Per-Query Allocation)

### Problem

`RadixWildcardMatcher.Match()` at [filter.go~L334](../internal/service/filter.go) performs:

1. `reverseDomain(domain)` — uses `strings.Split` + `strings.Join` → 2 allocations per call
2. `WalkPrefix` — efficient O(log n) radix lookup
3. **Full tree `Walk`** — iterates the **entire tree** looking for `*` in keys, making it **O(n)** where n = number of filter entries
4. `wildcardMatch()` at [~L386](../internal/service/filter.go) does two more `strings.Split` calls per comparison

This runs on every DNS query that hits the filter path.

### Recommended Fix

1. **Pre-index wildcard patterns** at load time into a separate data structure so lookups avoid the full-tree walk.
2. **Cache reversed domain labels** or use a byte-level reversal without allocations in `reverseDomain()`.
3. **Pre-split patterns at insert time** instead of splitting on every `wildcardMatch()` call.
4. **In forwarder** ([forwarder.go~L1017](../internal/dns/forwarder.go)): `extractBaseDomain` also uses `strings.Split(domain, ".")` per call — consider index-based parsing.

---

## Priority 3 — ClientUpdateQueue Per-Query DB Hit

### Problem

`ClientUpdateQueue.Enqueue()` at [client.go~L293](../internal/service/client.go) runs:

```go
q.db.Where("ip_address = ?", clientIP).Select("discovering").First(&client)
```

…on **every single DNS query** to check the `discovering` flag. This is called from the DNS hot path.

### Recommended Fix

Cache `discovering` status in-memory (e.g., `sync.Map` or `atomic.Pointer` snapshot refreshed every few seconds) to eliminate this per-query DB round-trip.

---

## Priority 4 — GORM Prepared Statements (Easy Win)

### Problem

GORM `PrepareStmt: true` is **not enabled anywhere** in the codebase. The heap profile shows significant allocations in:

- `gorm.(*Statement).Build`
- `clause.Values.Build`
- `clause.Assignments`
- `strings.(*Builder).WriteString` / `strings.(*Builder).WriteByte` / `strings.(*Builder).Grow`

These are re-built from scratch on every query.

### Recommended Fix

Add `PrepareStmt: true` to the GORM session config in [db.go](../internal/storage/db.go). This caches prepared statements across queries, reducing per-query allocation overhead.

### Caveat

With SQLite, `PrepareStmt` can cause issues with concurrent writes — test thoroughly under load before enabling.

---

## Priority 5 — sync.Pool for DNS Hot Path

### Problem

- The `handleDNSQuery` panic recovery at [server.go~L1135](../internal/dns/server.go) allocates `make([]byte, 4096)` per query.
- Each DNS query allocates a new `dns.Msg` for the response.
- No `sync.Pool` usage found anywhere in the DNS package.

### Recommended Fix

1. Pool panic recovery buffers: `sync.Pool` for `[]byte` stacks.
2. Evaluate `sync.Pool` for `dns.Msg` response building at high QPS.

---

## Priority 6 — Log Rotation Goroutine Consolidation (26 → fewer)

### Problem

Each `NewRotatingLogWriter` in [logrotate.go](../internal/service/logrotate.go) spawns:
- 1 async write worker goroutine
- 1 async compression worker goroutine (if compression enabled)

With 13 log files defined in [filelogwriter.go](../internal/service/filelogwriter.go):

| # | Writer |
|---|--------|
| 1 | HTTP log |
| 2 | Access log (Apache CLF) |
| 3 | Error log (Apache style) |
| 4 | DNS log |
| 5 | DNS Query log |
| 6 | DNS Query Failed log |
| 7 | DHCP log |
| 8 | DHCP-DNS Integration log |
| 9 | NTP log |
| 10 | NTP Query log |
| 11 | Filter log |
| 12 | Cleanup log |
| 13 | Database SQL log |

Total: **13 write workers + 13 compression workers = 26 goroutines** just for log rotation. Plus 9 `lumberjack.millRun` goroutines (library).

### Recommended Fix

Consolidate compression workers into a single shared pool (1-3 workers) that all 13 writers submit to, reducing goroutines by ~10.

---

## Priority 7 — Minor Optimizations

### `GetTotalStats()` Index Check

[stats.go~L1291](../internal/service/stats.go): `SUM(total_queries, cache_hits, cache_misses)` scans the full `dns_stats` table. Verify indexes exist. For large tables, consider a materialized summary row updated on write.

### ClientUpdateQueue Batch Upserts

The 500ms batch at [client.go~L339](../internal/service/client.go) does individual GORM `Clauses(clause.OnConflict{...}).Create()` per stat type per client. For high-traffic scenarios, batch multiple upserts into a single SQL statement.

### Forwarder RWMutex Contention

Multiple `sync.RWMutex` fields in `Forwarder` (`rtMu`, `rrtMu`, `rsrtMu`, `cqMu`, `fcMu`, `latMu`) protect response-time slices. Under extreme load, write-side contention could bottleneck. Consider sharded or lock-free alternatives.

### AsyncLogWriter Backpressure

[async_writer.go](../internal/logging/async_writer.go): `Write()` blocks when the 10,000-entry channel is full. During a log flood (e.g., DDoS), this blocks the DNS goroutine. Consider a non-blocking send with drop-count metric.

---

## Existing Good Practices (No Changes Needed)

These patterns are already well-optimized and should be preserved:

| Pattern | Location | Notes |
|---------|----------|-------|
| Lock-free zone/record cache via `atomic.Pointer` | [resolver.go~L39-49](../internal/dns/resolver.go) | Copy-on-write snapshots, excellent |
| `GoTagged` removed from per-query hot path | [server.go~L1129](../internal/dns/server.go) | `activeQueries atomic.Int64` instead |
| Sampled goroutine polling (5s interval) | [server.go~L706-725](../internal/dns/server.go) | Avoids per-query `runtime.NumGoroutine()` |
| Sharded LRU (L1) in front of Redis | [cache.go~L100](../internal/dns/cache.go) | Local fast path before network |
| Async client tracking (worker pool) | [server.go~L1367-1384](../internal/dns/server.go) | Never blocks DNS response |
| Async query logging (enqueue) | [server.go~L1356](../internal/dns/server.go) | Fire-and-forget to DB logger |
| Per-upstream concurrency limiter | [forwarder.go~L296-317](../internal/dns/forwarder.go) | Channel semaphore per server |
| Non-blocking cache startup | [cache.go~L227-262](../internal/dns/cache.go) | Reconnect loop in background |
| All tickers use `defer ticker.Stop()` | Various | No ticker leaks found |
| Name normalization computed once | [server.go~L1302-1308](../internal/dns/server.go) | Passed via `NormalizedName` field |

---

## Verification Plan

After implementing changes:

1. Re-run `go tool pprof http://<host>:6060/debug/pprof/heap` — compare heap profiles
2. Compare goroutine counts via `/debug/pprof/goroutine?debug=1`
3. Monitor dashboard SSE responsiveness — stats should still update at same visual frequency
4. Run `go test ./...` and `go vet ./...` after each change
5. Load test DNS queries (e.g., `dnsperf`) to verify filter lookup and client tracking improvements
6. Check SQLite `busy_timeout` contention by monitoring for "database is locked" log messages
