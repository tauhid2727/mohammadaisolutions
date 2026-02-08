const { Resend } = require("resend");

// ✅ CORS (include x-lead-token)
const corsHeaders = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-lead-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

// ✅ small helper to avoid HTML breaking
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

exports.handler = async (event) => {
  try {
    // ✅ CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders(), body: "" };
    }

    // ✅ Allow POST only
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: false, error: "Method Not Allowed" }),
      };
    }

    // ✅ TOKEN CHECK (inside handler)
    const token = event.headers?.["x-lead-token"] || event.headers?.["X-Lead-Token"];
    if (!process.env.LEAD_TOKEN || token !== process.env.LEAD_TOKEN) {
      return {
        statusCode: 401,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: false, error: "Unauthorized" }),
      };
    }

    // ✅ Parse body
    const data = JSON.parse(event.body || "{}");

    // ✅ Env vars
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

    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: [EMAIL_TO],
      ...(EMAIL_CC ? { cc: [EMAIL_CC] } : {}),
      subject: `🔥 New Lead — ${data.fullName || "Website"}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.4;">
          <h2 style="margin:0 0 12px;">New Lead</h2>
          <p style="margin:0 0 12px;">
            <b>Name:</b> ${escapeHtml(data.fullName || "")}<br/>
            <b>Business:</b> ${escapeHtml(data.businessName || "")}<br/>
            <b>Preferred Contact:</b> ${escapeHtml(data.preferredContact || "")}<br/>
            <b>Email:</b> ${escapeHtml(data.email || "")}<br/>
            <b>Phone:</b> ${escapeHtml(data.phone || "")}<br/>
            <b>Has Website:</b> ${escapeHtml(data.hasWebsite || "")}<br/>
            <b>Service Interest:</b> ${escapeHtml(data.serviceInterest || "")}
          </p>

          <h3 style="margin:18px 0 8px;">Full Payload</h3>
          <pre style="font-size:13px; background:#f6f6f6; padding:12px; border-radius:8px; white-space:pre-wrap;">${escapeHtml(
            JSON.stringify(data, null, 2)
          )}</pre>
        </div>
      `,
    });

    // ✅ Resend returns id inside result.data.id (most common)
    const id = result?.data?.id || result?.id || null;

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, id }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: err.message || String(err) }),
    };
  }
};
