const fetch = require('node-fetch');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

// All three Vinted markets — items are per-domain and don't overlap
const DOMAINS = [
  { host: 'www.vinted.com',   lang: 'en-US,en;q=0.9',               slug: 'com' },
  { host: 'www.vinted.co.uk', lang: 'en-GB,en;q=0.9,en-US;q=0.8',  slug: 'uk'  },
  { host: 'www.vinted.fr',    lang: 'fr-FR,fr;q=0.9,en-US;q=0.8',  slug: 'fr'  },
];

// Vinted brand_title values that correspond to the Brut clothing label
const BRUT_BRANDS = new Set(['brut', 'brut clothing', 'brut archives']);

const NON_CLOTHING_KEYWORDS = [
  'pendentif', 'bougeoir', 'déodorant', 'deodorant', 'désodorisant',
  'desodorizante', 'after shave', 'aftershave', 'eau de toilette',
  'parfum', 'cologne', 'savon', 'spray', 'champagne', 'présentoir',
  'presentoir', 'opale', 'diamant', 'cuarzo', 'meuble', 'speaker',
  'lampe', 'bougie', 'chandelle', 'bois brut', 'coeur en brut',
];

// Per-domain cookie jars
const cookieJars = {};

function parseCookies(setCookieHeaders) {
  const jar = {};
  for (const header of setCookieHeaders) {
    const [pair] = header.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name  = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (value) jar[name] = value;
  }
  return jar;
}

async function fetchCookieForDomain({ host, lang }) {
  const res = await fetch(`https://${host}`, {
    headers: {
      'user-agent':      USER_AGENT,
      accept:            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': lang,
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`${host} homepage returned ${res.status} — likely rate-limited by Cloudflare`);
  }

  const setCookieHeaders = res.headers.raw()['set-cookie'] ?? [];
  const parsed = parseCookies(setCookieHeaders);

  if (!parsed['access_token_web']) {
    throw new Error(`Could not find access_token_web cookie on ${host}`);
  }

  cookieJars[host] = parsed;
  console.log(`[vinted] Cookie fetched for ${host}`);
}

function buildCookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function searchPage(domain, { query, perPage = 96, page = 1 } = {}) {
  const { host, lang } = domain;

  if (!cookieJars[host]) await fetchCookieForDomain(domain);

  const parts = [
    `order=newest_first`,
    `per_page=${perPage}`,
    `page=${page}`,
    `status_ids[]=6`,
  ];
  if (query) parts.push(`search_text=${encodeURIComponent(query)}`);

  const url = `https://${host}/api/v2/catalog/items?${parts.join('&')}`;

  const res = await fetch(url, {
    headers: {
      cookie:            buildCookieHeader(cookieJars[host]),
      'user-agent':      USER_AGENT,
      accept:            'application/json, text/plain, */*',
      'accept-language': lang,
    },
  });

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`${host} returned non-JSON (${res.status}) — likely rate-limited`);
  }

  const data = await res.json();

  // Session expired — refresh and retry once
  if (data.code === 100 || data.message_code === 'invalid_authentication_token') {
    console.log(`[vinted] Session expired on ${host} — refreshing cookie...`);
    cookieJars[host] = null;
    await fetchCookieForDomain(domain);
    return searchPage(domain, { query, perPage, page });
  }

  return {
    items:        data.items ?? [],
    totalPages:   data.pagination?.total_pages ?? 1,
    totalEntries: data.pagination?.total_entries ?? 0,
  };
}

async function searchOneDomain(domain, query) {
  const first    = await searchPage(domain, { query, perPage: 96, page: 1 });
  const allItems = [...first.items];
  const pages    = Math.min(2, first.totalPages);

  for (let page = 2; page <= pages; page++) {
    await new Promise((r) => setTimeout(r, 800));
    const result = await searchPage(domain, { query, perPage: 96, page });
    allItems.push(...result.items);
  }

  return allItems;
}

function isValidItem(item) {
  if (item.is_visible === false) return false;
  const title = (item.title ?? '').toLowerCase();
  const brand = (item.brand_title ?? '').toLowerCase();

  if (NON_CLOTHING_KEYWORDS.some((kw) => title.includes(kw))) return false;

  // "Brut Archives" anywhere in the title — high confidence
  if (title.includes('brut archives')) return true;

  // "BRUT" in the title + brand is a known Brut label — cross-check keeps cologne out
  if (title.includes('brut') && BRUT_BRANDS.has(brand)) return true;

  return false;
}

function normalizeItem(item, domainSlug) { // eslint-disable-line no-unused-vars
  return {
    id:        `vinted:${item.id}`,
    platform:  'vinted',
    title:     item.title ?? '',
    price:     item.price?.amount ?? null,
    currency:  item.price?.currency_code ?? null,
    imageUrl:  item.photo?.url ?? null,
    itemUrl:   item.url,
    size:      item.size_title ?? null,
    condition: null,
  };
}

async function search(query) {
  // Search all three domains in parallel — each has independent inventory
  const results = await Promise.allSettled(
    DOMAINS.map((domain) => searchOneDomain(domain, query))
  );

  const items = [];
  for (let i = 0; i < DOMAINS.length; i++) {
    const { status, value, reason } = results[i];
    if (status === 'rejected') {
      console.warn(`[vinted] ${DOMAINS[i].host} skipped: ${reason.message}`);
      continue;
    }
    for (const item of value) {
      if (isValidItem(item)) items.push(normalizeItem(item, DOMAINS[i].slug));
    }
  }

  return items;
}

module.exports = { search };
