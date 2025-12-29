// /api/openai-image.js — OpenAI Images relay (Vercel)
// Требует env: OPENAI_API_KEY, FETCH_SECRET (тот же секрет, что в fetch.js)

export default async function handler(req, res) {
  try {
    // 0) метод
    if (req.method !== "POST") {
      res.status(405).send("method not allowed");
      return;
    }

    // 1) секрет (как в fetch.js)
    const secret = req.headers["x-proxy-secret"] || req.query.secret;
    if (process.env.FETCH_SECRET && secret !== process.env.FETCH_SECRET) {
      res.status(401).send("unauthorized");
      return;
    }

    // 2) ключ OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ ok: 0, error: "OPENAI_API_KEY is missing" });
      return;
    }

    // 3) body (Vercel обычно уже парсит JSON, но подстрахуемся)
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const prompt = String(body.prompt || "").trim();
    const model  = String(body.model || "gpt-image-1").trim();
    const size   = String(body.size || "1536x1024").trim();

    if (!prompt) {
      res.status(400).json({ ok: 0, error: "missing prompt" });
      return;
    }

    // 4) запрос к OpenAI Images
    const payload = {
      model,
      prompt,
      size,
      // важно: пусть вернёт base64, чтобы твой сервер мог сохранить PNG локально
      response_format: "b64_json",
    };

    // пропускаем доп. поля, если ты их шлёшь
    for (const k of ["quality", "style", "background", "n"]) {
      if (body[k] != null) payload[k] = body[k];
    }

    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const txt = await r.text();
    let j = null;
    try { j = JSON.parse(txt); } catch {}

    if (!r.ok) {
      res.status(r.status).json({
        ok: 0,
        error: j?.error?.message || txt || `HTTP ${r.status}`,
      });
      return;
    }

    const item = (j && j.data && j.data[0]) ? j.data[0] : null;
    const b64 = item && (item.b64_json || item.b64);

    if (!b64) {
      res.status(500).json({ ok: 0, error: "No b64_json returned from OpenAI" });
      return;
    }

    res.status(200).json({ ok: 1, b64_json: b64 });
  } catch (e) {
    res.status(500).json({ ok: 0, error: String(e) });
  }
}
