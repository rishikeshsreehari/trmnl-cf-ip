# trmnl-cf-ip

Cloudflare Worker + helper script to maintain a dynamic IP allowlist
(TRMNL IPs + trusted machines) for edge-protected Workers.

- `worker.js` → IP allowlist publisher
- `update-ip.sh` → reports local IP to Cloudflare running on a rpi

Secrets are configured via Cloudflare env vars.
