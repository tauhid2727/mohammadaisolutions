// netlify/functions/send-lead-email.js

const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "Content-Type, x-lead-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});

// ---------- Slack helper ----------
async function sendSlackAlert(lead) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("Slack skipped: SLACK_WEBHOOK_URL missing");
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
        { type: "mrkdwn", text: "Lead captured from website chatbot." },
      ],
    },
  ];

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "New lead received", blocks }),
    });

    const text = await res.text();
    console.log("Slack status:", res.status, text);

    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      body: text,
    };
  } catch (err) {
    console.error("Slack error:", err?.message || String(err));
    return { ok: false, error: err?.message || String(err) };
  }
}

exports.handler = async (event) => {
  const allowOrigin = event.headers?.origin || event.headers?.Origin || "*";

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders(allowOrigin),
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  try {
    // ---------- Token check ----------
    const headerToken =
      event.headers?.["x-lead-token"] ||
      event.headers?.["X-Lead-Token"] ||
      event.headers?.["X-LEAD-TOKEN"] ||
      "";

    const expectedToken = process.env.LEAD_TOKEN || "";

    if (expectedToken && headerToken !== expectedToken) {
      return {
        statusCode: 401,
        headers: corsHeaders(allowOrigin),
        body: JSON.stringify({
          ok: false,
          error: "Unauthorized (bad or missing token)",
        }),
      };
    }

    // ---------- Parse incoming body ----------
    const rawBody = JSON.parse(event.body || "{}");

    // IMPORTANT:
    // Flowise may send either:
    // { fullName: "...", ... }
    // OR
    // { body: { fullName: "...", ... } }
    const payload =
      rawBody && typeof rawBody.body === "object" && rawBody.body !== null
        ? rawBody.body
        : rawBody;

    console.log("Incoming rawBody:", JSON.stringify(rawBody));
    console.log("Parsed payload:", JSON.stringify(payload));

    // ---------- Normalize keys ----------
    const fullName = payload.fullName || payload.FullName || payload.name || "";
    const preferredContact = payload.preferredContact || payload.contactMethod || "";
    const phoneOrWhatsApp =
      payload.phoneOrWhatsApp ||
      payload.phoneOrWhatsapp ||
      payload.phone ||
      payload.whatsapp ||
      "";
    const businessName = payload.businessName || payload.business || "";
    const email = payload.email || "";
    const source = payload.source || "MohammadAI Website";

    console.log("Normalized lead:", {
      fullName,
      preferredContact,
      phoneOrWhatsApp,
      businessName,
      email,
      source,
    });

    // ---------- Validate ----------
    if (!fullName || !preferredContact || !phoneOrWhatsApp || !businessName) {
      return {
        statusCode: 400,
        headers: corsHeaders(allowOrigin),
        body: JSON.stringify({
          ok: false,
          error: "Missing required fields",
          debug: {
            fullName,
            preferredContact,
            phoneOrWhatsApp,
            businessName,
            payload,
          },
        }),
      };
    }

    // ---------- 1) Send email ----------
    let emailResult = null;
    let emailError = null;

    try {
      emailResult = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_TO,
        subject: `🔥 New AI Lead | ${businessName} | ${phoneOrWhatsApp}`,
        html: `
          <h2>New Website Lead</h2>
          <p><strong>Name:</strong> ${fullName}</p>
          <p><strong>Business:</strong> ${businessName}</p>
          <p><strong>Preferred Contact:</strong> ${preferredContact}</p>
          <p><strong>Phone/WhatsApp:</strong> ${phoneOrWhatsApp}</p>
          <p><strong>Email:</strong> ${email || "Not provided"}</p>
          <p><strong>Source:</strong> ${source}</p>
        `,
      });
      // Send confirmation email to the lead (only if they provided email)
      if (email && String(email).trim()) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM,
          to: email,
          subject: "We received your request",
          html: `
            <p>Hi ${fullName},</p>
            <p>Thanks for contacting <strong>Mohammad AI Solutions</strong>.</p>
            <p>We received your request for <strong>${businessName}</strong>.</p>
            <p>We will contact you shortly.</p>
            <p>Best regards,<br>Mohammad AI Solutions</p>
          `,
        });
      }
      console.log("Resend result:", JSON.stringify(emailResult));
    } catch (err) {
      emailError = err?.message || String(err);
      console.error("Resend error:", emailError);
    }

    // ---------- 2) Log to Google Sheets ----------
    let sheetsStatus = null;
    let sheetsBody = null;
    let sheetsError = null;

    try {
      const gsheetUrl =
        process.env.GSHEET_WEBAPP_URL || process.env.GOOGLE_SHEETS_WEBAPP_URL || "";

      if (!gsheetUrl) throw new Error("Missing GSHEET_WEBAPP_URL / GOOGLE_SHEETS_WEBAPP_URL");
      if (!process.env.LEAD_TOKEN) throw new Error("Missing LEAD_TOKEN");

      const sheetPayload = {
        leadToken: process.env.LEAD_TOKEN,
        fullName,
        preferredContact,
        phoneOrWhatsapp: phoneOrWhatsApp,
        businessName,
        email: email || "",
        source,
        timestamp: new Date().toISOString(),
      };

      console.log("Sending to Sheets:", JSON.stringify(sheetPayload));

      const res = await fetch(gsheetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sheetPayload),
      });

      sheetsStatus = res.status;

      const text = await res.text();
      try {
        sheetsBody = JSON.parse(text);
      } catch {
        sheetsBody = { raw: text };
      }

      console.log("Google Sheets status:", sheetsStatus);
      console.log("Google Sheets response:", JSON.stringify(sheetsBody));
    } catch (err) {
      sheetsError = err?.message || String(err);
      console.error("Google Sheets error:", sheetsError);
    }

    // ---------- 3) Slack ----------
    const slack = await sendSlackAlert({
      fullName,
      preferredContact,
      phoneOrWhatsApp,
      businessName,
      email,
      source,
    });

    // ---------- Final result ----------
    // Important: do not fail the whole request only because email is delayed.
    const overallOk =
      (!sheetsError && sheetsStatus >= 200 && sheetsStatus < 300) ||
      (!emailError && emailResult);

    return {
      statusCode: overallOk ? 200 : 500,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({
        ok: !!overallOk,
        message: overallOk ? "Lead submitted successfully" : "Lead processing failed",
        email: {
          result: emailResult,
          error: emailError,
        },
        sheets: {
          status: sheetsStatus,
          body: sheetsBody,
          error: sheetsError,
        },
        slack,
      }),
    };
  } catch (error) {
    console.error("Function crash:", error?.message || String(error));

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
