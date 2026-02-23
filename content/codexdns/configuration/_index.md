---
title: "Configuration"
description: "Configure CodexDNS using JSON files, environment variables, and the web UI. Includes a full parameter reference and environment variable guide."
weight: 30
---

CodexDNS uses a hybrid configuration system: a JSON file (`config.json`) provides bootstrap settings at startup, while the Web UI and database allow runtime changes without restarts.

This section covers:

- **[Configuration Architecture](architecture)** — how the JSON file, database, and environment variables interact
- **[Runtime Configuration](runtime)** — changing settings live via the Web UI or API
- **[Export & Import](export-import)** — backing up and restoring configuration
- **[Configuration Parameters Reference](parameters)** — every JSON config key with its type, default value, environment variable equivalent, and description
- **[Environment Variables](environment-variables)** — naming convention, precedence rules, sensitive secrets, and running without a config file
