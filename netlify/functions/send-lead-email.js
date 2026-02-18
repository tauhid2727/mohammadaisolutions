// netlify/functions/send-lead-email.js

const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "Content-Type, x-lead-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});

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

    // Minimal required fields (keep as you had)
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

    // 1) Send email via Resend
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

    // 2) Log to Google Sheet (Apps Script Web App) — Clean + Safe + Good Logs
    let sheetsStatus = null;
    let sheetsBody = null;

    try {
      if (!process.env.GSHEET_WEBAPP_URL) {
        throw new Error("Missing env var GSHEET_WEBAPP_URL");
      }
      if (!process.env.LEAD_TOKEN) {
        throw new Error("Missing env var LEAD_TOKEN");
      }

      const payload = {
        leadToken: process.env.LEAD_TOKEN,
        fullName,
        preferredContact,
        phoneOrWhatsapp: phoneOrWhatsApp, // Apps Script expects phoneOrWhatsapp
        businessName,
        email: email || "",
        source: "MohammadAI Website",
      };

      const res = await fetch(process.env.GSHEET_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      sheetsStatus = res.status;

      const text = await res.text();
      try {
        sheetsBody = JSON.parse(text);
      } catch {
        sheetsBody = { raw: text };
      }

      console.log("Google Sheets status:", sheetsStatus);
      console.log("Google Sheets response:", sheetsBody);
    } catch (e) {
      console.log("Google Sheets logging error:", e?.message || String(e));
      sheetsBody = { ok: false, error: e?.message || String(e) };
    }

    // 3) Success response (includes Sheets debug info)
    return {
      statusCode: 200,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({
        ok: true,
        message: "Lead submitted successfully",
        result,
        sheets: { status: sheetsStatus, body: sheetsBody },
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
