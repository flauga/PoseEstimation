// ===== BioMotion Lab – Chart Manager =====
import { NORMATIVE_ROM, SAGITTAL_CHART_GROUPS, FRONTAL_CHART_GROUPS } from './constants.js';
import { savitzkyGolay } from './smoothing.js';

const _charts = {}; // { chartKey: Chart instance }
let _timeseries = {};
let _videoDuration = 0;
let _syncEnabled = true;

// External callbacks
let _onSeekCallback = null;

export function setSeekCallback(fn) { _onSeekCallback = fn; }

// ---- Build/destroy charts ----
export function buildCharts(timeseries, videoDuration, viewMode, age, gender) {
  destroyAllCharts();

  _timeseries    = timeseries;
  _videoDuration = videoDuration;

  const grid   = document.getElementById('chartsGrid');
  const empty  = document.getElementById('graphsEmpty');
  const content = document.getElementById('graphsContent');

  if (!grid) return;
  grid.innerHTML = '';

  const groups = viewMode === 'sagittal' ? SAGITTAL_CHART_GROUPS : FRONTAL_CHART_GROUPS;

  if (!Object.keys(timeseries).length) {
    if (empty)   empty.style.display = 'flex';
    if (content) content.style.display = 'none';
    return;
  }

  if (empty)   empty.style.display = 'none';
  if (content) content.style.display = 'block';

  // Update master slider range
  const slider = document.getElementById('masterSlider');
  if (slider) {
    slider.max  = videoDuration;
    slider.step = videoDuration / 1000;
  }

  for (const group of groups) {
    const card = buildChartCard(group, timeseries, videoDuration, age, gender);
    if (card) grid.appendChild(card);
  }
}

function buildChartCard(group, timeseries, videoDuration, age, gender) {
  // Gather data
  const leftData   = group.leftId   ? (timeseries[group.leftId]   || []) : [];
  const rightData  = group.rightId  ? (timeseries[group.rightId]  || []) : [];
  const singleData = group.singleId ? (timeseries[group.singleId] || []) : [];

  const isSingle = !!group.singleId;
  const hasData  = isSingle ? singleData.length > 0 : (leftData.length > 0 || rightData.length > 0);
  if (!hasData) return null;

  // Build card HTML
  const card = document.createElement('div');
  card.className = 'chart-card';
  card.innerHTML = `
    <div class="chart-card__header">
      <span class="chart-card__title">${group.title}</span>
      ${!isSingle ? `
      <div class="chart-card__legend">
        <span class="chart-card__legend-item"><span class="chart-card__legend-dot left"></span>Left</span>
        <span class="chart-card__legend-item"><span class="chart-card__legend-dot right"></span>Right</span>
      </div>` : ''}
    </div>
    <div class="chart-card__canvas-wrap">
      <canvas id="chart_${group.key}"></canvas>
    </div>
    <div class="chart-card__stats" id="stats_${group.key}">
      ${buildStatsHTML(group, timeseries)}
    </div>
  `;

  // Normative range
  const normRange = getNormRange(group.normKey, age, gender);

  // After inserting, build Chart.js instance
  requestAnimationFrame(() => {
    const canvas = document.getElementById(`chart_${group.key}`);
    if (!canvas) return;

    const datasets = [];
    if (isSingle) {
      datasets.push({
        label: group.title,
        data: singleData,
        borderColor: '#00B4D8',
        backgroundColor: 'rgba(0,180,216,0.08)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      });
    } else {
      if (leftData.length) datasets.push({
        label: 'Left',
        data: leftData,
        borderColor: '#00B4D8',
        backgroundColor: 'rgba(0,180,216,0.08)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      });
      if (rightData.length) datasets.push({
        label: 'Right',
        data: rightData,
        borderColor: '#FF6B6B',
        backgroundColor: 'rgba(255,107,107,0.08)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      });
    }

    // Build annotation set
    const annotations = {};

    // Normative band
    if (normRange) {
      annotations.normBand = {
        type: 'box',
        yMin: normRange.min,
        yMax: normRange.max,
        backgroundColor: 'rgba(72,187,120,0.07)',
        borderColor: 'rgba(72,187,120,0.25)',
        borderWidth: 1,
        label: { display: false },
      };
    }

    // Current time line
    annotations.currentLine = {
      type: 'line',
      xMin: 0, xMax: 0,
      borderColor: '#FFD700',
      borderWidth: 2,
      borderDash: [4, 4],
    };

    const chart = new Chart(canvas, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: videoDuration,
            title: { display: true, text: 'Time (s)', font: { size: 10 }, color: '#A0AEC0' },
            ticks: { color: '#A0AEC0', font: { size: 10 }, maxTicksLimit: 8 },
            grid: { color: 'rgba(226,232,240,0.5)' },
          },
          y: {
            title: { display: true, text: '°', font: { size: 10 }, color: '#A0AEC0' },
            ticks: { color: '#A0AEC0', font: { size: 10 } },
            grid: { color: 'rgba(226,232,240,0.5)' },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}°`,
              title: ctx => `t = ${ctx[0]?.label}s`,
            },
          },
          annotation: { annotations },
        },
        onClick(event, elements, chart) {
          const xScale = chart.scales.x;
          const rect = chart.canvas.getBoundingClientRect();
          const xPos = event.native.clientX - rect.left;
          const time = xScale.getValueForPixel(xPos);
          if (time !== undefined && _onSeekCallback) {
            _onSeekCallback(Math.max(0, Math.min(time, videoDuration)));
          }
        },
      },
    });

    _charts[group.key] = chart;
  });

  return card;
}

function buildStatsHTML(group, ts) {
  const isSingle = !!group.singleId;

  const stats = (dataArr) => {
    const vals = dataArr.map(p => p.y).filter(v => v !== null);
    if (!vals.length) return null;
    const min  = Math.min(...vals);
    const max  = Math.max(...vals);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const rom  = max - min;
    return { min, max, mean, rom };
  };

  if (isSingle) {
    const s = stats(ts[group.singleId] || []);
    if (!s) return '<div class="chart-card__stat-row" style="grid-column:1/-1; justify-content:center; color:var(--text-muted);">No data</div>';
    return `
      <div class="chart-card__stat-row" style="grid-column:1/-1;">
        <span class="chart-card__stat-side left" style="min-width: 50px;">${group.title.split(' ')[0]}</span>
        <div class="chart-card__stat-values">
          <span class="chart-card__stat-item">Min <strong>${s.min.toFixed(1)}°</strong></span>
          <span class="chart-card__stat-item">Max <strong>${s.max.toFixed(1)}°</strong></span>
          <span class="chart-card__stat-item">Range <strong>${s.rom.toFixed(1)}°</strong></span>
          <span class="chart-card__stat-item">Mean <strong>${s.mean.toFixed(1)}°</strong></span>
        </div>
      </div>`;
  }

  const ls = stats(ts[group.leftId] || []);
  const rs = stats(ts[group.rightId] || []);
  let asymHTML = '';
  if (ls && rs) {
    const avg = (ls.max + rs.max) / 2;
    const pct = avg > 0 ? Math.abs((ls.max - rs.max) / avg * 100).toFixed(1) : '0.0';
    const label = parseFloat(pct) < 10 ? 'Normal' : parseFloat(pct) < 15 ? 'Mild' : parseFloat(pct) < 25 ? 'Moderate' : 'Significant';
    asymHTML = `<div class="chart-card__asymmetry">Asymmetry <strong>${pct}%</strong> &nbsp;·&nbsp; ${label}</div>`;
  }

  const rowHTML = (label, s, side) => s ? `
    <div class="chart-card__stat-row">
      <span class="chart-card__stat-side ${side}">${label}</span>
      <div class="chart-card__stat-values">
        <span class="chart-card__stat-item">Min <strong>${s.min.toFixed(1)}°</strong></span>
        <span class="chart-card__stat-item">Max <strong>${s.max.toFixed(1)}°</strong></span>
        <span class="chart-card__stat-item">ROM <strong>${s.rom.toFixed(1)}°</strong></span>
        <span class="chart-card__stat-item">Mean <strong>${s.mean.toFixed(1)}°</strong></span>
      </div>
    </div>` : '';

  return rowHTML('Left', ls, 'left') + rowHTML('Right', rs, 'right') + asymHTML;
}

// ---- Timeline sync ----
export function updateTimeline(currentTime) {
  if (!_syncEnabled) return;

  // Move all chart annotation lines
  for (const chart of Object.values(_charts)) {
    try {
      chart.options.plugins.annotation.annotations.currentLine.xMin = currentTime;
      chart.options.plugins.annotation.annotations.currentLine.xMax = currentTime;
      chart.update('none');
    } catch (_) {}
  }

  // Sync master slider
  const slider = document.getElementById('masterSlider');
  if (slider) slider.value = currentTime;

  const display = document.getElementById('masterTimeDisplay');
  if (display) display.textContent = `${currentTime.toFixed(3)}s / ${_videoDuration.toFixed(3)}s`;
}

export function destroyAllCharts() {
  for (const chart of Object.values(_charts)) {
    try { chart.destroy(); } catch (_) {}
  }
  for (const key of Object.keys(_charts)) delete _charts[key];
}

export function getChartImages() {
  const images = {};
  for (const [key, chart] of Object.entries(_charts)) {
    try { images[key] = chart.toBase64Image('image/jpeg', 0.85); } catch (_) {}
  }
  return images;
}

function getNormRange(normKey, age, gender) {
  const norm = NORMATIVE_ROM[normKey];
  if (!norm) return null;
  const ag = !age ? '18-30' : age <= 30 ? '18-30' : age <= 50 ? '31-50' : '51+';
  const ageGroup = norm.ranges[ag] ? ag : 'all';
  const rangeSet = norm.ranges[ageGroup];
  if (!rangeSet) return null;
  const gen = gender === 'female' ? 'female' : 'male';
  return rangeSet[gen] || rangeSet['male'];
}

// Pause sync temporarily (to avoid feedback loops)
export function pauseSync() { _syncEnabled = false; }
export function resumeSync() { _syncEnabled = true; }
