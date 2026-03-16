/**
 * HOMI — Claude API Proxy
 * Netlify Function: /.netlify/functions/claude
 */
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }) };
  }
  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }
  const { system, messages } = body;
  if (!messages || !Array.isArray(messages)) {
    return { statusCode: 400, body: JSON.stringify({ error: "messages array required" }) };
  }
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        ...(system ? { system } : {}),
        messages,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: data.error?.message || "API error" }) };
    }
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Proxy error" }) };
  }
};
