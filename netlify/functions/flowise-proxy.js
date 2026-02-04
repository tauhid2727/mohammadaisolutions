export default async (req) => {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("", { status: 200, headers: corsHeaders() });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders(),
      });
    }

    const FLOWISE_URL = process.env.FLOWISE_URL; // https://chat.mohammadaisolutions.com
    const FLOWISE_API_KEY = process.env.FLOWISE_API_KEY;

    if (!FLOWISE_URL) return json({ error: "Missing FLOWISE_URL env var" }, 500);
    if (!FLOWISE_API_KEY) return json({ error: "Missing FLOWISE_API_KEY env var" }, 500);

    const body = await req.json();
    const { chatflowId, question, overrideConfig, sessionId } = body || {};

    if (!chatflowId || !question) {
      return json({ error: "chatflowId and question are required" }, 400);
    }

    const target = `${FLOWISE_URL.replace(/\/$/, "")}/api/v1/prediction/${chatflowId}`;

    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FLOWISE_API_KEY}`,
      },
      body: JSON.stringify({
        question,
        ...(overrideConfig ? { overrideConfig } : {}),
        ...(sessionId ? { sessionId } : {}),
      }),
    });

    const upstreamText = await upstream.text();

    // If upstream sends HTML, return it as text so you can see the real error fast
    let data;
    try {
      data = JSON.parse(upstreamText);
    } catch (e) {
      console.log("Upstream returned non-JSON (first 300):", upstreamText.slice(0, 300));
      return new Response(upstreamText, {
        status: upstream.status,
        headers: { ...corsHeaders(), "Content-Type": "text/plain" },
      });
    }

    // Remove LEAD_JSON block from visitor-visible text (if present)
    const rawText = data?.text ?? "";
    const cleanText = rawText.replace(/<LEAD_JSON>[\s\S]*?<\/LEAD_JSON>/i, "").trim();
    data.text = cleanText;

    return json(data, upstream.status);
  } catch (err) {
    console.log("Function error:", err);
    return json({ error: "proxy failed", detail: String(err) }, 500);
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

