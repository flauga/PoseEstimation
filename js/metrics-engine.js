// ===== BioMotion Lab – Metrics Engine =====
import { NORMATIVE_ROM } from './constants.js';

// Get the right normative range based on age + gender
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

// ---- Per-angle statistics ----
export function computeAngleStats(values) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (!valid.length) return null;
  const min  = Math.min(...valid);
  const max  = Math.max(...valid);
  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  const range = max - min;

  // Smoothness: inverse of std-dev of frame-to-frame deltas
  const deltas = [];
  for (let i = 1; i < valid.length; i++) deltas.push(Math.abs(valid[i] - valid[i-1]));
  const deltaMean = deltas.length ? deltas.reduce((s, v) => s + v, 0) / deltas.length : 0;

  return {
    min:   parseFloat(min.toFixed(2)),
    max:   parseFloat(max.toFixed(2)),
    mean:  parseFloat(mean.toFixed(2)),
    range: parseFloat(range.toFixed(2)),
    deltaMean: parseFloat(deltaMean.toFixed(3)),
  };
}

// ---- Asymmetry index ----
// Returns percent asymmetry and clinical label
export function computeAsymmetry(leftStats, rightStats) {
  if (!leftStats || !rightStats) return null;
  const lPeak = leftStats.max;
  const rPeak = rightStats.max;
  const avg = (lPeak + rPeak) / 2;
  if (avg === 0) return { percent: 0, absolute: 0, dominant: 'none', label: 'Normal' };
  const pct = Math.abs((lPeak - rPeak) / avg) * 100;
  const abs = Math.abs(lPeak - rPeak);
  return {
    percent: parseFloat(pct.toFixed(1)),
    absolute: parseFloat(abs.toFixed(1)),
    dominant: lPeak >= rPeak ? 'left' : 'right',
    label: pct < 10 ? 'Normal' : pct < 15 ? 'Mild' : pct < 25 ? 'Moderate' : 'Significant',
    cssClass: pct < 10 ? 'normal' : pct < 15 ? 'mild' : pct < 25 ? 'moderate' : 'significant',
  };
}

// ---- Normative status ----
export function normativeStatus(value, normKey, age, gender) {
  if (value === null || value === undefined) return { status: 'unknown', color: '#A0AEC0' };
  const range = getNormRange(normKey, age, gender);
  if (!range) return { status: 'unknown', color: '#A0AEC0' };

  const span = range.max - range.min;
  const buffer = span * 0.10;

  if (value >= range.min && value <= range.max) {
    return { status: 'normal',  label: 'Normal',     color: '#48BB78', cssClass: 'normal' };
  } else if (value >= range.min - buffer && value <= range.max + buffer) {
    return { status: 'warning', label: 'Borderline', color: '#ECC94B', cssClass: 'warning' };
  } else {
    return { status: 'danger',  label: 'Outside',    color: '#FC8181', cssClass: 'danger' };
  }
}

// ---- Movement Quality Score (0–100) ----
export function computeQualityScore(summary, age, gender) {
  if (!summary) return null;

  // ROM score (0–40): average of each angle's ROM as % of normative ROM
  const romPairs = [
    { key: 'leftKneeFlexion',  norm: 'kneeFlexion' },
    { key: 'rightKneeFlexion', norm: 'kneeFlexion' },
    { key: 'leftHipFlexion',   norm: 'hipFlexion' },
    { key: 'rightHipFlexion',  norm: 'hipFlexion' },
  ];
  let romScores = [];
  for (const { key, norm } of romPairs) {
    const stats = summary.sagittal?.[key];
    if (!stats) continue;
    const range = getNormRange(norm, age, gender);
    if (!range) continue;
    const normROM = range.max - range.min;
    if (normROM <= 0) continue;
    const pct = Math.min(1, stats.range / normROM);
    romScores.push(pct);
  }
  const romScore = romScores.length
    ? Math.round((romScores.reduce((s, v) => s + v, 0) / romScores.length) * 40)
    : 20;

  // Symmetry score (0–30): penalise asymmetry
  const asymEntries = Object.values(summary.asymmetry || {}).filter(Boolean);
  let symScore = 30;
  if (asymEntries.length) {
    const avgAsym = asymEntries.reduce((s, a) => s + (a.percent || 0), 0) / asymEntries.length;
    symScore = Math.max(0, Math.round(30 - avgAsym * 1.2));
  }

  // Smoothness score (0–30): lower deltaMean = smoother
  const allDelta = [];
  for (const plane of ['sagittal', 'frontal']) {
    for (const stats of Object.values(summary[plane] || {})) {
      if (stats?.deltaMean !== undefined) allDelta.push(stats.deltaMean);
    }
  }
  let smoothScore = 25;
  if (allDelta.length) {
    const avgDelta = allDelta.reduce((s, v) => s + v, 0) / allDelta.length;
    smoothScore = Math.max(0, Math.round(30 - avgDelta * 3));
  }

  const total = Math.min(100, romScore + symScore + smoothScore);
  return { total, romScore, symScore, smoothScore };
}

// ---- Full summary computation ----
export function computeSummary(frames, age, gender) {
  if (!frames.length) return null;

  const firstFrame = frames.find(f => f.angles);
  if (!firstFrame) return null;

  const sagKeys = Object.keys(firstFrame.angles.sagittal || {});
  const fronKeys = Object.keys(firstFrame.angles.frontal  || {});

  const sagittal = {};
  for (const key of sagKeys) {
    const values = frames.map(f => f.angles.sagittal[key]);
    sagittal[key] = computeAngleStats(values);
  }

  const frontal = {};
  for (const key of fronKeys) {
    const values = frames.map(f => f.angles.frontal[key]);
    frontal[key] = computeAngleStats(values);
  }

  // Asymmetry pairs
  const asymmetry = {
    knee:     computeAsymmetry(sagittal.leftKneeFlexion,     sagittal.rightKneeFlexion),
    hip:      computeAsymmetry(sagittal.leftHipFlexion,      sagittal.rightHipFlexion),
    elbow:    computeAsymmetry(sagittal.leftElbowFlexion,    sagittal.rightElbowFlexion),
    shoulder: computeAsymmetry(sagittal.leftShoulderFlexion, sagittal.rightShoulderFlexion),
    kneeFPPA: computeAsymmetry(frontal.leftKneeFPPA,         frontal.rightKneeFPPA),
  };

  const summary = { sagittal, frontal, asymmetry };
  summary.qualityScore = computeQualityScore(summary, age, gender);

  return summary;
}
