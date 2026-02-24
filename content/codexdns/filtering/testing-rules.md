---
title: "Testing Filter Rules"
description: "How to test and validate your filter rules."
weight: 40
---

# Testing Filter Rules

## Overview

After adding blocklists, allowlists, or quick rules, it's a good idea to verify that they are working as expected. This page explains how to check if rules are taking effect and how to use the Quick Block/Allow feature from the Live Queries page.

---

## Quick Block and Allow

The fastest way to add a rule is directly from the **Live Queries** page. Each query row has four action buttons:

| Button | Action |
|--------|--------|
| **Block Domain** | Adds the domain to the Quick Block list — all queries for it are blocked immediately |
| **Allow Domain** | Adds the domain to the Quick Allow list — overrides any blocklist for this domain |
| **Block Client** | All DNS queries from that client's IP are blocked regardless of domain |
| **Allow Client** | Exempts that client's IP from client-level blocking |

Quick rules take effect immediately and appear in **Filtering → Quick Rules**.

### How to use

1. Navigate to **Filtering → Live Queries**
2. Generate or wait for DNS traffic to appear
3. Click the desired action button for a query row
4. A confirmation dialog appears — review and confirm
5. A success notification confirms the rule was added
6. Verify the rule appears under **Filtering → Quick Rules**

---

## Verifying Rules with DNS Queries

Once a rule is in place, test it using standard DNS tools:

```bash
# Test from the machine running CodexDNS (or any configured client)
nslookup example.com 127.0.0.1

# With dig
dig @127.0.0.1 example.com
```

**Blocked domain**: Returns `NXDOMAIN` or the configured block response.

**Allowed domain**: Resolves normally even if it's on a blocklist.

**Check the Live Queries page** after running the query — the **Result** column shows whether the query was `Allowed`, `Blocked`, `Cached`, or `Forwarded`.

---

## Managing Quick Rules

Navigate to **Filtering → Quick Rules** to view and delete any quick rules you've added.

The page has four tabs:

- **Blocked Domains** — domains added via Quick Block
- **Allowed Domains** — domains added via Quick Allow
- **Blocked Clients** — client IPs added via Block Client
- **Allowed Clients** — client IPs added via Allow Client

To delete a rule, click the trash icon next to it and confirm. The rule is removed immediately.

---

## How Evaluation Order Works

CodexDNS evaluates filter rules in this order for each query:

1. **Deny All** — if the client's group is set to Deny All mode, the query is blocked
2. **Allow Clients** — if the client's IP is on the Quick Allow Clients list, the query proceeds normally
3. **Block Clients** — if the client's IP is on the Quick Block Clients list, the query is blocked
4. **Allow Domains** — if the domain matches an allowlist rule, the query is allowed (overrides blocklists)
5. **Block Domains** — if the domain matches a blocklist rule, the query is blocked
6. **Default** — if no rules match, the query is forwarded and allowed

**Important**: Allowlists take priority over blocklists. You can use Quick Allow to unblock a single domain even while a large blocklist is active.

---

## Testing Two-Pass Evaluation (Allow Overrides Block)

To confirm that allowlists override blocklists:

1. Quick Block a test domain (e.g., `test.example.com`)
2. Verify it is blocked: `nslookup test.example.com 127.0.0.1` → should return a block response
3. Quick Allow the same domain (`test.example.com`)
4. Verify it now resolves: `nslookup test.example.com 127.0.0.1` → should return a normal answer
5. Delete the allow rule from **Quick Rules → Allowed Domains**
6. Verify it is blocked again

---

## Troubleshooting

### Rule doesn't appear to take effect

- Wait a few seconds and retry — rules apply immediately but DNS clients may have cached the result
- Flush your local DNS cache:
  - **Windows**: `ipconfig /flushdns`
  - **Linux**: `sudo systemd-resolve --flush-caches` or `sudo resolvectl flush-caches`
  - **macOS**: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
- Check the **Live Queries** page to see the result column for the query

### Quick Rules page shows no rules

- Confirm the button click succeeded (success notification should appear)
- Try adding a rule again; if the notification shows an error, check the dashboard for server connectivity

### Buttons are not visible on Live Queries

- Ensure you are logged in with an account that has filtering management permissions
- Try a hard refresh (Ctrl+F5) to reload any cached JavaScript
