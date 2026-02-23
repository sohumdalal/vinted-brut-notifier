require('dotenv').config();
const { search } = require('./vinted');

const QUERIES = ['Brut Archives', 'Brut Paris', 'Brut Clothing', 'BRUT'];
const HIGH_CONFIDENCE_PHRASES = ['brut archives', 'brut paris', 'brut clothing'];

const BRUT_BRANDS = new Set(['brut', 'brut clothing']);

function isBrutItem(item) {
  const title = item.title.toLowerCase();
  const brand = (item.brand_title ?? '').toLowerCase();
  if (HIGH_CONFIDENCE_PHRASES.some((phrase) => title.includes(phrase))) return true;
  if (title.includes('brut') && BRUT_BRANDS.has(brand)) return true;
  return false;
}

(async () => {
  const seen = new Set();

  for (const query of QUERIES) {
    console.log(`\n━━━ "${query}" ━━━\n`);
    const items = await search({ query, perPage: 96 });
    const matched = items.filter(isBrutItem).filter((i) => !seen.has(i.id));
    matched.forEach((i) => seen.add(i.id));

    console.log(`${items.length} results → ${matched.length} matched\n`);
    matched.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.title}`);
      console.log(`     Price : EUR ${item.price?.amount ?? '?'}`);
      console.log(`     Brand : ${item.brand_title ?? 'N/A'}`);
      console.log(`     URL   : ${item.url}`);
      console.log();
    });

    await new Promise((r) => setTimeout(r, 1500));
  }
})();
