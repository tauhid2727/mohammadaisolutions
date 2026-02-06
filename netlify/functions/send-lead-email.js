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
      return {
        statusCode: 405,
        body: "Method Not Allowed",
      };
    }

    const data = JSON.parse(event.body);

    // 🔴 THIS is the missing part in your current setup
    const email = await resend.emails.send({
      from: "onboarding@resend.dev", // SAFE sender
      to: ["tauhid27@gmail.com"],     // change if needed
      subject: "🚀 New Lead – Mohammad AI Solutions",
      html: `
        <h2>New Lead Received</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      `,
    });

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, email }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
