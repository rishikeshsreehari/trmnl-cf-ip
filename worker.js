const DEFAULT_TRMNL_URL = "https://trmnl.com/api/ips";

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    // 1. UPDATE ROUTE (For your DietPi/Home)
    if (url.pathname === "/update") {
      const name = (url.searchParams.get("IP_name") || "").trim();
      const password = url.searchParams.get("password") || "";
      if (password !== env.UPDATE_PASSWORD) return new Response("Unauthorized", { status: 401 });

      const ip = req.headers.get("CF-Connecting-IP");
      await env.IP_STORE.put(`named:${name}`, ip, { expirationTtl: 604800 }); // 7 days
      return new Response(`OK: ${name}=${ip}`);
    }

    // 2. IPS ROUTE (For your Filter Worker)
    if (url.pathname === "/ips" || url.pathname === "/") {
      try {
        const list = await env.IP_STORE.list({ prefix: "named:" });
        const named = {};
        for (const key of list.keys) {
          named[key.name.replace("named:", "")] = await env.IP_STORE.get(key.name);
        }

        let trmnlRaw = await env.IP_STORE.get("trmnl:ips");
        
        // If TRMNL list is missing (like right now), fetch it immediately
        if (!trmnlRaw) {
          await refreshTrmnlIPs(env);
          trmnlRaw = await env.IP_STORE.get("trmnl:ips");
        }

        const trmnl = trmnlRaw ? JSON.parse(trmnlRaw) : { ipv4: [], ipv6: [] };

        return new Response(JSON.stringify({
          ipv4: trmnl.ipv4 || [],
          ipv6: trmnl.ipv6 || [],
          named
        }, null, 2), { headers: { "content-type": "application/json" } });
        
      } catch (err) {
        return new Response(`KV Error: ${err.message}`, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },

  // Runs once an hour automatically
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshTrmnlIPs(env));
  }
};

// THE MISSING PIECE: This actually talks to TRMNL
async function refreshTrmnlIPs(env) {
  try {
    const r = await fetch(env.TRMNL_URL || DEFAULT_TRMNL_URL);
    if (!r.ok) return;
    const data = await r.json();
    await env.IP_STORE.put("trmnl:ips", JSON.stringify({
      ipv4: data?.data?.ipv4 || [],
      ipv6: data?.data?.ipv6 || [],
      fetched_at: new Date().toISOString()
    }), { expirationTtl: 7200 }); // Cache for 2 hours
  } catch (e) {
    console.error("TRMNL Refresh Failed", e);
  }
}