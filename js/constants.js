// ===== BioMotion Lab – Constants & Normative Data =====

export const SKELETON_CONNECTIONS = [
  ['left_shoulder',  'left_elbow'],
  ['left_elbow',     'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow',    'right_wrist'],
  ['left_shoulder',  'right_shoulder'],
  ['left_shoulder',  'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip',       'right_hip'],
  ['left_hip',       'left_knee'],
  ['left_knee',      'left_ankle'],
  ['right_hip',      'right_knee'],
  ['right_knee',     'right_ankle'],
  ['nose',           'left_eye'],
  ['nose',           'right_eye'],
  ['left_eye',       'left_ear'],
  ['right_eye',      'right_ear'],
];

export const JOINT_COLORS = {
  head:     '#FFD700',
  upper:    '#00B4D8',
  lower:    '#FF6B6B',
  spine:    '#90E0EF',
};

// Color coding per keypoint group
export const KEYPOINT_COLOR = {
  nose: JOINT_COLORS.head,
  left_eye: JOINT_COLORS.head,
  right_eye: JOINT_COLORS.head,
  left_ear: JOINT_COLORS.head,
  right_ear: JOINT_COLORS.head,
  left_shoulder: JOINT_COLORS.upper,
  right_shoulder: JOINT_COLORS.upper,
  left_elbow: JOINT_COLORS.upper,
  right_elbow: JOINT_COLORS.upper,
  left_wrist: JOINT_COLORS.upper,
  right_wrist: JOINT_COLORS.upper,
  left_hip: JOINT_COLORS.lower,
  right_hip: JOINT_COLORS.lower,
  left_knee: JOINT_COLORS.lower,
  right_knee: JOINT_COLORS.lower,
  left_ankle: JOINT_COLORS.lower,
  right_ankle: JOINT_COLORS.lower,
};

// ===== NORMATIVE ROM DATA (degrees) =====
// Sources: Physiopedia, CDC Normal Joint ROM Study, published clinical literature
// All values represent typical active range of motion for healthy adults.
export const NORMATIVE_ROM = {
  // ---- Sagittal plane ----
  kneeFlexion: {
    label: 'Knee Flexion',
    unit: '°',
    description: 'Full extension (0°) to maximum flexion',
    displayKey: 'both',
    plane: 'sagittal',
    ranges: {
      '18-30': { male: { min: 0,  max: 140 }, female: { min: 0,  max: 145 } },
      '31-50': { male: { min: 0,  max: 135 }, female: { min: 0,  max: 140 } },
      '51+':   { male: { min: 0,  max: 128 }, female: { min: 0,  max: 133 } },
    },
  },
  hipFlexion: {
    label: 'Hip Flexion',
    unit: '°',
    description: 'Neutral standing to maximum flexion',
    displayKey: 'both',
    plane: 'sagittal',
    ranges: {
      '18-30': { male: { min: 90, max: 125 }, female: { min: 95,  max: 135 } },
      '31-50': { male: { min: 85, max: 120 }, female: { min: 90,  max: 128 } },
      '51+':   { male: { min: 80, max: 110 }, female: { min: 82,  max: 118 } },
    },
  },
  shoulderFlexion: {
    label: 'Shoulder Flexion',
    unit: '°',
    description: 'Arm at side to overhead elevation',
    displayKey: 'both',
    plane: 'sagittal',
    ranges: {
      '18-30': { male: { min: 150, max: 180 }, female: { min: 155, max: 183 } },
      '31-50': { male: { min: 145, max: 175 }, female: { min: 150, max: 178 } },
      '51+':   { male: { min: 138, max: 168 }, female: { min: 140, max: 170 } },
    },
  },
  elbowFlexion: {
    label: 'Elbow Flexion',
    unit: '°',
    description: 'Full extension to maximum flexion',
    displayKey: 'both',
    plane: 'sagittal',
    ranges: {
      '18-30': { male: { min: 130, max: 148 }, female: { min: 132, max: 152 } },
      '31-50': { male: { min: 128, max: 145 }, female: { min: 130, max: 148 } },
      '51+':   { male: { min: 122, max: 140 }, female: { min: 124, max: 143 } },
    },
  },
  trunkInclination: {
    label: 'Trunk Inclination',
    unit: '°',
    description: 'Forward lean from vertical during movement',
    displayKey: 'single',
    plane: 'sagittal',
    ranges: {
      'all': { male: { min: 0, max: 45 }, female: { min: 0, max: 45 } },
    },
  },

  // ---- Frontal plane ----
  kneeFPPA: {
    label: 'Knee FPPA',
    unit: '°',
    description: 'Frontal Plane Projection Angle. 180° = neutral; lower = valgus collapse',
    displayKey: 'both',
    plane: 'frontal',
    ranges: {
      'all': { male: { min: 168, max: 192 }, female: { min: 164, max: 192 } },
    },
  },
  trunkLateralFlexion: {
    label: 'Trunk Lateral Flexion',
    unit: '°',
    description: 'Lateral trunk lean from vertical. 0° = upright; positive = lean right',
    displayKey: 'single',
    plane: 'frontal',
    ranges: {
      'all': { male: { min: -5, max: 5 }, female: { min: -5, max: 5 } },
    },
  },
  shoulderTilt: {
    label: 'Shoulder Elevation',
    unit: '°',
    description: 'Shoulder line tilt from horizontal. Positive = right higher',
    displayKey: 'single',
    plane: 'frontal',
    ranges: {
      'all': { male: { min: -5, max: 5 }, female: { min: -5, max: 5 } },
    },
  },
  pelvisTilt: {
    label: 'Pelvic Tilt (frontal)',
    unit: '°',
    description: 'Hip line tilt from horizontal (Trendelenburg indicator). 0° = level',
    displayKey: 'single',
    plane: 'frontal',
    ranges: {
      'all': { male: { min: -5, max: 5 }, female: { min: -5, max: 5 } },
    },
  },
  shoulderAbduction: {
    label: 'Shoulder Abduction',
    unit: '°',
    description: 'Arm raise to the side from neutral',
    displayKey: 'both',
    plane: 'frontal',
    ranges: {
      '18-30': { male: { min: 150, max: 185 }, female: { min: 152, max: 185 } },
      '31-50': { male: { min: 145, max: 180 }, female: { min: 147, max: 180 } },
      '51+':   { male: { min: 138, max: 173 }, female: { min: 140, max: 173 } },
    },
  },
};

// ===== SAGITTAL VIEW MODE CONFIGURATION =====
export const SAGITTAL_ANGLES = [
  {
    id: 'leftKneeFlexion',
    label: 'Knee Flexion',
    side: 'left',
    normativeKey: 'kneeFlexion',
    keypoints: ['left_hip', 'left_knee', 'left_ankle'],
  },
  {
    id: 'rightKneeFlexion',
    label: 'Knee Flexion',
    side: 'right',
    normativeKey: 'kneeFlexion',
    keypoints: ['right_hip', 'right_knee', 'right_ankle'],
  },
  {
    id: 'leftHipFlexion',
    label: 'Hip Flexion',
    side: 'left',
    normativeKey: 'hipFlexion',
    keypoints: ['left_shoulder', 'left_hip', 'left_knee'],
  },
  {
    id: 'rightHipFlexion',
    label: 'Hip Flexion',
    side: 'right',
    normativeKey: 'hipFlexion',
    keypoints: ['right_shoulder', 'right_hip', 'right_knee'],
  },
  {
    id: 'leftElbowFlexion',
    label: 'Elbow Flexion',
    side: 'left',
    normativeKey: 'elbowFlexion',
    keypoints: ['left_shoulder', 'left_elbow', 'left_wrist'],
  },
  {
    id: 'rightElbowFlexion',
    label: 'Elbow Flexion',
    side: 'right',
    normativeKey: 'elbowFlexion',
    keypoints: ['right_shoulder', 'right_elbow', 'right_wrist'],
  },
  {
    id: 'leftShoulderFlexion',
    label: 'Shoulder Flexion',
    side: 'left',
    normativeKey: 'shoulderFlexion',
    keypoints: ['left_elbow', 'left_shoulder', 'left_hip'],
  },
  {
    id: 'rightShoulderFlexion',
    label: 'Shoulder Flexion',
    side: 'right',
    normativeKey: 'shoulderFlexion',
    keypoints: ['right_elbow', 'right_shoulder', 'right_hip'],
  },
  {
    id: 'trunkInclination',
    label: 'Trunk Inclination',
    side: 'single',
    normativeKey: 'trunkInclination',
    keypoints: null, // computed specially
  },
];

// ===== FRONTAL VIEW MODE CONFIGURATION =====
export const FRONTAL_ANGLES = [
  {
    id: 'leftKneeFPPA',
    label: 'Knee FPPA',
    side: 'left',
    normativeKey: 'kneeFPPA',
    keypoints: ['left_hip', 'left_knee', 'left_ankle'],
  },
  {
    id: 'rightKneeFPPA',
    label: 'Knee FPPA',
    side: 'right',
    normativeKey: 'kneeFPPA',
    keypoints: ['right_hip', 'right_knee', 'right_ankle'],
  },
  {
    id: 'leftShoulderAbduction',
    label: 'Shoulder Abduction',
    side: 'left',
    normativeKey: 'shoulderAbduction',
    keypoints: ['left_hip', 'left_shoulder', 'left_elbow'],
  },
  {
    id: 'rightShoulderAbduction',
    label: 'Shoulder Abduction',
    side: 'right',
    normativeKey: 'shoulderAbduction',
    keypoints: ['right_hip', 'right_shoulder', 'right_elbow'],
  },
  {
    id: 'trunkLateralFlexion',
    label: 'Trunk Lateral Flexion',
    side: 'single',
    normativeKey: 'trunkLateralFlexion',
    keypoints: null, // computed specially
  },
  {
    id: 'shoulderTilt',
    label: 'Shoulder Elevation',
    side: 'single',
    normativeKey: 'shoulderTilt',
    keypoints: null, // computed specially
  },
  {
    id: 'pelvisTilt',
    label: 'Pelvic Tilt',
    side: 'single',
    normativeKey: 'pelvisTilt',
    keypoints: null, // computed specially
  },
];

// Chart display groups (pairs of L/R or single angles)
export const SAGITTAL_CHART_GROUPS = [
  { key: 'kneeFlexion',    title: 'Knee Flexion',     leftId: 'leftKneeFlexion',    rightId: 'rightKneeFlexion',    normKey: 'kneeFlexion' },
  { key: 'hipFlexion',     title: 'Hip Flexion',      leftId: 'leftHipFlexion',     rightId: 'rightHipFlexion',     normKey: 'hipFlexion' },
  { key: 'elbowFlexion',   title: 'Elbow Flexion',    leftId: 'leftElbowFlexion',   rightId: 'rightElbowFlexion',   normKey: 'elbowFlexion' },
  { key: 'shoulderFlex',   title: 'Shoulder Flexion', leftId: 'leftShoulderFlexion', rightId: 'rightShoulderFlexion', normKey: 'shoulderFlexion' },
  { key: 'trunkIncl',      title: 'Trunk Inclination', singleId: 'trunkInclination', normKey: 'trunkInclination' },
];

export const FRONTAL_CHART_GROUPS = [
  { key: 'kneeFPPA',         title: 'Knee FPPA',            leftId: 'leftKneeFPPA',         rightId: 'rightKneeFPPA',         normKey: 'kneeFPPA' },
  { key: 'shoulderAbd',      title: 'Shoulder Abduction',   leftId: 'leftShoulderAbduction', rightId: 'rightShoulderAbduction', normKey: 'shoulderAbduction' },
  { key: 'trunkLateral',     title: 'Trunk Lateral Flexion', singleId: 'trunkLateralFlexion', normKey: 'trunkLateralFlexion' },
  { key: 'shoulderTiltChart',title: 'Shoulder Elevation',   singleId: 'shoulderTilt',        normKey: 'shoulderTilt' },
  { key: 'pelvisTiltChart',  title: 'Pelvic Tilt',          singleId: 'pelvisTilt',          normKey: 'pelvisTilt' },
];
