// Cloudflare Pages Function: fetches cached recent prices from Travelpayouts'
// free Data API, keeping the access token secret on the server side instead of
// exposing it in the browser's JavaScript.
//
// Cloudflare auto-detects this file at /functions/get-prices.js and serves it
// at /get-prices (no ".js", no extra path prefix needed).
//
// Setup required before this works:
// 1. Sign up free at travelpayouts.com
// 2. Get your Data API token at travelpayouts.com/developers/api
// 3. In Cloudflare Pages: Settings -> Environment variables -> add
//    TRAVELPAYOUTS_TOKEN with that token as the value. Never put the token
//    directly in this file or in any HTML/JS the browser can see.

export async function onRequestGet(context) {
  const token = context.env.TRAVELPAYOUTS_TOKEN;
  const url = new URL(context.request.url);

  const origin = (url.searchParams.get("origin") || "").toUpperCase();
  const destination = (url.searchParams.get("destination") || "").toUpperCase();
  const currency = (url.searchParams.get("currency") || "USD").toUpperCase();

  const jsonResponse = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (!origin || !destination) {
    return jsonResponse({ success: false, error: "Missing origin or destination" }, 400);
  }

  if (!token) {
    return jsonResponse({ success: false, error: "not_configured" });
  }

  try {
    const apiUrl = `https://api.travelpayouts.com/v1/prices/cheap?origin=${origin}&destination=${destination}&currency=${currency}&token=${token}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!data.success || !data.data || !data.data[destination]) {
      return jsonResponse({ success: false, error: "no_cached_data" });
    }

    const entries = Object.values(data.data[destination]);
    if (!entries.length) {
      return jsonResponse({ success: false, error: "no_cached_data" });
    }

    const cheapest = entries.reduce((min, entry) =>
      !min || entry.price < min.price ? entry : min
    , null);

    return jsonResponse({
      success: true,
      price: cheapest.price,
      currency,
      departure_at: cheapest.departure_at || null,
      return_at: cheapest.return_at || null,
      found_note: "Recent cached price — confirm the exact fare with the provider.",
    });
  } catch (err) {
    return jsonResponse({ success: false, error: "fetch_failed" });
  }
}
