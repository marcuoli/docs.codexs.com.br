---
title: "Client Groups"
description: "Organise clients into groups and control DNS filtering per group — apply rules, bypass filtering, or block everything."
weight: 20
---

# Client Groups

Client Groups let you control DNS filtering differently for different devices on your network. For example, you can apply strict blocking rules to kids' devices, bypass filtering entirely for a home server, or block all DNS for an IoT network.

## The Groups Table

The **Client Groups** page shows all your groups with the following columns:

| Column | What it shows |
|--------|---------------|
| **Name** | The group's name |
| **Description** | Optional note about the group's purpose |
| **Members** | Number of clients assigned to this group — click to manage |
| **Default** | Whether unassigned clients automatically join this group |
| **Filtering** | The filter mode in effect: **Filter**, **Allow All**, or **Deny All** |
| **Created** | When the group was created |

## The "All Clients" System Group

CodexDNS includes one built-in group called **All Clients** that always covers every device on your network. It cannot be edited or deleted. Blocklist and allowlist rules you attach to this group apply to every client unless a more specific group overrides them.

## Filter Modes

Every group has a **Filter Mode** that controls what happens to DNS queries from clients in that group. You set it using the three radio cards in the Create/Edit modal.

### Filter — apply configured rules

This is the default and recommended mode for most groups.

DNS queries from clients in this group go through your configured rules:
- If the domain is on an **allowlist**, it resolves immediately.
- If the domain is on a **blocklist**, it is blocked.
- If neither list matches, the query resolves normally.

Use **Filter** for any group where you want your blocklists and allowlists to take effect — family devices, shared network, office equipment, etc.

### Allow All — bypass filtering entirely

DNS queries from clients in this group always resolve, regardless of any rules you have configured. Blocklists are completely ignored.

Use **Allow All** for devices that need unrestricted DNS access — a home lab server, a router, a monitoring system, or your own workstation where filtering would cause problems.

> **Tip:** This is more permissive than Filter. If you just need one specific domain to resolve for a client, consider adding an allowlist rule to a Filter-mode group instead — it gives you more control.

### Deny All — block everything

DNS queries from clients in this group are always refused, regardless of any rules. Nothing resolves.

Use **Deny All** for:
- **IoT devices** that have no reason to make DNS queries
- **Guest VLANs** that should not access the internet
- **Parental controls** where the default should be "nothing works unless explicitly allowed"
- **Quarantined machines** that need to be cut off from the network

> Queries blocked by **Deny All** count toward the group's **Blocked** statistics, so you can see activity even when everything is refused.

**Deny All takes priority.** If a client belongs to multiple groups and any one of them is set to Deny All, all DNS queries from that client are blocked.

## Creating and Editing Groups

Click **New Group** to create a group, or the pencil icon on any existing group to edit it.

| Field | Description |
|-------|-------------|
| **Name** | A unique label (required) |
| **Description** | Optional note for your reference |
| **Default group** | If checked, clients not assigned to any other group automatically belong to this one |
| **Filter Mode** | Select Filter, Allow All, or Deny All using the radio cards |

## Managing Group Members

Click the **Members badge** (e.g. *3 members*) on any non-system group to open the Members panel.

**Adding a member:**
1. Start typing in the search box to find a registered client by name, IP address, or MAC address.
2. Select the client from the dropdown — its IP and MAC fill in automatically.
3. Alternatively, enter an IP address, MAC address, or CIDR range manually (useful for ranges like `192.168.10.0/24`).
4. Click **Add Member**.

**Removing a member:** Click the trash icon next to any member in the list.

A client can belong to more than one group. When that happens, **Deny All wins** over Allow All, which wins over Filter.

## Default Group

Exactly one group can be marked as the **Default group**. Any client that is not explicitly assigned to a group is automatically treated as a member of the Default group. If no default group is set, unassigned clients are only covered by the built-in All Clients group.

## Blocked Statistics and Deny All

Queries blocked by **Deny All** are included in the Blocked query count for that group. You will see them in the dashboard blocked totals and in the Query Log with the reason shown as the group name.
