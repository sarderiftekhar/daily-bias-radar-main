export async function handler(event, context) {
  try {
    // Path after function name, using rawUrl when available for accuracy
    const rawPath = event.rawUrl ? new URL(event.rawUrl).pathname : event.path;
    const pathAfterFn = rawPath.replace(/^.*\/(yahoo)(\/)?/i, "");

    const qs = new URLSearchParams(event.queryStringParameters || {});
    const upstreamUrl = `https://query1.finance.yahoo.com/${pathAfterFn}?${qs.toString()}`;

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
      body: JSON.stringify({ error: "Proxy error (yahoo)", details: String(err) }),
    };
  }
}