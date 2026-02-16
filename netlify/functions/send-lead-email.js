import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ----------------- Helpers -----------------
function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, x-lead-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function asCleanString(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) {
      const val = asCleanString(obj[k]);
      if (val) return val;
    }
  }
  return "";
}

// Normalize ANY incoming shape to your canonical fields
function normalizeLeadPayload(raw) {
  const fullName = pickFirst(raw, [
    "fullName",
    "FullName",
    "name",
    "Name",
    "customerName",
    "CustomerName",
  ]);

  const businessName = pickFirst(raw, [
    "businessName",
    "BusinessName",
    "company",
    "Company",
    "companyName",
    "CompanyName",
    "business",
  ]);

  const preferredContact = pickFirst(raw, [
    "preferredContact",
    "PreferredContact",
    "contactMethod",
    "ContactMethod",
    "preferred_contact",
  ]).toLowerCase();

  // IMPORTANT: accept BOTH spellings and many variants
  const phoneOrWhatsapp = pickFirst(raw, [
    // the two main ones
    "phoneOrWhatsapp",
    "phoneOrWhatsApp",

    // common casing variants
    "PhoneOrWhatsapp",
    "PhoneOrWhatsApp",

    // other likely keys
    "phone",
    "Phone",
    "phoneNumber",
    "PhoneNumber",
    "mobile",
    "Mobile",
    "whatsapp",
    "WhatsApp",
    "contactNumber",
    "ContactNumber",
  ]);

  const email = pickFirst(raw, [
    "email",
    "Email",
    "emailAddress",
    "EmailAddress",
  ]);

  return { fullName, businessName, preferredContact, phoneOrWhatsapp, email };
}

function missingRequiredFields(n) {
  const missing = [];
  if (!n.fullName) missing.push("fullName");
  if (!n.businessName) missing.push("businessName");
  if (!n.preferredContact) missing.push("preferredContact");
  if (!n.phoneOrWhatsapp) missing.push("phoneOrWhatsapp");
  return missing;
}

function parseRecipients(val) {
  // allow: "a@x.com" or "a@x.com,b@y.com"
  const s = asCleanString(val);
  if (!s) return [];
  return s.split(",").map(x => x.trim()).filter(Boolean);
}

// ----------------- Netlify Function -----------------
export const handler = async (event) => {
  const allowOrigin = process.env.ALLOW_ORIGIN || "*";

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(allowOrigin), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  try {
    // Token check (matches your front-end header: x-lead-token)
    const incomingToken =
      event.headers?.["x-lead-token"] ||
      event.headers?.["X-Lead-Token"] ||
      event.headers?.["x-lead-Token"];

    const expectedToken = process.env.LEAD_TOKEN;

    if (expectedToken && incomingToken !== expectedToken) {
      return {
        statusCode: 401,
        headers: corsHeaders(allowOrigin),
        body: JSON.stringify({ ok: false, error: "Unauthorized (bad token)" }),
      };
    }

    // ✅ Sanity check #1: handle empty body safely
    const raw = event.body ? JSON.parse(event.body) : {};

    const normalized = normalizeLeadPayload(raw);
    const missing = missingRequiredFields(normalized);

    if (missing.length) {
      return {
        statusCode: 400,
        headers: corsHeaders(allowOrigin),
        body: JSON.stringify({
          ok: false,
          error: "Missing required fields",
          missing,
          receivedKeys: Object.keys(raw || {}),
          normalized,
        }),
      };
    }

    // Use YOUR Netlify env vars (you currently have EMAIL_FROM / EMAIL_TO)
    const FROM_EMAIL =
      process.env.EMAIL_FROM ||
      "Mohammad AI Solutions <hello@mohammadaisolutions.com>";

    const toList =
      parseRecipients(process.env.EMAIL_TO) ||
      ["hello@mohammadaisolutions.com"];

    // ✅ Sanity check #2: always send as array
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: toList.length ? toList : ["hello@mohammadaisolutions.com"],
      subject: "🔥 New Website Lead",
      html: `
        <h2>New Lead Received</h2>
        <p><strong>Name:</strong> ${normalized.fullName}</p>
        <p><strong>Business:</strong> ${normalized.businessName}</p>
        <p><strong>Preferred Contact:</strong> ${normalized.preferredContact}</p>
        <p><strong>Phone/WhatsApp:</strong> ${normalized.phoneOrWhatsapp}</p>
        <p><strong>Email:</strong> ${normalized.email || "Not provided"}</p>
      `,
    });

    return {
      statusCode: 200,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({ ok: true, result }),
    };
  } catch (error) {
    console.error("ERROR:", error);
    return {
      statusCode: 500,
      headers: corsHeaders(allowOrigin),
      body: JSON.stringify({ ok: false, error: error?.message || "Server error" }),
    };
  }
};
