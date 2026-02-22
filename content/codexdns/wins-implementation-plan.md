# WINS/NetBIOS Server Implementation Plan

**Date**: January 26, 2026  
**Status**: Research Complete - Ready for Implementation  
**Estimated Effort**: 50-80 hours for full implementation

---

## Executive Summary

After comprehensive research, **there are NO mature, production-ready standalone WINS/NetBIOS server libraries in Go**. The recommended approach is to implement a custom WINS server from scratch, following the proven NTP integration pattern already established in CodexDNS.

**Key Finding**: The NetBIOS protocol is well-documented (RFCs 1001, 1002), and CodexDNS architecture provides the perfect foundation for this integration.

---

## 1. Existing Go Libraries Research

### 1.1 google/gopacket
- **Import**: `github.com/google/gopacket/layers`
- **GitHub Stars**: ~8.4k
- **Status**: ✅ Active (2024+)
- **License**: BSD-3-Clause
- **NetBIOS Support**: 
  - Port constants only (137, 138, 139)
  - Found in `layers/ports.go` lines 110-139
  - No protocol implementation
- **Use Case**: Would need custom NetBIOS protocol built on top
- **Verdict**: Not sufficient alone

### 1.2 stacktitan/smb
- **Import**: `github.com/stacktitan/smb`
- **GitHub**: https://github.com/stacktitan/smb
- **GitHub Stars**: ~380
- **Status**: ⚠️ Abandoned (last update 2019-2020)
- **License**: MIT
- **Features**:
  - SMB2/3 client library
  - NetBIOS Session Service transport (port 139)
  - NTLMSSP authentication
  - Session framing over NetBIOS
- **Code Quality**: Good structure, proper error handling
- **Pros**: 
  - Well-documented SMB protocol implementation
  - Shows NetBIOS session message framing
  - Good encoder/decoder pattern
- **Cons**: 
  - **NOT a NetBIOS Name Service (NBNS) implementation**
  - Only handles session transport layer
  - Abandoned project
  - Client-only (no server)
- **Verdict**: Not useful for WINS server

### 1.3 hirochachacha/go-smb2
- **Import**: `github.com/hirochachacha/go-smb2`
- **GitHub**: https://github.com/hirochachacha/go-smb2
- **GitHub Stars**: ~400
- **Status**: ✅ Well-maintained (2023-2024)
- **License**: MIT
- **Features**: Modern SMB2/3 client
- **Code Quality**: Excellent, modern Go idioms
- **NetBIOS Support**: 
  - Minimal - uses direct SMB2 over TCP (port 445)
  - Does NOT use NetBIOS (modern approach)
- **Pros**: Best modern SMB client in Go
- **Cons**: **NO NetBIOS support** (uses modern SMB3 without NetBIOS layer)
- **Verdict**: Not relevant for WINS

### 1.4 Other Findings

**No other significant Go libraries found for:**
- NetBIOS Name Service (NBNS) - UDP port 137
- WINS (Windows Internet Name Service)
- NetBIOS Datagram Service - UDP port 138
- Standalone NetBIOS implementations

### 1.5 Conclusion

**NO standalone WINS/NetBIOS Name Service server implementations found in Go ecosystem.**

The existing packages only provide:
- Port constants (`google/gopacket`)
- SMB client with NetBIOS session transport (`stacktitan/smb` - abandoned)
- Modern SMB without NetBIOS (`hirochachacha/go-smb2`)

**Recommendation**: Custom implementation from scratch is the only viable option.

---

## 2. NetBIOS/WINS Protocol Details

### 2.1 Port Numbers

```
UDP 137: NetBIOS Name Service (NBNS) - name registration/query/release
UDP 138: NetBIOS Datagram Service - connectionless communication
TCP 139: NetBIOS Session Service - connection-oriented communication
TCP 445: SMB over TCP (modern, bypasses NetBIOS entirely)
```

**WINS Implementation Focus**: UDP port 137 (NetBIOS Name Service)

### 2.2 NBNS Packet Structure (RFC 1001, 1002)

#### Header (12 bytes)

```
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|                Transaction ID                 |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|QR|  OpCode |AA|TC|RD|RA| 0| 0|B|  RCode    |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|              Question Count                   |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|               Answer Count                    |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|             Authority Count                   |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|            Additional Count                   |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+

Fields:
- Transaction ID (2 bytes): Identifies the request/response pair
- Flags (2 bytes):
  * QR (1 bit): 0=Query, 1=Response
  * OpCode (4 bits): 0=Query, 5=Registration, 6=Release, 7=WACK
  * AA (1 bit): Authoritative Answer
  * TC (1 bit): Truncated
  * RD (1 bit): Recursion Desired
  * RA (1 bit): Recursion Available
  * B (1 bit): Broadcast flag
  * RCode (4 bits): Return code (0=success, 3=name error, etc.)
- Question Count (2 bytes): Number of questions
- Answer Count (2 bytes): Number of answers
- Authority Count (2 bytes): Number of authority records
- Additional Count (2 bytes): Number of additional records
```

#### Question Section

```
- Name (34 bytes encoded): NetBIOS name with type byte
- Type (2 bytes): NB (0x0020) or NBSTAT (0x0021)
- Class (2 bytes): IN (0x0001 - Internet)
```

#### Resource Record (Answer Section)

```
- Name (34 bytes encoded): NetBIOS name
- Type (2 bytes): Record type
- Class (2 bytes): Record class
- TTL (4 bytes): Time-to-live in seconds
- RD Length (2 bytes): Length of resource data
- Resource Data (variable): IP address, node flags, etc.
```

### 2.3 NetBIOS Name Encoding

NetBIOS names are **16 characters** (15 user-defined + 1 type byte), encoded as follows:

**Encoding Process**:
1. Pad name to 16 characters with spaces
2. Split each character into two 4-bit nibbles (high and low)
3. Add 'A' (0x41) to each nibble
4. Prepend length byte (0x20 = 32 for encoded chars)
5. Terminate with 0x00

**Example - "WORKGROUP"**:
```
Original: "WORKGROUP       " + 0x00 (workstation suffix)
         = W O R K G R O U P _ _ _ _ _ _ 0x00
         = 0x57 0x4F 0x52 0x4B 0x47 0x52 0x4F 0x55 0x50 0x20 0x20 0x20 0x20 0x20 0x20 0x00

Encoding each byte:
  W (0x57) = 0x5 0x7 → E G (0x45 0x47)
  O (0x4F) = 0x4 0xF → E P (0x45 0x50)
  R (0x52) = 0x5 0x2 → E C (0x45 0x43)
  ... and so on ...

Final: 0x20 + "EGFCEFEECACACACACACACACACACACAAA" + 0x00
       (length)  (encoded name - 32 bytes)      (terminator)
```

**Decoding Process** (reverse):
1. Read length byte (should be 0x20)
2. For each pair of encoded bytes:
   - Subtract 0x41 from each byte
   - Combine nibbles: `(high << 4) | low`
3. Trim trailing spaces
4. Extract 16th byte as name type

**Common Name Types** (16th byte):
- `0x00`: Workstation Service (computer name)
- `0x03`: Messenger Service
- `0x20`: File Server Service
- `0x1B`: Domain Master Browser
- `0x1C`: Domain Controllers (group name)
- `0x1D`: Master Browser
- `0x1E`: Browser Service Elections
- `0x1F`: NetDDE Service

### 2.4 Message Types (OpCode)

#### Name Query (OpCode 0)
- **Purpose**: Resolve NetBIOS name to IP address
- **Request**: Client → Broadcast or WINS server
- **Response**: WINS/Owner → Client with IP address(es)
- **Broadcast**: B-node and M-node use broadcast first
- **WINS**: P-node and H-node query WINS directly

#### Name Registration (OpCode 5)
- **Purpose**: Register name → IP mapping with WINS server
- **Request**: Client → WINS server
- **Response**: WINS → Client (positive/negative acknowledgment)
- **Refresh**: Periodic updates (default every 15 minutes)
- **Conflict**: Server may challenge if name already registered

#### Name Refresh (OpCode 8)
- **Purpose**: Update TTL for existing registration
- **Request**: Client → WINS server
- **Response**: Acknowledgment
- **Frequency**: Default every 15 minutes (half of 30-minute renewal)

#### Name Release (OpCode 6)
- **Purpose**: Remove name registration when shutting down
- **Request**: Client → WINS server
- **Response**: WINS → Client acknowledgment
- **Effect**: Name marked as released/tombstoned

#### WACK - Wait for Acknowledgment (OpCode 7)
- **Purpose**: Tell client to wait during complex operations
- **Response**: WINS → Client to indicate "processing, please wait"
- **Use Case**: Prevents timeout during replication or database operations

### 2.5 Node Types

**B-node (Broadcast)**: 
- **Behavior**: Broadcasts on local subnet
- **Pros**: Simple, no server needed
- **Cons**: Limited to broadcast domain, high network traffic
- **Use Case**: Small networks without WINS

**P-node (Point-to-point)**: 
- **Behavior**: Uses WINS server directly
- **Pros**: No broadcast, scalable
- **Cons**: Requires WINS configuration, fails if WINS unavailable
- **Use Case**: Large networks with centralized WINS

**M-node (Mixed)**: 
- **Behavior**: Tries broadcast first, then WINS
- **Pros**: Works without WINS, falls back to WINS if needed
- **Cons**: Still generates broadcast traffic
- **Use Case**: Migration scenarios

**H-node (Hybrid)**: 
- **Behavior**: Tries WINS first (preferred), falls back to broadcast
- **Pros**: Efficient, reduces broadcast traffic, resilient
- **Cons**: Requires WINS for optimal performance
- **Use Case**: **Most common in Windows networks**

---

## 3. WINS Server Functionality Requirements

### 3.1 Core Functions (Phase 1 - MVP)

#### 1. Name Query Handler
**Function**: Respond to NetBIOS name resolution requests

**Process**:
1. Receive UDP packet on port 137
2. Parse NBNS query packet (extract name and type)
3. Lookup name in database (active registrations)
4. If found: Return positive response with IP address
5. If not found: Return negative response (name error)
6. Log query for analytics

**Database Query**:
```sql
SELECT ip_address, ttl 
FROM wins_registrations 
WHERE name = ? AND name_type = ? AND state = 'active'
```

**Performance Target**: < 5ms response time

#### 2. Name Registration Handler
**Function**: Accept and store new NetBIOS name registrations

**Process**:
1. Receive registration request
2. Extract name, type, IP, TTL, node type
3. Check for existing registration (conflict detection)
4. If conflict: 
   - Same IP → Accept as refresh
   - Different IP → Challenge or reject
5. If new: Create registration record
6. Update expiration time based on TTL
7. Send positive/negative acknowledgment

**Conflict Resolution**:
- **Same IP**: Treat as refresh, update TTL
- **Different IP**: 
  - For unique names: Send challenge to current owner
  - For group names: Allow multiple registrations
  - Static entries: Cannot be overwritten

#### 3. Name Refresh Handler
**Function**: Update TTL for existing registrations

**Process**:
1. Receive refresh request
2. Verify name and IP match existing registration
3. Update TTL and expiration timestamp
4. Send acknowledgment

**Default Refresh Interval**: 15 minutes (configurable)

#### 4. Name Release Handler
**Function**: Remove name registration when client shuts down

**Process**:
1. Receive release request
2. Verify name and IP match
3. Mark record as "released" (tombstoned, not deleted)
4. Send acknowledgment

**Tombstone Period**: Retain released records for replication (default 6 days)

#### 5. Database Management
**Functions**:
- Store active registrations
- Expire old entries based on TTL
- Cleanup tombstoned records
- Support static entries (never expire)

**Expiration Cleanup**:
- Run every hour
- Delete registrations where `expires_at < NOW()` and `static = false`
- Keep tombstoned records for replication window

**Default TTL**: 6 days (518,400 seconds)

### 3.2 Advanced Features (Phase 2)

#### 6. Conflict Detection & Resolution
**Scenarios**:
- **Unique Name Conflict**: Challenge current owner, timeout defense
- **Group Name**: Allow multiple IPs for same name
- **Static Override**: Manual entries cannot be challenged

**Challenge Process**:
1. Send challenge to current IP
2. Wait for defense response (timeout: 500ms)
3. If no response: Allow new registration
4. If defended: Reject new registration

#### 7. Statistics and Monitoring
**Metrics**:
- Queries per second (QPS)
- Registrations total
- Refreshes total
- Releases total
- Conflicts detected
- Active registrations count
- Cache hit rate (if caching implemented)
- Top queried names (analytics)

**Real-time Dashboard**:
- Update every 2 seconds via Server-Sent Events (SSE)
- Chart: Queries over time
- Chart: Top queried names
- Table: Recent queries

#### 8. Query Logging
**Purpose**: Audit trail and analytics

**Log Fields**:
- Timestamp
- Client IP
- Query name
- Query type (name suffix)
- Response IP (if found)
- Found (boolean)
- Latency (milliseconds)

**Storage**: Database table `wins_query_logs`

**Retention**: Configurable (default 30 days)

### 3.3 Enterprise Features (Phase 3)

#### 9. WINS Replication
**Purpose**: Share registrations between multiple WINS servers

**Types**:
- **Push Replication**: Send updates when threshold reached
- **Pull Replication**: Request updates on schedule
- **Push-Pull**: Combination of both

**Replication Partners**: Configure IP addresses of other WINS servers

**Complexity**: High - requires RFC deep-dive and extensive testing

#### 10. Active Directory Integration
**Purpose**: Sync with Windows domain infrastructure

**Features**:
- Dynamic DNS updates
- Secure updates (Kerberos)
- Integration with AD site topology

**Complexity**: Very high - Windows-specific knowledge required

#### 11. Burst Handling
**Purpose**: Optimize for startup storms (many clients registering simultaneously)

**Techniques**:
- Registration queue
- Batch database inserts
- Rate limiting per client
- Priority for refreshes over new registrations

---

## 4. Integration with CodexDNS

### 4.1 NTP Implementation Pattern (Reference)

CodexDNS already has a proven pattern for integrating auxiliary services. The NTP implementation provides the perfect template.

**Key Files in NTP Implementation**:

1. **Service Layer**: `internal/service/ntp.go`
   - Main service struct with lifecycle methods
   - Start/Stop/Restart/IsRunning
   - Metrics tracking (atomic counters)
   - Background workers (goroutines)

2. **HTTP Handlers**: `internal/http/handlers/ntp.go`
   - Dashboard view
   - Configuration view
   - JSON API endpoints
   - Server-Sent Events (SSE) for real-time stats

3. **Routes**: `internal/http/router.go`
   - UI routes: `/ntp`, `/ntp/config`
   - API routes: `/api/ntp/stats`, `/api/ntp/sse`

4. **Templates**:
   - `web/templates/ntp_dashboard.templ` - Real-time metrics
   - `web/templates/config-ntp.templ` - Configuration page

5. **Sidebar**: `web/templates/components/sidebar.templ`
   - Section: "NTP" with Dashboard and Configuration links

6. **Configuration**: `internal/config/config.go`
   - Fields: `NTPEnabled`, `NTPListenAddress`, `NTPListenPort`, etc.

**Service Structure Example** (from `internal/service/ntp.go`):
```go
type NTPService struct {
    cfg    *config.Config
    server *ntpserver.Server
    ctx    context.Context
    cancel context.CancelFunc
    mu     sync.RWMutex
    db     *gorm.DB
    
    requestsTotal    uint64  // Atomic counter
    errorsTotal      uint64
    rateLimitedTotal uint64
}

func NewNTPService(cfg *config.Config, db *gorm.DB) *NTPService
func (n *NTPService) Start() error
func (n *NTPService) Stop() error
func (n *NTPService) Restart() error
func (n *NTPService) IsRunning() bool
func (n *NTPService) GetCounters() (requests, errors, rateLimited uint64)
```

### 4.2 Proposed WINS Architecture

Following the **exact same pattern** as NTP for consistency:

#### File Structure
```
internal/
  service/
    wins.go                    ← Main service (mirrors ntp.go)
  
  storage/
    wins.go                    ← Database models (GORM)
  
  http/
    handlers/
      wins.go                  ← HTTP handlers (mirrors ntp.go)
  
  wins/                        ← WINS-specific protocol implementation
    parser.go                  ← Packet parsing (RFC 1001/1002)
    encoder.go                 ← Response packet building
    protocol.go                ← Constants and types
    names.go                   ← NetBIOS name encoding/decoding

web/
  templates/
    wins_dashboard.templ       ← Dashboard with real-time stats
    wins_config.templ          ← Configuration page
    wins_registrations.templ   ← Active registrations table

migrations/
  XXXXXX_create_wins_tables.up.sql    ← Database schema
  XXXXXX_create_wins_tables.down.sql  ← Rollback
```

#### 4.2.1 Service Layer (`internal/service/wins.go`)

**Full Implementation Template**:

```go
package service

import (
    "context"
    "fmt"
    "net"
    "sync"
    "sync/atomic"
    "time"

    "github.com/marcuoli/codexdns/internal/config"
    "github.com/marcuoli/codexdns/internal/constants"
    "github.com/marcuoli/codexdns/internal/logging"
    "github.com/marcuoli/codexdns/internal/storage"
    "github.com/marcuoli/codexdns/internal/wins"
    "gorm.io/gorm"
)

type WINSService struct {
    cfg    *config.Config
    db     *gorm.DB
    ctx    context.Context
    cancel context.CancelFunc
    mu     sync.RWMutex
    
    conn    *net.UDPConn
    running bool
    
    // Metrics (atomic for thread-safe access)
    queriesTotal        atomic.Uint64
    registrationsTotal  atomic.Uint64
    releasesTotal       atomic.Uint64
    refreshesTotal      atomic.Uint64
    conflictsTotal      atomic.Uint64
    errorsTotal         atomic.Uint64
}

func NewWINSService(cfg *config.Config, db *gorm.DB) *WINSService {
    return &WINSService{
        cfg:     cfg,
        db:      db,
        running: false,
    }
}

func (w *WINSService) Start() error {
    w.mu.Lock()
    defer w.mu.Unlock()
    
    if w.running {
        return fmt.Errorf("WINS server already running")
    }
    
    // Create UDP listener on configured port
    addr := net.UDPAddr{
        IP:   net.ParseIP(w.cfg.WINSListenAddress),
        Port: w.cfg.WINSListenPort,
    }
    
    conn, err := net.ListenUDP("udp", &addr)
    if err != nil {
        return fmt.Errorf("failed to start WINS listener: %w", err)
    }
    
    w.conn = conn
    w.ctx, w.cancel = context.WithCancel(context.Background())
    w.running = true
    
    // Start request handler goroutine
    GoTagged("WINSServer", GoroutineCategoryWINS, "WINS request handler", func() {
        w.handleRequests()
    })
    
    // Start expiration cleanup goroutine (runs every hour)
    GoTagged("WINSCleaner", GoroutineCategoryWINS, "WINS registration cleanup", func() {
        w.cleanupExpired()
    })
    
    logging.Printf(constants.LogPrefixInfo, constants.LogPrefixWINS, 
        "WINS server started on %s:%d", w.cfg.WINSListenAddress, w.cfg.WINSListenPort)
    
    return nil
}

func (w *WINSService) Stop() error {
    w.mu.Lock()
    defer w.mu.Unlock()
    
    if !w.running {
        return nil
    }
    
    w.cancel()
    if w.conn != nil {
        w.conn.Close()
    }
    w.running = false
    
    logging.Printf(constants.LogPrefixInfo, constants.LogPrefixWINS, "WINS server stopped")
    return nil
}

func (w *WINSService) Restart() error {
    if err := w.Stop(); err != nil {
        return err
    }
    time.Sleep(100 * time.Millisecond) // Brief pause
    return w.Start()
}

func (w *WINSService) IsRunning() bool {
    w.mu.RLock()
    defer w.mu.RUnlock()
    return w.running
}

func (w *WINSService) GetCounters() (queries, registrations, releases, conflicts uint64) {
    return w.queriesTotal.Load(), 
           w.registrationsTotal.Load(), 
           w.releasesTotal.Load(), 
           w.conflictsTotal.Load()
}

func (w *WINSService) handleRequests() {
    buf := make([]byte, 1500) // Max UDP packet size
    
    for {
        select {
        case <-w.ctx.Done():
            return
        default:
        }
        
        n, addr, err := w.conn.ReadFromUDP(buf)
        if err != nil {
            if w.ctx.Err() != nil {
                return // Shutting down
            }
            w.errorsTotal.Add(1)
            continue
        }
        
        // Process request in goroutine to avoid blocking
        packet := make([]byte, n)
        copy(packet, buf[:n])
        
        GoTagged("WINSRequestHandler", GoroutineCategoryWINS, "Handle WINS request", func() {
            w.processRequest(packet, addr)
        })
    }
}

func (w *WINSService) processRequest(buf []byte, addr *net.UDPAddr) {
    header, query, err := wins.ParseNBNSPacket(buf)
    if err != nil {
        logging.Printf(constants.LogPrefixWarn, constants.LogPrefixWINS, 
            "Invalid packet from %s: %v", addr.IP, err)
        w.errorsTotal.Add(1)
        return
    }
    
    switch header.OpCode() {
    case wins.OpCodeQuery:
        w.handleQuery(header, query, addr)
    case wins.OpCodeRegistration:
        w.handleRegistration(header, query, addr)
    case wins.OpCodeRelease:
        w.handleRelease(header, query, addr)
    default:
        logging.Printf(constants.LogPrefixWarn, constants.LogPrefixWINS, 
            "Unsupported opcode %d from %s", header.OpCode(), addr.IP)
    }
}

func (w *WINSService) handleQuery(header *wins.NBNSHeader, query *wins.NBNSQuery, addr *net.UDPAddr) {
    w.queriesTotal.Add(1)
    
    // Query database for registration
    var reg storage.WINSRegistration
    result := w.db.Where("name = ? AND name_type = ? AND state = ?", 
        query.Name, query.NameType, "active").First(&reg)
    
    var response []byte
    if result.Error == nil {
        // Found - return positive response
        response = wins.BuildQueryResponse(header.TransactionID, query.Name, 
            query.NameType, net.ParseIP(reg.IPAddress), reg.TTL)
        
        logging.Printf(constants.LogPrefixInfo, constants.LogPrefixWINS, 
            "Query %s<%02X> from %s -> %s", query.Name, query.NameType, addr.IP, reg.IPAddress)
    } else {
        // Not found - return negative response
        response = wins.BuildNegativeResponse(header.TransactionID, query.Name, query.NameType)
        
        logging.Printf(constants.LogPrefixInfo, constants.LogPrefixWINS, 
            "Query %s<%02X> from %s -> NOT FOUND", query.Name, query.NameType, addr.IP)
    }
    
    // Send response
    if _, err := w.conn.WriteToUDP(response, addr); err != nil {
        logging.Printf(constants.LogPrefixWarn, constants.LogPrefixWINS, 
            "Failed to send response to %s: %v", addr.IP, err)
        w.errorsTotal.Add(1)
    }
    
    // Log query to database (async)
    GoTagged("WINSQueryLogger", GoroutineCategoryWINS, "Log WINS query", func() {
        logEntry := storage.WINSQueryLog{
            Timestamp:  time.Now(),
            ClientIP:   addr.IP.String(),
            QueryName:  query.Name,
            QueryType:  query.NameType,
            ResponseIP: reg.IPAddress,
            Found:      result.Error == nil,
        }
        w.db.Create(&logEntry)
    })
}

func (w *WINSService) handleRegistration(header *wins.NBNSHeader, query *wins.NBNSQuery, addr *net.UDPAddr) {
    w.registrationsTotal.Add(1)
    
    // Check for existing registration
    var existing storage.WINSRegistration
    result := w.db.Where("name = ? AND name_type = ?", query.Name, query.NameType).First(&existing)
    
    if result.Error == nil {
        // Registration exists
        if existing.IPAddress == addr.IP.String() {
            // Refresh from same IP - update TTL
            existing.TTL = w.cfg.WINSDefaultTTL
            existing.ExpiresAt = time.Now().Add(time.Duration(existing.TTL) * time.Second)
            w.db.Save(&existing)
            w.refreshesTotal.Add(1)
            
            response := wins.BuildRegistrationResponse(header.TransactionID, true)
            w.conn.WriteToUDP(response, addr)
            
            logging.Printf(constants.LogPrefixInfo, constants.LogPrefixWINS, 
                "Refresh %s<%02X> from %s", query.Name, query.NameType, addr.IP)
        } else {
            // Conflict - different IP
            w.conflictsTotal.Add(1)
            
            response := wins.BuildRegistrationResponse(header.TransactionID, false)
            w.conn.WriteToUDP(response, addr)
            
            logging.Printf(constants.LogPrefixWarn, constants.LogPrefixWINS, 
                "Conflict %s<%02X> from %s (existing: %s)", 
                query.Name, query.NameType, addr.IP, existing.IPAddress)
        }
    } else {
        // New registration
        reg := storage.WINSRegistration{
            Name:       query.Name,
            NameType:   query.NameType,
            IPAddress:  addr.IP.String(),
            NodeType:   query.NodeType,
            TTL:        w.cfg.WINSDefaultTTL,
            ExpiresAt:  time.Now().Add(time.Duration(w.cfg.WINSDefaultTTL) * time.Second),
            Static:     false,
            State:      "active",
        }
        w.db.Create(&reg)
        
        response := wins.BuildRegistrationResponse(header.TransactionID, true)
        w.conn.WriteToUDP(response, addr)
        
        logging.Printf(constants.LogPrefixInfo, constants.LogPrefixWINS, 
            "Register %s<%02X> from %s", query.Name, query.NameType, addr.IP)
    }
}

func (w *WINSService) handleRelease(header *wins.NBNSHeader, query *wins.NBNSQuery, addr *net.UDPAddr) {
    w.releasesTotal.Add(1)
    
    // Mark as released (tombstone)
    w.db.Model(&storage.WINSRegistration{}).
        Where("name = ? AND name_type = ? AND ip_address = ?", 
            query.Name, query.NameType, addr.IP.String()).
        Update("state", "released")
    
    response := wins.BuildReleaseResponse(header.TransactionID)
    w.conn.WriteToUDP(response, addr)
    
    logging.Printf(constants.LogPrefixInfo, constants.LogPrefixWINS, 
        "Release %s<%02X> from %s", query.Name, query.NameType, addr.IP)
}

func (w *WINSService) cleanupExpired() {
    ticker := time.NewTicker(1 * time.Hour)
    defer ticker.Stop()
    
    for {
        select {
        case <-w.ctx.Done():
            return
        case <-ticker.C:
            // Delete expired registrations
            result := w.db.Where("expires_at < ? AND static = ?", time.Now(), false).
                Delete(&storage.WINSRegistration{})
            
            if result.RowsAffected > 0 {
                logging.Printf(constants.LogPrefixInfo, constants.LogPrefixWINS, 
                    "Cleaned up %d expired registrations", result.RowsAffected)
            }
        }
    }
}
```

#### 4.2.2 Database Models (`internal/storage/wins.go`)

```go
package storage

import (
    "time"
)

// WINSRegistration represents a NetBIOS name registration
type WINSRegistration struct {
    ID         uint      `gorm:"primaryKey" json:"id"`
    Name       string    `gorm:"index;size:15;not null" json:"name"`     // NetBIOS name (15 chars)
    NameType   uint8     `gorm:"not null" json:"name_type"`              // 0x00=workstation, 0x20=server, etc.
    IPAddress  string    `gorm:"index;not null" json:"ip_address"`
    NodeType   uint16    `gorm:"not null" json:"node_type"`              // B/P/M/H-node
    TTL        uint32    `gorm:"not null" json:"ttl"`                    // Seconds
    ExpiresAt  time.Time `gorm:"index;not null" json:"expires_at"`
    Static     bool      `gorm:"default:false" json:"static"`            // Manual entry
    State      string    `gorm:"default:'active'" json:"state"`          // active, released, tombstone
    CreatedAt  time.Time `json:"created_at"`
    UpdatedAt  time.Time `json:"updated_at"`
}

// TableName specifies the table name for GORM
func (WINSRegistration) TableName() string {
    return "wins_registrations"
}

// FormatNameWithType returns the name with type suffix for display
func (w *WINSRegistration) FormatNameWithType() string {
    return fmt.Sprintf("%s<%02X>", w.Name, w.NameType)
}

// TimeUntilExpiration returns duration until expiration
func (w *WINSRegistration) TimeUntilExpiration() time.Duration {
    return time.Until(w.ExpiresAt)
}

// IsExpired checks if registration has expired
func (w *WINSRegistration) IsExpired() bool {
    return time.Now().After(w.ExpiresAt) && !w.Static
}

// WINSQueryLog represents a NetBIOS name query (for analytics)
type WINSQueryLog struct {
    ID          uint      `gorm:"primaryKey" json:"id"`
    Timestamp   time.Time `gorm:"index;not null" json:"timestamp"`
    ClientIP    string    `gorm:"index;not null" json:"client_ip"`
    QueryName   string    `gorm:"index;not null" json:"query_name"`
    QueryType   uint8     `gorm:"not null" json:"query_type"`
    ResponseIP  string    `json:"response_ip"`
    Found       bool      `json:"found"`
    CreatedAt   time.Time `json:"created_at"`
}

// TableName specifies the table name for GORM
func (WINSQueryLog) TableName() string {
    return "wins_query_logs"
}
```

#### 4.2.3 HTTP Handlers (`internal/http/handlers/wins.go`)

```go
package handlers

import (
    "fmt"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/marcuoli/codexdns/internal/config"
    "github.com/marcuoli/codexdns/internal/service"
    "github.com/marcuoli/codexdns/internal/storage"
    "gorm.io/gorm"
)

type WINSHandlers struct {
    cfg       *config.Config
    configSvc *service.ConfigService
    winsSvc   *service.WINSService
    db        *gorm.DB
}

func NewWINSHandlers(cfg *config.Config, configSvc *service.ConfigService, winsSvc *service.WINSService, db *gorm.DB) *WINSHandlers {
    return &WINSHandlers{
        cfg:       cfg,
        configSvc: configSvc,
        winsSvc:   winsSvc,
        db:        db,
    }
}

// ViewDashboard renders the WINS dashboard page
func (h *WINSHandlers) ViewDashboard() gin.HandlerFunc {
    return func(c *gin.Context) {
        queries, registrations, releases, conflicts := h.winsSvc.GetCounters()
        
        var activeCount int64
        h.db.Model(&storage.WINSRegistration{}).Where("state = ?", "active").Count(&activeCount)
        
        data := gin.H{
            "title":           "WINS Dashboard",
            "page":            "wins-dashboard",
            "enabled":         h.cfg.WINSEnabled,
            "running":         h.winsSvc.IsRunning(),
            "listenAddress":   h.cfg.WINSListenAddress,
            "listenPort":      h.cfg.WINSListenPort,
            "queries":         queries,
            "registrations":   registrations,
            "releases":        releases,
            "conflicts":       conflicts,
            "activeRecords":   activeCount,
        }
        
        c.HTML(http.StatusOK, "wins_dashboard.templ", data)
    }
}

// ViewConfig renders the WINS configuration page
func (h *WINSHandlers) ViewConfig() gin.HandlerFunc {
    return func(c *gin.Context) {
        data := gin.H{
            "title":         "WINS Configuration",
            "page":          "wins-config",
            "enabled":       h.cfg.WINSEnabled,
            "listenAddress": h.cfg.WINSListenAddress,
            "listenPort":    h.cfg.WINSListenPort,
            "defaultTTL":    h.cfg.WINSDefaultTTL,
            "debugWINS":     h.cfg.DebugWINS,
        }
        
        c.HTML(http.StatusOK, "wins_config.templ", data)
    }
}

// ViewRegistrations renders the active registrations page
func (h *WINSHandlers) ViewRegistrations() gin.HandlerFunc {
    return func(c *gin.Context) {
        var registrations []storage.WINSRegistration
        h.db.Where("state = ?", "active").
            Order("name ASC").
            Find(&registrations)
        
        data := gin.H{
            "title":          "WINS Registrations",
            "page":           "wins-registrations",
            "registrations":  registrations,
        }
        
        c.HTML(http.StatusOK, "wins_registrations.templ", data)
    }
}

// GetStats returns current WINS statistics (JSON API)
func (h *WINSHandlers) GetStats() gin.HandlerFunc {
    return func(c *gin.Context) {
        queries, registrations, releases, conflicts := h.winsSvc.GetCounters()
        
        var activeCount int64
        h.db.Model(&storage.WINSRegistration{}).Where("state = ?", "active").Count(&activeCount)
        
        c.JSON(http.StatusOK, gin.H{
            "running":       h.winsSvc.IsRunning(),
            "queries":       queries,
            "registrations": registrations,
            "releases":      releases,
            "conflicts":     conflicts,
            "activeRecords": activeCount,
            "timestamp":     time.Now().Unix(),
        })
    }
}

// SSEStats provides real-time WINS statistics via Server-Sent Events
func (h *WINSHandlers) SSEStats() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("Content-Type", "text/event-stream")
        c.Header("Cache-Control", "no-cache")
        c.Header("Connection", "keep-alive")
        
        ticker := time.NewTicker(2 * time.Second)
        defer ticker.Stop()
        
        for {
            select {
            case <-c.Request.Context().Done():
                return
            case <-ticker.C:
                queries, registrations, releases, conflicts := h.winsSvc.GetCounters()
                
                var activeCount int64
                h.db.Model(&storage.WINSRegistration{}).Where("state = ?", "active").Count(&activeCount)
                
                data := fmt.Sprintf(`{"running":%t,"queries":%d,"registrations":%d,"releases":%d,"conflicts":%d,"activeRecords":%d}`,
                    h.winsSvc.IsRunning(), queries, registrations, releases, conflicts, activeCount)
                
                c.SSEvent("stats", data)
                c.Writer.Flush()
            }
        }
    }
}

// ListRegistrations returns all active registrations (JSON API)
func (h *WINSHandlers) ListRegistrations() gin.HandlerFunc {
    return func(c *gin.Context) {
        var registrations []storage.WINSRegistration
        h.db.Where("state = ?", "active").
            Order("name ASC").
            Find(&registrations)
        
        c.JSON(http.StatusOK, registrations)
    }
}

// CreateStaticRegistration adds a manual WINS entry
func (h *WINSHandlers) CreateStaticRegistration() gin.HandlerFunc {
    return func(c *gin.Context) {
        var req struct {
            Name      string `json:"name" binding:"required,max=15"`
            NameType  uint8  `json:"name_type" binding:"required"`
            IPAddress string `json:"ip_address" binding:"required,ip"`
        }
        
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }
        
        reg := storage.WINSRegistration{
            Name:       req.Name,
            NameType:   req.NameType,
            IPAddress:  req.IPAddress,
            NodeType:   0,
            TTL:        0, // Static entries don't expire
            ExpiresAt:  time.Now().Add(100 * 365 * 24 * time.Hour), // 100 years
            Static:     true,
            State:      "active",
        }
        
        if err := h.db.Create(&reg).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        
        c.JSON(http.StatusCreated, reg)
    }
}

// DeleteRegistration removes a WINS entry
func (h *WINSHandlers) DeleteRegistration() gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")
        
        if err := h.db.Delete(&storage.WINSRegistration{}, id).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        
        c.JSON(http.StatusOK, gin.H{"message": "Registration deleted"})
    }
}
```

#### 4.2.4 Protocol Implementation (`internal/wins/protocol.go`)

```go
package wins

// NetBIOS Name Service constants
const (
    OpCodeQuery        = 0
    OpCodeRegistration = 5
    OpCodeRelease      = 6
    OpCodeWACK         = 7
    
    TypeNB      = 0x0020  // NetBIOS general Name Service
    TypeNBSTAT  = 0x0021  // NetBIOS NODE STATUS
    
    ClassIN = 0x0001  // Internet class
    
    // Name types (16th byte of NetBIOS name)
    NameTypeWorkstation      = 0x00
    NameTypeMessenger        = 0x03
    NameTypeFileServer       = 0x20
    NameTypeDomainMaster     = 0x1B
    NameTypeDomainControllers = 0x1C
    NameTypeMasterBrowser    = 0x1D
    NameTypeBrowserElection  = 0x1E
)

// Node types
const (
    NodeTypeB = 0x0000  // Broadcast
    NodeTypeP = 0x2000  // Point-to-point
    NodeTypeM = 0x4000  // Mixed
    NodeTypeH = 0x6000  // Hybrid
)

type NBNSHeader struct {
    TransactionID uint16
    Flags         uint16
    Questions     uint16
    Answers       uint16
    Authority     uint16
    Additional    uint16
}

func (h *NBNSHeader) OpCode() uint8 {
    return uint8((h.Flags >> 11) & 0x0F)
}

func (h *NBNSHeader) IsResponse() bool {
    return (h.Flags & 0x8000) != 0
}

func (h *NBNSHeader) RCode() uint8 {
    return uint8(h.Flags & 0x000F)
}

type NBNSQuery struct {
    Name     string
    NameType uint8
    Type     uint16
    Class    uint16
    NodeType uint16
}
```

#### 4.2.5 Routes Registration (`internal/http/router.go`)

Add to router setup (after NTP section):

```go
// WINS/NetBIOS
if cfg.WINSEnabled {
    winsHandlers := handlers.NewWINSHandlers(cfg, service.NewConfigService(db, cfg), winsSvc, db)
    
    // UI routes
    authGroup.GET("/wins", winsHandlers.ViewDashboard())
    authGroup.GET("/wins/config", winsHandlers.ViewConfig())
    authGroup.GET("/wins/registrations", winsHandlers.ViewRegistrations())
    
    // API routes
    apiWINS := authGroup.Group("/api/wins")
    {
        apiWINS.GET("/stats", winsHandlers.GetStats())
        apiWINS.GET("/sse", winsHandlers.SSEStats())
        apiWINS.GET("/registrations", winsHandlers.ListRegistrations())
        apiWINS.POST("/registrations", winsHandlers.CreateStaticRegistration())
        apiWINS.DELETE("/registrations/:id", winsHandlers.DeleteRegistration())
    }
}
```

#### 4.2.6 Configuration Fields (`internal/config/config.go`)

Add to Config struct:

```go
// WINS server settings
WINSEnabled        bool   `json:"wins_enabled" ui:"label=Enable WINS Server,group=Services,order=19,help=Enable NetBIOS Name Service (WINS),default=false"`
WINSListenAddress  string `json:"wins_listen_address" ui:"label=WINS Listen Address,group=WINS,order=1,help=IP address for WINS to bind to,placeholder=0.0.0.0,default=0.0.0.0"`
WINSListenPort     int    `json:"wins_listen_port" ui:"label=WINS Listen Port,group=WINS,order=2,help=UDP port for WINS (NetBIOS Name Service),placeholder=137,default=137"`
WINSDefaultTTL     uint32 `json:"wins_default_ttl" ui:"label=Default TTL (seconds),group=WINS,order=3,help=Time-to-live for WINS registrations,placeholder=518400,default=518400"` // 6 days
DebugWINS          bool   `json:"debug_wins" ui:"label=Debug WINS,group=Debug,order=6,help=Enable detailed WINS logging,default=false"`
WINSQueryLogPath   string `json:"wins_query_log_path" ui:"label=WINS Query Log,group=Logging,order=9,help=Path to WINS query log file,placeholder=logs/wins_queries.log,default=logs/wins_queries.log"`
```

#### 4.2.7 Sidebar Menu (`web/templates/components/sidebar.templ`)

Add after NTP section:

```templ
<!-- WINS/NetBIOS -->
if cfg.WINSEnabled {
    <div class="pt-4">
        <h3 class="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            WINS/NetBIOS
        </h3>
        <div class="mt-1 space-y-1">
            @SidebarLink(SidebarLinkParams{
                Href:  "/wins",
                Page:  "wins-dashboard",
                Label: "Dashboard",
                Icon:  "📡",
            })
            @SidebarLink(SidebarLinkParams{
                Href:  "/wins/registrations",
                Page:  "wins-registrations",
                Label: "Registrations",
                Icon:  "📋",
            })
            @SidebarLink(SidebarLinkParams{
                Href:  "/wins/config",
                Page:  "wins-config",
                Label: "Configuration",
                Icon:  "⚙️",
            })
        </div>
    </div>
}
```

#### 4.2.8 Database Migration

Create migration file: `migrations/XXXXXX_create_wins_tables.up.sql`

```sql
-- WINS registrations table
CREATE TABLE IF NOT EXISTS wins_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(15) NOT NULL,
    name_type INTEGER NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    node_type INTEGER NOT NULL,
    ttl INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    static BOOLEAN DEFAULT 0,
    state VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wins_registrations_name ON wins_registrations(name);
CREATE INDEX idx_wins_registrations_ip ON wins_registrations(ip_address);
CREATE INDEX idx_wins_registrations_expires ON wins_registrations(expires_at);
CREATE INDEX idx_wins_registrations_state ON wins_registrations(state);

-- WINS query logs table
CREATE TABLE IF NOT EXISTS wins_query_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,
    client_ip VARCHAR(45) NOT NULL,
    query_name VARCHAR(15) NOT NULL,
    query_type INTEGER NOT NULL,
    response_ip VARCHAR(45),
    found BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wins_query_logs_timestamp ON wins_query_logs(timestamp);
CREATE INDEX idx_wins_query_logs_client ON wins_query_logs(client_ip);
CREATE INDEX idx_wins_query_logs_name ON wins_query_logs(query_name);
```

Create rollback: `migrations/XXXXXX_create_wins_tables.down.sql`

```sql
DROP INDEX IF EXISTS idx_wins_query_logs_name;
DROP INDEX IF EXISTS idx_wins_query_logs_client;
DROP INDEX IF EXISTS idx_wins_query_logs_timestamp;
DROP TABLE IF EXISTS wins_query_logs;

DROP INDEX IF EXISTS idx_wins_registrations_state;
DROP INDEX IF EXISTS idx_wins_registrations_expires;
DROP INDEX IF EXISTS idx_wins_registrations_ip;
DROP INDEX IF EXISTS idx_wins_registrations_name;
DROP TABLE IF EXISTS wins_registrations;
```

#### 4.2.9 Constants (`internal/constants/constants.go`)

Add WINS logging prefixes:

```go
const (
    // ... existing constants ...
    
    // WINS logging
    LogPrefixWINS       = "[WINS]"
    LogPrefixWINSQuery  = "[WINS-QUERY]"
    LogPrefixWINSReg    = "[WINS-REG]"
)
```

Add goroutine category:

```go
const (
    // ... existing categories ...
    
    GoroutineCategoryWINS = "wins"
)
```

---

## 5. Implementation Roadmap

### Phase 1: MVP - Basic WINS Server (20-30 hours)

#### Week 1: Foundation (10 hours)

**Day 1-2: Protocol Package (6 hours)**
- [ ] Create `internal/wins/` directory
- [ ] `protocol.go` - Define constants and types (1 hour)
- [ ] `names.go` - NetBIOS name encoding/decoding (2 hours)
- [ ] `parser.go` - Packet parser (2 hours)
- [ ] `encoder.go` - Response builder (1 hour)

**Day 3: Testing (4 hours)**
- [ ] Unit tests for name encoding/decoding (2 hours)
- [ ] Unit tests for packet parsing (2 hours)

#### Week 2: Service Layer (8 hours)

**Day 4: Database (3 hours)**
- [ ] `internal/storage/wins.go` - Database models (2 hours)
- [ ] Create migration files (1 hour)

**Day 5-6: WINS Service (5 hours)**
- [ ] `internal/service/wins.go` - Service skeleton (1 hour)
- [ ] UDP listener implementation (2 hours)
- [ ] Query handler (1 hour)
- [ ] Start/Stop/Restart methods (1 hour)

#### Week 3: UI Integration (12 hours)

**Day 7-8: HTTP Layer (4 hours)**
- [ ] `internal/http/handlers/wins.go` - Handlers (3 hours)
- [ ] Routes registration in `router.go` (1 hour)

**Day 9: Configuration (2 hours)**
- [ ] Add fields to `config.go` (1 hour)
- [ ] Add constants (1 hour)

**Day 10-12: Templates (6 hours)**
- [ ] `wins_dashboard.templ` - Dashboard (3 hours)
- [ ] `wins_config.templ` - Configuration page (2 hours)
- [ ] `wins_registrations.templ` - Registrations list (1 hour)

#### Week 4: Testing & Polish (5 hours)

**Day 13-14: Integration Testing (3 hours)**
- [ ] End-to-end tests (2 hours)
- [ ] Test with Windows `nbtstat` (30 min)
- [ ] Test with Linux `nmblookup` (30 min)

**Day 15: Documentation (2 hours)**
- [ ] Update README.md (1 hour)
- [ ] Write user guide (1 hour)

**Phase 1 Deliverables:**
- ✅ Basic WINS query/response working
- ✅ Dashboard showing real-time stats
- ✅ Configuration page
- ✅ Active registrations view
- ✅ Works with Windows `nbtstat` and Linux `nmblookup`

### Phase 2: Full Features (15-20 hours)

#### Weeks 5-6: Advanced Protocol Support

**Registration Handling (6 hours)**
- [ ] Name registration handler (3 hours)
- [ ] Name refresh handler (2 hours)
- [ ] Testing (1 hour)

**Release & Expiration (4 hours)**
- [ ] Name release handler (2 hours)
- [ ] TTL and expiration management (2 hours)

**Conflict Detection (5 hours)**
- [ ] Conflict detection logic (3 hours)
- [ ] Testing conflict scenarios (2 hours)

**Static Entries (3 hours)**
- [ ] Manual entry creation (2 hours)
- [ ] Enhanced UI for static entries (1 hour)

**Testing (2 hours)**
- [ ] Integration tests for all features
- [ ] Performance testing

**Phase 2 Deliverables:**
- ✅ Full WINS registration/refresh/release
- ✅ Conflict handling
- ✅ Automatic expiration cleanup
- ✅ Manual static entry creation via UI

### Phase 3: Enterprise Features (30+ hours)

**Future enhancements** (implement as needed):

**WINS Replication (20+ hours)**
- [ ] Replication protocol implementation
- [ ] Push/pull replication
- [ ] Partner configuration
- [ ] Database versioning
- [ ] Testing with multiple WINS servers

**Advanced Features (10+ hours)**
- [ ] Burst mode optimization
- [ ] Advanced analytics and reporting
- [ ] Export/import of registrations
- [ ] WINS database compaction

**Active Directory Integration (Variable)**
- [ ] Dynamic DNS updates
- [ ] Kerberos authentication
- [ ] AD site topology integration

---

## 6. Testing Strategy

### 6.1 Unit Tests

#### Parser Tests (`internal/wins/parser_test.go`)

```go
package wins

import (
    "testing"
)

func TestDecodeNetBIOSName(t *testing.T) {
    tests := []struct {
        name     string
        encoded  []byte
        expected string
    }{
        {
            name:     "WORKGROUP",
            encoded:  []byte{0x20, 'E','G','F','C','E','F','E','E','C','A','C','A','C','A','C','A','C','A','C','A','C','A','C','A','C','A','C','A','C','A','A','A', 0x00},
            expected: "WORKGROUP",
        },
        // Add more test cases
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := DecodeNetBIOSName(tt.encoded)
            if result != tt.expected {
                t.Errorf("Expected %s, got %s", tt.expected, result)
            }
        })
    }
}

func TestEncodeNetBIOSName(t *testing.T) {
    name := "WORKGROUP"
    nameType := uint8(0x00)
    
    encoded := EncodeNetBIOSName(name, nameType)
    decoded := DecodeNetBIOSName(encoded)
    
    if decoded != name {
        t.Errorf("Round-trip failed: expected %s, got %s", name, decoded)
    }
}

func TestParseNBNSQuery(t *testing.T) {
    // Test with real NBNS query packet
    packet := []byte{
        // Header
        0x12, 0x34, // Transaction ID
        0x01, 0x00, // Flags (standard query)
        0x00, 0x01, // Questions: 1
        0x00, 0x00, // Answers: 0
        0x00, 0x00, // Authority: 0
        0x00, 0x00, // Additional: 0
        // Question
        // ... encoded name ...
        0x00, 0x20, // Type: NB
        0x00, 0x01, // Class: IN
    }
    
    header, query, err := ParseNBNSPacket(packet)
    if err != nil {
        t.Fatalf("Parse failed: %v", err)
    }
    
    if header.TransactionID != 0x1234 {
        t.Errorf("Expected transaction ID 0x1234, got 0x%04X", header.TransactionID)
    }
}
```

#### Service Tests (`internal/service/wins_test.go`)

```go
package service

import (
    "testing"
    "github.com/marcuoli/codexdns/internal/config"
    "gorm.io/gorm"
)

func TestWINSServiceLifecycle(t *testing.T) {
    cfg := &config.Config{
        WINSEnabled:       true,
        WINSListenAddress: "127.0.0.1",
        WINSListenPort:    1137, // Non-privileged port for testing
        WINSDefaultTTL:    3600,
    }
    
    db := setupTestDB(t)
    defer cleanupTestDB(t, db)
    
    svc := NewWINSService(cfg, db)
    
    // Test Start
    if err := svc.Start(); err != nil {
        t.Fatalf("Failed to start: %v", err)
    }
    
    if !svc.IsRunning() {
        t.Error("Service should be running")
    }
    
    // Test Stop
    if err := svc.Stop(); err != nil {
        t.Fatalf("Failed to stop: %v", err)
    }
    
    if svc.IsRunning() {
        t.Error("Service should not be running")
    }
}

func TestQueryHandling(t *testing.T) {
    // TODO: Test query processing
}
```

### 6.2 Integration Tests

#### Windows Client Tests

```cmd
REM Set WINS server
netsh interface ip set wins "Local Area Connection" static 192.168.1.100

REM Register name (automatic when joining domain or workgroup)
net use

REM Query name
nbtstat -A 192.168.1.100

REM Check local cache
nbtstat -c

REM Purge cache
nbtstat -R
```

#### Linux Client Tests

```bash
# Install Samba tools (includes nmblookup)
sudo apt-get install smbclient

# Query name via WINS
nmblookup -U 192.168.1.100 WORKGROUP

# Query with specific name type
nmblookup -U 192.168.1.100 "WORKGROUP#20"

# Broadcast query (for comparison)
nmblookup WORKGROUP

# Node status query
nmblookup -A 192.168.1.100
```

#### Packet Capture

```bash
# Monitor WINS traffic
tcpdump -i any -n port 137 -X

# Filter specific client
tcpdump -i any -n port 137 and host 192.168.1.50

# Save to file for Wireshark analysis
tcpdump -i any -n port 137 -w wins.pcap
```

### 6.3 Performance Tests

#### Load Testing

```bash
# Use custom load test tool (to be developed)
# or adapt existing tools

# Target: 1000+ queries per second
# Monitor: CPU, memory, goroutine count, database connections
```

#### Metrics to Track
- Queries per second (sustained)
- Average response time
- 95th percentile response time
- Memory usage
- Goroutine count
- Database connection pool utilization

---

## 7. Code Quality Standards

### 7.1 Following CodexDNS Patterns

**Consistency Requirements**:
- ✅ **Same structure as NTP** - proven pattern, familiar to maintainers
- ✅ **GORM for database** - consistent with entire project
- ✅ **Goroutine tracking** - use `service.GoTagged()` for all background tasks
- ✅ **Proper logging** - use `[WINS]` prefix, structured logging
- ✅ **Configuration** - use `internal/config.Config`, no hardcoded values
- ✅ **Error handling** - comprehensive, descriptive errors
- ✅ **Metrics** - atomic counters for thread safety, expose via API

### 7.2 Documentation Requirements

**Code Documentation**:
- [ ] All exported functions have GoDoc comments
- [ ] Complex logic has inline comments explaining "why" not "what"
- [ ] Package-level documentation (`doc.go`)

**User Documentation**:
- [ ] README section for WINS
- [ ] Configuration guide (all settings explained)
- [ ] Troubleshooting guide (common issues)
- [ ] API documentation (all endpoints)

**Developer Documentation**:
- [ ] Architecture overview
- [ ] Protocol implementation notes
- [ ] Testing guide

### 7.3 Security Considerations

**Network Security**:
- **Port binding**: Validate listen address/port configuration
- **Input validation**: Sanitize all NetBIOS names (prevent injection)
- **Rate limiting**: Prevent query/registration floods
- **Access control**: Consider IP-based restrictions (optional)

**Data Security**:
- **Logging**: Audit trail for all registrations/releases
- **No sensitive data**: Don't log internal network details unnecessarily
- **Database**: Validate all inputs before database operations

**DoS Prevention**:
- **Max packet size**: Enforce 1500-byte limit
- **Query queue**: Limit concurrent processing
- **Client tracking**: Detect and throttle abusive clients

---

## 8. Success Criteria

### 8.1 Phase 1 MVP Success

**Functional Requirements**:
- ✅ WINS server starts and binds to UDP 137
- ✅ Responds to NetBIOS name queries correctly
- ✅ Stores registrations in database
- ✅ Lookups return correct IP addresses
- ✅ Dashboard shows real-time statistics
- ✅ Configuration page works (save/load)
- ✅ Compatible with Windows `nbtstat -A`
- ✅ Compatible with Linux `nmblookup -U`

**Quality Requirements**:
- ✅ All unit tests pass (>80% coverage)
- ✅ Integration tests pass
- ✅ No memory leaks under normal load
- ✅ No goroutine leaks
- ✅ Response time < 10ms for queries
- ✅ Can handle 100+ concurrent queries

### 8.2 Phase 2 Full Features Success

**Functional Requirements**:
- ✅ Handles registration requests correctly
- ✅ Handles refresh requests (updates TTL)
- ✅ Handles release requests (tombstones records)
- ✅ Detects and handles name conflicts
- ✅ Automatic expiration cleanup works
- ✅ Static entries configurable via UI
- ✅ Manual entry creation/deletion works

**Performance Requirements**:
- ✅ Can handle 1000+ queries per second
- ✅ Database queries optimized (indexes used)
- ✅ No performance degradation over time

### 8.3 Production Readiness

**Code Quality**:
- ✅ Comprehensive error handling
- ✅ Graceful shutdown (no abrupt termination)
- ✅ All linters pass (golangci-lint)
- ✅ Code review completed

**Operational**:
- ✅ Database migrations tested (up and down)
- ✅ Configuration validation works
- ✅ Monitoring and metrics exposed
- ✅ Logging appropriate (not too verbose)

**Documentation**:
- ✅ User guide complete
- ✅ API documentation complete
- ✅ Troubleshooting guide complete
- ✅ Changelog updated

---

## 9. Future Enhancements (Post-Phase 3)

### 9.1 Advanced Analytics

**Dashboard Enhancements**:
- **Top queried names**: Chart showing most popular queries
- **Client activity**: Map of clients and their query patterns
- **Geographic distribution**: If GeoIP available
- **Time-series analysis**: Query trends over time
- **Heatmap**: Query activity by hour/day of week

**Reporting**:
- Scheduled reports (daily/weekly)
- Export to CSV/PDF
- Email notifications for anomalies

### 9.2 Modern Alternatives Integration

**mDNS (Multicast DNS)**:
- Respond to `.local` queries
- Service discovery (DNS-SD)
- Zero-configuration networking
- Integration with WINS (fallback/hybrid)

**LLMNR (Link-Local Multicast Name Resolution)**:
- Microsoft's successor to NetBIOS
- Multicast IPv4 and IPv6
- Similar to mDNS but Windows-focused

**DNS Integration**:
- Auto-create A/PTR records from WINS registrations
- Sync between WINS and DNS
- Migration path from WINS to DNS

### 9.3 Cluster Support

**Multi-Master Setup**:
- Multiple WINS servers (high availability)
- Shared state via Redis
- Consistent hashing for load distribution
- Health checks and failover

**Scaling**:
- Horizontal scaling (multiple instances)
- Load balancing (DNS round-robin or dedicated LB)
- Regional deployments

---

## 10. References

### 10.1 RFCs and Standards

**Primary RFCs**:
- **RFC 1001**: Protocol Standard for a NetBIOS Service on a TCP/UDP Transport: Concepts and Methods
  - URL: https://tools.ietf.org/html/rfc1001
  - Essential reading for understanding NetBIOS concepts

- **RFC 1002**: Protocol Standard for a NetBIOS Service on a TCP/UDP Transport: Detailed Specifications
  - URL: https://tools.ietf.org/html/rfc1002
  - Detailed packet formats and protocol specifics

**Related RFCs**:
- **RFC 883**: Domain Names - Implementation and Specification
  - Background on name resolution concepts

- **RFC 1034/1035**: DNS specifications
  - For comparison with DNS architecture

### 10.2 Microsoft Documentation

**WINS Architecture**:
- [WINS Overview](https://docs.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/cc757976(v=ws.10))
- [NetBIOS over TCP/IP](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-nbte/1a5e82b3-5d8e-4dd9-8c47-3dfd6b77b4db)
- [WINS Replication](https://docs.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/cc754969(v=ws.10))

**Windows Server Documentation**:
- NetBIOS name resolution process
- WINS client configuration
- Troubleshooting WINS

### 10.3 Tools

**Packet Analysis**:
- **Wireshark**: NetBIOS protocol dissector, excellent for debugging
  - Filter: `nbns` or `udp.port == 137`
  - Decode As: NBT Datagram Service, NBT Name Service

**Windows Tools**:
- **nbtstat**: NetBIOS over TCP/IP statistics
  - `nbtstat -A <ip>` - Query remote WINS
  - `nbtstat -c` - Display cache
  - `nbtstat -R` - Purge cache
  - `nbtstat -RR` - Refresh registrations

**Linux/Unix Tools**:
- **nmblookup** (Samba): NetBIOS name lookup tool
  - `nmblookup -U <wins-ip> <name>` - Query WINS
  - `nmblookup -A <ip>` - Node status query
  - `nmblookup -S <name>` - Status query

- **tcpdump**: Packet capture for debugging
  - `tcpdump -i any -n port 137`

**Development Tools**:
- **golangci-lint**: Go code linting
- **gotestsum**: Better test output
- **go-test-coverage**: Coverage reporting

---

## 11. Decision Log

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| 2026-01-26 | Custom implementation from scratch | No viable Go libraries exist | High effort, full control |
| 2026-01-26 | Follow NTP integration pattern | Proven architecture in CodexDNS | Consistency, familiarity |
| 2026-01-26 | UDP port 137 only (Phase 1) | Focus on core Name Service first | Faster MVP |
| 2026-01-26 | GORM for database | Consistency with existing codebase | Easy integration |
| 2026-01-26 | Phased approach (MVP → Full → Enterprise) | Manageable increments, early feedback | Reduced risk |
| 2026-01-26 | SQLite default, multi-DB support | Match DNS server pattern | Flexibility |
| 2026-01-26 | SSE for real-time dashboard | Same pattern as NTP/DNS | Consistent UX |

---

## 12. Contact & Ownership

**Project**: CodexDNS WINS Server  
**Repository**: marcuoli/codexdns  
**Primary Developer**: TBD  
**Reviewer**: TBD  
**Documentation**: This file (`docs/wins-implementation-plan.md`)  
**Status Updates**: Track in GitHub Issues/Projects  

**Issue Tracking**:
- Label: `feature/wins`
- Milestone: "WINS Phase 1", "WINS Phase 2", "WINS Phase 3"

---

## Appendix A: NetBIOS Name Type Reference

| Type | Hex | Description | Usage |
|------|-----|-------------|-------|
| Workstation | 0x00 | Computer name | Unique, registered by workstation service |
| Messenger | 0x03 | Messenger service | Unique, for inter-process messages |
| File Server | 0x20 | Server service | Unique, registered by file/print servers |
| RAS Server | 0x06 | Remote Access Service | Unique |
| Domain Master Browser | 0x1B | PDC emulator | Unique, one per domain |
| Domain Controllers | 0x1C | Domain controllers | Group, all DCs register |
| Master Browser | 0x1D | Master browser | Unique, per subnet |
| Browser Elections | 0x1E | Browser election service | Group |
| NetDDE | 0x1F | Network DDE | Unique |
| Modemsharing | 0x21 | Modem sharing | Unique |
| SMS Clients | 0x43 | SMS remote control | Unique |
| SMS Admin | 0x44 | SMS remote chat | Unique |
| Network Monitor | 0xBE | Network Monitor agent | Unique |
| Network Monitor App | 0xBF | Network Monitor app | Unique |

**Common Patterns**:
- **0x00**: Basic computer name registration
- **0x20**: Server service (most common for servers)
- **0x1B/0x1C/0x1D**: Domain/browse-related (Active Directory)
- **0x03**: Messenger service (legacy, usually disabled)

---

## Appendix B: Sample Packet Structures

### B.1 Name Query Request

```
Hex dump:
00 00 01 10 00 01 00 00 00 00 00 00 20 45 47 46
43 45 46 45 45 43 41 43 41 43 41 43 41 43 41 43
41 43 41 43 41 43 41 43 41 43 41 41 41 00 00 20
00 01

Breakdown:
Header (12 bytes):
  Transaction ID: 0x0000
  Flags:         0x0110 (standard query, recursion desired)
  Questions:     0x0001
  Answers:       0x0000
  Authority:     0x0000
  Additional:    0x0000

Question (variable):
  Name length:  0x20 (32 bytes)
  Name:         "EGFCEFEECACACACACACACACACACACAAA" (encoded "WORKGROUP    <00>")
  Terminator:   0x00
  Type:         0x0020 (NB)
  Class:        0x0001 (IN)
```

### B.2 Name Query Response (Positive)

```
Hex dump:
00 00 85 00 00 00 00 01 00 00 00 00 20 45 47 46
43 45 46 45 45 43 41 43 41 43 41 43 41 43 41 43
41 43 41 43 41 43 41 43 41 43 41 41 41 00 00 20
00 01 00 00 00 3C 00 06 60 00 C0 A8 01 32

Breakdown:
Header (12 bytes):
  Transaction ID: 0x0000
  Flags:         0x8500 (response, authoritative, no error)
  Questions:     0x0000
  Answers:       0x0001
  Authority:     0x0000
  Additional:    0x0000

Answer (variable):
  Name:         (same as query)
  Type:         0x0020 (NB)
  Class:        0x0001 (IN)
  TTL:          0x0000003C (60 seconds)
  Data length:  0x0006 (6 bytes)
  Flags:        0x6000 (H-node, unique name)
  IP Address:   0xC0A80132 (192.168.1.50)
```

### B.3 Name Registration Request

```
Hex dump:
12 34 29 10 00 01 00 00 00 00 00 01 20 45 47 46
43 45 46 45 45 43 41 43 41 43 41 43 41 43 41 43
41 43 41 43 41 43 41 43 41 43 41 41 41 00 00 20
00 01 00 00 25 80 00 06 60 00 C0 A8 01 32

Breakdown:
Header:
  Transaction ID: 0x1234
  Flags:         0x2910 (registration request, recursion desired)
  OpCode:        5 (registration)
  Questions:     0x0001
  Answers:       0x0000
  Authority:     0x0000
  Additional:    0x0001

Question:
  Name:         "WORKGROUP    <00>" (encoded)
  Type:         0x0020 (NB)
  Class:        0x0001 (IN)

Additional (registration data):
  TTL:          0x00002580 (9600 seconds = 160 minutes)
  Data length:  0x0006
  Flags:        0x6000 (H-node, unique)
  IP Address:   0xC0A80132 (192.168.1.50)
```

---

## Appendix C: Example WINS Session

```
1. Client starts, registers name:
   Client → WINS: Registration Request
                  Name: WORKSTATION<00>
                  IP: 192.168.1.50
                  TTL: 518400 (6 days)
   
   WINS → Client: Positive Response
                  Name accepted

2. Another client queries name:
   Client2 → WINS: Query Request
                   Name: WORKSTATION<00>
   
   WINS → Client2: Query Response
                   Name: WORKSTATION<00>
                   IP: 192.168.1.50
                   TTL: 517000 (remaining)

3. Client refreshes registration (every 15 min):
   Client → WINS: Refresh Request
                  Name: WORKSTATION<00>
                  IP: 192.168.1.50
   
   WINS → Client: Positive Response
                  TTL reset to 518400

4. Client shuts down, releases name:
   Client → WINS: Release Request
                  Name: WORKSTATION<00>
                  IP: 192.168.1.50
   
   WINS → Client: Release Response
                  Name released

5. Subsequent query fails:
   Client2 → WINS: Query Request
                   Name: WORKSTATION<00>
   
   WINS → Client2: Negative Response
                   Name not found
```

---

## Appendix D: Troubleshooting Guide

### Common Issues

**Issue**: WINS server won't start
- **Cause**: Port 137 already in use
- **Solution**: Check with `netstat -an | grep 137`, stop conflicting service

**Issue**: Clients can't register
- **Cause**: Firewall blocking UDP 137
- **Solution**: Allow UDP 137 in firewall rules

**Issue**: Queries return "not found"
- **Cause**: Name not registered or expired
- **Solution**: Check registrations table, verify TTL

**Issue**: High memory usage
- **Cause**: Too many registrations in memory
- **Solution**: Implement cleanup, check expiration logic

**Issue**: Slow query responses
- **Cause**: Database not indexed properly
- **Solution**: Verify indexes exist on `name`, `ip_address`, `state`

### Debug Commands

```bash
# Check if WINS is listening
netstat -an | grep 137

# Test with nmblookup
nmblookup -U 127.0.0.1 TESTNAME

# Watch WINS traffic
tcpdump -i any -n port 137 -X

# Check database
sqlite3 data/codexdns.db "SELECT * FROM wins_registrations;"

# Check logs
tail -f logs/wins.log
```

---

**End of Document**

Last Updated: January 26, 2026
Version: 1.0
