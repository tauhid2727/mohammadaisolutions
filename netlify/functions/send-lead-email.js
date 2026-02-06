const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: cors(), body: "" };
    }

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: cors(), body: "Method Not Allowed" };
    }

    if (!process.env.RESEND_API_KEY) {
      return {
        statusCode: 500,
        headers: cors(),
        body: JSON.stringify({ ok: false, error: "Missing RESEND_API_KEY in Netlify env vars" }),
      };
    }

    const data = JSON.parse(event.body || "{}");

    const from = process.env.EMAIL_FROM || "Mohammad AI <onboarding@resend.dev>";
    const to = (process.env.EMAIL_TO || "tauhid27@gmail.com").split(",").map(s => s.trim()).filter(Boolean);

    const { data: sent, error } = await resend.emails.send({
      from,
      to,
      subject: "🔥 New Lead",
      html: `
        <h2>New Lead</h2>
        <pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>
      `,
    });

    if (error) {
      return {
        statusCode: 500,
        headers: cors(),
        body: JSON.stringify({ ok: false, resendError: error }),
      };
    }

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ ok: true, id: sent?.id }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ ok: false, error: String(err?.message || err) }),
    };
  }
};

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
