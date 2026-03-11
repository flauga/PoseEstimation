// ===== BioMotion Lab – View Mode Manager =====
import { SAGITTAL_ANGLES, FRONTAL_ANGLES, NORMATIVE_ROM } from './constants.js';
import { normativeStatus } from './metrics-engine.js';

let _currentMode = 'sagittal';
let _onModeChange = null;

export function getCurrentMode() { return _currentMode; }

export function setModeChangeCallback(fn) { _onModeChange = fn; }

export function setMode(mode) {
  if (mode !== 'sagittal' && mode !== 'frontal') return;
  _currentMode = mode;

  // Update header toggle buttons
  document.querySelectorAll('.view-toggle__btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  _onModeChange?.(mode);
  rebuildAnglePanel();
}

// Returns the angle config array for the current mode
export function getAnglesConfig() {
  return _currentMode === 'sagittal' ? SAGITTAL_ANGLES : FRONTAL_ANGLES;
}

// Build the angle cards panel based on view mode
export function rebuildAnglePanel() {
  const panel = document.getElementById('anglePanel');
  const emptyState = document.getElementById('anglePanelEmpty');
  if (!panel) return;

  // Clear old cards (keep empty state element)
  const cards = panel.querySelectorAll('.angle-card');
  cards.forEach(c => c.remove());
  if (emptyState) emptyState.style.display = 'block';

  // Groups: find unique label+normKey combos
  const config = getAnglesConfig();
  const paired  = {};
  const singles = [];

  for (const angle of config) {
    if (angle.side === 'single') {
      singles.push(angle);
    } else {
      const key = angle.normativeKey;
      if (!paired[key]) paired[key] = {};
      paired[key][angle.side] = angle;
      paired[key].label = angle.label;
    }
  }

  // Build paired cards
  for (const [normKey, { label, left, right }] of Object.entries(paired)) {
    const card = buildPairedCard(label, left?.id, right?.id, normKey);
    panel.appendChild(card);
  }

  // Build single cards
  for (const angle of singles) {
    const card = buildSingleCard(angle.label, angle.id, angle.normativeKey);
    panel.appendChild(card);
  }
}

function buildPairedCard(label, leftId, rightId, normKey) {
  const card = document.createElement('div');
  card.className = 'angle-card';
  card.dataset.normKey = normKey;

  card.innerHTML = `
    <div class="angle-card__header">
      <span class="angle-card__name">${label}</span>
      <span class="angle-card__status" id="status_${normKey}"></span>
    </div>
    <div class="angle-card__values">
      <div class="angle-card__side">
        <div class="angle-card__side-label left">Left</div>
        <div class="angle-card__value" id="val_${leftId ?? ''}">–</div>
        <div class="angle-card__unit">deg</div>
      </div>
      <div class="angle-card__side">
        <div class="angle-card__side-label right">Right</div>
        <div class="angle-card__value" id="val_${rightId ?? ''}">–</div>
        <div class="angle-card__unit">deg</div>
      </div>
    </div>
    <div class="angle-card__range">
      <div class="angle-card__metric">
        <div class="angle-card__metric-label">Min</div>
        <div class="angle-card__metric-value" id="min_${normKey}">–</div>
      </div>
      <div class="angle-card__metric">
        <div class="angle-card__metric-label">Max</div>
        <div class="angle-card__metric-value" id="max_${normKey}">–</div>
      </div>
      <div class="angle-card__metric">
        <div class="angle-card__metric-label">ROM</div>
        <div class="angle-card__metric-value" id="rom_${normKey}">–</div>
      </div>
    </div>
  `;
  return card;
}

function buildSingleCard(label, id, normKey) {
  const card = document.createElement('div');
  card.className = 'angle-card';
  card.dataset.normKey = normKey;

  card.innerHTML = `
    <div class="angle-card__header">
      <span class="angle-card__name">${label}</span>
      <span class="angle-card__status" id="status_${normKey}"></span>
    </div>
    <div class="angle-card__single-value">
      <div class="angle-card__value" id="val_${id}">–</div>
      <div class="angle-card__unit">degrees</div>
    </div>
    <div class="angle-card__range">
      <div class="angle-card__metric">
        <div class="angle-card__metric-label">Min</div>
        <div class="angle-card__metric-value" id="min_${normKey}">–</div>
      </div>
      <div class="angle-card__metric">
        <div class="angle-card__metric-label">Max</div>
        <div class="angle-card__metric-value" id="max_${normKey}">–</div>
      </div>
    </div>
  `;
  return card;
}

// Update live angle values from a computed angles object
export function updateAngleDisplay(angles, summary, age, gender) {
  const config = getAnglesConfig();
  const plane  = _currentMode === 'sagittal' ? angles.sagittal : angles.frontal;

  const emptyState = document.getElementById('anglePanelEmpty');
  if (emptyState) emptyState.style.display = 'none';

  for (const angle of config) {
    const el = document.getElementById(`val_${angle.id}`);
    if (!el) continue;

    const val = plane?.[angle.id];
    if (val !== null && val !== undefined) {
      el.textContent = val.toFixed(1);
    } else {
      el.textContent = '–';
    }
  }

  // Update normative status dots + min/max/ROM from summary if available
  if (summary) updateSummaryDisplay(summary, age, gender);
}

function updateSummaryDisplay(summary, age, gender) {
  const config   = getAnglesConfig();
  const plane    = _currentMode === 'sagittal' ? 'sagittal' : 'frontal';
  const normData = summary[plane];
  if (!normData) return;

  // Build a map of normKey -> { left stats, right stats, single stats }
  const normKeyData = {};
  for (const angle of config) {
    const nk = angle.normativeKey;
    if (!normKeyData[nk]) normKeyData[nk] = {};
    const stats = normData[angle.id];
    if (!stats) continue;
    if (angle.side === 'left')   normKeyData[nk].left   = stats;
    else if (angle.side === 'right') normKeyData[nk].right = stats;
    else normKeyData[nk].single = stats;
  }

  for (const [nk, data] of Object.entries(normKeyData)) {
    // Use worst-side (largest asymmetry) or average for status, best available for display
    const primary = data.left ?? data.single ?? data.right;
    if (!primary) continue;

    // Aggregate min/max across both sides for paired cards
    const allStats = [data.left, data.right, data.single].filter(Boolean);
    const aggMin   = Math.min(...allStats.map(s => s.min ?? Infinity));
    const aggMax   = Math.max(...allStats.map(s => s.max ?? -Infinity));
    const aggROM   = Math.max(...allStats.map(s => s.range ?? 0));

    const minEl    = document.getElementById(`min_${nk}`);
    const maxEl    = document.getElementById(`max_${nk}`);
    const romEl    = document.getElementById(`rom_${nk}`);
    const statusEl = document.getElementById(`status_${nk}`);

    if (minEl) minEl.textContent = isFinite(aggMin) ? aggMin.toFixed(1) : '–';
    if (maxEl) maxEl.textContent = isFinite(aggMax) ? aggMax.toFixed(1) : '–';
    if (romEl) romEl.textContent = aggROM > 0 ? aggROM.toFixed(1) : '–';

    if (statusEl) {
      // Use worst-side for normative status
      const worstStat = allStats.reduce((worst, s) => {
        if (!worst) return s;
        // Compare ROM vs normative
        return (s.range ?? 0) < (worst.range ?? 0) ? s : worst;
      }, null);
      const ns = normativeStatus(worstStat?.max, nk, age, gender);
      statusEl.className = `angle-card__status ${ns.cssClass ?? ''}`;
    }
  }
}
