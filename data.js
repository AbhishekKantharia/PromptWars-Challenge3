/* ============================================================
   CarbonLens — Data Layer & Carbon Emission Factors
   Sources: EPA, DEFRA 2024, IEA World Energy Outlook
   ============================================================ */

'use strict';

/**
 * @fileoverview Centralized data constants, emission factors,
 * storage helpers, and computation utilities for CarbonLens.
 * All emission factors are in kg CO₂e (carbon dioxide equivalent).
 */

/** Emission factors by category and subtype (kg CO₂e per unit) */
const EMISSION_FACTORS = Object.freeze({
  transport: Object.freeze({
    car:    0.21,   // kg CO₂ per km (average petrol car)
    bus:    0.089,  // kg CO₂ per km (public bus)
    train:  0.041,  // kg CO₂ per km (electric rail)
    flight: 0.255,  // kg CO₂ per km (economy class)
    bike:   0,      // zero emissions
    walk:   0       // zero emissions
  }),
  food: Object.freeze({
    beef:       6.61,  // kg CO₂ per meal serving
    chicken:    3.20,
    fish:       2.80,
    vegetarian: 1.70,
    vegan:      0.90
  }),
  energy: Object.freeze({
    electricity: 0.50, // kg CO₂ per kWh (global average grid)
    gas:         2.00, // kg CO₂ per m³ (natural gas)
    heating:     2.52  // kg CO₂ per litre (heating oil)
  }),
  shopping: Object.freeze({
    clothing:    15,   // kg CO₂ per item (lifecycle)
    electronics: 50,
    furniture:   80,
    groceries:   3     // kg CO₂ per bag
  })
});

/** Monthly per-capita CO₂ (kg) by country — derived from World Bank data */
const COUNTRY_AVERAGES = Object.freeze({
  global: 333, us: 1250, uk: 417, in: 167,
  de: 667, au: 1250, ca: 1167, jp: 750, br: 167, cn: 625
});

const COUNTRY_NAMES = Object.freeze({
  global:'Global', us:'United States', uk:'United Kingdom',
  'in':'India', de:'Germany', au:'Australia', ca:'Canada',
  jp:'Japan', br:'Brazil', cn:'China'
});

/** Paris-aligned ideal: ~2 tonnes/yr ≈ 167 kg/month */
const IDEAL_MONTHLY = 167;

const CATEGORY_COLORS = Object.freeze({
  transport: '#3b82f6', food: '#f59e0b',
  energy: '#ef4444', shopping: '#8b5cf6'
});

const CATEGORY_EMOJIS = Object.freeze({
  transport: '🚗', food: '🍽️', energy: '⚡', shopping: '🛍️'
});

const SUBTYPE_EMOJIS = Object.freeze({
  car:'🚗', bus:'🚌', train:'🚆', flight:'✈️', bike:'🚲', walk:'🚶',
  beef:'🥩', chicken:'🍗', fish:'🐟', vegetarian:'🥗', vegan:'🌿',
  electricity:'💡', gas:'🔥', heating:'🌡️',
  clothing:'👕', electronics:'📱', furniture:'🪑', groceries:'🛒'
});

/** Achievement definitions with unlock-check predicates */
const ACHIEVEMENTS = Object.freeze([
  { id:'first_log',     icon:'🌱', title:'First Step',         desc:'Log your first activity',                check: (a) => a.length >= 1 },
  { id:'five_logs',     icon:'📋', title:'Getting Serious',    desc:'Log 5 activities',                       check: (a) => a.length >= 5 },
  { id:'twenty_logs',   icon:'📊', title:'Data Driven',        desc:'Log 20 activities',                      check: (a) => a.length >= 20 },
  { id:'fifty_logs',    icon:'🏆', title:'Carbon Guru',        desc:'Log 50 activities',                      check: (a) => a.length >= 50 },
  { id:'green_commute', icon:'🚲', title:'Green Commuter',     desc:'Log 5 bike or walk trips',               check: (a) => a.filter(x => x.category === 'transport' && (x.subtype === 'bike' || x.subtype === 'walk')).length >= 5 },
  { id:'plant_based',   icon:'🌿', title:'Plant Powered',      desc:'Log 10 vegan or vegetarian meals',       check: (a) => a.filter(x => x.category === 'food' && (x.subtype === 'vegan' || x.subtype === 'vegetarian')).length >= 10 },
  { id:'low_day',       icon:'⬇️', title:'Low Carbon Day',     desc:'Have a day under 2 kg CO₂',              check: (a) => { const days = {}; a.forEach(x => { const d = x.date.slice(0, 10); days[d] = (days[d] || 0) + x.co2; }); return Object.values(days).some(v => v < 2 && v > 0); } },
  { id:'week_streak',   icon:'🔥', title:'Week Warrior',       desc:'Log activities 7 days in a row',         check: (a) => getStreak(a) >= 7 },
  { id:'all_categories',icon:'🌈', title:'Well Rounded',       desc:'Log in all 4 categories',                check: (a) => new Set(a.map(x => x.category)).size >= 4 },
  { id:'carbon_saver',  icon:'💚', title:'Carbon Saver',       desc:'Save 50 kg CO₂ vs country average',      check: (a, p) => { const mo = getMonthTotal(a); const avg = COUNTRY_AVERAGES[p?.country || 'global']; return avg - mo >= 50; } }
]);

/** Personalized insight cards pool */
const INSIGHTS_POOL = Object.freeze([
  { cat:'transport', icon:'🚌', title:'Switch to Public Transit', desc:'Taking the bus instead of driving can reduce your commute emissions by up to 60%.', impact:'high' },
  { cat:'transport', icon:'🚲', title:'Bike Short Trips',         desc:'For trips under 5 km, cycling produces zero emissions and keeps you fit!', impact:'medium' },
  { cat:'transport', icon:'🏠', title:'Work from Home',           desc:'Even 1 day/week working from home can cut your transport emissions by 20%.', impact:'medium' },
  { cat:'transport', icon:'⚡', title:'Consider an EV',            desc:'Electric vehicles produce ~50% fewer lifetime emissions than petrol cars.', impact:'high' },
  { cat:'food',      icon:'🥗', title:'Meatless Mondays',         desc:'Replacing one beef meal per week with a vegetarian option saves ~250 kg CO₂/year.', impact:'high' },
  { cat:'food',      icon:'🥬', title:'Eat Local & Seasonal',     desc:'Locally grown food reduces transport emissions and supports your community.', impact:'medium' },
  { cat:'food',      icon:'🚮', title:'Reduce Food Waste',        desc:'Up to 30% of food is wasted. Plan meals and use leftovers creatively.', impact:'medium' },
  { cat:'energy',    icon:'🌡️', title:'Lower Your Thermostat',    desc:'Reducing heating by 1°C can cut your heating bill and emissions by ~10%.', impact:'medium' },
  { cat:'energy',    icon:'💡', title:'Switch to LEDs',            desc:'LED bulbs use 75% less energy than incandescent bulbs and last 25x longer.', impact:'low' },
  { cat:'energy',    icon:'☀️', title:'Use Renewable Energy',     desc:'Switching to a green energy provider can eliminate most electricity emissions.', impact:'high' },
  { cat:'shopping',  icon:'♻️', title:'Buy Second-Hand',          desc:'Second-hand clothing has ~80% lower carbon footprint than new items.', impact:'medium' },
  { cat:'shopping',  icon:'🔧', title:'Repair, Don\'t Replace',   desc:'Extending a product\'s life by 1 year reduces its footprint by 20-30%.', impact:'medium' }
]);

/* ============================================================
   Storage Helpers — localStorage with error handling
   ============================================================ */

const STORAGE_KEYS = Object.freeze({
  PROFILE: 'cl_profile',
  ACTIVITIES: 'cl_activities'
});

/**
 * Safely loads and parses JSON from localStorage.
 * @param {string} key - The localStorage key.
 * @returns {*} Parsed value or null on failure.
 */
function safeLoadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn(`[CarbonLens] Failed to parse ${key}:`, err);
    return null;
  }
}

function loadProfile() { return safeLoadJSON(STORAGE_KEYS.PROFILE); }
function saveProfile(p) { localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(p)); }
function loadActivities() { return safeLoadJSON(STORAGE_KEYS.ACTIVITIES) || []; }
function saveActivities(a) { localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(a)); }

/* ============================================================
   Computation Helpers
   ============================================================ */

/** @returns {string} Today's date as YYYY-MM-DD */
function todayStr() { return new Date().toISOString().slice(0, 10); }

/** @returns {string} Date N days ago as YYYY-MM-DD */
function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Sum CO₂ for today's activities */
function getTodayTotal(acts) {
  const t = todayStr();
  return acts.filter(a => a.date.slice(0, 10) === t).reduce((s, a) => s + a.co2, 0);
}

/** Sum CO₂ for last 7 days */
function getWeekTotal(acts) {
  const start = dateNDaysAgo(6);
  return acts.filter(a => a.date.slice(0, 10) >= start).reduce((s, a) => s + a.co2, 0);
}

/** Sum CO₂ for current calendar month */
function getMonthTotal(acts) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  return acts.filter(a => a.date.slice(0, 10) >= start).reduce((s, a) => s + a.co2, 0);
}

/** Aggregate totals by category */
function getCategoryTotals(acts) {
  const totals = { transport: 0, food: 0, energy: 0, shopping: 0 };
  acts.forEach(a => { if (totals[a.category] !== undefined) totals[a.category] += a.co2; });
  return totals;
}

/** Get daily totals for the last 7 days */
function getLast7DaysTotals(acts) {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = dateNDaysAgo(i);
    const total = acts.filter(a => a.date.slice(0, 10) === d).reduce((s, a) => s + a.co2, 0);
    const label = new Date(d + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' });
    result.push({ date: d, label, total });
  }
  return result;
}

/** Calculate consecutive-day logging streak ending today */
function getStreak(acts) {
  if (!acts.length) return 0;
  const dates = [...new Set(acts.map(a => a.date.slice(0, 10)))].sort().reverse();
  let streak = 0;
  let expected = todayStr();
  for (const d of dates) {
    if (d === expected) {
      streak++;
      const prev = new Date(expected + 'T00:00:00Z');
      prev.setUTCDate(prev.getUTCDate() - 1);
      expected = prev.toISOString().slice(0, 10);
    } else if (d < expected) {
      break;
    }
  }
  return streak;
}

/** Compute eco-score (0-100) based on monthly emissions vs country average */
function computeEcoScore(acts, profile) {
  const monthly = getMonthTotal(acts);
  const avg = COUNTRY_AVERAGES[profile?.country || 'global'];
  if (monthly === 0 && acts.length === 0) return 72; // default for new users
  const ratio = monthly / avg;
  const score = Math.round(100 - (ratio * 50));
  return Math.max(0, Math.min(100, score));
}

/* ============================================================
   Input Sanitization (XSS protection)
   ============================================================ */

/**
 * Escapes HTML entities to prevent XSS in dynamic content.
 * @param {string} str - Raw string input.
 * @returns {string} Sanitized string safe for innerHTML.
 */
function sanitizeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates numeric input within bounds.
 * @param {number} value - The value to validate.
 * @param {number} min - Minimum allowed.
 * @param {number} max - Maximum allowed.
 * @returns {number|null} Clamped value or null if invalid.
 */
function validateNumericInput(value, min, max) {
  const num = parseFloat(value);
  if (isNaN(num) || num < min || num > max) return null;
  return num;
}
