// /api/fetch.js — secure fetch relay (Vercel)
// Requires env: FETCH_SECRET

const ALLOW_DOMAINS = ["cnbc.com", "stooq.com", "stooq.pl"]; // разрешаем любые поддомены

function hostAllowed(host) {
  const h = String(host || "").toLowerCase();
  return ALLOW_DOMAINS.some(d => h === d || h.endsWith("." + d));
}

export default async function handler(req, res) {
  try {
    // 0) Секрет
    const secret = req.headers["x-proxy-secret"] || req.query.secret;
    if (!process.env.FETCH_SECRET || secret !== process.env.FETCH_SECRET) {
      return res.status(401).send("unauthorized");
    }

    // 0.1) Диагностика деплоя
    if (req.query.info === "1") {
      return res.status(200).json({
        ok: true,
        allow: ALLOW_DOMAINS,
        commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
        now: new Date().toISOString()
      });
    }

    // 1) Валидация URL
    const url = req.query.url;
    if (!url) return res.status(400).send("missing url");

    let u;
    try { u = new URL(url); } catch { return res.status(400).send("bad url"); }
    if (!(u.protocol === "https:" || u.protocol === "http:")) {
      return res.status(400).send("bad protocol");
    }
    if (!hostAllowed(u.hostname)) {
      return res.status(403).send("host not allowed");
    }

    // 2) Проксируем запрос
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 10000);

    const resp = await fetch(u.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (FinFeed Relay)",
        "accept": "application/rss+xml, application/xml, text/xml, text/plain, */*"
      },
      redirect: "follow",
      signal: ac.signal
    });
    clearTimeout(to);

    const text = await resp.text();
    res.status(resp.status);
    res.setHeader("content-type", resp.headers.get("content-type") || "text/plain; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    return res.send(text);
  } catch (e) {
    return res.status(502).send("fetch error");
  }
}
