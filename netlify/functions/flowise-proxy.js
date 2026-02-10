const FLOWISE_HOST = "https://chat.mohammadaisolutions.com";

function corsHeaders(origin) {
  // Allow your domains (add/remove as needed)
  const allowed = new Set([
    "https://mohammadaisolutions.com",
    "https://willowy-biscuit-a98742.netlify.app",
  ]);

  const allowOrigin = allowed.has(origin) ? origin : "https://mohammadaisolutions.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

exports.handler = async (event) => {
  const origin = event.headers.origin || "";

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(origin), body: "" };
  }

  try {
    // Netlify redirect sends /api/v1/* -> /.netlify/functions/flowise-proxy/:splat
    // event.path will look like: "/.netlify/functions/flowise-proxy/public-chatbotConfig/<id>"
    const fnPrefix = "/.netlify/functions/flowise-proxy";
    const splat = event.path.startsWith(fnPrefix) ? event.path.slice(fnPrefix.length) : event.path;

    // splat is like "/public-chatbotConfig/<id>" or "/chatflows-streaming/<id>"
    const targetUrl = `${FLOWISE_HOST}/api/v1${splat}`;

    const upstream = await fetch(targetUrl, {
      method: event.httpMethod,               // IMPORTANT: forwards GET/POST/etc
      headers: {
        "Content-Type": event.headers["content-type"] || "application/json",
        // If Flowise needs auth, add it here:
        // "Authorization": `Bearer ${process.env.FLOWISE_TOKEN}`,
      },
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
    });

    const contentType = upstream.headers.get("content-type") || "application/json";
    const text = await upstream.text();

    return {
      statusCode: upstream.status,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": contentType,
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(origin),
      body: JSON.stringify({ error: "Proxy error", details: String(err) }),
    };
  }
};
