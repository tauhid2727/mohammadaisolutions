export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "Method Not Allowed",
    };
  }

  try {
    const { chatflowId, question, overrideConfig } = JSON.parse(event.body || "{}");

    if (!chatflowId || !question) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing chatflowId or question" }),
      };
    }

    const base = (process.env.FLOWISE_URL || "").replace(/\/$/, "");
    if (!base) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "FLOWISE_URL env var is missing" }),
      };
    }

    // ✅ This is the correct Flowise prediction endpoint format:
    const url = `${base}/api/v1/prediction/${chatflowId}`;

    const headers = { "Content-Type": "application/json" };

    // Only send auth header if you actually set a key
    if (process.env.FLOWISE_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.FLOWISE_API_KEY}`;
    }

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ question, overrideConfig }),
    });

    const text = await resp.text();
    return {
      statusCode: resp.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": resp.headers.get("content-type") || "application/json",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
}
