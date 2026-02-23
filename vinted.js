/**
 * Minimal Vinted API client.
 * The `vinted-api` npm package has a bug where it passes the cookie module
 * object as the cookie header value instead of the actual session string.
 * This replaces it with a correct implementation.
 */

const fetch = require('node-fetch');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

// Vinted now uses JWT-based cookies instead of the old session cookie
let cookieJar = null;

function parseCookies(setCookieHeaders) {
  const jar = {};
  for (const header of setCookieHeaders) {
    const [pair] = header.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (value) jar[name] = value; // skip empty values (Vinted sends access_token_web twice, once empty)
  }
  return jar;
}

async function fetchCookie() {
  const res = await fetch('https://www.vinted.fr', {
    headers: { 'user-agent': USER_AGENT },
    redirect: 'follow',
  });

  const setCookieHeaders = res.headers.raw()['set-cookie'] ?? [];
  const parsed = parseCookies(setCookieHeaders);

  if (!parsed['access_token_web']) {
    throw new Error('Could not find access_token_web cookie in Vinted response.');
  }

  cookieJar = parsed;
  console.log('[*] Cookie fetched (access_token_web obtained).');
}

function buildCookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

// opts: { brandId, query, perPage }
async function search({ brandId, query, perPage = 96 } = {}) {
  if (!cookieJar) await fetchCookie();

  const params = new URLSearchParams({
    order: 'newest_first',
    per_page: String(perPage),
  });
  if (brandId) params.set('brand_ids', String(brandId));
  if (query)   params.set('search_text', query);

  const url = `https://www.vinted.fr/api/v2/catalog/items?${params}`;

  const res = await fetch(url, {
    headers: {
      cookie: buildCookieHeader(cookieJar),
      'user-agent': USER_AGENT,
      accept: 'application/json, text/plain, */*',
      'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  const data = await res.json();

  // If the session expired, refresh and retry once
  if (data.code === 100 || data.message_code === 'invalid_authentication_token') {
    console.log('[*] Session expired — refreshing cookie...');
    cookieJar = null;
    await fetchCookie();
    return search({ brandId, query, perPage });
  }

  return data.items ?? [];
}

module.exports = { search, fetchCookie };
