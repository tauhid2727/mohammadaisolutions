// netlify/functions/flowise-proxy.js

export async function handler(event) {
  // 1) Handle CORS preflight
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // 2) Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: "Method Not Allowed",
    };
  }

  try {
    const FLOWISE_URL = process.env.FLOWISE_URL; // e.g. https://chat.mohammadaisolutions.com
    const FLOWISE_API_KEY = process.env.FLOWISE_API_KEY;

    if (!FLOWISE_URL) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing FLOWISE_URL env var" }),
      };
    }

    // 3) Expect payload like: { chatflowId: "...", question: "...", ... }
    const body = JSON.parse(event.body || "{}");
    const chatflowId = body.chatflowId;

    if (!chatflowId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing chatflowId in request body" }),
      };
    }

    // 4) Forward to Flowise Prediction endpoint
    const targetUrl = `${FLOWISE_URL.replace(/\/$/, "")}/api/v1/prediction/${chatflowId}`;

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",

        // Some Flowise setups use Bearer, some use x-api-key.
        // Sending both is fine; Flowise will ignore the one it doesn't use.
        ...(FLOWISE_API_KEY ? { Authorization: `Bearer ${FLOWISE_API_KEY}` } : {}),
        ...(FLOWISE_API_KEY ? { "x-api-key": FLOWISE_API_KEY } : {}),
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    return {
      statusCode: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err?.message || "Proxy error" }),
    };
  }
}
