// trmnl-cf-ip — Cloudflare Worker for TRMNL IP allowlist
// Bindings required:
// - KV namespace: IP_STORE
// - Env var: UPDATE_PASSWORD
// - Optional env var: TRMNL_URL

const DEFAULT_TRMNL_URL = "https://trmnl.com/api/ips";
const TRMNL_CACHE_TTL = 2 * 60 * 60; // 2 hours
const NAMED_IP_TTL = 7 * 24 * 60 * 60; // 7 days

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    // /update?IP_name=home&password=xxxx
    if (url.pathname === "/update") {
      const name = (url.searchParams.get("IP_name") || "").trim();
      const password = url.searchParams.get("password") || "";

      if (!name) return text(400, "Missing IP_name");
      if (password !== env.UPDATE_PASSWORD) return text(401, "Unauthorized");

      const ip = req.headers.get("CF-Connecting-IP");
      if (!ip) return text(400, "Missing CF-Connecting-IP");

      await env.IP_STORE.put(`named:${name}`, ip, {
        expirationTtl: NAMED_IP_TTL,
      });

      return text(200, `OK ${name}=${ip}`);
    }

    // /ips
    if (url.pathname === "/ips") {
      const trmnl = await getTrmnlIPs(env);
      const named = await getNamedIPs(env);

      const ipv4 = new Set(trmnl.ipv4 || []);
      const ipv6 = new Set(trmnl.ipv6 || []);

      for (const ip of Object.values(named)) {
        ip.includes(":") ? ipv6.add(ip) : ipv4.add(ip);
      }

      return json(200, {
        ipv4: [...ipv4],
        ipv6: [...ipv6],
        named,
      });
    }

    return text(404, "Not found");
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshTrmnlIPs(env));
  },
};

async function refreshTrmnlIPs(env) {
  const url = env.TRMNL_URL || DEFAULT_TRMNL_URL;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return;

  const data = await res.json();
  const payload = {
    ipv4: data?.data?.ipv4 || [],
    ipv6: data?.data?.ipv6 || [],
    fetched_at: new Date().toISOString(),
  };

  await env.IP_STORE.put("trmnl:ips", JSON.stringify(payload), {
    expirationTtl: TRMNL_CACHE_TTL,
  });
}

async function getTrmnlIPs(env) {
  const raw = await env.IP_STORE.get("trmnl:ips");
  if (raw) return JSON.parse(raw);

  await refreshTrmnlIPs(env);
  const again = await env.IP_STORE.get("trmnl:ips");
  return again ? JSON.parse(again) : { ipv4: [], ipv6: [] };
}

async function getNamedIPs(env) {
  const list = await env.IP_STORE.list({ prefix: "named:" });
  const out = {};

  for (const key of list.keys) {
    const name = key.name.slice("named:".length);
    out[name] = await env.IP_STORE.get(key.name);
  }

  return out;
}

function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function text(status, msg) {
  return new Response(msg + "\n", {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
