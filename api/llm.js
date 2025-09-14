
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  try {
    const { system = '', prompt = '', model = 'gpt-4o-mini', temperature = 0.3 } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'No prompt' });

    const messages = system
      ? [{ role: 'system', content: system }, { role: 'user', content: prompt }]
      : [{ role: 'user', content: prompt }];

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {'content-type':'application/json', authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
      body: JSON.stringify({ model, messages, temperature }),
    });

    if (!r.ok) return res.status(r.status).json({ error:'upstream_error', detail: await r.text().catch(()=> '') });
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    res.setHeader('cache-control','no-store');
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error:'proxy_failed', detail:String(e) });
  }
}
