const fetch = require('node-fetch');

let cachedToken = null;
let tokenExpiry  = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const creds = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`eBay token error: ${data.error_description}`);

  cachedToken = data.access_token;
  tokenExpiry  = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function search(query) {
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    console.log('[ebay] No credentials set — skipping (add EBAY_CLIENT_ID + EBAY_CLIENT_SECRET to .env)');
    return [];
  }

  const token = await getToken();
  const params = new URLSearchParams({
    q:      query,
    limit:  '50',
    filter: 'conditionIds:{1000|1500|2000|2500|3000|4000|5000}', // all used/new conditions
  });

  const res = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,
    {
      headers: {
        Authorization:          `Bearer ${token}`,
        'Content-Type':         'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(`eBay API error: ${data.message ?? res.status}`);

  return (data.itemSummaries ?? []).map((item) => ({
    id:        `ebay:${item.itemId}`,
    platform:  'ebay',
    title:     item.title,
    price:     item.price?.value ?? null,
    currency:  item.price?.currency ?? 'USD',
    imageUrl:  item.thumbnailImages?.[0]?.imageUrl ?? item.image?.imageUrl ?? null,
    itemUrl:   item.itemWebUrl,
    size:      item.localizedAspects?.find((a) => a.name === 'Size')?.value ?? null,
    condition: item.condition ?? null,
    listedAt:  item.itemCreationDate ? new Date(item.itemCreationDate).getTime() : null,
  }));
}

module.exports = { search };
