// api/openai-image.js (Vercel)
// Требует env: FETCH_SECRET, OPENAI_API_KEY

export default async function handler(req, res) {
  try {
    const secret = req.headers["x-proxy-secret"] || req.query.secret;
    if (!process.env.FETCH_SECRET || secret !== process.env.FETCH_SECRET) {
      return res.status(401).send("unauthorized");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: 0, error: "method_not_allowed" });
    }

    const body = (typeof req.body === "string") ? JSON.parse(req.body || "{}") : (req.body || {});
    const prompt = String(body.prompt || "").trim();
    const model = String(body.model || "gpt-image-1").trim();
    const size = String(body.size || "1792x1024").trim();

    if (!prompt) return res.status(400).json({ ok: 0, error: "missing_prompt" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ ok: 0, error: "missing_openai_key" });

    // ВАЖНО: НЕ передаём response_format — для gpt-image-1 это вызывает 400
    const upstreamResp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({ model, prompt, size })
    });

    const txt = await upstreamResp.text().catch(() => "");
    let j = null;
    try { j = JSON.parse(txt); } catch { j = null; }

    if (!upstreamResp.ok) {
      return res.status(400).json({
        ok: 0,
        error: "openai_error_" + upstreamResp.status,
        detail: txt
      });
    }

    const b64 =
      j?.data?.[0]?.b64_json ||
      j?.b64_json ||
      null;

    if (!b64) {
      return res.status(500).json({
        ok: 0,
        error: "no_b64_json",
        detail: txt.slice(0, 2000)
      });
    }

    return res.status(200).json({ ok: 1, b64_json: b64 });
  } catch (e) {
    return res.status(500).json({ ok: 0, error: "server_error", detail: String(e) });
  }
}
