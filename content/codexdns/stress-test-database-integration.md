# DNS Stress Test Database Integration

## Overview

The DNS stress test now automatically loads test domains from the CodexDNS database, testing all configured zones and their records across all zone types.

## Features

### Database-Driven Testing
- **Automatic Zone Discovery**: Loads all active zones from the database
- **Zone Type Support**: Tests all three zone types:
  - **Primary zones**: Authoritative zones with local records
  - **Forward zones**: Zones forwarded to upstream DNS servers
  - **Reverse zones**: PTR record zones for reverse DNS lookups
- **Record Testing**: Tests actual DNS records configured in each zone
- **Filter Rule Testing**: Includes blocked and whitelisted domains from filter rules

### Intelligent Domain Weighting
The test applies strategic weighting to ensure comprehensive coverage:

- **Primary zone records**: 2x weight (test local authoritative resolution)
- **Primary zone apex**: 3x weight
- **Reverse zone PTR records**: 2x weight (test reverse DNS)
- **Forward zone apex**: 2x weight (test forwarding logic)
- **Forward zone subdomains**: 1x weight (generated test subdomains)
- **Blocked domains**: 3x weight (test filtering effectiveness)
- **Whitelisted domains**: 2x weight (test whitelist exceptions)
- **External domains**: 1x weight (test recursive resolution)
- **Edge cases**: 1x weight (test error handling)

### Fallback Mechanism
If database loading fails or returns no data, the test automatically falls back to a hardcoded domain list, ensuring tests can run in any environment.

## Usage

### Basic Stress Test
```bash
# Default: loads from database, runs for 60s with 10 workers
go test -v ./internal/dns -run TestStressDNSServer -stress
```

### With Database
```bash
# Explicitly use database (default behavior)
go test -v ./internal/dns -run TestStressDNSServer \
  -stress \
  -usedb=true \
  -db=../../data/codexdns.db \
  -duration=30s \
  -workers=5
```

### Without Database (Fallback)
```bash
# Use hardcoded domain list only
go test -v ./internal/dns -run TestStressDNSServer \
  -stress \
  -usedb=false \
  -duration=30s \
  -workers=5
```

### Rate-Limited Test
```bash
# Limit to 1000 queries per second
go test -v ./internal/dns -run TestStressDNSServer \
  -stress \
  -qps=1000 \
  -duration=60s \
  -workers=10
```

### Custom Query Types
```bash
# Test specific record types
go test -v ./internal/dns -run TestStressDNSServer \
  -stress \
  -qtypes=A,AAAA,PTR,TXT \
  -duration=30s
```

## Test Output

The test provides detailed statistics including:

### Summary Information
- Data source (database vs fallback)
- Number of unique domains
- Total weighted domain list size
- Zone breakdown by type

### Performance Metrics
- Total queries executed
- Success/failure rates
- Response time statistics (min/avg/max/p50/p95/p99)
- Queries per second

### Categorization
- **Authoritative**: Queries to primary zones
- **Reverse**: PTR lookups in reverse zones
- **Forward Zone**: Queries forwarded to upstream
- **Blocked**: Filtered domains
- **Whitelisted**: Allowed domains
- **External**: Recursive queries
- **Edge Case**: Error handling tests

## Example Output

```
Testing DNS server at 127.0.0.1:5354
Attempting to load test data from database: ../../data/codexdns.db
Loaded 3 zones from database
  Primary zone: example.com
    Records: 25 total, types: map[A:15 AAAA:5 MX:3 TXT:2]
  Forward zone: corp.local (servers: 8.8.8.8:53,8.8.4.4:53)
  Reverse zone: 1.168.192.in-addr.arpa
    PTR records: 10
Loaded 150 filter rules from database
  Blocked: 120, Whitelisted: 30
Built weighted domain list: 185 unique domains, 425 total entries

Test Data Source: database (../../data/codexdns.db)
  Unique domains: 185
  Total weighted list: 425
```

## Implementation Details

### Database Queries
1. **Zones**: `SELECT * FROM zones WHERE is_active = true`
2. **Records**: `SELECT * FROM records WHERE zone_id = ?`
3. **Filter Rules**: `SELECT * FROM filter_rules`

### Category Cache
When loading from database, a category cache is built mapping each domain to its type:
- Enables accurate per-domain categorization
- Improves performance during test execution
- Falls back to heuristic categorization for hardcoded lists

### Thread Safety
- Database connection opens once at test start
- Read-only operations (no concurrent write issues)
- Category cache populated before workers start

## Benefits

1. **Real-World Testing**: Tests actual configured zones and records
2. **Comprehensive Coverage**: Automatically includes all zone types
3. **Filter Validation**: Verifies blocked/whitelisted domain handling
4. **Maintenance-Free**: No manual domain list updates needed
5. **Environment Flexibility**: Works with or without database access

## Troubleshooting

### "Failed to open database"
- Ensure CodexDNS application is stopped (database not locked)
- Check database path is correct relative to test file
- Use `-usedb=false` to bypass database loading

### "No domains loaded from database"
- Database may be empty or have no active zones
- Check that zones have `is_active = true`
- Test will automatically use fallback list

### Low Coverage for Specific Zone Type
- Add more records to that zone type in the database
- Adjust weighting in `loadDomainsFromDatabase` function if needed
- Generate test subdomains for forward zones (automatic)

## Future Enhancements

Potential improvements:
- [ ] Support for dynamic DNS (DHCP-generated records)
- [ ] Client-specific testing (per-client filter policies)
- [ ] Zone transfer (AXFR/IXFR) testing
- [ ] DNSSEC validation testing
- [ ] Multi-server testing (cluster mode)
