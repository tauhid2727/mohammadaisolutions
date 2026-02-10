const FLOWISE_HOST = "https://chat.mohammadaisolutions.com";
const VERSION = "proxy-v3-cleanheaders-2026-02-10";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

exports.handler = async (event) => {
  const origin = event.headers.origin || "";

  // Quick deployment test endpoint:
  // https://<yoursite>/.netlify/functions/flowise-proxy/ping
  if (event.path.endsWith("/ping")) {
    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, version: VERSION }),
    };
  }

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(origin), body: "" };
  }

  try {
    const fnPrefix = "/.netlify/functions/flowise-proxy";
    const splat = event.path.startsWith(fnPrefix)
      ? event.path.slice(fnPrefix.length)
      : event.path;

    const targetUrl = `${FLOWISE_HOST}/api/v1${splat}`;

    // ✅ CLEAN headers only (do NOT forward Netlify headers)
    const upstream = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: {
        "Accept": "application/json",
        "Content-Type": event.headers["content-type"] || "application/json",
      },
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
    });

    const text = await upstream.text();

    return {
      statusCode: upstream.status,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Proxy error", details: String(err), version: VERSION }),
    };
  }
};
