// netlify/functions/send-lead-email.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Optional shared CORS headers (safe even if you don't need CORS)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, x-lead-token, Authorization, X-Requested-With",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const handler = async (event) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    // Only allow POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: "Method not allowed" }),
      };
    }

    // (Optional) Simple token gate (matches what you send from Flowise)
    // Set LEAD_TOKEN in Netlify env vars to the same value as your x-lead-token header.
    const requiredToken = process.env.LEAD_TOKEN;
    if (requiredToken) {
      const gotToken =
        event.headers?.["x-lead-token"] || event.headers?.["X-Lead-Token"];
      if (gotToken !== requiredToken) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ ok: false, error: "Unauthorized" }),
        };
      }
    }

    // Parse body safely
    const data = event.body ? JSON.parse(event.body) : {};

    // ✅ Normalize keys (accept common variants Flowise/LLM might send)
    const fullName = (data.fullName || data.name || data.full_name || "").trim();

    const preferredContact = (
      data.preferredContact ||
      data.contactMethod ||
      data.preferred_contact ||
      ""
    ).trim();

    const phoneOrWhatsapp = (
      data.phoneOrWhatsapp || // expected
      data.phoneOrWhatsApp || // common (capital A)
      data.phone || // common
      data.phoneNumber ||
      data.phone_number ||
      data.whatsapp ||
      data.whatsApp ||
      ""
    ).trim();

    const email = (data.email || data.emailAddress || data.email_address || "")
      .toString()
      .trim();

    const businessName = (
      data.businessName ||
      data.company ||
      data.companyName ||
      data.business ||
      ""
    ).trim();

    // Basic validation (only the required ones)
    if (!fullName || !preferredContact || !phoneOrWhatsapp || !businessName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: false,
          error: "Missing required fields",
          missing: {
            fullName: !fullName,
            preferredContact: !preferredContact,
            phoneOrWhatsapp: !phoneOrWhatsapp,
            businessName: !businessName,
          },
          receivedKeys: Object.keys(data || {}),
        }),
      };
    }

    // Send email via Resend
    const result = await resend.emails.send({
      from: "Mohammad AI Solutions <hello@mohammadaisolutions.com>",
      to: ["hello@mohammadaisolutions.com"], // array is safest
      subject: "🔥 New Website Lead",
      html: `
        <h2>New Lead Received</h2>
        <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
        <p><strong>Business:</strong> ${escapeHtml(businessName)}</p>
        <p><strong>Preferred Contact:</strong> ${escapeHtml(preferredContact)}</p>
        <p><strong>Phone/WhatsApp:</strong> ${escapeHtml(phoneOrWhatsapp)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email || "Not provided")}</p>
      `,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, result }),
    };
  } catch (error) {
    console.error("ERROR:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: false,
        error: error?.message || "Unknown error",
      }),
    };
  }
};

// Simple HTML escaping (prevents broken markup if user types < > etc.)
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
