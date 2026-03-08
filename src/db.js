const fs   = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'items.json');

// ── In-memory store ────────────────────────────────────────────────────────────

let itemsById = {};

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    // Support both old array format and new object format
    if (Array.isArray(raw)) {
      raw.forEach((item) => { itemsById[item.id] = item; });
    } else {
      itemsById = raw;
    }
  } catch {
    itemsById = {};
  }
}

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(itemsById), 'utf8');
}

load();

// ── Public API ─────────────────────────────────────────────────────────────────

function insertItem(item) {
  if (itemsById[item.id]) return { changes: 0 };
  // Normalize to snake_case so the frontend and API always get consistent field names
  itemsById[item.id] = {
    id:        item.id,
    platform:  item.platform,
    title:     item.title,
    price:     item.price     ?? null,
    currency:  item.currency  ?? 'USD',
    image_url: item.imageUrl  ?? null,
    item_url:  item.itemUrl,
    size:      item.size      ?? null,
    condition: item.condition ?? null,
    found_at:  Date.now(),
  };
  save();
  return { changes: 1 };
}

function getItems({ platform, limit = 200 } = {}) {
  let items = Object.values(itemsById);
  if (platform && platform !== 'all') {
    items = items.filter((i) => i.platform === platform);
  }
  items.sort((a, b) => b.found_at - a.found_at);
  return items.slice(0, limit);
}

module.exports = { insertItem, getItems };
