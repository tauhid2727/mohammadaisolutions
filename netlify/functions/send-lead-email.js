const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "Content-Type, x-lead-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});

exports.handler = async (event) => {
  const allowOrigin =
    event.headers?.origin ||
    event.headers?.Origin ||
    "*";

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(allowOrigin), body: "" };
  }

  // Only POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({ success: false, message: "Method not allowed" }),
    };
  }

  // ✅ Token check (recommended)
  const token = event.headers?.["x-lead-token"] || event.headers?.["X-Lead-Token"];
  if (process.env.LEAD_TOKEN && token !== process.env.LEAD_TOKEN) {
    return {
      statusCode: 401,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({ success: false, message: "Unauthorized" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    // Normalize keys
    const fullName = body.fullName || body.FullName || body.name || "";
    const preferredContact = body.preferredContact || body.contactMethod || "";
    const phoneOrWhatsApp = body.phoneOrWhatsApp || body.phone || body.whatsapp || "";
    const businessName = body.businessName || body.business || "";
    const email = body.email || "";

    // Required fields
    if (!fullName || !businessName) {
      return {
        statusCode: 400,
        headers: corsHeaders(allowOrigin),
        body: JSON.stringify({
          success: false,
          message: "Missing required fields",
          required: ["fullName", "businessName"],
        }),
      };
    }

    // Send via Resend
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM, // e.g. "Mohammad AI Solutions <hello@mohammadaisolutions.com>"
      to: process.env.EMAIL_TO,     // e.g. "tauhid27@gmail.com"
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

    return {
      statusCode: 200,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({
        success: true,
        message: "Lead submitted successfully",
        result,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({
        success: false,
        message: error?.message || "Server error",
      }),
    };
  }
};
