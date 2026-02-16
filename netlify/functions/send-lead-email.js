const token = event.headers["x-lead-token"] || event.headers["X-Lead-Token"];
if (token !== process.env.LEAD_TOKEN) {
  return { statusCode: 401, body: JSON.stringify({ ok:false, error:"Unauthorized" }) };
}
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ ok: false, error: "Method not allowed" }),
      };
    }

    const data = JSON.parse(event.body);

    const {
      fullName,
      preferredContact,
      phoneOrWhatsapp,
      email,
      businessName,
    } = data;

    // Basic validation
    if (!fullName || !preferredContact || !phoneOrWhatsapp || !businessName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Missing required fields" }),
      };
    }

    await resend.emails.send({
      from: "Mohammad AI Solutions <hello@mohammadaisolutions.com>",
      to: "hello@mohammadaisolutions.com",
      subject: "🔥 New Website Lead",
      html: `
        <h2>New Lead Received</h2>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Business:</strong> ${businessName}</p>
        <p><strong>Preferred Contact:</strong> ${preferredContact}</p>
        <p><strong>Phone/WhatsApp:</strong> ${phoneOrWhatsapp}</p>
        <p><strong>Email:</strong> ${email || "Not provided"}</p>
      `,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    console.error("ERROR:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error.message }),
    };
  }
};

