import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// -------------------- helpers --------------------
function corsHeaders(origin) {
  const allowOrigin = origin || process.env.ALLOW_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type, x-lead-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function clean(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

// case-insensitive header getter (Netlify headers sometimes vary)
function getHeader(headers, key) {
  if (!headers) return "";
  const target = key.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === target) return headers[k];
  }
  return "";
}

function pickFirst(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const k of keys) {
    // direct match
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const val = clean(obj[k]);
      if (val) return val;
    }
  }

  // also try case-insensitive match
  const lowerMap = {};
  for (const [k, v] of Object.entries(obj)) {
    lowerMap[k.toLowerCase()] = v;
  }
  for (const k of keys) {
    const v = lowerMap[k.toLowerCase()];
    const val = clean(v);
    if (val) return val;
  }

  return "";
}

function normalizeLeadPayload(raw) {
  // Some tools wrap the payload inside { input: {...} } or { data: {...} }
  const root =
    (raw && raw.input && typeof raw.input === "object" && raw.input) ||
    (raw && raw.data && typeof raw.data === "object" && raw.data) ||
    raw ||
    {};

  const fullName = pickFirst(root, [
    "fullName",
    "FullName",
    "name",
    "Name",
    "fullname",
    "customerName",
    "customer_name",
    "full_name",
  ]);

  const businessName = pickFirst(root, [
    "businessName",
    "BusinessName",
    "business",
    "company",
    "companyName",
    "CompanyName",
    "company_name",
    "business_name",
  ]);

  const preferredContact = pickFirst(root, [
    "preferredContact",
    "PreferredContact",
    "contactMethod",
    "contact_method",
    "preferred_contact",
    "preferred",
  ]).toLowerCase();

  // ✅ Accept BOTH spellings + lots of variants
  const phoneOrWhatsapp = pickFirst(root, [
    "phoneOrWhatsapp",
    "phoneOrWhatsApp",
    "PhoneOrWhatsapp",
    "PhoneOrWhatsApp",
    "phone",
    "Phone",
    "phoneNumber",
    "phone_number",
    "mobile",
    "Mobile",
    "whatsapp",
    "WhatsApp",
    "whatsApp",
    "contactNumber",
    "contact_number",
  ]);

  const email = pickFirst(root, [
    "email",
    "Email",
    "emailAddress",
    "EmailAddress",
    "email_address",
  ]);

  return { fullName, businessName, preferredContact, phoneOrWhatsapp, email, receivedKeys: Object.keys(root) };
}

function missingRequiredFields(n) {
  const missing = [];
  if (!n.fullName) missing.push("fullName");
  if (!n.businessName) missing.push("businessName");
  if (!n.preferredContact) missing.push("preferredContact");
  if (!n.phoneOrWhatsapp) missing.push("phoneOrWhatsapp");
  return missing;
}

// -------------------- function --------------------
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
    // ---- token check ----
    const incomingToken = clean(getHeader(event.headers, "x-lead-token"));
    const expectedToken = clean(process.env.LEAD_TOKEN);

    if (expectedToken && incomingToken !== expectedToken) {
      return {
        statusCode: 401,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: false, error: "Unauthorized (bad token)" }),
      };
    }

    // ---- safe parse (your sanity check #1) ----
    let raw = {};
    try {
      raw = event.body ? JSON.parse(event.body) : {};
    } catch (e) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: false, error: "Invalid JSON body" }),
      };
    }

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
          receivedKeys: normalized.receivedKeys,
          normalized,
        }),
      };
    }

    // ---- env vars (matches your Netlify UI names) ----
    const FROM_EMAIL = clean(process.env.EMAIL_FROM) || "Mohammad AI Solutions <hello@mohammadaisolutions.com>";
    const TO_EMAIL = clean(process.env.EMAIL_TO) || "hello@mohammadaisolutions.com";

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: [TO_EMAIL], // ✅ sanity check #2 (array)
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
      body: JSON.stringify({ ok: false, error: error?.message || "Server error" }),
    };
  }
};
