require('dotenv').config();
const { search }     = require('./src/scrapers/vinted');
const { QUERIES, isBrutItem } = require('./src/config');

// Full paginated scan across all queries — for discovery, not the live poller
(async () => {
  const seen = new Set();
  let grandTotal = 0;

  for (const query of QUERIES) {
    console.log(`\n━━━ "${query}" ━━━\n`);
    const { items, totalPages, totalEntries } = await search({ query, perPage: 96, maxPages: Infinity });
    console.log(`Fetched ${items.length} / ${totalEntries} total (${totalPages} pages)\n`);

    const matched = items.filter(isBrutItem).filter((i) => !seen.has(String(i.id)));
    matched.forEach((i) => seen.add(String(i.id)));
    grandTotal += matched.length;

    if (!matched.length) { console.log('  No Brut items found.'); continue; }

    matched.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.title}`);
      console.log(`     Price : ${item.price?.currency_code ?? 'EUR'} ${item.price?.amount ?? '?'}`);
      console.log(`     Brand : ${item.brand_title ?? 'N/A'}`);
      console.log(`     URL   : ${item.url}`);
      console.log();
    });

    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n━━━ Total unique Brut items: ${grandTotal} ━━━`);
})();
