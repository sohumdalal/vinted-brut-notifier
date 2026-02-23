require('dotenv').config();
const { search } = require('./vinted');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MINUTES = parseInt(process.env.POLL_INTERVAL_MINUTES || '5', 10);
const SEEN_FILE = path.join(__dirname, 'seen.json');

// Four search queries cast a wide net across all capitalizations/variants.
// Each result is then filtered client-side before alerting.
const QUERIES = ['Brut Archives', 'Brut Paris', 'Brut Clothing', 'BRUT'];

// Phrases that, if found anywhere in the title, are a high-confidence match
// (case-insensitive, so covers "Brut Archives", "brut archives", "BRUT ARCHIVES", etc.)
const HIGH_CONFIDENCE_PHRASES = ['brut archives', 'brut paris', 'brut clothing'];

// Brands registered on Vinted that correspond to the Brut clothing label
const BRUT_BRANDS = new Set(['brut', 'brut clothing']);

function isBrutItem(item) {
  const title = item.title.toLowerCase();
  const brand = (item.brand_title ?? '').toLowerCase();

  // Phrase match in title — any capitalisation
  if (HIGH_CONFIDENCE_PHRASES.some((phrase) => title.includes(phrase))) return true;

  // "brut" alone is noisy (raw denim, cologne, etc.) — cross-check with brand.
  // "BRUT CLOTHING" is a separately registered Vinted brand, catches more items.
  if (title.includes('brut') && BRUT_BRANDS.has(brand)) return true;

  return false;
}

// ── Persistence ───────────────────────────────────────────────────────────────

function loadSeen() {
  try {
    return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')));
  } catch {
    return new Set();
  }
}

function saveSeen(set) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...set]), 'utf8');
}

// ── Email ─────────────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function buildEmailHtml(newItems) {
  const rows = newItems.map((item) => {
    const price = item.price?.amount ?? '?';
    const imgTag = item.photo?.url
      ? `<img src="${item.photo.url}" width="80" style="border-radius:4px;display:block;" />`
      : '';
    return `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee;vertical-align:top;width:90px;">${imgTag}</td>
        <td style="padding:12px;border-bottom:1px solid #eee;vertical-align:top;">
          <strong style="font-size:15px;">
            <a href="${item.url}" style="color:#111;text-decoration:none;">${item.title}</a>
          </strong><br/>
          <span style="color:#555;font-size:13px;">
            EUR ${price}
            ${item.brand_title ? `&nbsp;·&nbsp; ${item.brand_title}` : ''}
            ${item.size_title ? `&nbsp;·&nbsp; ${item.size_title}` : ''}
          </span><br/>
          <a href="${item.url}"
             style="display:inline-block;margin-top:8px;padding:6px 14px;
                    background:#111;color:#fff;font-size:12px;
                    border-radius:4px;text-decoration:none;">
            View on Vinted
          </a>
        </td>
      </tr>`;
  }).join('');

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;color:#111;">
      <h2 style="border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:0;">
        New Brut Archives listing${newItems.length > 1 ? 's' : ''} on Vinted
      </h2>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="color:#aaa;font-size:11px;margin-top:16px;">
        vinted-brut-notifier · polling every ${POLL_INTERVAL_MINUTES} min
      </p>
    </div>`;
}

async function sendNotification(newItems) {
  await transporter.sendMail({
    from: `"Vinted Notifier" <${process.env.GMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL,
    subject: `[Vinted] ${newItems.length} new Brut Archives listing${newItems.length > 1 ? 's' : ''}`,
    html: buildEmailHtml(newItems),
  });
  console.log(`[${ts()}] Email sent — ${newItems.length} new item(s).`);
}

// ── Polling ───────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleTimeString();
}

async function poll() {
  console.log(`[${ts()}] Polling Vinted (${QUERIES.length} queries)...`);
  const seen = loadSeen();
  const newItems = [];
  const alertedIds = new Set(); // deduplicate across queries within this poll

  for (const query of QUERIES) {
    let items;
    try {
      items = await search({ query, perPage: 96 });
    } catch (err) {
      console.error(`[${ts()}] "${query}" failed:`, err.message);
      continue;
    }

    const matched = items.filter(isBrutItem);
    const fresh = matched.filter((item) => {
      const id = String(item.id);
      return !seen.has(id) && !alertedIds.has(id);
    });

    console.log(`[${ts()}] "${query}" → ${items.length} results, ${matched.length} matched, ${fresh.length} new`);

    fresh.forEach((item) => alertedIds.add(String(item.id)));
    newItems.push(...fresh);

    // Mark all returned results as seen (not just matched) to keep seen.json lean
    items.forEach((item) => seen.add(String(item.id)));

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 1500));
  }

  saveSeen(seen);

  if (newItems.length > 0) {
    await sendNotification(newItems);
  } else {
    console.log(`[${ts()}] No new Brut items found.`);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

console.log(`Vinted Brut Archives Notifier`);
console.log(`Polling every ${POLL_INTERVAL_MINUTES} min · notifying ${process.env.NOTIFY_EMAIL}\n`);

poll();
cron.schedule(`*/${POLL_INTERVAL_MINUTES} * * * *`, poll);
