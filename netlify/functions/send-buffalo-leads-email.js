// netlify/functions/send-buffalo-lead-email.js

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
      text: { type: "plain_text", text: "🚗 New Lead — Buffalo Auto Deals", emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Name:*\n${safe(lead.fullName)}` },
        { type: "mrkdwn", text: `*Vehicle Interest:*\n${safe(lead.vehicleInterest)}` },
        { type: "mrkdwn", text: `*Preferred Contact:*\n${safe(lead.preferredContact)}` },
        { type: "mrkdwn", text: `*Phone:*\n${safe(lead.phone)}` },
        { type: "mrkdwn", text: `*Email:*\n${safe(lead.email)}` },
        { type: "mrkdwn", text: `*Source:*\n${safe(lead.source)}` },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Message / Notes:*\n${safe(lead.message)}`,
      },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: "Lead captured from Buffalo Auto Deals website chatbot." }],
    },
  ];

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "New Buffalo Auto Deals lead received", blocks }),
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

    const payload =
      rawBody && typeof rawBody.body === "object" && rawBody.body !== null
        ? rawBody.body
        : rawBody;

    console.log("Incoming rawBody:", JSON.stringify(rawBody));
    console.log("Parsed payload:", JSON.stringify(payload));

    // ---------- Normalize keys ----------
    const fullName =
      payload.fullName ||
      payload.FullName ||
      payload.name ||
      "";

    const preferredContact =
      payload.preferredContact ||
      payload.contactMethod ||
      "";

    const phone =
      payload.phone ||
      payload.phoneNumber ||
      payload.phoneOrWhatsApp ||
      payload.phoneOrWhatsapp ||
      "";

    const email = payload.email || "";

    const vehicleInterest =
      payload.vehicleInterest ||
      payload.carInterest ||
      payload.inventoryInterest ||
      payload.vehicle ||
      payload.car ||
      "";

    const message =
      payload.message ||
      payload.notes ||
      payload.customerMessage ||
      "";

    const source = payload.source || "Buffalo Auto Deals Website";

    console.log("Normalized lead:", {
      fullName,
      preferredContact,
      phone,
      email,
      vehicleInterest,
      message,
      source,
    });

    // ---------- Validate ----------
    const cleanPhone = String(phone || "").replace(/[^\d+]/g, "");
    const digitCount = cleanPhone.replace(/\D/g, "").length;
    const emailTrimmed = String(email || "").trim();

    const phoneValid = digitCount >= 10 && digitCount <= 15;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);

    if (!fullName || !preferredContact) {
      return {
        statusCode: 400,
        headers: corsHeaders(allowOrigin),
        body: JSON.stringify({
          ok: false,
          error: "Missing required fields",
          required: ["fullName", "preferredContact"],
        }),
      };
    }

    if (preferredContact.toLowerCase() === "phone") {
      if (!phone || !phoneValid) {
        return {
          statusCode: 400,
          headers: corsHeaders(allowOrigin),
          body: JSON.stringify({
            ok: false,
            error: "Invalid phone number. Please enter a valid phone number with 10 to 15 digits.",
          }),
        };
      }
    }

    if (preferredContact.toLowerCase() === "email") {
      if (!emailTrimmed || !emailValid) {
        return {
          statusCode: 400,
          headers: corsHeaders(allowOrigin),
          body: JSON.stringify({
            ok: false,
            error: "Invalid email address. Please enter a valid email.",
          }),
        };
      }
    }

    if (!phoneValid && !emailValid) {
      return {
        statusCode: 400,
        headers: corsHeaders(allowOrigin),
        body: JSON.stringify({
          ok: false,
          error: "At least one valid contact method is required.",
        }),
      };
    }

    // ---------- 1) Send admin email ----------
    let emailResult = null;
    let emailError = null;

    try {
      emailResult = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: "leads.buffaloautodeals@gmail.com",
        subject: `🚗 New Car Lead | ${fullName} | ${phone || email || "No contact info"}`,
        html: `
          <h2>New Buffalo Auto Deals Lead</h2>
          <p><strong>Name:</strong> ${fullName}</p>
          <p><strong>Preferred Contact:</strong> ${preferredContact}</p>
          <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
          <p><strong>Email:</strong> ${email || "Not provided"}</p>
          <p><strong>Vehicle Interest:</strong> ${vehicleInterest || "Not specified"}</p>
          <p><strong>Message / Notes:</strong> ${message || "Not provided"}</p>
          <p><strong>Source:</strong> ${source}</p>
        `,
      });

      // ---------- 2) Optional auto-reply ----------
      if (emailTrimmed) {
        await resend.emails.send({
          from: "onboarding@resend.dev",
          to: emailTrimmed,
          subject: "We received your inquiry",
          html: `
            <p>Hi ${fullName},</p>
            <p>Thanks for contacting <strong>Buffalo Auto Deals</strong>.</p>
            <p>We received your inquiry${vehicleInterest ? ` about <strong>${vehicleInterest}</strong>` : ""}.</p>
            <p>We will contact you shortly.</p>
            <p>Best regards,<br>Buffalo Auto Deals</p>
          `,
        });
      }

      console.log("Resend result:", JSON.stringify(emailResult));
    } catch (err) {
      emailError = err?.message || String(err);
      console.error("Resend error:", emailError);
    }

    // ---------- 3) Slack ----------
    const slack = await sendSlackAlert({
      fullName,
      preferredContact,
      phone,
      email,
      vehicleInterest,
      message,
      source,
    });

    const overallOk = !emailError && emailResult;

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
