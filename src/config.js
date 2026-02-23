// ── Search queries ────────────────────────────────────────────────────────────
// Each query is run against Vinted and results are filtered client-side.
// Add new queries here as needed (e.g. "Brut Rework").
const QUERIES = ['Brut Archives', 'Brut Paris', 'Brut Clothing', 'BRUT'];

// ── Filter ────────────────────────────────────────────────────────────────────

// Phrases that, if found anywhere in the title (any capitalisation), are a
// high-confidence match — no extra cross-check needed.
const HIGH_CONFIDENCE_PHRASES = ['brut archives', 'brut paris', 'brut clothing'];

// Brand titles registered on Vinted that correspond to the Brut clothing label.
const BRUT_BRANDS = new Set(['brut', 'brut clothing']);

// Keywords that indicate the item is clearly NOT clothing.
// Applied only when matching via the brand cross-check (not phrase matches).
const NON_CLOTHING_KEYWORDS = [
  'pendentif', 'bougeoir', 'déodorant', 'deodorant', 'désodorisant',
  'desodorizante', 'after shave', 'aftershave', 'eau de toilette',
  'parfum', 'cologne', 'savon', 'spray', 'champagne', 'présentoir',
  'presentoir', 'opale', 'diamant', 'cuarzo', 'meuble', 'speaker',
  'lampe', 'bougie', 'chandelle', 'bois brut', 'coeur en brut',
];

function isNonClothing(title) {
  return NON_CLOTHING_KEYWORDS.some((kw) => title.includes(kw));
}

function isBrutItem(item) {
  const title = (item.title ?? '').toLowerCase();
  const brand = (item.brand_title ?? '').toLowerCase();

  // High-confidence: phrase found in title (covers all capitalisations)
  if (HIGH_CONFIDENCE_PHRASES.some((phrase) => title.includes(phrase))) return true;

  // Cross-check: title says "brut" + brand is Brut/Brut Clothing + not obviously non-clothing
  if (title.includes('brut') && BRUT_BRANDS.has(brand) && !isNonClothing(title)) return true;

  return false;
}

// ── Polling ───────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MINUTES = parseInt(process.env.POLL_INTERVAL_MINUTES || '5', 10);

// Pages to fetch per query during normal polling (2 × 96 = 192 items per query).
// Increase for broader coverage at the cost of more API calls.
const POLL_PAGES = parseInt(process.env.POLL_PAGES || '2', 10);

module.exports = { QUERIES, isBrutItem, POLL_INTERVAL_MINUTES, POLL_PAGES };
