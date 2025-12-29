// /api/openai-image.js — OpenAI Images relay (Vercel)
// Требует env на Vercel: OPENAI_API_KEY
// Защита: FETCH_SECRET (или VERCEL_FETCH_SECRET) + header "x-proxy-secret"

export default async function handler(req, res) {
  try {
    // --- secret guard (как у тебя в /api/fetch.js) ---
    const secret = req.headers["x-proxy-secret"] || req.query.secret;
    const secretEnv = process.env.FETCH_SECRET || process.env.VERCEL_FETCH_SECRET || "";
    if (secretEnv && secret !== secretEnv) {
      return res.status(401).send("unauthorized");
    }

    // --- method ---
    if (req.method !== "POST") {
      res.setHeader("allow", "POST");
      return res.status(405).json({ ok: 0, error: "method not allowed" });
    }

    // --- parse body ---
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const prompt = String(body.prompt || "").trim();
    if (!prompt) return res.status(400).json({ ok: 0, error: "missing prompt" });

    const model = String(body.model || process.env.OPENAI_IMAGE_MODEL || "gpt-image-1").trim();
    const size  = String(body.size  || process.env.OPENAI_IMAGE_SIZE  || "1792x1024").trim();

    const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(500).json({ ok: 0, error: "OPENAI_API_KEY is missing on Vercel" });
    }

    const payload = {
      model,
      prompt,
      size,
      response_format: "b64_json",
    };

    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const txt = await r.text().catch(() => "");
    if (!r.ok) {
      // важно: отдаём текст ошибки, чтобы ты видел причину (400/401/429 и т.д.)
      return res.status(r.status).json({
        ok: 0,
        error: `openai_error_${r.status}`,
        detail: txt.slice(0, 2000),
      });
    }

    let j = null;
    try { j = JSON.parse(txt); } catch { j = null; }

    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(500).json({
        ok: 0,
        error: "no_b64_json",
        detail: (j ? JSON.stringify(j).slice(0, 2000) : txt.slice(0, 2000)),
      });
    }

    return res.status(200).json({ ok: 1, b64_json: b64 });
  } catch (e) {
    return res.status(500).json({ ok: 0, error: "server_error", detail: String(e) });
  }
}
