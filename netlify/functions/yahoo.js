export async function handler(event, context) {
  try {
    // Build the upstream path after the function name (works with rawUrl or path)
    const rawPath = event.rawUrl ? new URL(event.rawUrl).pathname : event.path || "";
    const pathAfterFn = rawPath.replace(/^.*\/(yahoo)(\/)?/i, "").replace(/^\//, "");

    const qs = new URLSearchParams(event.queryStringParameters || {});
    const upstreamUrl = `https://query1.finance.yahoo.com/${pathAfterFn}${qs.toString() ? `?${qs.toString()}` : ""}`;

    const upstreamRes = await fetch(upstreamUrl, {
      // Send browser-like headers to reduce likelihood of being blocked by Yahoo
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://finance.yahoo.com/",
      },
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