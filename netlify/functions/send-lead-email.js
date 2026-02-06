const { Resend } = require("resend");

const corsHeaders = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});
const token = event.headers["x-lead-token"] || event.headers["X-Lead-Token"];
if (!process.env.LEAD_TOKEN || token !== process.env.LEAD_TOKEN) {
  return {
    statusCode: 401,
    headers: corsHeaders(),
    body: JSON.stringify({ ok: false, error: "Unauthorized" })
  };
}
exports.handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders(), body: "" };
    }

    // Allow POST only
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: corsHeaders(), body: "Method Not Allowed" };
    }

    // Parse body
    const data = JSON.parse(event.body || "{}");

    // Env vars
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const EMAIL_TO = process.env.EMAIL_TO;
    const EMAIL_FROM = process.env.EMAIL_FROM;
    const EMAIL_CC = process.env.EMAIL_CC;

    if (!RESEND_API_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: false, error: "Missing RESEND_API_KEY" }),
      };
    }
    if (!EMAIL_TO) {
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: false, error: "Missing EMAIL_TO" }),
      };
    }
    if (!EMAIL_FROM) {
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: false, error: "Missing EMAIL_FROM" }),
      };
    }

    const resend = new Resend(RESEND_API_KEY);

    const email = await resend.emails.send({
      from: EMAIL_FROM,
      to: [EMAIL_TO],
      ...(EMAIL_CC ? { cc: [EMAIL_CC] } : {}),
      subject: "🔥 New Lead",
      html: `
        <h2>New Lead</h2>
        <pre style="font-size:14px;white-space:pre-wrap">${escapeHtml(
          JSON.stringify(data, null, 2)
        )}</pre>
      `,
    });

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, email }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: err.message || String(err) }),
    };
  }
};

// small helper to avoid HTML breaking
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
