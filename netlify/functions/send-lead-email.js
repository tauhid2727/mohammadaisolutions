const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * CORS headers
 */
const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "Content-Type, x-lead-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});

/**
 * Log a lead to Google Sheets via Apps Script Web App
 * - Does NOT throw to the main flow unless you want it to.
 * - We call it in a try/catch so email never breaks.
 */
async function logLeadToGoogleSheet(lead) {
  const url = process.env.GOOGLE_SHEETS_WEBAPP_URL;
  if (!url) throw new Error("Missing GOOGLE_SHEETS_WEBAPP_URL env var");

  // Netlify Node runtime supports fetch in modern runtimes, but this is safest:
  const fetchFn = global.fetch || (await import("node-fetch")).default;

  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // Apps Script should validate this value (must match Script Property / token)
      leadToken: process.env.LEAD_TOKEN || "",
      ...lead,
      source: "mohammadaisolutions.com",
      timestamp: new Date().toISOString(),
    }),
  });

  const data = await res.json().catch(() => ({}));

  // Expect Apps Script to respond with: { ok: true }
  if (!res.ok || data.ok !== true) {
    throw new Error(`Sheets logging failed: ${JSON.stringify(data)}`);
  }

  return data;
}

exports.handler = async (event) => {
  const allowOrigin = event.headers?.origin || event.headers?.Origin || "*";

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders(allowOrigin),
      body: "",
    };
  }

  // Only POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    // Normalize keys (keep your current behavior)
    const fullName = body.fullName || body.FullName || body.name || "";
    const preferredContact = body.preferredContact || body.contactMethod || "";
    const phoneOrWhatsApp =
      body.phoneOrWhatsApp || body.phoneOrWhatsapp || body.phone || body.whatsapp || "";
    const businessName = body.businessName || body.business || "";
    const email = body.email || "";

    // Keep your current minimal requirement so you don’t break anything
    if (!fullName || !businessName) {
      return {
        statusCode: 400,
        headers: corsHeaders(allowOrigin),
        body: JSON.stringify({
          ok: false,
          error: "Missing required fields",
          required: ["fullName", "businessName"],
        }),
      };
    }

    // 1) SEND EMAIL (same as your current function)
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
      subject: `🔥 New Lead from ${businessName}`,
      html: `
        <h2>New Website Lead</h2>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Business:</strong> ${businessName}</p>
        <p><strong>Preferred Contact:</strong> ${preferredContact || "Not provided"}</p>
        <p><strong>Phone/WhatsApp:</strong> ${phoneOrWhatsApp || "Not provided"}</p>
        <p><strong>Email:</strong> ${email || "Not provided"}</p>
      `,
    });

    // 2) LOG TO GOOGLE SHEETS (safe: will not break email if it fails)
    let sheetsOk = false;
    let sheetsResult = null;

    try {
      sheetsResult = await logLeadToGoogleSheet({
        fullName,
        preferredContact,
        phoneOrWhatsApp,
        businessName,
        email,
      });
      sheetsOk = true;
    } catch (e) {
      console.log("Google Sheets logging error:", e?.message || e);
      sheetsOk = false;
    }

    // 3) SUCCESS RESPONSE (email is the primary success)
    return {
      statusCode: 200,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({
        ok: true,
        message: "Lead submitted successfully",
        result,
        sheetsOk,
        sheetsResult,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({
        ok: false,
        error: error?.message || "Server error",
      }),
    };
  }
};
