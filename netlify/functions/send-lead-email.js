import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ---- Helpers ----
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

function normalizeLeadPayload(raw) {
  // Accept many variants that tools/LLMs might produce
  const fullName = pickFirst(raw, [
    "fullName",
    "FullName",
    "name",
    "Name",
    "fullname",
    "customerName",
  ]);

  const businessName = pickFirst(raw, [
    "businessName",
    "BusinessName",
    "company",
    "companyName",
    "CompanyName",
    "business",
  ]);

  const preferredContact = pickFirst(raw, [
    "preferredContact",
    "PreferredContact",
    "contactMethod",
    "preferred_contact",
  ]).toLowerCase();

  // IMPORTANT: handle both spellings (Whatsapp vs WhatsApp)
  const phoneOrWhatsapp = pickFirst(raw, [
    "phoneOrWhatsapp",
    "phoneOrWhatsApp",
    "PhoneOrWhatsapp",
    "PhoneOrWhatsApp",
    "phone",
    "Phone",
    "whatsapp",
    "WhatsApp",
    "phoneNumber",
    "mobile",
    "contactNumber",
  ]);

  const email = pickFirst(raw, [
    "email",
    "Email",
    "emailAddress",
    "EmailAddress",
  ]);

  return {
    fullName,
    businessName,
    preferredContact,
    phoneOrWhatsapp,
    email,
  };
}

function missingRequiredFields(normalized) {
  const missing = [];
  if (!normalized.fullName) missing.push("fullName");
  if (!normalized.businessName) missing.push("businessName");
  if (!normalized.preferredContact) missing.push("preferredContact");
  if (!normalized.phoneOrWhatsapp) missing.push("phoneOrWhatsapp");
  return missing;
}

// ---- Netlify Function ----
export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  try {
    // (Recommended) token check
    const incomingToken =
      event.headers?.["x-lead-token"] || event.headers?.["X-Lead-Token"];
    const expectedToken = process.env.LEAD_TOKEN; // set in Netlify env vars

    if (expectedToken && incomingToken !== expectedToken) {
      return {
        statusCode: 401,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: false, error: "Unauthorized (bad token)" }),
      };
    }

    // Safe parse
    const raw = event.body ? JSON.parse(event.body) : {};
    const normalized = normalizeLeadPayload(raw);
    const missing = missingRequiredFields(normalized);

    if (missing.length) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({
          ok: false,
          error: "Missing required fields",
          missing,
          receivedKeys: Object.keys(raw || {}),
          normalized,
        }),
      };
    }

    const FROM_EMAIL =
      process.env.FROM_EMAIL || "Mohammad AI Solutions <hello@mohammadaisolutions.com>";
    const TO_EMAIL = process.env.TO_EMAIL || "hello@mohammadaisolutions.com";

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
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
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, result }),
    };
  } catch (error) {
    console.error("ERROR:", error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: false,
        error: error?.message || "Server error",
      }),
    };
  }
};
