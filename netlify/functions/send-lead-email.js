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
    const body = JSON.parse(event.body || "{}");

    // Normalize keys
    const fullName = body.fullName || body.FullName || body.name || "";
    const preferredContact = body.preferredContact || body.contactMethod || "";
    const phoneOrWhatsApp = body.phoneOrWhatsApp || body.phone || body.whatsapp || "";
    const businessName = body.businessName || body.business || "";
    const email = body.email || "";

    // Only required
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

    return {
      statusCode: 200,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({
        ok: true,
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
        ok: false,
        success: false,
        message: error?.message || "Server error",
      }),
    };
  }
};
