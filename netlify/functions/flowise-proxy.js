export default async (req, context) => {
  try {
    // Only allow POST (and reply to OPTIONS for CORS)
    if (req.method === "OPTIONS") {
      return new Response("", {
        status: 200,
        headers: corsHeaders()
      });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders()
      });
    }

    const FLOWISE_URL = process.env.FLOWISE_URL;       // e.g. https://chat.mohammadaisolutions.com
    const FLOWISE_API_KEY = process.env.FLOWISE_API_KEY; // your Flowise API key

    if (!FLOWISE_URL) {
      console.log("Missing env var: FLOWISE_URL");
      return json({ error: "Missing FLOWISE_URL env var" }, 500);
    }
    if (!FLOWISE_API_KEY) {
      console.log("Missing env var: FLOWISE_API_KEY");
      return json({ error: "Missing FLOWISE_API_KEY env var" }, 500);
    }

    const body = await req.json();
    const chatflowId = body.chatflowId;
    const question = body.question;

    if (!chatflowId || !question) {
      console.log("Bad request body:", body);
      return json({ error: "chatflowId and question are required" }, 400);
    }

    const target = `${FLOWISE_URL.replace(/\/$/, "")}/api/v1/prediction/${chatflowId}`;

    console.log("Proxying to:", target);

    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Most common Flowise API key pattern:
        "Authorization": `Bearer ${FLOWISE_API_KEY}`
      },
      body: JSON.stringify({ question })
    });

    const text = await upstream.text();
    console.log("Upstream status:", upstream.status);
    // Log first part only, to avoid huge logs
    console.log("Upstream body (first 300 chars):", text.slice(0, 300));

    return new Response(text, {
      status: upstream.status,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.log("Function error:", err);
    return json({ error: "fetch failed", detail: String(err) }, 500);
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}
