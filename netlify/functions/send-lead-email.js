const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
        body: "",
      };
    }

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const data = JSON.parse(event.body);

    // 🔴 THIS is the critical line — must run
    const email = await resend.emails.send({
      from: "Mohammad AI <onboarding@resend.dev>", // SAFE TEST SENDER
      to: ["hello@mohammadaisolutions.com"],  
      cc: ["tauhid27@gmail.com"],
                // your inbox
      subject: "🔥 New Lead Test",
      html: `
        <h2>New Lead</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      `,
    });

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, email }),
    };

  } catch (err) {
    console.error("RESEND ERROR:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: err.message || err,
      }),
    };
  }
};
