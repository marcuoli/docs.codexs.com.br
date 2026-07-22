---
title: "DNS Response Cache"
description: "Configure, observe, and troubleshoot CodexDNS response caching."
weight: 40
---

# DNS Response Cache

CodexDNS can cache authoritative and forwarded DNS responses in bounded memory
or Redis. Cache keys include the selected resolution route and DNS request
properties that can change the response, so entries are not shared across
incompatible routes, DNSSEC modes, or request variants.

## Cache page

Open **DNS > Cache** (or `/cache`) to inspect the active cache generation. The
page uses one shared snapshot refreshed every 10 seconds, regardless of the
number of connected browsers.

The **Client query cache outcomes** section reports:

- **Hits**: eligible client queries answered from the response cache.
- **Misses**: eligible queries that required resolution.
- **Errors**: cache lookups that failed open and continued with resolution.
- **Bypasses**: queries that were intentionally not cache eligible.
- **Hit rate**: `hits / (hits + misses + errors)`. Bypasses are excluded.

The normal window is the last 24 hours from retained hourly statistics. Before
the first hourly sample exists, the page labels and displays current-process
query outcomes instead of showing an empty 24-hour aggregate.

L1 and L2 cards are backend-operation metrics, not client-query metrics. With
Redis, L1 is the short in-process cache and L2 is Redis. The page also exposes
occupancy, capacity enforcement, evictions, expiry removals, Redis circuit and
pool health, and warmup outcomes.

## Interpreting a low household hit rate

A home resolver does not necessarily have a high server-side hit rate. Browsers
and operating systems cache locally, devices request A, AAAA, and HTTPS records
independently, CDN and telemetry names may be unique, and upstream TTLs can be
short.

Measure for at least 24 uninterrupted hours without clearing or restarting the
cache. A low rate is likely workload-shaped when:

- occupancy is healthy and no backend errors or circuit events occur;
- an immediate repeat of the same name, type, route, and request variant hits;
- most requests do not repeat before their upstream TTL expires.

Repeated complete keys that miss again before expiry indicate a cache or route
invalidation problem and should be investigated with the tier and upstream
metrics.

## Backends

### Memory

The memory backend is a sharded LRU bounded by `cache_max_size` and
`cache_memory_max_mb`. It performs incremental expiry cleanup and does not add a
second duplicate in-process L1.

### Redis

Redis uses an owned schema, instance, and process-lifetime namespace. Set
`CODEXDNS_CACHE_NAMESPACE` to a unique value when multiple CodexDNS instances
share one Redis database. CodexDNS does not change Redis server-global eviction
policy or enforce `cache_max_size` in Redis; configure Redis capacity and
eviction on the server.

A cache-only restart retains safe Redis L2 entries and shares mutation barriers
with the replacement generation. A full CodexDNS process restart uses a new
process namespace; optional warmup rebuilds common entries from recent query
history.

## TTL and response policy

- `cache_ttl` is the maximum positive lifetime; response RR TTLs can shorten it.
- `cache_negative_ttl` caps RFC 2308 NXDOMAIN and NODATA caching based on SOA
  TTL/MINIMUM.
- A zero effective TTL is not replaced with a default and is not cached.
- Transient errors, malformed or truncated responses, and blocked/sinkhole
  upstream answers are not stored as normal response-cache entries.

Warmup uses recent forwardable, non-blocked history and the same route, key, TTL,
and cacheability policy as live queries. Its outcomes are kept separate from the
client-query hit rate.

## Administration

Clearing all entries or deleting selected entries publishes a barrier before
the operation completes. An upstream request that started earlier cannot refill
the removed entry afterward.

Avoid these actions during a hit-rate observation window:

- **Clear cache** on `/cache`;
- the dashboard cache-stat reset action, which also clears entries;
- cache or service restart.

## Prometheus metrics

The main metric families are:

- `codexdns_cache_query_outcomes_total` for route-level client outcomes;
- `codexdns_cache_tier_operations_total` and
  `codexdns_cache_tier_operation_duration_seconds` for L1/L2 operations;
- `codexdns_cache_storage_value` for occupancy and bounded-storage state;
- `codexdns_cache_singleflight_events_total` for executions, shared waiters,
  and fills;
- `codexdns_cache_warmup_events_total` for warmup results;
- `codexdns_cache_redis_resilience_events_total` and Redis pool metrics for
  fail-open, circuit, reconnect, and connection-pressure diagnosis.

See [Configuration Parameters](../configuration/parameters) for all cache and
Redis settings and [Resolution Flow](resolution-flow) for route selection.
