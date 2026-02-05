import nodemailer from "nodemailer";

export default async (req) => {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("", { status: 200, headers: corsHeaders() });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders()
      });
    }

    const FLOWISE_URL = process.env.FLOWISE_URL;
    const FLOWISE_API_KEY = process.env.FLOWISE_API_KEY;

    const {
      EMAIL_HOST,
      EMAIL_PORT,
      EMAIL_USER,
      EMAIL_PASS,
      EMAIL_TO
    } = process.env;

    if (!FLOWISE_URL || !FLOWISE_API_KEY) {
      return json({ error: "Missing Flowise env vars" }, 500);
    }

    const body = await req.json();
    const { chatflowId, question } = body;

    const target = `${FLOWISE_URL.replace(/\/$/, "")}/api/v1/prediction/${chatflowId}`;

    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FLOWISE_API_KEY}`
      },
      body: JSON.stringify({ question })
    });

    const text = await upstream.text();

    // 🔍 Extract LEAD_JSON safely
    try {
      const match = text.match(/<LEAD_JSON>([\s\S]*?)<\/LEAD_JSON>/);

      if (match) {
        const lead = JSON.parse(match[1]);

        if (lead.leadCaptured === true) {
          await sendLeadEmail({
            EMAIL_HOST,
            EMAIL_PORT,
            EMAIL_USER,
            EMAIL_PASS,
            EMAIL_TO,
            lead
          });
        }
      }
    } catch (emailErr) {
      console.log("Lead email error (non-blocking):", emailErr);
    }

    // 🔁 Always return Flowise response unchanged
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });

  } catch (err) {
    console.log("Function error:", err);
    return json({ error: "Internal error" }, 500);
  }
};

async function sendLeadEmail({
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_TO,
  lead
}) {
  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT),
    secure: Number(EMAIL_PORT) === 465,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });

  const subject = `🔥 New Lead — ${lead.businessName || "Unknown Business"}`;

  const body = `
New lead captured from Mohammad AI Solutions

Name: ${lead.fullName}
Business: ${lead.businessName}
Industry: ${lead.industry}
Preferred Contact: ${lead.preferredContact}
Email: ${lead.email || "N/A"}
Phone: ${lead.phone || "N/A"}
Has Website: ${lead.hasWebsite}
Volume: ${lead.monthlyVisitorsOrLeads}
Service Interest: ${lead.serviceInterest}

Summary:
${lead.summary || "—"}
`;

  await transporter.sendMail({
    from: EMAIL_USER,
    to: EMAIL_TO,
    subject,
    text: body
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}


