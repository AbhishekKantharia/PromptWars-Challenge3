/* ============================================================
   CarbonLens — Main Application Logic
   ============================================================ */

/**
 * @fileoverview Core application controller for CarbonLens.
 * Handles navigation, onboarding, activity logging, dashboard
 * refresh, insights generation, achievements, and data export.
 * Uses IIFE pattern to avoid global namespace pollution.
 */

(function () {
  'use strict';

  /* ---- State ---- */
  let profile = loadProfile();
  let activities = loadActivities();

  /* ============================================================
     Initialization
     ============================================================ */
  function init() {
    if (!profile) {
      document.getElementById('onboarding-modal').classList.add('visible');
      // Trap focus inside modal for accessibility
      trapFocusInModal('onboarding-modal');
    } else {
      document.getElementById('onboarding-modal').classList.remove('visible');
      updateGreeting();
      refreshAll();
    }
    setupNav();
    setupOnboarding();
    setupLogForms();
    setupDataExport();
    setupKeyboardShortcuts();
    setDateBadge();
  }

  /* ============================================================
     Focus Trap for Modal (Accessibility)
     ============================================================ */
  function trapFocusInModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const focusable = modal.querySelectorAll(
      'input, select, button, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();
    modal.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ============================================================
     Navigation — Tab-based section switching
     ============================================================ */
  function setupNav() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => switchSection(btn.dataset.section));
    });

    // Keyboard arrow navigation between tabs
    const tabList = document.querySelector('.nav-links');
    if (tabList) {
      tabList.addEventListener('keydown', (e) => {
        const tabs = Array.from(navBtns);
        const currentIndex = tabs.indexOf(document.activeElement);
        let newIndex = -1;
        if (e.key === 'ArrowRight') newIndex = (currentIndex + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        if (newIndex >= 0) {
          e.preventDefault();
          tabs[newIndex].focus();
          tabs[newIndex].click();
        }
      });
    }

    // Category tabs in Log section
    document.querySelectorAll('.cat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cat-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
          t.setAttribute('tabindex', '-1');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        tab.setAttribute('tabindex', '0');
        document.querySelectorAll('.log-form').forEach(f => f.classList.remove('active'));
        document.getElementById('form-' + tab.dataset.cat).classList.add('active');
      });
    });
  }

  function switchSection(section) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
      b.setAttribute('tabindex', '-1');
    });
    const activeBtn = document.querySelector(`.nav-btn[data-section="${section}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.setAttribute('aria-selected', 'true');
      activeBtn.setAttribute('tabindex', '0');
    }

    // Switch pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('section-' + section);
    if (target) target.classList.add('active');

    // Lazy-refresh section data
    if (section === 'insights') refreshInsights();
    if (section === 'achievements') refreshAchievements();
    if (section === 'dashboard') refreshAll();
  }

  /* ============================================================
     Onboarding
     ============================================================ */
  function setupOnboarding() {
    const form = document.getElementById('onboarding-form');
    const nameInput = document.getElementById('user-name');
    const nameError = document.getElementById('name-error');

    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = nameInput.value.trim();

      // Input validation
      if (!name || name.length < 1 || name.length > 50) {
        nameError.textContent = 'Please enter a valid name (1-50 characters).';
        nameInput.setAttribute('aria-invalid', 'true');
        nameInput.focus();
        return;
      }

      // Sanitize input
      const sanitizedName = sanitizeHTML(name);

      profile = {
        name: sanitizedName,
        country: document.getElementById('user-country').value,
        diet: document.querySelector('input[name="diet"]:checked').value,
        joinDate: todayStr()
      };
      saveProfile(profile);
      document.getElementById('onboarding-modal').classList.remove('visible');
      updateGreeting();
      refreshAll();
      showToast(`Welcome, ${sanitizedName}! 🌱 Let's start tracking.`);
    });

    // Clear error on input
    nameInput.addEventListener('input', () => {
      nameError.textContent = '';
      nameInput.removeAttribute('aria-invalid');
    });
  }

  /* ============================================================
     Greeting & Date
     ============================================================ */
  function updateGreeting() {
    const h = new Date().getHours();
    let greet = 'Good morning';
    if (h >= 12 && h < 17) greet = 'Good afternoon';
    else if (h >= 17) greet = 'Good evening';
    const el = document.getElementById('greeting');
    if (el) el.textContent = `${greet}, ${profile?.name || 'User'}!`;
  }

  function setDateBadge() {
    const el = document.getElementById('date-badge');
    if (el) {
      el.textContent = new Date().toLocaleDateString('en', {
        weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
      });
    }
  }

  /* ============================================================
     Log Forms — Input, Preview, and Submission
     ============================================================ */
  function setupLogForms() {
    // Live emission estimation previews
    setupPreview('transport', () => {
      const type = document.querySelector('input[name="transport-type"]:checked')?.value || 'car';
      const dist = parseFloat(document.getElementById('transport-dist').value) || 0;
      return (EMISSION_FACTORS.transport[type] || 0) * dist;
    });
    setupPreview('food', () => {
      const type = document.querySelector('input[name="food-type"]:checked')?.value || 'beef';
      const srv = parseInt(document.getElementById('food-servings').value, 10) || 1;
      return (EMISSION_FACTORS.food[type] || 0) * srv;
    });
    setupPreview('energy', () => {
      const type = document.querySelector('input[name="energy-type"]:checked')?.value || 'electricity';
      const amt = parseFloat(document.getElementById('energy-amount').value) || 0;
      return (EMISSION_FACTORS.energy[type] || 0) * amt;
    });
    setupPreview('shopping', () => {
      const type = document.querySelector('input[name="shopping-type"]:checked')?.value || 'clothing';
      const qty = parseInt(document.getElementById('shopping-qty').value, 10) || 1;
      return (EMISSION_FACTORS.shopping[type] || 0) * qty;
    });

    // Log buttons
    document.getElementById('btn-log-transport').addEventListener('click', () => {
      const type = document.querySelector('input[name="transport-type"]:checked')?.value;
      const dist = validateNumericInput(document.getElementById('transport-dist').value, 0, 50000);
      if (dist === null) { showToast('Please enter a valid distance.'); return; }
      const co2 = (EMISSION_FACTORS.transport[type] || 0) * dist;
      addActivity('transport', type, co2, `${dist} km by ${type}`);
      document.getElementById('transport-dist').value = '';
      updatePreview('transport', 0);
    });

    document.getElementById('btn-log-food').addEventListener('click', () => {
      const type = document.querySelector('input[name="food-type"]:checked')?.value;
      const srv = validateNumericInput(document.getElementById('food-servings').value, 1, 100) || 1;
      const co2 = (EMISSION_FACTORS.food[type] || 0) * srv;
      addActivity('food', type, co2, `${srv} ${type} meal(s)`);
      document.getElementById('food-servings').value = '1';
      updatePreview('food', EMISSION_FACTORS.food[type]);
    });

    document.getElementById('btn-log-energy').addEventListener('click', () => {
      const type = document.querySelector('input[name="energy-type"]:checked')?.value;
      const amt = validateNumericInput(document.getElementById('energy-amount').value, 0.1, 100000);
      if (amt === null) { showToast('Please enter a valid amount.'); return; }
      const co2 = (EMISSION_FACTORS.energy[type] || 0) * amt;
      addActivity('energy', type, co2, `${amt} units of ${type}`);
      document.getElementById('energy-amount').value = '';
      updatePreview('energy', 0);
    });

    document.getElementById('btn-log-shopping').addEventListener('click', () => {
      const type = document.querySelector('input[name="shopping-type"]:checked')?.value;
      const qty = validateNumericInput(document.getElementById('shopping-qty').value, 1, 1000) || 1;
      const co2 = (EMISSION_FACTORS.shopping[type] || 0) * qty;
      addActivity('shopping', type, co2, `${qty} ${type} item(s)`);
      document.getElementById('shopping-qty').value = '1';
      updatePreview('shopping', EMISSION_FACTORS.shopping[type]);
    });
  }

  function setupPreview(category, calcFn) {
    const form = document.getElementById('form-' + category);
    if (!form) return;
    form.addEventListener('input', () => updatePreview(category, calcFn()));
    form.addEventListener('change', () => updatePreview(category, calcFn()));
  }

  function updatePreview(category, val) {
    const el = document.getElementById('est-' + category);
    if (el) el.textContent = (val || 0).toFixed(2) + ' kg CO₂';
  }

  /* ============================================================
     Activity Management
     ============================================================ */
  function addActivity(category, subtype, co2, description) {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: new Date().toISOString(),
      category,
      subtype,
      co2: Math.round(co2 * 100) / 100,
      description: sanitizeHTML(description)
    };
    activities.unshift(entry);
    saveActivities(activities);
    showToast(`Logged ${co2.toFixed(2)} kg CO₂ for ${description}`);
    refreshAll();
  }

  /* ============================================================
     Toast Notification
     ============================================================ */
  function showToast(msg) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    if (!toast || !msgEl) return;
    msgEl.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  /* ============================================================
     Dashboard Refresh
     ============================================================ */
  function refreshAll() {
    refreshStats();
    refreshCharts();
    refreshRecentList();
    refreshComparison();
  }

  function refreshStats() {
    animateCounter('val-today', getTodayTotal(activities));
    animateCounter('val-week', getWeekTotal(activities));
    animateCounter('val-month', getMonthTotal(activities));
    const yearEstimate = getMonthTotal(activities) * 12;
    const trees = Math.ceil(yearEstimate / 22); // 1 tree ≈ 22 kg CO₂/yr
    const treesEl = document.getElementById('val-trees');
    if (treesEl) treesEl.textContent = trees;
  }

  /** Smooth counter animation using easing */
  function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseFloat(el.textContent) || 0;
    const duration = 600;
    const startTime = performance.now();
    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = (start + (target - start) * eased).toFixed(1);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function refreshCharts() {
    const weekly = getLast7DaysTotals(activities);
    drawWeeklyChart('chart-weekly', weekly);
    const catTotals = getCategoryTotals(activities);
    drawBreakdownChart('chart-breakdown', catTotals);
  }

  function refreshComparison() {
    const monthly = getMonthTotal(activities);
    const avg = COUNTRY_AVERAGES[profile?.country || 'global'];
    const maxBar = Math.max(monthly, avg, IDEAL_MONTHLY) * 1.1 || 1;

    setBarWidth('comp-you', monthly / maxBar * 100);
    setText('comp-you-val', monthly.toFixed(0) + ' kg');
    setBarWidth('comp-avg', avg / maxBar * 100);
    setText('comp-avg-val', avg + ' kg');
    setBarWidth('comp-target', IDEAL_MONTHLY / maxBar * 100);
    setText('comp-target-val', IDEAL_MONTHLY + ' kg');
  }

  function setBarWidth(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.min(pct, 100) + '%';
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function refreshRecentList() {
    const list = document.getElementById('recent-list');
    if (!list) return;
    const recent = activities.slice(0, 8);
    if (!recent.length) {
      list.innerHTML = '<p class="empty-state" role="status">No activities logged yet. Start by logging your first activity! 🚀</p>';
      return;
    }
    list.innerHTML = recent.map(a => {
      const emoji = SUBTYPE_EMOJIS[a.subtype] || CATEGORY_EMOJIS[a.category] || '📌';
      const timeAgo = getTimeAgo(a.date);
      const catColor = CATEGORY_COLORS[a.category] || '#34d399';
      // Using textContent-safe values — description is already sanitized on entry
      return `<div class="recent-item" role="listitem" style="--cat-color:${catColor}">
        <span class="recent-emoji" aria-hidden="true">${emoji}</span>
        <div class="recent-info">
          <span class="recent-desc">${a.description}</span>
          <span class="recent-time">${timeAgo}</span>
        </div>
        <span class="recent-co2">${a.co2.toFixed(2)} kg</span>
      </div>`;
    }).join('');
  }

  function getTimeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ago';
  }

  /* ============================================================
     Insights Section
     ============================================================ */
  function refreshInsights() {
    const score = computeEcoScore(activities, profile);
    setText('eco-score', score);
    drawScoreRing('score-ring', score);

    // Dynamic titles based on score
    const titles = [
      { min: 80, title: "Excellent! You're a sustainability star! 🌟", desc: 'Your carbon footprint is well below average. Keep inspiring others!' },
      { min: 60, title: "You're doing great!", desc: 'Your footprint is below average. Here are some ways to improve further.' },
      { min: 40, title: 'Room for improvement', desc: 'Your footprint is around average. Small changes can make a big difference!' },
      { min: 0,  title: "Let's work on this together", desc: 'Your footprint is above average, but every step counts. Check the tips below!' }
    ];
    const tier = titles.find(t => score >= t.min);
    setText('eco-title', tier.title);
    setText('eco-desc', tier.desc);

    // Personalized insights — prioritize highest-emission category
    const catTotals = getCategoryTotals(activities);
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'transport';

    const sorted = [...INSIGHTS_POOL].sort((a, b) => {
      if (a.cat === topCat && b.cat !== topCat) return -1;
      if (b.cat === topCat && a.cat !== topCat) return 1;
      const impactOrder = { high: 0, medium: 1, low: 2 };
      return (impactOrder[a.impact] || 1) - (impactOrder[b.impact] || 1);
    });

    const grid = document.getElementById('insights-grid');
    if (grid) {
      grid.innerHTML = sorted.slice(0, 6).map(ins => `
        <div class="insight-card" style="--cat-color:${CATEGORY_COLORS[ins.cat]}">
          <div class="insight-icon" aria-hidden="true">${ins.icon}</div>
          <h3>${ins.title}</h3>
          <p>${ins.desc}</p>
          <span class="insight-impact impact-${ins.impact}">${ins.impact} impact</span>
        </div>`).join('');
    }

    // Weekly challenge progress
    const carFreeDays = (() => {
      const last7 = [];
      for (let i = 0; i < 7; i++) last7.push(dateNDaysAgo(i));
      return last7.filter(d => !activities.some(a =>
        a.date.slice(0, 10) === d && a.category === 'transport' && a.subtype === 'car'
      )).length;
    })();
    const challengeGoal = 3;
    const progress = Math.min(carFreeDays, challengeGoal);
    setBarWidth('challenge-bar', progress / challengeGoal * 100);
    setText('challenge-status', `${progress} / ${challengeGoal} days completed`);
  }

  /* ============================================================
     Achievements Section
     ============================================================ */
  function refreshAchievements() {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;
    grid.innerHTML = ACHIEVEMENTS.map(ach => {
      const unlocked = ach.check(activities, profile);
      return `<div class="ach-card ${unlocked ? 'unlocked' : 'locked'}" role="listitem">
        <div class="ach-icon" aria-hidden="true">${ach.icon}</div>
        <h3>${ach.title}</h3>
        <p>${ach.desc}</p>
        ${unlocked
          ? '<span class="ach-badge">✅ Unlocked</span>'
          : '<span class="ach-badge locked-badge">🔒 Locked</span>'}
      </div>`;
    }).join('');

    setText('streak-number', getStreak(activities));
  }

  /* ============================================================
     Data Export / Import
     ============================================================ */
  function setupDataExport() {
    const exportBtn = document.getElementById('btn-export-data');
    const importBtn = document.getElementById('btn-import-data');
    const importFile = document.getElementById('import-file');
    const clearBtn = document.getElementById('btn-clear-data');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const data = {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          profile: profile,
          activities: activities
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `carbonlens-backup-${todayStr()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported successfully! 📦');
      });
    }

    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          showToast('File too large. Max 5 MB.');
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (!data.activities || !Array.isArray(data.activities)) {
              throw new Error('Invalid format');
            }
            if (data.profile) { profile = data.profile; saveProfile(profile); }
            activities = data.activities;
            saveActivities(activities);
            updateGreeting();
            refreshAll();
            showToast(`Imported ${activities.length} activities! ✅`);
          } catch (err) {
            showToast('Invalid backup file format.');
          }
        };
        reader.readAsText(file);
        importFile.value = ''; // reset
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
          localStorage.removeItem(STORAGE_KEYS.PROFILE);
          localStorage.removeItem(STORAGE_KEYS.ACTIVITIES);
          profile = null;
          activities = [];
          location.reload();
        }
      });
    }
  }

  /* ============================================================
     Keyboard Shortcuts
     ============================================================ */
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Escape closes modals
      if (e.key === 'Escape') {
        const modal = document.getElementById('onboarding-modal');
        if (modal && modal.classList.contains('visible') && profile) {
          modal.classList.remove('visible');
        }
      }
      // Alt+1-4 for section navigation
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const sections = ['dashboard', 'log', 'insights', 'achievements'];
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 4) {
          e.preventDefault();
          switchSection(sections[num - 1]);
        }
      }
    });
  }

  /* ---- Start ---- */
  document.addEventListener('DOMContentLoaded', init);
})();
