/**
 * Provider-neutral Node 20 serverless handler contract.
 * Deploy behind your own authentication/rate limits and set AI_API_URL + AI_API_KEY
 * in that platform's secret store. Do not put those values in GitHub Pages or browser code.
 */
export default async function handler(request) {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  if (!process.env.AI_API_URL || !process.env.AI_API_KEY) {
    return Response.json({ error: "Secure AI provider is not configured." }, { status: 503 });
  }
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (!payload?.analysis || typeof payload.analysis !== "object") {
    return Response.json({ error: "A deterministic analysis object is required." }, { status: 400 });
  }

  const upstream = await fetch(process.env.AI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      task: "Provide a concise fantasy-football trade assessment. Treat supplied values, news, and source metadata as unverified context. Do not claim real-time data or invent citations.",
      trade: payload.analysis,
      league: payload.league || null,
    }),
  });
  if (!upstream.ok) return Response.json({ error: "Configured AI provider request failed." }, { status: 502 });
  const result = await upstream.json();
  const analysis = typeof result.analysis === "string" ? result.analysis : typeof result.output_text === "string" ? result.output_text : null;
  if (!analysis) return Response.json({ error: "Configured AI provider returned no analysis text." }, { status: 502 });
  return Response.json({ analysis });
}
