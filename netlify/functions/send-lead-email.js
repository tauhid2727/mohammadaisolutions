const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: cors(), body: "" };
    }

    // Only allow POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: cors(),
        body: "Method Not Allowed"
      };
    }

    const body = JSON.parse(event.body || "{}");

    const name = body.name || "";
    const email = body.email || "";
    const phone = body.phone || "";
    const business = body.business || "";
    const message = body.message || "";

    // Require at least one contact method
    if (!email && !phone) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ ok: false, error: "Missing email or phone" })
      };
    }

    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
      subject: `New Lead: ${name || "Unknown"}`,
      text: `New Lead Received

Name: ${name}
Business: ${business}
Email: ${email}
Phone: ${phone}

Message:
${message}

(Source: Website / Chatbot)
`
    });

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}
-------------------------------------
