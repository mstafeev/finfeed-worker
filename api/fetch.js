// /api/fetch.js — secure fetch relay (Vercel)
// Требует env: FETCH_SECRET

const ALLOW_DOMAINS = ["cnbc.com", "stooq.com", "stooq.pl"]; // любые поддомены

function hostAllowed(host) {
  const h = String(host || "").toLowerCase();
  return ALLOW_DOMAINS.some(d => h === d || h.endsWith("." + d));
}

export default async function handler(req, res) {
  try {
    // 0) секрет
    const secret = req.headers["x-proxy-secret"] || req.query.secret;
    if (!process.env.FETCH_SECRET || secret !== process.env.FETCH_SECRET) {
      return res.status(401).send("unauthorized");
    }

    // 0.1) диагностика деплоя
    if (req.query.info === "1") {
      return res.status(200).json({
        ok: true,
        allow: ALLOW_DOMAINS,
        commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
        now: new Date().toISOString()
      });
    }

    // 1) обязательный url
    const url = req.query.url;
    if (!url) return res.status(400).send("missing url");

    let u;
    try { u = new URL(url); } catch { return res.status(400).send("bad url"); }
    if (!(u.protocol === "http:" || u.protocol === "https:")) {
      return res.status(400).send("bad protocol");
    }
    if (!hostAllowed(u.hostname)) {
      return res.status(403).send("host not allowed");
    }

    // 2) проксируем
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 10000);
    let r;
    try {
      r = await fetch(u.toString(), {
        headers: {
          "user-agent": "FinFeed/relay (+https://rufinfeed.ru)",
          "accept": "application/rss+xml, application/xml, text/xml, text/plain"
        },
        redirect: "follow",
        signal: ac.signal
      });
    } catch {
      clearTimeout(to);
      return res.status(502).send("fetch error");
    }
    clearTimeout(to);

    const body = await r.text();
    res.status(r.ok ? 200 : r.status);
    res.setHeader("content-type", r.headers.get("content-type") || "text/plain");
    res.setHeader("cache-control", "no-store");
    return res.send(body);
  } catch {
    return res.status(502).send("fetch error");
  }
}
