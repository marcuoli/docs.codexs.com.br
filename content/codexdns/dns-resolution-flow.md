# DNS Resolution Flow

This document describes the complete flow that CodexDNS follows when processing DNS queries from clients.

## Log Prefix Reference

### Response Source Prefixes

| Prefix | Meaning | Description |
|--------|---------|-------------|
| `[AUTH]` | Authoritative | Response from local authoritative zone |
| `[RULE]` | Forwarding Rule | Response forwarded via domain-specific forwarding rule |
| `[FWDZ]` | Forward Zone | Response forwarded to zone-specific upstream servers |
| `[FWD]` | Non-Authoritative | Response forwarded to default upstream servers |

### Cache Prefixes

| Prefix | Meaning | Description |
|--------|---------|-------------|
| `[CACHE:AUTH]` | Cached Authoritative | Cached response from authoritative zone |
| `[CACHE:RULE]` | Cached Rule | Cached response from forwarding rule |
| `[CACHE:FWDZ]` | Cached Forward Zone | Cached response from forward zone upstream |
| `[CACHE:FWD]` | Cached Non-Auth | Cached response from default upstream |
| `[NEG:AUTH]` | Negative Auth | No records in authoritative zone (empty answer) |
| `[NEG:RULE]` | Negative Rule | No answer from forwarding rule upstream |
| `[NEG:FWDZ]` | Negative Forward Zone | No answer from forward zone upstream |
| `[NEG:FWD]` | Negative Non-Auth | No answer from default upstream |

**Example Log Lines:**

```text
[DNS Query] example.com A from 192.168.1.100
[AUTH] example.com A → 192.168.1.10 (TTL: 3600)
[RULE] server.lan.corp.com A via 192.168.1.1 (3ms) → 192.168.1.50 (TTL: 300)
[FWDZ] server.internal.lan A via 10.0.0.1 (5ms) → 10.0.0.25 (TTL: 300)
[FWD] google.com A via 8.8.8.8 (20ms) → 142.250.185.14 (TTL: 300)
[CACHE:AUTH] example.com A → 192.168.1.10 (TTL: 3542)
[CACHE:RULE] server.lan.corp.com A → 192.168.1.50 (TTL: 245)
[CACHE:FWDZ] server.internal.lan A → 10.0.0.25 (TTL: 245)
[CACHE:FWD] google.com A → 142.250.185.14 (TTL: 180)
[NEG:AUTH] unknown.example.com A → NOANSWER
[NEG:RULE] ipv6host.lan.corp.com AAAA → NOANSWER
[NEG:FWDZ] ipv6host.internal.lan AAAA → NOANSWER
[NEG:FWD] ipv6only.google.com AAAA → NOANSWER
```

## Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DNS Query Received                              │
│                         (UDP/TCP on configured port)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           1. QUERY LOGGING                                   │
│              Log: [DNS Query] domain.example.com A from 192.168.1.100        │
│              Code: server.go:283                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        2. LOCAL RESOLVER CHECK                               │
│                    (Authoritative Zones & Forward Zones)                     │
│                         Code: resolver.go:54 (findMatchingZone)              │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
            ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
            │ Authoritative │  │ Forward Zone  │  │   No Match    │
            │  Zone Match   │  │    Match      │  │   (Default)   │
            │ Log: res:66   │  │ ⚠️ NO LOG     │  │ ⚠️ NO LOG     │
            │ Stats: res:69 │  │ (see fwd:233) │  │               │
            └───────────────┘  └───────────────┘  └───────────────┘
                    │                  │                  │
                    ▼                  │                  │
            ┌───────────────┐          │                  │
            │ Query Local   │          │                  │
            │   Database    │          │                  │
            │ Code: res:94  │          │                  │
            └───────────────┘          │                  │
                    │                  │                  │
         ┌─────────┴─────────┐         │                  │
         ▼                   ▼         │                  │
   ┌──────────┐       ┌──────────┐     │                  │
   │ Records  │       │   No     │     │                  │
   │  Found   │       │ Records  │     │                  │
   │Log:res:114│       │Log:res:111│     │                  │
   └──────────┘       └──────────┘     │                  │
         │                   │         │                  │
         ▼                   ▼         │                  │
  ┌────────────┐     ┌────────────┐    │                  │
  │   [AUTH]   │     │ [NEG:AUTH] │    │                  │
  │  RESPONSE  │     │  NOERROR   │    │                  │
  │  (Answer)  │     │  (Empty)   │    │                  │
  ├────────────┤     ├────────────┤    │                  │
  │Log: :313   │     │Log: :313   │    │                  │
  │Stats: :306 │     │Stats: :306 │    │                  │
  │Track: :310 │     │Track: :310 │    │                  │
  └────────────┘     └────────────┘    │                  │
                                       │                  │
                                       ▼                  ▼
                    ┌─────────────────────────────────────────┐
                    │   2c. LOCAL RECORDS OVERRIDE CHECK       │
                    │   (Only if local_records_override=true)  │
                    │           Code: server.go:516            │
                    └─────────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
          ┌─────────────────┐                   ┌─────────────────┐
          │  Local Record   │                   │   No Override   │
          │    Found        │                   │     Found       │
          │ Log: [AUTH]     │                   │                 │
          │ (local override)│                   │                 │
          └─────────────────┘                   └─────────────────┘
                    │                                     │
                    ▼                                     ▼
           ┌────────────┐              ┌─────────────────────────────────────────┐
           │   [AUTH]   │              │         3. FORWARDER PROCESSING          │
           │  RESPONSE  │              └─────────────────────────────────────────┘
           │(local ovrd)│                                 │
           └────────────┘              ┌──────────────────┴──────────────────┐
                                       │                                     │
                                       ▼                                     ▼
          ┌─────────────────┐                   ┌─────────────────┐
          │  Forward Zone   │                   │   No Match      │
          │    (FWDZ)       │                   │  Default (FWD)  │
          │ Log: fwd:233    │                   │ ⚠️ NO LOG       │
          └─────────────────┘                   └─────────────────┘
                    │                                     │
                    ▼                                     ▼
          ┌─────────────────┐                   ┌─────────────────┐
          │ 3a. CHECK CACHE │                   │ 3a. CHECK CACHE │
          │ [CACHE:FWDZ]?   │                   │  [CACHE:FWD]?   │
          │ Code: :336-337  │                   │ Code: :336-337  │
          └─────────────────┘                   └─────────────────┘
                    │                                     │
         ┌─────────┴─────────┐             ┌─────────────┴─────────────┐
         ▼                   ▼             ▼                           ▼
   ┌───────────┐       ┌───────────┐ ┌───────────┐               ┌───────────┐
   │ Cache HIT │       │Cache MISS │ │ Cache HIT │               │Cache MISS │
   │ (found)   │       │ (→ :359)  │ │ (found)   │               │ (→ :359)  │
   └───────────┘       └───────────┘ └───────────┘               └───────────┘
         │                   │             │                           │
         ▼                   │             ▼                           │
  ┌─────────────┐            │      ┌─────────────┐                    │
  │[CACHE:FWDZ] │            │      │ [CACHE:FWD] │                    │
  │or [NEG:FWDZ]│            │      │or [NEG:FWD] │                    │
  ├─────────────┤            │      ├─────────────┤                    │
  │Log: :340    │            │      │Log: :340    │                    │
  │Stats: :345  │            │      │Stats: :345  │                    │
  │Track: :350  │            │      │Track: :350  │                    │
  └─────────────┘            │      └─────────────┘                    │
                             │                                         │
                             ▼                                         ▼
                   ┌─────────────────┐                       ┌─────────────────┐
                   │ 3b. Forward to  │                       │ 3b. Forward to  │
                   │  Zone Servers   │                       │ Default Upstream│
                   │ Code: fwd:231   │                       │ Code: fwd:239   │
                   └─────────────────┘                       └─────────────────┘
                             │                                         │
                             ▼                                         ▼
                   ┌─────────────────┐                       ┌─────────────────┐
                   │ 3c. QUERY       │                       │ 3c. QUERY       │
                   │ UPSTREAM SERVER │                       │ UPSTREAM SERVER │
                   │ fwd:265 (rule)  │                       │ fwd:422 (ord)   │
                   │ fwd:275 (fail)  │                       │ fwd:443 (rr)    │
                   └─────────────────┘                       └─────────────────┘
                             │                                         │
                  ┌──────────┴──────────┐               ┌──────────────┴──────────┐
                  ▼                     ▼               ▼                         ▼
            ┌───────────┐         ┌───────────┐  ┌───────────┐             ┌───────────┐
            │  Success  │         │  Failure  │  │  Success  │             │  Failure  │
            │ fwd:287   │         │ fwd:293   │  │ (return)  │             │ (err!=nil)│
            └───────────┘         └───────────┘  └───────────┘             └───────────┘
                  │                     │              │                         │
                  ▼                     │              ▼                         │
         ┌─────────────────┐            │     ┌─────────────────┐                │
         │ [FWDZ] or       │            │     │ [FWD] or        │                │
         │ [NEG:FWDZ]      │            │     │ [NEG:FWD]       │                │
         ├─────────────────┤            │     ├─────────────────┤                │
         │Log: :371        │            ▼     │Log: :371        │                ▼
         │Stats: :374,:375 │      ┌─────────┐ │Stats: :374,:375 │          ┌─────────┐
         │Track: :377      │      │SERVFAIL │ │Track: :377      │          │SERVFAIL │
         └─────────────────┘      │Log: :364│ └─────────────────┘          │Log: :364│
                  │               └─────────┘          │                   └─────────┘
                  ▼                                    ▼
         ┌─────────────────┐                  ┌─────────────────┐
         │ Cache Response  │                  │ Cache Response  │
         │ (3d) :383-395   │                  │ (3d) :383-395   │
         │ Pos: TTL resp   │                  │ Pos: TTL resp   │
         │ Neg: 60s TTL    │                  │ Neg: 60s TTL    │
         └─────────────────┘                  └─────────────────┘
```

**Legend:** Line references are from `internal/dns/server.go` unless prefixed:

- `fwd:` = `forwarder.go`
- `res:` = `resolver.go`


## Detailed Step-by-Step Flow

### Step 1: Query Reception & Logging

When a DNS query arrives:

1. **Parse the query** - Extract question section (domain name, query type, class)
2. **Log the query** - `[DNS Query] domain.example.com. TYPE from client_ip`
3. **Track client** - Record query for client statistics

### Step 2: Local Resolver Check

The resolver attempts to find a matching zone for the query:

```go
// Priority order:
1. Find zone matching the query domain (longest suffix match)
2. Determine zone type:
   - Authoritative Zone → Query local database
   - Forward Zone → Skip to forwarder (Step 3)
   - No Match → Skip to forwarder (Step 3)
```

#### 2a. Authoritative Zone Resolution

If an **authoritative zone** matches:

1. Query the local database for matching records
2. If records found → Return authoritative response
3. If no records → Return authoritative NOERROR (empty answer)
   - This prevents forwarding for domains we're authoritative for

**Log Output:**

```text
[DNS Query] Authoritative: www.example.com. -> 192.168.1.100
```

#### 2b. Forward Zone Detection

If a **forward zone** matches:

- The resolver returns `(nil, false)` to indicate forwarding is needed
- No resolver logs are generated (to avoid noise)
- Processing continues to Step 2c (Local Records Override check) or Step 3

### Step 2c: Local Records Override (Optional)

When `local_records_override` is enabled in configuration, the system performs an additional check **before forwarding** to upstream servers:

```text
┌─────────────────────────────────────────────────────────────────┐
│                  LOCAL RECORDS OVERRIDE CHECK                   │
│              (Only when local_records_override = true)          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
              ┌─────────────────────────────────┐
              │  Search for matching record     │
              │  across ALL authoritative zones │
              └─────────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
        ┌───────────┐                       ┌───────────┐
        │  Record   │                       │ No Record │
        │  Found    │                       │  Found    │
        └───────────┘                       └───────────┘
              │                                   │
              ▼                                   ▼
       ┌─────────────┐                    ┌─────────────┐
       │   [AUTH]    │                    │ Continue to │
       │  RESPONSE   │                    │  Step 3     │
       │(local ovrd) │                    │ (Forward)   │
       └─────────────┘                    └─────────────┘
```

**Use Case:**

This feature allows you to "override" external DNS responses with local entries. For example:

- You have a local zone `example.com` with an A record for `www` pointing to `192.168.1.100`
- Normally, if the domain is NOT in an authoritative zone, queries are forwarded to upstream
- With `local_records_override` enabled, the system checks local records FIRST before forwarding

**Configuration:**

Enable via System Configuration → Upstream tab:

- Toggle "Local Records Override" ON

Or in `config.json`:

```json
{
  "local_records_override": true
}
```

**Log Output (Override Match):**

```text
[AUTH] www.example.com A -> 192.168.1.100 (local override, 1.2ms)
```

**Note:** This only applies to queries that would otherwise be forwarded. If the domain matches an authoritative zone directly (Step 2a), that takes precedence.

### Step 3: Forwarder Processing

When local resolution fails or a forward zone is detected:

#### 3a. Cache Check (for forwarded queries)

If `cache_forwarded_requests` is enabled:

1. Check cache for existing response (keyed by domain + query type)
2. **Cache HIT** → Return cached response immediately
3. **Cache MISS** → Continue to forwarding

**Log Output (Cache HIT):**

```text
[DNS Query] Cached: domain.example.com. -> 192.168.1.100
```

**Log Output (Cache HIT - No Answer):**

```text
[DNS Query] Cached: domain.example.com. -> NOANSWER(AAAA)
```

#### 3b. Forwarding Rule/Zone Matching

The forwarder checks (in priority order):

| Priority | Type | Description |
|----------|------|-------------|
| 1 | Forwarding Rules | Domain-specific rules (legacy, use Forward Zones instead) |
| 2 | Forward Zones | Zone-based forwarding to specific upstream servers |
| 3 | Default Upstreams | Global upstream servers from configuration |

**Log Output (Forward Zone Match):**

```text
[DNS] Forward zone: server.internal.lan. -> internal.lan (servers: [192.168.1.1])
```

#### 3c. Upstream Query

Query the selected upstream server(s) based on strategy:

| Strategy | Behavior |
|----------|----------|
| `ordered` | Try servers in configured order until one responds |
| `round-robin` | Distribute queries evenly across all servers |
| `fastest-response` | Prefer server with best average response time |
| `lowest-latency` | Prefer server with lowest network latency |

**Log Output (Success with Answer):**

```text
[DNS Query] Forwarded: host.example.com. via 8.8.8.8 (25ms) -> 93.184.216.34
```

**Log Output (Success - No Answer):**

```text
[DNS Query] Forwarded: host.example.com. via 8.8.8.8 (15ms) -> NOANSWER(AAAA)
```

**Log Output (Failure):**

```text
[DNS Query] Forward failed: host.example.com. -> SERVFAIL
```

#### 3d. Response Caching

After a successful upstream query:

1. **Positive responses** (has answers) → Cache for TTL from response (default: 5 minutes)
2. **Negative responses** (no answers) → Cache for 60 seconds (negative caching)

**Log Output:**

```text
[Cache] SET: domain.example.com (type=A, source=FWDZ, ttl=300s)
```

### Step 4: Response Delivery

The final response is sent to the client with appropriate flags:

| Source | Log Prefix | Authoritative (AA) | Recursion Available (RA) |
|--------|-----------|-------------------|-------------------------|
| Local Authoritative | `[AUTH]` | Yes | No |
| Forward Zone | `[FWDZ]` | No | Yes |
| Default Upstream | `[FWD]` | No | Yes |
| Cached Auth | `[CACHE:AUTH]` | Preserved | Preserved |
| Cached Forward Zone | `[CACHE:FWDZ]` | Preserved | Preserved |
| Cached Default | `[CACHE:FWD]` | Preserved | Preserved |

## Response Types Summary

| Scenario | Log Prefix | Response Code | Answer Section |
|----------|-----------|--------------|----------------|
| Authoritative zone, records found | `[AUTH]` | NOERROR | Records |
| Authoritative zone, no records | `[NEG:AUTH]` | NOERROR | Empty |
| Forward zone, answer received | `[FWDZ]` | NOERROR | Records from upstream |
| Forward zone, no answer | `[NEG:FWDZ]` | NOERROR | Empty |
| Default upstream, answer received | `[FWD]` | NOERROR | Records from upstream |
| Default upstream, no answer | `[NEG:FWD]` | NOERROR | Empty |
| Cached forward zone response | `[CACHE:FWDZ]` | NOERROR | Cached records |
| Cached default upstream response | `[CACHE:FWD]` | NOERROR | Cached records |
| Forward failed, all upstreams | - | SERVFAIL | Empty |
| No zone, no upstreams configured | - | SERVFAIL | Empty |

## Example Flows

### Example 1: Authoritative Query (Local)

```text
Client queries: www.mycompany.com A

1. [DNS Query] www.mycompany.com A from 192.168.1.100
2. [AUTH] www.mycompany.com A → 10.0.0.50 (TTL: 3600)
3. Response: A 10.0.0.50 (AA=1, Authoritative)
```

### Example 2: Authoritative Zone - No Record

```text
Client queries: unknown.mycompany.com A

1. [DNS Query] unknown.mycompany.com A from 192.168.1.100
2. [NEG:AUTH] unknown.mycompany.com A → NOANSWER
3. Response: NOERROR with empty answer (AA=1, Authoritative)
```

### Example 3: Forward Zone Query

```text
Client queries: server.internal.lan A

1. [DNS Query] server.internal.lan A from 192.168.1.100
2. [FWDZ] server.internal.lan A via 10.0.0.1 (5ms) → 10.0.0.25 (TTL: 300)
3. [Cache] SET: server.internal.lan (type=A, source=FWDZ, ttl=300s)
4. Response: A 10.0.0.25 (AA=0, Forward Zone)
```

### Example 4: External Query (Default Upstream)

```text
Client queries: www.google.com A

1. [DNS Query] www.google.com A from 192.168.1.100
2. [FWD] www.google.com A via 8.8.8.8 (20ms) → 142.250.80.4 (TTL: 300)
3. [Cache] SET: www.google.com (type=A, source=FWD, ttl=300s)
4. Response: A 142.250.80.4 (AA=0, Non-Authoritative)
```

### Example 5: Cached Forward Zone Response

```text
Client queries: server.internal.lan A (second request within TTL)

1. [DNS Query] server.internal.lan A from 192.168.1.100
2. [CACHE:FWDZ] server.internal.lan A → 10.0.0.25 (TTL: 245)
3. Response: A 10.0.0.25 (from cache)
```

### Example 6: Cached Non-Authoritative Response

```text
Client queries: www.google.com A (second request within TTL)

1. [DNS Query] www.google.com A from 192.168.1.100
2. [CACHE:FWD] www.google.com A → 142.250.80.4 (TTL: 180)
3. Response: A 142.250.80.4 (from cache)
```

### Example 7: Forward Zone - No IPv6 Record (Negative Caching)

```text
Client queries: server.internal.lan AAAA

1. [DNS Query] server.internal.lan AAAA from 192.168.1.100
2. [NEG:FWDZ] server.internal.lan AAAA via 10.0.0.1 (5ms) → NOANSWER
3. [Cache] SET: server.internal.lan (type=AAAA, source=FWDZ, ttl=60s)
4. Response: NOERROR with empty answer
```

### Example 8: Cached Negative Forward Zone Response

```text
Client queries: server.internal.lan AAAA (second request within negative TTL)

1. [DNS Query] server.internal.lan AAAA from 192.168.1.100
2. [NEG:FWDZ] server.internal.lan AAAA → NOANSWER (cached)
3. Response: NOERROR with empty answer (from negative cache)
```

### Example 9: Non-Authoritative - No IPv6 Record

```text
Client queries: ipv4only.example.com AAAA

1. [DNS Query] ipv4only.example.com AAAA from 192.168.1.100
2. [NEG:FWD] ipv4only.example.com AAAA via 8.8.8.8 (15ms) → NOANSWER
3. [Cache] SET: ipv4only.example.com (type=AAAA, source=FWD, ttl=60s)
4. Response: NOERROR with empty answer
```

## Implementation Reference

### Log Output Locations

All DNS query logging is centralized in `internal/dns/server.go`:

| Line | Log Statement | Description |
|------|---------------|-------------|
| `283` | `[DNS Query] %s from %s` | Initial query logging (domain + type + client IP) |
| `313` | `[DNS Query] Resolved locally: %s` | Authoritative response (local zone) |
| `340` | `[DNS Query] Cache HIT: %s -> %s` | Cached response |
| `364` | `[DNS Query] Forward failed for %s` | Forward failure |
| `371` | `[DNS Query] Forwarded %s to %s` | Successful forward |
| `419` | `[DNS Query] SERVFAIL for %s` | All upstreams failed |
| `423` | `[DNS Query] NXDOMAIN for %s` | No upstream configured |

Additional logs in `internal/dns/forwarder.go`:

| Line | Log Statement | Description |
|------|---------------|-------------|
| `224` | `[DNS] Forwarding rule matched: %s` | Forwarding rule match (legacy) |
| `233` | `[DNS] Forward zone matched: %s` | Forward zone match |
| `275` | `[DNS] Forwarding rule server %s failed` | Rule server failure |

Additional logs in `internal/dns/resolver.go`:

| Line | Log Statement | Description |
|------|---------------|-------------|
| `66` | `[Resolver] Matched authoritative zone: %s` | Authoritative zone detected |
| `69` | `RecordZoneQuery(zone.ID)` | Per-zone query statistics |
| `111` | `[Resolver] No records found for %s` | Auth zone with no matching records |
| `114` | `[Resolver] Found %d record(s)` | Records found in auth zone |
| `198` | `[Resolver] Forward zone match: %s` | Forward zone server lookup |

### Statistics Recording Locations

Statistics are recorded at key points in `internal/dns/server.go`:

| Line | Call | Event |
|------|------|-------|
| `306` | `statsSvc.RecordQuery(true, false, false, ...)` | Authoritative response |
| `345` | `statsSvc.RecordQuery(false, false, true, ...)` | Cache hit |
| `374` | `statsSvc.RecordQuery(false, true, false, ...)` | Forwarded query |
| `375` | `statsSvc.RecordUpstreamQuery(server, true, ...)` | Upstream server stats |

### Client Tracking Locations

Client tracking callback `trackClient()` defined at line `288` is called:

| Line | Context | Parameters |
|------|---------|------------|
| `310` | Authoritative | `wasAuthoritative=true` |
| `350` | Cache hit | `wasCached=true` |
| `377` | Forwarded | `wasForwarded=true` |
| `420` | SERVFAIL | `wasForwarded=true` (failed) |
| `425` | NXDOMAIN | all `false` |

### Statistics Service (`internal/service/stats.go`)

| Function | Line | Purpose |
|----------|------|---------|
| `RecordQuery()` | `176` | Records query type (auth/fwd/cache) and response time |
| `RecordUpstreamQuery()` | `199` | Records per-upstream server statistics |
| `FlushToDB()` | `224` | Persists in-memory stats to database (every 30s) |
| `PurgeOldStats()` | `371` | Removes stats older than retention period |

---

## Gap Analysis: Logs & Statistics Implementation Status

### ✅ Implemented Logs

| Scenario | Implementation | Code Location |
|----------|----------------|---------------|
| Default upstream selection | `[DNS] Using default upstreams for %s` | `forwarder.go:260` |
| Authoritative answer | `[AUTH] %s -> %s` | `server.go:315` |
| Authoritative empty answer | `[NEG:AUTH] %s -> NOANSWER` | `server.go:313` |
| Forward zone response | `[FWDZ] %s via %s -> %s` | `server.go:395` |
| Default upstream response | `[FWD] %s via %s -> %s` | `server.go:401` |
| Negative forward zone | `[NEG:FWDZ] %s -> NOANSWER` | `server.go:383` |
| Negative default upstream | `[NEG:FWD] %s -> NOANSWER` | `server.go:389` |
| Cached forward zone | `[CACHE:FWDZ] %s -> %s` | `server.go:362` |
| Cached default upstream | `[CACHE:FWD] %s -> %s` | `server.go:368` |
| Negative cache hit (FWDZ) | `[NEG:FWDZ] %s -> NOANSWER (cached)` | `server.go:356` |
| Negative cache hit (FWD) | `[NEG:FWD] %s -> NOANSWER (cached)` | `server.go:362` |
| Cache SET with source | `[Cache] SET: %s (type=%d, source=%s, ttl=%ds)` | `cache.go:518` |

### ⚠️ Not Implemented (by design)

| Scenario | Reason |
|----------|--------|
| Forward zone match (resolver) | Already logged in `forwarder.go:255` to avoid duplication |
| No zone match (resolver) | Would be noisy; logged when using default upstreams |

### ✅ Implemented Statistics

| Statistic | Method | Code Location |
|-----------|--------|---------------|
| Forward zone queries | `RecordZoneQuery(zoneID)` via `zone_stats.go` | Same as primary/reverse zones |
| Negative cache hits | `RecordNegativeCacheHit()` | `stats.go:269` |
| SERVFAIL count | `RecordSERVFAIL()` | `stats.go:275` |
| NXDOMAIN count | `RecordNXDOMAIN()` | `stats.go:281` |

### ✅ Implemented Forwarder Metadata

`ForwardQuery()` now returns `*ForwardResult` struct (`forwarder.go:117-143`):

```go
type ForwardResult struct {
    Response   *dns.Msg      // The DNS response message
    Server     string        // The server that responded
    Source     ForwardSource // Source type: rule, forward-zone, or default
    ZoneName   string        // Zone name if forward zone matched
    ZoneID     uint          // Zone ID for statistics (forward zones only)
    IsNegative bool          // True if response has no answers
    ElapsedMs  int64         // Query time in milliseconds
}
```

### ✅ Implemented Cache Source Tracking

`CachedResponse` now includes source type (`cache.go:37`):

```go
type CachedResponse struct {
    Response  *dns.Msg
    WireData  string      // Base64-encoded wire format for Redis
    CachedAt  time.Time
    ExpiresAt time.Time
    Source    CacheSource // Source type: auth, forward-zone, or default
}
```

New cache methods:

- `GetWithSource()` - Returns `(*dns.Msg, CacheSource, bool)` (`cache.go:461`)
- `SetWithSource()` - Stores with explicit source tracking (`cache.go:490`)

---

## Implementation Checklist

### Phase 1: Logging Prefixes ✅ COMPLETE

- [x] Add `source` field to cache entries (`internal/dns/cache.go`)
- [x] Modify `ForwardQuery()` to return source type (`internal/dns/forwarder.go`)
- [x] Update log statements in `server.go`:
  - [x] `[AUTH]` or `[NEG:AUTH]` based on answer count
  - [x] `[CACHE:*]` or `[NEG:*]` based on cached source
  - [x] `[FWDZ]` or `[FWD]` based on forwarder result

### Phase 2: Statistics Enhancement ✅ COMPLETE

- [x] Forward zone stats now use zone ID via `RecordZoneQuery(zoneID)` (unified with primary/reverse zones)
- [x] Add `pendingNegativeCacheHits` counter
- [x] Add `pendingSERVFAIL` and `pendingNXDOMAIN` counters
- [x] Forward zone queries properly persisted via `zone_stats.go` and `flushZoneStats()`

### Phase 3: Cache Source Tracking ✅ COMPLETE

- [x] Store source type (AUTH/FWDZ/FWD) with cached entries
- [x] Return source type on cache `GetWithSource()`
- [x] Include source in cache logging

---

## Configuration Reference

Key configuration options affecting DNS resolution:

```json
{
  "cache_enabled": true,
  "cache_forwarded_requests": true,
  "cache_ttl": 300,
  "upstream_servers": ["8.8.8.8:53", "1.1.1.1:53"],
  "upstream_strategy": "ordered",
  "upstream_timeout": 2000
}
```

## See Also

- [Zones Management](../README.md) - Creating authoritative and forward zones
- [Configuration Guide](../README.md) - Full configuration options
- [Cache Management](../README.md) - Cache settings and tuning
