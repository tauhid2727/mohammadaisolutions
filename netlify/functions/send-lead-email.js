const nodemailer = require("nodemailer");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  // Allow POST only
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Method Not Allowed" }),
    };
  }

  try {
    // 🔐 REQUIRED ENV VARS (fail fast)
    const {
      EMAIL_HOST,
      EMAIL_PORT,
      EMAIL_USER,
      EMAIL_PASS,
      EMAIL_TO,
      EMAIL_FROM,
    } = process.env;

    if (
      !EMAIL_HOST ||
      !EMAIL_USER ||
      !EMAIL_PASS ||
      !EMAIL_TO ||
      !EMAIL_FROM
    ) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: false,
          error: "Missing required email environment variables",
        }),
      };
    }

    // Parse body
    const data = JSON.parse(event.body || "{}");

    const {
      name,
      email,
      phone,
      business,
      message,
    } = data;

    if (!name && !email && !phone && !business) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: "Empty lead" }),
      };
    }

    // ⚡ FAST SMTP (no hangs)
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: Number(EMAIL_PORT || 587),
      secure: false,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `New Lead — ${name || business || "Website"}`,
      text: `
New Lead Received

Name: ${name || ""}
Business: ${business || ""}
Email: ${email || ""}
Phone: ${phone || ""}

Message:
${message || ""}

Sent from mohammadaisolutions.com
      `,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: false,
        error: err.message || "Internal error",
      }),
    };
  }
};
