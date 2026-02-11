const FLOWISE_HOST = "https://chat.mohammadaisolutions.com";

function corsHeaders(origin) {
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
    // event.path may be:
    // 1) "/.netlify/functions/flowise-proxy/public-chatbotConfig/<id>"
    // 2) "/api/v1/public-chatbotConfig/<id>"   (when called via _redirects)
    let path = event.path || "";

    // Remove function prefix if present
    const fnPrefix = "/.netlify/functions/flowise-proxy";
    if (path.startsWith(fnPrefix)) path = path.slice(fnPrefix.length);

    // Remove "/api/v1" prefix if present (critical!)
    const apiPrefix = "/api/v1";
    if (path.startsWith(apiPrefix)) path = path.slice(apiPrefix.length);

    // Now path should look like "/public-chatbotConfig/<id>" etc.
    const targetUrl = `${FLOWISE_HOST}/api/v1${path}`;

    const upstream = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: {
        "Content-Type": event.headers["content-type"] || "application/json",
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
