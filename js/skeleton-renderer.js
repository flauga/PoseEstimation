// ===== BioMotion Lab – Skeleton Renderer =====
import { SKELETON_CONNECTIONS, KEYPOINT_COLOR } from './constants.js';

// Scale raw MoveNet keypoints to canvas/display coordinates
export function scaleKeypoints(rawKeypoints, video) {
  const videoWidth  = video.videoWidth;
  const videoHeight = video.videoHeight;
  const elemWidth   = video.clientWidth;
  const elemHeight  = video.clientHeight;

  const videoAspect = videoWidth / videoHeight;
  const elemAspect  = elemWidth  / elemHeight;

  let renderW, renderH, offsetX = 0, offsetY = 0;

  if (videoAspect > elemAspect) {
    renderW = elemWidth;
    renderH = elemWidth / videoAspect;
    offsetY = (elemHeight - renderH) / 2;
  } else {
    renderH = elemHeight;
    renderW = elemHeight * videoAspect;
    offsetX = (elemWidth - renderW) / 2;
  }

  const pts = {};
  for (const kp of rawKeypoints) {
    if (kp.score > 0.3) {
      pts[kp.name] = {
        x: (kp.x / videoWidth)  * renderW + offsetX,
        y: (kp.y / videoHeight) * renderH + offsetY,
        score: kp.score,
      };
    }
  }
  return pts;
}

// Scale for export mode (full resolution, no letterbox offset)
export function scaleKeypointsFull(rawKeypoints) {
  const pts = {};
  for (const kp of rawKeypoints) {
    if (kp.score > 0.3) {
      pts[kp.name] = { x: kp.x, y: kp.y, score: kp.score };
    }
  }
  return pts;
}

// Draw the full skeleton overlay
export function drawSkeleton(ctx, pts, viewMode) {
  ctx.save();

  // --- Connections ---
  for (const [a, b] of SKELETON_CONNECTIONS) {
    if (!pts[a] || !pts[b]) continue;
    ctx.beginPath();
    ctx.moveTo(pts[a].x, pts[a].y);
    ctx.lineTo(pts[b].x, pts[b].y);
    ctx.strokeStyle = 'rgba(0, 180, 216, 0.75)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // --- Joint dots ---
  for (const [name, pt] of Object.entries(pts)) {
    const color = KEYPOINT_COLOR[name] || '#FFFFFF';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // --- Reference lines ---
  drawReferenceLines(ctx, pts, viewMode);

  ctx.restore();
}

// Draw angle arc labels on joints
export function drawAngleLabels(ctx, pts, angles, viewMode) {
  if (!angles) return;
  ctx.save();
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const labelPairs = viewMode === 'sagittal'
    ? [
        { pt: 'left_knee',     val: angles.sagittal?.leftKneeFlexion,  color: '#00B4D8' },
        { pt: 'right_knee',    val: angles.sagittal?.rightKneeFlexion, color: '#FF6B6B' },
        { pt: 'left_hip',      val: angles.sagittal?.leftHipFlexion,   color: '#00B4D8' },
        { pt: 'right_hip',     val: angles.sagittal?.rightHipFlexion,  color: '#FF6B6B' },
        { pt: 'left_elbow',    val: angles.sagittal?.leftElbowFlexion, color: '#00B4D8' },
        { pt: 'right_elbow',   val: angles.sagittal?.rightElbowFlexion,color: '#FF6B6B' },
      ]
    : [
        { pt: 'left_knee',     val: angles.frontal?.leftKneeFPPA,   color: '#00B4D8' },
        { pt: 'right_knee',    val: angles.frontal?.rightKneeFPPA,  color: '#FF6B6B' },
      ];

  for (const { pt, val, color } of labelPairs) {
    if (!pts[pt] || val === null || val === undefined) continue;
    const x = pts[pt].x + 18;
    const y = pts[pt].y - 8;

    // Background pill
    const text = `${val.toFixed(1)}°`;
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = 'rgba(27, 40, 56, 0.85)';
    roundRect(ctx, x - w / 2, y - 10, w, 20, 4);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Reference lines per view mode
function drawReferenceLines(ctx, pts, viewMode) {
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1.2;

  if (viewMode === 'sagittal') {
    // Vertical plumb line from mid-ankle midpoint
    if (pts.left_ankle && pts.right_ankle) {
      const midAx = (pts.left_ankle.x + pts.right_ankle.x) / 2;
      const midAy = (pts.left_ankle.y + pts.right_ankle.y) / 2;
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.45)';
      ctx.beginPath();
      ctx.moveTo(midAx, midAy);
      ctx.lineTo(midAx, midAy - 1200);
      ctx.stroke();

      // Ankle baseline
      ctx.beginPath();
      ctx.moveTo(pts.left_ankle.x - 30, pts.left_ankle.y);
      ctx.lineTo(pts.right_ankle.x + 30, pts.right_ankle.y);
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.35)';
      ctx.stroke();
    }
  } else {
    // Frontal: horizontal reference lines for hips and shoulders
    if (pts.left_hip && pts.right_hip) {
      ctx.strokeStyle = 'rgba(255, 107, 107, 0.45)';
      ctx.beginPath();
      ctx.moveTo(pts.left_hip.x  - 20, pts.left_hip.y);
      ctx.lineTo(pts.right_hip.x + 20, pts.right_hip.y);
      ctx.stroke();
    }
    if (pts.left_shoulder && pts.right_shoulder) {
      ctx.strokeStyle = 'rgba(0, 180, 216, 0.45)';
      ctx.beginPath();
      ctx.moveTo(pts.left_shoulder.x  - 20, pts.left_shoulder.y);
      ctx.lineTo(pts.right_shoulder.x + 20, pts.right_shoulder.y);
      ctx.stroke();
    }
    // Mid-spine vertical
    if (pts.left_hip && pts.right_hip && pts.left_shoulder && pts.right_shoulder) {
      const mh = { x: (pts.left_hip.x + pts.right_hip.x) / 2, y: (pts.left_hip.y + pts.right_hip.y) / 2 };
      const ms = { x: (pts.left_shoulder.x + pts.right_shoulder.x) / 2, y: (pts.left_shoulder.y + pts.right_shoulder.y) / 2 };
      ctx.strokeStyle = 'rgba(144, 224, 239, 0.5)';
      ctx.beginPath();
      ctx.moveTo(ms.x, ms.y - 200);
      ctx.lineTo(mh.x, mh.y + 100);
      ctx.stroke();
    }
  }

  ctx.setLineDash([]);
  ctx.restore();
}
