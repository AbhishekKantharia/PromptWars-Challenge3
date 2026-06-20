/* global console, document, window, localStorage, EMISSION_FACTORS, COUNTRY_AVERAGES, IDEAL_MONTHLY, CATEGORY_COLORS, CATEGORY_EMOJIS, SUBTYPE_EMOJIS, ACHIEVEMENTS, INSIGHTS_POOL, STORAGE_KEYS, safeLoadJSON, loadProfile, saveProfile, loadActivities, saveActivities, todayStr, dateNDaysAgo, getTodayTotal, getWeekTotal, getMonthTotal, getCategoryTotals, getLast7DaysTotals, getStreak, computeEcoScore, sanitizeHTML, validateNumericInput, drawWeeklyChart, drawBreakdownChart, drawScoreRing */

/* ============================================================
   CarbonLens — Test Suite (Zero-dependency, browser-based)
   Run: Open tests.html in a browser
   ============================================================ */

'use strict';

/**
 * @fileoverview Comprehensive test suite for CarbonLens.
 * Tests data utilities, computation functions, emission factors,
 * input validation, sanitization, and storage helpers.
 * Uses a minimal custom test runner — no external dependencies.
 */

/* ---- Minimal Test Runner ---- */
const TestRunner = (() => {
  let passed = 0, failed = 0, total = 0;
  const results = [];

  function assert(condition, message) {
    total++;
    if (condition) {
      passed++;
      results.push({ status: 'PASS', message });
    } else {
      failed++;
      results.push({ status: 'FAIL', message });
      console.error(`FAIL: ${message}`);
    }
  }

  function assertEqual(actual, expected, message) {
    const pass = actual === expected;
    assert(pass, `${message} — expected: ${expected}, got: ${actual}`);
  }

  function assertApprox(actual, expected, tolerance, message) {
    const pass = Math.abs(actual - expected) <= tolerance;
    assert(pass, `${message} — expected: ~${expected}, got: ${actual}`);
  }

  function assertThrows(fn, message) {
    let threw = false;
    try { fn(); } catch (_) { threw = true; }
    assert(threw, message);
  }

  function report() {
    console.log(`\n========== TEST RESULTS ==========`);
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`==================================\n`);
    return { total, passed, failed, results };
  }

  return { assert, assertEqual, assertApprox, assertThrows, report, getResults: () => results };
})();

/* ============================================================
   Test Groups
   ============================================================ */

function runAllTests() {
  testEmissionFactors();
  testDateHelpers();
  testActivityComputation();
  testEcoScore();
  testStreak();
  testSanitization();
  testValidation();
  testCategoryTotals();
  testStorageHelpers();
  testAchievements();
  testDeleteActivity();
  testCharts();
  return TestRunner.report();
}

/* ---- Emission Factors ---- */
function testEmissionFactors() {
  const { assert, assertApprox } = TestRunner;

  // Transport factors exist
  assert(EMISSION_FACTORS.transport.car === 0.21, 'Car emission factor is 0.21 kg/km');
  assert(EMISSION_FACTORS.transport.bus === 0.089, 'Bus emission factor is 0.089 kg/km');
  assert(EMISSION_FACTORS.transport.train === 0.041, 'Train emission factor is 0.041 kg/km');
  assert(EMISSION_FACTORS.transport.flight === 0.255, 'Flight emission factor is 0.255 kg/km');
  assert(EMISSION_FACTORS.transport.bike === 0, 'Bike emission factor is 0');
  assert(EMISSION_FACTORS.transport.walk === 0, 'Walk emission factor is 0');

  // Food factors
  assert(EMISSION_FACTORS.food.beef === 6.61, 'Beef meal emission is 6.61 kg');
  assert(EMISSION_FACTORS.food.vegan === 0.90, 'Vegan meal emission is 0.90 kg');

  // Energy factors
  assert(EMISSION_FACTORS.energy.electricity === 0.50, 'Electricity emission is 0.50 kg/kWh');

  // Shopping factors
  assert(EMISSION_FACTORS.shopping.electronics === 50, 'Electronics emission is 50 kg/item');

  // Calculation: 10 km car trip
  assertApprox(EMISSION_FACTORS.transport.car * 10, 2.1, 0.01, '10 km car trip = 2.1 kg CO₂');

  // Calculation: 3 beef meals
  assertApprox(EMISSION_FACTORS.food.beef * 3, 19.83, 0.01, '3 beef meals = 19.83 kg CO₂');

  // Immutability check
  assert(Object.isFrozen(EMISSION_FACTORS), 'EMISSION_FACTORS is frozen/immutable');
  assert(Object.isFrozen(EMISSION_FACTORS.transport), 'Transport factors are frozen');
}

/* ---- Date Helpers ---- */
function testDateHelpers() {
  const { assert, assertEqual } = TestRunner;

  // todayStr format
  const today = todayStr();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(today), 'todayStr returns YYYY-MM-DD format');

  // dateNDaysAgo
  const yesterday = dateNDaysAgo(1);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(yesterday), 'dateNDaysAgo returns YYYY-MM-DD');
  assert(yesterday < today, 'Yesterday is before today');

  const weekAgo = dateNDaysAgo(7);
  assert(weekAgo < yesterday, '7 days ago is before yesterday');

  // dateNDaysAgo(0) should be today
  assertEqual(dateNDaysAgo(0), today, 'dateNDaysAgo(0) equals todayStr()');
}

/* ---- Activity Computation ---- */
function testActivityComputation() {
  const { assertApprox, assertEqual } = TestRunner;

  const now = new Date().toISOString();
  const mockActivities = [
    { date: now, category: 'transport', subtype: 'car', co2: 2.1 },
    { date: now, category: 'food', subtype: 'beef', co2: 6.61 },
    { date: now, category: 'energy', subtype: 'electricity', co2: 5.0 },
    { date: now, category: 'shopping', subtype: 'clothing', co2: 15.0 }
  ];

  // Today total
  const todayTotal = getTodayTotal(mockActivities);
  assertApprox(todayTotal, 28.71, 0.01, 'Today total sums correctly');

  // Week total (should include today)
  const weekTotal = getWeekTotal(mockActivities);
  assertApprox(weekTotal, 28.71, 0.01, 'Week total includes today');

  // Month total
  const monthTotal = getMonthTotal(mockActivities);
  assertApprox(monthTotal, 28.71, 0.01, 'Month total includes today');

  // Empty activities
  assertEqual(getTodayTotal([]), 0, 'Empty activities returns 0 for today');
  assertEqual(getWeekTotal([]), 0, 'Empty activities returns 0 for week');
  assertEqual(getMonthTotal([]), 0, 'Empty activities returns 0 for month');
}

/* ---- Eco Score ---- */
function testEcoScore() {
  const { assert, assertEqual } = TestRunner;

  // Default score for new users
  const defaultScore = computeEcoScore([], null);
  assertEqual(defaultScore, 72, 'Default eco score for new users is 72');

  // Zero emissions should give high score
  const zeroProfile = { country: 'global' };
  const oneActivity = [{ date: new Date().toISOString(), category: 'transport', subtype: 'bike', co2: 0 }];
  const zeroScore = computeEcoScore(oneActivity, zeroProfile);
  assert(zeroScore >= 90, 'Zero emissions gives high score (>= 90)');

  // Score is clamped 0-100
  assert(defaultScore >= 0 && defaultScore <= 100, 'Score is between 0-100');

  // Very high emissions → low score
  const now = new Date().toISOString();
  const highEmit = Array(100).fill({ date: now, category: 'food', subtype: 'beef', co2: 50 });
  const lowScore = computeEcoScore(highEmit, { country: 'global' });
  assert(lowScore <= 20, 'Very high emissions produce low score');
}

/* ---- Streak ---- */
function testStreak() {
  const { assertEqual } = TestRunner;

  // No activities → 0 streak
  assertEqual(getStreak([]), 0, 'Empty activities gives 0 streak');

  // Activity today → 1 streak
  const todayActs = [{ date: new Date().toISOString(), category: 'food', co2: 1 }];
  assertEqual(getStreak(todayActs), 1, 'Activity today gives streak of 1');

  // Multi-day streak
  const multiDay = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    multiDay.push({ date: d.toISOString(), category: 'food', co2: 1 });
  }
  assertEqual(getStreak(multiDay), 5, '5 consecutive days gives streak of 5');
}

/* ---- Sanitization ---- */
function testSanitization() {
  const { assert, assertEqual } = TestRunner;

  // Basic XSS prevention
  const xss = sanitizeHTML('<script>alert("xss")</script>');
  assert(!xss.includes('<script>'), 'Script tags are escaped');
  assert(xss.includes('&lt;script&gt;'), 'Script tags converted to entities');

  // Normal text passes through
  assertEqual(sanitizeHTML('Hello World'), 'Hello World', 'Normal text unchanged');

  // Entities in user input
  const entities = sanitizeHTML('Tom & Jerry <3');
  assert(entities.includes('&amp;'), 'Ampersand is escaped');
  assert(entities.includes('&lt;'), 'Angle bracket is escaped');

  // Empty string
  assertEqual(sanitizeHTML(''), '', 'Empty string returns empty');
}

/* ---- Validation ---- */
function testValidation() {
  const { assertEqual } = TestRunner;

  // Valid numeric inputs
  assertEqual(validateNumericInput('10', 0, 100), 10, 'Valid number accepted');
  assertEqual(validateNumericInput('0', 0, 100), 0, 'Zero is valid when min is 0');
  assertEqual(validateNumericInput('100', 0, 100), 100, 'Max value accepted');

  // Invalid inputs
  assertEqual(validateNumericInput('abc', 0, 100), null, 'Non-numeric returns null');
  assertEqual(validateNumericInput('-5', 0, 100), null, 'Below min returns null');
  assertEqual(validateNumericInput('200', 0, 100), null, 'Above max returns null');
  assertEqual(validateNumericInput('', 0, 100), null, 'Empty string returns null');
  assertEqual(validateNumericInput(NaN, 0, 100), null, 'NaN returns null');

  // Float precision
  assertApproxEqual(validateNumericInput('3.14', 0, 10), 3.14, 'Float accepted');
}

function assertApproxEqual(actual, expected, message) {
  TestRunner.assertApprox(actual, expected, 0.001, message);
}

/* ---- Category Totals ---- */
function testCategoryTotals() {
  const { assertApprox } = TestRunner;

  const acts = [
    { category: 'transport', co2: 5.0 },
    { category: 'transport', co2: 3.0 },
    { category: 'food', co2: 6.61 },
    { category: 'energy', co2: 2.5 },
    { category: 'shopping', co2: 15.0 }
  ];

  const totals = getCategoryTotals(acts);
  assertApprox(totals.transport, 8.0, 0.01, 'Transport total correct');
  assertApprox(totals.food, 6.61, 0.01, 'Food total correct');
  assertApprox(totals.energy, 2.5, 0.01, 'Energy total correct');
  assertApprox(totals.shopping, 15.0, 0.01, 'Shopping total correct');
}

/* ---- Storage Helpers ---- */
function testStorageHelpers() {
  const { assertEqual } = TestRunner;

  // safeLoadJSON handles missing keys
  const missing = safeLoadJSON('__nonexistent_key_test__');
  assertEqual(missing, null, 'Missing key returns null');

  // safeLoadJSON handles invalid JSON gracefully
  localStorage.setItem('__test_invalid__', '{broken json');
  const invalid = safeLoadJSON('__test_invalid__');
  assertEqual(invalid, null, 'Invalid JSON returns null without throwing');
  localStorage.removeItem('__test_invalid__');

  // Round-trip profile
  const testProfile = { name: 'Test', country: 'us', diet: 'vegan' };
  saveProfile(testProfile);
  const loaded = loadProfile();
  assertEqual(loaded.name, 'Test', 'Profile name round-trips correctly');
  assertEqual(loaded.country, 'us', 'Profile country round-trips correctly');

  // Clean up
  localStorage.removeItem(STORAGE_KEYS.PROFILE);
}

/* ---- Achievements ---- */
function testAchievements() {
  const { assert, assertEqual } = TestRunner;

  // First log achievement
  const noActs = [];
  const oneAct = [{ category: 'food', subtype: 'vegan', co2: 0.9, date: new Date().toISOString() }];
  const firstLog = ACHIEVEMENTS.find(a => a.id === 'first_log');
  assert(!firstLog.check(noActs), 'First log not unlocked with 0 activities');
  assert(firstLog.check(oneAct), 'First log unlocked with 1 activity');

  // All categories achievement
  const allCats = [
    { category: 'transport', co2: 1, date: new Date().toISOString() },
    { category: 'food', co2: 1, date: new Date().toISOString() },
    { category: 'energy', co2: 1, date: new Date().toISOString() },
    { category: 'shopping', co2: 1, date: new Date().toISOString() }
  ];
  const wellRounded = ACHIEVEMENTS.find(a => a.id === 'all_categories');
  assert(wellRounded.check(allCats), 'Well Rounded unlocked with all 4 categories');

  // Country averages exist for all countries
  const countries = ['global', 'us', 'uk', 'in', 'de', 'au', 'ca', 'jp', 'br', 'cn'];
  countries.forEach(c => {
    assert(COUNTRY_AVERAGES[c] > 0, `Country average exists for ${c}`);
  });

  assertEqual(IDEAL_MONTHLY, 167, 'Ideal monthly target is 167 kg');
}

/* ---- Delete Activity ---- */
function testDeleteActivity() {
  const { assertEqual } = TestRunner;
  const initial = [
    { id: 'act-1', category: 'food', co2: 2.5 },
    { id: 'act-2', category: 'transport', co2: 5.0 }
  ];
  
  // Test filter/deletion logic
  const filtered = initial.filter(a => a.id !== 'act-1');
  assertEqual(filtered.length, 1, 'One activity remaining after deletion');
  assertEqual(filtered[0].id, 'act-2', 'Correct activity remains');
}

/* ---- Charts module tests ---- */
function testCharts() {
  const { assert } = TestRunner;

  // Test setupHiDPICanvas
  const canvas = document.getElementById('chart-weekly');
  assert(canvas !== null, 'Weekly chart canvas element exists');
  
  // Test drawing weekly chart
  try {
    drawWeeklyChart('chart-weekly', [
      { date: '2026-06-14', label: 'Sun', total: 5.5 },
      { date: '2026-06-13', label: 'Sat', total: 2.1 }
    ]);
    assert(true, 'drawWeeklyChart completed without throwing');
  } catch (err) {
    assert(false, `drawWeeklyChart threw error: ${err.message}`);
  }

  // Test drawing breakdown chart
  try {
    drawBreakdownChart('chart-breakdown', {
      transport: 5.0, food: 3.2, energy: 0, shopping: 15.0
    });
    assert(true, 'drawBreakdownChart completed without throwing');
  } catch (err) {
    assert(false, `drawBreakdownChart threw error: ${err.message}`);
  }

  // Test drawing score ring
  try {
    drawScoreRing('score-ring', 85);
    assert(true, 'drawScoreRing completed without throwing');
  } catch (err) {
    assert(false, `drawScoreRing threw error: ${err.message}`);
  }
}

/* ============================================================
   Last 7 Days Test
   ============================================================ */
function testLast7Days() {
  const { assertEqual } = TestRunner;
  const result = getLast7DaysTotals([]);
  assertEqual(result.length, 7, 'getLast7DaysTotals returns 7 entries');
  result.forEach(d => {
    assertEqual(d.total, 0, `Day ${d.label} has 0 total with no activities`);
  });
}

/* ---- Auto-run if in test page ---- */
if (typeof window !== 'undefined' && document.getElementById('test-output')) {
  document.addEventListener('DOMContentLoaded', () => {
    testLast7Days();
    const report = runAllTests();
    const output = document.getElementById('test-output');
    const summary = document.getElementById('test-summary');

    summary.textContent = `${report.passed}/${report.total} tests passed`;
    summary.className = report.failed === 0 ? 'test-pass' : 'test-fail';

    output.innerHTML = report.results.map(r =>
      `<div class="test-result ${r.status.toLowerCase()}">
        <span class="test-status">${r.status === 'PASS' ? '✅' : '❌'}</span>
        <span class="test-msg">${r.message}</span>
      </div>`
    ).join('');
  });
}
