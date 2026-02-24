---
title: "Jobs"
description: "Monitor and control background scheduled tasks in CodexDNS."
weight: 10
---

# Jobs

The **Jobs** page (`/admin/jobs`) provides a real-time view of all background scheduled tasks running inside CodexDNS. From here you can monitor task health, trigger immediate runs, pause/resume individual jobs, and adjust their execution intervals — all without restarting the server.

## Accessing the Jobs Page

Navigate to **Administration → Jobs** in the sidebar, or go directly to:

```
https://your-server.com/admin/jobs
```

You must be logged in with an account that has administration privileges.

## Page Layout

### Status Bar

At the top of the page a status bar shows:

- **Scheduler running** (green) / **Scheduler stopped** (red) — whether the internal job scheduler is active.
- **Paused** indicator — shown in yellow when the page's auto-refresh is paused.

### Auto-Refresh Toggle

The **Pause/Resume live updates** button (top-right of the page header) pauses or resumes the live SSE stream that keeps job cards updated in real time. Pausing is useful when inspecting a specific job without the data refreshing underneath you.

### Job Cards

Each scheduled job is displayed as a card containing:

| Field | Description |
|---|---|
| **Name** | Unique job identifier |
| **Category** | Functional grouping (e.g. `dns`, `dhcp`, `system`) |
| **Status badge** | Current state: `idle`, `running`, `paused`, or `error` |
| **Description** | Short human-readable description of what the job does |
| **Interval** | How often the job runs (e.g. `30s`, `5m`, `1h`) |
| **Run Count** | Total number of times the job has executed since startup |
| **Last Run** | Relative time since the job last ran |
| **Next Run** | Relative time until the next scheduled run (shows `paused` when the job is paused) |
| **Last Error** | If the most recent run produced an error, the message is shown in red |

## Job Controls

Each job card has three action buttons:

### Run Now

Triggers the job immediately, regardless of its scheduled interval. The button is disabled while the job is already running.

### Pause / Resume

Toggles the job's scheduled execution:

- **Pause** — stops the job from running on its normal schedule. The status badge changes to `paused` and **Next Run** shows `paused`. The job can still be triggered manually with **Run Now**.
- **Resume** — re-enables scheduled execution. The job will run again at the next scheduled interval.

> **Note:** The Pause/Resume button icon changes to reflect the current state — a pause icon (two vertical bars) when the job is active, and a play icon (triangle) when the job is paused.

### Interval

Opens an inline editor to change how frequently the job runs. Accepted formats:

| Input | Meaning |
|---|---|
| `30s` | Every 30 seconds |
| `5m` | Every 5 minutes |
| `1h` | Every hour |
| `1d` | Every day |

Press **Save** to apply or **Cancel** / `Escape` to discard the change.

## Live Updates

Job data is pushed to the page via **Server-Sent Events (SSE)** on the `/api/jobs/sse` endpoint. The page also polls every 5 seconds as a fallback when the SSE connection is not active. This means job state (status, last run, next run, errors) is always up to date without a page reload.

## Common Scenarios

### A job is stuck in `running`

If a job shows `running` for much longer than its normal execution time:

1. Check the **Last Error** field for any error message.
2. You can **Run Now** to force a new execution cycle (this may resolve a stuck state depending on the job's implementation).

### Reducing CPU/network load

Temporarily **Pause** non-critical jobs (e.g. metrics collection or external sync jobs) to reduce load during a high-traffic period, then **Resume** them afterward.

### Diagnosing a misconfigured interval

Use the **Interval** editor to temporarily shorten a job's interval while debugging, then restore the production value once the issue is confirmed.
