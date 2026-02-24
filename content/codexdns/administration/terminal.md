---
title: "Terminal"
description: "Interactive browser-based shell access to the CodexDNS server."
weight: 20
---

# Terminal

The **Terminal** page (`/admin/terminal`) provides an interactive shell directly in the browser, powered by [xterm.js](https://xtermjs.org/) over a WebSocket connection.

## Accessing the Terminal

Navigate to **Administration → Terminal**, or go directly to:

```
https://your-server.com/admin/terminal
```

Authentication with administration privileges is required.

## Interface

The terminal occupies all available viewport height and adjusts automatically on window resize or layout changes (sidebar expand/collapse). It uses the One Dark color theme.

### Status Bar

| Element | Description |
|---|---|
| **Pulsing indicator** | Green = connected, red/grey = disconnected |
| **Shell info** | Displays the current shell path when connected |
| **Reconnect** | Re-establishes the WebSocket session (disabled when already connected) |
| **Clear** | Clears the current terminal output |
| **Disconnect** | Closes the WebSocket session |

## Usage

Type shell commands as you would in a local terminal. The session runs as the user that started the CodexDNS process.

```bash
# Check service status
systemctl status codexdns

# View logs
tail -f /var/log/codexdns/dns.log

# Close the shell session
exit
```

## Connection Details

- **Transport**: WebSocket (`ws://` or `wss://` depending on your TLS configuration)
- **Endpoint**: `/api/terminal/ws`
- **Keepalive**: A ping is sent every 30 seconds to keep the session alive
- **Resize**: Terminal dimensions are automatically sent to the server on every viewport change so the PTY is always the correct size

## Security Notes

- The terminal is protected by the same session authentication as the rest of the UI
- Only users with sufficient permissions can access the terminal page
- All terminal activity runs under the CodexDNS process user — do not grant terminal access to untrusted accounts
