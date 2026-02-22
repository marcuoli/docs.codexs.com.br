---
title: "NTP Integration"
description: "Integrate and use the built-in NTP server."
weight: 10
---

# NTP Server Integration Plan

## Current Status

The NTP server functionality in CodexDNS currently consists of:
- ✅ UI configuration pages (Dashboard, Configuration)
- ✅ Configuration storage (NTP enabled, listen address/port, time sync settings)
- ✅ Debug logging infrastructure (`[NTP]` prefix, `debug_ntp` flag)
- ✅ Charts styled to match DNS Dashboard (stacked bars + dual-axis)
- ❌ **No actual NTP server running**
- ❌ **No real NTP request handling or logging**

## Required Components

### 1. NTP Server Module Integration

The `go-ntpserver` module exists as a separate project but is not integrated into CodexDNS.

**Location**: `I:\OneDrive\Trabalhos\Desenv\golang\go-ntpserver`

**Integration Steps**:

1. Add module dependency to `go.mod`:
   ```bash
   go get github.com/marcuoli/go-ntpserver
   ```

2. Create NTP server service layer at `internal/service/ntp.go`:
   ```go
   package service
   
   import (
       "context"
       "github.com/marcuoli/go-ntpserver/pkg/ntpserver"
       "github.com/marcuoli/codexdns/internal/config"
       "github.com/marcuoli/codexdns/internal/logging"
   )
   
   type NTPService struct {
       cfg    *config.Config
       server *ntpserver.Server
       ctx    context.Context
       cancel context.CancelFunc
   }
   
   func NewNTPService(cfg *config.Config) *NTPService {
       return &NTPService{cfg: cfg}
   }
   
   func (n *NTPService) Start() error {
       if !n.cfg.NTPEnabled {
           return nil
       }
       
       n.ctx, n.cancel = context.WithCancel(context.Background())
       
       n.server = ntpserver.New(ntpserver.Config{
           ListenAddr:         fmt.Sprintf("%s:%d", n.cfg.NTPListenAddress, n.cfg.NTPListenPort),
           Stratum:            2,
           RateLimitPerSecond: 100,
           RateLimitBurst:     5,
           Hook:               n.requestHook,
       })
       
       return n.server.Start(n.ctx)
   }
   
   func (n *NTPService) Stop() error {
       if n.server != nil {
           return n.server.Stop()
       }
       if n.cancel != nil {
           n.cancel()
       }
       return nil
   }
   
   func (n *NTPService) requestHook(req ntpserver.Packet, meta ntpserver.RequestMeta) string {
       // Log NTP requests with [NTP] prefix
       if n.cfg.DebugNTP {
           logging.Printf(LogPrefixDebug, LogPrefixNTP, 
               "Request from %s:%d version=%d mode=%d", 
               meta.ClientIP, meta.ClientPort, req.VN, req.Mode)
       }
       
       // Always log to NTP log file
       logging.Printf(LogPrefixInfo, LogPrefixNTP,
           "Request from %s version=%d", meta.ClientIP, req.VN)
       
       return "" // no drop
   }
   
   func (n *NTPService) Metrics() MetricsSnapshot {
       if n.server != nil {
           return n.server.Metrics()
       }
       return MetricsSnapshot{}
   }
   ```

3. Initialize NTP service in `cmd/codexdns/main.go`:
   ```go
   // After creating config and services
   ntpSvc := service.NewNTPService(cfg)
   if cfg.NTPEnabled {
       if err := ntpSvc.Start(); err != nil {
           log.Printf("[ERROR] [NTP] Failed to start: %v", err)
       } else {
           log.Printf("[INFO] [NTP] Server started on %s:%d", 
               cfg.NTPListenAddress, cfg.NTPListenPort)
       }
   }
   
   // In shutdown handler
   defer func() {
       if err := ntpSvc.Stop(); err != nil {
           log.Printf("[ERROR] [NTP] Failed to stop: %v", err)
       }
   }()
   ```

### 2. Real-time Metrics Collection

Update `internal/http/handlers/ntp.go` to use real metrics from the NTP server:

```go
type NTPHandlers struct {
    cfg       *config.Config
    configSvc *service.ConfigService
    ntpSvc    *service.NTPService  // ADD THIS
}

func NewNTPHandlers(cfg *config.Config, configSvc *service.ConfigService, ntpSvc *service.NTPService) *NTPHandlers {
    return &NTPHandlers{
        cfg:       cfg,
        configSvc: configSvc,
        ntpSvc:    ntpSvc,  // ADD THIS
    }
}

// In GetStats() and SSEStats()
func (h *NTPHandlers) GetStats(c *gin.Context) {
    metrics := h.ntpSvc.Metrics()  // Get real metrics
    
    c.JSON(200, NTPStatsResponse{
        Timestamp:          time.Now(),
        NTPEnabled:         h.cfg.NTPEnabled,
        NTPListenAddress:   h.cfg.NTPListenAddress,
        NTPListenPort:      h.cfg.NTPListenPort,
        RequestsTotal:      metrics.RequestsTotal,
        ErrorsTotal:        metrics.ErrorsTotal,
        RateLimitedTotal:   metrics.RateLimitedTotal,
        // ... other fields
    })
}
```

### 3. NTP Request Logging

The `requestHook` function in the NTP service will handle logging:

- **Console/HTTP log** (when `debug_ntp` is enabled):
  ```
  [DEBUG] [NTP] Request from 192.168.1.100:49152 version=4 mode=3
  ```

- **NTP log file** (`logs/ntp.log`):
  ```
  [INFO] [NTP] Request from 192.168.1.100 version=4
  ```

The logging infrastructure already routes `[NTP]` prefixed messages to the correct log files via the patterns in `internal/constants/logprefixes.go`.

### 4. Service Lifecycle Control

Add start/stop/restart endpoints in `internal/http/handlers/ntp.go`:

```go
func (h *NTPHandlers) ServiceControl(c *gin.Context) {
    type ControlRequest struct {
        Action string `json:"action"` // "start", "stop", "restart"
    }
    
    var req ControlRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": "invalid request"})
        return
    }
    
    switch req.Action {
    case "start":
        if err := h.ntpSvc.Start(); err != nil {
            c.JSON(500, gin.H{"error": err.Error()})
            return
        }
    case "stop":
        if err := h.ntpSvc.Stop(); err != nil {
            c.JSON(500, gin.H{"error": err.Error()})
            return
        }
    case "restart":
        _ = h.ntpSvc.Stop()
        if err := h.ntpSvc.Start(); err != nil {
            c.JSON(500, gin.H{"error": err.Error()})
            return
        }
    default:
        c.JSON(400, gin.H{"error": "invalid action"})
        return
    }
    
    c.JSON(200, gin.H{"success": true})
}
```

Register the route in `internal/http/routes.go`:
```go
ntpGroup.POST("/service/control", ntpHandlers.ServiceControl)
```

### 5. Processing Time Metrics

To get processing time for the charts, the go-ntpserver already provides `ProcessingUSec` in events:

```go
// In NTP service, subscribe to events
eventCh, unsubscribe := n.server.Subscribe()
defer unsubscribe()

go func() {
    for event := range eventCh {
        // Track processing time for charts
        // Average it over time windows (similar to DNS stats)
        processingMS := float64(event.ProcessingUSec) / 1000.0
        // Store in metrics aggregator
    }
}()
```

## Testing Plan

1. **Unit Tests**: Test NTP service start/stop/restart
2. **Integration Tests**: Verify real NTP requests are logged
3. **UI Tests**: Verify charts update with real data
4. **Manual Tests**: Use `ntpdate` or `ntpq` to send real NTP requests:
   ```bash
   ntpdate -q 127.0.0.1
   ```

## Expected Outcomes

After integration:
- ✅ Real NTP server listens on configured address/port
- ✅ NTP requests are handled and responded to
- ✅ NTP requests are logged to `logs/ntp.log`
- ✅ Debug logging shows detailed request info when enabled
- ✅ Charts show real request rates, errors, and processing time
- ✅ Metrics counters increment with real traffic
- ✅ Service can be started/stopped via UI or CLI

## Dependencies

- `github.com/marcuoli/go-ntpserver` - Must be published or use replace directive:
  ```go
  // In go.mod during development:
  replace github.com/marcuoli/go-ntpserver => ../go-ntpserver
  ```

## Priority

This is a **future enhancement**. Current NTP UI and configuration are placeholders for when the actual server is integrated.
