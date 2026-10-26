/**
 * Retailer Inventory (DEMO) - shared data helpers.
 *
 * Local-only: one JSON blob per retailer in AsyncStorage. The first time a
 * retailer is opened, 13 past visits (spread over ~2 months) are seeded so the
 * Last visit / Last week / This month / Last month filters all have data.
 * Figures are retailer-reported market insight, NOT sales tracking.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';

export type InventoryItem = {
  sku: string;
  asked: number;
  fast: boolean;
  left: number;
};
export type InventoryVisit = {id: string; date: string; items: InventoryItem[]};

export const STORAGE_PREFIX = 'retailer_inventory_demo_v2_';
export const LOW_STOCK_LIMIT = 4;
const MAX_VISITS = 30;

// Demo SKU catalogue (units = bottles / cans).
export const DEMO_SKUS = [
  {sku: 'Premium Whisky 750ml', short: 'Premium Whisky'},
  {sku: 'Classic Whisky 375ml', short: 'Classic Whisky'},
  {sku: 'Classic Whisky 180ml', short: 'Whisky 180ml'},
  {sku: 'Vodka Citrus 750ml', short: 'Vodka Citrus'},
  {sku: 'Dark Rum 750ml', short: 'Dark Rum'},
  {sku: 'London Dry Gin 750ml', short: 'London Dry Gin'},
  {sku: 'Strong Beer 650ml', short: 'Strong Beer'},
  {sku: 'Light Beer 500ml', short: 'Light Beer'},
  {sku: 'RTD Cocktail 250ml', short: 'RTD Cocktail'},
];

export const shortName = (sku: string) =>
  DEMO_SKUS.find(s => s.sku === sku)?.short || sku;

// Small deterministic PRNG so a retailer always gets the same demo history.
const seededRandom = (seedText: string) => {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Days before today for each seeded visit (newest first).
const SEED_DAYS_AGO = [1, 3, 6, 9, 13, 17, 22, 28, 35, 42, 50, 58, 66];
// Per-SKU demand drift per visit (oldest -> newest), giving visible trends.
const SLOPES = [0.04, -0.03, 0, 0.05, -0.04, 0.02, 0, 0.03, -0.02];

const buildDemoHistory = (accountId: string): InventoryVisit[] => {
  const rand = seededRandom(accountId || 'demo');
  const base = DEMO_SKUS.map(() => 6 + Math.floor(rand() * 26));
  return [...SEED_DAYS_AGO].reverse().map((daysAgo, v) => {
    const items: InventoryItem[] = DEMO_SKUS.map((s, i) => {
      const asked = Math.max(
        2,
        Math.round(base[i] * (1 + SLOPES[i] * v) + rand() * 4),
      );
      const left = Math.floor(rand() * Math.min(asked, 14));
      return {sku: s.sku, asked, left, fast: false};
    });
    // The SKU with the lowest left-to-asked ratio is flagged as selling most.
    const fastest = items.reduce((a, b) =>
      b.left / b.asked < a.left / a.asked ? b : a,
    );
    fastest.fast = true;
    const date = moment().subtract(daysAgo, 'days').format('YYYY-MM-DD');
    return {id: `${date}-${v}`, date, items};
  });
};

/** Returns visits sorted oldest -> newest. */
export const loadHistory = async (
  accountId: string,
): Promise<InventoryVisit[]> => {
  const key = STORAGE_PREFIX + accountId;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {
    // fall through and re-seed
  }
  const seeded = buildDemoHistory(accountId);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(seeded));
  } catch (e) {}
  return seeded;
};

/** Adds (or replaces today's) visit and persists. Returns the new history. */
export const addVisit = async (
  accountId: string,
  history: InventoryVisit[],
  items: InventoryItem[],
): Promise<InventoryVisit[]> => {
  const today = moment().format('YYYY-MM-DD');
  const entry: InventoryVisit = {id: `${today}-new`, date: today, items};
  const next = [...history.filter(v => v.date !== today), entry]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_VISITS);
  await AsyncStorage.setItem(STORAGE_PREFIX + accountId, JSON.stringify(next));
  return next;
};

export type RangeKey = 'last' | 'week' | 'month' | 'lastMonth';

export const RANGE_LABELS: {key: RangeKey; label: string}[] = [
  {key: 'last', label: 'Last visit'},
  {key: 'week', label: 'Last week'},
  {key: 'month', label: 'This month'},
  {key: 'lastMonth', label: 'Last month'},
];

/** Visits for a filter, newest first. "Last week" = the last 7 days. */
export const visitsForRange = (
  history: InventoryVisit[],
  range: RangeKey,
): InventoryVisit[] => {
  const desc = [...history].sort((a, b) => b.date.localeCompare(a.date));
  const today = moment();
  switch (range) {
    case 'last':
      return desc.slice(0, 1);
    case 'week': {
      const from = moment().subtract(7, 'days').startOf('day');
      return desc.filter(v => !moment(v.date).isBefore(from));
    }
    case 'month':
      return desc.filter(v => moment(v.date).isSame(today, 'month'));
    case 'lastMonth': {
      const lm = moment().subtract(1, 'month');
      return desc.filter(v => moment(v.date).isSame(lm, 'month'));
    }
  }
};

export const rangeCaption = (range: RangeKey): string => {
  switch (range) {
    case 'last':
      return 'Most recent visit';
    case 'week':
      return `${moment().subtract(7, 'days').format('DD MMM')} - ${moment().format('DD MMM')}`;
    case 'month':
      return moment().format('MMMM YYYY');
    case 'lastMonth':
      return moment().subtract(1, 'month').format('MMMM YYYY');
  }
};

/** Totals for a single visit. */
export const visitTotals = (visit: InventoryVisit) => {
  const asked = visit.items.reduce((a, i) => a + i.asked, 0);
  const left = visit.items.reduce((a, i) => a + i.left, 0);
  const low = visit.items.filter(i => i.left <= LOW_STOCK_LIMIT).length;
  const fast = visit.items.find(i => i.fast);
  return {asked, left, low, top: fast ? shortName(fast.sku) : '-'};
};

/** Consolidated view over several visits (newest first). */
export const consolidate = (visits: InventoryVisit[]) => {
  const perSku = DEMO_SKUS.map(s => {
    const rows = visits
      .map(v => v.items.find(i => i.sku === s.sku))
      .filter((r): r is InventoryItem => !!r);
    const asked = rows.reduce((a, r) => a + r.asked, 0);
    const avgLeft = rows.length
      ? Math.round(rows.reduce((a, r) => a + r.left, 0) / rows.length)
      : 0;
    const soldMost = rows.filter(r => r.fast).length;
    // Trend: newest visit in range vs the average of the older ones.
    let trend = 0;
    if (rows.length > 1) {
      const older = rows.slice(1);
      const avg = older.reduce((a, r) => a + r.asked, 0) / older.length;
      trend = avg ? Math.round(((rows[0].asked - avg) / avg) * 100) : 0;
    }
    return {sku: s.sku, asked, avgLeft, soldMost, trend};
  });

  const totalAsked = perSku.reduce((a, r) => a + r.asked, 0);
  const topRow = [...perSku].sort(
    (a, b) => b.soldMost - a.soldMost || b.asked - a.asked,
  )[0];
  const latest = visits[0];
  const lowStock = latest
    ? latest.items.filter(i => i.left <= LOW_STOCK_LIMIT).length
    : 0;

  return {
    visitCount: visits.length,
    totalAsked,
    top: visits.length && topRow ? shortName(topRow.sku) : '-',
    lowStock,
    perSku: visits.length ? perSku : [],
  };
};
