// ===== BioMotion Lab – Video Controller =====
import { scaleKeypointsFull, drawSkeleton, drawAngleLabels } from './skeleton-renderer.js';
import { computeAllAngles } from './angle-calculator.js';
import { smoothKeypoints, sliderToAlpha } from './smoothing.js';

const FRAME_STEP = 1 / 30; // approx 1 frame at 30fps

export function initVideoController(video, onVideoLoaded, onTimeUpdate) {
  const playPauseBtn    = document.getElementById('playPauseBtn');
  const stepBackBtn     = document.getElementById('stepBackBtn');
  const stepFwdBtn      = document.getElementById('stepFwdBtn');
  const timeline        = document.getElementById('videoTimeline');
  const timeDisplay     = document.getElementById('videoTimeDisplay');
  const speedSelect     = document.getElementById('playbackSpeed');
  const noVideoState    = document.getElementById('noVideoState');
  const videoContainer  = document.getElementById('videoContainer');
  const videoControls   = document.getElementById('videoControls');

  // File upload
  document.getElementById('videoUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    video.src = URL.createObjectURL(file);
    onVideoLoaded?.(file.name);
  });

  // Drag-drop on upload zone
  const uploadZone = document.getElementById('uploadZone');
  if (uploadZone) {
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.style.borderColor = 'var(--color-primary)';
    });
    uploadZone.addEventListener('dragleave', () => {
      uploadZone.style.borderColor = '';
    });
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('video/')) {
        video.src = URL.createObjectURL(file);
        onVideoLoaded?.(file.name);
      }
    });
  }

  // Metadata loaded
  video.addEventListener('loadedmetadata', () => {
    const vc = document.getElementById('videoContainer');
    const overlay = document.getElementById('overlay');

    // Show container FIRST so video renders at real dimensions
    if (noVideoState)   noVideoState.style.display   = 'none';
    if (vc)             vc.style.display              = 'block';
    if (videoControls)  videoControls.style.display  = 'flex';

    // Now clientWidth/Height are meaningful
    requestAnimationFrame(() => {
      if (overlay) {
        overlay.width  = video.clientWidth  || video.videoWidth;
        overlay.height = video.clientHeight || video.videoHeight;
      }
    });

    timeline.max  = video.duration;
    timeline.step = video.duration / 1000;
    updateTimeDisplay();
  });

  // Play/pause
  video.addEventListener('play',  () => { if (playPauseBtn) playPauseBtn.textContent = '⏸'; });
  video.addEventListener('pause', () => { if (playPauseBtn) playPauseBtn.textContent = '▶'; });
  video.addEventListener('ended', () => { if (playPauseBtn) playPauseBtn.textContent = '▶'; });

  video.addEventListener('timeupdate', () => {
    if (!video.seeking) {
      timeline.value = video.currentTime;
      updateTimeDisplay();
      onTimeUpdate?.(video.currentTime);
    }
  });

  // Control buttons
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (video.paused) video.play();
      else video.pause();
    });
  }
  if (stepBackBtn) {
    stepBackBtn.addEventListener('click', () => {
      video.pause();
      video.currentTime = Math.max(0, video.currentTime - FRAME_STEP);
    });
  }
  if (stepFwdBtn) {
    stepFwdBtn.addEventListener('click', () => {
      video.pause();
      video.currentTime = Math.min(video.duration, video.currentTime + FRAME_STEP);
    });
  }

  // Timeline scrubber
  if (timeline) {
    timeline.addEventListener('input', () => {
      video.pause();
      video.currentTime = parseFloat(timeline.value);
      updateTimeDisplay();
      onTimeUpdate?.(video.currentTime);
    });
  }

  // Speed
  if (speedSelect) {
    speedSelect.addEventListener('change', () => {
      video.playbackRate = parseFloat(speedSelect.value);
    });
  }

  function updateTimeDisplay() {
    if (!timeDisplay) return;
    const cur = video.currentTime;
    const dur = video.duration || 0;
    timeDisplay.textContent = `${fmt(cur)} / ${fmt(dur)}`;
    if (timeline) timeline.value = cur;
  }
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${m}:${sec}`;
}

// Annotated video export
export async function exportAnnotatedVideo(video, detector, viewMode, smoothEnabled, smoothStrength) {
  const exportBtn = document.getElementById('exportVideoBtn');
  if (!video.src || !detector) return;

  exportBtn.disabled = true;
  exportBtn.querySelector('span').textContent = 'Exporting…';

  const expCanvas = document.createElement('canvas');
  expCanvas.width  = video.videoWidth;
  expCanvas.height = video.videoHeight;
  const expCtx = expCanvas.getContext('2d');

  const stream   = expCanvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks   = [];

  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'biomotion_annotated.webm'; a.click();
    URL.revokeObjectURL(url);
    exportBtn.disabled = false;
    exportBtn.querySelector('span').textContent = 'Export Video';
  };

  recorder.start();
  video.currentTime = 0;
  await video.play();

  const alpha = sliderToAlpha(smoothStrength);

  const loop = async () => {
    if (video.paused || video.ended) { recorder.stop(); return; }
    expCtx.drawImage(video, 0, 0);

    const poses = await detector.estimatePoses(video);
    if (poses.length) {
      const raw = poses[0].keypoints;
      const pts = scaleKeypointsFull(raw);
      const smoothed = smoothEnabled ? smoothKeypoints(pts, alpha) : pts;
      const angles = computeAllAngles(smoothed);
      drawSkeleton(expCtx, smoothed, viewMode);
      drawAngleLabels(expCtx, smoothed, angles, viewMode);
    }
    requestAnimationFrame(loop);
  };
  loop();
}
