const { chromium } = require('playwright');

let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome', // uses system Chrome — passes Depop's bot detection
      args: ['--disable-blink-features=AutomationControlled'],
    });
  }
  return browser;
}

// Graceful shutdown
process.on('SIGINT',  async () => { await browser?.close(); process.exit(0); });
process.on('SIGTERM', async () => { await browser?.close(); process.exit(0); });

// Convert URL slug to readable title
// slug: "{seller}-brut-{item-words}-{4char-hex}" → "brut {item words}"
function slugToTitle(slug) {
  const parts = slug.split('-');
  const brutIdx = parts.findIndex((p) => p.toLowerCase() === 'brut');
  if (brutIdx === -1) return slug.replace(/-/g, ' ');

  // Strip trailing 4-char hex hash if present
  const last = parts[parts.length - 1];
  const end = (last.length === 4 && /^[0-9a-f]+$/i.test(last))
    ? parts.length - 1
    : parts.length;

  return parts.slice(brutIdx, end).join(' ');
}

async function search(query) {
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' +
      ' (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    locale:   'en-GB',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  try {
    await page.goto(
      `https://www.depop.com/search/?q=${encodeURIComponent(query)}`,
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    await page.waitForTimeout(3000); // let React render

    const cards = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('li'))
        .filter((li) => li.querySelector('a[href*="/products/"]'));

      return items.map((li) => {
        const a     = li.querySelector('a[href*="/products/"]');
        const imgs  = li.querySelectorAll('img');
        const price = li.querySelector('p[class*="styles_price"]')?.textContent?.trim() ?? null;
        const size  = li.querySelector('p[class*="styles_sizeAttributeText"]')?.textContent?.trim() ?? null;
        return {
          href:   a?.href ?? '',
          imgSrc: imgs[1]?.src ?? imgs[0]?.src ?? null,
          price,
          size,
        };
      }).filter((c) => c.href.includes('/products/'));
    });

    return cards.map((card) => {
      const slug     = card.href.split('/products/')[1]?.replace(/\/$/, '') ?? '';
      const rawPrice = card.price?.replace(/[^0-9.]/g, '') ?? null;
      return {
        id:        `depop:${slug}`,
        platform:  'depop',
        title:     slugToTitle(slug),
        price:     rawPrice,
        currency:  'USD',
        imageUrl:  card.imgSrc,
        itemUrl:   card.href,
        size:      card.size,
        condition: null,
      };
    });

  } finally {
    await context.close();
  }
}

module.exports = { search };
