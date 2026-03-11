// ===== BioMotion Lab – Data Store =====
// Central repository for all session data.

const _session = {
  metadata: {
    sessionId: null,
    patientName: '',
    patientAge: null,
    patientGender: 'male',
    assessmentDate: new Date().toISOString().split('T')[0],
    viewMode: 'sagittal',
    assessmentType: 'squat',
    videoFileName: '',
    videoDuration: 0,
    totalFrames: 0,
  },
  frames: [],      // [{timestamp, rawKeypoints, smoothedKeypoints, angles}]
  summary: null,   // computed after analysis
  aiAssessment: null,
};

let _lastTimestamp = -1;

// ---------- Public API ----------

export function initSession() {
  _session.metadata.sessionId = crypto.randomUUID();
  _session.frames = [];
  _session.summary = null;
  _session.aiAssessment = null;
  _lastTimestamp = -1;
}

export function setMetadata(updates) {
  Object.assign(_session.metadata, updates);
}

export function getMetadata() {
  return { ..._session.metadata };
}

// Push one frame of data (skip if timestamp unchanged)
export function pushFrame({ timestamp, rawKeypoints, smoothedKeypoints, angles }) {
  if (Math.abs(timestamp - _lastTimestamp) < 0.001) return false; // duplicate
  _lastTimestamp = timestamp;
  _session.frames.push({ timestamp, rawKeypoints, smoothedKeypoints, angles });
  _session.metadata.totalFrames = _session.frames.length;
  return true;
}

export function getFrames() {
  return _session.frames;
}

export function getFrameCount() {
  return _session.frames.length;
}

export function setSummary(summary) {
  _session.summary = summary;
}

export function getSummary() {
  return _session.summary;
}

export function setAiAssessment(text) {
  _session.aiAssessment = text;
}

export function getAiAssessment() {
  return _session.aiAssessment;
}

export function getFullSession() {
  return _session;
}

// Build timeseries arrays per angle key for chart rendering
// Returns: { angleId: [{x: timestamp, y: value}, ...], ... }
export function buildTimeseries(useSg = true) {
  const { savitzkyGolay } = window._bioSmoothingModule ?? {};
  const series = {};

  if (!_session.frames.length) return series;

  // Gather all angle keys from first valid frame
  const firstFrame = _session.frames.find(f => f.angles);
  if (!firstFrame) return series;

  const allKeys = [
    ...Object.keys(firstFrame.angles.sagittal || {}),
    ...Object.keys(firstFrame.angles.frontal  || {}),
  ];

  for (const key of allKeys) {
    const plane = key in firstFrame.angles.sagittal ? 'sagittal' : 'frontal';
    const rawValues = _session.frames.map(f => f.angles[plane]?.[key] ?? null);
    const timestamps = _session.frames.map(f => f.timestamp);

    let values = rawValues;
    // Apply Savitzky-Golay post-processing if available and requested
    if (useSg && savitzkyGolay) {
      values = savitzkyGolay(rawValues);
    }

    series[key] = timestamps.map((t, i) => ({
      x: parseFloat(t.toFixed(3)),
      y: values[i] !== null ? parseFloat(values[i].toFixed(2)) : null,
    })).filter(p => p.y !== null);
  }

  return series;
}

// Export session as JSON
export function exportJSON() {
  const blob = new Blob([JSON.stringify(_session, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `biomotion_${_session.metadata.patientName || 'session'}_${_session.metadata.assessmentDate}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Export angle timeseries as CSV
export function exportCSV() {
  const frames = _session.frames;
  if (!frames.length) return;

  const firstFrame = frames.find(f => f.angles);
  const sagKeys = Object.keys(firstFrame.angles.sagittal || {});
  const fronKeys = Object.keys(firstFrame.angles.frontal  || {});

  const headers = ['timestamp', ...sagKeys.map(k => `sag_${k}`), ...fronKeys.map(k => `fro_${k}`)];
  const rows = frames.map(f => [
    f.timestamp.toFixed(3),
    ...sagKeys.map(k => f.angles.sagittal[k]?.toFixed(2) ?? ''),
    ...fronKeys.map(k => f.angles.frontal[k]?.toFixed(2) ?? ''),
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `biomotion_angles_${_session.metadata.assessmentDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
