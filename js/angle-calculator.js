// ===== BioMotion Lab – Angle Calculator =====

// Core 3-point angle (vertex at B)
export function calculateAngle(A, B, C) {
  const BA = { x: A.x - B.x, y: A.y - B.y };
  const BC = { x: C.x - B.x, y: C.y - B.y };
  const dot = BA.x * BC.x + BA.y * BC.y;
  const magBA = Math.hypot(BA.x, BA.y);
  const magBC = Math.hypot(BC.x, BC.y);
  if (magBA === 0 || magBC === 0) return null;
  const cos = Math.min(1, Math.max(-1, dot / (magBA * magBC)));
  return Math.acos(cos) * (180 / Math.PI);
}

// Midpoint helper
export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Angle of a line from vertical (upward Y direction in screen coords is negative)
// Returns degrees of deviation from vertical; 0 = perfectly upright
export function angleFromVertical(topPt, bottomPt) {
  const dx = topPt.x - bottomPt.x;
  const dy = topPt.y - bottomPt.y; // negative = up on screen
  return Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI);
}

// Signed angle from vertical: positive = leaning right, negative = leaning left
export function signedAngleFromVertical(topPt, bottomPt) {
  const dx = topPt.x - bottomPt.x;
  const dy = Math.abs(topPt.y - bottomPt.y);
  return Math.atan2(dx, dy) * (180 / Math.PI);
}

// Signed angle of a line from horizontal
// Positive = right side higher (in screen coords, right side has smaller y)
export function signedAngleFromHorizontal(leftPt, rightPt) {
  const dx = rightPt.x - leftPt.x;
  const dy = rightPt.y - leftPt.y; // positive dy = right side lower
  return Math.atan2(-dy, dx) * (180 / Math.PI);
}

// ---------- Compute ALL angles from keypoint map ----------
// pts: { name: {x, y, score} }
// Returns object with all computed angles (null if keypoints missing)
export function computeAllAngles(pts) {
  const get = (name) => pts[name] ?? null;

  const safe3 = (A, B, C) => {
    const a = get(A), b = get(B), c = get(C);
    if (!a || !b || !c) return null;
    return parseFloat(calculateAngle(a, b, c).toFixed(2));
  };

  // --- Sagittal ---
  const leftKneeFlexion  = safe3('left_hip',  'left_knee',   'left_ankle');
  const rightKneeFlexion = safe3('right_hip', 'right_knee',  'right_ankle');
  const leftHipFlexion   = safe3('left_shoulder',  'left_hip',  'left_knee');
  const rightHipFlexion  = safe3('right_shoulder', 'right_hip', 'right_knee');
  const leftElbowFlexion = safe3('left_shoulder',  'left_elbow',  'left_wrist');
  const rightElbowFlexion= safe3('right_shoulder', 'right_elbow', 'right_wrist');
  const leftShoulderFlexion = safe3('left_elbow',  'left_shoulder',  'left_hip');
  const rightShoulderFlexion= safe3('right_elbow', 'right_shoulder', 'right_hip');

  // Trunk inclination: deviation of spine from vertical
  // Use midpoints of hips and shoulders, with nose as head reference
  let trunkInclination = null;
  const lh = get('left_hip'), rh = get('right_hip');
  const ls = get('left_shoulder'), rs = get('right_shoulder');
  if (lh && rh && ls && rs) {
    const midHip = midpoint(lh, rh);
    const midShoulder = midpoint(ls, rs);
    trunkInclination = parseFloat(angleFromVertical(midShoulder, midHip).toFixed(2));
  }

  // --- Frontal ---
  // Knee FPPA (Frontal Plane Projection Angle) – same keypoints as knee flexion
  // but meaningful from front view; deviation from 180° = valgus/varus
  const leftKneeFPPA  = safe3('left_hip',  'left_knee',  'left_ankle');
  const rightKneeFPPA = safe3('right_hip', 'right_knee', 'right_ankle');

  // Shoulder abduction – frontal
  const leftShoulderAbduction  = safe3('left_hip',  'left_shoulder',  'left_elbow');
  const rightShoulderAbduction = safe3('right_hip', 'right_shoulder', 'right_elbow');

  // Trunk lateral flexion
  let trunkLateralFlexion = null;
  if (lh && rh && ls && rs) {
    const midHip2 = midpoint(lh, rh);
    const midShoulder2 = midpoint(ls, rs);
    trunkLateralFlexion = parseFloat(signedAngleFromVertical(midShoulder2, midHip2).toFixed(2));
  }

  // Shoulder tilt (elevation asymmetry)
  let shoulderTilt = null;
  if (ls && rs) {
    shoulderTilt = parseFloat(signedAngleFromHorizontal(ls, rs).toFixed(2));
  }

  // Pelvic tilt / hip drop (Trendelenburg)
  let pelvisTilt = null;
  if (lh && rh) {
    pelvisTilt = parseFloat(signedAngleFromHorizontal(lh, rh).toFixed(2));
  }

  return {
    sagittal: {
      leftKneeFlexion,
      rightKneeFlexion,
      leftHipFlexion,
      rightHipFlexion,
      leftElbowFlexion,
      rightElbowFlexion,
      leftShoulderFlexion,
      rightShoulderFlexion,
      trunkInclination,
    },
    frontal: {
      leftKneeFPPA,
      rightKneeFPPA,
      leftShoulderAbduction,
      rightShoulderAbduction,
      trunkLateralFlexion,
      shoulderTilt,
      pelvisTilt,
    },
  };
}
