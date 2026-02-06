try {
  const email = await resend.emails.send({
    from: "from: "Mohammad AI <hello@mohammadaisolutions.com>",
    to: ["hello@mohammadaisolutions.com"],
    cc: ["tauhid27@gmail.com"],
    subject: "🔥 New Lead Test",
    html: `
      <h2>New Lead</h2>
      <pre>${JSON.stringify(data, null, 2)}</pre>
    `,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, email }),
  };
} catch (err) {
  console.error("Resend error:", err);

  return {
    statusCode: 500,
    body: JSON.stringify({
      ok: false,
      message: err.message,
    }),
  };
}

