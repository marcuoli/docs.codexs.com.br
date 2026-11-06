---
title: "NTP Integration"
description: "Configure and check the built-in NTP server."
weight: 10
---

# Built-in NTP server

CodexDNS includes a UDP NTP server provided by go-ntpserver. It answers clients using the host's clock. Keep the operating system synchronized with a trusted time service; serving NTP does not synchronize the host with an upstream time source.

## Enable the server

The server is disabled by default. Configure these settings in the NTP configuration page or configuration file:

```json
{
  "ntp_enabled": true,
  "ntp_listen_address": "0.0.0.0",
  "ntp_listen_port": 123,
  "ntp_protocol": "ipv4"
}
```

This example listens on all IPv4 interfaces. Choose a specific local address to restrict the interface, allow UDP traffic from the intended clients, and ensure another NTP service is not already using the port. Binding UDP port 123 requires suitable operating-system permissions; configure the service account or container accordingly.

## Check replies and activity

Use an NTP client against the configured server. For the standard UDP port, a query-only check with ntpdate is:

```sh
ntpdate -q SERVER_ADDRESS
```

Check the NTP dashboard and [query logs](../query-logging/) for activity. Counters update asynchronously, so receiving a reply and seeing its counter change are separate events. From version 0.5.20261106.1, the service subscribes to request events before opening UDP, allowing startup events to wait in the subscription buffer while the background consumer starts. Database-backed recent queries and hourly statistics use separate background writes.

A reply confirms reachability and protocol handling. Check the host time service separately when diagnosing clock accuracy.
