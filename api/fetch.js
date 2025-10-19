// /api/fetch.js — secure fetch relay (RSS/CSV/HTML/JSON)
// Принимает секрет из заголовка: x-proxy-secret: <token>
// или Authorization: Bearer <token>, или ?secret=<token>
// Секрет берётся из process.env.FETCH_SECRET ИЛИ VERCEL_FETCH_SECRET.

const ALLOW = new Set([
  // твои источники
  'www.federalreserve.gov',
  'www.ecb.europa.eu',
  'finance.yahoo.com',
  'www.reuters.com',
  'www.cnbc.com',
  'feeds.content.dowjones.io',
  'www.coindesk.com',
  'www.bls.gov',
  'www.bea.gov',
  'home.treasury.gov',

  // 🔥 добавляем stooq для цен
  'stooq.com',
  'stooq.pl',
]);

function getToken(req) {
  const q = req.query || {};
  const h = req.headers || {};
  const bearer = (h.authorization || '').trim(); // "Bearer xxx"
  if (h['x-proxy-secret']) return String(h['x-proxy-secret']).trim();
  if (q.secret) return String(q.secret).trim();
  if (bearer.toLowerCase().startsWith('bearer ')) return bearer.slice(7).trim();
  return '';
}

export default async function handler(req, res) {
  try {
    const token = getToken(req);
    const SECRET = (process.env.FETCH_SECRET || process.env.VERCEL_FETCH_SECRET || '').trim();
    if (!SECRET || token !== SECRET) {
      return res.status(401).send('unauthorized');
    }

    const url = (req.query && req.query.url) ? String(req.query.url) : '';
    if (!url) return res.status(400).send('missing url');

    let u;
    try { u = new URL(url); } catch { return res.status(400).send('bad url'); }
    if (!(u.protocol === 'https:' || u.protocol === 'http:')) {
      return res.status(400).send('bad protocol');
    }
    if (!ALLOW.has(u.hostname)) {
      return res.status(403).send('host not allowed');
    }

    // 8–12s таймаут — stooq иногда тупит
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 12000);

    // Важно: разрешаем CSV (stooq), XML (RSS), JSON и HTML
    const UA = 'Mozilla/5.0 (FinFeed Fetch Relay)';
    const r = await fetch(u.toString(), {
      method: 'GET',
      headers: {
        'user-agent': UA,
        'accept':
          'text/csv, application/rss+xml, application/xml, text/xml, application/json, text/html, */*;q=0.1',
      },
      redirect: 'follow',
      signal: ac.signal,
    }).catch((e) => {
      clearTimeout(to);
      throw e;
    });
    clearTimeout(to);

    // Пробрасываем статус/типы
    const ct = r.headers.get('content-type') || 'text/plain; charset=utf-8';
    res.status(r.status);
    res.setHeader('content-type', ct);
    res.setHeader('cache-control', 'no-store');

    const buf = await r.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (e) {
    res.status(502).send('fetch error');
  }
}
