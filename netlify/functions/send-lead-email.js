// netlify/functions/send-lead-email.js

const corsHeaders = (origin = "") => {
  const allowed =
    origin === "https://mohammadaisolutions.com" ||
    origin === "https://chat.mohammadaisolutions.com" ||
    origin.endsWith(".netlify.app");

  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://mohammadaisolutions.com",
    "Access-Control-Allow-Headers": "Content-Type, x-lead-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
};

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";

  try {
    // Handle preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders(origin), body: "" };
    }

    // Only POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders(origin),
        body: JSON.stringify({ ok: false, error: "Method Not Allowed" }),
      };
    }

    // Token check
    const expectedToken = process.env.LEAD_TOKEN;
    const gotToken = event.headers["x-lead-token"] || event.headers["X-Lead-Token"];

    if (!expectedToken) {
      console.log("❌ Missing env LEAD_TOKEN");
      return {
        statusCode: 500,
        headers: corsHeaders(origin),
        body: JSON.stringify({ ok: false, error: "Server misconfigured (LEAD_TOKEN missing)" }),
      };
    }

    if (!gotToken || gotToken !== expectedToken) {
      console.log("❌ Unauthorized token. got:", gotToken ? "(present)" : "(missing)");
      return {
        statusCode: 401,
        headers: corsHeaders(origin),
        body: JSON.stringify({ ok: false, error: "Unauthorized" }),
      };
    }

    // Parse body
    const data = JSON.parse(event.body || "{}");

    const {
      fullName = "",
      email = "",
      preferredContact = "",
      phoneOrWhatsapp = "",
      businessName = "",
      goal = "",
      painPoint = "",
      tools = "",
      monthlyVolume = "",
      sourceUrl = "",
    } = data;

    console.log("✅ Lead received:", {
      fullName,
      email: email ? "(present)" : "(missing)",
      preferredContact,
      phoneOrWhatsapp: phoneOrWhatsapp ? "(present)" : "(missing)",
      businessName,
      sourceUrl,
    });

    // Resend env
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const EMAIL_FROM = process.env.EMAIL_FROM; // must be verified in Resend
    const EMAIL_TO = process.env.EMAIL_TO;     // your inbox

    if (!RESEND_API_KEY || !EMAIL_FROM || !EMAIL_TO) {
      console.log("❌ Missing env:", {
        RESEND_API_KEY: !!RESEND_API_KEY,
        EMAIL_FROM: !!EMAIL_FROM,
        EMAIL_TO: !!EMAIL_TO,
      });

      return {
        statusCode: 500,
        headers: corsHeaders(origin),
        body: JSON.stringify({ ok: false, error: "Server misconfigured (missing email env vars)" }),
      };
    }

    const subject = `New Lead — ${businessName || fullName || "Website"}`;

    const text = `
New Lead

Name: ${fullName}
Email: ${email}
Preferred contact: ${preferredContact}
Phone/WhatsApp: ${phoneOrWhatsapp}

Business: ${businessName}
Goal: ${goal}
Pain point: ${painPoint}
Tools: ${tools}
Monthly volume: ${monthlyVolume}

Source: ${sourceUrl}
    `.trim();

    console.log("📨 Sending via Resend…");

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [EMAIL_TO],
        subject,
        text,
      }),
    });

    const respBody = await resp.json().catch(() => ({}));

    console.log("📩 Resend response:", resp.status, respBody);

    if (!resp.ok) {
      return {
        statusCode: 502,
        headers: corsHeaders(origin),
        body: JSON.stringify({
          ok: false,
          error: "Resend failed",
          status: resp.status,
          details: respBody,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: true, id: respBody.id || null }),
    };
  } catch (err) {
    console.log("🔥 Function error:", err?.message || err);
    return {
      statusCode: 500,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: false, error: err?.message || "Server error" }),
    };
  }
};
