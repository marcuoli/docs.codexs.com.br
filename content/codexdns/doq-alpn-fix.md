# DoQ ALPN Protocol Negotiation Fix

## Problem

DoQ (DNS-over-QUIC) upstream connections were failing with the following error:

```
[WARN] [DNS] Upstream server quic://dns.nextdns.io ping failed: 
DoQ connection failed: CRYPTO_ERROR 0x178 (remote): tls: no application protocol
```

## Root Cause

The TLS configuration for DoQ connections was missing **ALPN (Application Layer Protocol Negotiation)** configuration. 

According to **RFC 9250** (DNS over QUIC), the ALPN protocol identifier for DoQ is `"doq"`. When a QUIC client attempts to establish a connection without specifying the ALPN protocol, the remote server rejects the connection with a CRYPTO_ERROR.

## Solution

Updated the `NewUpstreamClient()` function in [internal/dns/upstream.go](../internal/dns/upstream.go) to set the correct ALPN protocol for each DNS protocol type:

### ALPN Protocol IDs

| Protocol | ALPN ID | RFC Reference |
|----------|---------|---------------|
| DoT (DNS-over-TLS) | `"dns"` | RFC 8310 |
| **DoQ (DNS-over-QUIC)** | **`"doq"`** | **RFC 9250** |
| DoH (DNS-over-HTTPS) | `"h2"` | RFC 8484 (HTTP/2) |
| DoH3 (DNS-over-HTTP/3) | `"h3"` | RFC 9110 (HTTP/3) |

### Code Changes

```go
// Set ALPN for secure protocols (DoT, DoH, DoQ, DoH3)
// RFC 9250: DoQ ALPN protocol ID is "doq"
switch server.Protocol {
case ProtocolDoT:
    tlsConfig.NextProtos = []string{"dns"}  // Standard DoT ALPN
case ProtocolDoQ:
    tlsConfig.NextProtos = []string{"doq"}  // RFC 9250: DNS over QUIC
case ProtocolDoH:
    tlsConfig.NextProtos = []string{"h2"}   // HTTP/2 for DoH
case ProtocolDoH3:
    tlsConfig.NextProtos = []string{"h3"}   // HTTP/3 for DoH3
}
```

## Testing

- All upstream protocol tests pass (20+ test functions)
- Added test coverage for ALPN configuration across all 4 protocol types
- Tests verify correct ALPN value for each protocol

## Impact

- ✅ DoQ upstream DNS queries now work correctly
- ✅ Queries to RFC 9250 compliant servers (e.g., dns.nextdns.io) are functional
- ✅ ALPN now properly configured for all secure DNS protocols
- ✅ No breaking changes to existing functionality

## Commit

- **Hash**: 624dddf
- **Version**: 0.5.20260127.2
- **Date**: 2026-01-27

## References

- [RFC 9250 - DNS over QUIC](https://datatracker.ietf.org/doc/html/rfc9250)
- [RFC 8484 - DNS Queries over HTTPS](https://datatracker.ietf.org/doc/html/rfc8484)
- [RFC 9110 - HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110)
- [QUIC Protocol Negotiation](https://datatracker.ietf.org/doc/html/rfc9000#section-7.4)
