const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors(), body: "" };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors(), body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    const EMAIL_TO = process.env.EMAIL_TO;     // e.g. hello@mohammadaisolutions.com
    const EMAIL_FROM = process.env.EMAIL_FROM; // e.g. onboarding@resend.dev (or hello@... after domain verified)
    const EMAIL_CC = process.env.EMAIL_CC;     // optional

    if (!process.env.RESEND_API_KEY) {
      return {
        statusCode: 500,
        headers: cors(),
        body: JSON.stringify({ ok: false, error: "Missing RESEND_API_KEY" }),
      };
    }
    if (!EMAIL_TO) {
      return {
        statusCode: 500,
        headers: cors(),
        body: JSON.stringify({ ok: false, error: "Missing EMAIL_TO" }),
      };
    }
    if (!EMAIL_FROM) {
      return {
        statusCode: 500,
        headers: cors(),
        body: JSON.stringify({ ok: false, error: "Missing EMAIL_FROM" }),
      };
    }

    const subject = "🔥 New Lead";
    const html = `
      <h2>New Lead</h2>
      <pre style="font-size:14px;line-height:1.4">${escapeHtml(
        JSON.stringify(data, null, 2)
      )}</pre>
    `;

    const payload = {
      from: `Mohammad AI Solutions <${EMAIL_FROM}>`,
      to: [EMAIL_TO],
      subject,
      html,
    };

    if (EMAIL_CC && EMAIL_CC.trim()) {
      payload.cc = [EMAIL_CC.trim()];
    }

    const result = await resend.emails.send(payload);

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ ok: true, result }),
    };
  } catch (err) {
    // IMPORTANT: return the real error so 403 explains itself
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({
        ok: false,
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
      }),
    };
  }
};

// tiny helper so JSON doesn't break HTML
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
