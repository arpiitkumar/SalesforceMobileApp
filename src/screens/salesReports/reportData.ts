/**
 * Sales Reports (DEMO) - deterministic dummy-data engine.
 *
 * Everything is generated on demand from a seed (user id + date), so figures are
 * stable between opens, always relative to today, and need no storage or sync.
 * The current user is always rep #0; six demo colleagues complete the team that
 * the manager view rolls up. All figures are dummy data.
 */
import moment from 'moment';

export type Period = 'today' | 'wtd' | 'mtd';
export type ViewMode = 'salesman' | 'manager';
export type Rep = {id: string; name: string; isMe: boolean; idx: number};
export type Sale = {
  value: number;
  cases: number;
  lines: {sku: string; cases: number; value: number}[];
};
export type Visit = {
  outlet: string;
  outletId: string;
  cls: 'A' | 'B' | 'C';
  time: string;
  status: 'visited' | 'pending' | 'skipped';
  geoOk: boolean;
  reason?: string;
  sale?: Sale;
};
export type DayData = {date: string; assigned: number; visits: Visit[]};

const FMT = 'YYYY-MM-DD';
export const todayStr = () => moment().format(FMT);

// ---------- helpers ----------
const rng = (seedText: string) => {
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

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const inrShort = (n: number) => {
  const v = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (v >= 10000000) return `${s}₹${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `${s}₹${(v / 100000).toFixed(2)}L`;
  if (v >= 1000) return `${s}₹${(v / 1000).toFixed(1)}K`;
  return `${s}₹${Math.round(v)}`;
};
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export const trendPct = (cur: number, prev: number) =>
  prev ? Math.round(((cur - prev) / prev) * 100) : 0;

// ---------- catalogue ----------
export const SKUS = [
  {id: 'PW750', name: 'Premium Whisky 750ml', short: 'Premium Whisky', brand: 'Whisky', price: 17400, premium: true, focus: true, launchDaysAgo: 0},
  {id: 'CW375', name: 'Classic Whisky 375ml', short: 'Classic Whisky', brand: 'Whisky', price: 8400, premium: false, focus: false, launchDaysAgo: 0},
  {id: 'CW180', name: 'Classic Whisky 180ml', short: 'Whisky 180ml', brand: 'Whisky', price: 6600, premium: false, focus: false, launchDaysAgo: 0},
  {id: 'VC750', name: 'Vodka Citrus 750ml', short: 'Vodka Citrus', brand: 'Vodka', price: 11400, premium: false, focus: false, launchDaysAgo: 0},
  {id: 'DR750', name: 'Dark Rum 750ml', short: 'Dark Rum', brand: 'Rum', price: 9600, premium: false, focus: false, launchDaysAgo: 0},
  {id: 'GN750', name: 'London Dry Gin 750ml', short: 'London Dry Gin', brand: 'Gin', price: 13200, premium: true, focus: false, launchDaysAgo: 0},
  {id: 'SB650', name: 'Strong Beer 650ml', short: 'Strong Beer', brand: 'Beer', price: 3600, premium: false, focus: false, launchDaysAgo: 0},
  {id: 'LB500', name: 'Light Beer 500ml', short: 'Light Beer', brand: 'Beer', price: 3000, premium: false, focus: false, launchDaysAgo: 0},
  {id: 'RTD250', name: 'RTD Cocktail 250ml', short: 'RTD Cocktail', brand: 'RTD', price: 3300, premium: false, focus: true, launchDaysAgo: 45},
];
export const skuById = (id: string) => SKUS.find(s => s.id === id)!;
export const BRANDS = ['Whisky', 'Vodka', 'Rum', 'Gin', 'Beer', 'RTD'];

// ---------- team ----------
const NAMES = ['Rohit Verma', 'Anita Sharma', 'Karan Mehta', 'Priya Nair', 'Imran Khan', 'Deepak Joshi'];
// Index 0 is the current user. Each array holds one value per rep.
const COV = [0.92, 0.96, 0.88, 0.72, 0.84, 0.55, 0.8]; // visit probability
const STRIKE = [0.62, 0.7, 0.58, 0.45, 0.66, 0.35, 0.5]; // productive-call probability
const PERF = [1, 1.2, 0.9, 0.7, 1.35, 0.6, 0.85]; // basket size multiplier
const TARGET_FACTOR: (number | null)[] = [1.03, 0.8, 1.15, 1.4, 0.72, 1.1, null];
const COLLECT = [88, 76, 94, 62, 35, 80, 90]; // collections %, rep 4 = outlier
const RANK_MOVE = [2, -1, 0, -2, 3, 1, -1];

const teamCache: Record<string, Rep[]> = {};
export const getTeam = (me: {id: string; name: string}): Rep[] => {
  const key = me.id + '|' + me.name;
  if (!teamCache[key]) {
    teamCache[key] = [
      {id: me.id || 'demo-user', name: me.name || 'Sales Rep', isMe: true, idx: 0},
      ...NAMES.map((n, i) => ({id: 'demo-rep-' + (i + 1), name: n, isMe: false, idx: i + 1})),
    ];
  }
  return teamCache[key];
};

// ---------- calendar ----------
// Demo off-days master: the 2nd of every month is a dry day.
export const isWorkingDay = (date: string) => moment(date).date() !== 2;
export const dateList = (from: moment.Moment, to: moment.Moment) => {
  const out: string[] = [];
  const d = from.clone().startOf('day');
  while (!d.isAfter(to, 'day')) {
    out.push(d.format(FMT));
    d.add(1, 'day');
  }
  return out;
};
export const workingDays = (from: moment.Moment, to: moment.Moment) =>
  dateList(from, to).filter(isWorkingDay).length;

export const monthWorkingInfo = () => {
  const t = moment();
  const start = t.clone().startOf('month');
  const end = t.clone().endOf('month');
  const total = workingDays(start, end);
  const elapsed = workingDays(start, t);
  const remaining = workingDays(t.clone().add(1, 'day'), end);
  return {total, elapsed, remaining, daysInMonth: end.date()};
};

export const rangeFor = (p: Period) => {
  const t = moment();
  if (p === 'today') return {from: t.clone(), to: t.clone()};
  if (p === 'wtd') return {from: t.clone().startOf('isoWeek'), to: t.clone()};
  return {from: t.clone().startOf('month'), to: t.clone()};
};
export const prevRangeFor = (p: Period) => {
  const {from, to} = rangeFor(p);
  if (p === 'today') {
    const y = to.clone().subtract(1, 'day');
    return {from: y, to: y};
  }
  if (p === 'wtd') return {from: from.clone().subtract(7, 'days'), to: to.clone().subtract(7, 'days')};
  const pf = from.clone().subtract(1, 'month').startOf('month');
  const pt = pf.clone().date(Math.min(to.date(), pf.daysInMonth()));
  return {from: pf, to: pt};
};
export const PERIOD_LABEL: Record<Period, string> = {today: 'Today', wtd: 'Week to date', mtd: 'Month to date'};

// ---------- outlets ----------
const PREFIX = ['Royal', 'City', 'Green Valley', 'Sunrise', 'Blue Moon', 'Metro', 'Star', 'Palace', 'Lakeview', 'Heritage', 'Golden', 'Central'];
const SUFFIX = ['Wine Shop', 'Beverage Point', 'Liquor Store', 'Bar & Spirits', 'Wine & Spirits', 'Beer Cafe'];
export type Outlet = {id: string; name: string; cls: 'A' | 'B' | 'C'; dormantDays: number; focus: Record<string, boolean>};
const outletCache: Record<string, Outlet[]> = {};
export const outletsFor = (rep: Rep): Outlet[] => {
  if (!outletCache[rep.id]) {
    const r = rng('outlets|' + rep.id);
    outletCache[rep.id] = Array.from({length: 24}, (_, i) => ({
      id: `${rep.id}-o${i}`,
      name: `${PREFIX[(i * 5 + rep.idx * 3) % 12]} ${SUFFIX[(i + rep.idx) % 6]}`,
      cls: (i % 6 < 1 ? 'A' : i % 6 < 3 ? 'B' : 'C') as 'A' | 'B' | 'C',
      // Outlets 21-23 are outside the active beat rotation (lapsed).
      dormantDays: i >= 21 ? 16 + Math.floor(r() * 24) : 0,
      focus: {PW750: r() < 0.58, RTD250: r() < 0.35},
    }));
  }
  return outletCache[rep.id];
};
const ACTIVE_OUTLETS = 21;
export const lapsedOutlets = (rep: Rep) =>
  outletsFor(rep).filter(o => o.dormantDays > 14).sort((a, b) => b.dormantDays - a.dormantDays);

// ---------- day generation ----------
const REASONS = ['Stock refusal', 'Outlet closed', 'No funds', 'Other'];
const CLASS_MUL = {A: 1.6, B: 1, C: 0.6};
const fmtTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const dayCache: Record<string, DayData> = {};
export const dayData = (rep: Rep, date: string): DayData => {
  const key = rep.id + '|' + date;
  if (dayCache[key]) return dayCache[key];
  if (!isWorkingDay(date)) return (dayCache[key] = {date, assigned: 0, visits: []});

  const r = rng(key);
  const outlets = outletsFor(rep);
  const dayNum = moment(date).dayOfYear();
  const assigned = 7;
  const isToday = date === todayStr();
  const todayVisited = rep.idx === 5 ? 0 : Math.round(assigned * COV[rep.idx] * 0.7);
  const bigDay = rep.idx === 1 && date === moment().subtract(3, 'days').format(FMT);
  const visits: Visit[] = [];
  let bigUsed = false;

  for (let i = 0; i < assigned; i++) {
    const o = outlets[(dayNum * assigned + i) % ACTIVE_OUTLETS];
    const time = fmtTime(9 * 60 + 30 + i * 55);
    let status: Visit['status'];
    if (isToday) status = i < todayVisited ? 'visited' : 'pending';
    else status = r() < COV[rep.idx] + (r() - 0.5) * 0.1 ? 'visited' : 'skipped';

    const v: Visit = {outlet: o.name, outletId: o.id, cls: o.cls, time, status, geoOk: true};
    if (status === 'visited') {
      v.geoOk = r() > 0.07;
      if (r() < STRIKE[rep.idx]) {
        const n = 2 + Math.floor(r() * 3);
        const picks = [...SKUS].sort(() => r() - 0.5).slice(0, n);
        const lines = picks.map(s => {
          let cases = Math.max(1, Math.round((1 + r() * 2.5) * CLASS_MUL[o.cls] * Math.sqrt(PERF[rep.idx])));
          if (bigDay && !bigUsed) cases *= 8;
          return {sku: s.id, cases, value: Math.round(cases * s.price * 0.96)};
        });
        if (bigDay) bigUsed = true;
        v.sale = {
          lines,
          cases: lines.reduce((a, l) => a + l.cases, 0),
          value: lines.reduce((a, l) => a + l.value, 0),
        };
      } else {
        v.reason = REASONS[Math.floor(r() * r() * REASONS.length)];
      }
    }
    visits.push(v);
  }
  return (dayCache[key] = {date, assigned, visits});
};

// ---------- aggregation ----------
export type Stats = {
  assigned: number;
  visited: number;
  totalCalls: number;
  productive: number;
  coverage: number;
  strike: number;
  value: number;
  cases: number;
  orders: number;
  aov: number;
  geoFlags: number;
  maxSale: number;
  sku: Record<string, {cases: number; value: number}>;
  outlet: Record<string, {value: number; cls: string; name: string}>;
  cls: {A: number; B: number; C: number};
};

export const statsFor = (rep: Rep, from: moment.Moment, to: moment.Moment): Stats => {
  const s: Stats = {
    assigned: 0, visited: 0, totalCalls: 0, productive: 0, coverage: 0, strike: 0,
    value: 0, cases: 0, orders: 0, aov: 0, geoFlags: 0, maxSale: 0,
    sku: {}, outlet: {}, cls: {A: 0, B: 0, C: 0},
  };
  dateList(from, to).forEach(d => {
    const day = dayData(rep, d);
    s.assigned += day.assigned;
    day.visits.forEach(v => {
      if (v.status !== 'visited') return;
      s.visited++;
      s.totalCalls++;
      if (!v.geoOk) s.geoFlags++;
      if (v.sale) {
        s.productive++;
        s.orders++;
        s.value += v.sale.value;
        s.cases += v.sale.cases;
        s.maxSale = Math.max(s.maxSale, v.sale.value);
        s.cls[v.cls] += v.sale.value;
        const o = (s.outlet[v.outletId] = s.outlet[v.outletId] || {value: 0, cls: v.cls, name: v.outlet});
        o.value += v.sale.value;
        v.sale.lines.forEach(l => {
          const k = (s.sku[l.sku] = s.sku[l.sku] || {cases: 0, value: 0});
          k.cases += l.cases;
          k.value += l.value;
        });
      }
    });
  });
  s.coverage = pct(s.visited, s.assigned);
  s.strike = pct(s.productive, s.totalCalls);
  s.aov = s.orders ? Math.round(s.value / s.orders) : 0;
  return s;
};

export const periodStats = (rep: Rep, p: Period) => {
  const {from, to} = rangeFor(p);
  return statsFor(rep, from, to);
};
export const prevPeriodStats = (rep: Rep, p: Period) => {
  const {from, to} = prevRangeFor(p);
  return statsFor(rep, from, to);
};
export const sumStats = (list: Stats[]) => {
  const t = list.reduce(
    (a, s) => ({assigned: a.assigned + s.assigned, visited: a.visited + s.visited, productive: a.productive + s.productive, value: a.value + s.value, cases: a.cases + s.cases, orders: a.orders + s.orders}),
    {assigned: 0, visited: 0, productive: 0, value: 0, cases: 0, orders: 0},
  );
  return {...t, coverage: pct(t.visited, t.assigned), strike: pct(t.productive, t.visited), aov: t.orders ? Math.round(t.value / t.orders) : 0};
};

/** Consecutive recent days (ending yesterday) on which a rep missed the floors. */
export const belowFloorDays = (rep: Rep, covFloor = 80, strikeFloor = 40) => {
  let n = 0;
  for (let i = 1; i <= 5; i++) {
    const d = moment().subtract(i, 'days');
    if (!isWorkingDay(d.format(FMT))) continue;
    const s = statsFor(rep, d, d);
    if (s.coverage < covFloor || s.strike < strikeFloor) n++;
    else break;
  }
  return n;
};

// ---------- targets ----------
export type Target = {value: number; volume: number};
export const targetFor = (rep: Rep): Target | null => {
  const f = TARGET_FACTOR[rep.idx];
  if (f === null) return null;
  const info = monthWorkingInfo();
  const m = periodStats(rep, 'mtd');
  const perDayV = m.value / Math.max(1, info.elapsed);
  const perDayC = m.cases / Math.max(1, info.elapsed);
  return {
    value: Math.round((perDayV * info.total * f) / 10000) * 10000,
    volume: Math.round((perDayC * info.total * f) / 5) * 5,
  };
};

export const paceFor = (achieved: number, target: number) => {
  const info = monthWorkingInfo();
  const avg = achieved / Math.max(1, info.elapsed);
  const projected = achieved + avg * info.remaining;
  const ratio = target ? projected / target : 0;
  const status = ratio >= 1 ? 'On Track' : ratio >= 0.8 ? 'At Risk' : 'Behind';
  const runRate = info.remaining ? Math.max(0, (target - achieved) / info.remaining) : 0;
  return {projected, ratio: Math.round(ratio * 100), status, runRate, info};
};

export const targetHistory = (rep: Rep) => {
  const r = rng('hist|' + rep.id);
  return [3, 2, 1].map(m => ({
    month: moment().subtract(m, 'months').format('MMM'),
    ach: Math.round(80 + r() * 40 + (rep.idx === 3 ? -22 : 0) + (rep.idx === 4 ? 14 : 0)),
  }));
};

export const weekTarget = (target: number) => {
  const info = monthWorkingInfo();
  const t = moment();
  const wk = workingDays(t.clone().startOf('isoWeek'), t.clone().endOf('isoWeek'));
  return Math.round((target * wk) / Math.max(1, info.total));
};

// ---------- SKU extras ----------
export const focusSkuTarget = (rep: Rep, skuId: string) => {
  const m = periodStats(rep, 'mtd');
  const info = monthWorkingInfo();
  const sold = m.sku[skuId]?.cases || 0;
  const f = TARGET_FACTOR[rep.idx] ?? 1;
  return Math.max(6, Math.round(((sold / Math.max(1, info.elapsed)) * info.total * f) / 1) + 1);
};
export const focusPenetration = (rep: Rep, skuId: string) => {
  const o = outletsFor(rep).slice(0, ACTIVE_OUTLETS);
  return pct(o.filter(x => x.focus[skuId]).length, o.length);
};
export const whitespace = (rep: Rep, skuId: string) =>
  outletsFor(rep).slice(0, ACTIVE_OUTLETS).filter(o => !o.focus[skuId]);
export const launchCurve = () => {
  const weeks = Math.ceil(45 / 7);
  const actual = [4, 11, 19, 26, 31, 35, 38];
  const goal = [8, 16, 25, 33, 42, 50, 58];
  return Array.from({length: weeks}, (_, i) => ({week: i + 1, actual: actual[i], goal: goal[i]}));
};

// ---------- leaderboard ----------
export const WEIGHTS = {achievement: 0.4, coverage: 0.2, collections: 0.2, focus: 0.2};
export const POOL = 12000;
export const SLABS = [
  {min: 90, pay: 100},
  {min: 75, pay: 75},
  {min: 60, pay: 50},
  {min: 0, pay: 0},
];
export const slabFor = (points: number) => SLABS.find(s => points >= s.min)!;

export type RepScore = {
  rep: Rep;
  achievement: number;
  coverage: number;
  collections: number;
  focus: number;
  points: number;
  payout: number;
  value: number;
  maxShare: number;
  noTarget: boolean;
  outlier: string[];
  moved: number;
};

export const leaderboard = (team: Rep[], locked: boolean): RepScore[] => {
  const rows = team.map(rep => {
    const m = periodStats(rep, 'mtd');
    const t = targetFor(rep);
    const jitter = locked ? rng('lock|' + rep.id) : () => 0.5;
    const j = () => (locked ? (jitter() - 0.5) * 16 : 0);
    const ach = t ? (m.value / t.value) * 100 + j() : 0;
    const cov = m.coverage + j();
    const col = COLLECT[rep.idx] + j();
    const foc = (focusPenetration(rep, 'PW750') / 60) * 100 + j();
    const cap = (n: number) => Math.max(0, Math.min(100, n));
    const points =
      WEIGHTS.achievement * cap(ach) + WEIGHTS.coverage * cap(cov) + WEIGHTS.collections * cap(col) + WEIGHTS.focus * cap(foc);
    const maxShare = m.value ? m.maxSale / m.value : 0;
    const outlier: string[] = [];
    if (ach >= 90 && col < 50) outlier.push('High order value, low collections');
    if (m.aov && m.maxSale > 5 * m.aov && !locked) outlier.push(`One unusually large sale (${(m.maxSale / m.aov).toFixed(1)}× the average)`);
    return {
      rep,
      achievement: Math.round(ach),
      coverage: Math.round(cov),
      collections: Math.round(col),
      focus: Math.round(foc),
      points: Math.round(points * 10) / 10,
      payout: Math.round((POOL * slabFor(points).pay) / 100),
      value: m.value,
      maxShare,
      noTarget: !t,
      outlier,
      moved: RANK_MOVE[rep.idx],
    };
  });
  return rows.sort((a, b) => b.points - a.points);
};

// ---------- chart series ----------
type Summed = ReturnType<typeof sumStats>;
/** One point per working day for the last `days` calendar days (oldest first). */
export const dailySeries = (reps: Rep[], days: number, pick: (s: Summed) => number) => {
  const out: {date: string; label: string; value: number}[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = moment().subtract(i, 'days');
    const date = d.format(FMT);
    if (!isWorkingDay(date)) continue;
    out.push({date, label: d.format('D MMM'), value: pick(sumStats(reps.map(r => statsFor(r, d, d))))});
  }
  return out;
};

/** Cumulative achieved vs an even pace to target, per working day of this month. */
export const cumulativeSeries = (rep: Rep, kind: 'value' | 'cases', target: number) => {
  const t = moment();
  const days = dateList(t.clone().startOf('month'), t.clone().endOf('month')).filter(isWorkingDay);
  let run = 0;
  const labels: string[] = [];
  const actual: (number | null)[] = [];
  const ideal: number[] = [];
  days.forEach((date, i) => {
    const d = moment(date);
    labels.push(d.format('D MMM'));
    if (!d.isAfter(t, 'day')) {
      const s = statsFor(rep, d, d);
      run += kind === 'value' ? s.value : s.cases;
      actual.push(run);
    } else {
      actual.push(null);
    }
    ideal.push(Math.round((target * (i + 1)) / days.length));
  });
  return {labels, actual, ideal};
};
