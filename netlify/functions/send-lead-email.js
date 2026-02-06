const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  try {
    // CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };

    // Preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    // Only allow POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: "Method Not Allowed" }),
      };
    }

    // Parse body
    const data = JSON.parse(event.body || "{}");

    const {
      fullName,
      email,
      phone,
      preferredContact,
      businessName,
      industry,
      hasWebsite,
      monthlyVisitorsOrLeads,
      serviceInterest,
      budget,
      timeline,
      notes,
    } = data;

    // Basic validation
    if (!fullName && !email && !phone) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: false,
          error: "Missing lead info (need at least name/email/phone).",
        }),
      };
    }

    const subject = `New Lead: ${fullName || "Website Visitor"} (${serviceInterest || "Inquiry"})`;

    const html = `
      <h2>New Lead</h2>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr><td><b>Name</b></td><td>${escapeHtml(fullName)}</td></tr>
        <tr><td><b>Email</b></td><td>${escapeHtml(email)}</td></tr>
        <tr><td><b>Phone</b></td><td>${escapeHtml(phone)}</td></tr>
        <tr><td><b>Preferred Contact</b></td><td>${escapeHtml(preferredContact)}</td></tr>
        <tr><td><b>Business</b></td><td>${escapeHtml(businessName)}</td></tr>
        <tr><td><b>Industry</b></td><td>${escapeHtml(industry)}</td></tr>
        <tr><td><b>Has Website</b></td><td>${escapeHtml(hasWebsite)}</td></tr>
        <tr><td><b>Monthly Visitors/Leads</b></td><td>${escapeHtml(monthlyVisitorsOrLeads)}</td></tr>
        <tr><td><b>Service Interest</b></td><td>${escapeHtml(serviceInterest)}</td></tr>
        <tr><td><b>Budget</b></td><td>${escapeHtml(budget)}</td></tr>
        <tr><td><b>Timeline</b></td><td>${escapeHtml(timeline)}</td></tr>
        <tr><td><b>Notes</b></td><td>${escapeHtml(notes)}</td></tr>
      </table>
    `;

    const fromEmail = process.env.EMAIL_FROM;
    const toEmail = process.env.EMAIL_TO;

    if (!fromEmail || !toEmail) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: "Missing EMAIL_FROM or EMAIL_TO env vars." }),
      };
    }

    // Send
    const result = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject,
      html,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, result }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};

function escapeHtml(v) {
  if (v === undefined || v === null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
