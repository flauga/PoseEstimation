// ===== BioMotion Lab – Main App Orchestrator =====
import { loadModel, getPoseKeypoints } from './pose-engine.js';
import { drawSkeleton, drawAngleLabels } from './skeleton-renderer.js';
import { computeAllAngles } from './angle-calculator.js';
import { initVideoController, exportAnnotatedVideo } from './video-controller.js';
import { initSession, setMetadata, pushFrame, getFrames, getFrameCount,
         setSummary, getSummary, setAiAssessment, getFullSession,
         buildTimeseries, exportJSON } from './data-store.js';
import { resetEmaState, sliderToLabel } from './smoothing.js';
import { getCurrentMode, setMode, setModeChangeCallback,
         rebuildAnglePanel, updateAngleDisplay } from './view-mode.js';
import { computeSummary } from './metrics-engine.js';
import { buildCharts, updateTimeline, destroyAllCharts,
         setSeekCallback, getChartImages, pauseSync, resumeSync } from './chart-manager.js';
import { getApiKey, saveApiKey, clearApiKey,
         runAIAssessment, parseAIResponse, renderAIResults } from './ai-assessment.js';
import { generatePDFReport, buildReportPreview } from './report-generator.js';

// ---- Expose smoothing module for data-store SG filter ----
import * as SmoothingModule from './smoothing.js';
window._bioSmoothingModule = SmoothingModule;

// ---- State ----
let animationId  = null;
let isAnalysing  = false;
let analysisFrames = 0;
let analysisTotalFrames = 0;
let detector     = null;

const video   = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx     = overlay?.getContext('2d');

// ---- Boot ----
async function boot() {
  const overlay_el = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');

  try {
    detector = await loadModel(msg => { if (loadingText) loadingText.textContent = msg; });
  } catch (e) {
    if (loadingText) loadingText.textContent = '⚠ Model failed to load. Refresh to retry.';
    return;
  }

  // Fade out loading overlay
  if (overlay_el) {
    overlay_el.classList.add('hidden');
    setTimeout(() => overlay_el.style.display = 'none', 500);
  }

  initSession();
  setupUI();
  setupViewMode();
  setupVideoController();
  setupSmoothingControls();
  setupSidebarActions();
  setupTabNavigation();
  setupKeyboardShortcuts();
  setupAITab();
  setupReportTab();
  loadApiKeyStatus();
  setToday();
}

// ---- UI Setup ----
function setupUI() {
  // Sync header session inputs → metadata
  document.getElementById('patientName')?.addEventListener('input', e => {
    setMetadata({ patientName: e.target.value });
    document.getElementById('reportPatientName').value = e.target.value;
  });
  document.getElementById('assessmentType')?.addEventListener('change', e => {
    setMetadata({ assessmentType: e.target.value });
  });

  // Hide video controls initially
  const vc = document.getElementById('videoControls');
  if (vc) vc.style.display = 'none';
  const container = document.getElementById('videoContainer');
  if (container) container.style.display = 'none';
}

function setupViewMode() {
  setModeChangeCallback(mode => {
    setMetadata({ viewMode: mode });
    // Rebuild charts if we have data
    const frames = getFrames();
    if (frames.length > 0) {
      const ts = buildTimeseries(true);
      const meta = getFullSession().metadata;
      buildCharts(ts, video.duration || 0, mode, meta.patientAge, meta.patientGender);
    }
  });

  document.querySelectorAll('.view-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  // Build initial panel
  rebuildAnglePanel();
}

function setupVideoController() {
  initVideoController(video,
    // onVideoLoaded
    (fileName) => {
      setMetadata({ videoFileName: fileName });
      document.getElementById('analyzeBtn').disabled = false;
      document.getElementById('exportVideoBtn').disabled = false;
      initSession();
      resetEmaState();
      destroyAllCharts();
      document.getElementById('graphsEmpty').style.display = 'flex';
      document.getElementById('graphsContent').style.display = 'none';
      document.getElementById('qualityScoreCard').style.display = 'none';
      document.getElementById('asymmetryCard').style.display = 'none';
      document.getElementById('aiResults').style.display = 'none';
      setMetadata({ videoFileName: fileName });
    },
    // onTimeUpdate (called during normal playback)
    (currentTime) => {
      pauseSync();
      updateTimeline(currentTime);
      resumeSync();
    }
  );

  video.addEventListener('loadedmetadata', () => {
    overlay.width  = video.clientWidth;
    overlay.height = video.clientHeight;
    setMetadata({ videoDuration: video.duration });
  });

  // Resize observer to keep canvas aligned
  const resizeObserver = new ResizeObserver(() => {
    if (video.videoWidth) {
      overlay.width  = video.clientWidth;
      overlay.height = video.clientHeight;
    }
  });
  resizeObserver.observe(video);

  // Real-time skeleton loop on play
  video.addEventListener('play', () => {
    if (!animationId) animationId = requestAnimationFrame(viewerLoop);
  });
  video.addEventListener('pause', () => { animationId = null; });
  video.addEventListener('ended', () => { animationId = null; });

  // Draw on seek while paused
  video.addEventListener('seeked', async () => {
    if (video.paused) await drawCurrentFrame();
  });

  // Master slider seek (Graphs tab)
  const masterSlider = document.getElementById('masterSlider');
  if (masterSlider) {
    masterSlider.addEventListener('input', () => {
      const t = parseFloat(masterSlider.value);
      pauseSync();
      video.currentTime = t;
      resumeSync();
    });
  }
}

function setupSmoothingControls() {
  const toggle  = document.getElementById('smoothingToggle');
  const slider  = document.getElementById('smoothStrength');
  const label   = document.getElementById('smoothStrengthLabel');

  slider?.addEventListener('input', () => {
    if (label) label.textContent = sliderToLabel(parseInt(slider.value));
  });
  // Initial label
  if (slider && label) label.textContent = sliderToLabel(parseInt(slider.value));
}

function setupSidebarActions() {
  // Analyze button: process entire video
  document.getElementById('analyzeBtn')?.addEventListener('click', analyzeFullVideo);

  // Export video
  document.getElementById('exportVideoBtn')?.addEventListener('click', () => {
    exportAnnotatedVideo(video, detector, getCurrentMode(),
      document.getElementById('smoothingToggle').checked,
      parseInt(document.getElementById('smoothStrength').value)
    );
  });

  // Export JSON
  document.getElementById('exportDataBtn')?.addEventListener('click', () => {
    if (getFrameCount() > 0) exportJSON();
  });

  // Stop analysis
  document.getElementById('stopAnalysisBtn')?.addEventListener('click', () => {
    isAnalysing = false;
  });

  // Reset
  document.getElementById('resetBtn')?.addEventListener('click', () => {
    video.src = '';
    video.load();
    initSession();
    resetEmaState();
    destroyAllCharts();
    ctx?.clearRect(0, 0, overlay.width, overlay.height);
    document.getElementById('videoContainer').style.display = 'none';
    document.getElementById('videoControls').style.display  = 'none';
    document.getElementById('noVideoState').style.display   = 'block';
    document.getElementById('analyzeBtn').disabled  = true;
    document.getElementById('exportVideoBtn').disabled = true;
    document.getElementById('exportDataBtn').disabled = true;
    document.getElementById('qualityScoreCard').style.display = 'none';
    document.getElementById('asymmetryCard').style.display    = 'none';
    document.getElementById('graphsEmpty').style.display      = 'flex';
    document.getElementById('graphsContent').style.display    = 'none';
    document.getElementById('aiResults').style.display        = 'none';
    document.getElementById('reportPreviewContent').innerHTML = '';
    rebuildAnglePanel();
  });
}

function setupTabNavigation() {
  const allNavItems  = document.querySelectorAll('.sidebar__nav-item, .tab-bar__item');
  const allTabPanes  = document.querySelectorAll('.tab-pane');

  allNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      if (!tab) return;

      // Activate nav items
      allNavItems.forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
      // Activate panes
      allTabPanes.forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));

      // On switching to graphs, refresh charts
      if (tab === 'graphs' && getFrameCount() > 0) {
        refreshGraphs();
      }
      // On switching to report
      if (tab === 'report' && getSummary()) {
        buildReportPreview(getFullSession());
        const btn = document.getElementById('generatePdfBtn');
        if (btn) btn.disabled = false;
        const pbtn = document.getElementById('printReportBtn');
        if (pbtn) pbtn.disabled = false;
      }
    });
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); video.paused ? video.play() : video.pause(); }
    if (e.code === 'ArrowRight') { video.pause(); video.currentTime = Math.min(video.duration, video.currentTime + 1/30); }
    if (e.code === 'ArrowLeft')  { video.pause(); video.currentTime = Math.max(0, video.currentTime - 1/30); }
    if (e.code === 'ArrowUp')    { video.playbackRate = Math.min(2, video.playbackRate + 0.25); }
    if (e.code === 'ArrowDown')  { video.playbackRate = Math.max(0.25, video.playbackRate - 0.25); }
  });
}

function setupAITab() {
  document.getElementById('saveApiKeyBtn')?.addEventListener('click', () => {
    const val = document.getElementById('apiKeyInput').value.trim();
    if (val) { saveApiKey(val); loadApiKeyStatus(); }
  });
  document.getElementById('clearApiKeyBtn')?.addEventListener('click', () => {
    clearApiKey();
    document.getElementById('apiKeyInput').value = '';
    loadApiKeyStatus();
  });
  document.getElementById('runAiBtn')?.addEventListener('click', runAIAnalysis);
}

function setupReportTab() {
  document.getElementById('generatePdfBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('generatePdfBtn');
    btn.disabled = true;
    btn.innerHTML = '⏳ Generating…';
    try {
      // Sync patient info from report form
      const session = getFullSession();
      session.metadata.patientName    = document.getElementById('reportPatientName').value;
      session.metadata.patientAge     = parseInt(document.getElementById('reportAge').value) || null;
      session.metadata.patientGender  = document.getElementById('reportGender').value;
      session.metadata.assessmentDate = document.getElementById('reportDate').value;
      session.metadata.clinician      = document.getElementById('reportClinician').value;

      await generatePDFReport(session, getChartImages(), video);
    } catch (e) {
      alert('PDF generation failed: ' + e.message);
      console.error(e);
    }
    btn.disabled = false;
    btn.innerHTML = '⬇ Generate PDF Report';
  });

  document.getElementById('printReportBtn')?.addEventListener('click', () => window.print());
}

function loadApiKeyStatus() {
  const key = getApiKey();
  const statusEl = document.getElementById('apiKeyStatus');
  const runBtn   = document.getElementById('runAiBtn');
  if (key) {
    if (statusEl) { statusEl.textContent = '✔ API key saved locally'; statusEl.style.color = 'var(--color-normal)'; }
    if (runBtn) runBtn.disabled = getSummary() === null;
  } else {
    if (statusEl) { statusEl.textContent = 'No API key saved.'; statusEl.style.color = 'var(--text-muted)'; }
    if (runBtn) runBtn.disabled = true;
  }
}

function setToday() {
  const el = document.getElementById('reportDate');
  if (el) el.value = new Date().toISOString().split('T')[0];
}

// ---- Real-time viewer loop ----
async function viewerLoop() {
  if (video.paused || video.ended) { animationId = null; return; }
  await drawCurrentFrame();
  animationId = requestAnimationFrame(viewerLoop);
}

async function drawCurrentFrame() {
  if (!ctx || !detector) return;
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  const smoothEnabled = document.getElementById('smoothingToggle').checked;
  const smoothStrength = parseInt(document.getElementById('smoothStrength').value);

  const result = await getPoseKeypoints(video, smoothEnabled, smoothStrength);
  if (!result) return;

  const { smoothedDisplayPts } = result;
  const viewMode = getCurrentMode();
  const angles   = computeAllAngles(smoothedDisplayPts);

  drawSkeleton(ctx, smoothedDisplayPts, viewMode);
  drawAngleLabels(ctx, smoothedDisplayPts, angles, viewMode);

  updateAngleDisplay(angles, getSummary(),
    parseInt(document.getElementById('reportAge').value) || null,
    document.getElementById('reportGender').value
  );
}

// ---- Full Video Analysis ----
async function analyzeFullVideo() {
  if (isAnalysing || !video.src || !detector) return;
  isAnalysing = true;

  const btn = document.getElementById('analyzeBtn');
  if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'Analysing…'; }

  const progressSection = document.getElementById('progressSection');
  const progressBar     = document.getElementById('analysisProgress');
  const progressLabel   = document.getElementById('progressLabel');
  if (progressSection) progressSection.style.display = 'block';

  initSession();
  resetEmaState();

  const smoothEnabled  = document.getElementById('smoothingToggle').checked;
  const smoothStrength = parseInt(document.getElementById('smoothStrength').value);

  setMetadata({
    videoDuration: video.duration,
    assessmentType: document.getElementById('assessmentType').value,
    patientName:    document.getElementById('patientName').value,
  });

  // Step through every frame
  const duration  = video.duration;
  const frameStep = 1 / 30;
  let t = 0;
  let count = 0;
  const totalSteps = Math.ceil(duration / frameStep);

  video.pause();

  while (t <= duration && isAnalysing) {
    video.currentTime = t;
    await waitForSeek(video);

    const result = await getPoseKeypoints(video, smoothEnabled, smoothStrength);
    if (result) {
      const { rawPts, smoothedDisplayPts } = result;
      const angles = computeAllAngles(smoothedDisplayPts);
      pushFrame({ timestamp: t, rawKeypoints: rawPts, smoothedKeypoints: smoothedDisplayPts, angles });

      // Update live display
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      drawSkeleton(ctx, smoothedDisplayPts, getCurrentMode());
      drawAngleLabels(ctx, smoothedDisplayPts, angles, getCurrentMode());
      updateAngleDisplay(angles, null, null, null);
    }

    count++;
    const pct = Math.min(100, Math.round((count / totalSteps) * 100));
    if (progressBar)  progressBar.style.width = `${pct}%`;
    if (progressLabel) progressLabel.textContent = `Analysing frame ${count} of ${totalSteps}… (${pct}%)`;

    t += frameStep;
    // Yield to browser every 5 frames to keep UI responsive
    if (count % 5 === 0) await yieldToMain();
  }

  // Compute summary
  const frames = getFrames();
  const age    = parseInt(document.getElementById('reportAge').value) || null;
  const gender = document.getElementById('reportGender').value || 'male';
  const summary = computeSummary(frames, age, gender);
  setSummary(summary);

  // Update UI with results
  if (summary) {
    renderQualityScore(summary.qualityScore);
    renderAsymmetryCard(summary.asymmetry);
    updateAngleDisplay({ sagittal: {}, frontal: {} }, summary, age, gender);
  }

  // Enable downstream features
  document.getElementById('exportDataBtn').disabled = false;
  document.getElementById('generatePdfBtn').disabled = false;
  document.getElementById('printReportBtn').disabled = false;
  if (getApiKey()) document.getElementById('runAiBtn').disabled = false;

  // Build graphs
  refreshGraphs();

  isAnalysing = false;
  if (progressSection) progressSection.style.display = 'none';
  if (btn) { btn.disabled = false; btn.querySelector('span').textContent = 'Analyze Video'; }
}

function refreshGraphs() {
  const ts   = buildTimeseries(true);
  const meta = getFullSession().metadata;
  const age  = parseInt(document.getElementById('reportAge').value) || null;
  const gen  = document.getElementById('reportGender').value || 'male';
  buildCharts(ts, video.duration || 0, getCurrentMode(), age, gen);

  // Wire chart click → video seek
  setSeekCallback(t => {
    video.currentTime = t;
  });
}

// ---- Render helpers ----
function renderQualityScore(qs) {
  if (!qs) return;
  const card = document.getElementById('qualityScoreCard');
  if (card) card.style.display = 'block';
  const el = document.getElementById('qualityScoreValue');
  if (el) el.textContent = qs.total;
  const rom = document.getElementById('romScore');
  const sym = document.getElementById('symScore');
  const smo = document.getElementById('smoothScore');
  if (rom) rom.textContent = `${qs.romScore}/40`;
  if (sym) sym.textContent = `${qs.symScore}/30`;
  if (smo) smo.textContent = `${qs.smoothScore}/30`;
}

function renderAsymmetryCard(asymmetry) {
  if (!asymmetry) return;
  const card = document.getElementById('asymmetryCard');
  const rows = document.getElementById('asymmetryRows');
  if (!card || !rows) return;

  const labels = { knee: 'Knee Flexion', hip: 'Hip Flexion', elbow: 'Elbow Flexion', shoulder: 'Shoulder Flexion', kneeFPPA: 'Knee FPPA' };
  rows.innerHTML = '';
  let hasAny = false;

  for (const [key, val] of Object.entries(asymmetry)) {
    if (!val) continue;
    hasAny = true;
    const row = document.createElement('div');
    row.className = 'asymmetry-row';
    row.innerHTML = `
      <span class="asymmetry-row__label">${labels[key] || key}</span>
      <span class="asymmetry-row__value ${val.cssClass}">${val.percent}% · ${val.label}</span>
    `;
    rows.appendChild(row);
  }

  if (hasAny) card.style.display = 'block';
}

// ---- AI Analysis ----
async function runAIAnalysis() {
  const btn = document.getElementById('runAiBtn');
  const loading = document.getElementById('aiLoading');
  const results = document.getElementById('aiResults');

  if (btn) btn.disabled = true;
  if (loading) loading.style.display = 'block';
  if (results) results.style.display = 'none';

  try {
    const text = await runAIAssessment(getFullSession());
    setAiAssessment(text);
    const sections = parseAIResponse(text);
    renderAIResults(sections);
    // Enable in report
    document.getElementById('generatePdfBtn').disabled = false;
  } catch (e) {
    alert(`AI Analysis failed: ${e.message}`);
    console.error(e);
  }

  if (btn) btn.disabled = false;
  if (loading) loading.style.display = 'none';
}

// ---- Utilities ----
function waitForSeek(video) {
  return new Promise(resolve => {
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
    video.addEventListener('seeked', onSeeked);
    // Short fallback timeout so slow seeks don't stall forever
    setTimeout(resolve, 150);
  });
}

function yieldToMain() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ---- Start ----
boot();
