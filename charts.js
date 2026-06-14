/* ============================================================
   CarbonLens — Charts Module (Canvas-based, zero dependencies)
   ============================================================ */

'use strict';

/**
 * @fileoverview Custom canvas-based charting for CarbonLens.
 * Provides bar charts, donut charts, and score ring visualizations
 * with HiDPI support, animations, and accessibility considerations.
 */

/**
 * Configures a canvas for HiDPI (Retina) rendering.
 * @param {HTMLCanvasElement} canvas
 * @param {number} w - Logical width
 * @param {number} h - Logical height
 * @returns {CanvasRenderingContext2D}
 */
function setupHiDPICanvas(canvas, w, h) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

/**
 * Draws the 7-day bar chart.
 * @param {string} canvasId - Canvas element ID
 * @param {Array<{date:string, label:string, total:number}>} data
 */
function drawWeeklyChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const W = 500, H = 220;
  const ctx = setupHiDPICanvas(canvas, W, H);
  ctx.clearRect(0, 0, W, H);

  const pad = { top: 20, right: 20, bottom: 40, left: 50 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;
  const maxVal = Math.max(...data.map(d => d.total), 5);
  const barW = cW / data.length * 0.55;
  const gap = cW / data.length;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + cH - (cH * i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText((maxVal * i / 4).toFixed(1), pad.left - 8, y + 4);
  }

  // Bars with gradient
  data.forEach((d, i) => {
    const x = pad.left + i * gap + (gap - barW) / 2;
    const h = (d.total / maxVal) * cH;
    const y = pad.top + cH - h;
    const grad = ctx.createLinearGradient(x, y, x, pad.top + cH);
    grad.addColorStop(0, '#34d399');
    grad.addColorStop(1, '#059669');
    ctx.fillStyle = grad;

    // Rounded top corners
    const r = Math.min(6, barW / 2);
    ctx.beginPath();
    ctx.moveTo(x, pad.top + cH);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
    ctx.lineTo(x + barW, pad.top + cH);
    ctx.fill();

    // Glow effect
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Value label on top
    if (d.total > 0) {
      ctx.fillStyle = '#d1fae5';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.total.toFixed(1), x + barW / 2, y - 6);
    }

    // Day label
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, x + barW / 2, pad.top + cH + 22);
  });

  // Y-axis label
  ctx.save();
  ctx.translate(14, pad.top + cH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('kg CO₂', 0, 0);
  ctx.restore();
}

/**
 * Draws the category breakdown donut chart.
 * @param {string} canvasId
 * @param {{transport:number, food:number, energy:number, shopping:number}} categoryTotals
 */
function drawBreakdownChart(canvasId, categoryTotals) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const W = 300, H = 220;
  const ctx = setupHiDPICanvas(canvas, W, H);
  ctx.clearRect(0, 0, W, H);

  const total = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
  const cx = W / 2 - 40, cy = H / 2, radius = 75;
  const colors = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
  const labels = ['Transport', 'Food', 'Energy', 'Shopping'];
  const keys = ['transport', 'food', 'energy', 'shopping'];

  if (total === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet', cx, cy + 5);
    return;
  }

  let startAngle = -Math.PI / 2;
  keys.forEach((k, i) => {
    const val = categoryTotals[k];
    const sliceAngle = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.fillStyle = colors[i];
    ctx.fill();
    startAngle += sliceAngle;
  });

  // Center hole (donut)
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = '#0c1220';
  ctx.fill();

  // Center text
  ctx.fillStyle = '#fff';
  ctx.font = '700 18px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(total.toFixed(1), cx, cy + 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('kg CO₂', cx, cy + 18);

  // Legend
  const lx = W - 95;
  keys.forEach((k, i) => {
    const ly = 40 + i * 38;
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(labels[i], lx + 14, ly + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(categoryTotals[k].toFixed(1) + ' kg', lx + 14, ly + 18);
  });
}

/**
 * Draws the eco-score ring gauge.
 * @param {string} canvasId
 * @param {number} score - 0 to 100
 */
function drawScoreRing(canvasId, score) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const size = 180;
  const ctx = setupHiDPICanvas(canvas, size, size);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2, cy = size / 2, r = 72, lw = 10;

  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = lw;
  ctx.stroke();

  // Score ring with color coding
  const pct = score / 100;
  const endAngle = -Math.PI / 2 + pct * Math.PI * 2;
  const grad = ctx.createConicGradient(-Math.PI / 2, cx, cy);

  if (score >= 70) {
    grad.addColorStop(0, '#34d399');
    grad.addColorStop(pct, '#059669');
  } else if (score >= 40) {
    grad.addColorStop(0, '#fbbf24');
    grad.addColorStop(pct, '#f59e0b');
  } else {
    grad.addColorStop(0, '#f87171');
    grad.addColorStop(pct, '#ef4444');
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, endAngle);
  ctx.strokeStyle = grad;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}
