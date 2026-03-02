export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { companyName, careersUrl, category } = req.body;

  if (!companyName || !careersUrl) {
    return res.status(400).json({ error: 'Missing companyName or careersUrl' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const prompt = `You are helping a product leader research job openings at AgeTech companies.

Company: "${companyName}"
Category: ${category}
Careers page: ${careersUrl}

Based on your knowledge of this company, list likely CURRENT open roles — especially product, technology, and operations positions. Prioritize Director, Head of Product, VP Product, Product Manager, and similar product leadership roles if they exist.

Return ONLY a JSON array (no markdown, no explanation):
[
  {"title": "Head of Product", "department": "Product", "location": "Remote", "type": "Full-time", "url": "${careersUrl}"},
  ...
]

If you have no information about current openings, return: []
Maximum 6 jobs. Return ONLY the JSON array.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(502).json({ error: err.error?.message || 'Upstream API error' });
    }

    const data = await response.json();
    const text = data.content.map(b => b.text || '').join('').trim();

    let jobs = [];
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      jobs = JSON.parse(clean);
      if (!Array.isArray(jobs)) jobs = [];
    } catch (e) {
      jobs = [];
    }

    // Add CORS headers so the browser can call this
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ jobs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
