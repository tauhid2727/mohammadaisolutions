export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: "Method Not Allowed"
      };
    }

    const FLOWISE_URL = process.env.FLOWISE_URL;
    const FLOWISE_API_KEY = process.env.FLOWISE_API_KEY;

    if (!FLOWISE_URL) {
      return {
        statusCode: 500,
        body: "FLOWISE_URL is not set"
      };
    }

    const response = await fetch(FLOWISE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(FLOWISE_API_KEY && {
          Authorization: `Bearer ${FLOWISE_API_KEY}`
        })
      },
      body: event.body
    });

    const data = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: data
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
