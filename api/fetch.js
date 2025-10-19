// Vercel Serverless Function: secure fetch relay for RSS/XML
// File path in your Vercel project: /api/fetch.js
// Env: set FETCH_SECRET in Vercel Project Settings → Environment Variables

const ALLOW = new Set([
  'www.cnbc.com',
  'stooq.com',
  'stooq.pl'
]);

export default async function handler(req, res) {
  try {
    const secret = req.headers['x-proxy-secret'] || req.query.secret;
    if (!process.env.FETCH_SECRET || secret !== process.env.FETCH_SECRET) {
      return res.status(401).send('unauthorized');
    }
    const url = req.query.url;
    if (!url) return res.status(400).send('missing url');

    let u;
    try { u = new URL(url); } catch { return res.status(400).send('bad url'); }
    if (!(u.protocol === 'https:' || u.protocol === 'http:')) {
      return res.status(400).send('bad protocol');
    }
    if (!ALLOW.has(u.hostname)) {
      return res.status(403).send('host not allowed');
    }

    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 15000);
    const UA = 'Mozilla/5.0 (FinFeed2 Fetch Relay)';

    const r = await fetch(u.toString(), {
    headers: {
      'user-agent': 'Mozilla/5.0 (FinFeed2 Fetch Relay)',
      'accept': 'text/csv, application/rss+xml, application/xml, text/xml, text/plain',
      'accept-encoding': 'identity'
    },
    redirect: 'follow',
    signal: ac.signal
    });
    clearTimeout(to);

    const txt = await r.text();
    res.status(r.ok ? 200 : r.status);
    res.setHeader('content-type', r.headers.get('content-type') || 'application/xml; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-deploy', process.env.VERCEL_GIT_COMMIT_SHA || 'local');
    res.setHeader('x-allow-hosts', JSON.stringify([...ALLOW]));
    res.send(txt);
  } catch (e) {
    res.status(502).send('fetch error');
  }
}
