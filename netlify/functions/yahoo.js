export async function handler(event, context) {
  try {
    // Build the upstream path after the function name (works with rawUrl or path)
    const rawPath = event.rawUrl ? new URL(event.rawUrl).pathname : event.path || "";
    let pathAfterFn = rawPath.replace(/^.*\/(yahoo)(\/)?/i, "").replace(/^\//, "");

    // Extra hardening for manual testing mistakes:
    // - Remove leading encoded spaces like %20 from the path
    // - Trim any actual leading whitespace
    // - If a full URL accidentally gets appended to the path, strip it
    pathAfterFn = pathAfterFn
      .replace(/^%20+/gi, "")
      .replace(/^\s+/, "")
      .replace(/https?:\/\/.*$/i, "");

    const qs = new URLSearchParams(event.queryStringParameters || {});

    // Guard against accidental garbage in query (e.g. someone pasted another URL after a param)
    for (const [k, v] of qs.entries()) {
      if (/https?:\/\//i.test(v)) {
        qs.set(k, v.replace(/https?:\/\/.*$/i, ""));
      }
    }

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
        "x-yproxy-upstream-url": upstreamUrl,
        "x-yproxy-upstream-status": String(upstreamRes.status),
      },
      body,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
        "x-yproxy-error": String(err && err.message ? err.message : err),
      },
      body: JSON.stringify({ error: "Proxy error (yahoo)", details: String(err) }),
    };
  }
}