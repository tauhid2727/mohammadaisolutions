// netlify/functions/send-lead-email.js

const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "Content-Type, x-lead-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});

// --- Slack helper ---
async function sendSlackAlert(lead) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("Slack webhook not configured (SLACK_WEBHOOK_URL missing)");
    return { ok: false, skipped: true };
  }

  const safe = (v) => (v && String(v).trim() ? String(v) : "-");

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "🚀 New Lead — Mohammad AI Solutions", emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Name:*\n${safe(lead.fullName)}` },
        { type: "mrkdwn", text: `*Business:*\n${safe(lead.businessName)}` },
        { type: "mrkdwn", text: `*Preferred:*\n${safe(lead.preferredContact)}` },
        { type: "mrkdwn", text: `*Phone/WhatsApp:*\n${safe(lead.phoneOrWhatsApp)}` },
        { type: "mrkdwn", text: `*Email:*\n${safe(lead.email)}` },
        { type: "mrkdwn", text: `*Source:*\n${safe(lead.source)}` },
      ],
    },
    { type: "divider" },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: "✅ Logged to Google Sheets + Email sent. Reply here to coordinate follow-up." },
      ],
    },
  ];

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "New lead received", blocks }),
    });

    console.log("Slack status:", res.status);
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } catch (err) {
    console.error("Slack error:", err?.message || String(err));
    return { ok: false, error: err?.message || String(err) };
  }
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
    // (Recommended) Optional security check:
    // If you set LEAD_TOKEN in Netlify, only requests with header x-lead-token matching it will be accepted.
    const headerToken =
      event.headers?.["x-lead-token"] ||
      event.headers?.["X-Lead-Token"] ||
      event.headers?.["X-LEAD-TOKEN"] ||
      "";

    const expectedToken = process.env.LEAD_TOKEN || "";
    if (expectedToken && headerToken && headerToken !== expectedToken) {
      return {
        statusCode: 401,
        headers: corsHeaders(allowOrigin),
        body: JSON.stringify({ ok: false, error: "Unauthorized (bad token)" }),
      };
    }
    // If you want to REQUIRE the token header (stronger), uncomment:
    /*
    if (expectedToken && !headerToken) {
      return {
        statusCode: 401,
        headers: corsHeaders(allowOrigin),
        body: JSON.stringify({ ok: false, error: "Unauthorized (missing token)" }),
      };
    }
    */

    const body = JSON.parse(event.body || "{}");

    // Normalize keys (keep your current behavior)
    const fullName = body.fullName || body.FullName || body.name || "";
    const preferredContact = body.preferredContact || body.contactMethod || "";
    const phoneOrWhatsApp =
      body.phoneOrWhatsApp || body.phoneOrWhatsapp || body.phone || body.whatsapp || "";
    const businessName = body.businessName || body.business || "";
    const email = body.email || "";
    const source = body.source || "MohammadAI Website";

    // Minimal required fields
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
    const emailResult = await resend.emails.send({
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
        <p><strong>Source:</strong> ${source}</p>
      `,
    });

    // 2) Log to Google Sheet (Apps Script Web App)
    let sheetsStatus = null;
    let sheetsBody = null;

    try {
      if (!process.env.GSHEET_WEBAPP_URL) throw new Error("Missing env var GSHEET_WEBAPP_URL");
      if (!process.env.LEAD_TOKEN) throw new Error("Missing env var LEAD_TOKEN");

      const payload = {
        leadToken: process.env.LEAD_TOKEN,
        fullName,
        preferredContact,
        phoneOrWhatsapp: phoneOrWhatsApp, // Apps Script accepts this
        businessName,
        email: email || "",
        source,
        timestamp: new Date().toISOString(),
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

    // 3) Slack alert (do NOT fail the request if Slack fails)
    const slack = await sendSlackAlert({
      fullName,
      preferredContact,
      phoneOrWhatsApp,
      businessName,
      email,
      source,
    });

    // 4) Success response (includes Sheets + Slack debug)
    return {
      statusCode: 200,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({
        ok: true,
        message: "Lead submitted successfully",
        email: emailResult,
        sheets: { status: sheetsStatus, body: sheetsBody },
        slack,
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
