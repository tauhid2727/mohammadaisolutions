// netlify/functions/send-lead-email.js
// Bulletproof version:
// ✅ CORS (prod + chat subdomain + any .netlify.app preview)
// ✅ OPTIONS preflight
// ✅ Token check is CASE-INSENSITIVE
// ✅ Accepts MANY possible field names from Flowise/custom tools
// ✅ Sends email via Resend and returns real id
// ✅ Logs useful debug info in Netlify function logs

const corsHeaders = (origin = "") => {
  const allowed =
    origin === "https://mohammadaisolutions.com" ||
    origin === "https://chat.mohammadaisolutions.com" ||
    origin.endsWith(".netlify.app"); // keep because you chose Option B

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
    // 1) Handle preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders(origin), body: "" };
    }

    // 2) Only POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders(origin),
        body: JSON.stringify({ ok: false, error: "Method Not Allowed" }),
      };
    }

    // 3) Normalize headers to lowercase (CASE-INSENSITIVE)
    const headersLower = Object.fromEntries(
      Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v])
    );

    // 4) Token check (case-insensitive header name)
    const expectedToken = process.env.LEAD_TOKEN;
    const gotToken = headersLower["x-lead-token"];

    if (!expectedToken) {
      console.log("❌ Missing env LEAD_TOKEN");
      return {
        statusCode: 500,
        headers: corsHeaders(origin),
        body: JSON.stringify({ ok: false, error: "Server misconfigured (LEAD_TOKEN missing)" }),
      };
    }

    if (!gotToken || gotToken !== expectedToken) {
      console.log("❌ Unauthorized: token missing or mismatch");
      return {
        statusCode: 401,
        headers: corsHeaders(origin),
        body: JSON.stringify({ ok: false, error: "Unauthorized" }),
      };
    }

    // 5) Parse JSON body
    const data = JSON.parse(event.body || "{}");

    // 6) Bulletproof field mapping (accept many key names)
    const fullName =
      data.fullName || data.name || data.customerName || data.full_name || "";

    const email =
      data.email || data.emailAddress || data.email_address || "";

    const preferredContact =
      data.preferredContact || data.contactMethod || data.preferred_contact || "";

    const phoneOrWhatsapp =
      data.phoneOrWhatsapp ||
      data.phone ||
      data.phoneNumber ||
      data.phone_number ||
      data.whatsapp ||
      data.whatsappNumber ||
      data.whatsapp_number ||
      "";

    const businessName =
      data.businessName || data.company || data.companyName || data.business || data.clinicName || "";

    const goal = data.goal || "";
    const painPoint = data.painPoint || data.pain_point || "";
    const tools = data.tools || "";
    const monthlyVolume = data.monthlyVolume || data.monthlyInquiries || data.monthly || "";
    const sourceUrl = data.sourceUrl || data.pageUrl || data.sourceURL || "";

    console.log("✅ Lead received:", {
      fullName,
      email: email ? "(present)" : "(missing)",
      preferredContact,
      phoneOrWhatsapp: phoneOrWhatsapp ? "(present)" : "(missing)",
      businessName,
      goal,
      sourceUrl,
    });

    // 7) Required env vars for Resend
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

    // 8) Build email
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

    // 9) Send via Resend REST API
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

    // 10) Success
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
