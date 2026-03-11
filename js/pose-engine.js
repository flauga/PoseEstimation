// ===== BioMotion Lab – Pose Engine =====
import { scaleKeypoints } from './skeleton-renderer.js';
import { smoothKeypoints, sliderToAlpha } from './smoothing.js';

let detector = null;
let isReady  = false;

export async function loadModel(onProgress) {
  onProgress?.('Loading MoveNet Thunder…');

  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER }
  );

  isReady = true;
  onProgress?.('Model Ready ✔');
  return detector;
}

export function isModelReady() {
  return isReady;
}

// Estimate poses on current video frame
// Returns raw MoveNet keypoints array or null
export async function estimatePose(video) {
  if (!detector || video.readyState < 2) return null;
  try {
    const poses = await detector.estimatePoses(video);
    return poses.length ? poses[0].keypoints : null;
  } catch (e) {
    console.warn('Pose estimation error:', e);
    return null;
  }
}

// Get display-scaled & smoothed keypoint map
// smoothEnabled: bool, smoothAlpha: 0–1
export async function getPoseKeypoints(video, smoothEnabled, smoothStrength) {
  const raw = await estimatePose(video);
  if (!raw) return null;

  const alpha = sliderToAlpha(smoothStrength);

  // Scale to display coordinates
  const displayPts = scaleKeypoints(raw, video);

  // Build raw keyset for storage
  const rawPts = {};
  for (const kp of raw) {
    if (kp.score > 0.3) rawPts[kp.name] = { x: kp.x, y: kp.y, score: kp.score };
  }

  // Smooth the display-scaled keypoints if enabled
  const smoothedDisplayPts = smoothEnabled
    ? smoothKeypoints(displayPts, alpha)
    : displayPts;

  return { rawPts, displayPts, smoothedDisplayPts };
}
