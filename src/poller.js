const fs   = require('fs');
const path = require('path');
const cron = require('node-cron');

const { search }           = require('./scrapers/vinted');
const { sendNotification } = require('./email');
const { QUERIES, isBrutItem, POLL_INTERVAL_MINUTES, POLL_PAGES } = require('./config');

const SEEN_FILE = path.join(__dirname, '..', 'seen.json');

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

// ── Poll ──────────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleTimeString();
}

async function poll() {
  console.log(`[${ts()}] Polling Vinted (${QUERIES.length} queries, ${POLL_PAGES} page(s) each)...`);
  const seen       = loadSeen();
  const newItems   = [];
  const alertedIds = new Set();

  for (const query of QUERIES) {
    let items;
    try {
      ({ items } = await search({ query, perPage: 96, maxPages: POLL_PAGES }));
    } catch (err) {
      console.error(`[${ts()}] "${query}" failed:`, err.message);
      continue;
    }

    const matched = items.filter(isBrutItem);
    const fresh   = matched.filter((item) => {
      const id = String(item.id);
      return !seen.has(id) && !alertedIds.has(id);
    });

    console.log(`[${ts()}] "${query}" → ${items.length} fetched, ${matched.length} matched, ${fresh.length} new`);

    fresh.forEach((item) => alertedIds.add(String(item.id)));
    newItems.push(...fresh);
    items.forEach((item) => seen.add(String(item.id)));

    await new Promise((r) => setTimeout(r, 1500));
  }

  saveSeen(seen);

  if (newItems.length > 0) {
    await sendNotification(newItems, POLL_INTERVAL_MINUTES);
  } else {
    console.log(`[${ts()}] No new Brut items.`);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

function start() {
  console.log(`Vinted Brut Notifier`);
  console.log(`Polling every ${POLL_INTERVAL_MINUTES} min · notifying ${process.env.NOTIFY_EMAIL}\n`);

  poll(); // run immediately on startup
  cron.schedule(`*/${POLL_INTERVAL_MINUTES} * * * *`, poll);
}

module.exports = { start, poll };
