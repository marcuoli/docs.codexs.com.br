/**
 * Cloudflare Worker: CodexDNS Update Check Telemetry
 *
 * Deploy this Worker with the route: docs.codexs.com.br/*
 *
 * It intercepts GET /codexdns/version.json?v=...&os=...&arch=...&iid=... requests,
 * writes a telemetry event to Analytics Engine, then transparently proxies to GitHub Pages.
 * Note: the instance-ID parameter is named "iid" (not "id") to avoid Cloudflare's
 * automatic PII redaction of query parameters named "id".
 *
 * Setup:
 *   1. Create an Analytics Engine dataset named "codexdns_update_checks" in the
 *      Cloudflare dashboard (Workers > Analytics Engine).
 *   2. Bind it in the Worker settings: Variable name = ANALYTICS
 *   3. Add the Worker route: docs.codexs.com.br/*  -> this Worker
 *
 * Query usage in the Cloudflare dashboard or via the API:
 *
 *   SELECT blob1 AS version, blob2 AS os, blob3 AS arch,
 *          COUNT(DISTINCT blob4) AS unique_instances,
 *          COUNT(*) AS total_checks
 *   FROM codexdns_update_checks
 *   WHERE timestamp > NOW() - INTERVAL '30' DAY
 *   GROUP BY version, os, arch
 *   ORDER BY unique_instances DESC
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only instrument the version check endpoint
    if (url.pathname === '/codexdns/version.json' && request.method === 'GET') {
      const v    = url.searchParams.get('v')    ?? 'unknown';
      const os   = url.searchParams.get('os')   ?? 'unknown';
      const arch = url.searchParams.get('arch') ?? 'unknown';
      const id   = url.searchParams.get('iid')  ?? 'unknown';

      // Write telemetry event (non-blocking – no await)
      if (env.ANALYTICS) {
        env.ANALYTICS.writeDataPoint({
          blobs:   [v, os, arch, id],
          indexes: [id],
        });
      }
    }

    // Transparently proxy all requests to GitHub Pages (origin)
    return fetch(request);
  },
};
