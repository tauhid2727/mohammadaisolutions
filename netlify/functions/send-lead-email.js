const { Resend } = require("resend");

const corsHeaders = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

exports.handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders(), body: "" };
    }

    // Allow POST only
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: corsHeaders(), body: "Method Not Allowed" };
    }

    // Env checks
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.EMAIL_TO; // e.g. hello@mohammadaisolutions.com
    const from = process.env.EMAIL_FROM || "Mohammad AI <onboarding@resend.dev>";
    const cc = process.env.EMAIL_CC || "";
    const bcc = process.env.EMAIL_BCC || "";

    if (!apiKey) {
      return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ ok: false, error: "Missing RESEND_API_KEY" }) };
    }
    if (!to) {
      return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ ok: false, error: "Missing EMAIL_TO" }) };
    }

    const resend = new Resend(apiKey);

    // Parse body safely
    let data = {};
    try {
      data = JSON.parse(event.body || "{}");
    } catch (e) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ ok: false, error: "Invalid JSON body" }) };
    }

    const subject = `🔥 New Lead: ${data.fullName || "Unknown"} (${data.serviceInterest || "Inquiry"})`;

    const emailPayload = {
      from,
      to: [to],
      subject,
      html: `
        <h2>New Lead</h2>
        <p><b>Name:</b> ${data.fullName || ""}</p>
        <p><b>Email:</b> ${data.email || ""}</p>
        <p><b>Phone:</b> ${data.phone || ""}</p>
        <p><b>Preferred Contact:</b> ${data.preferredContact || ""}</p>
        <p><b>Business:</b> ${data.businessName || ""}</p>
        <p><b>Industry:</b> ${data.industry || ""}</p>
        <p><b>Has Website:</b> ${data.hasWebsite || ""}</p>
        <p><b>Monthly Visitors/Leads:</b> ${data.monthlyVisitorsOrLeads || ""}</p>
        <p><b>Service Interest:</b> ${data.serviceInterest || ""}</p>
        <p><b>Budget:</b> ${data.budget || ""}</p>
        <p><b>Timeline:</b> ${data.timeline || ""}</p>
        <p><b>Notes:</b> ${data.notes || ""}</p>
        <hr/>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      `,
    };

    // Optional CC/BCC
    if (cc.trim()) emailPayload.cc = cc.split(",").map(s => s.trim()).filter(Boolean);
    if (bcc.trim()) emailPayload.bcc = bcc.split(",").map(s => s.trim()).filter(Boolean);

    const result = await resend.emails.send(emailPayload);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, result }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: false,
        error: err?.message || "Unknown error",
        stack: err?.stack || "",
      }),
    };
  }
};
