/**
 * Grailed scraper using Grailed's public Algolia search API.
 */

const fetch = require('node-fetch');

const ALGOLIA_APP_ID = 'MNRWEFSS2Q';
const ALGOLIA_API_KEY = 'c89dbaddf15fe70e1941a109bf7c2a3d';
// Listing_by_heat_production is the active index (date_added index returns 0 results)
const ALGOLIA_INDEX = 'Listing_by_heat_production';

const ALGOLIA_URL = `https://${ALGOLIA_APP_ID}.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`;

const CONDITION_MAP = {
  is_new:          'New',
  is_not_worn:     'New / Not Worn',
  is_gently_used:  'Gently Used',
  is_used:         'Used',
  is_worn:         'Worn',
};

function normalizeHit(hit) {
  const imageUrl = hit.cover_photo?.image_url ?? hit.cover_photo?.url ?? null;
  const itemUrl  = `https://www.grailed.com/listings/${hit.id}`;
  const condition = CONDITION_MAP[hit.condition] ?? hit.condition ?? null;

  return {
    id:        `grailed:${hit.id}`,
    platform:  'grailed',
    title:     String(hit.title ?? ''),
    price:     Number(hit.price ?? 0).toFixed(2),
    currency:  'USD',
    imageUrl,
    itemUrl,
    size:      hit.size ?? null,
    condition,
    listedAt:  hit.created_at_i ? hit.created_at_i * 1000 : null,
  };
}

async function search(query) {
  const res = await fetch(ALGOLIA_URL, {
    method: 'POST',
    headers: {
      'x-algolia-application-id': ALGOLIA_APP_ID,
      'x-algolia-api-key': ALGOLIA_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      hitsPerPage: 48,
      filters: 'NOT sold:true',
    }),
  });

  if (!res.ok) {
    throw new Error(`Grailed Algolia API returned ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  const hits = data.hits ?? [];

  const items = hits
    .filter((hit) => hit.sold !== true)
    .filter((hit) => {
      // Algolia fuzzy-matches loosely — keep only genuine Brut items
      const designer = (hit.designer_names ?? '').toLowerCase();
      const title    = (hit.title ?? '').toLowerCase();
      return designer.includes('brut') || title.includes('brut');
    })
    .map(normalizeHit);

  return items;
}

module.exports = { search };
