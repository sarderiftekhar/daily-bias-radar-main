export async function handler(event, context) {
  try {
    const params = new URLSearchParams(event.queryStringParameters || {});

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Missing API_KEY in environment." }),
      };
    }

    // Ensure API key is appended server-side
    params.set("apikey", apiKey);
    const upstreamUrl = `https://www.alphavantage.co/query?${params.toString()}`;

    const upstreamRes = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const body = await upstreamRes.text();
    const contentType = upstreamRes.headers.get("content-type") || "application/json";

    return {
      statusCode: upstreamRes.status,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
      body,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Proxy error (alphavantage)", details: String(err) }),
    };
  }
}