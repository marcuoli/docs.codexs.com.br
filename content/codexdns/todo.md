# TODO

- DONE: Add Templ components for the icons (trash, for example)

- Add DNS servers configured on Forward zones to the "Upstream" widget also. "Upstream statistics" already shows their statistics.

- DONE: "Top Client" dashboard widget has wrong % computations

- DONE: "Top Queries" and "Top Blocked Domains" dashboard widget have wrong % computations. Instead of making computations in Java, can we have the data come from Go api directly ? If possible, do the same for "Top Client"

- DONE: Add HTMX button to "DNS cache" widget so we can reset the statistics. Also add the same button for all other widgets that contains statistics;

- DONE: Add a db-sql.log, if it does not exist yet to save all queries and the time takens to process it (Implemented SQL query logging with custom GORM logger that writes to db-sql.log. Logs all queries with execution time, highlights slow queries (>200ms), and integrates with existing log rotation system. Configurable via `db_log_path` in config and `CODEXDNS_DB_LOG_PATH` env var)

- DONE: Create a database cleanup/purge job if it does not exist yet and add logs to the main logile to keep track of the database cleanup job. (Implemented `CleanupService` with periodic database cleanup (runs every 24 hours by default). Cleans up: 1) DNS query logs older than 30 days, 2) Client history records older than 90 days, 3) DHCP integration updates older than 30 days, 4) Legacy archived clients. All cleanup operations are logged to the main log file with detailed statistics. Retention periods are configurable. Service starts automatically with the application and integrates with existing service lifecycle management. Tests included.)

- Add as much tests as possible to increase the coverage

- DONE +- :Add inline buttons icons besides the name icons to block client, domain ...

- DONE: Make the Dashboard in the SPA also

- DONE: Add the Zone select combo filter to the Live Queries page (Added Zone filter dropdown to the Live Queries page filters. Updated QueryStreamHandlers to fetch zones via ZoneService, added QueryStreamZone type and queryStreamZoneOptions helper to template, added zone filter to JavaScript that filters queries by domain suffix matching zone name. Also added Zone column to the table that shows which zone each query domain matches.)

- ANALYZED: Statistics behavior when master Filter service is off.

  **Finding:** This is expected/correct behavior, not a bug.

  When `FilterEnabled` is OFF in System Configuration:
  
  1. **Live Filter Stats page** - Shows `filterEnabled: false` status badge ("Disabled"). The `blockedQueries`, `allowedQueries`, `domainHits`, `wildcardHits`, `regexHits` counters will NOT increment because domain filtering is skipped entirely (server.go line 517: `if filterService != nil && serverCfg.FilterEnabled`).
  
  2. **DNS Query Statistics (database-backed)** - `blocked_queries` in `ClientQueryStats` table will still count **client-based blocks** (clients with `IsActive=false`), but NOT filter-based blocks. This is correct because no domains are actually being filtered.
  
  3. **What still works when Filter is OFF:**
     - Client blocking (if client is deactivated)
     - Authoritative zone resolution
     - Cache hits/misses
     - Forwarding queries
     - All query type statistics (A, AAAA, CNAME, etc.)
  
  **Recommendation:** No code change needed. The Live Filter Stats page already shows the "Disabled" status badge when `filterEnabled` is false. Users should expect filter statistics to be zero when filtering is disabled. Consider adding a note/tooltip on the Live Filter Stats page explaining this behavior.

- Add a separate test to leave the server running and execute a stress test (gathering information until the server stops). The debug/statistics data should be saved to a specific test log file. The statistics should be shown in the screen at defined intervals;


- DONE: The Copy to clipboard icon/button is not working. Also make the button change to a gree check mark for a while and then go back to the copy button. (Fixed copyToClipboard function in utils.js to capture button reference before async, updated CopyIcon component to use absolute positioning with both icons overlaid, smooth opacity transition when copying: copy icon fades out → green checkmark fades in → after 1.5s fades back to copy icon)

- DONE: Use the widget from "Rules Browser" on "Live Filter Stats" (Total, Blocked, Allowed... etc) - Created StatWidget component in components/ui.templ with 8 color themes (Blue, Red, Green, Gray, Purple, Yellow, Orange, Cyan). Updated Rules Browser and Live Filter Stats pages to use the new component. StatWidget supports both Alpine.js expressions (ValueExpr) and static text (ValueText) for values.

- DONE: Failed to restart dns: Request failed with status 403

- DONE: On the DNS Query Log show the client name alongside the Client IP

- DONE:Can we save the DNS server that responded to the query ?

- DONE: When a DNS query comes, the existing Records can be checked first (so it doesn't need to be forwaded to the upstream or forward servers). Some kind of overhide. This must be configurable thru System Configuration page (docs\dns-resolution-flow.md) - Implemented LocalRecordsOverride config option: when enabled, checks local DNS records BEFORE forwarding to upstream; if a matching record exists in any authoritative zone, it's returned instead of forwarding. Added toggle in System Configuration → Upstream tab.

- DONE: After confirming the delete on the Delete modal, the table that reflects the data is not being updated without refresh. It may be happening in more than one page. (Fixed all JS files to use htmx.ajax() instead of window.location.reload() or window.location.href for SPA-friendly navigation - zones.js, records.js, clients.js, forwarding-rules.js, utils.js)

- DONE: The Archived Client implementation is kinda messy... I accept suggestions on how to keep records of deleted clients. Maybe an historical table with IP and mac address isolated from the real one. (Implemented ClientHistory table that archives deleted clients with all their info - accessible via "View History" button on Clients page)

- DONE: Add device type to the Client so I can choose what they are (TV, Air Conditioner, etc) (Added DeviceType dropdown in client form with 18 device types: Desktop, Laptop, Mobile, Tablet, Server, Router, Printer, TV, Media, Gaming, IoT, Camera, HVAC, Appliance, SBC, NAS, VoIP, Other)

- DONE: Add the hostname lock option to the clients so DHCP-DNS do not update the hostname (Added HostnameLocked checkbox in client form that prevents DHCP/discovery from auto-updating the hostname)

- DONE: When I click Update Client when editing a client the data is not updated. (Fixed UpdateClient handler to return JSON response instead of redirect, fixed checkbox handling, and updated JS to close modal and refresh table on success)

- DONE: Add the db path to the Dashboard page, Database widget (Added "Path:" row to Database widget showing the database file path)

- DONE: Widgets already use a common generic `Widget` component (`components/widget.templ`). The Widget component provides: variant (default/subtle/inset/dark/transparent), rounded corners, padding, border, and shadow options. Currently used by: Card, CardSubtle, CardInset, Modal, FilterCard, and 8 UI components (StatCard, PanelCard, InfoCard, etc.). Components not using Widget (intentionally): Badge (inline element with color variants), Alert (specialized color semantics), EmptyState (centered flex layout), Table/Pagination (structural elements).

- DONE: Fixed log lines not being shown in the Server Logs page. Root cause: non-blocking channel sends in `notifySubscribers()` dropped entries when buffer was full. Fix: increased buffer from 100→500 and added 50ms timeout instead of instant skip.

- DONE: It seems more secure to not have input.css in the /static folder. Moved to web/css/input.css

- DONE: Are all the tables using the generic table implementation ?

- DONE: The Light theme should have some kind of color contrast between the objects and the surrounding background like the Dark theme.

- DONE: Fixed Query Statistics page not showing data. Root cause: `buildQueryHistory` was dividing daily stats by interval count instead of using actual hourly data from `ClientHourlyStats` table. Fix: rewrote the function to query `ClientHourlyStats` for hourly/sub-hourly grouping and `ClientQueryStats` for daily grouping.

- DONE: Are all API endpoints properly secured ?

- DONE: I see many templates have HEAD, BODY, NAVBAR, SIDEBAR ? Shouldn't we enconpass all pages in a structure so we don't need all this repteated code ?

- DONE: When I click Server Usage the data is not automatically loaded. I have to refresh the data for the data to appear.

- DONE: Are all pages using the new Delete modal Templ component ?

- DONE: Is the new PageContent Templ Component used in all pages ?

- DONE: Let's use js files instead of the /script tags. We can reuse js code if possible

- DONE: Implement log-rotation, size limits, etc

- DONE: When a new client is automatically added and the client discovery had not found any information, look for the hostname in the Records by the IP.

- DONE: All search input text should have the magnifying like the "Search users..." on the "User Management" page

- DONE: Add some status icons to the Services page so we can see if the service is Online or not. 

- DONE: Form components extended with XChange support for Input, Textarea, Select, and Checkbox. Added XValue to Checkbox for array bindings. Added AlpineHiddenInput component. Converted all legacy pages (zones, records, users, clients, querystream, logs) to use form components.

## Config parameter test coverage checklist (one todo per parameter)

Server and core

- [ ] http_port
- [ ] dns_host
- [ ] dns_port

NTP

- [ ] ntp_enabled
- [ ] ntp_listen_address
- [ ] ntp_listen_port
- [ ] ntp_protocol
- [ ] ntp_time_sync_enabled
- [ ] ntp_time_sync_server

Localization

- [ ] timezone

HTTP/HTTPS

- [ ] http_enabled
- [ ] https_enabled
- [ ] https_port
- [ ] gin_mode
- [ ] https_cert_path
- [ ] https_key_path
- [ ] http_redirect_to_https
- [ ] hsts_enabled
- [ ] hsts_max_age_seconds

DNS listeners (UDP/TCP)

- [ ] udp_enabled
- [ ] udp_address
- [ ] udp_port
- [ ] tcp_enabled
- [ ] tcp_address
- [ ] tcp_port

DoT

- [ ] dot_enabled
- [ ] dot_address
- [ ] dot_port
- [ ] dot_cert_path
- [ ] dot_key_path

DoH

- [ ] doh_enabled
- [ ] doh_address
- [ ] doh_port
- [ ] doh_path
- [ ] doh_http3_enabled
- [ ] doh_cert_path
- [ ] doh_key_path

DoQ

- [ ] doq_enabled
- [ ] doq_address
- [ ] doq_port
- [ ] doq_cert_path
- [ ] doq_key_path

TLS defaults

- [ ] tls_cert_path
- [ ] tls_key_path
- [ ] tls_use_wildcard
- [ ] tls_use_self_signed

Auto TLS

- [ ] auto_tls_enabled
- [ ] auto_tls_domain
- [ ] auto_tls_email
- [ ] auto_tls_cache_dir
- [ ] auto_tls_staging
- [ ] auto_tls_auto_renew

Database and Redis

- [ ] db_driver
- [ ] db_dsn
- [ ] redis_addr

Cache

- [ ] cache_backend
- [ ] cache_enabled
- [ ] cache_forwarded_requests
- [ ] cache_ttl
- [ ] cache_max_size
- [ ] cache_memory_max_mb
- [ ] cache_eviction_policy
- [ ] cache_local_lru_enabled
- [ ] cache_local_lru_max_entries
- [ ] cache_local_lru_ttl
- [ ] cache_redis_dial_timeout_ms
- [ ] cache_redis_read_timeout_ms
- [ ] cache_redis_write_timeout_ms

Logging levels and debug flags

- [ ] log_level
- [ ] debug_dns
- [ ] debug_resolver
- [ ] debug_discovery
- [ ] debug_cache
- [ ] debug_http
- [ ] debug_ntp
- [ ] debug_dhcp
- [ ] debug_dhcp_dns
- [ ] debug_auth
- [ ] debug_latency
- [ ] debug_db

Profiling and monitoring

- [ ] enable_pprof
- [ ] latency_measurement_interval
- [ ] prometheus_enabled
- [ ] prometheus_port
- [ ] prometheus_path
- [ ] prometheus_auth_token
- [ ] prometheus_allowed_networks
- [ ] prometheus_use_forwarded_for

Log paths

- [ ] application_log_path
- [ ] http_access_log
- [ ] http_error_log
- [ ] dns_log_path
- [ ] dns_query_log_path
- [ ] dns_query_failed_log_path
- [ ] dhcp_log_path
- [ ] dhcp_dns_log_path
- [ ] ntp_log_path
- [ ] ntp_query_log_path
- [ ] cleanup_log_path
- [ ] db_log_path

Log rotation

- [ ] log_max_size_mb
- [ ] log_max_backups
- [ ] log_max_age_days
- [ ] log_compress_method
- [ ] log_compress

Upstream DNS

- [ ] upstream_servers
- [ ] upstream_strategy
- [ ] upstream_timeout
- [ ] edns0_udp_size
- [ ] local_records_override

Stats

- [ ] stats_retention_days
- [ ] stats_async_enabled
- [ ] stats_async_buffer_size

DHCP server

- [ ] dhcp_enabled

DHCP integration

- [ ] dhcp_int_enabled
- [ ] dhcp_int_domain
- [ ] dhcp_int_listen_address
- [ ] dhcp_int_key_name
- [ ] dhcp_int_key_secret
- [ ] dhcp_int_key_algorithm
- [ ] dhcp_int_default_ttl
- [ ] dhcp_int_reverse_zone
- [ ] dhcp_int_auto_create_zone
- [ ] dhcp_int_create_ptr
- [ ] dhcp_int_update_client_name
- [ ] dhcp_int_allowed_networks
- [ ] dhcp_int_cleanup_stale
- [ ] dhcp_int_cleanup_after_hours

Client discovery

- [ ] discovery_enabled
- [ ] discovery_methods
- [ ] discovery_stop_on_first
- [ ] discovery_timeout

OUI database

- [ ] oui_enabled
- [ ] oui_auto_update
- [ ] oui_update_url
- [ ] oui_database_path

Certificates

- [ ] certificate_import_on_startup

WebAuthn and 2FA

- [ ] webauthn_rp_id
- [ ] webauthn_rp_display_name
- [ ] webauthn_rp_origins
- [ ] twofa_issuer

SMTP

- [ ] smtp_host
- [ ] smtp_port
- [ ] smtp_username
- [ ] smtp_password
- [ ] smtp_from
- [ ] smtp_from_name
- [ ] smtp_use_tls
- [ ] smtp_skip_verify

Filtering and safe search

- [ ] filter_enabled
- [ ] filter_load_mode
- [ ] filter_cache_method
- [ ] filter_debug
- [ ] filter_log_path
- [ ] filter_update_interval_hours
- [ ] safe_search_enabled
- [ ] safe_search_google
- [ ] safe_search_youtube
- [ ] safe_search_bing
- [ ] safe_search_duckduckgo
- [ ] safe_search_ecosia
- [ ] safe_search_yandex
- [ ] safe_search_pixabay
- [ ] blocked_services

Worker pools

- [ ] client_tracking_workers
- [ ] client_tracking_queue_size
- [ ] client_discovery_workers
- [ ] client_discovery_queue_size

## Legacy config removal evaluation

- [ ] http_log_path (alias for application_log_path) — decide deprecation window and migration guidance
- [ ] log_compress (deprecated boolean) — confirm final removal plan in favor of log_compress_method
- [ ] session_secret (legacy config files) — determine removal or mapping to current auth/session config
- [ ] enable_https (legacy config files) — map or remove in favor of https_enabled
- [ ] cert_file (legacy config files) — map or remove in favor of tls_cert_path/https_cert_path
- [ ] key_file (legacy config files) — map or remove in favor of tls_key_path/https_key_path
- [ ] discovery_interval_minutes (legacy config files) — map or remove in favor of discovery_timeout or update interval
- [ ] database_driver (legacy config files) — map or remove in favor of db_driver
- [ ] database_dsn (legacy config files) — map or remove in favor of db_dsn
- [ ] redis_enabled (legacy config files) — map or remove in favor of cache_backend/cache_enabled

