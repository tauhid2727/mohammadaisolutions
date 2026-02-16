import { Resend } from "resend";

/**
 * Netlify Function: send-lead-email
 * - Reads RESEND_API_KEY from Netlify env vars
 * - Validates x-lead-token
 * - Normalizes input keys (Flowise/website may send different names)
 * - Sends lead email via Resend
 */

const resend = new Resend(process.env.RESEND_API_KEY);

// ---- CONFIG ----
const LEAD_TOKEN = process.env.LEAD_TOKEN || "Xlcrick_VeryStrongPassword_12345";
const TO_EMAIL = process.env.LEAD_TO || "hello@mohammadaisolutions.com";
const FROM_EMAIL =
  process.env.LEAD_FROM || "Mohammad AI Solutions <hello@mohammadaisolutions.com>";

// If you want to lock it down, set this to your domains.
// Otherwise, keep "*" during setup/testing.
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";

// ---- HELPERS ----
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, x-lead-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function normalizeBody(raw) {
  // Accept many variants of the same field name (Flowise + user typing differences)
  const fullName = pick(raw, ["fullName", "fullname", "name", "full_name", "customerName"]);
  const preferredContact = pick(raw, [
    "preferredContact",
    "preferred_contact",
    "contactMethod",
    "preferredMethod",
    "contact_method",
  ]);
  const phoneOrWhatsapp = pick(raw, [
    "phoneOrWhatsapp",
    "phone_or_whatsapp",
    "phone",
    "phoneNumber",
    "mobile",
    "whatsapp",
    "whatsApp",
    "whatsappNumber",
  ]);
  const businessName = pick(raw, [
    "businessName",
    "business",
    "company",
    "companyName",
    "business_name",
  ]);
  const email = pick(raw, ["email", "emailAddress", "mail", "e-mail"]);

  return { fullName, preferredContact, phoneOrWhatsapp, businessName, email };
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

// ---- HANDLER ----
export const handler = async (event) => {
  try {
    // Preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders(), body: "" };
    }

    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    // Token check
    const token =
      event.headers?.["x-lead-token"] ||
      event.headers?.["X-Lead-Token"] ||
      event.headers?.["x-lead-token".toLowerCase()];

    if (!token || token !== LEAD_TOKEN) {
      return json(401, { ok: false, error: "Unauthorized (bad or missing x-lead-token)" });
    }

    // Safe parse body
    const raw = event.body ? JSON.parse(event.body) : {};
    const data = normalizeBody(raw);

    const missing = [];
    if (!data.fullName) missing.push("fullName");
    if (!data.preferredContact) missing.push("preferredContact");
    if (!data.phoneOrWhatsapp) missing.push("phoneOrWhatsapp");
    if (!data.businessName) missing.push("businessName");

    if (missing.length) {
      // IMPORTANT: return 400 (not 500) so Flowise knows it's input issue
      return json(400, {
        ok: false,
        error: "Missing required fields",
        missing,
        receivedKeys: Object.keys(raw || {}),
        normalized: data,
      });
    }

    // Send email
    const subject = "🔥 New Website Lead";
    const html = `
      <h2>New Lead Received</h2>
      <p><strong>Name:</strong> ${escapeHtml(data.fullName)}</p>
      <p><strong>Business:</strong> ${escapeHtml(data.businessName)}</p>
      <p><strong>Preferred Contact:</strong> ${escapeHtml(data.preferredContact)}</p>
      <p><strong>Phone/WhatsApp:</strong> ${escapeHtml(data.phoneOrWhatsapp)}</p>
      <p><strong>Email:</strong> ${escapeHtml(data.email || "Not provided")}</p>
      <hr/>
      <p style="font-size:12px;color:#666">
        Source: mohammadaisolutions.com / Flowise lead capture
      </p>
    `;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: [TO_EMAIL], // array is safest
      subject,
      html,
    });

    return json(200, { ok: true, result });
  } catch (error) {
    console.error("send-lead-email ERROR:", error);
    return json(500, { ok: false, error: error?.message || "Unknown error" });
  }
};

// Simple HTML escaping to avoid breaking email HTML
function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
